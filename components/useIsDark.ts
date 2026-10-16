'use client';

// Tracks the site's own theme (html[data-theme], persisted in localStorage
// 'vstep_theme' by ThemeToggle). Default is light.

import { useEffect, useState } from 'react';

export function useIsDark(): boolean {
  // Initialize from the live <html data-theme> (set before first paint by
  // the theme-init script in app/layout.tsx) so the first client render
  // already matches the saved theme — otherwise DarkVeil flashes light in
  // dark mode until the mount effect runs. Safe for SSR: `document` is
  // undefined on the server, so the server render still starts at false,
  // and the canvas element itself is identical either way (only the WebGL
  // uniform differs, drawn in an effect).
  const [isDark, setIsDark] = useState(
    () =>
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-theme') === 'dark'
  );
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setIsDark(el.getAttribute('data-theme') === 'dark');
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}
