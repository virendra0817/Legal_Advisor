import ConsultationSession from "../models/ConsultationSession.js";
import { classifyIssue, IssueClassifierError } from "./issueClassifier.js";
import {
  computePhase,
  getNextSlotToAsk,
  MAX_QUESTIONS_PER_CONSULTATION,
} from "./intakeStateManager.js";
import { extractAnswer, FactExtractorError } from "./factExtractor.js";
import { generateGuidance, GuidanceGeneratorError } from "./guidanceGenerator.js";
import { getIntakeSchema } from "../config/legalIntakeSchemas.js";
import { getStructuredCompletion, ClaudeAnalysisError } from "./mistralClient.js";

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class ConsultationError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = "ConsultationError";
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

// ─── Process One Conversational Turn ───────────────────────────────────────────
// The single entry point for the entire consultation module. Called once
// per incoming user message. Loads (or creates) the session, computes the
// current phase BEFORE doing anything else, and routes to the correct
// phase handler. Every phase handler returns the same shape — a message
// to show the user plus the updated session — so the controller never
// needs to know which phase actually ran.

export const processConsultationTurn = async (chatId, userId, userMessage) => {
  let session = await ConsultationSession.findOne({ chatId });

  if (!session) {
    session = await ConsultationSession.create({ chatId, userId });
  }

  // Phase is ALWAYS recomputed from stored state at the top of every turn —
  // never trusted from a prior in-memory value, and never decided by the
  // model. This is the single source of truth referenced throughout this
  // module's design.
  const currentPhase = computePhase(session);

  switch (currentPhase) {
    case "identifying_issue":
      return handleIdentifyingIssue(session, userMessage);

    case "gathering_information":
      return handleGatheringInformation(session, userMessage);

    case "ready_for_guidance":
      return handleReadyForGuidance(session);

    case "guidance_provided":
      return handlePostGuidanceFollowUp(session, userMessage);

    default:
      throw new ConsultationError(`Unknown consultation phase: ${currentPhase}`, "UNKNOWN_PHASE", false);
  }
};

// ─── Phase 1 Handler: Identifying the Issue ────────────────────────────────────

const handleIdentifyingIssue = async (session, userMessage) => {
  let classification;

  try {
    classification = await classifyIssue(userMessage);
  } catch (error) {
    throw wrapPhaseError(error, IssueClassifierError);
  }

  if (classification.isUnclear) {
    // Stay in identifying_issue — do not advance the phase. The model's
    // clarifying question becomes the assistant's reply, and the next
    // user message will be classified again, now with more to go on.
    session.issueSummary = classification.issueSummary;
    await session.save();

    return {
      assistantMessage: classification.clarifyingQuestion,
      phase: "identifying_issue",
      session,
    };
  }

  // Classification succeeded — record it and move to gathering information
  session.categorySlug = classification.categorySlug;
  session.categoryConfidence = classification.confidence;
  session.issueSummary = classification.issueSummary;
  session.phase = "gathering_information";
  await session.save();

  // Immediately ask the first question rather than making the user wait
  // for a separate turn — a real consultant doesn't pause after
  // identifying the issue, they move straight into the next question.
  return handleGatheringInformation(session, null, { skipExtraction: true });
};

// ─── Phase 2/3/5 Handler: Gathering Information ────────────────────────────────

const handleGatheringInformation = async (session, userMessage, options = {}) => {
  const { skipExtraction = false } = options;
  const schema = getIntakeSchema(session.categorySlug);

  // ── Extract an answer for the slot that was just asked about ───────────────
  // Skipped on the very first call into this phase (right after
  // classification), since no question has been asked yet to extract a
  // reply to.

  if (!skipExtraction && session.lastAskedSlotKey && userMessage) {
    const slot = schema.slots.find((s) => s.key === session.lastAskedSlotKey);

    if (slot) {
      let extraction;

      try {
        extraction = await extractAnswer(slot, userMessage, session.issueSummary);
      } catch (error) {
        throw wrapPhaseError(error, FactExtractorError);
      }

      if (extraction.wasAnswered) {
        session.setAnswer(slot.key, extraction.value, extraction.rawUserText, extraction.confidence);
      } else if (extraction.wasSkipped) {
        if (!session.skippedSlotKeys.includes(slot.key)) {
          session.skippedSlotKeys.push(slot.key);
        }
      }
      // If neither answered nor skipped, the slot remains open — the
      // orchestrator will re-ask it below since getNextSlotToAsk() will
      // surface the same slot again until it's actually addressed.
    }
  }

  session.questionsAskedCount += 1;

  // ── Recompute phase NOW, after this turn's extraction ───────────────────────
  // The just-extracted answer may have completed intake — recheck before
  // deciding whether to ask another question or move to guidance.

  const updatedPhase = computePhase(session);

  if (updatedPhase === "ready_for_guidance") {
    session.phase = "ready_for_guidance";
    await session.save();
    return handleReadyForGuidance(session);
  }

  // ── Determine and ask the next question ──────────────────────────────────────

  const nextSlot = getNextSlotToAsk(session);

  if (!nextSlot) {
    // Defensive fallback — computePhase and getNextSlotToAsk should never
    // disagree, but if they somehow do, fail toward guidance rather than
    // an infinite loop with no question to ask.
    session.phase = "ready_for_guidance";
    await session.save();
    return handleReadyForGuidance(session);
  }

  session.lastAskedSlotKey = nextSlot.key;
  await session.save();

  const phrasedQuestion = await phraseFollowUpQuestion(nextSlot, session);

  return {
    assistantMessage: phrasedQuestion,
    phase: "gathering_information",
    session,
  };
};

