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
  // Campos expandidos de venda
  seller_name?: string;
  seller_type?: "bookstore" | "independent";
  location?: string;
  delivery_options?: string;
  stock_quantity?: number;
  purchase_rating?: number;
  rating_comment?: string;
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

    // 2. Verifica se o email é o administrador autorizado
    if (user.email?.toLowerCase() === "leonardojulianoj@gmail.com") {
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
    // Novos campos
    seller_name: bookData.seller_name?.trim() || undefined,
    seller_type: bookData.seller_type || "independent",
    location: bookData.location?.trim() || undefined,
    physical_condition: bookData.physical_condition || "Novo",
    delivery_options: bookData.delivery_options || undefined,
    stock_quantity: Number(bookData.stock_quantity) || 1,
    purchase_rating: bookData.purchase_rating !== undefined ? Number(bookData.purchase_rating) : 5,
    rating_comment: bookData.rating_comment?.trim() || undefined,
  };

  try {
    // 1. Tenta gravar com todos os campos no Supabase
    const { data, error } = await supabase
      .from("books")
      .upsert({
        ...completeItem,
        is_approved: true,
      })
      .select()
      .single();

    if (!error && data) {
      saveLocalStoreBook({ ...completeItem, ...(data as any) });
      return { ...completeItem, ...(data as any) };
    }

    // 2. Se falhar por colunas adicionais não criadas no schema remoto, grava com campos base
    if (error) {
      const basePayload: any = {
        id: completeItem.id,
        title: completeItem.title,
        author: completeItem.author,
        description: completeItem.description,
        cover_url: completeItem.cover_url,
        file_url: completeItem.file_url,
        file_type: completeItem.file_type,
        is_for_sale: true,
        price: completeItem.price,
        currency: completeItem.currency,
        stock_status: completeItem.stock_status,
        seller_whatsapp: completeItem.seller_whatsapp,
        category_id: completeItem.category_id,
        is_approved: true,
      };

      const { data: baseData } = await supabase
        .from("books")
        .upsert(basePayload)
        .select()
        .single();

      if (baseData) {
        saveLocalStoreBook({ ...completeItem, ...(baseData as any) });
        return { ...completeItem, ...(baseData as any) };
      }
    }
  } catch (err) {
    console.warn("Aviso ao sincronizar no Supabase:", err);
  }

  // Grava localmente garantindo persistência imediata
  saveLocalStoreBook(completeItem);
  return completeItem;
}

/**
 * Guarda uma classificação da compra / avaliação de interesse para o livro
 */
export async function rateBookPurchase(
  bookId: string,
  rating: number,
  comment?: string
): Promise<BookSaleItem | null> {
  const books = getLocalStoreBooks();
  const book = books.find((b) => b.id === bookId);
  if (book) {
    book.purchase_rating = rating;
    if (comment !== undefined) book.rating_comment = comment;
    saveLocalStoreBook(book);
  }

  try {
    const { data } = await supabase
      .from("books")
      .update({
        purchase_rating: rating,
        rating_comment: comment || null,
      })
      .eq("id", bookId)
      .select()
      .maybeSingle();

    if (data) {
      const merged = { ...book, ...(data as any) };
      saveLocalStoreBook(merged);
      return merged;
    }
  } catch (err) {
    console.warn("Aviso ao guardar classificação de compra no Supabase:", err);
  }

  return book || null;
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
