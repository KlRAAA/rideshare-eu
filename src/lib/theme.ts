// Light or dark, chosen in the header's sun/moon button or in Profile. Same
// storage key and data-theme attribute as the blocking script in layout.tsx;
// both controls listen for THEME_EVENT so they never disagree.
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'rsu-theme';
export const THEME_EVENT = 'rsu:theme';

export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing or blocked storage: it applies now, just isn't remembered.
  }
  window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: theme }));
}
