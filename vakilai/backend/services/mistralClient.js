import { Mistral } from "@mistralai/mistralai";
import dotenv from "dotenv";

dotenv.config();

// ─── Configuration ─────────────────────────────────────────────────────────────

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

if (!MISTRAL_API_KEY) {
  console.error("FATAL: MISTRAL_API_KEY is not set in environment.");
  process.exit(1);
}

export const ANALYSIS_MODEL =
  process.env.MISTRAL_ANALYSIS_MODEL || "mistral-medium-latest";

// Shared client instance
const mistral = new Mistral({
  apiKey: MISTRAL_API_KEY,
});

// ─── Custom Error ──────────────────────────────────────────────────────────────

export class MistralAnalysisError extends Error {
  constructor(message, code = "UNKNOWN", retryable = false) {
    super(message);
    this.name = "MistralAnalysisError";
    this.code = code;
    this.retryable = retryable;
  }
}
// ─── Structured Completion Call ────────────────────────────────────────────────
// The single entry point for every Claude call in this module. Uses native
// Structured Outputs (output_config.format) rather than prompt-based JSON
// instructions — this guarantees schema-compliant output at the API level
// via constrained decoding, eliminating the need for defensive JSON-repair
// logic that hand-rolled "please return JSON" prompting would require.

// ─── Structured Completion ────────────────────────────────────────────────────

export const getStructuredCompletion = async ({
  systemPrompt,
  userPrompt,
  jsonSchema,
  maxTokens = 4096,
}) => {
  try {
    const response = await mistral.chat.complete({
      model: ANALYSIS_MODEL,

      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],

      responseFormat: {
        type: "json_object",
      },

      maxTokens,
      temperature: 0.1,
    });

    if (!response.choices?.length) {
      throw new MistralAnalysisError(
        "Mistral returned no completion.",
        "EMPTY_RESPONSE"
      );
    }

    const content = response.choices[0].message.content;

    if (!content) {
      throw new MistralAnalysisError(
        "Empty response from Mistral.",
        "EMPTY_CONTENT"
      );
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new MistralAnalysisError(
        `Invalid JSON returned: ${err.message}`,
        "JSON_PARSE_FAILED"
      );
    }

    return {
      data: parsed,

      usage: {
        inputTokens: response.usage?.promptTokens || 0,
        outputTokens: response.usage?.completionTokens || 0,
        totalTokens: response.usage?.totalTokens || 0,
      },

      model: response.model,
      stopReason: response.choices[0].finishReason,
    };
  } catch (error) {
    throw mapMistralError(error);
  }
};

// ─── Map Anthropic SDK Errors to Our Error Shape ───────────────────────────────
// The Anthropic SDK throws typed errors (APIError subclasses) with a
// `status` field. We map these to ClaudeAnalysisError with an isRetryable
// flag so the calling worker can make the same retry/permanent-fail
// decision pattern already used in the document processing worker.

// ─── Error Mapping ────────────────────────────────────────────────────────────

const mapMistralError = (error) => {
  const status = error?.status || error?.response?.status;

  if (status === 400) {
    return new MistralAnalysisError(
      `Invalid request: ${error.message}`,
      "INVALID_REQUEST",
      false
    );
  }

  if (status === 401 || status === 403) {
    return new MistralAnalysisError(
      "Invalid Mistral API Key.",
      "AUTH_ERROR",
      false
    );
  }

  if (status === 404) {
    return new MistralAnalysisError(
      "Requested model not found.",
      "MODEL_NOT_FOUND",
      false
    );
  }

  if (status === 429) {
    return new MistralAnalysisError(
      "Mistral rate limit exceeded.",
      "RATE_LIMITED",
      true
    );
  }

  if (status >= 500) {
    return new MistralAnalysisError(
      `Mistral server error: ${error.message}`,
      "SERVER_ERROR",
      true
    );
  }

  return new MistralAnalysisError(
    error.message || "Unknown Mistral error.",
    "UNKNOWN_ERROR",
    false
  );
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export default mistral;

export { MistralAnalysisError as ClaudeAnalysisError };

