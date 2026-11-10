# Blog post outline: Comparing a local LLM and Claude with Langfuse experiments

**Reader**: a developer who has shipped (or is about to ship) an LLM feature and wonders whether
a local or cheaper open model would do. Knows TypeScript, has heard of Langfuse, has not used
experiments.

**Promise**: in 15 minutes of reading, they know how to answer "is model B good enough?" with
numbers instead of vibes, and they can run it themselves from the repo.

**Length**: ~1,800 words, 5 screenshots, 4 short code snippets.

> ⚠ Before publishing: the Gemma numbers so far come from **OpenRouter** (Gemma 3 12B, same open
> weights, run in the cloud). Run the experiment once with **LM Studio** on the laptop and either
> replace the numbers or add a "local vs hosted Gemma" row. Latency and cost are the columns that
> will change; faithfulness should be close.

---

## 1. Hook (100 words)

Open on the ClickHouse 26.10 example, before any explanation:

- Two LinkedIn posts generated from the same release notes. Both pass every rule my code checks:
  length, link, hashtags.
- One opens with "ClickHouse 7 / 2 returns 3.5 by default". The other with "ClickHouse truncates
  integer division by default". The article says the first one.
- "My code said both were fine. This post is about how I found out that one of them was not, and
  what it says about swapping Claude for a local model."

## 2. The setup (200 words)

- The app: blog post URL → summary → LinkedIn post → rule check. Two LLM calls, a few hundred lines of TypeScript.
- Why compare models at all: cost (Gemma is ~4× cheaper per post here), privacy, offline use.
- Why "try it on a few posts and read them" does not work: you read 3 posts, you like 2,
  you decide. Then you change the prompt and have to start over.
- Mermaid diagram from the README.

## 3. Step 1: trace everything first (250 words)

- One trace per run, one observation per step. Snippet: `startActiveObservation(..., { asType:
  "generation" })` + `generation.update({ model, usageDetails, prompt })` (from `src/llm.ts`).
- Langfuse infers cost from the model name for Claude; OpenRouter returns the real cost, which we
  pass as `costDetails`; LM Studio is 0.
- Screenshot: `trace.png`.
- **Gotcha box: double-counted cost.** The Anthropic SDK now emits its own OpenTelemetry span per
  call; Langfuse shows it as a second generation and the trace cost doubles. If you already trace
  calls yourself, create the client with `openTelemetry: false`. Worth knowing for any
  auto-instrumented SDK.

## 4. Step 2: prompts with labels, not in code (200 words)

- v1 "simple" is `production`, v2 "improved" (hook, structure, call to action) is `staging`.
- The app asks for a label; every generation is linked to the exact version.
- The fallback: if Langfuse is unreachable, the SDK returns v1 from the code and the app keeps
  running.
- Screenshot: `prompt-diff.png`.

## 5. Step 3: a dataset that is not just your favorite example (150 words)

- 16 real posts: announcements, deep dives, release notes, personal blogs, short and long (some
  truncated at 12k characters for small-context local models).
- Stable item ids so re-seeding updates instead of duplicating.
- Tip: include your own posts; they are the ones you care about.

## 6. Step 4: experiments, two kinds of evaluators (400 words, the core)

- One experiment run = the real pipeline on every dataset item (not a copy of it).
  Snippet: `langfuse.experiment.run({ data: dataset.items, task, evaluators, runEvaluators })`.
- **Rules in code**: length, link, hashtags. Free, instant, deterministic. They catch format,
  not truth.
- **LLM-as-a-judge** for faithfulness: fixed judge (Claude Haiku 5.5) for every run, JSON schema
  output with `unsupported_claims`, `reasoning` and a score on a 5-step scale. Snippet: the schema
  from `src/experiment/judge.ts`.
  - Why the list of claims matters: a score alone is not debuggable; the comment in Langfuse is.
  - Why a fixed judge: compare runs, not judges.
- Evaluators run outside the item's trace, so the judge's cost stays out of the pipeline's cost.
  The judge gets its own trace.
- Run-level scores: `checks_pass_rate`, `avg_faithfulness`.

## 7. The results (300 words)

Table (replace with final runs):

| Run | Pass every rule | Avg faithfulness | Cost, 16 posts | Time per post |
|---|---|---|---|---|
| Claude Haiku 5.5, prompt v1 | 69% | 0.73 | $0.018 | 8 s |
| Claude Haiku 5.5, prompt v2 | 94% | 0.77 | $0.017 | 7 s |
| Gemma 3 12B, prompt v2 (OpenRouter) | 100% | 0.66 | $0.004 | 24 s |
| Gemma 3 12B, prompt v2 (LM Studio, local) | TODO | TODO | $0 | TODO |

What to say:
- The prompt mattered more than the model for the rules: v1 → v2 is +25 points.
- Gemma follows instructions as well, but adds things the article does not say: lower on 7 posts,
  equal on 7, higher on 2.
- Back to the hook example, with `compare.png` and `judge-comment.png`.
- Decision framing, not a verdict: for a draft a human edits, Gemma at a quarter of the cost may be
  fine; for posts published as-is, the faithfulness gap is the cost.

## 8. The bug the experiment found (200 words)

The best story of the build, give it its own section:
- First run: `has_link` failed on 7 of 16 posts. The traces showed generations stopping at exactly
  1,024 output tokens for ~1,000 characters of text.
- Cause: Claude Haiku 5.5 thinks by default, and thinking tokens count against `max_tokens`. A
  third of summaries and posts were silently cut off. No error anywhere.
- Fix: detect `stop_reason: "max_tokens"` / `finish_reason: "length"`, mark the generation
  `WARNING`, and set `max_tokens` to 8,000 in the prompt config (a ceiling, not a cost).
- Lesson: without the dataset run, I would have blamed the prompt.

## 9. Limits, honestly (150 words)

- One run per configuration: LLM output varies, small gaps are noise. Run each config 2–3 times
  before deciding.
- A Claude judge grading Claude may favor it. Next step: a second judge from another family, and
  check the ranking holds.
- 16 posts is a demo, not a benchmark.

## 10. Try it (100 words)

- Repo link, the 5-minute quickstart (4 commands).
- One command to compare your own model: `npm run experiment -- --model=lmstudio:<model>`.
- Call to action: "Run it on your own posts and tell me which model you kept."

---

## Assets checklist

- [ ] Screenshots listed in `docs/screenshots/README.md`
- [ ] Final experiment runs (2–3 per config) and the updated table
- [ ] LM Studio run on the laptop
- [ ] Short side note: Langfuse v4 turned off some public read endpoints (traces, scores) in
      events-only mode; use `/api/public/v2/observations`, or the UI
