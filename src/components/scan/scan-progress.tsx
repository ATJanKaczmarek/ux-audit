"use client";

import type { ScanEvent } from "@/types/scan";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface ProgressState {
  phase: "crawling" | "analyzing" | "lighthouse" | "auditing" | "ai" | "complete" | "error";
  crawlCurrent: number;
  crawlTotal: number;
  pagesAnalyzed: number;
  totalPages: number;
  lighthouseIndex: number;
  lighthouseTotal: number;
  completedAudits: string[];
  aiChunks: string[];
  error?: string;
  lastUrl?: string;
}

const AUDIT_LABELS: Record<string, string> = {
  accessibility: "Accessibility (axe-core)",
  performance: "Performance (Lighthouse)",
  visual_hierarchy: "Visual Hierarchy",
  navigation: "Navigation & IA",
  forms: "Forms",
  content_quality: "Content Quality",
  mobile: "Mobile",
  cta: "CTA Effectiveness",
};

const ALL_AUDITS = Object.keys(AUDIT_LABELS);

export function ScanProgress({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ProgressState>({
    phase: "crawling",
    crawlCurrent: 0,
    crawlTotal: 0,
    pagesAnalyzed: 0,
    totalPages: 0,
    lighthouseIndex: 0,
    lighthouseTotal: 0,
    completedAudits: [],
    aiChunks: [],
  });
  const esRef = useRef<EventSource | null>(null);
  const aiTextRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/scans/${scanId}/stream`);
    esRef.current = es;

    function handleEvent(e: MessageEvent, eventType: string) {
      try {
        const data = JSON.parse(e.data) as ScanEvent;
        setState((prev) => {
          const next = { ...prev };

          switch (data.event) {
            case "crawl_start":
              next.phase = "crawling";
              next.crawlTotal = data.total;
              break;
            case "crawl_progress":
              next.phase = "crawling";
              next.crawlCurrent = data.current;
              next.crawlTotal = data.total;
              next.lastUrl = data.url;
              break;
            case "page_analyzed":
              next.phase = "analyzing";
              next.pagesAnalyzed = data.index;
              next.totalPages = data.total;
              next.lastUrl = data.url;
              break;
            case "lighthouse_progress":
              next.phase = "lighthouse";
              next.lighthouseIndex = data.index;
              next.lighthouseTotal = data.total;
              break;
            case "audit_complete":
              next.phase = "auditing";
              next.completedAudits = [...prev.completedAudits, data.category];
              break;
            case "ai_progress":
              next.phase = "ai";
              next.aiChunks = [...prev.aiChunks, data.chunk];
              break;
            case "complete":
              next.phase = "complete";
              break;
            case "error":
              next.phase = "error";
              next.error = data.message;
              break;
          }

          return next;
        });

        if (eventType === "complete") {
          es.close();
          setTimeout(() => router.push(`/report/${scanId}`), 1000);
        }
        if (eventType === "error") {
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    }

    const eventTypes = [
      "crawl_start",
      "crawl_progress",
      "page_analyzed",
      "lighthouse_progress",
      "audit_complete",
      "ai_progress",
      "complete",
      "error",
    ];

    for (const type of eventTypes) {
      es.addEventListener(type, (e) => handleEvent(e, type));
    }

    es.onerror = () => {
      // Reconnect will be handled by browser automatically
    };

    return () => {
      es.close();
    };
  }, [scanId, router]);

  // Scroll AI text into view
  useEffect(() => {
    if (aiTextRef.current && state.aiChunks.length > 0) {
      aiTextRef.current.scrollTop = aiTextRef.current.scrollHeight;
    }
  }, [state.aiChunks]);

  const aiText = state.aiChunks.join("");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Phase indicator */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <PhaseSteps state={state} />
      </div>

      {/* Crawl progress */}
      {(state.phase === "crawling" || state.crawlCurrent > 0) && (
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Crawling</h3>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all duration-300 rounded-full"
              style={{
                width:
                  state.crawlTotal > 0
                    ? `${(state.crawlCurrent / state.crawlTotal) * 100}%`
                    : "10%",
              }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 truncate">
            {state.lastUrl ?? "Starting crawl..."}
          </p>
          <p className="text-xs text-gray-400">
            {state.crawlCurrent} / {state.crawlTotal || "?"} pages
          </p>
        </div>
      )}

      {/* Audit checklist */}
      {state.completedAudits.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Audit Modules</h3>
          <div className="space-y-2">
            {ALL_AUDITS.map((audit) => {
              const done = state.completedAudits.includes(audit);
              const running =
                !done &&
                ((audit === "accessibility" && state.phase === "analyzing") ||
                  (audit === "performance" && state.phase === "lighthouse") ||
                  (state.phase === "auditing" && !state.completedAudits.includes(audit)));
              return (
                <div key={audit} className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      done
                        ? "bg-green-500/20 text-green-400"
                        : running
                          ? "bg-brand-500/20 text-brand-400"
                          : "bg-gray-800 text-gray-600"
                    }`}
                  >
                    {done ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        />
                      </svg>
                    ) : running ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                    )}
                  </div>
                  <span
                    className={`text-sm ${done ? "text-gray-300" : running ? "text-brand-300" : "text-gray-600"}`}
                  >
                    {AUDIT_LABELS[audit] ?? audit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI insights streaming */}
      {state.phase === "ai" && aiText && (
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500 progress-pulse" />
            Generating AI Insights...
          </h3>
          <div
            ref={aiTextRef}
            className="max-h-48 overflow-y-auto text-sm text-gray-300 font-mono whitespace-pre-wrap"
          >
            {aiText}
          </div>
        </div>
      )}

      {/* Error */}
      {state.phase === "error" && (
        <div className="bg-red-950/50 border border-red-900 rounded-2xl p-5">
          <p className="text-red-400 font-medium">Scan failed</p>
          <p className="text-red-300 text-sm mt-1">{state.error}</p>
          <a href="/" className="mt-3 inline-block text-sm text-brand-400 hover:text-brand-300">
            ← Try again
          </a>
        </div>
      )}

      {/* Complete */}
      {state.phase === "complete" && (
        <div className="bg-green-950/50 border border-green-900 rounded-2xl p-5 text-center">
          <p className="text-green-400 font-medium">Scan complete! Redirecting to report...</p>
        </div>
      )}
    </div>
  );
}

