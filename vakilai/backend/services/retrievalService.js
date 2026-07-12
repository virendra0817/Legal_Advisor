import { generateQueryEmbedding, EmbeddingError } from "./embeddingService.js";
import { queryNamespace, userNamespace, kbNamespace, PineconeError } from "./pineconeClient.js";

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class RetrievalError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = "RetrievalError";
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

// ─── Configuration ────────────────────────────────────────────────────────────

// How many chunks to request from EACH namespace before merging. We ask
// for more than we ultimately need (FINAL_TOP_K) because merging across
// two sources and deduplicating means some fraction of raw results get
// discarded — over-fetching here is cheap, under-fetching would silently
// degrade answer quality.
const PER_NAMESPACE_TOP_K = 10;

// How many chunks survive the merge and get sent to Claude as context.
// Tuned to balance answer groundedness against prompt size/cost — more
// chunks isn't strictly better past a point, since irrelevant chunks can
// dilute the signal Claude needs to focus on.
const FINAL_TOP_K = 8;

// Minimum cosine similarity score for a chunk to be considered relevant
// at all. Chunks below this are noise relative to the query, even if they
// happen to rank within the requested topK — better to return fewer,
// more relevant chunks than to pad results with weak matches.
const MIN_RELEVANCE_SCORE = 0.72;

// ─── Retrieve Relevant Context for a Query ─────────────────────────────────────
// The single entry point for this file. Embeds the query once, then
// searches the user's personal document namespace and the relevant
// knowledge-base namespace(s) IN PARALLEL, merges results, deduplicates,
// filters by relevance threshold, and returns the final ranked chunk list.

export const retrieveContext = async (queryText, options = {}) => {
  const {
    userId,
    categorySlugs = [], // one or more KB categories to search, e.g. ["property-rera"]
    documentIds = null, // optional: restrict user-namespace results to specific documents
    topK = FINAL_TOP_K,
  } = options;

  if (!userId) {
    throw new RetrievalError("userId is required for retrieval.", "MISSING_USER_ID", false);
  }

  // ── 1. Embed the query once ──────────────────────────────────────────────────
  // Both namespace searches reuse this single embedding — embedding is the
  // expensive, latency-sensitive step, so we never embed the same query twice.

  let queryEmbedding;

  try {
    queryEmbedding = await generateQueryEmbedding(queryText);
  } catch (error) {
    if (error instanceof EmbeddingError) {
      throw new RetrievalError(error.message, error.code, error.isRetryable);
    }
    throw new RetrievalError(
      `Unexpected error embedding query: ${error.message}`,
      "UNEXPECTED_EMBEDDING_ERROR",
      true
    );
  }

  // ── 2. Build the list of namespace searches to run in parallel ─────────────

  const searches = [];

  // User's personal document namespace — always searched if the user has
  // any documents at all (queryNamespace returns [] gracefully if not,
  // per the "namespace not found" handling in pineconeClient.js).
  searches.push({
    namespace: userNamespace(userId.toString()),
    source: "user_document",
    filter: documentIds?.length ? { documentId: { $in: documentIds } } : null,
  });

  // One search per requested KB category — a chat message scoped to
  // "property-rera" might also want to search a related category like
  // "consumer-protection" if the frontend passes multiple slugs, but
  // typically this is a single-element array driven by the active
  // legal category in the chat session.
  for (const slug of categorySlugs) {
    searches.push({
      namespace: kbNamespace(slug),
      source: "kb_statute",
      filter: null,
    });
  }

  // ── 3. Run all namespace searches in parallel ───────────────────────────────
  // Promise.all is safe here because queryNamespace already handles its
  // own "namespace doesn't exist yet" case by returning [] rather than
  // throwing — so one empty namespace never causes Promise.all to reject
  // and take down searches against the other, populated namespaces.

  let searchResults;

  try {
    searchResults = await Promise.all(
      searches.map((s) =>
        queryNamespace(queryEmbedding, s.namespace, {
          topK: PER_NAMESPACE_TOP_K,
          filter: s.filter,
        }).then((matches) => matches.map((m) => ({ ...m, source: s.source })))
      )
    );
  } catch (error) {
    if (error instanceof PineconeError) {
      throw new RetrievalError(error.message, error.code, error.isRetryable);
    }
    throw new RetrievalError(
      `Unexpected error during namespace search: ${error.message}`,
      "UNEXPECTED_SEARCH_ERROR",
      true
    );
  }

  const allMatches = searchResults.flat();

  // ── 4. Merge, deduplicate, filter, and rank ─────────────────────────────────

  const mergedChunks = mergeAndRank(allMatches, topK);

  return {
    chunks: mergedChunks,
    queryEmbeddingDimensions: queryEmbedding.length,
    namespacesSearched: searches.map((s) => s.namespace),
    totalRawMatches: allMatches.length,
  };
};

// ─── Merge, Deduplicate, and Rank Results ──────────────────────────────────────

const mergeAndRank = (allMatches, topK) => {
  // Deduplicate by chunk ID — in principle a chunk should only ever exist
  // in one namespace, but defensive deduplication costs nothing and
  // protects against any future scenario where the same content might be
  // indexed in two places (e.g. a KB article that's also referenced
  // verbatim inside a user's uploaded document).
  const seenIds = new Set();
  const deduplicated = [];

  // Sort by score descending FIRST, so when we deduplicate we keep
  // whichever instance of a duplicate ID scored higher.
  const sortedByScore = [...allMatches].sort((a, b) => b.score - a.score);

  for (const match of sortedByScore) {
    if (seenIds.has(match.id)) continue;
    seenIds.add(match.id);
    deduplicated.push(match);
  }

  // Filter out weak matches below the relevance floor
  const relevant = deduplicated.filter((m) => m.score >= MIN_RELEVANCE_SCORE);

  // Take the top K after filtering
  const topMatches = relevant.slice(0, topK);

  // Shape the final output — this is the exact structure ragChatService.js
  // consumes to build the Claude prompt and render citations
  return topMatches.map((match) => ({
    chunkId: match.id,
    score: match.score,
    source: match.source, // "user_document" | "kb_statute"
    text: match.metadata.text,
    heading: match.metadata.heading || null,
    headingType: match.metadata.headingType || null,
    documentId: match.metadata.documentId || null,
    fileName: match.metadata.fileName || null,
  }));
};

export { FINAL_TOP_K, MIN_RELEVANCE_SCORE, PER_NAMESPACE_TOP_K };
