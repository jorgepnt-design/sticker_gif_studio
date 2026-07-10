/**
 * Nimmt eine Frame-Sequenz in Echtzeit über MediaRecorder als Video auf
 * (MP4 bevorzugt, WebM als Rückfall). Läuft komplett lokal im Browser.
 *
 * Zweck u. a.: kurze Videos für den „GIF“-Schalter in WhatsApp erzeugen –
 * WhatsApp wandelt Videos bis 6 Sekunden in ein GIF um.
 */
import type { RawFrame } from './gif';
import { createCanvas, ctx2d } from './imaging';

/** WhatsApp wandelt nur Videos bis zu dieser Länge per „GIF“-Schalter um. */
export const WHATSAPP_GIF_MAX_SECONDS = 6;

/** Bestes vom Browser unterstütztes Aufnahmeformat ermitteln (MP4 bevorzugt). */
export function pickVideoMime(): string | null {
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

/**
 * Spielt die Sequenz einmal in Echtzeit ab und zeichnet sie auf.
 * `renderFrame` zeichnet jeden Quellframe auf die Zielgröße.
 * Videos haben keine Transparenz → `background` füllt die Fläche.
 */
export async function recordSequenceToVideo(
  sequence: RawFrame[],
  width: number,
  height: number,
  renderFrame: (src: HTMLCanvasElement, target: HTMLCanvasElement) => void,
  opts: { maxSeconds?: number; background?: string } = {},
  onProgress?: (v: number) => void,
): Promise<{ blob: Blob; ext: 'mp4' | 'webm' }> {
  const mime = pickVideoMime();
  if (!mime) throw new Error('Videoaufnahme wird von diesem Browser nicht unterstützt');

  // Gerade Kantenlängen sind für Video-Encoder sicherer
  const canvas = createCanvas(width - (width % 2), height - (height % 2));
  const ctx = ctx2d(canvas);
  const background = opts.background ?? '#ffffff';

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

  const draw = (f: RawFrame) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    renderFrame(f.canvas, canvas);
  };

  const maxMs = (opts.maxSeconds ?? Infinity) * 1000;
  const totalMs = Math.min(
    sequence.reduce((s, f) => s + f.delay, 0),
    maxMs,
  );

  draw(sequence[0]);
  recorder.start();
  let elapsed = 0;
  for (let i = 0; i < sequence.length; i++) {
    const f = sequence[i];
    draw(f);
    await new Promise((r) => setTimeout(r, f.delay));
    elapsed += f.delay;
    onProgress?.(Math.min(1, elapsed / totalMs));
    if (elapsed >= maxMs) break;
  }
  recorder.stop();
  await stopped;

  const blob = new Blob(chunks, { type: mime.split(';')[0] });
  return { blob, ext: mime.includes('mp4') ? 'mp4' : 'webm' };
}
