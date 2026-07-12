import { getStructuredCompletion, ClaudeAnalysisError } from "./mistralClient.js";

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class FactExtractorError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = "FactExtractorError";
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

// ─── Build the Extraction Schema for a Specific Slot ───────────────────────────
// The schema is built dynamically per-slot rather than being one large
// fixed schema for "extract everything" — this keeps each extraction call
// narrowly scoped to interpreting the user's reply as an answer to ONE
// specific question, which is both more accurate (less for the model to
// get wrong) and matches how intakeStateManager.js drives the conversation
// one slot at a time.

const buildExtractionSchema = (slot) => {
  const valueSchema = buildValueSchemaForSlotType(slot);

  return {
    type: "object",
    properties: {
      wasAnswered: {
        type: "boolean",
        description:
          "True if the user's message actually provides an answer to the question asked, " +
          "even if phrased indirectly. False if they asked a different question, changed the " +
          "subject, or gave a non-answer like 'I don't know'.",
      },
      wasSkipped: {
        type: "boolean",
        description:
          "True if the user explicitly declined to answer (e.g. 'I'd rather not say', " +
          "'not sure', 'I don't know') rather than simply not addressing the question.",
      },
      value: valueSchema,
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "Confidence that the extracted value correctly captures what the user meant.",
      },
      otherFactsMentioned: {
        type: "array",
        items: { type: "string" },
        description:
          "Any OTHER relevant facts the user volunteered in this message that weren't asked " +
          "for but could be useful later (e.g. they mention a specific date while answering a " +
          "different question). Plain text notes, not structured — empty array if none.",
      },
    },
    required: ["wasAnswered", "wasSkipped", "value", "confidence", "otherFactsMentioned"],
    additionalProperties: false,
  };
};

// ─── Map a Slot's Type to a JSON Schema Value Type ─────────────────────────────

const buildValueSchemaForSlotType = (slot) => {
  switch (slot.type) {
    case "boolean":
      return {
        type: ["boolean", "null"],
        description: "true/false based on the user's answer, or null if not answered/skipped.",
      };
    case "enum":
      return {
        type: ["string", "null"],
        enum: [...slot.options, null],
        description: "One of the allowed options, or null if not answered/skipped.",
      };
    case "number":
      return {
        type: ["number", "null"],
        description: "The numeric value mentioned, or null if not answered/skipped.",
      };
    case "date":
      return {
        type: ["string", "null"],
        description:
          "The date as a string, preserving whatever precision the user gave " +
          "(e.g. 'March 2023', '15 January 2024', 'about two years ago'), or null.",
      };
    default:
      return {
        type: ["string", "null"],
        description: "The free-text value extracted from the user's answer, or null.",
      };
  }
};

// ─── Build the System Prompt ────────────────────────────────────────────────────

const buildExtractionSystemPrompt = (slot, issueSummary) => {
  return `You are extracting a structured answer from a user's reply during a legal intake conversation for VakilAI.

CONTEXT: ${issueSummary || "No prior context available."}

QUESTION THAT WAS ASKED: "${slot.question}"
EXPECTED ANSWER TYPE: ${slot.type}${slot.options ? ` (one of: ${slot.options.join(", ")})` : ""}

Your only job is to interpret the user's reply below AS AN ANSWER TO THIS SPECIFIC QUESTION. Do not answer the question yourself, do not provide legal advice, and do not evaluate whether the answer is "good" — just extract what they said.

If their reply doesn't address this question at all (they asked something else, changed topic, or gave an unrelated response), set wasAnswered to false and wasSkipped to false — this signals the conversation should redirect back to the question rather than treating silence as an answer.`;
};

// ─── Extract a Structured Answer ────────────────────────────────────────────────
// Phase 4 of the consultation workflow. Takes the slot that was being
// asked about and the user's free-text reply, returns the parsed
// structured value plus metadata about how the extraction went.

export const extractAnswer = async (slot, userReply, issueSummary = null) => {
  if (!userReply || userReply.trim().length === 0) {
    throw new FactExtractorError("Cannot extract from an empty reply.", "EMPTY_REPLY", false);
  }

  const systemPrompt = buildExtractionSystemPrompt(slot, issueSummary);
  const userPrompt = `User's reply: "${userReply.trim()}"`;

  try {
    const result = await getStructuredCompletion({
      systemPrompt,
      userPrompt,
      jsonSchema: buildExtractionSchema(slot),
      maxTokens: 512,
    });

    return {
      slotKey: slot.key,
      wasAnswered: result.data.wasAnswered,
      wasSkipped: result.data.wasSkipped,
      value: result.data.value,
      confidence: result.data.confidence,
      otherFactsMentioned: result.data.otherFactsMentioned || [],
      rawUserText: userReply.trim(),
    };
  } catch (error) {
    if (error instanceof ClaudeAnalysisError) {
      throw new FactExtractorError(error.message, error.code, error.isRetryable);
    }
    throw new FactExtractorError(
      `Unexpected error during fact extraction: ${error.message}`,
      "UNEXPECTED_EXTRACTION_ERROR",
      true
    );
  }
};
