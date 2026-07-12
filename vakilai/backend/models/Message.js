import mongoose from "mongoose";

// ─── Citation Sub-schema ────────────────────────────────────────────────────────
// Mirrors the citation shape produced by ragChatService.js's extractCitations()
// and guidanceGenerator.js's identical function — this is the persisted form
// of what those services compute at response time.

const citationSchema = new mongoose.Schema(
  {
    marker: { type: Number, required: true },
    chunkId: { type: String, required: true },
    source: { type: String, enum: ["user_document", "kb_statute"], required: true },
    heading: { type: String, default: null },
    documentId: { type: String, default: null },
    fileName: { type: String, default: null },
    excerpt: { type: String, default: null },
  },
  { _id: false }
);

// ─── Message Schema ───────────────────────────────────────────────────────────

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    contentType: {
      type: String,
      enum: ["text", "error", "disclaimer"],
      default: "text",
    },

    citations: {
      type: [citationSchema],
      default: [],
    },

    documentRefs: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Document",
      default: [],
      // Which uploaded documents were in scope when this message was
      // generated — distinct from citations, which is what was ACTUALLY
      // cited; this is what WAS AVAILABLE to cite from
    },

    consultationPhase: {
      type: String,
      enum: [
        "identifying_issue",
        "gathering_information",
        "ready_for_guidance",
        "guidance_provided",
        null,
      ],
      default: null,
      // Which phase of consultationOrchestrator.js produced this message,
      // if applicable — lets the frontend render phase-appropriate UI
      // (e.g. a progress indicator during gathering_information) when
      // replaying history, not just live during the active conversation
    },

    tokenUsage: {
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
    },

    isStreamed: {
      type: Boolean,
      default: false,
    },

    feedback: {
      thumbsUp: { type: Boolean, default: null },
      thumbsDown: { type: Boolean, default: null },
      flagReason: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// The canonical query: "load this chat's messages in order" — runs on
// every chat open, so this is the single most important index in this file
messageSchema.index({ chatId: 1, createdAt: 1 });

// ─── Transform ────────────────────────────────────────────────────────────────

messageSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Message = mongoose.model("Message", messageSchema);

export default Message;
