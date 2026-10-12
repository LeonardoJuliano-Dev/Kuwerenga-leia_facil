import { supabase } from "./supabase";

// Offline storage using IndexedDB for books and reading progress
// This allows users to download and read books without internet

const DB_NAME = 'leitura-offline';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // Store downloaded book files (blobs)
      if (!db.objectStoreNames.contains('book_files')) {
        db.createObjectStore('book_files', { keyPath: 'bookId' });
      }

      // Store reading progress for offline sync
      if (!db.objectStoreNames.contains('reading_progress')) {
        const store = db.createObjectStore('reading_progress', { keyPath: 'bookId' });
        store.createIndex('synced', 'synced', { unique: false });
      }

      // Store annotations for offline sync
      if (!db.objectStoreNames.contains('annotations')) {
        const store = db.createObjectStore('annotations', { keyPath: 'id' });
        store.createIndex('bookId', 'bookId', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }

      // Store book metadata for offline browsing
      if (!db.objectStoreNames.contains('book_metadata')) {
        db.createObjectStore('book_metadata', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ========== BOOK FILES ==========

export async function saveBookOffline(bookId: string, fileBlob: Blob, metadata: Record<string, unknown>) {
  const db = await openDB();
  const tx = db.transaction(['book_files', 'book_metadata'], 'readwrite');

  tx.objectStore('book_files').put({ bookId, blob: fileBlob, downloadedAt: new Date().toISOString() });
  tx.objectStore('book_metadata').put({ id: bookId, ...metadata });

  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBookOffline(bookId: string): Promise<Blob | null> {
  const db = await openDB();
  const tx = db.transaction('book_files', 'readonly');
  const request = tx.objectStore('book_files').get(bookId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result?.blob || null);
    request.onerror = () => reject(request.error);
  });
}

export async function isBookDownloaded(bookId: string): Promise<boolean> {
  const blob = await getBookOffline(bookId);
  return blob !== null;
}

export async function deleteBookOffline(bookId: string) {
  const db = await openDB();
  const tx = db.transaction(['book_files', 'book_metadata'], 'readwrite');
  tx.objectStore('book_files').delete(bookId);
  tx.objectStore('book_metadata').delete(bookId);

  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBookMetadataOffline(bookId: string): Promise<Record<string, any> | null> {
  try {
    const db = await openDB();
    const tx = db.transaction('book_metadata', 'readonly');
    const request = tx.objectStore('book_metadata').get(bookId);

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn("Erro ao ler metadados offline:", err);
    return null;
  }
}

export async function getAllDownloadedBookIds(): Promise<string[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('book_files', 'readonly');
    const store = tx.objectStore('book_files');
    const request = store.getAllKeys();

    return new Promise((resolve) => {
      request.onsuccess = () => resolve((request.result as string[]) || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn("Erro ao listar IDs descarregados:", err);
    return [];
  }
}

export async function getAllDownloadedBooksOffline(): Promise<any[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(['book_files', 'book_metadata'], 'readonly');
    const filesStore = tx.objectStore('book_files');
    const metaStore = tx.objectStore('book_metadata');

    return new Promise((resolve) => {
      const filesReq = filesStore.getAll();
      filesReq.onsuccess = () => {
        const files = filesReq.result || [];
        if (files.length === 0) {
          resolve([]);
          return;
        }

        const metaReq = metaStore.getAll();
        metaReq.onsuccess = () => {
          const metas = metaReq.result || [];
          const metaMap = new Map(metas.map((m: any) => [m.id, m]));

          const results = files.map((f: any) => {
            const m = metaMap.get(f.bookId) || {};
            return {
              id: f.bookId,
              bookId: f.bookId,
              title: m.title || "Livro Guardado",
              author: m.author || "Autor Desconhecido",
              coverUrl: m.coverUrl || m.cover_url || null,
              fileType: m.file_type || m.fileType || "pdf",
              totalPages: m.totalPages || m.total_pages || 1,
              downloadedAt: f.downloadedAt,
              isOfflineAvailable: true,
              source: "system",
              ...m
            };
          });
          resolve(results);
        };
        metaReq.onerror = () => resolve([]);
      };
      filesReq.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn("Erro ao listar livros offline completos:", err);
    return [];
  }
}

export async function downloadBookForOffline(book: {
  id: string;
  title: string;
  author?: string;
  coverUrl?: string | null;
  fileUrl?: string | null;
  fileType?: string;
  totalPages?: number;
}): Promise<boolean> {
  try {
    let fileBlob: Blob | null = null;
    let resolvedFileType = book.fileType || "pdf";

    // 1. Se não tiver fileUrl, tenta buscar no Supabase
    let fileUrl = book.fileUrl;
    if (!fileUrl) {
      const { data } = await supabase
        .from("books")
        .select("file_url, file_type, total_pages, cover_url")
        .eq("id", book.id)
        .maybeSingle();

      if (data?.file_url) {
        fileUrl = data.file_url;
        if (data.file_type) resolvedFileType = data.file_type;
      }
    }

    if (!fileUrl) {
      throw new Error("O livro não tem ficheiro associado para descarregar.");
    }

    // 2. Fetch direto do ficheiro
    try {
      const res = await fetch(fileUrl);
      if (res.ok) {
        const b = await res.blob();
        if (b.type !== "application/json") {
          fileBlob = b;
        }
      }
    } catch (e) {
      console.warn("Fetch direto falhou, a tentar Storage do Supabase:", e);
    }

    // 3. Fallback via Supabase Storage
    if (!fileBlob && fileUrl) {
      const urlParts = fileUrl.split("/books/");
      const storagePath = urlParts.length > 1 ? urlParts[1] : fileUrl.split("/").pop();
      if (storagePath) {
        const { data: downloadedBlob } = await supabase.storage.from("books").download(storagePath);
        if (downloadedBlob && downloadedBlob.type !== "application/json") {
          fileBlob = downloadedBlob;
        }
      }
    }

    if (!fileBlob) {
      throw new Error("Não foi possível transferir o ficheiro do livro.");
    }

    // 4. Salvar no IndexedDB
    await saveBookOffline(book.id, fileBlob, {
      title: book.title,
      author: book.author || "Autor",
      coverUrl: book.coverUrl,
      file_type: resolvedFileType,
      totalPages: book.totalPages || 1,
    });

    return true;
  } catch (err) {
    console.error("Erro ao transferir livro para offline:", err);
    throw err;
  }
}

// ========== READING PROGRESS ==========

export interface ReadingProgress {
  bookId: string;
  currentPage: number;
  currentChapter: string;
  progress: number;
  lastReadAt: string;
  synced: boolean;
}

export async function saveReadingProgress(progress: ReadingProgress) {
  const db = await openDB();
  const tx = db.transaction('reading_progress', 'readwrite');
  tx.objectStore('reading_progress').put(progress);

  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getReadingProgress(bookId: string): Promise<ReadingProgress | null> {
  const db = await openDB();
  const tx = db.transaction('reading_progress', 'readonly');
  const request = tx.objectStore('reading_progress').get(bookId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getUnsyncedProgress(): Promise<ReadingProgress[]> {
  const db = await openDB();
  const tx = db.transaction('reading_progress', 'readonly');
  const index = tx.objectStore('reading_progress').index('synced');
  const request = index.getAll(IDBKeyRange.only(0));

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ========== ANNOTATIONS ==========

export interface OfflineAnnotation {
  id: string;
  bookId: string;
  type: 'highlight' | 'note' | 'bookmark';
  content: string;
  selectedText: string;
  pageNumber: number;
  chapter: string;
  cfiRange?: string;
  color?: 'yellow' | 'green' | 'blue' | 'pink' | string;
  synced: boolean;
  createdAt: string;
}

export async function saveAnnotationOffline(annotation: OfflineAnnotation) {
  const db = await openDB();
  const tx = db.transaction('annotations', 'readwrite');
  tx.objectStore('annotations').put(annotation);

  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAnnotationsForBook(bookId: string): Promise<OfflineAnnotation[]> {
  const db = await openDB();
  const tx = db.transaction('annotations', 'readonly');
  const index = tx.objectStore('annotations').index('bookId');
  const request = index.getAll(bookId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getUnsyncedAnnotations(): Promise<OfflineAnnotation[]> {
  const db = await openDB();
  const tx = db.transaction('annotations', 'readonly');
  const index = tx.objectStore('annotations').index('synced');
  const request = index.getAll(IDBKeyRange.only(0));

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ========== SYNC ==========

export async function markProgressSynced(bookId: string) {
  const db = await openDB();
  const tx = db.transaction('reading_progress', 'readwrite');
  const store = tx.objectStore('reading_progress');
  const request = store.get(bookId);

  request.onsuccess = () => {
    if (request.result) {
      store.put({ ...request.result, synced: true });
    }
  };
}

export async function markAnnotationSynced(id: string) {
  const db = await openDB();
  const tx = db.transaction('annotations', 'readwrite');
  const store = tx.objectStore('annotations');
  const request = store.get(id);

  request.onsuccess = () => {
    if (request.result) {
      store.put({ ...request.result, synced: true });
    }
  };
}

export async function getAllAnnotationsOffline(): Promise<OfflineAnnotation[]> {
  const db = await openDB();
  const tx = db.transaction('annotations', 'readonly');
  const store = tx.objectStore('annotations');
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAnnotationOffline(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('annotations', 'readwrite');
  tx.objectStore('annotations').delete(id);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
