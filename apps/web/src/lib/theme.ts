import type { ThemeMode } from '@codinator/contracts';

export const THEME_STORAGE_KEY = 'codinator:theme-mode';

const DARK_CLASS_NAME = 'dark';

export const applyThemeMode = (theme: ThemeMode): void => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const isDark = theme === 'DARK';

  root.classList.toggle(DARK_CLASS_NAME, isDark);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  root.style.colorScheme = isDark ? 'dark' : 'light';
};

export const saveThemeMode = (theme: ThemeMode): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
};

export const getStoredThemeMode = (): ThemeMode | null => {
  if (typeof window === 'undefined') return null;

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'DARK' || stored === 'LIGHT' ? stored : null;
};

export const initializeThemeMode = (): ThemeMode => {
  const stored = getStoredThemeMode() ?? 'LIGHT';
  applyThemeMode(stored);
  return stored;
};
