import { PROXIES } from "../constants";

/**
 * Try fetching using all proxies until one succeeds.
 */
async function fetchThroughProxies(url: string): Promise<string> {
  for (const proxy of PROXIES) {
    try {
      const finalURL = proxy + encodeURIComponent(url);

      console.log("Trying proxy:", finalURL);

      const response = await fetch(finalURL, { method: "GET" });

      if (!response.ok) {
        console.warn(`Proxy failed: ${proxy}`);
        continue;
      }

      // AllOrigins returns JSON wrapper with .contents
      if (proxy.includes("allorigins")) {
        const data = await response.json();
        return data.contents;
      }

      // Jina.ai already returns markdown (safe for scraping)
      return await response.text();

    } catch (error) {
      console.warn(`Proxy error for ${proxy}`, error);
      continue;
    }
  }

  throw new Error("All proxies failed for URL: " + url);
}

/**
 * Scraper: loads page through proxies, strips scripts, and cleans output.
 */
export async function scrapeWebsite(url: string): Promise<string> {
  try {
    const rawHtml = await fetchThroughProxies(url);

    // Remove scripts, styles, comments, excessive spacing
    const cleaned = rawHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned;

  } catch (error) {
    console.error("Scraper error:", error);
    return "SCRAPER_ERROR";
  }
}
