// One helper that turns any LLM call into a Langfuse "generation":
// model, input, output, token usage, cost, latency and the prompt version end up in the trace.
import type { ChatPromptClient } from "@langfuse/client";
import { startActiveObservation } from "@langfuse/tracing";
import { compilePrompt } from "./prompts.js";
import type { LlmProvider } from "./providers/index.js";

interface TracedCallOptions {
  name: string;
  provider: LlmProvider;
  prompt: ChatPromptClient;
  variables: Record<string, string | number>;
}

export async function tracedCompletion({ name, provider, prompt, variables }: TracedCallOptions) {
  return startActiveObservation(
    name,
    async (generation) => {
      const { system, user, maxTokens } = compilePrompt(prompt, variables);

      generation.update({
        model: provider.model,
        modelParameters: { provider: provider.provider, max_tokens: maxTokens },
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        // Links this generation to the prompt version in Langfuse (Prompts → Metrics).
        prompt: { name: prompt.name, version: prompt.version, isFallback: prompt.isFallback },
      });

      const result = await provider.complete({ system, user, maxTokens });

      generation.update({
        output: result.text,
        usageDetails: { input: result.usage.input, output: result.usage.output },
        // When we know the real cost we send it; otherwise Langfuse infers it.
        ...(result.costUsd !== undefined && { costDetails: { total: result.costUsd } }),
      });

      return result.text;
    },
    { asType: "generation" },
  );
}
