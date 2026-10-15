/** Gemeinsame Bausteine der Werkzeugseiten */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Download, Share2, Loader2, FilePlus2 } from 'lucide-react';
import { navigate } from '../lib/router';
import { canShareFiles, downloadBlob, shareBlob } from '../lib/share';
import { formatBytes, renderPage, type PdfJsDoc } from '../lib/pdf';

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/90 backdrop-blur-lg safe-top dark:border-slate-700/60 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5">
        <button
          onClick={() => navigate('/')}
          className="rounded-full p-2 text-slate-600 active:scale-90 dark:text-slate-300"
          aria-label="Zurück"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

/** Großer Auswahl-Button; öffnet die Dateiauswahl des Geräts */
export function FilePicker({
  accept,
  multiple,
  label,
  hint,
  onFiles,
  compact,
}: {
  accept: string;
  multiple?: boolean;
  label: string;
  hint?: string;
  onFiles: (files: File[]) => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const input = (
    <input
      ref={ref}
      type="file"
      accept={accept}
      multiple={multiple}
      className="hidden"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (files.length) onFiles(files);
      }}
    />
  );
  if (compact) {
    return (
      <>
        {input}
        <button
          onClick={() => ref.current?.click()}
          className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
        >
          <FilePlus2 className="h-4 w-4" /> {label}
        </button>
      </>
    );
  }
  return (
    <>
      {input}
      <button
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length) onFiles(multiple ? files : files.slice(0, 1));
        }}
        className={`flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors active:scale-[0.99] ${
          over
            ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30'
            : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
        }`}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/30">
          <FilePlus2 className="h-7 w-7" />
        </span>
        <span className="text-base font-bold">{label}</span>
        {hint && <span className="text-sm text-slate-500 dark:text-slate-400">{hint}</span>}
      </button>
    </>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  busy,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 py-3.5 font-bold text-white shadow-lg shadow-rose-500/25 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
    >
      {busy && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}

/** Fertige Datei: Größe anzeigen, speichern oder teilen */
export function ResultCard({ blob, filename, note }: { blob: Blob; filename: string; note?: string }) {
  const [canShare] = useState(canShareFiles);
  return (
    <div className="page-in rounded-3xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
      <p className="font-bold text-emerald-800 dark:text-emerald-300">Fertig!</p>
      <p className="mt-0.5 break-all text-sm text-emerald-700 dark:text-emerald-400">
        {filename} · {formatBytes(blob.size)}
      </p>
      {note && <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">{note}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => downloadBlob(blob, filename)}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 font-semibold text-white active:scale-95"
        >
          <Download className="h-5 w-5" /> Speichern
        </button>
        {canShare && (
          <button
            onClick={() => shareBlob(blob, filename)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-3 font-semibold text-emerald-700 active:scale-95 dark:bg-slate-800 dark:text-emerald-300"
          >
            <Share2 className="h-5 w-5" /> Teilen
          </button>
        )}
      </div>
    </div>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span>{Math.round(value * 100)} %</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className="h-full rounded-full bg-rose-500 transition-[width]" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

/** Segmentierte Auswahl (z. B. Format, Qualität) */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition-colors ${
            o.value === value
              ? 'bg-white text-rose-600 shadow-sm dark:bg-slate-700 dark:text-rose-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      {children}
    </div>
  );
}

/** Seitenvorschau, die erst gerendert wird, wenn sie in den sichtbaren Bereich kommt */
export function PageThumb({
  doc,
  pageNumber,
  width,
  rotation = 0,
}: {
  doc: PdfJsDoc;
  pageNumber: number;
  width: number;
  rotation?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [aspect, setAspect] = useState(1.414);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), {
      rootMargin: '300px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    let cancelled = false;
    const canvas = canvasRef.current;
    renderPage(doc, pageNumber, canvas, width, rotation)
      .then(() => {
        if (!cancelled) setAspect(canvas.height / canvas.width);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, doc, pageNumber, width, rotation]);

  return (
    <div ref={boxRef} className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" style={{ width, minHeight: width * aspect }}>
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
