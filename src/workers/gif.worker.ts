/**
 * Web Worker für die GIF-Kodierung (gifenc).
 * Läuft im Hintergrund, damit die Oberfläche nicht blockiert.
 *
 * Eingabe:  { frames: ArrayBuffer[], width, height, delays: number[], transparent: boolean, maxColors: number }
 * Ausgabe:  { type: 'progress', value: 0..1 }  und  { type: 'done', buffer: ArrayBuffer }
 */
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

interface EncodeRequest {
  frames: ArrayBuffer[];
  width: number;
  height: number;
  delays: number[];
  transparent: boolean;
  maxColors: number;
}

self.onmessage = (e: MessageEvent<EncodeRequest>) => {
  const { frames, width, height, delays, transparent, maxColors } = e.data;
  try {
    const gif = GIFEncoder();
    const format = transparent ? 'rgba4444' : 'rgb565';

    for (let i = 0; i < frames.length; i++) {
      const rgba = new Uint8ClampedArray(frames[i]);
      const palette = quantize(rgba, maxColors, {
        format,
        oneBitAlpha: transparent,
      });
      const index = applyPalette(rgba, palette, format);
      gif.writeFrame(index, width, height, {
        palette,
        delay: delays[i],
        transparent,
        // dispose=2: Fläche vor dem nächsten Frame leeren (nötig bei Transparenz)
        dispose: transparent ? 2 : 0,
      });
      (self as unknown as Worker).postMessage({ type: 'progress', value: (i + 1) / frames.length });
    }

    gif.finish();
    const bytes = gif.bytes();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    (self as unknown as Worker).postMessage({ type: 'done', buffer }, [buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: 'error', message: (err as Error).message });
  }
};
