# Feature: User-Flow Diagramming with Screenshot Nodes

The following plan should be complete, but validate documentation and codebase patterns before implementing.
Pay special attention to naming of existing types, how screenshotPath URLs are constructed, and how ReactFlow CSS is imported in Next.js App Router.

---

## Feature Description

Replace the current linear text-chain `FlowMap` component with an interactive node-graph diagram powered by `@xyflow/react`. Each page node in the diagram renders a screenshot thumbnail, the page pathname, and contextual indicators (forms, payment fields). Flows are tabbed by type (Sign Up / Checkout / etc.). Edges come from the real `FlowEdge[]` data rather than sequential ordering. The diagram is pannable and zoomable, giving auditors a visual walkthrough of each user journey.

## User Story

As a UX auditor reviewing a scan report
I want to see user flows as an interactive graph with screenshot thumbnails per page
So that I can visually trace the user journey through the site and spot drop-off or layout issues at a glance

## Problem Statement

The current `FlowMap` renders pages as a flat, horizontal list of colored text labels. It ignores actual navigation edges (`FlowEdge[]`), shows no visual content per page, and can't represent branching flows. This makes it impossible to understand the real navigation structure from the report alone.

## Solution Statement

Introduce a `FlowDiagram` component that:
1. Uses `@xyflow/react` for a pannable/zoomable canvas with custom nodes
2. Applies `@dagrejs/dagre` for automatic LR graph layout using real `FlowEdge` connections
3. Renders each page node with its screenshot thumbnail, pathname, and indicators
4. Provides tab navigation between detected flow types
5. Accepts the full `pages: PageData[]` array for screenshot path lookups

The screenshot-serving API route (`/api/screenshots/[scanId]/[file]`) already exists and is secure — no changes needed.

## Feature Metadata

**Feature Type**: Enhancement (replaces existing FlowMap component)
**Estimated Complexity**: Medium
**Primary Systems Affected**: `src/components/report/flow-diagram.tsx` (new), `src/app/report/[scanId]/page.tsx` (layout update)
**Dependencies**: `@xyflow/react`, `@dagrejs/dagre`

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

- `src/components/report/flow-map.tsx` (all, 132 lines) — **current implementation to replace**; reuse `FLOW_COLORS` and `FLOW_LABELS` constants exactly; same `FlowMapProps` input shape
- `src/types/scan.ts` (lines 169–190) — `FlowNode`, `FlowEdge`, `DetectedFlow` types; **`FlowEdge.from`/`FlowEdge.to` are full URLs** (not IDs)
- `src/types/scan.ts` (lines 86–108) — `PageData` interface; `screenshotPath` field is `"screenshots/{scanId}/{md5}.jpg"` (relative); accessed at `/api/{screenshotPath}` e.g. `/api/screenshots/abc-123/deadbeef...jpg`
- `src/app/report/[scanId]/page.tsx` (lines 111–133) — layout grid to restructure; currently FlowMap lives in `lg:grid-cols-2` alongside AIInsightsPanel
- `src/app/api/screenshots/[scanId]/[file]/route.ts` (all, 37 lines) — already implemented; validates MD5 filename and UUID scanId; no changes needed
- `src/components/report/page-details.tsx` (lines 56–65, 87–104) — pattern for constructing screenshot `<img src={`/api/${page.screenshotPath}`} />`; mirror exactly
- `package.json` — confirm no existing `@xyflow/react` or `dagre` before adding

### New Files to Create

- `src/components/report/flow-diagram.tsx` — full `FlowDiagram` component with ReactFlow + custom screenshot nodes + dagre layout + tab nav

### Files to Update

- `src/app/report/[scanId]/page.tsx` — swap `FlowMap` → `FlowDiagram` import + update layout (make full-width, pass `pages` prop)
- `package.json` — add `@xyflow/react`, `@dagrejs/dagre`

### Patterns to Follow

**"use client" pattern** — all 5 existing report components use `"use client"` at line 1; do the same.

**Import alias** — project uses `@/` alias. All imports must use `import type { Foo } from "@/types/scan"`.

**Tailwind dark theme** — bg: `bg-gray-900`, border: `border-gray-800`, text: `text-white` / `text-gray-200` / `text-gray-500`. No light mode variants.

