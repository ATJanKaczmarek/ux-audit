import fs from "fs";
import path from "path";
import type { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scanId: string; file: string }> },
): Promise<Response> {
  const { scanId, file } = await params;

  // Sanitize: only allow 32-char hex filenames with .jpg extension (MD5 hash pattern)
  if (!/^[a-f0-9]{32}\.jpg$/.test(file)) {
    return new Response("Not Found", { status: 404 });
  }

  // Sanitize: scanId should be a UUID (hex + hyphens only)
  if (!/^[a-f0-9-]{36}$/.test(scanId)) {
    return new Response("Not Found", { status: 404 });
  }

  const filepath = path.join(process.cwd(), "data", "screenshots", scanId, file);

  if (!fs.existsSync(filepath)) {
    return new Response("Not Found", { status: 404 });
  }

  const buffer = fs.readFileSync(filepath);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600, immutable",
      "Content-Length": buffer.length.toString(),
    },
  });
}
