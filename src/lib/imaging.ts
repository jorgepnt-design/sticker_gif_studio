/**
 * Medienverarbeitung: Laden, Freistellen, Rand, Compositing und Export.
 * Alles läuft lokal im Browser über die Canvas API – keine Uploads.
 */
import type { EditorDoc, TextLayer, Adjustments } from './types';

/** Logische Arbeitsfläche (WhatsApp-Sticker sind 512×512) */
export const WORLD = 512;

/** Maximale Kantenlänge, mit der intern gearbeitet wird (Speicher schonen) */
const MAX_WORK_SIZE = 1280;

/** Maximale Dateigröße für Uploads (Schutz vor Speicherproblemen) */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas wird von diesem Browser nicht unterstützt');
  return ctx;
}

/**
 * Lädt eine Bilddatei in ein Canvas. Sehr große Bilder werden automatisch
 * verkleinert, damit die Bearbeitung auf Smartphones flüssig bleibt.
 */
export async function loadImageToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    let { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) throw new Error('Bild konnte nicht gelesen werden');
    const factor = Math.min(1, MAX_WORK_SIZE / Math.max(w, h));
    w = Math.round(w * factor);
    h = Math.round(h * factor);
    const canvas = createCanvas(w, h);
    ctx2d(canvas).drawImage(img, 0, 0, w, h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  ctx2d(c).drawImage(src, 0, 0);
  return c;
}

/**
 * Automatisches Freistellen: entfernt zusammenhängende Hintergrundflächen,
 * die farblich den Bildecken ähneln (Flood-Fill von allen Rändern aus).
 * tolerance: 0–100 (wie stark die Farbe abweichen darf).
 */
export function autoRemoveBackground(canvas: HTMLCanvasElement, tolerance: number): void {
  const ctx = ctx2d(canvas);
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  // Referenzfarben: die vier Ecken des Bildes
  const cornerIdx = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
  const refs = cornerIdx.map((i) => [d[i], d[i + 1], d[i + 2]]);
  const tol = (tolerance / 100) * 160; // maximale Kanaldistanz
  const tol2 = tol * tol * 3;

  const matches = (p: number): boolean => {
    const i = p * 4;
    if (d[i + 3] === 0) return true; // bereits transparent → weiter ausbreiten
    for (const r of refs) {
      const dr = d[i] - r[0];
      const dg = d[i + 1] - r[1];
      const db = d[i + 2] - r[2];
      if (dr * dr + dg * dg + db * db <= tol2) return true;
    }
    return false;
  };

  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) {
    stack.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + w - 1);
  }

  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    if (!matches(p)) continue;
    d[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }

  // Kanten leicht weichzeichnen: halbtransparente Übergangspixel erzeugen
  softenEdges(d, w, h);
  ctx.putImageData(img, 0, 0);
}

/** Macht harte Freistell-Kanten einen Hauch weicher (1 Pixel Übergang). */
function softenEdges(d: Uint8ClampedArray, w: number, h: number): void {
  const alpha = new Uint8ClampedArray(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = d[p * 4 + 3];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (alpha[p] === 255) {
        // Pixel direkt an einer transparenten Kante? → leicht abschwächen
        if (alpha[p - 1] === 0 || alpha[p + 1] === 0 || alpha[p - w] === 0 || alpha[p + w] === 0) {
          d[p * 4 + 3] = 180;
        }
      }
    }
  }
}

/** Radierer/Wiederherstellen-Strich auf dem Bild-Canvas ausführen. */
export function brushStroke(
  target: HTMLCanvasElement,
  original: HTMLCanvasElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  mode: 'erase' | 'restore',
): void {
  const ctx = ctx2d(target);
  ctx.save();
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(dist / (radius * 0.4)));
  for (let i = 0; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.fill();
    } else {
      // Original innerhalb des Pinselkreises zurückholen
      ctx.globalCompositeOperation = 'source-over';
      ctx.clip();
      ctx.drawImage(original, 0, 0);
      ctx.restore();
      ctx.save();
    }
  }
  ctx.restore();
}

/* ---------- Anpassungen (Helligkeit, Kontrast, Sättigung, Wärme) ---------- */

export const NEUTRAL_ADJUST: Adjustments = { brightness: 100, contrast: 100, saturation: 100, temperature: 0 };

