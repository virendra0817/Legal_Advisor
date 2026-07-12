import Anthropic from "@anthropic-ai/sdk";
import { retrieveContext, RetrievalError } from "./retrievalService.js";
import { buildIntakeSummary, getMissingRequiredFacts } from "./intakeStateManager.js";
import { getIntakeSchema } from "../config/legalIntakeSchemas.js";

// ─── Configuration ────────────────────────────────────────────────────────────

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const anthropic = new Anthropic({ apiKey: MISTRAL_API_KEY, maxRetries: 2, timeout: 60 * 1000 });
const GUIDANCE_MODEL = process.env.MISTRAL_CHAT_MODEL || "mistral-small";
const GUIDANCE_MAX_TOKENS = 2048;

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class GuidanceGeneratorError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = "GuidanceGeneratorError";
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

// ─── Generate Final Legal Guidance ─────────────────────────────────────────────
// Phase 6 — the culmination of the entire consultation. Takes the fully
// (or partially, if the question ceiling was hit) populated intake session,
// builds a rich retrieval query from everything gathered, runs it through
// the existing RAG pipeline (retrieveContext from the RAG module), and
// synthesises a grounded, structured guidance response.
//
// This deliberately reuses retrievalService.js rather than re-implementing
// retrieval — the consultation's job is to get the QUERY into a
// high-information state before retrieval runs, not to duplicate the
// retrieval logic itself.

export const generateGuidance = async (session, options = {}) => {
  const { documentIds = null } = options;

  if (!session.categorySlug) {
    throw new GuidanceGeneratorError(
      "Cannot generate guidance without a classified legal category.",
      "NO_CATEGORY",
      false
    );
  }

  const intakeSummary = buildIntakeSummary(session);
  const missingFacts = getMissingRequiredFacts(session);
  const schema = getIntakeSchema(session.categorySlug);

  // ── 1. Build a high-information retrieval query from gathered facts ────────
  // Rather than retrieving based on the user's original opening message
  // alone (which may have been vague — that's exactly why intake happened),
  // we construct a dense query from everything established during intake.
  // This is the single highest-leverage step for retrieval QUALITY in this
  // entire module: a well-formed query retrieves dramatically better
  // context than a vague one.

  const retrievalQuery = buildRetrievalQuery(intakeSummary, schema.categoryLabel);

  let retrieval;

  try {
    retrieval = await retrieveContext(retrievalQuery, {
      userId: session.userId.toString(),
      categorySlugs: [session.categorySlug],
      documentIds,
      topK: 10, // slightly higher than chat default — guidance benefits from broader grounding
    });
  } catch (error) {
    if (error instanceof RetrievalError) {
      throw new GuidanceGeneratorError(error.message, error.code, error.isRetryable);
    }
    throw new GuidanceGeneratorError(
      `Unexpected error during guidance retrieval: ${error.message}`,
      "UNEXPECTED_RETRIEVAL_ERROR",
      true
    );
  }

  // ── 2. Build the guidance prompt ─────────────────────────────────────────────

  const systemPrompt = buildGuidanceSystemPrompt(intakeSummary, missingFacts, retrieval.chunks);

  // ── 3. Call Claude ────────────────────────────────────────────────────────────

  let response;

  try {
    response = await anthropic.messages.create({
      model: GUIDANCE_MODEL,
      max_tokens: GUIDANCE_MAX_TOKENS,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Based on everything gathered during our conversation, please provide your guidance now.",
        },
      ],
    });
  } catch (error) {
    throw mapClaudeError(error);
  }

  const textBlock = response.content.find((block) => block.type === "text");
  const guidanceText = textBlock?.text || "";

  const citations = extractCitations(guidanceText, retrieval.chunks);

  return {
    guidanceText,
    citations,
    sourceChunks: retrieval.chunks,
    intakeSummary,
    missingFacts,
    wasPartialIntake: missingFacts.length > 0,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
};

// ─── Build the Retrieval Query from Intake Facts ───────────────────────────────
// Converts the structured facts gathered during intake into a single dense
// natural-language query optimised for semantic retrieval — this is NOT
// the prompt shown to Claude, it's purely the search query used to find
// relevant chunks.

const buildRetrievalQuery = (intakeSummary, categoryLabel) => {
  const factsLine = intakeSummary.facts.join(". ");
  return `${categoryLabel}. ${intakeSummary.issueSummary || ""}. ${factsLine}`.trim();
};

