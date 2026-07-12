import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ── File identity ──────────────────────────────────────────────────────

    fileName: {
      type: String,
      required: [true, "File name is required"],
      trim: true,
    },

    originalFileName: {
      type: String,
      required: true,
      trim: true,
      // Preserved exactly as uploaded, even if fileName gets sanitised/renamed
    },

    mimeType: {
      type: String,
      required: true,
      enum: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
        "text/plain",
      ],
    },

    fileExtension: {
      type: String,
      required: true,
      enum: ["pdf", "docx", "txt"],
    },

    fileSizeBytes: {
      type: Number,
      required: true,
      max: [15 * 1024 * 1024, "File size cannot exceed 15MB"],
    },

    // ── Storage reference ──────────────────────────────────────────────────
    // We never store the raw file content in MongoDB. storageKey points to
    // wherever the actual bytes live — local disk path in dev, S3/R2 key in prod.

    storageProvider: {
      type: String,
      enum: ["local", "s3", "r2"],
      default: "local",
    },

    storageKey: {
      type: String,
      required: true,
      unique: true,
      // e.g. "documents/{userId}/{documentId}.pdf"
    },

    storageBucket: {
      type: String,
      default: null, // null for local storage, bucket name for S3/R2
    },

    checksum: {
      type: String,
      required: true,
      // SHA-256 hash of file content — detects duplicate uploads and
      // verifies file integrity after storage
    },

    // ── Processing lifecycle ───────────────────────────────────────────────

    status: {
      type: String,
      enum: ["uploaded", "processing", "ready", "failed"],
      default: "uploaded",
      index: true,
    },

    processingError: {
      type: String,
      default: null,
    },

    // ── Parsed content ─────────────────────────────────────────────────────
    // Populated by the background worker after text extraction.
    // Embedded here (not a separate collection) since it's always
    // fetched together with the document record.

    parsedContent: {
      rawText: {
        type: String,
        default: null,
        select: false, // large field — excluded from default queries
      },
      pageCount: {
        type: Number,
        default: null,
      },
      wordCount: {
        type: Number,
        default: null,
      },
      language: {
        type: String,
        default: "en",
      },
      ocrApplied: {
        type: Boolean,
        default: false,
      },
    },

    chunkCount: {
      type: Number,
      default: 0,
      // Populated once chunking + embedding completes
    },

    // ── AI-extracted metadata ──────────────────────────────────────────────
    // Populated asynchronously after initial parse, used for search/filter

    metadata: {
      documentType: {
        type: String,
        default: null,
        // e.g. "rent_agreement", "fir", "employment_contract", "legal_notice"
      },
      detectedActs: {
        type: [String],
        default: [],
        // e.g. ["Consumer Protection Act 2019", "IPC Section 420"]
      },
      parties: {
        type: [String],
        default: [],
      },
      detectedDates: {
        type: [String],
        default: [],
      },
    },

    categoryHint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LegalCategory",
      default: null,
    },

    // ── Soft delete ─────────────────────────────────────────────────────────
    // We don't hard-delete documents immediately — gives users an undo
    // window and keeps chat history referencing this doc intact.

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    // ── Lifecycle timestamps ───────────────────────────────────────────────

    uploadedAt: {
      type: Date,
      default: Date.now,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
      // Set for free-tier users — auto-deletion via TTL index
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary query: "show my documents, newest first, excluding deleted"
documentSchema.index({ userId: 1, isDeleted: 1, uploadedAt: -1 });

// Background worker picks up documents with status: "uploaded"
documentSchema.index({ status: 1 });

// Prevent duplicate storage references
documentSchema.index({ storageKey: 1 }, { unique: true });

// Detect duplicate uploads of the same file content by the same user
documentSchema.index({ userId: 1, checksum: 1 });

// TTL index — MongoDB automatically deletes documents past expiresAt.
// Sparse because most documents (pro/enterprise tier) never set this field.
documentSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, sparse: true }
);

// ─── Instance method: mark as ready ──────────────────────────────────────────

documentSchema.methods.markReady = function (extractedData) {
  this.status = "ready";
  this.processedAt = new Date();
  this.parsedContent = {
    ...this.parsedContent,
    ...extractedData,
  };
  return this.save();
};

// ─── Instance method: mark as failed ─────────────────────────────────────────

documentSchema.methods.markFailed = function (errorMessage) {
  this.status = "failed";
  this.processingError = errorMessage;
  return this.save();
};

// ─── Virtual: human-readable file size ───────────────────────────────────────

documentSchema.virtual("fileSizeFormatted").get(function () {
  const bytes = this.fileSizeBytes;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
});

// ─── Transform: clean JSON output ────────────────────────────────────────────

documentSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    delete ret.storageBucket; // internal infra detail, not for client
    return ret;
  },
});

const Document = mongoose.model("Document", documentSchema);

export default Document;
