# Feature: AI-Powered User Flow Detection

The following plan should be complete. Validate all file contents and line numbers before implementing.
Pay close attention to the existing AI integration pattern in `ai-analyzer.ts` and the scan pipeline order in `scan-engine.ts`.

---

## Feature Description

Replace the rule-based `detectFlows()` function (URL pattern matching + DOM heuristics) with a Claude-powered `detectFlowsWithAI()` function. The AI receives a compact summary of all crawled pages and the navigation graph, then intelligently identifies user flows regardless of URL naming conventions. The result is stored as the same `DetectedFlow[]` type — no downstream changes required. The rule-based detector is kept as a silent fallback when no API key is present or the AI call fails.

## User Story

As a UX auditor scanning any type of website
I want AI to intelligently identify user flows from the crawled page structure
So that flow detection works even for sites without standard URL patterns like `/login` or `/checkout`

## Problem Statement

`src/lib/flow-detector.ts` classifies pages by matching URLs against 7 hardcoded patterns (`/register`, `/login`, `/cart`, etc.) and a narrow DOM check. Any site that doesn't use these exact URL conventions returns `detectedFlows = []`, causing the FlowDiagram to show an empty state. The pattern list is also frozen in time and requires code changes to extend.

## Solution Statement

Introduce `src/lib/ai-flow-detector.ts` with a `detectFlowsWithAI()` function that:
1. Builds a compact page inventory (URL, title, depth, form field types) as a prompt
2. Calls `claude-haiku-4-5-20251001` (fast + cheap) to identify flows and their page memberships
3. Parses the JSON response and hydrates full `DetectedFlow[]` objects (nodes, edges, completeness, issues) using the original page data and `urlGraph`
4. Falls back to the existing rule-based `detectFlows()` if `ANTHROPIC_API_KEY` is unset or the call fails

The scan engine calls `detectFlowsWithAI()` at Step 5, before aggregation, so AI-detected flows feed into both the aggregated scores and the existing `generateAIInsights` prompt.

## Feature Metadata

**Feature Type**: Enhancement (replaces rule-based logic with AI)
**Estimated Complexity**: Medium
**Primary Systems Affected**: `src/lib/ai-flow-detector.ts` (new), `src/lib/scan-engine.ts` (Step 5 swap)
**Dependencies**: `@anthropic-ai/sdk` (already installed), `claude-haiku-4-5-20251001` model

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `src/lib/ai-analyzer.ts` (all, 195 lines) — **master pattern to mirror**; client init (line 4), `client.messages.stream()` call (lines 163–173), error handling + fallback pattern (lines 175–193), `ANTHROPIC_API_KEY` guard pattern
- `src/lib/scan-engine.ts` (lines 106–108) — Step 5 `detectFlows()` call to replace; understand how `detectedFlows` feeds `aggregateScanResults()` at line 128
- `src/lib/flow-detector.ts` (lines 66–150) — **fallback to preserve**; the `detectFlows()` export stays; understand `DetectedFlow` hydration pattern (lines 86–146) for reuse in AI hydration
- `src/types/scan.ts` (lines 169–190) — `FlowNode`, `FlowEdge`, `DetectedFlow`, `FlowType` types. `FlowType` is a string union: `"signup" | "login" | "checkout" | "onboarding" | "search" | "contact" | "product" | "unknown"`
- `src/types/scan.ts` (lines 86–108) — `PageData` fields available for prompt: `url`, `title`, `depth`, `forms`, `links`
- `src/lib/scan-engine.ts` (lines 134–146) — `if (process.env.ANTHROPIC_API_KEY)` guard pattern; mirror exactly for the flow detection step
- `src/lib/flow-detector.ts` (lines 86–118) — `FlowNode` + `FlowEdge` construction from `PageData` — reuse this hydration logic verbatim in `hydrateFlow()`

### New Files to Create

- `src/lib/ai-flow-detector.ts` — AI-powered flow detection with JSON parsing + fallback

### Files to Update

- `src/lib/scan-engine.ts` — replace Step 5 with `detectFlowsWithAI()` call (guarded by API key)

### Patterns to Follow

**Anthropic client pattern** (`ai-analyzer.ts` line 4):
```ts
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env automatically
```

**Non-streaming call** — flow detection doesn't need streaming. Use `client.messages.create()` (not `.stream()`):
```ts
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 1024,
  messages: [{ role: "user", content: prompt }],
});
const text = response.content[0].type === "text" ? response.content[0].text : "";
```

