"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  AdminAuditEntry,
  adminAuditStorageKey,
  adminLockoutStorageKey,
  AdminLockoutState,
  AdminSessionPayload,
  adminSessionStorageKey,
  compressImageFile,
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
import { createClient } from "@/lib/supabase";

type AdminTab = "fotos" | "produtos" | "categorias" | "seguranca" | "config";

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds

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

  // Products CRUD state ("produtos" tab)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [variantsText, setVariantsText] = useState("");
  const [inlineNewCategory, setInlineNewCategory] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Categories state ("categorias" tab)
  const [newCategoryName, setNewCategoryName] = useState("");

  // Settings state ("config" tab)
  const [draftSettings, setDraftSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [hoursTextarea, setHoursTextarea] = useState(
    defaultStoreSettings.hours_lines.join("\n")
  );

  const supabase = useMemo(() => createClient(), []);

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

  const handleLogout = useCallback(
    async (reason = "Sessão encerrada pelo administrador") => {
      sessionStorage.removeItem(adminSessionStorageKey);
      if (supabase) {
        await supabase.auth.signOut();
      }
      appendAuditEntry("logout", authUserLabel, reason);
      setIsAuthenticated(false);
      setSessionExpiresAt(null);
      setLoginPass("");
    },
    [appendAuditEntry, authUserLabel, supabase]
  );

  useEffect(() => {
    try {
      const savedProducts = localStorage.getItem(productsStorageKey);
      if (savedProducts) {
        const parsed = JSON.parse(savedProducts) as Partial<Product>[];
        if (Array.isArray(parsed) && parsed.length > 0) {
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
    } catch {
      // ignore storage read error
    }

    if (supabase) {
      void supabase.auth.getUser().then(({ data }) => {
        if (data.user?.email) {
          const expiresAt = Date.now() + SESSION_TTL_MS;
          const payload: AdminSessionPayload = {
            user: data.user.email,
            issuedAt: Date.now(),
            expiresAt,
            token: Math.random().toString(36).slice(2),
          };
          setIsAuthenticated(true);
          setAuthUserLabel(data.user.email);
          setSessionExpiresAt(expiresAt);
          sessionStorage.setItem(adminSessionStorageKey, JSON.stringify(payload));
        }
        setAuthChecking(false);
      });
    } else {
      setAuthChecking(false);
    }
  }, [supabase]);

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
      initialProducts[0]
    );
  }, [products, selectedPhotoProductId]);

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

  const persistProducts = async (next: Product[], deletedId?: string) => {
    setProducts(next);
    try {
      localStorage.setItem(productsStorageKey, JSON.stringify(next));
      window.dispatchEvent(new Event("storage"));
    } catch {
      showToast("Imagem muito pesada para o navegador. Escolha outra mais leve.");
      return;
    }

    if (!supabase) return;
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;

    if (deletedId) {
      await supabase.from("products").delete().eq("id", deletedId);
      return;
    }

    await supabase.from("products").upsert(
      next.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        badge: p.badge,
        price: p.price,
        image: p.image,
        published: p.published,
        featured: p.featured,
        variants: p.variants || [],
        updated_at: new Date().toISOString(),
      }))
    );
  };

  const persistSettings = async (nextSettings: StoreSettings) => {
    const normalized = normalizeSettings(nextSettings);
    setSettings(normalized);
    setDraftSettings(normalized);
    try {
      localStorage.setItem(settingsStorageKey, JSON.stringify(normalized));
      window.dispatchEvent(new Event("storage"));
    } catch {
      showToast("Não foi possível salvar no navegador.");
      return;
    }

    if (!supabase) {
      showToast("Alterações salvas e publicadas na vitrine!");
      return;
    }
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      showToast("Alterações salvas na vitrine local!");
      return;
    }

    await supabase.from("store_settings").upsert({
      id: true,
      store_name: normalized.store_name,
      hero_headline: normalized.hero_headline,
      whatsapp_url: normalized.whatsapp_url,
      whatsapp_phone: normalized.whatsapp_phone,
      instagram_url: normalized.instagram_url,
      instagram_handle: normalized.instagram_handle,
      city: normalized.city,
      address_line: normalized.address_line,
      postal_code: normalized.postal_code,
      maps_url: normalized.maps_url,
      hours_lines: normalized.hours_lines,
      custom_categories: normalized.custom_categories,
      attendance_note: normalized.attendance_note,
      updated_at: new Date().toISOString(),
    });
    showToast("Configurações sincronizadas!");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

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

    if (supabase && trimmedUser.includes("@")) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedUser,
        password: loginPass,
      });
      if (!error && data.user) {
        const cleanLock: AdminLockoutState = { attempts: 0, lockUntil: 0 };
        setLockoutState(cleanLock);
        localStorage.setItem(adminLockoutStorageKey, JSON.stringify(cleanLock));

        const label = data.user.email || trimmedUser;
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
        appendAuditEntry("login_success", label, "Autenticação Supabase Auth");
        return;
      }
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
    await persistSettings(updatedSettings);
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
    await persistProducts(repairedProducts);
    await persistSettings(repairedSettings);
    appendAuditEntry(
      "links_repaired",
      authUserLabel,
      "Varredura e reparo automático de links e imagens executados"
    );
    showToast("Todos os links e fotos foram verificados e blindados!");
  };

  // Photo Studio handlers
  const updatePhotoForActiveProduct = async (patch: Partial<Product>, toastMsg?: string) => {
    if (!activePhotoProduct) return;
    const next = products.map((p) =>
      p.id === activePhotoProduct.id ? { ...p, ...patch } : p
    );
    await persistProducts(next);
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
      const dataUrl = await compressImageFile(file, 1080);
      const targetProd = products.find((p) => p.id === idToUpdate);
      const next = products.map((p) =>
        p.id === idToUpdate ? { ...p, image: dataUrl } : p
      );
      await persistProducts(next);

      const nextGallery = [
        {
          id: `upload-${Date.now()}`,
          label: newGalleryLabel.trim() || targetProd?.name || "Foto enviada",
          src: dataUrl,
        },
        ...(settings.custom_gallery || studioGallery),
      ];
      await persistSettings({ ...settings, custom_gallery: nextGallery });
      setNewGalleryLabel("");
      showToast("Nova foto enviada e aplicada ao produto!");
    } catch {
      showToast("Não foi possível carregar essa imagem.");
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
      const dataUrl = await compressImageFile(file, 1200);
      const slides = [...(settings.hero_slides || defaultStoreSettings.hero_slides)];
      if (!slides[selectedHeroIdx]) return;
      slides[selectedHeroIdx] = { ...slides[selectedHeroIdx], image: dataUrl };
      await persistSettings({ ...settings, hero_slides: slides });
      showToast("Foto do destaque principal atualizada!");
    } catch {
      showToast("Erro ao processar foto do destaque.");
    }
  };

  const handleUpdateHeroSlide = async (patch: Partial<HeroSlideConfig>) => {
    const slides = [...(settings.hero_slides || defaultStoreSettings.hero_slides)];
    if (!slides[selectedHeroIdx]) return;
    slides[selectedHeroIdx] = { ...slides[selectedHeroIdx], ...patch };
    await persistSettings({ ...settings, hero_slides: slides });
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
      await persistSettings({ ...settings, custom_categories: nextCats });
    }

    const parsedVariants = variantsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const savedProd: Product = {
      ...editingProduct,
      category: finalCat,
      variants:
        parsedVariants.length > 0
          ? parsedVariants
          : getDefaultVariantsForCategory(finalCat),
    };

    const exists = products.some((p) => p.id === savedProd.id);
    const next = exists
      ? products.map((p) => (p.id === savedProd.id ? savedProd : p))
      : [savedProd, ...products];

    await persistProducts(next);
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
    await persistSettings({ ...settings, custom_categories: nextCats });
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
    await persistSettings({
      ...settings,
      custom_categories: nextCats.length > 0 ? nextCats : defaultProductCategories,
    });
    showToast(`Categoria "${catName}" removida.`);
  };

  const handleSaveStoreConfig = async (e: React.FormEvent) => {
    e.preventDefault();
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

  if (!isAuthenticated) {
    const isLockedOut = lockoutRemainingSec > 0;
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
              <p>
                {settings.store_name} · Autenticação Criptografada
              </p>
            </div>
          </div>

          <div className="admin-security-banner">
            <ShieldCheck size={15} />
            <span>
              Rota oculta protegida por hash SHA-256, limite de tentativas e sessão com expiração automática.
            </span>
          </div>

          <form className="admin-auth-form" onSubmit={(e) => void handleLogin(e)}>
            <label>
              Identificação do Administrador
              <input
                type="text"
                required
                autoComplete="username"
                disabled={isLockedOut}
                placeholder="Digite seu usuário ou e-mail"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
              />
            </label>

            <label>
              Chave de Segurança
              <div className="admin-pass-input-wrap">
                <input
                  type={showLoginPass ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  disabled={isLockedOut}
                  placeholder="Digite sua senha de acesso"
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
                : "Desbloquear Painel Admin"}
            </button>
          </form>

          <Link href="/" className="admin-back-store">
            <ArrowLeft size={15} /> Voltar para a vitrine pública
          </Link>
        </div>
      </main>
    );
  }

  const pos = parsePositionPercent(activePhotoProduct?.imagePosition);
  const currentHeroSlides = settings.hero_slides || defaultStoreSettings.hero_slides;
  const activeHeroSlide = currentHeroSlides[selectedHeroIdx] || currentHeroSlides[0];

  return (
    <main className="admin-dashboard">
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
            onClick={() => setTab("fotos")}
          >
            <Camera size={16} /> Fotos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "produtos"}
            className={tab === "produtos" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => {
              setTab("produtos");
              setEditingProduct(null);
            }}
          >
            <Sparkles size={16} /> Produtos ({products.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "categorias"}
            className={tab === "categorias" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => setTab("categorias")}
          >
            <Layers size={16} /> Categorias ({allCategories.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "seguranca"}
            className={tab === "seguranca" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => setTab("seguranca")}
          >
            <ShieldCheck size={16} /> Segurança & Links
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "config"}
            className={tab === "config" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => setTab("config")}
          >
            <Sliders size={16} /> Dados da Loja
          </button>
        </nav>

        <div className="admin-topbar-actions">
          <Link href="/" className="button button-outline">
            <Eye size={15} /> Ver Loja <ArrowUpRight size={14} />
          </Link>
          <button
            type="button"
            className="button button-quiet"
            onClick={() => void handleLogout("Bloqueio manual pelo administrador")}
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
                      onClick={() => setSelectedPhotoProductId(prod.id)}
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
                          objectPosition: activePhotoProduct.imagePosition || "50% 50%",
                          transform: `scale(${activePhotoProduct.imageScale || 1})`,
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
                          Zoom da Foto ({Math.round((activePhotoProduct.imageScale || 1) * 100)}%)
                        </span>
                        <input
                          type="range"
                          min="0.8"
                          max="1.45"
                          step="0.05"
                          value={activePhotoProduct.imageScale || 1}
                          onChange={(e) =>
                            void updatePhotoForActiveProduct({
                              imageScale: Number(e.target.value),
                            })
                          }
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
                          onChange={(e) =>
                            void updatePhotoForActiveProduct({
                              imagePosition: `${e.target.value}% ${pos.y}%`,
                            })
                          }
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
                          onChange={(e) =>
                            void updatePhotoForActiveProduct({
                              imagePosition: `${pos.x}% ${e.target.value}%`,
                            })
                          }
                        />
                      </label>
                    </div>
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
                            value={activeHeroSlide.title}
                            onChange={(e) =>
                              void handleUpdateHeroSlide({ title: e.target.value })
                            }
                            placeholder="Título do slide"
                          />
                          <input
                            type="text"
                            value={activeHeroSlide.image}
                            onChange={(e) =>
                              void handleUpdateHeroSlide({ image: e.target.value })
                            }
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
                    Preço R$ (deixe vazio para “Consultar”)
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
                          {p.category} · {formatCurrencyBRL(p.price) || "Sob consulta"} ·{" "}
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
                              void persistProducts(next, p.id);
                              setConfirmDeleteId(null);
                              showToast("Produto removido.");
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
                    <KeyRound size={18} /> Credenciais Criptografadas & Rota Oculta
                  </h2>
                  <p className="admin-sub">
                    O link de administração foi ocultado da loja pública. Use{" "}
                    <strong>Ctrl + Shift + A</strong> no teclado ou toque{" "}
                    <strong>5 vezes seguidas</strong> na logo do rodapé para abrir este painel.
                  </p>
                </div>
              </div>

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
                    void persistProducts(initialProducts);
                    void persistSettings(defaultStoreSettings);
                    showToast("Padrões originais restaurados!");
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