function PhaseSteps({ state }: { state: ProgressState }) {
  const phases = [
    { key: "crawl", label: "Crawl", done: state.crawlCurrent > 0 && state.phase !== "crawling" },
    { key: "audit", label: "Audit", done: state.completedAudits.length === ALL_AUDITS.length },
    { key: "ai", label: "AI Analysis", done: state.phase === "complete" },
  ];

  const activeIndex =
    state.phase === "crawling"
      ? 0
      : state.phase === "analyzing" || state.phase === "lighthouse" || state.phase === "auditing"
        ? 1
        : 2;

  return (
    <div className="flex items-center gap-0">
      {phases.map((phase, i) => (
        <div key={phase.key} className="flex items-center flex-1">
          <div
            className={`flex flex-col items-center gap-1 flex-shrink-0 ${
              phase.done ? "text-green-400" : i === activeIndex ? "text-brand-400" : "text-gray-600"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                phase.done
                  ? "border-green-500 bg-green-500/20"
                  : i === activeIndex
                    ? "border-brand-500 bg-brand-500/20"
                    : "border-gray-700 bg-gray-800"
              }`}
            >
              {phase.done ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  />
                </svg>
              ) : i === activeIndex ? (
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500 progress-pulse" />
              ) : (
                <span className="text-xs text-gray-500">{i + 1}</span>
              )}
            </div>
            <span className="text-xs font-medium">{phase.label}</span>
          </div>
          {i < phases.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 -mt-5 ${phase.done ? "bg-green-700" : "bg-gray-800"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
