import { NextResponse } from "next/server";
import { catalogCacheTag } from "@/lib/catalog-cache";
import { basicProductColumns, isMissingColumnError, productColumns, publicSettingsColumns } from "@/lib/catalog-repository";

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
    const fetchCompatible = async (endpoint: "products" | "store_settings", query: URLSearchParams, fallbackColumns: string) => {
      let response = await fetch(`${baseUrl}/rest/v1/${endpoint}?${query}`, { ...options, signal: AbortSignal.timeout(12_000) });
      if (!response.ok && response.status === 400) {
        const error = await response.clone().json().catch(() => null);
        if (isMissingColumnError(error)) {
          query.set("select", fallbackColumns);
          response = await fetch(`${baseUrl}/rest/v1/${endpoint}?${query}`, { ...options, signal: AbortSignal.timeout(12_000) });
        }
      }
      return response;
    };
    const [productsResponse, settingsResponse] = await Promise.all([
      fetchCompatible("products", new URLSearchParams({ select: productColumns, published: "eq.true", order: "created_at.desc,id.asc" }), basicProductColumns),
      fetchCompatible("store_settings", settingsQuery, publicSettingsColumns.replace(",custom_phone_models", "")),
    ]);

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
