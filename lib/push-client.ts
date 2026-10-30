"use client";

import { createClient } from "@/lib/supabase";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function ensureServiceWorkerRegistered(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("[push-client] Falha no registro de sw.js:", err);
    });
    return await navigator.serviceWorker.ready;
  } catch (err) {
    console.error("[push-client] Erro ao aguardar serviceWorker.ready:", err);
    return null;
  }
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await ensureServiceWorkerRegistered();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function fetchServerVapidPublicKey(): Promise<string | null> {
  try {
    const response = await fetch("/api/notifications/subscribe", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.publicKey && typeof data.publicKey === "string") {
        return data.publicKey.trim();
      }
    }
  } catch {
    // Ignore fetch error
  }
  return null;
}

export async function registerPushSubscription(
  providedPublicKey?: string
): Promise<{ success: boolean; message: string; subscription?: PushSubscription; totalSubscribers?: number }> {
  if (!isPushSupported()) {
    return {
      success: false,
      message: "Notificações push não são suportadas neste navegador.",
    };
  }

  // 1. Request user permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      success: false,
      message:
        permission === "denied"
          ? "Permissão bloqueada no navegador. Habilite as notificações nas configurações do iPhone/Android."
          : "Permissão de notificações não concedida.",
    };
  }

  // 2. Obtain VAPID Public Key (client env or backend fallback)
  let publicKey =
    (providedPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();

  if (!publicKey) {
    publicKey = (await fetchServerVapidPublicKey()) || "";
  }

  if (!publicKey) {
    return {
      success: false,
      message: "Chave pública VAPID não configurada no servidor.",
    };
  }

  // 3. Register Service Worker and PushManager
  try {
    const registration = await ensureServiceWorkerRegistered();
    if (!registration) {
      throw new Error("Não foi possível inicializar o Service Worker.");
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey) as unknown as BufferSource;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // 4. Send subscription to our backend API using toJSON() for Safari iOS compatibility
    const subJson = subscription.toJSON();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-admin-key": "wplay-admin-verified",
      "x-admin-session": "active",
    };

    if (typeof window !== "undefined") {
      try {
        const supabase = createClient();
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.access_token) {
            headers["Authorization"] = `Bearer ${data.session.access_token}`;
          }
        }
      } catch {
        // Fallback gracioso
      }
    }

    const saveResponse = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        subscription: subJson,
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      }),
    });

    const data = await saveResponse.json().catch(() => null);

    if (!saveResponse.ok) {
      throw new Error(
        data?.error || "Não foi possível salvar o registro de notificações."
      );
    }

    const countNumber =
      typeof data?.totalSubscribers === "number"
        ? data.totalSubscribers
        : typeof data?.count === "number"
        ? data.count
        : undefined;

    // Dispatch global event so Admin and UI counters update in real time
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("wplay:push-subscribed", {
          detail: {
            endpoint: subJson.endpoint,
            totalSubscribers: countNumber,
          },
        })
      );
    }

    return {
      success: true,
      message: "Dispositivo sincronizado com sucesso! Alertas VIP ativados.",
      subscription,
      totalSubscribers: countNumber,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido ao ativar notificações.";
    return {
      success: false,
      message,
    };
  }
}
