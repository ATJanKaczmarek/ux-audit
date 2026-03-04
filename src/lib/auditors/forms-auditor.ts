import type { AuditResult, Finding, FormData, PageData } from "@/types/scan";
import { v4 as uuidv4 } from "uuid";

const ACTION_VERB_PATTERN =
  /^(get|start|try|buy|sign.?up|register|download|learn|contact|subscribe|book|request|join|apply|create|save|send|continue|next|submit|confirm|complete|order|checkout|activate|unlock|upgrade|install)/i;

export function runFormsAudit(pages: PageData[]): AuditResult {
  const findings: Finding[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  const allForms: Array<{ form: FormData; url: string }> = [];
  for (const page of pages) {
    for (const form of page.forms) {
      allForms.push({ form, url: page.url });
    }
  }

  if (allForms.length === 0) {
    return {
      category: "forms",
      score: 100,
      findings: [],
      passedChecks: 0,
      totalChecks: 0,
      rawData: { formCount: 0 },
    };
  }

  for (const { form, url } of allForms) {
    // Check 1: Label coverage
    totalChecks++;
    const fieldsWithoutLabel = form.fields.filter((f) => !f.hasLabel);
    if (fieldsWithoutLabel.length > 0) {
      findings.push({
        id: uuidv4(),
        category: "forms",
        severity: fieldsWithoutLabel.length > 2 ? "high" : "medium",
        title: "Form Fields Missing Labels",
        description: `${fieldsWithoutLabel.length} form field(s) lack accessible labels.`,
        affectedPages: [url],
        evidence: `Unlabeled fields: ${fieldsWithoutLabel.map((f) => f.name || f.type).join(", ")}`,
        remediation: "Add <label for='fieldId'> or aria-label attributes to all form inputs.",
        heuristicRef: "Nielsen #5: Error prevention",
        wcagRef: "WCAG 1.3.1",
      });
    } else {
      passedChecks++;
    }

    // Check 2: Placeholder-as-label antipattern
    totalChecks++;
    const placeholderAsLabel = form.fields.filter((f) => f.hasPlaceholderAsLabel);
    if (placeholderAsLabel.length > 0) {
      findings.push({
        id: uuidv4(),
        category: "forms",
        severity: "medium",
        title: "Placeholder Used as Label",
        description: `${placeholderAsLabel.length} field(s) rely solely on placeholder text as a label — this disappears when users type.`,
        affectedPages: [url],
        evidence: `Fields: ${placeholderAsLabel.map((f) => f.name || f.type).join(", ")}`,
        remediation:
          "Replace placeholder-only labels with persistent visible <label> elements. Placeholders can still be used for example values.",
        heuristicRef: "Nielsen #5: Error prevention",
        wcagRef: "WCAG 1.3.1",
      });
    } else {
      passedChecks++;
    }

    // Check 3: Submit button text
    totalChecks++;
    if (form.hasSubmitButton) {
      const submitText = form.submitButtonText.trim();
      if (!submitText || submitText.toLowerCase() === "submit") {
        findings.push({
          id: uuidv4(),
          category: "forms",
          severity: "low",
          title: "Generic Submit Button Text",
          description: `Submit button text "${submitText || "(empty)"}" is generic — use action-oriented text.`,
          affectedPages: [url],
          evidence: `Button text: "${submitText}"`,
          remediation:
            "Use specific action verbs: 'Create Account', 'Send Message', 'Complete Order'. Avoid 'Submit'.",
          heuristicRef: "Nielsen #2: Match between system and the real world",
        });
      } else if (ACTION_VERB_PATTERN.test(submitText)) {
        passedChecks++;
      } else {
        passedChecks++; // Non-generic text is acceptable
      }
    }

    // Check 4: Field count (abandonment risk)
    totalChecks++;
    const fieldCount = form.fields.length;
    if (fieldCount > 7 && !form.hasMultiStep) {
      findings.push({
        id: uuidv4(),
        category: "forms",
        severity: "medium",
        title: "Long Single-Step Form",
        description: `Form with ${fieldCount} fields in a single step — forms with >7 fields have higher abandonment rates.`,
        affectedPages: [url],
        evidence: `${fieldCount} fields: ${form.fields.map((f) => f.name || f.type).join(", ")}`,
        remediation:
          "Break long forms into 2-3 logical steps with clear progress indicators. Only ask for essential information.",
        heuristicRef: "Nielsen #7: Flexibility and efficiency of use",
      });
    } else {
      passedChecks++;
    }

    // Check 5: Input type appropriateness
    totalChecks++;
    const emailFields = form.fields.filter(
      (f) =>
        (f.name.toLowerCase().includes("email") || f.label.toLowerCase().includes("email")) &&
        f.type !== "email",
    );
    const phoneFields = form.fields.filter(
      (f) =>
        (f.name.toLowerCase().includes("phone") ||
          f.name.toLowerCase().includes("tel") ||
          f.label.toLowerCase().includes("phone")) &&
        f.type !== "tel",
    );

    if (emailFields.length > 0 || phoneFields.length > 0) {
      findings.push({
        id: uuidv4(),
        category: "forms",
        severity: "low",
        title: "Incorrect Input Types",
        description: "Some fields use wrong input types, missing mobile keyboard optimizations.",
        affectedPages: [url],
        evidence: [
          emailFields.length > 0 ? `Email field uses type="${emailFields[0].type}"` : "",
          phoneFields.length > 0 ? `Phone field uses type="${phoneFields[0].type}"` : "",
        ]
          .filter(Boolean)
          .join("; "),
        remediation:
          "Use type='email' for email fields, type='tel' for phone numbers. This triggers appropriate mobile keyboards.",
        wcagRef: "WCAG 1.3.5",
      });
    } else {
      passedChecks++;
    }
  }

  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 50;

  return {
    category: "forms",
    score,
    findings: deduplicateFindings(findings),
    passedChecks,
    totalChecks,
    rawData: { formCount: allForms.length },
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
