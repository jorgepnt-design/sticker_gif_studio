/** Einstellungen: Design, Export-Standards, Datenschutz, Daten löschen */
import { useEffect, useState } from 'react';
import { Moon, Sun, MonitorSmartphone, Trash2, ShieldCheck, Share2, Info } from 'lucide-react';
import { loadSettings, saveSettings, applyTheme, type AppSettings, type ThemeSetting } from '../lib/settings';
import { wipeAllData } from '../lib/db';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

// Chrome/Edge-Installationsdialog abfangen, um einen eigenen Button anzubieten
let deferredInstall: (Event & { prompt?: () => void }) | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e as Event & { prompt?: () => void };
});

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    saveSettings(settings);
    applyTheme(settings.theme);
  }, [settings]);

  const wipe = async () => {
    setConfirmWipe(false);
    await wipeAllData();
    toast('Alle lokalen Daten wurden gelöscht', 'success');
    setTimeout(() => window.location.reload(), 800);
  };

  const themeOptions: { value: ThemeSetting; label: string; icon: typeof Sun }[] = [
    { value: 'system', label: 'System', icon: MonitorSmartphone },
    { value: 'light', label: 'Hell', icon: Sun },
    { value: 'dark', label: 'Dunkel', icon: Moon },
  ];

  return (
    <div className="page-in px-4 pt-6 safe-top">
      <h1 className="mb-4 text-2xl font-extrabold">Einstellungen</h1>

      {/* Design */}
      <section className="mb-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
        <h2 className="mb-3 font-bold">Design</h2>
        <div className="flex gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setSettings((s) => ({ ...s, theme: value }))}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 py-3 text-sm font-semibold transition ${
                settings.theme === value
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Export-Standards */}
      <section className="mb-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
        <h2 className="mb-3 font-bold">Export</h2>
        <label className="mb-1 block text-sm text-slate-500 dark:text-slate-400">Standard-Format</label>
        <div className="mb-4 flex gap-2">
          {(['webp', 'png'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSettings((s) => ({ ...s, format: f }))}
              className={`flex-1 rounded-2xl border-2 py-2.5 text-sm font-bold uppercase ${
                settings.format === f
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <label className="mb-1 block text-sm text-slate-500 dark:text-slate-400">
          Qualität: {Math.round(settings.quality * 100)} %
        </label>
        <input
          type="range"
          min={30}
          max={100}
          value={Math.round(settings.quality * 100)}
          onChange={(e) => setSettings((s) => ({ ...s, quality: Number(e.target.value) / 100 }))}
        />
        <p className="mt-1 text-xs text-slate-400">
          WebP wird für WhatsApp-Sticker empfohlen (kleinere Dateien).
        </p>
      </section>

      {/* App installieren */}
      <section className="mb-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
        <h2 className="mb-2 flex items-center gap-2 font-bold">
          <Share2 className="h-5 w-5 text-teal-500" /> Als App installieren
        </h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Installiere das Studio auf dem Startbildschirm – dann funktioniert es wie eine normale App, auch offline.
        </p>
        {deferredInstall ? (
          <button
            onClick={() => deferredInstall?.prompt?.()}
            className="w-full rounded-2xl bg-teal-500 py-3 font-semibold text-white active:scale-95"
          >
            Jetzt installieren
          </button>
        ) : (
          <p className="text-xs text-slate-400">
            <strong>iPhone:</strong> Teilen-Symbol → „Zum Home-Bildschirm“. <strong>Android:</strong> Browser-Menü →
            „App installieren“.
          </p>
        )}
      </section>

      {/* Datenschutz */}
      <section className="mb-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
        <h2 className="mb-2 flex items-center gap-2 font-bold">
          <ShieldCheck className="h-5 w-5 text-emerald-500" /> Datenschutz
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Alle Bilder werden ausschließlich lokal in deinem Browser verarbeitet. Es findet kein Upload und keine
          Weitergabe an externe Dienste statt.
        </p>
        <button onClick={() => setShowPrivacy(true)} className="mt-2 text-sm font-semibold text-emerald-600">
          Datenschutzerklärung anzeigen
        </button>
      </section>

      {/* Daten löschen */}
      <section className="mb-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
        <h2 className="mb-2 font-bold">Lokale Daten</h2>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Löscht alle gespeicherten Projekte, Einstellungen und zwischengespeicherten Dateien von diesem Gerät.
        </p>
        <button
          onClick={() => setConfirmWipe(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3 font-semibold text-red-500 active:scale-95 dark:bg-red-900/30"
        >
          <Trash2 className="h-5 w-5" /> Alle Daten löschen
        </button>
      </section>

      <p className="mb-4 flex items-center justify-center gap-1 text-xs text-slate-400">
        <Info className="h-3.5 w-3.5" /> Sticker &amp; GIF Studio · Version 0.1 (Phase 1)
      </p>

      <Modal
        open={confirmWipe}
        title="Wirklich alles löschen?"
        confirmLabel="Alles löschen"
        danger
        onConfirm={wipe}
        onClose={() => setConfirmWipe(false)}
      >
        Alle Projekte und Einstellungen werden unwiderruflich von diesem Gerät entfernt.
      </Modal>

      <Modal
        open={showPrivacy}
        title="Datenschutzerklärung"
        confirmLabel="Verstanden"
        onConfirm={() => setShowPrivacy(false)}
        onClose={() => setShowPrivacy(false)}
      >
        <div className="max-h-64 space-y-2 overflow-y-auto text-left">
          <p>
            <strong>Lokale Verarbeitung:</strong> Sämtliche Bilder, Texte und Projekte werden ausschließlich auf deinem
            Gerät (im Browser-Speicher, IndexedDB) verarbeitet und gespeichert.
          </p>
          <p>
            <strong>Kein Upload:</strong> Diese App sendet keine Dateien oder personenbezogenen Daten an Server oder
            Drittanbieter. Es gibt keine Analyse- oder Tracking-Dienste.
          </p>
          <p>
            <strong>Teilen:</strong> Wenn du die Teilen-Funktion nutzt, übergibst du die Datei aktiv an eine von dir
            gewählte App (z. B. WhatsApp). Erst dadurch verlässt sie dein Gerät.
          </p>
          <p>
            <strong>Löschen:</strong> Über „Alle Daten löschen“ kannst du jederzeit sämtliche lokal gespeicherten Daten
            entfernen.
          </p>
        </div>
      </Modal>
    </div>
  );
}
