import type { HeroSlideConfig, Product, StoreSettings, StudioPhoto } from "@/lib/catalog";

export const productColumns =
  "id,name,category,description,badge,price,image,image_fit,image_position,image_scale,published,featured,variants,price_pix,installments,stock_quantity";

export const settingsColumns =
  "id,store_name,logo_url,hero_headline,whatsapp_url,whatsapp_phone,instagram_url,instagram_handle,city,address_line,postal_code,maps_url,hours_lines,custom_categories,custom_gallery,hero_slides,attendance_note";

export const publicSettingsColumns =
  "id,store_name,logo_url,hero_headline,whatsapp_url,whatsapp_phone,instagram_url,instagram_handle,city,address_line,postal_code,maps_url,hours_lines,custom_categories,hero_slides,attendance_note";

export function productFromDatabase(row: Record<string, unknown>): Partial<Product> {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    description: row.description as string,
    badge: row.badge as string,
    price: row.price as number | null,
    pricePix: row.price_pix as number | null | undefined,
    installments: row.installments as string | null | undefined,
    stockQuantity: row.stock_quantity as number | null | undefined,
    image: row.image as string,
    imageFit: row.image_fit === "contain" ? "contain" : "cover",
    imagePosition: row.image_position as string | undefined,
    imageScale: row.image_scale as number | undefined,
    published: row.published as boolean,
    featured: row.featured as boolean,
    variants: row.variants as string[] | undefined,
  };
}

export function productToDatabase(product: Product) {
  const row: Record<string, unknown> = {
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    badge: product.badge,
    price: product.price,
    image: product.image,
    image_fit: product.imageFit || "cover",
    image_position: product.imagePosition || "50% 50%",
    image_scale: product.imageScale ?? 1,
    published: product.published,
    featured: product.featured,
    variants: product.variants || [],
    updated_at: new Date().toISOString(),
  };

  if (product.pricePix !== undefined) row.price_pix = product.pricePix;
  if (product.installments !== undefined) row.installments = product.installments;
  if (product.stockQuantity !== undefined) row.stock_quantity = product.stockQuantity;

  return row;
}

export function settingsFromDatabase(row: Record<string, unknown>): Partial<StoreSettings> {
  return {
    id: true,
    store_name: row.store_name as string,
    logo_url: row.logo_url as string,
    hero_headline: row.hero_headline as string,
    whatsapp_url: row.whatsapp_url as string,
    whatsapp_phone: row.whatsapp_phone as string | null,
    instagram_url: row.instagram_url as string,
    instagram_handle: row.instagram_handle as string,
    city: row.city as string,
    address_line: row.address_line as string,
    postal_code: row.postal_code as string,
    maps_url: row.maps_url as string,
    hours_lines: row.hours_lines as string[],
    custom_categories: row.custom_categories as string[],
    custom_gallery: row.custom_gallery as StudioPhoto[],
    hero_slides: row.hero_slides as HeroSlideConfig[],
    attendance_note: row.attendance_note as string,
  };
}

export function settingsToDatabase(settings: StoreSettings) {
  return {
    id: true,
    store_name: settings.store_name,
    logo_url: settings.logo_url,
    hero_headline: settings.hero_headline,
    whatsapp_url: settings.whatsapp_url,
    whatsapp_phone: settings.whatsapp_phone,
    instagram_url: settings.instagram_url,
    instagram_handle: settings.instagram_handle,
    city: settings.city,
    address_line: settings.address_line,
    postal_code: settings.postal_code,
    maps_url: settings.maps_url,
    hours_lines: settings.hours_lines,
    custom_categories: settings.custom_categories,
    custom_gallery: settings.custom_gallery,
    hero_slides: settings.hero_slides,
    attendance_note: settings.attendance_note,
    updated_at: new Date().toISOString(),
  };
}
