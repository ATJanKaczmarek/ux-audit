// Fetch and parse sitemap.xml / sitemap_index.xml

const TIMEOUT_MS = 10_000;

interface SitemapEntry {
  url: string;
  lastmod?: string;
  priority?: number;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "UXAudit-Bot/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractUrlsFromXml(xml: string): string[] {
  const urls: string[] = [];
  const locPattern = /<loc>(.*?)<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = locPattern.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url.startsWith("http")) {
      urls.push(url);
    }
  }
  return urls;
}

function isSitemapIndex(xml: string): boolean {
  return xml.includes("<sitemapindex") || xml.includes("<sitemap>");
}

export async function fetchSitemapUrls(baseUrl: string): Promise<string[]> {
  const origin = new URL(baseUrl).origin;
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap`,
    `${origin}/sitemap/sitemap.xml`,
  ];

  for (const candidate of candidates) {
    const xml = await fetchText(candidate);
    if (!xml) continue;

    if (isSitemapIndex(xml)) {
      // Fetch all child sitemaps
      const childUrls = extractUrlsFromXml(xml).filter(
        (u) => u.endsWith(".xml") || u.includes("sitemap"),
      );
      const allUrls: string[] = [];
      await Promise.all(
        childUrls.slice(0, 10).map(async (childUrl) => {
          const childXml = await fetchText(childUrl);
          if (childXml) {
            allUrls.push(...extractUrlsFromXml(childXml));
          }
        }),
      );
      return deduplicateAndFilter(allUrls, origin);
    }

    const urls = extractUrlsFromXml(xml);
    if (urls.length > 0) {
      return deduplicateAndFilter(urls, origin);
    }
  }

  return [];
}

function deduplicateAndFilter(urls: string[], origin: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      // Only same-origin URLs, no fragments, no files
      if (parsed.origin !== origin) continue;
      if (/\.(pdf|jpg|jpeg|png|gif|svg|ico|css|js|xml|json|txt|zip|mp4|mp3)$/i.test(parsed.pathname))
        continue;
      const normalized = parsed.origin + parsed.pathname + parsed.search;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push(url);
      }
    } catch {
      // skip invalid URLs
    }
  }

  return result;
}

export type { SitemapEntry };
