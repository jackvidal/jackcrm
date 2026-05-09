import * as cheerio from "cheerio";

const MAX_BYTES = 1_000_000; // 1 MB
const MAX_OUTPUT_CHARS = 8000;
const FETCH_TIMEOUT_MS = 10_000;

export interface FetchedPage {
  url: string;
  title: string;
  description: string;
  text: string;
}

export class PageFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageFetchError";
  }
}

/**
 * Fetch a webpage and return cleaned, condensed text suitable for an LLM.
 * Strips scripts, styles, nav, header, footer. Keeps headings and main copy.
 */
export async function fetchPageContent(url: string): Promise<FetchedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; JackCRM/1.0; +https://jackcrm.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timeout);
    throw new PageFetchError(
      err instanceof Error && err.name === "AbortError"
        ? "Timeout fetching the page"
        : "Network error fetching the page",
    );
  }
  clearTimeout(timeout);

  if (!response.ok) {
    throw new PageFetchError(`HTTP ${response.status} fetching the page`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new PageFetchError("Empty response body");

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  await reader.cancel().catch(() => {});

  const html = new TextDecoder("utf-8").decode(
    Buffer.concat(chunks.map((c) => Buffer.from(c))),
  );

  const $ = cheerio.load(html);
  $(
    "script, style, noscript, iframe, svg, nav, header, footer, [aria-hidden='true']",
  ).remove();

  const title = ($("title").first().text() || "").trim();
  const description =
    ($('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "").trim();

  // Pull headings + body text in document order
  const lines: string[] = [];
  $("h1, h2, h3, h4, p, li").each((_, el) => {
    const tag = "tagName" in el ? (el as { tagName: string }).tagName : "";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;
    if (tag.startsWith("h")) lines.push(`# ${text}`);
    else lines.push(text);
  });

  let body = lines.join("\n").slice(0, MAX_OUTPUT_CHARS);
  if (body.length === 0) {
    body = $("body").text().replace(/\s+/g, " ").slice(0, MAX_OUTPUT_CHARS);
  }

  return { url, title, description, text: body };
}
