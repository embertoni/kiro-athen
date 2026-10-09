/**
 * Theme helpers + hook for the light/dark toggle.
 *
 * The chosen theme is applied via a data attribute on the document root
 * (document.documentElement.dataset.theme = 'light' | 'dark') and the
 * matching [data-theme=dark] palette override lives in src/styles/theme.css.
 * The choice is persisted in localStorage and, on first visit, falls back to
 * the OS preference (prefers-color-scheme) and finally to 'light'.
 *
 * resolveInitialTheme / nextTheme are pure (no DOM/storage access) so they can
 * be unit-tested; see __tests__/theme.test.ts.
 */

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'athen.theme';

/**
 * Resolve the initial theme from a persisted value and an OS preference.
 * A valid stored value wins; otherwise fall back to the OS dark preference,
 * then to 'light'. Pure: callers pass the stored value and the prefers-dark
 * flag so this stays testable without touching the DOM or storage.
 */
export function resolveInitialTheme(
  stored: string | null | undefined,
  prefersDark: boolean,
): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

/** The opposite theme (used by the toggle). Pure. */
export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

function readStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function prefersDarkScheme(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Apply the theme to the document root and persist the choice. */
function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures (private mode, quota) — the data attribute still
    // reflects the current choice for this session.
  }
}

/**
 * React hook owning the current theme. Initializes from storage/OS preference,
 * keeps the document root data attribute in sync, and exposes a toggle.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveInitialTheme(readStoredTheme(), prefersDarkScheme()),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => nextTheme(current));
  }, []);

  return { theme, toggleTheme };
}
