import { Mistral } from "@mistralai/mistralai";
import { retrieveContext, RetrievalError } from "./retrievalService.js";

// ─── Configuration ────────────────────────────────────────────────────────────

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

if (!MISTRAL_API_KEY) {
  console.error("FATAL: MISTRAL_API_KEY is not set in environment.");
  process.exit(1);
}

const mistral = new Mistral({
  apiKey: MISTRAL_API_KEY,
});

const CHAT_MODEL = process.env.MISTRAL_CHAT_MODEL || "mistral-large-latest";
const CHAT_MAX_TOKENS = 2048;

// Maximum number of prior turns (user+assistant pairs) included as
// conversation history in the prompt — bounds prompt size on long chat
// sessions.
const MAX_HISTORY_TURNS = 6;

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class RagChatError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = "RagChatError";
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

// ─── Generate a RAG-Grounded Chat Response ─────────────────────────────────────

export const generateRagResponse = async (userMessage, options = {}) => {
  const {
    userId,
    categorySlugs = [],
    documentIds = null,
    conversationHistory = [],
    categoryDisclaimer = null,
    stream = false,
  } = options;

  // ── 1. Retrieve relevant context ─────────────────────────────────────────────

  let retrieval;

  try {
    retrieval = await retrieveContext(userMessage, { userId, categorySlugs, documentIds });
  } catch (error) {
    if (error instanceof RetrievalError) {
      throw new RagChatError(error.message, error.code, error.isRetryable);
    }
    throw new RagChatError(
      `Unexpected error during retrieval: ${error.message}`,
      "UNEXPECTED_RETRIEVAL_ERROR",
      true
    );
  }

  // ── 2. Build system prompt ────────────────────────────────────────────────────

  const systemPrompt = buildSystemPrompt(retrieval.chunks, categoryDisclaimer);

  // ── 3. Build messages array
  // Mistral does NOT have a top-level `system` param — the system message
  // goes as the first entry in the messages array with role: "system".

  const trimmedHistory = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);

  const messages = [
    { role: "system", content: systemPrompt },
    ...trimmedHistory.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: userMessage },
  ];

  // ── 4. Call Mistral ───────────────────────────────────────────────────────────

  if (stream) {
    return {
      stream: createStreamingCompletion(messages),
      sourceChunks: retrieval.chunks,
      retrievalMeta: {
        namespacesSearched: retrieval.namespacesSearched,
        totalRawMatches: retrieval.totalRawMatches,
        chunksUsed: retrieval.chunks.length,
      },
    };
  }

  let response;

  try {
    response = await mistral.chat.complete({
      model: CHAT_MODEL,
      maxTokens: CHAT_MAX_TOKENS,
      messages,
    });
  } catch (error) {
    throw mapMistralError(error);
  }

  // Mistral response shape:
  // response.choices[0].message.content  — answer text
  // response.usage.promptTokens          — input tokens
  // response.usage.completionTokens      — output tokens
  const answerText = response.choices?.[0]?.message?.content || "";
  const citations = extractCitations(answerText, retrieval.chunks);

  return {
    answer: answerText,
    citations,
    sourceChunks: retrieval.chunks,
    usage: {
      inputTokens: response.usage?.promptTokens ?? 0,
      outputTokens: response.usage?.completionTokens ?? 0,
    },
    retrievalMeta: {
      namespacesSearched: retrieval.namespacesSearched,
      totalRawMatches: retrieval.totalRawMatches,
      chunksUsed: retrieval.chunks.length,
    },
  };
};

// ─── Streaming Variant ────────────────────────────────────────────────────────
// Returns the raw Mistral stream — the chat controller pipes this to the
// client over SSE. We return the stream rather than consuming it here so
// this service stays transport-agnostic.

const createStreamingCompletion = (messages) => {
  try {
    return mistral.chat.stream({
      model: CHAT_MODEL,
      maxTokens: CHAT_MAX_TOKENS,
      messages,
    });
  } catch (error) {
    throw mapMistralError(error);
  }
};

// ─── Build the Grounded System Prompt ────────────────────────────────────────

