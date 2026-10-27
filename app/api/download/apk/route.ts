import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "downloads", "wplay-app.apk");

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Arquivo de instalação APK temporariamente indisponível.", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="WPlay-Eletronicos.apk"',
      "Content-Length": fileBuffer.length.toString(),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
    },
  });
}
