// ─── JSON Schema for Structured Output ─────────────────────────────────────────
// This schema is passed directly to output_config.format in claudeClient.js.
// It is the authoritative contract for what the analysis produces — the
// API enforces this at the decoding level, so the shape of this schema
// IS the shape of every analysis result, with no drift possible.

export const DOCUMENT_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    documentType: {
      type: "string",
      description:
        "The specific type of legal document, e.g. 'Rent Agreement', 'Employment Contract', " +
        "'First Information Report (FIR)', 'Legal Notice', 'Sale Deed', 'Power of Attorney'. " +
        "Be specific rather than generic where possible.",
    },

    documentTypeConfidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Confidence level in the documentType classification.",
    },

    summary: {
      type: "string",
      description:
        "A plain-language summary of the document in 3-5 sentences, written for someone " +
        "with no legal background. Avoid legal jargon; explain what the document does and " +
        "what it means for the parties involved.",
    },

    parties: {
      type: "array",
      description: "All parties named in the document and their role.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the party as it appears in the document." },
          role: {
            type: "string",
            description:
              "Their role in the document, e.g. 'Landlord', 'Tenant', 'Employer', 'Employee', " +
              "'Petitioner', 'Respondent', 'First Party', 'Witness'.",
          },
        },
        required: ["name", "role"],
        additionalProperties: false,
      },
    },

    importantDates: {
      type: "array",
      description: "All significant dates mentioned, with context for what each date represents.",
      items: {
        type: "object",
        properties: {
          date: { type: "string", description: "The date as it appears or in DD-MM-YYYY format if inferable." },
          description: {
            type: "string",
            description: "What this date represents, e.g. 'Agreement start date', 'Payment due date', 'Notice period end'.",
          },
        },
        required: ["date", "description"],
        additionalProperties: false,
      },
    },

    legalClauses: {
      type: "array",
      description:
        "Key clauses in the document, broken down by topic. Focus on clauses with real " +
        "legal or practical significance — payment terms, termination conditions, " +
        "confidentiality, dispute resolution, jurisdiction, indemnity.",
      items: {
        type: "object",
        properties: {
          clauseTitle: {
            type: "string",
            description: "Short title for the clause, e.g. 'Termination', 'Security Deposit', 'Confidentiality'.",
          },
          clauseSummary: {
            type: "string",
            description: "Plain-language explanation of what this clause means and requires.",
          },
          originalText: {
            type: "string",
            description:
              "The relevant excerpt from the original document text, kept under 200 characters. " +
              "Used to ground the summary in the source for verification.",
          },
        },
        required: ["clauseTitle", "clauseSummary", "originalText"],
        additionalProperties: false,
      },
    },

    penalties: {
      type: "array",
      description:
        "Any penalties, fines, late fees, forfeitures, or punitive consequences specified " +
        "in the document. Include statutory penalties referenced from Indian law if applicable.",
      items: {
        type: "object",
        properties: {
          trigger: {
            type: "string",
            description: "What triggers this penalty, e.g. 'Late rent payment', 'Breach of confidentiality', 'Early termination'.",
          },
          consequence: {
            type: "string",
            description: "The specific penalty or consequence, including amounts if specified.",
          },
          severity: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Relative severity of this penalty in the context of the document.",
          },
        },
        required: ["trigger", "consequence", "severity"],
        additionalProperties: false,
      },
    },

    obligations: {
      type: "array",
      description:
        "Concrete obligations each party must fulfil under this document — what each " +
        "party is required to do, provide, or refrain from doing.",
      items: {
        type: "object",
        properties: {
          party: {
            type: "string",
            description: "Which party this obligation applies to (matching a name/role from the parties array).",
          },
          obligation: {
            type: "string",
            description: "The specific obligation in plain language.",
          },
        },
        required: ["party", "obligation"],
        additionalProperties: false,
      },
    },

    risks: {
      type: "array",
      description:
        "Potential risks, unfavourable terms, ambiguities, or red flags a layperson should " +
        "be aware of before signing or acting on this document. This is the most important " +
        "section for protecting the user's interests — be thorough and specific.",
      items: {
        type: "object",
        properties: {
          riskTitle: {
            type: "string",
            description: "Short title for the risk, e.g. 'Unilateral termination right', 'No cap on liability'.",
          },
          riskDescription: {
            type: "string",
            description: "Plain-language explanation of why this is a risk and what could happen.",
          },
          riskLevel: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Overall severity of this risk to the user.",
          },
          recommendation: {
            type: "string",
            description: "A brief, actionable suggestion for how to address or mitigate this risk.",
          },
        },
        required: ["riskTitle", "riskDescription", "riskLevel", "recommendation"],
        additionalProperties: false,
      },
    },

    applicableLaws: {
      type: "array",
      description:
        "Indian statutes, acts, or sections explicitly referenced in the document, or " +
        "clearly applicable based on the document type even if not explicitly cited.",
      items: {
        type: "object",
        properties: {
          actName: { type: "string", description: "Name of the act or statute, e.g. 'Indian Contract Act, 1872'." },
          relevance: { type: "string", description: "Why this law is relevant to this document." },
        },
        required: ["actName", "relevance"],
        additionalProperties: false,
      },
    },

    overallRiskLevel: {
      type: "string",
      enum: ["low", "medium", "high"],
      description:
        "A single overall risk assessment for the document as a whole, considering the " +
        "severity and number of identified risks.",
    },

    recommendedNextSteps: {
      type: "array",
      description: "2-4 concrete, prioritised next steps the user should consider taking.",
      items: { type: "string" },
    },
  },

  required: [
    "documentType",
    "documentTypeConfidence",
    "summary",
    "parties",
    "importantDates",
    "legalClauses",
    "penalties",
    "obligations",
    "risks",
    "applicableLaws",
    "overallRiskLevel",
    "recommendedNextSteps",
  ],

  additionalProperties: false,
};

