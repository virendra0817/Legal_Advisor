import { extractTextFromPdf, PdfExtractionError } from "./pdfExtractor.js";
import { extractTextFromDocx, DocxExtractionError } from "./docxExtractor.js";
import { cleanExtractedText } from "./textCleaner.js";
import { structureDocument } from "./textStructurer.js";

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class DocumentProcessingError extends Error {
  constructor(message, code, isRetryable = false) {
    super(message);
    this.name = "DocumentProcessingError";
    this.code = code;
    this.isRetryable = isRetryable; // signals whether the worker should retry or fail permanently
  }
}

// ─── Process a Single Document ─────────────────────────────────────────────────
// The single entry point for the entire extraction → clean → structure
// pipeline. Takes a raw file buffer and its declared extension, returns a
// fully structured, RAG-ready representation.
//
// This function is intentionally format-agnostic at the call site — the
// caller (documentProcessingWorker.js) doesn't need to know which extractor
// ran or how cleaning/structuring works internally. It just gets back a
// consistent result shape regardless of whether the input was a PDF, DOCX,
// or TXT file.

export const processDocument = async (buffer, fileExtension) => {
  const startTime = Date.now();

  // ── Step 1: Format-specific extraction ─────────────────────────────────────

  let extraction;

  try {
    extraction = await extractByFormat(buffer, fileExtension);
  } catch (error) {
    throw mapExtractionError(error, fileExtension);
  }

  if (!extraction.rawText || extraction.rawText.trim().length === 0) {
    throw new DocumentProcessingError(
      "Extraction produced no text content.",
      "EMPTY_EXTRACTION",
      false
    );
  }

  // ── Step 2: Clean the extracted text ────────────────────────────────────────

  const sourceFormat = fileExtension === "pdf" ? "pdf" : fileExtension === "docx" ? "docx" : "txt";
  const { cleanedText, stats: cleaningStats } = cleanExtractedText(extraction.rawText, {
    sourceFormat,
  });

  if (cleanedText.trim().length === 0) {
    // Cleaning removed everything — this means the document was likely
    // pure noise (e.g. a PDF with only repeated headers/footers and no
    // actual body content), which is a real edge case worth surfacing
    // distinctly from a generic extraction failure.
    throw new DocumentProcessingError(
      "Document contained no meaningful text after cleaning. It may be a scanned or image-only file.",
      "NO_CONTENT_AFTER_CLEANING",
      false
    );
  }

  // ── Step 3: Structure the cleaned text ──────────────────────────────────────

  const { sections, sectionCount, metadata } = structureDocument(cleanedText);

  const processingTimeMs = Date.now() - startTime;

  // ── Final result shape — consistent across all file formats ────────────────

  return {
    rawText: cleanedText,           // full cleaned text — used for whole-document analysis
    sections,                       // structured sections — used for chunking/citations
    sectionCount,
    wordCount: countWords(cleanedText),
    pageCount: extraction.pageCount || null, // only populated for PDFs
    language: detectLanguageHint(cleanedText),
    ocrApplied: false,              // set true by a future OCR fallback module
    metadata: {
      ...metadata,
      documentType: inferDocumentType(cleanedText, metadata.detectedActs),
    },
    processing: {
      sourceFormat,
      cleaningStats,
      processingTimeMs,
      extractorWarnings: extraction.warnings || [],
    },
  };
};

// ─── Route to the Correct Extractor ────────────────────────────────────────────

const extractByFormat = async (buffer, fileExtension) => {
  switch (fileExtension) {
    case "pdf": {
      const result = await extractTextFromPdf(buffer);
      return { rawText: result.rawText, pageCount: result.pageCount, warnings: [] };
    }

    case "docx": {
      const result = await extractTextFromDocx(buffer);
      return { rawText: result.rawText, pageCount: null, warnings: result.warnings };
    }

    case "txt": {
      const rawText = buffer.toString("utf-8");
      return { rawText, pageCount: null, warnings: [] };
    }

    default:
      throw new DocumentProcessingError(
        `Unsupported file extension: ${fileExtension}`,
        "UNSUPPORTED_FORMAT",
        false
      );
  }
};

// ─── Map Format-Specific Errors to a Consistent Shape ─────────────────────────
// PdfExtractionError and DocxExtractionError have their own code spaces.
// This normalises them into DocumentProcessingError so the worker only
// ever needs to handle one error type, while preserving the original
// error code for logging/debugging and deciding retryability.

