// LLM-as-a-judge: is the LinkedIn post faithful to the article it is about?
// Always the same judge model, whatever model wrote the post, so runs stay comparable.
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";

export const JUDGE_MODEL = "claude-haiku-5-5";

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

const VERDICT = jsonSchemaOutputFormat({
  type: "object",
  properties: {
    unsupported_claims: { type: "array", items: { type: "string" } },
    reasoning: { type: "string", description: "Two or three sentences explaining the score." },
    score: { type: "number", enum: [0, 0.25, 0.5, 0.75, 1] },
  },
  required: ["unsupported_claims", "reasoning", "score"],
  additionalProperties: false,
});

const client = new Anthropic({ openTelemetry: false }); // see providers/anthropic.ts

export interface JudgeInput {
  article: string;
  post: string;
  posterIsAuthor: boolean;
  context: Record<string, string>; // copied to the judge trace metadata, to find it again
}

export async function judgeFaithfulness({ article, post, posterIsAuthor, context }: JudgeInput) {
  const user = INSTRUCTIONS.replace(
    "{{authorship}}",
    posterIsAuthor ? "Here the poster IS the author, so first person is fine." : "Here the poster is NOT the author.",
  )
    .replace("{{article}}", article)
    .replace("{{post}}", post);

  // The judge gets its own trace: its cost is not mixed with the cost of the pipeline it grades.
  return propagateAttributes({ traceName: "faithfulness-judge", tags: ["judge"], metadata: context }, () =>
    startActiveObservation(
      "faithfulness-judge",
      async (generation) => {
        generation.update({
          model: JUDGE_MODEL,
          input: [
            { role: "system", content: SYSTEM },
            { role: "user", content: user },
          ],
        });

        const response = await client.messages.parse({
          model: JUDGE_MODEL,
          max_tokens: 8000,
          system: SYSTEM,
          messages: [{ role: "user", content: user }],
          output_config: { format: VERDICT, effort: "medium" },
        });
        if (!response.parsed_output) throw new Error(`Judge returned no verdict (stop: ${response.stop_reason})`);

        generation.update({
          output: response.parsed_output,
          usageDetails: { input: response.usage.input_tokens, output: response.usage.output_tokens },
        });
        return response.parsed_output;
      },
      { asType: "generation" },
    ),
  );
}
