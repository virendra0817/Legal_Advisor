// ─── Heading Detection Patterns ────────────────────────────────────────────────
// Legal documents follow fairly predictable heading conventions in India.
// These patterns detect section/clause headers so the document can be
// broken into addressable, citable sections rather than treated as one
// undifferentiated wall of text.

const HEADING_PATTERNS = [
  // Markdown-style headers preserved by docxExtractor.js (# Heading)
  { regex: /^#{1,3}\s+(.+)$/, type: "markdown_heading" },

  // "Section 4: Termination" / "Section 4 - Termination" / "SECTION 4. Termination"
  { regex: /^section\s+\d+[:.\-–]?\s*(.+)?$/i, type: "section_heading" },

  // "Clause 4.1" / "Clause 4.1.2"
  { regex: /^clause\s+\d+(\.\d+)*[:.\-–]?\s*(.+)?$/i, type: "clause_heading" },

  // Numbered list at top level: "1. Definitions" "1) Definitions"
  { regex: /^\d+[.)]\s+([A-Z][A-Za-z\s]{2,60})$/, type: "numbered_heading" },

  // ALL CAPS lines that look like headings (not full sentences) —
  // common in Indian legal/government document formatting:
  // "WHEREAS", "NOW THEREFORE", "TERMS AND CONDITIONS"
  { regex: /^[A-Z][A-Z\s&,]{4,60}$/, type: "caps_heading" },

  // Roman numeral headings: "I. Preamble" "IV. Obligations"
  { regex: /^[IVXLC]+\.\s+([A-Z].{2,60})$/, type: "roman_heading" },
];

// ─── Legal Act/Statute Reference Patterns ─────────────────────────────────────
// Detects references to Indian statutes for the metadata.detectedActs field
// on the Document model — used for category hinting and search filtering.

const ACT_REFERENCE_PATTERNS = [
  /\bIndian Penal Code,?\s*(1860)?\b/gi,
  /\bIPC\s+(Section|S\.?)\s*\d+[A-Za-z]*\b/gi,
  /\bCode of Criminal Procedure,?\s*(1973)?\b/gi,
  /\bCrPC\s+(Section|S\.?)\s*\d+[A-Za-z]*\b/gi,
  /\bCode of Civil Procedure,?\s*(1908)?\b/gi,
  /\bCPC\s+(Section|S\.?)\s*\d+[A-Za-z]*\b/gi,
  /\bConsumer Protection Act,?\s*(2019|1986)?\b/gi,
  /\bReal Estate \(Regulation and Development\) Act,?\s*(2016)?\b/gi,
  /\bRERA\b/g,
  /\bRight to Information Act,?\s*(2005)?\b/gi,
  /\bRTI Act\b/gi,
  /\bHindu Marriage Act,?\s*(1955)?\b/gi,
  /\bInformation Technology Act,?\s*(2000)?\b/gi,
  /\bIT Act,?\s*(2000)?\b/gi,
  /\bTransfer of Property Act,?\s*(1882)?\b/gi,
  /\bIndian Contract Act,?\s*(1872)?\b/gi,
  /\bNegotiable Instruments Act,?\s*(1881)?\b/gi,
  /\bCompanies Act,?\s*(2013)?\b/gi,
  /\bIndustrial Disputes Act,?\s*(1947)?\b/gi,
  /\bConstitution of India\b/gi,
  /\bArticle\s+\d+[A-Za-z]*\s+of\s+the\s+Constitution\b/gi,
];

// ─── Date Pattern ──────────────────────────────────────────────────────────────
// Matches common Indian date formats: "15th March 2024", "15/03/2024",
// "15-03-2024", "March 15, 2024"

const DATE_PATTERNS = [
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
  /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
];

// ─── Main Structuring Function ────────────────────────────────────────────────
// Takes cleaned plain text and returns a structured representation:
// an ordered list of sections (each with a heading, level, and body text),
// plus document-level metadata extracted via pattern matching.

export const structureDocument = (cleanedText) => {
  const lines = cleanedText.split("\n");
  const sections = [];

  let currentSection = {
    heading: null,
    headingType: "preamble", // text before the first detected heading
    level: 0,
    body: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      currentSection.body.push("");
      continue;
    }

    const detectedHeading = detectHeading(trimmed);

    if (detectedHeading) {
      // Close out the current section if it has any content
      if (currentSection.body.some((l) => l.trim().length > 0) || currentSection.heading) {
        sections.push(finaliseSection(currentSection));
      }

      currentSection = {
        heading: detectedHeading.text,
        headingType: detectedHeading.type,
        level: detectedHeading.level,
        body: [],
      };
    } else {
      currentSection.body.push(line);
    }
  }

  // Push the final section
  if (currentSection.body.some((l) => l.trim().length > 0) || currentSection.heading) {
    sections.push(finaliseSection(currentSection));
  }

  const metadata = extractDocumentMetadata(cleanedText);

  return {
    sections,
    sectionCount: sections.length,
    metadata,
  };
};

