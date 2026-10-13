export type AppTheme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "kuwerenga_theme";

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "system";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem("theme");
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
    return "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: AppTheme) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem("theme", theme);
  } catch {}

  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }

  // Atualiza a meta tag theme-color para a barra de estado móvel
  try {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", isDark ? "#000000" : "#f7f3e8");
    }
  } catch {}
}

export function initThemeListener(): () => void {
  if (typeof window === "undefined") return () => {};

  // Aplica o tema imediatamente na inicialização
  const initial = getStoredTheme();
  applyTheme(initial);

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleMediaChange = () => {
    const current = getStoredTheme();
    if (current === "system") {
      applyTheme("system");
    }
  };

  mediaQuery.addEventListener("change", handleMediaChange);
  return () => {
    mediaQuery.removeEventListener("change", handleMediaChange);
  };
}
