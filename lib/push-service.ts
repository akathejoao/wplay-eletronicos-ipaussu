import webpush from "web-push";

// Default fallback VAPID keys for out-of-the-box local development & testing
const DEFAULT_VAPID_PUBLIC_KEY =
  "BKBkYGwUK5TKFeIrcnXUUbk32hweJmW4OfYdJdCmiiN-TMRYIg6Lp0WkAgzY1NjsTNw4YU_dG7prJJ5RlJfsv_0";
const DEFAULT_VAPID_PRIVATE_KEY =
  "PouptOuS-kQukzM4VFcEY3fneTU6xveEsK6hPcGRSys";
const DEFAULT_VAPID_SUBJECT = "mailto:contato@wplay.com.br";

export function getVapidPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY
  );
}

export function getVapidPrivateKey(): string {
  return process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
}

export function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;
}

let vapidConfigured = false;
function ensureVapidConfigured() {
  if (vapidConfigured) return;
  try {
    webpush.setVapidDetails(
      getVapidSubject(),
      getVapidPublicKey(),
      getVapidPrivateKey()
    );
    vapidConfigured = true;
  } catch (err) {
    console.error("[push-service] Erro ao configurar VAPID:", err);
  }
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface ClientPushSubscription {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string;
}

export interface StoredPushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
  created_at: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  image?: string;
  badge?: string;
  tag?: string;
}

export interface PushBroadcastResult {
  total: number;
  sent: number;
  failed: number;
  removed: number;
}

// In-memory fallback for local development or demo environments
const globalSubscriptionsKey = Symbol.for("wplay.push.subscriptions");
interface GlobalPushStorage {
  [globalSubscriptionsKey]?: Map<string, StoredPushSubscription>;
}

function getMemoryStore(): Map<string, StoredPushSubscription> {
  const g = globalThis as unknown as GlobalPushStorage;
  if (!g[globalSubscriptionsKey]) {
    g[globalSubscriptionsKey] = new Map<string, StoredPushSubscription>();
  }
  return g[globalSubscriptionsKey]!;
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
 * Saves or updates a push subscription in Supabase (or fallback storage).
 * Prevents duplicates by matching on endpoint.
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

  // Always keep in-memory store in sync
  memoryStore.set(endpoint, {
    id: subId,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent,
    created_at: existingMem?.created_at || now,
  });

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
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const rows = await response.json().catch(() => []);
        const savedId = Array.isArray(rows) && rows[0]?.id ? String(rows[0].id) : subId;
        return { success: true, id: savedId, isNew: !existingMem };
      }
    } catch {
      // Supabase is optional or down; gracefully fallback to memory store
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
          signal: AbortSignal.timeout(6000),
        }
      );
    } catch {
      // Ignore database cleanup errors
    }
  }
  return true;
}

/**
 * Retrieves all stored push subscriptions.
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
          signal: AbortSignal.timeout(8000),
        }
      );
      if (response.ok) {
        const rows = (await response.json()) as StoredPushSubscription[];
        if (Array.isArray(rows)) {
          // Sync database rows into memory store
          for (const row of rows) {
            memoryStore.set(row.endpoint, row);
          }
          return rows;
        }
      }
    } catch {
      // Fallback to memory store below
    }
  }

  return Array.from(memoryStore.values());
}

/**
 * Gets the total count of registered push subscribers.
 */
export async function getPushSubscriberCount(): Promise<number> {
  const subscriptions = await getAllPushSubscriptions();
  return subscriptions.length;
}

/**
 * Sends a push notification to all subscribed devices and removes expired ones.
 */
export async function broadcastPushNotification(
  payload: PushNotificationPayload
): Promise<PushBroadcastResult> {
  ensureVapidConfigured();
  const subscriptions = await getAllPushSubscriptions();

  const result: PushBroadcastResult = {
    total: subscriptions.length,
    sent: 0,
    failed: 0,
    removed: 0,
  };

  if (subscriptions.length === 0) {
    return result;
  }

  const notificationData = JSON.stringify({
    title: payload.title || "WPlay Eletrônicos",
    body: payload.body || "",
    url: payload.url || "/",
    image: payload.image || undefined,
    badge: payload.badge || "/icons/icon-192.png",
    tag: payload.tag || "wplay-sales-alert",
  });

  const sendPromises = subscriptions.map(async (sub) => {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSub, notificationData, {
        urgency: "high",
        TTL: 24 * 60 * 60, // 24 hours
      });
      result.sent++;
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      // HTTP 404 (Not Found) or 410 (Gone) indicate unsubscribed or expired subscription
      if (statusCode === 404 || statusCode === 410) {
        result.removed++;
        await removePushSubscription(sub.endpoint);
      } else {
        result.failed++;
        console.warn(`[push-service] Falha ao enviar para ${sub.endpoint.slice(0, 30)}...:`, error);
      }
    }
  });

  await Promise.allSettled(sendPromises);

  // Record campaign in database / storage
  const config = getSupabaseConfig();
  if (config) {
    try {
      await fetch(`${config.url}/rest/v1/push_campaigns`, {
        method: "POST",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: `camp-${Date.now()}`,
          title: payload.title.slice(0, 100),
          body: payload.body.slice(0, 250),
          target_url: payload.url || "/",
          image_url: payload.image || null,
          sent_count: result.sent,
        }),
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      // Ignore campaign history log failure
    }
  }

  return result;
}
