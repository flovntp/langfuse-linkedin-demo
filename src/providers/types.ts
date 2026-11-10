export interface CompletionRequest {
  system: string;
  user: string;
  maxTokens: number;
}

export interface CompletionResult {
  text: string;
  usage: { input: number; output: number };
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
