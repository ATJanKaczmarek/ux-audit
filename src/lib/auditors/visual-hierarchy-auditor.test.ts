import type { PageData } from "@/types/scan";
import { describe, expect, it } from "vitest";
import { runVisualHierarchyAudit } from "./visual-hierarchy-auditor";

function makePage(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/",
    title: "Example",
    statusCode: 200,
    depth: 0,
    headings: [],
    fonts: [],
    forms: [],
    links: [],
    ctas: [],
    hasViewportMeta: true,
    viewportContent: "width=device-width, initial-scale=1",
    hasBreadcrumbs: false,
    mainTextContent: "",
    wordCount: 0,
    imageCount: 0,
    viewportWidth: 1440,
    viewportHeight: 900,
    hasHorizontalOverflow: false,
    touchTargetViolations: 0,
    loadedAt: Date.now(),
    ...overrides,
  };
}

describe("runVisualHierarchyAudit", () => {
  it("flags missing H1", () => {
    const result = runVisualHierarchyAudit([makePage({ headings: [] })]);
    expect(result.findings.some((f) => f.title.includes("Missing H1"))).toBe(true);
  });

  it("passes with single H1", () => {
    const result = runVisualHierarchyAudit([
      makePage({ headings: [{ level: 1, text: "Welcome", visible: true }] }),
    ]);
    expect(result.findings.some((f) => f.title.includes("Missing H1"))).toBe(false);
  });

  it("flags multiple H1s", () => {
    const result = runVisualHierarchyAudit([
      makePage({
        headings: [
          { level: 1, text: "First", visible: true },
          { level: 1, text: "Second", visible: true },
        ],
      }),
    ]);
    expect(result.findings.some((f) => f.title.includes("Multiple H1"))).toBe(true);
  });

  it("flags skipped heading levels", () => {
    const result = runVisualHierarchyAudit([
      makePage({
        headings: [
          { level: 1, text: "H1", visible: true },
          { level: 3, text: "H3 skipped H2", visible: true },
        ],
      }),
    ]);
    expect(result.findings.some((f) => f.title.includes("Skipped"))).toBe(true);
  });

  it("returns score between 0 and 100", () => {
    const result = runVisualHierarchyAudit([makePage()]);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
