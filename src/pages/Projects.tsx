/** Projektverwaltung: gespeicherte Arbeiten öffnen, umbenennen, löschen */
import { useEffect, useState } from 'react';
import { FolderOpen, Trash2, Pencil, Plus } from 'lucide-react';
import { listProjects, saveProject, deleteProject } from '../lib/db';
import { navigate } from '../lib/router';
import { useToast } from '../components/Toast';
import { Modal, InputModal } from '../components/Modal';
import type { Project } from '../lib/types';

const MODE_LABEL: Record<string, string> = {
  sticker: 'Sticker',
  meme: 'Meme',
  image: 'Bild',
  profile: 'Profilbild',
};

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const [toRename, setToRename] = useState<Project | null>(null);
  const toast = useToast();

  const reload = () => {
    listProjects()
      .then(setProjects)
      .catch(() => toast('Projekte konnten nicht geladen werden', 'error'));
  };
  useEffect(reload, []);

  // Objekt-URLs für die Vorschaubilder verwalten
  useEffect(() => {
    if (!projects) return;
    const urls: Record<string, string> = {};
    for (const p of projects) urls[p.id] = URL.createObjectURL(p.thumbnail);
    setThumbs(urls);
    return () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
  }, [projects]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    await deleteProject(toDelete.id);
    setToDelete(null);
    toast('Projekt gelöscht', 'success');
    reload();
  };

  const rename = async (name: string) => {
    if (!toRename) return;
    await saveProject({ ...toRename, name, updatedAt: Date.now() });
    setToRename(null);
    reload();
  };

  return (
    <div className="page-in px-4 pt-6 safe-top">
      <h1 className="mb-4 text-2xl font-extrabold">Meine Projekte</h1>

      {projects === null && <p className="text-sm text-slate-400">Lade …</p>}

      {projects?.length === 0 && (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <FolderOpen className="h-16 w-16 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400">
            Noch keine Projekte.
            <br />
            Erstelle deinen ersten Sticker!
          </p>
          <button
            onClick={() => navigate('/editor?mode=sticker')}
            className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 font-semibold text-white shadow-lg active:scale-95"
          >
            <Plus className="h-5 w-5" /> Sticker erstellen
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {projects?.map((p) => (
          <div
            key={p.id}
            className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700"
          >
            <button
              onClick={() => navigate(`/editor?p=${p.id}`)}
              className="checkerboard block aspect-square w-full active:opacity-80"
            >
              {thumbs[p.id] && (
                <img src={thumbs[p.id]} alt={p.name} className="h-full w-full object-contain" />
              )}
            </button>
            <div className="p-3">
              <div className="truncate text-sm font-bold">{p.name}</div>
              <div className="text-[11px] text-slate-400">
                {MODE_LABEL[p.mode] ?? p.mode} ·{' '}
                {new Date(p.updatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setToRename(p)}
                  className="flex-1 rounded-xl bg-slate-100 py-1.5 text-slate-600 active:scale-95 dark:bg-slate-700 dark:text-slate-300"
                  aria-label="Umbenennen"
                >
                  <Pencil className="mx-auto h-4 w-4" />
                </button>
                <button
                  onClick={() => setToDelete(p)}
                  className="flex-1 rounded-xl bg-red-50 py-1.5 text-red-500 active:scale-95 dark:bg-red-900/30"
                  aria-label="Löschen"
                >
                  <Trash2 className="mx-auto h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!toDelete}
        title="Projekt löschen?"
        confirmLabel="Löschen"
        danger
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      >
        „{toDelete?.name}“ wird dauerhaft von diesem Gerät entfernt.
      </Modal>

      <InputModal
        open={!!toRename}
        title="Projekt umbenennen"
        initial={toRename?.name}
        onSubmit={rename}
        onClose={() => setToRename(null)}
      />
    </div>
  );
}
