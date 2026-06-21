/**
 * Provider-agnostic LLM interface.
 *
 * Every model backend (Gemini today; OpenAI/Anthropic later) implements
 * {@link LLMProvider}. The rest of the app only ever talks to this interface,
 * so swapping the underlying model is a config change, not a code change.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GenerateOptions {
  /** Sampling temperature. Lower = more deterministic. Defaults per provider. */
  temperature?: number;
  /** Hard cap on output tokens. */
  maxOutputTokens?: number;
  /**
   * When set, the provider is asked to return JSON conforming to this schema
   * (OpenAPI-3 subset, as understood by Gemini/OpenAI structured output).
   * The returned string is then a JSON document.
   */
  responseSchema?: Record<string, unknown>;
  /**
   * When true, enable Grounding with Google Search — the model may run live web
   * searches "when needed" before answering. On Gemini 3.x this combines with
   * {@link GenerateOptions.responseSchema}; on 2.5 it does not.
   */
  grounding?: boolean;
  /**
   * Thinking-token budget for reasoning models. 0 disables "thinking" (much
   * faster — good for mechanical tasks like structuring). Omit to let the model
   * decide. Ignored by providers/models without a thinking mode.
   */
  thinkingBudget?: number;
}

/** One web source the model used while grounding. */
export interface GroundingSource {
  title: string;
  uri: string;
}

/**
 * Grounding metadata returned alongside a grounded answer. `searchSuggestionHtml`
 * is Google's ready-made "Search Suggestions" chip — its display is required by
 * the Grounding terms of service whenever a grounded answer is shown.
 */
export interface GroundingInfo {
  sources: GroundingSource[];
  searchSuggestionHtml: string;
  queries: string[];
}

/** Result of a generation: the text plus any grounding metadata. */
export interface GenerateResult {
  text: string;
  grounding?: GroundingInfo;
}

export interface LLMProvider {
  /** Stable provider identifier, e.g. "gemini". */
  readonly id: string;
  /** Model name in use, e.g. "gemini-2.5-flash". */
  readonly model: string;
  /**
   * Generate a completion. The returned {@link GenerateResult.text} is the
   * model's text output, or a JSON string when
   * {@link GenerateOptions.responseSchema} is provided.
   */
  generate(messages: ChatMessage[], opts?: GenerateOptions): Promise<GenerateResult>;
}
