# Feature: Site Map Fallback When No User Flows Detected

The following plan is complete and targeted. Validate exact file contents and line numbers before implementing.

---

## Feature Description

When no specific user flows are detected (signup, login, checkout, etc.), the `FlowDiagram` component currently shows a static "No user flows detected" message. This is unhelpful — the scan has crawled up to 50 pages with screenshots and built a full navigation graph (`urlGraph`). We should display that data as a "Site Map" view instead, giving the auditor a visual overview of the site's page structure even when it lacks recognizable flow patterns.

## User Story

As a UX auditor viewing a scan report for a site without standard flows
I want to see a visual site map showing crawled pages and their connections
So that I get useful structural insight instead of a blank "no flows" message

## Problem Statement

`src/lib/flow-detector.ts` line 76 explicitly skips all pages classified as "unknown":
```ts
if (flowType === "unknown") continue;
```
This means sites without URL patterns matching `/login`, `/signup`, `/cart`, etc. produce an empty `detectedFlows[]` array. The `FlowDiagram` shows its static fallback text and the entire diagram section is wasted space.

## Solution Statement

Add a `buildSiteMapGraph()` utility in `flow-diagram.tsx` that consumes `urlGraph` and `pages` to construct a "Site Map" ReactFlow graph capped at 15 nodes. When `detectedFlows.length === 0`, render this fallback graph (labeled "Site Map") instead of the empty message. The `FlowDiagram` component accepts a new `urlGraph` prop; the report page passes `result.urlGraph`.

No changes to `flow-detector.ts`, `scan.ts` types, or the database are needed.

## Feature Metadata

**Feature Type**: Bug Fix / Enhancement
**Estimated Complexity**: Low
**Primary Systems Affected**: `src/components/report/flow-diagram.tsx`, `src/app/report/[scanId]/page.tsx`
**Dependencies**: None (reuses existing `@xyflow/react`, `@dagrejs/dagre`, `ScreenshotNode`, `layoutWithDagre`)

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `src/components/report/flow-diagram.tsx` (all, 384 lines) — **file to modify**; understand `FlowDiagramProps`, `buildFlowGraph()`, `FlowCanvas`, and the empty state at line 298–308
- `src/app/report/[scanId]/page.tsx` (line 117) — **file to modify**; where `FlowDiagram` is called; `result.urlGraph` is available from `getScanResult(scanId)` which returns `ScanResult`
- `src/types/scan.ts` (lines 210–228) — `ScanResult` interface; confirms `urlGraph: Record<string, string[]>` is a top-level field
- `src/lib/flow-detector.ts` (lines 66–81, 104–132) — **root cause**: "unknown" pages filtered at line 76; `urlGraph` edge-building pattern to mirror at lines 104–132
- `src/types/scan.ts` (lines 86–108) — `PageData` interface; `depth: number` and `links: LinkData[]` fields used for page ranking

### New Files to Create

None.

### Files to Update

- `src/components/report/flow-diagram.tsx` — add `urlGraph` prop + `buildSiteMapGraph()` utility + update empty-state logic
- `src/app/report/[scanId]/page.tsx` — pass `urlGraph={result.urlGraph}` to `FlowDiagram`

### Patterns to Follow

**`buildFlowGraph()` pattern** (`flow-diagram.tsx` lines 203–246) — `buildSiteMapGraph()` must return the same `{ nodes: Node<ScreenshotNodeData>[]; edges: Edge[] }` shape so it drops directly into the existing `FlowCanvas` component.

**Page selection for site map** — to keep the graph readable, cap at **15 pages** using this sort order:
1. Sort pages by `depth` ascending (shallowest = closest to root)
2. Within same depth, sort by number of outbound links in `urlGraph[page.url]?.length` descending (more connected = more important)
3. Take first 15

**Edge filtering** — only include edges between the 15 selected pages (same guard as `buildFlowGraph` line 210: `nodeUrlSet.has(e.from) && nodeUrlSet.has(e.to)`).

**Node color** — use `FLOW_COLORS.unknown` (`"#6b7280"`) for all site-map nodes. Reuse `ScreenshotNodeData.flowType = "unknown"`.

**Biome formatting** — 2-space indent, double quotes, trailing commas, semicolons, 100 char line width. Run `npx biome check src/` after.

---

## IMPLEMENTATION PLAN

### Phase 1: Add `urlGraph` prop + `buildSiteMapGraph()` utility

Extend `FlowDiagramProps` with `urlGraph` and add the fallback graph builder.

### Phase 2: Update empty-state rendering

Replace the static "No user flows detected" JSX with a `FlowCanvas` call using the site map graph + a "Site Map" header label.

### Phase 3: Pass `urlGraph` from report page

One-line prop addition in `src/app/report/[scanId]/page.tsx`.

---

## STEP-BY-STEP TASKS

### TASK 1 — UPDATE `src/components/report/flow-diagram.tsx`: add `urlGraph` prop to `FlowDiagramProps`

