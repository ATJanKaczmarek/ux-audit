import type { AuditResult, Finding, PageData } from "@/types/scan";
import { v4 as uuidv4 } from "uuid";

const ACTION_VERB_PATTERN =
  /^(get|start|try|buy|sign.?up|register|download|learn|contact|subscribe|book|request|join|apply|create|save|send|continue|next|confirm|complete|order|checkout|activate|unlock|upgrade|install|explore|discover|see|view|shop|add|schedule|claim|access|build|launch)/i;

export function runCtaAudit(pages: PageData[]): AuditResult {
  const findings: Finding[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  for (const page of pages) {
    // Check 1: Has at least one CTA
    totalChecks++;
    if (page.ctas.length === 0) {
      findings.push({
        id: uuidv4(),
        category: "cta",
        severity: "medium",
        title: "No CTA Detected",
        description:
          "Page has no identifiable call-to-action elements — users may not know what to do next.",
        affectedPages: [page.url],
        evidence: "No button or CTA elements found",
        remediation:
          "Add a clear primary CTA above the fold that guides users to the next desired action.",
        heuristicRef: "Nielsen #1: Visibility of system status",
      });
      continue;
    } else {
      passedChecks++;
    }

    // Check 2: CTA above the fold
    totalChecks++;
    const aboveFoldCTAs = page.ctas.filter((c) => c.position === "above-fold");
    if (aboveFoldCTAs.length === 0) {
      findings.push({
        id: uuidv4(),
        category: "cta",
        severity: "medium",
        title: "Primary CTA Below Fold",
        description: "No CTA is visible without scrolling — this reduces conversion rates.",
        affectedPages: [page.url],
        evidence: `${page.ctas.length} CTA(s) found, all below fold`,
        remediation:
          "Move the primary action button to the hero section visible without scrolling.",
        heuristicRef: "Nielsen #7: Flexibility and efficiency of use",
      });
    } else {
      passedChecks++;
    }

    // Check 3: Too many CTAs (competing actions)
    totalChecks++;
    if (aboveFoldCTAs.length > 3) {
      findings.push({
        id: uuidv4(),
        category: "cta",
        severity: "low",
        title: "Too Many CTAs Above the Fold",
        description: `${aboveFoldCTAs.length} CTAs above the fold create choice paralysis and dilute the primary action.`,
        affectedPages: [page.url],
        evidence: `CTAs: ${aboveFoldCTAs.map((c) => c.text).join(", ")}`,
        remediation:
          "Limit above-fold CTAs to 1-2. Use a clear primary/secondary visual hierarchy (filled button vs. outline).",
        heuristicRef: "Nielsen #8: Aesthetic and minimalist design",
      });
    } else if (aboveFoldCTAs.length >= 1) {
      passedChecks++;
    }

    // Check 4: Action-verb CTA text
    totalChecks++;
    const ctasWithoutActionVerb = page.ctas.filter((c) => !c.isActionVerb && c.text.length < 50);
    if (ctasWithoutActionVerb.length > 0 && page.ctas.length > 0) {
      findings.push({
        id: uuidv4(),
        category: "cta",
        severity: "low",
        title: "Non-Action CTA Text",
        description: `${ctasWithoutActionVerb.length} CTA(s) don't use action verbs — action-oriented text improves click-through rates.`,
        affectedPages: [page.url],
        evidence: `Non-action CTAs: ${ctasWithoutActionVerb
          .slice(0, 3)
          .map((c) => `"${c.text}"`)
          .join(", ")}`,
        remediation:
          "Start CTA text with strong action verbs: 'Get Started', 'Start Free Trial', 'Download Now', 'Learn More'.",
        heuristicRef: "Nielsen #2: Match between system and the real world",
      });
    } else {
      passedChecks++;
    }

    // Check 5: CTA size (too small)
    totalChecks++;
    const smallCTAs = page.ctas.filter(
      (c) => c.position === "above-fold" && (c.width < 80 || c.height < 36),
    );
    if (smallCTAs.length > 0) {
      findings.push({
        id: uuidv4(),
        category: "cta",
        severity: "low",
        title: "Small CTA Buttons",
        description: `${smallCTAs.length} above-fold CTA(s) appear small and may not draw enough visual attention.`,
        affectedPages: [page.url],
        evidence: `Smallest CTA: ${Math.min(...smallCTAs.map((c) => c.width))}×${Math.min(...smallCTAs.map((c) => c.height))}px`,
        remediation:
          "Ensure primary CTA buttons are at least 120px wide and 40px tall for prominence.",
      });
    } else if (aboveFoldCTAs.length > 0) {
      passedChecks++;
    }
  }

  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 50;

  return {
    category: "cta",
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