export function isNeutralAdjust(a?: Adjustments): boolean {
  return !a || (a.brightness === 100 && a.contrast === 100 && a.saturation === 100 && a.temperature === 0);
}

/**
 * Wendet die Anpassungen auf eine Kopie des Bildes an (nicht-destruktiv).
 * Uint8ClampedArray übernimmt das Begrenzen auf 0–255 automatisch.
 */
export function applyAdjustments(src: HTMLCanvasElement, a: Adjustments): HTMLCanvasElement {
  if (isNeutralAdjust(a)) return src;
  const out = cloneCanvas(src);
  const ctx = ctx2d(out);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const bright = a.brightness / 100;
  const contrast = a.contrast / 100;
  const sat = a.saturation / 100;
  const temp = a.temperature;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * bright;
    let g = d[i + 1] * bright;
    let b = d[i + 2] * bright;
    r = (r - 128) * contrast + 128 + temp;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128 - temp;
    if (sat !== 1) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      b = l + (b - l) * sat;
    }
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/* ---------- Filter-Presets (destruktiv, aber Undo-fähig) ---------- */

export type FilterPreset = 'sw' | 'sepia' | 'invert' | 'pixel' | 'blur' | 'sharpen' | 'cartoon' | 'comic';

const clampIdx = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function blurAxis(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number, horizontal: boolean): void {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const div = 2 * r + 1;
  for (let line = 0; line < lines; line++) {
    for (let ch = 0; ch < 4; ch++) {
      const idx = horizontal
        ? (i: number) => (line * w + i) * 4 + ch
        : (i: number) => (i * w + line) * 4 + ch;
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += src[idx(clampIdx(i, 0, len - 1))];
      for (let i = 0; i < len; i++) {
        dst[idx(i)] = sum / div;
        sum += src[idx(clampIdx(i + r + 1, 0, len - 1))] - src[idx(clampIdx(i - r, 0, len - 1))];
      }
    }
  }
}

/** Schneller separierbarer Box-Blur (in place) */
export function boxBlurCanvas(canvas: HTMLCanvasElement, radius: number, passes = 2): void {
  const ctx = ctx2d(canvas);
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const tmp = new Uint8ClampedArray(img.data.length);
  const r = Math.max(1, Math.round(radius));
  for (let p = 0; p < passes; p++) {
    blurAxis(img.data, tmp, w, h, r, true);
    blurAxis(tmp, img.data, w, h, r, false);
  }
  ctx.putImageData(img, 0, 0);
}

function posterize(d: Uint8ClampedArray, levels: number): void {
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round(d[i] / step) * step;
    d[i + 1] = Math.round(d[i + 1] / step) * step;
    d[i + 2] = Math.round(d[i + 2] / step) * step;
  }
}

