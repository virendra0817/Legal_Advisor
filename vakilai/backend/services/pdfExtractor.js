import pdfParse from "pdf-parse";

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class PdfExtractionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "PdfExtractionError";
    this.code = code;
  }
}

// ─── Extract Text from PDF Buffer ──────────────────────────────────────────────
// Returns raw, unprocessed text exactly as pdf-parse pulls it from the PDF's
// content streams. No cleaning happens here — that's textCleaner.js's job.
// Keeping extraction and cleaning separate means each can be tested and
// swapped independently (e.g. replacing pdf-parse with a different library
// later doesn't touch the cleaning logic at all).

export const extractTextFromPdf = async (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new PdfExtractionError("Empty or invalid PDF buffer provided.", "EMPTY_BUFFER");
  }

  let result;

  try {
    result = await pdfParse(buffer, {
      // pdf-parse calls this once per page during parsing — we use it to
      // capture per-page text so we can later detect headers/footers that
      // repeat across pages (handled in textCleaner.js)
      pagerender: renderPageWithMarker,
    });
  } catch (error) {
    // pdf-parse throws on encrypted, corrupted, or non-PDF-structured buffers
    if (error.message?.includes("encrypted")) {
      throw new PdfExtractionError(
        "This PDF is password-protected and cannot be processed.",
        "PDF_ENCRYPTED"
      );
    }

    throw new PdfExtractionError(
      `Failed to parse PDF: ${error.message}`,
      "PDF_PARSE_FAILED"
    );
  }

  if (!result.text || result.text.trim().length === 0) {
    // A PDF with zero extractable text is almost always a scanned image —
    // the caller (documentProcessor.js) should fall back to OCR in this case.
    throw new PdfExtractionError(
      "No extractable text found. This PDF may be a scanned image requiring OCR.",
      "NO_TEXT_LAYER"
    );
  }

  return {
    rawText: result.text,
    pageCount: result.numpages,
    pdfInfo: {
      title: result.info?.Title || null,
      author: result.info?.Author || null,
      creationDate: result.info?.CreationDate || null,
      producer: result.info?.Producer || null,
    },
  };
};

// ─── Per-page Render Hook ──────────────────────────────────────────────────────
// pdf-parse's default behaviour concatenates all page text with no separator,
// making it impossible to know where one page ends and the next begins.
// This hook inserts an explicit marker between pages, which textCleaner.js
// uses to detect repeated headers/footers and which textStructurer.js uses
// to preserve page-aware structure for citation purposes later.

const PAGE_BREAK_MARKER = "\n\n[[PAGE_BREAK]]\n\n";

async function renderPageWithMarker(pageData) {
  const textContent = await pageData.getTextContent();

  const pageText = textContent.items
    .map((item) => item.str)
    .join(" ");

  return pageText + PAGE_BREAK_MARKER;
}

export { PAGE_BREAK_MARKER };
