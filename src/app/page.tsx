import { UrlForm } from "@/components/scan/url-form";
import { getRecentScans } from "@/lib/db";

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "complete":
      return "text-green-400";
    case "running":
      return "text-brand-400";
    case "error":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}

export default function HomePage() {
  let recentScans: ReturnType<typeof getRecentScans> = [];
  try {
    recentScans = getRecentScans(8);
  } catch {
    // DB not initialized yet
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
          Deep UX Analysis
          <br />
          <span className="text-brand-400">in minutes</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
          Enter any URL to get a comprehensive UX audit — accessibility, performance, visual
          hierarchy, navigation, forms, readability, mobile, and CTA effectiveness — with AI-powered
          insights.
        </p>

        <UrlForm />

        {/* Feature grid */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: "♿", label: "Accessibility", desc: "WCAG 2.2 AA via axe-core" },
            { icon: "⚡", label: "Performance", desc: "Core Web Vitals via Lighthouse" },
            { icon: "📐", label: "Visual Hierarchy", desc: "Headings, fonts, contrast" },
            { icon: "🧭", label: "Navigation", desc: "IA depth, orphans, breadcrumbs" },
            { icon: "📝", label: "Forms", desc: "Labels, types, submit text" },
            { icon: "📖", label: "Readability", desc: "Flesch-Kincaid grade level" },
            { icon: "📱", label: "Mobile", desc: "Viewport, touch targets" },
            { icon: "🎯", label: "CTA", desc: "Action verbs, position, count" },
          ].map((feature) => (
            <div
              key={feature.label}
              className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 text-left"
            >
              <div className="text-2xl mb-2">{feature.icon}</div>
              <p className="text-sm font-medium text-gray-200">{feature.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent scans */}
      {recentScans.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pb-20">
          <h2 className="text-lg font-semibold text-gray-300 mb-4">Recent Scans</h2>
          <div className="space-y-2">
            {recentScans.map((scan) => (
              <a
                key={scan.id}
                href={scan.status === "complete" ? `/report/${scan.id}` : `/scan/${scan.id}`}
                className="flex items-center gap-4 p-4 bg-gray-900/60 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{scan.url}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatRelativeTime(scan.created_at)}
                  </p>
                </div>
                <span className={`text-xs font-medium capitalize ${getStatusColor(scan.status)}`}>
                  {scan.status}
                </span>
                {scan.status === "complete" && scan.result_json && (
                  <span className="text-sm font-bold text-white bg-gray-800 px-2 py-1 rounded">
                    {JSON.parse(scan.result_json).overallScore}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
