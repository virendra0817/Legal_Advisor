import express from "express";
import rateLimit from "express-rate-limit";
import {
  analyseDocumentHandler,
  getAnalysisHandler,
  reanalyseDocumentHandler,
} from "../controllers/analysisController.js";
import { protect, requireVerified, requireTier } from "../middleware/authMiddleware.js";

// mergeParams: true lets this router read :id from the parent mount path
// (/api/documents/:id/analyse) since it's mounted as a sub-router of
// documentRoutes.js rather than having its own top-level path segment.
const router = express.Router({ mergeParams: true });

// ─── Rate Limiters ────────────────────────────────────────────────────────────
// Analysis calls cost real Claude API spend per request, so the limiter
// here is intentionally tighter than the upload/read limiters in
// documentRoutes.js — this is the most expensive endpoint in the app.

const analysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,                   // 20 analyses per hour per IP — generous for genuine use,
                              // restrictive enough to bound runaway cost from a bug or abuse
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many analysis requests. Please try again in an hour.",
    code: "ANALYSIS_RATE_LIMITED",
  },
});

// ─── All analysis routes require authentication ───────────────────────────────

router.use(protect);

// ─── Routes ───────────────────────────────────────────────────────────────────
// Mounted in server.js as: app.use("/api/documents/:id", analysisRoutes)
// giving the final paths shown below.
//
//  POST   /api/documents/:id/analyse      Run or retrieve cached analysis
//  GET    /api/documents/:id/analysis     Get current analysis (no Claude call)
//  POST   /api/documents/:id/reanalyse    Force a fresh analysis

router.post(
  "/analyse",
  analysisLimiter,
  requireVerified,                    // unverified accounts cannot trigger paid AI calls
  requireTier("pro", "enterprise"),   // document analysis is a paid-tier feature
  analyseDocumentHandler
);

router.get(
  "/analysis",
  getAnalysisHandler                   // read-only — no tier gate, any authenticated
                                        // owner can view an analysis that already exists
);

router.post(
  "/reanalyse",
  analysisLimiter,
  requireVerified,
  requireTier("pro", "enterprise"),
  reanalyseDocumentHandler
);

export default router;
