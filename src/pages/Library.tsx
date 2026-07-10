/**
 * Sticker-Bibliothek: gespeicherte Sticker (Suche, Favoriten, Kategorien)
 * und Stickerpakete verwalten.
 */
import { useEffect, useMemo, useState } from 'react';
import { Star, Search, Plus, Package, ChevronRight, Trash2, Share2, Download } from 'lucide-react';
import { listStickers, saveSticker, deleteSticker, listPacks, savePack } from '../lib/db';
import { navigate } from '../lib/router';
import { useToast } from '../components/Toast';
import { Modal, InputModal } from '../components/Modal';
import { shareOrDownload, downloadBlob } from '../lib/share';
import { uid } from '../lib/imaging';
import { STICKER_CATEGORIES, type LibrarySticker, type StickerPack } from '../lib/types';

/** Kleiner Dialog mit zwei Feldern für Paket-Name und Autor */
export function PackFormModal({
  open, title, initialName, initialAuthor, onSubmit, onClose,
}: {
  open: boolean;
  title: string;
  initialName?: string;
  initialAuthor?: string;
  onSubmit: (name: string, author: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [author, setAuthor] = useState(initialAuthor ?? '');
  useEffect(() => {
    if (open) {
      setName(initialName ?? '');
      setAuthor(initialAuthor ?? '');
    }
  }, [open, initialName, initialAuthor]);
  const field =
    'w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-base outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-700';
  return (
    <Modal
      open={open}
      title={title}
      confirmLabel="Übernehmen"
      onConfirm={() => {
        if (name.trim()) onSubmit(name.trim(), author.trim() || 'Ich');
        onClose();
      }}
      onClose={onClose}
    >
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Paketname" className={field} />
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Autor (optional)" className={field} />
      </div>
    </Modal>
  );
}

export function LibraryPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'stickers' | 'packs'>('stickers');
  const [stickers, setStickers] = useState<LibrarySticker[]>([]);
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('alle');
  const [detail, setDetail] = useState<LibrarySticker | null>(null);
  const [rename, setRename] = useState<LibrarySticker | null>(null);
  const [toDelete, setToDelete] = useState<LibrarySticker | null>(null);
  const [createPack, setCreatePack] = useState(false);

  const reload = () => {
    void listStickers().then(setStickers);
    void listPacks().then(setPacks);
  };
  useEffect(reload, []);

  // Objekt-URLs für die Vorschaubilder
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const s of stickers) map[s.id] = URL.createObjectURL(s.blob);
    setUrls(map);
    return () => Object.values(map).forEach((u) => URL.revokeObjectURL(u));
  }, [stickers]);

  const filtered = useMemo(() => {
    let list = stickers;
    if (filter === 'favoriten') list = list.filter((s) => s.favorite);
    else if (filter !== 'alle') list = list.filter((s) => s.category === filter);
    if (query.trim()) list = list.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()));
    return list;
  }, [stickers, filter, query]);

  const toggleFav = async (s: LibrarySticker) => {
    await saveSticker({ ...s, favorite: !s.favorite });
    reload();
  };

  const usedNow = async (s: LibrarySticker) => {
    await saveSticker({ ...s, lastUsedAt: Date.now() });
    reload();
  };

  const addToPack = async (pack: StickerPack) => {
    if (!detail) return;
    if (pack.stickerIds.includes(detail.id)) {
      toast('Sticker ist bereits in diesem Paket', 'info');
      return;
    }
    await savePack({ ...pack, stickerIds: [...pack.stickerIds, detail.id], updatedAt: Date.now() });
    await usedNow(detail);
    toast(`Zu „${pack.name}“ hinzugefügt`, 'success');
    setDetail(null);
  };

  const catChip = (id: string, label: string) => (
    <button
      key={id}
      onClick={() => setFilter(id)}
      className={`shrink-0 rounded-xl border-2 px-3 py-1.5 text-xs font-semibold ${
        filter === id ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-400'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="page-in px-4 pt-6 safe-top">
      <h1 className="mb-3 text-2xl font-extrabold">Bibliothek</h1>

      {/* Tabs */}
      <div className="mb-4 flex rounded-2xl bg-slate-200/70 p-1 dark:bg-slate-800">
        {(['stickers', 'packs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2 text-sm font-bold ${
              tab === t ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500'
            }`}
          >
            {t === 'stickers' ? `Sticker (${stickers.length})` : `Pakete (${packs.length})`}
          </button>
        ))}
      </div>

      {tab === 'stickers' && (
        <>
          {/* Suche & Filter */}
          <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
            <Search className="h-5 w-5 shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sticker suchen …"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {catChip('alle', 'Alle')}
            {catChip('favoriten', '★ Favoriten')}
            {STICKER_CATEGORIES.map((c) => catChip(c, c))}
          </div>

          {filtered.length === 0 && (
            <p className="mt-10 text-center text-sm text-slate-400">
              {stickers.length === 0
                ? 'Noch keine Sticker – exportiere einen Sticker aus dem Editor und tippe auf „In Bibliothek“.'
                : 'Keine Treffer.'}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {filtered.map((s) => (
              <div key={s.id} className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
                <button onClick={() => setDetail(s)} className="checkerboard block aspect-square w-full active:opacity-80">
                  {urls[s.id] && <img src={urls[s.id]} alt={s.name} className="h-full w-full object-contain" />}
                </button>
                <button
                  onClick={() => void toggleFav(s)}
                  className="absolute right-1 top-1 rounded-full bg-white/85 p-1.5 shadow dark:bg-slate-900/85"
                  aria-label="Favorit"
                >
                  <Star className={`h-4 w-4 ${s.favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                </button>
                <div className="truncate px-2 py-1.5 text-[11px] font-semibold">{s.name}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'packs' && (
        <>
          <button
            onClick={() => setCreatePack(true)}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 font-bold text-white shadow-lg active:scale-95"
          >
            <Plus className="h-5 w-5" /> Neues Stickerpaket
          </button>
          {packs.length === 0 && (
            <p className="mt-8 text-center text-sm text-slate-400">
              Noch keine Pakete. Ein WhatsApp-Paket braucht mindestens 3 Sticker.
            </p>
          )}
          <div className="space-y-2">
            {packs.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/pack?id=${p.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 active:scale-[0.98] dark:bg-slate-800 dark:ring-slate-700"
              >
                <Package className="h-8 w-8 shrink-0 text-violet-500" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{p.name}</div>
                  <div className="text-xs text-slate-400">
                    {p.author} · {p.stickerIds.length} Sticker
                    {p.stickerIds.length < 3 && ' · mind. 3 nötig'}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* Sticker-Detail: Aktionen */}
      {detail && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4" onClick={() => setDetail(null)}>
          <div className="page-in w-full max-w-sm rounded-3xl bg-white p-5 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="checkerboard mx-auto mb-3 h-32 w-32 overflow-hidden rounded-2xl">
              {urls[detail.id] && <img src={urls[detail.id]} alt="" className="h-full w-full object-contain" />}
            </div>
            <div className="mb-3 text-center font-bold">{detail.name}</div>

            <div className="mb-3 flex flex-wrap justify-center gap-1.5">
              {STICKER_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={async () => {
                    await saveSticker({ ...detail, category: c });
                    setDetail({ ...detail, category: c });
                    reload();
                  }}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                    detail.category === c ? 'border-emerald-500 text-emerald-600' : 'border-slate-200 text-slate-400 dark:border-slate-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="mb-2 grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  await usedNow(detail);
                  await shareOrDownload(detail.blob, `${detail.name}.${detail.blob.type.split('/')[1] || 'png'}`, detail.name);
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white active:scale-95"
              >
                <Share2 className="h-4 w-4" /> Teilen
              </button>
              <button
                onClick={async () => {
                  await usedNow(detail);
                  downloadBlob(detail.blob, `${detail.name}.${detail.blob.type.split('/')[1] || 'png'}`);
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-500 py-2.5 text-sm font-bold text-white active:scale-95"
              >
                <Download className="h-4 w-4" /> Laden
              </button>
            </div>

            {packs.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {packs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => void addToPack(p)}
                    className="flex w-full items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 active:scale-95 dark:bg-slate-700 dark:text-slate-300"
                  >
                    <Package className="h-4 w-4 text-violet-500" /> Zu „{p.name}“ hinzufügen
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setRename(detail);
                  setDetail(null);
                }}
                className="rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 active:scale-95 dark:bg-slate-700 dark:text-slate-300"
              >
                Umbenennen
              </button>
              <button
                onClick={() => {
                  setToDelete(detail);
                  setDetail(null);
                }}
                className="flex items-center justify-center gap-1 rounded-xl bg-red-50 py-2.5 text-sm font-semibold text-red-500 active:scale-95 dark:bg-red-900/30"
              >
                <Trash2 className="h-4 w-4" /> Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      <InputModal
        open={!!rename}
        title="Sticker umbenennen"
        initial={rename?.name}
        onSubmit={async (name) => {
          if (rename) {
            await saveSticker({ ...rename, name });
            reload();
          }
        }}
        onClose={() => setRename(null)}
      />

      <Modal
        open={!!toDelete}
        title="Sticker löschen?"
        confirmLabel="Löschen"
        danger
        onConfirm={async () => {
          if (toDelete) {
            await deleteSticker(toDelete.id);
            setToDelete(null);
            toast('Sticker gelöscht', 'success');
            reload();
          }
        }}
        onClose={() => setToDelete(null)}
      >
        „{toDelete?.name}“ wird auch aus allen Paketen entfernt.
      </Modal>

      <PackFormModal
        open={createPack}
        title="Neues Stickerpaket"
        onSubmit={async (name, author) => {
          const pack: StickerPack = { id: uid(), name, author, stickerIds: [], createdAt: Date.now(), updatedAt: Date.now() };
          await savePack(pack);
          reload();
          navigate(`/pack?id=${pack.id}`);
        }}
        onClose={() => setCreatePack(false)}
      />
    </div>
  );
}
