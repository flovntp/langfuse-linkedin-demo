// The blog posts the experiments run on. Real, public technical posts with different shapes
// (announcements, deep dives, release notes, personal blogs; short ones and ones long enough to
// be truncated), so a prompt or a model can't look good on one kind of post only.
export const DATASET_NAME = "blog-posts";

export interface BlogPostItem {
  id: string; // stable: re-running `npm run setup` updates the item instead of adding a copy
  url: string;
  kind: "announcement" | "deep-dive" | "release-notes" | "how-to" | "opinion";
  source: string;
}

export const PUBLIC_POSTS: BlogPostItem[] = [
  { id: "langfuse-open-source", kind: "announcement", source: "langfuse.com",
    url: "https://langfuse.com/blog/2025-06-04-open-sourcing-langfuse-product" },
  { id: "langfuse-eval-setup", kind: "how-to", source: "langfuse.com",
    url: "https://langfuse.com/blog/2026-07-16-steal-our-eval-setup" },
  { id: "langfuse-halo-assistant", kind: "deep-dive", source: "langfuse.com",
    url: "https://langfuse.com/blog/2026-10-21-building-the-langfuse-assistant" },
  { id: "clickhouse-postgres-fencing", kind: "deep-dive", source: "clickhouse.com",
    url: "https://clickhouse.com/blog/fencing-a-postgres-primary-that-might-still-be-alive" },
  { id: "clickhouse-release-26-10", kind: "release-notes", source: "clickhouse.com",
    url: "https://clickhouse.com/blog/clickhouse-release-26-10" },
  { id: "github-ebpf-deployments", kind: "deep-dive", source: "github.blog",
    url: "https://github.blog/engineering/infrastructure/how-github-uses-ebpf-to-improve-deployment-safety/" },
  { id: "github-diff-performance", kind: "deep-dive", source: "github.blog",
    url: "https://github.blog/engineering/architecture-optimization/the-uphill-climb-of-making-diff-lines-performant/" },
  { id: "jvns-running-sqlite", kind: "how-to", source: "jvns.ca",
    url: "https://jvns.ca/blog/2026/07/17/learning-about-running-sqlite/" },
  { id: "jvns-man-page-examples", kind: "opinion", source: "jvns.ca",
    url: "https://jvns.ca/blog/2026/03/10/examples-for-the-tcpdump-and-dig-man-pages/" },
  { id: "simonw-stateless-mcp", kind: "opinion", source: "simonwillison.net",
    url: "https://simonwillison.net/2026/Jul/31/stateless-mcp/" },
];

// ┌──────────────────────────────────────────────────────────────────────────────┐
// │ TODO: add your own posts here (e.g. your Upsun blog posts), then re-run       │
// │ `npm run setup`. They are added to the same dataset, with source "mine".      │
// └──────────────────────────────────────────────────────────────────────────────┘
export const MY_POSTS: BlogPostItem[] = [
  // { id: "upsun-REPLACE-ME", kind: "how-to", source: "mine",
  //   url: "https://upsun.com/blog/REPLACE-ME/" },
];
