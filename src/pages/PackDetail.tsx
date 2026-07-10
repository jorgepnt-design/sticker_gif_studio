/**
 * Stickerpaket-Detail: Sticker sortieren, hinzufügen, entfernen und das
 * Paket als ZIP (Sticker + pack.json) exportieren oder teilen.
 */
import { useEffect, useState } from 'react';
import {
  ArrowLeft, Pencil, Trash2, Plus, Share2, Download, ChevronUp, ChevronDown, X, AlertTriangle, Loader2,
} from 'lucide-react';
import { zipSync, strToU8 } from 'fflate';
import { getPack, savePack, deletePack, listStickers, saveSticker } from '../lib/db';
import { navigate } from '../lib/router';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { PackFormModal } from './Library';
import { shareOrDownload, downloadBlob, formatBytes } from '../lib/share';
import type { LibrarySticker, StickerPack } from '../lib/types';

export function PackDetailPage({ params }: { params: URLSearchParams }) {
  const toast = useToast();
  const packId = params.get('id') ?? '';

  const [pack, setPack] = useState<StickerPack | null>(null);
  const [allStickers, setAllStickers] = useState<LibrarySticker[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [showEdit, setShowEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    void getPack(packId).then((p) => {
      if (!p) {
        toast('Paket nicht gefunden', 'error');
        navigate('/library');
        return;
      }
      setPack(p);
    });
    void listStickers().then(setAllStickers);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [packId]);

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const s of allStickers) map[s.id] = URL.createObjectURL(s.blob);
    setUrls(map);
    return () => Object.values(map).forEach((u) => URL.revokeObjectURL(u));
  }, [allStickers]);

  if (!pack) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const inPack = pack.stickerIds
    .map((id) => allStickers.find((s) => s.id === id))
    .filter((s): s is LibrarySticker => !!s);
  const notInPack = allStickers.filter((s) => !pack.stickerIds.includes(s.id));

  const update = async (patch: Partial<StickerPack>) => {
    const next = { ...pack, ...patch, updatedAt: Date.now() };
    await savePack(next);
    setPack(next);
  };

  const move = (index: number, dir: -1 | 1) => {
    const ids = [...pack.stickerIds];
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void update({ stickerIds: ids });
  };

  const removeFromPack = (id: string) => {
    void update({ stickerIds: pack.stickerIds.filter((x) => x !== id) });
  };

  const addSticker = async (s: LibrarySticker) => {
    await update({ stickerIds: [...pack.stickerIds, s.id] });
    await saveSticker({ ...s, lastUsedAt: Date.now() });
    void listStickers().then(setAllStickers);
  };

  /** Paket als ZIP bündeln: Sticker-Dateien + pack.json mit Metadaten */
  const buildZip = async (): Promise<Blob> => {
    const files: Record<string, Uint8Array> = {};
    const names: string[] = [];
    for (let i = 0; i < inPack.length; i++) {
      const s = inPack[i];
      const ext = s.blob.type === 'image/webp' ? 'webp' : s.blob.type === 'image/gif' ? 'gif' : 'png';
      const name = `sticker-${String(i + 1).padStart(2, '0')}.${ext}`;
      files[name] = new Uint8Array(await s.blob.arrayBuffer());
      names.push(name);
    }
    files['pack.json'] = strToU8(
      JSON.stringify(
        { name: pack.name, author: pack.author, stickers: names, created: new Date().toISOString() },
        null,
        2,
      ),
    );
    // Bilder sind bereits komprimiert → ZIP ohne zusätzliche Kompression (schnell)
    const zipped = zipSync(files, { level: 0 });
    return new Blob([zipped], { type: 'application/zip' });
  };

  const exportZip = async (share: boolean) => {
    if (inPack.length < 3) {
      toast('WhatsApp benötigt mindestens 3 Sticker pro Paket', 'error');
      return;
    }
    setBusy(true);
    try {
      const blob = await buildZip();
      const filename = `${pack.name.replace(/[^\wäöüÄÖÜß-]+/g, '_')}.zip`;
      if (share) {
        const shared = await shareOrDownload(blob, filename, pack.name);
        toast(shared ? 'Teilen geöffnet' : `ZIP heruntergeladen (${formatBytes(blob.size)})`, 'success');
      } else {
        downloadBlob(blob, filename);
        toast(`ZIP heruntergeladen (${formatBytes(blob.size)})`, 'success');
      }
    } catch {
      toast('Export fehlgeschlagen', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-in px-4 pt-6 safe-top">
      <button onClick={() => navigate('/library')} className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-500">
        <ArrowLeft className="h-4 w-4" /> Bibliothek
      </button>

      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold">{pack.name}</h1>
          <p className="text-sm text-slate-400">
            von {pack.author} · {inPack.length} Sticker
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowEdit(true)} className="rounded-xl bg-slate-100 p-2.5 text-slate-600 active:scale-95 dark:bg-slate-700 dark:text-slate-300" aria-label="Paket umbenennen">
            <Pencil className="h-5 w-5" />
          </button>
          <button onClick={() => setConfirmDelete(true)} className="rounded-xl bg-red-50 p-2.5 text-red-500 active:scale-95 dark:bg-red-900/30" aria-label="Paket löschen">
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {inPack.length < 3 && (
        <p className="mb-3 flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Für den WhatsApp-Export braucht ein Paket mindestens 3 Sticker – aktuell {inPack.length}.
        </p>
      )}

      {/* Sticker im Paket (sortierbar) */}
      <div className="mb-4 space-y-2">
        {inPack.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
            <div className="checkerboard h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              {urls[s.id] && <img src={urls[s.id]} alt={s.name} className="h-full w-full object-contain" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{s.name}</div>
              <div className="text-[11px] text-slate-400">Position {i + 1}</div>
            </div>
            <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg bg-slate-100 p-2 text-slate-500 active:scale-95 disabled:opacity-30 dark:bg-slate-700" aria-label="Nach oben">
              <ChevronUp className="h-4 w-4" />
            </button>
            <button onClick={() => move(i, 1)} disabled={i === inPack.length - 1} className="rounded-lg bg-slate-100 p-2 text-slate-500 active:scale-95 disabled:opacity-30 dark:bg-slate-700" aria-label="Nach unten">
              <ChevronDown className="h-4 w-4" />
            </button>
            <button onClick={() => removeFromPack(s.id)} className="rounded-lg bg-red-50 p-2 text-red-500 active:scale-95 dark:bg-red-900/30" aria-label="Entfernen">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowAdd(true)}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-300 py-3 font-semibold text-emerald-600 active:scale-95 dark:border-emerald-700 dark:text-emerald-400"
      >
        <Plus className="h-5 w-5" /> Sticker hinzufügen
      </button>

      <div className="mb-6 flex gap-3">
        <button
          onClick={() => void exportZip(true)}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 font-bold text-white shadow-lg active:scale-95 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />} Paket teilen
        </button>
        <button
          onClick={() => void exportZip(false)}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-500 py-3.5 font-bold text-white shadow-lg active:scale-95 disabled:opacity-50"
        >
          <Download className="h-5 w-5" /> ZIP laden
        </button>
      </div>

      <p className="mb-6 rounded-2xl bg-teal-50 p-3 text-xs leading-relaxed text-teal-900 dark:bg-teal-900/30 dark:text-teal-200">
        <strong>So kommt das Paket in WhatsApp:</strong> ZIP auf dem Handy entpacken und die Sticker in einer
        Sticker-Import-App (z. B. „Sticker Maker“) als Paket anlegen – Name und Autor stehen in der pack.json.
        Web-Apps dürfen Pakete nicht direkt installieren, das erlaubt WhatsApp nur nativen Apps.
      </p>

      {/* Sticker-Auswahl zum Hinzufügen */}
      {showAdd && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4" onClick={() => setShowAdd(false)}>
          <div className="page-in max-h-[70dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-5 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold">Sticker auswählen</h3>
            {notInPack.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">
                Keine weiteren Sticker in der Bibliothek. Erstelle neue im Editor und speichere sie über „In Bibliothek“.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {notInPack.map((s) => (
                <button key={s.id} onClick={() => void addSticker(s)} className="checkerboard aspect-square overflow-hidden rounded-2xl ring-1 ring-slate-200 active:scale-95 dark:ring-slate-600">
                  {urls[s.id] && <img src={urls[s.id]} alt={s.name} className="h-full w-full object-contain" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <PackFormModal
        open={showEdit}
        title="Paket bearbeiten"
        initialName={pack.name}
        initialAuthor={pack.author}
        onSubmit={(name, author) => void update({ name, author })}
        onClose={() => setShowEdit(false)}
      />

      <Modal
        open={confirmDelete}
        title="Paket löschen?"
        confirmLabel="Löschen"
        danger
        onConfirm={async () => {
          await deletePack(pack.id);
          toast('Paket gelöscht', 'success');
          navigate('/library');
        }}
        onClose={() => setConfirmDelete(false)}
      >
        „{pack.name}“ wird gelöscht. Die Sticker bleiben in der Bibliothek erhalten.
      </Modal>
    </div>
  );
}
