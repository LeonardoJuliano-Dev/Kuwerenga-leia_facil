/**
 * Cache local inteligente (Stale-While-Revalidate)
 * Permite que a aplicação exiba dados em 0ms enquanto atualiza em segundo plano.
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`cache_${key}`);
    if (!raw) return null;
    const parsed: CacheItem<T> = JSON.parse(raw);
    return parsed.data;
  } catch (e) {
    console.warn("Erro ao ler cache:", e);
    return null;
  }
}

export function setCached<T>(key: string, data: T): void {
  try {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(`cache_${key}`, JSON.stringify(item));
  } catch (e) {
    console.warn("Erro ao gravar cache:", e);
  }
}

export function clearCache(key: string): void {
  try {
    localStorage.removeItem(`cache_${key}`);
  } catch (e) {
    console.warn("Erro ao limpar cache:", e);
  }
}
