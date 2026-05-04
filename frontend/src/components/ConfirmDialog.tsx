import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  /** Optional note/reason field (e.g. withdrawing published content) */
  reasonField?: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    show: boolean;
  };
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * In-app confirmation — replaces window.confirm / window.prompt for flows that match the VKsLab UI.
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  loading = false,
  reasonField,
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/25'
      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/25';

  const node = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-label={cancelLabel}
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label={cancelLabel}
        >
          <X size={18} />
        </button>
        <h2 id="confirm-dialog-title" className="pr-10 text-xl font-black tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">{description}</p>
        {reasonField?.show ? (
          <div className="mt-5 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {reasonField.label}
            </label>
            <textarea
              value={reasonField.value}
              onChange={(e) => reasonField.onChange(e.target.value)}
              placeholder={reasonField.placeholder}
              rows={3}
              className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 resize-none"
            />
          </div>
        ) : null}
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="inline-flex h-12 min-w-[120px] items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-6 text-[11px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl px-6 text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${confirmBtnClass}`}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
};

export default ConfirmDialog;
