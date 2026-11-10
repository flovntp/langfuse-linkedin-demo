// Seeds the "blog-posts" dataset. Safe to re-run: the dataset and its items are upserted
// on their name / id.
import type { LangfuseClient } from "@langfuse/client";
import { fetchArticle } from "../pipeline/fetch.js";
import { DATASET_NAME, MY_POSTS, PUBLIC_POSTS } from "./dataset-items.js";

export async function seedDataset(langfuse: LangfuseClient) {
  await langfuse.api.datasets.create({
    name: DATASET_NAME,
    description: "Technical blog posts to turn into LinkedIn posts. Input: { url }.",
    metadata: { project: "langfuse-linkedin-demo" },
  });

  const items = [...PUBLIC_POSTS, ...MY_POSTS];
  for (const item of items) {
    await langfuse.dataset.createItem({
      datasetName: DATASET_NAME,
      id: `${DATASET_NAME}-${item.id}`, // item ids are unique per project, not per dataset
      input: { url: item.url },
      metadata: { kind: item.kind, source: item.source },
    });
  }

  console.log(`  ${DATASET_NAME}: ${PUBLIC_POSTS.length} public posts + ${MY_POSTS.length} of yours`);
  if (MY_POSTS.length === 0) console.log("  (add your own posts in src/setup/dataset-items.ts → MY_POSTS)");

  // Download every article once, so the demo still works without network (see pipeline/fetch.ts).
  const results = await Promise.allSettled(items.map((item) => fetchArticle(item.url)));
  const failed = items.filter((_, i) => results[i].status === "rejected");
  console.log(`  articles cached for offline use: ${items.length - failed.length}/${items.length}`);
  for (const item of failed) console.log(`  ⚠ could not fetch ${item.url}`);
}
