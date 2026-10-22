"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BatteryCharging,
  Check,
  Copy,
  CreditCard,
  Eye,
  Layers,
  Lock,
  MapPin,
  Menu,
  Minus,
  Navigation,
  PackagePlus,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  Truck,
  Watch,
  X,
} from "lucide-react";
import {
  buildGoogleMapsEmbedUrl,
  buildWhatsAppHref,
  defaultHeroSlides,
  defaultProductCategories,
  defaultStoreSettings,
  formatCurrencyBRL,
  getDefaultVariantsForCategory,
  initialProducts,
  normalizeProduct,
  normalizeSettings,
  officialLogoPath,
  Product,
  productsStorageKey,
  settingsStorageKey,
  StoreSettings,
} from "@/lib/catalog";
import { createClient } from "@/lib/supabase";

type FulfillmentMode = "Retirar na loja (Ipaussu)" | "Receber por entrega";
type PaymentPreference = "PIX (À vista)" | "Cartão de crédito" | "Dar aparelho na troca";
type CustomCondition = "Lacrado" | "Seminovo" | "Original Importado";
type AtmosphereStage = "hero" | "vitrine" | "encomenda" | "localizacao";

type CustomOrderItem = {
  id: string;
  title: string;
  condition: CustomCondition;
  quantity: number;
};

const stageAtmosphereMeta: Record<
  AtmosphereStage,
  { label: string; href: string }
> = {
  hero: { label: "Destaque", href: "#inicio" },
  vitrine: { label: "Vitrine", href: "#vitrine" },
  encomenda: { label: "Encomendas", href: "#encomenda" },
  localizacao: { label: "Localização", href: "#localizacao" },
};

function CategoryIcon({ name }: { name: string }) {
  const lower = name.toLocaleLowerCase("pt-BR");
  if (lower.includes("tudo")) return <Layers size={18} />;
  if (lower.includes("celul") || lower.includes("iphone") || lower.includes("smart"))
    return <Smartphone size={18} />;
  if (lower.includes("mobil") || lower.includes("scooter") || lower.includes("bike"))
    return <BatteryCharging size={18} />;
  if (lower.includes("perfum") || lower.includes("frag")) return <Sparkles size={18} />;
  if (lower.includes("áudio") || lower.includes("audio") || lower.includes("som"))
    return <AudioLines size={18} />;
  if (lower.includes("acess") || lower.includes("relóg") || lower.includes("watch"))
    return <Watch size={18} />;
  return <Tag size={18} />;
}

