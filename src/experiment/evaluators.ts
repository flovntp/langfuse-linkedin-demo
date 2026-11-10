// Scores attached to every experiment item, then to the whole run.
import type { Evaluator, RunEvaluator } from "@langfuse/client";
import { checkPost } from "../pipeline/check.js";
import { judgeFaithfulness } from "./judge.js";

export interface PostInput { url: string }
/** The task's output is the post itself; the article text it was written from is kept here. */
export type ArticleTexts = Map<string, string>; // url → text the model saw
export type ItemMetadata = { kind?: string; source?: string } & Record<string, unknown>;

/** Deterministic checks: plain code, free, instant. Same rules as the guardrail in the pipeline. */
export function ruleEvaluator(maxChars: number): Evaluator<PostInput, unknown, ItemMetadata> {
  return async ({ input, output }) => {
    const post = output as string;
    const check = checkPost(post, input.url, maxChars);
    return [
      { name: "length_ok", value: check.rules.lengthOk ? 1 : 0, dataType: "BOOLEAN", comment: `${check.length} / ${maxChars} chars` },
      { name: "has_link", value: check.rules.hasLink ? 1 : 0, dataType: "BOOLEAN" },
      { name: "hashtags_ok", value: check.rules.hashtagsOk ? 1 : 0, dataType: "BOOLEAN", comment: `${check.hashtags} hashtags` },
      { name: "post_length", value: check.length, dataType: "NUMERIC" },
    ];
  };
}

/** LLM-as-a-judge: faithfulness to the source, 0–1, with the judge's reasoning as comment. */
export function faithfulnessEvaluator(runName: string, articles: ArticleTexts): Evaluator<PostInput, unknown, ItemMetadata> {
  return async ({ input, output, metadata }) => {
    const article = articles.get(input.url);
    if (!article) throw new Error(`No article text for ${input.url}`);
    const verdict = await judgeFaithfulness({
      article,
      post: output as string,
      posterIsAuthor: metadata?.source === "mine",
      context: { runName, url: input.url },
    });
    const claims = verdict.unsupported_claims.length
      ? `\nUnsupported: ${verdict.unsupported_claims.map((c) => `"${c}"`).join("; ")}`
      : "";
    return { name: "faithfulness", value: verdict.score, dataType: "NUMERIC", comment: verdict.reasoning + claims };
  };
}

/** Run-level scores: one number per run, easy to compare across runs. */
export const runSummary: RunEvaluator = async ({ itemResults }) => {
  const scoresOf = (name: string) =>
    itemResults.flatMap((r) => r.evaluations.filter((e) => e.name === name).map((e) => Number(e.value)));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const allChecksPass = itemResults.map((r) =>
    ["length_ok", "has_link", "hashtags_ok"].every((n) => r.evaluations.some((e) => e.name === n && e.value === 1)) ? 1 : 0,
  );
  return [
    { name: "avg_faithfulness", value: avg(scoresOf("faithfulness")), dataType: "NUMERIC" },
    { name: "checks_pass_rate", value: avg(allChecksPass), dataType: "NUMERIC", comment: `${allChecksPass.filter(Boolean).length}/${itemResults.length} posts pass every rule` },
  ];
};
