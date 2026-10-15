import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CalendarDays,
  Check,
  Circle,
  Copy,
  Highlighter,
  MousePointer2,
  PenLine,
  Pencil,
  Signature,
  Trash2,
  Type,
  X,
  Minus,
  Plus,
} from 'lucide-react';
import { PageHeader, FilePicker, ResultCard } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { baseName, isPdf, openForEdit, openForView, pdfBlob, readFile, type PdfJsDoc } from '../../lib/pdf';
import { uid } from '../../lib/uid';
import { applyToPdf, todayString, type FormValues, type Item } from './model';
import { PageView, type PlaceInfo } from './PageView';
import { SignaturePad, loadSignature, type SignatureKind } from './SignaturePad';

type Tool = 'select' | 'text' | 'date' | 'check' | 'cross' | 'dot' | 'highlight' | 'signature' | 'initials';

const TOOLS: { id: Tool; label: string; icon: ReactNode }[] = [
  { id: 'select', label: 'Auswahl', icon: <MousePointer2 /> },
  { id: 'text', label: 'Text', icon: <Type /> },
  { id: 'signature', label: 'Unterschrift', icon: <Signature /> },
  { id: 'initials', label: 'Initialen', icon: <PenLine /> },
  { id: 'date', label: 'Datum', icon: <CalendarDays /> },
  { id: 'check', label: 'Haken', icon: <Check /> },
  { id: 'cross', label: 'Kreuz', icon: <X /> },
  { id: 'dot', label: 'Punkt', icon: <Circle className="fill-current" /> },
  { id: 'highlight', label: 'Markieren', icon: <Highlighter /> },
];

const COLORS = ['#111827', '#1d4ed8', '#dc2626'];
const HIGHLIGHTS = ['#fde047', '#86efac', '#f9a8d4'];

/** Bildseitenverhältnis (Höhe/Breite) einer Data-URL */
function imageAspect(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalHeight / img.naturalWidth || 0.4);
    img.onerror = () => resolve(0.4);
    img.src = dataUrl;
  });
}

