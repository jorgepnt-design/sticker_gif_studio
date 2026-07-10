/** Vorlagen-Galerie: fertige Text-Sticker, die im Editor angepasst werden können */
import { navigate } from '../lib/router';
import { TEMPLATES } from '../lib/templates';

export function TemplatesPage() {
  return (
    <div className="page-in px-4 pt-6 safe-top">
      <h1 className="mb-1 text-2xl font-extrabold">Vorlagen</h1>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Tippe eine Vorlage an und passe sie im Editor an – Text, Farbe und Schrift sind frei änderbar.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(`/editor?mode=sticker&template=${t.id}`)}
            className="flex flex-col items-center rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 active:scale-95 dark:bg-slate-800 dark:ring-slate-700"
          >
            <span className="text-5xl">{t.emoji}</span>
            <span
              className="mt-3 text-center text-lg font-extrabold leading-tight"
              style={{
                fontFamily: t.font,
                color: t.color,
                WebkitTextStroke: t.strokeWidth > 0 ? `1px ${t.strokeColor}` : undefined,
              }}
            >
              {t.text.replace('\n', ' ')}
            </span>
            <span className="mt-2 text-[11px] text-slate-400">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
