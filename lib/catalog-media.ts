import type { SupabaseClient } from "@supabase/supabase-js";

export const catalogMediaBucket = "catalog-media";
export const maximumImageBytes = 250 * 1024;
const maximumOriginalBytes = 10 * 1024 * 1024;
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];

function encodeImage(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível preparar a imagem. Tente outro arquivo."));
    }, "image/webp", quality);
  });
}

export async function prepareCatalogImage(file: File, maxDimension = 1280): Promise<Blob> {
  if (!acceptedImageTypes.includes(file.type)) {
    throw new Error("Escolha uma imagem JPG, PNG ou WebP.");
  }
  if (file.size > maximumOriginalBytes) {
    throw new Error("A imagem original deve ter no máximo 10 MB.");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const photo = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
      image.src = objectUrl;
    });
    if (!photo.naturalWidth || !photo.naturalHeight) throw new Error("A imagem está vazia.");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Seu navegador não conseguiu preparar a imagem.");
    const maximumSide = Math.min(1440, Math.max(512, maxDimension));
    const initialRatio = Math.min(1, maximumSide / Math.max(photo.naturalWidth, photo.naturalHeight));
    for (const scale of [1, 0.8, 0.64, 0.5]) {
      canvas.width = Math.max(1, Math.round(photo.naturalWidth * initialRatio * scale));
      canvas.height = Math.max(1, Math.round(photo.naturalHeight * initialRatio * scale));
      context.drawImage(photo, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.7, 0.58]) {
        const blob = await encodeImage(canvas, quality);
        if (blob.size <= maximumImageBytes && acceptedImageTypes.includes(blob.type)) return blob;
      }
    }
    throw new Error("Não foi possível reduzir a imagem para 250 KB. Escolha uma foto menor.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadCatalogImage(client: SupabaseClient, file: File, maxDimension = 1280): Promise<string> {
  const image = await prepareCatalogImage(file, maxDimension);
  const extension = image.type === "image/webp" ? "webp" : image.type === "image/png" ? "png" : "jpg";
  const path = `image-${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(catalogMediaBucket).upload(path, image, {
    contentType: image.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Não foi possível enviar a imagem: ${error.message}`);
  return `/api/media/${path}`;
}
