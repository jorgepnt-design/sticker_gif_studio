/**
 * Datenmodell für „Ausfüllen & Unterschreiben“ und das Einbrennen ins PDF.
 *
 * Positionen werden relativ (0–1) zur *angezeigten* Seite gespeichert, also nach
 * Anwendung der Seitendrehung. Beim Export rechnen wir sie in PDF-Koordinaten
 * der ungedrehten Seite zurück und drehen den Inhalt mit, damit er für den
 * Betrachter aufrecht erscheint.
 */
import {
  BlendMode,
  LineCapStyle,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';

export type ItemKind = 'text' | 'check' | 'cross' | 'dot' | 'signature' | 'initials' | 'highlight';

export interface Item {
  id: string;
  page: number; // 0-basiert
  kind: ItemKind;
  x: number; // linke obere Ecke, relativ zur angezeigten Seitenbreite
  y: number; // relativ zur angezeigten Seitenhöhe
  w: number; // Breite relativ (für Text ungenutzt)
  h: number; // Höhe relativ (für Text ungenutzt)
  color: string; // #rrggbb
  text?: string;
  fontSize?: number; // in PDF-Punkten
  image?: string; // PNG-Data-URL (Unterschrift/Initialen)
}

/** Formularwerte, Schlüssel = vollständiger Feldname */
export type FormValues = Record<string, string | boolean>;

// Gemeinsame Textmetrik für Anzeige (CSS) und Export, damit die Grundlinie übereinstimmt.
// Arial: Oberlänge 0,905 em, Inhaltsbereich 1,117 em → bei Zeilenhöhe 1,2 liegt die
// Grundlinie 0,947 em unter der Oberkante der Zeile.
export const TEXT_FONT = 'Arial, Helvetica, sans-serif';
export const LINE_HEIGHT = 1.2;
export const BASELINE = 0.947;

/** SVG-Pfade der Symbole in einem 100×100-Feld */
export const SYMBOL_PATHS: Record<'check' | 'cross' | 'dot', string> = {
  check: 'M 12 52 L 38 80 L 88 18',
  cross: 'M 18 18 L 82 82 M 82 18 L 18 82',
  dot: 'M 50 22 A 28 28 0 1 1 49.99 22 Z',
};

export function todayString(): string {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Ersetzt Zeichen, die die Standardschrift nicht darstellen kann (z. B. Emojis) */
function encodable(font: PDFFont, text: string): string {
  let out = '';
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
    }
  }
  return out;
}

/** Abbildung relativer Anzeige-Koordinaten (u, v) auf PDF-Koordinaten der Seite */
function pageMapper(page: PDFPage) {
  const box = page.getCropBox();
  const r = ((page.getRotation().angle % 360) + 360) % 360;
  const turned = r === 90 || r === 270;
  const dispW = turned ? box.height : box.width;
  const dispH = turned ? box.width : box.height;
  const toPdf = (u: number, v: number) => {
    switch (r) {
      case 90:
        return { x: box.x + v * box.width, y: box.y + u * box.height };
      case 180:
        return { x: box.x + (1 - u) * box.width, y: box.y + v * box.height };
      case 270:
        return { x: box.x + (1 - v) * box.width, y: box.y + (1 - u) * box.height };
      default:
        return { x: box.x + u * box.width, y: box.y + (1 - v) * box.height };
    }
  };
  return { toPdf, dispW, dispH, rotate: degrees(r) };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Trägt Formularwerte ein; gibt die Namen der Felder zurück, die nicht gesetzt werden konnten */
function fillForm(doc: PDFDocument, values: FormValues, font: PDFFont): string[] {
  const failed: string[] = [];
  const form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    try {
      const field = form.getField(name);
      if (field instanceof PDFTextField) field.setText(encodable(font, String(value)));
      else if (field instanceof PDFCheckBox) (value ? field.check() : field.uncheck());
      else if (field instanceof PDFRadioGroup) {
        if (typeof value === 'string' && value) {
          // Bei Gruppen mit /Opt-Liste meldet pdf.js den Index ("0", "1" …) statt des Optionsnamens
          const options = field.getOptions();
          const index = Number(value);
          field.select(options.includes(value) || !Number.isInteger(index) ? value : options[index]);
        }
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        if (typeof value === 'string' && value) field.select(value);
      }
    } catch {
      failed.push(name);
    }
  }
  return failed;
}

export async function applyToPdf(
  bytes: Uint8Array,
  items: Item[],
  formValues: FormValues,
  flatten: boolean,
): Promise<{ bytes: Uint8Array; failedFields: string[] }> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  const failedFields = Object.keys(formValues).length ? fillForm(doc, formValues, font) : [];
  if (Object.keys(formValues).length || flatten) {
    const form = doc.getForm();
    form.updateFieldAppearances(font);
    if (flatten) form.flatten();
  }

  for (const item of items) {
    const page = pages[item.page];
    if (!page) continue;
    const { toPdf, dispW, dispH, rotate } = pageMapper(page);
    const color = hexToRgb(item.color);

    if (item.kind === 'text') {
      const size = item.fontSize ?? 12;
      const lines = encodable(font, item.text ?? '').split('\n');
      lines.forEach((line, i) => {
        if (!line) return;
        const v = item.y + (size * (BASELINE + LINE_HEIGHT * i)) / dispH;
        const p = toPdf(item.x, v);
        page.drawText(line, { x: p.x, y: p.y, size, font, color, rotate });
      });
    } else if (item.kind === 'highlight') {
      const p = toPdf(item.x, item.y + item.h);
      page.drawRectangle({
        x: p.x,
        y: p.y,
        width: item.w * dispW,
        height: item.h * dispH,
        color,
        opacity: 0.45,
        blendMode: BlendMode.Multiply,
        rotate,
      });
    } else if (item.kind === 'signature' || item.kind === 'initials') {
      if (!item.image) continue;
      const png = await doc.embedPng(dataUrlToBytes(item.image));
      const p = toPdf(item.x, item.y + item.h);
      page.drawImage(png, { x: p.x, y: p.y, width: item.w * dispW, height: item.h * dispH, rotate });
    } else {
      const p = toPdf(item.x, item.y);
      const width = item.w * dispW;
      page.drawSvgPath(SYMBOL_PATHS[item.kind], {
        x: p.x,
        y: p.y,
        scale: width / 100,
        rotate,
        ...(item.kind === 'dot'
          ? { color }
          : { borderColor: color, borderWidth: 12, borderLineCap: LineCapStyle.Round }),
      });
    }
  }

  return { bytes: await doc.save(), failedFields };
}
