"use client";

import { useState } from "react";
import type { PageData } from "@/types/scan";

interface PageDetailsProps {
  pages: PageData[];
}

export function PageDetails({ pages }: PageDetailsProps) {
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [showCount, setShowCount] = useState(10);

  const displayed = pages.slice(0, showCount);

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-white mb-5">
        Page Details{" "}
        <span className="text-gray-500 font-normal text-base">({pages.length} pages)</span>
      </h2>

      <div className="space-y-2">
        {displayed.map((page) => {
          const isExpanded = expandedUrl === page.url;
          const pathname = (() => {
            try {
              return new URL(page.url).pathname || "/";
            } catch {
              return page.url;
            }
          })();

          const h1 = page.headings.find((h) => h.level === 1);
          const issueCount =
            (page.headings.filter((h) => h.level === 1).length !== 1 ? 1 : 0) +
            (page.forms.some((f) => f.fields.some((fi) => !fi.hasLabel)) ? 1 : 0) +
            (page.hasHorizontalOverflow ? 1 : 0) +
            (page.touchTargetViolations > 5 ? 1 : 0) +
            (!page.hasViewportMeta ? 1 : 0);

          return (
            <div key={page.url} className="border border-gray-800 rounded-xl overflow-hidden">
              <button
                type="button"
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                onClick={() => setExpandedUrl(isExpanded ? null : page.url)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{pathname}</p>
                  {h1 && (
                    <p className="text-xs text-gray-500 truncate">{h1.text}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {page.screenshotPath && (
                    <div className="w-16 h-10 flex-shrink-0 overflow-hidden rounded border border-gray-800 hidden sm:block">
                      <img
                        src={`/api/${page.screenshotPath}`}
                        alt=""
                        className="w-full h-full object-cover object-top"
                        loading="lazy"
                      />
                    </div>
                  )}
                  {issueCount > 0 && (
                    <span className="text-xs text-orange-400 bg-orange-950/40 border border-orange-900/50 px-2 py-0.5 rounded">
                      {issueCount} issue{issueCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="text-xs text-gray-600">{page.wordCount} words</span>
                  <span className="text-xs text-gray-600">{page.forms.length} form{page.forms.length !== 1 ? "s" : ""}</span>
                  <svg
                    className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-800/50">
                  {/* Screenshot */}
                  {page.screenshotPath && (
                    <div className="pt-3">
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
                        title={`Open ${page.url}`}
                      >
                        <img
                          src={`/api/${page.screenshotPath}`}
                          alt={`Screenshot of ${page.title || pathname}`}
                          className="w-full object-cover object-top max-h-52"
                          loading="lazy"
                        />
                      </a>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                    <Stat label="Headings" value={page.headings.length} />
                    <Stat label="Forms" value={page.forms.length} />
                    <Stat label="CTAs" value={page.ctas.length} />
                    <Stat label="Word Count" value={page.wordCount} />
                  </div>

                  {/* Heading structure */}
                  {page.headings.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">Heading Structure</p>
                      <div className="space-y-0.5">
                        {page.headings.slice(0, 8).map((h, i) => (
                          <div
                            key={i}
                            className="flex items-baseline gap-2"
                            style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                          >
                            <span className="text-xs text-gray-600 font-mono w-6">H{h.level}</span>
                            <span className="text-xs text-gray-400 truncate">{h.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Issues */}
                  <div className="space-y-1">
                    {!page.hasViewportMeta && (
                      <Issue text="Missing viewport meta tag" severity="critical" />
                    )}
                    {page.hasHorizontalOverflow && (
                      <Issue text="Horizontal overflow detected" severity="critical" />
                    )}
                    {page.headings.filter((h) => h.level === 1).length === 0 && (
                      <Issue text="No H1 heading" severity="high" />
                    )}
                    {page.touchTargetViolations > 5 && (
                      <Issue text={`${page.touchTargetViolations} small touch targets`} severity="high" />
                    )}
                    {page.forms.some((f) => f.fields.some((fi) => !fi.hasLabel)) && (
                      <Issue text="Form fields missing labels" severity="medium" />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pages.length > showCount && (
        <button
          type="button"
          onClick={() => setShowCount((n) => n + 10)}
          className="mt-4 w-full py-2 text-sm text-gray-400 hover:text-white border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
        >
          Show {Math.min(10, pages.length - showCount)} more pages
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-2.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function Issue({ text, severity }: { text: string; severity: "critical" | "high" | "medium" }) {
  const colors = {
    critical: "text-red-400",
    high: "text-orange-400",
    medium: "text-yellow-400",
  };
  return (
    <p className={`text-xs ${colors[severity]}`}>
      ● {text}
    </p>
  );
}
