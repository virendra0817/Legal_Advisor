import { HfInference } from "@huggingface/inference";

// ─── Configuration ────────────────────────────────────────────────────────────

const HF_API_KEY = process.env.HF_API_KEY;

if (!HF_API_KEY) {
  console.error("FATAL: HF_API_KEY is not set in environment.");
  process.exit(1);
}

const hf = new HfInference(HF_API_KEY);

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "BAAI/bge-small-en-v1.5";
const EMBEDDING_DIMENSIONS = 384; // fixed for BAAI/bge-small-en-v1.5 — must match the Pinecone index dimension

// The HF Inference API doesn't publish a hard input/token ceiling the way
// OpenAI's batch embeddings endpoint does, but free-tier requests can be
// rate-limited and slow calls with huge payloads are more likely to time
// out or fail. We keep batching conservative for the same reasons as before.
const MAX_INPUTS_PER_BATCH = 100;
const MAX_TOKENS_PER_BATCH = 150000; // conservative estimate-based ceiling

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class EmbeddingError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = "EmbeddingError";
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

// ─── Rough Token Estimator ────────────────────────────────────────────────────
// A precise tokenizer count would be more accurate, but for batching purposes
// a conservative word-based estimate (English averages ~1.3 tokens/word,
// we use 2 for safety margin given embedded legal terminology and Hindi/
// Indic-script content tends to tokenize less efficiently than English)
// is sufficient — we only need to stay safely under the batch ceiling,
// not hit an exact count.

const estimateTokens = (text) => {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 2);
};

// ─── Generate Embeddings for a Batch of Chunks ─────────────────────────────────
// Takes an array of chunk objects (from chunkingService.js, each with a
// `text` field) and returns the same chunks with an `embedding` field
// added. Internally splits into sub-batches respecting both the input-count
// and token-count ceilings, and embeds each sub-batch sequentially to
// avoid bursting past the Hugging Face Inference API's rate limit.

export const generateEmbeddings = async (chunks) => {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return [];
  }

  const batches = splitIntoBatches(chunks);
  const embeddedChunks = [];

  for (const batch of batches) {
    const batchResults = await embedBatch(batch);
    embeddedChunks.push(...batchResults);
  }

  return embeddedChunks;
};

// ─── Split Chunks into Safe Batches ─────────────────────────────────────────────

const splitIntoBatches = (chunks) => {
  const batches = [];
  let currentBatch = [];
  let currentTokenEstimate = 0;

  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk.text);

    const wouldExceedLimits =
      currentBatch.length >= MAX_INPUTS_PER_BATCH ||
      currentTokenEstimate + chunkTokens > MAX_TOKENS_PER_BATCH;

    if (wouldExceedLimits && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokenEstimate = 0;
    }

    currentBatch.push(chunk);
    currentTokenEstimate += chunkTokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
};

// ─── Embed a Single Batch ───────────────────────────────────────────────────────
// featureExtraction accepts an array of strings via `inputs` and returns
// results in the same order, so we can zip them back onto chunks by index —
// same pattern as the original OpenAI/Groq implementation.

const embedBatch = async (batch) => {
  try {
    const output = await hf.featureExtraction({
      model: EMBEDDING_MODEL,
      inputs: batch.map((chunk) => chunk.text),
    });

    return batch.map((chunk, i) => ({
      ...chunk,
      embedding: normalizeEmbeddingOutput(output[i]),
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
    }));
  } catch (error) {
    throw mapEmbeddingError(error, batch.length);
  }
};

// ─── Generate a Single Query Embedding ─────────────────────────────────────────
// Used by retrievalService.js to embed an incoming user question. Kept as
// a separate function (rather than calling generateEmbeddings with a
// one-item array) because query embedding is on the hot path of every
// chat message and benefits from being a direct, minimal call without
// the batching machinery designed for bulk document ingestion.

export const generateQueryEmbedding = async (queryText) => {
  if (!queryText || queryText.trim().length === 0) {
    throw new EmbeddingError("Cannot embed empty query text.", "EMPTY_QUERY", false);
  }

  try {
    const output = await hf.featureExtraction({
      model: EMBEDDING_MODEL,
      inputs: queryText,
    });

    return normalizeEmbeddingOutput(output);
  } catch (error) {
    throw mapEmbeddingError(error, 1);
  }
};

// ─── Normalize HF Output Shape ───────────────────────────────────────────────
// Depending on the model and whether the API applies pooling server-side,
// featureExtraction can return a flat vector (number[]) or a 2D array of
// per-token vectors (number[][]) that still needs mean-pooling into a
// single sentence embedding. This guards against both shapes so callers
// always get back a flat number[] of length EMBEDDING_DIMENSIONS.

const normalizeEmbeddingOutput = (vector) => {
  if (Array.isArray(vector) && typeof vector[0] === "number") {
    return vector;
  }

  if (Array.isArray(vector) && Array.isArray(vector[0])) {
    const tokenCount = vector.length;
    const dims = vector[0].length;
    const pooled = new Array(dims).fill(0);

    for (const tokenVec of vector) {
      for (let d = 0; d < dims; d++) {
        pooled[d] += tokenVec[d];
      }
    }

    return pooled.map((sum) => sum / tokenCount);
  }

  throw new EmbeddingError(
    "Unexpected embedding output shape from Hugging Face Inference API.",
    "INVALID_OUTPUT_SHAPE",
    false
  );
};

// ─── Map Hugging Face Inference API Errors ───────────────────────────────────

const mapEmbeddingError = (error, batchSize) => {
  const status = error?.httpResponse?.status ?? error?.status;
  const message = error?.message || "";

  if (status === 429 || message.toLowerCase().includes("rate limit")) {
    return new EmbeddingError(
      `Hugging Face rate limit reached while embedding batch of ${batchSize}.`,
      "RATE_LIMITED",
      true
    );
  }

  if (status === 503 || message.toLowerCase().includes("loading")) {
    // Free-tier HF Inference API can return 503 while a model is "cold" and
    // spinning up on their infrastructure — this is transient and safe to retry.
    return new EmbeddingError(
      `Hugging Face model is warming up (cold start): ${message}`,
      "MODEL_LOADING",
      true
    );
  }

  if (status >= 500) {
    return new EmbeddingError(
      `Hugging Face server error during embedding: ${message}`,
      "API_SERVER_ERROR",
      true
    );
  }

  if (status === 400 || status === 422) {
    return new EmbeddingError(
      `Invalid embedding request (likely a chunk exceeds the model's token limit): ${message}`,
      "INVALID_INPUT",
      false
    );
  }

  if (status === 401 || status === 403) {
    console.error("FATAL: Hugging Face API authentication failed. Check HF_API_KEY.");
    return new EmbeddingError("Hugging Face API authentication failed.", "AUTH_ERROR", false);
  }

  if (!status) {
    return new EmbeddingError(
      `Network error calling Hugging Face Inference API: ${message}`,
      "NETWORK_ERROR",
      true
    );
  }

  return new EmbeddingError(`Unexpected embedding error: ${message}`, "UNKNOWN_ERROR", true);
};

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };