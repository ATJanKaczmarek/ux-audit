"use client";

import type { DetectedFlow, FlowType } from "@/types/scan";

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

interface FlowMapProps {
  flows: DetectedFlow[];
}

export function FlowMap({ flows }: FlowMapProps) {
  if (flows.length === 0) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">User Flow Map</h2>
        <p className="text-gray-500 text-sm">No user flows detected. This site may not have recognizable flow patterns (signup, checkout, etc.).</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-white mb-6">User Flows Detected</h2>
      <div className="space-y-6">
        {flows.map((flow) => (
          <FlowDiagram key={flow.type} flow={flow} />
        ))}
      </div>
    </div>
  );
}

function FlowDiagram({ flow }: { flow: DetectedFlow }) {
  const color = FLOW_COLORS[flow.type];
  const completenessPercent = Math.round(flow.completeness * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <h3 className="font-medium text-gray-200">{FLOW_LABELS[flow.type]} Flow</h3>
        <span className="text-xs text-gray-500">{flow.pages.length} pages</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">Completeness:</span>
          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${completenessPercent}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-xs" style={{ color }}>
            {completenessPercent}%
          </span>
        </div>
      </div>

      {/* Flow page nodes */}
      <div className="flex flex-wrap items-center gap-1">
        {flow.pages.map((node, i) => {
          const pathname = (() => {
            try {
              return new URL(node.url).pathname || "/";
            } catch {
              return node.url;
            }
          })();
          return (
            <div key={node.url} className="flex items-center gap-1">
              <div
                className="px-3 py-1.5 rounded-lg text-xs font-medium border max-w-[140px] truncate"
                style={{
                  color,
                  borderColor: `${color}30`,
                  backgroundColor: `${color}10`,
                }}
                title={node.url}
              >
                {node.hasForms && (
                  <span className="mr-1 opacity-60">⬜</span>
                )}
                {pathname}
              </div>
              {i < flow.pages.length - 1 && (
                <svg className="w-4 h-4 text-gray-700 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Issues */}
      {flow.issues.length > 0 && (
        <div className="pl-4 border-l-2 border-orange-900/50 space-y-1">
          {flow.issues.map((issue, i) => (
            <p key={i} className="text-xs text-orange-400">
              ⚠ {issue}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
