import { useEffect, useRef, useState } from 'react';
import { PageHeader, FilePicker, PrimaryButton, ResultCard, Segmented, Field, Progress, PageThumb } from '../components/ui';
import { useToast } from '../components/Toast';
import { baseName, canvasToBlob, isPdf, openForEdit, openForView, readFile, renderPageAtDpi, type PdfJsDoc } from '../lib/pdf';
import { zipFiles } from '../lib/share';

type Format = 'png' | 'jpg';

export function PdfToImagesPage() {
  const toast = useToast();
  const [doc, setDoc] = useState<{ name: string; view: PdfJsDoc } | null>(null);
  const [format, setFormat] = useState<Format>('jpg');
  const [dpi, setDpi] = useState(150);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const docRef = useRef(doc);
  docRef.current = doc;
  useEffect(() => () => void docRef.current?.view.destroy(), []);

  const pick = async ([f]: File[]) => {
    if (!isPdf(f)) return toast('Bitte ein PDF wählen', 'error');
    try {
      const bytes = await readFile(f);
      await openForEdit(bytes, f.name);
      doc?.view.destroy();
      setDoc({ name: f.name, view: await openForView(bytes) });
      setResult(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF konnte nicht gelesen werden', 'error');
    }
  };

  const convert = async () => {
    if (!doc) return;
    setProgress(0);
    setResult(null);
    try {
      const type = format === 'png' ? 'image/png' : 'image/jpeg';
      const files: { name: string; blob: Blob }[] = [];
      const pad = String(doc.view.numPages).length;
      for (let n = 1; n <= doc.view.numPages; n++) {
        const canvas = await renderPageAtDpi(doc.view, n, dpi);
        files.push({
          name: `${baseName(doc.name)} – Seite ${String(n).padStart(pad, '0')}.${format}`,
          blob: await canvasToBlob(canvas, type, 0.9),
        });
        canvas.width = canvas.height = 0;
        setProgress(n / doc.view.numPages);
      }
      setResult(
        files.length === 1
          ? { blob: files[0].blob, name: files[0].name }
          : { blob: await zipFiles(files), name: `${baseName(doc.name)} (Bilder).zip` },
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Umwandeln fehlgeschlagen', 'error');
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      <PageHeader title="PDF in Bilder" subtitle={doc ? `${doc.name} · ${doc.view.numPages} Seiten` : undefined} right={doc && <FilePicker compact accept="application/pdf,.pdf" label="Andere" onFiles={pick} />} />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        {!doc ? (
          <FilePicker accept="application/pdf,.pdf" label="PDF auswählen" hint="Jede Seite wird ein Bild. Mehrere Seiten kommen als ZIP." onFiles={pick} />
        ) : (
          <>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Array.from({ length: Math.min(doc.view.numPages, 20) }, (_, i) => (
                <div key={i} className="shrink-0">
                  <PageThumb doc={doc.view} pageNumber={i + 1} width={96} />
                </div>
              ))}
            </div>
            <div className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
              <Field label="Format">
                <Segmented
                  value={format}
                  onChange={setFormat}
                  options={[
                    { value: 'jpg', label: 'JPG (kleiner)' },
                    { value: 'png', label: 'PNG (verlustfrei)' },
                  ]}
                />
              </Field>
              <Field label="Auflösung">
                <Segmented
                  value={dpi}
                  onChange={setDpi}
                  options={[
                    { value: 72, label: 'Bildschirm' },
                    { value: 150, label: 'Standard' },
                    { value: 300, label: 'Druck' },
                  ]}
                />
              </Field>
            </div>
            {progress !== null ? <Progress value={progress} label="Seiten werden umgewandelt …" /> : <PrimaryButton onClick={convert}>In Bilder umwandeln</PrimaryButton>}
            {result && <ResultCard blob={result.blob} filename={result.name} />}
          </>
        )}
      </main>
    </>
  );
}