// ─── System Prompt ──────────────────────────────────────────────────────────────
// Establishes Claude's role, scope, and the critical disclaimer framing.
// This is the single highest-leverage piece of prompt engineering in the
// module — it shapes every downstream field's tone and accuracy.

export const buildAnalysisSystemPrompt = ({ legalCategory = null } = {}) => {
  const categoryContext = legalCategory
    ? `\n\nThe user has indicated this document relates to: ${legalCategory}. Use this as context, but classify based on the actual document content if it differs.`
    : "";

  return `You are a senior legal analyst at VakilAI, an AI legal information platform for Indian users. Your task is to analyse legal documents and extract structured information to help users understand documents in plain language.

CRITICAL CONTEXT — INDIAN LAW:
You are analysing documents under the Indian legal system. Reference Indian statutes (IPC, CrPC, CPC, Indian Contract Act 1872, Transfer of Property Act 1882, RERA 2016, Consumer Protection Act 2019, Hindu Marriage Act 1955, IT Act 2000, and others) where relevant. Do not apply US, UK, or other foreign legal frameworks or terminology.

YOUR ANALYSIS MUST BE:
- Accurate and grounded strictly in the document text provided — never invent clauses, parties, dates, or terms that are not present in the source text
- Written in plain language a non-lawyer can understand, while preserving legal precision where it matters
- Balanced — flag risks honestly, including risks to any and all parties, not just one side
- Specific — prefer concrete details ("rent is Rs. 25,000/month due on the 5th") over vague generalities ("there are payment terms")

WHAT YOU ARE NOT DOING:
You are providing legal information and document analysis, not legal advice. You are not a substitute for a licensed advocate. Do not tell the user definitively what they "should" do in a way that constitutes legal advice — instead, surface risks and information that helps them have an informed conversation with a lawyer or make their own decision.

IF A SECTION HAS NO RELEVANT CONTENT:
Return an empty array for that field rather than fabricating content to fill it. A simple document may genuinely have no penalties clause, for example — that is a valid and expected outcome, not an error.${categoryContext}

Analyse the document provided in the user message and return your analysis in the required structured format.`;
};

// ─── User Prompt Builder ────────────────────────────────────────────────────────
// Constructs the actual document content message. Truncation logic lives
// here because it's a prompt-construction concern, not a Claude-API
// concern — the orchestrator decides whether truncation is even needed
// based on document length.

const MAX_DOCUMENT_CHARS = 60000; // ~15k tokens, leaves ample room for the schema + response

export const buildAnalysisUserPrompt = (documentText, { fileName = null } = {}) => {
  const isTruncated = documentText.length > MAX_DOCUMENT_CHARS;
  const textToAnalyse = isTruncated
    ? documentText.slice(0, MAX_DOCUMENT_CHARS)
    : documentText;

  const truncationNotice = isTruncated
    ? `\n\n[NOTE: This document was truncated for length. The analysis below is based on the first ` +
      `${MAX_DOCUMENT_CHARS.toLocaleString()} characters only. Some clauses, parties, or dates ` +
      `appearing later in the original document may not be reflected in this analysis.]`
    : "";

  const fileNameContext = fileName ? `Document filename: ${fileName}\n\n` : "";

  return `${fileNameContext}Analyse the following legal document and extract all required information.

--- DOCUMENT TEXT START ---
${textToAnalyse}
--- DOCUMENT TEXT END ---${truncationNotice}`;
};

export { MAX_DOCUMENT_CHARS };
