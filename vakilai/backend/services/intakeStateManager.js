import { resolveApplicableSlots, getIntakeSchema } from "../config/legalIntakeSchemas.js";

// ─── Configuration ────────────────────────────────────────────────────────────

// Hard ceiling on follow-up questions per consultation. Even in the worst
// case, a category with every optional slot in play and a user who keeps
// giving ambiguous answers requiring re-asks, intake should never feel
// like an endless interrogation. Once this is hit, the orchestrator moves
// to guidance generation with whatever has been gathered, explicitly
// noting which facts are still missing rather than continuing to probe.
export const MAX_QUESTIONS_PER_CONSULTATION = 8;

// ─── Determine the Next Unanswered Required Slot ───────────────────────────────
// The deterministic core of Phases 2, 3, and 5. Given the category and
// everything gathered so far, returns the single next slot that should be
// asked about, or null if intake is complete. Required slots are always
// prioritised over optional ones — we never spend a question on something
// optional while a required fact is still missing.

export const getNextSlotToAsk = (session) => {
  if (!session.categorySlug) return null; // Phase 1 hasn't completed yet

  const answersMap = session.getAnswersMap();
  const applicableSlots = resolveApplicableSlots(session.categorySlug, answersMap);

  const isAnswered = (slot) =>
    answersMap[slot.key] !== undefined || session.skippedSlotKeys.includes(slot.key);

  // Required slots first, in the order defined by the schema — this order
  // is itself a deliberate authoring choice in legalIntakeSchemas.js
  // (e.g. "state" is always asked early because it affects which laws
  // apply to everything that follows).
  const nextRequired = applicableSlots.find((slot) => slot.required && !isAnswered(slot));
  if (nextRequired) return nextRequired;

  // Only ask optional slots if we haven't hit the question ceiling and
  // there's genuinely something optional left unanswered — these add
  // helpful context but are never allowed to block guidance generation.
  if (session.questionsAskedCount < MAX_QUESTIONS_PER_CONSULTATION) {
    const nextOptional = applicableSlots.find((slot) => !slot.required && !isAnswered(slot));
    if (nextOptional) return nextOptional;
  }

  return null; // nothing left to ask
};

// ─── Check Whether Intake Is Complete ───────────────────────────────────────────
// "Complete" means every REQUIRED applicable slot has an answer (or was
// explicitly skipped). Optional slots never block completeness — this is
// what prevents the consultation from feeling like it's stalling on
// nice-to-have details when the user is clearly ready to hear guidance.

export const isIntakeComplete = (session) => {
  if (!session.categorySlug) return false;

  const answersMap = session.getAnswersMap();
  const applicableSlots = resolveApplicableSlots(session.categorySlug, answersMap);

  const isAnswered = (slot) =>
    answersMap[slot.key] !== undefined || session.skippedSlotKeys.includes(slot.key);

  const allRequiredAnswered = applicableSlots
    .filter((slot) => slot.required)
    .every(isAnswered);

  return allRequiredAnswered;
};

// ─── Compute the Current Phase ──────────────────────────────────────────────────
// The single function that decides what phase the consultation is in.
// This is called at the START of every turn, before any Claude call is
// made — the phase is never inferred by the model, only read by it.

export const computePhase = (session) => {
  if (session.phase === "guidance_provided") {
    return "guidance_provided"; // terminal state — once given, stays given
  }

  if (!session.categorySlug) {
    return "identifying_issue";
  }

  if (isIntakeComplete(session) || session.questionsAskedCount >= MAX_QUESTIONS_PER_CONSULTATION) {
    return "ready_for_guidance";
  }

  return "gathering_information";
};

// ─── Build a Human-Readable Intake Summary ──────────────────────────────────────
// Used both for the guidance generation prompt (so Claude has all gathered
// facts in one clean block) and for an optional "here's what I understood"
// confirmation the frontend can show before generating guidance.

export const buildIntakeSummary = (session) => {
  if (!session.categorySlug) return null;

  const schema = getIntakeSchema(session.categorySlug);
  const answersMap = session.getAnswersMap();

  const lines = schema.slots
    .map((slot) => {
      const value = answersMap[slot.key];
      const wasSkipped = session.skippedSlotKeys.includes(slot.key);

      if (value !== undefined) {
        return `${slot.label}: ${formatAnswerValue(value, slot.type)}`;
      }
      if (wasSkipped) {
        return `${slot.label}: not provided`;
      }
      return null; // never asked — omit rather than showing as blank
    })
    .filter(Boolean);

  return {
    categoryLabel: schema.categoryLabel,
    issueSummary: session.issueSummary,
    facts: lines,
  };
};

const formatAnswerValue = (value, type) => {
  if (type === "boolean") return value ? "Yes" : "No";
  return String(value);
};

// ─── Get Missing Required Facts ─────────────────────────────────────────────────
// Used when guidance is generated before full completeness (the
// MAX_QUESTIONS ceiling was hit) — Phase 6 needs to know what's still
// unknown so it can caveat the guidance honestly rather than presenting
// it as if every fact was established.

export const getMissingRequiredFacts = (session) => {
  if (!session.categorySlug) return [];

  const answersMap = session.getAnswersMap();
  const applicableSlots = resolveApplicableSlots(session.categorySlug, answersMap);

  const isAnswered = (slot) =>
    answersMap[slot.key] !== undefined || session.skippedSlotKeys.includes(slot.key);

  return applicableSlots
    .filter((slot) => slot.required && !isAnswered(slot))
    .map((slot) => slot.label);
};
