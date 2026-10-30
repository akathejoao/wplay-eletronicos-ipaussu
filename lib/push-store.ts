import fs from "fs";
import path from "path";
import os from "os";

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface ClientPushSubscription {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string | null;
}

export interface StoredPushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
  created_at: string;
  updated_at?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __wplayPushStore: Map<string, StoredPushSubscription> | undefined;
}

export const PUSH_SETTINGS_GALLERY_ID = "wplay_push_subscriptions_store";
export const PUSH_SETTINGS_GALLERY_LABEL = "WPlay Push Subscriptions Storage";

const STORAGE_PATHS = [
  path.join(process.cwd(), ".data", "push-subscriptions.json"),
  path.join(os.tmpdir(), "wplay-push-subscriptions.json"),
  ...(process.platform !== "win32" ? ["/tmp/wplay-push-subscriptions.json"] : []),
];

function ensureDirectoryExistence(filePath: string) {
  try {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
  } catch {
    // Ignore folder creation errors in restricted environments
  }
}

function loadFromDisk(): Map<string, StoredPushSubscription> {
  const map = new Map<string, StoredPushSubscription>();

  for (const filePath of STORAGE_PATHS) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && typeof item.endpoint === "string" && item.endpoint.trim()) {
              map.set(item.endpoint.trim(), item);
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return map;
}

function saveToDisk(map: Map<string, StoredPushSubscription>) {
  const array = Array.from(map.values());
  const serialized = JSON.stringify(array, null, 2);

  for (const filePath of STORAGE_PATHS) {
    try {
      ensureDirectoryExistence(filePath);
      fs.writeFileSync(filePath, serialized, "utf-8");
    } catch {
      // Ignore write errors
    }
  }
}

function getMemoryStore(): Map<string, StoredPushSubscription> {
  if (!globalThis.__wplayPushStore) {
    globalThis.__wplayPushStore = loadFromDisk();
  }
  return globalThis.__wplayPushStore;
}

function getSupabaseConfig(authToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  const defaultKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey || defaultKey;
  if (!url || !key) return null;

  // Use serviceKey if available, otherwise use caller's authToken (e.g. active admin Bearer token)
  const cleanAuthToken = authToken ? authToken.replace(/^Bearer\s+/i, "").trim() : "";
  const token = serviceKey || (cleanAuthToken || key);

  return {
    url: url.replace(/\/$/, ""),
    apiKey: key,
    token,
  };
}

function extractSubsFromGallery(customGallery: unknown[]): StoredPushSubscription[] {
  if (!Array.isArray(customGallery)) return [];
  const entry = customGallery.find(
    (item) => item && typeof item === "object" && (item as { id?: string }).id === PUSH_SETTINGS_GALLERY_ID
  ) as { src?: string } | undefined;

  if (!entry?.src || typeof entry.src !== "string") return [];

  try {
    const raw = entry.src.startsWith("data:application/json;utf8,")
      ? decodeURIComponent(entry.src.replace("data:application/json;utf8,", ""))
      : entry.src;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item.endpoint === "string" && item.endpoint.trim());
    }
  } catch {
    // Ignore JSON parse errors
  }
  return [];
}

/**
 * Saves or updates a push subscription in memory, disk cache, and Supabase.
 * On serverless environments (Vercel), if public.push_subscriptions table returns 404,
 * falls back to storing subscriptions inside the existing public.store_settings table.
 */
