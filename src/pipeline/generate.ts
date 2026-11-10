import { tracedCompletion } from "../llm.js";
import { compile, PROMPTS } from "../prompts.js";
import type { LlmProvider } from "../providers/index.js";

export interface PostOptions {
  url: string;
  tone: string;
  language: string;
  maxChars: number;
}

export async function generatePost(summary: string, provider: LlmProvider, options: PostOptions) {
  const prompt = PROMPTS["linkedin-post"];
  return tracedCompletion({
    name: "generate-post",
    provider,
    system: prompt.system,
    user: compile(prompt.user, {
      summary,
      url: options.url,
      tone: options.tone,
      language: options.language,
      max_chars: options.maxChars,
    }),
    maxTokens: 1024,
  });
}
