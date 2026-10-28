import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireStoreAdmin } from "../lib/admin-access";
import { detectInstallPlatform } from "../lib/app-install";
import { normalizeProduct, normalizeSettings } from "../lib/catalog";
import { iphoneLineup } from "../lib/iphone-models";
import { deleteCustomerLead, getStoredLeads, loadLeads, saveCustomerLead, updateLeadStatus } from "../lib/catalog-crm";

function mockClient(result: { data: unknown; error: unknown }, user: { id: string; email?: string } | null = { id: "owner-1" }) {
  const filters: unknown[][] = [];
  const query = {
    select: () => query, order: () => query, limit: () => query,
    insert: () => query, update: () => query, delete: () => query,
    eq: (...args: unknown[]) => { filters.push(args); return query; },
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return {
    client: { auth: { getUser: async () => ({ data: { user }, error: null }) }, from: () => query } as unknown as SupabaseClient,
    filters,
  };
}

test("installation selects iOS for iPhone and desktop-mode iPad", () => {
  assert.equal(detectInstallPlatform({ userAgent: "iPhone Safari", platform: "iPhone", maxTouchPoints: 5 }), "ios");
  assert.equal(detectInstallPlatform({ userAgent: "Macintosh Safari", platform: "MacIntel", maxTouchPoints: 5 }), "ios");
  assert.equal(detectInstallPlatform({ userAgent: "Macintosh Safari", platform: "MacIntel", maxTouchPoints: 0 }), "android");
  assert.equal(detectInstallPlatform({ userAgent: "Android Chrome", platform: "Linux", maxTouchPoints: 5 }), "android");
});

test("normalization never invents discounts or installments", () => {
  const product = normalizeProduct({ price: 1000 }, 0);
  assert.equal(product.pricePix, null);
  assert.equal(product.installments, null);
  assert.equal(product.stockQuantity, null);
});

test("normalization rejects infinite/negative prices and preserves explicit zero", () => {
  assert.equal(normalizeProduct({ price: Infinity }, 0).price, null);
  assert.equal(normalizeProduct({ price: -10 }, 0).price, null);
  const product = normalizeProduct({ price: 200, pricePix: 0, stockQuantity: -1 }, 0);
  assert.equal(product.pricePix, 0);
  assert.equal(product.stockQuantity, 0);
});

test("custom phone models survive normalization; unusable models are rejected", () => {
  const custom = { ...iphoneLineup[0], id: "custom-galaxy", generation: 24 };
  assert.deepEqual(normalizeSettings({ custom_phone_models: [custom] }).custom_phone_models, [custom]);
  assert.deepEqual(normalizeSettings({ custom_phone_models: [{ ...custom, finishes: [] }] }).custom_phone_models, []);
});

test("a special email without an owner row never grants admin access", async () => {
  const { client } = mockClient({ data: null, error: null }, { id: "visitor", email: "joaopro9678@gmail.com" });
  await assert.rejects(requireStoreAdmin(client), /não tem acesso/);
});

test("permission errors fail closed even if catalog data is readable", async () => {
  const { client } = mockClient({ data: null, error: { code: "42501" } });
  await assert.rejects(requireStoreAdmin(client), /verificar sua permissão/);
});

test("expired sessions cannot authorize store mutations", async () => {
  const { client } = mockClient({ data: { user_id: "owner-1" }, error: null }, null);
  await assert.rejects(requireStoreAdmin(client), /sessão expirou/);
});

test("admin access is scoped to the verified user's own owner row", async () => {
  const { client, filters } = mockClient({ data: { user_id: "owner-1" }, error: null });
  assert.equal((await requireStoreAdmin(client)).id, "owner-1");
  assert.deepEqual(filters, [["user_id", "owner-1"]]);
});

test("an empty cloud CRM remains empty", async () => {
  assert.deepEqual(await loadLeads(mockClient({ data: [], error: null }).client), []);
});

test("CRM read failures surface instead of returning demo contacts", async () => {
  await assert.rejects(loadLeads(mockClient({ data: null, error: { code: "42501" } }).client), /carregar os contatos/);
  assert.deepEqual(getStoredLeads(), []);
});

test("CRM writes report database errors and zero affected rows", async () => {
  const denied = mockClient({ data: null, error: { code: "42501" } }).client;
  const invisible = mockClient({ data: [], error: null }).client;
  assert.equal(await updateLeadStatus("missing", "fechado", undefined, denied), false);
  assert.equal(await deleteCustomerLead("missing", invisible), false);
});

test("a successful CRM update requires an affected row", async () => {
  const allowed = mockClient({ data: [{ id: "lead-1" }], error: null }).client;
  assert.equal(await updateLeadStatus("lead-1", "fechado", undefined, allowed), true);
});

test("cloud capture does not silently replace a failed insert with local storage", async () => {
  await assert.rejects(saveCustomerLead({ name: "Cliente", whatsapp: "5514999999999", productName: "Produto", status: "novo" },
    mockClient({ data: null, error: { code: "42501" } }).client), /registrar o contato/);
});
