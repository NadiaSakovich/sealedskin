import type { LLMProvider } from "./types";
import { GeminiProvider } from "./providers/gemini";

export type { ChatMessage, GenerateOptions, LLMProvider } from "./types";

export type ProviderId = "gemini";

/**
 * Build the active LLM provider from environment configuration.
 *
 *   AI_PROVIDER   which backend to use (default: "gemini")
 *   AI_MODEL      model name for that backend (optional; provider has a default)
 *   GEMINI_API_KEY  required when AI_PROVIDER=gemini
 *
 * `modelOverride` (when set and trusted by the caller) takes precedence over
 * `AI_MODEL` — used by the API route to honor the UI's model picker.
 *
 * To add a new provider, implement {@link LLMProvider} and add a case here.
 */
export function createProvider(modelOverride?: string): LLMProvider {
  const providerId = (process.env.AI_PROVIDER ?? "gemini") as ProviderId;
  const model = modelOverride ?? process.env.AI_MODEL;

  switch (providerId) {
    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY is not set. Copy .env.example to .env.local and add your key.",
        );
      }
      return new GeminiProvider({ apiKey, model });
    }
    default:
      throw new Error(`Unknown AI_PROVIDER: "${providerId}"`);
  }
}
