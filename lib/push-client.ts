"use client";

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

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function registerPushSubscription(
  providedPublicKey?: string
): Promise<{ success: boolean; message: string; subscription?: PushSubscription }> {
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
          ? "Permissão bloqueada no navegador. Habilite as notificações nas configurações do site."
          : "Permissão de notificações não concedida.",
    };
  }

  // 2. Obtain VAPID Public Key
  let publicKey =
    providedPublicKey ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    try {
      const response = await fetch("/api/notifications/subscribe", {
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        const data = await response.json();
        publicKey = data.publicKey;
      }
    } catch {
      // Fallback
    }
  }

  if (!publicKey) {
    return {
      success: false,
      message: "Chave pública VAPID não configurada no servidor.",
    };
  }

  // 3. Register with PushManager
  try {
    const registration = await navigator.serviceWorker.ready;
    const applicationServerKey = urlBase64ToUint8Array(publicKey) as unknown as BufferSource;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // 4. Send subscription to our backend API
    const subJson = subscription.toJSON();
    const saveResponse = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscription: subJson,
        userAgent: navigator.userAgent,
      }),
    });

    if (!saveResponse.ok) {
      const errorData = await saveResponse.json().catch(() => null);
      throw new Error(
        errorData?.error || "Não foi possível salvar o registro de notificações."
      );
    }

    return {
      success: true,
      message: "Notificações ativadas com sucesso! Você receberá ofertas relâmpago em primeira mão.",
      subscription,
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
