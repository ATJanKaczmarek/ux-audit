import { UrlForm } from "@/components/scan/url-form";
import { getRecentScans } from "@/lib/db";
import { 
  Accessibility, 
  ArrowRight,
  BarChart3,
  BookOpen, 
  CheckSquare, 
  Compass, 
  Layout, 
  MousePointer2,
  ShieldCheck,
  Smartphone, 
  Sparkles,
  Target,
  Zap 
} from "lucide-react";
import Link from "next/link";

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

const features = [
  { icon: Accessibility, label: "Accessibility", desc: "WCAG 2.2 AA standards via axe-core analysis." },
  { icon: Zap, label: "Performance", desc: "Core Web Vitals and loading metrics via Lighthouse." },
  { icon: Layout, label: "Visual Hierarchy", desc: "Heading structures, font scaling, and contrast checks." },
  { icon: Compass, label: "Navigation", desc: "IA depth, link health, and structural consistency." },
  { icon: CheckSquare, label: "Forms", desc: "Validation of labels, input types, and submission UX." },
  { icon: BookOpen, label: "Readability", desc: "Flesch-Kincaid and Gunning Fog complexity analysis." },
  { icon: Smartphone, label: "Mobile", desc: "Viewport configuration and touch target optimization." },
  { icon: Target, label: "CTA", desc: "Effectiveness of action verbs and button placement." },
];

export default function HomePage() {
  let recentScans: ReturnType<typeof getRecentScans> = [];
  try {
    recentScans = getRecentScans(5);
  } catch {
    // DB not initialized yet
  }

  return (
    <div className="flex flex-col gap-24 pb-24">
      {/* Hero Section */}
      <section className="relative pt-20 px-4">
        <div className="absolute inset-0 bg-brand-500/5 blur-[120px] rounded-full max-w-3xl mx-auto" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold mb-6">
            <Sparkles className="w-3 h-3" />
            <span>Now with AI-Powered User Flow Detection</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight leading-[1.1]">
            Deep UX Analysis
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-600">
              in minutes.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Automate your UX audits. Get actionable insights on accessibility, performance, and 
            conversion optimization powered by Claude AI.
          </p>

          <div className="max-w-xl mx-auto">
            <UrlForm />
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span>No registration required</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span>Free for public URLs</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="max-w-7xl mx-auto px-4 w-full">
        <p className="text-center text-xs font-semibold text-gray-600 uppercase tracking-widest mb-8">
          Powered by Industry Standards
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-40 grayscale transition-all hover:grayscale-0 hover:opacity-100">
          <span className="text-xl font-bold text-white">Google Lighthouse</span>
          <span className="text-xl font-bold text-white">Axe Core</span>
          <span className="text-xl font-bold text-white">Anthropic Claude</span>
          <span className="text-xl font-bold text-white">Playwright</span>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-4 w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">Comprehensive Audit Suite</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Our engine runs over 150 checks across 8 critical dimensions to give you 
            a 360° view of your product's user experience.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.label}
              className="group bg-gray-900/40 border border-gray-800 p-6 rounded-2xl hover:border-brand-500/50 hover:bg-gray-900/60 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-brand-500/10 transition-colors">
                <feature.icon className="w-6 h-6 text-gray-400 group-hover:text-brand-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.label}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="bg-gray-900/30 py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">How it Works</h2>
              <div className="space-y-8">
                {[
                  { 
                    step: "01", 
                    title: "Submit your URL", 
                    desc: "Enter any public URL. Our crawler will navigate through the site just like a real user." 
                  },
                  { 
                    step: "02", 
                    title: "Deep Automated Scan", 
                    desc: "We run accessibility tests, performance audits, and analyze visual elements in parallel." 
                  },
                  { 
                    step: "03", 
                    title: "AI Analysis", 
                    desc: "Claude AI processes the raw data to identify high-impact friction points and suggests fixes." 
                  }
                ].map((item) => (
                  <div key={item.step} className="flex gap-6">
                    <span className="text-4xl font-bold text-brand-900 shrink-0">{item.step}</span>
                    <div>
                      <h4 className="text-xl font-semibold text-white mb-2">{item.title}</h4>
                      <p className="text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-brand-500/20 blur-3xl rounded-full" />
              <div className="relative bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="space-y-4">
                  <div className="h-4 w-2/3 bg-gray-800 rounded" />
                  <div className="h-4 w-full bg-gray-800 rounded" />
                  <div className="h-32 w-full bg-gray-800/50 rounded-xl border border-gray-700 flex items-center justify-center">
                    <BarChart3 className="w-12 h-12 text-gray-700" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="h-20 bg-brand-500/10 border border-brand-500/20 rounded-lg" />
                    <div className="h-20 bg-gray-800 rounded-lg" />
                    <div className="h-20 bg-gray-800 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing/Beta */}
      <section id="pricing" className="max-w-3xl mx-auto px-4 w-full text-center">
        <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Zap className="w-32 h-32 text-brand-500" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Start Auditing Today</h2>
          <p className="text-gray-400 mb-8">
            We're currently in open beta. All features are free to use while we refine our AI engine.
          </p>
          <div className="bg-brand-500/10 border border-brand-500/20 rounded-2xl p-6 mb-8 inline-block">
            <div className="text-4xl font-bold text-white mb-1">$0</div>
            <div className="text-sm text-brand-400 font-medium">Free during Beta</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/" 
              className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-8 py-3 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
            >
              Analyze your first URL
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 w-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Latest Community Scans</h2>
            <div className="h-px flex-1 bg-gray-800 mx-6 hidden sm:block" />
          </div>
          <div className="grid gap-3">
            {recentScans.map((scan) => (
              <a
                key={scan.id}
                href={scan.status === "complete" ? `/report/${scan.id}` : `/scan/${scan.id}`}
                className="group flex items-center gap-4 p-4 bg-gray-900/40 border border-gray-800 rounded-2xl hover:border-gray-700 hover:bg-gray-900/60 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0 group-hover:bg-gray-700 transition-colors">
                  <MousePointer2 className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{scan.url}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                    {formatRelativeTime(scan.created_at)}
                    <span className="w-1 h-1 rounded-full bg-gray-700" />
                    {new URL(scan.url).hostname}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                    scan.status === 'complete' ? 'border-green-500/20 bg-green-500/10 text-green-400' : 
                    scan.status === 'running' ? 'border-brand-500/20 bg-brand-500/10 text-brand-400' :
                    'border-gray-500/20 bg-gray-500/10 text-gray-400'
                  }`}>
                    {scan.status}
                  </span>
                  {scan.status === "complete" && scan.result_json && (
                    <div className="text-sm font-bold text-white bg-gray-800 w-10 h-10 flex items-center justify-center rounded-lg border border-gray-700">
                      {JSON.parse(scan.result_json).overallScore}
                    </div>
                  )}
                  <ArrowRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 group-hover:translate-x-1 transition-all" />
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
