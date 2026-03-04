"use client";

import type { AIInsights } from "@/types/scan";

const IMPACT_COLORS = {
  high: "text-red-400 bg-red-950/40 border-red-900/50",
  medium: "text-yellow-400 bg-yellow-950/40 border-yellow-900/50",
  low: "text-blue-400 bg-blue-950/40 border-blue-900/50",
};

interface AIInsightsPanelProps {
  insights: AIInsights | undefined;
}

export function AIInsightsPanel({ insights }: AIInsightsPanelProps) {
  if (!insights) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">AI Insights</h2>
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">AI insights not available.</p>
          <p className="text-xs mt-1">Set ANTHROPIC_API_KEY to enable Claude-powered analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-brand-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white">AI Insights</h2>
        <span className="text-xs text-gray-500 ml-auto">Claude claude-opus-4-6</span>
      </div>

      {/* Executive Summary */}
      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-3">Executive Summary</h3>
        <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
          {insights.executiveSummary}
        </div>
      </section>

      {/* Top Priorities */}
      {insights.topPriorities.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Top Priorities</h3>
          <div className="space-y-3">
            {insights.topPriorities.map((p, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-800 text-gray-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-200">{p.title}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded border ${IMPACT_COLORS[p.impact]}`}
                    >
                      {p.impact}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{p.rationale}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Flow Commentary */}
      {insights.flowCommentary.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-400 mb-3">User Flow Commentary</h3>
          <div className="space-y-3">
            {insights.flowCommentary.map((fc, i) => (
              <div key={i} className="pl-3 border-l-2 border-brand-800/50">
                <p className="text-xs text-brand-400 font-medium mb-1 capitalize">
                  {fc.flowType} flow
                </p>
                <p className="text-sm text-gray-300 leading-relaxed">{fc.assessment}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Wins */}
      {insights.quickWins.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Wins</h3>
          <ul className="space-y-2">
            {insights.quickWins.map((win, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
                {win}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
