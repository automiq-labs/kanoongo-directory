import { createClient } from "./supabase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 1000;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateImage(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Only JPG, PNG, and WebP images are accepted";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "photo_too_large";
  }
  return null;
}

/** Downscale image client-side to max 1000px, return as Blob */
export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Compression failed"));
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

/** Upload image to Supabase Storage, return public URL */
export async function uploadPhoto(
  file: File,
  familyId: string,
  table: string,
  recordId: string
): Promise<string> {
  const compressed = await compressImage(file);
  const ext = "jpg"; // we always compress to jpeg
  const path = `${familyId}/${table}_${recordId}_${Date.now()}.${ext}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("member-photos")
    .upload(path, compressed, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("member-photos").getPublicUrl(path);

  return publicUrl;
}

/** Create a local preview URL from a File */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}
