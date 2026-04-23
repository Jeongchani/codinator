import type { ThemeMode } from "@codinator/contracts";

export const THEME_STORAGE_KEY = "codinator:theme-mode";
export const DEFAULT_THEME_MODE: ThemeMode = "LIGHT";

export const isThemeMode = (value: unknown): value is ThemeMode => {
  return value === "LIGHT" || value === "DARK";
};

export const getStoredThemeMode = (): ThemeMode | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(storedValue) ? storedValue : null;
};

export const persistThemeMode = (theme: ThemeMode): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
};

export const clearStoredThemeMode = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(THEME_STORAGE_KEY);
};

export const applyThemeMode = (theme: ThemeMode): void => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const isDark = theme === "DARK";

  root.classList.toggle("dark", isDark);
  root.dataset.theme = isDark ? "dark" : "light";
  document.body.dataset.theme = isDark ? "dark" : "light";
};

export const saveAndApplyThemeMode = (theme: ThemeMode): void => {
  persistThemeMode(theme);
  applyThemeMode(theme);
};

export const bootstrapThemeMode = (): ThemeMode => {
  const theme = getStoredThemeMode() ?? DEFAULT_THEME_MODE;
  applyThemeMode(theme);
  return theme;
};