// ─── Heading Detection ─────────────────────────────────────────────────────────
// Tries each pattern in order and returns the first match. Order matters:
// more specific patterns (markdown, section/clause) are tried before the
// broader, more false-positive-prone caps-heading pattern.

const detectHeading = (line) => {
  // Reject lines that are clearly body text despite matching loosely —
  // a heading is rarely longer than ~100 characters
  if (line.length > 100) return null;

  for (const pattern of HEADING_PATTERNS) {
    const match = line.match(pattern.regex);
    if (match) {
      const level = headingLevelFor(pattern.type, line);
      const text = (match[1] || match[2] || line)
        .replace(/^#{1,3}\s+/, "")
        .trim();

      // Guard against false positives: a "heading" with no real text content
      if (!text || text.length < 2) return null;

      return { text, type: pattern.type, level };
    }
  }

  return null;
};

const headingLevelFor = (type, line) => {
  if (type === "markdown_heading") {
    const hashes = line.match(/^#{1,3}/)?.[0]?.length || 1;
    return hashes;
  }
  if (type === "section_heading") return 1;
  if (type === "clause_heading") {
    // Nested clauses (4.1.2) are deeper than top-level clauses (4)
    const depth = (line.match(/\d+\.\d+/g) || []).length;
    return 2 + depth;
  }
  if (type === "roman_heading") return 1;
  if (type === "caps_heading") return 1;
  if (type === "numbered_heading") return 2;
  return 1;
};

// ─── Finalise a Section ────────────────────────────────────────────────────────
// Joins the body lines, trims excess blank lines, and computes section
// word count — useful later for chunking decisions (a 50-word section
// might be merged with its neighbour; a 2000-word section might need
// splitting into multiple RAG chunks).

const finaliseSection = (section) => {
  const bodyText = section.body
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    heading: section.heading,
    headingType: section.headingType,
    level: section.level,
    text: bodyText,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
  };
};

// ─── Extract Document-Level Metadata ──────────────────────────────────────────
// Scans the full cleaned text (not per-section) for statute references and
// dates. This feeds directly into the Document model's metadata field
// from the Upload module (detectedActs, detectedDates).

const extractDocumentMetadata = (text) => {
  const detectedActs = new Set();

  for (const pattern of ACT_REFERENCE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      detectedActs.add(normaliseActReference(match[0]));
    }
  }

  const detectedDates = new Set();

  for (const pattern of DATE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      detectedDates.add(match[0].trim());
    }
  }

  return {
    detectedActs: [...detectedActs].slice(0, 20),   // cap to avoid noise from over-matching
    detectedDates: [...detectedDates].slice(0, 20),
    estimatedReadingTimeMinutes: Math.ceil(countWords(text) / 200), // ~200 wpm average
  };
};

// Collapses minor variations so "IPC Section 420" and "ipc section 420"
// and "Ipc S. 420" all become one consistent entry rather than three
// near-duplicate strings in the detectedActs array.

const normaliseActReference = (raw) => {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bipc\b/i, "IPC")
    .replace(/\bcrpc\b/i, "CrPC")
    .replace(/\bcpc\b/i, "CPC")
    .replace(/\brera\b/i, "RERA")
    .replace(/\brti\b/i, "RTI");
};

const countWords = (text) => {
  return text.split(/\s+/).filter(Boolean).length;
};

// ─── Flatten Structured Sections Back to Plain Text ───────────────────────────
// Used when the RAG pipeline needs a single text blob (e.g. for the
// map-reduce summarisation pass on very long documents) rather than the
// structured section array. Reconstructs headings with markdown-style
// markers so structure is still visible to the LLM in the prompt.

export const flattenSectionsToText = (sections) => {
  return sections
    .map((section) => {
      const headingMarker = section.heading
        ? `${"#".repeat(Math.min(section.level, 6))} ${section.heading}\n\n`
        : "";
      return `${headingMarker}${section.text}`;
    })
    .join("\n\n")
    .trim();
};