const mapExtractionError = (error, fileExtension) => {
  if (error instanceof PdfExtractionError) {
    const retryableCodes = ["PDF_PARSE_FAILED"]; // transient parse issues may be worth a retry
    return new DocumentProcessingError(
      error.message,
      error.code,
      retryableCodes.includes(error.code)
    );
  }

  if (error instanceof DocxExtractionError) {
    const retryableCodes = ["DOCX_PARSE_FAILED"];
    return new DocumentProcessingError(
      error.message,
      error.code,
      retryableCodes.includes(error.code)
    );
  }

  // Unexpected error — treat as retryable once, in case it's transient
  // (e.g. a momentary out-of-memory condition under load)
  return new DocumentProcessingError(
    `Unexpected error processing ${fileExtension} file: ${error.message}`,
    "UNEXPECTED_PROCESSING_ERROR",
    true
  );
};

// ─── Lightweight Language Detection ────────────────────────────────────────────
// Not a full language detection library — a cheap heuristic that checks
// for Devanagari and other major Indic script Unicode ranges. Good enough
// to flag "this document is primarily in Hindi/Marathi" vs English for
// the parsedContent.language field, without adding a heavy NLP dependency
// for what is ultimately a secondary metadata signal.

const detectLanguageHint = (text) => {
  const sample = text.slice(0, 2000); // sample is sufficient, full-doc scan is wasteful

  const scriptRanges = {
    hi: /[\u0900-\u097F]/g,  // Devanagari (Hindi, Marathi)
    bn: /[\u0980-\u09FF]/g,  // Bengali
    ta: /[\u0B80-\u0BFF]/g,  // Tamil
    te: /[\u0C00-\u0C7F]/g,  // Telugu
    gu: /[\u0A80-\u0AFF]/g,  // Gujarati
    kn: /[\u0C80-\u0CFF]/g,  // Kannada
  };

  let maxMatches = 0;
  let detectedLang = "en";

  for (const [lang, pattern] of Object.entries(scriptRanges)) {
    const matches = sample.match(pattern);
    const count = matches ? matches.length : 0;

    if (count > maxMatches) {
      maxMatches = count;
      detectedLang = lang;
    }
  }

  // Require a meaningful presence of the script, not a stray character —
  // otherwise an English document with one quoted Hindi term would be
  // misclassified
  const significanceThreshold = sample.length * 0.05;

  return maxMatches >= significanceThreshold ? detectedLang : "en";
};

// ─── Infer Document Type ───────────────────────────────────────────────────────
// Heuristic classification based on keyword presence and detected acts.
// This populates Document.metadata.documentType, which feeds the frontend's
// document type badge and helps pre-select the right legal category.
// Order matters — more specific document types are checked before generic ones.

const inferDocumentType = (text, detectedActs) => {
  const lower = text.slice(0, 3000).toLowerCase(); // sample is sufficient for classification

  const typeSignals = [
    { type: "fir", keywords: ["first information report", "f.i.r.", "police station", "under section"] },
    { type: "rent_agreement", keywords: ["rent agreement", "lease deed", "tenant", "landlord", "monthly rent"] },
    { type: "employment_contract", keywords: ["employment agreement", "employee", "employer", "ctc", "notice period"] },
    { type: "legal_notice", keywords: ["legal notice", "notice is hereby given", "advocate for the"] },
    { type: "court_order", keywords: ["in the court of", "honourable court", "petitioner", "respondent", "order dated"] },
    { type: "rti_application", keywords: ["right to information", "public information officer", "rti application"] },
    { type: "affidavit", keywords: ["affidavit", "solemnly affirm", "deponent"] },
    { type: "sale_deed", keywords: ["sale deed", "vendor", "vendee", "consideration of rs"] },
    { type: "power_of_attorney", keywords: ["power of attorney", "attorney holder", "executant"] },
    { type: "marriage_certificate", keywords: ["marriage certificate", "solemnized", "bride", "bridegroom"] },
  ];

  for (const { type, keywords } of typeSignals) {
    const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
    if (matchCount >= 2) return type; // require at least 2 keyword hits to reduce false positives
  }

  // Fall back to act-based inference if keyword matching was inconclusive
  if (detectedActs.some((act) => act.includes("Hindu Marriage Act"))) return "family_law_document";
  if (detectedActs.some((act) => act.includes("IPC"))) return "criminal_law_document";
  if (detectedActs.some((act) => act.includes("RERA"))) return "property_document";

  return "general_legal_document";
};

const countWords = (text) => {
  return text.split(/\s+/).filter(Boolean).length;
};
