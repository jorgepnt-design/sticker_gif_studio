/** App-Einstellungen in localStorage (kein Konto nötig) */

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: ThemeSetting;
  format: 'webp' | 'png';
  quality: number; // 0.3–1
}

const KEY = 'sgs-settings';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { theme: 'system', format: 'webp', quality: 0.9, ...JSON.parse(raw) };
  } catch {
    /* defekte Daten ignorieren */
  }
  return { theme: 'system', format: 'webp', quality: 0.9 };
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

/** Wendet das Theme auf das <html>-Element an */
export function applyTheme(theme: ThemeSetting): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}