**File location**: `flow-diagram.tsx` lines 285–288 (the `FlowDiagramProps` interface)

Current:
```ts
interface FlowDiagramProps {
  flows: DetectedFlow[];
  pages: PageData[];
}
```

Change to:
```ts
interface FlowDiagramProps {
  flows: DetectedFlow[];
  pages: PageData[];
  urlGraph: Record<string, string[]>;
}
```

- **GOTCHA**: Update the destructured props in the `FlowDiagram` function signature to include `urlGraph`
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 2 — UPDATE `src/components/report/flow-diagram.tsx`: add `buildSiteMapGraph()` utility

Add this function immediately AFTER `buildFlowGraph()` (after line 246). It must return the identical shape.

```ts
function buildSiteMapGraph(
  pages: PageData[],
  urlGraph: Record<string, string[]>,
  screenshotMap: Map<string, string | undefined>,
): { nodes: Node<ScreenshotNodeData>[]; edges: Edge[] } {
  // Select up to 15 most representative pages:
  // sort by depth asc, then outbound link count desc
  const ranked = [...pages].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    const aLinks = urlGraph[a.url]?.length ?? 0;
    const bLinks = urlGraph[b.url]?.length ?? 0;
    return bLinks - aLinks;
  });
  const selected = ranked.slice(0, 15);
  const selectedUrls = new Set(selected.map((p) => p.url));

  // Build edges: only between selected pages
  const rfEdges: Edge[] = [];
  const seenEdges = new Set<string>();
  for (const page of selected) {
    const targets = urlGraph[page.url] ?? [];
    for (const targetUrl of targets) {
      if (!selectedUrls.has(targetUrl)) continue;
      const key = `${page.url}→${targetUrl}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      rfEdges.push({
        id: key,
        source: page.url,
        target: targetUrl,
        animated: false,
        style: { stroke: FLOW_COLORS.unknown, strokeWidth: 1.5 },
      });
    }
  }

  const rawNodes = selected.map((p) => ({ id: p.url }));
  const positions = layoutWithDagre(
    rawNodes,
    rfEdges.map((e) => ({ source: e.source, target: e.target })),
  );

  const rfNodes: Node<ScreenshotNodeData>[] = selected.map((page) => {
    const pos = positions.get(page.url) ?? { x: 0, y: 0 };
    return {
      id: page.url,
      type: "screenshotNode",
      position: pos,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: {
        url: page.url,
        title: page.title,
        screenshotPath: screenshotMap.get(page.url),
        flowType: "unknown" as FlowType,
        hasForms: page.forms.length > 0,
        hasPaymentFields: false,
      },
    };
  });

  return { nodes: rfNodes, edges: rfEdges };
}
```

- **IMPORTS**: `PageData` is already imported. No new imports needed.
- **GOTCHA**: `urlGraph[page.url]` can be `undefined` for pages with no outbound links — always use `?? []` fallback
- **GOTCHA**: Edges can still be duplicated if two pages both link to each other — use the `seenEdges` Set to deduplicate
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 3 — UPDATE `src/components/report/flow-diagram.tsx`: replace empty-state with site map

Find the empty-state block in `FlowDiagram` (currently at lines 298–308):

```tsx
if (flows.length === 0) {
  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-white mb-4">User Flow Map</h2>
      <p className="text-gray-500 text-sm">
        No user flows detected. This site may not have recognizable flow patterns (signup,
        checkout, etc.).
      </p>
    </div>
  );
}
```

Replace with a site map rendering that reuses `FlowCanvas`:

```tsx
if (flows.length === 0) {
  const siteMapGraph = buildSiteMapGraph(pages, urlGraph, screenshotMap);
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white">Site Map</h2>
        <p className="text-xs text-gray-500 mt-1">
          No recognizable flows detected — showing top {siteMapGraph.nodes.length} pages by
          navigation depth.
        </p>
      </div>
      <div style={{ height: 420 }} className="w-full">
        <ReactFlow
          nodes={siteMapGraph.nodes}
          edges={siteMapGraph.edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#374151" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
```

- **GOTCHA**: The `siteMapGraph` computation runs inside the component function BUT after all hooks (`useState`, `useMemo`) are declared. All hooks must remain at the top of the component. Do NOT call `buildSiteMapGraph()` before the hooks — only after them. The `if (flows.length === 0)` return is already after the hooks block, so just ensure the `screenshotMap` memo is declared before this block.
- **GOTCHA**: `ReactFlow` is already imported at the top of the file. `Background` and `Controls` are already imported. No new imports needed for this block.
- **GOTCHA**: Do NOT use `FlowCanvas` here because `FlowCanvas` has its own `useNodesState`/`useEdgesState`. For a static site map where we don't need node change tracking, render `ReactFlow` directly with static `nodes`/`edges` from `siteMapGraph`. This avoids adding another layer of React state for a read-only graph.
- **VALIDATE**: `npx tsc --noEmit`

---

### TASK 4 — UPDATE `src/app/report/[scanId]/page.tsx`: pass `urlGraph` prop

Find line 117:
```tsx
<FlowDiagram flows={result.detectedFlows} pages={result.pages} />
```

Change to:
```tsx
<FlowDiagram flows={result.detectedFlows} pages={result.pages} urlGraph={result.urlGraph} />
```

- **PATTERN**: `result.urlGraph` is available on `ScanResult` (types/scan.ts line ~220); `result` is already typed as `ScanResult` via `getScanResult(scanId)`
- **VALIDATE**: `npx biome check src/app/ && npx tsc --noEmit`

---

## TESTING STRATEGY

### Unit Tests

Test `buildSiteMapGraph()` as a pure function:
- Empty `pages` + empty `urlGraph` → returns `{ nodes: [], edges: [] }` without throwing
- 20 pages input → returns at most 15 nodes
- Edges only reference node IDs in the selected set (no dangling edges)
- Pages sorted shallower first (depth=0 pages appear before depth=2)
- Duplicate bidirectional edges are deduplicated

Project test framework: Vitest. Example test file pattern: `src/lib/aggregator.test.ts`.

### Edge Cases to Handle

1. `pages` array is empty (scan with 0 pages) — `ranked.slice(0, 15)` returns `[]`, `rfNodes` is `[]`, ReactFlow renders empty canvas — OK
2. `urlGraph` is `{}` (no edges) — `rfEdges` stays `[]`, nodes render without connections — OK
3. `pages.length <= 15` — all pages selected, no truncation needed — OK
4. Page in `urlGraph` has a target URL that is NOT in `pages` array — `selectedUrls.has(targetUrl)` guard catches this — OK
5. Site with exactly 1 page — single node, no edges, dagre positions it at origin — OK

---

## VALIDATION COMMANDS

### Level 1: Type Check & Lint
```bash
npx tsc --noEmit
npx biome check src/components/report/flow-diagram.tsx
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

```bash
npm run dev
```

1. Open a completed scan for a simple site (blog, portfolio, marketing page) that shows "No flows" — verify the "Site Map" graph now renders with screenshot nodes
2. Verify pan/zoom still works on the site map canvas
3. Open a scan WITH detected flows — verify those still render correctly (no regression)
4. Confirm `siteMapGraph.nodes.length` in the subtitle matches actual node count (max 15)

---

## ACCEPTANCE CRITERIA

- [ ] `FlowDiagram` with `flows=[]` renders a "Site Map" graph instead of empty text
- [ ] Site map shows up to 15 pages, shallowest depth first
- [ ] Each node shows screenshot thumbnail (when available)
- [ ] Edges reflect actual `urlGraph` connections between selected pages
- [ ] Scans WITH detected flows still render the flow diagram correctly (no regression)
- [ ] `npx tsc --noEmit` zero errors
- [ ] `npx biome check src/` zero new errors
- [ ] `npm run build` succeeds
- [ ] All 19 existing tests pass

---

## COMPLETION CHECKLIST

- [ ] Task 1: `urlGraph` prop added to interface + function signature
- [ ] Task 2: `buildSiteMapGraph()` implemented after `buildFlowGraph()`
- [ ] Task 3: Empty-state block replaced with site map rendering
- [ ] Task 4: Report page passes `urlGraph` prop
- [ ] Build passes
- [ ] Manual: site map renders for "no flows" scans
- [ ] Manual: flow diagram still works for scans with detected flows

---

## NOTES

### Why Not Change `flow-detector.ts`

The flow detector produces structured `DetectedFlow` objects specifically for *recognized user journeys* (signup, login, checkout). Adding generic "site map" data to that output would mix two different concepts. The site map is a presentation concern, not a UX flow concern. Keeping it in the diagram component preserves this separation.

### Why Cap at 15 Nodes

With 50 pages at NODE_WIDTH=180, NODE_HEIGHT=150 in dagre LR layout, the graph would need ~3000px width and be effectively unusable. 15 nodes produces a diagram that fits in ~2–3 ranks of 5 nodes each, comfortably visible in the 420px canvas height.

### Why Not Use `FlowCanvas` for the Site Map

`FlowCanvas` manages its own `useNodesState`/`useEdgesState` hooks and expects to be remountable via `key`. For the static site map rendered inside the `if (flows.length === 0)` branch, we compute the graph once from `pages`+`urlGraph` and render it directly. No state management needed since the data is immutable (derived from scan result). Using `FlowCanvas` would add unnecessary React state overhead.

### `screenshotMap` Position

`screenshotMap` is built with `useMemo` at the top of `FlowDiagram`, before the `if (flows.length === 0)` early return. This is correct — hooks come first, then conditional returns. The site map branch uses `screenshotMap` which is already computed.

---

**Confidence Score**: 9/10 — Small targeted change, all patterns already established in the codebase. Main risk is accidentally calling `buildSiteMapGraph` before the hooks, but the plan is explicit about hook ordering.
