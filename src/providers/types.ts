export interface CompletionRequest {
  system: string;
  user: string;
  maxTokens: number;
}

export interface CompletionResult {
  text: string;
  usage: { input: number; output: number };
  // True when the model hit maxTokens and the text is cut off. With reasoning models the
  // thinking tokens count against maxTokens too, so this can happen on short outputs.
  truncated: boolean;
  // Only set when the provider tells us what the call cost (OpenRouter) or when
  // we know it is free (local model). Otherwise Langfuse computes the cost from
  // the model name and its price table.
  costUsd?: number;
}

export interface LlmProvider {
  provider: string; // "anthropic" | "lmstudio" | "openrouter"
  model: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}
