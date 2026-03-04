"use client";

import { useState } from "react";
import type { Finding, Severity, AuditCategory } from "@/types/scan";

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string }> = {
  critical: {
    label: "Critical",
    color: "text-red-400",
    bg: "bg-red-950/40",
    border: "border-red-900/50",
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bg: "bg-orange-950/40",
    border: "border-orange-900/50",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-400",
    bg: "bg-yellow-950/40",
    border: "border-yellow-900/50",
  },
  low: {
    label: "Low",
    color: "text-blue-400",
    bg: "bg-blue-950/40",
    border: "border-blue-900/50",
  },
  info: {
    label: "Info",
    color: "text-gray-400",
    bg: "bg-gray-900",
    border: "border-gray-800",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  accessibility: "Accessibility",
  performance: "Performance",
  visual_hierarchy: "Visual Hierarchy",
  navigation: "Navigation",
  forms: "Forms",
  content_quality: "Content",
  mobile: "Mobile",
  cta: "CTA",
};

interface FindingCardProps {
  finding: Finding;
  expanded: boolean;
  onToggle: () => void;
}

function FindingCard({ finding, expanded, onToggle }: FindingCardProps) {
  const config = SEVERITY_CONFIG[finding.severity];

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden`}>
      <button
        type="button"
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-white/5 transition-colors"
        onClick={onToggle}
      >
        <span
          className={`mt-0.5 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${config.color} bg-current/10`}
          style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}
        >
          <span className={config.color}>{config.label}</span>
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200">{finding.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{finding.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-600">
            {finding.affectedPages.length} page{finding.affectedPages.length !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-gray-600 px-1.5 py-0.5 rounded bg-gray-800">
            {CATEGORY_LABELS[finding.category] ?? finding.category}
          </span>
          <svg
            className={`w-4 h-4 text-gray-600 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-white/5">
          {finding.evidence && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Evidence</p>
              <pre className="text-xs text-gray-400 bg-gray-950/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {finding.evidence}
              </pre>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Remediation</p>
            <p className="text-sm text-gray-300">{finding.remediation}</p>
          </div>
          {(finding.wcagRef || finding.heuristicRef) && (
            <div className="flex gap-3 flex-wrap">
              {finding.wcagRef && (
                <span className="text-xs text-blue-400 bg-blue-950/40 border border-blue-900/50 px-2 py-0.5 rounded">
                  {finding.wcagRef}
                </span>
              )}
              {finding.heuristicRef && (
                <span className="text-xs text-purple-400 bg-purple-950/40 border border-purple-900/50 px-2 py-0.5 rounded">
                  {finding.heuristicRef}
                </span>
              )}
            </div>
          )}
          {finding.affectedPages.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">
                Affected Pages ({finding.affectedPages.length})
              </p>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {finding.affectedPages.slice(0, 10).map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-gray-400 hover:text-brand-400 truncate"
                  >
                    {new URL(url).pathname || "/"}
                  </a>
                ))}
                {finding.affectedPages.length > 10 && (
                  <p className="text-xs text-gray-600">
                    +{finding.affectedPages.length - 10} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FindingsListProps {
  findings: Finding[];
}

export function FindingsList({ findings }: FindingsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | "all">("all");

  const filtered = findings.filter((f) => {
    if (severityFilter !== "all" && f.severity !== severityFilter) return false;
    if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
    return true;
  });

  const severityCounts = findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<Severity, number>,
  );

  const categories = [...new Set(findings.map((f) => f.category))];

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-white">
          Findings <span className="text-gray-500 font-normal text-base">({findings.length})</span>
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={() => setSeverityFilter("all")}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            severityFilter === "all"
              ? "bg-gray-700 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          All ({findings.length})
        </button>
        {(["critical", "high", "medium", "low"] as Severity[]).map((sev) => {
          const count = severityCounts[sev] ?? 0;
          if (count === 0) return null;
          const config = SEVERITY_CONFIG[sev];
          return (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                severityFilter === sev ? `${config.bg} ${config.color}` : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {config.label} ({count})
            </button>
          );
        })}
        <div className="ml-2 h-6 w-px bg-gray-700" />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as AuditCategory | "all")}
          className="px-3 py-1 rounded-lg text-xs bg-gray-800 text-gray-400 border border-gray-700 focus:outline-none focus:border-brand-500"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat] ?? cat}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            No findings match the current filter.
          </p>
        ) : (
          filtered.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              expanded={expandedId === finding.id}
              onToggle={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
