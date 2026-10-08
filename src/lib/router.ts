// A router small enough to read in one go. Four kinds of page do not need a
// dependency; the static server sends every path to index.html.

import { useEffect, useState } from 'react';

const listeners = new Set<() => void>();

export function navigate(to: string, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  listeners.forEach(l => l());
  window.scrollTo(0, 0);
}

export function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    listeners.add(on);
    window.addEventListener('popstate', on);
    return () => {
      listeners.delete(on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return path;
}

/** Matches "/events/:id" against a path; returns the params or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$');
  const m = re.exec(path);
  return m ? { ...(m.groups ?? {}) } : null;
}
