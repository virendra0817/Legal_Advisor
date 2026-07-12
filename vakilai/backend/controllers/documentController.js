import Document from "../models/Document.js";
import User from "../models/User.js";
import {
  saveFile,
  readFile,
  deleteFile,
  computeChecksum,
  getStoredFileSize,
} from "../utils/fileStorage.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sendSuccess = (res, statusCode, message, data = {}) => {
  return res.status(statusCode).json({ success: true, message, ...data });
};

const sendError = (res, statusCode, message, code, extra = {}) => {
  return res.status(statusCode).json({ success: false, message, code, ...extra });
};

const EXTENSION_BY_MIME = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

// Free-tier documents auto-expire after 30 days; pro/enterprise never expire
const FREE_TIER_EXPIRY_DAYS = 30;

// Free-tier document count limit, enforced before allowing a new upload
const FREE_TIER_MAX_DOCUMENTS = 3;

// ─── @route   POST /api/documents/upload ──────────────────────────────────────
// @desc    Upload a PDF, DOCX, or TXT document, save securely, store metadata
// @access  Private (requires verified email)
//
// Middleware chain (defined in documentRoutes.js):
//   protect → requireVerified → enforceTierFileLimits → uploadSingleFile
//   → validateTierFileSize → validateFileContent → uploadDocument

export const uploadDocument = async (req, res) => {
  let savedStorageKey = null; // tracked so we can clean up on failure

  try {
    const { userId, tier } = req.user;
    const file = req.file;

    if (!file) {
      return sendError(res, 400, "No file was uploaded.", "NO_FILE_PROVIDED");
    }

    // 1. Enforce free-tier document count limit
    if (tier === "free") {
      const existingCount = await Document.countDocuments({
        userId,
        isDeleted: false,
      });

      if (existingCount >= FREE_TIER_MAX_DOCUMENTS) {
        return sendError(
          res, 403,
          `Free plan is limited to ${FREE_TIER_MAX_DOCUMENTS} documents. Upgrade to Pro to upload more.`,
          "DOCUMENT_LIMIT_REACHED",
          { limit: FREE_TIER_MAX_DOCUMENTS, current: existingCount }
        );
      }
    }

    // 2. Compute checksum and check for duplicate upload
    const checksum = computeChecksum(file.buffer);

    const existingDuplicate = await Document.findOne({
      userId,
      checksum,
      isDeleted: false,
    });

    if (existingDuplicate) {
      return sendError(
        res, 409,
        "You've already uploaded this exact file.",
        "DUPLICATE_FILE",
        { existingDocumentId: existingDuplicate._id }
      );
    }

    // 3. Determine file extension from validated MIME type
    const fileExtension = EXTENSION_BY_MIME[file.mimetype];

    if (!fileExtension) {
      return sendError(res, 400, "Unsupported file type.", "UNSUPPORTED_FILE_TYPE");
    }

    // 4. Save file to storage (local disk or S3/R2)
    const { storageKey, storageBucket, storageProvider } = await saveFile({
      buffer: file.buffer,
      userId,
      fileExtension,
    });

    savedStorageKey = storageKey; // for cleanup if a later step fails

    // 5. Sanity check — confirm the file landed correctly on disk
    const writtenSize = await getStoredFileSize(storageKey, storageProvider);

    if (writtenSize !== file.buffer.length) {
      throw new Error(
        `File size mismatch after write: expected ${file.buffer.length}, got ${writtenSize}`
      );
    }

    // 6. Calculate expiry for free-tier users
    const expiresAt =
      tier === "free"
        ? new Date(Date.now() + FREE_TIER_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
        : null;

    // 7. Create the MongoDB metadata record
    const document = await Document.create({
      userId,
      fileName: sanitizeDisplayName(file.originalname),
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileExtension,
      fileSizeBytes: file.buffer.length,
      storageProvider,
      storageKey,
      storageBucket,
      checksum,
      status: "uploaded", // background worker will pick this up for parsing
      expiresAt,
    });

    // 8. Increment the user's usage stats
    await User.findByIdAndUpdate(userId, {
      $inc: { "usageStats.totalDocsUploaded": 1 },
    });

    // 9. Respond — 202 Accepted because parsing happens asynchronously.
    // The client should poll GET /api/documents/:id for status updates.
    return sendSuccess(res, 202, "Document uploaded and queued for processing.", {
      document: {
        id: document._id,
        fileName: document.fileName,
        fileExtension: document.fileExtension,
        fileSizeBytes: document.fileSizeBytes,
        fileSizeFormatted: document.fileSizeFormatted,
        status: document.status,
        uploadedAt: document.uploadedAt,
        expiresAt: document.expiresAt,
      },
    });
  } catch (error) {
    console.error("Document upload error:", error);

    // Clean up the orphaned file on disk if the DB write failed
    // after the file was already saved to storage
    if (savedStorageKey) {
      try {
        await deleteFile(savedStorageKey, "local");
      } catch (cleanupError) {
        console.error("Failed to clean up orphaned file:", cleanupError);
      }
    }

    // Mongoose validation error
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return sendError(res, 400, "Document validation failed.", "VALIDATION_ERROR", { errors });
    }

    return sendError(res, 500, "Document upload failed. Please try again.", "UPLOAD_ERROR");
  }
};