export function applyFilterPreset(canvas: HTMLCanvasElement, preset: FilterPreset): void {
  const ctx = ctx2d(canvas);
  const { width: w, height: h } = canvas;

  if (preset === 'pixel') {
    const block = Math.max(4, Math.round(w / 48));
    const sw = Math.max(1, Math.round(w / block));
    const sh = Math.max(1, Math.round(h / block));
    const small = createCanvas(sw, sh);
    ctx2d(small).drawImage(canvas, 0, 0, sw, sh);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    return;
  }
  if (preset === 'blur') {
    boxBlurCanvas(canvas, Math.max(2, Math.round(w / 150)));
    return;
  }
  if (preset === 'sharpen') {
    // Unscharf maskieren: Original + (Original − Weichzeichnung) × Stärke
    const blurred = cloneCanvas(canvas);
    boxBlurCanvas(blurred, 2, 1);
    const img = ctx.getImageData(0, 0, w, h);
    const bd = ctx2d(blurred).getImageData(0, 0, w, h).data;
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] += (d[i] - bd[i]) * 0.8;
      d[i + 1] += (d[i + 1] - bd[i + 1]) * 0.8;
      d[i + 2] += (d[i + 2] - bd[i + 2]) * 0.8;
    }
    ctx.putImageData(img, 0, 0);
    return;
  }
  if (preset === 'cartoon') {
    boxBlurCanvas(canvas, Math.max(1, Math.round(w / 400)), 1);
    const img = ctx.getImageData(0, 0, w, h);
    posterize(img.data, 5);
    // Farben leicht anheben für den Comic-Look
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      d[i] = l + (d[i] - l) * 1.3;
      d[i + 1] = l + (d[i + 1] - l) * 1.3;
      d[i + 2] = l + (d[i + 2] - l) * 1.3;
    }
    ctx.putImageData(img, 0, 0);
    return;
  }
  if (preset === 'comic') {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    // Helligkeit vor dem Posterisieren merken (für die Kantenerkennung)
    const lum = new Float32Array(w * h);
    for (let p = 0; p < w * h; p++) {
      lum[p] = 0.2126 * d[p * 4] + 0.7152 * d[p * 4 + 1] + 0.0722 * d[p * 4 + 2];
    }
    posterize(d, 4);
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const p = y * w + x;
        if (Math.abs(lum[p] - lum[p + 1]) + Math.abs(lum[p] - lum[p + w]) > 42 && d[p * 4 + 3] > 0) {
          d[p * 4] = 25;
          d[p * 4 + 1] = 25;
          d[p * 4 + 2] = 25;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return;
  }

  // Pixelweise Filter: Schwarz-Weiß, Sepia, Invertieren
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (preset === 'sw') {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      d[i] = l;
      d[i + 1] = l;
      d[i + 2] = l;
    } else if (preset === 'sepia') {
      d[i] = 0.393 * r + 0.769 * g + 0.189 * b;
      d[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
      d[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
    } else if (preset === 'invert') {
      d[i] = 255 - r;
      d[i + 1] = 255 - g;
      d[i + 2] = 255 - b;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Zeilenumbrüche berücksichtigen und Text-Ausmaße bestimmen */
export function measureTextLayer(layer: TextLayer): { w: number; h: number; lines: string[] } {
  const lines = layer.text.split('\n');
  const c = createCanvas(1, 1);
  const ctx = ctx2d(c);
  ctx.font = `700 ${layer.size}px ${layer.font}`;
  let maxW = 0;
  for (const line of lines) {
    maxW = Math.max(maxW, ctx.measureText(line).width);
  }
  const lineHeight = layer.size * 1.2;
  return { w: maxW, h: lines.length * lineHeight, lines };
}

export function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer): void {
  const { lines } = measureTextLayer(layer);
  const lineHeight = layer.size * 1.2;
  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate(layer.rotation);
  ctx.font = `700 ${layer.size}px ${layer.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startY = -((lines.length - 1) * lineHeight) / 2;
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;
    if (layer.strokeWidth > 0 && layer.kind === 'text') {
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineWidth = (layer.strokeWidth / 100) * layer.size;
      ctx.strokeText(lines[i], 0, y);
    }
    ctx.fillStyle = layer.color;
    ctx.fillText(lines[i], 0, y);
  }
  ctx.restore();
}

function drawImageLayer(ctx: CanvasRenderingContext2D, doc: EditorDoc, image: HTMLCanvasElement): void {
  const t = doc.image!;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate((t.rot * Math.PI) / 180);
  ctx.scale(t.scale * (t.flipX ? -1 : 1), t.scale * (t.flipY ? -1 : 1));
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.restore();
}

/**
 * Rendert den kompletten Editor-Zustand auf ein Ziel-Canvas.
 * `quality` steuert, wie aufwendig der Sticker-Rand berechnet wird
 * (während einer Geste reicht eine gröbere Darstellung).
 */
export function composeDoc(
  target: HTMLCanvasElement,
  doc: EditorDoc,
  image: HTMLCanvasElement | null,
  quality: 'fast' | 'high' = 'high',
  drawing?: HTMLCanvasElement | null,
): void {
  const size = target.width; // quadratisch
  const scale = size / WORLD;
  const ctx = ctx2d(target);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.scale(scale, scale);

  // Inhalt (Bild + Zeichnung + Ebenen) einmal offscreen rendern
  const content = createCanvas(size, size);
  const cctx = ctx2d(content);
  cctx.save();
  cctx.scale(scale, scale);
  if (doc.image && image) drawImageLayer(cctx, doc, image);
  if (drawing) cctx.drawImage(drawing, 0, 0);
  for (const layer of doc.layers) drawTextLayer(cctx, layer);
  cctx.restore();

  // 1) Hintergrundfarbe
  if (doc.bg) {
    ctx.fillStyle = doc.bg;
    ctx.fillRect(0, 0, WORLD, WORLD);
  }

  // 2) Sticker-Rand: eingefärbte Silhouette mehrfach versetzt zeichnen
  // (im runden Profilbild-Modus wird stattdessen ein Ring gezeichnet, s. u.)
  if (doc.border.enabled && doc.border.width > 0 && !doc.round) {
    const tinted = createCanvas(size, size);
    const tctx = ctx2d(tinted);
    tctx.drawImage(content, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = doc.border.color;
    tctx.fillRect(0, 0, size, size);

    const w = doc.border.width;
    const angleSteps = quality === 'high' ? 16 : 8;
    const radiusStep = Math.max(1.5, w / (quality === 'high' ? 6 : 3));
    ctx.save();
    // Offsets in Welt-Koordinaten (Kontext ist bereits skaliert)
    for (let r = radiusStep; r <= w + 0.01; r += radiusStep) {
      for (let a = 0; a < angleSteps; a++) {
        const ang = (a / angleSteps) * Math.PI * 2;
        ctx.drawImage(tinted, Math.cos(ang) * r, Math.sin(ang) * r, WORLD, WORLD);
      }
    }
    ctx.restore();
  }

  // 3) Inhalt oben drauf – optional mit Schlagschatten
  if (doc.shadow?.enabled) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    // Schatten-Attribute wirken im Geräte-Raum, daher mitskalieren
    ctx.shadowBlur = doc.shadow.blur * scale;
    ctx.shadowOffsetX = doc.shadow.offset * scale;
    ctx.shadowOffsetY = doc.shadow.offset * scale;
    ctx.drawImage(content, 0, 0, WORLD, WORLD);
    ctx.restore();
  } else {
    ctx.drawImage(content, 0, 0, WORLD, WORLD);
  }

  // 4) Runde Maske (Profilbild-Modus) + optionaler farbiger Ring
  if (doc.round) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(WORLD / 2, WORLD / 2, WORLD / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (doc.border.enabled && doc.border.width > 0) {
      ctx.beginPath();
      ctx.arc(WORLD / 2, WORLD / 2, WORLD / 2 - doc.border.width / 2, 0, Math.PI * 2);
      ctx.strokeStyle = doc.border.color;
      ctx.lineWidth = doc.border.width;
      ctx.stroke();
    }
  }

  ctx.restore();
}

/** Canvas als Blob kodieren; fällt auf PNG zurück, wenn WebP nicht unterstützt wird (ältere iPhones). */
export function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: 'png' | 'webp' | 'jpeg',
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Export fehlgeschlagen'));
        resolve(blob);
      },
      `image/${format}`,
      quality,
    );
  });
}

/**
 * Exportiert einen Sticker und reduziert bei Bedarf automatisch die Qualität,
 * bis die WhatsApp-Grenze (~100 KB für statische Sticker) eingehalten wird.
 */
export async function exportSticker(
  doc: EditorDoc,
  image: HTMLCanvasElement | null,
  drawing: HTMLCanvasElement | null,
  format: 'png' | 'webp' | 'jpeg',
  quality: number,
  optimizeForWhatsApp: boolean,
): Promise<{ blob: Blob; actualFormat: string }> {
  let out = createCanvas(WORLD, WORLD);
  composeDoc(out, doc, image, 'high', drawing);
  if (format === 'jpeg') {
    // JPG kennt keine Transparenz → weiß unterlegen
    const flat = createCanvas(WORLD, WORLD);
    const fctx = ctx2d(flat);
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(0, 0, WORLD, WORLD);
    fctx.drawImage(out, 0, 0);
    out = flat;
  }
  let blob = await encodeCanvas(out, format, quality);
  // Safari < 17 kann kein WebP kodieren und liefert stattdessen PNG
  const actualFormat = blob.type.replace('image/', '');
  if (optimizeForWhatsApp && actualFormat === 'webp') {
    let q = quality;
    while (blob.size > 100 * 1024 && q > 0.3) {
      q -= 0.1;
      blob = await encodeCanvas(out, 'webp', q);
    }
  }
  return { blob, actualFormat: blob.type.replace('image/', '') };
}

/** Kleine Vorschau für die Projektliste erzeugen */
export function makeThumbnail(
  doc: EditorDoc,
  image: HTMLCanvasElement | null,
  drawing?: HTMLCanvasElement | null,
): Promise<Blob> {
  const c = createCanvas(160, 160);
  composeDoc(c, doc, image, 'fast', drawing);
  return encodeCanvas(c, 'png', 0.9);
}

/** Eindeutige ID (für Ebenen und Projekte) */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
