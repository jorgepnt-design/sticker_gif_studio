/**
 * GIF-Pipeline: Frames aus Videos, GIF-Dateien oder Bildern gewinnen,
 * Abspielreihenfolge aufbauen und über den Web Worker als GIF kodieren.
 */
import { parseGIF, decompressFrames } from 'gifuct-js';
import { createCanvas, ctx2d, loadImageToCanvas } from './imaging';

/** Ein Rohframe: Vollbild-Canvas + Anzeigedauer in ms */
export interface RawFrame {
  canvas: HTMLCanvasElement;
  delay: number;
}

export type Direction = 'forward' | 'reverse' | 'pingpong';

/** Obergrenze, damit Speicher und Kodierzeit auf Smartphones beherrschbar bleiben */
export const MAX_FRAMES = 150;
export const MAX_VIDEO_BYTES = 120 * 1024 * 1024;

/* ---------- Quellen laden ---------- */

/** Video-Metadaten (Dauer, Abmessungen) auslesen */
export function loadVideo(file: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error('Video konnte nicht gelesen werden'));
  });
}

/** Ein Einzelbild aus dem Video an Position `time` holen (für Vorschau/Trim) */
export function grabVideoFrame(video: HTMLVideoElement, time: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      const c = createCanvas(video.videoWidth, video.videoHeight);
      ctx2d(c).drawImage(video, 0, 0);
      resolve(c);
    };
    video.addEventListener('seeked', onSeeked);
    video.onerror = () => reject(new Error('Video-Fehler'));
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
  });
}

/**
 * Frames aus einem Video-Ausschnitt extrahieren (per Seek, ohne FFmpeg).
 * Die Bildrate wird automatisch gesenkt, wenn das Frame-Limit überschritten würde.
 */
export async function extractVideoFrames(
  video: HTMLVideoElement,
  start: number,
  end: number,
  fps: number,
  onProgress: (v: number) => void,
): Promise<{ frames: RawFrame[]; effectiveFps: number }> {
  const span = Math.max(0.1, end - start);
  let effectiveFps = fps;
  while (span * effectiveFps > MAX_FRAMES && effectiveFps > 2) effectiveFps -= 1;
  const step = 1 / effectiveFps;
  const delay = Math.round(1000 / effectiveFps);
  const frames: RawFrame[] = [];
  const total = Math.floor(span / step);

  // Sehr große Videos für die Verarbeitung verkleinern
  const maxDim = 720;
  const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);

  for (let i = 0; i <= total; i++) {
    const t = start + i * step;
    if (t >= end) break;
    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        const c = createCanvas(w, h);
        ctx2d(c).drawImage(video, 0, 0, w, h);
        frames.push({ canvas: c, delay });
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.onerror = () => reject(new Error('Video-Fehler beim Lesen'));
      video.currentTime = t;
    });
    onProgress((i + 1) / (total + 1));
  }
  return { frames, effectiveFps };
}

/** GIF-Datei in Vollbild-Frames zerlegen (inkl. Disposal-Handling) */
export async function decodeGifFrames(file: Blob): Promise<RawFrame[]> {
  const buf = await file.arrayBuffer();
  const gif = parseGIF(buf);
  const parsed = decompressFrames(gif, true);
  if (!parsed.length) throw new Error('GIF enthält keine Frames');

  const w = parsed[0].dims.width + parsed[0].dims.left;
  let fullW = 0;
  let fullH = 0;
  for (const f of parsed) {
    fullW = Math.max(fullW, f.dims.left + f.dims.width);
    fullH = Math.max(fullH, f.dims.top + f.dims.height);
  }
  fullW = Math.max(fullW, w);

  // GIF-Frames sind oft nur Teilflächen → auf einem Arbeits-Canvas zusammensetzen
  const work = createCanvas(fullW, fullH);
  const wctx = ctx2d(work);
  const patch = createCanvas(fullW, fullH);
  const pctx = ctx2d(patch);

  const frames: RawFrame[] = [];
  for (const f of parsed.slice(0, MAX_FRAMES)) {
    const imageData = new ImageData(new Uint8ClampedArray(f.patch), f.dims.width, f.dims.height);
    pctx.clearRect(0, 0, fullW, fullH);
    pctx.putImageData(imageData, f.dims.left, f.dims.top);

    if (f.disposalType === 2) {
      // Vorherigen Frame-Bereich löschen
      wctx.clearRect(f.dims.left, f.dims.top, f.dims.width, f.dims.height);
    }
    wctx.drawImage(patch, 0, 0);

    const snap = createCanvas(fullW, fullH);
    ctx2d(snap).drawImage(work, 0, 0);
    frames.push({ canvas: snap, delay: f.delay && f.delay > 10 ? f.delay : 100 });
  }
  return frames;
}

/** Mehrere Einzelbilder als Frames laden (Diashow / Stop-Motion) */
export async function loadImageFrames(files: File[], delay = 500): Promise<RawFrame[]> {
  const frames: RawFrame[] = [];
  for (const f of files.slice(0, MAX_FRAMES)) {
    frames.push({ canvas: await loadImageToCanvas(f), delay });
  }
  return frames;
}

/* ---------- Sequenz & Kodierung ---------- */

/** Abspielreihenfolge inkl. Richtung und Geschwindigkeit berechnen */
export function buildSequence(frames: RawFrame[], direction: Direction, speed: number): RawFrame[] {
  let order: RawFrame[];
  if (direction === 'reverse') order = [...frames].reverse();
  else if (direction === 'pingpong') order = [...frames, ...frames.slice(1, -1).reverse()];
  else order = [...frames];
  return order.map((f) => ({ canvas: f.canvas, delay: Math.max(20, Math.round(f.delay / speed)) }));
}

export interface EncodeOptions {
  width: number;
  height: number;
  transparent: boolean;
  maxColors: number;
}

/**
 * GIF im Web Worker kodieren. `renderFrame` zeichnet jeden Quellframe auf die
 * Zielgröße (Zuschnitt, Text, Effekte). Abbrechbar über das zurückgegebene Handle.
 */
export function encodeGif(
  sequence: RawFrame[],
  renderFrame: (src: HTMLCanvasElement, target: HTMLCanvasElement) => void,
  opts: EncodeOptions,
  onProgress: (v: number) => void,
): { promise: Promise<Blob>; cancel: () => void } {
  const worker = new Worker(new URL('../workers/gif.worker.ts', import.meta.url), { type: 'module' });
  let cancelled = false;

  const promise = (async (): Promise<Blob> => {
    return new Promise<Blob>(async (resolve, reject) => {
    try {
      // Frames auf Zielgröße rendern und als übertragbare Puffer sammeln.
      // Zwischendurch kurz ans UI abgeben, damit nichts einfriert.
      const target = createCanvas(opts.width, opts.height);
      const tctx = ctx2d(target);
      const buffers: ArrayBuffer[] = [];
      const delays: number[] = [];
      for (let i = 0; i < sequence.length; i++) {
        if (cancelled) return;
        const f = sequence[i];
        tctx.clearRect(0, 0, opts.width, opts.height);
        renderFrame(f.canvas, target);
        const data = tctx.getImageData(0, 0, opts.width, opts.height);
        buffers.push(data.data.buffer.slice(0));
        delays.push(f.delay);
        if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
      }

      worker.onmessage = (e: MessageEvent<{ type: string; value?: number; buffer?: ArrayBuffer; message?: string }>) => {
        if (cancelled) return;
        if (e.data.type === 'progress') onProgress(e.data.value ?? 0);
        else if (e.data.type === 'done') {
          resolve(new Blob([e.data.buffer!], { type: 'image/gif' }));
          worker.terminate();
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.message ?? 'GIF-Kodierung fehlgeschlagen'));
          worker.terminate();
        }
      };
      worker.onerror = () => {
        reject(new Error('GIF-Worker-Fehler'));
        worker.terminate();
      };
      worker.postMessage(
        {
          frames: buffers,
          width: opts.width,
          height: opts.height,
          delays,
          transparent: opts.transparent,
          maxColors: opts.maxColors,
        },
        buffers,
      );
    } catch (err) {
      worker.terminate();
      reject(err as Error);
    }
    });
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      worker.terminate();
    },
  };
}

/** Seitenverhältnisse für den GIF-Ersteller */
export const ASPECTS: { id: string; label: string; ratio: number | null }[] = [
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: 'orig', label: 'Frei', ratio: null },
];

/** Ziel-Abmessungen aus Quellgröße, Seitenverhältnis und Basisgröße berechnen */
export function targetDims(srcW: number, srcH: number, aspectId: string, baseSize: number) {
  const aspect = ASPECTS.find((a) => a.id === aspectId)?.ratio ?? null;
  const ratio = aspect ?? srcW / srcH;
  let w: number;
  let h: number;
  if (ratio >= 1) {
    w = baseSize;
    h = Math.round(baseSize / ratio);
  } else {
    h = baseSize;
    w = Math.round(baseSize * ratio);
  }
  // GIF-Encoder mag gerade Zahlen
  return { width: w - (w % 2), height: h - (h % 2) };
}

/** Quellframe formatfüllend (cover) auf das Ziel zeichnen */
export function drawCover(src: HTMLCanvasElement, target: HTMLCanvasElement): void {
  const ctx = ctx2d(target);
  const scale = Math.max(target.width / src.width, target.height / src.height);
  const w = src.width * scale;
  const h = src.height * scale;
  ctx.drawImage(src, (target.width - w) / 2, (target.height - h) / 2, w, h);
}
