// LM Studio and OpenRouter both speak the OpenAI Chat Completions API,
// so one small client covers both: only the base URL and the key change.
import OpenAI from "openai";
import type { CompletionRequest, CompletionResult, LlmProvider } from "./types.js";

interface Options {
  provider: "lmstudio" | "openrouter";
  model: string;
  baseURL: string;
  apiKey: string;
}

export function openAICompatibleProvider({ provider, model, baseURL, apiKey }: Options): LlmProvider {
  const client = new OpenAI({ baseURL, apiKey });

  return {
    provider,
    model,
    async complete({ system, user, maxTokens }: CompletionRequest): Promise<CompletionResult> {
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      // OpenRouter adds the real price of the call to the usage block.
      const usage = response.usage as (OpenAI.CompletionUsage & { cost?: number }) | undefined;

      return {
        text: stripThinking(response.choices[0]?.message.content ?? ""),
        usage: { input: usage?.prompt_tokens ?? 0, output: usage?.completion_tokens ?? 0 },
        truncated: response.choices[0]?.finish_reason === "length",
        costUsd: provider === "lmstudio" ? 0 : usage?.cost,
      };
    },
  };
}

// Some local reasoning models (Qwen3, DeepSeek R1…) put their reasoning in <think> tags.
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
