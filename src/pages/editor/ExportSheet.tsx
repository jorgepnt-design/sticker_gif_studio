/** Export-Sheet: Format & Qualität wählen, Größe prüfen, teilen oder herunterladen */
import { useEffect, useState } from 'react';
import { X, Share2, Download, Loader2, AlertTriangle, CheckCircle2, Library } from 'lucide-react';
import type { EditorDoc } from '../../lib/types';
import { exportSticker, uid } from '../../lib/imaging';
import { shareOrDownload, downloadBlob, formatBytes } from '../../lib/share';
import { loadSettings } from '../../lib/settings';
import { saveSticker } from '../../lib/db';
import { useToast } from '../../components/Toast';

const WHATSAPP_LIMIT = 100 * 1024;

export function ExportSheet({
  open,
  onClose,
  doc,
  image,
}: {
  open: boolean;
  onClose: () => void;
  doc: EditorDoc;
  image: HTMLCanvasElement | null;
}) {
  const defaults = loadSettings();
  const [format, setFormat] = useState<'webp' | 'png'>(defaults.format);
  const [quality, setQuality] = useState(Math.round(defaults.quality * 100));
  const [optimize, setOptimize] = useState(doc.mode === 'sticker');
  const [result, setResult] = useState<{ blob: Blob; actualFormat: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Vorschau-Export bei jeder Einstellungsänderung neu berechnen
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(() => {
      exportSticker(doc, image, format, quality / 100, optimize)
        .then((r) => {
          if (!cancelled) setResult(r);
        })
        .catch(() => toast('Export fehlgeschlagen', 'error'))
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, format, quality, optimize, doc, image]);

  if (!open) return null;

  const ext = result?.actualFormat === 'webp' ? 'webp' : 'png';
  const filename = `sticker-studio-${Date.now()}.${ext}`;
  const tooBig = result && result.blob.size > WHATSAPP_LIMIT;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="page-in max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 safe-bottom dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Exportieren</h2>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 dark:bg-slate-700" aria-label="Schließen">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Größen-Anzeige */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/50">
          {busy || !result ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              <span className="text-sm text-slate-500">Berechne Dateigröße …</span>
            </>
          ) : (
            <>
              {tooBig && doc.mode === 'sticker' ? (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              )}
              <div className="text-sm">
                <div className="font-bold">
                  512 × 512 · {result.actualFormat.toUpperCase()} · {formatBytes(result.blob.size)}
                </div>
                {doc.mode === 'sticker' && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {tooBig
                      ? 'Über 100 KB – für WhatsApp „Optimieren“ aktivieren oder Qualität senken.'
                      : 'Erfüllt die WhatsApp-Sticker-Anforderungen (max. 100 KB).'}
                  </div>
                )}
                {format === 'webp' && result.actualFormat === 'png' && (
                  <div className="text-xs text-amber-600">
                    Dein Browser unterstützt kein WebP – es wurde PNG erstellt.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Format */}
        <div className="mb-3 flex gap-2">
          {(['webp', 'png'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 rounded-2xl border-2 py-2.5 text-sm font-bold uppercase ${
                format === f
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30'
                  : 'border-slate-200 text-slate-400 dark:border-slate-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {format === 'webp' && (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              Qualität: {quality} %
            </label>
            <input type="range" min={30} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
          </div>
        )}

        <label className="mb-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <span className="text-sm font-semibold">Für WhatsApp optimieren (&lt; 100 KB)</span>
          <input
            type="checkbox"
            checked={optimize}
            onChange={(e) => setOptimize(e.target.checked)}
            className="h-6 w-6 accent-emerald-500"
          />
        </label>

        {/* Aktionen */}
        <div className="mb-4 flex gap-3">
          <button
            disabled={!result || busy}
            onClick={async () => {
              if (!result) return;
              const shared = await shareOrDownload(result.blob, filename, 'Mein Sticker');
              toast(shared ? 'Teilen geöffnet' : 'Sticker heruntergeladen', 'success');
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 font-bold text-white shadow-lg active:scale-95 disabled:opacity-50"
          >
            <Share2 className="h-5 w-5" /> Teilen
          </button>
          <button
            disabled={!result || busy}
            onClick={() => {
              if (!result) return;
              downloadBlob(result.blob, filename);
              toast('Sticker heruntergeladen', 'success');
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-500 py-3.5 font-bold text-white shadow-lg active:scale-95 disabled:opacity-50"
          >
            <Download className="h-5 w-5" /> Speichern
          </button>
        </div>

        {/* In der Sticker-Bibliothek ablegen (für Stickerpakete) */}
        <button
          disabled={!result || busy}
          onClick={async () => {
            if (!result) return;
            try {
              await saveSticker({
                id: uid(),
                name: `Sticker vom ${new Date().toLocaleDateString('de-DE')}`,
                blob: result.blob,
                favorite: false,
                category: 'Allgemein',
                createdAt: Date.now(),
                lastUsedAt: Date.now(),
              });
              toast('In Bibliothek gespeichert – dort kannst du Pakete erstellen', 'success');
            } catch {
              toast('Speichern fehlgeschlagen', 'error');
            }
          }}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 font-semibold text-slate-700 active:scale-95 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200"
        >
          <Library className="h-5 w-5" /> In Bibliothek speichern
        </button>

        {/* Anleitung für WhatsApp */}
        <div className="rounded-2xl bg-teal-50 p-4 text-xs leading-relaxed text-teal-900 dark:bg-teal-900/30 dark:text-teal-200">
          <strong>So nutzt du den Sticker in WhatsApp:</strong>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            <li>Sticker über „Teilen“ direkt an einen Chat senden – oder herunterladen.</li>
            <li>
              Für ein echtes Sticker-Paket: Datei in einer Sticker-Import-App (z. B. „Sticker Maker“) hinzufügen und
              das Paket zu WhatsApp exportieren.
            </li>
            <li>Web-Apps dürfen Sticker leider nicht direkt in WhatsApp installieren – das erlaubt WhatsApp nur nativen Apps.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
