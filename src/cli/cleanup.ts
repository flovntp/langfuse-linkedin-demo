// npm run cleanup                     → list the experiments of the last 30 days, with their ids
// npm run cleanup -- <id> [<id>...]   → show what would be deleted
// npm run cleanup -- <id> ... --yes   → delete it
// npm run cleanup -- --trace=<traceId> --yes → delete single traces (e.g. some items of an experiment)
//
// Langfuse v4 has no "delete experiment" button or endpoint. An experiment is made of the traces
// of its items, so deleting those traces (with their observations and scores) removes it.
// https://langfuse.com/faq/all/deprecated-api-migration#dataset-delete-sdk-methods
import { parseArgs } from "node:util";
import { LangfuseClient } from "@langfuse/client";

const { values, positionals: ids } = parseArgs({
  allowPositionals: true,
  options: {
    yes: { type: "boolean", default: false },
    days: { type: "string", default: "30" },
    trace: { type: "string", multiple: true, default: [] },
  },
});

const langfuse = new LangfuseClient();
const fromStartTime = new Date(Date.now() - Number(values.days) * 86_400_000).toISOString();

try {
  if (ids.length === 0 && values.trace!.length === 0) {
    const experiments = [];
    let cursor: string | undefined;
    do {
      const page = await langfuse.api.experiments.list({ fromStartTime, limit: 100, cursor });
      experiments.push(...page.data);
      cursor = page.meta.cursor ?? undefined;
    } while (cursor);

    experiments.sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const e of experiments) console.log(`${e.id}  ${String(e.itemCount).padStart(3)} items  ${e.name}`);
    console.log(`\nDelete with: npm run cleanup -- <id> [<id>...] --yes`);
  } else {
    const traceIds = new Set<string>(values.trace);
    for (const experimentId of ids) {
      let cursor: string | undefined;
      do {
        const page = await langfuse.api.experiments.listItems({ fromStartTime, experimentId, limit: 100, cursor });
        page.data.forEach((item) => traceIds.add(item.traceId));
        cursor = page.meta.cursor ?? undefined;
      } while (cursor);
    }

    console.log(`${ids.length} experiment(s), ${traceIds.size} traces in total (with their observations and scores).`);
    if (!values.yes) {
      console.log("Nothing deleted. Add --yes to delete.");
    } else if (traceIds.size > 0) {
      const all = [...traceIds];
      for (let i = 0; i < all.length; i += 1000) {
        await langfuse.api.trace.deleteMultiple({ traceIds: all.slice(i, i + 1000) });
      }
      console.log("Deleted. Langfuse removes the data in the background: refresh the UI in a minute.");
    }
  }
} catch (error) {
  console.error(`✖ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
