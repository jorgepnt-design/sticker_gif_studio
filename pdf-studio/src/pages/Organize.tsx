import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckSquare, ChevronLeft, ChevronRight, RotateCcw, RotateCw, Scissors, Trash2, FileOutput, Check } from 'lucide-react';
import { PageHeader, FilePicker, PrimaryButton, ResultCard, PageThumb, Progress } from '../components/ui';
import { moveItem } from '../components/FileList';
import { useToast } from '../components/Toast';
import { baseName, isPdf, openForEdit, openForView, pdfBlob, readFile, type PdfJsDoc } from '../lib/pdf';
import { assemblePdf, type PageRef, type SourcePdf } from '../lib/assemble';
import { zipFiles } from '../lib/share';
import { uid } from '../lib/uid';

interface PageItem extends PageRef {
  id: string;
}

interface Source extends SourcePdf {
  view: PdfJsDoc;
}

const THUMB = 132;

export function OrganizePage() {
  const toast = useToast();
  const [sources, setSources] = useState<Source[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string; note?: string } | null>(null);
  const [splitEvery, setSplitEvery] = useState(1);

  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  useEffect(() => () => sourcesRef.current.forEach((s) => s.view.destroy()), []);

  const addFiles = async (files: File[]) => {
    const nextSources = sources.slice();
    const nextPages: PageItem[] = [];
    for (const file of files) {
      if (!isPdf(file)) {
        toast(`„${file.name}“ ist kein PDF`, 'error');
        continue;
      }
      try {
        const bytes = await readFile(file);
        await openForEdit(bytes, file.name); // prüft Verschlüsselung früh
        const view = await openForView(bytes);
        const sourceIndex = nextSources.length;
        nextSources.push({ name: file.name, bytes, view });
        for (let i = 0; i < view.numPages; i++) nextPages.push({ id: uid(), source: sourceIndex, index: i, rotation: 0 });
      } catch (err) {
        toast(err instanceof Error ? err.message : `„${file.name}“ konnte nicht gelesen werden`, 'error');
      }
    }
    setSources(nextSources);
    setPages((p) => [...p, ...nextPages]);
    setResult(null);
  };

  const change = (next: PageItem[]) => {
    setPages(next);
    setResult(null);
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const rotateSelected = (delta: number) =>
    change(pages.map((p) => (selected.has(p.id) ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p)));

  const deleteSelected = () => {
    if (selected.size === pages.length) {
      toast('Mindestens eine Seite muss bleiben', 'error');
      return;
    }
    change(pages.filter((p) => !selected.has(p.id)));
    setSelected(new Set());
  };

  const outName = sources.length ? baseName(sources[0].name) : 'Dokument';

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(label);
    setResult(null);
    try {
      await job();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Vorgang fehlgeschlagen', 'error');
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const saveAll = () =>
    run('save', async () => {
      setResult({ blob: pdfBlob(await assemblePdf(sources, pages)), name: `${outName}.pdf` });
    });

  const extract = () =>
    run('extract', async () => {
      const chosen = pages.filter((p) => selected.has(p.id));
      setResult({
        blob: pdfBlob(await assemblePdf(sources, chosen)),
        name: `${outName} (Auszug).pdf`,
        note: `${chosen.length} ausgewählte Seiten`,
      });
    });

  const split = () =>
    run('split', async () => {
      const files: { name: string; blob: Blob }[] = [];
      const groups = Math.ceil(pages.length / splitEvery);
      for (let g = 0; g < groups; g++) {
        const part = pages.slice(g * splitEvery, (g + 1) * splitEvery);
        const from = g * splitEvery + 1;
        const to = from + part.length - 1;
        const label = from === to ? `Seite ${from}` : `Seiten ${from}-${to}`;
        files.push({ name: `${outName} – ${label}.pdf`, blob: pdfBlob(await assemblePdf(sources, part)) });
        setProgress((g + 1) / groups);
      }
      setResult({ blob: await zipFiles(files), name: `${outName} (aufgeteilt).zip`, note: `${files.length} PDF-Dateien im ZIP` });
    });

  const allSelected = pages.length > 0 && selected.size === pages.length;

  return (
    <>
      <PageHeader
        title="Seiten organisieren"
        subtitle={pages.length ? `${pages.length} Seiten · ${selected.size} ausgewählt` : undefined}
        right={pages.length > 0 && <FilePicker compact accept="application/pdf,.pdf" multiple label="PDF" onFiles={addFiles} />}
      />
      <main className="mx-auto max-w-3xl space-y-4 p-4 pb-40">
        {pages.length === 0 ? (
          <FilePicker
            accept="application/pdf,.pdf"
            multiple
            label="PDF auswählen"
            hint="Seiten sortieren, drehen, löschen, extrahieren oder das PDF aufteilen."
            onFiles={addFiles}
          />
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <p className="text-slate-500 dark:text-slate-400">Tippe Seiten an, um sie auszuwählen.</p>
              <button
                onClick={() => setSelected(allSelected ? new Set() : new Set(pages.map((p) => p.id)))}
                className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400"
              >
                <CheckSquare className="h-4 w-4" /> {allSelected ? 'Keine' : 'Alle'}
              </button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3">
              {pages.map((p, i) => {
                const isSel = selected.has(p.id);
                return (
                  <div key={p.id} className="flex flex-col items-center gap-1.5">
                    <button
                      onClick={() => toggle(p.id)}
                      className={`relative rounded-xl p-1.5 transition-colors ${isSel ? 'bg-rose-500/90' : 'bg-transparent'}`}
                    >
                      <PageThumb doc={sources[p.source].view} pageNumber={p.index + 1} width={THUMB} rotation={p.rotation} />
                      {isSel && (
                        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => change(moveItem(pages, i, -1))} disabled={i === 0} className="rounded-full p-1 text-slate-500 disabled:opacity-25" aria-label="Nach vorne">
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <span className="w-14 text-center text-xs font-semibold text-slate-500">
                        {i + 1}
                        {sources.length > 1 && <span className="block truncate text-[10px] font-normal">{baseName(sources[p.source].name)}</span>}
                      </span>
                      <button onClick={() => change(moveItem(pages, i, 1))} disabled={i === pages.length - 1} className="rounded-full p-1 text-slate-500 disabled:opacity-25" aria-label="Nach hinten">
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
              <p className="flex items-center gap-2 font-bold">
                <Scissors className="h-5 w-5 text-rose-500" /> PDF aufteilen
              </p>
              <label className="flex items-center gap-3 text-sm">
                Alle
                <input
                  type="number"
                  min={1}
                  max={pages.length}
                  value={splitEvery}
                  onChange={(e) => setSplitEvery(Math.max(1, Math.min(pages.length, Number(e.target.value) || 1)))}
                  className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base dark:border-slate-700 dark:bg-slate-800"
                />
                Seiten eine neue Datei ({Math.ceil(pages.length / splitEvery)} Dateien)
              </label>
              {busy === 'split' && progress !== null ? (
                <Progress value={progress} label="Wird aufgeteilt …" />
              ) : (
                <button
                  onClick={split}
                  disabled={!!busy}
                  className="w-full rounded-2xl bg-slate-100 py-3 font-semibold text-slate-700 active:scale-[0.98] disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200"
                >
                  Als ZIP aufteilen
                </button>
              )}
            </div>

            {result && <ResultCard blob={result.blob} filename={result.name} note={result.note} />}
          </>
        )}
      </main>

      {pages.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/60 bg-white/95 backdrop-blur-lg safe-bottom dark:border-slate-700/60 dark:bg-slate-900/95">
          <div className="mx-auto max-w-3xl space-y-2 p-3">
            {selected.size > 0 && (
              <div className="grid grid-cols-4 gap-2">
                <ToolButton icon={<RotateCcw />} label="Links" onClick={() => rotateSelected(-90)} />
                <ToolButton icon={<RotateCw />} label="Rechts" onClick={() => rotateSelected(90)} />
                <ToolButton icon={<Trash2 />} label="Löschen" onClick={deleteSelected} danger />
                <ToolButton icon={<FileOutput />} label="Extrahieren" onClick={extract} disabled={!!busy} />
              </div>
            )}
            <PrimaryButton onClick={saveAll} busy={busy === 'save'} disabled={!!busy}>
              PDF speichern
            </PrimaryButton>
          </div>
        </div>
      )}
    </>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 rounded-2xl bg-slate-100 py-2 text-xs font-semibold active:scale-95 disabled:opacity-40 dark:bg-slate-800 [&_svg]:h-5 [&_svg]:w-5 ${
        danger ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
