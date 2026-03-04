"use client";

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import type { Edge, Node, NodeProps } from "@xyflow/react";
import { useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import type { DetectedFlow, FlowType, PageData } from "@/types/scan";
import dagre from "@dagrejs/dagre";

// ── Constants ────────────────────────────────────────────────────────────────

const FLOW_COLORS: Record<FlowType, string> = {
  signup: "#818cf8",
  login: "#60a5fa",
  checkout: "#34d399",
  onboarding: "#f59e0b",
  search: "#a78bfa",
  contact: "#fb923c",
  product: "#38bdf8",
  unknown: "#6b7280",
};

const FLOW_LABELS: Record<FlowType, string> = {
  signup: "Sign Up",
  login: "Log In",
  checkout: "Checkout",
  onboarding: "Onboarding",
  search: "Search",
  contact: "Contact",
  product: "Product",
  unknown: "Other",
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 150;

// ── Custom node type ─────────────────────────────────────────────────────────

type ScreenshotNodeData = Record<string, unknown> & {
  url: string;
  title: string;
  screenshotPath?: string;
  flowType: FlowType;
  hasForms: boolean;
  hasPaymentFields: boolean;
};

// nodeTypes MUST be defined outside any component to prevent ReactFlow flicker
// on re-render. Do not move this inside FlowDiagram or FlowCanvas.

function ScreenshotNode({ data }: NodeProps<Node<ScreenshotNodeData>>) {
  const color = FLOW_COLORS[data.flowType as FlowType] ?? "#6b7280";

  const pathname = (() => {
    try {
      const p = new URL(data.url as string).pathname || "/";
      return p.length > 22 ? `${p.slice(0, 22)}…` : p;
    } catch {
      const u = data.url as string;
      return u.length > 22 ? `${u.slice(0, 22)}…` : u;
    }
  })();

  return (
    <div
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        border: `2px solid ${color}50`,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#1f2937",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color }} />

      {/* Screenshot or placeholder */}
      {data.screenshotPath ? (
        <img
          src={`/api/${data.screenshotPath as string}`}
          alt={data.title as string}
          style={{
            width: "100%",
            height: 90,
            objectFit: "cover",
            objectPosition: "top",
            display: "block",
            flexShrink: 0,
          }}
          loading="lazy"
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: 90,
            backgroundColor: "#374151",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 10, color: "#6b7280" }}>No screenshot</span>
        </div>
      )}

      {/* Info row */}
      <div
        style={{
          padding: "5px 8px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#e5e7eb",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={data.url as string}
          >
            {pathname}
          </span>
          <span style={{ flexShrink: 0, display: "flex", gap: 2 }}>
            {(data.hasForms as boolean) && (
              <span title="Has forms" style={{ fontSize: 10 }}>
                ⬜
              </span>
            )}
            {(data.hasPaymentFields as boolean) && (
              <span title="Has payment fields" style={{ fontSize: 10 }}>
                💳
              </span>
            )}
          </span>
        </div>
        {data.title && (
          <span
            style={{
              fontSize: 10,
              color: "#9ca3af",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {data.title as string}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: color }} />
    </div>
  );
}

const nodeTypes = { screenshotNode: ScreenshotNode };

// ── Layout utility ───────────────────────────────────────────────────────────

function layoutWithDagre(
  nodes: Array<{ id: string }>,
  edges: Array<{ source: string; target: string }>,
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 100, marginx: 20, marginy: 20 });
  for (const n of nodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return new Map(
    nodes.map((n) => {
      const node = g.node(n.id);
      if (!node) return [n.id, { x: 0, y: 0 }];
      return [n.id, { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 }];
    }),
  );
}

// ── Graph builder ────────────────────────────────────────────────────────────

function buildFlowGraph(
  flow: DetectedFlow,
  screenshotMap: Map<string, string | undefined>,
): { nodes: Node<ScreenshotNodeData>[]; edges: Edge[] } {
  const nodeUrlSet = new Set(flow.pages.map((p) => p.url));

  const rfEdges: Edge[] = flow.edges
    .filter((e) => nodeUrlSet.has(e.from) && nodeUrlSet.has(e.to))
    .map((e) => ({
      id: `${e.from}→${e.to}`,
      source: e.from,
      target: e.to,
      label: e.linkText || undefined,
      animated: false,
      style: { stroke: FLOW_COLORS[flow.type], strokeWidth: 1.5 },
    }));

  const rawNodes = flow.pages.map((p) => ({ id: p.url }));
  const positions = layoutWithDagre(
    rawNodes,
    rfEdges.map((e) => ({ source: e.source, target: e.target })),
  );

  const rfNodes: Node<ScreenshotNodeData>[] = flow.pages.map((page) => {
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
        flowType: page.flowType,
        hasForms: page.hasForms,
        hasPaymentFields: page.hasPaymentFields,
      },
    };
  });

  return { nodes: rfNodes, edges: rfEdges };
}

// ── ReactFlow canvas sub-component (isolated state, remountable via key) ─────

interface FlowCanvasProps {
  flow: DetectedFlow;
  screenshotMap: Map<string, string | undefined>;
}

function FlowCanvas({ flow, screenshotMap }: FlowCanvasProps) {
  const rfGraph = useMemo(() => buildFlowGraph(flow, screenshotMap), [flow, screenshotMap]);
  const [nodes, , onNodesChange] = useNodesState(rfGraph.nodes);
  const [edges, , onEdgesChange] = useEdgesState(rfGraph.edges);

  return (
    <div style={{ height: 420 }} className="w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
  );
}

// ── Main exported component ──────────────────────────────────────────────────

interface FlowDiagramProps {
  flows: DetectedFlow[];
  pages: PageData[];
}

export function FlowDiagram({ flows, pages }: FlowDiagramProps) {
  const [activeTab, setActiveTab] = useState(0);

  const screenshotMap = useMemo(
    () => new Map(pages.map((p) => [p.url, p.screenshotPath])),
    [pages],
  );

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

  const safeTab = Math.min(activeTab, flows.length - 1);
  const currentFlow = flows[safeTab];
  const completenessPercent = Math.round(currentFlow.completeness * 100);
  const color = FLOW_COLORS[currentFlow.type];

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white">User Flow Map</h2>
        {flows.length > 1 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {flows.map((flow, i) => (
              <button
                key={flow.type}
                type="button"
                onClick={() => setActiveTab(i)}
                style={
                  safeTab === i
                    ? {
                        backgroundColor: `${FLOW_COLORS[flow.type]}20`,
                        borderColor: FLOW_COLORS[flow.type],
                        color: FLOW_COLORS[flow.type],
                      }
                    : {}
                }
                className="px-3 py-1 rounded-full text-xs border border-gray-700 text-gray-400 transition-colors"
              >
                {FLOW_LABELS[flow.type]} ({flow.pages.length})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Completeness bar */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-gray-800/60">
        <span className="text-xs text-gray-500">Completeness:</span>
        <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${completenessPercent}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-xs" style={{ color }}>
          {completenessPercent}%
        </span>
        <span className="text-xs text-gray-500">{currentFlow.pages.length} pages</span>
        {currentFlow.issues.length > 0 && (
          <span className="text-xs text-orange-400 ml-auto">
            ⚠ {currentFlow.issues.length} issue{currentFlow.issues.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ReactFlow canvas — keyed by flow type to force remount + re-fitView on tab switch */}
      <FlowCanvas key={currentFlow.type} flow={currentFlow} screenshotMap={screenshotMap} />

      {/* Issues list */}
      {currentFlow.issues.length > 0 && (
        <div className="px-6 pb-6 pt-4 border-t border-gray-800/50">
          <div className="pl-4 border-l-2 border-orange-900/50 space-y-1">
            {currentFlow.issues.map((issue, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: issue strings may not be unique
              <p key={i} className="text-xs text-orange-400">
                ⚠ {issue}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
