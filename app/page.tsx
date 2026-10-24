"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BatteryCharging,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  Layers,
  MapPin,
  Menu,
  Minus,
  Navigation,
  PackagePlus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
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
  Zap,
} from "lucide-react";
import {
  buildGoogleMapsEmbedUrl,
  buildWhatsAppHref,
  defaultHeroSlides,
  defaultProductCategories,
  defaultStoreSettings,
  formatCurrencyBRL,
  getDefaultVariantsForCategory,
  getFallbackImageForCategory,
  handleImageErrorFallback,
  initialProducts,
  normalizeProduct,
  normalizeSettings,
  officialLogoPath,
  Product,
  productsStorageKey,
  sanitizeExternalUrl,
  settingsStorageKey,
  StoreSettings,
} from "@/lib/catalog";
import {
  formatIphoneSelectionSummary,
  getIphoneModelById,
  IphoneFinish,
  iphoneGenerations,
  iphoneLineup,
  IphoneModelSpec,
} from "@/lib/iphone-models";
import { Iphone3DStudio } from "@/app/components/Iphone3DStudio";
import { Product3DStudio } from "@/app/components/Product3DStudio";
import { createClient } from "@/lib/supabase";
import { StoreAtmosphere } from "@/app/components/StoreAtmosphere";

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

type SafeLinkRecoveryState = {
  label: string;
  url: string;
  repaired: boolean;
  copiedMessage?: string;
} | null;

