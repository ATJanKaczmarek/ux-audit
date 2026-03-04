import { NextRequest, NextResponse } from "next/server";
import { getScan, getScanResult } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
): Promise<NextResponse> {
  const { scanId } = await params;

  const row = getScan(scanId);
  if (!row) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  if (row.status === "complete") {
    const result = getScanResult(scanId);
    return NextResponse.json({ status: row.status, result });
  }

  return NextResponse.json({
    status: row.status,
    createdAt: row.created_at,
    url: row.url,
  });
}