**Error handling + fallback** (`ai-analyzer.ts` lines 175–193):
```ts
try {
  // AI call
} catch (err) {
  console.error("[ai-flow-detector] Error:", err);
  return detectFlows(pages, urlGraph); // rule-based fallback
}
```

**FlowNode hydration** (`flow-detector.ts` lines 86–98) — mirror exactly:
```ts
const nodes: FlowNode[] = flowPages.map((p) => ({
  url: p.url,
  title: p.title,
  flowType,
  depth: p.depth,
  hasForms: p.forms.length > 0,
  hasPaymentFields: p.forms.some((f) =>
    f.fields.some((field) =>
      field.name.toLowerCase().includes("card") || field.name.toLowerCase().includes("cvv"),
    ),
  ),
}));
```

**FlowEdge hydration** (`flow-detector.ts` lines 101–118) — mirror exactly for intra-flow edges.

**Biome formatting** — 2-space indent, double quotes, trailing commas, semicolons, 100 char line width.

---

## IMPLEMENTATION PLAN

### Phase 1: Build `src/lib/ai-flow-detector.ts`

Create the new module with prompt builder, JSON extractor, response hydrator, and main export.

### Phase 2: Update `src/lib/scan-engine.ts`

Swap Step 5 to call `detectFlowsWithAI()` when API key is available; keep rule-based as silent fallback.

---

## STEP-BY-STEP TASKS

### TASK 1 — CREATE `src/lib/ai-flow-detector.ts`

**Complete file structure to implement:**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { DetectedFlow, FlowEdge, FlowNode, FlowType, PageData } from "@/types/scan";
import { detectFlows } from "./flow-detector"; // fallback

const client = new Anthropic();

const VALID_FLOW_TYPES = new Set<FlowType>([
  "signup", "login", "checkout", "onboarding",
  "search", "contact", "product", "unknown",
]);
```

#### Sub-function: `buildFlowDetectionPrompt(pages, urlGraph)`

Build a compact prompt. Keep total prompt under ~1500 tokens for haiku.

Page summary format — one line per page:
```
[depth:{n}] {pathname} | {title truncated to 60 chars} | forms:[{field types joined}]
```

Where:
- pathname = `new URL(page.url).pathname` (fallback to page.url on throw)
- title = `page.title.slice(0, 60)`
- field types = `page.forms.flatMap(f => f.fields.map(fi => fi.type || fi.name)).slice(0, 5).join(",")`; if no forms, omit the `forms:[]` part

Navigation graph summary — list top 25 edges by source URL (pages with most outbound links first):
```
{fromPathname} → {toPathname1}, {toPathname2}
```
Truncate each line to max 120 chars.

Full prompt template:
```
You are analyzing a crawled website at {baseUrl} to identify user flows.
A user flow is a sequence of pages a visitor navigates to complete a task (sign up, log in, buy, contact, etc.).

PAGES ({count} total):
{pageLines}

NAVIGATION LINKS (top connections):
{graphLines}

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

