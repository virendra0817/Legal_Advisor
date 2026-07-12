import Document from "../models/Document.js";
import DocumentAnalysis from "../models/DocumentAnalysis.js";
import { getStructuredCompletion, MistralAnalysisError } from "./mistralClient.js";
import {
  DOCUMENT_ANALYSIS_SCHEMA,
  buildAnalysisSystemPrompt,
  buildAnalysisUserPrompt,
  MAX_DOCUMENT_CHARS,
} from "./analysisPromptBuilder.js";
import {
  validateAndNormaliseAnalysis,
  AnalysisValidationError,
} from "./analysisResponseParser.js";

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class DocumentAnalyzerError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = "DocumentAnalyzerError";
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

// Output tokens scale with how much structured content a document
// genuinely contains — a 2-page document and a 20-page contract both
// need to fit within this ceiling, so it's set generously.
const ANALYSIS_MAX_OUTPUT_TOKENS = 8192;

// ─── Analyse a Document ─────────────────────────────────────────────────────────
// The single entry point for this entire module. Takes a documentId,
// orchestrates the full pipeline (fetch → prompt → Claude → validate →
// persist), and returns the saved DocumentAnalysis record.
//
// This function is called by analysisController.js for the synchronous,
// user-triggered "analyse this document" flow. Unlike the text-extraction
// worker (which polls in the background), analysis is triggered on demand
// since it costs real money per call and users may never click "analyse"
// for every document they upload.

export const analyzeDocument = async (documentId, userId, options = {}) => {
  const { legalCategory = null, forceReanalysis = false } = options;

  // ── 1. Fetch the document with its parsed text ──────────────────────────────

  const document = await Document.findOne({
    _id: documentId,
    userId,
    isDeleted: false,
  }).select("+parsedContent.rawText");

  if (!document) {
    throw new DocumentAnalyzerError("Document not found.", "DOCUMENT_NOT_FOUND", false);
  }

  if (document.status !== "ready") {
    throw new DocumentAnalyzerError(
      `Document is not ready for analysis (current status: ${document.status}). ` +
      `Text extraction must complete first.`,
      "DOCUMENT_NOT_READY",
      false
    );
  }

  if (!document.parsedContent?.rawText) {
    throw new DocumentAnalyzerError(
      "Document has no extracted text available for analysis.",
      "NO_TEXT_AVAILABLE",
      false
    );
  }

  // ── 2. Check for an existing analysis (avoid redundant API spend) ──────────

  const existingAnalysis = await DocumentAnalysis.findOne({
    documentId,
    userId,
    isStale: false,
  });

  if (existingAnalysis && !forceReanalysis) {
    return { analysis: existingAnalysis, wasCached: true };
  }

  // ── 3. Build the prompt ──────────────────────────────────────────────────────

  const systemPrompt = buildAnalysisSystemPrompt({ legalCategory });
  const userPrompt = buildAnalysisUserPrompt(document.parsedContent.rawText, {
    fileName: document.fileName,
  });

  const wasTruncated = document.parsedContent.rawText.length > MAX_DOCUMENT_CHARS;

  // ── 4. Call Claude with structured output ───────────────────────────────────

  let completionResult;

  try {
    completionResult = await getStructuredCompletion({
      systemPrompt,
      userPrompt,
      jsonSchema: DOCUMENT_ANALYSIS_SCHEMA,
      maxTokens: ANALYSIS_MAX_OUTPUT_TOKENS,
    });
  } catch (error) {
    if (error instanceof ClaudeAnalysisError) {
      throw new DocumentAnalyzerError(error.message, error.code, error.isRetryable);
    }
    throw new DocumentAnalyzerError(
      `Unexpected error during analysis: ${error.message}`,
      "UNEXPECTED_ANALYSIS_ERROR",
      true
    );
  }

  // ── 5. Validate and normalise the structured output ─────────────────────────

  let validated;

  try {
    validated = validateAndNormaliseAnalysis(completionResult.data, {
      documentId,
      fileName: document.fileName,
    });
  } catch (error) {
    if (error instanceof AnalysisValidationError) {
      throw new DocumentAnalyzerError(error.message, error.code, false);
    }
    throw error;
  }

  if (validated.validationIssues.length > 0) {
    console.warn(
      `Analysis validation issues for document ${documentId}:`,
      validated.validationIssues
    );
  }

  // ── 6. Mark any previous analysis as stale ──────────────────────────────────
  // Rather than overwriting the previous analysis in place, we keep history.
  // This means a user can see how an analysis changed after re-running it
  // (useful if the document's parsed text was improved, e.g. after an
  // OCR re-process), and it preserves an audit trail.

  if (existingAnalysis) {
    existingAnalysis.isStale = true;
    await existingAnalysis.save();
  }

  // ── 7. Persist the new analysis ─────────────────────────────────────────────

  const analysis = await DocumentAnalysis.create({
    documentId,
    userId,
    ...validated.analysis,
    isLowConfidence: validated.isLowConfidence,
    validationIssues: validated.validationIssues,
    wasTruncated,
    isStale: false,
    modelUsed: completionResult.model,
    tokenUsage: {
      inputTokens: completionResult.usage.inputTokens,
      outputTokens: completionResult.usage.outputTokens,
    },
    analysedAt: new Date(),
  });

  // ── 8. Sync key fields back onto the Document record ───────────────────────
  // The Document model's metadata.documentType (populated by the
  // keyword-heuristic in documentProcessor.js during text extraction) gets
  // superseded by the much more accurate AI-classified type, since this
  // is a far stronger signal than the earlier regex-based heuristic.

  document.metadata.documentType = validated.analysis.documentType;
  document.metadata.parties = validated.analysis.parties.map((p) => p.name);
  await document.save();

  return { analysis, wasCached: false };
};

// ─── Get the Latest Analysis for a Document ────────────────────────────────────
// Read-only accessor — does not trigger a new Claude call.

export const getLatestAnalysis = async (documentId, userId) => {
  const analysis = await DocumentAnalysis.findOne({
    documentId,
    userId,
    isStale: false,
  });

  if (!analysis) {
    throw new DocumentAnalyzerError(
      "No analysis found for this document. Run analysis first.",
      "ANALYSIS_NOT_FOUND",
      false
    );
  }

  return analysis;
};