export function FillSignPage() {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; view: PdfJsDoc } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(COLORS[0]);
  const [pad, setPad] = useState<SignatureKind | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [flatten, setFlatten] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [width, setWidth] = useState(600);
  const mainRef = useRef<HTMLElement>(null);

  const fileRef = useRef(file);
  fileRef.current = file;
  useEffect(() => () => void fileRef.current?.view.destroy(), []);

  // Seitenbreite an den verfügbaren Platz anpassen
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.min(900, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [file]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const dirty = items.length > 0 || Object.keys(formValues).length > 0;

  // Warnen, bevor ungespeicherte Änderungen verloren gehen
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const update = useCallback((id: string, patch: Partial<Item>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setResult(null);
  }, []);

  const remove = useCallback((id: string) => {
    setItems((list) => list.filter((i) => i.id !== id));
    setSelectedId(null);
    setResult(null);
  }, []);

  // Entf-Taste löscht das ausgewählte Element (Desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!selectedId || editing || /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') remove(selectedId);
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, editing, remove]);

  const pick = async ([f]: File[]) => {
    if (!isPdf(f)) return toast('Bitte ein PDF wählen', 'error');
    try {
      const bytes = await readFile(f);
      await openForEdit(bytes, f.name);
      file?.view.destroy();
      setFile({ name: f.name, bytes, view: await openForView(bytes) });
      setItems([]);
      setFormValues({});
      setResult(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF konnte nicht gelesen werden', 'error');
    }
  };

  const chooseTool = (t: Tool) => {
    setSelectedId(null);
    if ((t === 'signature' || t === 'initials') && !loadSignature(t)) {
      setPad(t); // erst Unterschrift anlegen, danach platzieren
      return;
    }
    setTool(t);
  };

  const place = async ({ page, u, v, widthPt, heightPt }: PlaceInfo) => {
    const base = { id: uid(), page, color };
    let item: Item;
    switch (tool) {
      case 'text':
      case 'date': {
        const fontSize = 12;
        item = {
          ...base,
          kind: 'text',
          text: tool === 'date' ? todayString() : '',
          fontSize,
          // Tippen markiert ungefähr die Mitte der ersten Zeile
          x: u,
          y: v - (fontSize * 0.6) / heightPt,
          w: 0,
          h: 0,
        };
        break;
      }
      case 'check':
      case 'cross':
      case 'dot': {
        const s = 14;
        item = { ...base, kind: tool, x: u - s / 2 / widthPt, y: v - s / 2 / heightPt, w: s / widthPt, h: s / heightPt };
        break;
      }
      case 'highlight': {
        const w = 150;
        const h = 14;
        item = { ...base, kind: 'highlight', color: HIGHLIGHTS[0], x: u - w / 2 / widthPt, y: v - h / 2 / heightPt, w: w / widthPt, h: h / heightPt };
        break;
      }
      case 'signature':
      case 'initials': {
        const image = loadSignature(tool);
        if (!image) return;
        const aspect = await imageAspect(image);
        const w = tool === 'signature' ? 150 : 60;
        const h = w * aspect;
        item = { ...base, kind: tool, image, x: u - w / 2 / widthPt, y: v - h / 2 / heightPt, w: w / widthPt, h: h / heightPt };
        break;
      }
      default:
        return;
    }
    setItems((list) => [...list, item]);
    setSelectedId(item.id);
    setTool('select');
    setResult(null);
    if (tool === 'text') setEditing({ id: item.id, text: '' });
  };

  const finishEdit = () => {
    if (!editing) return;
    if (editing.text.trim()) update(editing.id, { text: editing.text });
    else remove(editing.id);
    setEditing(null);
  };

  const duplicate = (item: Item) => {
    const copy = { ...item, id: uid(), x: item.x + 0.02, y: item.y + 0.02 };
    setItems((list) => [...list, copy]);
    setSelectedId(copy.id);
  };

  const save = async (lockForm = flatten) => {
    if (!file) return;
    setSaving(true);
    setSelectedId(null);
    try {
      const out = await applyToPdf(file.bytes, items, formValues, lockForm);
      if (out.failedFields.length) toast(`${out.failedFields.length} Formularfeld(er) konnten nicht gesetzt werden`, 'error');
      setResult(pdfBlob(out.bytes));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onPadDone = async (dataUrl: string) => {
    const kind = pad!;
    setPad(null);
    // Ausgewählte Unterschrift ersetzen oder Werkzeug zum Platzieren aktivieren
    if (selected && selected.kind === kind) {
      // Breite behalten, Höhe an das Seitenverhältnis der neuen Unterschrift anpassen
      const [oldAspect, newAspect] = await Promise.all([imageAspect(selected.image ?? dataUrl), imageAspect(dataUrl)]);
      update(selected.id, { image: dataUrl, h: (selected.h * newAspect) / oldAspect });
    } else {
      setTool(kind);
    }
  };

  if (!file) {
    return (
      <>
        <PageHeader title="Ausfüllen & Unterschreiben" />
        <main className="mx-auto max-w-3xl p-4">
          <FilePicker
            accept="application/pdf,.pdf"
            label="PDF auswählen"
            hint="Formulare ausfüllen, Text, Häkchen und Datum setzen und unterschreiben."
            onFiles={pick}
          />
        </main>
      </>
    );
  }

  const hint =
    tool === 'select'
      ? null
      : `Tippe auf die Seite, um ${
          { text: 'Text', date: 'das Datum', check: 'ein Häkchen', cross: 'ein Kreuz', dot: 'einen Punkt', highlight: 'eine Markierung', signature: 'deine Unterschrift', initials: 'deine Initialen' }[tool]
        } zu platzieren`;

  return (
    <>
      <PageHeader
        title="Ausfüllen & Unterschreiben"
        subtitle={`${file.name} · ${file.view.numPages} ${file.view.numPages === 1 ? 'Seite' : 'Seiten'}`}
        right={
          <button
            onClick={() => save()}
            disabled={saving}
            className="rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Speichert …' : 'Fertig'}
          </button>
        }
      />

      <main ref={mainRef} className="mx-auto max-w-[932px] space-y-4 px-4 pb-48 pt-4">
        {hint && (
          // Fest positioniert und nicht antippbar: verschiebt die Seiten nicht und fängt keine Tipps ab
          <p className="page-in pointer-events-none fixed inset-x-0 top-20 z-30 mx-auto w-fit max-w-[90vw] rounded-full bg-slate-900/90 px-4 py-2 text-center text-sm font-medium text-white shadow-lg">
            {hint}
          </p>
        )}
        {Array.from({ length: file.view.numPages }, (_, i) => (
          <PageView
            key={i}
            doc={file.view}
            pageIndex={i}
            width={width}
            items={items.filter((it) => it.page === i)}
            selectedId={selectedId}
            placing={tool !== 'select'}
            formValues={formValues}
            onFormChange={(name, value) => {
              setFormValues((v) => ({ ...v, [name]: value }));
              setResult(null);
            }}
            onPlace={place}
            onSelect={setSelectedId}
            onUpdate={update}
            onEditText={(id) => setEditing({ id, text: items.find((x) => x.id === id)?.text ?? '' })}
          />
        ))}
      </main>

      {/* Untere Leiste: Kontextaktionen für das ausgewählte Element, darunter die Werkzeuge */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/60 bg-white/95 backdrop-blur-lg safe-bottom dark:border-slate-700/60 dark:bg-slate-900/95">
        {selected && (
          <div className="page-in mx-auto flex max-w-3xl items-center gap-1.5 overflow-x-auto border-b border-slate-200/60 px-3 py-2 dark:border-slate-700/60">
            {selected.kind === 'text' && (
              <>
                <Chip onClick={() => setEditing({ id: selected.id, text: selected.text ?? '' })}>
                  <Pencil className="h-4 w-4" /> Bearbeiten
                </Chip>
                <Chip onClick={() => update(selected.id, { fontSize: Math.max(6, (selected.fontSize ?? 12) - 1) })} label="Kleiner">
                  <Minus className="h-4 w-4" />
                </Chip>
                <span className="w-8 text-center text-sm font-semibold tabular-nums">{selected.fontSize ?? 12}</span>
                <Chip onClick={() => update(selected.id, { fontSize: Math.min(72, (selected.fontSize ?? 12) + 1) })} label="Größer">
                  <Plus className="h-4 w-4" />
                </Chip>
              </>
            )}
            {(selected.kind === 'signature' || selected.kind === 'initials') && (
              <Chip onClick={() => setPad(selected.kind as SignatureKind)}>
                <PenLine className="h-4 w-4" /> Neu zeichnen
              </Chip>
            )}
            {selected.kind !== 'signature' && selected.kind !== 'initials' && (
              <div className="flex items-center gap-1.5 px-1">
                {(selected.kind === 'highlight' ? HIGHLIGHTS : COLORS).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      update(selected.id, { color: c });
                      if (selected.kind !== 'highlight') setColor(c);
                    }}
                    className={`h-7 w-7 shrink-0 rounded-full ring-offset-2 dark:ring-offset-slate-900 ${selected.color === c ? 'ring-2 ring-rose-500' : ''}`}
                    style={{ background: c }}
                    aria-label="Farbe"
                  />
                ))}
              </div>
            )}
            <div className="ml-auto flex gap-1.5">
              <Chip onClick={() => duplicate(selected)} label="Duplizieren">
                <Copy className="h-4 w-4" />
              </Chip>
              <Chip onClick={() => remove(selected.id)} label="Löschen" danger>
                <Trash2 className="h-4 w-4" />
              </Chip>
            </div>
          </div>
        )}
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 py-2">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => chooseTool(t.id)}
              className={`flex min-w-[64px] flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-semibold active:scale-95 [&_svg]:h-5 [&_svg]:w-5 ${
                tool === t.id ? 'bg-rose-500 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={finishEdit}>
          <div className="page-in w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold">Text</h3>
            <textarea
              autoFocus
              rows={3}
              value={editing.text}
              onChange={(e) => setEditing({ ...editing, text: e.target.value })}
              placeholder="Text eingeben …"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-base outline-none focus:border-rose-400 dark:border-slate-600 dark:bg-slate-700"
            />
            <button onClick={finishEdit} className="mt-3 w-full rounded-2xl bg-rose-500 py-3 font-bold text-white active:scale-[0.98]">
              Übernehmen
            </button>
          </div>
        </div>
      )}

      {pad && <SignaturePad kind={pad} onDone={onPadDone} onClose={() => setPad(null)} />}

      {result && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setResult(null)}>
          <div className="w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <ResultCard blob={result} filename={`${baseName(file.name)} (unterschrieben).pdf`} />
            <label className="flex items-center gap-3 rounded-2xl bg-white p-3 text-sm dark:bg-slate-800">
              <input
                type="checkbox"
                checked={flatten}
                disabled={saving}
                onChange={(e) => {
                  setFlatten(e.target.checked);
                  save(e.target.checked);
                }}
                className="h-5 w-5 accent-rose-500"
              />
              Formular fixieren, damit Felder nicht mehr geändert werden können
            </label>
            <button onClick={() => setResult(null)} className="w-full rounded-2xl bg-white py-3 font-semibold dark:bg-slate-800">
              Weiter bearbeiten
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Chip({ children, onClick, label, danger }: { children: ReactNode; onClick: () => void; label?: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold active:scale-95 dark:bg-slate-800 ${
        danger ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}
