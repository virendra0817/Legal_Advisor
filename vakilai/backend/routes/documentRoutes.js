import express from "express";
import rateLimit from "express-rate-limit";
import {
  uploadDocument,
  getDocuments,
  getDocument,
  getDocumentStatus,
  deleteDocument,
  downloadDocument,
} from "../controllers/documentController.js";
import { protect, requireVerified } from "../middleware/authMiddleware.js";
import {
  uploadSingleFile,
  validateFileContent,
  enforceTierFileLimits,
  validateTierFileSize,
} from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ─── Rate Limiters ────────────────────────────────────────────────────────────

// Uploads are expensive (disk I/O, future async parsing/embedding cost),
// so they get a tighter limit than general reads.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,                   // 15 uploads per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many uploads. Please wait a few minutes before uploading again.",
    code: "UPLOAD_RATE_LIMITED",
  },
});

// Status polling can fire frequently from the frontend's poll loop —
// looser limit, but still bounded to prevent runaway polling bugs.
const statusPollLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,                  // up to once per second, generous for polling
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many status checks. Please slow down.",
    code: "POLL_RATE_LIMITED",
  },
});

const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many download requests. Please try again shortly.",
    code: "DOWNLOAD_RATE_LIMITED",
  },
});

// ─── All document routes require authentication ───────────────────────────────
// Applied once at the router level rather than per-route.

router.use(protect);

// ─── Routes ───────────────────────────────────────────────────────────────────
//
//  POST   /api/documents/upload         Upload a new document
//  GET    /api/documents                List user's documents (paginated)
//  GET    /api/documents/:id            Get single document metadata
//  GET    /api/documents/:id/status     Poll processing status (lightweight)
//  GET    /api/documents/:id/download   Download original file
//  DELETE /api/documents/:id            Soft-delete a document

router.post(
  "/upload",
  uploadLimiter,
  requireVerified,        // unverified accounts cannot upload — abuse prevention
  enforceTierFileLimits,  // attaches req.maxFileSizeForTier based on req.user.tier
  uploadSingleFile,       // multer: buffers file, runs fileFilter + global size limit
  validateTierFileSize,   // re-checks against the tier-specific limit
  validateFileContent,    // magic-byte sniffing — the authoritative type check
  uploadDocument          // persists to storage + MongoDB
);

router.get(
  "/",
  getDocuments
);

router.get(
  "/:id",
  getDocument
);

router.get(
  "/:id/status",
  statusPollLimiter,
  getDocumentStatus
);

router.get(
  "/:id/download",
  downloadLimiter,
  downloadDocument
);

router.delete(
  "/:id",
  deleteDocument
);

export default router;
