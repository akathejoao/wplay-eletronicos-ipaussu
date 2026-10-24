import type { SupabaseClient } from "@supabase/supabase-js";

export const catalogCacheSeconds = 300;
export const catalogCacheTag = "wplay-public-catalog-v1";
export const publicCatalogStorageKey = "wplay-public-catalog-v1";
export const catalogChangedEvent = "wplay-catalog-changed";

export async function notifyCatalogChanged(client: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await client.auth.getSession();
    if (!data.session?.access_token) return false;
    const response = await fetch("/api/catalog/revalidate", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    localStorage.removeItem(publicCatalogStorageKey);
    window.dispatchEvent(new Event(catalogChangedEvent));
    return true;
  } catch {
    return false;
  }
}
