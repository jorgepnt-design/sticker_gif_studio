/** Wiederverwendbarer Dialog (Bestätigen, Umbenennen, Texteingabe) */
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function Modal({ open, title, children, confirmLabel = 'OK', danger, onConfirm, onClose }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className="page-in w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-bold">{title}</h3>
        <div className="mb-5 text-sm text-slate-600 dark:text-slate-300">{children}</div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-slate-100 py-3 font-semibold text-slate-700 active:scale-95 dark:bg-slate-700 dark:text-slate-200"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-2xl py-3 font-semibold text-white active:scale-95 ${
              danger ? 'bg-red-500' : 'bg-emerald-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Dialog mit Textfeld – z. B. zum Umbenennen von Projekten oder Texteingabe */
export function InputModal({
  open,
  title,
  initial,
  placeholder,
  multiline,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  initial?: string;
  placeholder?: string;
  multiline?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initial ?? '');
      setTimeout(() => (multiline ? textareaRef.current : inputRef.current)?.focus(), 50);
    }
  }, [open, initial, multiline]);

  const submit = () => {
    if (value.trim()) onSubmit(value.trim());
    onClose();
  };

  return (
    <Modal open={open} title={title} confirmLabel="Übernehmen" onConfirm={submit} onClose={onClose}>
      {multiline ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-base outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-700"
        />
      ) : (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-base outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-700"
        />
      )}
    </Modal>
  );
}
