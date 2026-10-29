import { NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

export const runtime = "nodejs";

const candidatePaths = [
  path.join(process.cwd(), "public", "WPlay-Eletronicos.apk"),
  path.join(process.cwd(), "public", "downloads", "wplay-app.apk"),
];

async function getAvailableApk(): Promise<{ path: string; size: number } | null> {
  for (const candidate of candidatePaths) {
    try {
      const file = await stat(candidate);
      if (file.isFile() && file.size > 0) {
        return { path: candidate, size: file.size };
      }
    } catch {
      // Continue checking next path
    }
  }
  return null;
}

async function download(headOnly: boolean) {
  try {
    const apk = await getAvailableApk();
    if (!apk) throw new Error("APK unavailable");
    const headers = {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="WPlay-Eletronicos.apk"',
      "Content-Length": String(apk.size),
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    };
    if (headOnly) return new NextResponse(null, { headers });
    const body = Readable.toWeb(createReadStream(apk.path)) as ReadableStream<Uint8Array>;
    return new NextResponse(body, { headers });
  } catch {
    return new NextResponse(
      headOnly
        ? null
        : "O APK está sendo gerado ou temporariamente indisponível. Você também pode adicionar a WPlay à tela inicial pelo navegador.",
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "Retry-After": "3600",
        },
      }
    );
  }
}

export async function GET() { return download(false); }
export async function HEAD() { return download(true); }
