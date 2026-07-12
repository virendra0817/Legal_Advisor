import Document from "../models/Document.js";
import { readFile } from "../utils/fileStorage.js";
import { processDocument, DocumentProcessingError } from "../services/documentProcessor.js";

// ─── Worker Configuration ──────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000;        // check for new documents every 5 seconds
const BATCH_SIZE = 3;                 // process up to 3 documents per poll cycle
const MAX_RETRY_ATTEMPTS = 2;         // retryable failures get 2 attempts before permanent failure
const PROCESSING_TIMEOUT_MS = 120000; // 2 minutes — guards against a hung extraction

// ─── In-memory Retry Tracking ──────────────────────────────────────────────────
// Tracks retry counts per document for the lifetime of the worker process.
// This is intentionally NOT persisted to MongoDB — a worker restart resetting
// retry counts is an acceptable trade-off for the simplicity of not needing
// an extra schema field, and genuinely transient errors are rare enough that
// this doesn't meaningfully change outcomes in practice.

const retryAttempts = new Map(); // documentId (string) → attempt count

// ─── Main Polling Loop ─────────────────────────────────────────────────────────
// Runs continuously while the worker process is alive. Each cycle:
//   1. Find documents with status "uploaded" (not yet picked up)
//   2. Atomically claim them by flipping to "processing"
//   3. Process each one through the pipeline
//   4. Mark "ready" on success, "failed" or re-queue on error

export const startDocumentProcessingWorker = () => {
  console.log(
    `Document processing worker started (poll every ${POLL_INTERVAL_MS / 1000}s, ` +
    `batch size ${BATCH_SIZE})`
  );

  const intervalId = setInterval(() => {
    runPollCycle().catch((error) => {
      // A failure in the poll cycle itself (e.g. DB connection drop)
      // should never crash the worker — log and let the next interval retry
      console.error("Document processing worker poll cycle error:", error);
    });
  }, POLL_INTERVAL_MS);

  // Return a stop function so server.js can cleanly shut the worker down
  // during graceful shutdown (SIGTERM/SIGINT)
  return () => {
    clearInterval(intervalId);
    console.log("Document processing worker stopped.");
  };
};

// ─── Single Poll Cycle ──────────────────────────────────────────────────────────

const runPollCycle = async () => {
  const claimedDocuments = await claimUploadedDocuments();

  if (claimedDocuments.length === 0) return; // nothing to do this cycle

  console.log(`Worker picked up ${claimedDocuments.length} document(s) for processing.`);

  // Process documents in parallel within the batch — extraction is CPU-bound
  // but I/O-waiting (disk reads), so concurrent processing within a small
  // batch size is safe and faster than strictly sequential processing.
  await Promise.all(claimedDocuments.map((doc) => processSingleDocument(doc)));
};

// ─── Atomically Claim Documents ────────────────────────────────────────────────
// Uses findOneAndUpdate in a loop rather than find() + bulk update, so that
// if multiple worker instances are ever run concurrently (horizontal scaling),
// they cannot both claim the same document. findOneAndUpdate's atomicity at
// the MongoDB level is what prevents the race condition here.

const claimUploadedDocuments = async () => {
  const claimed = [];

  for (let i = 0; i < BATCH_SIZE; i++) {
    const doc = await Document.findOneAndUpdate(
      { status: "uploaded", isDeleted: false },
      { $set: { status: "processing" } },
      { new: true, sort: { uploadedAt: 1 } } // oldest uploads processed first (FIFO fairness)
    ).select("+parsedContent.rawText"); // need to write into this field later

    if (!doc) break; // no more documents waiting
    claimed.push(doc);
  }

  return claimed;
};

// ─── Process a Single Claimed Document ─────────────────────────────────────────

const processSingleDocument = async (document) => {
  const documentId = document._id.toString();

  try {
    // Read the file from storage
    const buffer = await withTimeout(
      readFile(document.storageKey, document.storageProvider),
      PROCESSING_TIMEOUT_MS,
      "File read timed out"
    );

    // Run the full extraction → clean → structure pipeline
    const result = await withTimeout(
      processDocument(buffer, document.fileExtension),
      PROCESSING_TIMEOUT_MS,
      "Document processing timed out"
    );

    // Success — persist the structured result and mark ready
    await markDocumentReady(document, result);

    retryAttempts.delete(documentId); // clear retry tracking on success

    console.log(
      `Processed document ${documentId} (${document.fileExtension}) — ` +
      `${result.sectionCount} sections, ${result.wordCount} words, ` +
      `${result.processing.processingTimeMs}ms`
    );
  } catch (error) {
    await handleProcessingFailure(document, error);
  }
};

