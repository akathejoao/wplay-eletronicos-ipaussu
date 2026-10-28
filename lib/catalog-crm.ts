import type { SupabaseClient } from "@supabase/supabase-js";
import { CustomerLead, leadsStorageKey } from "@/lib/catalog";

export async function saveCustomerLead(
  lead: Omit<CustomerLead, "id" | "createdAt">,
  supabase?: SupabaseClient | null
): Promise<CustomerLead> {
  const newLead: CustomerLead = {
    ...lead,
    id: `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  // 1. If Supabase is available, attempt to write directly to customer_leads
  if (supabase) {
    try {
      const { error } = await supabase.from("customer_leads").insert({
        id: newLead.id,
        name: newLead.name,
        whatsapp: newLead.whatsapp,
        product_name: newLead.productName,
        product_id: newLead.productId || null,
        variant_chosen: newLead.variantChosen || null,
        notes: newLead.notes || "",
        status: newLead.status,
        estimated_value: newLead.estimatedValue || null,
      });
      if (error) throw new Error("Não foi possível registrar o contato.");
      return newLead;
    } catch {
      throw new Error("Não foi possível registrar o contato na loja.");
    }
  }

  // Local persistence is only used by the local demo, without a cloud client.
  try {
    const existing = getStoredLeads();
    const updated = [newLead, ...existing.filter((l) => l.id !== newLead.id)].slice(0, 200);
    localStorage.setItem(leadsStorageKey, JSON.stringify(updated));
    window.dispatchEvent(new Event("wplay-leads-updated"));
  } catch {
    // Ignore storage quota
  }

  return newLead;
}

export function getStoredLeads(): CustomerLead[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(leadsStorageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function loadLeads(supabase?: SupabaseClient | null): Promise<CustomerLead[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("customer_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && Array.isArray(data)) {
        const mapped: CustomerLead[] = data.map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          name: row.name,
          whatsapp: row.whatsapp,
          productName: row.product_name,
          productId: row.product_id,
          variantChosen: row.variant_chosen,
          notes: row.notes,
          status: row.status,
          estimatedValue: row.estimated_value,
          lastFollowUpAt: row.last_follow_up_at,
        }));
        return mapped;
      }
      throw new Error("Não foi possível carregar os contatos. Verifique sua conexão e permissão.");
    } catch {
      throw new Error("Não foi possível carregar os contatos. Verifique sua conexão e permissão.");
    }
  }
  return getStoredLeads();
}

export async function updateLeadStatus(
  id: string,
  status: CustomerLead["status"],
  notes?: string,
  supabase?: SupabaseClient | null
): Promise<boolean> {
  const now = new Date().toISOString();
  if (supabase) {
    try {
      const patch: Record<string, unknown> = {
        status,
        last_follow_up_at: now,
      };
      if (notes !== undefined) patch.notes = notes;
      const { data, error } = await supabase.from("customer_leads").update(patch).eq("id", id).select("id");
      return !error && Boolean(data?.length);
    } catch { return false; }
  }

  try {
    const existing = getStoredLeads();
    const updated = existing.map((lead) =>
      lead.id === id
        ? { ...lead, status, lastFollowUpAt: now, ...(notes !== undefined ? { notes } : {}) }
        : lead
    );
    localStorage.setItem(leadsStorageKey, JSON.stringify(updated));
    window.dispatchEvent(new Event("wplay-leads-updated"));
    return true;
  } catch {
    return false;
  }
}

export async function deleteCustomerLead(
  id: string,
  supabase?: SupabaseClient | null
): Promise<boolean> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from("customer_leads").delete().eq("id", id).select("id");
      return !error && Boolean(data?.length);
    } catch { return false; }
  }
  try {
    const existing = getStoredLeads();
    const updated = existing.filter((lead) => lead.id !== id);
    localStorage.setItem(leadsStorageKey, JSON.stringify(updated));
    window.dispatchEvent(new Event("wplay-leads-updated"));
    return true;
  } catch {
    return false;
  }
}

export type FollowUpTemplateKey = "default" | "pix" | "reposicao" | "retirada" | "negociacao";

export function buildFollowUpWhatsAppHref(
  lead: CustomerLead,
  storeName: string,
  templateKey?: FollowUpTemplateKey
): string {
  const digits = lead.whatsapp.replace(/\D/g, "");
  const phone = digits.length <= 11 && !digits.startsWith("55") ? `55${digits}` : digits;

  let msg = `Olá, ${lead.name}! Tudo bem? Aqui é da ${storeName} em Ipaussu.\n`;

  if (templateKey === "pix") {
    msg += `Estou retomando seu contato sobre o *${lead.productName}*. Conseguimos liberar uma condição exclusiva de desconto à vista no PIX hoje!\nQuer que eu separe sua unidade?`;
  } else if (templateKey === "reposicao" || (!templateKey && lead.status === "aguardando_reposicao")) {
    msg += `Passando para avisar que recebemos novidades e reposição do *${lead.productName}* (${lead.variantChosen || "novo lote"}).\nVocê ainda tem interesse em garantir o seu com condição especial?`;
  } else if (templateKey === "retirada") {
    msg += `Passando para avisar que o *${lead.productName}* está disponível para você conferir ou retirar hoje na nossa loja física aqui no centro de Ipaussu!\nQue horas fica bom para você dar uma passada?`;
  } else if (templateKey === "negociacao" || (!templateKey && lead.status === "em_negociacao")) {
    msg += `Estou retomando seu contato sobre o *${lead.productName}*. Conseguimos uma condição diferenciada no PIX ou parcelamento no cartão hoje!\nPodemos separar para você?`;
  } else {
    msg += `Vi que você teve interesse no *${lead.productName}* no nosso aplicativo.\nGostaria de tirar alguma dúvida sobre disponibilidade ou condições de pagamento?`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function exportLeadsToCsv(leads: CustomerLead[]): string {
  const headers = ["ID", "Data", "Nome", "WhatsApp", "Produto", "Variante", "Status", "Valor Estimado (R$)", "Anotações"];
  const rows = leads.map((lead) => [
    lead.id,
    new Date(lead.createdAt).toLocaleString("pt-BR"),
    `"${(lead.name || "").replace(/"/g, '""')}"`,
    lead.whatsapp,
    `"${(lead.productName || "").replace(/"/g, '""')}"`,
    `"${(lead.variantChosen || "").replace(/"/g, '""')}"`,
    lead.status,
    lead.estimatedValue ? lead.estimatedValue.toFixed(2) : "",
    `"${(lead.notes || "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}
