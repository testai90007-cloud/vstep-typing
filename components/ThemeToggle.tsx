'use client';

// Theme toggle (light ⇄ dark) shown in the site header.
// Default theme is always light; dark applies only when the user explicitly
// toggles it. The choice persists in localStorage ('vstep_theme') and the
// <html data-theme> attribute is set by an inline script in the root layout
// before first paint, so there is no flash on reload.

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';

const KEY = 'vstep_theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (window.localStorage.getItem(KEY) === 'dark') {
        setTheme('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch {
      /* storage unavailable — stay on light */
    }
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
    >
      {mounted && theme === 'dark' ? (
        <SunIcon width={18} height={18} />
      ) : (
        <MoonIcon width={18} height={18} />
      )}
    </button>
  );
}
