// npm run run -- <url> [--model=anthropic:claude-haiku-5-5] [--tone=...] [--lang=English] [--max-chars=1300] [--session=...]
import { shutdownTracing } from "../instrumentation.js"; // must stay the first import
import { parseArgs } from "node:util";
import { LangfuseClient } from "@langfuse/client";
import { propagateAttributes } from "@langfuse/tracing";
import { blogToLinkedIn } from "../pipeline/index.js";
import { getProvider } from "../providers/index.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: "string" },
    tone: { type: "string", default: "friendly and practical, no hype" },
    lang: { type: "string", default: "English" },
    "max-chars": { type: "string", default: "1300" },
    session: { type: "string", default: `demo-${new Date().toISOString().slice(0, 10)}` },
  },
});

const url = positionals[0];
if (!url) {
  console.error("Usage: npm run run -- <blog post url> [--model=provider:model] [--tone=...] [--lang=...]");
  process.exit(1);
}

try {
  const provider = getProvider(values.model);

  // Attributes set here are copied to the trace and every span inside it.
  const result = await propagateAttributes(
    {
      traceName: "blog-to-linkedin",
      sessionId: values.session,
      userId: process.env.DEMO_USER_ID ?? "devrel-demo",
      tags: ["demo", provider.provider],
      metadata: { model: provider.model, language: values.lang },
    },
    () =>
      blogToLinkedIn(url, provider, {
        tone: values.tone!,
        language: values.lang!,
        maxChars: Number(values["max-chars"]),
      }),
  );

  console.log(`\n${result.post}\n`);
  console.log(`Checks: ${result.check.passed ? "all passed" : "some failed"}`, result.check.rules);
  console.log(`Trace: ${await new LangfuseClient().getTraceUrl(result.traceId)}`);
} catch (error) {
  // The failed run is still in Langfuse: the span that threw is marked as an error.
  console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await shutdownTracing();
}
