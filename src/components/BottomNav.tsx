/** Untere Navigationsleiste für die Smartphone-Bedienung */
import { Home, PlusCircle, FolderOpen, LayoutTemplate, Settings } from 'lucide-react';
import { navigate } from '../lib/router';

const ITEMS = [
  { path: '/', label: 'Start', icon: Home },
  { path: '/create', label: 'Erstellen', icon: PlusCircle },
  { path: '/projects', label: 'Projekte', icon: FolderOpen },
  { path: '/templates', label: 'Vorlagen', icon: LayoutTemplate },
  { path: '/settings', label: 'Einstellungen', icon: Settings },
];

export function BottomNav({ current }: { current: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/60 bg-white/90 backdrop-blur-lg safe-bottom dark:border-slate-700/60 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {ITEMS.map(({ path, label, icon: Icon }) => {
          const active = current === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 pt-2.5"
              aria-label={label}
            >
              <Icon
                className={`h-6 w-6 transition-colors ${
                  active ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'
                }`}
                strokeWidth={active ? 2.4 : 2}
              />
              <span
                className={`text-[10px] font-medium ${
                  active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
