import { Combine, FileImage, Images, LayoutGrid, Minimize2, PenLine, ShieldCheck } from 'lucide-react';
import { navigate } from '../lib/router';

const TOOLS = [
  {
    path: '/fill-sign',
    title: 'Ausfüllen & Unterschreiben',
    text: 'Text, Häkchen, Datum und Unterschrift setzen, Formularfelder ausfüllen',
    icon: PenLine,
    color: 'bg-rose-500',
  },
  {
    path: '/merge',
    title: 'PDFs zusammenfügen',
    text: 'Mehrere PDFs zu einer Datei kombinieren',
    icon: Combine,
    color: 'bg-violet-500',
  },
  {
    path: '/organize',
    title: 'Seiten organisieren',
    text: 'Sortieren, drehen, löschen, extrahieren und teilen',
    icon: LayoutGrid,
    color: 'bg-sky-500',
  },
  {
    path: '/compress',
    title: 'PDF komprimieren',
    text: 'Dateigröße verkleinern, z. B. für E-Mail',
    icon: Minimize2,
    color: 'bg-emerald-500',
  },
  {
    path: '/images-to-pdf',
    title: 'Bilder in PDF',
    text: 'Fotos und Scans zu einem PDF zusammenstellen',
    icon: Images,
    color: 'bg-amber-500',
  },
  {
    path: '/pdf-to-images',
    title: 'PDF in Bilder',
    text: 'Seiten als PNG oder JPG speichern',
    icon: FileImage,
    color: 'bg-fuchsia-500',
  },
];

export function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 safe-top">
      <header className="pb-5 pt-8">
        <h1 className="text-3xl font-extrabold tracking-tight">
          PDF Studio <span className="text-rose-500">by Jorge</span>
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Alle PDF-Werkzeuge an einem Ort.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {TOOLS.map(({ path, title, text, icon: Icon, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="page-in flex items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200/70 active:scale-[0.98] dark:bg-slate-900 dark:ring-slate-800"
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${color}`}>
              <Icon className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{title}</span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">{text}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-3xl bg-slate-100 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-400">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
        <p>
          <b>Datenschutz zuerst:</b> Deine Dateien werden ausschließlich auf diesem Gerät verarbeitet. Kein Upload, kein
          Konto, kein Tracking – funktioniert auch offline.
        </p>
      </div>
    </div>
  );
}
