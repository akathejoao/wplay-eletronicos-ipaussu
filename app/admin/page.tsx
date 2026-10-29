"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FolderPlus,
  ImagePlus,
  KeyRound,
  Layers,
  Link2,
  Lock,
  LogOut,
  MessageSquare,
  Bell,
  Send,
  Users,
  Search,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { AdminPhoneModelsTab } from "@/app/components/AdminPhoneModelsTab";
import {
  AdminAuditEntry,
  adminAuditStorageKey,
  adminLockoutStorageKey,
  AdminLockoutState,
  AdminSessionPayload,
  adminSessionStorageKey,
  compressImageFile,
  CustomerLead,
  defaultAdminPinHash,
  defaultProductCategories,
  defaultStoreSettings,
  formatCurrencyBRL,
  getDefaultVariantsForCategory,
  getFallbackImageForCategory,
  handleImageErrorFallback,
  hashAdminSecret,
  HeroSlideConfig,
  initialProducts,
  isValidImageSrc,
  normalizePhoneDigits,
  normalizeProduct,
  normalizeSettings,
  officialLogoPath,
  Product,
  productsStorageKey,
  sanitizeExternalUrl,
  settingsStorageKey,
  StoreSettings,
  studioGallery,
  verifyAdminCredentials,
} from "@/lib/catalog";
import { createClient, isLocalDemoHost } from "@/lib/supabase";
import { requireStoreAdmin } from "@/lib/admin-access";
import { notifyCatalogChanged } from "@/lib/catalog-cache";
import { uploadCatalogImage } from "@/lib/catalog-media";
import {
  basicProductColumns,
  isMissingColumnError,
  productColumns,
  productFromDatabase,
  productToDatabase,
  settingsFromDatabase,
  settingsToDatabase,
} from "@/lib/catalog-repository";
import { AdminAccessManager } from "@/app/components/AdminAccessManager";
import { buildFollowUpWhatsAppHref, loadLeads, updateLeadStatus } from "@/lib/catalog-crm";

type AdminTab = "fotos" | "produtos" | "categorias" | "modelos" | "crm" | "push" | "seguranca" | "config";
type PhotoFramingDraft = {
  productId: string;
  imageScale: number;
  imagePosition: string;
};

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds
const adminAuthFlowStorageKey = "wplay-admin-auth-flow-v1";

function parsePositionPercent(pos: string | undefined): { x: number; y: number } {
  if (!pos) return { x: 50, y: 50 };
  const parts = pos.trim().split(/\s+/);
  const x = Number.parseFloat(parts[0] ?? "50");
  const y = Number.parseFloat(parts[1] ?? "50");
  return {
    x: Number.isNaN(x) ? 50 : Math.min(100, Math.max(0, x)),
    y: Number.isNaN(y) ? 50 : Math.min(100, Math.max(0, y)),
  };
}

function formatRemainingTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${String(remMins).padStart(2, "0")}m`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [tab, setTab] = useState<AdminTab>("fotos");
  const [notice, setNotice] = useState("");

  // Hardened Authentication & Session state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [cloudDataLoaded, setCloudDataLoaded] = useState(false);
  const [cloudLoadError, setCloudLoadError] = useState("");
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [passwordlessSession, setPasswordlessSession] = useState(false);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [emailActionMessage, setEmailActionMessage] = useState("");
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [authUserLabel, setAuthUserLabel] = useState("admin");
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [remainingSessionMs, setRemainingSessionMs] = useState<number>(SESSION_TTL_MS);

  // Brute-force Lockout & Security Audit Log
  const [lockoutState, setLockoutState] = useState<AdminLockoutState>({
    attempts: 0,
    lockUntil: 0,
  });
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(0);
  const [auditLog, setAuditLog] = useState<AdminAuditEntry[]>([]);

  // Password Change state in "seguranca" tab
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newAdminUserInput, setNewAdminUserInput] = useState("admin");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmNewPinInput, setConfirmNewPinInput] = useState("");
  const [securityMsg, setSecurityMsg] = useState("");

  // Photo Studio state ("fotos" tab)
  const [selectedPhotoProductId, setSelectedPhotoProductId] = useState<string>(
    initialProducts[0]?.id || "iphone-pro"
  );
  const [photoUrlDraft, setPhotoUrlDraft] = useState("");
  const [newGalleryLabel, setNewGalleryLabel] = useState("");
  const [selectedHeroIdx, setSelectedHeroIdx] = useState<number>(0);
  const [heroImageUrlDraft, setHeroImageUrlDraft] = useState<{ slideId: string; value: string } | null>(null);
  const [heroTitleDraft, setHeroTitleDraft] = useState<{ slideId: string; value: string } | null>(null);
  const [framingDraft, setFramingDraft] = useState<PhotoFramingDraft | null>(null);
  const [savingFraming, setSavingFraming] = useState(false);

  // Products CRUD state ("produtos" tab)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [variantsText, setVariantsText] = useState("");
  const [inlineNewCategory, setInlineNewCategory] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");

  // CRM Leads & Follow-up state ("crm" tab)
  const [leads, setLeads] = useState<CustomerLead[]>([]);
  const [leadsLoadError, setLeadsLoadError] = useState("");
  const [crmFilter, setCrmFilter] = useState<string>("todos");
  const [crmSearch, setCrmSearch] = useState<string>("");
  const [editingLeadNoteId, setEditingLeadNoteId] = useState<string | null>(null);
  const [leadNoteDraft, setLeadNoteDraft] = useState<string>("");

  // Push Notifications state ("push" tab)
  const [pushTitleDraft, setPushTitleDraft] = useState<string>("🚀 Novidades Exclusivas na WPlay!");
  const [pushBodyDraft, setPushBodyDraft] = useState<string>("Novos aparelhos lacrados a pronta entrega com descontos especiais no PIX. Confira!");
  const [isSendingPush, setIsSendingPush] = useState<boolean>(false);
  const [pushUrlDraft, setPushUrlDraft] = useState<string>("/#catalogo");
  const [pushImageDraft, setPushImageDraft] = useState<string>("");
  const [pushSubscriberCount, setPushSubscriberCount] = useState<number>(0);
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState<boolean>(false);
  const [isBroadcastingPush, setIsBroadcastingPush] = useState<boolean>(false);
  const [pushPreviewOS, setPushPreviewOS] = useState<"ios" | "android">("ios");
  const [pushTargetProduct, setPushTargetProduct] = useState<string>("");
  const [pushLastResult, setPushLastResult] = useState<{
    total: number;
    sent: number;
    failed: number;
    removed: number;
    timestamp: string;
  } | null>(null);

  // Settings state ("config" tab)
  const [draftSettings, setDraftSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [hoursTextarea, setHoursTextarea] = useState(
    defaultStoreSettings.hours_lines.join("\n")
  );

  const supabase = useMemo(() => createClient(), []);
  const localDemoMode = !supabase && isLocalDemoHost();

  const refreshLeads = useCallback(async () => {
    try {
      setLeads(await loadLeads(supabase));
      setLeadsLoadError("");
    } catch (caught) {
      setLeads([]);
      setLeadsLoadError(caught instanceof Error ? caught.message : "Não foi possível carregar os contatos.");
    }
  }, [supabase]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void refreshLeads();
    const handleUpdate = () => { void refreshLeads(); };
    window.addEventListener("wplay-leads-updated", handleUpdate);
    return () => window.removeEventListener("wplay-leads-updated", handleUpdate);
  }, [isAuthenticated, refreshLeads]);

  const crmMetrics = useMemo(() => {
    const total = leads.length;
    const novos = leads.filter((l) => l.status === "novo").length;
    const emNegociacao = leads.filter((l) => l.status === "em_negociacao").length;
    const fechados = leads.filter((l) => l.status === "fechado").length;
    const aguardando = leads.filter((l) => l.status === "aguardando_reposicao").length;
    const valorPipeline = leads.reduce((acc, curr) => acc + (curr.estimatedValue || 0), 0);
    return { total, novos, emNegociacao, fechados, aguardando, valorPipeline };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (crmFilter !== "todos" && lead.status !== crmFilter) return false;
      if (crmSearch.trim()) {
        const q = crmSearch.toLowerCase();
        const matchName = lead.name.toLowerCase().includes(q);
        const matchPhone = lead.whatsapp.toLowerCase().includes(q);
        const matchProd = lead.productName.toLowerCase().includes(q);
        const matchVariant = (lead.variantChosen || "").toLowerCase().includes(q);
        const matchNotes = (lead.notes || "").toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchProd && !matchVariant && !matchNotes) return false;
      }
      return true;
    });
  }, [leads, crmFilter, crmSearch]);

  const handleUpdateLeadStatus = async (
    id: string,
    newStatus: CustomerLead["status"],
    notes?: string
  ) => {
    const ok = await updateLeadStatus(id, newStatus, notes, supabase);
    if (ok) {
      await refreshLeads();
      showToast("Status do cliente atualizado!");
    } else {
      showToast("Não foi possível atualizar o contato. Verifique sua conexão e permissão.");
    }
  };


  const handleSaveLeadNote = async (id: string) => {
    const target = leads.find((l) => l.id === id);
    if (!target) return;
    const saved = await updateLeadStatus(id, target.status, leadNoteDraft, supabase);
    if (!saved) { showToast("A anotação não foi salva. Tente novamente."); return; }
    await refreshLeads();
    setEditingLeadNoteId(null);
    showToast("Anotação do cliente salva!");
  };

  const fetchPushSubscribersCount = useCallback(async () => {
    setIsLoadingSubscribers(true);
    try {
      const response = await fetch("/api/notifications/subscribe", {
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        const data = await response.json();
        setPushSubscriberCount(typeof data.count === "number" ? data.count : 0);
      }
    } catch {
      // Ignore count fetch error
    } finally {
      setIsLoadingSubscribers(false);
    }
  }, []);

  const applyPushTemplate = (type: "oferta" | "reposicao" | "cupom" | "ultimas") => {
    const prod = products.find((p) => p.id === pushTargetProduct) || products[0];
    const prodName = prod?.name || "iPhone 15 Pro Max";
    const prodUrl = prod ? `/#produto-${prod.id}` : "/#catalogo";
    const prodImg = prod?.image || "";

    switch (type) {
      case "oferta":
        setPushTitleDraft("🔥 Oferta Relâmpago na WPlay!");
        setPushBodyDraft(`Só hoje na WPlay! ${prodName} com desconto especial no Pix. Toque para ver!`);
        setPushUrlDraft(prodUrl);
        setPushImageDraft(prodImg);
        break;
      case "reposicao":
        setPushTitleDraft("📦 Reposição de Estoque!");
        setPushBodyDraft(`Ele voltou! O ${prodName} acabou de chegar na loja. Garanta o seu antes que acabe!`);
        setPushUrlDraft(prodUrl);
        setPushImageDraft(prodImg);
        break;
      case "cupom":
        setPushTitleDraft("🎟️ Cupom Exclusivo do App!");
        setPushBodyDraft("Presente pra você que tem o nosso App! Use o cupom WPLAYAPP hoje.");
        setPushUrlDraft("/#catalogo");
        setPushImageDraft(prodImg);
        break;
      case "ultimas":
        setPushTitleDraft("⚡ Últimas Unidades!");
        setPushBodyDraft(`Restam poucas unidades de ${prodName} com preço antigo. Confira no catálogo!`);
        setPushUrlDraft(prodUrl);
        setPushImageDraft(prodImg);
        break;
    }
  };

  const handleBroadcastPush = async () => {
    if (!pushTitleDraft.trim() || !pushBodyDraft.trim()) {
      showToast("Preencha o título e a mensagem para disparar.");
      return;
    }

    if (!confirm(`Confirmar disparo para ${pushSubscriberCount} dispositivo(s) cadastrado(s)?`)) {
      return;
    }

    setIsBroadcastingPush(true);
    try {
      let token = "";
      if (supabase) {
        const session = (await supabase.auth.getSession()).data.session;
        token = session?.access_token ? `Bearer ${session.access_token}` : "";
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = token;
      }
      headers["x-admin-key"] = "wplay-admin-verified";
      headers["x-admin-session"] = "active";

      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: pushTitleDraft.trim(),
          body: pushBodyDraft.trim(),
          url: pushUrlDraft.trim() || "/",
          image: pushImageDraft.trim() || undefined,
          badge: "/icons/icon-192.png",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao processar disparo no servidor.");
      }

      const stats = data.stats || { total: 0, sent: 0, failed: 0, removed: 0 };
      setPushLastResult({
        ...stats,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      });

      showToast(`Disparo realizado! ${stats.sent} enviado(s) com sucesso.`);
      void fetchPushSubscribersCount();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido ao disparar notificações.";
      showToast(msg);
    } finally {
      setIsBroadcastingPush(false);
    }
  };

  const handleTestLocalPush = async () => {
    if (!("Notification" in window)) {
      showToast("Notificações não são suportadas neste navegador. No iPhone, abra o app instalado na Tela de Início.");
      return;
    }
    setIsSendingPush(true);
    try {
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        showToast("Permissão de notificações não concedida no navegador.");
        return;
      }
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw.js");
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          const ready = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Tempo de espera excedido.")), 8_000); }),
          ]);
          await ready.showNotification(pushTitleDraft || "WPlay Eletrônicos", { body: pushBodyDraft, icon: officialLogoPath, data: { url: pushUrlDraft || "/" }, ...(pushImageDraft ? { image: pushImageDraft } : {}) } as NotificationOptions);
        } finally { clearTimeout(timeout); }
      } else {
        new Notification(pushTitleDraft || "WPlay Eletrônicos", { body: pushBodyDraft, icon: officialLogoPath, ...(pushImageDraft ? { image: pushImageDraft } : {}) } as NotificationOptions);
      }
      showToast("Notificação de teste exibida neste dispositivo.");
    } catch {
      showToast("Não foi possível exibir o teste. Verifique as permissões do navegador.");
    } finally {
      setIsSendingPush(false);
    }
  };

  // Categories state ("categorias" tab)

  const productsRef = useRef(products);
  productsRef.current = products;
  const productPatchQueueRef = useRef<Promise<void>>(Promise.resolve());
  const framingDraftRef = useRef(framingDraft);
  framingDraftRef.current = framingDraft;
  const draftStateRef = useRef({ settings, draftSettings, hoursTextarea, editingProduct, framingDraft });
  draftStateRef.current = { settings, draftSettings, hoursTextarea, editingProduct, framingDraft };

  const loadCloudData = useCallback(async (background = false) => {
    if (!supabase) return { success: false, error: "Conexão com a loja indisponível." };
    setCloudDataLoaded(false);
    setCloudLoadError("");
    try {
      const [productsResult, settingsResult] = await Promise.all([
        supabase
          .from("products")
          .select(productColumns)
          .order("created_at", { ascending: false }),
        supabase
          .from("store_settings")
          .select("*")
          .eq("id", true)
          .maybeSingle(),
      ]);

      let productRows: Record<string, unknown>[] = productsResult.data || [];
      let productError = productsResult.error;
      if (isMissingColumnError(productError)) {
        const fallback = await supabase.from("products").select(basicProductColumns).order("created_at", { ascending: false });
        productRows = fallback.data || [];
        productError = fallback.error;
      }

      const errors: string[] = [];
      if (productError) {
        errors.push(`Produtos: ${productError.message}`);
      }
      if (settingsResult.error) {
        errors.push(`Configurações: ${settingsResult.error.message}`);
      }
      if (errors.length) {
        const message = errors.join(" ");
        setCloudLoadError(message);
        return { success: false, error: message };
      }

      const loadedProducts = productRows.map((row, index) =>
        normalizeProduct(
          productFromDatabase(row as unknown as Record<string, unknown>),
          index
        )
      );
      const loadedSettings = settingsResult.data
        ? normalizeSettings(
            settingsFromDatabase(
              settingsResult.data as unknown as Record<string, unknown>
            )
          )
          : defaultStoreSettings;
      const currentDraft = draftStateRef.current;
      const hasDirtyDraft =
        currentDraft.editingProduct !== null ||
        currentDraft.framingDraft !== null ||
        JSON.stringify(currentDraft.draftSettings) !== JSON.stringify(currentDraft.settings) ||
        currentDraft.hoursTextarea !== currentDraft.settings.hours_lines.join("\n");
      if (!background || !hasDirtyDraft) {
        productsRef.current = loadedProducts;
        setProducts(loadedProducts);
      }
      if (!background || !hasDirtyDraft) {
        setSettings(loadedSettings);
        setDraftSettings(loadedSettings);
        setHoursTextarea(loadedSettings.hours_lines.join("\n"));
      }
      if (!background || !hasDirtyDraft) {
        setSelectedPhotoProductId((currentId) =>
          loadedProducts.some((product) => product.id === currentId)
            ? currentId
            : loadedProducts[0]?.id || ""
        );
      }
      setCloudDataLoaded(true);
      return { success: true, error: "" };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Falha de rede ao carregar a loja.";
      setCloudLoadError(message);
      return { success: false, error: message };
    }
  }, [supabase]);

  const appendAuditEntry = useCallback(
    (
      event: AdminAuditEntry["event"],
      user: string,
      detail: string
    ) => {
      const entry: AdminAuditEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleString("pt-BR"),
        event,
        user: user || "desconhecido",
        detail,
      };
      setAuditLog((prev) => {
        const next = [entry, ...prev].slice(0, 40);
        try {
          localStorage.setItem(adminAuditStorageKey, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  const authorizeCloudUser = useCallback(
    async (user: { id: string; email?: string | null }) => {
      if (!supabase) return false;
      try {
        // Claim only an existing invitation, then verify this user's owner row.
        await supabase.rpc("claim_store_admin");
        await requireStoreAdmin(supabase);

        const loadResult = await loadCloudData();
        if (!loadResult.success) {
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          setLoginError(`Acesso validado, mas os dados da loja não carregaram. ${loadResult.error}`);
          return false;
        }

        const label = user.email || "Administrador";
        const expiresAt = Date.now() + SESSION_TTL_MS;
        setAuthUserLabel(label);
        setSessionExpiresAt(expiresAt);
        setRemainingSessionMs(SESSION_TTL_MS);
        setIsAuthenticated(true);
        setLoginPass("");
        appendAuditEntry("login_success", label, "Autenticação segura e administrador verificado");
        return true;
      } catch (caught) {
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        setLoginError(
          caught instanceof Error
            ? `Não foi possível validar o acesso: ${caught.message}`
            : "Não foi possível validar o acesso de administrador."
        );
        return false;
      }
    },
    [appendAuditEntry, loadCloudData, supabase]
  );

  const handleLogout = useCallback(
    async (reason = "Sessão encerrada pelo administrador") => {
      sessionStorage.removeItem(adminSessionStorageKey);
      if (supabase) {
        await supabase.auth.signOut();
      }
      appendAuditEntry("logout", authUserLabel, reason);
      setIsAuthenticated(false);
      setSessionExpiresAt(null);
      setLeads([]);
      setLoginPass("");
    },
    [appendAuditEntry, authUserLabel, supabase]
  );

  useEffect(() => {
    let cancelled = false;
    try {
      const savedAudit = localStorage.getItem(adminAuditStorageKey);
      if (savedAudit) {
        const parsedAudit = JSON.parse(savedAudit) as AdminAuditEntry[];
        if (Array.isArray(parsedAudit)) setAuditLog(parsedAudit);
      }
      const savedLockout = localStorage.getItem(adminLockoutStorageKey);
      if (savedLockout) {
        const parsedLock = JSON.parse(savedLockout) as AdminLockoutState;
        if (parsedLock && typeof parsedLock.lockUntil === "number") {
          setLockoutState(parsedLock);
        }
      }

      if (localDemoMode) {
        const savedProducts = localStorage.getItem(productsStorageKey);
        if (savedProducts) {
          const parsed = JSON.parse(savedProducts) as Partial<Product>[];
          if (Array.isArray(parsed)) {
            const normalized = parsed.map((item, idx) => normalizeProduct(item, idx));
            setProducts(normalized);
            if (normalized[0]) setSelectedPhotoProductId(normalized[0].id);
          }
        }
        const savedSettings = localStorage.getItem(settingsStorageKey);
        if (savedSettings) {
          const parsedSettings = normalizeSettings(
            JSON.parse(savedSettings) as Partial<StoreSettings>
          );
          setSettings(parsedSettings);
          setDraftSettings(parsedSettings);
          setNewAdminUserInput(parsedSettings.admin_user || "admin");
          setHoursTextarea(parsedSettings.hours_lines.join("\n"));
        }
        setCloudDataLoaded(true);
        const savedSessionRaw = sessionStorage.getItem(adminSessionStorageKey);
        if (savedSessionRaw) {
          const sessionObj = JSON.parse(savedSessionRaw) as AdminSessionPayload;
          if (sessionObj && sessionObj.expiresAt > Date.now()) {
            setIsAuthenticated(true);
            setAuthUserLabel(sessionObj.user);
            setSessionExpiresAt(sessionObj.expiresAt);
            setRemainingSessionMs(sessionObj.expiresAt - Date.now());
          } else {
            sessionStorage.removeItem(adminSessionStorageKey);
          }
        }
      }
    } catch {
      // ignore storage read error
    }

    if (!supabase) {
      sessionStorage.removeItem(adminSessionStorageKey);
      setAuthChecking(false);
      return () => {
        cancelled = true;
      };
    }

    sessionStorage.removeItem(adminSessionStorageKey);
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        setPasswordlessSession(true);
        window.setTimeout(() => {
          void authorizeCloudUser(session.user).then((authorized) => {
            if (!cancelled && authorized) setIsPasswordRecovery(true);
          });
        }, 0);
      }
      if (event === "SIGNED_OUT" && !cancelled) {
        setIsAuthenticated(false);
        setSessionExpiresAt(null);
      }
    });

    void supabase.auth.getUser().then(async ({ data, error }) => {
      if (cancelled) return;
      if (!error && data.user) {
        const authFlow = sessionStorage.getItem(adminAuthFlowStorageKey);
        const authorized = await authorizeCloudUser(data.user);
        if (!cancelled && authorized) {
          setPasswordlessSession(authFlow === "email" || authFlow === "signup" || authFlow === "recovery");
          sessionStorage.removeItem(adminAuthFlowStorageKey);
        }
      }
      if (!cancelled) setAuthChecking(false);
    }).catch((caught) => {
      if (!cancelled) {
        setLoginError(caught instanceof Error ? caught.message : "Não foi possível verificar a sessão.");
        setAuthChecking(false);
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [authorizeCloudUser, localDemoMode, supabase]);

  useEffect(() => {
    if (!supabase || !isAuthenticated) return;
    let refreshing = false;
    let lastRefreshAt = 0;
    const refreshCooldownMs = 5 * 60 * 1000;
    const refreshCloudState = async () => {
      const now = Date.now();
      if (
        refreshing ||
        document.visibilityState === "hidden" ||
        now - lastRefreshAt < refreshCooldownMs
      ) return;
      refreshing = true;
      lastRefreshAt = now;
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          setCloudDataLoaded(false);
          setLoginError("Sua sessão expirou. Entre novamente.");
          return;
        }
        try {
          await requireStoreAdmin(supabase);
        } catch {
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          setCloudDataLoaded(false);
          setLeads([]);
          setLoginError("O acesso de administrador foi removido ou não pôde ser verificado.");
          return;
        }
        const loadResult = await loadCloudData(true);
        if (!loadResult.success) {
          showToast(`Falha ao atualizar os dados da loja. ${loadResult.error}`);
        }
      } finally {
        refreshing = false;
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshCloudState();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isAuthenticated, loadCloudData, supabase]);

  useEffect(() => {
    if (!framingDraft) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [framingDraft]);

  // Live Lockout Countdown Timer
  useEffect(() => {
    const updateLockout = () => {
      const rem = Math.max(0, Math.ceil((lockoutState.lockUntil - Date.now()) / 1000));
      setLockoutRemainingSec(rem);
    };
    updateLockout();
    if (lockoutState.lockUntil <= Date.now()) return;
    const timer = window.setInterval(updateLockout, 1000);
    return () => window.clearInterval(timer);
  }, [lockoutState.lockUntil]);

  // Live Session Expiration Timer
  useEffect(() => {
    if (!isAuthenticated || !sessionExpiresAt) return;
    const timer = window.setInterval(() => {
      const rem = sessionExpiresAt - Date.now();
      if (rem <= 0) {
        void handleLogout("Sessão expirada automaticamente por segurança (TTL)");
      } else {
        setRemainingSessionMs(rem);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [handleLogout, isAuthenticated, sessionExpiresAt]);

  const activePhotoProduct = useMemo(() => {
    return (
      products.find((p) => p.id === selectedPhotoProductId) ||
      products[0] ||
      (localDemoMode ? initialProducts[0] : null)
    );
  }, [localDemoMode, products, selectedPhotoProductId]);

  useEffect(() => {
    if (activePhotoProduct) {
      setPhotoUrlDraft(activePhotoProduct.image);
    }
  }, [activePhotoProduct]);

  const allCategories = useMemo(() => {
    const fromSettings = settings.custom_categories?.length
      ? settings.custom_categories
      : defaultProductCategories;
    const fromProducts = products.map((p) => p.category);
    return Array.from(new Set([...fromSettings, ...fromProducts]));
  }, [settings.custom_categories, products]);

  const galleryOptions = useMemo(() => {
    const custom = settings.custom_gallery || [];
    const merged = [...custom, ...studioGallery];
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (seen.has(item.src)) return false;
      seen.add(item.src);
      return true;
    });
  }, [settings.custom_gallery]);

  // Link & Media Integrity Diagnostic Report ("Segurança & Links" tab)
  const linkHealthReport = useMemo(() => {
    const checks: {
      id: string;
      label: string;
      target: string;
      healthy: boolean;
      detail: string;
    }[] = [];

    const waCheck = sanitizeExternalUrl(
      settings.whatsapp_url,
      defaultStoreSettings.whatsapp_url
    );
    checks.push({
      id: "whatsapp",
      label: "WhatsApp Oficial",
      target: waCheck.url,
      healthy: !waCheck.repaired,
      detail: waCheck.repaired
        ? "URL reparada automaticamente pelo fallback"
        : "Link verificado e ativo",
    });

    const igCheck = sanitizeExternalUrl(
      settings.instagram_url,
      defaultStoreSettings.instagram_url
    );
    checks.push({
      id: "instagram",
      label: "Instagram Oficial",
      target: igCheck.url,
      healthy: !igCheck.repaired,
      detail: igCheck.repaired
        ? "URL reparada automaticamente pelo fallback"
        : "Link verificado e ativo",
    });

    const mapsCheck = sanitizeExternalUrl(
      settings.maps_url,
      defaultStoreSettings.maps_url
    );
    checks.push({
      id: "maps",
      label: "Google Maps Rota",
      target: mapsCheck.url,
      healthy: !mapsCheck.repaired,
      detail: mapsCheck.repaired
        ? "URL reparada automaticamente pelo fallback"
        : "Link verificado e ativo",
    });

    const logoHealthy = isValidImageSrc(settings.logo_url);
    checks.push({
      id: "logo",
      label: "Logo Oficial da Marca",
      target: settings.logo_url || officialLogoPath,
      healthy: logoHealthy,
      detail: logoHealthy ? "Imagem válida" : "Protegido por fallback oficial",
    });

    for (const prod of products) {
      const imgOk = isValidImageSrc(prod.image);
      checks.push({
        id: `prod-${prod.id}`,
        label: `Foto: ${prod.name}`,
        target: prod.image || getFallbackImageForCategory(prod.category),
        healthy: imgOk,
        detail: imgOk ? "Mídia íntegra" : "Fallback automático ativo",
      });
    }

    return checks;
  }, [products, settings]);

  const showToast = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((curr) => (curr === msg ? "" : curr));
    }, 3400);
  };

  const ensureCloudOwner = async () => {
    if (!supabase || !isAuthenticated || !cloudDataLoaded) {
      showToast("Aguarde o carregamento seguro dos dados antes de salvar.");
      return false;
    }
    try {
      await requireStoreAdmin(supabase);
      return true;
    } catch (caught) {
      showToast(
        caught instanceof Error
          ? `Falha ao verificar a permissão: ${caught.message}`
          : "Falha ao verificar a permissão para salvar."
      );
      return false;
    }
  };

  const notifyCatalogCacheBestEffort = async (client: SupabaseClient) => {
    let notified = false;
    try {
      notified = await notifyCatalogChanged(client);
    } catch {
      notified = false;
    }
    if (!notified) {
      window.setTimeout(
        () => showToast("Dados salvos no banco; a vitrine pode levar mais tempo para refletir a alteração."),
        0
      );
    }
  };

  const persistProducts = async (next: Product[], deletedId?: string) => {
    if (supabase) {
      const currentProducts = productsRef.current;
      const changedProducts = deletedId
        ? []
        : next.filter((product) => {
            const current = currentProducts.find((item) => item.id === product.id);
            if (!current) return true;
            const stableCurrent = normalizeProduct(current, 0);
            const stableNext = normalizeProduct(product, 0);
            return JSON.stringify(stableCurrent) !== JSON.stringify(stableNext);
          });
      if (!deletedId && changedProducts.length === 0) {
        productsRef.current = next;
        setProducts(next);
        return true;
      }
      if (!(await ensureCloudOwner())) return false;
      try {
        const result = deletedId
          ? await supabase.from("products").delete().eq("id", deletedId).select("id")
          : await supabase.from("products").upsert(changedProducts.map((p) => productToDatabase(p))).select("id");
        if (result.error) {
          showToast(`Falha ao salvar produtos online: ${result.error.message}`);
          return false;
        }
        const wroteRows = (result.data?.length ?? 0) > 0;
        if (!wroteRows) { showToast("Nenhum produto foi alterado. Atualize o painel e verifique sua permissão."); return false; }
        productsRef.current = next;
        setProducts(next);
        if (wroteRows) await notifyCatalogCacheBestEffort(supabase);
        return true;
      } catch (caught) {
        showToast(
          caught instanceof Error
            ? `Falha ao salvar produtos online: ${caught.message}`
            : "Falha ao salvar produtos online."
        );
        return false;
      }
    }

    if (!localDemoMode) {
      showToast("Configuração online indisponível. O modo local só funciona neste computador.");
      return false;
    }
    try {
      localStorage.setItem(productsStorageKey, JSON.stringify(next));
      window.dispatchEvent(new Event("storage"));
      productsRef.current = next;
      setProducts(next);
      return true;
    } catch {
      showToast("Imagem muito pesada para salvar no navegador. Escolha outra mais leve.");
      return false;
    }
  };

  const persistSettings = async (nextSettings: StoreSettings) => {
    const normalizedSettings = normalizeSettings(nextSettings);
    const normalized = {
      ...normalizedSettings,
      custom_gallery: normalizedSettings.custom_gallery.slice(0, 60),
    };
    if (supabase) {
      const nextPublicSettings = settingsToDatabase(normalized);
      const currentPublicSettings = settingsToDatabase(normalizeSettings(settings));
      const changedColumns: Record<string, unknown> = {};
      for (const [column, value] of Object.entries(nextPublicSettings)) {
        if (column === "id" || column === "updated_at") continue;
        if (
          JSON.stringify(value) !==
          JSON.stringify(currentPublicSettings[column as keyof typeof currentPublicSettings])
        ) {
          changedColumns[column] = value;
        }
      }
      if (Object.keys(changedColumns).length === 0) {
        setSettings(normalized);
        setDraftSettings(normalized);
        showToast("Nenhuma alteração pública para sincronizar.");
        return true;
      }
      if (!(await ensureCloudOwner())) return false;
      try {
        const { error } = await supabase
          .from("store_settings")
          .upsert({ id: true, ...changedColumns });
        if (error) {
          showToast(`Falha ao salvar configurações online: ${error.message}`);
          return false;
        }
      } catch (caught) {
        showToast(
          caught instanceof Error
            ? `Falha ao salvar configurações online: ${caught.message}`
            : "Falha ao salvar configurações online."
        );
        return false;
      }
      setSettings(normalized);
      setDraftSettings(normalized);
      await notifyCatalogCacheBestEffort(supabase);
      showToast("Configurações sincronizadas!");
      return true;
    }
    if (!localDemoMode) {
      showToast("Configuração online indisponível. O modo local só funciona neste computador.");
      return false;
    }
    try {
      localStorage.setItem(settingsStorageKey, JSON.stringify(normalized));
      window.dispatchEvent(new Event("storage"));
    } catch {
      showToast("Não foi possível salvar no navegador.");
      return false;
    }

    setSettings(normalized);
    setDraftSettings(normalized);
    showToast("Alterações salvas e publicadas na vitrine!");
    return true;
  };

  const handleSendEmailCode = async () => {
    if (!supabase) return;
    const email = loginUser.trim().toLowerCase();
    if (!email.includes("@")) {
      setLoginError("Informe o e-mail do convite para receber o código.");
      return;
    }
    setLoginError("");
    setEmailActionMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/admin`,
      },
    });
    if (error) {
      setLoginError(`Não foi possível enviar o código: ${error.message}`);
      return;
    }
    sessionStorage.setItem(adminAuthFlowStorageKey, "email");
    setEmailCodeSent(true);
    setEmailActionMessage("Enviamos um código ou link seguro para o e-mail informado.");
  };

  const handleVerifyEmailCode = async () => {
    if (!supabase) return;
    const email = loginUser.trim().toLowerCase();
    const token = emailCode.trim();
    if (!email.includes("@") || !token) {
      setLoginError("Informe o e-mail e o código recebido.");
      return;
    }
    setLoginError("");
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error || !data.user) {
      setLoginError(`Não foi possível validar o código: ${error?.message || "usuário não autenticado"}`);
      return;
    }
    setEmailCode("");
    if (await authorizeCloudUser(data.user)) {
      setPasswordlessSession(true);
      sessionStorage.removeItem(adminAuthFlowStorageKey);
    }
  };

  const handleCreateAccount = async () => {
    if (!supabase) return;
    const email = loginUser.trim().toLowerCase();
    if (!email.includes("@") || loginPass.length < 12) {
      setLoginError("Informe o e-mail convidado e uma senha com pelo menos 12 caracteres.");
      return;
    }
    setLoginError("");
    const { data, error } = await supabase.auth.signUp({
      email,
      password: loginPass,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    });
    if (error) {
      setLoginError(`Não foi possível criar a conta WPlay: ${error.message}`);
      return;
    }
    sessionStorage.setItem(adminAuthFlowStorageKey, "signup");
    setLoginPass("");
    if (data.session && data.user) {
      if (await authorizeCloudUser(data.user)) {
        setPasswordlessSession(true);
        sessionStorage.removeItem(adminAuthFlowStorageKey);
      }
    } else {
      setEmailActionMessage("Confira o e-mail e confirme a conta antes de voltar ao painel.");
    }
  };

  const handleSendPasswordRecovery = async () => {
    if (!supabase) return;
    const email = loginUser.trim().toLowerCase();
    if (!email.includes("@")) {
      setLoginError("Informe o e-mail da conta para receber o link de redefinição.");
      return;
    }
    setLoginError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin`,
    });
    if (!error) sessionStorage.setItem(adminAuthFlowStorageKey, "recovery");
    setEmailActionMessage(
      error
        ? `Não foi possível enviar o link: ${error.message}`
        : "Se a conta puder redefinir a senha, enviaremos um link seguro por e-mail."
    );
  };

  const handleSetRecoveredPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (newPinInput.length < 12) {
      setSecurityMsg("Use pelo menos 12 caracteres para a senha.");
      return;
    }
    if (newPinInput !== confirmNewPinInput) {
      setSecurityMsg("A confirmação da senha não confere.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPinInput });
    if (error) {
      setSecurityMsg(`Não foi possível atualizar a senha: ${error.message}`);
      return;
    }
    setNewPinInput("");
    setConfirmNewPinInput("");
    setIsPasswordRecovery(false);
    setPasswordlessSession(false);
    sessionStorage.removeItem(adminAuthFlowStorageKey);
    setSecurityMsg("");
    showToast("Senha da conta WPlay atualizada.");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (supabase) {
      const email = loginUser.trim().toLowerCase();
      if (!email.includes("@") || !loginPass) {
        setLoginError("Informe o e-mail e a senha da conta WPlay.");
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: loginPass,
      });
      if (error || !data.user) {
        setLoginError(`Não foi possível entrar: ${error?.message || "credenciais inválidas"}`);
        return;
      }
      sessionStorage.setItem(adminAuthFlowStorageKey, "password");
      if (await authorizeCloudUser(data.user)) {
        setPasswordlessSession(false);
        sessionStorage.removeItem(adminAuthFlowStorageKey);
      }
      return;
    }

    if (!localDemoMode) {
      setLoginError("O painel está temporariamente indisponível. Entre em contato com o responsável pela loja.");
      return;
    }

    if (lockoutState.lockUntil > Date.now()) {
      const waitSec = Math.ceil((lockoutState.lockUntil - Date.now()) / 1000);
      setLoginError(
        `Acesso temporariamente bloqueado por tentativas inválidas. Aguarde ${waitSec}s.`
      );
      return;
    }

    const trimmedUser = loginUser.trim();
    const isValidLocal = await verifyAdminCredentials(trimmedUser, loginPass, settings);

    if (isValidLocal) {
      const cleanLock: AdminLockoutState = { attempts: 0, lockUntil: 0 };
      setLockoutState(cleanLock);
      localStorage.setItem(adminLockoutStorageKey, JSON.stringify(cleanLock));

      const label = trimmedUser || settings.admin_user || "admin";
      const expiresAt = Date.now() + SESSION_TTL_MS;
      const sessionPayload: AdminSessionPayload = {
        user: label,
        issuedAt: Date.now(),
        expiresAt,
        token: Math.random().toString(36).slice(2),
      };
      sessionStorage.setItem(adminSessionStorageKey, JSON.stringify(sessionPayload));
      setAuthUserLabel(label);
      setSessionExpiresAt(expiresAt);
      setRemainingSessionMs(SESSION_TTL_MS);
      setIsAuthenticated(true);
      setLoginPass("");
      appendAuditEntry("login_success", label, "Autenticação validada via SHA-256");
      return;
    }

    const nextAttempts = lockoutState.attempts + 1;
    const triggeredLock = nextAttempts >= MAX_LOGIN_ATTEMPTS;
    const nextLockState: AdminLockoutState = {
      attempts: triggeredLock ? 0 : nextAttempts,
      lockUntil: triggeredLock ? Date.now() + LOCKOUT_DURATION_MS : 0,
    };
    setLockoutState(nextLockState);
    try {
      localStorage.setItem(adminLockoutStorageKey, JSON.stringify(nextLockState));
    } catch {
      // ignore
    }

    if (triggeredLock) {
      appendAuditEntry(
        "lockout_triggered",
        trimmedUser,
        `Bloqueio de 60s acionado após ${MAX_LOGIN_ATTEMPTS} tentativas falhas`
      );
      setLoginError(
        "Muitas tentativas incorretas. Painel bloqueado preventivamente por 60 segundos."
      );
    } else {
      const remAttempts = MAX_LOGIN_ATTEMPTS - nextAttempts;
      appendAuditEntry(
        "login_failed",
        trimmedUser,
        `Credenciais recusadas (${remAttempts} tentativa(s) restante(s))`
      );
      setLoginError(
        `Credenciais inválidas. Tentativas restantes antes do bloqueio: ${remAttempts}.`
      );
    }
  };

  const handleUpdateSecurityCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMsg("");
    if (supabase) {
      if (!(await ensureCloudOwner())) return;
      if (newPinInput.length < 12) {
        setSecurityMsg("Use pelo menos 12 caracteres para a senha da conta WPlay.");
        return;
      }
      if (newPinInput !== confirmNewPinInput) {
        setSecurityMsg("A confirmação da nova senha não confere.");
        return;
      }
      if (currentPinInput) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: authUserLabel,
          password: currentPinInput,
        });
        if (verifyError) {
          setSecurityMsg("A senha atual da conta WPlay está incorreta.");
          return;
        }
      } else if (!passwordlessSession) {
        setSecurityMsg("Informe a senha atual da conta WPlay para confirmar a alteração.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPinInput });
      if (error) {
        setSecurityMsg(`Não foi possível atualizar a senha da conta WPlay: ${error.message}`);
        return;
      }
      setCurrentPinInput("");
      setNewPinInput("");
      setConfirmNewPinInput("");
      setPasswordlessSession(false);
      appendAuditEntry("credentials_updated", authUserLabel, "Senha da conta WPlay atualizada");
      setSecurityMsg("Senha da conta WPlay atualizada com sucesso.");
      return;
    }
    const verified = await verifyAdminCredentials(
      settings.admin_user || "admin",
      currentPinInput,
      settings
    );
    if (!verified) {
      setSecurityMsg("A senha atual informada está incorreta.");
      return;
    }
    if (newPinInput.trim().length < 6) {
      setSecurityMsg("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPinInput.trim() !== confirmNewPinInput.trim()) {
      setSecurityMsg("A confirmação da nova senha não confere.");
      return;
    }
    const newHash = await hashAdminSecret(newPinInput.trim());
    const updatedSettings: StoreSettings = {
      ...settings,
      admin_user: newAdminUserInput.trim() || "admin",
      admin_pin: "",
      admin_pin_hash: newHash,
    };
    if (!(await persistSettings(updatedSettings))) return;
    setCurrentPinInput("");
    setNewPinInput("");
    setConfirmNewPinInput("");
    appendAuditEntry(
      "credentials_updated",
      authUserLabel,
      "Credenciais do painel recriptografadas com SHA-256"
    );
    setSecurityMsg("Credenciais atualizadas e criptografadas com sucesso!");
    showToast("Nova senha criptografada ativada!");
  };

  const handleRepairAllLinksAndImages = async () => {
    const repairedProducts = products.map((p, idx) => normalizeProduct(p, idx));
    const repairedSettings = normalizeSettings(settings);
    if (!(await persistProducts(repairedProducts))) return;
    if (!(await persistSettings(repairedSettings))) return;
    appendAuditEntry(
      "links_repaired",
      authUserLabel,
      "Varredura e reparo automático de links e imagens executados"
    );
    showToast("Todos os links e fotos foram verificados e blindados!");
  };

  // Photo Studio handlers
  const persistProductPatch = async (productId: string, patch: Partial<Product>) => {
    let saved = false;
    const operation = productPatchQueueRef.current.then(async () => {
      const current = productsRef.current;
      if (!current.some((product) => product.id === productId)) return;
      const next = current.map((product) =>
        product.id === productId ? { ...product, ...patch } : product
      );
      saved = await persistProducts(next);
    });
    productPatchQueueRef.current = operation.then(() => undefined, () => undefined);
    await operation;
    return saved;
  };

  const clearFramingDraft = () => {
    framingDraftRef.current = null;
    setFramingDraft(null);
  };

  const updateFramingDraft = (patch: Partial<PhotoFramingDraft>) => {
    if (!activePhotoProduct) return;
    const current = framingDraftRef.current?.productId === activePhotoProduct.id
      ? framingDraftRef.current
      : {
          productId: activePhotoProduct.id,
          imageScale: activePhotoProduct.imageScale ?? 1,
          imagePosition: activePhotoProduct.imagePosition || "50% 50%",
        };
    const next = { ...current, ...patch, productId: activePhotoProduct.id };
    framingDraftRef.current = next;
    setFramingDraft(next);
  };

  const saveFramingDraft = async () => {
    const draft = framingDraftRef.current;
    if (!draft) return true;
    if (savingFraming) return false;
    setSavingFraming(true);
    try {
      const saved = await persistProductPatch(draft.productId, {
        imageScale: draft.imageScale,
        imagePosition: draft.imagePosition,
      });
      if (saved && framingDraftRef.current === draft) clearFramingDraft();
      return saved;
    } finally {
      setSavingFraming(false);
    }
  };

  const changeTab = (nextTab: AdminTab) => {
    if (tab === "fotos" && nextTab !== "fotos" && framingDraftRef.current) {
      showToast("Salve o enquadramento antes de sair do Studio de Fotos.");
      return false;
    }
    setTab(nextTab);
    return true;
  };

  const updatePhotoForActiveProduct = async (patch: Partial<Product>, toastMsg?: string) => {
    if (!activePhotoProduct || savingFraming) return;
    const productId = activePhotoProduct.id;
    const draft = framingDraftRef.current;
    const patchWithDraft = draft?.productId === productId
      ? { imageScale: draft.imageScale, imagePosition: draft.imagePosition, ...patch }
      : patch;
    if (!(await persistProductPatch(productId, patchWithDraft))) return;
    if (draft?.productId === productId && framingDraftRef.current === draft) clearFramingDraft();
    if (toastMsg) showToast(toastMsg);
  };

  const handleUploadProductPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetProductId?: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const idToUpdate = targetProductId || activePhotoProduct?.id;
    if (!idToUpdate) return;
    try {
      const imageUrl = supabase
        ? await uploadCatalogImage(supabase, file, 1080)
        : await compressImageFile(file, 1080);
      const targetProd = productsRef.current.find((p) => p.id === idToUpdate);
      const draft = framingDraftRef.current;
      const imagePatch = draft?.productId === idToUpdate
        ? { image: imageUrl, imageScale: draft.imageScale, imagePosition: draft.imagePosition }
        : { image: imageUrl };
      if (!(await persistProductPatch(idToUpdate, imagePatch))) return;
      if (draft?.productId === idToUpdate && framingDraftRef.current === draft) clearFramingDraft();

      const nextGallery = [
        {
          id: `upload-${Date.now()}`,
          label: newGalleryLabel.trim() || targetProd?.name || "Foto enviada",
          src: imageUrl,
        },
        ...(settings.custom_gallery || studioGallery),
      ].slice(0, 60);
      if (!(await persistSettings({ ...settings, custom_gallery: nextGallery }))) return;
      setNewGalleryLabel("");
      showToast("Nova foto enviada e aplicada ao produto!");
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Não foi possível carregar essa imagem.");
    }
  };

  const restoreDemoProductPhoto = async () => {
    if (!activePhotoProduct) return;
    const demoProduct =
      initialProducts.find((product) => product.id === activePhotoProduct.id) ||
      initialProducts.find((product) => product.category === activePhotoProduct.category);
    await updatePhotoForActiveProduct(
      {
        image: demoProduct?.image || "/images/wplay-hero.jpg",
        imageFit: demoProduct?.imageFit || "cover",
        imagePosition: demoProduct?.imagePosition || "50% 50%",
        imageScale: demoProduct?.imageScale || 1,
      },
      "Foto de demonstração restaurada."
    );
  };

  const handleUploadHeroSlidePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imageUrl = supabase
        ? await uploadCatalogImage(supabase, file, 1200)
        : await compressImageFile(file, 1200);
      const slides = [...(settings.hero_slides || defaultStoreSettings.hero_slides)];
      if (!slides[selectedHeroIdx]) return;
      slides[selectedHeroIdx] = { ...slides[selectedHeroIdx], image: imageUrl };
      if (!(await persistSettings({ ...settings, hero_slides: slides }))) return;
      setHeroImageUrlDraft(null);
      showToast("Foto do destaque principal atualizada!");
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Erro ao processar foto do destaque.");
    }
  };

  const handleUpdateHeroSlide = async (patch: Partial<HeroSlideConfig>) => {
    const slides = [...(settings.hero_slides || defaultStoreSettings.hero_slides)];
    if (!slides[selectedHeroIdx]) return;
    if (
      supabase &&
      patch.image?.trim().toLowerCase().startsWith("data:image/") &&
      patch.image !== slides[selectedHeroIdx].image
    ) {
      showToast("Use o envio de imagem para salvar fotos da nuvem; URLs data:image não são aceitas.");
      return false;
    }
    slides[selectedHeroIdx] = { ...slides[selectedHeroIdx], ...patch };
    return await persistSettings({ ...settings, hero_slides: slides });
  };

  // Product Form handlers
  const startEditProduct = (p: Product) => {
    setEditingProduct(p);
    setInlineNewCategory("");
    setVariantsText(
      (p.variants && p.variants.length > 0
        ? p.variants
        : getDefaultVariantsForCategory(p.category)
      ).join(", ")
    );
  };

  const handleSaveProductForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    const finalCat = inlineNewCategory.trim()
      ? inlineNewCategory.trim()
      : editingProduct.category;

    if (inlineNewCategory.trim()) {
      const nextCats = Array.from(
        new Set([...(settings.custom_categories || allCategories), finalCat])
      );
      if (!(await persistSettings({ ...settings, custom_categories: nextCats }))) return;
    }

    const parsedVariants = variantsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const savedProd: Product = {
      ...editingProduct,
      category: finalCat,
      pricePix: editingProduct.pricePix !== undefined ? editingProduct.pricePix : null,
      installments: editingProduct.installments || undefined,
      stockQuantity: editingProduct.stockQuantity ?? null,
      variants:
        parsedVariants.length > 0
          ? parsedVariants
          : getDefaultVariantsForCategory(finalCat),
    };

    const exists = products.some((p) => p.id === savedProd.id);
    const next = exists
      ? products.map((p) => (p.id === savedProd.id ? savedProd : p))
      : [savedProd, ...products];

    if (!(await persistProducts(next))) return;
    setEditingProduct(null);
    setInlineNewCategory("");
    showToast("Produto salvo com sucesso!");
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newCategoryName.trim();
    if (!cleaned) return;
    const nextCats = Array.from(
      new Set([...(settings.custom_categories || allCategories), cleaned])
    );
    if (!(await persistSettings({ ...settings, custom_categories: nextCats }))) return;
    setNewCategoryName("");
    showToast(`Categoria "${cleaned}" criada!`);
  };

  const handleMoveCategory = async (index: number, direction: -1 | 1) => {
    const list = [...allCategories];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    await persistSettings({ ...settings, custom_categories: list });
  };

  const handleRemoveCategory = async (catName: string) => {
    const nextCats = allCategories.filter((c) => c !== catName);
    if (!(await persistSettings({
      ...settings,
      custom_categories: nextCats.length > 0 ? nextCats : defaultProductCategories,
    }))) return;
    showToast(`Categoria "${catName}" removida.`);
  };

  const handleSaveStoreConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const logoUrl = draftSettings.logo_url.trim();
    if (
      /^data:image\//i.test(logoUrl) &&
      logoUrl !== settings.logo_url.trim()
    ) {
      showToast("Data URI não pode ser usado como logo. Informe uma URL ou caminho de imagem.");
      return;
    }
    const parsedHours = hoursTextarea
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    await persistSettings({
      ...draftSettings,
      hours_lines:
        parsedHours.length > 0 ? parsedHours : defaultStoreSettings.hours_lines,
    });
  };

  if (authChecking) {
    return (
      <main className="admin-route-shell">
        <div className="admin-auth-card">
          <p>Verificando sessão segura...</p>
        </div>
      </main>
    );
  }

  if (isPasswordRecovery && supabase) {
    return (
      <main className="admin-route-shell">
        <div className="admin-auth-card">
          <h1>Definir nova senha</h1>
          <p>Use pelo menos 12 caracteres para concluir a recuperação da conta de administrador.</p>
          <form className="admin-auth-form" onSubmit={(e) => void handleSetRecoveredPassword(e)}>
            <label>
              Nova senha
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={confirmNewPinInput}
                onChange={(e) => setConfirmNewPinInput(e.target.value)}
              />
            </label>
            {securityMsg && <p className="admin-auth-error">{securityMsg}</p>}
            <button type="submit" className="button button-lime admin-auth-submit">
              <Lock size={16} /> Atualizar senha
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    if (!supabase && !localDemoMode) {
      return (
        <main className="admin-route-shell">
          <div className="admin-auth-card">
            <h1>Painel não configurado</h1>
            <p>O painel está temporariamente indisponível. Entre em contato com o responsável pela loja.</p>
            <Link href="/" className="admin-back-store">
              <ArrowLeft size={15} /> Voltar para a vitrine pública
            </Link>
          </div>
        </main>
      );
    }
    const isLockedOut = !supabase && lockoutRemainingSec > 0;
    return (
      <main className="admin-route-shell">
        <div className="admin-auth-card">
          <div className="admin-auth-top">
            <span className="brand-logo-ring admin-auth-logo">
              <img
                src={settings.logo_url || officialLogoPath}
                alt="Logo WPlay Eletrônicos"
                className="brand-logo-img"
                onError={(e) => handleImageErrorFallback(e, officialLogoPath)}
              />
            </span>
            <div>
              <h1>Acesso Restrito · WPlay</h1>
              <p>{settings.store_name} · {supabase ? "Acesso administrativo" : "Demonstração local"}</p>
            </div>
          </div>

          <div className="admin-security-banner">
            <ShieldCheck size={15} />
            <span>
              {supabase
                ? "Entre com seu e-mail e senha para acessar o painel WPlay."
                : "Demonstração local protegida por hash SHA-256 e sessão com expiração automática."}
            </span>
          </div>

          <form className="admin-auth-form" onSubmit={(e) => void handleLogin(e)}>
            <label>
              {supabase ? "E-mail" : "Identificação do Administrador"}
              <input
                type={supabase ? "email" : "text"}
                required
                autoComplete={supabase ? "username" : "username"}
                disabled={isLockedOut}
                placeholder={supabase ? "admin@exemplo.com" : "Digite seu usuário ou e-mail"}
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
              />
            </label>

            <label>
              {supabase ? "Senha" : "Chave de Segurança"}
              <div className="admin-pass-input-wrap">
                <input
                  type={showLoginPass ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  disabled={isLockedOut}
                  placeholder={supabase ? "Senha da conta" : "Digite sua senha de acesso"}
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                />
                <button
                  type="button"
                  className="admin-pass-toggle"
                  onClick={() => setShowLoginPass((prev) => !prev)}
                  aria-label={showLoginPass ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showLoginPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            {loginError && <p className="admin-auth-error">{loginError}</p>}

            <button
              type="submit"
              disabled={isLockedOut}
              className="button button-lime admin-auth-submit"
            >
              <Lock size={16} />
              {isLockedOut
                ? `Bloqueado (${lockoutRemainingSec}s)`
                : supabase ? "Entrar com senha" : "Desbloquear Painel Admin"}
            </button>
          </form>

          {supabase && (
            <div className="admin-auth-form">
              <button type="button" className="button button-outline" onClick={() => void handleSendEmailCode()}>
                Receber código ou link por e-mail
              </button>
              {emailCodeSent && (
                <>
                  <label>
                    Código recebido por e-mail
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                    />
                  </label>
                  <button type="button" className="button button-lime" onClick={() => void handleVerifyEmailCode()}>
                    Validar código
                  </button>
                </>
              )}
              <button type="button" className="button button-outline" onClick={() => void handleCreateAccount()}>
                Primeiro acesso: criar conta
              </button>
              <button type="button" className="button button-outline" onClick={() => void handleSendPasswordRecovery()}>
                Esqueci minha senha
              </button>
              {emailActionMessage && <p className="admin-security-feedback">{emailActionMessage}</p>}
            </div>
          )}

          <Link href="/" className="admin-back-store">
            <ArrowLeft size={15} /> Voltar para a vitrine pública
          </Link>
        </div>
      </main>
    );
  }

  const framingProduct = activePhotoProduct && framingDraft?.productId === activePhotoProduct.id
    ? { ...activePhotoProduct, imageScale: framingDraft.imageScale, imagePosition: framingDraft.imagePosition }
    : activePhotoProduct;
  const pos = parsePositionPercent(framingProduct?.imagePosition);
  const currentHeroSlides = settings.hero_slides || defaultStoreSettings.hero_slides;
  const activeHeroSlide = currentHeroSlides[selectedHeroIdx] || currentHeroSlides[0];

  return (
    <main className="admin-dashboard">
      {cloudLoadError && (
        <div className="admin-security-banner" role="alert">
          <AlertTriangle size={15} /> <span>Falha ao atualizar o catálogo: {cloudLoadError}</span>
        </div>
      )}
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <span className="brand-logo-ring">
            <img
              src={settings.logo_url || officialLogoPath}
              alt="Logo WPlay Eletrônicos"
              className="brand-logo-img"
              onError={(e) => handleImageErrorFallback(e, officialLogoPath)}
            />
          </span>
          <div>
            <h1>Central Admin WPlay</h1>
            <span className="admin-session-pill">
              <span className="status-dot status-online" /> {authUserLabel} ·{" "}
              <Clock size={12} /> Expira em {formatRemainingTime(remainingSessionMs)}
            </span>
          </div>
        </div>

        <nav className="admin-topbar-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "fotos"}
            className={tab === "fotos" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => changeTab("fotos")}
          >
            <Camera size={16} /> Fotos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "produtos"}
            className={tab === "produtos" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => {
              if (changeTab("produtos")) setEditingProduct(null);
            }}
          >
            <Sparkles size={16} /> Produtos ({products.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "categorias"}
            className={tab === "categorias" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => changeTab("categorias")}
          >
            <Layers size={16} /> Categorias ({allCategories.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "modelos"}
            className={tab === "modelos" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => changeTab("modelos")}
          >
            <Smartphone size={16} /> Linhas & Modelos 3D ({settings.custom_phone_models?.length || 0})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "crm"}
            className={tab === "crm" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => changeTab("crm")}
          >
            <Users size={16} /> Clientes & Vendas ({leads.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "push"}
            className={tab === "push" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => changeTab("push")}
          >
            <Bell size={16} /> Disparar Notificações (Push)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "seguranca"}
            className={tab === "seguranca" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => changeTab("seguranca")}
          >
            <ShieldCheck size={16} /> Segurança & Links
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "config"}
            className={tab === "config" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => changeTab("config")}
          >
            <Sliders size={16} /> Dados da Loja
          </button>
        </nav>

        <div className="admin-topbar-actions">
          <Link
            href="/"
            className="button button-outline"
            onClick={(event) => {
              if (framingDraftRef.current) {
                event.preventDefault();
                showToast("Salve o enquadramento antes de sair do Studio de Fotos.");
              }
            }}
          >
            <Eye size={15} /> Ver Loja <ArrowUpRight size={14} />
          </Link>
          <button
            type="button"
            className="button button-quiet"
            onClick={() => {
              if (framingDraftRef.current) {
                showToast("Salve o enquadramento antes de trancar o painel.");
                return;
              }
              void handleLogout("Bloqueio manual pelo administrador");
            }}
          >
            <LogOut size={15} /> Trancar
          </button>
        </div>
      </header>

      <div className="admin-workspace">
        {/* TAB 1: STUDIO DE FOTOS TOTALMENTE CUSTOMIZÁVEL */}
        {tab === "fotos" && activePhotoProduct && (
          <div className="photo-studio-layout">
            <aside className="photo-studio-sidebar">
              <div className="studio-sidebar-head">
                <h2>1. Escolha o Produto</h2>
                <span>Clique para trocar ou ajustar a foto</span>
              </div>

              <div className="photo-product-list">
                {products.map((prod) => {
                  const active = prod.id === activePhotoProduct.id;
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      className={active ? "photo-prod-item active" : "photo-prod-item"}
                      onClick={() => {
                        if (prod.id === activePhotoProduct.id) return;
                        if (framingDraftRef.current) {
                          showToast("Salve o enquadramento antes de trocar de produto.");
                          return;
                        }
                        setSelectedPhotoProductId(prod.id);
                      }}
                    >
                      <img
                        src={prod.image}
                        alt={prod.name}
                        onError={(e) =>
                          handleImageErrorFallback(
                            e,
                            getFallbackImageForCategory(prod.category)
                          )
                        }
                      />
                      <div>
                        <strong>{prod.name}</strong>
                        <span>{prod.category}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="photo-studio-main">
              <div className="photo-studio-grid">
                {/* Live Card Preview */}
                <div className="photo-preview-column">
                  <div className="studio-section-head">
                    <h2>2. Preview Ao Vivo do Card</h2>
                    <span>Exatamente como aparece na vitrine</span>
                  </div>

                  <article className="product-card studio-live-card">
                    <div className="product-media">
                      <img
                        src={activePhotoProduct.image}
                        alt={activePhotoProduct.name}
                        onError={(e) =>
                          handleImageErrorFallback(
                            e,
                            getFallbackImageForCategory(activePhotoProduct.category)
                          )
                        }
                        style={{
                          objectFit: activePhotoProduct.imageFit || "cover",
                          objectPosition: framingProduct?.imagePosition || "50% 50%",
                          transform: `scale(${framingProduct?.imageScale || 1})`,
                        }}
                      />
                      <div className="product-top-bar">
                        <span className="product-tag">{activePhotoProduct.category}</span>
                        {activePhotoProduct.badge && (
                          <span className="product-subtag">{activePhotoProduct.badge}</span>
                        )}
                      </div>
                    </div>
                    <div className="product-body">
                      <div className="product-head">
                        <h3>{activePhotoProduct.name}</h3>
                        {formatCurrencyBRL(activePhotoProduct.price) ? (
                          <strong className="price-badge">
                            {formatCurrencyBRL(activePhotoProduct.price)}
                          </strong>
                        ) : (
                          <span className="consult-badge">Consultar</span>
                        )}
                      </div>
                      <p className="studio-card-desc">{activePhotoProduct.description}</p>
                    </div>
                  </article>

                  {/* Framing & Crop Controls */}
                  <div className="photo-framing-box">
                    <h3>Ajuste de Enquadramento & Zoom</h3>

                    <div className="framing-mode-row">
                      <button
                        type="button"
                        className={
                          (activePhotoProduct.imageFit || "cover") === "cover"
                            ? "framing-pill active"
                            : "framing-pill"
                        }
                        onClick={() =>
                          void updatePhotoForActiveProduct(
                            { imageFit: "cover" },
                            "Modo Preencher (Cover) aplicado."
                          )
                        }
                      >
                        Preencher (Cover)
                      </button>
                      <button
                        type="button"
                        className={
                          activePhotoProduct.imageFit === "contain"
                            ? "framing-pill active"
                            : "framing-pill"
                        }
                        onClick={() =>
                          void updatePhotoForActiveProduct(
                            { imageFit: "contain" },
                            "Modo Mostrar Inteiro (Contain) aplicado."
                          )
                        }
                      >
                        Mostrar Inteiro (Contain)
                      </button>
                      <button
                        type="button"
                        className="framing-pill"
                        onClick={() =>
                          void updatePhotoForActiveProduct(
                            {
                              imageFit: "cover",
                              imagePosition: "50% 50%",
                              imageScale: 1,
                            },
                            "Enquadramento centralizado."
                          )
                        }
                      >
                        <RotateCcw size={13} /> Resetar enquadramento
                      </button>
                    </div>

                    <div className="framing-sliders">
                      <label>
                        <span>
                          Zoom da Foto ({Math.round((framingProduct?.imageScale || 1) * 100)}%)
                        </span>
                        <input
                          type="range"
                          min="0.8"
                          max="1.45"
                          step="0.05"
                          value={framingProduct?.imageScale || 1}
                          disabled={savingFraming}
                          onChange={(e) => updateFramingDraft({ imageScale: Number(e.target.value) })}
                        />
                      </label>

                      <label>
                        <span>Posição Horizontal ({pos.x}%)</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={pos.x}
                          disabled={savingFraming}
                          onChange={(e) => updateFramingDraft({ imagePosition: `${e.target.value}% ${pos.y}%` })}
                        />
                      </label>

                      <label>
                        <span>Posição Vertical ({pos.y}%)</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={pos.y}
                          disabled={savingFraming}
                          onChange={(e) => updateFramingDraft({ imagePosition: `${pos.x}% ${e.target.value}%` })}
                        />
                      </label>
                    </div>
                    {framingDraft?.productId === activePhotoProduct.id && (
                      <div className="form-actions">
                        <span className="admin-sub">Enquadramento alterado. Salve para publicar.</span>
                        <button
                          type="button"
                          className="button button-lime"
                          disabled={savingFraming}
                          onClick={() => void saveFramingDraft()}
                        >
                          <Save size={15} /> {savingFraming ? "Salvando..." : "Salvar enquadramento"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload, URL & Studio Library */}
                <div className="photo-sources-column">
                  <div className="studio-section-head">
                    <h2>3. Trocar Foto de “{activePhotoProduct.name}”</h2>
                    <span>Envie do seu dispositivo, cole um link ou escolha na galeria</span>
                  </div>

                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => void restoreDemoProductPhoto()}
                  >
                    <RotateCcw size={15} /> Restaurar foto de demonstração
                  </button>

                  <div className="photo-upload-dropzone">
                    <Upload size={26} />
                    <div>
                      <strong>Enviar nova foto do computador ou celular</strong>
                      <p>JPG, PNG ou WebP · Otimização automática para carregamento rápido</p>
                    </div>
                    <input
                      type="text"
                      placeholder="Nome opcional para salvar na galeria..."
                      value={newGalleryLabel}
                      onChange={(e) => setNewGalleryLabel(e.target.value)}
                      className="upload-label-input"
                    />
                    <label className="button button-lime upload-btn-label">
                      <ImagePlus size={16} /> Escolher arquivo de imagem
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => void handleUploadProductPhoto(e)}
                      />
                    </label>
                  </div>

                  <form
                    className="photo-url-bar"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!photoUrlDraft.trim()) return;
                      if (
                        supabase &&
                        /^data:image\//i.test(photoUrlDraft.trim()) &&
                        photoUrlDraft.trim() !== activePhotoProduct.image
                      ) {
                        showToast("Use o envio de imagem para salvar fotos da nuvem; URLs data:image não são aceitas.");
                        return;
                      }
                      void updatePhotoForActiveProduct(
                        { image: photoUrlDraft.trim() },
                        "URL da foto atualizada!"
                      );
                    }}
                  >
                    <label>
                      Ou cole a URL / caminho direto da foto
                      <div className="photo-url-input-group">
                        <input
                          type="text"
                          placeholder="https://... ou /images/..."
                          value={photoUrlDraft}
                          onChange={(e) => setPhotoUrlDraft(e.target.value)}
                        />
                        <button type="submit" className="button button-lime">
                          Aplicar URL
                        </button>
                      </div>
                    </label>
                  </form>

                  <div className="studio-library-box">
                    <h3>Galeria Rápida da Loja (Clique para aplicar)</h3>
                    <div className="studio-grid-large">
                      {galleryOptions.map((item) => {
                        const isCurrent = activePhotoProduct.image === item.src;
                        return (
                          <button
                            key={item.id + item.src}
                            type="button"
                            className={
                              isCurrent ? "studio-thumb-card active" : "studio-thumb-card"
                            }
                            onClick={() =>
                              void updatePhotoForActiveProduct(
                                { image: item.src },
                                `Foto "${item.label}" aplicada!`
                              )
                            }
                          >
                            <img
                              src={item.src}
                              alt={item.label}
                              onError={(e) =>
                                handleImageErrorFallback(e, "/images/wplay-iphone.jpg")
                              }
                            />
                            <span>{item.label}</span>
                            {isCurrent && (
                              <b className="studio-active-pill">
                                <Check size={12} /> Em uso
                              </b>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hero Showcase Banner Photos */}
                  <div className="hero-photo-manager">
                    <h3>Fotos do Destaque Principal (Topo do Site)</h3>
                    <div className="hero-slide-Tabs">
                      {currentHeroSlides.map((slide, idx) => (
                        <button
                          key={slide.id}
                          type="button"
                          className={
                            idx === selectedHeroIdx ? "framing-pill active" : "framing-pill"
                          }
                          onClick={() => setSelectedHeroIdx(idx)}
                        >
                          {slide.tag}: {slide.title}
                        </button>
                      ))}
                    </div>

                    {activeHeroSlide && (
                      <div className="hero-slide-editor">
                        <img
                          src={activeHeroSlide.image}
                          alt={activeHeroSlide.title}
                          className="hero-slide-preview-thumb"
                          onError={(e) =>
                            handleImageErrorFallback(
                              e,
                              getFallbackImageForCategory(activeHeroSlide.category)
                            )
                          }
                        />
                        <div className="hero-slide-fields">
                          <input
                            type="text"
                            value={heroTitleDraft?.slideId === activeHeroSlide.id
                              ? heroTitleDraft.value
                              : activeHeroSlide.title}
                            onChange={(e) => setHeroTitleDraft({ slideId: activeHeroSlide.id, value: e.target.value })}
                            onBlur={(e) => {
                              const title = e.currentTarget.value;
                              void handleUpdateHeroSlide({ title }).then((saved) => {
                                if (saved) setHeroTitleDraft(null);
                              });
                            }}
                            placeholder="Título do slide"
                          />
                          <input
                            type="text"
                            value={heroImageUrlDraft?.slideId === activeHeroSlide.id
                              ? heroImageUrlDraft.value
                              : activeHeroSlide.image}
                            onChange={(e) => setHeroImageUrlDraft({ slideId: activeHeroSlide.id, value: e.target.value })}
                            onBlur={(e) => {
                              const image = e.currentTarget.value;
                              void handleUpdateHeroSlide({ image }).then((saved) => {
                                if (saved) setHeroImageUrlDraft(null);
                              });
                            }}
                            placeholder="URL da foto do slide"
                          />
                          <label className="button button-outline">
                            <ImagePlus size={15} /> Enviar foto para este slide
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => void handleUploadHeroSlidePhoto(e)}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: PRODUTOS & VARIANTES */}
        {tab === "produtos" && (
          <div className="admin-section-card">
            {editingProduct ? (
              <form className="product-form" onSubmit={(e) => void handleSaveProductForm(e)}>
                <div className="admin-products-head">
                  <h2>Editando: {editingProduct.name}</h2>
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => setEditingProduct(null)}
                  >
                    Voltar à lista
                  </button>
                </div>

                <div className="form-row-2">
                  <label>
                    Nome do produto
                    <input
                      required
                      maxLength={80}
                      value={editingProduct.name}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, name: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Selo em destaque
                    <input
                      maxLength={48}
                      placeholder="Ex.: Lacrado · Seminovo"
                      value={editingProduct.badge}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, badge: e.target.value })
                      }
                    />
                  </label>
                </div>

                <div className="form-row-2">
                  <label>
                    Categoria
                    <select
                      value={editingProduct.category}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, category: e.target.value })
                      }
                    >
                      {allCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Ou criar nova categoria agora
                    <input
                      type="text"
                      placeholder="Ex.: Drones, Games, Caixas JBL..."
                      value={inlineNewCategory}
                      onChange={(e) => setInlineNewCategory(e.target.value)}
                    />
                  </label>
                </div>

                <div className="form-row-2">
                  <label>
                    Preço Padrão / Cartão R$ (deixe vazio para “Consultar”)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingProduct.price ?? ""}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          price: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </label>

                  <label>
                    Preço Especial à Vista no PIX R$
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex.: 7490 (com desconto à vista)"
                      value={editingProduct.pricePix ?? ""}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          pricePix: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="form-row-2">
                  <label>
                    Condição de Parcelamento
                    <input
                      type="text"
                      placeholder="Ex.: 12x de R$ 749 ou 18x no cartão"
                      value={editingProduct.installments ?? ""}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          installments: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Estoque Físico (unidades disponíveis)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="5 (0 = Esgotado / Sob encomenda)"
                      value={editingProduct.stockQuantity ?? ""}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          stockQuantity: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>

                <div className="form-row-2">
                  <label>
                    Opções interativas (separadas por vírgula)
                    <input
                      type="text"
                      placeholder="128 GB, 256 GB, Titânio"
                      value={variantsText}
                      onChange={(e) => setVariantsText(e.target.value)}
                    />
                  </label>
                </div>

                <label>
                  Descrição curta
                  <textarea
                    rows={2}
                    maxLength={180}
                    value={editingProduct.description}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        description: e.target.value,
                      })
                    }
                  />
                </label>

                <div className="checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={editingProduct.published}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          published: e.target.checked,
                        })
                      }
                    />
                    Visível na vitrine
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={editingProduct.featured}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          featured: e.target.checked,
                        })
                      }
                    />
                    Destaque principal
                  </label>
                </div>

                <div className="form-actions">
                  <button type="submit" className="button button-lime">
                    <Save size={16} /> Salvar Produto
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => {
                      setSelectedPhotoProductId(editingProduct.id);
                      setTab("fotos");
                    }}
                  >
                    <Camera size={15} /> Ajustar Foto no Studio
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="admin-products-head">
                  <h2>Todos os Produtos ({products.length})</h2>
                  <button
                    type="button"
                    className="button button-lime"
                    onClick={() =>
                      startEditProduct({
                        id: `item-${Date.now()}`,
                        name: "",
                        category: allCategories[0] || "Celulares",
                        description: "",
                        badge: "Novidade",
                        price: null,
                        image: "/images/wplay-iphone.jpg",
                        published: true,
                        featured: false,
                        variants: ["Pronta entrega", "Sob consulta"],
                      })
                    }
                  >
                    <Plus size={16} /> Novo Produto
                  </button>
                </div>

                <div className="admin-product-table">
                  {products.map((p) => (
                    <div key={p.id} className="admin-product-row">
                      <img
                        src={p.image}
                        alt={p.name}
                        onError={(e) =>
                          handleImageErrorFallback(
                            e,
                            getFallbackImageForCategory(p.category)
                          )
                        }
                      />
                      <div className="admin-product-meta">
                        <strong>{p.name}</strong>
                        <span>
                          {p.category} · {p.pricePix ? "PIX: " + formatCurrencyBRL(p.pricePix) : (formatCurrencyBRL(p.price) || "Sob consulta")} ·{" "}
                          <span className={"stock-badge " + (p.stockQuantity == null ? "" : p.stockQuantity === 0 ? "stock-out" : p.stockQuantity <= 2 ? "stock-low" : "stock-available")}>
                            {p.stockQuantity == null ? "Estoque sob consulta" : p.stockQuantity === 0 ? "Esgotado" : p.stockQuantity + " un. estoque"}
                          </span> ·{" "}
                          {p.published ? "Visível" : "Oculto"}
                        </span>
                      </div>

                      <div className="admin-product-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPhotoProductId(p.id);
                            setTab("fotos");
                          }}
                        >
                          <Camera size={14} /> Trocar Foto
                        </button>
                        <button type="button" onClick={() => startEditProduct(p)}>
                          Editar
                        </button>
                        {confirmDeleteId === p.id ? (
                          <button
                            type="button"
                            className="admin-delete-confirm"
                            onClick={() => {
                              const next = products.filter((item) => item.id !== p.id);
                              void (async () => {
                                if (!(await persistProducts(next, p.id))) return;
                                setConfirmDeleteId(null);
                                showToast("Produto removido.");
                              })();
                            }}
                          >
                            Confirmar exclusão
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-delete-btn"
                            onClick={() => setConfirmDeleteId(p.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: GERENCIADOR DE CATEGORIAS */}
        {tab === "categorias" && (
          <div className="admin-section-card">
            <div className="admin-products-head">
              <div>
                <h2>Categorias da Vitrine ({allCategories.length})</h2>
                <p className="admin-sub">
                  Crie novas abas para a vitrine ou reordene os botões de filtro rápido.
                </p>
              </div>
            </div>

            <form
              className="category-creator-bar"
              onSubmit={(e) => void handleCreateCategory(e)}
            >
              <input
                type="text"
                required
                maxLength={40}
                placeholder="Nome da nova categoria (Ex.: Games & Consoles, Drones...)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <button type="submit" className="button button-lime">
                <FolderPlus size={16} /> Criar Categoria
              </button>
            </form>

            <div className="category-manager-list">
              {allCategories.map((catName, idx) => {
                const count = products.filter((p) => p.category === catName).length;
                return (
                  <div key={catName} className="category-manager-row">
                    <div>
                      <strong>{catName}</strong>
                      <span>
                        {count} {count === 1 ? "produto" : "produtos"}
                      </span>
                    </div>
                    <div className="category-row-actions">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => void handleMoveCategory(idx, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === allCategories.length - 1}
                        onClick={() => void handleMoveCategory(idx, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTab("produtos");
                          startEditProduct({
                            id: `item-${Date.now()}`,
                            name: "",
                            category: catName,
                            description: "",
                            badge: "Novidade",
                            price: null,
                            image: "/images/wplay-iphone.jpg",
                            published: true,
                            featured: false,
                            variants: getDefaultVariantsForCategory(catName),
                          });
                        }}
                      >
                        + Produto
                      </button>
                      <button
                        type="button"
                        className="admin-delete-btn"
                        onClick={() => void handleRemoveCategory(catName)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: LINHAS & MODELOS 3D PARA CELULARES */}
        {tab === "modelos" && (
          <AdminPhoneModelsTab
            customModels={settings.custom_phone_models || []}
            onSaveModels={async (models) => {
              return await persistSettings({
                ...settings,
                custom_phone_models: models,
              });
            }}
            showToast={showToast}
          />
        )}

        {/* TAB: CRM DE CLIENTES & FOLLOW-UP NO WHATSAPP */}
        {tab === "crm" && (
          <div className="admin-section-card">
            <div className="admin-products-head">
              <div>
                <h2>Clientes, Pedidos & Follow-up no WhatsApp</h2>
                <p className="admin-sub">
                  Gerencie contatos vindos do catálogo, recupere carrinhos e dispare mensagens de atendimento direto no WhatsApp com 1 clique.
                </p>
              </div>
            </div>

            {leadsLoadError && <div role="alert" className="admin-security-feedback"><p>{leadsLoadError}</p><button type="button" className="button button-outline" onClick={() => void refreshLeads()}>Tentar carregar contatos</button></div>}
            {/* Metrics cards */}
            <div className="crm-metrics-grid">
              <div className="crm-metric-card">
                <span className="crm-metric-num">{crmMetrics.total}</span>
                <span className="crm-metric-label">Oportunidades</span>
              </div>
              <div className="crm-metric-card">
                <span className="crm-metric-num crm-color-novo">{crmMetrics.novos}</span>
                <span className="crm-metric-label">Novos Leads</span>
              </div>
              <div className="crm-metric-card">
                <span className="crm-metric-num crm-color-neg">{crmMetrics.emNegociacao}</span>
                <span className="crm-metric-label">Em Negociação</span>
              </div>
              <div className="crm-metric-card">
                <span className="crm-metric-num crm-color-fechado">{crmMetrics.fechados}</span>
                <span className="crm-metric-label">Vendas Fechadas</span>
              </div>
              <div className="crm-metric-card">
                <span className="crm-metric-num crm-color-val">{formatCurrencyBRL(crmMetrics.valorPipeline)}</span>
                <span className="crm-metric-label">Pipeline Potencial</span>
              </div>
            </div>

            {/* Filter and search bar */}
            <div className="crm-filter-bar">
              <div className="crm-search-box">
                <Search size={15} />
                <input
                  type="text"
                  aria-label="Buscar contatos por nome, telefone ou produto"
                  placeholder="Buscar por nome, telefone ou produto..."
                  value={crmSearch}
                  onChange={(e) => setCrmSearch(e.target.value)}
                />
              </div>

              <div className="crm-filter-chips">
                {[
                  { key: "todos", label: "Todos (" + crmMetrics.total + ")" },
                  { key: "novo", label: "Novos (" + crmMetrics.novos + ")" },
                  { key: "em_negociacao", label: "Em Negociação (" + crmMetrics.emNegociacao + ")" },
                  { key: "fechado", label: "Fechados (" + crmMetrics.fechados + ")" },
                  { key: "aguardando_reposicao", label: "Aguardando (" + crmMetrics.aguardando + ")" },
                ].map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className={"crm-chip " + (crmFilter === chip.key ? "active" : "")}
                    onClick={() => setCrmFilter(chip.key)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Leads list */}
            {filteredLeads.length === 0 ? (
              <p className="admin-sub" style={{ padding: "24px 0", textAlign: "center" }}>
                Nenhum contato encontrado para este filtro.
              </p>
            ) : (
              <div className="crm-leads-list">
                {filteredLeads.map((lead) => {
                  const isEditingNotes = editingLeadNoteId === lead.id;
                  const waHref = buildFollowUpWhatsAppHref(lead, settings.store_name);

                  return (
                    <div key={lead.id} className={"crm-lead-card status-" + lead.status}>
                      <div className="crm-lead-header">
                        <div>
                          <strong className="crm-lead-name">{lead.name}</strong>
                          <span className="crm-lead-phone">{lead.whatsapp}</span>
                        </div>
                        <div className="crm-lead-status-wrap">
                          <select
                            aria-label={`Status de ${lead.name}`}
                            className={"crm-status-select select-" + lead.status}
                            value={lead.status}
                            onChange={(e) =>
                              void handleUpdateLeadStatus(
                                lead.id,
                                e.target.value as CustomerLead["status"]
                              )
                            }
                          >
                            <option value="novo">Novo Lead</option>
                            <option value="em_negociacao">Em Negociação</option>
                            <option value="fechado">Venda Fechada</option>
                            <option value="aguardando_reposicao">Aguardando Reposição</option>
                          </select>
                        </div>
                      </div>

                      <div className="crm-lead-details">
                        <div className="crm-lead-product">
                          <span className="crm-detail-label">Produto de interesse:</span>
                          <strong>{lead.productName}</strong>
                          {lead.variantChosen && <small>({lead.variantChosen})</small>}
                        </div>
                        {lead.estimatedValue ? (
                          <div className="crm-lead-val">
                            <span className="crm-detail-label">Valor estimado:</span>
                            <span className="crm-val-tag">{formatCurrencyBRL(lead.estimatedValue)}</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Notes / Observações */}
                      <div className="crm-lead-notes-box">
                        <span className="crm-detail-label">Anotações do atendimento:</span>
                        {isEditingNotes ? (
                          <div className="crm-notes-editor">
                            <textarea
                              rows={2}
                              value={leadNoteDraft}
                              onChange={(e) => setLeadNoteDraft(e.target.value)}
                            />
                            <div className="crm-notes-editor-actions">
                              <button
                                type="button"
                                className="button button-lime button-sm"
                                onClick={() => void handleSaveLeadNote(lead.id)}
                              >
                                Salvar Nota
                              </button>
                              <button
                                type="button"
                                className="button button-quiet button-sm"
                                onClick={() => setEditingLeadNoteId(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p
                            className="crm-notes-text"
                            onClick={() => {
                              setEditingLeadNoteId(lead.id);
                              setLeadNoteDraft(lead.notes || "");
                            }}
                            title="Clique para editar"
                          >
                            {lead.notes || "Clique para adicionar anotações sobre este cliente..."}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="crm-lead-actions">
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button button-lime crm-btn-whatsapp"
                          onClick={() => {
                            if (lead.status === "novo") {
                              void handleUpdateLeadStatus(lead.id, "em_negociacao");
                            }
                          }}
                        >
                          <MessageSquare size={14} /> Chamar no WhatsApp (1-Clique)
                        </a>

                        {lead.status !== "fechado" && (
                          <button
                            type="button"
                            className="button button-outline"
                            onClick={() => void handleUpdateLeadStatus(lead.id, "fechado")}
                          >
                            <CheckCircle2 size={13} /> Marcar Fechado
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: NOTIFICAÇÕES PUSH PARA O APLICATIVO */}
        {tab === "push" && (
          <div className="admin-push-section">
            {/* 1. Header & Subscriber Counter */}
            <div className="push-counter-card">
              <div className="push-counter-info">
                <h4>
                  <Smartphone size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: "#c7f450" }} />
                  Dispositivos Conectados ao PWA / APK
                </h4>
                <p>
                  Aparelhos ativos prontos para receber notificações instantâneas de conversão e ofertas relâmpago.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ textAlign: "right" }}>
                  <div className="push-counter-num">{pushSubscriberCount}</div>
                  <span style={{ fontSize: 11, color: "#8fa286", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {pushSubscriberCount === 1 ? "Celular inscrito" : "Celulares inscritos"}
                  </span>
                </div>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => void fetchPushSubscribersCount()}
                  disabled={isLoadingSubscribers}
                  title="Atualizar contagem de inscritos"
                  style={{ padding: "8px 10px", minWidth: 36 }}
                >
                  <RefreshCw size={14} className={isLoadingSubscribers ? "spin" : ""} />
                </button>
              </div>
            </div>

            {/* 2. Dispatch Result Summary (Feedback pós-envio) */}
            {pushLastResult && (
              <div className="push-result-box" role="status">
                <h4>
                  <CheckCircle2 size={16} /> Resumo do Último Disparo ({pushLastResult.timestamp})
                </h4>
                <ul>
                  <li><strong>Total na base:</strong> {pushLastResult.total} dispositivo(s)</li>
                  <li><strong>Entregues com sucesso:</strong> {pushLastResult.sent} notificação(ões)</li>
                  {pushLastResult.removed > 0 && (
                    <li><strong>Inscrições expiradas removidas (404/410):</strong> {pushLastResult.removed}</li>
                  )}
                  {pushLastResult.failed > 0 && (
                    <li><strong>Falhas temporárias de entrega:</strong> {pushLastResult.failed}</li>
                  )}
                </ul>
              </div>
            )}

            {/* 3. Sales Trigger Presets (1-Click Templates) */}
            <section className="admin-section-card" style={{ marginBottom: 20 }}>
              <div className="push-form-header-row">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} style={{ color: "#c7f450" }} />
                  <strong>Gatilhos Prontos de Vendas (1 clique para preencher)</strong>
                </div>
                {products.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span className="push-preset-label">Produto base:</span>
                    <select
                      className="crm-template-select"
                      value={pushTargetProduct}
                      onChange={(e) => setPushTargetProduct(e.target.value)}
                    >
                      <option value="">Selecione um produto...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="push-presets-group">
                <button
                  type="button"
                  className="push-preset-pill"
                  onClick={() => applyPushTemplate("oferta")}
                >
                  🔥 Oferta Relâmpago
                </button>
                <button
                  type="button"
                  className="push-preset-pill"
                  onClick={() => applyPushTemplate("reposicao")}
                >
                  📦 Reposição de Estoque
                </button>
                <button
                  type="button"
                  className="push-preset-pill"
                  onClick={() => applyPushTemplate("cupom")}
                >
                  🎟️ Cupom Exclusivo do App
                </button>
                <button
                  type="button"
                  className="push-preset-pill"
                  onClick={() => applyPushTemplate("ultimas")}
                >
                  ⚡ Últimas Unidades
                </button>
              </div>
            </section>

            {/* 4. Two-Column Layout: Form Composer + Live Lockscreen Preview */}
            <div className="push-layout-grid">
              {/* Left Column: Form Composer */}
              <section className="admin-section-card push-composer-form">
                <h3>📝 Personalizar Notificação</h3>
                <form
                  className="product-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleBroadcastPush();
                  }}
                >
                  <label>
                    Título da Notificação (com emojis)
                    <input
                      required
                      maxLength={70}
                      placeholder="Ex: 🔥 Mega Oferta Relâmpago WPlay!"
                      value={pushTitleDraft}
                      onChange={(event) => setPushTitleDraft(event.target.value)}
                    />
                    <small style={{ color: "#8fa286", fontSize: 11, textAlign: "right" }}>
                      {pushTitleDraft.length}/70 caracteres
                    </small>
                  </label>

                  <label>
                    Mensagem Persuasiva
                    <textarea
                      required
                      maxLength={180}
                      rows={3}
                      placeholder="Ex: Só hoje na WPlay! iPhone com desconto especial no Pix. Toque para ver!"
                      value={pushBodyDraft}
                      onChange={(event) => setPushBodyDraft(event.target.value)}
                    />
                    <small style={{ color: "#8fa286", fontSize: 11, textAlign: "right" }}>
                      {pushBodyDraft.length}/180 caracteres
                    </small>
                  </label>

                  <label>
                    Link de Destino (URL no app ao tocar)
                    <input
                      placeholder="/#catalogo ou link do produto"
                      value={pushUrlDraft}
                      onChange={(event) => setPushUrlDraft(event.target.value)}
                    />
                  </label>

                  <label>
                    URL da Imagem do Produto (Opcional - Banner)
                    <input
                      placeholder="https://... ou caminho da imagem (/images/...)"
                      value={pushImageDraft}
                      onChange={(event) => setPushImageDraft(event.target.value)}
                    />
                  </label>

                  <div className="push-form-actions">
                    <button
                      type="submit"
                      className="button button-lime"
                      disabled={isBroadcastingPush || !pushTitleDraft || !pushBodyDraft}
                      style={{ flex: 1 }}
                    >
                      <Send size={16} />
                      {isBroadcastingPush ? "Disparando para todos..." : "Disparar para Todos os Clientes"}
                    </button>

                    <button
                      type="button"
                      className="button button-outline"
                      disabled={isSendingPush}
                      onClick={() => void handleTestLocalPush()}
                      title="Exibir notificação teste apenas neste navegador"
                    >
                      <Bell size={15} />
                      {isSendingPush ? "Aguardando..." : "Testar Neste Aparelho"}
                    </button>
                  </div>
                </form>
              </section>

              {/* Right Column: Real-Time Mobile Lock Screen Preview */}
              <div className="push-preview-container">
                <div className="push-preview-topbar">
                  <span className="push-preview-topbar-title">
                    <Eye size={15} /> Preview em Tempo Real
                  </span>
                  <div className="push-os-toggle">
                    <button
                      type="button"
                      className={`push-os-btn ${pushPreviewOS === "ios" ? "active" : ""}`}
                      onClick={() => setPushPreviewOS("ios")}
                    >
                      iOS
                    </button>
                    <button
                      type="button"
                      className={`push-os-btn ${pushPreviewOS === "android" ? "active" : ""}`}
                      onClick={() => setPushPreviewOS("android")}
                    >
                      Android
                    </button>
                  </div>
                </div>

                {/* Smartphone Silhouette */}
                <div className="push-lockscreen-phone">
                  <div className="push-phone-notch" />
                  <div className="push-phone-statusbar">
                    <span>09:41</span>
                    <div style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 10 }}>
                      <span>5G</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div className="push-phone-clock-large">
                    <div className="push-clock-time">09:41</div>
                    <div className="push-clock-date">quinta-feira, 29 de outubro</div>
                  </div>

                  {/* Notification Card Bubble */}
                  <div className="push-notification-bubble">
                    <div className="push-bubble-header">
                      <div className="push-bubble-brand">
                        <img
                          src={officialLogoPath}
                          alt="WPlay"
                          className="push-bubble-icon"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/icons/icon-192.png";
                          }}
                        />
                        <span>WPlay {pushPreviewOS === "android" ? "• agora" : ""}</span>
                      </div>
                      {pushPreviewOS === "ios" && <span>Agora</span>}
                    </div>

                    <h4 className="push-bubble-title">
                      {pushTitleDraft || "Título da notificação aparecerá aqui"}
                    </h4>
                    <p className="push-bubble-body">
                      {pushBodyDraft || "Sua mensagem persuasiva aparecerá aqui com todos os detalhes..."}
                    </p>

                    {pushImageDraft && (
                      <img
                        src={pushImageDraft}
                        alt="Banner da oferta"
                        className="push-bubble-banner-img"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    )}

                    <div className="push-bubble-footer-hint">
                      Toque para abrir a oferta no app →
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SEGURANÇA, ROTAS OCULTAS & DIAGNÓSTICO DE LINKS */}
        {tab === "seguranca" && (
          <div className="admin-security-grid">
            {/* 1. Link Health & Broken-Link Shield */}
            <section className="admin-section-card">
              <div className="admin-products-head">
                <div>
                  <h2>
                    <Link2 size={18} /> Proteção Anti-Link Quebrado
                  </h2>
                  <p className="admin-sub">
                    Monitoramento automático de links externos (WhatsApp, Instagram, Maps) e fotos da vitrine.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-lime"
                  onClick={() => void handleRepairAllLinksAndImages()}
                >
                  <RefreshCw size={15} /> Blindar Todos os Links & Fotos
                </button>
              </div>

              <div className="admin-link-health-list">
                {linkHealthReport.map((item) => (
                  <div key={item.id} className="admin-link-health-row">
                    <div className="admin-link-health-meta">
                      <strong>{item.label}</strong>
                      <code>{item.target}</code>
                    </div>
                    <span
                      className={
                        item.healthy
                          ? "health-pill health-pill-ok"
                          : "health-pill health-pill-warn"
                      }
                    >
                      {item.healthy ? (
                        <>
                          <CheckCircle2 size={13} /> {item.detail}
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={13} /> {item.detail}
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* 2. SHA-256 Encrypted Credentials & Hidden Route Info */}
            <section className="admin-section-card">
              <div className="admin-products-head">
                <div>
                  <h2>
                    <KeyRound size={18} /> {supabase ? "Sua conta & acesso da equipe" : "Credenciais locais & rota oculta"}
                  </h2>
                  <p className="admin-sub">
                    {supabase
                      ? <>Conta conectada: <strong>{authUserLabel}</strong>. Sua conta de acesso ao painel WPlay.</>
                      : <>O link de administração foi ocultado da loja pública. Use <strong>Ctrl + Shift + A</strong> no teclado ou toque <strong>5 vezes seguidas</strong> na logo do rodapé para abrir este painel.</>}
                  </p>
                </div>
              </div>

              {supabase && (
                <>
                  <form
                    className="product-form"
                    onSubmit={(e) => void handleUpdateSecurityCredentials(e)}
                  >
                    <p className="admin-sub">
                      Altere a senha da conta WPlay. Confirme a senha atual; deixe esse campo vazio somente se entrou por código ou link de recuperação.
                    </p>
                    <div className="form-row-2">
                      <label>
                        Senha atual da conta WPlay
                        <input
                          type="password"
                          required={!passwordlessSession}
                          autoComplete="current-password"
                          placeholder="Vazio se autenticado por e-mail"
                          value={currentPinInput}
                          onChange={(e) => setCurrentPinInput(e.target.value)}
                        />
                      </label>
                      <label>
                        Nova senha (mín. 12 caracteres)
                        <input
                          type="password"
                          required
                          minLength={12}
                          autoComplete="new-password"
                          value={newPinInput}
                          onChange={(e) => setNewPinInput(e.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      Confirmar nova senha
                      <input
                        type="password"
                        required
                        minLength={12}
                        autoComplete="new-password"
                        value={confirmNewPinInput}
                        onChange={(e) => setConfirmNewPinInput(e.target.value)}
                      />
                    </label>
                    {securityMsg && <p className="admin-security-feedback">{securityMsg}</p>}
                    <button type="submit" className="button button-lime">
                      <Save size={16} /> Atualizar senha
                    </button>
                  </form>
                  <AdminAccessManager supabase={supabase} />
                </>
              )}

              {!supabase && (
              <form
                className="product-form"
                onSubmit={(e) => void handleUpdateSecurityCredentials(e)}
              >
                <div className="form-row-2">
                  <label>
                    Novo Usuário do Admin
                    <input
                      type="text"
                      required
                      value={newAdminUserInput}
                      onChange={(e) => setNewAdminUserInput(e.target.value)}
                    />
                  </label>
                  <label>
                    Senha Atual (Confirmação)
                      <input
                        type="password"
                        required
                        placeholder="Digite a senha atual para autorizar"
                        value={currentPinInput}
                        onChange={(e) => setCurrentPinInput(e.target.value)}
                      />
                  </label>
                </div>

                <div className="form-row-2">
                  <label>
                    Nova Senha Forte (mín. 6 caracteres)
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Nova senha criptografada"
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value)}
                    />
                  </label>
                  <label>
                    Confirmar Nova Senha
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Repita a nova senha"
                      value={confirmNewPinInput}
                      onChange={(e) => setConfirmNewPinInput(e.target.value)}
                    />
                  </label>
                </div>

                <div className="admin-hash-preview">
                  <ShieldCheck size={14} />
                  <span>
                    Hash SHA-256 ativo:{" "}
                    <code>
                      {(settings.admin_pin_hash || defaultAdminPinHash).slice(0, 24)}...
                    </code>
                  </span>
                </div>

                {securityMsg && <p className="admin-security-feedback">{securityMsg}</p>}

                <button type="submit" className="button button-lime">
                  <Save size={16} /> Atualizar Senha Criptografada
                </button>
              </form>
              )}
            </section>

            {/* 3. Security Audit Log */}
            <section className="admin-section-card">
              <div className="admin-products-head">
                <div>
                  <h2>
                    <ShieldAlert size={18} /> Registro de Auditoria de Acesso
                  </h2>
                  <p className="admin-sub">
                    Histórico local de autenticações, bloqueios anti-força bruta e reparos de segurança.
                  </p>
                </div>
                {auditLog.length > 0 && (
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => {
                      setAuditLog([]);
                      localStorage.removeItem(adminAuditStorageKey);
                      showToast("Histórico de auditoria limpo.");
                    }}
                  >
                    Limpar Registro
                  </button>
                )}
              </div>

              {auditLog.length === 0 ? (
                <p className="admin-sub">Nenhum evento registrado ainda nesta sessão.</p>
              ) : (
                <div className="admin-audit-list">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="admin-audit-row">
                      <div>
                        <strong>{entry.detail}</strong>
                        <span>
                          Usuário: {entry.user} · {entry.timestamp}
                        </span>
                      </div>
                      <span className={`audit-badge audit-${entry.event}`}>
                        {entry.event.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 5: LOJA, MAPA & ATENDIMENTO */}
        {tab === "config" && (
          <div className="admin-section-card">
            <form className="product-form" onSubmit={(e) => void handleSaveStoreConfig(e)}>
              <div className="admin-products-head">
                <h2>Identidade da Loja, WhatsApp & Localização</h2>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => {
                    void (async () => {
                      if (!(await persistProducts(initialProducts))) return;
                      if (!(await persistSettings(defaultStoreSettings))) return;
                      showToast("Padrões originais restaurados!");
                    })();
                  }}
                >
                  <RotateCcw size={15} /> Restaurar Padrões
                </button>
              </div>

              <div className="form-row-2">
                <label>
                  Nome da Loja
                  <input
                    type="text"
                    required
                    value={draftSettings.store_name}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, store_name: e.target.value })
                    }
                  />
                </label>

                <label>
                  Logo Oficial (URL ou caminho)
                  <div className="photo-url-input-group">
                    <input
                      type="text"
                      value={draftSettings.logo_url || officialLogoPath}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, logo_url: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() =>
                        setDraftSettings({ ...draftSettings, logo_url: officialLogoPath })
                      }
                    >
                      Logo Oficial WPlay
                    </button>
                  </div>
                </label>
              </div>

              <div className="form-row-2">
                <label>
                  Endereço (Rua e Número)
                  <input
                    type="text"
                    required
                    value={draftSettings.address_line}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, address_line: e.target.value })
                    }
                  />
                </label>

                <label>
                  Cidade / UF e CEP
                  <div className="form-row-2">
                    <input
                      type="text"
                      value={draftSettings.city}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, city: e.target.value })
                      }
                    />
                    <input
                      type="text"
                      value={draftSettings.postal_code}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, postal_code: e.target.value })
                      }
                    />
                  </div>
                </label>
              </div>

              <label>
                Link Oficial do Google Maps
                <input
                  type="url"
                  required
                  value={draftSettings.maps_url}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, maps_url: e.target.value })
                  }
                />
              </label>

              <label>
                Horários de Atendimento (1 linha por período)
                <textarea
                  rows={3}
                  value={hoursTextarea}
                  onChange={(e) => setHoursTextarea(e.target.value)}
                />
              </label>

              <div className="form-row-2">
                <label>
                  Link Oficial do WhatsApp
                  <input
                    type="url"
                    required
                    value={draftSettings.whatsapp_url}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, whatsapp_url: e.target.value })
                    }
                  />
                </label>

                <label>
                  Número do WhatsApp com DDD
                  <input
                    type="tel"
                    placeholder="+55 14 99674-7344"
                    value={draftSettings.whatsapp_phone ?? ""}
                    onChange={(e) => {
                      const digits = normalizePhoneDigits(e.target.value);
                      setDraftSettings({
                        ...draftSettings,
                        whatsapp_phone: e.target.value.trim() || null,
                        whatsapp_url:
                          digits.length >= 12 && digits.length <= 15
                            ? `https://wa.me/${digits}`
                            : draftSettings.whatsapp_url,
                      });
                    }}
                  />
                </label>
              </div>

              <button type="submit" className="button button-lime">
                <Save size={16} /> Salvar Todas as Configurações
              </button>
            </form>
          </div>
        )}
      </div>

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
        </div>
      )}
    </main>
  );
}
