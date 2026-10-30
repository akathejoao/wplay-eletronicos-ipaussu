import webpush from "web-push";
import {
  savePushSubscription,
  removePushSubscription,
  getAllPushSubscriptions,
  getPushSubscriberCount,
  type PushSubscriptionKeys,
  type ClientPushSubscription,
  type StoredPushSubscription,
} from "./push-store";

export type {
  PushSubscriptionKeys,
  ClientPushSubscription,
  StoredPushSubscription,
};

export {
  savePushSubscription,
  removePushSubscription,
  getAllPushSubscriptions,
  getPushSubscriberCount,
};

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
  const envSubject = (process.env.VAPID_SUBJECT || "").trim();
  if (envSubject.startsWith("mailto:") || envSubject.startsWith("https://")) {
    return envSubject;
  }
  return DEFAULT_VAPID_SUBJECT;
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
