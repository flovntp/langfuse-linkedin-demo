import { tracedCompletion } from "../llm.js";
import { compile, PROMPTS } from "../prompts.js";
import type { LlmProvider } from "../providers/index.js";
import type { Article } from "./fetch.js";

export async function summarize(article: Article, provider: LlmProvider, language: string) {
  const prompt = PROMPTS.summarize;
  return tracedCompletion({
    name: "summarize",
    provider,
    system: prompt.system,
    user: compile(prompt.user, { title: article.title, article: article.text, language }),
    maxTokens: 1024,
  });
}
