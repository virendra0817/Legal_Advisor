import {
  getStructuredCompletion,
  ClaudeAnalysisError,
} from "./mistralClient.js";
import { getAllCategorySlugs, getIntakeSchema } from "../config/legalIntakeSchemas.js";

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class IssueClassifierError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = "IssueClassifierError";
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

// ─── JSON Schema for Classification Output ─────────────────────────────────────
// A deliberately small, fast schema — classification should be quick and
// cheap since it runs on literally the first message of every consultation.
// categorySlug is constrained to an enum of the actual configured categories
// PLUS "unclear", so the model has an explicit, valid way to say "I don't
// have enough information yet" rather than being forced to guess.

const buildClassificationSchema = () => ({
  type: "object",
  properties: {
    categorySlug: {
      type: "string",
      enum: [...getAllCategorySlugs(), "unclear"],
      description:
        "The legal category that best matches the user's situation, or 'unclear' " +
        "if the opening message does not contain enough information to classify confidently.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Confidence in this classification.",
    },
    issueSummary: {
      type: "string",
      description:
        "A single, neutral sentence summarising the user's situation as understood so far, " +
        "written in third person (e.g. 'User's landlord is withholding the security deposit " +
        "after move-out'). Used internally for context, not shown verbatim to the user.",
    },
    clarifyingQuestionIfUnclear: {
      type: "string",
      description:
        "If categorySlug is 'unclear', a single natural follow-up question to ask the user " +
        "to help identify the legal area. Empty string if categorySlug is not 'unclear'.",
    },
  },
  required: ["categorySlug", "confidence", "issueSummary", "clarifyingQuestionIfUnclear"],
  additionalProperties: false,
});

// ─── System Prompt ──────────────────────────────────────────────────────────────

const buildClassificationSystemPrompt = () => {
  const categoryDescriptions = getAllCategorySlugs()
    .filter((slug) => slug !== "general-legal-query")
    .map((slug) => `- ${slug}: ${getIntakeSchema(slug).categoryLabel}`)
    .join("\n");

  return `You are the intake classifier for VakilAI, an AI legal consultant for Indian users. Your only job right now is to identify which legal category best matches the user's opening message. You are NOT answering their question or giving advice yet.

AVAILABLE CATEGORIES:
${categoryDescriptions}
- general-legal-query: Use only when the situation genuinely doesn't fit any specific category above

CLASSIFICATION RULES:
- If the message clearly describes a situation matching one category, classify with high or medium confidence.
- If the message is too vague to classify (e.g. "I need legal help" with no further detail), use categorySlug "unclear" and provide a single, warm, specific clarifying question, not a generic "can you tell me more?"
- Do not ask multiple questions at once.
- Write the issueSummary neutrally and factually — this is for internal use, not a message to the user.`;
};

// ─── Classify the Legal Issue ───────────────────────────────────────────────────
// Phase 1 of the consultation workflow. Takes the user's opening message
// (and optionally subsequent messages if the first one was "unclear") and
// returns a category classification.

export const classifyIssue = async (userMessage) => {
  if (!userMessage || userMessage.trim().length === 0) {
    throw new IssueClassifierError("Cannot classify an empty message.", "EMPTY_MESSAGE", false);
  }

  const systemPrompt = buildClassificationSystemPrompt();
  const userPrompt = `Classify the legal category for this message:\n\n"${userMessage.trim()}"`;

  try {
    const result = await getStructuredCompletion({
      systemPrompt,
      userPrompt,
      jsonSchema: buildClassificationSchema(),
      maxTokens: 512, // classification is small — keep this call fast and cheap
    });

    return {
      categorySlug: result.data.categorySlug === "unclear" ? null : result.data.categorySlug,
      confidence: result.data.confidence,
      issueSummary: result.data.issueSummary,
      clarifyingQuestion:
        result.data.categorySlug === "unclear" ? result.data.clarifyingQuestionIfUnclear : null,
      isUnclear: result.data.categorySlug === "unclear",
    };
  } catch (error) {
    if (error instanceof MistralAnalysisError) {
      throw new IssueClassifierError(error.message, error.code, error.isRetryable);
    }
    throw new IssueClassifierError(
      `Unexpected error during classification: ${error.message}`,
      "UNEXPECTED_CLASSIFICATION_ERROR",
      true
    );
  }
};
