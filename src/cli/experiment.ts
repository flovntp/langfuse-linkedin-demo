// npm run experiment -- [--model=anthropic:claude-haiku-5-5] [--label=production] [--judge=provider:model ...] [--limit=N] [--concurrency=4]
// Runs the whole pipeline on every item of the dataset, scores each post, and records it all
// as one experiment run in Langfuse. Run it twice with a different --model or --label, then
// compare the two runs side by side in Datasets → blog-posts.
// --judge can be repeated: every judge scores the same posts, to check the ranking does not
// depend on the judge (e.g. a Claude judge favoring Claude).
import { shutdownTracing } from "../instrumentation.js"; // must stay the first import
import { parseArgs } from "node:util";
import { LangfuseClient } from "@langfuse/client";
import { propagateAttributes } from "@langfuse/tracing";
import { faithfulnessEvaluator, faithfulnessScoreName, ruleEvaluator, runSummary, type ArticleTexts, type PostInput } from "../experiment/evaluators.js";
import { DEFAULT_JUDGE, loadJudge } from "../experiment/judge.js";
import { blogToLinkedIn } from "../pipeline/index.js";
import { getProvider } from "../providers/index.js";
import { DATASET_NAME } from "../setup/dataset-items.js";

const { values } = parseArgs({
  options: {
    model: { type: "string" },
    label: { type: "string", default: "production" },
    tone: { type: "string", default: "friendly and practical, no hype" },
    lang: { type: "string", default: "English" },
    "max-chars": { type: "string", default: "1300" },
    limit: { type: "string" }, // only the first N items, for a quick try
    concurrency: { type: "string", default: "4" },
    judge: { type: "string", multiple: true, default: [DEFAULT_JUDGE] },
  },
});

const langfuse = new LangfuseClient();

try {
  const provider = getProvider(values.model);
  const modelSpec = `${provider.provider}:${provider.model}`;
  const promptLabel = values.label!;
  const maxChars = Number(values["max-chars"]);
  const judges = values.judge!.map(loadJudge);
  const judgeNames = judges.map((j) => j.spec).join(", ");
  const scoreNames = judges.map(faithfulnessScoreName);
  const runName = `${modelSpec} · prompt ${promptLabel} · ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

  const dataset = await langfuse.dataset.get(DATASET_NAME);
  const items = values.limit ? dataset.items.slice(0, Number(values.limit)) : dataset.items;
  console.log(`Experiment "${runName}" on ${items.length} posts (judge: ${judgeNames})\n`);

  const articles: ArticleTexts = new Map();

  // Dataset items keep their dataset id, so the run shows up under Datasets → blog-posts → Experiments.
  const result = await langfuse.experiment.run({
    name: "blog-to-linkedin",
    runName,
    description: `Model ${modelSpec}, prompts labeled "${promptLabel}", judged by ${judgeNames}`,
    metadata: { model: modelSpec, promptLabel, judges: judgeNames, tone: values.tone, language: values.lang, maxChars },
    data: items,
    maxConcurrency: Number(values.concurrency),

    // The task is the exact same pipeline as `npm run run`.
    task: async (item) => {
      const { url } = item.input as PostInput;
      const run = await propagateAttributes(
        { tags: ["experiment", provider.provider, `prompt:${promptLabel}`], metadata: { model: provider.model, promptLabel } },
        () => blogToLinkedIn(url, provider, { tone: values.tone!, language: values.lang!, maxChars, promptLabel }),
      );
      articles.set(url, run.article.text);
      process.stdout.write(run.check.passed ? "." : "!");
      return run.post;
    },

    evaluators: [
      ruleEvaluator(maxChars),
      ...judges.map((judge, i) => faithfulnessEvaluator(runName, articles, judge, scoreNames[i])),
    ],
    runEvaluators: [runSummary(scoreNames)],
  });

  console.log("\n");
  for (const r of result.itemResults) {
    const score = (name: string) => r.evaluations.find((e) => e.name === name)?.value;
    const rules = ["length_ok", "has_link", "hashtags_ok"].map((n) => (score(n) === 1 ? "✓" : "✗")).join("");
    const faithfulness = scoreNames.map((n) => String(score(n) ?? "-").padEnd(4)).join(" ");
    console.log(`  ${rules}  faithfulness ${faithfulness}  ${(r.item.input as PostInput).url}`);
  }
  const failed = items.length - result.itemResults.length;
  console.log(`\n${result.runEvaluations.map((e) => `${e.name}: ${Number(e.value).toFixed(2)}`).join("   ")}`);
  if (failed) console.log(`${failed} item(s) failed and were skipped (see the errors above).`);
  console.log(`\nRun: ${result.experimentUrl ?? result.runName}`);
} catch (error) {
  console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await langfuse.flush();
  await shutdownTracing();
}
