/**
 * GIF-Studio: erstellt GIFs und animierte Sticker aus Videos, GIF-Dateien
 * oder Bilderserien. Trimmen, Richtung, Geschwindigkeit, Zuschnitt, Text,
 * Qualität – Kodierung läuft im Web Worker.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Film, Image as ImageIcon, Clapperboard, Loader2, X, Share2,
  Download, Type as TypeIcon, Trash2, Library, RefreshCcw, AlertTriangle, CheckCircle2, Video,
} from 'lucide-react';
import { navigate } from '../lib/router';
import { useToast } from '../components/Toast';
import { Modal, InputModal } from '../components/Modal';
import { COLORS } from './editor/EditorPanels';
import {
  type RawFrame, type Direction, loadVideo, grabVideoFrame, extractVideoFrames,
  decodeGifFrames, loadImageFrames, buildSequence, encodeGif, targetDims, drawCover,
  ASPECTS, MAX_VIDEO_BYTES,
} from '../lib/gif';
import { recordSequenceToVideo, WHATSAPP_GIF_MAX_SECONDS } from '../lib/video';
import { ctx2d, autoRemoveBackground, drawTextLayer, uid } from '../lib/imaging';
import { saveSticker } from '../lib/db';
import { shareOrDownload, downloadBlob, formatBytes } from '../lib/share';
import { FONTS } from '../lib/templates';
import type { TextLayer } from '../lib/types';

/** Text auf dem GIF – Position/Größe relativ (0..1), damit Zuschnitt-Wechsel funktioniert */
interface GifText {
  text: string;
  rx: number;
  ry: number;
  sizeFrac: number;
  color: string;
  strokeColor: string;
}

const WHATSAPP_ANIM_LIMIT = 500 * 1024;

function toTextLayer(t: GifText, w: number, h: number): TextLayer {
  return {
    id: 'gif-text', kind: 'text', text: t.text,
    x: t.rx * w, y: t.ry * h, size: Math.max(10, t.sizeFrac * w),
    rotation: 0, font: FONTS[1].value, color: t.color, strokeColor: t.strokeColor, strokeWidth: 14,
  };
}