// ─── Phase 6 Handler: Ready for Guidance ───────────────────────────────────────

const handleReadyForGuidance = async (session) => {
  let guidance;

  try {
    guidance = await generateGuidance(session);
  } catch (error) {
    throw wrapPhaseError(error, GuidanceGeneratorError);
  }

  session.phase = "guidance_provided";
  session.guidanceGeneratedAt = new Date();
  await session.save();

  return {
    assistantMessage: guidance.guidanceText,
    citations: guidance.citations,
    phase: "guidance_provided",
    wasPartialIntake: guidance.wasPartialIntake,
    missingFacts: guidance.missingFacts,
    session,
  };
};

// ─── Post-Guidance Follow-Up Handler ────────────────────────────────────────────
// Once guidance has been given, the consultation drops out of the
// structured intake state machine entirely and becomes a normal grounded
// RAG conversation — the user might ask "what if the landlord refuses?"
// or "how do I file the complaint?" which are follow-ups on the guidance
// already given, not new intake questions. We hand this off to the
// existing ragChatService.js rather than re-running any intake logic.

const handlePostGuidanceFollowUp = async (session) => {
  // Intentionally a thin pass-through — the actual RAG chat call happens
  // in the controller via ragChatService.generateRagResponse, using the
  // session's categorySlug for namespace scoping. This handler's role is
  // just to confirm the phase and let the controller know to route here.
  return {
    assistantMessage: null, // signals the controller to use ragChatService directly
    phase: "guidance_provided",
    routeToRagChat: true,
    session,
  };
};

// ─── Phrase a Follow-Up Question Naturally ─────────────────────────────────────
// Takes the next slot to ask about (a structured definition with a default
// `question` string) and asks Claude to phrase it the way a consultant
// would in context — acknowledging what was just said, rather than
// reciting the raw question text verbatim every time. Falls back to the
// slot's default question text if this call fails, so a transient error
// here never blocks the conversation from continuing.

const phraseFollowUpQuestion = async (slot, session) => {
  const schema = {
    type: "object",
    properties: {
      question: {
        type: "string",
        description:
          "A natural, warm, single follow-up question that asks for this specific information, " +
          "phrased the way an attentive consultant would ask it in conversation.",
      },
    },
    required: ["question"],
    additionalProperties: false,
  };

  const recentAnswers = session.collectedAnswers
    .slice(-2)
    .map((a) => `${a.slotKey}: ${a.rawUserText}`)
    .join("; ");

  const systemPrompt = `You are VakilAI, a legal consultant gathering information from a client about a ${getIntakeSchema(session.categorySlug).categoryLabel} matter.

SITUATION SO FAR: ${session.issueSummary || "Not yet summarised."}
RECENTLY DISCUSSED: ${recentAnswers || "Nothing yet."}

You need to ask the client the following, but phrase it naturally and warmly, as part of an ongoing conversation, not as a robotic form question:
"${slot.question}"

Ask ONLY this one question. Do not ask multiple things at once. Do not provide advice yet. Keep it brief, conversational, and specific to their situation if context allows.`;

  try {
    const result = await getStructuredCompletion({
      systemPrompt,
      userPrompt: "Phrase the follow-up question.",
      jsonSchema: schema,
      maxTokens: 256,
    });
    return result.data.question;
  } catch (error) {
    // Fall back to the raw default question rather than failing the turn —
    // a slightly less natural-sounding question is far better than the
    // consultation breaking entirely on a transient phrasing-call failure.
    console.warn(`Failed to phrase follow-up question naturally, using fallback: ${error.message}`);
    return slot.question;
  }
};

// ─── Error Wrapping Helper ───────────────────────────────────────────────────────

const wrapPhaseError = (error, expectedErrorClass) => {
  if (error instanceof expectedErrorClass || error instanceof ClaudeAnalysisError) {
    return new ConsultationError(error.message, error.code, error.isRetryable);
  }
  return new ConsultationError(`Unexpected consultation error: ${error.message}`, "UNEXPECTED_ERROR", true);
};

export { MAX_QUESTIONS_PER_CONSULTATION };
