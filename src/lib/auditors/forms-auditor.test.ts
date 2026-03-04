import { describe, it, expect } from "vitest";
import { runFormsAudit } from "./forms-auditor";
import type { PageData, FormData } from "@/types/scan";

function makeForm(overrides: Partial<FormData> = {}): FormData {
  return {
    id: "form-0",
    action: "/submit",
    method: "post",
    fields: [],
    hasSubmitButton: true,
    submitButtonText: "Submit",
    hasMultiStep: false,
    ...overrides,
  };
}

function makePage(forms: FormData[]): PageData {
  return {
    url: "https://example.com/signup",
    title: "Sign Up",
    statusCode: 200,
    depth: 1,
    headings: [],
    fonts: [],
    forms,
    links: [],
    ctas: [],
    hasViewportMeta: true,
    viewportContent: "width=device-width, initial-scale=1",
    hasBreadcrumbs: false,
    mainTextContent: "",
    wordCount: 100,
    imageCount: 0,
    viewportWidth: 1440,
    viewportHeight: 900,
    hasHorizontalOverflow: false,
    touchTargetViolations: 0,
    loadedAt: Date.now(),
  };
}

describe("runFormsAudit", () => {
  it("returns 100 score with no forms", () => {
    const result = runFormsAudit([makePage([])]);
    expect(result.score).toBe(100);
    expect(result.findings).toHaveLength(0);
  });

  it("flags unlabeled fields", () => {
    const form = makeForm({
      fields: [{ type: "text", name: "name", label: "", hasLabel: false, hasPlaceholderAsLabel: false, hasAutocomplete: false, isRequired: true }],
    });
    const result = runFormsAudit([makePage([form])]);
    expect(result.findings.some((f) => f.title.includes("Missing Labels"))).toBe(true);
  });

  it("flags generic submit button text", () => {
    const form = makeForm({
      submitButtonText: "Submit",
      fields: [{ type: "email", name: "email", label: "Email", hasLabel: true, hasPlaceholderAsLabel: false, hasAutocomplete: true, isRequired: true }],
    });
    const result = runFormsAudit([makePage([form])]);
    expect(result.findings.some((f) => f.title.includes("Generic Submit"))).toBe(true);
  });

  it("flags long single-step form", () => {
    const fields = Array.from({ length: 9 }, (_, i) => ({
      type: "text",
      name: `field${i}`,
      label: `Field ${i}`,
      hasLabel: true,
      hasPlaceholderAsLabel: false,
      hasAutocomplete: false,
      isRequired: false,
    }));
    const form = makeForm({ fields, hasMultiStep: false });
    const result = runFormsAudit([makePage([form])]);
    expect(result.findings.some((f) => f.title.includes("Long Single-Step"))).toBe(true);
  });

  it("does not flag multi-step long form", () => {
    const fields = Array.from({ length: 9 }, (_, i) => ({
      type: "text",
      name: `field${i}`,
      label: `Field ${i}`,
      hasLabel: true,
      hasPlaceholderAsLabel: false,
      hasAutocomplete: false,
      isRequired: false,
    }));
    const form = makeForm({ fields, hasMultiStep: true });
    const result = runFormsAudit([makePage([form])]);
    expect(result.findings.some((f) => f.title.includes("Long Single-Step"))).toBe(false);
  });
});
