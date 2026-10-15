import { useState } from 'react';
import { FileText, Info } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { PageHeader, FilePicker, PrimaryButton, ResultCard, Segmented, Field, Progress } from '../components/ui';
import { useToast } from '../components/Toast';
import { baseName, canvasToBlob, formatBytes, isPdf, openForEdit, openForView, pdfBlob, readFile, renderPageAtDpi } from '../lib/pdf';

type Level = 'lossless' | 'low' | 'medium' | 'high';

const LEVELS: Record<Exclude<Level, 'lossless'>, { dpi: number; quality: number }> = {
  low: { dpi: 150, quality: 0.8 },
  medium: { dpi: 120, quality: 0.65 },
  high: { dpi: 96, quality: 0.5 },
};

/** Verlustfrei: Seiten in ein frisches Dokument kopieren (verwaiste Objekte entfallen) und mit Objekt-Streams speichern */
async function compressLossless(bytes: Uint8Array, name: string): Promise<Uint8Array> {
  const src = await openForEdit(bytes, name);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, src.getPageIndices());
  pages.forEach((p) => out.addPage(p));
  out.setTitle(src.getTitle() ?? baseName(name));
  return out.save({ useObjectStreams: true });
}

/** Stark: jede Seite als JPEG neu aufbauen – deutlich kleiner, Text ist danach aber nicht mehr markierbar */
async function compressRaster(
  bytes: Uint8Array,
  dpi: number,
  quality: number,
  onProgress: (v: number) => void,
): Promise<Uint8Array> {
  const view = await openForView(bytes);
  try {
    const out = await PDFDocument.create();
    for (let n = 1; n <= view.numPages; n++) {
      const page = await view.getPage(n);
      const vp = page.getViewport({ scale: 1 }); // berücksichtigt die Seitendrehung
      const canvas = await renderPageAtDpi(view, n, dpi);
      const jpg = await canvasToBlob(canvas, 'image/jpeg', quality);
      const image = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
      const target = out.addPage([vp.width, vp.height]);
      target.drawImage(image, { x: 0, y: 0, width: vp.width, height: vp.height });
      canvas.width = canvas.height = 0; // Speicher sofort freigeben (wichtig auf iPhones)
      onProgress(n / view.numPages);
    }
    return out.save({ useObjectStreams: true });
  } finally {
    view.destroy();
  }
}

export function CompressPage() {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [level, setLevel] = useState<Level>('medium');
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Blob | null>(null);

  const pick = async ([f]: File[]) => {
    if (!isPdf(f)) return toast('Bitte ein PDF wählen', 'error');
    try {
      const bytes = await readFile(f);
      await openForEdit(bytes, f.name);
      setFile({ name: f.name, bytes });
      setResult(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF konnte nicht gelesen werden', 'error');
    }
  };

  const compress = async () => {
    if (!file) return;
    setProgress(0);
    setResult(null);
    try {
      const out =
        level === 'lossless'
          ? await compressLossless(file.bytes, file.name)
          : await compressRaster(file.bytes, LEVELS[level].dpi, LEVELS[level].quality, setProgress);
      setResult(pdfBlob(out));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Komprimieren fehlgeschlagen', 'error');
    } finally {
      setProgress(null);
    }
  };

  const before = file?.bytes.length ?? 0;
  const saved = result ? 1 - result.size / before : 0;

  return (
    <>
      <PageHeader title="PDF komprimieren" />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        {!file ? (
          <FilePicker accept="application/pdf,.pdf" label="PDF auswählen" hint="Verkleinert die Datei, z. B. für E-Mail-Anhänge." onFiles={pick} />
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
              <FileText className="h-8 w-8 shrink-0 text-rose-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(before)}</p>
              </div>
              <FilePicker compact accept="application/pdf,.pdf" label="Andere" onFiles={pick} />
            </div>

            <div className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
              <Field label="Komprimierung">
                <Segmented
                  value={level}
                  onChange={(v) => {
                    setLevel(v);
                    setResult(null);
                  }}
                  options={[
                    { value: 'lossless', label: 'Verlustfrei' },
                    { value: 'low', label: 'Leicht' },
                    { value: 'medium', label: 'Mittel' },
                    { value: 'high', label: 'Stark' },
                  ]}
                />
              </Field>
              <p className="flex gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                {level === 'lossless'
                  ? 'Räumt das PDF auf, ohne die Qualität zu verändern. Text bleibt markierbar – die Ersparnis ist meist gering.'
                  : `Seiten werden als Bild mit ${LEVELS[level].dpi} DPI neu aufgebaut. Ideal für Scans und Fotos; Text ist danach nicht mehr markierbar oder durchsuchbar.`}
              </p>
            </div>

            {progress !== null ? (
              <Progress value={progress} label="Wird komprimiert …" />
            ) : (
              <PrimaryButton onClick={compress}>Komprimieren</PrimaryButton>
            )}

            {result &&
              (saved > 0.01 ? (
                <ResultCard
                  blob={result}
                  filename={`${baseName(file.name)} (komprimiert).pdf`}
                  note={`${formatBytes(before)} → ${formatBytes(result.size)} · ${Math.round(saved * 100)} % kleiner`}
                />
              ) : (
                <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Mit dieser Stufe wird die Datei nicht kleiner ({formatBytes(result.size)}).{' '}
                  {level === 'high'
                    ? 'Das PDF ist bereits sehr kompakt (z. B. reiner Text) – hier lässt sich nichts mehr einsparen.'
                    : 'Das PDF ist bereits gut komprimiert – probiere eine stärkere Stufe.'}
                </p>
              ))}
          </>
        )}
      </main>
    </>
  );
}
