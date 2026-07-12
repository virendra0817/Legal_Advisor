import { PAGE_BREAK_MARKER } from "./pdfExtractor.js";

// ─── Main Clean Pipeline ───────────────────────────────────────────────────────
// Runs a fixed sequence of transformations over raw extracted text.
// Order matters here — page-break-dependent steps (header/footer detection)
// must run before the page break markers themselves are stripped out.

export const cleanExtractedText = (rawText, options = {}) => {
  const { sourceFormat = "pdf" } = options; // "pdf" | "docx" | "txt"

  let text = rawText;
  const stats = { originalLength: rawText.length };

  if (sourceFormat === "pdf") {
    // Page-aware cleaning must happen while [[PAGE_BREAK]] markers still exist
    text = removeRepeatedHeadersFooters(text);
    text = stripPageBreakMarkers(text);
  }

  text = normaliseLineEndings(text);
  text = removeControlCharacters(text);
  text = fixHyphenatedLineBreaks(text);
  text = collapseExcessiveWhitespace(text);
  text = removeLikelyOcrArtifacts(text);
  text = normaliseQuotesAndDashes(text);
  text = trimEmptyLines(text);

  stats.cleanedLength = text.length;
  stats.reductionPercent = rawText.length > 0
    ? Math.round((1 - text.length / rawText.length) * 100)
    : 0;

  return { cleanedText: text.trim(), stats };
};

// ─── 1. Remove Repeated Headers/Footers ────────────────────────────────────────
// Splits text on page markers, finds lines that appear identically (or
// near-identically) at the same position across most pages, and removes
// them. This targets the classic "Page X of Y" footer and law-firm
// letterhead headers that repeat on every page and add no informational
// value, while being genuinely harmful noise if embedded as RAG chunks
// (every chunk would falsely "match" any query mentioning the firm name).

const removeRepeatedHeadersFooters = (text) => {
  const pages = text.split(PAGE_BREAK_MARKER).filter((p) => p.trim().length > 0);

  if (pages.length < 3) {
    // Not enough pages to reliably detect a repeating pattern —
    // skip this step rather than risk false positives on a 1-2 page doc
    return text;
  }

  const firstLineCounts = new Map();
  const lastLineCounts  = new Map();

  pages.forEach((page) => {
    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const firstLine = normaliseForComparison(lines[0]);
    const lastLine  = normaliseForComparison(lines[lines.length - 1]);

    firstLineCounts.set(firstLine, (firstLineCounts.get(firstLine) || 0) + 1);
    lastLineCounts.set(lastLine, (lastLineCounts.get(lastLine) || 0) + 1);
  });

  // A line repeating on 60%+ of pages is almost certainly a header/footer,
  // not genuine content (genuine content rarely repeats verbatim across pages)
  const repetitionThreshold = Math.ceil(pages.length * 0.6);

  const headerCandidates = [...firstLineCounts.entries()]
    .filter(([, count]) => count >= repetitionThreshold)
    .map(([line]) => line);

  const footerCandidates = [...lastLineCounts.entries()]
    .filter(([, count]) => count >= repetitionThreshold)
    .map(([line]) => line);

  const cleanedPages = pages.map((page) => {
    const lines = page.split("\n");

    // Remove matching header from the start of the page
    while (lines.length > 0 && headerCandidates.includes(normaliseForComparison(lines[0].trim()))) {
      lines.shift();
    }

    // Remove matching footer from the end of the page
    while (lines.length > 0 && footerCandidates.includes(normaliseForComparison(lines[lines.length - 1].trim()))) {
      lines.pop();
    }

    return lines.join("\n");
  });

  return cleanedPages.join(PAGE_BREAK_MARKER);
};

// Loosely normalises a line for repetition comparison — strips digits so
// "Page 1 of 12" and "Page 2 of 12" are still recognised as the same
// repeating pattern despite the page number changing.
const normaliseForComparison = (line) => {
  return line.toLowerCase().replace(/\d+/g, "#").trim();
};

// ─── 2. Strip Page Break Markers ───────────────────────────────────────────────

