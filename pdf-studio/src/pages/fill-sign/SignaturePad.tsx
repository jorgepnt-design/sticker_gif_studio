/** Unterschrift oder Initialen zeichnen bzw. tippen; Ergebnis ist ein zugeschnittenes PNG */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Eraser, X } from 'lucide-react';
import { Segmented } from '../../components/ui';

const STORAGE_KEY = { signature: 'pdfstudio.signature', initials: 'pdfstudio.initials' } as const;
export type SignatureKind = keyof typeof STORAGE_KEY;

export function loadSignature(kind: SignatureKind): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY[kind]);
  } catch {
    return null;
  }
}

function storeSignature(kind: SignatureKind, dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(STORAGE_KEY[kind], dataUrl);
    else localStorage.removeItem(STORAGE_KEY[kind]);
  } catch {
    /* privater Modus – dann eben nur für diese Sitzung */
  }
}

export function deleteSignature(kind: SignatureKind) {
  storeSignature(kind, null);
}

/** Schneidet transparente Ränder ab und liefert eine PNG-Data-URL */
function trimCanvas(src: HTMLCanvasElement): string | null {
  const ctx = src.getContext('2d')!;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

const INK = ['#111827', '#1d4ed8'];

export function SignaturePad({
  kind,
  onDone,
  onClose,
}: {
  kind: SignatureKind;
  onDone: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [ink, setInk] = useState(INK[0]);
  const [typed, setTyped] = useState('');
  const [hasInk, setHasInk] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const title = kind === 'signature' ? 'Unterschrift' : 'Initialen';

  // Canvas in Gerätepixeln anlegen (scharfe Linien)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    setHasInk(false);
  }, [mode]);

  // Getippte Unterschrift live in das Canvas zeichnen
  useEffect(() => {
    if (mode !== 'type') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!typed.trim()) return setHasInk(false);
    let size = rect.height * 0.55;
    const family = getComputedStyle(document.querySelector('.font-signature') ?? document.body).fontFamily;
    ctx.font = `${size}px ${family}`;
    while (ctx.measureText(typed).width > rect.width * 0.92 && size > 12) {
      size -= 2;
      ctx.font = `${size}px ${family}`;
    }
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typed, rect.width / 2, rect.height / 2);
    setHasInk(true);
  }, [typed, ink, mode]);

  const point = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = point(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.4, 0, Math.PI * 2);
    ctx.fill();
    setHasInk(true);
  };

  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw' || !last.current) return;
    const ctx = e.currentTarget.getContext('2d')!;
    // Zwischenpunkte (coalesced) für flüssige Linien auf schnellen Geräten nutzen
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const rect = e.currentTarget.getBoundingClientRect();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const ev of events) {
      const p = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last.current = p;
    }
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setTyped('');
    setHasInk(false);
  };

  const done = () => {
    const url = trimCanvas(canvasRef.current!);
    if (!url) return;
    storeSignature(kind, url);
    onDone(url);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="page-in w-full max-w-lg rounded-t-3xl bg-white p-5 safe-bottom dark:bg-slate-800 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title} erstellen</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500" aria-label="Schließen">
            <X className="h-5 w-5" />
          </button>
        </div>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setTyped('');
          }}
          options={[
            { value: 'draw', label: 'Zeichnen' },
            { value: 'type', label: 'Tippen' },
          ]}
        />
        {mode === 'type' && (
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={kind === 'signature' ? 'Vor- und Nachname' : 'z. B. J. P.'}
            autoFocus
            className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-base outline-none focus:border-rose-400 dark:border-slate-600 dark:bg-slate-700"
          />
        )}
        <div className="relative mt-3">
          <canvas
            ref={canvasRef}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={() => (last.current = null)}
            onPointerCancel={() => (last.current = null)}
            className={`no-select block w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white dark:border-slate-600 ${
              kind === 'signature' ? 'h-44' : 'h-32'
            }`}
          />
          <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-slate-300" />
          {mode === 'draw' && !hasInk && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              Hier mit dem Finger {kind === 'signature' ? 'unterschreiben' : 'Initialen zeichnen'}
            </span>
          )}
        </div>
        {/* Unsichtbares Element, um die Signatur-Schriftfamilie auszulesen */}
        <span className="font-signature hidden" />
        <div className="mt-3 flex items-center gap-2">
          {INK.map((c) => (
            <button
              key={c}
              onClick={() => setInk(c)}
              className={`h-8 w-8 rounded-full ring-offset-2 dark:ring-offset-slate-800 ${ink === c ? 'ring-2 ring-rose-500' : ''}`}
              style={{ background: c }}
              aria-label="Tintenfarbe"
            />
          ))}
          <button onClick={clear} className="ml-auto flex items-center gap-1 text-sm font-semibold text-slate-500">
            <Eraser className="h-4 w-4" /> Löschen
          </button>
        </div>
        <button
          onClick={done}
          disabled={!hasInk}
          className="mt-4 w-full rounded-2xl bg-rose-500 py-3.5 font-bold text-white active:scale-[0.98] disabled:opacity-40"
        >
          {title} übernehmen
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">Wird nur auf diesem Gerät gespeichert.</p>
      </div>
    </div>
  );
}
