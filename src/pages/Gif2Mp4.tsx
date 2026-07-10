/**
 * GIF→Video-Konverter: zerlegt ein GIF in Frames und nimmt sie über
 * MediaRecorder (Canvas-Stream) als MP4 bzw. WebM auf – komplett lokal.
 */
import { useRef, useState } from 'react';
import { ArrowLeft, Film, Download, Share2, Loader2, Info } from 'lucide-react';
import { navigate } from '../lib/router';
import { useToast } from '../components/Toast';
import { decodeGifFrames, type RawFrame } from '../lib/gif';
import { createCanvas, ctx2d } from '../lib/imaging';
import { shareOrDownload, downloadBlob, formatBytes } from '../lib/share';
import { COLORS } from './editor/EditorPanels';

/** Bestes vom Browser unterstütztes Aufnahmeformat ermitteln (MP4 bevorzugt) */
function pickMimeType(): string | null {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

export function Gif2Mp4Page() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [frames, setFrames] = useState<RawFrame[] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [bg, setBg] = useState('#ffffff');
  const [scale, setScale] = useState(1);
  const [loops, setLoops] = useState(2);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string; ext: string } | null>(null);

  const pick = async (file: File) => {
    setResult(null);
    setProgress(null);
    try {
      const f = await decodeGifFrames(file);
      setFrames(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
    } catch {
      toast('GIF konnte nicht gelesen werden', 'error');
    }
  };

  const convert = async () => {
    if (!frames?.length) return;
    const mime = pickMimeType();
    if (!mime) {
      toast('Dein Browser unterstützt keine Videoaufnahme', 'error');
      return;
    }
    setProgress(0);
    try {
      const w = Math.round((frames[0].canvas.width * scale) / 2) * 2;
      const h = Math.round((frames[0].canvas.height * scale) / 2) * 2;
      const canvas = createCanvas(w, h);
      const ctx = ctx2d(canvas);
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

      const drawFrame = (f: RawFrame) => {
        ctx.fillStyle = bg; // GIF-Transparenz mit gewählter Hintergrundfarbe füllen
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(f.canvas, 0, 0, w, h);
      };

      drawFrame(frames[0]);
      recorder.start();

      // Frames in Echtzeit abspielen und dabei aufnehmen
      const total = frames.length * loops;
      let done = 0;
      for (let l = 0; l < loops; l++) {
        for (const f of frames) {
          drawFrame(f);
          await new Promise((r) => setTimeout(r, f.delay));
          done++;
          setProgress(done / total);
        }
      }
      recorder.stop();
      await stopped;

      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      if (result) URL.revokeObjectURL(result.url);
      setResult({ blob, url: URL.createObjectURL(blob), ext });
      if (ext === 'webm') {
        toast('Dein Browser kann kein MP4 aufnehmen – WebM wurde erstellt', 'info');
      }
    } catch {
      toast('Umwandlung fehlgeschlagen', 'error');
    } finally {
      setProgress(null);
    }
  };

  const duration = frames ? ((frames.reduce((s, f) => s + f.delay, 0) * loops) / 1000).toFixed(1) : '0';

  return (
    <div className="page-in px-4 pt-6 safe-top">
      <button onClick={() => navigate('/create')} className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-500">
        <ArrowLeft className="h-4 w-4" /> Zurück
      </button>
      <h1 className="mb-4 text-2xl font-extrabold">GIF in Video umwandeln</h1>

      <input ref={inputRef} type="file" accept="image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ''; }} />

      {!frames && (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-violet-300 bg-violet-50/50 py-10 text-violet-600 active:scale-[0.98] dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-400"
        >
          <Film className="h-10 w-10" />
          <span className="font-bold">GIF-Datei auswählen</span>
        </button>
      )}

      {frames && (
        <>
          <div className="checkerboard mx-auto mb-4 w-fit max-w-full overflow-hidden rounded-2xl shadow">
            {previewUrl && <img src={previewUrl} alt="GIF-Vorschau" className="block max-h-[30dvh] w-auto max-w-full" />}
          </div>

          <div className="mb-4 space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Hintergrundfarbe (füllt transparente Bereiche)
              </span>
              <div className="flex flex-wrap gap-2">
                {COLORS.slice(0, 8).map((c) => (
                  <button
                    key={c}
                    onClick={() => setBg(c)}
                    className={`h-8 w-8 rounded-full border-2 ${bg === c ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-slate-200 dark:border-slate-600'}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Hintergrund ${c}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Auflösung</span>
              <div className="flex gap-2">
                {[1, 0.5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold ${scale === s ? 'border-emerald-500 text-emerald-600' : 'border-slate-200 text-slate-400 dark:border-slate-600'}`}
                  >
                    {s === 1 ? `Original (${frames[0].canvas.width}px)` : `Klein (${Math.round(frames[0].canvas.width / 2)}px)`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Wiederholungen (Videolänge: ca. {duration} s)
              </span>
              <div className="flex gap-2">
                {[1, 2, 3].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLoops(l)}
                    className={`rounded-xl border-2 px-4 py-2 text-sm font-semibold ${loops === l ? 'border-emerald-500 text-emerald-600' : 'border-slate-200 text-slate-400 dark:border-slate-600'}`}
                  >
                    {l}×
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => void convert()}
              disabled={progress !== null}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 font-bold text-white shadow-lg active:scale-95 disabled:opacity-60"
            >
              {progress !== null ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Nimmt auf … {Math.round(progress * 100)} %
                </>
              ) : (
                'In Video umwandeln'
              )}
            </button>
            <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Die Aufnahme läuft in Echtzeit – ein 3-Sekunden-GIF mit 2 Wiederholungen dauert ca. 6 Sekunden.
            </p>
          </div>

          <button onClick={() => inputRef.current?.click()} className="mb-4 w-full rounded-2xl bg-slate-200 py-2.5 text-sm font-semibold text-slate-600 active:scale-95 dark:bg-slate-700 dark:text-slate-300">
            Anderes GIF wählen
          </button>
        </>
      )}

      {result && (
        <div className="mb-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
          <video src={result.url} controls loop autoPlay muted playsInline className="mb-3 w-full rounded-2xl" />
          <div className="mb-3 text-center text-sm font-semibold text-slate-500">
            {result.ext.toUpperCase()} · {formatBytes(result.blob.size)}
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                const shared = await shareOrDownload(result.blob, `video-${Date.now()}.${result.ext}`, 'Mein Video');
                toast(shared ? 'Teilen geöffnet' : 'Video heruntergeladen', 'success');
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 font-bold text-white active:scale-95"
            >
              <Share2 className="h-5 w-5" /> Teilen
            </button>
            <button
              onClick={() => {
                downloadBlob(result.blob, `video-${Date.now()}.${result.ext}`);
                toast('Video heruntergeladen', 'success');
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-500 py-3 font-bold text-white active:scale-95"
            >
              <Download className="h-5 w-5" /> Speichern
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
