import { useState } from 'react';
import { FileText } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { PageHeader, FilePicker, PrimaryButton, ResultCard } from '../components/ui';
import { FileList } from '../components/FileList';
import { useToast } from '../components/Toast';
import { formatBytes, isPdf, openForEdit, pdfBlob, readFile } from '../lib/pdf';
import { uid } from '../lib/uid';

interface PdfItem {
  id: string;
  name: string;
  size: number;
  pages: number;
  bytes: Uint8Array;
}

export function MergePage() {
  const toast = useToast();
  const [items, setItems] = useState<PdfItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);

  const addFiles = async (files: File[]) => {
    const added: PdfItem[] = [];
    for (const file of files) {
      if (!isPdf(file)) {
        toast(`„${file.name}“ ist kein PDF`, 'error');
        continue;
      }
      try {
        const bytes = await readFile(file);
        const doc = await openForEdit(bytes, file.name);
        added.push({ id: uid(), name: file.name, size: file.size, pages: doc.getPageCount(), bytes });
      } catch (err) {
        toast(err instanceof Error ? err.message : `„${file.name}“ konnte nicht gelesen werden`, 'error');
      }
    }
    setItems((list) => [...list, ...added]);
    setResult(null);
  };

  const merge = async () => {
    setBusy(true);
    try {
      const out = await PDFDocument.create();
      for (const item of items) {
        const src = await openForEdit(item.bytes, item.name);
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      setResult(pdfBlob(await out.save()));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Zusammenfügen fehlgeschlagen', 'error');
    } finally {
      setBusy(false);
    }
  };

  const totalPages = items.reduce((n, i) => n + i.pages, 0);

  return (
    <>
      <PageHeader
        title="PDFs zusammenfügen"
        subtitle={items.length ? `${items.length} Dateien · ${totalPages} Seiten` : undefined}
        right={items.length > 0 && <FilePicker compact accept="application/pdf,.pdf" multiple label="Mehr" onFiles={addFiles} />}
      />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        {items.length === 0 ? (
          <FilePicker
            accept="application/pdf,.pdf"
            multiple
            label="PDFs auswählen"
            hint="Wähle zwei oder mehr PDFs. Die Reihenfolge kannst du danach ändern."
            onFiles={addFiles}
          />
        ) : (
          <FileList
            items={items}
            onChange={(next) => {
              setItems(next);
              setResult(null);
            }}
            render={(item) => (
              <>
                <FileText className="h-8 w-8 shrink-0 text-rose-500" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {item.pages} {item.pages === 1 ? 'Seite' : 'Seiten'} · {formatBytes(item.size)}
                  </p>
                </div>
              </>
            )}
          />
        )}
        {items.length > 0 && (
          <PrimaryButton onClick={merge} busy={busy} disabled={items.length < 2}>
            {items.length < 2 ? 'Mindestens 2 PDFs wählen' : `${items.length} PDFs zusammenfügen`}
          </PrimaryButton>
        )}
        {result && <ResultCard blob={result} filename="Zusammengefügt.pdf" />}
      </main>
    </>
  );
}
