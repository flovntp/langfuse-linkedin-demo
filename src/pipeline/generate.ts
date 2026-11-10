import { tracedCompletion } from "../llm.js";
import { getPrompt, type PromptLabel } from "../prompts.js";
import type { LlmProvider } from "../providers/index.js";

export interface PostOptions {
  url: string;
  tone: string;
  language: string;
  maxChars: number;
  promptLabel: PromptLabel;
}

export async function generatePost(summary: string, provider: LlmProvider, options: PostOptions) {
  return tracedCompletion({
    name: "generate-post",
    provider,
    prompt: await getPrompt("linkedin-post", options.promptLabel),
    variables: {
      summary,
      url: options.url,
      tone: options.tone,
      language: options.language,
      max_chars: options.maxChars,
    },
  });
}
