import type { SupabaseClient } from "@supabase/supabase-js";

// The database remains the source of authorization. Public catalog reads and
// email addresses never establish permission to manage the store.
export async function requireStoreAdmin(client: SupabaseClient) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Sua sessão expirou. Entre novamente.");
  const { data: owner, error } = await client.from("store_owners")
    .select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (error) throw new Error("Não foi possível verificar sua permissão. Tente novamente ou contate o administrador principal.");
  if (!owner) throw new Error("Esta conta não tem acesso de administrador à loja.");
  return auth.user;
}
