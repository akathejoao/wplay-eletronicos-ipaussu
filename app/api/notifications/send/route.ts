import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStoreAdmin } from "@/lib/admin-access";
import {
  broadcastPushNotification,
  getPushSubscriberCount,
} from "@/lib/push-service";

async function verifyAdminAccess(request: Request): Promise<boolean> {
  const authorization = request.headers.get("authorization");
  const adminSecret = request.headers.get("x-admin-key") || request.headers.get("x-admin-token");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. If Supabase is configured and authorization header is provided, verify against store_owners table
  if (url && key && authorization && /^Bearer [A-Za-z0-9._-]{20,4096}$/.test(authorization)) {
    try {
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authorization } },
      });
      await requireStoreAdmin(client);
      return true;
    } catch {
      return false;
    }
  }

  // 2. Fallback for local demo host or admin panel session token
  const origin = request.headers.get("origin") || request.headers.get("referer") || "";
  const isLocal =
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.includes("::1");

  if (isLocal && (adminSecret === "wplay-admin-verified" || request.headers.get("x-admin-session") === "active")) {
    return true;
  }

  // 3. Fallback when Supabase is not configured in local environment
  if (!url || !key) {
    if (adminSecret || authorization) {
      return true;
    }
  }

  return false;
}

export async function GET(request: Request) {
  const isAuthorized = await verifyAdminAccess(request);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Acesso restrito. Autenticação de administrador necessária." },
      { status: 401 }
    );
  }

  const count = await getPushSubscriberCount();
  return NextResponse.json({
    subscribersCount: count,
  });
}

export async function POST(request: Request) {
  const isAuthorized = await verifyAdminAccess(request);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Acesso não autorizado. Apenas administradores podem disparar notificações push." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Corpo da requisição inválido (JSON esperado)." },
        { status: 400 }
      );
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const messageBody = typeof body.body === "string" ? body.body.trim() : "";
    const url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : "/";
    const image = typeof body.image === "string" && body.image.trim() ? body.image.trim() : undefined;
    const badge = typeof body.badge === "string" && body.badge.trim() ? body.badge.trim() : "/icons/icon-192.png";

    if (!title) {
      return NextResponse.json(
        { error: "O título da notificação é obrigatório." },
        { status: 400 }
      );
    }

    if (!messageBody) {
      return NextResponse.json(
        { error: "A mensagem (corpo) da notificação é obrigatória." },
        { status: 400 }
      );
    }

    const result = await broadcastPushNotification({
      title,
      body: messageBody,
      url,
      image,
      badge,
    });

    return NextResponse.json({
      success: true,
      message: `Disparo concluído: ${result.sent} entregue(s) com sucesso de um total de ${result.total} inscritos.`,
      stats: result,
    });
  } catch (error: unknown) {
    console.error("[api/notifications/send] Erro no disparo push:", error);
    const message =
      error instanceof Error ? error.message : "Erro interno ao processar disparo de notificações.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
