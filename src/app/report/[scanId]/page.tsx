import { AIInsightsPanel } from "@/components/report/ai-insights-panel";
import { FindingsList } from "@/components/report/findings-list";
import { FlowDiagram } from "@/components/report/flow-diagram";
import { PageDetails } from "@/components/report/page-details";
import { ScoreOverview } from "@/components/report/score-overview";
import { getScan, getScanResult } from "@/lib/db";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ scanId: string }>;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export default async function ReportPage({ params }: Props) {
  const { scanId } = await params;

  let row;
  try {
    row = getScan(scanId);
  } catch {
    row = null;
  }

  if (!row) notFound();

  if (row.status !== "complete") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-400 mb-4">Scan is {row.status}...</p>
        <a href={`/scan/${scanId}`} className="text-brand-400 hover:text-brand-300">
          View Progress →
        </a>
      </div>
    );
  }

  const result = getScanResult(scanId);
  if (!result) notFound();

  const hostname = (() => {
    try {
      return new URL(result.url).hostname;
    } catch {
      return result.url;
    }
  })();

  const duration = result.completedAt
    ? formatDuration(result.completedAt - result.createdAt)
    : formatDuration(result.crawlDuration);

  const criticalCount = result.findings.filter((f) => f.severity === "critical").length;
  const highCount = result.findings.filter((f) => f.severity === "high").length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a href="/" className="text-xs text-gray-500 hover:text-gray-300">
              ← New Scan
            </a>
          </div>
          <h1 className="text-2xl font-bold text-white">{hostname}</h1>
          <p className="text-sm text-gray-500 truncate max-w-lg">{result.url}</p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-xs text-gray-500">Pages Analyzed</p>
            <p className="text-xl font-bold text-white">{result.totalPagesAnalyzed}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Findings</p>
            <p className="text-xl font-bold text-white">{result.findings.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Duration</p>
            <p className="text-xl font-bold text-white">{duration}</p>
          </div>
        </div>
      </div>

      {/* Severity summary strip */}
      {(criticalCount > 0 || highCount > 0) && (
        <div className="mb-6 flex items-center gap-3 p-3 bg-red-950/30 border border-red-900/50 rounded-xl">
          <svg
            className="w-4 h-4 text-red-400 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            />
          </svg>
          <p className="text-sm text-red-300">
            {criticalCount > 0 && <span className="font-semibold">{criticalCount} critical</span>}
            {criticalCount > 0 && highCount > 0 && " and "}
            {highCount > 0 && <span className="font-semibold">{highCount} high</span>} severity
            issue{criticalCount + highCount !== 1 ? "s" : ""} require immediate attention.
          </p>
        </div>
      )}

      {/* Main content grid */}
      <div className="space-y-6">
        {/* Score overview — full width */}
        <ScoreOverview overallScore={result.overallScore} categoryScores={result.categoryScores} />

        {/* Flow diagram — full width */}
        <FlowDiagram flows={result.detectedFlows} pages={result.pages} />

        {/* AI insights — full width */}
        <AIInsightsPanel insights={result.aiInsights} />

        {/* Findings list — full width */}
        <FindingsList findings={result.findings} />

        {/* Page details accordion */}
        <PageDetails pages={result.pages} />
      </div>
    </div>
  );
}
