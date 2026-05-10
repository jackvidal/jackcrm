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
        // Real Chrome UA — many sites reject non-browser fingerprints,
        // especially when the request comes from a data-center IP.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "he,en-US;q=0.7,en;q=0.3",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timeout);
    throw new PageFetchError(
      err instanceof Error && err.name === "AbortError"
        ? "Timeout fetching the page (>10s)"
        : `Network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  clearTimeout(timeout);

  if (!response.ok) {
    throw new PageFetchError(
      `HTTP ${response.status} ${response.statusText} fetching the page`,
    );
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