function isIphoneOrCellularProduct(p: Product | null | undefined): boolean {
  if (!p) return false;
  const hay = `${p.id} ${p.name} ${p.category}`.toLocaleLowerCase("pt-BR");
  return (
    hay.includes("iphone") ||
    hay.includes("celul") ||
    hay.includes("smartphone")
  );
}

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
  onSecretTrigger,
}: {
  storeName: string;
  city: string;
  logoUrl?: string;
  onSecretTrigger?: () => void;
}) {
  const clickTimestampsRef = useRef<number[]>([]);

  const handleBrandClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onSecretTrigger) return;
    const now = Date.now();
    const recent = clickTimestampsRef.current.filter((t) => now - t < 2000);
    recent.push(now);
    clickTimestampsRef.current = recent;
    if (recent.length >= 5) {
      e.preventDefault();
      clickTimestampsRef.current = [];
      onSecretTrigger();
    }
  };

  return (
    <a
      className="brand"
      href="#inicio"
      aria-label={`${storeName}, início`}
      onClick={handleBrandClick}
    >
      <span className="brand-logo-ring">
        <img
          src={logoUrl || officialLogoPath}
          alt="Logo oficial WPlay Eletrônicos"
          className="brand-logo-img"
          onError={(e) => handleImageErrorFallback(e, officialLogoPath)}
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
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [category, setCategory] = useState<string>("Tudo");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [ambientPaused, setAmbientPaused] = useState(false);
  const [notice, setNotice] = useState("");
  const [safeLinkRecovery, setSafeLinkRecovery] = useState<SafeLinkRecoveryState>(null);

  // Scroll-Driven Atmosphere Stage
  const [atmosphereStage, setAtmosphereStage] = useState<AtmosphereStage>("hero");

  // Interactive Hero Stage
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [stagePaused, setStagePaused] = useState(true);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Interactive iPhone 13 -> 18 Pro Max Configurator State
  const [activeIphoneGen, setActiveIphoneGen] = useState<13 | 14 | 15 | 16 | 17 | 18>(16);
  const [selectedIphoneModelId, setSelectedIphoneModelId] = useState<string>("iphone-16-pro-max");
  const [selectedIphoneStorage, setSelectedIphoneStorage] = useState<string>("256 GB");
  const [selectedIphoneFinishId, setSelectedIphoneFinishId] = useState<string>("desert-titanium");
  const [selectedIphoneCondition, setSelectedIphoneCondition] = useState<"Lacrado" | "Seminovo">("Lacrado");

  const activeIphoneModel: IphoneModelSpec = useMemo(
    () => getIphoneModelById(selectedIphoneModelId),
    [selectedIphoneModelId]
  );

  const activeIphoneStorage = useMemo(() => {
    if (activeIphoneModel.storages.includes(selectedIphoneStorage)) {
      return selectedIphoneStorage;
    }
    return activeIphoneModel.storages[0];
  }, [activeIphoneModel, selectedIphoneStorage]);

  const activeIphoneFinish: IphoneFinish = useMemo(() => {
    return (
      activeIphoneModel.finishes.find((f) => f.id === selectedIphoneFinishId) ||
      activeIphoneModel.finishes[0]
    );
  }, [activeIphoneModel, selectedIphoneFinishId]);

  const activeIphoneSummary = useMemo(
    () =>
      formatIphoneSelectionSummary(
        activeIphoneModel,
        activeIphoneStorage,
        activeIphoneFinish,
        selectedIphoneCondition
      ),
    [activeIphoneModel, activeIphoneStorage, activeIphoneFinish, selectedIphoneCondition]
  );

  // Interactive Product Variants & Quick-Look Drawer
  const [chosenVariants, setChosenVariants] = useState<Record<string, string>>({
    "iphone-pro": "iPhone 16 Pro Max · 256 GB · Titânio-deserto (Lacrado)",
    "scooter-eletrica": "Pneu Fat",
    "perfumes-importados": "Árabe",
  });
  const [inspectedProduct, setInspectedProduct] = useState<Product | null>(null);

  // Discrete Owner-Only Admin Route Shortcut (Ctrl+Shift+A or Ctrl+Alt+A)
  useEffect(() => {
    const handleOwnerKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isInput) return;

      if (
        event.ctrlKey &&
        (event.shiftKey || event.altKey) &&
        event.key.toLocaleLowerCase() === "a"
      ) {
        event.preventDefault();
        router.push("/admin");
      }
    };
    window.addEventListener("keydown", handleOwnerKeydown);
    return () => window.removeEventListener("keydown", handleOwnerKeydown);
  }, [router]);

  useEffect(() => {
    if (!inspectedProduct) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = document.querySelector<HTMLElement>(".quicklook-sheet");
    panel?.querySelector<HTMLElement>("button")?.focus();
    const handleModalKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInspectedProduct(null);
      if (event.key !== "Tab" || !panel) return;
      const controls = [
        ...panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
        ),
      ];
      const firstControl = controls[0];
      const lastControl = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault();
        lastControl?.focus();
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault();
        firstControl?.focus();
      }
    };
    document.addEventListener("keydown", handleModalKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleModalKey);
      previousFocus?.focus();
    };
  }, [inspectedProduct]);

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

  // Sync iPhone configurator summary to the Celulares product variant
  const applyIphoneConfiguration = (
    nextModel: IphoneModelSpec,
    nextStorage?: string,
    nextFinish?: IphoneFinish,
    nextCondition: "Lacrado" | "Seminovo" = selectedIphoneCondition
  ) => {
    const validStorage =
      nextStorage && nextModel.storages.includes(nextStorage)
        ? nextStorage
        : nextModel.storages.includes(selectedIphoneStorage)
        ? selectedIphoneStorage
        : nextModel.storages[0];
    const validFinish =
      nextFinish && nextModel.finishes.some((f) => f.id === nextFinish.id)
        ? nextFinish
        : nextModel.finishes.find((f) => f.id === selectedIphoneFinishId) ||
          nextModel.finishes[0];

    setActiveIphoneGen(nextModel.generation);
    setSelectedIphoneModelId(nextModel.id);
    setSelectedIphoneStorage(validStorage);
    setSelectedIphoneFinishId(validFinish.id);
    setSelectedIphoneCondition(nextCondition);
    setCustomMessageOverride(null);

    const summary = formatIphoneSelectionSummary(
      nextModel,
      validStorage,
      validFinish,
      nextCondition
    );
    setChosenVariants((prev) => ({
      ...prev,
      "iphone-pro": summary,
    }));
  };

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

  useEffect(() => {
    const stageTargets: [string, AtmosphereStage][] = [
      [".hero-stage-wrap", "hero"],
      ["#vitrine", "vitrine"],
      ["#encomenda", "encomenda"],
      ["#localizacao", "localizacao"],
    ];
    const stageByElement = new Map<Element, AtmosphereStage>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const stage = stageByElement.get(entry.target);
          if (stage) {
            document.documentElement.dataset.stage = stage;
            setAtmosphereStage(stage);
          }
        }
      },
      { rootMargin: "-12% 0px -58% 0px" }
    );
    for (const [selector, stage] of stageTargets) {
      const element = document.querySelector(selector);
      if (element) {
        stageByElement.set(element, stage);
        observer.observe(element);
      }
    }
    return () => observer.disconnect();
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
    if (
      stagePaused ||
      stageSlides.length <= 1 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = window.setInterval(() => {
      setActiveSlideIdx((prev) => (prev + 1) % stageSlides.length);
    }, 4800);
    return () => window.clearInterval(timer);
  }, [stagePaused, stageSlides.length]);

  const activeSlide = stageSlides[activeSlideIdx] || stageSlides[0];

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    setStagePaused(true);
    const el = stageRef.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
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
      const extraIphoneSearch = isIphoneOrCellularProduct(p)
        ? iphoneLineup.map((m) => `${m.name} ${m.storages.join(" ")}`).join(" ")
        : "";
      const haystack =
        `${p.name} ${p.category} ${p.description} ${p.badge} ${(p.variants || []).join(" ")} ${extraIphoneSearch}`.toLocaleLowerCase(
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
        variant: isIphoneOrCellularProduct(p)
          ? chosenVariants[p.id] || activeIphoneSummary
          : chosenVariants[p.id] ||
            (p.variants && p.variants[0]) ||
            getDefaultVariantsForCategory(p.category)[0],
      }));
  }, [publishedProducts, orderQuantities, chosenVariants, activeIphoneSummary]);

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
    const current = orderQuantities[productId] || 0;
    const targetProduct = publishedProducts.find((p) => p.id === productId);
    setOrderQuantities((prev) => {
      const curr = prev[productId] || 0;
      if (curr > 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: 1 };
    });
    if (current === 0 && targetProduct) {
      setNotice(`${targetProduct.name} adicionado ao seu pedido!`);
    }
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

  // Safe External Navigation & Broken-Link Fallback Guard
  const openSafeExternalLink = async (
    rawUrl: string | null | undefined,
    fallbackUrl: string,
    label: string,
    copyPayload?: string
  ) => {
    const { url, repaired } = sanitizeExternalUrl(rawUrl, fallbackUrl);
    if (copyPayload) {
      await handleCopyMessage(copyPayload);
    }
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened || repaired) {
      setSafeLinkRecovery({
        label,
        url,
        repaired,
        copiedMessage: copyPayload,
      });
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
    await openSafeExternalLink(
      href,
      defaultStoreSettings.whatsapp_url,
      "WhatsApp Oficial WPlay",
      activeOrderMessage
    );
  };

  const handleQuickProductConsult = async (product: Product) => {
    const variant = isIphoneOrCellularProduct(product)
      ? chosenVariants[product.id] || activeIphoneSummary
      : chosenVariants[product.id] ||
        (product.variants && product.variants[0]) ||
        getDefaultVariantsForCategory(product.category)[0];
    const priceLabel = formatCurrencyBRL(product.price);
    const meta = [variant, priceLabel].filter(Boolean).join(" · ");
    const quickText = `Olá, WPlay! Quero comprar/consultar: ${product.name}${
      meta ? ` (${meta})` : ""
    }. Está disponível para retirada ou entrega?`;
    const { href, usesDirectText } = buildWhatsAppHref(settings, quickText);
    if (!usesDirectText) {
      const copied = await handleCopyMessage(quickText);
      if (copied) {
        setNotice(`"${meta || product.name}" copiado! Cole no WhatsApp.`);
      }
    }
    await openSafeExternalLink(
      href,
      defaultStoreSettings.whatsapp_url,
      `Comprar ${product.name}`,
      quickText
    );
  };

  const handleTopBarBuyClick = () => {
    setMenuOpen(false);
    if (totalOrderCount === 0 && activeSlide) {
      const targetId = activeSlide.id || "iphone-pro";
      setOrderQuantities({ [targetId]: 1 });
      setNotice(`Adicionamos ${activeSlide.title} ao seu pedido para agilizar!`);
    }
    document.getElementById("encomenda")?.scrollIntoView({ behavior: "smooth" });
  };

  const primaryWhatsAppHref = buildWhatsAppHref(settings).href;
  const safeInstagramUrl = sanitizeExternalUrl(
    settings.instagram_url,
    defaultStoreSettings.instagram_url
  ).url;
  const mapsHref = sanitizeExternalUrl(
    settings.maps_url,
    defaultStoreSettings.maps_url
  ).url;
  const mapsEmbedUrl = buildGoogleMapsEmbedUrl(settings);
  const activeLogoUrl = settings.logo_url || officialLogoPath;

  return (
    <main id="inicio" className="storefront-clean" data-stage={atmosphereStage}>
      <StoreAtmosphere paused={ambientPaused} />

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
            href={safeInstagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              void openSafeExternalLink(
                settings.instagram_url,
                defaultStoreSettings.instagram_url,
                "Instagram WPlay"
              );
            }}
          >
            Instagram <ArrowUpRight size={13} />
          </a>
        </nav>

        <div className="header-action-group">
          <button
            type="button"
            className="ambient-toggle"
            aria-pressed={ambientPaused}
            aria-label={
              ambientPaused ? "Ativar iluminação dinâmica" : "Pausar iluminação dinâmica"
            }
            title={
              ambientPaused ? "Ativar iluminação dinâmica" : "Pausar iluminação dinâmica"
            }
            onClick={() => setAmbientPaused((previous) => !previous)}
          >
            {ambientPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>

          <button
            type="button"
            className={`header-buy-cta ${totalOrderCount > 0 ? "has-items" : ""}`}
            onClick={handleTopBarBuyClick}
            aria-label={
              totalOrderCount > 0
                ? `Comprar agora (${totalOrderCount} ${
                    totalOrderCount === 1 ? "item selecionado" : "itens selecionados"
                  })`
                : "Comprar agora"
            }
          >
            <ShoppingBag size={15} />
            <span>{totalOrderCount > 0 ? "Comprar agora" : "Comprar"}</span>
            {totalOrderCount > 0 && (
              <span className="header-buy-badge">{totalOrderCount}</span>
            )}
          </button>

          <button
            type="button"
            className="header-quick-whatsapp"
            onClick={() => void handleSendOrderToWhatsApp()}
            title="Finalizar pedido em 1 clique pelo WhatsApp"
          >
            <Zap size={14} />
            <span>1-Clique</span>
          </button>
        </div>
      </header>

      {/* Interactive Split Stage Hero */}
      <section className="hero-stage-wrap">
        <div className="hero-left">
          <h1>
            Toque, escolha
            <br />e compre pelo <span>WhatsApp.</span>
          </h1>

          <p className="hero-summary">
            iPhones do 13 ao 18 Pro Max, Scooters Elétricas, Perfumes e Áudio em
            Ipaussu. Atendimento direto, sem fila e com avaliação imediata na troca.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="button button-lime"
              onClick={() => {
                setCategory(activeSlide.category);
                document.getElementById("vitrine")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Explorar {activeSlide.tag} <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={handleTopBarBuyClick}
            >
              <ShoppingBag size={16} /> Comprar / Encomendar
            </button>
          </div>

          <div className="hero-trust-strip" aria-label="Vantagens exclusivas WPlay">
            <span className="trust-pill">
              <ShieldCheck size={14} /> Retirada hoje em Ipaussu
            </span>
            <span className="trust-pill">
              <RefreshCw size={14} /> Seu usado vale na troca
            </span>
            <span className="trust-pill">
              <Sparkles size={14} /> Condição especial no PIX
            </span>
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
              onError={(e) =>
                handleImageErrorFallback(e, getFallbackImageForCategory(slide.category))
              }
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
                    setNotice(`${activeSlide.title} (${spec}) adicionado ao pedido.`);
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
              aria-label={`Espiar ${activeSlide.title} em 3D`}
            >
              <Eye size={16} /> Espiar 3D
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
                placeholder="Buscar iPhone 16 Pro Max, Scooter, Perfume..."
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
            {visibleProducts.map((product) => {
              const isSelected = (orderQuantities[product.id] || 0) > 0;
              const priceFormatted = formatCurrencyBRL(product.price);
              const isCellular = isIphoneOrCellularProduct(product);
              const variants =
                product.variants && product.variants.length > 0
                  ? product.variants
                  : getDefaultVariantsForCategory(product.category);
              const activeVariant = isCellular
                ? chosenVariants[product.id] || activeIphoneSummary
                : chosenVariants[product.id] || variants[0];

              return (
                <article
                  key={product.id}
                  className={[
                    "product-card",
                    isSelected ? "product-card-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="product-media">
                    <img
                      src={product.image || getFallbackImageForCategory(product.category)}
                      alt={product.name}
                      loading="lazy"
                      onError={(e) =>
                        handleImageErrorFallback(
                          e,
                          getFallbackImageForCategory(product.category)
                        )
                      }
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
                    <div className="product-quick-Floating">
                      <button
                        type="button"
                        className="icon-pill icon-pill-inspect"
                        onClick={() => setInspectedProduct(product)}
                        aria-label={`Espiar ${product.name} em 3D`}
                        title="Espiar e girar em 3D (360°)"
                      >
                        <Eye size={16} />
                        <span className="pill-3d-label">Espiar 3D</span>
                      </button>
                      <button
                        type="button"
                        className={
                          isSelected ? "icon-pill icon-pill-lime" : "icon-pill"
                        }
                        onClick={() => toggleProductInOrder(product.id, false)}
                        aria-label={
                          isSelected
                            ? `Remover ${product.name} do pedido`
                            : `Adicionar ${product.name} ao pedido`
                        }
                        title={isSelected ? "No pedido" : "Incluir no pedido"}
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
                        <span className="consult-badge">Sob consulta</span>
                      )}
                    </div>

                    <p className="product-summary">
                      {isCellular
                        ? `${activeIphoneModel.name} · ${activeIphoneStorage}`
                        : `${product.category} · ${activeVariant}`}
                    </p>

                    <div className="product-hook-row">
                      <span className="hook-chip hook-chip-emerald">
                        <ShieldCheck size={11} />
                        {isCellular ? "Linha 13 ao 18 Pro Max" : "Pronta consulta · Ipaussu"}
                      </span>
                      <span className="hook-chip hook-chip-lime">
                        <Zap size={11} /> PIX ou Troca Smart
                      </span>
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
                            <Check size={14} /> No pedido ({orderQuantities[product.id]})
                          </>
                        ) : (
                          <>
                            <ShoppingBag size={14} /> Selecionar
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="card-whatsapp-btn"
                        onClick={() => void handleQuickProductConsult(product)}
                        aria-label={`Comprar ${product.name} (${activeVariant}) pelo WhatsApp`}
                      >
                        Comprar já
                        <ArrowUpRight size={15} />
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
              Finalize seu <span>pedido.</span>
            </h2>
            <p className="order-studio-sub">
              Personalize modelos, escolha retirada em Ipaussu ou entrega rápida e finalize no WhatsApp.
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
                const isCellular = isIphoneOrCellularProduct(p);
                const variants =
                  p.variants && p.variants.length > 0
                    ? p.variants
                    : getDefaultVariantsForCategory(p.category);
                const chosenVar = isCellular
                  ? chosenVariants[p.id] || activeIphoneSummary
                  : chosenVariants[p.id] || variants[0];

                return (
                  <div
                    key={p.id}
                    className={
                      active ? "order-select-card active" : "order-select-card"
                    }
                  >
                    <div className="order-select-top">
                      <img
                        src={p.image || getFallbackImageForCategory(p.category)}
                        alt={p.name}
                        className="order-select-thumb"
                        onError={(e) =>
                          handleImageErrorFallback(
                            e,
                            getFallbackImageForCategory(p.category)
                          )
                        }
                      />
                      <div className="order-select-info">
                        <strong>{p.name}</strong>
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
                      <button
                        type="button"
                        className="order-configure"
                        onClick={() => setInspectedProduct(p)}
                      >
                        {isCellular
                          ? `${activeIphoneModel.name} · ${activeIphoneStorage} · ${activeIphoneFinish.name}`
                          : chosenVar}
                        <span>
                          Configurar 3D <ArrowUpRight size={13} />
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Custom Special-Order Adder */}
            <details className="order-optional">
              <summary>
                Procurando outro modelo específico? <Plus size={15} />
              </summary>
              <form
                className="custom-order-adder"
                onSubmit={(e) => handleAddCustomOrderItem(e)}
              >
                <div className="custom-adder-head">
                  <PackagePlus size={18} />
                  <div>
                    <strong>Encomenda sob medida</strong>
                    <span>Digite qualquer produto ou capacidade desejada.</span>
                  </div>
                </div>

                <div className="custom-adder-controls">
                  <input
                    type="text"
                    maxLength={90}
                    placeholder="Ex.: iPhone 17 Pro 512GB, Apple Watch, JBL Boombox..."
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
                    <Plus size={15} /> Incluir no Pedido
                  </button>
                </div>
              </form>
            </details>

            {/* 3. Fulfillment & Payment Configurator */}
            <details className="order-optional" open>
              <summary>
                Entrega, PIX ou Troca Smart <ArrowRight size={15} />
              </summary>
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
                        <strong>Troca Smart</strong>
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
            </details>
          </div>

          {/* Right Column: Live Interactive Order Tray & WhatsApp Dispatch */}
          <aside className="order-tray-dock">
            <div className="tray-header">
              <div className="tray-brand">
                <img
                  src={activeLogoUrl}
                  alt="Logo WPlay"
                  className="tray-brand-logo"
                  onError={(e) => handleImageErrorFallback(e, officialLogoPath)}
                />
                <div>
                  <strong>Resumo do Pedido</strong>
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
                    Toque em <strong>+ Incluir</strong> nos produtos ao lado para montar seu pedido.
                  </p>
                </div>
              ) : (
                <>
                  {selectedCatalogEntries.map(({ product, quantity, variant }) => (
                    <div className="tray-item-row" key={product.id}>
                      <img
                        src={product.image || getFallbackImageForCategory(product.category)}
                        alt={product.name}
                        onError={(e) =>
                          handleImageErrorFallback(
                            e,
                            getFallbackImageForCategory(product.category)
                          )
                        }
                      />
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
            <details className="tray-message-box">
              <summary>
                Revisar mensagem do pedido <ArrowRight size={14} />
              </summary>
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
            </details>

            <div className="ticket-actions">
              <button
                type="button"
                className="button button-lime ticket-send"
                onClick={() => void handleSendOrderToWhatsApp()}
              >
                Finalizar Compra no WhatsApp <Send size={15} />
              </button>
              <button
                type="button"
                className="button button-outline"
                onClick={() => void handleCopyMessage(activeOrderMessage)}
                aria-label="Copiar texto da encomenda"
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
            Encontre a <span>WPlay.</span>
          </h2>
        </div>

        <div className="location-layout">
          <div className="location-card">
            <div className="location-card-top">
              <img
                src={activeLogoUrl}
                alt="Logo Oficial WPlay Eletrônicos"
                className="location-card-logo"
                onError={(e) => handleImageErrorFallback(e, officialLogoPath)}
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
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                void openSafeExternalLink(
                  settings.maps_url,
                  defaultStoreSettings.maps_url,
                  "Google Maps WPlay"
                );
              }}
            >
              <Navigation size={16} /> Ver rota no Google Maps
            </a>
          </div>

          <div className="location-map-shell">
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

      {/* Footer with Official WPlay Logo (5x rapid click on brand triggers discrete owner access) */}
      <footer className="footer">
        <div className="footer-brand-block">
          <Brand
            storeName={settings.store_name}
            city={settings.city}
            logoUrl={activeLogoUrl}
            onSecretTrigger={() => router.push("/admin")}
          />
        </div>

        <div className="footer-links">
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              void openSafeExternalLink(
                settings.maps_url,
                defaultStoreSettings.maps_url,
                "Google Maps WPlay"
              );
            }}
          >
            <MapPin size={14} /> Abrir no Google Maps
          </a>
          <a
            href={safeInstagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              void openSafeExternalLink(
                settings.instagram_url,
                defaultStoreSettings.instagram_url,
                "Instagram WPlay"
              );
            }}
          >
            {settings.instagram_handle} <ArrowUpRight size={14} />
          </a>
          <a
            href={primaryWhatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              void handleSendOrderToWhatsApp();
            }}
          >
            WhatsApp Oficial <ArrowUpRight size={14} />
          </a>
        </div>
      </footer>

      {/* Interactive Floating Bag / WhatsApp Dock */}
      <div className="floating-dock">
        {totalOrderCount > 0 && (
          <a href="#encomenda" className="floating-bag">
            <span className="bag-count">{totalOrderCount}</span>
            <span>Finalizar ({totalOrderCount})</span>
          </a>
        )}
        <button
          type="button"
          className="whatsapp-float"
          onClick={() => void handleSendOrderToWhatsApp()}
          aria-label="Comprar ou chamar a WPlay no WhatsApp"
        >
          <img
            src={activeLogoUrl}
            alt="Logo WPlay"
            className="whatsapp-float-logo"
            onError={(e) => handleImageErrorFallback(e, officialLogoPath)}
          />
          <span>WhatsApp</span>
          <ArrowUpRight size={15} />
        </button>
      </div>

      {/* Interactive Product Quick-Look Sheet (with 360° 3D Turntable for all products) */}
      {inspectedProduct && (
        <div
          className="quicklook-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setInspectedProduct(null);
          }}
        >
          <div
            className="quicklook-sheet quicklook-sheet-3d"
            role="dialog"
            tabIndex={-1}
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

            {isIphoneOrCellularProduct(inspectedProduct) ? (
              <>
                <div className="quicklook-media quicklook-media-3d">
                  <Iphone3DStudio
                    model={activeIphoneModel}
                    finish={activeIphoneFinish}
                    storage={activeIphoneStorage}
                  />
                </div>

                <div className="quicklook-content quicklook-content-3d">
                  <span className="product-tag">{inspectedProduct.category}</span>

                  <h3 id="quicklook-title">{activeIphoneModel.name}</h3>
                  <p className="quicklook-highlight">
                    Escolha seu modelo (13 ao 18 Pro Max), memória compatível e acabamento.
                  </p>

                  <div className="quicklook-fields">
                    <label>
                      Modelo
                      <select
                        value={activeIphoneModel.id}
                        onChange={(event) => {
                          const nextModel = getIphoneModelById(event.target.value);
                          setActiveIphoneGen(nextModel.generation);
                          applyIphoneConfiguration(nextModel);
                        }}
                      >
                        {iphoneGenerations.map((generation) => (
                          <optgroup key={generation} label={`Linha iPhone ${generation}`}>
                            {iphoneLineup
                              .filter((model) => model.generation === generation)
                              .map((model) => (
                                <option key={model.id} value={model.id}>
                                  {model.name}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <label>
                      Memória
                      <select
                        value={activeIphoneStorage}
                        onChange={(event) =>
                          applyIphoneConfiguration(
                            activeIphoneModel,
                            event.target.value,
                            activeIphoneFinish
                          )
                        }
                      >
                        {activeIphoneModel.storages.map((capacity) => (
                          <option key={capacity}>{capacity}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Acabamento
                      <select
                        value={activeIphoneFinish.id}
                        onChange={(event) => {
                          const finish = activeIphoneModel.finishes.find(
                            (item) => item.id === event.target.value
                          );
                          if (finish)
                            applyIphoneConfiguration(
                              activeIphoneModel,
                              activeIphoneStorage,
                              finish
                            );
                        }}
                      >
                        {activeIphoneModel.finishes.map((finish) => (
                          <option value={finish.id} key={finish.id}>
                            {finish.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Condição
                      <select
                        value={selectedIphoneCondition}
                        onChange={(event) =>
                          setSelectedIphoneCondition(
                            event.target.value as "Lacrado" | "Seminovo"
                          )
                        }
                      >
                        <option>Lacrado</option>
                        <option>Seminovo</option>
                      </select>
                    </label>
                  </div>

                  <div className="quicklook-trust-banner">
                    <ShieldCheck size={14} />
                    <span>
                      Retirada em Ipaussu ou entrega · Aceitamos seu iPhone usado na troca
                    </span>
                  </div>

                  <div className="quicklook-actions">
                    <button
                      type="button"
                      className="button button-lime"
                      onClick={() => void handleQuickProductConsult(inspectedProduct)}
                    >
                      Comprar pelo WhatsApp <ArrowUpRight size={16} />
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
                      Incluir no pedido
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="quicklook-media quicklook-media-3d">
                  <Product3DStudio
                    product={inspectedProduct}
                    variant={
                      chosenVariants[inspectedProduct.id] ||
                      inspectedProduct.variants?.[0] ||
                      getDefaultVariantsForCategory(inspectedProduct.category)[0]
                    }
                  />
                </div>

                <div className="quicklook-content quicklook-content-3d">
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

                  <div className="quicklook-trust-banner">
                    <ShieldCheck size={14} />
                    <span>
                      Disponível em Ipaussu · Condição especial no PIX ou parcelamento
                    </span>
                  </div>

                  <div className="quicklook-actions">
                    <button
                      type="button"
                      className="button button-lime"
                      onClick={() => void handleQuickProductConsult(inspectedProduct)}
                    >
                      Comprar pelo WhatsApp <ArrowUpRight size={16} />
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
                      Incluir no pedido
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Smart Broken-Link / Popup Fallback Modal */}
      {safeLinkRecovery && (
        <div
          className="quicklook-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Acesso direto garantido"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSafeLinkRecovery(null);
          }}
        >
          <div className="safelink-modal">
            <div className="safelink-head">
              <span className="safelink-badge">
                <ShieldCheck size={14} /> Link Verificado WPlay
              </span>
              <button
                type="button"
                className="quicklook-close"
                onClick={() => setSafeLinkRecovery(null)}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
            <h3>Continue para {safeLinkRecovery.label}</h3>
            <p>
              {safeLinkRecovery.repaired
                ? "Detectamos um link desatualizado e ativamos automaticamente o endereço oficial da WPlay Eletrônicos."
                : "Seu navegador bloqueou a abertura automática da nova guia. Use o botão direto abaixo:"}
            </p>
            <div className="safelink-actions">
              <a
                href={safeLinkRecovery.url}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-lime"
                onClick={() => setSafeLinkRecovery(null)}
              >
                Abrir {safeLinkRecovery.label} <ExternalLink size={15} />
              </a>
              {safeLinkRecovery.copiedMessage && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() =>
                    void handleCopyMessage(safeLinkRecovery.copiedMessage || "")
                  }
                >
                  {copiedFeedback ? <Check size={15} /> : <Copy size={15} />}
                  {copiedFeedback ? "Mensagem Copiada!" : "Copiar Pedido"}
                </button>
              )}
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
