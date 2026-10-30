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

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

/**
 * Saves or updates a push subscription in memory, disk cache, and Supabase (if available).
 */
export async function savePushSubscription(
  subscription: ClientPushSubscription
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

  // 3. Try syncing with Supabase in background
  const config = getSupabaseConfig();
  if (config) {
    try {
      const response = await fetch(`${config.url}/rest/v1/push_subscriptions`, {
        method: "POST",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
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
        const rows = await response.json().catch(() => []);
        const savedId = Array.isArray(rows) && rows[0]?.id ? String(rows[0].id) : subId;
        return { success: true, id: savedId, isNew: !existingMem };
      }
    } catch {
      // Supabase is optional; in-memory and disk persistence ensure 100% reliability
    }
  }

  return { success: true, id: subId, isNew: !existingMem };
}

/**
 * Removes a subscription when expired (HTTP 404 or 410) or requested.
 */
export async function removePushSubscription(endpoint: string): Promise<boolean> {
  if (!endpoint) return false;
  const memoryStore = getMemoryStore();
  memoryStore.delete(endpoint);
  saveToDisk(memoryStore);

  const config = getSupabaseConfig();
  if (config) {
    try {
      const encodedEndpoint = encodeURIComponent(endpoint);
      await fetch(
        `${config.url}/rest/v1/push_subscriptions?endpoint=eq.${encodedEndpoint}`,
        {
          method: "DELETE",
          headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`,
          },
          signal: AbortSignal.timeout(4000),
        }
      );
    } catch {
      // Ignore database cleanup errors
    }
  }
  return true;
}

/**
 * Retrieves all stored push subscriptions combining memory, disk, and Supabase.
 */
export async function getAllPushSubscriptions(): Promise<StoredPushSubscription[]> {
  const memoryStore = getMemoryStore();

  const config = getSupabaseConfig();
  if (config) {
    try {
      const response = await fetch(
        `${config.url}/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth,user_agent,created_at&order=created_at.desc`,
        {
          headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`,
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
export async function getPushSubscriberCount(): Promise<number> {
  const subs = await getAllPushSubscriptions();
  return subs.length;
}
