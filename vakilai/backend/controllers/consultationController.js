import {
  processConsultationTurn,
  ConsultationError,
} from "../services/consultationOrchestrator.js";
import { generateRagResponse, RagChatError } from "../services/ragChatService.js";
import ConsultationSession from "../models/ConsultationSession.js";
import { getIntakeSchema } from "../config/legalIntakeSchemas.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sendSuccess = (res, statusCode, message, data = {}) => {
  return res.status(statusCode).json({ success: true, message, ...data });
};

const sendError = (res, statusCode, message, code, extra = {}) => {
  return res.status(statusCode).json({ success: false, message, code, ...extra });
};

const ERROR_STATUS_MAP = {
  EMPTY_MESSAGE: 400,
  NO_CATEGORY: 409,
  RATE_LIMITED: 429,
  API_OVERLOADED: 503,
  AUTH_ERROR: 502,
};

const statusForErrorCode = (code) => ERROR_STATUS_MAP[code] || 500;

// ─── @route   POST /api/consultations/:chatId/message ─────────────────────────
// @desc    Process one turn of the conversational legal consultation —
//          identifies the issue, asks follow-ups, collects answers, and
//          eventually generates guidance, per the phase the session is in.
// @access  Private (requires verified email)

export const sendConsultationMessage = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatId } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return sendError(res, 400, "Message text is required.", "MISSING_MESSAGE");
    }

    if (message.length > 4000) {
      return sendError(res, 400, "Message is too long (max 4000 characters).", "MESSAGE_TOO_LONG");
    }

    const turnResult = await processConsultationTurn(chatId, userId, message.trim());
    console.log("Consultation turn result:", turnResult);
    // ── Post-guidance follow-ups route to the standard RAG chat pipeline ───────
    // The structured intake state machine has nothing left to do once
    // guidance has been delivered — ongoing Q&A about that guidance is
    // handled by the existing RAG chat service, scoped to the same
    // legal category for namespace-consistent retrieval.

    if (turnResult.routeToRagChat) {
      const ragResult = await generateRagResponse(message.trim(), {
        userId,
        categorySlugs: turnResult.session.categorySlug ? [turnResult.session.categorySlug] : [],
        categoryDisclaimer: buildCategoryDisclaimer(turnResult.session.categorySlug),
      });

      return sendSuccess(res, 200, "Response generated.", {
        reply: ragResult.answer,
        citations: ragResult.citations,
        phase: "guidance_provided",
        isFollowUp: true,
      });
    }

    // ── Standard phase response (clarifying question, follow-up question, ────
    // or freshly generated guidance) ────────────────────────────────────────

    return sendSuccess(res, 200, "Response generated.", {
      reply: turnResult.assistantMessage,
      citations: turnResult.citations || [],
      phase: turnResult.phase,
      ...(turnResult.wasPartialIntake !== undefined && {
        wasPartialIntake: turnResult.wasPartialIntake,
        missingFacts: turnResult.missingFacts,
      }),
    });
    console.log(turnResult);
  } catch (error) {
    if (error instanceof ConsultationError || error instanceof RagChatError) {
      return sendError(
        res,
        statusForErrorCode(error.code),
        error.message,
        error.code,
        { isRetryable: error.isRetryable }
      );
    }

    if (error.name === "CastError") {
      return sendError(res, 400, "Invalid chat ID.", "INVALID_ID");
    }

    console.error("Consultation message error:", error);
    return sendError(res, 500, "Failed to process your message. Please try again.", "CONSULTATION_ERROR");
  }
};

// ─── @route   GET /api/consultations/:chatId/state ─────────────────────────────
// @desc    Get the current consultation phase and gathered facts — used by
//          the frontend to render a progress indicator ("3 of 5 details
//          gathered") without needing to parse chat messages.
// @access  Private (owner only)

export const getConsultationState = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatId } = req.params;

    const session = await ConsultationSession.findOne({ chatId, userId });

    if (!session) {
      return sendError(res, 404, "No consultation found for this chat.", "SESSION_NOT_FOUND");
    }

    const schema = session.categorySlug ? getIntakeSchema(session.categorySlug) : null;
    const totalRequiredSlots = schema ? schema.slots.filter((s) => s.required).length : 0;
    const answeredRequiredSlots = schema
      ? schema.slots.filter(
          (s) =>
            s.required &&
            (session.getAnswer(s.key) !== undefined || session.skippedSlotKeys.includes(s.key))
        ).length
      : 0;

    return sendSuccess(res, 200, "Consultation state fetched.", {
      phase: session.phase,
      categorySlug: session.categorySlug,
      categoryLabel: schema?.categoryLabel || null,
      issueSummary: session.issueSummary,
      progress: {
        answered: answeredRequiredSlots,
        total: totalRequiredSlots,
      },
      questionsAskedCount: session.questionsAskedCount,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return sendError(res, 400, "Invalid chat ID.", "INVALID_ID");
    }
    console.error("Get consultation state error:", error);
    return sendError(res, 500, "Failed to fetch consultation state.", "FETCH_ERROR");
  }
};

// ─── Helper: Build a Category-Specific Disclaimer ──────────────────────────────
// Mirrors the disclaimerText field on the legal_categories collection from
// the MongoDB schema design — in a full implementation this would be
// fetched from that collection rather than hardcoded here.

const buildCategoryDisclaimer = (categorySlug) => {
  if (!categorySlug) return null;
  return "This is general legal information based on your situation, not formal legal advice. For matters requiring filing or representation, please consult a licensed advocate.";
};
