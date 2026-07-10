/** „Erstellen“-Tab: alle Werkzeuge als Liste */
import { Sticker, ImagePlus, UserCircle2, Laugh, FileArchive, Type, ChevronRight } from 'lucide-react';
import { navigate } from '../lib/router';

const TOOLS = [
  { to: '/editor?mode=sticker', title: 'WhatsApp-Sticker', desc: 'Foto freistellen, Rand & Text hinzufügen', icon: Sticker, color: 'text-emerald-500' },
  { to: '/editor?mode=sticker&text=1', title: 'Text-Sticker', desc: 'Sticker nur aus Text und Emojis', icon: Type, color: 'text-teal-500' },
  { to: '/editor?mode=meme', title: 'Meme', desc: 'Klassisches Meme mit Text oben und unten', icon: Laugh, color: 'text-violet-500' },
  { to: '/editor?mode=image', title: 'Bild bearbeiten', desc: 'Zuschneiden, drehen, freistellen', icon: ImagePlus, color: 'text-cyan-500' },
  { to: '/editor?mode=profile', title: 'Profilbild', desc: 'Rund mit farbigem Ring für WhatsApp & Co.', icon: UserCircle2, color: 'text-fuchsia-500' },
  { to: '/compress', title: 'Bild komprimieren', desc: 'Mehrere Bilder verkleinern', icon: FileArchive, color: 'text-green-600' },
];

export function CreatePage() {
  return (
    <div className="page-in px-4 pt-6 safe-top">
      <h1 className="mb-4 text-2xl font-extrabold">Erstellen</h1>
      <div className="space-y-3">
        {TOOLS.map(({ to, title, desc, icon: Icon, color }) => (
          <button
            key={title}
            onClick={() => navigate(to)}
            className="flex w-full items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 active:scale-[0.98] dark:bg-slate-800 dark:ring-slate-700"
          >
            <Icon className={`h-8 w-8 shrink-0 ${color}`} />
            <div className="min-w-0 flex-1">
              <div className="font-bold">{title}</div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">{desc}</div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
          </button>
        ))}
      </div>
    </div>
  );
}
