"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  Eye,
  FolderPlus,
  ImagePlus,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import {
  adminSessionStorageKey,
  compressImageFile,
  defaultProductCategories,
  defaultStoreSettings,
  formatCurrencyBRL,
  getDefaultVariantsForCategory,
  HeroSlideConfig,
  initialProducts,
  normalizeProduct,
  normalizeSettings,
  officialLogoPath,
  Product,
  productsStorageKey,
  settingsStorageKey,
  StoreSettings,
   studioGallery,
} from "@/lib/catalog";
import { createClient } from "@/lib/supabase";

type AdminTab = "fotos" | "produtos" | "categorias" | "config";

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

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [tab, setTab] = useState<AdminTab>("fotos");
  const [notice, setNotice] = useState("");

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authUserLabel, setAuthUserLabel] = useState("Administrador WPlay");

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
        setHoursTextarea(parsedSettings.hours_lines.join("\n"));
      }
      const savedSession = sessionStorage.getItem(adminSessionStorageKey);
      if (savedSession) {
        setIsAuthenticated(true);
        setAuthUserLabel(savedSession);
      }
    } catch {
      // ignore storage read error
    }

    if (supabase) {
      void supabase.auth.getUser().then(({ data }) => {
        if (data.user?.email) {
          setIsAuthenticated(true);
          setAuthUserLabel(data.user.email);
          sessionStorage.setItem(adminSessionStorageKey, data.user.email);
        }
        setAuthChecking(false);
      });
    } else {
      setAuthChecking(false);
    }
  }, [supabase]);

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
    const trimmedUser = loginUser.trim();
    const expectedUser = (settings.admin_user || "admin").toLocaleLowerCase("pt-BR");
    const expectedPin = settings.admin_pin || "wplay2026";

    if (
      (trimmedUser.toLocaleLowerCase("pt-BR") === expectedUser ||
        trimmedUser.toLocaleLowerCase("pt-BR") === "wplay" ||
        trimmedUser.toLocaleLowerCase("pt-BR") === "admin@wplay.com") &&
      loginPass === expectedPin
    ) {
      const label = trimmedUser || "admin";
      sessionStorage.setItem(adminSessionStorageKey, label);
      setAuthUserLabel(label);
      setIsAuthenticated(true);
      setLoginPass("");
      return;
    }

    if (supabase && trimmedUser.includes("@")) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedUser,
        password: loginPass,
      });
      if (!error && data.user) {
        const label = data.user.email || trimmedUser;
        sessionStorage.setItem(adminSessionStorageKey, label);
        setAuthUserLabel(label);
        setIsAuthenticated(true);
        setLoginPass("");
        return;
      }
    }

    setLoginError(
      `Credenciais inválidas. Use o usuário "${settings.admin_user || "admin"}" e a senha configurada.`
    );
  };

  const handleLogout = async () => {
    sessionStorage.removeItem(adminSessionStorageKey);
    if (supabase) {
      await supabase.auth.signOut();
    }
    setIsAuthenticated(false);
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

      // Also add to custom gallery so admin can reuse it
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
          <p>Carregando painel administrativo...</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="admin-route-shell">
        <div className="admin-auth-card">
          <div className="admin-auth-top">
            <span className="brand-logo-ring admin-auth-logo">
              <img
                src={settings.logo_url || officialLogoPath}
                alt="Logo WPlay Eletrônicos"
                className="brand-logo-img"
              />
            </span>
            <div>
              <h1>Painel do Administrador</h1>
              <p>
                {settings.store_name} · {settings.city}
              </p>
            </div>
          </div>

          <form className="admin-auth-form" onSubmit={(e) => void handleLogin(e)}>
            <label>
              Usuário ou E-mail do Admin
              <input
                type="text"
                required
                placeholder="Ex.: admin"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
              />
            </label>

            <label>
              Senha de Acesso
              <input
                type="password"
                required
                placeholder="Digite a senha do painel"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
              />
            </label>

            {loginError && <p className="admin-auth-error">{loginError}</p>}

            <button type="submit" className="button button-lime admin-auth-submit">
              <Lock size={16} /> Entrar no Painel Admin
            </button>
          </form>

          <div className="admin-auth-helper">
            <div>
              <KeyRound size={15} />
              <span>
                Acesso padrão local: usuário <strong>{settings.admin_user || "admin"}</strong> ·
                senha <strong>{settings.admin_pin || "wplay2026"}</strong>
              </span>
            </div>
            <button
              type="button"
              className="admin-autofill-btn"
              onClick={() => {
                setLoginUser(settings.admin_user || "admin");
                setLoginPass(settings.admin_pin || "wplay2026");
              }}
            >
              Preencher acesso rápido
            </button>
          </div>

          <Link href="/" className="admin-back-store">
            <ArrowLeft size={15} /> Voltar para a loja pública
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
            />
          </span>
          <div>
            <h1>Central Admin WPlay</h1>
            <span className="admin-session-pill">
              <span className="status-dot status-online" /> Conectado como {authUserLabel}
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
            <Camera size={16} /> Fotos dos Produtos
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
            aria-selected={tab === "config"}
            className={tab === "config" ? "admin-nav-tab active" : "admin-nav-tab"}
            onClick={() => setTab("config")}
          >
            <Sliders size={16} /> Loja, Mapa & Senha
          </button>
        </nav>

        <div className="admin-topbar-actions">
          <Link href="/" className="button button-outline">
            <Eye size={15} /> Ver Loja <ArrowUpRight size={14} />
          </Link>
          <button type="button" className="button button-quiet" onClick={() => void handleLogout()}>
            <LogOut size={15} /> Sair
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
                      <img src={prod.image} alt={prod.name} />
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
                        <RotateCcw size={13} /> Resetar
                      </button>
                    </div>

                    <div className="framing-sliders">
                      <label>
                        <span>Zoom da Foto ({Math.round((activePhotoProduct.imageScale || 1) * 100)}%)</span>
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
                            <img src={item.src} alt={item.label} />
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
                      setEditingProduct(null);
                      setTab("fotos");
                    }}
                  >
                    <Camera size={16} /> Personalizar Foto deste Produto
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="admin-products-head">
                  <div>
                    <h2>Catálogo de Produtos</h2>
                    <p className="admin-helper-text">
                      Adicione novos produtos, edite variantes ou clique em “Trocar Foto” para abrir o estúdio.
                    </p>
                  </div>
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
                        variants: ["Pronta entrega", "Consultar cores"],
                      })
                    }
                  >
                    <Plus size={16} /> Novo Produto
                  </button>
                </div>

                <div className="admin-list">
                  {products.map((p) => (
                    <div className="admin-row" key={p.id}>
                      <div className="admin-row-main">
                        <img src={p.image} alt={p.name} className="admin-row-thumb" />
                        <div>
                          <strong>{p.name || "Sem nome"}</strong>
                          <span>
                            {p.category} · {formatCurrencyBRL(p.price) || "Sob consulta"} ·{" "}
                            {p.published ? "Publicado" : "Oculto"}
                          </span>
                        </div>
                      </div>

                      <div className="admin-row-actions">
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
                          Editar Dados
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = products.map((item) =>
                              item.id === p.id ? { ...item, featured: !item.featured } : item
                            );
                            void persistProducts(next);
                          }}
                        >
                          <Star size={14} /> {p.featured ? "Destaque" : "Normal"}
                        </button>
                        {confirmDeleteId === p.id ? (
                          <button
                            type="button"
                            className="admin-delete-confirm"
                            onClick={() => {
                              const next = products.filter((item) => item.id !== p.id);
                              setConfirmDeleteId(null);
                              void persistProducts(next, p.id);
                            }}
                          >
                            Confirmar Exclusão
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

        {/* TAB 3: CATEGORIAS PERSONALIZADAS */}
        {tab === "categorias" && (
          <div className="admin-section-card">
            <div className="admin-products-head">
              <div>
                <h2>Categorias da Loja</h2>
                <p className="admin-helper-text">
                  Crie novas categorias, escolha a ordem em que aparecem no topo da vitrine ou adicione produtos nelas.
                </p>
              </div>
            </div>

            <form className="category-create-bar" onSubmit={(e) => void handleCreateCategory(e)}>
              <input
                type="text"
                maxLength={36}
                placeholder="Nome da nova categoria (ex.: Videogames, JBL, Drones...)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <button type="submit" className="button button-lime">
                <FolderPlus size={16} /> Criar Categoria
              </button>
            </form>

            <div className="admin-list">
              {allCategories.map((catName, idx) => {
                const count = products.filter((p) => p.category === catName).length;
                return (
                  <div className="admin-row" key={catName}>
                    <div className="admin-row-main">
                      <span className="admin-cat-icon">
                        <Layers size={16} />
                      </span>
                      <div>
                        <strong>{catName}</strong>
                        <span>
                          {count} {count === 1 ? "produto vinculado" : "produtos vinculados"}
                        </span>
                      </div>
                    </div>

                    <div className="admin-row-actions">
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

        {/* TAB 4: LOJA, MAPA, LOGO & SENHA DO ADMIN */}
        {tab === "config" && (
          <div className="admin-section-card">
            <form className="product-form" onSubmit={(e) => void handleSaveStoreConfig(e)}>
              <div className="admin-products-head">
                <h2>Identidade da Loja, Localização & Segurança</h2>
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
                  Telefone WhatsApp com DDD (opcional p/ texto direto)
                  <input
                    type="tel"
                    placeholder="5514999999999"
                    value={draftSettings.whatsapp_phone ?? ""}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        whatsapp_phone: e.target.value.trim() || null,
                      })
                    }
                  />
                </label>
              </div>

              <div className="form-row-2">
                <label>
                  Usuário do Painel Admin
                  <input
                    type="text"
                    required
                    value={draftSettings.admin_user}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, admin_user: e.target.value })
                    }
                  />
                </label>

                <label>
                  Senha do Painel Admin
                  <input
                    type="text"
                    required
                    value={draftSettings.admin_pin}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, admin_pin: e.target.value })
                    }
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
