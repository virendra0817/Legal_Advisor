import mongoose from "mongoose";

// ─── Collected Answer Sub-schema ───────────────────────────────────────────────
// Each answer keeps provenance — not just the value, but how confidently
// and from which user message it was extracted. This matters because a
// user might later contradict an earlier answer ("actually, I do have a
// written agreement") and the consultation needs to know an answer can
// be revised, not just appended.

const collectedAnswerSchema = new mongoose.Schema(
  {
    slotKey: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    rawUserText: { type: String, required: true }, // the user's actual words, for audit/citation
    confidence: { type: String, enum: ["high", "medium", "low"], default: "high" },
    extractedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const consultationSessionSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      unique: true, // one consultation session per chat — 1:1, not 1:many
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ── Phase tracking ──────────────────────────────────────────────────────────

    phase: {
      type: String,
      enum: [
        "identifying_issue",     // Phase 1 — category not yet determined
        "gathering_information", // Phases 2/3/5 — actively asking follow-ups
        "ready_for_guidance",    // all required slots filled, awaiting generation
        "guidance_provided",     // Phase 6 complete — guidance has been generated
      ],
      default: "identifying_issue",
      index: true,
    },

    // ── Issue classification (Phase 1 output) ───────────────────────────────────

    categorySlug: {
      type: String,
      default: null,
      // null until Phase 1 completes; matches a key in LEGAL_INTAKE_SCHEMAS
    },

    categoryConfidence: {
      type: String,
      enum: ["high", "medium", "low", null],
      default: null,
    },

    issueSummary: {
      type: String,
      default: null,
      // A one-line summary of the issue as understood so far — shown in
      // chat history list and used as context for every subsequent prompt
    },

    // ── Collected facts (Phases 2-5 output) ──────────────────────────────────────

    collectedAnswers: {
      type: [collectedAnswerSchema],
      default: [],
    },

    // ── Question tracking ───────────────────────────────────────────────────────

    lastAskedSlotKey: {
      type: String,
      default: null,
      // Which slot the most recent question was trying to fill — lets the
      // fact extractor know what it's interpreting the user's reply AS AN
      // ANSWER TO, rather than re-classifying from scratch every turn
    },

    questionsAskedCount: {
      type: Number,
      default: 0,
      // Safety valve — see consultationOrchestrator.js MAX_QUESTIONS guard
    },

    skippedSlotKeys: {
      type: [String],
      default: [],
      // Slots the user explicitly declined to answer ("I'd rather not say",
      // "I don't know") — tracked separately from "not yet asked" so the
      // orchestrator doesn't loop back and re-ask something already declined
    },

    // ── Guidance output (Phase 6) ───────────────────────────────────────────────

    guidanceGeneratedAt: {
      type: Date,
      default: null,
    },

    guidanceMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
      // Points to the Message document (from the Messages collection in
      // the MongoDB schema) that contains the rendered guidance text
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

consultationSessionSchema.index({ chatId: 1 }, { unique: true });
consultationSessionSchema.index({ userId: 1, phase: 1 });

// ─── Instance Method: Get Answer Value by Slot Key ─────────────────────────────

consultationSessionSchema.methods.getAnswer = function (slotKey) {
  const answer = this.collectedAnswers.find((a) => a.slotKey === slotKey);
  return answer ? answer.value : undefined;
};

// ─── Instance Method: Get All Answers as a Flat Object ─────────────────────────
// Used by intakeStateManager.js and guidanceGenerator.js, which both want
// { stateKey: value } rather than iterating the array repeatedly.

consultationSessionSchema.methods.getAnswersMap = function () {
  return this.collectedAnswers.reduce((acc, a) => {
    acc[a.slotKey] = a.value;
    return acc;
  }, {});
};

// ─── Instance Method: Upsert an Answer ─────────────────────────────────────────
// Replaces an existing answer for the same slot rather than appending a
// duplicate — this is what allows a user to revise an earlier answer
// mid-conversation without the record accumulating contradictory entries.

consultationSessionSchema.methods.setAnswer = function (slotKey, value, rawUserText, confidence = "high") {
  const existingIndex = this.collectedAnswers.findIndex((a) => a.slotKey === slotKey);

  const newAnswer = { slotKey, value, rawUserText, confidence, extractedAt: new Date() };

  if (existingIndex >= 0) {
    this.collectedAnswers[existingIndex] = newAnswer;
  } else {
    this.collectedAnswers.push(newAnswer);
  }

  // Revising an answer should also clear it from skipped, if it was there
  this.skippedSlotKeys = this.skippedSlotKeys.filter((k) => k !== slotKey);
};

const ConsultationSession = mongoose.model("ConsultationSession", consultationSessionSchema);

export default ConsultationSession;