function Brand({
  storeName,
  city,
  logoUrl,
}: {
  storeName: string;
  city: string;
  logoUrl?: string;
}) {
  return (
    <a className="brand" href="#inicio" aria-label={`${storeName}, início`}>
      <span className="brand-logo-ring">
        <img
          src={logoUrl || officialLogoPath}
          alt="Logo oficial WPlay Eletrônicos"
          className="brand-logo-img"
        />
      </span>
      <span className="brand-name">
        {storeName.toUpperCase()}
        <small>{city.toUpperCase()}</small>
      </span>
    </a>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [category, setCategory] = useState<string>("Tudo");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");

  // Scroll-Driven Atmosphere Stage
  const [atmosphereStage, setAtmosphereStage] = useState<AtmosphereStage>("hero");

  // Interactive Hero Stage
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [stagePaused, setStagePaused] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Interactive Product Variants & Quick-Look Drawer
  const [chosenVariants, setChosenVariants] = useState<Record<string, string>>({
    "iphone-pro": "256 GB",
    "scooter-eletrica": "Pneu Fat",
    "perfumes-importados": "Árabe",
  });
  const [inspectedProduct, setInspectedProduct] = useState<Product | null>(null);

  // Interactive Order Studio ("Central de Encomendas")
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({
    "iphone-pro": 1,
  });
  const [customItems, setCustomItems] = useState<CustomOrderItem[]>([]);
  const [customDraftTitle, setCustomDraftTitle] = useState("");
  const [customDraftCondition, setCustomDraftCondition] =
    useState<CustomCondition>("Lacrado");
  const [orderFilterCat, setOrderFilterCat] = useState<string>("Tudo");
  const [fulfillment, setFulfillment] = useState<FulfillmentMode>(
    "Retirar na loja (Ipaussu)"
  );
  const [paymentPref, setPaymentPref] = useState<PaymentPreference>("PIX (À vista)");
  const [tradeInDevice, setTradeInDevice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customModelNote, setCustomModelNote] = useState("");
  const [customMessageOverride, setCustomMessageOverride] = useState<string | null>(null);
  const [showMessageEditor, setShowMessageEditor] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Load saved products & settings + listen for changes from /admin
  useEffect(() => {
    const syncFromLocal = () => {
      try {
        const savedProducts = localStorage.getItem(productsStorageKey);
        if (savedProducts) {
          const parsed = JSON.parse(savedProducts) as Partial<Product>[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed.map((item, idx) => normalizeProduct(item, idx)));
          }
        }
        const savedSettings = localStorage.getItem(settingsStorageKey);
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings) as Partial<StoreSettings>;
          setSettings(normalizeSettings(parsedSettings));
        }
      } catch {
        // ignore read error
      }
    };

    syncFromLocal();
    window.addEventListener("storage", syncFromLocal);

    const supabase = createClient();
    if (supabase) {
      void supabase
        .from("products")
        .select(
          "id,name,category,description,badge,price,image,published,featured,variants"
        )
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          if (data?.length) {
            const normalized = data.map((item, idx) =>
              normalizeProduct(item as Partial<Product>, idx)
            );
            setProducts(normalized);
            try {
              localStorage.setItem(productsStorageKey, JSON.stringify(normalized));
            } catch {
              // ignore
            }
          }
        });

      void supabase
        .from("store_settings")
        .select(
          "store_name,hero_headline,whatsapp_url,whatsapp_phone,instagram_url,instagram_handle,city,address_line,postal_code,maps_url,hours_lines,custom_categories,attendance_note"
        )
        .eq("id", true)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const merged = normalizeSettings(data as Partial<StoreSettings>);
            setSettings(merged);
            try {
              localStorage.setItem(settingsStorageKey, JSON.stringify(merged));
            } catch {
              // ignore
            }
          }
        });
    }

    return () => window.removeEventListener("storage", syncFromLocal);
  }, []);

  // Scroll-Driven Chromatic Atmosphere Engine
  useEffect(() => {
    let rafId = 0;

    const updateAtmosphereOnScroll = () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      const ratio = Math.min(1, Math.max(0, window.scrollY / maxScroll));

      // Smoothly shift hue (112 -> 154) and glow coordinates as the visitor scrolls
      const dynamicHue = (112 + ratio * 42).toFixed(1);
      const glowX = (18 + Math.sin(ratio * Math.PI) * 64).toFixed(1);
      const glowY = (12 + ratio * 72).toFixed(1);

      doc.style.setProperty("--scroll-progress", ratio.toFixed(4));
      doc.style.setProperty("--atmo-hue", dynamicHue);
      doc.style.setProperty("--glow-x", `${glowX}%`);
      doc.style.setProperty("--glow-y", `${glowY}%`);

      // Detect which section owns the viewport center
      const midY = window.innerHeight * 0.42;
      const locEl = document.getElementById("localizacao");
      const orderEl = document.getElementById("encomenda");
      const vitrineEl = document.getElementById("vitrine");

      let nextStage: AtmosphereStage = "hero";
      if (locEl && locEl.getBoundingClientRect().top <= midY) {
        nextStage = "localizacao";
      } else if (orderEl && orderEl.getBoundingClientRect().top <= midY) {
        nextStage = "encomenda";
      } else if (vitrineEl && vitrineEl.getBoundingClientRect().top <= midY) {
        nextStage = "vitrine";
      }

      doc.dataset.stage = nextStage;
      setAtmosphereStage((prev) => (prev === nextStage ? prev : nextStage));
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateAtmosphereOnScroll);
    };

    updateAtmosphereOnScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const stageSlides = useMemo(
    () =>
      settings.hero_slides && settings.hero_slides.length > 0
        ? settings.hero_slides
        : defaultHeroSlides,
    [settings.hero_slides]
  );

  // Auto-advance Hero Stage when not hovered
  useEffect(() => {
    if (stagePaused || stageSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveSlideIdx((prev) => (prev + 1) % stageSlides.length);
    }, 4800);
    return () => window.clearInterval(timer);
  }, [stagePaused, stageSlides.length]);

  const activeSlide = stageSlides[activeSlideIdx] || stageSlides[0];

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const tiltX = ((y - 50) / 50) * -3.5;
    const tiltY = ((x - 50) / 50) * 3.5;
    el.style.setProperty("--spot-x", `${x.toFixed(1)}%`);
    el.style.setProperty("--spot-y", `${y.toFixed(1)}%`);
    el.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
    el.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
  };

  const handleStagePointerLeave = () => {
    setStagePaused(false);
    const el = stageRef.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  };

  const handleCardPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty("--card-x", `${x.toFixed(0)}px`);
    e.currentTarget.style.setProperty("--card-y", `${y.toFixed(0)}px`);
  };

  const publishedProducts = useMemo(
    () => products.filter((p) => p.published),
    [products]
  );

  // Merge owner's custom categories + any category used by a product
  const activeCategories = useMemo(() => {
    const fromSettings = settings.custom_categories?.length
      ? settings.custom_categories
      : defaultProductCategories;
    const fromProducts = publishedProducts.map((p) => p.category);
    return Array.from(new Set([...fromSettings, ...fromProducts]));
  }, [settings.custom_categories, publishedProducts]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { Tudo: publishedProducts.length };
    for (const c of activeCategories) {
      map[c] = publishedProducts.filter((p) => p.category === c).length;
    }
    return map;
  }, [publishedProducts, activeCategories]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return publishedProducts.filter((p) => {
      if (category !== "Tudo" && p.category !== category) return false;
      if (onlyFeatured && !p.featured) return false;
      if (!normalizedQuery) return true;
      const haystack =
        `${p.name} ${p.category} ${p.description} ${p.badge} ${(p.variants || []).join(" ")}`.toLocaleLowerCase(
          "pt-BR"
        );
      return haystack.includes(normalizedQuery);
    });
  }, [publishedProducts, category, onlyFeatured, query]);

  const orderBuilderProducts = useMemo(() => {
    if (orderFilterCat === "Tudo") return publishedProducts;
    return publishedProducts.filter((p) => p.category === orderFilterCat);
  }, [publishedProducts, orderFilterCat]);

  const selectedCatalogEntries = useMemo(() => {
    return publishedProducts
      .filter((p) => (orderQuantities[p.id] || 0) > 0)
      .map((p) => ({
        product: p,
        quantity: orderQuantities[p.id] || 1,
        variant:
          chosenVariants[p.id] ||
          (p.variants && p.variants[0]) ||
          getDefaultVariantsForCategory(p.category)[0],
      }));
  }, [publishedProducts, orderQuantities, chosenVariants]);

  const totalOrderCount = useMemo(() => {
    const catCount = selectedCatalogEntries.reduce((acc, item) => acc + item.quantity, 0);
    const customCount = customItems.reduce((acc, item) => acc + item.quantity, 0);
    return catCount + customCount;
  }, [selectedCatalogEntries, customItems]);

  const generatedOrderMessage = useMemo(() => {
    const greeting = customerName.trim()
      ? `Olá, WPlay! Aqui é ${customerName.trim()}.`
      : "Olá, WPlay! Montei minha encomenda pelo site:";

    const catalogLines = selectedCatalogEntries.map(({ product, quantity, variant }) => {
      const price = formatCurrencyBRL(product.price);
      const details = [variant, price].filter(Boolean).join(" · ");
      const qtyPrefix = quantity > 1 ? `${quantity}x ` : "";
      return `• ${qtyPrefix}${product.name}${details ? ` (${details})` : ""}`;
    });

    const customLines = customItems.map((item) => {
      const qtyPrefix = item.quantity > 1 ? `${item.quantity}x ` : "";
      return `• [Sob Encomenda] ${qtyPrefix}${item.title} (${item.condition})`;
    });

    const allItemLines =
      catalogLines.length + customLines.length > 0
        ? [...catalogLines, ...customLines].join("\n")
        : "• Quero consultar opções disponíveis no catálogo";

    const fulfillmentLine = `Recebimento: ${fulfillment}`;
    const paymentLine =
      paymentPref === "Dar aparelho na troca" && tradeInDevice.trim()
        ? `Pagamento: ${paymentPref} (Meu aparelho: ${tradeInDevice.trim()})`
        : `Pagamento: ${paymentPref}`;
    const noteLine = customModelNote.trim() ? `Observação: ${customModelNote.trim()}` : "";
    const closingLine =
      "Podem confirmar disponibilidade, valor atualizado e condições?";

    return [
      greeting,
      allItemLines,
      fulfillmentLine,
      paymentLine,
      noteLine,
      closingLine,
    ]
      .filter(Boolean)
      .join("\n");
  }, [
    customerName,
    selectedCatalogEntries,
    customItems,
    fulfillment,
    paymentPref,
    tradeInDevice,
    customModelNote,
  ]);

  const activeOrderMessage = customMessageOverride ?? generatedOrderMessage;

  const selectVariant = (productId: string, variant: string) => {
    setCustomMessageOverride(null);
    setChosenVariants((prev) => ({ ...prev, [productId]: variant }));
  };

  const toggleProductInOrder = (productId: string, scrollToBuilder = false) => {
    setCustomMessageOverride(null);
    setOrderQuantities((prev) => {
      const current = prev[productId] || 0;
      if (current > 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: 1 };
    });
    if (scrollToBuilder) {
      document.getElementById("encomenda")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const adjustProductQuantity = (productId: string, delta: number) => {
    setCustomMessageOverride(null);
    setOrderQuantities((prev) => {
      const nextQty = (prev[productId] || 0) + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: Math.min(20, nextQty) };
    });
  };

  const handleAddCustomOrderItem = (e: React.FormEvent) => {
    e.preventDefault();
    const title = customDraftTitle.trim();
    if (!title) return;
    setCustomMessageOverride(null);
    setCustomItems((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        title,
        condition: customDraftCondition,
        quantity: 1,
      },
    ]);
    setCustomDraftTitle("");
    setNotice(`"${title}" adicionado à sua bandeja de encomenda!`);
  };

  const adjustCustomItemQuantity = (id: string, delta: number) => {
    setCustomMessageOverride(null);
    setCustomItems((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleCopyMessage = async (msg: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedFeedback(true);
      window.setTimeout(() => setCopiedFeedback(false), 2400);
      return true;
    } catch {
      return false;
    }
  };

  const handleSendOrderToWhatsApp = async () => {
    const { href, usesDirectText } = buildWhatsAppHref(settings, activeOrderMessage);
    const copied = await handleCopyMessage(activeOrderMessage);
    if (!usesDirectText) {
      setNotice(
        copied
          ? "Encomenda copiada! Cole na conversa do WhatsApp que abrimos."
          : "Abrindo o WhatsApp oficial da WPlay."
      );
    }
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleQuickProductConsult = async (product: Product) => {
    const variant =
      chosenVariants[product.id] ||
      (product.variants && product.variants[0]) ||
      getDefaultVariantsForCategory(product.category)[0];
    const priceLabel = formatCurrencyBRL(product.price);
    const meta = [variant, priceLabel].filter(Boolean).join(" · ");
    const quickText = `Olá, WPlay! Quero consultar: ${product.name}${
      meta ? ` (${meta})` : ""
    }. Está disponível?`;
    const { href, usesDirectText } = buildWhatsAppHref(settings, quickText);
    if (!usesDirectText) {
      const copied = await handleCopyMessage(quickText);
      if (copied) {
        setNotice(`"${product.name}" copiado! Cole no WhatsApp.`);
      }
    }
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const primaryWhatsAppHref = settings.whatsapp_url || defaultStoreSettings.whatsapp_url;
  const mapsHref = settings.maps_url || defaultStoreSettings.maps_url;
  const mapsEmbedUrl = buildGoogleMapsEmbedUrl(settings);
  const activeLogoUrl = settings.logo_url || officialLogoPath;

  return (
    <main id="inicio" data-stage={atmosphereStage}>
      {/* Fixed Scroll-Driven Chromatic Atmosphere Canvas */}
      <div className="chromatic-backdrop" aria-hidden="true">
        <div className="chromatic-orb chromatic-orb-primary" />
        <div className="chromatic-orb chromatic-orb-secondary" />
        <div className="chromatic-mesh" />
      </div>

      {/* Top Scroll Gradient Progress Ribbon */}
      <div className="scroll-spectrum-bar" aria-hidden="true" />

      <header className="header">
        <Brand
          storeName={settings.store_name}
          city={settings.city}
          logoUrl={activeLogoUrl}
        />

        <button
          className="menu-toggle"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav id="primary-navigation" className={menuOpen ? "nav nav-open" : "nav"}>
          <a
            href="#vitrine"
            className={atmosphereStage === "vitrine" ? "nav-active" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Vitrine
          </a>
          <a
            href="#encomenda"
            className={atmosphereStage === "encomenda" ? "nav-active" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Encomendar
            {totalOrderCount > 0 && (
              <span className="nav-badge">{totalOrderCount}</span>
            )}
          </a>
          <a
            href="#localizacao"
            className={atmosphereStage === "localizacao" ? "nav-active" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Localização
          </a>
          <a
            href={settings.instagram_url}
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenuOpen(false)}
          >
            Instagram <ArrowUpRight size={13} />
          </a>
          <Link
            href="/admin"
            className="admin-trigger"
            onClick={() => setMenuOpen(false)}
          >
            <Lock size={13} /> Painel Admin <ArrowUpRight size={13} />
          </Link>
        </nav>

        <a
          className="header-cta"
          href={primaryWhatsAppHref}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp <ArrowUpRight size={15} />
        </a>
      </header>

      {/* Interactive Split Stage Hero */}
      <section className="hero-stage-wrap">
        <div className="hero-left">
          <div className="hero-brand-pill">
            <img
              src={activeLogoUrl}
              alt="Logo WPlay Eletrônicos"
              className="hero-brand-logo"
            />
            <div>
              <strong>{settings.store_name}</strong>
              <a href="#localizacao" className="hero-address-chip">
                <MapPin size={12} /> {settings.address_line} · {settings.city}
              </a>
            </div>
          </div>

          <h1>
            Toque, escolha
            <br />e chame no <span>WhatsApp.</span>
          </h1>

          <div
            className="stage-switcher"
            role="tablist"
            aria-label="Explorar linhas de produtos em destaque"
          >
            {stageSlides.map((slide, idx) => {
              const active = idx === activeSlideIdx;
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? "stage-pill active" : "stage-pill"}
                  onMouseEnter={() => {
                    setStagePaused(true);
                    setActiveSlideIdx(idx);
                  }}
                  onClick={() => {
                    setActiveSlideIdx(idx);
                  }}
                >
                  <span className="stage-pill-tag">{slide.tag}</span>
                  <strong>{slide.title}</strong>
                  <ArrowRight size={15} />
                </button>
              );
            })}
          </div>

          <div className="hero-actions">
            <button
              type="button"
              className="button button-lime"
              onClick={() => {
                setCategory(activeSlide.category);
                document.getElementById("vitrine")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Ver {activeSlide.tag} <ArrowRight size={16} />
            </button>
            <a className="button button-outline" href="#encomenda">
              <ShoppingBag size={16} /> Fazer Encomenda
            </a>
            <a className="button button-outline" href="#localizacao">
              <MapPin size={16} /> Como chegar
            </a>
          </div>
        </div>

        <div
          ref={stageRef}
          className="hero-viewport"
          onPointerEnter={() => setStagePaused(true)}
          onPointerMove={handleStagePointerMove}
          onPointerLeave={handleStagePointerLeave}
        >
          {stageSlides.map((slide, idx) => (
            <img
              key={slide.id}
              src={slide.image}
              alt={slide.title}
              className={
                idx === activeSlideIdx
                  ? "hero-viewport-img active"
                  : "hero-viewport-img"
              }
            />
          ))}
          <div className="hero-spotlight" />

          <div className="hero-hud-top">
            <span className="hud-chip">{activeSlide.tag}</span>
            <div className="hud-dots" role="group" aria-label="Slide ativo">
              {stageSlides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Mostrar ${s.title}`}
                  className={idx === activeSlideIdx ? "hud-dot active" : "hud-dot"}
                  onClick={() => setActiveSlideIdx(idx)}
                />
              ))}
            </div>
          </div>

          <div className="hero-hud-bottom">
            <div className="hud-specs">
              {activeSlide.specs.map((spec) => (
                <button
                  key={spec}
                  type="button"
                  className="hud-spec-pill"
                  onClick={() => {
                    selectVariant(activeSlide.id, spec);
                    if (!orderQuantities[activeSlide.id]) {
                      toggleProductInOrder(activeSlide.id, false);
                    }
                    setNotice(`${activeSlide.title} (${spec}) adicionado à encomenda.`);
                  }}
                >
                  <Plus size={12} /> {spec}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="hud-inspect-btn"
              onClick={() => {
                const found =
                  publishedProducts.find((p) => p.id === activeSlide.id) ||
                  publishedProducts[0];
                if (found) setInspectedProduct(found);
              }}
              aria-label={`Espiar ${activeSlide.title}`}
            >
              <Eye size={16} /> Espiar
            </button>
          </div>
        </div>
      </section>

      {/* Dynamic Category Dock */}
      <section className="category-dock" aria-label="Atalhos rápidos de categorias">
        <button
          type="button"
          className={category === "Tudo" && !onlyFeatured ? "dock-tile active" : "dock-tile"}
          onClick={() => {
            setCategory("Tudo");
            setOnlyFeatured(false);
          }}
        >
          <CategoryIcon name="Tudo" />
          <span>Tudo</span>
          <b>{categoryCounts.Tudo ?? 0}</b>
        </button>

        {activeCategories.map((catName) => (
          <button
            key={catName}
            type="button"
            className={category === catName ? "dock-tile active" : "dock-tile"}
            onClick={() => {
              setCategory(catName);
              setOnlyFeatured(false);
            }}
          >
            <CategoryIcon name={catName} />
            <span>{catName}</span>
            <b>{categoryCounts[catName] ?? 0}</b>
          </button>
        ))}
      </section>

      {/* Interactive Bento Product Showcase */}
      <section className="catalog-section" id="vitrine">
        <div className="catalog-bar">
          <h2>
            Vitrine <span>WPlay.</span>
          </h2>

          <div className="catalog-controls">
            <button
              type="button"
              className={onlyFeatured ? "feature-toggle active" : "feature-toggle"}
              onClick={() => setOnlyFeatured(!onlyFeatured)}
            >
              <Star size={14} /> Destaques
            </button>

            <label className="search">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar modelo..."
                aria-label="Buscar produtos"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setQuery("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>
          </div>
        </div>

        {visibleProducts.length ? (
          <div className="bento-grid">
            {visibleProducts.map((product, index) => {
              const isSelected = (orderQuantities[product.id] || 0) > 0;
              const priceFormatted = formatCurrencyBRL(product.price);
              const variants =
                product.variants && product.variants.length > 0
                  ? product.variants
                  : getDefaultVariantsForCategory(product.category);
              const activeVariant = chosenVariants[product.id] || variants[0];
              const isWide = index === 0 && category === "Tudo" && !query && !onlyFeatured;

              return (
                <article
                  key={product.id}
                  onPointerMove={handleCardPointerMove}
                  className={[
                    "product-card",
                    isWide ? "product-card-wide" : "",
                    isSelected ? "product-card-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="product-media">
                    <img
                      src={product.image || "/images/wplay-iphone.jpg"}
                      alt={product.name}
                      loading="lazy"
                      style={{
                        objectFit: product.imageFit || "cover",
                        objectPosition: product.imagePosition || "50% 50%",
                        transform:
                          product.imageScale && product.imageScale !== 1
                            ? `scale(${product.imageScale})`
                            : undefined,
                      }}
                      onClick={() => setInspectedProduct(product)}
                    />
                    <div className="product-top-bar">
                      <span className="product-tag">{product.category}</span>
                      {product.badge && (
                        <span className="product-subtag">{product.badge}</span>
                      )}
                    </div>

                    <div className="product-quick-Floating">
                      <button
                        type="button"
                        className="icon-pill"
                        onClick={() => setInspectedProduct(product)}
                        aria-label={`Inspecionar ${product.name}`}
                        title="Ver detalhes"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        className={
                          isSelected ? "icon-pill icon-pill-lime" : "icon-pill"
                        }
                        onClick={() => toggleProductInOrder(product.id, false)}
                        aria-label={
                          isSelected
                            ? `Remover ${product.name} da encomenda`
                            : `Adicionar ${product.name} à encomenda`
                        }
                        title={isSelected ? "Na encomenda" : "Adicionar à encomenda"}
                      >
                        {isSelected ? <Check size={17} /> : <Plus size={17} />}
                      </button>
                    </div>
                  </div>

                  <div className="product-body">
                    <div className="product-head">
                      <h3>{product.name}</h3>
                      {priceFormatted ? (
                        <strong className="price-badge">{priceFormatted}</strong>
                      ) : (
                        <span className="consult-badge">Consultar</span>
                      )}
                    </div>

                    <div
                      className="variant-row"
                      role="group"
                      aria-label={`Opções para ${product.name}`}
                    >
                      {variants.map((v) => {
                        const chosen = activeVariant === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            className={chosen ? "variant-chip active" : "variant-chip"}
                            onClick={() => selectVariant(product.id, v)}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>

                    <div className="product-footer">
                      <button
                        type="button"
                        className={
                          isSelected ? "card-btn card-btn-selected" : "card-btn"
                        }
                        onClick={() => toggleProductInOrder(product.id, false)}
                      >
                        {isSelected ? (
                          <>
                            <Check size={14} /> Na bandeja ({orderQuantities[product.id]})
                          </>
                        ) : (
                          <>
                            <Plus size={14} /> Encomendar
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="card-whatsapp-btn"
                        onClick={() => void handleQuickProductConsult(product)}
                        aria-label={`Cotar ${product.name} (${activeVariant}) no WhatsApp`}
                      >
                        Cotar {activeVariant} <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-results">
            <Search size={22} />
            <p>Nada encontrado para esse filtro.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("Tudo");
                setOnlyFeatured(false);
              }}
            >
              Mostrar tudo
            </button>
          </div>
        )}
      </section>

      {/* REDESIGNED INTERACTIVE ORDER STUDIO ("Central de Encomendas Sob Medida") */}
      <section className="order-section" id="encomenda">
        <div className="order-studio-header">
          <div>
            <h2>
              Monte sua encomenda <span>sob medida.</span>
            </h2>
            <p className="order-studio-sub">
              Selecione itens da vitrine, peça qualquer modelo sob encomenda e escolha como prefere pagar e retirar.
            </p>
          </div>

          <div className="order-filter-pills" role="tablist" aria-label="Filtrar itens na encomenda">
            <button
              type="button"
              role="tab"
              aria-selected={orderFilterCat === "Tudo"}
              className={orderFilterCat === "Tudo" ? "order-cat-pill active" : "order-cat-pill"}
              onClick={() => setOrderFilterCat("Tudo")}
            >
              Todos
            </button>
            {activeCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={orderFilterCat === cat}
                className={orderFilterCat === cat ? "order-cat-pill active" : "order-cat-pill"}
                onClick={() => setOrderFilterCat(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="order-studio-grid">
          <div className="order-builder-left">
            {/* 1. Interactive Visual Product Cards */}
            <div className="order-Interactive-cards">
              {orderBuilderProducts.map((p) => {
                const qty = orderQuantities[p.id] || 0;
                const active = qty > 0;
                const variants =
                  p.variants && p.variants.length > 0
                    ? p.variants
                    : getDefaultVariantsForCategory(p.category);
                const chosenVar = chosenVariants[p.id] || variants[0];

                return (
                  <div
                    key={p.id}
                    className={
                      active ? "order-select-card active" : "order-select-card"
                    }
                  >
                    <div className="order-select-top">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="order-select-thumb"
                      />
                      <div className="order-select-info">
                        <span className="order-select-cat">{p.category}</span>
                        <strong>{p.name}</strong>
                        <small>
                          {formatCurrencyBRL(p.price) || p.badge || "Sob consulta"}
                        </small>
                      </div>

                      {active ? (
                        <div className="order-qty-stepper">
                          <button
                            type="button"
                            onClick={() => adjustProductQuantity(p.id, -1)}
                            aria-label={`Diminuir quantidade de ${p.name}`}
                          >
                            <Minus size={13} />
                          </button>
                          <span>{qty}</span>
                          <button
                            type="button"
                            onClick={() => adjustProductQuantity(p.id, 1)}
                            aria-label={`Aumentar quantidade de ${p.name}`}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="order-add-trigger"
                          onClick={() => adjustProductQuantity(p.id, 1)}
                        >
                          <Plus size={14} /> Incluir
                        </button>
                      )}
                    </div>

                    <div className="order-select-variants">
                      {variants.map((v) => (
                        <button
                          key={v}
                          type="button"
                          className={
                            chosenVar === v
                              ? "order-mini-variant active"
                              : "order-mini-variant"
                          }
                          onClick={() => {
                            selectVariant(p.id, v);
                            if (!orderQuantities[p.id]) {
                              adjustProductQuantity(p.id, 1);
                            }
                          }}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Custom Special-Order Adder */}
            <form
              className="custom-order-adder"
              onSubmit={(e) => handleAddCustomOrderItem(e)}
            >
              <div className="custom-adder-head">
                <PackagePlus size={18} />
                <div>
                  <strong>Procurando um modelo específico fora da vitrine?</strong>
                  <span>
                    Digite o aparelho, capacidade, perfume ou acessório que buscamos para você
                  </span>
                </div>
              </div>

              <div className="custom-adder-controls">
                <input
                  type="text"
                  maxLength={90}
                  placeholder="Ex.: iPhone 16 Pro Max 512GB Desert, Perfume Asad, PS5..."
                  value={customDraftTitle}
                  onChange={(e) => setCustomDraftTitle(e.target.value)}
                />
                <div className="custom-condition-pills">
                  {(["Lacrado", "Seminovo", "Original Importado"] as CustomCondition[]).map(
                    (cond) => (
                      <button
                        key={cond}
                        type="button"
                        className={
                          customDraftCondition === cond
                            ? "condition-pill active"
                            : "condition-pill"
                        }
                        onClick={() => setCustomDraftCondition(cond)}
                      >
                        {cond}
                      </button>
                    )
                  )}
                </div>
                <button type="submit" className="button button-lime">
                  <Plus size={15} /> Adicionar à Bandeja
                </button>
              </div>
            </form>

            {/* 3. Fulfillment & Payment Configurator */}
            <div className="order-preferences-grid">
              <div className="order-pref-box">
                <span className="pref-label">Como prefere receber?</span>
                <div className="pref-options">
                  <button
                    type="button"
                    className={
                      fulfillment === "Retirar na loja (Ipaussu)"
                        ? "pref-btn active"
                        : "pref-btn"
                    }
                    onClick={() => {
                      setCustomMessageOverride(null);
                      setFulfillment("Retirar na loja (Ipaussu)");
                    }}
                  >
                    <Store size={16} />
                    <div>
                      <strong>Retirar na Loja</strong>
                      <small>{settings.address_line}</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={
                      fulfillment === "Receber por entrega"
                        ? "pref-btn active"
                        : "pref-btn"
                    }
                    onClick={() => {
                      setCustomMessageOverride(null);
                      setFulfillment("Receber por entrega");
                    }}
                  >
                    <Truck size={16} />
                    <div>
                      <strong>Receber por Entrega</strong>
                      <small>Ipaussu e região</small>
                    </div>
                  </button>
                </div>
              </div>

              <div className="order-pref-box">
                <span className="pref-label">Preferência de pagamento ou troca</span>
                <div className="pref-options pref-options-3">
                  <button
                    type="button"
                    className={
                      paymentPref === "PIX (À vista)" ? "pref-btn active" : "pref-btn"
                    }
                    onClick={() => {
                      setCustomMessageOverride(null);
                      setPaymentPref("PIX (À vista)");
                    }}
                  >
                    <Sparkles size={15} />
                    <div>
                      <strong>PIX</strong>
                      <small>Melhor condição</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={
                      paymentPref === "Cartão de crédito" ? "pref-btn active" : "pref-btn"
                    }
                    onClick={() => {
                      setCustomMessageOverride(null);
                      setPaymentPref("Cartão de crédito");
                    }}
                  >
                    <CreditCard size={15} />
                    <div>
                      <strong>Cartão</strong>
                      <small>Simular parcelas</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={
                      paymentPref === "Dar aparelho na troca"
                        ? "pref-btn active"
                        : "pref-btn"
                    }
                    onClick={() => {
                      setCustomMessageOverride(null);
                      setPaymentPref("Dar aparelho na troca");
                    }}
                  >
                    <RefreshCw size={15} />
                    <div>
                      <strong>Troca</strong>
                      <small>Seu usado como parte</small>
                    </div>
                  </button>
                </div>

                {paymentPref === "Dar aparelho na troca" && (
                  <input
                    type="text"
                    className="tradein-input"
                    placeholder="Qual aparelho você quer dar na troca? (Ex.: iPhone 13 128GB, saúde 88%)"
                    value={tradeInDevice}
                    onChange={(e) => {
                      setCustomMessageOverride(null);
                      setTradeInDevice(e.target.value);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Order Tray & WhatsApp Dispatch */}
          <aside className="order-tray-dock">
            <div className="tray-header">
              <div className="tray-brand">
                <img
                  src={activeLogoUrl}
                  alt="Logo WPlay"
                  className="tray-brand-logo"
                />
                <div>
                  <strong>Bandeja de Encomenda</strong>
                  <span>
                    {settings.store_name} · {settings.city}
                  </span>
                </div>
              </div>
              <span className="tray-count-pill">
                {totalOrderCount} {totalOrderCount === 1 ? "item" : "itens"}
              </span>
            </div>

            {/* Selected Items inside Tray */}
            <div className="tray-items-list">
              {selectedCatalogEntries.length === 0 && customItems.length === 0 ? (
                <div className="tray-empty">
                  <ShoppingBag size={20} />
                  <p>
                    Toque em <strong>+ Incluir</strong> nos produtos ao lado ou adicione um pedido sob encomenda.
                  </p>
                </div>
              ) : (
                <>
                  {selectedCatalogEntries.map(({ product, quantity, variant }) => (
                    <div className="tray-item-row" key={product.id}>
                      <img src={product.image} alt={product.name} />
                      <div className="tray-item-meta">
                        <strong>{product.name}</strong>
                        <span>{variant}</span>
                      </div>
                      <div className="tray-item-qty">
                        <button
                          type="button"
                          onClick={() => adjustProductQuantity(product.id, -1)}
                          aria-label="Diminuir"
                        >
                          <Minus size={12} />
                        </button>
                        <b>{quantity}x</b>
                        <button
                          type="button"
                          onClick={() => adjustProductQuantity(product.id, 1)}
                          aria-label="Aumentar"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {customItems.map((cItem) => (
                    <div className="tray-item-row tray-item-custom" key={cItem.id}>
                      <span className="tray-custom-badge">Sob Medida</span>
                      <div className="tray-item-meta">
                        <strong>{cItem.title}</strong>
                        <span>{cItem.condition}</span>
                      </div>
                      <div className="tray-item-qty">
                        <button
                          type="button"
                          onClick={() => adjustCustomItemQuantity(cItem.id, -1)}
                          aria-label="Remover"
                        >
                          <Trash2 size={12} />
                        </button>
                        <b>{cItem.quantity}x</b>
                        <button
                          type="button"
                          onClick={() => adjustCustomItemQuantity(cItem.id, 1)}
                          aria-label="Mais um"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Customer Name & Optional Note */}
            <div className="tray-customer-fields">
              <input
                type="text"
                maxLength={50}
                placeholder="Seu nome (opcional)"
                value={customerName}
                onChange={(e) => {
                  setCustomMessageOverride(null);
                  setCustomerName(e.target.value);
                }}
              />
              <input
                type="text"
                maxLength={120}
                placeholder="Alguma dúvida ou detalhe extra?"
                value={customModelNote}
                onChange={(e) => {
                  setCustomMessageOverride(null);
                  setCustomModelNote(e.target.value);
                }}
              />
            </div>

            {/* Live Message Preview / Editor Toggle */}
            <div className="tray-message-box">
              <div className="tray-message-bar">
                <span>Mensagem pronta para envio</span>
                <div className="tray-message-actions">
                  {customMessageOverride !== null && (
                    <button
                      type="button"
                      className="order-reset-btn"
                      onClick={() => setCustomMessageOverride(null)}
                    >
                      <RotateCcw size={12} /> Restaurar
                    </button>
                  )}
                  <button
                    type="button"
                    className="order-reset-btn"
                    onClick={() => setShowMessageEditor(!showMessageEditor)}
                  >
                    {showMessageEditor ? "Ocultar editor" : "Editar texto"}
                  </button>
                </div>
              </div>

              {showMessageEditor ? (
                <textarea
                  rows={5}
                  className="tray-textarea"
                  value={activeOrderMessage}
                  onChange={(e) => setCustomMessageOverride(e.target.value)}
                />
              ) : (
                <pre className="tray-message-preview">{activeOrderMessage}</pre>
              )}
            </div>

            <div className="ticket-actions">
              <button
                type="button"
                className="button button-lime ticket-send"
                onClick={() => void handleSendOrderToWhatsApp()}
              >
                Enviar Encomenda no WhatsApp <Send size={15} />
              </button>
              <button
                type="button"
                className="button button-outline"
                onClick={() => void handleCopyMessage(activeOrderMessage)}
                aria-label="Copiar mensagem da encomenda"
                title="Copiar mensagem"
              >
                {copiedFeedback ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <p className="ticket-footnote">{settings.attendance_note}</p>
          </aside>
        </div>
      </section>

      {/* Store Location Section */}
      <section className="location-section" id="localizacao">
        <div className="location-head">
          <h2>
            Visite a loja em <span>Ipaussu.</span>
          </h2>
        </div>

        <div className="location-layout">
          <div className="location-card">
            <div className="location-card-top">
              <span className="location-pin-badge" aria-hidden="true">
                <MapPin size={22} />
              </span>
              <img
                src={activeLogoUrl}
                alt="Logo Oficial WPlay Eletrônicos"
                className="location-card-logo"
              />
            </div>

            <h3>{settings.store_name}</h3>

            <p className="location-address">
              {settings.address_line}
              <br />
              {settings.city} · CEP {settings.postal_code}
            </p>

            <div className="location-hours">
              {(settings.hours_lines || defaultStoreSettings.hours_lines).map(
                (line, idx) => (
                  <p key={idx}>{line}</p>
                )
              )}
            </div>

            <a
              className="location-route-btn"
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation size={16} /> Ver rota no mapa
            </a>
          </div>

          <div className="location-map-shell">
            <div className="location-map-floating">
              <div>
                <strong>{settings.address_line}</strong>
                <span>
                  {settings.address_line} - {settings.city}, {settings.postal_code}, Brasil
                </span>
              </div>
              <a
                className="location-maps-pill"
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
              >
                <ArrowUpRight size={15} /> Abrir no Maps
              </a>
            </div>

            <iframe
              title={`Mapa de localização ${settings.store_name}`}
              src={mapsEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="location-map-iframe"
            />
          </div>
        </div>
      </section>

      {/* Footer with Official WPlay Logo */}
      <footer className="footer">
        <div className="footer-brand-block">
          <Brand
            storeName={settings.store_name}
            city={settings.city}
            logoUrl={activeLogoUrl}
          />
          <p className="footer-address-line">
            {settings.address_line} · {settings.city} · CEP {settings.postal_code}
          </p>
        </div>

        <div className="footer-links">
          <a href={mapsHref} target="_blank" rel="noreferrer">
            <MapPin size={14} /> Abrir no Google Maps
          </a>
          <a href={settings.instagram_url} target="_blank" rel="noreferrer">
            {settings.instagram_handle} <ArrowUpRight size={14} />
          </a>
          <a href={primaryWhatsAppHref} target="_blank" rel="noreferrer">
            WhatsApp Oficial <ArrowUpRight size={14} />
          </a>
          <Link href="/admin" className="footer-admin-link">
            <Lock size={13} /> Painel Admin (/admin)
          </Link>
        </div>
      </footer>

      {/* Interactive Floating Bag / Atmosphere Indicator / WhatsApp Dock */}
      <div className="floating-dock">
        <a
          href={stageAtmosphereMeta[atmosphereStage].href}
          className="atmosphere-stage-pill"
          aria-label={`Seção ativa: ${stageAtmosphereMeta[atmosphereStage].label}`}
        >
          <span className="atmosphere-stage-dot" />
          <span>{stageAtmosphereMeta[atmosphereStage].label}</span>
        </a>

        {totalOrderCount > 0 && (
          <a href="#encomenda" className="floating-bag">
            <span className="bag-count">{totalOrderCount}</span>
            <span>Ver bandeja</span>
          </a>
        )}
        <a
          className="whatsapp-float"
          href={primaryWhatsAppHref}
          target="_blank"
          rel="noreferrer"
          aria-label="Chamar a WPlay no WhatsApp"
        >
          <img
            src={activeLogoUrl}
            alt="Logo WPlay"
            className="whatsapp-float-logo"
          />
          <span>WhatsApp</span>
          <ArrowUpRight size={15} />
        </a>
      </div>

      {/* Interactive Product Quick-Look Sheet */}
      {inspectedProduct && (
        <div
          className="quicklook-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setInspectedProduct(null);
          }}
        >
          <div
            className="quicklook-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quicklook-title"
          >
            <button
              type="button"
              className="quicklook-close"
              onClick={() => setInspectedProduct(null)}
              aria-label="Fechar visualização"
            >
              <X size={18} />
            </button>

            <div className="quicklook-media">
              <img src={inspectedProduct.image} alt={inspectedProduct.name} />
            </div>

            <div className="quicklook-content">
              <span className="product-tag">{inspectedProduct.category}</span>
              <h3 id="quicklook-title">{inspectedProduct.name}</h3>
              <p>{inspectedProduct.description}</p>

              <div className="variant-row">
                {(inspectedProduct.variants?.length
                  ? inspectedProduct.variants
                  : getDefaultVariantsForCategory(inspectedProduct.category)
                ).map((v) => {
                  const active =
                    (chosenVariants[inspectedProduct.id] ||
                      (inspectedProduct.variants || [])[0]) === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      className={active ? "variant-chip active" : "variant-chip"}
                      onClick={() => selectVariant(inspectedProduct.id, v)}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>

              <div className="quicklook-actions">
                <button
                  type="button"
                  className="button button-lime"
                  onClick={() => void handleQuickProductConsult(inspectedProduct)}
                >
                  Chamar no WhatsApp <ArrowUpRight size={16} />
                </button>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => {
                    const id = inspectedProduct.id;
                    setInspectedProduct(null);
                    if (!orderQuantities[id]) {
                      toggleProductInOrder(id, true);
                    } else {
                      document
                        .getElementById("encomenda")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                >
                  Incluir na encomenda
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Fechar aviso"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
