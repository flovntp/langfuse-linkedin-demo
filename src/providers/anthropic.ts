import Anthropic from "@anthropic-ai/sdk";
import type { CompletionRequest, CompletionResult, LlmProvider } from "./types.js";

export function anthropicProvider(model: string): LlmProvider {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

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
