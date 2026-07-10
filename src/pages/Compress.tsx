/** Bild-Komprimierer: mehrere Bilder auswählen, Qualität einstellen, herunterladen */
import { useRef, useState } from 'react';
import { ArrowLeft, Download, ImageDown, Loader2 } from 'lucide-react';
import { loadImageToCanvas, encodeCanvas, createCanvas, ctx2d, MAX_FILE_BYTES } from '../lib/imaging';
import { downloadBlob, formatBytes } from '../lib/share';
import { navigate } from '../lib/router';
import { useToast } from '../components/Toast';

interface Item {
  name: string;
  originalSize: number;
  blob: Blob;
  url: string;
  newSize: number;
}

export function CompressPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<File[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [quality, setQuality] = useState(70);
  const [format, setFormat] = useState<'jpeg' | 'webp'>('jpeg');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  /** Alle gewählten Dateien mit aktuellen Einstellungen (neu) kodieren */
  const process = async (files: File[], q: number, fmt: 'jpeg' | 'webp') => {
    setBusy(true);
    const result: Item[] = [];
    try {
      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) {
          toast(`„${file.name}“ ist zu groß (max. 25 MB)`, 'error');
          continue;
        }
        const canvas = await loadImageToCanvas(file);
        // JPEG hat keine Transparenz → weißen Hintergrund unterlegen
        const flat = createCanvas(canvas.width, canvas.height);
        const ctx = ctx2d(flat);
        if (fmt === 'jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, flat.width, flat.height);
        }
        ctx.drawImage(canvas, 0, 0);
        const blob = await encodeCanvas(flat, fmt, q / 100);
        const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
        result.push({
          name: file.name.replace(/\.[^.]+$/, '') + `-klein.${ext}`,
          originalSize: file.size,
          blob,
          url: URL.createObjectURL(blob),
          newSize: blob.size,
        });
      }
      setItems((old) => {
        old.forEach((i) => URL.revokeObjectURL(i.url));
        return result;
      });
    } catch {
      toast('Ein Bild konnte nicht verarbeitet werden', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onPick = (list: FileList | null) => {
    if (!list?.length) return;
    filesRef.current = Array.from(list);
    void process(filesRef.current, quality, format);
  };

  const reprocess = (q: number, fmt: 'jpeg' | 'webp') => {
    setQuality(q);
    setFormat(fmt);
    if (filesRef.current.length) void process(filesRef.current, q, fmt);
  };

  const totalOld = items.reduce((s, i) => s + i.originalSize, 0);
  const totalNew = items.reduce((s, i) => s + i.newSize, 0);

  return (
    <div className="page-in px-4 pt-6 safe-top">
      <button onClick={() => navigate('/')} className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-500">
        <ArrowLeft className="h-4 w-4" /> Zurück
      </button>
      <h1 className="mb-4 text-2xl font-extrabold">Bild komprimieren</h1>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => onPick(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="mb-4 flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 py-8 text-emerald-600 active:scale-[0.98] dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
      >
        <ImageDown className="h-10 w-10" />
        <span className="font-bold">Bilder auswählen</span>
        <span className="text-xs opacity-70">Mehrfachauswahl möglich</span>
      </button>

      {/* Einstellungen */}
      <div className="mb-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
        <label className="mb-1 block text-sm font-semibold">Qualität: {quality} %</label>
        <input
          type="range"
          min={20}
          max={95}
          value={quality}
          onChange={(e) => reprocess(Number(e.target.value), format)}
        />
        <div className="mt-3 flex gap-2">
          {(['jpeg', 'webp'] as const).map((f) => (
            <button
              key={f}
              onClick={() => reprocess(quality, f)}
              className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold uppercase ${
                format === f
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-slate-200 text-slate-400 dark:border-slate-600'
              }`}
            >
              {f === 'jpeg' ? 'JPG' : 'WebP'}
            </button>
          ))}
        </div>
      </div>

      {busy && (
        <div className="flex items-center justify-center gap-2 py-6 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Verarbeite Bilder …
        </div>
      )}

      {/* Ergebnisliste */}
      {!busy && items.length > 0 && (
        <>
          <div className="mb-3 rounded-2xl bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            Gesamt: {formatBytes(totalOld)} → {formatBytes(totalNew)} (−
            {totalOld > 0 ? Math.max(0, Math.round((1 - totalNew / totalOld) * 100)) : 0} %)
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700"
              >
                <img src={item.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{item.name}</div>
                  <div className="text-xs text-slate-400">
                    {formatBytes(item.originalSize)} → {formatBytes(item.newSize)}
                  </div>
                </div>
                <button
                  onClick={() => downloadBlob(item.blob, item.name)}
                  className="rounded-xl bg-emerald-500 p-2.5 text-white active:scale-95"
                  aria-label={`${item.name} herunterladen`}
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
          {items.length > 1 && (
            <button
              onClick={() => items.forEach((i, n) => setTimeout(() => downloadBlob(i.blob, i.name), n * 400))}
              className="mt-3 w-full rounded-2xl bg-emerald-500 py-3 font-semibold text-white active:scale-95"
            >
              Alle herunterladen ({items.length})
            </button>
          )}
        </>
      )}
    </div>
  );
}
