import type { AuditResult, Finding, PageData } from "@/types/scan";
import { v4 as uuidv4 } from "uuid";

export function runMobileAudit(pages: PageData[]): AuditResult {
  const findings: Finding[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  for (const page of pages) {
    // Check 1: Viewport meta tag
    totalChecks++;
    if (!page.hasViewportMeta) {
      findings.push({
        id: uuidv4(),
        category: "mobile",
        severity: "critical",
        title: "Missing Viewport Meta Tag",
        description:
          "Page lacks a <meta name='viewport'> tag — the page will not scale correctly on mobile devices.",
        affectedPages: [page.url],
        evidence: "No viewport meta found",
        remediation: "Add <meta name='viewport' content='width=device-width, initial-scale=1'>",
        heuristicRef: "Nielsen #4: Consistency and standards",
        wcagRef: "WCAG 1.4.4",
      });
    } else {
      // Check viewport content
      const content = page.viewportContent.toLowerCase();
      if (content.includes("user-scalable=no") || content.includes("maximum-scale=1")) {
        findings.push({
          id: uuidv4(),
          category: "mobile",
          severity: "high",
          title: "Pinch-to-Zoom Disabled",
          description:
            "Viewport meta tag disables user scaling (user-scalable=no), which is an accessibility barrier.",
          affectedPages: [page.url],
          evidence: `viewport: ${page.viewportContent}`,
          remediation:
            "Remove user-scalable=no and maximum-scale=1 restrictions from the viewport meta tag.",
          wcagRef: "WCAG 1.4.4",
        });
      } else {
        passedChecks++;
      }
    }

    // Check 2: Touch target sizes
    totalChecks++;
    if (page.touchTargetViolations > 5) {
      findings.push({
        id: uuidv4(),
        category: "mobile",
        severity: "high",
        title: "Small Touch Targets",
        description: `${page.touchTargetViolations} interactive element(s) are smaller than 44x44px, making them hard to tap accurately.`,
        affectedPages: [page.url],
        evidence: `${page.touchTargetViolations} touch target violations`,
        remediation:
          "Set minimum touch target size to 44x44px (Apple HIG) or 48x48dp (Material Design). Add padding around small elements.",
        wcagRef: "WCAG 2.5.5",
      });
    } else if (page.touchTargetViolations > 0) {
      findings.push({
        id: uuidv4(),
        category: "mobile",
        severity: "low",
        title: "Some Small Touch Targets",
        description: `${page.touchTargetViolations} interactive element(s) are smaller than 44px.`,
        affectedPages: [page.url],
        evidence: `${page.touchTargetViolations} violations`,
        remediation:
          "Increase touch target sizes to at least 44x44px for all interactive elements.",
        wcagRef: "WCAG 2.5.5",
      });
      passedChecks++; // Minor issue
    } else {
      passedChecks++;
    }

    // Check 3: Horizontal overflow
    totalChecks++;
    if (page.hasHorizontalOverflow) {
      findings.push({
        id: uuidv4(),
        category: "mobile",
        severity: "critical",
        title: "Horizontal Scroll / Overflow",
        description:
          "Page content extends beyond the viewport width, forcing users to scroll horizontally.",
        affectedPages: [page.url],
        evidence: "Horizontal overflow detected at 1440px viewport",
        remediation:
          "Use responsive CSS (max-width: 100%, overflow-x: hidden on body). Avoid fixed-width elements wider than viewport.",
        heuristicRef: "Nielsen #4: Consistency and standards",
      });
    } else {
      passedChecks++;
    }

    // Check 4: Font legibility at mobile sizes
    totalChecks++;
    const tinyFonts = page.fonts.filter((f) => f.fontSize < 12 && f.fontSize > 0);
    if (tinyFonts.length > 0) {
      findings.push({
        id: uuidv4(),
        category: "mobile",
        severity: "medium",
        title: "Text Too Small for Mobile",
        description: `${tinyFonts.length} text element(s) use font sizes smaller than 12px.`,
        affectedPages: [page.url],
        evidence: `Smallest font: ${Math.min(...tinyFonts.map((f) => f.fontSize))}px`,
        remediation:
          "Set minimum body text size to 16px for optimal mobile readability. Use relative units (rem) for scaling.",
        wcagRef: "WCAG 1.4.4",
      });
    } else if (page.fonts.length > 0) {
      passedChecks++;
    }
  }

  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 50;

  return {
    category: "mobile",
    score,
    findings: deduplicateFindings(findings),
    passedChecks,
    totalChecks,
  };
}

function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  for (const f of findings) {
    if (seen.has(f.title)) {
      seen.get(f.title)!.affectedPages = [
        ...new Set([...seen.get(f.title)!.affectedPages, ...f.affectedPages]),
      ];
    } else {
      seen.set(f.title, { ...f });
    }
  }
  return Array.from(seen.values());
}
