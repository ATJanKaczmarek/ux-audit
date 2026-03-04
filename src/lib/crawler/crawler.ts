import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import type {
  CTAData,
  FormData,
  FormFieldData,
  HeadingData,
  LinkData,
  PageData,
} from "@/types/scan";
import { Configuration, PlaywrightCrawler, RequestQueue } from "crawlee";
import { fetchSitemapUrls } from "./sitemap";

const MAX_PAGES = Number(process.env.MAX_PAGES ?? 50);
const CONCURRENCY = 3;

export interface CrawlResult {
  pages: PageData[];
  urlGraph: Record<string, string[]>;
}

// ── Screenshot helpers ────────────────────────────────────────────────────────

function getScreenshotDir(scanId: string): string {
  return path.join(process.cwd(), "data", "screenshots", scanId);
}

export function urlToFilename(url: string): string {
  return createHash("md5").update(url).digest("hex") + ".jpg";
}

// DOM evaluation function injected into page context
const PAGE_EVAL_SCRIPT = `
(function() {
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;

  // Headings
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(el => ({
    level: parseInt(el.tagName[1]),
    text: el.innerText.trim().slice(0, 200),
    visible: el.offsetParent !== null
  }));

  // Forms
  const forms = Array.from(document.querySelectorAll('form')).map((form, fi) => {
    const fields = Array.from(form.querySelectorAll('input,select,textarea'))
      .filter(el => !['hidden','submit','button','reset','image'].includes(el.type))
      .map(el => {
        const id = el.id || el.name;
        let labelText = '';
        if (id) {
          const lb = document.querySelector('label[for="' + id + '"]');
          if (lb) labelText = lb.innerText.trim();
        }
        if (!labelText) {
          const closest = el.closest('label');
          if (closest) labelText = closest.innerText.trim();
        }
        const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        return {
          type: el.type || el.tagName.toLowerCase(),
          name: el.name || el.id || '',
          label: labelText || ariaLabel || '',
          hasLabel: !!(labelText || ariaLabel),
          hasPlaceholderAsLabel: !!(el.placeholder && !labelText && !ariaLabel),
          hasAutocomplete: !!el.autocomplete && el.autocomplete !== 'off',
          isRequired: el.required || el.getAttribute('aria-required') === 'true'
        };
      });
    const submitBtn = form.querySelector('[type="submit"], button:not([type]), button[type="submit"]');
    const progressIndicators = form.querySelectorAll('[aria-valuenow], [role="progressbar"], .step, .wizard-step');
    return {
      id: 'form-' + fi,
      action: form.action || '',
      method: form.method || 'get',
      fields,
      hasSubmitButton: !!submitBtn,
      submitButtonText: submitBtn ? submitBtn.innerText.trim() : '',
      hasMultiStep: progressIndicators.length > 0
    };
  });

  // Links
  const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 200).map(el => {
    const href = el.href;
    const isNav = !!el.closest('nav,header,[role="navigation"]');
    return {
      href,
      text: el.innerText.trim().slice(0, 100),
      isInternal: href.startsWith(window.location.origin),
      isNavigation: isNav
    };
  });

  // CTAs
  const ctaPattern = /^(get|start|try|buy|sign.?up|register|download|learn|contact|subscribe|book|request|join|apply|explore|discover|see|view|shop|order|add|checkout|continue|next|submit|save|create|build|launch|schedule|claim|access|unlock|activate|upgrade|install)/i;
  const ctaElements = Array.from(document.querySelectorAll('button, a.btn, a.button, [class*="cta"], [class*="btn"]'))
    .filter(el => el.offsetParent !== null)
    .slice(0, 20)
    .map(el => {
      const rect = el.getBoundingClientRect();
      const styles = window.getComputedStyle(el);
      const text = el.innerText.trim();
      return {
        text: text.slice(0, 100),
        tag: el.tagName.toLowerCase(),
        position: rect.top < viewportH ? 'above-fold' : 'below-fold',
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        backgroundColor: styles.backgroundColor,
        textColor: styles.color,
        contrastRatio: 1, // computed server-side
        isActionVerb: ctaPattern.test(text.trim())
      };
    });

  // Fonts (sample)
  const fontSamples = Array.from(document.querySelectorAll('p, h1, h2, h3, span, a, button'))
    .filter(el => el.offsetParent !== null && el.children.length === 0 && el.innerText.trim())
    .slice(0, 15)
    .map(el => {
      const styles = window.getComputedStyle(el);
      return {
        selector: el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : ''),
        fontSize: parseFloat(styles.fontSize),
        fontWeight: parseInt(styles.fontWeight) || 400,
        lineHeight: parseFloat(styles.lineHeight) || 1.5,
        color: styles.color,
        backgroundColor: styles.backgroundColor
      };
    });

  // Viewport meta
  const viewportMeta = document.querySelector('meta[name="viewport"]');

  // Breadcrumbs
  const hasBreadcrumbs = !!(
    document.querySelector('[aria-label*="breadcrumb" i], [class*="breadcrumb"], nav ol, [itemtype*="BreadcrumbList"]')
  );

  // Main text content (prefer main/article)
  const mainEl = document.querySelector('main') || document.querySelector('article') || document.body;
  const mainText = mainEl.innerText.replace(/\\s+/g, ' ').trim().slice(0, 5000);

  // Horizontal overflow
  const hasOverflow = document.documentElement.scrollWidth > viewportW;

  // Touch target violations (elements smaller than 44px)
  const interactives = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"]'))
    .filter(el => el.offsetParent !== null);
  const touchViolations = interactives.filter(el => {
    const r = el.getBoundingClientRect();
    return r.width < 44 || r.height < 44;
  }).length;

  return {
    headings,
    forms,
    links,
    ctas: ctaElements,
    fonts: fontSamples,
    hasViewportMeta: !!viewportMeta,
    viewportContent: viewportMeta ? viewportMeta.content : '',
    hasBreadcrumbs,
    mainTextContent: mainText,
    wordCount: mainText.split(/\\s+/).filter(Boolean).length,
    imageCount: document.querySelectorAll('img').length,
    hasHorizontalOverflow: hasOverflow,
    touchTargetViolations: touchViolations,
    viewportWidth: viewportW,
    viewportHeight: viewportH
  };
})()
`;

