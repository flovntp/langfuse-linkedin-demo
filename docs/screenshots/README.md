# Screenshots to take

Taken from the local Langfuse UI after `npm run setup`, two `npm run run` calls and the
experiments. 1600 px wide, light theme, so they read well on a projector and in the blog post.

| File | What to show |
|---|---|
| `trace.png` | Tracing → one `blog-to-linkedin` trace, the tree open, `generate-post` selected (prompt + version badge visible) |
| `prompt-diff.png` | Prompts → `linkedin-post` → diff between v1 and v2 |
| `compare.png` | Datasets → blog-posts → Experiments → Compare the Claude and Gemma `staging` runs, ClickHouse 26.10 row |
| `judge-comment.png` | The `faithfulness` score of the Gemma post on ClickHouse 26.10, with the judge's reasoning |
| `feedback.png` | A trace with its `user-feedback` score |
