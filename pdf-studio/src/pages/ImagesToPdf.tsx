import { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { PageHeader, FilePicker, PrimaryButton, ResultCard, Segmented, Field, Progress } from '../components/ui';
import { FileList } from '../components/FileList';
import { useToast } from '../components/Toast';
import { canvasToBlob, pdfBlob } from '../lib/pdf';
import { uid } from '../lib/uid';

interface ImageItem {
  id: string;
  file: File;
  url: string;
}

type PageSize = 'image' | 'a4' | 'letter';
type Orientation = 'auto' | 'portrait' | 'landscape';
type Margin = 0 | 18 | 36;

// Seitengrößen in PDF-Punkten (1 pt = 1/72 Zoll)
const SIZES: Record<Exclude<PageSize, 'image'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};
const MAX_SIDE = 4000;

/**
 * Lädt ein Bild über ein <img>-Element: Browser wenden dabei die EXIF-Drehung an,
 * damit Handyfotos nicht seitlich im PDF landen. Anschließend wird es neu kodiert.
 */
async function encodeImage(file: File): Promise<{ bytes: Uint8Array; png: boolean; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d')!;
    const png = file.type === 'image/png';
    if (!png) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, png ? 'image/png' : 'image/jpeg', 0.9);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), png, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ImagesToPdfPage() {
  const toast = useToast();
  const [items, setItems] = useState<ImageItem[]>([]);
  const [size, setSize] = useState<PageSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [margin, setMargin] = useState<Margin>(18);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Blob | null>(null);

  // Vorschau-URLs beim Verlassen freigeben
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const addFiles = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length < files.length) toast('Nur Bilddateien werden übernommen', 'info');
    setItems((list) => [...list, ...images.map((file) => ({ id: uid(), file, url: URL.createObjectURL(file) }))]);
    setResult(null);
  };

  const build = async () => {
    setProgress(0);
    setResult(null);
    try {
      const doc = await PDFDocument.create();
      for (let i = 0; i < items.length; i++) {
        const enc = await encodeImage(items[i].file);
        const image = enc.png ? await doc.embedPng(enc.bytes) : await doc.embedJpg(enc.bytes);
        const landscapeImage = enc.width > enc.height;

        let pageW: number;
        let pageH: number;
        if (size === 'image') {
          // Bild in Originalgröße bei 150 DPI, Rand außen herum
          pageW = (enc.width * 72) / 150 + margin * 2;
          pageH = (enc.height * 72) / 150 + margin * 2;
        } else {
          const [w, h] = SIZES[size];
          const landscape = orientation === 'landscape' || (orientation === 'auto' && landscapeImage);
          [pageW, pageH] = landscape ? [h, w] : [w, h];
        }
        const page = doc.addPage([pageW, pageH]);
        const boxW = pageW - margin * 2;
        const boxH = pageH - margin * 2;
        const scale = Math.min(boxW / enc.width, boxH / enc.height);
        const w = enc.width * scale;
        const h = enc.height * scale;
        page.drawImage(image, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
        setProgress((i + 1) / items.length);
      }
      setResult(pdfBlob(await doc.save()));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF konnte nicht erstellt werden', 'error');
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Bilder in PDF"
        subtitle={items.length ? `${items.length} Bilder` : undefined}
        right={items.length > 0 && <FilePicker compact accept="image/*" multiple label="Mehr" onFiles={addFiles} />}
      />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        {items.length === 0 ? (
          <FilePicker
            accept="image/*"
            multiple
            label="Bilder auswählen"
            hint="Fotos, Scans oder Screenshots – jedes Bild wird eine Seite."
            onFiles={addFiles}
          />
        ) : (
          <>
            <FileList
              items={items}
              onChange={(next) => {
                setItems(next);
                setResult(null);
              }}
              render={(item) => (
                <>
                  <img src={item.url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  <p className="truncate text-sm font-semibold">{item.file.name}</p>
                </>
              )}
            />
            <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
              <Field label="Seitengröße">
                <Segmented
                  value={size}
                  onChange={setSize}
                  options={[
                    { value: 'a4', label: 'A4' },
                    { value: 'letter', label: 'US Letter' },
                    { value: 'image', label: 'Wie Bild' },
                  ]}
                />
              </Field>
              {size !== 'image' && (
                <Field label="Ausrichtung">
                  <Segmented
                    value={orientation}
                    onChange={setOrientation}
                    options={[
                      { value: 'auto', label: 'Automatisch' },
                      { value: 'portrait', label: 'Hoch' },
                      { value: 'landscape', label: 'Quer' },
                    ]}
                  />
                </Field>
              )}
              <Field label="Rand">
                <Segmented
                  value={margin}
                  onChange={setMargin}
                  options={[
                    { value: 0, label: 'Kein' },
                    { value: 18, label: 'Klein' },
                    { value: 36, label: 'Groß' },
                  ]}
                />
              </Field>
            </div>
            {progress !== null ? (
              <Progress value={progress} label="Seiten werden erstellt …" />
            ) : (
              <PrimaryButton onClick={build}>PDF erstellen</PrimaryButton>
            )}
          </>
        )}
        {result && <ResultCard blob={result} filename="Bilder.pdf" />}
      </main>
    </>
  );
}
