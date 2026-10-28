"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RefreshCw, ShieldCheck, Trash2, UserPlus } from "lucide-react";

type Owner = { user_id: string; email: string; is_primary: boolean };
type Invitation = { email: string; is_primary: boolean };

export function AdminAccessManager({ supabase }: { supabase: SupabaseClient }) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sua sessão expirou. Entre novamente.");
      const { data, error: ownersError } = await supabase
        .from("store_owners")
        .select("user_id,email,is_primary")
        .order("created_at");
      if (ownersError) throw new Error("Não foi possível carregar os administradores.");
      const records = (data || []) as Owner[];
      const primary = records.some((owner) => owner.user_id === auth.user.id && owner.is_primary);
      setOwners(records);
      setIsPrimary(primary);
      if (primary) {
        const { data: invites, error: invitesError } = await supabase
          .from("store_admin_invites")
          .select("email,is_primary")
          .order("created_at");
        if (invitesError) throw new Error("Não foi possível carregar as permissões pendentes.");
        setInvitations((invites || []) as Invitation[]);
      } else {
        setInvitations([]);
      }
    } catch (caught) {
      setIsPrimary(false);
      setError(caught instanceof Error ? caught.message : "Falha ao carregar os acessos.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void refresh(); }, [refresh]);

  const grantAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!isPrimary || busy || !normalized) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const { data: granted, error: grantError } = await supabase.rpc("grant_store_admin", { target_email: normalized });
      if (grantError || granted !== true) throw new Error("Não foi possível conceder acesso. Verifique sua permissão e tente novamente.");
      setEmail("");
      await refresh();
      setMessage("Acesso autorizado. Compartilhe o endereço deste painel com a pessoa; ela deverá entrar usando o e-mail autorizado e confirmar o acesso pelo próprio e-mail.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao conceder acesso.");
    } finally {
      setBusy(false);
    }
  };

  const revokeAccess = async (owner: Owner) => {
    if (!isPrimary || owner.is_primary || busy) return;
    if (!window.confirm(`Remover o acesso administrativo de ${owner.email}?`)) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const { data: revoked, error: revokeError } = await supabase.rpc("revoke_store_admin", { target_user_id: owner.user_id });
      if (revokeError || revoked !== true) throw new Error("Não foi possível remover esse administrador.");
      await refresh();
      setMessage("Acesso removido. Essa conta não pode mais alterar os dados da loja.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao remover acesso.");
    } finally {
      setBusy(false);
    }
  };

  const cancelInvitation = async (invitation: Invitation) => {
    if (!isPrimary || invitation.is_primary || busy) return;
    if (!window.confirm(`Cancelar a autorização de ${invitation.email}?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data, error: cancelError } = await supabase.rpc("revoke_store_admin_email", { target_email: invitation.email });
      if (cancelError || data !== true) throw new Error("Não foi possível cancelar essa autorização. Atualize a lista e tente novamente.");
      await refresh();
      setMessage("Autorização cancelada.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao cancelar autorização.");
    } finally {
      setBusy(false);
    }
  };

  const pending = invitations.filter((invitation) => !owners.some((owner) => owner.email === invitation.email));

  return (
    <section className="admin-section-card" aria-labelledby="admin-access-heading">
      <div className="admin-products-head">
        <div>
          <h2 id="admin-access-heading"><ShieldCheck size={18} /> Administradores</h2>
          <p className="admin-sub">Somente o administrador principal pode conceder ou remover acesso. Os demais administradores podem gerenciar o catálogo e os contatos.</p>
        </div>
        <button type="button" className="button button-ghost" disabled={loading || busy} onClick={() => void refresh()}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>
      {loading && <p role="status">Carregando acessos…</p>}
      {error && <p role="alert" className="admin-security-feedback">{error}</p>}
      {message && <p role="status" className="admin-security-feedback">{message}</p>}
      {!loading && isPrimary && (
        <>
          <form className="product-form" onSubmit={(event) => void grantAccess(event)}>
            <label>E-mail do novo administrador
              <input type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} placeholder="pessoa@exemplo.com" />
            </label>
            <button type="submit" className="button button-lime" disabled={busy}>
              <UserPlus size={16} /> {busy ? "Salvando…" : "Conceder acesso"}
            </button>
          </form>
          <ul className="admin-list" aria-label="Administradores ativos" style={{ listStyle: "none", padding: 0 }}>
            {owners.map((owner) => (
              <li key={owner.user_id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "12px 0" }}>
                <span style={{ flex: "1 1 180px", overflowWrap: "anywhere" }}>{owner.email}<br /><small>{owner.is_primary ? "Administrador principal" : "Administrador"}</small></span>
                {!owner.is_primary && <button type="button" className="button button-ghost" disabled={busy} onClick={() => void revokeAccess(owner)} aria-label={`Remover acesso de ${owner.email}`}><Trash2 size={16} /> Remover</button>}
              </li>
            ))}
          </ul>
          {pending.length > 0 && <h3>Aguardando primeiro acesso</h3>}
          <ul className="admin-list" aria-label="Autorizações pendentes" style={{ listStyle: "none", padding: 0 }}>
            {pending.map((invitation) => (
              <li key={invitation.email} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "12px 0" }}>
                <span style={{ flex: "1 1 180px", overflowWrap: "anywhere" }}>{invitation.email}</span>
                {!invitation.is_primary && <button type="button" className="button button-ghost" disabled={busy} onClick={() => void cancelInvitation(invitation)} aria-label={`Cancelar autorização de ${invitation.email}`}><Trash2 size={16} /> Cancelar</button>}
              </li>
            ))}
          </ul>
        </>
      )}
      {!loading && !isPrimary && !error && <p>Seu acesso permite editar a loja. Para gerenciar administradores, entre com a conta do administrador principal.</p>}
    </section>
  );
}