**Screenshot img pattern** from `page-details.tsx`:
```tsx
<img
  src={`/api/${page.screenshotPath}`}
  alt={page.title}
  className="w-full object-cover object-top"
  loading="lazy"
/>
```
The `screenshotPath` value already starts with `screenshots/` so the constructed URL is `/api/screenshots/{scanId}/{file}.jpg` which matches the existing route.

**FlowMap color/label constants** (from `flow-map.tsx` lines 5–25) — copy these verbatim into `flow-diagram.tsx`:
```ts
const FLOW_COLORS: Record<FlowType, string> = {
  signup: "#818cf8", login: "#60a5fa", checkout: "#34d399",
  onboarding: "#f59e0b", search: "#a78bfa", contact: "#fb923c",
  product: "#38bdf8", unknown: "#6b7280",
};
const FLOW_LABELS: Record<FlowType, string> = {
  signup: "Sign Up", login: "Log In", checkout: "Checkout",
  onboarding: "Onboarding", search: "Search", contact: "Contact",
  product: "Product", unknown: "Other",
};
```

**Biome formatting** — 2-space indent, double quotes, trailing commas, semicolons, max line width 100. Run `npx biome check --write src/` after each file change.

---

## IMPLEMENTATION PLAN

### Phase 1: Install Dependencies

Add `@xyflow/react` (canvas + node engine) and `@dagrejs/dagre` (auto-layout algorithm) to package.json and install.

### Phase 2: Create FlowDiagram Component

Build `src/components/report/flow-diagram.tsx` with:
- Custom `ScreenshotNode` node type showing screenshot thumbnail + pathname + indicators
- `layoutWithDagre()` utility that computes x/y for nodes using dagre LR layout
- `buildReactFlowGraph()` that transforms `DetectedFlow` + screenshot Map into ReactFlow nodes/edges
- `FlowDiagram` exported component with tab bar (one tab per flow) + ReactFlow canvas per flow
- Graceful empty state matching `FlowMap` empty state style

### Phase 3: Update Report Page Layout

In `src/app/report/[scanId]/page.tsx`:
- Replace `FlowMap` import with `FlowDiagram`
- Move `FlowDiagram` to its own full-width row (below `ScoreOverview`)
- Move `AIInsightsPanel` to full-width row beneath it
- Pass `pages={result.pages}` to `FlowDiagram` alongside `flows={result.detectedFlows}`

---

## STEP-BY-STEP TASKS

### TASK 1 — ADD dependencies to package.json and install

- **IMPLEMENT**: Add `"@xyflow/react": "^12.0.0"` and `"@dagrejs/dagre": "^1.0.4"` to `dependencies` in `package.json`
- **GOTCHA**: `@dagrejs/dagre` v1 includes TypeScript types natively — do NOT install `@types/dagre` separately, it conflicts
- **GOTCHA**: Use `@dagrejs/dagre` NOT the legacy `dagre` package (the legacy package is unmaintained)
- **VALIDATE**: `npm install && npx tsc --noEmit`

---

### TASK 2 — CREATE `src/components/report/flow-diagram.tsx`

#### Full component structure to implement:

```
"use client"

imports:
  - React, useState, useMemo from "react"
  - ReactFlow, Background, Controls, Handle, Position, useNodesState, useEdgesState from "@xyflow/react"
  - import "@xyflow/react/dist/style.css"   ← CRITICAL: must be in this file since it's "use client"
  - dagre from "@dagrejs/dagre"
  - type { DetectedFlow, FlowType, PageData } from "@/types/scan"

constants:
  - FLOW_COLORS (copy from flow-map.tsx verbatim)
  - FLOW_LABELS (copy from flow-map.tsx verbatim)
  - NODE_WIDTH = 180
  - NODE_HEIGHT = 150
```

**Sub-component: `ScreenshotNode`**

This is the custom ReactFlow node type. Structure:
```
┌─ border colored by flow type ─────────────────┐
│  ┌─ screenshot ──────────────────────────────┐ │  (h=90px, object-cover object-top)
│  │  [img src="/api/screenshots/{s}/{f}.jpg"] │ │
│  └───────────────────────────────────────────┘ │
│  /pathname                        [⬜] [💳]    │  (12px truncated pathname + badges)
│  page title (1 line truncated)                 │  (10px text-gray-400)
└───────────────────────────────────────────────┘
```

