// npm run run -- <url> [--model=anthropic:claude-haiku-5-5] [--label=production|staging] [--tone=...] [--lang=English] [--max-chars=1300] [--session=...]
import { shutdownTracing } from "../instrumentation.js"; // must stay the first import
import { parseArgs } from "node:util";
import { LangfuseClient } from "@langfuse/client";
import { propagateAttributes } from "@langfuse/tracing";
import { blogToLinkedIn } from "../pipeline/index.js";
import type { PromptLabel } from "../prompts.js";
import { saveLastTrace } from "../last-trace.js";
import { getProvider } from "../providers/index.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: "string" },
    label: { type: "string", default: "production" }, // which prompt version to use
    tone: { type: "string", default: "friendly and practical, no hype" },
    lang: { type: "string", default: "English" },
    "max-chars": { type: "string", default: "1300" },
    session: { type: "string", default: `demo-${new Date().toISOString().slice(0, 10)}` },
  },
});

const url = positionals[0];
if (!url) {
  console.error("Usage: npm run run -- <blog post url> [--model=provider:model] [--label=production|staging] [--tone=...] [--lang=...]");
  process.exit(1);
}

try {
  const provider = getProvider(values.model);
  const promptLabel: PromptLabel = values.label!;

  // Attributes set here are copied to the trace and every span inside it.
  const result = await propagateAttributes(
    {
      traceName: "blog-to-linkedin",
      sessionId: values.session,
      userId: process.env.DEMO_USER_ID ?? "devrel-demo",
      tags: ["demo", provider.provider, `prompt:${promptLabel}`],
      metadata: { model: provider.model, language: values.lang!, promptLabel },
    },
    () =>
      blogToLinkedIn(url, provider, {
        tone: values.tone!,
        language: values.lang!,
        maxChars: Number(values["max-chars"]),
        promptLabel,
      }),
  );

  await saveLastTrace({
    traceId: result.traceId,
    url,
    model: `${provider.provider}:${provider.model}`,
    promptLabel,
    createdAt: new Date().toISOString(),
  });

  console.log(`\n${result.post}\n`);
  console.log(`Checks: ${result.check.passed ? "all passed" : "some failed"}`, result.check.rules);
  // getTraceUrl asks the Langfuse API for the project id: don't fail the run if it's down.
  const traceUrl = await new LangfuseClient().getTraceUrl(result.traceId).catch(() => undefined);
  console.log(`Trace: ${traceUrl ?? `${result.traceId} (Langfuse unreachable, prompts fell back to v1 from the code)`}`);
  console.log("Rate it: npm run feedback -- up|down [\"comment\"]");
} catch (error) {
  // The failed run is still in Langfuse: the span that threw is marked as an error.
  console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await shutdownTracing();
}
