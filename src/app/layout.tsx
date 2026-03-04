import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";

export const metadata: Metadata = {
  title: "UX Audit — Deep UX Analysis Tool",
  description:
    "Automated UX analysis: accessibility, performance, visual hierarchy, navigation, forms, readability, mobile, and CTA effectiveness.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