Implementation details:
- Must accept `data` prop typed as: `{ url: string; title: string; screenshotPath?: string; flowType: FlowType; hasForms: boolean; hasPaymentFields: boolean }`
- Source handle at `Position.Right`, target handle at `Position.Left` (for LR layout)
- Background: `bg-gray-800`, border: `2px solid {FLOW_COLORS[data.flowType]}30` on default, brighter on hover
- Screenshot img: `className="w-full h-[90px] object-cover object-top rounded-t-lg"`, `loading="lazy"`. Render only if `screenshotPath` is truthy. If no screenshot, show placeholder `div` with same dimensions and `bg-gray-700` + an icon or the pathname centered.
- Pathname extraction: `new URL(data.url).pathname || "/"` wrapped in try/catch fallback to `data.url`
- Truncate pathname to max 22 chars with `…` if longer (prevents overflow)
- `⬜` badge if `hasForms`, `💳` badge if `hasPaymentFields` — shown in bottom-right of node
- **GOTCHA**: ReactFlow custom nodes MUST NOT use Tailwind JIT classes for dynamic colors — use inline `style` for border color and background tint derived from `FLOW_COLORS`

**Utility: `layoutWithDagre(nodes, edges, direction = "LR")`**

```ts
function layoutWithDagre(
  nodes: Array<{ id: string }>,
  edges: Array<{ source: string; target: string }>,
): Map<string, { x: number; y: number }>
```

Implementation:
```
const g = new dagre.graphlib.Graph()
g.setDefaultEdgeLabel(() => ({}))
g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 100, marginx: 20, marginy: 20 })
nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
edges.forEach(e => g.setEdge(e.source, e.target))
dagre.layout(g)
return new Map(nodes.map(n => [n.id, { x: g.node(n.id).x - NODE_WIDTH/2, y: g.node(n.id).y - NODE_HEIGHT/2 }]))
```

- **GOTCHA**: `dagre.graphlib.Graph` — import dagre as: `import dagre from "@dagrejs/dagre"`. The default export contains both `dagre.layout` and `dagre.graphlib`.
- **GOTCHA**: If `g.node(n.id)` is undefined (disconnected node), fall back to `{ x: 0, y: 0 }` to avoid crashes

**Utility: `buildFlowGraph(flow, screenshotMap)`**

```ts
function buildFlowGraph(
  flow: DetectedFlow,
  screenshotMap: Map<string, string | undefined>,
): { nodes: RFNode[]; edges: RFEdge[] }
```

- Build ReactFlow nodes from `flow.pages`: each node id = URL
- Node data: spread FlowNode fields + lookup `screenshotMap.get(node.url)`
- Build ReactFlow edges from `flow.edges`: `{ id: \`${e.from}-${e.to}\`, source: e.from, target: e.to, label: e.linkText || undefined, animated: false, style: { stroke: FLOW_COLORS[flow.type], strokeWidth: 1.5 } }`
- Call `layoutWithDagre` and apply positions to nodes
- Return typed `{ nodes, edges }`

**Main exported component: `FlowDiagram`**

Props:
```ts
interface FlowDiagramProps {
  flows: DetectedFlow[];
  pages: PageData[];
}
```

Logic:
1. Build `screenshotMap: Map<string, string | undefined>` from `pages` via `useMemo`: `new Map(pages.map(p => [p.url, p.screenshotPath]))`
2. Active tab state: `const [activeTab, setActiveTab] = useState(0)`
3. Current flow: `flows[activeTab]` (guard for empty flows)
4. `rfGraph = useMemo(() => buildFlowGraph(currentFlow, screenshotMap), [currentFlow, screenshotMap])`
5. `const [nodes, , onNodesChange] = useNodesState(rfGraph.nodes)` — use `useNodesState`/`useEdgesState` for ReactFlow state
6. **GOTCHA**: `useNodesState` initializes only on mount. When `activeTab` changes, you need `useEffect` to call `setNodes(rfGraph.nodes)` and `setEdges(rfGraph.edges)`.

