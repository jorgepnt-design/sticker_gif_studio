/**
 * PDF-Grundfunktionen: Anzeigen mit pdf.js, Bearbeiten mit pdf-lib.
 * Alles läuft lokal im Browser – keine Datei verlässt das Gerät.
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfJsDoc = pdfjs.PDFDocumentProxy;
export type PdfJsPage = pdfjs.PDFPageProxy;
export const AnnotationMode = pdfjs.AnnotationMode;

export class EncryptedPdfError extends Error {
  constructor(name: string) {
    super(`„${name}“ ist passwortgeschützt und kann nicht bearbeitet werden.`);
  }
}

/** Öffnet ein PDF zur Anzeige. pdf.js übernimmt den Puffer, daher eine Kopie übergeben. */
export async function openForView(bytes: Uint8Array): Promise<PdfJsDoc> {
  return pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
}

/** Öffnet ein PDF zur Bearbeitung und lehnt verschlüsselte Dateien mit klarer Meldung ab. */
export async function openForEdit(bytes: Uint8Array, name = 'Datei'): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (err) {
    if (err instanceof Error && /encrypted/i.test(err.message)) throw new EncryptedPdfError(name);
    throw err;
  }
}

/**
 * Rendert eine Seite in ein Canvas der gewünschten CSS-Breite.
 * Die Pixeldichte folgt dem Gerät (begrenzt, damit iPhones nicht aus dem Speicher laufen).
 */
export async function renderPage(
  doc: PdfJsDoc,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  extraRotation = 0,
): Promise<void> {
  const page = await doc.getPage(pageNumber);
  const rotation = (page.rotate + extraRotation) % 360;
  const base = page.getViewport({ scale: 1, rotation });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr, rotation });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${(cssWidth * base.height) / base.width}px`;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
}

/** Rendert eine Seite mit fester Auflösung (DPI) in ein neues Canvas – für Export und Komprimierung. */
export async function renderPageAtDpi(doc: PdfJsDoc, pageNumber: number, dpi: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: dpi / 72 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d')!;
  // Weißer Hintergrund, damit JPEG-Export keine schwarzen Flächen bekommt
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht erzeugt werden'))), type, quality),
  );
}

export async function readFile(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes], { type: 'application/pdf' });
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}