export async function savePushSubscription(
  subscription: ClientPushSubscription,
  authToken?: string
): Promise<{ success: boolean; id: string; isNew: boolean }> {
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    throw new Error("PushSubscription inválido: endpoint e chaves p256dh/auth são obrigatórios.");
  }

  const endpoint = subscription.endpoint.trim();
  const p256dh = subscription.keys.p256dh.trim();
  const auth = subscription.keys.auth.trim();
  const userAgent = subscription.userAgent?.slice(0, 255) || null;

  const now = new Date().toISOString();
  const memoryStore = getMemoryStore();
  const existingMem = memoryStore.get(endpoint);
  const subId = existingMem?.id || crypto.randomUUID();

  const record: StoredPushSubscription = {
    id: subId,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent,
    created_at: existingMem?.created_at || now,
    updated_at: now,
  };

  // 1. Save to in-memory store
  memoryStore.set(endpoint, record);

  // 2. Persist to disk files
  saveToDisk(memoryStore);

  // 3. Persist to Supabase
  const config = getSupabaseConfig(authToken);
  if (config) {
    let pushTableAvailable = false;
    try {
      const response = await fetch(`${config.url}/rest/v1/push_subscriptions`, {
        method: "POST",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent,
          updated_at: now,
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (response.ok) {
        pushTableAvailable = true;
        const rows = await response.json().catch(() => []);
        const savedId = Array.isArray(rows) && rows[0]?.id ? String(rows[0].id) : subId;
        return { success: true, id: savedId, isNew: !existingMem };
      }
    } catch {
      // push_subscriptions table check failed or timed out
    }

    // 4. Fallback: Save to store_settings (which exists and works on Vercel)
    if (!pushTableAvailable) {
      try {
        const fetchSettings = await fetch(
          `${config.url}/rest/v1/store_settings?id=eq.true&select=custom_gallery`,
          {
            headers: {
              apikey: config.apiKey,
              Authorization: `Bearer ${config.token}`,
            },
            signal: AbortSignal.timeout(4000),
          }
        );

        if (fetchSettings.ok) {
          const settingsRows = (await fetchSettings.json()) as Array<{ custom_gallery?: unknown[] }>;
          const currentGallery = Array.isArray(settingsRows[0]?.custom_gallery)
            ? settingsRows[0].custom_gallery
            : [];

          // Extract existing subscriptions stored in custom_gallery
          const existingSubs = extractSubsFromGallery(currentGallery);
          const subsMap = new Map<string, StoredPushSubscription>();
          for (const s of existingSubs) {
            subsMap.set(s.endpoint, s);
          }
          // Also merge any memoryStore items
          for (const [ep, s] of memoryStore.entries()) {
            if (!subsMap.has(ep)) {
              subsMap.set(ep, s);
            }
          }
          subsMap.set(endpoint, record);

          const updatedList = Array.from(subsMap.values());
          const pushPayload = {
            id: PUSH_SETTINGS_GALLERY_ID,
            src: "data:application/json;utf8," + encodeURIComponent(JSON.stringify(updatedList)),
            label: PUSH_SETTINGS_GALLERY_LABEL,
          };

          // Keep genuine store photos and replace/append the push storage item
          const preservedPhotos = currentGallery.filter(
            (item) => item && typeof item === "object" && (item as { id?: string }).id !== PUSH_SETTINGS_GALLERY_ID
          );
          const newGallery = [...preservedPhotos, pushPayload];

          await fetch(`${config.url}/rest/v1/store_settings?id=eq.true`, {
            method: "PATCH",
            headers: {
              apikey: config.apiKey,
              Authorization: `Bearer ${config.token}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              custom_gallery: newGallery,
              updated_at: now,
            }),
            signal: AbortSignal.timeout(4000),
          });
        }
      } catch {
        // Fallback to in-memory/disk store
      }
    }
  }

  return { success: true, id: subId, isNew: !existingMem };
}

/**
 * Removes a subscription when expired (HTTP 404 or 410) or requested.
 */
export async function removePushSubscription(
  endpoint: string,
  authToken?: string
): Promise<boolean> {
  if (!endpoint) return false;
  const memoryStore = getMemoryStore();
  memoryStore.delete(endpoint);
  saveToDisk(memoryStore);

  const config = getSupabaseConfig(authToken);
  if (config) {
    try {
      const encodedEndpoint = encodeURIComponent(endpoint);
      const res = await fetch(
        `${config.url}/rest/v1/push_subscriptions?endpoint=eq.${encodedEndpoint}`,
        {
          method: "DELETE",
          headers: {
            apikey: config.apiKey,
            Authorization: `Bearer ${config.token}`,
          },
          signal: AbortSignal.timeout(4000),
        }
      );

      // If push_subscriptions returned 404, remove from store_settings fallback
      if (res.status === 404) {
        const fetchSettings = await fetch(
          `${config.url}/rest/v1/store_settings?id=eq.true&select=custom_gallery`,
          {
            headers: {
              apikey: config.apiKey,
              Authorization: `Bearer ${config.token}`,
            },
            signal: AbortSignal.timeout(4000),
          }
        );

        if (fetchSettings.ok) {
          const settingsRows = (await fetchSettings.json()) as Array<{ custom_gallery?: unknown[] }>;
          const currentGallery = Array.isArray(settingsRows[0]?.custom_gallery)
            ? settingsRows[0].custom_gallery
            : [];
          const existingSubs = extractSubsFromGallery(currentGallery);
          const remainingSubs = existingSubs.filter((s) => s.endpoint !== endpoint);

          const pushPayload = {
            id: PUSH_SETTINGS_GALLERY_ID,
            src: "data:application/json;utf8," + encodeURIComponent(JSON.stringify(remainingSubs)),
            label: PUSH_SETTINGS_GALLERY_LABEL,
          };

          const preservedPhotos = currentGallery.filter(
            (item) => item && typeof item === "object" && (item as { id?: string }).id !== PUSH_SETTINGS_GALLERY_ID
          );
          const newGallery = [...preservedPhotos, pushPayload];

          await fetch(`${config.url}/rest/v1/store_settings?id=eq.true`, {
            method: "PATCH",
            headers: {
              apikey: config.apiKey,
              Authorization: `Bearer ${config.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              custom_gallery: newGallery,
              updated_at: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(4000),
          });
        }
      }
    } catch {
      // Ignore database cleanup errors
    }
  }
  return true;
}

/**
 * Retrieves all stored push subscriptions combining memory, disk, and Supabase.
 * On serverless environments (Vercel), falls back to store_settings table when
 * push_subscriptions is not present in Supabase schema.
 */
export async function getAllPushSubscriptions(
  authToken?: string
): Promise<StoredPushSubscription[]> {
  const memoryStore = getMemoryStore();

  const config = getSupabaseConfig(authToken);
  if (config) {
    try {
      // 1. Try public.push_subscriptions table
      const response = await fetch(
        `${config.url}/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth,user_agent,created_at&order=created_at.desc`,
        {
          headers: {
            apikey: config.apiKey,
            Authorization: `Bearer ${config.token}`,
          },
          signal: AbortSignal.timeout(4000),
        }
      );

      if (response.ok) {
        const rows = (await response.json()) as StoredPushSubscription[];
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (row?.endpoint) {
              memoryStore.set(row.endpoint, row);
            }
          }
          saveToDisk(memoryStore);
          return Array.from(memoryStore.values());
        }
      }

      // 2. If table returned 404, fallback to store_settings (which exists and works)
      if (response.status === 404) {
        const settingsRes = await fetch(
          `${config.url}/rest/v1/store_settings?id=eq.true&select=custom_gallery`,
          {
            headers: {
              apikey: config.apiKey,
              Authorization: `Bearer ${config.token}`,
            },
            signal: AbortSignal.timeout(4000),
          }
        );

        if (settingsRes.ok) {
          const settingsRows = (await settingsRes.json()) as Array<{ custom_gallery?: unknown[] }>;
          const currentGallery = Array.isArray(settingsRows[0]?.custom_gallery)
            ? settingsRows[0].custom_gallery
            : [];
          const storedSubs = extractSubsFromGallery(currentGallery);

          if (storedSubs.length > 0) {
            for (const item of storedSubs) {
              if (item?.endpoint) {
                memoryStore.set(item.endpoint, item);
              }
            }
            saveToDisk(memoryStore);
          }
        }
      }
    } catch {
      // Fallback to local memory and disk store
    }
  }

  return Array.from(memoryStore.values());
}

/**
 * Gets the total count of registered push subscribers.
 */
export async function getPushSubscriberCount(authToken?: string): Promise<number> {
  const subs = await getAllPushSubscriptions(authToken);
  return subs.length;
}
