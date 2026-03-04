import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UX Audit — Deep UX Analysis Tool",
  description:
    "Automated UX analysis: accessibility, performance, visual hierarchy, navigation, forms, readability, mobile, and CTA effectiveness.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100">
        <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                </svg>
              </div>
              <span className="font-semibold text-white">UX Audit</span>
            </a>
            <span className="text-gray-500 text-sm ml-auto">Powered by Claude AI</span>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
