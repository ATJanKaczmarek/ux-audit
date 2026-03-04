import type { AuditResult, AxeViolation, Finding, PageData } from "@/types/scan";
import { chromium } from "playwright";
import { v4 as uuidv4 } from "uuid";

const CONCURRENCY = Number(process.env.MAX_CONCURRENT_AUDITS ?? 3);

export async function runAccessibilityAudit(
  pages: PageData[],
): Promise<{ violations: AxeViolation[]; auditResult: AuditResult }> {
  const { default: AxeBuilder } = await import("@axe-core/playwright");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const allViolations: AxeViolation[] = [];
  const violationMap = new Map<string, AxeViolation>();

  // Process in batches for concurrency
  for (let i = 0; i < pages.length; i += CONCURRENCY) {
    const batch = pages.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (pageData) => {
        const page = await browser.newPage();
        try {
          await page.goto(pageData.url, { waitUntil: "domcontentloaded", timeout: 20000 });

          const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();

          for (const violation of results.violations) {
            if (violationMap.has(violation.id)) {
              const existing = violationMap.get(violation.id)!;
              if (!existing.affectedPages.includes(pageData.url)) {
                existing.affectedPages.push(pageData.url);
                existing.nodes.push(
                  ...violation.nodes.slice(0, 2).map((n) => ({
                    html: n.html.slice(0, 200),
                    target: n.target.map(String),
                    failureSummary: n.failureSummary ?? "",
                  })),
                );
              }
            } else {
              violationMap.set(violation.id, {
                id: violation.id,
                impact: (violation.impact ?? "minor") as AxeViolation["impact"],
                description: violation.description,
                helpUrl: violation.helpUrl,
                nodes: violation.nodes.slice(0, 3).map((n) => ({
                  html: n.html.slice(0, 200),
                  target: n.target.map(String),
                  failureSummary: n.failureSummary ?? "",
                })),
                affectedPages: [pageData.url],
              });
            }
          }
        } catch (err) {
          console.warn(`[axe] Failed for ${pageData.url}:`, err);
        } finally {
          await page.close();
        }
      }),
    );
  }

  await browser.close();

  allViolations.push(...violationMap.values());

  // Convert to findings
  const findings = axeViolationsToFindings(allViolations);

  // Score: start at 100, deduct by violation count/impact
  let deduction = 0;
  for (const v of allViolations) {
    const pageCount = v.affectedPages.length;
    switch (v.impact) {
      case "critical":
        deduction += 15 * Math.min(pageCount, 3);
        break;
      case "serious":
        deduction += 8 * Math.min(pageCount, 3);
        break;
      case "moderate":
        deduction += 4 * Math.min(pageCount, 3);
        break;
      case "minor":
        deduction += 1 * Math.min(pageCount, 3);
        break;
    }
  }

  const score = Math.max(0, Math.min(100, 100 - deduction));
  const criticalCount = allViolations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  ).length;

  return {
    violations: allViolations,
    auditResult: {
      category: "accessibility",
      score,
      findings,
      passedChecks: Math.max(0, 40 - allViolations.length), // approximate
      totalChecks: 40,
    },
  };
}

function axeViolationsToFindings(violations: AxeViolation[]): Finding[] {
  return violations.map((v) => {
    const severityMap: Record<AxeViolation["impact"], Finding["severity"]> = {
      critical: "critical",
      serious: "high",
      moderate: "medium",
      minor: "low",
    };

    const sampleNode = v.nodes[0];
    return {
      id: uuidv4(),
      category: "accessibility" as const,
      severity: severityMap[v.impact],
      title: `Accessibility: ${v.id.replace(/-/g, " ")}`,
      description: v.description,
      affectedPages: v.affectedPages,
      evidence: sampleNode
        ? `${sampleNode.html.slice(0, 150)}\n${sampleNode.failureSummary}`
        : "See axe-core report",
      remediation: `Fix per axe-core guidance: ${v.helpUrl}`,
      wcagRef: inferWcagRef(v.id),
    };
  });
}

function inferWcagRef(ruleId: string): string {
  const wcagMap: Record<string, string> = {
    "color-contrast": "WCAG 1.4.3",
    "image-alt": "WCAG 1.1.1",
    label: "WCAG 1.3.1",
    "button-name": "WCAG 4.1.2",
    "link-name": "WCAG 2.4.4",
    "html-lang-valid": "WCAG 3.1.1",
    "html-has-lang": "WCAG 3.1.1",
    "document-title": "WCAG 2.4.2",
    "heading-order": "WCAG 1.3.1",
    "landmark-one-main": "WCAG 1.3.6",
    region: "WCAG 1.3.6",
    "skip-link": "WCAG 2.4.1",
    tabindex: "WCAG 2.4.3",
    "focus-trap": "WCAG 2.1.2",
    keyboard: "WCAG 2.1.1",
  };
  return wcagMap[ruleId] ?? "";
}
