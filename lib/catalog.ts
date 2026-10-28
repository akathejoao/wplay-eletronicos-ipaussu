import { isPhoneModelSpec, type IphoneModelSpec } from "./iphone-models";
import type { SyntheticEvent } from "react";

export type ProductCategory = string;

export const officialLogoPath = "/images/wplay-logo-official.png";
export const productsStorageKey = "wplay-products-v6";
export const settingsStorageKey = "wplay-settings-v6";
export const adminSessionStorageKey = "wplay-admin-auth-v2";
export const adminLockoutStorageKey = "wplay-admin-lockout-v1";
export const adminAuditStorageKey = "wplay-admin-audit-v1";
export const leadsStorageKey = "wplay-customer-leads-v1";
export const pushSubsStorageKey = "wplay-push-subscribers-v1";

// SHA-256 hash of default PIN ("wplay2026") with salt "wplay-ipaussu-v2:"
export const defaultAdminPinHash =
  "ef72b4d3f5a9881d1878e1b6c5015b6d8fb4e812423a533790f02561d7eb6e61";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  badge: string;
  price: number | null;
  pricePix?: number | null;
  installments?: string | null; // e.g. "12x de R$ 389,00"
  stockQuantity?: number | null; // null = pronta entrega sem contagem, > 0 quantidade, 0 = esgotado
  image: string;
  imageFit?: "cover" | "contain";
  imagePosition?: string;
  imageScale?: number;
  published: boolean;
  featured: boolean;
  variants?: string[];
};

export type CustomerLead = {
  id: string;
  createdAt: string;
  name: string;
  whatsapp: string;
  productName: string;
  productId?: string;
  variantChosen?: string;
  notes?: string;
  status: "novo" | "em_negociacao" | "fechado" | "aguardando_reposicao";
  estimatedValue?: number | null;
  lastFollowUpAt?: string;
};

export type PushNotificationCampaign = {
  id: string;
  createdAt: string;
  title: string;
  body: string;
  targetUrl: string;
  sentCount: number;
};

export type StudioPhoto = {
  id: string;
  label: string;
  src: string;
};

export type HeroSlideConfig = {
  id: string;
  title: string;
  tag: string;
  category: ProductCategory;
  image: string;
  specs: string[];
};

export type StoreSettings = {
  id: true;
  store_name: string;
  logo_url: string;
  hero_headline: string;
  whatsapp_url: string;
  whatsapp_phone: string | null;
  instagram_url: string;
  instagram_handle: string;
  city: string;
  address_line: string;
  postal_code: string;
  maps_url: string;
  hours_lines: string[];
  custom_categories: string[];
  custom_gallery: StudioPhoto[];
  hero_slides: HeroSlideConfig[];
  attendance_note: string;
  custom_phone_models?: IphoneModelSpec[];
  admin_user: string;
  admin_pin: string;
  admin_pin_hash?: string;
};

export type AdminSessionPayload = {
  user: string;
  issuedAt: number;
  expiresAt: number;
  token: string;
};

export type AdminLockoutState = {
  attempts: number;
  lockUntil: number;
};

export type AdminAuditEntry = {
  id: string;
  timestamp: string;
  event: "login_success" | "login_failed" | "lockout_triggered" | "logout" | "credentials_updated" | "links_repaired";
  user: string;
  detail: string;
};

export const defaultProductCategories: string[] = [
  "Celulares",
  "Mobilidade",
  "Perfumes",
  "Áudio",
  "Acessórios",
];

export const studioGallery: StudioPhoto[] = [
  { id: "iphone", label: "iPhones & Smartphones", src: "/images/wplay-iphone.jpg" },
  { id: "scooter", label: "Scooter Elétrica", src: "/images/wplay-scooter.jpg" },
  { id: "perfume", label: "Perfumes Importados", src: "/images/wplay-perfume.jpg" },
  { id: "speaker", label: "Caixas de Som", src: "/images/wplay-speaker.jpg" },
  { id: "headphones", label: "Fones & Cabos", src: "/images/wplay-headphones.jpg" },
  { id: "smartwatch", label: "Smartwatches", src: "/images/wplay-smartwatch.jpg" },
  { id: "hero", label: "Composição Estúdio", src: "/images/wplay-hero.jpg" },
  { id: "emerald-studio", label: "Showroom Emerald WPlay", src: "/images/wplay-emerald-backdrop.jpg" },
];