Render structure:
```tsx
<div className="bg-gray-900 rounded-2xl border border-gray-800">
  {/* Header */}
  <div className="px-6 pt-6 pb-4 border-b border-gray-800">
    <h2>User Flow Map</h2>
    {/* Tab bar — only if flows.length > 1 */}
    <div className="flex gap-2 mt-3 flex-wrap">
      {flows.map((flow, i) => (
        <button key={flow.type} onClick={() => setActiveTab(i)}
          style={activeTab === i ? { backgroundColor: `${FLOW_COLORS[flow.type]}20`, borderColor: FLOW_COLORS[flow.type], color: FLOW_COLORS[flow.type] } : {}}
          className="px-3 py-1 rounded-full text-xs border border-gray-700 text-gray-400 transition-colors">
          {FLOW_LABELS[flow.type]} ({flow.pages.length})
        </button>
      ))}
    </div>
  </div>

  {/* Completeness bar + issues */}
  <div className="px-6 py-3 flex items-center gap-4">
    <span>Completeness:</span>
    ... (mirror FlowMap completeness bar pattern from flow-map.tsx lines 66–77)
    {currentFlow.issues.length > 0 && <span>⚠ {currentFlow.issues.length} issues</span>}
  </div>

  {/* ReactFlow canvas */}
  <div style={{ height: 420 }} className="w-full">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}  // defined as const OUTSIDE component: { screenshotNode: ScreenshotNode }
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.3}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#374151" gap={20} />
      <Controls showInteractive={false} className="[&_button]:bg-gray-800 [&_button]:border-gray-700" />
    </ReactFlow>
  </div>

  {/* Issues list */}
  {currentFlow.issues.length > 0 && (
    <div className="px-6 pb-6">... orange warning list ...</div>
  )}
</div>
```

