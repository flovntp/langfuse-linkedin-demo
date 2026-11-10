import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { startActiveObservation } from "@langfuse/tracing";

// Local models are often loaded with a small context window: keep the input bounded.
const MAX_ARTICLE_CHARS = 12_000;

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

      const response = await fetch(url, { headers: { "User-Agent": "langfuse-linkedin-demo" } });
      if (!response.ok) throw new Error(`GET ${url} → HTTP ${response.status}`);

      const { document } = parseHTML(await response.text());
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
        metadata: { fullLength: fullText.length, truncated: article.truncated },
      });
      return article;
    },
    { asType: "tool" },
  );
}
