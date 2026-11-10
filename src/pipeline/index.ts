import { getActiveTraceId, startActiveObservation } from "@langfuse/tracing";
import type { LlmProvider } from "../providers/index.js";
import { tracedCheckPost } from "./check.js";
import { fetchArticle } from "./fetch.js";
import { generatePost, type PostOptions } from "./generate.js";
import { summarize } from "./summarize.js";

export type PipelineOptions = Omit<PostOptions, "url">;

/** Blog post URL → summary → LinkedIn post → rule check, as one trace. */
export async function blogToLinkedIn(url: string, provider: LlmProvider, options: PipelineOptions) {
  return startActiveObservation("blog-to-linkedin", async (root) => {
    root.update({ input: { url, ...options, model: `${provider.provider}:${provider.model}` } });

    const article = await fetchArticle(url);
    const summary = await summarize(article, provider, options.language);
    const post = await generatePost(summary, provider, { ...options, url });
    const check = await tracedCheckPost(post, url, options.maxChars);

    root.update({ output: { post, check } });
    return { traceId: getActiveTraceId()!, article, summary, post, check };
  }, { asType: "chain" });
}
