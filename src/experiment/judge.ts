// LLM-as-a-judge: is the LinkedIn post faithful to the article it is about?
// The judge is fixed for a run, whatever model wrote the post, so runs stay comparable.
// Default: Claude Haiku 5.5. Any "<provider>:<model>" works, to check that a Claude judge
// does not simply favor Claude (see --judge in cli/experiment.ts).
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";
import { getProvider, type LlmProvider } from "../providers/index.js";

export const DEFAULT_JUDGE = "anthropic:claude-haiku-5-5";

const SYSTEM = `You check LinkedIn posts written about technical blog posts.
Your only job is faithfulness: does every claim in the post match the article?
You do not judge style, tone or length.`;

const INSTRUCTIONS = `Compare the LinkedIn post with the article it is about.

List every claim in the post that the article does not support: invented facts, wrong numbers,
names or versions, overstated results, or the post speaking as the article's author or company
(e.g. "we released") when the poster did not write the article. {{authorship}}
Include minor overstatements and extrapolations too: any score below 1 must come with at least
one entry in unsupported_claims.

Then give a score:
1    every claim is supported by the article
0.75 one minor inaccuracy or overstatement
0.5  several inaccuracies, or one that changes the meaning
0.25 mostly unsupported
0    the post misrepresents the article

<article>
{{article}}
</article>

<post>
{{post}}
</post>`;

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    unsupported_claims: { type: "array", items: { type: "string" } },
    reasoning: { type: "string", description: "Two or three sentences explaining the score." },
    score: { type: "number", enum: [0, 0.25, 0.5, 0.75, 1] },
  },
  required: ["unsupported_claims", "reasoning", "score"],
  additionalProperties: false,
} as const;
const VERDICT = jsonSchemaOutputFormat(VERDICT_SCHEMA);
const SCORES = [0, 0.25, 0.5, 0.75, 1];

export interface Verdict {
  unsupported_claims: string[];
  reasoning: string;
  score: number;
}

const client = new Anthropic({ openTelemetry: false }); // see providers/anthropic.ts

export interface JudgeInput {
  judge: LlmProvider;
  article: string;
  post: string;
  posterIsAuthor: boolean;
  context: Record<string, string>; // copied to the judge trace metadata, to find it again
}

export async function judgeFaithfulness({ judge, article, post, posterIsAuthor, context }: JudgeInput): Promise<Verdict> {
  const user = INSTRUCTIONS.replace(
    "{{authorship}}",
    posterIsAuthor ? "Here the poster IS the author, so first person is fine." : "Here the poster is NOT the author.",
  )
    .replace("{{article}}", article)
    .replace("{{post}}", post);

  // The judge gets its own trace: its cost is not mixed with the cost of the pipeline it grades.
  return propagateAttributes({ traceName: "faithfulness-judge", tags: ["judge", judge.provider], metadata: context }, () =>
    startActiveObservation(
      "faithfulness-judge",
      async (generation) => {
        generation.update({
          model: judge.model,
          modelParameters: { provider: judge.provider },
          input: [
            { role: "system", content: SYSTEM },
            { role: "user", content: user },
          ],
        });

        const { verdict, usage, costUsd } =
          judge.provider === "anthropic" ? await claudeVerdict(judge.model, user) : await jsonVerdict(judge, user);

        generation.update({
          output: verdict,
          usageDetails: usage,
          ...(costUsd !== undefined && { costDetails: { total: costUsd } }),
        });
        return verdict;
      },
      { asType: "generation" },
    ),
  );
}

/** Claude: structured outputs, the answer is guaranteed to match the schema. */
async function claudeVerdict(model: string, user: string) {
  const response = await client.messages.parse({
    model,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
    output_config: { format: VERDICT, effort: "medium" },
  });
  if (!response.parsed_output) throw new Error(`Judge returned no verdict (stop: ${response.stop_reason})`);
  return {
    verdict: response.parsed_output as Verdict,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    costUsd: undefined, // Langfuse knows Claude's prices
  };
}

/** Other models (OpenRouter, LM Studio): ask for JSON in the prompt, then check it in code. */
async function jsonVerdict(judge: LlmProvider, user: string) {
  const result = await judge.complete({
    system: SYSTEM,
    user: `${user}\n\nAnswer with only a JSON object matching this schema, no other text:\n${JSON.stringify(VERDICT_SCHEMA)}`,
    maxTokens: 8000,
  });
  const json = result.text.match(/\{[\s\S]*\}/)?.[0];
  const verdict = json ? (JSON.parse(json) as Verdict) : undefined;
  if (!verdict || !Array.isArray(verdict.unsupported_claims) || !SCORES.includes(verdict.score)) {
    throw new Error(`Judge ${judge.model} returned no valid verdict: ${result.text.slice(0, 200)}`);
  }
  return { verdict, usage: result.usage, costUsd: result.costUsd };
}

/** "openrouter:google/gemma-3-12b-it" → a provider plus a short name for score names. */
export function loadJudge(spec: string) {
  const provider = getProvider(spec);
  return { spec, provider, shortName: provider.model.split("/").pop()! };
}
