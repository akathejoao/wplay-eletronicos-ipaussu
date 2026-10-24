import { createClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { catalogCacheTag } from "@/lib/catalog-cache";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization || !/^Bearer [A-Za-z0-9._-]{20,4096}$/.test(authorization)) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  try {
    const { data, error } = await client.from("store_owners").select("user_id").limit(1);
    if (error || !data?.length) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
    revalidateTag(catalogCacheTag);
    revalidatePath("/api/catalog");
    return NextResponse.json({ revalidated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar a vitrine agora." }, { status: 503 });
  }
}