export function GifStudioPage({ params }: { params: URLSearchParams }) {
  const mode: 'gif' | 'anim' = params.get('mode') === 'anim' ? 'anim' : 'gif';
  const toast = useToast();

  const [step, setStep] = useState<'pick' | 'trim' | 'edit' | 'result'>('pick');
  const [frames, setFrames] = useState<RawFrame[] | null>(null);

  // Video-Trimmen
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDur, setVideoDur] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [fps, setFps] = useState(12);

  // Bearbeitungs-Einstellungen
  const [direction, setDirection] = useState<Direction>('forward');
  const [speed, setSpeed] = useState(100);
  const [aspect, setAspect] = useState(mode === 'anim' ? '1:1' : 'orig');
  const [size, setSize] = useState(mode === 'anim' ? 512 : 480);
  const [colors, setColors] = useState(256);
  const [removeBg, setRemoveBg] = useState(false);
  const [tolerance, setTolerance] = useState(30);
  const [frameSkip, setFrameSkip] = useState(1);
  const [text, setText] = useState<GifText | null>(null);
  const [textModal, setTextModal] = useState(false);

  const [busy, setBusy] = useState<{ label: string; progress: number | null } | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null);
  const [confirmBack, setConfirmBack] = useState(false);
  const [showWaGif, setShowWaGif] = useState(false);
  // Datei, die sich nicht nativ öffnen ließ → Angebot „Alles-Konverter“
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const trimPreviewRef = useRef<HTMLCanvasElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const gifInput = useRef<HTMLInputElement>(null);
  const imagesInput = useRef<HTMLInputElement>(null);

  const title = mode === 'anim' ? 'Animierter Sticker' : 'GIF erstellen';

  /* ---------- Quellen laden ---------- */

  /** Geladenes Video übernehmen und zum Trim-Schritt wechseln. */
  const useLoadedVideo = (video: HTMLVideoElement) => {
    videoRef.current = video;
    const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 60;
    setVideoDur(dur);
    setTrimStart(0);
    setTrimEnd(Math.min(dur, mode === 'anim' ? 6 : 10));
    if (mode === 'anim' && dur > 10) {
      toast('Für WhatsApp sollten animierte Sticker kurz sein – wähle einen Ausschnitt.', 'info');
    }
    setStep('trim');
  };

  const pickVideo = async (file: File) => {
    if (file.size > MAX_VIDEO_BYTES) {
      toast('Video ist zu groß (max. 120 MB)', 'error');
      return;
    }
    setBusy({ label: 'Video wird geladen …', progress: null });
    try {
      const video = await loadVideo(file, (label) => setBusy({ label, progress: null }));
      setBusy(null);
      useLoadedVideo(video);
    } catch {
      // Nativ nicht lesbar → Alles-Konverter anbieten (ffmpeg im Browser)
      setBusy(null);
      setConvertFile(file);
    }
  };

  /**
   * Fallback: Video mit ffmpeg.wasm in ein kompatibles MP4 umwandeln und dann
   * regulär laden. Funktioniert mit praktisch jedem Videoformat.
   */
  const convertAndLoad = async (file: File) => {
    setConvertFile(null);
    try {
      // ffmpeg erst hier laden (Code-Splitting) – hält das Start-Bundle klein
      const { transcodeToMp4, isFfmpegReady } = await import('../lib/ffmpeg');
      if (!isFfmpegReady()) {
        setBusy({ label: 'Konverter wird geladen … (einmalig ~31 MB)', progress: null });
      }
      setBusy({ label: 'Video wird umgewandelt …', progress: 0 });
      const mp4 = await transcodeToMp4(
        file,
        { maxSeconds: 30, maxDim: 720, fps: 24 },
        (r) => setBusy({ label: 'Video wird umgewandelt …', progress: r }),
      );
      setBusy({ label: 'Video wird geladen …', progress: null });
      const video = await loadVideo(mp4, (label) => setBusy({ label, progress: null }));
      setBusy(null);
      useLoadedVideo(video);
      toast('Video umgewandelt – es werden bis zu 30 Sekunden verwendet', 'info');
    } catch {
      setBusy(null);
      toast('Umwandlung fehlgeschlagen. Bitte ein anderes Video versuchen.', 'error');
    }
  };

  const pickGif = async (file: File) => {
    setBusy({ label: 'GIF wird gelesen …', progress: null });
    try {
      const f = await decodeGifFrames(file);
      setFrames(f);
      setStep('edit');
    } catch {
      toast('GIF konnte nicht gelesen werden', 'error');
    } finally {
      setBusy(null);
    }
  };

  const pickImages = async (files: File[]) => {
    if (files.length < 2) {
      toast('Bitte mindestens 2 Bilder auswählen', 'error');
      return;
    }
    setBusy({ label: 'Bilder werden geladen …', progress: null });
    try {
      setFrames(await loadImageFrames(files));
      setStep('edit');
    } catch {
      toast('Bilder konnten nicht geladen werden', 'error');
    } finally {
      setBusy(null);
    }
  };

  /* ---------- Trim-Vorschau ---------- */
  useEffect(() => {
    if (step !== 'trim' || !videoRef.current) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const frame = await grabVideoFrame(videoRef.current!, trimStart);
        if (!alive || !trimPreviewRef.current) return;
        const c = trimPreviewRef.current;
        c.width = frame.width;
        c.height = frame.height;
        ctx2d(c).drawImage(frame, 0, 0);
      } catch {
        /* Vorschau-Fehler ignorieren */
      }
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [step, trimStart]);

  const extractFromVideo = async () => {
    const video = videoRef.current;
    if (!video) return;
    setBusy({ label: 'Frames werden gelesen …', progress: 0 });
    try {
      const { frames: f, effectiveFps } = await extractVideoFrames(video, trimStart, trimEnd, fps, (v) =>
        setBusy({ label: 'Frames werden gelesen …', progress: v }),
      );
      if (effectiveFps < fps) toast(`Bildrate auf ${effectiveFps} fps reduziert (Frame-Limit)`, 'info');
      if (!f.length) throw new Error('leer');
      setFrames(f);
      setStep('edit');
    } catch {
      toast('Frames konnten nicht gelesen werden', 'error');
    } finally {
      setBusy(null);
    }
  };

  /* ---------- Rendering (Vorschau + Export) ---------- */

  const skipped = (list: RawFrame[]) =>
    frameSkip === 1
      ? list
      : list.filter((_, i) => i % frameSkip === 0).map((f) => ({ canvas: f.canvas, delay: f.delay * frameSkip }));

  const renderFrame = (withBgRemoval: boolean) => (src: HTMLCanvasElement, target: HTMLCanvasElement) => {
    drawCover(src, target);
    if (withBgRemoval) autoRemoveBackground(target, tolerance);
    if (text) drawTextLayer(ctx2d(target), toTextLayer(text, target.width, target.height));
  };

  // Live-Vorschau abspielen
  useEffect(() => {
    if (step !== 'edit' || !frames?.length) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const seq = buildSequence(skipped(frames), direction, speed / 100);
    const dims = targetDims(frames[0].canvas.width, frames[0].canvas.height, aspect, Math.min(size, 480));
    canvas.width = dims.width;
    canvas.height = dims.height;
    const render = renderFrame(false); // Freistellen erst beim Export (Performance)
    let alive = true;
    let idx = 0;
    let timer = 0;
    const tick = () => {
      if (!alive) return;
      const f = seq[idx % seq.length];
      ctx2d(canvas).clearRect(0, 0, canvas.width, canvas.height);
      render(f.canvas, canvas);
      timer = window.setTimeout(() => {
        idx++;
        tick();
      }, f.delay);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, frames, direction, speed, aspect, size, text, frameSkip]);

  // Text auf der Vorschau verschieben
  const dragText = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!text || e.buttons !== 1) return;
    const c = previewRef.current!;
    const r = c.getBoundingClientRect();
    setText({ ...text, rx: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), ry: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
  };

  /* ---------- Export ---------- */

  /** Kodiert das GIF mit konkreten Einstellungen und meldet den Fortschritt. */
  const encodeWith = (
    opts: { colors: number; skip: number; size: number },
    onProgress: (v: number) => void,
  ): { promise: Promise<Blob>; cancel: () => void } => {
    const list =
      opts.skip === 1
        ? frames!
        : frames!.filter((_, i) => i % opts.skip === 0).map((f) => ({ canvas: f.canvas, delay: f.delay * opts.skip }));
    const seq = buildSequence(list, direction, speed / 100);
    const dims = targetDims(frames![0].canvas.width, frames![0].canvas.height, aspect, opts.size);
    return encodeGif(
      seq,
      renderFrame(removeBg),
      { width: dims.width, height: dims.height, transparent: removeBg, maxColors: opts.colors },
      onProgress,
    );
  };

  const doExport = async () => {
    if (!frames?.length) return;
    setBusy({ label: 'GIF wird erstellt …', progress: 0 });
    const handle = encodeWith({ colors, skip: frameSkip, size }, (v) =>
      setBusy({ label: 'GIF wird erstellt …', progress: v }),
    );
    cancelRef.current = handle.cancel;
    try {
      const blob = await handle.promise;
      if (result) URL.revokeObjectURL(result.url);
      setResult({ blob, url: URL.createObjectURL(blob) });
      setStep('result');
    } catch {
      toast('GIF-Erstellung fehlgeschlagen', 'error');
    } finally {
      setBusy(null);
      cancelRef.current = null;
    }
  };

  /**
   * Verkleinert das Ergebnis mit einem Klick unter die WhatsApp-Grenze (~500 KB):
   * probiert stufenweise weniger Farben, geringere Bildrate und kleinere Maße,
   * bis das GIF passt – oder nimmt die kleinstmögliche Variante.
   */
  const optimizeToLimit = async () => {
    if (!frames?.length) return;
    // Stufen von „kaum sichtbarer Verlust“ bis „stark komprimiert“
    const ladder: { colors: number; skip: number; size: number }[] = [
      { colors: 128, skip: 1, size: Math.min(size, 512) },
      { colors: 96, skip: 1, size: 448 },
      { colors: 64, skip: 2, size: 384 },
      { colors: 48, skip: 2, size: 320 },
      { colors: 32, skip: 3, size: 288 },
      { colors: 24, skip: 4, size: 256 },
      { colors: 16, skip: 5, size: 224 },
    ];
    let best: { blob: Blob; step: { colors: number; skip: number; size: number } } | null = null;
    for (let i = 0; i < ladder.length; i++) {
      const step = ladder[i];
      const label = `Optimiere für WhatsApp … (Schritt ${i + 1}/${ladder.length})`;
      setBusy({ label, progress: 0 });
      const handle = encodeWith(step, (v) => setBusy({ label, progress: v }));
      cancelRef.current = handle.cancel;
      let blob: Blob;
      try {
        blob = await handle.promise;
      } catch {
        toast('Optimierung fehlgeschlagen', 'error');
        setBusy(null);
        cancelRef.current = null;
        return;
      }
      best = { blob, step };
      if (blob.size <= WHATSAPP_ANIM_LIMIT) break;
    }
    cancelRef.current = null;
    setBusy(null);
    if (!best) return;
    // Regler an das gewählte Ergebnis angleichen (für „Anpassen“)
    setColors(best.step.colors);
    setFrameSkip(best.step.skip);
    setSize(best.step.size);
    if (result) URL.revokeObjectURL(result.url);
    setResult({ blob: best.blob, url: URL.createObjectURL(best.blob) });
    if (best.blob.size <= WHATSAPP_ANIM_LIMIT) {
      toast(`Fertig: ${formatBytes(best.blob.size)} – passt als WhatsApp-Sticker`, 'success');
    } else {
      toast(
        `Kleinstmöglich: ${formatBytes(best.blob.size)}. Für noch kleiner das Video kürzen oder Tempo erhöhen.`,
        'info',
      );
    }
  };

  /**
   * Exportiert die Animation als kurzes Video (MP4/WebM, max. 6 s) und teilt/lädt es.
   * Damit lässt sich in WhatsApp über den „GIF“-Schalter ein eigenes GIF hinzufügen.
   */
  const exportForWhatsAppGif = async () => {
    if (!frames?.length) return;
    // Eine saubere Schleife der Animation, gedeckelt auf 6 s (WhatsApp-Grenze)
    const seq = buildSequence(skipped(frames), direction, speed / 100);
    const dims = targetDims(frames[0].canvas.width, frames[0].canvas.height, aspect, Math.min(size, 480));
    setBusy({ label: 'Video wird aufgenommen …', progress: 0 });
    try {
      const { blob, ext } = await recordSequenceToVideo(
        seq,
        dims.width,
        dims.height,
        renderFrame(false), // Video hat keinen Alphakanal → ohne Freistellen, weißer Hintergrund
        { maxSeconds: WHATSAPP_GIF_MAX_SECONDS, background: '#ffffff' },
        (v) => setBusy({ label: 'Video wird aufgenommen …', progress: v }),
      );
      setBusy(null);
      const shared = await shareOrDownload(blob, `whatsapp-gif-${Date.now()}.${ext}`, 'Für WhatsApp-GIF');
      setShowWaGif(true); // Anleitung einblenden
      toast(shared ? 'Video geteilt – jetzt in Fotos sichern' : `Video gespeichert (${formatBytes(blob.size)})`, 'success');
    } catch {
      toast('Videoaufnahme fehlgeschlagen', 'error');
      setBusy(null);
    }
  };

  const saveToLibrary = async () => {
    if (!result) return;
    try {
      await saveSticker({
        id: uid(),
        name: `${mode === 'anim' ? 'Animation' : 'GIF'} vom ${new Date().toLocaleDateString('de-DE')}`,
        blob: result.blob,
        favorite: false,
        category: 'Allgemein',
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      });
      toast('In Bibliothek gespeichert', 'success');
    } catch {
      toast('Speichern fehlgeschlagen', 'error');
    }
  };

  const goBack = () => {
    if (frames && step !== 'pick') setConfirmBack(true);
    else navigate('/');
  };

  const totalDuration = frames
    ? (buildSequence(skipped(frames), direction, speed / 100).reduce((s, f) => s + f.delay, 0) / 1000).toFixed(1)
    : '0';

  const chip = (active: boolean) =>
    `rounded-xl border-2 px-3 py-2 text-sm font-semibold active:scale-95 ${
      active ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-400'
    }`;

  return (
    <div className="flex h-dvh flex-col bg-slate-100 dark:bg-[#0d1117]">
      {/* Kopfleiste */}
      <header className="flex items-center gap-1 border-b border-slate-200 bg-white px-2 py-2 safe-top dark:border-slate-700 dark:bg-slate-900">
        <button onClick={goBack} className="rounded-xl p-2.5 active:bg-slate-100 dark:active:bg-slate-800" aria-label="Zurück">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold">{title}</h1>
        {step === 'edit' && (
          <button
            onClick={() => void doExport()}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-sm font-bold text-white shadow active:scale-95"
          >
            <Share2 className="h-4 w-4" /> Erstellen
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Schritt 1: Quelle wählen */}
        {step === 'pick' && (
          <div className="page-in px-4 py-8">
            <p className="mb-5 text-center text-sm text-slate-500 dark:text-slate-400">
              {mode === 'anim'
                ? 'Erstelle einen animierten Sticker aus einem kurzen Video, GIF oder einer Bilderserie.'
                : 'Erstelle ein GIF aus einem Video, einer GIF-Datei oder mehreren Bildern.'}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => videoInput.current?.click()}
                className="flex w-full items-center gap-4 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 p-5 text-left text-white shadow-lg active:scale-[0.98]"
              >
                <Film className="h-9 w-9 shrink-0" />
                <div>
                  <div className="font-bold">Video auswählen</div>
                  <div className="text-xs opacity-80">Ausschnitt wählen und umwandeln</div>
                </div>
              </button>
              <button
                onClick={() => gifInput.current?.click()}
                className="flex w-full items-center gap-4 rounded-3xl bg-gradient-to-br from-violet-400 to-purple-600 p-5 text-left text-white shadow-lg active:scale-[0.98]"
              >
                <Clapperboard className="h-9 w-9 shrink-0" />
                <div>
                  <div className="font-bold">GIF-Datei bearbeiten</div>
                  <div className="text-xs opacity-80">Vorhandenes GIF kürzen, beschriften, optimieren</div>
                </div>
              </button>
              <button
                onClick={() => imagesInput.current?.click()}
                className="flex w-full items-center gap-4 rounded-3xl bg-gradient-to-br from-teal-400 to-cyan-500 p-5 text-left text-white shadow-lg active:scale-[0.98]"
              >
                <ImageIcon className="h-9 w-9 shrink-0" />
                <div>
                  <div className="font-bold">Bilderserie</div>
                  <div className="text-xs opacity-80">Mehrere Fotos als Stop-Motion-Animation</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Schritt 2: Video trimmen */}
        {step === 'trim' && (
          <div className="page-in px-4 py-4">
            <div className="checkerboard mx-auto mb-4 max-w-sm overflow-hidden rounded-2xl shadow">
              <canvas ref={trimPreviewRef} className="block w-full" />
            </div>
            <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Start: {trimStart.toFixed(1)} s
                </label>
                <input
                  type="range" min={0} max={Math.max(0.1, videoDur - 0.2)} step={0.1} value={trimStart}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTrimStart(v);
                    if (v >= trimEnd) setTrimEnd(Math.min(videoDur, v + 1));
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Ende: {trimEnd.toFixed(1)} s (Länge: {(trimEnd - trimStart).toFixed(1)} s)
                </label>
                <input
                  type="range" min={0.2} max={videoDur} step={0.1} value={trimEnd}
                  onChange={(e) => setTrimEnd(Math.max(trimStart + 0.2, Number(e.target.value)))}
                />
              </div>
              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Bildrate</span>
                <div className="flex gap-2">
                  {[5, 10, 12, 15, 20].map((f) => (
                    <button key={f} onClick={() => setFps(f)} className={chip(fps === f)}>
                      {f} fps
                    </button>
                  ))}
                </div>
              </div>
              {mode === 'anim' && trimEnd - trimStart > 10 && (
                <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> Über 10 Sekunden – für WhatsApp bitte kürzen.
                </p>
              )}
              <button
                onClick={() => void extractFromVideo()}
                className="w-full rounded-2xl bg-emerald-500 py-3.5 font-bold text-white shadow-lg active:scale-95"
              >
                Ausschnitt übernehmen
              </button>
            </div>
          </div>
        )}

        {/* Schritt 3: Bearbeiten */}
        {step === 'edit' && frames && (
          <div className="page-in px-4 py-4">
            <div className="checkerboard mx-auto mb-2 w-fit max-w-full overflow-hidden rounded-2xl shadow">
              <canvas
                ref={previewRef}
                className="block max-h-[38dvh] w-auto max-w-full touch-none"
                onPointerDown={dragText}
                onPointerMove={dragText}
              />
            </div>
            <p className="mb-3 text-center text-[11px] text-slate-400">
              {skipped(frames).length} Frames · ca. {totalDuration} s{text ? ' · Text mit dem Finger verschieben' : ''}
            </p>

            <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Richtung</span>
                <div className="flex gap-2">
                  <button onClick={() => setDirection('forward')} className={chip(direction === 'forward')}>Vorwärts</button>
                  <button onClick={() => setDirection('reverse')} className={chip(direction === 'reverse')}>Rückwärts</button>
                  <button onClick={() => setDirection('pingpong')} className={chip(direction === 'pingpong')}>Ping-Pong</button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Geschwindigkeit: {speed} %
                </label>
                <input type="range" min={10} max={300} step={5} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
                {mode === 'anim' && (
                  <div className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                    <p className="mb-2">
                      <strong>Sticker in WhatsApp zu schnell?</strong> WhatsApp spielt animierte Sticker oft schneller
                      ab als das Original. Verlangsame die Animation hier zum Ausgleich:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Normal', v: 100 },
                        { label: '½ Tempo', v: 50 },
                        { label: '⅓ Tempo', v: 33 },
                        { label: '¼ Tempo', v: 25 },
                      ].map((o) => (
                        <button
                          key={o.v}
                          onClick={() => setSpeed(o.v)}
                          className={`rounded-lg border-2 px-3 py-1.5 font-semibold ${
                            speed === o.v
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40'
                              : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {mode === 'gif' && (
                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Seitenverhältnis</span>
                  <div className="flex flex-wrap gap-2">
                    {ASPECTS.map((a) => (
                      <button key={a.id} onClick={() => setAspect(a.id)} className={chip(aspect === a.id)}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Größe & Qualität</span>
                <div className="flex flex-wrap gap-2">
                  {(mode === 'anim' ? [320, 512] : [240, 320, 480]).map((s) => (
                    <button key={s} onClick={() => setSize(s)} className={chip(size === s)}>
                      {s} px
                    </button>
                  ))}
                  {[256, 128, 64].map((c) => (
                    <button key={c} onClick={() => setColors(c)} className={chip(colors === c)}>
                      {c} Farben
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Text</span>
                {text ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button onClick={() => setTextModal(true)} className={chip(false)}>„{text.text.slice(0, 12)}“ ändern</button>
                      <button onClick={() => setText(null)} className="rounded-xl border-2 border-red-200 px-3 py-2 text-sm font-semibold text-red-500 active:scale-95 dark:border-red-900">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      type="range" min={5} max={30} value={Math.round(text.sizeFrac * 100)}
                      onChange={(e) => setText({ ...text, sizeFrac: Number(e.target.value) / 100 })}
                    />
                    <div className="flex flex-wrap gap-2">
                      {COLORS.slice(0, 8).map((c) => (
                        <button
                          key={c}
                          onClick={() => setText({ ...text, color: c, strokeColor: c === '#ffffff' ? '#111827' : '#ffffff' })}
                          className={`h-7 w-7 rounded-full border-2 ${text.color === c ? 'border-emerald-500' : 'border-slate-200 dark:border-slate-600'}`}
                          style={{ backgroundColor: c }}
                          aria-label={`Textfarbe ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setTextModal(true)} className={chip(false)}>
                    <TypeIcon className="mr-1 inline h-4 w-4" /> Text hinzufügen
                  </button>
                )}
              </div>

              <label className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  Hintergrund entfernen <span className="text-xs font-normal text-slate-400">(einfarbiger Hintergrund)</span>
                </span>
                <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} className="h-6 w-6 accent-emerald-500" />
              </label>
              {removeBg && (
                <input type="range" min={5} max={90} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} />
              )}

              <button
                onClick={() => void doExport()}
                className="w-full rounded-2xl bg-emerald-500 py-3.5 font-bold text-white shadow-lg active:scale-95"
              >
                {mode === 'anim' ? 'Animierten Sticker erstellen' : 'GIF erstellen'}
              </button>
            </div>
          </div>
        )}

        {/* Schritt 4: Ergebnis */}
        {step === 'result' && result && (
          <div className="page-in px-4 py-4">
            <div className="checkerboard mx-auto mb-3 w-fit max-w-full overflow-hidden rounded-2xl shadow">
              <img src={result.url} alt="Fertiges GIF" className="block max-h-[40dvh] w-auto max-w-full" />
            </div>

            <div className={`mb-3 flex items-center gap-2 rounded-2xl p-3 text-sm ${
              mode === 'anim' && result.blob.size > WHATSAPP_ANIM_LIMIT
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            }`}>
              {mode === 'anim' && result.blob.size > WHATSAPP_ANIM_LIMIT ? (
                <AlertTriangle className="h-5 w-5 shrink-0" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              )}
              <div>
                <strong>{formatBytes(result.blob.size)}</strong>
                {mode === 'anim' &&
                  (result.blob.size > WHATSAPP_ANIM_LIMIT
                    ? ' – zu groß für einen WhatsApp-Sticker (max. ~500 KB).'
                    : ' – passt als animierter Sticker.')}
              </div>
            </div>

            {mode === 'anim' && result.blob.size > WHATSAPP_ANIM_LIMIT && (
              <button
                onClick={() => void optimizeToLimit()}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 font-bold text-white shadow active:scale-95"
              >
                <RefreshCcw className="h-5 w-5" /> Auf unter 500 KB verkleinern
              </button>
            )}

            <div className="mb-3 flex gap-3">
              <button
                onClick={async () => {
                  const shared = await shareOrDownload(result.blob, `studio-${Date.now()}.gif`, title);
                  toast(shared ? 'Teilen geöffnet' : 'GIF heruntergeladen', 'success');
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 font-bold text-white shadow-lg active:scale-95"
              >
                <Share2 className="h-5 w-5" /> Teilen
              </button>
              <button
                onClick={() => {
                  downloadBlob(result.blob, `studio-${Date.now()}.gif`);
                  toast('GIF heruntergeladen', 'success');
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-500 py-3.5 font-bold text-white shadow-lg active:scale-95"
              >
                <Download className="h-5 w-5" /> Speichern
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => void saveToLibrary()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-200 py-3 font-semibold text-slate-700 active:scale-95 dark:bg-slate-700 dark:text-slate-200">
                <Library className="h-5 w-5" /> In Bibliothek
              </button>
              <button onClick={() => setStep('edit')} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-200 py-3 font-semibold text-slate-700 active:scale-95 dark:bg-slate-700 dark:text-slate-200">
                Anpassen
              </button>
            </div>

            {/* Für WhatsApp-GIF: als kurzes Video exportieren */}
            <button
              onClick={() => void exportForWhatsAppGif()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 py-3.5 font-bold text-white shadow-lg active:scale-95"
            >
              <Video className="h-5 w-5" /> Als WhatsApp-GIF (Video)
            </button>
            <button
              onClick={() => setShowWaGif(true)}
              className="mt-2 w-full text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              Wie füge ich es zu WhatsApp-GIFs hinzu?
            </button>

            {mode === 'anim' && (
              <p className="mt-4 rounded-2xl bg-teal-50 p-3 text-xs leading-relaxed text-teal-900 dark:bg-teal-900/30 dark:text-teal-200">
                <strong>Hinweis:</strong> Das GIF kann in WhatsApp direkt als Animation gesendet werden. Für echte
                animierte Sticker-Pakete wandelt eine Sticker-Import-App (z. B. „Sticker Maker“) das GIF beim Import
                automatisch in das WhatsApp-Format um. Spielt der Sticker in WhatsApp zu schnell? Tippe auf „Anpassen“
                und verringere die Geschwindigkeit (z. B. auf ½ Tempo).
              </p>
            )}
          </div>
        )}
      </div>

      {/* Versteckte Datei-Eingaben */}
      <input ref={videoInput} type="file" accept="video/*,.mov,.mp4,.m4v,.quicktime" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickVideo(f); e.target.value = ''; }} />
      <input ref={gifInput} type="file" accept="image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickGif(f); e.target.value = ''; }} />
      <input ref={imagesInput} type="file" accept="image/*" multiple hidden onChange={(e) => { const f = e.target.files; if (f?.length) void pickImages(Array.from(f)); e.target.value = ''; }} />

      {/* Lade-Overlay mit Fortschritt und Abbrechen */}
      {busy && (
        <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-4 bg-black/70 px-10 text-white">
          <Loader2 className="h-10 w-10 animate-spin" />
          <span className="font-semibold">{busy.label}</span>
          {busy.progress !== null && (
            <div className="h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.round(busy.progress * 100)}%` }} />
            </div>
          )}
          {cancelRef.current && (
            <button
              onClick={() => {
                cancelRef.current?.();
                cancelRef.current = null;
                setBusy(null);
                toast('Abgebrochen', 'info');
              }}
              className="flex items-center gap-1 rounded-2xl bg-white/15 px-4 py-2 font-semibold active:scale-95"
            >
              <X className="h-4 w-4" /> Abbrechen
            </button>
          )}
        </div>
      )}

      <InputModal
        open={textModal}
        title="Text auf dem GIF"
        initial={text?.text ?? ''}
        placeholder="Dein Text …"
        onSubmit={(t) =>
          setText(
            text
              ? { ...text, text: t }
              : { text: t, rx: 0.5, ry: 0.85, sizeFrac: 0.12, color: '#ffffff', strokeColor: '#111827' },
          )
        }
        onClose={() => setTextModal(false)}
      />

      <Modal
        open={confirmBack}
        title="Studio verlassen?"
        confirmLabel="Verlassen"
        danger
        onConfirm={() => navigate('/')}
        onClose={() => setConfirmBack(false)}
      >
        Die geladenen Frames gehen verloren.
      </Modal>

      <Modal
        open={!!convertFile}
        title="Video umwandeln?"
        confirmLabel="Jetzt umwandeln"
        onConfirm={() => convertFile && void convertAndLoad(convertFile)}
        onClose={() => setConvertFile(null)}
      >
        <div className="space-y-2 text-left">
          <p>
            Dieses Video ließ sich nicht direkt öffnen. Der <strong>Alles-Konverter</strong> kann es umwandeln – damit
            funktionieren praktisch alle Formate (auch iPhone-HEVC).
          </p>
          <p className="text-xs text-slate-400">
            Beim ersten Mal wird der Konverter geladen (einmalig ~31&nbsp;MB, danach offline verfügbar). Es werden die
            ersten <strong>30&nbsp;Sekunden</strong> des Videos verwendet; die Umwandlung läuft komplett auf deinem
            Gerät.
          </p>
        </div>
      </Modal>

      <Modal
        open={showWaGif}
        title="GIF in WhatsApp senden & wiederverwenden"
        confirmLabel="Verstanden"
        onConfirm={() => setShowWaGif(false)}
        onClose={() => setShowWaGif(false)}
      >
        <div className="space-y-3 text-left">
          <p>So sendest du deine Animation als GIF in einem Chat:</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Oben auf <strong>„Als WhatsApp-GIF (Video)“</strong> tippen und das Video <strong>in Fotos/Galerie speichern</strong>.</li>
            <li>In WhatsApp einen Chat öffnen → <strong>Anhang (＋)</strong> → <strong>Foto &amp; Video</strong> → das Video wählen.</li>
            <li>Oben auf den <strong>„GIF“-Schalter</strong> tippen (erscheint bei Videos bis 6&nbsp;Sek.) und senden.</li>
          </ol>
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <strong>Wichtig – ehrlich gesagt:</strong> WhatsApp speichert selbst erstellte GIFs <strong>nicht</strong>
            dauerhaft im GIF-Bereich (das GIF-Symbol zeigt nur die Giphy-/Tenor-Suche und Favoriten daraus). Ein
            lokales GIF lässt sich dort nicht ablegen – das ist eine Einschränkung von WhatsApp, nicht dieser App.
          </div>
          <p className="font-semibold">Zum Wiederverwenden gibt es zwei zuverlässige Wege:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li><strong>In dieser App:</strong> auf <strong>„In Bibliothek“</strong> tippen – dort bleibt dein GIF gespeichert und lässt sich jederzeit erneut teilen.</li>
            <li><strong>In Fotos:</strong> das gespeicherte Video bleibt in deiner Galerie und kann jederzeit erneut über den GIF-Schalter gesendet werden.</li>
          </ul>
          <p className="text-xs text-slate-400">
            Nur wenn dein GIF in der WhatsApp-<em>Suche</em> auffindbar sein soll, müsstest du es öffentlich bei
            Giphy oder Tenor hochladen – dann kannst du es in WhatsApp suchen und als Favorit markieren.
          </p>
        </div>
      </Modal>
    </div>
  );
}