- **CRITICAL GOTCHA**: `nodeTypes` constant MUST be defined OUTSIDE the component function. If defined inside, ReactFlow re-registers on every render causing flicker.
- **GOTCHA**: `proOptions={{ hideAttribution: true }}` removes the ReactFlow watermark (it's fine to use per their license for non-commercial OSS)
- **GOTCHA**: `Background` from `@xyflow/react` requires the parent div to have an explicit `height` — `h-[420px]` or `style={{ height: 420 }}`. Using only Tailwind class may not work consistently due to CSS specificity from their stylesheet.

**Empty state** — if `flows.length === 0`, render matching the existing FlowMap empty state:
```tsx
<div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
  <h2 className="text-lg font-semibold text-white mb-4">User Flow Map</h2>
  <p className="text-gray-500 text-sm">No user flows detected. ...</p>
</div>
```

- **VALIDATE**: `npx biome check src/components/report/flow-diagram.tsx`

---

### TASK 3 — UPDATE `src/app/report/[scanId]/page.tsx`

- **REMOVE** import `{ FlowMap } from "@/components/report/flow-map"`
- **ADD** import `{ FlowDiagram } from "@/components/report/flow-diagram"`
- **RESTRUCTURE** the main content grid (lines 112–130) to:

```tsx
{/* Score overview — full width */}
<ScoreOverview overallScore={result.overallScore} categoryScores={result.categoryScores} />

{/* Flow diagram — full width (needs space for screenshot nodes) */}
<FlowDiagram flows={result.detectedFlows} pages={result.pages} />

{/* AI insights — full width */}
<AIInsightsPanel insights={result.aiInsights} />

{/* Findings list — full width */}
<FindingsList findings={result.findings} />

{/* Page details accordion */}
<PageDetails pages={result.pages} />
```

- **GOTCHA**: The `<div className="space-y-6">` wrapper stays — just reorder children
- **PATTERN**: All other child components remain unchanged; only FlowMap is replaced
- **VALIDATE**: `npx biome check src/app/report/`

---

## TESTING STRATEGY

### Unit Tests

This project uses Vitest (`vitest.config.ts` at root). Tests live alongside source or in `__tests__/` (check existing structure — no test files found during analysis, so likely minimal test infra).

Test targets:
- `layoutWithDagre()` — pure function; test that disconnected nodes don't throw, that 0-node graph returns empty Map, that 2-node graph produces distinct x positions
- `buildFlowGraph()` — test that edges reference valid node IDs, that screenshotMap lookup works, that missing screenshot results in undefined data (not a crash)

### Edge Cases to Handle

1. `flow.edges` contains edges where `from` or `to` URL is NOT in `flow.pages` — dagre will get an unknown node. Guard: only add edges where both endpoints exist in the node set.
2. `flow.pages.length === 1` — single-node flow (no edges). Dagre should still layout correctly (just one positioned node).
3. `screenshotPath` is `undefined` — always possible if screenshot capture failed. Show placeholder div, never throw.
4. Very long pathnames (e.g. `/en/shop/category/product/very-long-slug`) — truncate to 22 chars + `…`
5. `new URL(node.url)` throws for relative URLs or malformed URLs — always wrap in try/catch
6. Tab switching — `useEffect` must fire when `activeTab` changes to re-initialize ReactFlow nodes/edges
7. `flows` prop changes (e.g. server re-render) — `useMemo` dependencies on `flows` and `pages` handle this

---

## VALIDATION COMMANDS

### Level 1: Type Check & Lint
```bash
npx tsc --noEmit
npx biome check src/
```

### Level 2: Unit Tests
```bash
npx vitest run
```

### Level 3: Build Check
```bash
npm run build
```
Watch for: CSS import warnings, missing module errors, bundle size warnings.

### Level 4: Manual Validation

Start dev server:
```bash
npm run dev
```

1. Open a completed scan report at `http://localhost:3000/report/{scanId}`
2. Verify `FlowDiagram` renders (not blank white box)
3. Verify screenshot thumbnails appear in nodes (check Network tab for `/api/screenshots/…` 200 responses)
4. Verify pan/zoom works (drag canvas, scroll to zoom)
5. If multiple flows: verify tab switching updates the graph
6. Test empty state: scan a simple site with no detectable flows, verify empty message renders
7. Check mobile (DevTools 375px) — ReactFlow canvas should still render (may be small but functional)

---

## ACCEPTANCE CRITERIA

- [ ] `FlowDiagram` component renders detected flows as a 2D graph (not linear chain)
- [ ] Each page node shows its screenshot thumbnail (when available)
- [ ] Each page node shows truncated pathname + form/payment indicators
- [ ] Graph edges reflect actual `FlowEdge[]` connections, not just sequential ordering
- [ ] Tab navigation switches between multiple flow types
- [ ] Canvas is pannable and zoomable
- [ ] Completeness bar and issues list preserved from original FlowMap
- [ ] Empty state renders correctly when no flows detected
- [ ] Report page layout updated: FlowDiagram full-width, AIInsightsPanel full-width below it
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npx biome check src/` passes with zero errors
- [ ] `npm run build` completes without errors
- [ ] Screenshot API returns 200 for all node thumbnails (no 404s in Network tab)
- [ ] No console errors in browser

---

## COMPLETION CHECKLIST

- [ ] Task 1: Dependencies installed, `tsc --noEmit` passes
- [ ] Task 2: `flow-diagram.tsx` created, biome clean
- [ ] Task 3: Report page updated, biome clean
- [ ] Full build passes (`npm run build`)
- [ ] Manual validation completed (screenshot thumbnails visible, tabs work)
- [ ] All acceptance criteria met

---

## NOTES

### Why `@xyflow/react` over custom SVG

The `urlGraph` and `FlowEdge[]` data can produce cycles and branches. Manually computing x/y for arbitrary DAGs in React without a layout library is error-prone and becomes unreadable for larger sites. `@xyflow/react` + `dagre` is the established standard for this kind of visualization.

### Why full-width layout

Screenshot thumbnails (180×150px nodes) make the diagram taller and wider than the current text-only FlowMap. The 2-column grid would constrain it to ~50% viewport width, which makes the diagram too small to be useful. Full-width gives the diagram room to breathe.

### `@xyflow/react` CSS Import in Next.js App Router

`import "@xyflow/react/dist/style.css"` in a `"use client"` component works in Next.js 15 App Router. It's processed by the CSS pipeline. Do NOT put it in `layout.tsx` unless you want it to load on all pages.

### Screenshot URL Construction

`PageData.screenshotPath` = `"screenshots/{scanId}/{md5}.jpg"` (no leading slash)
API route = `/api/screenshots/[scanId]/[file]`
Constructed URL = `/api/${page.screenshotPath}` = `/api/screenshots/{scanId}/{md5}.jpg` ✓
This matches the existing route pattern. **Do not prepend an extra `/api/screenshots/` prefix.**

### Dagre Version Note

Use `@dagrejs/dagre` v1.x (the maintained fork). The original `dagre` package (without `@dagrejs/` scope) has been abandoned. They have the same API.

### FlowMap Not Deleted

`flow-map.tsx` is left in place (just no longer imported). It can be deleted in a follow-up cleanup task. Keeping it avoids risk during this implementation.

---

**Confidence Score**: 8/10 — The main risk is ReactFlow CSS loading in Next.js App Router and the useEffect pattern for tab switching. Both have established solutions documented here.
