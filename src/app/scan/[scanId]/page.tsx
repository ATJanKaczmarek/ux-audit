import { notFound } from "next/navigation";
import { ScanProgress } from "@/components/scan/scan-progress";
import { getScan } from "@/lib/db";

interface Props {
  params: Promise<{ scanId: string }>;
}

export default async function ScanPage({ params }: Props) {
  const { scanId } = await params;

  let row;
  try {
    row = getScan(scanId);
  } catch {
    row = null;
  }

  if (!row) notFound();

  // If already complete, redirect
  if (row.status === "complete") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-400 mb-4">Scan complete. Redirecting...</p>
        <a href={`/report/${scanId}`} className="text-brand-400 hover:text-brand-300">
          View Report →
        </a>
        <meta httpEquiv="refresh" content={`0;url=/report/${scanId}`} />
      </div>
    );
  }

  const hostname = (() => {
    try {
      return new URL(row.url).hostname;
    } catch {
      return row.url;
    }
  })();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-sm text-gray-500 mb-2">Analyzing</p>
        <h1 className="text-2xl font-bold text-white">{hostname}</h1>
        <p className="text-sm text-gray-600 mt-1 truncate">{row.url}</p>
      </div>

      <ScanProgress scanId={scanId} />
    </div>
  );
}
