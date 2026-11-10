import { anthropicProvider } from "./anthropic.js";
import { openAICompatibleProvider } from "./openai-compatible.js";
import type { LlmProvider } from "./types.js";

export type { LlmProvider } from "./types.js";

/**
 * Builds a provider from a "<provider>:<model>" string, e.g.
 *   anthropic:claude-haiku-5-5
 *   lmstudio:gemma-3-12b-it-qat
 *   openrouter:anthropic/claude-haiku-5.5
 */
export function getProvider(spec = process.env.DEFAULT_MODEL ?? "anthropic:claude-haiku-5-5"): LlmProvider {
  const [provider, ...rest] = spec.split(":");
  const model = rest.join(":");
  if (!model) throw new Error(`Invalid model "${spec}", expected <provider>:<model>`);

  switch (provider) {
    case "anthropic":
      requireEnv("ANTHROPIC_API_KEY");
      return anthropicProvider(model);
    case "lmstudio":
      return openAICompatibleProvider({
        provider,
        model,
        baseURL: process.env.LMSTUDIO_BASE_URL ?? "http://localhost:1234/v1",
        apiKey: "lm-studio", // LM Studio ignores it, the SDK requires one
      });
    case "openrouter":
      return openAICompatibleProvider({
        provider,
        model,
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: requireEnv("OPENROUTER_API_KEY"),
      });
    default:
      throw new Error(`Unknown provider "${provider}" (use anthropic, lmstudio or openrouter)`);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is empty: add it to .env (see .env.example)`);
  return value;
}
