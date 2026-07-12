import Document from "../models/Document.js";
import { chunkDocument } from "./chunkingService.js";
import { generateEmbeddings, EmbeddingError } from "./embeddingService.js";
import {
  upsertChunks,
  deleteDocumentVectors,
  userNamespace,
  PineconeError,
} from "./pineconeClient.js";
import { structureDocument } from "./textStructurer.js";

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class VectorIngestionError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = "VectorIngestionError";
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

// ─── Ingest a Document into the Vector Store ───────────────────────────────────
// The single entry point for turning a "ready" document (text already
// extracted and structured by the Document Processing module) into
// searchable vectors. This is the bridge between that earlier module and
// the RAG retrieval layer — it does not extract text itself, it consumes
// the already-extracted text.

export const ingestDocument = async (documentId, userId) => {
  // ── 1. Fetch the document with its extracted text ──────────────────────────

  const document = await Document.findOne({
    _id: documentId,
    userId,
    isDeleted: false,
  }).select("+parsedContent.rawText");

  if (!document) {
    throw new VectorIngestionError("Document not found.", "DOCUMENT_NOT_FOUND", false);
  }

  if (document.status !== "ready") {
    throw new VectorIngestionError(
      `Document is not ready for ingestion (status: ${document.status}).`,
      "DOCUMENT_NOT_READY",
      false
    );
  }

  if (!document.parsedContent?.rawText) {
    throw new VectorIngestionError(
      "Document has no extracted text to ingest.",
      "NO_TEXT_AVAILABLE",
      false
    );
  }

  // ── 2. Re-derive structured sections from the cleaned text ─────────────────
  // textStructurer.js's output (the `sections` array) is intentionally NOT
  // persisted on the Document model — see the documentProcessingWorker.js
  // comment on this exact decision. We re-run structuring here, which is
  // cheap (pure string processing, no AI call) and avoids storing the same
  // structured data in two places that could drift out of sync.

  const { sections } = structureDocument(document.parsedContent.rawText);

  if (sections.length === 0) {
    throw new VectorIngestionError(
      "Document produced no structurable sections to chunk.",
      "NO_SECTIONS",
      false
    );
  }

  // ── 3. Chunk the document ────────────────────────────────────────────────────

  const chunks = chunkDocument(sections, {
    documentId: documentId.toString(),
    fileName: document.fileName,
  });

  if (chunks.length === 0) {
    throw new VectorIngestionError(
      "Chunking produced no chunks from this document.",
      "NO_CHUNKS",
      false
    );
  }

  // ── 4. Generate embeddings ───────────────────────────────────────────────────

  let embeddedChunks;

  try {
    embeddedChunks = await generateEmbeddings(chunks);
  } catch (error) {
    if (error instanceof EmbeddingError) {
      throw new VectorIngestionError(error.message, error.code, error.isRetryable);
    }
    throw new VectorIngestionError(
      `Unexpected error during embedding: ${error.message}`,
      "UNEXPECTED_EMBEDDING_ERROR",
      true
    );
  }

  // ── 5. Upsert into the user's namespace ──────────────────────────────────────
  // Document chunks always go into the per-user namespace, never the
  // shared KB namespace — that strict separation is what the two-namespace
  // strategy depends on. KB ingestion is a deliberately separate,
  // admin-only process (covered by a future "knowledge base seeding"
  // script, not this user-facing pipeline).

  const namespace = userNamespace(userId.toString());

  let upsertResult;

  try {
    upsertResult = await upsertChunks(embeddedChunks, namespace);
  } catch (error) {
    if (error instanceof PineconeError) {
      throw new VectorIngestionError(error.message, error.code, error.isRetryable);
    }
    throw new VectorIngestionError(
      `Unexpected error during vector upsert: ${error.message}`,
      "UNEXPECTED_UPSERT_ERROR",
      true
    );
  }

  // ── 6. Update the Document record ────────────────────────────────────────────

  document.chunkCount = upsertResult.upsertedCount;
  await document.save();

  return {
    documentId: documentId.toString(),
    chunkCount: upsertResult.upsertedCount,
    namespace,
  };
};

// ─── Re-ingest a Document ───────────────────────────────────────────────────────
// Deletes existing vectors for this document before re-chunking and
// re-embedding. Necessary when re-running ingestion after the source text
// has changed (e.g. an improved OCR pass) — without first deleting, stale
// chunks from the old chunking boundaries would remain in Pinecone
// alongside the new ones, since chunk IDs are positional (documentId_0,
// documentId_1, ...) and a shorter re-chunked document would leave
// higher-indexed old chunks orphaned rather than overwritten.

export const reingestDocument = async (documentId, userId) => {
  const namespace = userNamespace(userId.toString());

  try {
    await deleteDocumentVectors(documentId.toString(), namespace);
  } catch (error) {
    // Log but don't block re-ingestion on a cleanup failure — the new
    // upsert will still overwrite any chunk IDs that happen to match,
    // and leftover orphaned chunks from a shrunk document are a minor
    // data-quality issue, not a correctness-blocking one.
    console.warn(
      `Failed to clean up existing vectors for document ${documentId} before re-ingestion:`,
      error.message
    );
  }

  return ingestDocument(documentId, userId);
};

// ─── Remove a Document's Vectors ────────────────────────────────────────────────
// Called by the document deletion cleanup job (after the soft-delete
// grace period from the Upload module elapses).

export const removeDocumentVectors = async (documentId, userId) => {
  const namespace = userNamespace(userId.toString());

  try {
    await deleteDocumentVectors(documentId.toString(), namespace);
    return { success: true };
  } catch (error) {
    if (error instanceof PineconeError) {
      throw new VectorIngestionError(error.message, error.code, error.isRetryable);
    }
    throw error;
  }
};
