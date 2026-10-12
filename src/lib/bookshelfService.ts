import { supabase } from "./supabase";
import { setCached } from "./cache";

export interface BookshelfItem {
  id: string;
  bookId?: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  status: "reading" | "finished" | "saved" | "to_read";
  progress: number;
  currentPage?: number;
  totalPages?: number;
  isPhysical?: boolean;
  rating?: number;
  personalNotes?: string;
  finishedAt?: string | null;
  lastReadAt?: string | null;
  source: "system" | "custom";
  fileType?: string;
}

const LOCAL_CUSTOM_BOOKS_KEY = "kuwerenga_custom_bookshelf";

/** Retorna livros manuais/físicos guardados localmente */
export function getLocalCustomBooks(): BookshelfItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_BOOKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Salva livros manuais/físicos no armazenamento local */
export function saveLocalCustomBooks(books: BookshelfItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_CUSTOM_BOOKS_KEY, JSON.stringify(books));
  } catch (err) {
    console.warn("Erro ao salvar livros manuais localmente:", err);
  }
}

/** Carrega todos os livros da estante do utilizador (Supabase + Locais/Físicos) */
export async function loadUserBookshelf(): Promise<BookshelfItem[]> {
  const localCustom = getLocalCustomBooks();
  let systemItems: BookshelfItem[] = [];

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from("user_books")
        .select(`
          id,
          status,
          current_page,
          progress,
          last_read_at,
          book:books (
            id,
            title,
            author,
            cover_url,
            total_pages,
            file_type
          )
        `)
        .eq("user_id", user.id)
        .order("last_read_at", { ascending: false, nullsFirst: false });

      if (!error && data) {
        systemItems = data
          .filter((item: any) => item.book)
          .map((item: any) => ({
            id: item.id,
            bookId: item.book.id,
            title: item.book.title,
            author: item.book.author,
            coverUrl: item.book.cover_url,
            status: item.status,
            currentPage: item.current_page || 1,
            totalPages: item.book.total_pages || 1,
            progress: item.progress || 0,
            lastReadAt: item.last_read_at,
            source: "system",
            fileType: item.book.file_type || "pdf",
          }));
      }
    }
  } catch (err) {
    console.error("Erro ao carregar estante do Supabase:", err);
  }

  // Agrega itens do sistema + livros manuais/físicos (sem duplicar por ID)
  const combined = [...systemItems];
  for (const custom of localCustom) {
    if (!combined.some((item) => item.id === custom.id)) {
      combined.push(custom);
    }
  }

  setCached("bookshelf_all_items", combined);
  return combined;
}

/** Adiciona um livro físico ou lido noutro local à estante de Lidos */
export async function addCustomBookToShelf(bookData: {
  title: string;
  author: string;
  coverUrl?: string | null;
  totalPages?: number;
  isPhysical?: boolean;
  rating?: number;
  personalNotes?: string;
  finishedAt?: string;
  status?: "finished" | "reading" | "saved";
}): Promise<BookshelfItem> {
  const newBook: BookshelfItem = {
    id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: bookData.title.trim(),
    author: bookData.author.trim() || "Autor Desconhecido",
    coverUrl: bookData.coverUrl || null,
    status: bookData.status || "finished",
    progress: bookData.status === "reading" ? 50 : 100,
    currentPage: bookData.totalPages || 1,
    totalPages: bookData.totalPages || 100,
    isPhysical: bookData.isPhysical ?? true,
    rating: bookData.rating || 5,
    personalNotes: bookData.personalNotes?.trim() || "",
    finishedAt: bookData.finishedAt || new Date().toISOString(),
    lastReadAt: new Date().toISOString(),
    source: "custom",
  };

  const current = getLocalCustomBooks();
  const updated = [newBook, ...current];
  saveLocalCustomBooks(updated);

  return newBook;
}

/** Marca um livro do sistema automaticamente como concluído/lido */
export async function markBookAsFinished(bookId: string, totalPages?: number) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("user_books")
        .upsert({
          user_id: user.id,
          book_id: bookId,
          status: "finished",
          progress: 100,
          current_page: totalPages || 1,
          last_read_at: new Date().toISOString(),
        }, { onConflict: "user_id,book_id" });
    }
  } catch (err) {
    console.error("Erro ao marcar livro como lido no Supabase:", err);
  }

  // Também atualiza o registo local se existir
  const local = getLocalCustomBooks();
  const index = local.findIndex((b) => b.bookId === bookId || b.id === bookId);
  if (index !== -1) {
    local[index].status = "finished";
    local[index].progress = 100;
    local[index].finishedAt = new Date().toISOString();
    saveLocalCustomBooks(local);
  }
}

/** Atualiza o estado de um livro na estante */
export async function updateShelfBookStatus(
  item: BookshelfItem,
  newStatus: "reading" | "finished" | "saved"
) {
  if (item.source === "system" && item.bookId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("user_books")
          .update({
            status: newStatus,
            progress: newStatus === "finished" ? 100 : item.progress,
            last_read_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .eq("book_id", item.bookId);
      }
    } catch (err) {
      console.error("Erro ao atualizar status no Supabase:", err);
    }
  } else {
    const local = getLocalCustomBooks();
    const target = local.find((b) => b.id === item.id);
    if (target) {
      target.status = newStatus;
      if (newStatus === "finished") {
        target.progress = 100;
        target.finishedAt = new Date().toISOString();
      }
      saveLocalCustomBooks(local);
    }
  }
}

/** Remove um livro da estante */
export async function removeBookFromShelf(item: BookshelfItem) {
  if (item.source === "system" && item.bookId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("user_books")
          .delete()
          .eq("user_id", user.id)
          .eq("book_id", item.bookId);
      }
    } catch (err) {
      console.error("Erro ao remover livro do Supabase:", err);
    }
  }

  const local = getLocalCustomBooks();
  const updated = local.filter((b) => b.id !== item.id && b.bookId !== item.bookId);
  saveLocalCustomBooks(updated);
}