// ─── Build the Guidance System Prompt ──────────────────────────────────────────
// This is the most consultant-like prompt in the whole module — it
// explicitly asks for guidance STRUCTURED the way a real legal consultant
// would deliver it: situation recap, relevant law, practical options,
// risks, and clear next steps. Grounding rules mirror ragChatService.js's
// citation pattern for consistency across the app.

const buildGuidanceSystemPrompt = (intakeSummary, missingFacts, chunks) => {
  const factsBlock = intakeSummary.facts.length > 0
    ? intakeSummary.facts.map((f) => `- ${f}`).join("\n")
    : "(No specific facts were gathered.)";

  const missingFactsNote =
    missingFacts.length > 0
      ? `\n\nNOTE: The following details were not established during the conversation: ${missingFacts.join(", ")}. Acknowledge this explicitly in your guidance and note how it could affect the answer, rather than presenting guidance as if these were known.`
      : "";

  const contextBlock =
    chunks.length > 0
      ? chunks
          .map((chunk, i) => {
            const sourceLabel =
              chunk.source === "user_document"
                ? `User's document: ${chunk.fileName || "uploaded document"}`
                : "Legal knowledge base";
            const headingLine = chunk.heading ? ` — ${chunk.heading}` : "";
            return `[${i + 1}] (${sourceLabel}${headingLine})\n${chunk.text}`;
          })
          .join("\n\n")
      : "(No specific supporting context was found in the knowledge base or uploaded documents.)";

  return `You are a senior legal consultant at VakilAI speaking with a client about their situation under Indian law. You have just finished gathering information from them and are now ready to provide your guidance, exactly as a consultant would after an intake conversation.

SITUATION GATHERED:
Category: ${intakeSummary.categoryLabel}
Summary: ${intakeSummary.issueSummary}

FACTS ESTABLISHED:
${factsBlock}${missingFactsNote}

--- SUPPORTING LEGAL CONTEXT ---
${contextBlock}
--- END CONTEXT ---

STRUCTURE YOUR GUIDANCE AS A CONSULTANT WOULD:
1. Briefly acknowledge the situation in your own words (1-2 sentences). Confirm you understood it correctly.
2. Explain the relevant legal position in plain language, citing context excerpts with [1], [2] etc. where you draw on them.
3. Lay out the practical options available, in order of how commonly they're pursued.
4. Note any real risks, deadlines, or limitation periods relevant to acting on this.
5. Give clear, concrete next steps: what to do first.

TONE AND BOUNDARIES:
- Speak directly to the client ("you"), warmly and clearly, the way a good consultant speaks in a first meeting, not like a legal textbook.
- Ground every specific legal claim in the provided context. If the context doesn't cover something, say so rather than filling the gap with assumed knowledge.
- You are providing legal information to help the client understand their situation and options, not formal legal advice, and you are not their lawyer of record. Close with a brief, natural recommendation to consult a licensed advocate for formal advice specific to filing or representation, without being repetitive about this if you've already made it clear.
- Do not ask further questions in this response. The intake conversation is complete. This is the guidance, not another question.`;
};

// ─── Extract Citations (mirrors ragChatService.js) ─────────────────────────────

const extractCitations = (text, chunks) => {
  const markerPattern = /\[(\d+)\]/g;
  const citedIndices = new Set();

  let match;
  while ((match = markerPattern.exec(text)) !== null) {
    const index = parseInt(match[1], 10) - 1;
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

// ─── Map Mistral SDK Errors ───────────────────────────────────────────────────────

const mapClaudeError = (error) => {
  const status = error?.status;
  if (status === 429) return new GuidanceGeneratorError("Mistral API rate limit reached.", "RATE_LIMITED", true);
  if (status === 529) return new GuidanceGeneratorError("Mistral API is temporarily overloaded.", "API_OVERLOADED", true);
  if (status >= 500) return new GuidanceGeneratorError(`Mistral API server error: ${error.message}`, "API_SERVER_ERROR", true);
  if (status === 400) return new GuidanceGeneratorError(`Invalid request to Mistral API: ${error.message}`, "INVALID_REQUEST", false);
  if (status === 401 || status === 403) {
    console.error("FATAL: Mistral API authentication failed. Check MISTRAL_API_KEY.");
    return new GuidanceGeneratorError("Mistral API authentication failed.", "AUTH_ERROR", false);
  }
  if (!status) return new GuidanceGeneratorError(`Network error calling Mistral API: ${error.message}`, "NETWORK_ERROR", true);
  return new GuidanceGeneratorError(`Unexpected Mistral API error: ${error.message}`, "UNKNOWN_API_ERROR", true);
};