export const defaultHeroSlides: HeroSlideConfig[] = [
  {
    id: "iphone-pro",
    title: "iPhones 13 ao 18 Pro Max",
    tag: "Celulares",
    category: "Celulares",
    image: "/images/wplay-iphone.jpg",
    specs: ["Linha 13 ao 18 Pro Max", "128 GB a 2 TB", "Giro 3D Interativo"],
  },
  {
    id: "scooter-eletrica",
    title: "Scooters Elétricas",
    tag: "Mobilidade",
    category: "Mobilidade",
    image: "/images/wplay-scooter.jpg",
    specs: ["Pneu Fat Urbano", "Painel Digital", "Zero Emissão"],
  },
  {
    id: "perfumes-importados",
    title: "Perfumes Importados",
    tag: "Perfumaria",
    category: "Perfumes",
    image: "/images/wplay-perfume.jpg",
    specs: ["Árabes & Designer", "Alta Fixação", "Pronta Consulta"],
  },
  {
    id: "caixas-som-audio",
    title: "Áudio & Party Box",
    tag: "Som",
    category: "Áudio",
    image: "/images/wplay-speaker.jpg",
    specs: ["Grave de Presença", "Bluetooth Portátil", "Bateria Longa"],
  },
  {
    id: "smartwatch-earbuds",
    title: "Wearables & Acessórios",
    tag: "Setup",
    category: "Acessórios",
    image: "/images/wplay-smartwatch.jpg",
    specs: ["Smartwatches Ultra", "Fones ANC", "Carga Rápida USB-C"],
  },
];

export const defaultVariantsByCategory: Record<string, string[]> = {
  Celulares: [
    "iPhone 13 · 128 GB",
    "iPhone 14 Pro Max · 256 GB",
    "iPhone 15 Pro Max · 256 GB",
    "iPhone 16 Pro Max · 256 GB",
    "iPhone 17 Pro Max · 512 GB",
    "iPhone 18 Pro Max · 1 TB",
  ],
  Mobilidade: ["60V 2000W", "60V 3000W Fat", "Edição Street"],
  Perfumes: ["100ml Edição Especial", "Árabe Oudh & Âmbar", "Fragrância Designer"],
  Áudio: ["Party Box Portátil", "Grave Pro 160W", "Caixa de Mesa Estéreo"],
  Acessórios: ["Original / Turbo", "Blindagem MagSafe", "Carga Ultrarrápida USB-C"],
};

export function getDefaultVariantsForCategory(category: string): string[] {
  return (
    defaultVariantsByCategory[category] || [
      "Pronta entrega",
      "Sob encomenda",
      "Garantia WPlay",
    ]
  );
}

export const fallbackCategoryImages: Record<string, string> = {
  Celulares: "/images/wplay-iphone.jpg",
  Mobilidade: "/images/wplay-scooter.jpg",
  Perfumes: "/images/wplay-perfume.jpg",
  Áudio: "/images/wplay-speaker.jpg",
  Acessórios: "/images/wplay-smartwatch.jpg",
};

export function getFallbackImageForCategory(category: string): string {
  return fallbackCategoryImages[category] || "/images/wplay-hero.jpg";
}

export function handleImageErrorFallback(
  event: SyntheticEvent<HTMLImageElement, Event>,
  category?: string
): void {
  const target = event.currentTarget;
  const fallback = category ? getFallbackImageForCategory(category) : "/images/wplay-hero.jpg";
  if (!target.dataset.hasFallbackTriggered) {
    target.dataset.hasFallbackTriggered = "true";
    target.src = fallback;
  }
}

export function isValidImageSrc(src: string | null | undefined): boolean {
  if (!src || typeof src !== "string") return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (/^\/api\/media\/image-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(webp|png|jpg)$/.test(trimmed)) return true;
  if (trimmed.startsWith("/images/") || trimmed.startsWith("data:image/")) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function sanitizeExternalUrl(
  rawUrl: string | null | undefined,
  fallbackUrl: string
): { url: string; repaired: boolean } {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { url: fallbackUrl, repaired: true };
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { url: fallbackUrl, repaired: true };
  }
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { url: fallbackUrl, repaired: true };
    }
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return { url: fallbackUrl, repaired: true };
    }
    return { url: parsed.toString(), repaired: normalized !== trimmed };
  } catch {
    return { url: fallbackUrl, repaired: true };
  }
}

