import type { AuditResult } from "@/types/scan";
import { describe, expect, it } from "vitest";
import { aggregateScanResults, getScoreLabel, getSeveritySummary } from "./aggregator";

function makeAuditResult(category: AuditResult["category"], score: number): AuditResult {
  return { category, score, findings: [], passedChecks: 5, totalChecks: 5 };
}

describe("aggregateScanResults", () => {
  it("computes weighted overall score", () => {
    const auditResults: AuditResult[] = [
      makeAuditResult("accessibility", 80),
      makeAuditResult("performance", 60),
      makeAuditResult("visual_hierarchy", 70),
      makeAuditResult("navigation", 90),
      makeAuditResult("forms", 100),
      makeAuditResult("content_quality", 50),
      makeAuditResult("mobile", 75),
      makeAuditResult("cta", 85),
    ];

    const result = aggregateScanResults({
      scanId: "test-id",
      url: "https://example.com",
      pages: [],
      auditResults,
      lighthouseMetrics: [],
      axeViolations: [],
      detectedFlows: [],
      urlGraph: {},
      crawlDuration: 1000,
    });

    // Score should be: 80*0.25 + 60*0.20 + 70*0.15 + 90*0.10 + 100*0.10 + 50*0.08 + 75*0.07 + 85*0.05
    // = 20 + 12 + 10.5 + 9 + 10 + 4 + 5.25 + 4.25 = 75
    expect(result.overallScore).toBe(75);
  });

  it("fills missing categories with default score of 50", () => {
    const result = aggregateScanResults({
      scanId: "test-id",
      url: "https://example.com",
      pages: [],
      auditResults: [],
      lighthouseMetrics: [],
      axeViolations: [],
      detectedFlows: [],
      urlGraph: {},
      crawlDuration: 0,
    });

    expect(result.categoryScores).toHaveLength(8);
    expect(result.categoryScores.every((cs) => cs.score === 50)).toBe(true);
  });
});

describe("getSeveritySummary", () => {
  it("counts by severity", () => {
    const findings = [
      {
        severity: "critical" as const,
        id: "1",
        category: "accessibility" as const,
        title: "",
        description: "",
        affectedPages: [],
        evidence: "",
        remediation: "",
      },
      {
        severity: "high" as const,
        id: "2",
        category: "accessibility" as const,
        title: "",
        description: "",
        affectedPages: [],
        evidence: "",
        remediation: "",
      },
      {
        severity: "high" as const,
        id: "3",
        category: "forms" as const,
        title: "",
        description: "",
        affectedPages: [],
        evidence: "",
        remediation: "",
      },
    ];
    const summary = getSeveritySummary(findings);
    expect(summary.critical).toBe(1);
    expect(summary.high).toBe(2);
    expect(summary.medium).toBe(0);
  });
});

describe("getScoreLabel", () => {
  it("returns correct labels", () => {
    expect(getScoreLabel(95)).toBe("Excellent");
    expect(getScoreLabel(78)).toBe("Good");
    expect(getScoreLabel(62)).toBe("Fair");
    expect(getScoreLabel(45)).toBe("Poor");
    expect(getScoreLabel(20)).toBe("Critical");
  });
});
