import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: 'danger' | 'primary' | 'success';
  /** `dark`: panel tối (không gian điều hành / director). Mặc định giữ card sáng như các trang khác. */
  appearance?: 'light' | 'dark';
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
  appearance = 'light',
  loading = false,
  reasonField,
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, loading]);

  if (!open) return null;

  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/25'
      : variant === 'success'
        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/25'
        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/25';

  const isDark = appearance === 'dark';
  const panelClass = isDark
    ? 'border border-white/10 bg-[#0b1220] p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.65)] ring-1 ring-indigo-500/20'
    : 'border border-slate-200 bg-white p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)]';
  const titleClass = isDark ? 'text-white' : 'text-slate-900';
  const descClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const closeBtnClass = isDark
    ? 'text-slate-500 hover:bg-white/10 hover:text-slate-200'
    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700';
  const cancelBtnClass = isDark
    ? 'border-2 border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
    : 'border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
  const reasonLabelClass = isDark ? 'text-slate-500' : 'text-slate-400';
  const reasonTextareaClass = isDark
    ? 'border-2 border-white/10 bg-[#020617] text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15'
    : 'border-2 border-slate-100 bg-slate-50/80 text-slate-800 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10';

  const node = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <button
        type="button"
        className={`absolute inset-0 backdrop-blur-sm ${isDark ? 'bg-slate-950/75' : 'bg-slate-900/60'}`}
        aria-label={cancelLabel}
        disabled={loading}
        onClick={() => {
          if (!loading) onClose();
        }}
      />
      <div className={`relative w-full max-w-md rounded-[32px] ${panelClass}`}>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            if (!loading) onClose();
          }}
          className={`absolute right-5 top-5 rounded-xl p-2 transition-colors ${closeBtnClass}`}
          aria-label={cancelLabel}
        >
          <X size={18} />
        </button>
        <h2 id="confirm-dialog-title" className={`pr-10 text-xl font-black tracking-tight ${titleClass}`}>
          {title}
        </h2>
        <p className={`mt-3 text-sm font-medium leading-relaxed ${descClass}`}>{description}</p>
        {reasonField?.show ? (
          <div className="mt-5 space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ${reasonLabelClass}`}>
              {reasonField.label}
            </label>
            <textarea
              value={reasonField.value}
              onChange={(e) => reasonField.onChange(e.target.value)}
              placeholder={reasonField.placeholder}
              rows={3}
              className={`w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all resize-none ${reasonTextareaClass}`}
            />
          </div>
        ) : null}
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className={`inline-flex h-12 min-w-[120px] items-center justify-center rounded-2xl px-6 text-[11px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${cancelBtnClass}`}
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
