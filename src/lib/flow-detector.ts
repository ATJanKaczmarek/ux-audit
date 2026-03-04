import type { PageData, DetectedFlow, FlowNode, FlowEdge, FlowType } from "@/types/scan";

// URL pattern → flow type mapping
const URL_FLOW_PATTERNS: Array<{ pattern: RegExp; type: FlowType }> = [
  { pattern: /\/(register|signup|sign-up|create-account|join|new-user)/i, type: "signup" },
  { pattern: /\/(login|sign-in|signin|auth|log-in)/i, type: "login" },
  { pattern: /\/(cart|checkout|order|payment|billing|shipping|purchase|confirm)/i, type: "checkout" },
  { pattern: /\/(onboarding|welcome|setup|getting-started|tour|intro)/i, type: "onboarding" },
  { pattern: /\/(search|results)/i, type: "search" },
  { pattern: /\/(contact|support|help|feedback|ticket|inquiry)/i, type: "contact" },
  { pattern: /\/(product|catalog|shop|store|items|browse|collection)/i, type: "product" },
];

// DOM indicators for flow classification
function classifyPageByDOM(page: PageData): FlowType | null {
  const hasEmailAndPassword =
    page.forms.some((f) =>
      f.fields.some((field) => field.type === "email" || field.name.includes("email")),
    ) &&
    page.forms.some((f) =>
      f.fields.some((field) => field.type === "password"),
    );

  const hasPaymentFields = page.forms.some((f) =>
    f.fields.some(
      (field) =>
        field.name.toLowerCase().includes("card") ||
        field.name.toLowerCase().includes("cvv") ||
        field.name.toLowerCase().includes("billing") ||
        field.name.toLowerCase().includes("credit"),
    ),
  );

  const hasAddressFields = page.forms.some((f) =>
    f.fields.some(
      (field) =>
        field.name.toLowerCase().includes("address") ||
        field.name.toLowerCase().includes("zip") ||
        field.name.toLowerCase().includes("postal"),
    ),
  );

  if (hasPaymentFields) return "checkout";
  if (hasEmailAndPassword && page.forms.some((f) => f.submitButtonText.toLowerCase().includes("register")))
    return "signup";
  if (hasEmailAndPassword) return "login";
  if (hasAddressFields) return "checkout";

  return null;
}

function classifyPage(page: PageData): FlowType {
  // Check URL patterns first
  const urlPath = new URL(page.url).pathname;
  for (const { pattern, type } of URL_FLOW_PATTERNS) {
    if (pattern.test(urlPath)) return type;
  }

  // Fallback to DOM analysis
  return classifyPageByDOM(page) ?? "unknown";
}

export function detectFlows(
  pages: PageData[],
  urlGraph: Record<string, string[]>,
): DetectedFlow[] {
  // Classify each page
  const pageFlowMap = new Map<string, FlowType>();
  for (const page of pages) {
    pageFlowMap.set(page.url, classifyPage(page));
  }

  // Group pages by flow type
  const flowGroups = new Map<FlowType, PageData[]>();
  for (const [url, flowType] of pageFlowMap) {
    if (flowType === "unknown") continue;
    const page = pages.find((p) => p.url === url);
    if (!page) continue;
    if (!flowGroups.has(flowType)) flowGroups.set(flowType, []);
    flowGroups.get(flowType)!.push(page);
  }

  const detectedFlows: DetectedFlow[] = [];

  for (const [flowType, flowPages] of flowGroups) {
    const nodes: FlowNode[] = flowPages.map((p) => ({
      url: p.url,
      title: p.title,
      flowType,
      depth: p.depth,
      hasForms: p.forms.length > 0,
      hasPaymentFields: p.forms.some((f) =>
        f.fields.some(
          (field) =>
            field.name.toLowerCase().includes("card") ||
            field.name.toLowerCase().includes("cvv"),
        ),
      ),
    }));

    // Build edges within this flow
    const edges: FlowEdge[] = [];
    const flowUrls = new Set(flowPages.map((p) => p.url));

    for (const page of flowPages) {
      const linkedPages = urlGraph[page.url] ?? [];
      for (const targetUrl of linkedPages) {
        if (flowUrls.has(targetUrl)) {
          const linkData = page.links.find((l) => l.href === targetUrl || l.href.startsWith(targetUrl));
          edges.push({
            from: page.url,
            to: targetUrl,
            linkText: linkData?.text ?? "",
          });
        }
      }
    }

    // Also include cross-flow edges (unknown pages linking to flow pages)
    for (const page of pages) {
      if (pageFlowMap.get(page.url) !== "unknown") continue;
      const linkedPages = urlGraph[page.url] ?? [];
      for (const targetUrl of linkedPages) {
        if (flowUrls.has(targetUrl)) {
          const linkData = page.links.find((l) => l.href === targetUrl);
          if (linkData) {
            edges.push({ from: page.url, to: targetUrl, linkText: linkData.text });
          }
        }
      }
    }

    // Assess completeness
    const completeness = assessFlowCompleteness(flowType, flowPages);

    // Identify issues
    const issues = identifyFlowIssues(flowType, flowPages);

    detectedFlows.push({
      type: flowType,
      pages: nodes,
      edges: deduplicateEdges(edges),
      completeness,
      issues,
    });
  }

  return detectedFlows;
}

function assessFlowCompleteness(flowType: FlowType, pages: PageData[]): number {
  const expectedSteps: Record<FlowType, number> = {
    signup: 2, // form + confirmation
    login: 1,
    checkout: 3, // cart + payment + confirmation
    onboarding: 3,
    search: 2, // input + results
    contact: 2, // form + confirmation
    product: 2, // listing + detail
    unknown: 1,
  };

  const expected = expectedSteps[flowType];
  return Math.min(1, pages.length / expected);
}

function identifyFlowIssues(flowType: FlowType, pages: PageData[]): string[] {
  const issues: string[] = [];

  if (flowType === "signup" || flowType === "login") {
    const hasPasswordField = pages.some((p) =>
      p.forms.some((f) => f.fields.some((field) => field.type === "password")),
    );
    if (!hasPasswordField) {
      issues.push("No password field detected in auth flow");
    }

    const unlabeledFields = pages.some((p) =>
      p.forms.some((f) => f.fields.some((field) => !field.hasLabel)),
    );
    if (unlabeledFields) {
      issues.push("Unlabeled form fields in auth flow");
    }
  }

  if (flowType === "checkout") {
    const hasPaymentPage = pages.some((p) =>
      p.forms.some((f) =>
        f.fields.some(
          (field) =>
            field.name.toLowerCase().includes("card") ||
            field.name.toLowerCase().includes("cvv"),
        ),
      ),
    );
    if (!hasPaymentPage && pages.length > 0) {
      issues.push("Payment fields not found in checkout flow");
    }

    const multiStepForms = pages.filter((p) => p.forms.some((f) => f.hasMultiStep));
    if (pages.length === 1 && pages[0].forms[0]?.fields.length > 10) {
      issues.push("Single-page checkout with many fields — consider multi-step");
    }
  }

  if (pages.length > 0 && pages[0].forms.length === 0) {
    issues.push(`No form found on first step of ${flowType} flow`);
  }

  return issues;
}

function deduplicateEdges(edges: FlowEdge[]): FlowEdge[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.from}→${e.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
