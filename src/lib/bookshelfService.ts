import { supabase } from "./supabase";
import { setCached, getCached } from "./cache";
import { getAllDownloadedBooksOffline, getAllDownloadedBookIds } from "./offlineStorage";

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
  isOfflineAvailable?: boolean;
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

/** Carrega todos os livros da estante do utilizador (Supabase + Locais/Físicos + Ficheiros Offline) */
export async function loadUserBookshelf(): Promise<BookshelfItem[]> {
  const localCustom = getLocalCustomBooks();
  const cachedItems = getCached<BookshelfItem[]>("bookshelf_all_items") || [];
  let downloadedIds = new Set<string>();
  let offlineBooks: any[] = [];

  try {
    const ids = await getAllDownloadedBookIds();
    downloadedIds = new Set(ids);
    offlineBooks = await getAllDownloadedBooksOffline();
  } catch (e) {
    console.warn("Erro ao ler livros do IndexedDB:", e);
  }

  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  let systemItems: BookshelfItem[] = [];

  if (!isOffline) {
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
              isOfflineAvailable: downloadedIds.has(item.book.id),
            }));
        }
      }
    } catch (err) {
      console.warn("Rede falhou ao carregar estante do Supabase:", err);
    }
  }

  // Se não obteve itens do sistema (ex: offline ou erro de rede), usa os do cache que eram do sistema
  if (systemItems.length === 0 && cachedItems.length > 0) {
    systemItems = cachedItems.filter((i) => i.source === "system");
  }

  // Agrega itens do sistema + livros manuais/físicos
  const combined: BookshelfItem[] = [...systemItems];

  for (const custom of localCustom) {
    if (!combined.some((item) => item.id === custom.id || (custom.bookId && item.bookId === custom.bookId))) {
      combined.push({
        ...custom,
        isOfflineAvailable: custom.bookId ? downloadedIds.has(custom.bookId) : false,
      });
    }
  }

  // Adiciona livros guardados no IndexedDB que ainda não estejam presentes na estante
  for (const off of offlineBooks) {
    const alreadyExists = combined.some(
      (item) => item.bookId === off.bookId || item.id === off.bookId || item.title === off.title
    );
    if (!alreadyExists) {
      combined.push({
        id: off.bookId,
        bookId: off.bookId,
        title: off.title,
        author: off.author || "Autor Desconhecido",
        coverUrl: off.coverUrl || null,
        status: "saved",
        progress: 0,
        currentPage: 1,
        totalPages: off.totalPages || 100,
        source: "system",
        fileType: off.fileType || "pdf",
        isOfflineAvailable: true,
      });
    }
  }

  // Atualiza anotação de isOfflineAvailable em todos os itens
  const finalized = combined.map((item) => ({
    ...item,
    isOfflineAvailable: item.isOfflineAvailable || (item.bookId ? downloadedIds.has(item.bookId) : false) || downloadedIds.has(item.id),
  }));

  setCached("bookshelf_all_items", finalized);
  return finalized;
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

  // Remove imediatamente do cache da Home para não aparecer em Continuar a Ler
  try {
    const cached = getCached<any[]>("home_reading_list");
    if (cached) {
      setCached("home_reading_list", cached.filter((b) => b.bookId !== bookId));
    }
  } catch {}

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

/** Regista automaticamente um livro na secção de 'A Ler' quando a leitura começa */
export async function markBookAsReading(bookId: string, title?: string, author?: string) {
  if (!bookId || bookId === "demo-book" || bookId.startsWith("local-")) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: existing } = await supabase
        .from("user_books")
        .select("status")
        .eq("user_id", user.id)
        .eq("book_id", bookId)
        .maybeSingle();

      // Só coloca em 'reading' se o livro ainda não foi finalizado/lido
      if (!existing || existing.status !== "finished") {
        await supabase
          .from("user_books")
          .upsert({
            user_id: user.id,
            book_id: bookId,
            status: "reading",
            last_read_at: new Date().toISOString(),
          }, { onConflict: "user_id,book_id" });
      }
    } else {
      // Visitante ou modo convidado local
      const local = getLocalCustomBooks();
      const existing = local.find((b) => b.bookId === bookId || b.id === bookId);
      if (!existing) {
        local.unshift({
          id: `reading-${bookId}`,
          bookId,
          title: title || "Livro",
          author: author || "Autor Desconhecido",
          status: "reading",
          progress: 5,
          currentPage: 1,
          source: "system",
          lastReadAt: new Date().toISOString(),
        });
        saveLocalCustomBooks(local);
      } else if (existing.status !== "finished") {
        existing.status = "reading";
        existing.lastReadAt = new Date().toISOString();
        saveLocalCustomBooks(local);
      }
    }
  } catch (err) {
    console.warn("Erro ao registar início de leitura:", err);
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

  if (newStatus === "finished") {
    try {
      const cached = getCached<any[]>("home_reading_list");
      if (cached) {
        setCached("home_reading_list", cached.filter((b) => b.bookId !== (item.bookId || item.id)));
      }
    } catch {}
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
