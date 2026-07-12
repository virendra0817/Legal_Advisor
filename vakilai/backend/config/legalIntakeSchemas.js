// ─── Legal Intake Schemas ───────────────────────────────────────────────────────
// Each entry defines the structured "facts checklist" for one legal category —
// the deterministic source of truth for what the consultation must establish
// before it is allowed to generate guidance. This is intentionally NOT left
// to the model to improvise; a model deciding on the fly what's "relevant
// enough to ask" would produce inconsistent intake quality across sessions
// and make it impossible to know when intake is actually complete.
//
// Structure of each slot:
//   key          - unique identifier, used as the field name in stored answers
//   label        - human-readable name, shown in summaries and to the model
//   question     - the DEFAULT question text if the model needs a fallback
//                  (the model is still expected to phrase this naturally and
//                  empathetically — this is a safety net, not what's shown verbatim)
//   required     - true if guidance cannot be generated without this fact
//   type         - "text" | "enum" | "date" | "boolean" | "number"
//   options      - for type "enum", the allowed values
//   dependsOn    - optional: { key, value } — only ask this if another slot
//                  already has a specific value (conditional branching)

export const LEGAL_INTAKE_SCHEMAS = {
  "tenant-landlord-dispute": {
    categoryLabel: "Tenant-Landlord Dispute",
    slots: [
      {
        key: "state",
        label: "State / Union Territory",
        question: "Which state or city is the rental property located in?",
        required: true,
        type: "text",
      },
      {
        key: "hasWrittenAgreement",
        label: "Written rent agreement exists",
        question: "Do you have a written, signed rent agreement?",
        required: true,
        type: "boolean",
      },
      {
        key: "agreementRegistered",
        label: "Agreement is registered",
        question: "Is the rent agreement registered with the sub-registrar?",
        required: false,
        type: "boolean",
        dependsOn: { key: "hasWrittenAgreement", value: true },
      },
      {
        key: "issueType",
        label: "Type of dispute",
        question: "What is the main issue: security deposit, eviction, unpaid rent, repairs, or something else?",
        required: true,
        type: "enum",
        options: ["security_deposit", "eviction", "unpaid_rent", "repairs", "rent_increase", "other"],
      },
      {
        key: "tenancyStartDate",
        label: "Tenancy start date",
        question: "When did the tenancy begin (approximately)?",
        required: true,
        type: "date",
      },
      {
        key: "noticeReceived",
        label: "Notice received",
        question: "Have you received any written notice from the landlord (or sent one, if you're the landlord)?",
        required: false,
        type: "boolean",
      },
    ],
  },

  "consumer-complaint": {
    categoryLabel: "Consumer Complaint",
    slots: [
      {
        key: "state",
        label: "State / Union Territory",
        question: "Which state are you located in?",
        required: true,
        type: "text",
      },
      {
        key: "transactionType",
        label: "Type of transaction",
        question: "Was this a purchase of goods, a service, or an online order?",
        required: true,
        type: "enum",
        options: ["goods", "service", "online_order", "real_estate", "financial_service", "other"],
      },
      {
        key: "transactionDate",
        label: "Transaction date",
        question: "When did this purchase or transaction take place?",
        required: true,
        type: "date",
      },
      {
        key: "amountInvolved",
        label: "Amount involved",
        question: "What is the approximate amount of money involved?",
        required: true,
        type: "number",
      },
      {
        key: "sellerContacted",
        label: "Seller already contacted",
        question: "Have you already raised this issue with the seller or company?",
        required: true,
        type: "boolean",
      },
      {
        key: "hasProofOfPurchase",
        label: "Proof of purchase available",
        question: "Do you have a receipt, invoice, or order confirmation?",
        required: false,
        type: "boolean",
      },
    ],
  },

  "employment-dispute": {
    categoryLabel: "Employment Dispute",
    slots: [
      {
        key: "state",
        label: "State of employment",
        question: "Which state is your employer based in, or where do you work?",
        required: true,
        type: "text",
      },
      {
        key: "issueType",
        label: "Type of issue",
        question: "Is this about termination, unpaid salary or dues, harassment, or something else?",
        required: true,
        type: "enum",
        options: ["termination", "unpaid_dues", "harassment", "notice_period", "discrimination", "other"],
      },
      {
        key: "hasEmploymentContract",
        label: "Written employment contract exists",
        question: "Do you have a written employment contract or appointment letter?",
        required: true,
        type: "boolean",
      },
      {
        key: "tenureLength",
        label: "Length of employment",
        question: "How long had you been employed there?",
        required: true,
        type: "text",
      },
      {
        key: "incidentDate",
        label: "Date of incident",
        question: "When did this issue occur (approximately)?",
        required: true,
        type: "date",
      },
    ],
  },

  "fir-criminal-complaint": {
    categoryLabel: "FIR / Criminal Complaint",
    slots: [
      {
        key: "state",
        label: "State / Police jurisdiction",
        question: "Which state and city did this incident occur in?",
        required: true,
        type: "text",
      },
      {
        key: "incidentDate",
        label: "Date of incident",
        question: "When did the incident occur?",
        required: true,
        type: "date",
      },
      {
        key: "firStatus",
        label: "FIR status",
        question: "Has an FIR already been filed, or are you trying to file one?",
        required: true,
        type: "enum",
        options: ["not_filed", "filed_pending", "filed_investigation_ongoing", "filed_closed", "refused_by_police"],
      },
      {
        key: "incidentType",
        label: "Nature of incident",
        question: "Can you briefly describe what happened: theft, assault, fraud, harassment, or another type of incident?",
        required: true,
        type: "text",
      },
      {
        key: "isComplainantOrAccused",
        label: "Role in the matter",
        question: "Are you the person who wants to file the complaint, or has a complaint been filed against you?",
        required: true,
        type: "enum",
        options: ["complainant", "accused", "witness", "other"],
      },
    ],
  },

  "family-law": {
    categoryLabel: "Family Law",
    slots: [
      {
        key: "state",
        label: "State of residence",
        question: "Which state do you currently reside in?",
        required: true,
        type: "text",
      },
      {
        key: "issueType",
        label: "Type of matter",
        question: "Is this about divorce, maintenance, child custody, domestic violence, or another family matter?",
        required: true,
        type: "enum",
        options: ["divorce", "maintenance", "custody", "domestic_violence", "succession", "other"],
      },
      {
        key: "marriageAct",
        label: "Marriage governed by",
        question: "Was the marriage solemnised under Hindu, Muslim, Christian, Parsi, or Special Marriage Act?",
        required: false,
        type: "enum",
        options: ["hindu_marriage_act", "muslim_personal_law", "christian_marriage_act", "parsi_law", "special_marriage_act", "unsure"],
      },
      {
        key: "marriageDate",
        label: "Date of marriage",
        question: "When did the marriage take place?",
        required: false,
        type: "date",
        dependsOn: { key: "issueType", value: "divorce" },
      },
      {
        key: "childrenInvolved",
        label: "Children involved",
        question: "Are there any children involved in this matter?",
        required: true,
        type: "boolean",
      },
    ],
  },

  "general-legal-query": {
    categoryLabel: "General Legal Query",
    slots: [
      {
        key: "state",
        label: "State / Union Territory",
        question: "Which state are you located in? Indian law can vary by state.",
        required: true,
        type: "text",
      },
      {
        key: "briefSituation",
        label: "Brief situation description",
        question: "Could you describe your situation in a bit more detail?",
        required: true,
        type: "text",
      },
    ],
  },
};

// ─── Helper: Get Schema for a Category ─────────────────────────────────────────

export const getIntakeSchema = (categorySlug) => {
  return LEGAL_INTAKE_SCHEMAS[categorySlug] || LEGAL_INTAKE_SCHEMAS["general-legal-query"];
};

// ─── Helper: Get All Category Slugs ────────────────────────────────────────────

export const getAllCategorySlugs = () => Object.keys(LEGAL_INTAKE_SCHEMAS);

// ─── Helper: Resolve Applicable Slots Given Current Answers ────────────────────
// Filters out slots whose dependsOn condition isn't met yet — e.g. don't
// ask "is the agreement registered" until we know a written agreement
// exists at all. This is what makes the checklist feel like a natural
// conversation rather than a rigid linear form.

export const resolveApplicableSlots = (categorySlug, currentAnswers = {}) => {
  const schema = getIntakeSchema(categorySlug);

  return schema.slots.filter((slot) => {
    if (!slot.dependsOn) return true;
    return currentAnswers[slot.dependsOn.key] === slot.dependsOn.value;
  });
};