export async function crawlSite(
  startUrl: string,
  scanId: string,
  onProgress: (current: number, total: number, url: string) => void,
): Promise<CrawlResult> {
  const origin = new URL(startUrl).origin;
  const storageDir = path.join("/tmp", `crawlee-${scanId}`);
  fs.mkdirSync(storageDir, { recursive: true });

  const screenshotDir = getScreenshotDir(scanId);
  fs.mkdirSync(screenshotDir, { recursive: true });

  // Try sitemap first
  const sitemapUrls = await fetchSitemapUrls(startUrl);

  const discoveredUrls = new Set<string>();
  const pages: PageData[] = [];
  const urlGraph: Record<string, string[]> = {};
  const urlDepth = new Map<string, number>();

  if (sitemapUrls.length > 0) {
    sitemapUrls.slice(0, MAX_PAGES).forEach((u) => discoveredUrls.add(u));
    urlDepth.set(startUrl, 0);
  } else {
    discoveredUrls.add(startUrl);
    urlDepth.set(startUrl, 0);
  }

  // Configure Crawlee storage isolation
  const config = new Configuration({ storageClientOptions: { localDataDirectory: storageDir } });

  const requestQueue = await RequestQueue.open(undefined, { config });

  // Seed the queue
  for (const url of Array.from(discoveredUrls).slice(0, MAX_PAGES)) {
    await requestQueue.addRequest({ url, userData: { depth: urlDepth.get(url) ?? 1 } });
  }

  const crawler = new PlaywrightCrawler(
    {
      requestQueue,
      maxRequestsPerCrawl: MAX_PAGES,
      maxConcurrency: CONCURRENCY,
      requestHandlerTimeoutSecs: 30,
      navigationTimeoutSecs: 20,
      launchContext: {
        launchOptions: {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
      async requestHandler({ request, page, enqueueLinks }) {
        const url = request.url;
        const depth = (request.userData.depth as number) ?? 0;

        try {
          await page.setViewportSize({ width: 1440, height: 900 });
          const title = await page.title();

          // Capture viewport screenshot (JPEG quality 60)
          let screenshotPath: string | undefined;
          try {
            const filename = urlToFilename(url);
            const filepath = path.join(screenshotDir, filename);
            const buffer = await page.screenshot({ type: "jpeg", quality: 60 });
            fs.writeFileSync(filepath, buffer);
            screenshotPath = `screenshots/${scanId}/${filename}`;
          } catch (screenshotErr) {
            console.warn(`[crawler] Screenshot failed for ${url}:`, screenshotErr);
          }

          // Gather DOM data
          const domData = (await page.evaluate(PAGE_EVAL_SCRIPT as unknown as () => unknown)) as {
            headings: HeadingData[];
            forms: FormData[];
            links: LinkData[];
            ctas: CTAData[];
            fonts: {
              selector: string;
              fontSize: number;
              fontWeight: number;
              lineHeight: number;
              color: string;
              backgroundColor: string;
            }[];
            hasViewportMeta: boolean;
            viewportContent: string;
            hasBreadcrumbs: boolean;
            mainTextContent: string;
            wordCount: number;
            imageCount: number;
            hasHorizontalOverflow: boolean;
            touchTargetViolations: number;
            viewportWidth: number;
            viewportHeight: number;
          };

          const pageData: PageData = {
            url,
            title,
            statusCode: 200,
            depth,
            headings: domData.headings,
            fonts: domData.fonts,
            forms: domData.forms,
            links: domData.links,
            ctas: domData.ctas,
            hasViewportMeta: domData.hasViewportMeta,
            viewportContent: domData.viewportContent,
            hasBreadcrumbs: domData.hasBreadcrumbs,
            mainTextContent: domData.mainTextContent,
            wordCount: domData.wordCount,
            imageCount: domData.imageCount,
            viewportWidth: domData.viewportWidth,
            viewportHeight: domData.viewportHeight,
            hasHorizontalOverflow: domData.hasHorizontalOverflow,
            touchTargetViolations: domData.touchTargetViolations,
            loadedAt: Date.now(),
            screenshotPath,
          };

          pages.push(pageData);

          // Build URL graph
          const internalLinks = domData.links
            .filter((l) => l.isInternal && l.href.startsWith(origin))
            .map((l) => {
              try {
                const u = new URL(l.href);
                return u.origin + u.pathname;
              } catch {
                return null;
              }
            })
            .filter((u): u is string => u !== null);

          urlGraph[url] = [...new Set(internalLinks)];

          // Enqueue internal links (not sitemap-seeded)
          if (sitemapUrls.length === 0 && depth < 4) {
            await enqueueLinks({
              strategy: "same-origin",
              transformRequestFunction: (req) => {
                const u = new URL(req.url);
                if (/\.(pdf|jpg|jpeg|png|gif|svg|ico|css|js|xml|json|txt|zip)$/i.test(u.pathname)) {
                  return false;
                }
                req.userData = { depth: depth + 1 };
                return req;
              },
            });
          }

          const idx = pages.length;
          onProgress(idx, Math.max(discoveredUrls.size, MAX_PAGES), url);
        } catch (err) {
          console.warn(`[crawler] Failed to process ${url}:`, err);
        }
      },
      failedRequestHandler({ request }) {
        console.warn(`[crawler] Request failed: ${request.url}`);
      },
    },
    config,
  );

  await crawler.run();

  // Cleanup storage
  try {
    fs.rmSync(storageDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }

  return { pages, urlGraph };
}
