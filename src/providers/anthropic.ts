import Anthropic from "@anthropic-ai/sdk";
import type { CompletionRequest, CompletionResult, LlmProvider } from "./types.js";

export function anthropicProvider(model: string): LlmProvider {
  // Reads ANTHROPIC_API_KEY. The SDK emits its own OpenTelemetry span per call, which Langfuse
  // would show as a second generation (and count the cost twice): we already trace the call
  // ourselves, with the prompt version attached, so we turn the SDK's spans off.
  const client = new Anthropic({ openTelemetry: false });

  return {
    provider: "anthropic",
    model,
    async complete({ system, user, maxTokens }: CompletionRequest): Promise<CompletionResult> {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
        // Writing tasks: little thinking needed, keep it fast and cheap.
        output_config: { effort: "low" },
      });

      if (response.stop_reason === "refusal") {
        throw new Error(`Claude declined the request (${response.stop_details?.category ?? "no category"})`);
      }

      const text = response.content
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("")
        .trim();

      return {
        text,
        usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      };
    },
  };
}
