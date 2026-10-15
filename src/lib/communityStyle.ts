import { supabase } from "./supabase";

/**
 * Paletas vibrantes e elegantes inspiradas no design do Telegram
 */
const TELEGRAM_PALETTES = [
  {
    gradient: "from-sky-500 to-blue-600",
    solidBg: "#2AABEE",
    ringColor: "ring-sky-400",
    coverGradient: "from-slate-900 via-sky-950 to-slate-900",
  },
  {
    gradient: "from-emerald-500 to-teal-600",
    solidBg: "#27AE60",
    ringColor: "ring-emerald-400",
    coverGradient: "from-slate-900 via-emerald-950 to-slate-900",
  },
  {
    gradient: "from-purple-500 to-indigo-600",
    solidBg: "#8E44AD",
    ringColor: "ring-purple-400",
    coverGradient: "from-slate-900 via-purple-950 to-slate-900",
  },
  {
    gradient: "from-amber-500 to-orange-600",
    solidBg: "#E67E22",
    ringColor: "ring-amber-400",
    coverGradient: "from-slate-900 via-amber-950 to-slate-900",
  },
  {
    gradient: "from-rose-500 to-red-600",
    solidBg: "#E74C3C",
    ringColor: "ring-rose-400",
    coverGradient: "from-slate-900 via-rose-950 to-slate-900",
  },
  {
    gradient: "from-teal-500 to-cyan-600",
    solidBg: "#16A085",
    ringColor: "ring-teal-400",
    coverGradient: "from-slate-900 via-teal-950 to-slate-900",
  },
  {
    gradient: "from-indigo-500 to-blue-700",
    solidBg: "#3F51B5",
    ringColor: "ring-indigo-400",
    coverGradient: "from-slate-900 via-indigo-950 to-slate-900",
  },
  {
    gradient: "from-fuchsia-500 to-pink-600",
    solidBg: "#D81B60",
    ringColor: "ring-fuchsia-400",
    coverGradient: "from-slate-900 via-pink-950 to-slate-900",
  },
];

/**
 * Extrai 1 ou 2 letras iniciais limpas do nome do grupo (estilo Telegram)
 */
export function getCommunityInitials(name: string): string {
  if (!name || !name.trim()) return "C";
  const words = name
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Retorna a paleta de cores sólida padrão associada de forma consistente ao nome do grupo
 */
export function getCommunityColorPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % TELEGRAM_PALETTES.length;
  return TELEGRAM_PALETTES[index];
}

/**
 * Redimensiona e comprime uma imagem no navegador antes do upload
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1400,
  quality = 0.82
): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            quality
          );
        } else {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Converte um ficheiro ou blob em Data URL compacta para fallback
 */
export async function fileToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Faz upload de imagem para avatar ou fundo do clube para o bucket de armazenamento
 * com compressão automática e fallback gracioso.
 */
export async function uploadClubImage(
  clubId: string,
  file: File,
  type: "avatar" | "cover"
): Promise<string | null> {
  try {
    const maxDim = type === "avatar" ? 512 : 1400;
    const quality = type === "avatar" ? 0.85 : 0.8;
    const compressedBlob = await compressImageFile(file, maxDim, quality);

    const path = `club_${type}s/${clubId}_${Date.now()}.jpg`;

    const { error: uploadErr } = await supabase.storage
      .from("covers")
      .upload(path, compressedBlob, {
        upsert: true,
        contentType: "image/jpeg",
      });

    if (!uploadErr) {
      const { data } = supabase.storage.from("covers").getPublicUrl(path);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    } else {
      console.warn(`Aviso no upload storage da ${type} do clube:`, uploadErr);
    }

    // Fallback de alta disponibilidade: converter para DataURL compacta caso o storage falhe
    const fallbackDataUrl = await fileToDataUrl(compressedBlob);
    return fallbackDataUrl;
  } catch (err) {
    console.error(`Falha ao carregar imagem (${type}):`, err);
    try {
      const directDataUrl = await fileToDataUrl(file);
      return directDataUrl;
    } catch {
      return null;
    }
  }
}
