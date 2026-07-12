import {
  analyzeDocument,
  getLatestAnalysis,
  DocumentAnalyzerError,
} from "../services/documentAnalyzer.js";
import User from "../models/User.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sendSuccess = (res, statusCode, message, data = {}) => {
  return res.status(statusCode).json({ success: true, message, ...data });
};

const sendError = (res, statusCode, message, code, extra = {}) => {
  return res.status(statusCode).json({ success: false, message, code, ...extra });
};

// Maps DocumentAnalyzerError codes to HTTP status codes — keeps this
// mapping in one place rather than scattering status-code decisions
// across every handler.
const ERROR_STATUS_MAP = {
  DOCUMENT_NOT_FOUND: 404,
  DOCUMENT_NOT_READY: 409,
  NO_TEXT_AVAILABLE: 422,
  ANALYSIS_NOT_FOUND: 404,
  RATE_LIMITED: 429,
  API_OVERLOADED: 503,
  AUTH_ERROR: 502, // our server misconfiguration, not the client's fault, but not a 500 either
};

const statusForErrorCode = (code) => ERROR_STATUS_MAP[code] || 500;

// ─── @route   POST /api/documents/:id/analyse ─────────────────────────────────
// @desc    Run (or retrieve cached) AI analysis for a document
// @access  Private (requires verified email + Pro/Enterprise tier)
//
// Middleware chain (defined in analysisRoutes.js):
//   protect → requireVerified → requireTier("pro", "enterprise") → analyseDocument

export const analyseDocumentHandler = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id: documentId } = req.params;
    const { legalCategory, forceReanalysis } = req.body;

    const { analysis, wasCached } = await analyzeDocument(documentId, userId, {
      legalCategory: legalCategory || null,
      forceReanalysis: !!forceReanalysis,
    });

    // Track analysis usage for billing/limits — only count genuinely new
    // analyses, not cache hits, since cache hits cost no Claude API spend
    if (!wasCached) {
      await User.findByIdAndUpdate(userId, {
        $inc: { "usageStats.monthlyTokensUsed": analysis.tokenUsage.outputTokens },
      });
    }

    return sendSuccess(
      res,
      200,
      wasCached ? "Returning existing analysis." : "Document analysed successfully.",
      { analysis, wasCached }
    );
  } catch (error) {
    if (error instanceof DocumentAnalyzerError) {
      return sendError(
        res,
        statusForErrorCode(error.code),
        error.message,
        error.code,
        { isRetryable: error.isRetryable }
      );
    }

    if (error.name === "CastError") {
      return sendError(res, 400, "Invalid document ID.", "INVALID_ID");
    }

    console.error("Document analysis error:", error);
    return sendError(res, 500, "Document analysis failed. Please try again.", "ANALYSIS_ERROR");
  }
};

// ─── @route   GET /api/documents/:id/analysis ─────────────────────────────────
// @desc    Get the current (non-stale) analysis for a document, without
//          triggering a new Claude call
// @access  Private (owner only)

export const getAnalysisHandler = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id: documentId } = req.params;

    const analysis = await getLatestAnalysis(documentId, userId);

    return sendSuccess(res, 200, "Analysis fetched.", { analysis });
  } catch (error) {
    if (error instanceof DocumentAnalyzerError) {
      return sendError(res, statusForErrorCode(error.code), error.message, error.code);
    }

    if (error.name === "CastError") {
      return sendError(res, 400, "Invalid document ID.", "INVALID_ID");
    }

    console.error("Get analysis error:", error);
    return sendError(res, 500, "Failed to fetch analysis.", "FETCH_ERROR");
  }
};

// ─── @route   POST /api/documents/:id/reanalyse ───────────────────────────────
// @desc    Force a fresh analysis, ignoring any cached result
// @access  Private (owner only, Pro/Enterprise tier)
// Thin wrapper around analyseDocumentHandler with forceReanalysis hardcoded —
// kept as a separate, explicit endpoint so the action is unambiguous in
// the API surface (and so frontend code calling /reanalyse can't
// accidentally hit the cache by forgetting a body parameter).

export const reanalyseDocumentHandler = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id: documentId } = req.params;
    const { legalCategory } = req.body;

    const { analysis } = await analyzeDocument(documentId, userId, {
      legalCategory: legalCategory || null,
      forceReanalysis: true,
    });

    await User.findByIdAndUpdate(userId, {
      $inc: { "usageStats.monthlyTokensUsed": analysis.tokenUsage.outputTokens },
    });

    return sendSuccess(res, 200, "Document re-analysed successfully.", { analysis });
  } catch (error) {
    if (error instanceof DocumentAnalyzerError) {
      return sendError(
        res,
        statusForErrorCode(error.code),
        error.message,
        error.code,
        { isRetryable: error.isRetryable }
      );
    }

    if (error.name === "CastError") {
      return sendError(res, 400, "Invalid document ID.", "INVALID_ID");
    }

    console.error("Document re-analysis error:", error);
    return sendError(res, 500, "Re-analysis failed. Please try again.", "REANALYSIS_ERROR");
  }
};
