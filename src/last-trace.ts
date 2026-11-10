// `npm run run` remembers its trace here, so `npm run feedback` knows which post you rate.
import { readFile, writeFile } from "node:fs/promises";

const FILE = ".last-trace.json"; // gitignored

export interface LastTrace {
  traceId: string;
  url: string;
  model: string;
  promptLabel: string;
  createdAt: string;
  // Set by the first vote. Langfuse updates a score sent again with the same id and timestamp,
  // so voting twice on the same post changes the vote instead of adding a second one.
  feedbackTimestamp?: string;
}

export async function saveLastTrace(trace: LastTrace) {
  await writeFile(FILE, JSON.stringify(trace, null, 2) + "\n");
}

export async function loadLastTrace(): Promise<LastTrace> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as LastTrace;
  } catch {
    throw new Error(`No ${FILE} yet: generate a post first with npm run run -- <url>`);
  }
}
