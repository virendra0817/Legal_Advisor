import multer from "multer";
import { fileTypeFromBuffer } from "file-type";

// ─── Configuration ────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_FILES_PER_REQUEST = 1;               // one document per upload request

// Allowed MIME types — must match the enum in the Document model
const ALLOWED_MIME_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

// File extensions we trust the client's declared MIME type for if magic-byte
// sniffing returns nothing conclusive (plain text has no reliable magic bytes)
const TEXT_FALLBACK_EXTENSIONS = ["txt"];

// ─── Multer Storage Engine ────────────────────────────────────────────────────
// We use memoryStorage rather than diskStorage. The file buffer stays in
// memory only briefly — the controller computes a checksum and hands it
// to fileStorage.js for the actual persisted write. This avoids Multer
// writing directly to disk with an unvalidated filename/path.

const storage = multer.memoryStorage();

// ─── Multer File Filter ───────────────────────────────────────────────────────
// First-pass filter based on declared MIME type and extension.
// This runs before the file is even fully buffered, so it's a cheap
// early rejection — the authoritative check happens after upload via
// magic-byte sniffing in validateFileContent below.

const fileFilter = (req, file, cb) => {
  const declaredMime = file.mimetype;
  const extension = file.originalname.split(".").pop()?.toLowerCase();

  if (!ALLOWED_MIME_TYPES[declaredMime]) {
    return cb(
      new MulterValidationError(
        `File type "${declaredMime}" is not supported. Please upload a PDF, DOCX, or TXT file.`,
        "UNSUPPORTED_FILE_TYPE"
      ),
      false
    );
  }

  const expectedExtension = ALLOWED_MIME_TYPES[declaredMime];
  if (extension !== expectedExtension) {
    return cb(
      new MulterValidationError(
        `File extension ".${extension}" does not match the declared file type.`,
        "EXTENSION_MISMATCH"
      ),
      false
    );
  }

  cb(null, true);
};

// ─── Custom Error Class ───────────────────────────────────────────────────────
// Lets the global error handler distinguish our validation errors from
// generic Multer errors (like LIMIT_FILE_SIZE) for cleaner client messages.

class MulterValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "MulterValidationError";
    this.code = code;
    this.statusCode = 400;
  }
}

// ─── Multer Instance ───────────────────────────────────────────────────────────

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_REQUEST,
  },
});

// ─── Single File Upload Middleware ────────────────────────────────────────────
// Wraps multer().single() to normalise its error format into our standard
// API error response shape, rather than letting raw Multer errors leak through.

