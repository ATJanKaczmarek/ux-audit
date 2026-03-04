import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { createScan } from "@/lib/db";
import { runScanPipeline } from "@/lib/scan-engine";

const StartScanSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = StartScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { url } = parsed.data;

  // Normalize URL
  let normalizedUrl: string;
  try {
    const u = new URL(url);
    normalizedUrl = u.href;
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const scanId = uuidv4();
  createScan(scanId, normalizedUrl);

  // Start scan pipeline detached from this request
  setTimeout(() => {
    runScanPipeline(scanId, normalizedUrl).catch((err) => {
      console.error("[api/scans] Pipeline error:", err);
    });
  }, 0);

  return NextResponse.json({ scanId }, { status: 202 });
}
