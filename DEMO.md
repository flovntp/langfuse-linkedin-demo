# Live demo runbook (10 minutes)

The story: *"I built a small LLM feature. Langfuse tells me what it does, which prompt it used,
whether the new prompt is better, whether a cheaper model is good enough, and what users think."*

Rule of thumb: **run live only what is fast and safe** (one post, one label flip, one vote).
Experiments are **shown from recorded runs**: they take minutes and LLM output changes between runs.

## The day before

- [ ] `npm run langfuse:up`, log in to http://localhost:3000 (credentials in `.env`).
- [ ] `npm run setup`: prompts v1/v2, dataset, and every article cached for offline use (16/16).
- [ ] Record the runs you will show, and note their names:
  ```bash
  npm run experiment -- --label=production
  npm run experiment -- --label=staging
  npm run experiment -- --model=openrouter:google/gemma-3-12b-it --label=staging
  ```
  Delete failed or test runs in the UI so the Runs list stays readable.
- [ ] In the Compare view, check that the ClickHouse 26.10 row still makes the point (see step 4).
  If Gemma did not make a mistake there this time, pick the row with the largest faithfulness gap.
- [ ] Offline rehearsal: wifi off, LM Studio on, then
  `npm run run -- https://clickhouse.com/blog/clickhouse-release-26-10 --model=lmstudio:gemma-3-12b-it-qat`.
  Tested with LM Studio Bionic (port 1235, Gemma 3 12B QAT 4-bit, 16k context): about 2 minutes
  per post on an M2 with 24 GB. Too slow to wait for on stage: start it, talk, come back.
- [ ] Browser tabs, in order: Traces, Prompts → `linkedin-post`, Datasets → `blog-posts` → Runs,
  the Compare view. Zoom the browser to 125–150% for the projector.
- [ ] Terminal: large font, in the repo folder, history cleared (`clear`).

## 30 minutes before

- [ ] `docker ps` shows the `langfuse-demo-*` containers running; the UI loads.
- [ ] `npm run setup` again: it resets the `production` label to v1 if you moved it while rehearsing.
- [ ] One warm-up run, so nothing is cold: `npm run run -- <any dataset url>`.

## Runbook

### 0:00 – The problem (1 min, no screen)

An LLM feature that "works on my machine" leaves questions open: what did it cost, which prompt
produced this, is the new prompt better, can I use a cheaper model, do users like it?
Five steps, one per question.

### 1:00 – Tracing (2 min, live)

```bash
npm run run -- https://clickhouse.com/blog/clickhouse-release-26-10
```

Click the trace link it prints. Show:
- The tree: `blog-to-linkedin` → `fetch-article` (tool) → `summarize` → `generate-post`
  (generations) → `check-post` (guardrail).
- Click `summarize`: input, output, tokens, **cost** (computed by Langfuse from the model name),
  latency.
- Session and user on the trace: all runs of the day are in session `demo-YYYY-MM-DD`.

Line to say: *"A few lines of setup, and every step of my pipeline is visible."*

### 3:00 – Prompt management (2 min, live)

Prompts → `linkedin-post`. Show v1 (`production`) and v2 (`staging`), click **diff**: v2 adds a
hook, a structure and a call to action.

Then, live: move the **production** label to v2 in the UI, and run the same command again,
**without changing any code**:

```bash
npm run run -- https://clickhouse.com/blog/clickhouse-release-26-10
```

The post now opens with a hook and ends with a question. Open `generate-post` in the new trace:
it is linked to `linkedin-post` v2.

Line to say: *"The prompt is deployed by a label, not by a release."*

### 5:00 – Dataset (30 s, UI only)

Datasets → `blog-posts`: 16 real technical posts (Langfuse, ClickHouse, GitHub, Julia Evans,
Simon Willison, and mine). Announcements, deep dives, release notes, short and long.

### 5:30 – Experiments (3 min, recorded runs)

Datasets → `blog-posts` → Runs. Show the run-level scores of the three runs:

| Run | Pass every rule | Avg faithfulness |
|---|---|---|
| Claude, prompt v1 | 69% | 0.73 |
| Claude, prompt v2 | 94% | 0.77 |
| Gemma 3 12B, prompt v2 | 100% | 0.66 |

(Numbers from the rehearsal runs on 2026-11-10: replace them with yours.)

1. **Prompt v1 vs v2** (same model): v2 passes the rules far more often, and is not less faithful.
2. **Claude vs Gemma** (same prompt): select both `staging` runs → **Compare**. Go to the
   **ClickHouse 26.10** row:
   - Claude's hook: *"Did you know ClickHouse 7 / 2 returns 3.5 by default?"* (correct).
   - Gemma's hook: *"…ClickHouse truncates integer division towards zero by default"* (the
     opposite of the article).
   - The rule columns are green on both sides. Click Gemma's `faithfulness` score (0.5): the judge
     quotes the article, *"7 / 2 gives 3.5"*.

Lines to say: *"My code says both posts are fine. Only the judge sees that one of them is wrong."*
and *"Gemma is 4 times cheaper. Langfuse tells me what I give up for it."*

Be ready for: *"Isn't a Claude judge biased toward Claude?"* Yes, it can be: say so, the judge is
fixed for every run so the comparison is consistent, and a second judge is the next step.

### 8:30 – Feedback (1 min, live)

```bash
npm run feedback -- down "Hook is too generic"
```

Open the trace: the `user-feedback` score is on it, with the comment. In a real app this is the
👍 / 👎 under the post; here it is one command. Voting again updates the vote.

### 9:30 – Wrap up (30 s)

Five questions, five Langfuse features: traces, prompts, datasets, experiments with evaluators,
scores from users. Everything here is open source and self-hosted on this laptop.
Repo link on the last slide.

## What can go wrong

| Problem | What to do |
|---|---|
| **No wifi** | Langfuse is local already. Articles come from `.cache/` (the `fetch-article` span shows `fromCache: true`). Switch the model to LM Studio: `--model=lmstudio:gemma-3-12b-it-qat` (about 2 min per post: start it, keep talking). Experiments are recorded, nothing to run. |
| **Anthropic API down or slow** | Same as no wifi: LM Studio for live runs. The recorded experiment runs do not need the API. |
| **Langfuse UI does not load** | `npm run langfuse:up` again; first start takes about a minute. Still down: the CLI keeps working (prompts fall back to v1 from the code, the trace is not sent), and switch to screenshots in `docs/screenshots/`. |
| **The live post is bad or breaks a rule** | Good, it is a demo of observability: open the trace and show which step went wrong and why (`check-post` is a `WARNING`). |
| **A generation is marked `WARNING` "cut off at max_tokens"** | That is the truncation check. Raise `max_tokens` in the prompt config in the UI: it creates a new version, move the label to it and run again. |
| **`403 Key limit exceeded` from OpenRouter** | The key has a spending limit: raise it on openrouter.ai/settings/keys, or use the recorded run. |
| **You moved the `production` label and forgot** | `npm run setup` puts it back on v1. |
| **Running an experiment live gives different numbers** | Expected: LLM output varies. That is why you show recorded runs. |
| **LM Studio answers with an error about context length** | Reload the model with a context length of 16k tokens. |
| **The local model is very slow (under ~5 tokens/s)** | Check the loaded context in *Loaded instances*: on-demand loading can pick 80k+ tokens, which fills the RAM. Reload at 16384. Stop Docker containers and apps you don't need: on a 24 GB Mac the model, Langfuse (~5 GB in Docker) and the browser compete for memory. |
