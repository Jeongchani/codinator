import type { ThemeMode } from '@codinator/contracts';

export const THEME_STORAGE_KEY = 'codinator:theme-mode';

export const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'LIGHT';
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'DARK' ? 'DARK' : 'LIGHT';
  } catch {
    return 'LIGHT';
  }
};

export const applyThemeMode = (theme: ThemeMode): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const isDark = theme === 'DARK';
  const root = document.documentElement;

  root.classList.toggle('dark', isDark);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  root.style.colorScheme = isDark ? 'dark' : 'light';

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // no-op
    }
  }
};

export const initializeThemeMode = (): ThemeMode => {
  const theme = getStoredThemeMode();
  applyThemeMode(theme);
  return theme;
};
