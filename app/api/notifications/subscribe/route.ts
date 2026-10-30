import { NextResponse } from "next/server";
import {
  getPushSubscriberCount,
  getVapidPublicKey,
  savePushSubscription,
} from "@/lib/push-service";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || undefined;
    const publicKey = getVapidPublicKey();
    const count = await getPushSubscriberCount(authHeader);
    return NextResponse.json(
      {
        publicKey,
        count,
        subscribersCount: count,
        total: count,
      },
      {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao consultar status do Web Push.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Corpo da requisição inválido (JSON esperado)." },
        { status: 400 }
      );
    }

    // Support direct PushSubscription, wrapped { subscription, userAgent }, or JSON.stringify(subscription)
    const subscription = body.subscription || body;
    const endpoint = typeof subscription.endpoint === "string" ? subscription.endpoint.trim() : "";
    const keys = subscription.keys;

    if (!endpoint || !endpoint.startsWith("http") || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        {
          error:
            "Objeto PushSubscription incompleto. Os campos 'endpoint', 'keys.p256dh' e 'keys.auth' são obrigatórios.",
        },
        { status: 400 }
      );
    }

    const p256dh = String(keys.p256dh).trim();
    const auth = String(keys.auth).trim();

    if (!p256dh || !auth) {
      return NextResponse.json(
        {
          error: "Chaves p256dh e auth não podem ser vazias.",
        },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get("user-agent") || body.userAgent;
    const authHeader = request.headers.get("authorization") || undefined;

    const result = await savePushSubscription(
      {
        endpoint,
        keys: {
          p256dh,
          auth,
        },
        userAgent,
      },
      authHeader
    );

    const totalSubscribers = await getPushSubscriberCount(authHeader);

    return NextResponse.json(
      {
        ok: true,
        success: true,
        id: result.id,
        isNew: result.isNew,
        totalSubscribers,
        subscribersCount: totalSubscribers,
        total: totalSubscribers,
        count: totalSubscribers,
        message: result.isNew
          ? "Dispositivo inscrito com sucesso para receber notificações."
          : "Inscrição de notificações atualizada com sucesso.",
      },
      {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  } catch (error: unknown) {
    console.error("[api/notifications/subscribe] Erro:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao processar inscrição de notificação.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