const buildSystemPrompt = (chunks, categoryDisclaimer) => {
  const disclaimerLine = categoryDisclaimer
    ? `\n\nIMPORTANT DISCLAIMER TO INCLUDE WHEN RELEVANT: ${categoryDisclaimer}`
    : "";

  if (chunks.length === 0) {
    return `You are VakilAI, an AI legal information assistant for Indian users. No relevant context was found in the legal knowledge base or the user's uploaded documents for this question.

Tell the user clearly that you don't have specific grounded information to answer this precisely, and offer to help if they can provide more detail or upload a relevant document. Do not fabricate legal provisions, case citations, or document contents. You may still provide general, clearly-labelled background knowledge about Indian law if relevant, but distinguish this explicitly from grounded, document-specific answers.${disclaimerLine}`;
  }

  const contextBlock = chunks
    .map((chunk, i) => {
      const sourceLabel =
        chunk.source === "user_document"
          ? `User's document: ${chunk.fileName || "uploaded document"}`
          : "Legal knowledge base";

      const headingLine = chunk.heading ? ` — ${chunk.heading}` : "";

      return `[${i + 1}] (${sourceLabel}${headingLine})\n${chunk.text}`;
    })
    .join("\n\n");

  return `You are VakilAI, an AI legal information assistant for Indian users. Answer the user's question using ONLY the numbered context excerpts below. Cite the specific excerpt number(s) you used in square brackets, e.g. "[1]" or "[2][3]", immediately after each claim that depends on that source.

RULES:
- Ground every factual claim in the provided context. If the context doesn't fully answer the question, say so explicitly rather than filling gaps with assumptions.
- Distinguish between content from the user's own uploaded documents and content from the general legal knowledge base — be clear about which is which when relevant.
- Write in plain language. Avoid unnecessary legal jargon.
- You are providing legal information, not legal advice. Do not tell the user definitively what they must do — surface the relevant information and let them decide, suggesting they consult a licensed advocate for advice specific to their situation.
- If asked something the context doesn't cover, say so plainly rather than speculating.${disclaimerLine}

--- CONTEXT EXCERPTS ---

${contextBlock}

--- END CONTEXT ---`;
};

// ─── Extract Citation Markers from the Answer ─────────────────────────────────

const extractCitations = (answerText, chunks) => {
  const markerPattern = /\[(\d+)\]/g;
  const citedIndices = new Set();

  let match;
  while ((match = markerPattern.exec(answerText)) !== null) {
    const index = parseInt(match[1], 10) - 1; // markers are 1-indexed in the prompt
    if (index >= 0 && index < chunks.length) {
      citedIndices.add(index);
    }
  }

  return [...citedIndices].map((index) => {
    const chunk = chunks[index];
    return {
      marker: index + 1,
      chunkId: chunk.chunkId,
      source: chunk.source,
      heading: chunk.heading,
      documentId: chunk.documentId,
      fileName: chunk.fileName,
      excerpt: chunk.text.slice(0, 200),
    };
  });
};

// ─── Map Mistral API Errors ───────────────────────────────────────────────────

const mapMistralError = (error) => {
  const status = error?.status ?? error?.httpStatus;

  if (status === 429) {
    return new RagChatError("Mistral API rate limit reached.", "RATE_LIMITED", true);
  }
  if (status >= 500) {
    return new RagChatError(`Mistral API server error: ${error.message}`, "API_SERVER_ERROR", true);
  }
  if (status === 400) {
    return new RagChatError(`Invalid request to Mistral API: ${error.message}`, "INVALID_REQUEST", false);
  }
  if (status === 401 || status === 403) {
    console.error("FATAL: Mistral API authentication failed. Check MISTRAL_API_KEY.");
    return new RagChatError("Mistral API authentication failed.", "AUTH_ERROR", false);
  }
  if (!status) {
    return new RagChatError(`Network error calling Mistral API: ${error.message}`, "NETWORK_ERROR", true);
  }
  return new RagChatError(`Unexpected Mistral API error: ${error.message}`, "UNKNOWN_API_ERROR", true);
};

export { CHAT_MODEL, MAX_HISTORY_TURNS };