If no flows are identifiable, return an empty array: []
```

#### Sub-function: `extractJsonArray(text)`

Robust JSON extraction from Claude response:
```ts
function extractJsonArray(text: string): unknown[] {
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
```

#### Sub-function: `hydrateFlow(aiFlow, pages, urlGraph)`

Converts AI JSON output → full `DetectedFlow` object.

Input type (internal, not exported):
```ts
interface AIFlowResult {
  type: string;
  pageUrls: string[];
  issues: string[];
}
```

Logic:
1. Validate `type` against `VALID_FLOW_TYPES`; coerce unknown values to `"unknown"`
2. Filter `pageUrls` to only URLs that exist in `pages` array (guard against AI hallucinations)
3. Build `flowPages: PageData[]` — find matching PageData for each valid URL
4. If `flowPages.length === 0`, return `null` (skip this flow)
5. Build `nodes: FlowNode[]` — mirror `flow-detector.ts` lines 86–98 exactly
6. Build `edges: FlowEdge[]` — mirror `flow-detector.ts` lines 101–118 exactly (intra-flow edges from `urlGraph`)
7. Deduplicate edges using a `Set<string>` keyed by `"${from}→${to}"`
8. Compute `completeness` — mirror `flow-detector.ts` assessFlowCompleteness logic:
   ```ts
   const expectedSteps: Record<FlowType, number> = {
     signup: 2, login: 1, checkout: 3, onboarding: 3,
     search: 2, contact: 2, product: 2, unknown: 1,
   };
   const completeness = Math.min(1, flowPages.length / expectedSteps[flowType]);
   ```
9. Use `aiFlow.issues` array (already strings from AI); filter to non-empty strings
10. Return `DetectedFlow`

- **GOTCHA**: AI may return URLs without trailing slashes while `pages` array has them (or vice versa). Normalize by stripping trailing slash from both sides during URL matching: `url.replace(/\/$/, "")`.
- **GOTCHA**: AI may hallucinate URLs not in the crawled set. The filter in step 2 guards this.

#### Main export: `detectFlowsWithAI(pages, urlGraph, onProgress?)`

```ts
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
```

- **GOTCHA**: `client.messages.create()` (not `.stream()`) — flow detection doesn't stream. Returning structured data, not progressive text.
- **GOTCHA**: `onProgress` is optional — scan engine can pass an SSE emitter but it's not required
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 2 — UPDATE `src/lib/scan-engine.ts`: Step 5 swap

Find Step 5 (lines 106–108):
```ts
// ── Step 5: Flow detection ────────────────────────────────────────────────────
const detectedFlows = detectFlows(pages, urlGraph);
```

Replace with:
```ts
// ── Step 5: Flow detection (AI-powered when API key available) ───────────────
const detectedFlows = process.env.ANTHROPIC_API_KEY
  ? await detectFlowsWithAI(pages, urlGraph, (status) => {
      console.log(`[scan-engine] Flow detection: ${status}`);
    })
  : detectFlows(pages, urlGraph);

emitScanEvent(scanId, { event: "audit_complete", category: "flows" });
```

Update the import at the top of the file:
- **REMOVE**: `import { detectFlows } from "./flow-detector";`
- **ADD**: `import { detectFlowsWithAI } from "./ai-flow-detector";`
- **ADD**: `import { detectFlows } from "./flow-detector";` — **keep this import** as it's still used inside `ai-flow-detector.ts` as fallback, BUT in scan-engine we no longer call it directly. Remove it from scan-engine imports.

Actually, since `detectFlows` is no longer called from scan-engine directly (it's called inside `ai-flow-detector.ts`), update scan-engine imports to:
- Remove `import { detectFlows } from "./flow-detector";`
- Add `import { detectFlowsWithAI } from "./ai-flow-detector";`

- **GOTCHA**: `doScan` function is not `async` already? Check: it IS `async` (line 44: `async function doScan`). The `await` keyword is already usable in Step 5.
- **GOTCHA**: The `emitScanEvent` for `audit_complete` with category `"flows"` is NOT a breaking change — the scan-progress UI's `audit_complete` handler adds the category to its `completedAudits[]` set, which is displayed as a checklist. Adding "flows" simply shows an additional completed audit step. The `ScanEvent` type accepts `category: string` (not a strict enum), so no type change needed.
- **VALIDATE**: `npx tsc --noEmit`

---

## TESTING STRATEGY

### Unit Tests

Add `src/lib/ai-flow-detector.test.ts`. Pattern: mirror `src/lib/aggregator.test.ts` structure.

Test `extractJsonArray()`:
- Returns `[]` for empty string
- Parses plain JSON array
- Parses JSON inside a markdown code block
- Returns `[]` for malformed JSON
- Handles JSON with leading/trailing text

Test `hydrateFlow()` (export it for testing if needed, or test indirectly):
- Coerces unknown flow types to "unknown"
- Filters out hallucinated URLs not in pages array
- Returns `null` for flows with no valid pages
- URL normalization: strips trailing slash when matching

Test `detectFlowsWithAI()` integration via mocking Anthropic client:
- Falls back to `detectFlows()` when AI call throws
- Returns empty array for empty pages input

### Edge Cases

1. AI returns valid JSON but with `pageUrls: []` — `hydrateFlow` returns `null`, flow skipped
2. AI returns flow type not in enum (e.g. `"registration"`) — coerce to `"unknown"`
3. AI returns a URL with extra path segments not in pages — normalized URL matching filters it
4. AI call times out (Haiku is fast, but still) — catch block → `detectFlows()` fallback
5. `ANTHROPIC_API_KEY` not set — scan-engine uses `detectFlows()` directly (AI path never reached)
6. Site with 0 pages — early return `[]` guard

---

## VALIDATION COMMANDS

### Level 1: Type Check & Lint
```bash
npx tsc --noEmit
npx biome check src/lib/ai-flow-detector.ts src/lib/scan-engine.ts
```

### Level 2: Unit Tests
```bash
npx vitest run
```

### Level 3: Build
```bash
npm run build
```

### Level 4: Manual Validation

Trigger a scan on a site that previously showed "No flows detected":
```bash
npm run dev
# POST http://localhost:3000/api/scans with { "url": "https://example.com" }
# Watch /scan/{scanId} for the "audit_complete: flows" event
# Check /report/{scanId} — FlowDiagram should now show detected flows
```

Check scan logs for:
- `[ai-flow-detector] Detected N flows via AI`
- No `[ai-flow-detector] AI call failed` errors

Verify fallback:
- Temporarily unset ANTHROPIC_API_KEY or break the API key
- Confirm scan still completes using rule-based fallback (no error, just `[]` if no URL patterns match)

---

## ACCEPTANCE CRITERIA

- [ ] `detectFlowsWithAI()` returns `DetectedFlow[]` (same type as before)
- [ ] Scan of a generic site (blog, marketing) produces non-empty `detectedFlows` via AI
- [ ] Flow nodes correctly reference crawled pages (no hallucinated URLs)
- [ ] Fallback to rule-based `detectFlows()` when API key absent or call fails
- [ ] `emitScanEvent(scanId, { event: "audit_complete", category: "flows" })` fires in scan engine
- [ ] `npx tsc --noEmit` zero errors
- [ ] `npx biome check src/` zero new errors
- [ ] `npm run build` succeeds
- [ ] All existing 19 tests pass
- [ ] FlowDiagram renders AI-detected flows in the report

---

## COMPLETION CHECKLIST

- [ ] Task 1: `ai-flow-detector.ts` created and type-checks clean
- [ ] Task 2: `scan-engine.ts` Step 5 updated
- [ ] Unit tests added and passing
- [ ] Build passes
- [ ] Manual: scan completes with AI flow detection logged
- [ ] Manual: report shows flows for a site that previously showed "No flows detected"

---

## NOTES

### Why `claude-haiku-4-5-20251001` not `claude-opus-4-6`

Flow detection is a structured classification task (identify pages, group by function). Haiku excels at structured output and is ~20x cheaper and faster than Opus. The main `generateAIInsights` call keeps Opus for its long-form reasoning quality. The model ID `claude-haiku-4-5-20251001` is the latest Haiku model per project memory.

### Why a Separate AI Call (not merged with `generateAIInsights`)

The scan pipeline requires `detectedFlows` before `aggregateScanResults()` (Step 6) because the aggregated scan result includes flows. `generateAIInsights()` runs after aggregation (Step 7) and already receives `detectedFlows` in its prompt. Merging would require restructuring the pipeline order. A separate Step 5 call is clean and preserves the existing pipeline.

### Why Keep `flow-detector.ts`

The rule-based detector is: (a) free/instant — no API call needed, (b) the fallback inside `ai-flow-detector.ts` when the AI call fails, (c) still the path taken when `ANTHROPIC_API_KEY` is not set. Do NOT delete it.

### Prompt Token Budget

With 50 pages at ~25 tokens each = ~1250 tokens for page list. Top 25 navigation edges at ~15 tokens each = ~375 tokens. Prompt header/footer ~150 tokens. Total ≈ 1775 tokens input. Haiku's 1024 max_tokens output is sufficient for the JSON array response (50 pages × 30 chars per URL ≈ 1500 chars ≈ 375 tokens for a large response). Well within Haiku's 200K context window.

### URL Normalization

Crawlee may store URLs with or without trailing slashes depending on the site's redirects. Always normalize by calling `.replace(/\/$/, "")` on both the AI-returned URLs and the `pages` array URLs when matching. This prevents "hallucination" false positives from mismatched trailing slashes.

### The `"flows"` Audit Category in `scan-progress.tsx`

The scan progress UI renders an `audit_complete` checklist. Adding `category: "flows"` means a "Flows" step appears in the list. The scan-progress component simply adds any received category to its completion set — no hardcoded category list. No UI changes needed.

---

**Confidence Score**: 8/10 — Main risk is prompt quality (will haiku correctly identify flows?) and JSON parse robustness. Both are mitigated by: (1) the compact prompt format tested against haiku's strengths, (2) the robust `extractJsonArray()` parser with multiple fallback strategies, (3) the rule-based fallback if anything goes wrong.
