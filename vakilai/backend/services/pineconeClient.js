
import { Pinecone } from "@pinecone-database/pinecone";
import { EMBEDDING_DIMENSIONS } from "./embeddingService.js";

// ─── Configuration ────────────────────────────────────────────────────────────

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "vakilai-legal-docs";

if (!PINECONE_API_KEY) {
  console.error("FATAL: PINECONE_API_KEY is not set in environment.");
  process.exit(1);
}

const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

// Cached index handle — resolved once on first use via describeIndex (which
// gives us the explicit host), then reused for every subsequent operation.
// Targeting by host rather than by name avoids an extra lookup on every
// single upsert/query call.
let cachedIndex = null;

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class PineconeError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = "PineconeError";
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

// ─── Get or Create the Index Handle ────────────────────────────────────────────
// FIX: pinecone.index(name, host) — v3 SDK takes positional args, not an object.

const getIndex = async () => {
  if (cachedIndex) return cachedIndex;

  try {
    const indexModel = await pinecone.describeIndex(PINECONE_INDEX_NAME);

    if (indexModel.dimension !== EMBEDDING_DIMENSIONS) {
      throw new PineconeError(
        `Pinecone index "${PINECONE_INDEX_NAME}" has dimension ${indexModel.dimension}, ` +
        `but the embedding model produces ${EMBEDDING_DIMENSIONS}-dimensional vectors. ` +
        `These must match exactly.`,
        "DIMENSION_MISMATCH",
        false
      );
    }

    // FIX: was pinecone.index({ host: indexModel.host }) — invalid in v3
    cachedIndex = pinecone.index(PINECONE_INDEX_NAME, indexModel.host);
    return cachedIndex;
  } catch (error) {
    if (error instanceof PineconeError) throw error;

    throw new PineconeError(
      `Failed to connect to Pinecone index "${PINECONE_INDEX_NAME}": ${error.message}`,
      "INDEX_CONNECTION_FAILED",
      true
    );
  }
};

// ─── Namespace Naming Conventions ──────────────────────────────────────────────

export const userNamespace = (userId) => `user_${userId}`;

export const kbNamespace = (categorySlug) => `kb_${categorySlug}`;

// ─── Upsert Chunks into a Namespace ────────────────────────────────────────────
// FIX: namespace scoped via index.namespace(ns).upsert() — not passed inside
// the upsert body, which is invalid in v3.

export const upsertChunks = async (chunks, namespace) => {
  if (!Array.isArray(chunks) || chunks.length === 0) return { upsertedCount: 0 };

  const index = await getIndex();

  const records = chunks.map((chunk) => ({
    id: chunk.chunkId,
    values: chunk.embedding,
    metadata: {
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      text: truncateForMetadata(chunk.text, 2000),
      heading: chunk.heading || "",
      headingType: chunk.headingType || "",
      wordCount: chunk.wordCount,
      fileName: chunk.fileName || "",
    },
  }));

  const UPSERT_BATCH_SIZE = 100;
  let totalUpserted = 0;

  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);

    try {
      // FIX: was index.upsert({ namespace, records: batch })
      await index.namespace(namespace).upsert(batch);
      totalUpserted += batch.length;
    } catch (error) {
      throw mapPineconeError(error, "upsert");
    }
  }

  return { upsertedCount: totalUpserted };
};

// ─── Query a Namespace for Similar Vectors ─────────────────────────────────────
// FIX: namespace scoped via index.namespace(ns).query() — passing namespace
// inside the query body throws "Object contained invalid properties: namespace"
// in v3.

export const queryNamespace = async (queryEmbedding, namespace, options = {}) => {
  const { topK = 8, filter = null, includeMetadata = true } = options;

  const index = await getIndex();

  try {
    // FIX: was index.query({ namespace, vector, topK, ... })
    const result = await index.namespace(namespace).query({
      vector: queryEmbedding,
      topK,
      includeMetadata,
      ...(filter ? { filter } : {}),
    });

    return (result.matches || []).map((match) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata || {},
      namespace,
    }));
  } catch (error) {
    if (isNamespaceNotFoundError(error)) {
      return [];
    }

    throw mapPineconeError(error, "query");
  }
};

// ─── Delete All Vectors for a Document ─────────────────────────────────────────
// FIX: namespace scoped via index.namespace(ns).deleteMany() — not passed
// inside the deleteMany body.

export const deleteDocumentVectors = async (documentId, namespace) => {
  const index = await getIndex();

  try {
    // FIX: was index.deleteMany({ namespace, filter: { ... } })
    await index.namespace(namespace).deleteMany({
      filter: { documentId: { $eq: documentId } },
    });
    return { success: true };
  } catch (error) {
    if (isNamespaceNotFoundError(error)) {
      return { success: true };
    }
    throw mapPineconeError(error, "delete");
  }
};

// ─── Delete an Entire Namespace ─────────────────────────────────────────────────
// FIX: index.deleteNamespace() does not exist in v3 — replaced with
// index.namespace(ns).deleteAll(), which is the correct v3 equivalent.

export const deleteUserNamespace = async (userId) => {
  const index = await getIndex();
  const namespace = userNamespace(userId);

  try {
    // FIX: was index.deleteNamespace(namespace)
    await index.namespace(namespace).deleteAll();
    return { success: true };
  } catch (error) {
    if (isNamespaceNotFoundError(error)) {
      return { success: true };
    }
    throw mapPineconeError(error, "deleteNamespace");
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const truncateForMetadata = (text, maxLength) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trim() + "…";
};

const isNamespaceNotFoundError = (error) => {
  const message = error?.message?.toLowerCase() || "";
  return message.includes("namespace not found") || error?.status === 404;
};

const mapPineconeError = (error, operation) => {
  const status = error?.status;

  if (status === 429) {
    return new PineconeError(
      `Pinecone rate limit reached during ${operation}.`,
      "RATE_LIMITED",
      true
    );
  }

  if (status >= 500) {
    return new PineconeError(
      `Pinecone server error during ${operation}: ${error.message}`,
      "API_SERVER_ERROR",
      true
    );
  }

  if (status === 401 || status === 403) {
    console.error("FATAL: Pinecone API authentication failed. Check PINECONE_API_KEY.");
    return new PineconeError("Pinecone API authentication failed.", "AUTH_ERROR", false);
  }

  if (!status) {
    return new PineconeError(
      `Network error during Pinecone ${operation}: ${error.message}`,
      "NETWORK_ERROR",
      true
    );
  }

  return new PineconeError(
    `Unexpected Pinecone error during ${operation}: ${error.message}`,
    "UNKNOWN_ERROR",
    true
  );
};