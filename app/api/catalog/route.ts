import { NextResponse } from "next/server";
import { catalogCacheTag } from "@/lib/catalog-cache";
import { productColumns, publicSettingsColumns } from "@/lib/catalog-repository";

export const revalidate = 300;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "O catálogo está temporariamente indisponível." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
  try {
    const baseUrl = url.replace(/\/$/, "");
    const settingsQuery = new URLSearchParams({ select: publicSettingsColumns, id: "eq.true" });
    const options = {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      next: { revalidate: 300, tags: [catalogCacheTag] },
      signal: AbortSignal.timeout(12_000),
    };

    // Try full productColumns first, fall back gracefully if new columns don't exist yet in Supabase
    let productsResponse = await fetch(`${baseUrl}/rest/v1/products?${new URLSearchParams({ select: productColumns, published: "eq.true", order: "created_at.desc,id.asc" })}`, options);
    
    if (!productsResponse.ok) {
      const basicProductColumns = "id,name,category,description,badge,price,image,image_fit,image_position,image_scale,published,featured,variants";
      productsResponse = await fetch(`${baseUrl}/rest/v1/products?${new URLSearchParams({ select: basicProductColumns, published: "eq.true", order: "created_at.desc,id.asc" })}`, options);
    }

    const settingsResponse = await fetch(`${baseUrl}/rest/v1/store_settings?${settingsQuery}`, options);

    if (!productsResponse.ok || !settingsResponse.ok) throw new Error("Catalog request failed");
    const [products, settings] = await Promise.all([productsResponse.json(), settingsResponse.json()]);
    if (!Array.isArray(products) || !Array.isArray(settings)) throw new Error("Invalid catalog response");
    return NextResponse.json({ products, settings: settings[0] || null }, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar o catálogo. Tente novamente em alguns instantes." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
