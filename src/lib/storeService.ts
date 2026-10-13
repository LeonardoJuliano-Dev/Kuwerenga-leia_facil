import { supabase } from "./supabase";

export interface BookSaleItem {
  id: string;
  title: string;
  author: string;
  description: string | null;
  cover_url: string | null;
  file_url?: string;
  file_type?: "pdf" | "epub" | "physical";
  total_pages?: number;
  category_id?: string | null;
  is_for_sale: boolean;
  price: number;
  currency: string;
  stock_status: "available" | "out_of_stock";
  seller_whatsapp: string;
  physical_condition?: string;
  created_at: string;
  uploaded_by?: string;
}

const LOCAL_STORE_BOOKS_KEY = "kuwerenga_custom_store_books";

/**
 * Obtém livros de loja guardados localmente como fallback
 */
export function getLocalStoreBooks(): BookSaleItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_BOOKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Salva livro de loja localmente
 */
export function saveLocalStoreBook(book: BookSaleItem): void {
  try {
    const list = getLocalStoreBooks();
    const idx = list.findIndex((b) => b.id === book.id);
    if (idx >= 0) {
      list[idx] = book;
    } else {
      list.unshift(book);
    }
    localStorage.setItem(LOCAL_STORE_BOOKS_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Erro ao salvar livro local:", err);
  }
}

/**
 * Remove livro de loja local
 */
export function removeLocalStoreBook(bookId: string): void {
  try {
    const list = getLocalStoreBooks().filter((b) => b.id !== bookId);
    localStorage.setItem(LOCAL_STORE_BOOKS_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Erro ao remover livro local:", err);
  }
}

/**
 * Verifica se o utilizador atual tem privilégios de administrador
 */
export async function checkIsAdmin(): Promise<boolean> {
  try {
    // 1. Verifica flag manual de admin no localStorage (para facilidade de testes do desenvolvedor)
    const manualAdmin = localStorage.getItem("kuwerenga_is_admin");
    if (manualAdmin === "true") return true;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // 2. Verifica se o email é um dos administradores padrão
    if (
      user.email?.toLowerCase().includes("admin") ||
      user.email === "leonardojuliano.dev@gmail.com" ||
      user.email === "admin@kuwerenga.com"
    ) {
      return true;
    }

    // 3. Verifica na tabela profiles do Supabase
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && profile.is_admin === true) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Define ou remove o modo de administrador local para testes
 */
export function setLocalAdminMode(enabled: boolean): void {
  localStorage.setItem("kuwerenga_is_admin", enabled ? "true" : "false");
}

/**
 * Limpa e formata o número de telefone de Moçambique / Internacional para WhatsApp
 */
export function formatWhatsAppNumber(phoneOrUrl: string): string {
  if (!phoneOrUrl) return "";

  // Se já for um link wa.me, extrai apenas o número
  if (phoneOrUrl.includes("wa.me/")) {
    const parts = phoneOrUrl.split("wa.me/");
    return parts[1]?.split("?")[0]?.replace(/\D/g, "") || "";
  }

  // Remove caracteres não numéricos
  let digits = phoneOrUrl.replace(/\D/g, "");

  // Se for número de Moçambique com 9 dígitos (ex: 841234567 ou 871234567), adiciona o indicativo 258
  if (digits.length === 9 && (digits.startsWith("82") || digits.startsWith("83") || digits.startsWith("84") || digits.startsWith("85") || digits.startsWith("86") || digits.startsWith("87"))) {
    digits = `258${digits}`;
  }

  return digits;
}

/**
 * Gera o link direto de WhatsApp com mensagem contextual pronta para o livro
 */
export function buildWhatsAppLink(book: {
  title: string;
  price?: number;
  currency?: string;
  seller_whatsapp: string;
  stock_status: "available" | "out_of_stock";
}): string {
  const phone = formatWhatsAppNumber(book.seller_whatsapp);
  const currency = book.currency || "MT";
  const priceDisplay = book.price && book.price > 0 ? ` por ${book.price} ${currency}` : "";

  let message = "";
  if (book.stock_status === "available") {
    message = `Olá! Vi o livro "${book.title}"${priceDisplay} no Kuwerenga+ e gostaria de saber se ainda está disponível para compra.`;
  } else {
    message = `Olá! Vi que o livro "${book.title}" está esgotado no Kuwerenga+. Gostaria de saber quando terão novas unidades disponíveis ou se é possível fazer uma reserva.`;
  }

  const encodedMsg = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encodedMsg}`;
}

/**
 * Carrega a lista de livros para venda
 */
export async function fetchBooksForSale(): Promise<BookSaleItem[]> {
  try {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("is_for_sale", true)
      .order("created_at", { ascending: false });

    const localItems = getLocalStoreBooks();

    if (!error && data && data.length > 0) {
      // Mescla com locais garantindo IDs únicos
      const existingIds = new Set(data.map((b: any) => b.id));
      const filteredLocals = localItems.filter((b) => !existingIds.has(b.id));
      return [...data, ...filteredLocals];
    }

    return localItems;
  } catch (err) {
    console.warn("Aviso ao carregar livros à venda no Supabase, usando armazenamento local:", err);
    return getLocalStoreBooks();
  }
}

/**
 * Adiciona ou edita um livro no catálogo
 */
export async function upsertBookForSale(bookData: Partial<BookSaleItem>): Promise<BookSaleItem> {
  const { data: { user } } = await supabase.auth.getUser();

  const id = bookData.id || `sale_${Date.now()}`;
  const completeItem: BookSaleItem = {
    id,
    title: bookData.title?.trim() || "Livro sem título",
    author: bookData.author?.trim() || "Autor desconhecido",
    description: bookData.description || null,
    cover_url: bookData.cover_url || null,
    file_url: bookData.file_url || "",
    file_type: (bookData.file_type as any) || "physical",
    is_for_sale: true,
    price: Number(bookData.price) || 0,
    currency: bookData.currency || "MT",
    stock_status: bookData.stock_status || "available",
    seller_whatsapp: formatWhatsAppNumber(bookData.seller_whatsapp || ""),
    category_id: bookData.category_id || null,
    uploaded_by: user?.id,
    created_at: bookData.created_at || new Date().toISOString(),
  };

  try {
    // Tenta gravar no Supabase
    const { data, error } = await supabase
      .from("books")
      .upsert({
        ...completeItem,
        is_approved: true,
      })
      .select()
      .single();

    if (!error && data) {
      saveLocalStoreBook(data as BookSaleItem);
      return data as BookSaleItem;
    }
  } catch (err) {
    console.warn("Aviso ao sincronizar no Supabase:", err);
  }

  // Grava localmente como garantia
  saveLocalStoreBook(completeItem);
  return completeItem;
}

/**
 * Elimina qualquer livro do sistema (para administradores)
 */
export async function deleteBookAsAdmin(bookId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("books").delete().eq("id", bookId);
    removeLocalStoreBook(bookId);
    return !error;
  } catch (err) {
    console.error("Erro ao apagar livro:", err);
    removeLocalStoreBook(bookId);
    return true;
  }
}