const stripPageBreakMarkers = (text) => {
  return text.split(PAGE_BREAK_MARKER).join("\n\n");
};

// ─── 3. Normalise Line Endings ─────────────────────────────────────────────────
// Windows (\r\n) and old Mac (\r) line endings both collapse to \n.
// Mixed line endings are common in documents that have been edited
// across different operating systems over their lifetime.

const normaliseLineEndings = (text) => {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
};

// ─── 4. Remove Control Characters ──────────────────────────────────────────────
// Strips non-printable control characters that sometimes leak through PDF
// extraction (form feed, vertical tab, null bytes) but preserves \n and \t
// since those are meaningful for structure.

const removeControlCharacters = (text) => {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
};

// ─── 5. Fix Hyphenated Line Breaks ─────────────────────────────────────────────
// PDFs frequently break words across lines with a hyphen for justified text:
//   "the ten-
//    ant shall vacate"
// This rejoins "tenant" instead of leaving it as two broken fragments,
// which matters a lot for embedding quality — a split word embeds as
// noise rather than as its actual semantic meaning.

const fixHyphenatedLineBreaks = (text) => {
  return text.replace(/([a-zA-Z])-\n([a-zA-Z])/g, "$1$2");
};

// ─── 6. Collapse Excessive Whitespace ──────────────────────────────────────────
// PDF extraction frequently produces multiple consecutive spaces (from
// justified text spacing) and excessive blank lines. We collapse these
// while preserving single paragraph breaks (double newline).

const collapseExcessiveWhitespace = (text) => {
  return text
    .replace(/[ \t]+/g, " ")           // multiple spaces/tabs → single space
    .replace(/ \n/g, "\n")             // trailing space before newline
    .replace(/\n /g, "\n")             // leading space after newline
    .replace(/\n{3,}/g, "\n\n");       // 3+ consecutive newlines → exactly 2
};

// ─── 7. Remove Likely OCR Artifacts ────────────────────────────────────────────
// When OCR has been applied (scanned documents), common artifacts include
// isolated single characters on their own line (misread punctuation/noise)
// and sequences of repeated special characters. This is a conservative
// heuristic — it only removes lines that are very unlikely to be genuine
// content, to avoid stripping legitimate single-character list markers
// like "a." or "1)".

const removeLikelyOcrArtifacts = (text) => {
  const lines = text.split("\n");

  const cleaned = lines.filter((line) => {
    const trimmed = line.trim();

    // Empty lines are handled separately — keep them for now
    if (trimmed.length === 0) return true;

    // A line that is ONLY repeated special characters (e.g. "‐‐‐‐‐‐‐‐",
    // "......", "________") is almost always an OCR misread of a
    // divider/underline, not content
    if (/^[\-_=~.•·*]{4,}$/.test(trimmed)) return false;

    // A single non-alphanumeric character alone on a line is noise
    if (trimmed.length === 1 && !/[a-zA-Z0-9]/.test(trimmed)) return false;

    return true;
  });

  return cleaned.join("\n");
};

// ─── 8. Normalise Quotes and Dashes ────────────────────────────────────────────
// Word/PDF "smart quotes" and em/en dashes are visually nicer but create
// inconsistency for downstream text matching and embeddings (a search for
// "tenant's rights" with a straight apostrophe should still match text
// extracted with a curly apostrophe). Normalising to ASCII equivalents
// keeps the corpus consistent.

const normaliseQuotesAndDashes = (text) => {
  return text
    .replace(/[\u2018\u2019]/g, "'")   // curly single quotes → straight
    .replace(/[\u201C\u201D]/g, '"')   // curly double quotes → straight
    .replace(/[\u2013\u2014]/g, "-")   // en-dash, em-dash → hyphen
    .replace(/\u2026/g, "...");        // ellipsis character → three dots
};

// ─── 9. Trim Empty Lines ───────────────────────────────────────────────────────
// Final pass — removes leading/trailing blank lines from the whole document
// and any remaining lines that are pure whitespace.

const trimEmptyLines = (text) => {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+$/, "")) // trim trailing whitespace per line
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
};
