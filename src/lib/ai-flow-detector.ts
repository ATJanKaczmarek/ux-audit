import type { DetectedFlow, FlowEdge, FlowNode, FlowType, PageData } from "@/types/scan";
import Anthropic from "@anthropic-ai/sdk";
import { detectFlows } from "./flow-detector";

const client = new Anthropic();

const VALID_FLOW_TYPES = new Set<FlowType>([
  "signup",
  "login",
  "checkout",
  "onboarding",
  "search",
  "contact",
  "product",
  "unknown",
]);

export interface AIFlowResult {
  type: string;
  pageUrls: string[];
  issues: string[];
}

function buildFlowDetectionPrompt(pages: PageData[], urlGraph: Record<string, string[]>): string {
  const baseUrl = new URL(pages[0].url).origin;

  const pageLines = pages
    .map((p) => {
      let pathname = p.url;
      try {
        pathname = new URL(p.url).pathname;
      } catch {
        // use p.url
      }

      const title = p.title.slice(0, 60);
      const fieldTypes = p.forms
        .flatMap((f) => f.fields.map((fi) => fi.type || fi.name))
        .slice(0, 5)
        .join(",");

      const formInfo = fieldTypes ? ` | forms:[${fieldTypes}]` : "";
      return `[depth:${p.depth}] ${pathname} | ${title}${formInfo}`;
    })
    .join("\n");

  // Get top 25 edges by source URL (most outbound links first)
  const topEdges = Object.entries(urlGraph)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 25);

  const graphLines = topEdges
    .map(([from, tos]) => {
      try {
        const fromPath = new URL(from).pathname;
        const toPaths = tos
          .map((to) => {
            try {
              return new URL(to).pathname;
            } catch {
              return to;
            }
          })
          .slice(0, 5)
          .join(", ");
        return `${fromPath} → ${toPaths}`.slice(0, 120);
      } catch {
        return `${from} → ${tos.slice(0, 5).join(", ")}`.slice(0, 120);
      }
    })
    .join("\n");

  return `You are analyzing a crawled website at ${baseUrl} to identify user flows.
A user flow is a sequence of pages a visitor navigates to complete a task (sign up, log in, buy, contact, etc.).

PAGES (${pages.length} total):
${pageLines}

NAVIGATION LINKS (top connections):
${graphLines}

Identify distinct user flows. For each flow respond with a JSON array item:
{
  "type": "signup|login|checkout|onboarding|search|contact|product|unknown",
  "pageUrls": ["exact full URLs"],
  "issues": ["brief UX issue string"]
}

Rules:
- Only include pages that clearly belong to a flow (skip generic content/blog pages)
- A page can belong to only one flow (assign to most specific type)
- issues array can be empty []
- Return ONLY the JSON array, no explanation

If no flows are identifiable, return an empty array: []`;
}

export function extractJsonArray(text: string): unknown[] {
  // Try to find JSON array in code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

  // Find first [ and last ]
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hydrateFlow(
  aiFlow: AIFlowResult,
  pages: PageData[],
  urlGraph: Record<string, string[]>,
): DetectedFlow | null {
  // Coerce type
  let flowType = aiFlow.type.toLowerCase() as FlowType;
  if (!VALID_FLOW_TYPES.has(flowType)) {
    flowType = "unknown";
  }

  // Normalize URLs for matching (strip trailing slash)
  const normalize = (url: string) => url.replace(/\/$/, "");

  // Filter valid URLs
  const validFlowPages: PageData[] = [];
  const pageMap = new Map<string, PageData>();
  for (const p of pages) {
    pageMap.set(normalize(p.url), p);
  }

  for (const url of aiFlow.pageUrls) {
    const page = pageMap.get(normalize(url));
    if (page) {
      validFlowPages.push(page);
    }
  }

  if (validFlowPages.length === 0) return null;

  // Build nodes (mirror flow-detector.ts)
  const nodes: FlowNode[] = validFlowPages.map((p) => ({
    url: p.url,
    title: p.title,
    flowType,
    depth: p.depth,
    hasForms: p.forms.length > 0,
    hasPaymentFields: p.forms.some((f) =>
      f.fields.some(
        (field) =>
          field.name.toLowerCase().includes("card") || field.name.toLowerCase().includes("cvv"),
      ),
    ),
  }));

  // Build edges (mirror flow-detector.ts)
  const edges: FlowEdge[] = [];
  const flowUrls = new Set(validFlowPages.map((p) => p.url));

  for (const page of validFlowPages) {
    const linkedPages = urlGraph[page.url] ?? [];
    for (const targetUrl of linkedPages) {
      if (flowUrls.has(targetUrl)) {
        const linkData = page.links.find(
          (l) => l.href === targetUrl || l.href.startsWith(targetUrl),
        );
        edges.push({
          from: page.url,
          to: targetUrl,
          linkText: linkData?.text ?? "",
        });
      }
    }
  }

  // Deduplicate edges
  const seenEdges = new Set<string>();
  const uniqueEdges = edges.filter((e) => {
    const key = `${e.from}→${e.to}`;
    if (seenEdges.has(key)) return false;
    seenEdges.add(key);
    return true;
  });

  // Assess completeness (mirror flow-detector.ts)
  const expectedSteps: Record<FlowType, number> = {
    signup: 2,
    login: 1,
    checkout: 3,
    onboarding: 3,
    search: 2,
    contact: 2,
    product: 2,
    unknown: 1,
  };
  const completeness = Math.min(1, validFlowPages.length / expectedSteps[flowType]);

  return {
    type: flowType,
    pages: nodes,
    edges: uniqueEdges,
    completeness,
    issues: aiFlow.issues.filter((i) => typeof i === "string" && i.length > 0),
  };
}

export async function detectFlowsWithAI(
  pages: PageData[],
  urlGraph: Record<string, string[]>,
  onProgress?: (status: string) => void,
): Promise<DetectedFlow[]> {
  if (pages.length === 0) return [];

  const prompt = buildFlowDetectionPrompt(pages, urlGraph);

  try {
    onProgress?.("Calling AI for flow analysis...");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const rawFlows = extractJsonArray(text);

    const detectedFlows: DetectedFlow[] = [];
    for (const raw of rawFlows) {
      const flow = hydrateFlow(raw as AIFlowResult, pages, urlGraph);
      if (flow) detectedFlows.push(flow);
    }

    console.log(`[ai-flow-detector] Detected ${detectedFlows.length} flows via AI`);
    return detectedFlows;
  } catch (err) {
    console.error("[ai-flow-detector] AI call failed, using rule-based fallback:", err);
    return detectFlows(pages, urlGraph);
  }
}
