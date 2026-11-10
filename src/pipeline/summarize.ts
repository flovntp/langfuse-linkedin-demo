import { tracedCompletion } from "../llm.js";
import { getPrompt, type PromptLabel } from "../prompts.js";
import type { LlmProvider } from "../providers/index.js";
import type { Article } from "./fetch.js";

export async function summarize(article: Article, provider: LlmProvider, language: string, label: PromptLabel) {
  return tracedCompletion({
    name: "summarize",
    provider,
    prompt: await getPrompt("summarize", label),
    variables: { title: article.title, article: article.text, language },
  });
}
