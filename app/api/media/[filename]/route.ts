import { NextResponse } from "next/server";

export const revalidate = 31536000;

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^image-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(webp|png|jpg)$/.test(filename)) {
    return new NextResponse(null, { status: 404 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return new NextResponse(null, { status: 503 });
  try {
    const image = await fetch(`${url.replace(/\/$/, "")}/storage/v1/object/public/catalog-media/${filename}`, {
      next: { revalidate: 31536000 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!image.ok) return new NextResponse(null, { status: image.status === 404 || image.status === 400 ? 404 : 503 });
    const contentType = image.headers.get("content-type")?.split(";")[0];
    if (!contentType || !["image/webp", "image/jpeg", "image/png"].includes(contentType)) {
      return new NextResponse(null, { status: 502 });
    }
    const body = await image.arrayBuffer();
    if (body.byteLength > 250 * 1024) return new NextResponse(null, { status: 413 });
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
