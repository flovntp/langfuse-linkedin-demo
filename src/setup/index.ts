// npm run setup: puts everything the demo needs into Langfuse. Safe to re-run.
import { LangfuseClient } from "@langfuse/client";
import { seedDataset } from "./seed-dataset.js";
import { seedPrompts } from "./seed-prompts.js";

const langfuse = new LangfuseClient();

try {
  console.log("Prompts:");
  await seedPrompts(langfuse);
  console.log("Dataset:");
  await seedDataset(langfuse);
  console.log(`\nDone. Open ${process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com"} → Prompts and Datasets`);
} catch (error) {
  console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
