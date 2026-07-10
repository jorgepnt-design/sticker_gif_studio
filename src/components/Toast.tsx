/** Einfache Toast-Benachrichtigungen (Erfolg / Fehler / Info) */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

const ToastContext = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />,
    error: <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />,
    info: <Info className="h-5 w-5 shrink-0 text-sky-400" />,
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 safe-top">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="page-in flex max-w-sm items-center gap-2 rounded-2xl bg-slate-900/95 px-4 py-3 text-sm font-medium text-white shadow-xl dark:bg-slate-800"
          >
            {icons[t.kind]}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
