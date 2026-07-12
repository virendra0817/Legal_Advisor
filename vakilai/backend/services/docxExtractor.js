import mammoth from "mammoth";

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class DocxExtractionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "DocxExtractionError";
    this.code = code;
  }
}

// ─── Style Map ──────────────────────────────────────────────────────────────
// Mammoth's default conversion discards most Word styling, which is usually
// correct (we want plain text, not formatting). But we explicitly preserve
// heading levels and list markers as lightweight markdown-style markers,
// because legal documents rely heavily on clause numbering and headings
// for structure ("Section 4: Termination", "1. Tenant obligations").
// textStructurer.js (File 4) uses these markers to detect document sections.

const LEGAL_DOCUMENT_STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "b => strong",
  "i => em",
];

// ─── Extract Text from DOCX Buffer ─────────────────────────────────────────────
// Returns text with lightweight structural markers (headings as #, ## etc.
// after HTML-to-markdown-ish normalisation) so downstream structuring can
// detect document sections without re-parsing the original DOCX XML.

export const extractTextFromDocx = async (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new DocxExtractionError("Empty or invalid DOCX buffer provided.", "EMPTY_BUFFER");
  }

  let htmlResult;

  try {
    // Convert to HTML first — this preserves heading/list structure that
    // a plain extractRawText() call would flatten away entirely.
    htmlResult = await mammoth.convertToHtml(
      { buffer },
      { styleMap: LEGAL_DOCUMENT_STYLE_MAP }
    );
  } catch (error) {
    if (error.message?.includes("not a valid zip") || error.message?.includes("central directory")) {
      throw new DocxExtractionError(
        "This file is not a valid DOCX document. It may be corrupted.",
        "INVALID_DOCX_STRUCTURE"
      );
    }

    throw new DocxExtractionError(
      `Failed to parse DOCX: ${error.message}`,
      "DOCX_PARSE_FAILED"
    );
  }

  // Mammoth surfaces non-fatal issues (unsupported style, missing image, etc.)
  // as "messages" rather than throwing. We log them but don't fail the
  // extraction — a missing inline image reference shouldn't block processing
  // a 10-page contract.
  const warnings = htmlResult.messages
    .filter((m) => m.type === "warning")
    .map((m) => m.message);

  if (!htmlResult.value || htmlResult.value.trim().length === 0) {
    throw new DocxExtractionError(
      "No extractable text found in this document.",
      "NO_TEXT_CONTENT"
    );
  }

  const structuredText = htmlToStructuredText(htmlResult.value);

  return {
    rawText: structuredText,
    warnings,
    wordCount: countWords(structuredText),
  };
};

// ─── HTML to Structured Plain Text ────────────────────────────────────────────
// Converts mammoth's HTML output into plain text while preserving heading
// markers as markdown-style "#" prefixes. This is intentionally simple regex
// processing rather than a full HTML parser, since mammoth's output is
// already a constrained, predictable subset of HTML (we control the style map).

const htmlToStructuredText = (html) => {
  let text = html;

  // Headings → markdown-style markers, preserved on their own line
  text = text.replace(/<h1>(.*?)<\/h1>/gi, "\n\n# $1\n\n");
  text = text.replace(/<h2>(.*?)<\/h2>/gi, "\n\n## $1\n\n");
  text = text.replace(/<h3>(.*?)<\/h3>/gi, "\n\n### $1\n\n");

  // List items → preserve as line items with a dash marker
  text = text.replace(/<li>(.*?)<\/li>/gi, "- $1\n");
  text = text.replace(/<\/?[uo]l>/gi, "\n");

  // Paragraphs → double newline between them (paragraph boundary)
  text = text.replace(/<p>(.*?)<\/p>/gi, "$1\n\n");

  // Table cells → tab-separated, rows newline-separated (legal docs often
  // use tables for parties/clauses/schedules)
  text = text.replace(/<\/td><td>/gi, "\t");
  text = text.replace(/<\/tr><tr>/gi, "\n");
  text = text.replace(/<\/?(table|tbody|thead|tr|td)>/gi, "");

  // Strip any remaining HTML tags (bold/italic markers we don't need
  // as plain text, plus anything mammoth's style map didn't catch)
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities that survive the above
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  return text;
};

// ─── Word Count Helper ─────────────────────────────────────────────────────────

const countWords = (text) => {
  const stripped = text.replace(/[#\-\n\t]/g, " ").trim();
  if (!stripped) return 0;
  return stripped.split(/\s+/).filter(Boolean).length;
};
