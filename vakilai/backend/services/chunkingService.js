// ─── Chunking Configuration ────────────────────────────────────────────────────

// Target chunk size in words — tuned for embedding model context and for
// producing chunks that are large enough to carry meaningful semantic
// content but small enough that a retrieved chunk maps to roughly one
// coherent idea (not half a page of unrelated clauses).
const TARGET_CHUNK_WORDS = 220;

// Chunks below this size get merged with an adjacent section rather than
// embedded standalone — a 15-word section produces a low-information
// embedding that mostly just adds noise to the vector index.
const MIN_CHUNK_WORDS = 40;

// Overlap between consecutive sub-chunks of a large section. This prevents
// a clause that happens to fall exactly on a chunk boundary from being
// split with neither half containing enough context to be useful on its own.
const CHUNK_OVERLAP_WORDS = 40;

// ─── Chunk a Structured Document ───────────────────────────────────────────────
// Takes the `sections` array produced by textStructurer.js (from the
// Document Processing module) and produces a flat array of chunks ready
// for embedding. Each chunk carries enough metadata to reconstruct exactly
// where it came from in the source document — essential for citations.

export const chunkDocument = (sections, documentContext = {}) => {
  const { documentId, fileName } = documentContext;

  // ── Pass 1: merge undersized sections with their neighbours ────────────────
  // A document with many short clauses (e.g. a numbered list of definitions)
  // would otherwise produce dozens of tiny, low-value chunks.

  const mergedSections = mergeSmallSections(sections);

  // ── Pass 2: split oversized sections, chunk everything else as-is ──────────

  const chunks = [];
  let chunkIndex = 0;

  for (const section of mergedSections) {
    const subChunks = splitSectionIfNeeded(section);

    for (const subChunk of subChunks) {
      chunks.push({
        chunkId: `${documentId}_${chunkIndex}`,
        documentId,
        fileName: fileName || null,
        chunkIndex,
        text: subChunk.text,
        heading: subChunk.heading,
        headingType: subChunk.headingType,
        sectionLevel: subChunk.level,
        wordCount: subChunk.text.split(/\s+/).filter(Boolean).length,
        isPartialSection: subChunk.isPartial,
      });
      chunkIndex++;
    }
  }

  return chunks;
};

// ─── Merge Small Sections ───────────────────────────────────────────────────────
// Walks the section list and combines any section under MIN_CHUNK_WORDS
// with the following section, carrying the earlier heading forward as
// context. Only merges forward (never backward) to keep the logic simple
// and predictable — a short final section in the document just stays
// short rather than needing special-cased backward merging.

const mergeSmallSections = (sections) => {
  const merged = [];
  let pending = null;

  for (const section of sections) {
    const wordCount = section.text.split(/\s+/).filter(Boolean).length;

    if (pending) {
      // Combine the pending small section with this one
      pending = {
        heading: pending.heading, // keep the earlier (often more specific) heading
        headingType: pending.headingType,
        level: pending.level,
        text: `${pending.text}\n\n${section.heading ? section.heading + "\n" : ""}${section.text}`.trim(),
      };

      const combinedWordCount = pending.text.split(/\s+/).filter(Boolean).length;

      if (combinedWordCount >= MIN_CHUNK_WORDS) {
        merged.push(pending);
        pending = null;
      }
      // else: still too small even combined — keep accumulating into `pending`
      continue;
    }

    if (wordCount < MIN_CHUNK_WORDS && wordCount > 0) {
      pending = { ...section };
      continue;
    }

    merged.push(section);
  }

  // Flush any trailing small section that never got merged forward
  if (pending) {
    merged.push(pending);
  }

  return merged;
};

// ─── Split a Section if it Exceeds Target Size ─────────────────────────────────
// Large sections (a long "Terms and Conditions" block with no sub-headings,
// for example) get split into overlapping word-count windows. Splitting on
// sentence boundaries (not mid-word) keeps each chunk readable and
// grammatically coherent for the embedding model.

const splitSectionIfNeeded = (section) => {
  const words = section.text.split(/\s+/).filter(Boolean);

  if (words.length <= TARGET_CHUNK_WORDS) {
    return [
      {
        text: section.text,
        heading: section.heading,
        headingType: section.headingType,
        level: section.level,
        isPartial: false,
      },
    ];
  }

  // Split on sentence boundaries first, then group sentences into
  // word-count-bounded windows — this avoids ever cutting a sentence
  // in half, which would produce a chunk ending mid-thought.
  const sentences = section.text.match(/[^.!?]+[.!?]+(\s|$)/g) || [section.text];

  const subChunks = [];
  let currentWindow = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWordCount = sentence.split(/\s+/).filter(Boolean).length;

    if (currentWordCount + sentenceWordCount > TARGET_CHUNK_WORDS && currentWindow.length > 0) {
      subChunks.push(currentWindow.join(""));

      // Carry the last few sentences forward as overlap context, rather
      // than starting the next window from a hard cut — this is what
      // prevents a clause from losing context because it landed at a
      // chunk boundary.
      const overlapSentences = takeLastNWords(currentWindow, CHUNK_OVERLAP_WORDS);
      currentWindow = overlapSentences;
      currentWordCount = overlapSentences.join("").split(/\s+/).filter(Boolean).length;
    }

    currentWindow.push(sentence);
    currentWordCount += sentenceWordCount;
  }

  if (currentWindow.length > 0) {
    subChunks.push(currentWindow.join(""));
  }

  return subChunks.map((text, i) => ({
    text: text.trim(),
    // Only the first sub-chunk keeps the original heading attached as
    // its primary label — later sub-chunks reference it via headingType
    // "continuation" so retrieval results can still show which section
    // they came from without implying they're the section's start.
    heading: i === 0 ? section.heading : `${section.heading} (continued)`,
    headingType: i === 0 ? section.headingType : "continuation",
    level: section.level,
    isPartial: true,
  }));
};

// ─── Take the Last N Words Worth of Sentences ──────────────────────────────────
// Used to build the overlap window — walks backward through the sentence
// array accumulating whole sentences until the word budget is hit, so
// overlap never starts mid-sentence either.

const takeLastNWords = (sentences, wordBudget) => {
  const result = [];
  let count = 0;

  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentenceWordCount = sentences[i].split(/\s+/).filter(Boolean).length;
    if (count >= wordBudget) break;
    result.unshift(sentences[i]);
    count += sentenceWordCount;
  }

  return result;
};

export { TARGET_CHUNK_WORDS, MIN_CHUNK_WORDS, CHUNK_OVERLAP_WORDS };
