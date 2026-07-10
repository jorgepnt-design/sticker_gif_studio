/** Startseite mit großen Funktionskarten */
import { Sticker, ImagePlus, UserCircle2, FolderOpen, Laugh, FileArchive, Clapperboard, Film, Library } from 'lucide-react';
import { navigate } from '../lib/router';

const CARDS = [
  {
    to: '/editor?mode=sticker',
    title: 'Sticker erstellen',
    subtitle: 'Foto freistellen & für WhatsApp exportieren',
    icon: Sticker,
    gradient: 'from-emerald-400 to-teal-500',
  },
  {
    to: '/gif?mode=anim',
    title: 'Animierter Sticker',
    subtitle: 'Aus Video, GIF oder Bilderserie',
    icon: Clapperboard,
    gradient: 'from-pink-400 to-rose-500',
  },
  {
    to: '/gif?mode=gif',
    title: 'GIF erstellen',
    subtitle: 'Video kürzen & als GIF exportieren',
    icon: Film,
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    to: '/editor?mode=meme',
    title: 'Meme erstellen',
    subtitle: 'Bild mit Text oben & unten',
    icon: Laugh,
    gradient: 'from-violet-400 to-purple-600',
  },
  {
    to: '/editor?mode=image',
    title: 'Bild bearbeiten',
    subtitle: 'Text, Rand, Freistellen & mehr',
    icon: ImagePlus,
    gradient: 'from-teal-400 to-cyan-500',
  },
  {
    to: '/editor?mode=profile',
    title: 'Profilbild erstellen',
    subtitle: 'Rund zuschneiden mit farbigem Ring',
    icon: UserCircle2,
    gradient: 'from-fuchsia-400 to-violet-500',
  },
  {
    to: '/compress',
    title: 'Bild komprimieren',
    subtitle: 'Dateigröße schnell reduzieren',
    icon: FileArchive,
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    to: '/library',
    title: 'Sticker-Bibliothek',
    subtitle: 'Sticker sammeln & Pakete erstellen',
    icon: Library,
    gradient: 'from-indigo-400 to-violet-600',
  },
  {
    to: '/projects',
    title: 'Meine Projekte',
    subtitle: 'Gespeicherte Arbeiten fortsetzen',
    icon: FolderOpen,
    gradient: 'from-slate-500 to-slate-700',
  },
];

export function HomePage() {
  return (
    <div className="page-in px-4 pt-6 safe-top">
      {/* Kopfbereich */}
      <header className="mb-6">
        <h1 className="bg-gradient-to-r from-emerald-500 via-teal-500 to-violet-500 bg-clip-text text-3xl font-extrabold text-transparent">
          Sticker &amp; GIF Studio
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Eigene WhatsApp-Sticker in wenigen Minuten – alles bleibt auf deinem Gerät.
        </p>
      </header>

      {/* Funktionskarten */}
      <div className="grid grid-cols-2 gap-3">
        {CARDS.map(({ to, title, subtitle, icon: Icon, gradient }) => (
          <button
            key={title}
            onClick={() => navigate(to)}
            className="group flex flex-col items-start rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 transition active:scale-95 dark:bg-slate-800 dark:ring-slate-700"
          >
            <span
              className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-md`}
            >
              <Icon className="h-6 w-6" />
            </span>
            <span className="font-bold leading-tight">{title}</span>
            <span className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">{subtitle}</span>
          </button>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        🔒 Deine Bilder werden ausschließlich lokal auf deinem Gerät verarbeitet.
      </p>
    </div>
  );
}
