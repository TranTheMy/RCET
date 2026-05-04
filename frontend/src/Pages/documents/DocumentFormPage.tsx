import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Loader2,
  Save,
  FileUp,
  Info,
  Terminal,
  LayoutGrid,
  Building2,
  Link as LinkIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { documentService } from '../../services/document.service';
import { categoryService } from '../../services/category.service';
import type { Category, DocumentType } from '../../types';
import { ROUTER } from '../../routes/router';
import { translateApiMessage } from '../../utils/apiErrorI18n';

const DOC_TYPES: DocumentType[] = ['datasheet', 'manual', 'schematic'];

const meteorStyles = `
  @keyframes list-meteor-fx {
    0% { transform: translate(500px, -500px) rotate(-45deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translate(-1000px, 1000px) rotate(-45deg); opacity: 0; }
  }
  .list-meteor {
    position: absolute;
    width: 1.5px;
    height: 100px;
    background: linear-gradient(to top, rgba(6, 182, 212, 0.85), transparent);
    animation: list-meteor-fx linear infinite;
    pointer-events: none;
    z-index: 1;
  }
`;

type MeteorSpec = { id: number; top: string; right: string; animationDuration: string };

const DocumentFormPage: React.FC = () => {
  const { id: editId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isEdit = Boolean(editId);

  // States
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [docType, setDocType] = useState<DocumentType | ''>('');
  const [manufacturer, setManufacturer] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };
  const inputClass = (field: string, base: string) =>
    `${base} ${fieldErrors[field] ? 'border-red-500/80 focus:border-red-400 focus:ring-red-500/20' : ''}`.trim();
  const scrollToFirstFieldError = (errors: Record<string, string>) => {
    const order = ['title', 'category_id', 'doc_type', 'manufacturer', 'description', 'file', 'pdf_url'];
    const first = order.find((f) => Boolean(errors[f])) || Object.keys(errors)[0];
    if (!first) return;
    const el = document.querySelector<HTMLElement>(`[data-error-field="${first}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus?.({ preventScroll: true });
  };

  const refreshCategories = useCallback(() => {
    return categoryService
      .list()
      .then((res) => setCategories(res.data?.items ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMeteors((prev) => {
        const spec: MeteorSpec = {
          id: Date.now(),
          top: `${Math.random() * -10}%`,
          right: `${Math.random() * 80}%`,
          animationDuration: `${Math.random() * 2 + 2}s`,
        };
        return [...prev.slice(-10), spec];
      });
    }, 1500);
    return () => window.clearInterval(interval);
  }, []);

  // Fetch Data if Edit
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await documentService.getOne(editId);
        const d = res.data;
        if (!d) return;

        if (d.status !== 'draft' && d.status !== 'rejected') {
          toast.error(t('documents:form.errors.editNotAllowed'));
          navigate(ROUTER.USER.DOCUMENTS_MINE, { replace: true });
          return;
        }

        if (cancelled) return;
        setTitle(d.title);
        setDescription(d.description ?? '');
        setCategoryId(d.category_id);
        setDocType((d.doc_type as DocumentType) || '');
        setManufacturer(d.manufacturer ?? '');
        setPdfUrl((d.pdf_url ?? d.file_path ?? '') || '');
      } catch {
        toast.error(t('documents:form.errors.fetchFailed'));
        navigate(ROUTER.USER.DOCUMENTS_MINE, { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editId, navigate, t]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = t('documents:form.errors.titleRequired');
    if (!categoryId) nextErrors.category_id = t('documents:form.errors.categoryRequired');
    if (!isEdit && !file && !pdfUrl.trim()) nextErrors.file = t('documents:form.errors.sourceRequired');
    if (pdfUrl.trim() && !/^https?:\/\//i.test(pdfUrl.trim())) {
      nextErrors.pdf_url = 'URL phải bắt đầu bằng http:// hoặc https://';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      scrollToFirstFieldError(nextErrors);
      toast.error(t('documents:form.errors.sourceRequired'));
      return;
    }

    setSaving(true);
    try {
      setFieldErrors({});
      const payload = {
        title: title.trim(),
        description: description || null,
        category_id: categoryId,
        doc_type: docType || null,
        manufacturer: manufacturer || null,
        pdf_url: pdfUrl.trim() || undefined,
        file: file ?? undefined,
      };

      if (isEdit && editId) {
        await documentService.update(editId, payload);
        toast.success(t('documents:form.toasts.updatedDraft'));
      } else {
        await documentService.create(payload);
        toast.success(t('documents:form.toasts.createdDraft'));
      }
      navigate(ROUTER.USER.DOCUMENTS_MINE);
    } catch (err: unknown) {
      const backendErrors = (err as { response?: { data?: { errors?: Array<{ field?: string; message?: string }> } } })
        ?.response?.data?.errors;
      if (Array.isArray(backendErrors) && backendErrors.length > 0) {
        const next: Record<string, string> = {};
        for (const it of backendErrors) {
          if (it?.field && it?.message && !next[it.field]) {
            next[it.field] = translateApiMessage(t, it.message);
          }
        }
        setFieldErrors(next);
        window.setTimeout(() => scrollToFirstFieldError(next), 0);
      }
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('documents:form.toasts.saveFailed');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden">
        <style>{meteorStyles}</style>
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          {meteors.map((m) => (
            <div
              key={m.id}
              className="list-meteor"
              style={{
                top: m.top,
                right: m.right,
                animationDuration: m.animationDuration,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mb-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/60">{t('documents:form.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 pb-24 relative overflow-hidden font-sans">
      <style>{meteorStyles}</style>
      {/* HUD Background + sao rơi */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:60px_60px] opacity-10" />
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
        {meteors.map((m) => (
          <div
            key={m.id}
            className="list-meteor"
            style={{
              top: m.top,
              right: m.right,
              animationDuration: m.animationDuration,
            }}
          />
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 relative z-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="group inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors mb-8"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> {t('documents:back')}
        </button>

        <header className="mb-10">
          <h1 className="text-4xl font-[950] text-white uppercase italic tracking-tighter flex items-center gap-4">
            {isEdit ? t('documents:update') : t('documents:create')} <span className="text-cyan-500">{t('documents:form.document')}</span>
          </h1>
          <div className="mt-4 flex items-center gap-2 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl max-w-fit">
            <Info size={14} className="text-cyan-500" />
            <p className="text-[10px] font-bold text-cyan-500/80 uppercase tracking-widest">
              {t('documents:form.draftHint')}
            </p>
          </div>
        </header>

        <form onSubmit={onSubmit} className="space-y-8 bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 md:p-12 shadow-2xl">
          
          {/* Section 1: Core Info */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-white border-b border-white/5 pb-2">
              <Terminal size={16} className="text-cyan-500" />
              <span className="text-xs font-black uppercase italic tracking-widest">{t('documents:form.sections.core')}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{t('documents:form.fields.title')}</label>
                <input
                  data-error-field="title"
                  value={title}
                  onChange={(e) => {
                    clearFieldError('title');
                    setTitle(e.target.value);
                  }}
                  placeholder={t('documents:form.placeholders.title')}
                  className={inputClass('title', 'w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all placeholder:text-slate-700 font-medium')}
                />
                <FieldError message={fieldErrors.title} />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{t('documents:form.fields.category')}</label>
                <div className="relative">
                  <LayoutGrid size={16} className="absolute left-4 top-4 text-slate-600" />
                  <select
                    data-error-field="category_id"
                    value={categoryId}
                    onChange={(e) => {
                      clearFieldError('category_id');
                      setCategoryId(e.target.value);
                    }}
                    className={inputClass('category_id', 'w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm text-white focus:border-cyan-500/50 outline-none appearance-none cursor-pointer')}
                  >
                    <option value="" className="bg-[#020617]">{t('documents:form.placeholders.category')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#020617]">{c.name}</option>
                    ))}
                  </select>
                </div>
                <FieldError message={fieldErrors.category_id} />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{t('documents:form.fields.docType')}</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType((e.target.value as DocumentType) || '')}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-cyan-500/50 outline-none appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#020617]">{t('documents:form.placeholders.docType')}</option>
                  {DOC_TYPES.map((docTypeKey) => (
                    <option key={docTypeKey} value={docTypeKey} className="bg-[#020617] uppercase">
                      {t(`documents:form.docTypes.${docTypeKey}`, { defaultValue: docTypeKey })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Technical Details */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-white border-b border-white/5 pb-2">
              <Building2 size={16} className="text-purple-500" />
              <span className="text-xs font-black uppercase italic tracking-widest">{t('documents:form.sections.extra')}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{t('documents:form.fields.description')}</label>
                <textarea
                  data-error-field="description"
                  value={description}
                  onChange={(e) => {
                    clearFieldError('description');
                    setDescription(e.target.value);
                  }}
                  rows={3}
                  placeholder={t('documents:form.placeholders.description')}
                  className={inputClass('description', 'w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-cyan-500/50 outline-none transition-all placeholder:text-slate-700')}
                />
                <FieldError message={fieldErrors.description} />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{t('documents:form.fields.manufacturer')}</label>
                <input
                  data-error-field="manufacturer"
                  value={manufacturer}
                  onChange={(e) => {
                    clearFieldError('manufacturer');
                    setManufacturer(e.target.value);
                  }}
                  placeholder={t('documents:form.placeholders.manufacturer')}
                  className={inputClass('manufacturer', 'w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-cyan-500/50 outline-none transition-all')}
                />
                <FieldError message={fieldErrors.manufacturer} />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{t('documents:form.fields.externalUrl')}</label>
                <div className="relative">
                  <LinkIcon size={16} className="absolute left-4 top-4 text-slate-600" />
                  <input
                    data-error-field="pdf_url"
                    value={pdfUrl}
                    onChange={(e) => {
                      clearFieldError('pdf_url');
                      setPdfUrl(e.target.value);
                    }}
                    placeholder={t('documents:form.placeholders.externalUrl')}
                    className={inputClass('pdf_url', 'w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm text-white focus:border-cyan-500/50 outline-none transition-all placeholder:text-slate-700 font-mono')}
                  />
                </div>
                <FieldError message={fieldErrors.pdf_url} />
              </div>
            </div>
          </div>

          {/* Section 3: File Upload */}
          <div className="p-8 bg-cyan-500/[0.03] border border-cyan-500/20 rounded-[24px]">
            <label className="block text-[10px] font-black uppercase tracking-widest text-cyan-500 mb-4 flex items-center gap-2">
              <FileUp size={14} /> {t('documents:form.fields.upload')}
            </label>
            <div className="relative group">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.rtf,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                data-error-field="file"
                className={`border-2 border-dashed group-hover:border-cyan-500/40 rounded-2xl p-6 transition-all text-center ${fieldErrors.file ? 'border-red-500/80 bg-red-500/10' : 'border-white/10'}`}
              >
                {file ? (
                  <div className="flex flex-col items-center">
                    <span className="text-cyan-400 font-bold text-sm mb-1">{file.name}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{t('documents:form.fileReady', { sizeMb: (file.size / 1024 / 1024).toFixed(2) })}</span>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-400">{t('documents:form.dropHere')}</p>
                    <p className="text-[9px] text-slate-600 mt-2 uppercase tracking-tighter">{t('documents:form.supportedTypes')}</p>
                  </div>
                )}
              </div>
            </div>
            <FieldError message={fieldErrors.file} />
            {isEdit && !file && (
              <p className="text-[9px] text-slate-500 mt-3 italic">{t('documents:form.keepExistingFileHint')}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-4 pt-4">
            <Link
              to={ROUTER.USER.DOCUMENTS_MINE}
              className="px-8 py-4 rounded-2xl border border-white/10 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 hover:text-white transition-all"
            >
              {t('documents:form.cancelTask')}
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-cyan-500 text-[#020617] text-[11px] font-[1000] uppercase tracking-[0.2em] hover:bg-cyan-400 hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {isEdit ? t('documents:form.submitUpdate') : t('documents:form.submitCreate')}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.2);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default DocumentFormPage;

const FieldError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return <p className="mt-2 text-xs font-semibold text-red-400">{message}</p>;
};