export const uploadSingleFile = (req, res, next) => {
  const handler = upload.single("document"); // field name: "document"

  handler(req, res, (err) => {
    if (err) {
      // Our custom validation errors (wrong type, extension mismatch)
      if (err instanceof MulterValidationError) {
        return res.status(400).json({
          success: false,
          message: err.message,
          code: err.code,
        });
      }

      // Multer's built-in errors (file too large, too many files, etc.)
      if (err instanceof multer.MulterError) {
        const messages = {
          LIMIT_FILE_SIZE: `File exceeds the maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
          LIMIT_FILE_COUNT: "Only one file can be uploaded at a time.",
          LIMIT_UNEXPECTED_FILE: 'Unexpected field. Use the "document" field name for uploads.',
        };

        return res.status(400).json({
          success: false,
          message: messages[err.code] || "File upload failed.",
          code: err.code,
        });
      }

      // Anything else — pass to global error handler
      return next(err);
    }

    // No file was provided at all
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file was uploaded. Please attach a PDF, DOCX, or TXT file.",
        code: "NO_FILE_PROVIDED",
      });
    }

    next();
  });
};

// ─── Magic-Byte Content Validation ────────────────────────────────────────────
// The authoritative file-type check. A file's extension and declared MIME
// type are trivial to spoof (rename malware.exe to contract.pdf), so we
// inspect the actual byte signature of the uploaded content.
//
// This middleware runs AFTER uploadSingleFile, once req.file.buffer exists.

export const validateFileContent = async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "No file content to validate.",
        code: "NO_FILE_BUFFER",
      });
    }

    const declaredMime = req.file.mimetype;
    const expectedExtension = ALLOWED_MIME_TYPES[declaredMime];

    const detected = await fileTypeFromBuffer(req.file.buffer);

    // Plain text files have no reliable magic bytes — file-type returns
    // undefined for them. We allow this ONLY for .txt and run an additional
    // sanity check that the content is actually printable text, not binary
    // data disguised with a .txt extension.
    if (!detected) {
      if (expectedExtension === "txt" || TEXT_FALLBACK_EXTENSIONS.includes(expectedExtension)) {
        const isPlausibleText = isLikelyPlainText(req.file.buffer);

        if (!isPlausibleText) {
          return res.status(400).json({
            success: false,
            message: "This file does not appear to be valid plain text.",
            code: "INVALID_TEXT_CONTENT",
          });
        }

        return next(); // genuine plain text file — proceed
      }

      return res.status(400).json({
        success: false,
        message: "Could not verify file type. The file may be corrupted.",
        code: "UNVERIFIABLE_FILE_TYPE",
      });
    }

    // For PDF and DOCX, the sniffed MIME type must match what was declared.
    // This is the check that catches a renamed .exe pretending to be a .pdf.
    if (detected.mime !== declaredMime) {
      return res.status(400).json({
        success: false,
        message:
          "The file content does not match its declared type. " +
          "This may indicate a corrupted or disguised file.",
        code: "CONTENT_TYPE_MISMATCH",
        detected: detected.mime,
        declared: declaredMime,
      });
    }

    next();
  } catch (error) {
    console.error("File content validation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to validate file content.",
      code: "VALIDATION_ERROR",
    });
  }
};

// ─── Plain Text Heuristic Check ───────────────────────────────────────────────
// Samples the first chunk of the buffer and checks that the overwhelming
// majority of bytes are printable ASCII/UTF-8 text characters. Binary files
// renamed to .txt will fail this check due to null bytes and control characters.

const isLikelyPlainText = (buffer) => {
  const sampleSize = Math.min(buffer.length, 8000);
  const sample = buffer.subarray(0, sampleSize);

  let suspiciousByteCount = 0;

  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];

    // Null bytes are a strong signal of binary content
    if (byte === 0) {
      suspiciousByteCount += 5; // weight heavily
      continue;
    }

    // Allow standard printable ASCII, tab, newline, carriage return,
    // and bytes that are part of valid UTF-8 multi-byte sequences (>= 0x80)
    const isPrintableAscii = byte >= 32 && byte <= 126;
    const isWhitespace = byte === 9 || byte === 10 || byte === 13;
    const isUtf8Continuation = byte >= 0x80;

    if (!isPrintableAscii && !isWhitespace && !isUtf8Continuation) {
      suspiciousByteCount++;
    }
  }

  const suspiciousRatio = suspiciousByteCount / sample.length;
  return suspiciousRatio < 0.05; // allow up to 5% anomalous bytes
};

// ─── Tier-based File Size Limit ───────────────────────────────────────────────
// Stricter limits for free-tier users, applied after auth middleware has
// already attached req.user. Must run before uploadSingleFile in the chain.

export const enforceTierFileLimits = (req, res, next) => {
  const tierLimits = {
    free: 5 * 1024 * 1024,        // 5 MB
    pro: 15 * 1024 * 1024,        // 15 MB
    enterprise: 15 * 1024 * 1024, // 15 MB (same as global max)
  };

  const userTier = req.user?.tier || "free";
  req.maxFileSizeForTier = tierLimits[userTier] || tierLimits.free;

  next();
};

// ─── Post-upload Tier Size Check ──────────────────────────────────────────────
// Multer's limits.fileSize is set to the global max (15MB) so it can't
// be used for per-tier enforcement directly. This middleware re-checks
// against the tier-specific limit after the file is buffered.

export const validateTierFileSize = (req, res, next) => {
  if (!req.file) return next();

  const limit = req.maxFileSizeForTier || 5 * 1024 * 1024;

  if (req.file.size > limit) {
    return res.status(400).json({
      success: false,
      message: `File exceeds the ${(limit / (1024 * 1024)).toFixed(0)}MB limit for your plan. Upgrade to upload larger files.`,
      code: "TIER_FILE_SIZE_EXCEEDED",
      limit,
      actualSize: req.file.size,
    });
  }

  next();
};

export { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES };
