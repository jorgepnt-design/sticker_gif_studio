/**
 * „Alles-Konverter“ auf Basis von ffmpeg.wasm (Single-Thread-Core, damit es
 * ohne spezielle Server-Header / SharedArrayBuffer auch auf GitHub Pages und
 * iOS läuft). Wird nur bei Bedarf geladen (~31 MB einmaliger Download) und
 * wandelt beliebige Videos in ein browserkompatibles MP4 (H.264) um.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let instance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export function isFfmpegReady(): boolean {
  return !!instance?.loaded;
}

/** Lädt den Konverter-Kern (einmalig). Die Core-Dateien liegen lokal in /ffmpeg. */
export function loadFfmpeg(): Promise<FFmpeg> {
  if (instance?.loaded) return Promise.resolve(instance);
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const ff = new FFmpeg();
    // BASE_URL berücksichtigt den GitHub-Pages-Unterpfad
    const base = `${import.meta.env.BASE_URL}ffmpeg`;
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    instance = ff;
    return ff;
  })();
  return loadPromise;
}

function guessExt(file: Blob): string {
  const t = file.type.toLowerCase();
  if (t.includes('quicktime') || t.includes('mov')) return 'mov';
  if (t.includes('webm')) return 'webm';
  if (t.includes('avi')) return 'avi';
  if (t.includes('matroska') || t.includes('mkv')) return 'mkv';
  if (t.includes('3gpp') || t.includes('3gp')) return '3gp';
  return 'mp4';
}

export interface TranscodeOptions {
  /** Nur die ersten … Sekunden umwandeln (Speicher/Tempo schonen) */
  maxSeconds?: number;
  /** Längste Kante in Pixeln */
  maxDim?: number;
  /** Ziel-Bildrate */
  fps?: number;
}

/**
 * Wandelt ein beliebiges Video in ein kompatibles, verkleinertes MP4 (H.264,
 * yuv420p) ohne Ton um. Das Ergebnis lässt sich anschließend zuverlässig über
 * das normale Video-Element laden.
 */
export async function transcodeToMp4(
  file: Blob,
  opts: TranscodeOptions = {},
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const ff = await loadFfmpeg();
  const input = `input.${guessExt(file)}`;
  const output = 'output.mp4';
  const maxDim = opts.maxDim ?? 640;

  const onProg = (e: { progress: number }) => onProgress?.(Math.max(0, Math.min(1, e.progress)));
  ff.on('progress', onProg);

  try {
    await ff.writeFile(input, await fetchFile(file));
    // Innerhalb maxDim×maxDim einpassen (Seitenverhältnis bleibt), gerade Kanten.
    // Wichtig: Argumente gehen als Array direkt an ffmpeg (keine Shell) → keine
    // Anführungszeichen und keine unmaskierten Kommas im Filter verwenden.
    const scale = `scale=${maxDim}:${maxDim}:force_original_aspect_ratio=decrease:force_divisible_by=2`;
    const vf = opts.fps ? `${scale},fps=${opts.fps}` : scale;
    const args = [
      '-i', input,
      ...(opts.maxSeconds ? ['-t', String(opts.maxSeconds)] : []),
      '-vf', vf,
      '-an', // kein Ton nötig
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast',
      '-crf', '26',
      '-movflags', '+faststart',
      output,
    ];
    await ff.exec(args);
    const data = (await ff.readFile(output)) as Uint8Array;
    if (!data || data.length === 0) throw new Error('Konvertierung ergab kein Video');
    return new Blob([data], { type: 'video/mp4' });
  } finally {
    ff.off('progress', onProg);
    // Aufräumen (Speicher freigeben)
    await ff.deleteFile(input).catch(() => undefined);
    await ff.deleteFile(output).catch(() => undefined);
  }
}