// ─── Persist a Successful Processing Result ────────────────────────────────────

const markDocumentReady = async (document, result) => {
  document.status = "ready";
  document.processedAt = new Date();

  document.parsedContent = {
    rawText: result.rawText,
    pageCount: result.pageCount,
    wordCount: result.wordCount,
    language: result.language,
    ocrApplied: result.ocrApplied,
  };

  document.metadata = {
    documentType: result.metadata.documentType,
    detectedActs: result.metadata.detectedActs,
    detectedDates: result.metadata.detectedDates,
    parties: document.metadata?.parties || [], // parties extraction happens in a later module (NER-based)
  };

  // Note: chunkCount stays at its default (0) here — that field is owned
  // by the RAG ingestion module (embedding + Pinecone upsert), which runs
  // as a separate downstream step once a document reaches "ready".
  // Structured sections (result.sections) are intentionally NOT stored on
  // the Document model itself — they're ephemeral output consumed directly
  // by the RAG chunking step, not persisted long-term, to avoid duplicating
  // data that will shortly be re-derived into Pinecone-bound chunks anyway.

  await document.save();
};

// ─── Handle a Processing Failure ───────────────────────────────────────────────
// Decides between re-queueing (retryable, attempts remaining) and permanent
// failure (not retryable, or retries exhausted).

const handleProcessingFailure = async (document, error) => {
  const documentId = document._id.toString();
  const currentAttempts = retryAttempts.get(documentId) || 0;

  const isRetryable = error instanceof DocumentProcessingError ? error.isRetryable : true;
  const errorCode = error instanceof DocumentProcessingError ? error.code : "UNKNOWN_ERROR";
  const errorMessage = error.message || "Unknown processing error.";

  console.error(
    `Failed to process document ${documentId}: [${errorCode}] ${errorMessage} ` +
    `(attempt ${currentAttempts + 1}/${MAX_RETRY_ATTEMPTS + 1})`
  );

  if (isRetryable && currentAttempts < MAX_RETRY_ATTEMPTS) {
    // Re-queue: flip status back to "uploaded" so the next poll cycle
    // picks it up again. Track the attempt count in memory.
    retryAttempts.set(documentId, currentAttempts + 1);

    await Document.findByIdAndUpdate(document._id, {
      $set: { status: "uploaded" },
    });

    return;
  }

  // Permanent failure — either not retryable, or retries exhausted
  retryAttempts.delete(documentId);

  await Document.findByIdAndUpdate(document._id, {
    $set: {
      status: "failed",
      processingError: `[${errorCode}] ${errorMessage}`,
    },
  });
};

// ─── Timeout Wrapper ────────────────────────────────────────────────────────────
// Wraps a promise with a hard timeout. Without this, a pathological file
// (e.g. a PDF that triggers an infinite loop in a parsing library) could
// hang a worker slot indefinitely, slowly starving the whole pipeline as
// more documents pile up unprocessed.

const withTimeout = (promise, timeoutMs, timeoutMessage) => {
  let timeoutHandle;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new DocumentProcessingError(timeoutMessage, "PROCESSING_TIMEOUT", true));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
};

// ─── Manual Trigger (for testing / admin re-processing) ───────────────────────
// Allows re-processing a specific document on demand — e.g. an admin
// endpoint that lets a user retry a permanently failed upload.

export const reprocessDocument = async (documentId) => {
  const document = await Document.findById(documentId);

  if (!document) {
    throw new DocumentProcessingError("Document not found.", "DOCUMENT_NOT_FOUND", false);
  }

  document.status = "uploaded";
  document.processingError = null;
  await document.save();

  retryAttempts.delete(documentId.toString());

  // The next poll cycle will pick it up automatically; this function
  // just resets state so that happens, rather than processing inline,
  // to keep all actual processing funneled through the same worker path.
};
