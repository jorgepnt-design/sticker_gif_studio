/** Sortierbare Dateiliste mit Hoch/Runter-Knöpfen – zuverlässiger per Touch als Drag & Drop */
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

export function moveItem<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = list.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function FileList<T extends { id: string }>({
  items,
  onChange,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, index: number) => ReactNode;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={item.id}
          className="page-in flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800"
        >
          <span className="w-5 shrink-0 text-center text-sm font-bold text-slate-400">{i + 1}</span>
          <div className="flex min-w-0 flex-1 items-center gap-3">{render(item, i)}</div>
          <div className="flex shrink-0 items-center">
            <button
              onClick={() => onChange(moveItem(items, i, -1))}
              disabled={i === 0}
              className="rounded-full p-1.5 text-slate-500 active:scale-90 disabled:opacity-25"
              aria-label="Nach oben"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
            <button
              onClick={() => onChange(moveItem(items, i, 1))}
              disabled={i === items.length - 1}
              className="rounded-full p-1.5 text-slate-500 active:scale-90 disabled:opacity-25"
              aria-label="Nach unten"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
            <button
              onClick={() => onChange(items.filter((x) => x.id !== item.id))}
              className="rounded-full p-1.5 text-red-500 active:scale-90"
              aria-label="Entfernen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
