/**
 * Utilitário de Gestão de Sessão do Modo Convidado (Visitante)
 * Permite leitura de livros locais e públicos sem forçar autenticação imediata.
 */

const GUEST_STORAGE_KEY = "kuwerenga_guest_mode";

/** Verifica se o utilizador está atualmente a navegar em Modo Convidado */
export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(GUEST_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Ativa o Modo Convidado */
export function enableGuestMode(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, "true");
  } catch (err) {
    console.warn("Erro ao ativar modo convidado:", err);
  }
}

/** Desativa o Modo Convidado (ex: ao fazer login ou logout) */
export function disableGuestMode(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch (err) {
    console.warn("Erro ao desativar modo convidado:", err);
  }
}
