// ─── Custom Error ─────────────────────────────────────────────────────────────

export class AnalysisValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "AnalysisValidationError";
    this.code = code;
  }
}

// ─── Validate and Normalise Structured Output ──────────────────────────────────
// Structured Outputs already guarantees the response matches our JSON
// Schema at the type/shape level — this function is NOT re-validating
// structure (that would be redundant with what the API already enforces).
// Instead, it checks business-logic invariants the schema can't express:
// content quality, internal consistency, and safety-relevant constraints
// that go beyond "is this valid JSON of the right shape."

export const validateAndNormaliseAnalysis = (rawAnalysis, sourceContext = {}) => {
  const issues = [];

  // ── Content quality checks ──────────────────────────────────────────────────
  // The schema can guarantee summary is a string; it cannot guarantee the
  // string is actually a meaningful summary rather than a one-word stub.

  if (!rawAnalysis.summary || rawAnalysis.summary.trim().length < 30) {
    issues.push("Summary is unexpectedly short — may indicate a low-quality analysis.");
  }

  if (rawAnalysis.documentType?.trim().length === 0) {
    throw new AnalysisValidationError(
      "Analysis returned an empty document type.",
      "EMPTY_DOCUMENT_TYPE"
    );
  }

  // ── Internal consistency checks ─────────────────────────────────────────────
  // Cross-field logic the schema cannot express: a document classified as
  // "low" overall risk shouldn't simultaneously list multiple "high"
  // severity individual risks — that's a model self-contradiction worth
  // flagging (and auto-correcting) rather than silently persisting.

  const highSeverityRiskCount = (rawAnalysis.risks || []).filter(
    (r) => r.riskLevel === "high"
  ).length;

  let normalisedOverallRisk = rawAnalysis.overallRiskLevel;

  if (highSeverityRiskCount >= 2 && normalisedOverallRisk === "low") {
    issues.push(
      `overallRiskLevel was "low" but ${highSeverityRiskCount} high-severity individual risks ` +
      `were found — corrected to "medium" for consistency.`
    );
    normalisedOverallRisk = "medium";
  }

  if (highSeverityRiskCount >= 4 && normalisedOverallRisk !== "high") {
    issues.push(
      `overallRiskLevel was "${normalisedOverallRisk}" but ${highSeverityRiskCount} high-severity ` +
      `individual risks were found — corrected to "high" for consistency.`
    );
    normalisedOverallRisk = "high";
  }

  // ── Obligation party cross-reference ────────────────────────────────────────
  // Soft check (warning only, not a hard failure): obligations should
  // reference parties that actually exist in the parties array. A mismatch
  // here usually means the model used slightly different naming between
  // sections (e.g. "Tenant" in parties but "the Lessee" in obligations) —
  // worth logging for prompt-quality monitoring, but not worth failing
  // the whole analysis over, since the content itself is still useful.

  const partyIdentifiers = new Set(
    (rawAnalysis.parties || []).flatMap((p) => [
      p.name?.toLowerCase().trim(),
      p.role?.toLowerCase().trim(),
    ])
  );

  const unmatchedObligationParties = (rawAnalysis.obligations || [])
    .map((o) => o.party?.toLowerCase().trim())
    .filter((party) => party && !partyIdentifiers.has(party));

  if (unmatchedObligationParties.length > 0) {
    issues.push(
      `${unmatchedObligationParties.length} obligation(s) reference a party not found in the ` +
      `parties array — naming may be inconsistent (non-blocking).`
    );
  }

  // ── Truncate any field that slipped past schema limits in practice ─────────
  // additionalProperties:false and required fields are enforced by the
  // grammar, but the grammar does not enforce string length limits
  // beyond what's described in the schema's prose description. We trim
  // defensively here so a single unusually long field (e.g. originalText
  // far exceeding the "~200 characters" guidance) can't bloat storage.

  const normalisedClauses = (rawAnalysis.legalClauses || []).map((clause) => ({
    ...clause,
    originalText: truncateField(clause.originalText, 300),
  }));

  // ── Empty-result sanity check ───────────────────────────────────────────────
  // If literally everything came back empty, that's a strong signal of a
  // genuine processing problem (e.g. the document text passed in was mostly
  // noise) rather than a legitimately simple document — flag distinctly.

  const allListsEmpty =
    (rawAnalysis.parties || []).length === 0 &&
    (rawAnalysis.legalClauses || []).length === 0 &&
    (rawAnalysis.obligations || []).length === 0 &&
    (rawAnalysis.risks || []).length === 0;

  if (allListsEmpty) {
    issues.push(
      "Analysis returned no parties, clauses, obligations, or risks — verify source document quality."
    );
  }

  return {
    analysis: {
      ...rawAnalysis,
      overallRiskLevel: normalisedOverallRisk,
      legalClauses: normalisedClauses,
    },
    validationIssues: issues,
    isLowConfidence: issues.length > 0 || rawAnalysis.documentTypeConfidence === "low",
  };
};

// ─── Truncate a Field Safely ────────────────────────────────────────────────────

const truncateField = (text, maxLength) => {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trim() + "…";
};
