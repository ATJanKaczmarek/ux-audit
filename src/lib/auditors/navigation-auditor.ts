import type { AuditResult, Finding, PageData } from "@/types/scan";
import { v4 as uuidv4 } from "uuid";

export function runNavigationAudit(
  pages: PageData[],
  urlGraph: Record<string, string[]>,
): AuditResult {
  const findings: Finding[] = [];
  let totalChecks = 0;
  let passedChecks = 0;
  const allUrls = pages.map((p) => p.url);

  // Build depth map via BFS from root
  const root = pages[0]?.url ?? "";
  const depthMap = buildDepthMap(root, urlGraph);

  // Check 1: Navigation depth
  totalChecks++;
  const maxDepth = Math.max(...Object.values(depthMap), 0);
  const deepPages = allUrls.filter((u) => (depthMap[u] ?? 0) > 3);
  if (maxDepth > 4) {
    findings.push({
      id: uuidv4(),
      category: "navigation",
      severity: "high",
      title: "Excessive Navigation Depth",
      description: `${deepPages.length} pages are more than 3 clicks from the homepage (max depth: ${maxDepth}).`,
      affectedPages: deepPages.slice(0, 10),
      evidence: `Max depth: ${maxDepth}. Pages beyond 3 clicks: ${deepPages.length}`,
      remediation:
        "Restructure IA to keep all important content within 3 clicks. Add shortcuts via featured/popular links.",
      heuristicRef: "Nielsen #6: Recognition rather than recall",
    });
  } else if (maxDepth > 3) {
    findings.push({
      id: uuidv4(),
      category: "navigation",
      severity: "medium",
      title: "Some Pages Deep in Hierarchy",
      description: `${deepPages.length} pages require 4 clicks to reach.`,
      affectedPages: deepPages.slice(0, 5),
      evidence: `Max depth: ${maxDepth}`,
      remediation:
        "Consider adding cross-links or surface popular deep content in primary navigation.",
    });
  } else {
    passedChecks++;
  }

  // Check 2: Orphan pages (no incoming links)
  totalChecks++;
  const linkedUrls = new Set<string>();
  for (const links of Object.values(urlGraph)) {
    for (const l of links) linkedUrls.add(l);
  }
  const orphans = allUrls.filter((u) => !linkedUrls.has(u) && u !== root);
  if (orphans.length > 0) {
    findings.push({
      id: uuidv4(),
      category: "navigation",
      severity: "medium",
      title: "Orphan Pages Detected",
      description: `${orphans.length} pages have no incoming internal links.`,
      affectedPages: orphans.slice(0, 10),
      evidence: `Orphan pages: ${orphans.slice(0, 3).join(", ")}`,
      remediation: "Link orphan pages from relevant sections or add them to sitemap navigation.",
      heuristicRef: "Nielsen #7: Flexibility and efficiency of use",
    });
  } else if (allUrls.length > 1) {
    passedChecks++;
  }

  // Check 3: Breadcrumb presence
  totalChecks++;
  const pagesWithBreadcrumbs = pages.filter((p) => p.hasBreadcrumbs);
  const pagesNeedingBreadcrumbs = pages.filter((p) => (depthMap[p.url] ?? 0) >= 2);
  if (pagesNeedingBreadcrumbs.length > 0 && pagesWithBreadcrumbs.length === 0) {
    findings.push({
      id: uuidv4(),
      category: "navigation",
      severity: "low",
      title: "Missing Breadcrumb Navigation",
      description:
        "No breadcrumbs found on pages with depth ≥ 2, making it harder for users to understand their location.",
      affectedPages: pagesNeedingBreadcrumbs.map((p) => p.url).slice(0, 5),
      evidence: `${pagesNeedingBreadcrumbs.length} pages at depth ≥2, ${pagesWithBreadcrumbs.length} have breadcrumbs`,
      remediation: "Add breadcrumb navigation with structured data markup (BreadcrumbList schema).",
      heuristicRef: "Nielsen #1: Visibility of system status",
      wcagRef: "WCAG 2.4.8",
    });
  } else if (pagesWithBreadcrumbs.length > 0) {
    passedChecks++;
  }

  // Check 4: Navigation consistency
  totalChecks++;
  const navPages = pages.filter((p) => p.links.some((l) => l.isNavigation));
  if (navPages.length < pages.length * 0.7 && pages.length > 3) {
    findings.push({
      id: uuidv4(),
      category: "navigation",
      severity: "medium",
      title: "Inconsistent Navigation",
      description: `Only ${navPages.length}/${pages.length} pages have navigation elements — inconsistent navigation confuses users.`,
      affectedPages: pages
        .filter((p) => !p.links.some((l) => l.isNavigation))
        .map((p) => p.url)
        .slice(0, 5),
      evidence: `Pages with nav: ${navPages.length}/${pages.length}`,
      remediation:
        "Ensure consistent navigation is present on all pages (global header/footer nav).",
      heuristicRef: "Nielsen #4: Consistency and standards",
    });
  } else {
    passedChecks++;
  }

  // Check 5: Primary nav item count (if detectable)
  totalChecks++;
  const navLinks = pages[0]?.links.filter((l) => l.isNavigation) ?? [];
  const primaryNavCount = navLinks.filter((l) => l.isInternal).length;
  if (primaryNavCount > 9) {
    findings.push({
      id: uuidv4(),
      category: "navigation",
      severity: "medium",
      title: "Too Many Navigation Items",
      description: `Primary navigation has ${primaryNavCount} items, exceeding the cognitive load threshold of 7±2.`,
      affectedPages: [pages[0]?.url ?? ""],
      evidence: `${primaryNavCount} nav items detected`,
      remediation:
        "Group navigation items under fewer top-level categories. Aim for 5-7 primary nav items.",
      heuristicRef: "Nielsen #7: Flexibility and efficiency of use",
    });
  } else if (primaryNavCount > 0) {
    passedChecks++;
  }

  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 50;

  return {
    category: "navigation",
    score,
    findings: deduplicateFindings(findings),
    passedChecks,
    totalChecks,
  };
}

function buildDepthMap(root: string, graph: Record<string, string[]>): Record<string, number> {
  const depth: Record<string, number> = { [root]: 0 };
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of graph[current] ?? []) {
      if (!(neighbor in depth)) {
        depth[neighbor] = (depth[current] ?? 0) + 1;
        queue.push(neighbor);
      }
    }
  }
  return depth;
}

function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  for (const f of findings) {
    if (!seen.has(f.title)) seen.set(f.title, f);
  }
  return Array.from(seen.values());
}
