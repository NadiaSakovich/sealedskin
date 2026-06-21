import type {
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  GroundingInfo,
  GroundingSource,
  LLMProvider,
} from "../types";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiProviderConfig {
  apiKey: string;
  /** Defaults to "gemini-2.5-flash". */
  model?: string;
}

/**
 * Thin REST wrapper over Google's Generative Language API. No SDK dependency,
 * so the provider abstraction stays the single source of truth and adding other
 * vendors follows the same shape.
 */
export class GeminiProvider implements LLMProvider {
  readonly id = "gemini";
  readonly model: string;
  private readonly apiKey: string;

  constructor(config: GeminiProviderConfig) {
    if (!config.apiKey) {
      throw new Error("GeminiProvider: apiKey is required");
    }
    this.apiKey = config.apiKey;
    this.model = config.model ?? "gemini-3.1-flash-lite";
  }

  async generate(
    messages: ChatMessage[],
    opts: GenerateOptions = {},
  ): Promise<GenerateResult> {
    // Gemini takes the system prompt separately and only knows user/model turns.
    const systemInstruction = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const contents: GeminiContent[] = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        ...(opts.maxOutputTokens
          ? { maxOutputTokens: opts.maxOutputTokens }
          : {}),
        ...(opts.responseSchema
          ? {
              responseMimeType: "application/json",
              responseSchema: opts.responseSchema,
            }
          : {}),
        ...(opts.thinkingBudget !== undefined
          ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } }
          : {}),
      },
    };
    // Grounding with Google Search: with this tool present the model decides on
    // its own whether to search the web before answering ("when needed").
    if (opts.grounding) {
      body.tools = [{ google_search: {} }];
    }
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await fetch(
      `${GEMINI_BASE}/models/${this.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Gemini request failed (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as {
      candidates?: {
        content?: { parts?: GeminiPart[] };
        groundingMetadata?: GeminiGroundingMetadata;
      }[];
    };
    const candidate = data.candidates?.[0];
    const text =
      candidate?.content?.parts?.map((p) => p.text).join("") ?? "";

    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    return { text, grounding: parseGrounding(candidate?.groundingMetadata) };
  }
}

interface GeminiGroundingMetadata {
  webSearchQueries?: string[];
  searchEntryPoint?: { renderedContent?: string };
  groundingChunks?: { web?: { uri?: string; title?: string } }[];
}

/** Normalize Gemini's groundingMetadata into our provider-agnostic shape. */
function parseGrounding(
  meta: GeminiGroundingMetadata | undefined,
): GroundingInfo | undefined {
  if (!meta) return undefined;
  const sources: GroundingSource[] = (meta.groundingChunks ?? [])
    .map((c) => ({ title: c.web?.title ?? "", uri: c.web?.uri ?? "" }))
    .filter((s) => s.uri);
  const searchSuggestionHtml = meta.searchEntryPoint?.renderedContent ?? "";
  const queries = meta.webSearchQueries ?? [];
  if (!sources.length && !searchSuggestionHtml && !queries.length) {
    return undefined;
  }
  return { sources, searchSuggestionHtml, queries };
}
