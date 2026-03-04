import type { AuditResult, ScanResult } from "@/types/scan";
import { aggregateScanResults } from "./aggregator";
import { generateAIInsights } from "./ai-analyzer";
import { runAccessibilityAudit } from "./auditors/accessibility-auditor";
import { runCtaAudit } from "./auditors/cta-auditor";
import { runFormsAudit } from "./auditors/forms-auditor";
import { runLighthouseAudits } from "./auditors/lighthouse-auditor";
import { runMobileAudit } from "./auditors/mobile-auditor";
import { runNavigationAudit } from "./auditors/navigation-auditor";
import { runReadabilityAudit } from "./auditors/readability-auditor";
import { runVisualHierarchyAudit } from "./auditors/visual-hierarchy-auditor";
import { crawlSite } from "./crawler/crawler";
import { completeScan, failScan, updateScanStatus } from "./db";
import { detectFlows } from "./flow-detector";
import { cleanupScan, emitScanEvent } from "./scan-store";

const SCAN_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export async function runScanPipeline(scanId: string, url: string): Promise<void> {
  const startTime = Date.now();
  let timeoutHandle: NodeJS.Timeout | null = null;

  // Set hard timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error("Scan timeout: exceeded 15 minutes"));
    }, SCAN_TIMEOUT_MS);
  });

  try {
    await Promise.race([doScan(scanId, url, startTime), timeoutPromise]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scan-engine] Scan ${scanId} failed:`, message);

    emitScanEvent(scanId, { event: "error", message });
    failScan(scanId, message);
    cleanupScan(scanId);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function doScan(scanId: string, url: string, startTime: number): Promise<void> {
  updateScanStatus(scanId, "running");

  // ── Step 1: Crawl ────────────────────────────────────────────────────────────
  emitScanEvent(scanId, { event: "crawl_start", total: 0 });

  const { pages, urlGraph } = await crawlSite(url, scanId, (current, total, pageUrl) => {
    emitScanEvent(scanId, {
      event: "crawl_progress",
      current,
      total,
      url: pageUrl,
    });
  });

  if (pages.length === 0) {
    throw new Error(`No pages could be crawled from ${url}`);
  }

  console.log(`[scan-engine] Crawled ${pages.length} pages`);

  // ── Step 2: Accessibility audit (axe-core) ───────────────────────────────────
  const { violations: axeViolations, auditResult: accessibilityResult } =
    await runAccessibilityAudit(pages);

  emitScanEvent(scanId, { event: "audit_complete", category: "accessibility" });

  // ── Step 3: Lighthouse (performance) ────────────────────────────────────────
  emitScanEvent(scanId, {
    event: "lighthouse_progress",
    index: 0,
    total: Math.min(5, pages.length),
  });

  const { metrics: lighthouseMetrics, auditResult: performanceResult } = await runLighthouseAudits(
    pages.map((p) => p.url),
    (index, total) => {
      emitScanEvent(scanId, { event: "lighthouse_progress", index, total });
    },
  );

  emitScanEvent(scanId, { event: "audit_complete", category: "performance" });

  // ── Step 4: DOM-based audits (synchronous) ───────────────────────────────────
  const visualResult = runVisualHierarchyAudit(pages);
  emitScanEvent(scanId, { event: "audit_complete", category: "visual_hierarchy" });

  const navigationResult = runNavigationAudit(pages, urlGraph);
  emitScanEvent(scanId, { event: "audit_complete", category: "navigation" });

  const formsResult = runFormsAudit(pages);
  emitScanEvent(scanId, { event: "audit_complete", category: "forms" });

  const readabilityResult = runReadabilityAudit(pages);
  emitScanEvent(scanId, { event: "audit_complete", category: "content_quality" });

  const mobileResult = runMobileAudit(pages);
  emitScanEvent(scanId, { event: "audit_complete", category: "mobile" });

  const ctaResult = runCtaAudit(pages);
  emitScanEvent(scanId, { event: "audit_complete", category: "cta" });

  // ── Step 5: Flow detection ────────────────────────────────────────────────────
  const detectedFlows = detectFlows(pages, urlGraph);

  // ── Step 6: Aggregation ───────────────────────────────────────────────────────
  const auditResults: AuditResult[] = [
    accessibilityResult,
    performanceResult,
    visualResult,
    navigationResult,
    formsResult,
    readabilityResult,
    mobileResult,
    ctaResult,
  ];

  const aggregated = aggregateScanResults({
    scanId,
    url,
    pages,
    auditResults,
    lighthouseMetrics,
    axeViolations,
    detectedFlows,
    urlGraph,
    crawlDuration: Date.now() - startTime,
  });

  // ── Step 7: AI analysis ───────────────────────────────────────────────────────
  let aiInsights;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      aiInsights = await generateAIInsights(
        { ...aggregated, status: "running", createdAt: startTime },
        (chunk) => {
          emitScanEvent(scanId, { event: "ai_progress", chunk });
        },
      );
    } catch (err) {
      console.warn("[scan-engine] AI analysis failed:", err);
    }
  }

  // ── Step 8: Persist ───────────────────────────────────────────────────────────
  const finalResult: ScanResult = {
    ...aggregated,
    status: "complete",
    createdAt: startTime,
    completedAt: Date.now(),
    ...(aiInsights ? { aiInsights } : {}),
  };

  completeScan(scanId, finalResult);
  emitScanEvent(scanId, { event: "complete", scanId });
  cleanupScan(scanId);

  console.log(
    `[scan-engine] Scan ${scanId} complete — score: ${aggregated.overallScore}, pages: ${pages.length}, duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
  );
}