export const initialProducts: Product[] = [
  {
    id: "iphone-pro",
    name: "iPhones & Smartphones",
    category: "Celulares",
    description:
      "Linha Apple do iPhone 13 ao 18 Pro Max. Selecione o modelo, memória, cor e condição desejada.",
    badge: "Estoque em Ipaussu",
    price: 4899,
    pricePix: 4599,
    installments: "12x de R$ 449,00 sem juros",
    stockQuantity: 4,
    image: "/images/wplay-iphone.jpg",
    imageFit: "cover",
    imagePosition: "50% 50%",
    imageScale: 1,
    published: true,
    featured: true,
    variants: [
      "iPhone 13 · 128 GB",
      "iPhone 14 Pro Max · 256 GB",
      "iPhone 15 Pro Max · 256 GB",
      "iPhone 16 Pro Max · 256 GB",
      "iPhone 17 Pro Max · 512 GB",
      "iPhone 18 Pro Max · 1 TB",
    ],
  },
  {
    id: "scooter-eletrica",
    name: "Scooters Elétricas WPlay",
    category: "Mobilidade",
    description: "Mobilidade elétrica urbana com economia e estilo. Pneu fat, painel digital e freios a disco.",
    badge: "Últimas 2 Unidades",
    price: 11990,
    pricePix: 10990,
    installments: "18x de R$ 749,00",
    stockQuantity: 2,
    image: "/images/wplay-scooter.jpg",
    imageFit: "cover",
    imagePosition: "50% 50%",
    imageScale: 1,
    published: true,
    featured: true,
    variants: ["60V 2000W Fat Urbana", "60V 3000W Street Power", "Edição Black Matte"],
  },
  {
    id: "perfumes-importados",
    name: "Perfumes Importados & Árabes",
    category: "Perfumes",
    description: "Fragrâncias originais de alta projeção e fixação duradoura. Originais com selo de procedência.",
    badge: "Pronta Entrega",
    price: 389,
    pricePix: 349,
    installments: "6x de R$ 64,80",
    stockQuantity: 8,
    image: "/images/wplay-perfume.jpg",
    imageFit: "cover",
    imagePosition: "50% 50%",
    imageScale: 1,
    published: true,
    featured: true,
    variants: ["Árabe Oudh Especial 100ml", "Designer Club de Nuit", "Oriental Vanilla Intenso"],
  },
  {
    id: "caixas-som",
    name: "Caixas de Som & Party Box",
    category: "Áudio",
    description: "Graves de peso, iluminação dinâmica e resistência a respingos d'água.",
    badge: "Pronta Entrega",
    price: 1290,
    pricePix: 1150,
    installments: "10x de R$ 129,00",
    stockQuantity: 5,
    image: "/images/wplay-speaker.jpg",
    imageFit: "cover",
    imagePosition: "50% 50%",
    imageScale: 1,
    published: true,
    featured: false,
    variants: ["Party Box 160W LED", "Boombox Portátil Pro", "Soundbar Bluetooth"],
  },
  {
    id: "fones-acessorios",
    name: "Fones & Carregadores",
    category: "Acessórios",
    description: "Áudio sem fio de alta fidelidade, cancelamento ativo de ruído e carregadores ultra turbo homologados.",
    badge: "Originais & Turbo",
    price: 189,
    pricePix: 159,
    installments: "3x de R$ 63,00",
    stockQuantity: 12,
    image: "/images/wplay-headphones.jpg",
    imageFit: "cover",
    imagePosition: "50% 50%",
    imageScale: 1,
    published: true,
    featured: false,
    variants: ["Fonte Turbo 35W Duo USB-C", "Cabo Trançado Reforçado 2m", "Headphone Over-Ear ANC"],
  },
  {
    id: "smartwatch-earbuds",
    name: "Smartwatches & In-Ear",
    category: "Acessórios",
    description: "Relógios inteligentes ultra com monitoramento de saúde e fones compactos para treino e rotina.",
    badge: "Novidades",
    price: 349,
    pricePix: 299,
    installments: "6x de R$ 58,16",
    stockQuantity: 6,
    image: "/images/wplay-smartwatch.jpg",
    imageFit: "cover",
    imagePosition: "50% 50%",
    imageScale: 1,
    published: true,
    featured: false,
    variants: ["Smartwatch Ultra 49mm Titânio", "Earbuds TWS Bluetooth 5.4", "Pulseira Alpine Loop"],
  },
];

export const defaultStoreSettings: StoreSettings = {
  id: true,
  store_name: "WPlay Eletrônicos",
  logo_url: officialLogoPath,
  hero_headline: "Toque, escolha e chame no WhatsApp.",
  whatsapp_url: "https://wa.me/5514996747344",
  whatsapp_phone: "5514996747344",
  instagram_url: "https://www.instagram.com/wplayeletronicosipaussu/",
  instagram_handle: "@wplayeletronicosipaussu",
  city: "Ipaussu — SP",
  address_line: "R. Washington Luís, 887",
  postal_code: "18950-025",
  maps_url: "https://maps.app.goo.gl/nrtpoXdpveMRe4mg9",
  hours_lines: [
    "Seg a Sex: Atendimento loja & WhatsApp",
    "Sábado: Atendimento especial",
    "Domingos: Consulte pelo WhatsApp",
  ],
  custom_categories: [...defaultProductCategories],
  custom_gallery: [...studioGallery],
  hero_slides: [...defaultHeroSlides],
  attendance_note:
    "Confirme preço, disponibilidade, formas de pagamento e entrega direto no WhatsApp.",
  custom_phone_models: [],
  admin_user: "admin",
  admin_pin: "",
  admin_pin_hash: defaultAdminPinHash,
};

