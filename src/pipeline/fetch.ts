import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { startActiveObservation } from "@langfuse/tracing";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Local models are often loaded with a small context window: keep the input bounded.
const MAX_ARTICLE_CHARS = 12_000;

// Every page we download is kept in .cache/ (gitignored). When the network is down (conference
// wifi...), the last copy is used instead, so the demo still runs offline with a local model.
const CACHE_DIR = ".cache/articles";
const cachePath = (url: string) => `${CACHE_DIR}/${createHash("sha256").update(url).digest("hex").slice(0, 16)}.html`;

async function download(url: string): Promise<{ html: string; fromCache: boolean }> {
  try {
    const response = await fetch(url, { headers: { "User-Agent": "langfuse-linkedin-demo" } });
    if (!response.ok) throw new Error(`GET ${url} → HTTP ${response.status}`);
    const html = await response.text();
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cachePath(url), html);
    return { html, fromCache: false };
  } catch (error) {
    const cached = await readFile(cachePath(url), "utf8").catch(() => undefined);
    if (cached === undefined) throw error;
    return { html: cached, fromCache: true };
  }
}

export interface Article {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
}

export async function fetchArticle(url: string): Promise<Article> {
  return startActiveObservation(
    "fetch-article",
    async (span) => {
      span.update({ input: { url } });

      const { html, fromCache } = await download(url);
      const { document } = parseHTML(html);
      const parsed = new Readability(document as unknown as Document).parse();
      if (!parsed?.textContent) throw new Error(`No article text found at ${url}`);

      const fullText = parsed.textContent.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      const article: Article = {
        url,
        title: parsed.title ?? url,
        text: fullText.slice(0, MAX_ARTICLE_CHARS),
        truncated: fullText.length > MAX_ARTICLE_CHARS,
      };

      span.update({
        output: { title: article.title, chars: article.text.length },
        metadata: { fullLength: fullText.length, truncated: article.truncated, fromCache },
      });
      return article;
    },
    { asType: "tool" },
  );
}
