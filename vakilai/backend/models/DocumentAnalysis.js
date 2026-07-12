import mongoose from "mongoose";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────
// Mirrors the shape of DOCUMENT_ANALYSIS_SCHEMA from analysisPromptBuilder.js
// exactly. Keeping these two definitions in sync is important — the Claude
// JSON Schema defines what can come BACK from the model, and this Mongoose
// schema defines what gets PERSISTED. They describe the same data from two
// different layers of the stack (API contract vs. database contract).

const partySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const dateEntrySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const legalClauseSchema = new mongoose.Schema(
  {
    clauseTitle: { type: String, required: true, trim: true },
    clauseSummary: { type: String, required: true, trim: true },
    originalText: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { _id: false }
);

const penaltySchema = new mongoose.Schema(
  {
    trigger: { type: String, required: true, trim: true },
    consequence: { type: String, required: true, trim: true },
    severity: { type: String, enum: ["low", "medium", "high"], required: true },
  },
  { _id: false }
);

const obligationSchema = new mongoose.Schema(
  {
    party: { type: String, required: true, trim: true },
    obligation: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const riskSchema = new mongoose.Schema(
  {
    riskTitle: { type: String, required: true, trim: true },
    riskDescription: { type: String, required: true, trim: true },
    riskLevel: { type: String, enum: ["low", "medium", "high"], required: true },
    recommendation: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const applicableLawSchema = new mongoose.Schema(
  {
    actName: { type: String, required: true, trim: true },
    relevance: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const documentAnalysisSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ── Core analysis fields (mirrors DOCUMENT_ANALYSIS_SCHEMA) ────────────────

    documentType: { type: String, required: true, trim: true },

    documentTypeConfidence: {
      type: String,
      enum: ["high", "medium", "low"],
      required: true,
    },

    summary: { type: String, required: true, trim: true },

    parties: { type: [partySchema], default: [] },

    importantDates: { type: [dateEntrySchema], default: [] },

    legalClauses: { type: [legalClauseSchema], default: [] },

    penalties: { type: [penaltySchema], default: [] },

    obligations: { type: [obligationSchema], default: [] },

    risks: { type: [riskSchema], default: [] },

    applicableLaws: { type: [applicableLawSchema], default: [] },

    overallRiskLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },

    recommendedNextSteps: { type: [String], default: [] },

    // ── Quality / metadata fields (not part of the Claude schema — added here) ─

    isLowConfidence: {
      type: Boolean,
      default: false,
      // True if validation flagged issues OR documentTypeConfidence is "low" —
      // drives a "review carefully" banner in the frontend
    },

    validationIssues: {
      type: [String],
      default: [],
      // Internal diagnostic log from analysisResponseParser.js —
      // not typically shown to end users, but useful for support/debugging
    },

    wasTruncated: {
      type: Boolean,
      default: false,
      // True if the source document exceeded MAX_DOCUMENT_CHARS —
      // surfaced in the UI so users know the analysis may be incomplete
    },

    isStale: {
      type: Boolean,
      default: false,
      index: true,
      // True once a newer analysis has superseded this one — kept for
      // audit history rather than deleted
    },

    // ── Provenance ───────────────────────────────────────────────────────────

    modelUsed: {
      type: String,
      required: true,
      // e.g. "claude-sonnet-4-6" — important for reproducibility and for
      // knowing which analyses to consider re-running after a model upgrade
    },

    tokenUsage: {
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
    },

    analysedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary lookup: "get the current (non-stale) analysis for this document"
documentAnalysisSchema.index({ documentId: 1, isStale: 1 });

// Ownership-scoped listing: "all of this user's analyses, newest first"
documentAnalysisSchema.index({ userId: 1, analysedAt: -1 });

// ─── Transform: clean JSON output ────────────────────────────────────────────
// validationIssues is internal diagnostic data — useful for logs and
// support tooling, but not meant for the end-user-facing API response.
// We strip it in the default JSON transform; the controller can still
// access it directly off the Mongoose document before serialisation
// if an internal/admin view ever needs it.

documentAnalysisSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.__v;
    delete ret.validationIssues;
    return ret;
  },
});

const DocumentAnalysis = mongoose.model("DocumentAnalysis", documentAnalysisSchema);

export default DocumentAnalysis;
