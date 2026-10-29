import { NextResponse } from "next/server";
import {
  getPushSubscriberCount,
  getVapidPublicKey,
  savePushSubscription,
} from "@/lib/push-service";

export async function GET() {
  try {
    const publicKey = getVapidPublicKey();
    const count = await getPushSubscriberCount();
    return NextResponse.json({
      publicKey,
      count,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
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

    // Support both direct PushSubscription and wrapped { subscription, userAgent }
    const subscription = body.subscription || body;
    const endpoint = subscription.endpoint;
    const keys = subscription.keys;

    if (!endpoint || typeof endpoint !== "string" || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        {
          error:
            "Objeto PushSubscription incompleto. Os campos 'endpoint', 'keys.p256dh' e 'keys.auth' são obrigatórios.",
        },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get("user-agent") || body.userAgent;

    const result = await savePushSubscription({
      endpoint,
      keys: {
        p256dh: String(keys.p256dh),
        auth: String(keys.auth),
      },
      userAgent,
    });

    const totalSubscribers = await getPushSubscriberCount();

    return NextResponse.json({
      success: true,
      id: result.id,
      isNew: result.isNew,
      totalSubscribers,
      message: result.isNew
        ? "Dispositivo inscrito com sucesso para receber notificações."
        : "Inscrição de notificações atualizada com sucesso.",
    });
  } catch (error: unknown) {
    console.error("[api/notifications/subscribe] Erro:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao processar inscrição de notificação.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
