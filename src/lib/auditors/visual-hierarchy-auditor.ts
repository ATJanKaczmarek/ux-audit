import type { PageData, AuditResult, Finding } from "@/types/scan";
import { v4 as uuidv4 } from "uuid";

export function runVisualHierarchyAudit(pages: PageData[]): AuditResult {
  const findings: Finding[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  for (const page of pages) {
    // Check 1: Single H1
    totalChecks++;
    const h1Count = page.headings.filter((h) => h.level === 1).length;
    if (h1Count === 0) {
      findings.push({
        id: uuidv4(),
        category: "visual_hierarchy",
        severity: "high",
        title: "Missing H1 Heading",
        description: "Page has no H1 heading, which disrupts visual and semantic hierarchy.",
        affectedPages: [page.url],
        evidence: `Found ${h1Count} H1 headings on ${new URL(page.url).pathname}`,
        remediation: "Add a single descriptive H1 that clearly states the page's primary topic.",
        heuristicRef: "Nielsen #6: Recognition rather than recall",
        wcagRef: "WCAG 1.3.1",
      });
    } else if (h1Count > 1) {
      findings.push({
        id: uuidv4(),
        category: "visual_hierarchy",
        severity: "medium",
        title: "Multiple H1 Headings",
        description: `Page has ${h1Count} H1 headings, weakening the primary heading's prominence.`,
        affectedPages: [page.url],
        evidence: page.headings
          .filter((h) => h.level === 1)
          .map((h) => h.text)
          .join("; "),
        remediation: "Use a single H1 for the main topic; use H2-H6 for subsections.",
      });
    } else {
      passedChecks++;
    }

    // Check 2: Heading hierarchy (no skipped levels)
    totalChecks++;
    const headingLevels = page.headings.filter((h) => h.visible).map((h) => h.level);
    let hasSkippedLevel = false;
    let prevLevel = 0;
    for (const level of headingLevels) {
      if (prevLevel > 0 && level > prevLevel + 1) {
        hasSkippedLevel = true;
        break;
      }
      prevLevel = level;
    }
    if (hasSkippedLevel) {
      findings.push({
        id: uuidv4(),
        category: "visual_hierarchy",
        severity: "medium",
        title: "Skipped Heading Levels",
        description: "Heading levels are skipped (e.g., H1 → H3), breaking semantic structure.",
        affectedPages: [page.url],
        evidence: `Heading levels: ${headingLevels.join(" → ")}`,
        remediation: "Use headings in sequential order (H1, H2, H3) without skipping levels.",
        wcagRef: "WCAG 1.3.1",
      });
    } else if (headingLevels.length > 0) {
      passedChecks++;
    }

    // Check 3: Font scale ratio (largest font should be significantly bigger)
    totalChecks++;
    if (page.fonts.length > 2) {
      const fontSizes = page.fonts.map((f) => f.fontSize).filter((s) => s > 0);
      const maxFont = Math.max(...fontSizes);
      const minFont = Math.min(...fontSizes);
      const ratio = maxFont / minFont;
      if (ratio < 1.3) {
        findings.push({
          id: uuidv4(),
          category: "visual_hierarchy",
          severity: "low",
          title: "Poor Font Scale Contrast",
          description: `Font size range is narrow (${minFont}px–${maxFont}px, ratio: ${ratio.toFixed(1)}x), reducing visual hierarchy clarity.`,
          affectedPages: [page.url],
          evidence: `Min: ${minFont}px, Max: ${maxFont}px`,
          remediation:
            "Use a type scale (e.g., Major Third: 1.25x) to create clear size distinctions between heading levels.",
        });
      } else {
        passedChecks++;
      }
    }

    // Check 4: Above-fold CTA presence
    totalChecks++;
    const aboveFoldCTAs = page.ctas.filter((c) => c.position === "above-fold");
    if (page.ctas.length > 0 && aboveFoldCTAs.length === 0) {
      findings.push({
        id: uuidv4(),
        category: "visual_hierarchy",
        severity: "medium",
        title: "No CTA Above the Fold",
        description: "All CTAs are below the fold — users may not see the primary action without scrolling.",
        affectedPages: [page.url],
        evidence: `${page.ctas.length} CTA(s) found, all below fold`,
        remediation: "Move the primary call-to-action to the hero section above the fold.",
        heuristicRef: "Nielsen #1: Visibility of system status",
      });
    } else if (aboveFoldCTAs.length > 0) {
      passedChecks++;
    }
  }

  // Score calculation
  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 50;

  // Deduplicate findings across pages
  const deduped = deduplicateFindings(findings);

  return {
    category: "visual_hierarchy",
    score,
    findings: deduped,
    passedChecks,
    totalChecks,
  };
}

function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  for (const f of findings) {
    if (seen.has(f.title)) {
      const existing = seen.get(f.title)!;
      existing.affectedPages = [...new Set([...existing.affectedPages, ...f.affectedPages])];
    } else {
      seen.set(f.title, { ...f });
    }
  }
  return Array.from(seen.values());
}
