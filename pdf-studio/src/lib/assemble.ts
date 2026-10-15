/** Baut aus einer Seitenliste (aus einer oder mehreren Quell-PDFs) ein neues PDF */
import { PDFDocument, degrees, type PDFPage } from 'pdf-lib';
import { openForEdit } from './pdf';

export interface SourcePdf {
  name: string;
  bytes: Uint8Array;
}

export interface PageRef {
  source: number; // Index in der Quellliste
  index: number; // Seitenindex (0-basiert) in der Quelle
  rotation: number; // zusätzliche Drehung in Grad (Vielfaches von 90)
}

export async function assemblePdf(sources: SourcePdf[], pages: PageRef[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  // Pro Quelle in einem Rutsch kopieren, damit gemeinsame Schriften/Bilder nur einmal übernommen werden
  const copied = new Map<PageRef, PDFPage>();
  for (const sourceIndex of new Set(pages.map((p) => p.source))) {
    const refs = pages.filter((p) => p.source === sourceIndex);
    const src = await openForEdit(sources[sourceIndex].bytes, sources[sourceIndex].name);
    const result = await out.copyPages(
      src,
      refs.map((r) => r.index),
    );
    refs.forEach((r, i) => copied.set(r, result[i]));
  }
  for (const ref of pages) {
    const page = copied.get(ref)!;
    if (ref.rotation) {
      page.setRotation(degrees((((page.getRotation().angle + ref.rotation) % 360) + 360) % 360));
    }
    out.addPage(page);
  }
  return out.save();
}