export const whatsappLink = defaultStoreSettings.whatsapp_url;

export function normalizeProduct(raw: Partial<Product>, index: number): Product {
  const categoryName =
    typeof raw.category === "string" && raw.category.trim().length > 0
      ? raw.category.trim()
      : "Celulares";
  const fallbackImg =
    getFallbackImageForCategory(categoryName) ||
    studioGallery[index % studioGallery.length]?.src ||
    "/images/wplay-iphone.jpg";
  const rawImage = typeof raw.image === "string" ? raw.image.trim() : "";
  const migratedImage =
    !isValidImageSrc(rawImage) || rawImage.includes("images.unsplash.com")
      ? fallbackImg
      : rawImage;
  const fallbackVariants = getDefaultVariantsForCategory(categoryName);

  const parsedPrice =
    raw.price !== null && raw.price !== undefined && Number.isFinite(Number(raw.price)) && Number(raw.price) >= 0
      ? Number(raw.price)
      : null;

  const parsedPricePix =
    raw.pricePix !== null && raw.pricePix !== undefined && Number.isFinite(Number(raw.pricePix)) && Number(raw.pricePix) >= 0
      ? Number(raw.pricePix)
      : null;

  const stockParsed =
    raw.stockQuantity !== null && raw.stockQuantity !== undefined && Number.isFinite(Number(raw.stockQuantity))
      ? Math.max(0, Math.floor(Number(raw.stockQuantity)))
      : null;

  return {
    id: raw.id || `item-${index}`,
    name: raw.name || "Produto WPlay",
    category: categoryName,
    description: raw.description || "Escolha sua opção e chame no WhatsApp.",
    badge: typeof raw.badge === "string" && raw.badge.trim() ? raw.badge : "Sob consulta",
    price: parsedPrice,
    pricePix: parsedPricePix,
    installments: typeof raw.installments === "string" && raw.installments.trim() ? raw.installments.trim() : null,
    stockQuantity: stockParsed,
    image: migratedImage,
    imageFit: raw.imageFit === "contain" ? "contain" : "cover",
    imagePosition:
      typeof raw.imagePosition === "string" && raw.imagePosition.trim()
        ? raw.imagePosition.trim()
        : "50% 50%",
    imageScale:
      typeof raw.imageScale === "number" && !Number.isNaN(raw.imageScale)
        ? Math.min(1.6, Math.max(0.75, raw.imageScale))
        : 1,
    published: raw.published ?? true,
    featured: raw.featured ?? index < 3,
    variants:
      Array.isArray(raw.variants) && raw.variants.length > 0
        ? raw.variants
        : fallbackVariants,
  };
}

