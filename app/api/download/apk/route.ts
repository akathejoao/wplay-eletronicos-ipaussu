import { NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

export const runtime = "nodejs";

const filePath = path.join(process.cwd(), "public", "downloads", "wplay-app.apk");

async function download(headOnly: boolean) {
  try {
    const file = await stat(filePath);
    if (!file.isFile() || file.size === 0) throw new Error("APK unavailable");
    const headers = {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="WPlay-Eletronicos.apk"',
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    };
    if (headOnly) return new NextResponse(null, { headers });
    const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
    return new NextResponse(body, { headers });
  } catch {
    return new NextResponse(headOnly ? null : "O APK está temporariamente indisponível. Adicione a WPlay à tela inicial pelo navegador.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8", "Retry-After": "3600" },
    });
  }
}

export async function GET() { return download(false); }
export async function HEAD() { return download(true); }
