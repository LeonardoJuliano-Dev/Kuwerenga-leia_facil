import { supabase } from "./supabase";

const LOCAL_READS_KEY = "kuwerenga_book_reads";
const READ_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutos de intervalo por livro para evitar contagens duplicadas

interface LocalReadRecord {
  [bookId: string]: {
    count: number;
    lastRecordedAt: number;
  };
}

/**
 * Obtém contagens locais guardadas no localStorage (modo convidado/offline)
 */
export function getLocalReadRecords(): LocalReadRecord {
  try {
    const raw = localStorage.getItem(LOCAL_READS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Guarda contagem local para um livro
 */
function saveLocalRead(bookId: string): number {
  try {
    const records = getLocalReadRecords();
    const now = Date.now();
    const current = records[bookId] || { count: 0, lastRecordedAt: 0 };

    // Evita incremento excessivo se foi lido há menos de 15 minutos
    if (now - current.lastRecordedAt < READ_COOLDOWN_MS) {
      return current.count;
    }

    const newCount = current.count + 1;
    records[bookId] = {
      count: newCount,
      lastRecordedAt: now,
    };

    localStorage.setItem(LOCAL_READS_KEY, JSON.stringify(records));
    return newCount;
  } catch {
    return 1;
  }
}

/**
 * Regista o início de leitura de uma obra no Supabase e localmente
 */
export async function recordBookRead(bookId: string): Promise<number | null> {
  if (!bookId || bookId === "demo-book" || bookId.startsWith("local-")) {
    return null;
  }

  // Regista localmente com cooldown
  const localCount = saveLocalRead(bookId);

  // Se estiver online, tenta chamar o RPC do Supabase
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const { data, error } = await supabase.rpc("increment_book_read_count", {
        target_book_id: bookId,
      });

      if (!error && typeof data === "number") {
        return data;
      }
    } catch (err) {
      // Falha silenciosa do RPC (ex: função ainda não executada no DB)
      console.warn("Falha no incremento RPC de leituras:", err);
    }
  }

  return localCount;
}

/**
 * Formata número de leituras de forma elegante (ex: 1.5k leituras ou 24 leituras)
 */
export function formatReadCount(count?: number | null): string {
  const num = Math.max(0, count || 0);
  if (num === 0) return "Primeira leitura";
  if (num === 1) return "1 leitura";
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1).replace(".0", "")}k leituras`;
  }
  return `${num} leituras`;
}

export interface MostReadBook {
  id: string;
  title: string;
  author: string;
  description: string | null;
  cover_url: string | null;
  file_type: string;
  total_pages: number;
  read_count: number;
  total_downloads?: number;
  avg_rating?: number;
  rank?: number;
}

/**
 * Obtém os livros mais lidos combinando Supabase e dados locais de forma resiliente
 */
export async function fetchMostReadBooks(limit: number = 8): Promise<MostReadBook[]> {
  const localRecords = getLocalReadRecords();

  try {
    // 1. Tenta carregar com read_count
    let books: any[] | null = null;
    const { data: primaryData, error } = await supabase
      .from("books")
      .select("id, title, author, description, cover_url, file_type, total_pages, is_approved, is_for_sale, read_count, total_downloads, avg_rating, total_ratings")
      .or("is_approved.eq.true,is_for_sale.eq.true")
      .order("read_count", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit * 2);

    books = primaryData;

    // Se falhar (por exemplo, coluna read_count ainda não adicionada ao schema no Supabase)
    if (error || !books) {
      const fallbackQuery = await supabase
        .from("books")
        .select("id, title, author, description, cover_url, file_type, total_pages, is_approved, is_for_sale, total_downloads, avg_rating, total_ratings")
        .or("is_approved.eq.true,is_for_sale.eq.true")
        .order("created_at", { ascending: false })
        .limit(limit * 2);

      books = fallbackQuery.data;
    }

    if (!books || books.length === 0) {
      return [];
    }

    // 2. Mescla read_count com registros locais e downloads
    const formatted: MostReadBook[] = books.map((b: any) => {
      const dbReadCount = typeof b.read_count === "number" ? b.read_count : 0;
      const localCount = localRecords[b.id]?.count || 0;
      const downloads = typeof b.total_downloads === "number" ? b.total_downloads : 0;

      // Leituras consolidadas: prioriza a contagem da BD ou soma atividade local
      const effectiveReads = Math.max(dbReadCount, localCount, downloads);

      return {
        id: b.id,
        title: b.title,
        author: b.author,
        description: b.description || null,
        cover_url: b.cover_url || null,
        file_type: b.file_type || "pdf",
        total_pages: b.total_pages || 0,
        read_count: effectiveReads,
        total_downloads: downloads,
        avg_rating: b.avg_rating || 0,
      };
    });

    // 3. Ordena estritamente por número de leituras (descendente)
    formatted.sort((a, b) => {
      if (b.read_count !== a.read_count) {
        return b.read_count - a.read_count;
      }
      return (b.total_downloads || 0) - (a.total_downloads || 0);
    });

    // 4. Atribui rank numérico (1º, 2º, 3º...)
    return formatted.slice(0, limit).map((book, index) => ({
      ...book,
      rank: index + 1,
    }));
  } catch (err) {
    console.error("Erro ao obter livros mais lidos:", err);
    return [];
  }
}
