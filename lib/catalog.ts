export type ProductCategory = string;

export const officialLogoPath = "/images/wplay-logo-official.png";
export const productsStorageKey = "wplay-products-v5";
export const settingsStorageKey = "wplay-settings-v5";
export const adminSessionStorageKey = "wplay-admin-auth-v1";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  badge: string;
  price: number | null;
  image: string;
  imageFit?: "cover" | "contain";
  imagePosition?: string;
  imageScale?: number;
  published: boolean;
  featured: boolean;
  variants?: string[];
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
  admin_user: string;
  admin_pin: string;
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
    title: "iPhones & Titânio",
    tag: "Celulares",
    category: "Celulares",
    image: "/images/wplay-iphone.jpg",
    specs: ["128 GB · 256 GB", "Lacrados & Seminovos", "Cotação no WhatsApp"],
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
  Celulares: ["128 GB", "256 GB", "Titânio / Preto", "Lacrado ou Seminovo"],
  Mobilidade: ["Urbana", "Pneu Fat", "Duplo Assento", "Consultar Cores"],
  Perfumes: ["Masculino", "Feminino", "Árabe / Importado", "100 ml"],
  Áudio: ["Portátil", "Grave Turbo", "À prova d'água", "Party Box"],
  Acessórios: ["USB-C Rápido", "MagSafe", "Fone Bluetooth", "Smartwatch"],
};

export function getDefaultVariantsForCategory(cat: string): string[] {
  return defaultVariantsByCategory[cat] || ["Pronta entrega", "Sob encomenda", "Consultar cores"];
}

export const initialProducts: Product[] = [
  {
    id: "iphone-pro",
    name: "iPhones & Smartphones",
    category: "Celulares",
    description: "Escolha capacidade ou acabamento e chame no WhatsApp.",
    badge: "Lacrado · Seminovo",
    price: null,
    image: "/images/wplay-iphone.jpg",
    imageFit: "cover",
    imagePosition: "50% 50%",
    imageScale: 1,
    published: true,
    featured: true,
    variants: ["128 GB", "256 GB", "Titânio Natural", "Preto"],
  },
  {
    id: "scooter-eletrica",
    name: "Scooters Elétricas",
    category: "Mobilidade",
    description: "Mobilidade elétrica urbana. Selecione o estilo para cotar.",
    badge: "Mobilidade",
    price: null,
    image: "/images/wplay-scooter.jpg",
    imageFit: "cover",
    imagePosition: "50% 50%",
    imageScale: 1,
    published: true,
    featured: true,
    variants: ["Pneu Fat", "Urbana Compacta", "Preto Fosco", "Consultar Cores"],
  },
  {
    id: "perfumes-importados",
    name: "Perfumes Importados",
    category: "Perfumes",
    description: "Fragrâncias importadas e árabes sob consulta.",
    badge: "Importados",
    price: null,
    image: "/images/wplay-perfume.jpg",
    imageFit: "cover",
    imagePosition: "50% 50%",
    imageScale: 1,
    published: true,
    featured: true,
    variants: ["Árabe", "Amadeirado", "Cítrico / Fresco", "100 ml"],
  },
  {
    id: "caixas-som-audio",
    name: "Caixas Bluetooth",
    category: "Áudio",
    description: "Som portátil com grave de presença.",
    badge: "Grave Forte",
    price: null,
    image: "/images/wplay-speaker.jpg",
    imageFit: "cover",
    imagePosition: "50% 50%",
    imageScale: 1,
    published: true,
    featured: false,
    variants: ["Portátil", "Party Speaker", "À prova d'água"],
  },
  {
    id: "fones-acessorios",
    name: "Fones & Carregadores",
    category: "Acessórios",
    description: "Áudio sem fio, cabos trançados e carga rápida.",
    badge: "Originais & Turbo",
    price: null,
    image: "/images/wplay-headphones.jpg",
    imageFit: "cover",
    imagePosition: "50% 50%",
    imageScale: 1,
    published: true,
    featured: false,
    variants: ["Over-Ear ANC", "Fonte 20W+ USB-C", "Base MagSafe"],
  },
  {
    id: "smartwatch-earbuds",
    name: "Smartwatches & In-Ear",
    category: "Acessórios",
    description: "Relógios inteligentes e fones compactos para treino e rotina.",
    badge: "Novidades",
    price: null,
    image: "/images/wplay-smartwatch.jpg",
    imageFit: "cover",
    imagePosition: "50% 50%",
    imageScale: 1,
    published: true,
    featured: false,
    variants: ["Caixa 45mm", "Caixa 49mm Ultra", "Earbuds Bluetooth"],
  },
];

export const defaultStoreSettings: StoreSettings = {
  id: true,
  store_name: "WPlay Eletrônicos",
  logo_url: officialLogoPath,
  hero_headline: "Toque, escolha e chame no WhatsApp.",
  whatsapp_url: "https://wa.me/message/AYTWXK3N666EC1",
  whatsapp_phone: null,
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
  admin_user: "admin",
  admin_pin: "wplay2026",
};

export const whatsappLink = defaultStoreSettings.whatsapp_url;

export function normalizeProduct(raw: Partial<Product>, index: number): Product {
  const categoryName =
    typeof raw.category === "string" && raw.category.trim().length > 0
      ? raw.category.trim()
      : "Celulares";
  const fallbackImg =
    studioGallery[index % studioGallery.length]?.src || "/images/wplay-iphone.jpg";
  const rawImage = typeof raw.image === "string" ? raw.image.trim() : "";
  const migratedImage =
    !rawImage || rawImage.includes("images.unsplash.com") ? fallbackImg : rawImage;
  const fallbackVariants = getDefaultVariantsForCategory(categoryName);

  return {
    id: raw.id || `item-${index}`,
    name: raw.name || "Produto WPlay",
    category: categoryName,
    description: raw.description || "Escolha sua opção e chame no WhatsApp.",
    badge: typeof raw.badge === "string" ? raw.badge : "Sob consulta",
    price:
      raw.price !== null && raw.price !== undefined && !Number.isNaN(Number(raw.price))
        ? Number(raw.price)
        : null,
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
      ? raw.hero_slides
      : defaultStoreSettings.hero_slides;

  const resolvedLogo =
    !raw.logo_url || raw.logo_url === "/images/wplay-logo.png"
      ? officialLogoPath
      : raw.logo_url;

  return {
    ...defaultStoreSettings,
    ...raw,
    id: true,
    logo_url: resolvedLogo,
    custom_categories: Array.from(new Set(customCats)),
    hours_lines: hours,
    custom_gallery: gallery,
    hero_slides: heroSlides,
    admin_user: raw.admin_user?.trim() || defaultStoreSettings.admin_user,
    admin_pin: raw.admin_pin?.trim() || defaultStoreSettings.admin_pin,
  };
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
  if (digits.length >= 12 && message && message.trim().length > 0) {
    return {
      href: `https://wa.me/${digits}?text=${encodeURIComponent(message.trim())}`,
      usesDirectText: true,
    };
  }
  return {
    href: settings.whatsapp_url || defaultStoreSettings.whatsapp_url,
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