export function normalizeSettings(raw?: Partial<StoreSettings> | null): StoreSettings {
  if (!raw) return defaultStoreSettings;
  const customCats =
    Array.isArray(raw.custom_categories) && raw.custom_categories.length > 0
      ? raw.custom_categories.map((c) => String(c).trim()).filter(Boolean)
      : defaultProductCategories;
  const hours =
    Array.isArray(raw.hours_lines) && raw.hours_lines.length > 0
      ? raw.hours_lines.map((h) => String(h).trim()).filter(Boolean)
      : defaultStoreSettings.hours_lines;
  const gallery =
    Array.isArray(raw.custom_gallery) && raw.custom_gallery.length > 0
      ? raw.custom_gallery
      : defaultStoreSettings.custom_gallery;
  const heroSlides =
    Array.isArray(raw.hero_slides) && raw.hero_slides.length > 0
      ? raw.hero_slides.map((slide, idx) => ({
          ...slide,
          image: isValidImageSrc(slide.image)
            ? slide.image
            : defaultHeroSlides[idx % defaultHeroSlides.length]?.image || "/images/wplay-iphone.jpg",
        }))
      : defaultStoreSettings.hero_slides;

  const resolvedLogo =
    !isValidImageSrc(raw.logo_url) || raw.logo_url === "/images/wplay-logo.png"
      ? officialLogoPath
      : raw.logo_url!;

  const savedWhatsAppUrl = raw.whatsapp_url?.trim();
  const rawWhatsappCandidate =
    !savedWhatsAppUrl || savedWhatsAppUrl === "https://wa.me/message/AYTWXK3N666EC1"
      ? defaultStoreSettings.whatsapp_url
      : savedWhatsAppUrl;

  const sanitizedWhatsApp = sanitizeExternalUrl(
    rawWhatsappCandidate,
    defaultStoreSettings.whatsapp_url
  ).url;
  const sanitizedInstagram = sanitizeExternalUrl(
    raw.instagram_url,
    defaultStoreSettings.instagram_url
  ).url;
  const sanitizedMaps = sanitizeExternalUrl(
    raw.maps_url,
    defaultStoreSettings.maps_url
  ).url;

  return {
    id: true,
    store_name: raw.store_name?.trim() || defaultStoreSettings.store_name,
    logo_url: resolvedLogo,
    hero_headline:
      raw.hero_headline?.trim() || defaultStoreSettings.hero_headline,
    whatsapp_url: sanitizedWhatsApp,
    whatsapp_phone:
      raw.whatsapp_phone !== undefined
        ? raw.whatsapp_phone
        : defaultStoreSettings.whatsapp_phone,
    instagram_url: sanitizedInstagram,
    instagram_handle:
      raw.instagram_handle?.trim() || defaultStoreSettings.instagram_handle,
    city: raw.city?.trim() || defaultStoreSettings.city,
    address_line:
      raw.address_line?.trim() || defaultStoreSettings.address_line,
    postal_code: raw.postal_code?.trim() || defaultStoreSettings.postal_code,
    maps_url: sanitizedMaps,
    hours_lines: hours,
    custom_categories: customCats,
    custom_gallery: gallery,
    hero_slides: heroSlides,
    attendance_note:
      raw.attendance_note?.trim() || defaultStoreSettings.attendance_note,
    custom_phone_models: Array.isArray(raw.custom_phone_models) ? raw.custom_phone_models.filter(isPhoneModelSpec) : [],
    admin_user: raw.admin_user?.trim() || defaultStoreSettings.admin_user,
    admin_pin: raw.admin_pin?.trim() || defaultStoreSettings.admin_pin,
    admin_pin_hash:
      raw.admin_pin_hash?.trim() || defaultStoreSettings.admin_pin_hash,
  };
}

export async function hashAdminSecret(secret: string): Promise<string> {
  const normalized = `wplay-ipaussu-v2:${secret.trim()}`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(normalized));
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export async function verifyAdminCredentials(
  inputUser: string,
  inputPin: string,
  settings: StoreSettings
): Promise<boolean> {
  const cleanUser = inputUser.trim().toLocaleLowerCase("pt-BR");
  const expectedUser = (settings.admin_user || "admin").trim().toLocaleLowerCase("pt-BR");
  const userMatches =
    cleanUser === expectedUser ||
    cleanUser === "wplay" ||
    cleanUser === "admin@wplay.com";
  if (!userMatches) return false;

  const trimmedPin = inputPin.trim();
  if (!trimmedPin) return false;

  if (settings.admin_pin && settings.admin_pin.length > 0) {
    if (trimmedPin === settings.admin_pin) return true;
  }

  const inputHash = await hashAdminSecret(trimmedPin);
  const expectedHash = settings.admin_pin_hash || defaultAdminPinHash;
  if (inputHash === expectedHash) return true;

  if (expectedHash === defaultAdminPinHash && trimmedPin === "wplay2026") {
    return true;
  }
  return false;
}

export function compressImageFile(file: File, maxDim = 1080): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato inválido"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function buildGoogleMapsEmbedUrl(settings: StoreSettings): string {
  const query = `${settings.address_line}, ${settings.city.replace("—", "-")}, ${settings.postal_code}, Brasil`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
}

export function normalizePhoneDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith("55")) {
    return `55${digits}`;
  }
  return digits;
}

export function buildWhatsAppHref(
  settings: StoreSettings,
  message?: string
): { href: string; usesDirectText: boolean } {
  const digits = normalizePhoneDigits(settings.whatsapp_phone);
  if (digits.length >= 12 && digits.length <= 15) {
    const text = message?.trim();
    return {
      href: `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`,
      usesDirectText: Boolean(text),
    };
  }
  const safeFallback = sanitizeExternalUrl(
    settings.whatsapp_url,
    defaultStoreSettings.whatsapp_url
  ).url;
  return {
    href: safeFallback,
    usesDirectText: false,
  };
}

export function formatCurrencyBRL(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}
