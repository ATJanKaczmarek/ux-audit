import { Zap } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950 py-12">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <Link href="/" className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white fill-current" />
            </div>
            <span className="font-semibold text-white tracking-tight">UX Audit</span>
          </Link>
          <p className="text-gray-400 text-sm max-w-sm">
            Deep automated UX analysis for modern product teams. Accessibility, performance, and
            AI-powered insights in one place.
          </p>
        </div>

        <div>
          <h3 className="text-white font-medium mb-4">Product</h3>
          <ul className="space-y-2 text-sm text-gray-500">
            <li>
              <Link href="#features" className="hover:text-brand-400 transition-colors">
                Features
              </Link>
            </li>
            <li>
              <Link href="#how-it-works" className="hover:text-brand-400 transition-colors">
                How it works
              </Link>
            </li>
            <li>
              <Link href="#pricing" className="hover:text-brand-400 transition-colors">
                Pricing
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-white font-medium mb-4">Support</h3>
          <ul className="space-y-2 text-sm text-gray-500">
            <li>
              <a
                href="https://github.com"
                className="hover:text-brand-400 transition-colors"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-brand-400 transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-brand-400 transition-colors">
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-gray-900 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs text-gray-600">
          © {new Date().getFullYear()} UX Audit. All rights reserved.
        </p>
        <p className="text-xs text-gray-600">
          Built with Claude AI & Next.js
        </p>
      </div>
    </footer>
  );
}
