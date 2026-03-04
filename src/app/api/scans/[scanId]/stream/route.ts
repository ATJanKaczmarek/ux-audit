import { getScan } from "@/lib/db";
import { isScanDone, subscribeScan } from "@/lib/scan-store";
import type { ScanEvent } from "@/types/scan";
import type { NextRequest } from "next/server";

function formatSSE(event: ScanEvent): string {
  const data = JSON.stringify(event);
  return `event: ${event.event}\ndata: ${data}\n\n`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
): Promise<Response> {
  const { scanId } = await params;

  // Verify scan exists
  const row = getScan(scanId);
  if (!row) {
    return new Response("Scan not found", { status: 404 });
  }

  // If scan is already complete, send a synthetic complete event
  if (row.status === "complete") {
    const body = formatSSE({ event: "complete", scanId });
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const { bufferedEvents, unsubscribe } = subscribeScan(scanId, (event) => {
        try {
          controller.enqueue(encoder.encode(formatSSE(event)));
          if (event.event === "complete" || event.event === "error") {
            controller.close();
            unsubscribe();
          }
        } catch {
          unsubscribe();
        }
      });

      // Replay buffered events for reconnects
      for (const event of bufferedEvents) {
        controller.enqueue(encoder.encode(formatSSE(event)));
      }

      // If already done (race condition), close
      if (isScanDone(scanId)) {
        controller.close();
        unsubscribe();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
