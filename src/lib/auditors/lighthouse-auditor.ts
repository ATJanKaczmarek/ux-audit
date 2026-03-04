import type { AuditResult, Finding, LighthouseMetrics } from "@/types/scan";
import { v4 as uuidv4 } from "uuid";

const SAMPLE_SIZE = Number(process.env.LIGHTHOUSE_SAMPLE_SIZE ?? 5);

export async function runLighthouseAudits(
  urls: string[],
  onProgress: (index: number, total: number) => void,
): Promise<{ metrics: LighthouseMetrics[]; auditResult: AuditResult }> {
  // Dynamic imports to avoid issues at module load time
  const { launch } = await import("chrome-launcher");
  const lighthouse = (await import("lighthouse")).default;

  const sample = urls.slice(0, SAMPLE_SIZE);
  const metrics: LighthouseMetrics[] = [];
  const findings: Finding[] = [];

  for (let i = 0; i < sample.length; i++) {
    const url = sample[i];
    let chrome;
    try {
      chrome = await launch({
        chromeFlags: ["--headless", "--no-sandbox", "--disable-setuid-sandbox"],
      });

      const runnerResult = await lighthouse(url, {
        port: chrome.port,
        output: "json",
        logLevel: "silent",
        onlyCategories: ["performance", "accessibility"],
        throttlingMethod: "simulate",
      });

      const lhr = runnerResult?.lhr;
      if (!lhr) continue;

      const audits = lhr.audits;
      const m: LighthouseMetrics = {
        url,
        fcp: audits["first-contentful-paint"]?.numericValue ?? 0,
        lcp: audits["largest-contentful-paint"]?.numericValue ?? 0,
        cls: audits["cumulative-layout-shift"]?.numericValue ?? 0,
        tbt: audits["total-blocking-time"]?.numericValue ?? 0,
        si: audits["speed-index"]?.numericValue ?? 0,
        performanceScore: Math.round((lhr.categories.performance?.score ?? 0) * 100),
        accessibilityScore: Math.round((lhr.categories.accessibility?.score ?? 0) * 100),
      };
      metrics.push(m);

      // Generate findings from Lighthouse metrics
      if (m.lcp > 4000) {
        findings.push({
          id: uuidv4(),
          category: "performance",
          severity: "high",
          title: "Poor Largest Contentful Paint",
          description: `LCP of ${(m.lcp / 1000).toFixed(1)}s exceeds the 4s threshold on ${new URL(url).pathname}`,
          affectedPages: [url],
          evidence: `LCP: ${(m.lcp / 1000).toFixed(1)}s (threshold: ≤2.5s good, ≤4s needs improvement)`,
          remediation:
            "Optimize images, eliminate render-blocking resources, use a CDN, and preload critical assets.",
          heuristicRef: "Nielsen #1: Visibility of system status",
        });
      } else if (m.lcp > 2500) {
        findings.push({
          id: uuidv4(),
          category: "performance",
          severity: "medium",
          title: "LCP Needs Improvement",
          description: `LCP of ${(m.lcp / 1000).toFixed(1)}s on ${new URL(url).pathname}`,
          affectedPages: [url],
          evidence: `LCP: ${(m.lcp / 1000).toFixed(1)}s`,
          remediation: "Consider image optimization and reducing server response time.",
        });
      }

      if (m.cls > 0.1) {
        findings.push({
          id: uuidv4(),
          category: "performance",
          severity: m.cls > 0.25 ? "high" : "medium",
          title: "High Cumulative Layout Shift",
          description: `CLS score of ${m.cls.toFixed(3)} causes unexpected layout shifts on ${new URL(url).pathname}`,
          affectedPages: [url],
          evidence: `CLS: ${m.cls.toFixed(3)} (threshold: ≤0.1 good)`,
          remediation:
            "Set explicit dimensions on images and ads; avoid inserting content above existing content.",
          wcagRef: "WCAG 1.4.13",
        });
      }

      if (m.tbt > 600) {
        findings.push({
          id: uuidv4(),
          category: "performance",
          severity: "high",
          title: "High Total Blocking Time",
          description: `TBT of ${m.tbt}ms indicates heavy JavaScript execution on ${new URL(url).pathname}`,
          affectedPages: [url],
          evidence: `TBT: ${m.tbt}ms (threshold: ≤200ms good)`,
          remediation:
            "Code-split JavaScript, defer non-critical scripts, reduce main thread work.",
        });
      }
    } catch (err) {
      console.warn(`[lighthouse] Failed for ${url}:`, err);
    } finally {
      if (chrome) {
        try {
          await chrome.kill();
        } catch {
          // ignore
        }
      }
    }

    onProgress(i + 1, sample.length);
    // Small delay between runs to avoid port conflicts
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Compute aggregate performance score
  const avgScore =
    metrics.length > 0 ? metrics.reduce((s, m) => s + m.performanceScore, 0) / metrics.length : 50;

  // Deduplicate findings by title
  const uniqueFindings = deduplicateFindings(findings);

  return {
    metrics,
    auditResult: {
      category: "performance",
      score: Math.round(avgScore),
      findings: uniqueFindings,
      passedChecks: metrics.filter((m) => m.performanceScore >= 90).length,
      totalChecks: metrics.length,
    },
  };
}

function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  for (const f of findings) {
    if (seen.has(f.title)) {
      seen.get(f.title)!.affectedPages.push(...f.affectedPages);
    } else {
      seen.set(f.title, { ...f, affectedPages: [...f.affectedPages] });
    }
  }
  return Array.from(seen.values());
}