// ─── @route   GET /api/documents ──────────────────────────────────────────────
// @desc    List the authenticated user's documents, paginated
// @access  Private

export const getDocuments = async (req, res) => {
  try {
    const { userId } = req.user;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const status = req.query.status; // optional filter: uploaded|processing|ready|failed

    const filter = { userId, isDeleted: false };
    if (status && ["uploaded", "processing", "ready", "failed"].includes(status)) {
      filter.status = status;
    }

    const [documents, total] = await Promise.all([
      Document.find(filter)
        .sort({ uploadedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-checksum -storageKey"), // never expose internal storage details
      Document.countDocuments(filter),
    ]);

    return sendSuccess(res, 200, "Documents fetched.", {
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get documents error:", error);
    return sendError(res, 500, "Failed to fetch documents.", "FETCH_ERROR");
  }
};

// ─── @route   GET /api/documents/:id ───────────────────────────────────────────
// @desc    Get a single document's metadata and processing status
// @access  Private (owner only)

export const getDocument = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;

    const document = await Document.findOne({
      _id: id,
      userId,        // ownership check — users can only access their own documents
      isDeleted: false,
    }).select("-checksum -storageKey");

    if (!document) {
      return sendError(res, 404, "Document not found.", "DOCUMENT_NOT_FOUND");
    }

    return sendSuccess(res, 200, "Document fetched.", { document });
  } catch (error) {
    if (error.name === "CastError") {
      return sendError(res, 400, "Invalid document ID.", "INVALID_ID");
    }
    console.error("Get document error:", error);
    return sendError(res, 500, "Failed to fetch document.", "FETCH_ERROR");
  }
};

// ─── @route   GET /api/documents/:id/status ───────────────────────────────────
// @desc    Lightweight polling endpoint — returns only status fields
// @access  Private (owner only)
// Used by the frontend's polling loop after upload to detect when
// background processing completes, without fetching the full document.

export const getDocumentStatus = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;

    const document = await Document.findOne({ _id: id, userId, isDeleted: false })
      .select("status processingError processedAt chunkCount");

    if (!document) {
      return sendError(res, 404, "Document not found.", "DOCUMENT_NOT_FOUND");
    }

    return sendSuccess(res, 200, "Status fetched.", {
      status: document.status,
      processingError: document.processingError,
      processedAt: document.processedAt,
      chunkCount: document.chunkCount,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return sendError(res, 400, "Invalid document ID.", "INVALID_ID");
    }
    console.error("Get document status error:", error);
    return sendError(res, 500, "Failed to fetch document status.", "FETCH_ERROR");
  }
};

// ─── @route   DELETE /api/documents/:id ───────────────────────────────────────
// @desc    Soft-delete a document (file remains in storage briefly for undo)
// @access  Private (owner only)

export const deleteDocument = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;

    const document = await Document.findOne({ _id: id, userId, isDeleted: false });

    if (!document) {
      return sendError(res, 404, "Document not found.", "DOCUMENT_NOT_FOUND");
    }

    document.isDeleted = true;
    document.deletedAt = new Date();
    await document.save();

    // Note: the actual file in storage and the Pinecone vectors are NOT
    // deleted here — a separate scheduled cleanup job purges soft-deleted
    // documents (and their vectors) after a grace period, e.g. 7 days.
    // This gives users an undo window and avoids orphaning chat citations
    // that reference this document mid-conversation.

    return sendSuccess(res, 200, "Document deleted.");
  } catch (error) {
    if (error.name === "CastError") {
      return sendError(res, 400, "Invalid document ID.", "INVALID_ID");
    }
    console.error("Delete document error:", error);
    return sendError(res, 500, "Failed to delete document.", "DELETE_ERROR");
  }
};

// ─── @route   GET /api/documents/:id/download ──────────────────────────────────
// @desc    Stream the original file back to the owner
// @access  Private (owner only)

export const downloadDocument = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;

    // storageKey IS needed here, unlike other reads — explicitly select it
    const document = await Document.findOne({ _id: id, userId, isDeleted: false })
      .select("+storageKey originalFileName mimeType storageProvider");

    if (!document) {
      return sendError(res, 404, "Document not found.", "DOCUMENT_NOT_FOUND");
    }

    const buffer = await readFile(document.storageKey, document.storageProvider);

    res.set({
      "Content-Type": document.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(document.originalFileName)}"`,
      "Content-Length": buffer.length,
    });

    return res.send(buffer);
  } catch (error) {
    if (error.name === "CastError") {
      return sendError(res, 400, "Invalid document ID.", "INVALID_ID");
    }
    if (error.code === "ENOENT") {
      return sendError(res, 404, "File no longer exists in storage.", "FILE_NOT_FOUND");
    }
    console.error("Download document error:", error);
    return sendError(res, 500, "Failed to download document.", "DOWNLOAD_ERROR");
  }
};

// ─── Helper: sanitise filename for display ────────────────────────────────────
// Strips characters that could cause issues in UI rendering or HTTP headers,
// while keeping the name human-readable (unlike the storage key).

const sanitizeDisplayName = (filename) => {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // strip filesystem-unsafe characters
    .trim()
    .slice(0, 200); // cap length
};
