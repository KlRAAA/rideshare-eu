'use client';

import React, { useEffect, useState } from 'react';
import { FaSun, FaMoon } from 'react-icons/fa';

const STORAGE_KEY = 'rsu-theme';

// Mirrors the inline blocking script in layout.tsx exactly — same storage
// key, same fallback to prefers-color-scheme — so this component's initial
// render always agrees with whatever data-theme the blocking script already
// set on <html> before React ever mounts.
function getCurrentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export default function ThemeToggle() {
  // Starts 'light' to match server-rendered markup (no window/document
  // there), then syncs to the real value on mount — the blocking script
  // already applied the correct data-theme before this runs, so the icon
  // corrects itself before the user can perceive the default.
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setTheme(getCurrentTheme());
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / blocked storage — theme still applies for this
      // page view, it just won't persist. Not worth surfacing an error for.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
    >
      {theme === 'dark' ? <FaSun className="w-4 h-4" /> : <FaMoon className="w-4 h-4" />}
    </button>
  );
}
