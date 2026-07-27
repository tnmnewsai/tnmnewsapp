import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export interface FetchedArticle {
  title: string;
  bodyText: string;
}

/**
 * Readability strips nav/ads/comments and leaves the actual article body —
 * the same extraction approach browsers use for reader mode. No AI involved
 * here; that starts at script generation, one step later in the pipeline.
 */
export async function fetchBlogArticle(url: string): Promise<FetchedArticle> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SocialVideoTool/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch article: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article?.textContent?.trim()) {
    throw new Error("Could not extract article content from this URL — is it a real article page?");
  }

  return {
    title: article.title?.trim() || "Untitled article",
    bodyText: article.textContent.trim().replace(/\n{3,}/g, "\n\n"),
  };
}
