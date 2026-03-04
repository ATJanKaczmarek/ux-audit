import type {
  AuditCategory,
  AuditResult,
  AxeViolation,
  CategoryScore,
  DetectedFlow,
  Finding,
  LighthouseMetrics,
  PageData,
  ScanResult,
} from "@/types/scan";

// Category weights must sum to 1.0
const CATEGORY_WEIGHTS: Record<AuditCategory, number> = {
  accessibility: 0.25,
  performance: 0.2,
  visual_hierarchy: 0.15,
  navigation: 0.1,
  forms: 0.1,
  content_quality: 0.08,
  mobile: 0.07,
  cta: 0.05,
};

export function aggregateScanResults(params: {
  scanId: string;
  url: string;
  pages: PageData[];
  auditResults: AuditResult[];
  lighthouseMetrics: LighthouseMetrics[];
  axeViolations: AxeViolation[];
  detectedFlows: DetectedFlow[];
  urlGraph: Record<string, string[]>;
  crawlDuration: number;
}): Omit<ScanResult, "aiInsights" | "status" | "createdAt" | "completedAt" | "errorMessage"> {
  const {
    scanId,
    url,
    pages,
    auditResults,
    lighthouseMetrics,
    axeViolations,
    detectedFlows,
    urlGraph,
    crawlDuration,
  } = params;

  // Build category scores
  const categoryScores: CategoryScore[] = auditResults.map((result) => ({
    category: result.category,
    score: result.score,
    weight: CATEGORY_WEIGHTS[result.category],
    findings: result.findings,
    passedChecks: result.passedChecks,
    totalChecks: result.totalChecks,
  }));

  // Fill in missing categories with default score
  const coveredCategories = new Set(auditResults.map((r) => r.category));
  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS) as Array<
    [AuditCategory, number]
  >) {
    if (!coveredCategories.has(category)) {
      categoryScores.push({
        category,
        score: 50,
        weight,
        findings: [],
        passedChecks: 0,
        totalChecks: 0,
      });
    }
  }

  // Compute weighted overall score
  const overallScore = Math.round(
    categoryScores.reduce((sum, cs) => sum + cs.score * cs.weight, 0),
  );

  // Gather all findings
  const allFindings: Finding[] = categoryScores.flatMap((cs) => cs.findings);

  // Sort by severity
  const severityOrder: Record<Finding["severity"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  allFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    scanId,
    url,
    pages,
    categoryScores,
    overallScore,
    findings: allFindings,
    lighthouseMetrics,
    axeViolations,
    detectedFlows,
    urlGraph,
    totalPagesAnalyzed: pages.length,
    crawlDuration,
  };
}

export function getSeveritySummary(findings: Finding[]): Record<Finding["severity"], number> {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    summary[f.severity]++;
  }
  return summary;
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Poor";
  return "Critical";
}

export function getScoreColor(score: number): string {
  if (score >= 90) return "green";
  if (score >= 75) return "lime";
  if (score >= 60) return "yellow";
  if (score >= 40) return "orange";
  return "red";
}
