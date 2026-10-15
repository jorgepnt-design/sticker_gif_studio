/**
 * Minimaler Hash-Router – bewusst ohne externe Abhängigkeit.
 * Routen haben die Form  #/pfad
 */
import { useEffect, useState } from 'react';

function parseHash(): string {
  return window.location.hash.replace(/^#/, '').split('?')[0] || '/';
}

export function useRoute(): string {
  const [path, setPath] = useState(parseHash);
  useEffect(() => {
    const onChange = () => setPath(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export function navigate(to: string): void {
  window.location.hash = to.startsWith('#') ? to : `#${to}`;
}
