// One helper that turns any LLM call into a Langfuse "generation":
// model, input, output, token usage, cost and latency end up in the trace.
import { startActiveObservation } from "@langfuse/tracing";
import type { LlmProvider } from "./providers/index.js";

interface TracedCallOptions {
  name: string;
  provider: LlmProvider;
  system: string;
  user: string;
  maxTokens: number;
}

export async function tracedCompletion({ name, provider, system, user, maxTokens }: TracedCallOptions) {
  return startActiveObservation(
    name,
    async (generation) => {
      generation.update({
        model: provider.model,
        modelParameters: { provider: provider.provider, max_tokens: maxTokens },
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
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
