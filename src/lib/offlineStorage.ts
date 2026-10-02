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
  const request = index.getAll(false);

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
  const request = index.getAll(false);

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
