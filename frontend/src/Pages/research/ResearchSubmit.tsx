import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileUp, Link as LinkIcon, Loader2, Send, ShieldCheck,
  ChevronLeft, Info, Cpu, CheckCircle, AlertCircle, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { researchService } from '../../services/research.service';
import type { ProjectTag, ResearchImpactRank, ResearchSourceType } from '../../types';
import { ROUTER } from '../../routes/router';
import { PROJECT_TAG_OPTIONS } from '../../constants/projectTags';
import { useTranslation } from 'react-i18next';
import { translateApiMessage } from '../../utils/apiErrorI18n';
import { useAuthStore } from '../../store/authStore';

const IMPACT_RANK_OPTIONS: { value: ResearchImpactRank; hintKey?: string }[] = [
  { value: 'No Rank', hintKey: 'research:submit.impact.noRankHint' },
  { value: 'Q1', hintKey: 'research:submit.impact.q1Hint' },
  { value: 'Q2', hintKey: 'research:submit.impact.q2Hint' },
  { value: 'Q3', hintKey: 'research:submit.impact.q3Hint' },
  { value: 'Q4', hintKey: 'research:submit.impact.q4Hint' },
];

const getTodayLocalISO = () => {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
};

const normalizePositiveInt = (raw: string, fallback = 1) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return fallback;
  const value = parseInt(digits, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const ResearchSubmit: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isVienTruong = user?.system_role === 'vien_truong';
  const [directorPublishPublic, setDirectorPublishPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [sourceType, setSourceType] = useState<ResearchSourceType>('upload');
  const [file, setFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    title: '',
    authors: '',
    published_date: '',
    journal: '',
    volume: 1,
    issue: 1,
    pages: '',
    publisher: '',
    description: '',
    total_citations: 0,
    pdf_url: '',
    impact_rank: 'No Rank' as ResearchImpactRank,
    is_peer_reviewed: true,
    is_open_access: false,
    doi: '',
  });

  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [volumeDraft, setVolumeDraft] = useState('1');
  const [issueDraft, setIssueDraft] = useState('1');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const todayISO = useMemo(() => getTodayLocalISO(), []);
  const inputClass = (field: string, extra = '') =>
    `form-input-hub ${fieldErrors[field] ? 'form-input-hub--error' : ''} ${extra}`.trim();
  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };
  const scrollToFirstFieldError = (errors: Record<string, string>) => {
    const priorityOrder = [
      'title',
      'authors',
      'published_date',
      'journal',
      'volume',
      'issue',
      'pages',
      'doi',
      'publisher',
      'description',
      'file',
      'pdf_url',
    ];
    const firstField =
      priorityOrder.find((field) => Boolean(errors[field])) || Object.keys(errors)[0];
    if (!firstField) return;
    const target = document.querySelector<HTMLElement>(`[data-error-field="${firstField}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
  };

  // Kiểm tra xem form có dữ liệu nào chưa để cảnh báo khi thoát
  const isDirty = useMemo(() => {
    return (
      Object.values(form).some((v) => v !== '' && v !== 1 && v !== 0 && v !== true && v !== false) ||
      !!file ||
      tags.length > 0 ||
      (isVienTruong && directorPublishPublic)
    );
  }, [form, file, tags.length, isVienTruong, directorPublishPublic]);

  const commitTagDraft = useCallback(() => {
    const segments = tagDraft
      .split(/[,;]/)
      .map((s) => s.trim().replace(/^#/, ''))
      .filter(Boolean);
    if (segments.length === 0) return;

    setTags((prev) => {
      const next = [...prev];
      for (const tagValue of segments) {
        if (next.length >= 24) {
          toast.error(t('research:submit.toasts.maxTags'));
          break;
        }
        if (tagValue.length > 48) {
          toast.error(t('research:submit.toasts.maxTagLength'));
          continue;
        }
        if (next.some((x) => x.toLowerCase() === tagValue.toLowerCase())) continue;
        next.push(tagValue);
      }
      return next;
    });
    setTagDraft('');
  }, [tagDraft, t]);

  const removeTag = useCallback((index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** Nhãn cùng bộ với dự án (CreateProject) — thêm một cú click */
  const addProjectTag = useCallback((tagValue: ProjectTag) => {
    setTags((prev) => {
      if (prev.length >= 24) {
        toast.error(t('research:submit.toasts.maxTags'));
        return prev;
      }
      if (prev.some((x) => x === tagValue)) return prev;
      return [...prev, tagValue];
    });
  }, [t]);

  const validateClientFields = useCallback(() => {
    const errors: Record<string, string> = {};
    const requiredTextFields: Array<{ field: keyof typeof form; label: string }> = [
      { field: 'title', label: 'Tiêu đề bài báo' },
      { field: 'authors', label: 'Tác giả' },
      { field: 'published_date', label: 'Ngày công bố' },
      { field: 'journal', label: 'Tạp chí/Hội nghị' },
      { field: 'pages', label: 'Số trang' },
      { field: 'publisher', label: 'Nhà xuất bản' },
      { field: 'description', label: 'Tóm tắt nghiên cứu' },
      { field: 'doi', label: 'DOI' },
    ];

    for (const item of requiredTextFields) {
      if (!String(form[item.field] || '').trim()) {
        errors[item.field] = `${item.label} là bắt buộc`;
      }
    }

    const normalizedVolume = normalizePositiveInt(volumeDraft, 0);
    const normalizedIssue = normalizePositiveInt(issueDraft, 0);
    if (normalizedVolume < 1) errors.volume = 'Tập (volume) phải là số nguyên dương';
    if (normalizedIssue < 1) errors.issue = 'Số (issue) phải là số nguyên dương';

    if (sourceType === 'upload' && !file) {
      errors.file = 'Vui lòng đính kèm file tài liệu (PDF, Word, Excel, …)';
    }
    if (sourceType === 'link') {
      const link = String(form.pdf_url || '').trim();
      if (!link) {
        errors.pdf_url = 'Vui lòng nhập URL bài báo';
      } else if (!/^https?:\/\//i.test(link)) {
        errors.pdf_url = 'URL bài báo phải bắt đầu bằng http:// hoặc https://';
      }
    }

    return errors;
  }, [file, form, issueDraft, sourceType, volumeDraft]);

  const handleReturn = () => {
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      navigate(-1);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clientErrors = validateClientFields();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      scrollToFirstFieldError(clientErrors);
      toast.error(t('research:submit.toasts.requiredFields'));
      return;
    }

    setSubmitting(true);
    try {
      setFieldErrors({});
      const normalizedVolume = normalizePositiveInt(volumeDraft, 1);
      const normalizedIssue = normalizePositiveInt(issueDraft, 1);

      const res = await researchService.submit({
        ...form,
        volume: normalizedVolume,
        issue: normalizedIssue,
        source_type: sourceType,
        pdf_url: sourceType === 'link' ? form.pdf_url : undefined,
        file: sourceType === 'upload' ? file ?? undefined : undefined,
        tags: tags.length > 0 ? tags : undefined,
        ...(isVienTruong ? { is_public: directorPublishPublic } : {}),
      });
      try {
        localStorage.setItem('research-status-updated', String(Date.now()));
        window.dispatchEvent(new CustomEvent('research-status-updated'));
      } catch {
        /* ignore */
      }
      const created = res.data;
      const publishedDirect = created?.status === 'approved';
      toast.success(
        publishedDirect
          ? t('research:submit.toasts.directorPublished')
          : t('research:submit.toasts.submitted'),
      );
      navigate(ROUTER.USER.RESEARCH_MINE);
    } catch (err: unknown) {
      const backendErrors = (err as { response?: { data?: { errors?: Array<{ field?: string; message?: string }> } } })
        ?.response?.data?.errors;
      if (Array.isArray(backendErrors) && backendErrors.length > 0) {
        const nextErrors: Record<string, string> = {};
        for (const it of backendErrors) {
          if (!it?.field || !it?.message) continue;
          if (!nextErrors[it.field]) nextErrors[it.field] = translateApiMessage(t, it.message);
        }
        setFieldErrors(nextErrors);
        window.setTimeout(() => scrollToFirstFieldError(nextErrors), 0);
      }
      const rawMsg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      const msg =
        translateApiMessage(t, typeof rawMsg === 'string' ? rawMsg : '') ||
        t('research:submit.toasts.submitFailed');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 relative">
      <div className="max-w-6xl mx-auto px-6 pt-12">
        {/* Accent line — không sticky để tránh chồng lên header trong suốt khi cuộn */}
        <div
          className="h-1 w-full max-w-md rounded-full bg-gradient-to-r from-indigo-600 via-cyan-500 to-emerald-500 mb-8"
          aria-hidden
        />

        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            {/* 1. Nút quay lại */}
            <button
              onClick={handleReturn}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-indigo-600 transition-colors mb-6 group"
            >
              <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              {t('research:submit.actions.back')}
            </button>

            {/* 3. Kicker & Title */}
            <div className="flex items-center gap-3 text-indigo-600 font-black text-[10px] uppercase tracking-[0.3em] mb-3">
              <Cpu size={16} /> {t('research:submit.kicker')}
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
              {t('research:submit.titlePrefix')} <span className="text-indigo-600">{t('research:submit.titleHighlight')}</span>
            </h1>
            <p className="text-slate-500 text-sm mt-2 font-medium max-w-xl">
              {t(isVienTruong ? 'research:submit.subtitleDirector' : 'research:submit.subtitle')}
            </p>
          </div>

          <Link
            to={ROUTER.USER.RESEARCH_MINE}
            className="group inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white border border-slate-200 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-600 hover:shadow-lg transition-all"
          >
            <ShieldCheck size={18} />
            {t('research:submit.actions.mine')}
          </Link>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* LEFT: MAIN FORM */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[40px] border border-slate-200 p-8 md:p-10 shadow-xl shadow-slate-200/40">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                  <Info size={20} />
                </div>
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{t('research:submit.sections.technical')}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <Field label={t('research:submit.fields.title.label')} sub={t('research:submit.fields.title.sub')}>
                  <input
                    data-error-field="title"
                    value={form.title}
                    onChange={(e) => {
                      clearFieldError('title');
                      setForm((p) => ({ ...p, title: e.target.value }));
                    }}
                    className={inputClass('title')}
                    placeholder={t('research:submit.fields.title.placeholder')}
                  />
                  <FieldError message={fieldErrors.title} />
                </Field>

                <Field label={t('research:submit.fields.authors.label')} sub={t('research:submit.fields.authors.sub')}>
                  <input
                    data-error-field="authors"
                    value={form.authors}
                    onChange={(e) => {
                      clearFieldError('authors');
                      setForm((p) => ({ ...p, authors: e.target.value }));
                    }}
                    className={inputClass('authors')}
                    placeholder={t('research:submit.fields.authors.placeholder')}
                  />
                  <FieldError message={fieldErrors.authors} />
                </Field>

                <Field label={t('research:submit.fields.publishedDate.label')} sub={t('research:submit.fields.publishedDate.sub')}>
                  <input
                    data-error-field="published_date"
                    type="date"
                    value={form.published_date}
                    min={todayISO}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next && next < todayISO) {
                        toast.error('Không thể chọn ngày đã qua');
                        return;
                      }
                      clearFieldError('published_date');
                      setForm((p) => ({ ...p, published_date: next }));
                    }}
                    className={inputClass('published_date', 'cursor-pointer')}
                  />
                  <FieldError message={fieldErrors.published_date} />
                </Field>

                <Field label={t('research:submit.fields.journal.label')} sub={t('research:submit.fields.journal.sub')}>
                  <input
                    data-error-field="journal"
                    value={form.journal}
                    onChange={(e) => {
                      clearFieldError('journal');
                      setForm((p) => ({ ...p, journal: e.target.value }));
                    }}
                    className={inputClass('journal')}
                    placeholder={t('research:submit.fields.journal.placeholder')}
                  />
                  <FieldError message={fieldErrors.journal} />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Tập" sub="Volume">
                    <input
                      data-error-field="volume"
                      type="number"
                      min={1}
                      step={1}
                      value={volumeDraft}
                      onChange={(e) => {
                        clearFieldError('volume');
                        setVolumeDraft(e.target.value.replace(/[^\d]/g, ''));
                      }}
                      onBlur={() => {
                        const normalized = normalizePositiveInt(volumeDraft, 1);
                        setVolumeDraft(String(normalized));
                        setForm((p) => ({ ...p, volume: normalized }));
                      }}
                      className={inputClass('volume')}
                    />
                    <FieldError message={fieldErrors.volume} />
                  </Field>
                  <Field label="Số" sub="Issue">
                    <input
                      data-error-field="issue"
                      type="number"
                      min={1}
                      step={1}
                      value={issueDraft}
                      onChange={(e) => {
                        clearFieldError('issue');
                        setIssueDraft(e.target.value.replace(/[^\d]/g, ''));
                      }}
                      onBlur={() => {
                        const normalized = normalizePositiveInt(issueDraft, 1);
                        setIssueDraft(String(normalized));
                        setForm((p) => ({ ...p, issue: normalized }));
                      }}
                      className={inputClass('issue')}
                    />
                    <FieldError message={fieldErrors.issue} />
                  </Field>
                </div>

                <Field label={t('research:submit.fields.pages.label')} sub={t('research:submit.fields.pages.sub')}>
                  <input
                    data-error-field="pages"
                    value={form.pages}
                    onChange={(e) => {
                      clearFieldError('pages');
                      setForm((p) => ({ ...p, pages: e.target.value }));
                    }}
                    className={inputClass('pages')}
                    placeholder={t('research:submit.fields.pages.placeholder')}
                  />
                  <FieldError message={fieldErrors.pages} />
                </Field>

                <Field label="DOI *" sub="Mã định danh số">
                  <input
                    data-error-field="doi"
                    value={form.doi}
                    onChange={(e) => {
                      clearFieldError('doi');
                      setForm((p) => ({ ...p, doi: e.target.value }));
                    }}
                    className={inputClass('doi', 'font-mono text-xs')}
                    placeholder="10.1000/xyz123"
                  />
                  <FieldError message={fieldErrors.doi} />
                </Field>

                <Field label={t('research:submit.fields.impact.label')} sub={t('research:submit.fields.impact.sub')}>
                  <select
                    value={form.impact_rank}
                    onChange={(e) => setForm((p) => ({ ...p, impact_rank: e.target.value as ResearchImpactRank }))}
                    className="form-input-hub bg-white cursor-pointer"
                  >
                    {IMPACT_RANK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} title={opt.hintKey ? t(opt.hintKey) : undefined}>
                        {opt.value === 'No Rank' ? `${t('research:impact.noRank')} (No Rank)` : `${opt.value} — ${opt.hintKey ? t(opt.hintKey) : ''}`}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                    {(() => {
                      const hit = IMPACT_RANK_OPTIONS.find((o) => o.value === form.impact_rank);
                      return hit?.hintKey ? t(hit.hintKey) : '';
                    })()}
                  </p>
                </Field>

                <Field label={t('research:submit.fields.publisher.label')} sub={t('research:submit.fields.publisher.sub')}>
                  <input
                    data-error-field="publisher"
                    value={form.publisher}
                    onChange={(e) => {
                      clearFieldError('publisher');
                      setForm((p) => ({ ...p, publisher: e.target.value }));
                    }}
                    className={inputClass('publisher')}
                    placeholder={t('research:submit.fields.publisher.placeholder')}
                  />
                  <FieldError message={fieldErrors.publisher} />
                </Field>

                <div className="md:col-span-2 mt-4">
                  <Field label={t('research:submit.fields.description.label')} sub={t('research:submit.fields.description.sub')}>
                    <textarea
                      data-error-field="description"
                      value={form.description}
                      onChange={(e) => {
                        clearFieldError('description');
                        setForm((p) => ({ ...p, description: e.target.value }));
                      }}
                      rows={6}
                      className={inputClass('description', 'resize-none py-4 leading-relaxed')}
                      placeholder={t('research:submit.fields.description.placeholder')}
                    />
                    <FieldError message={fieldErrors.description} />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label={t('research:submit.fields.tags.label')} sub={t('research:submit.fields.tags.sub')}>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-2">
                          {t('research:submit.fields.tags.projectTags')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {PROJECT_TAG_OPTIONS.map((opt) => {
                            const on = tags.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => addProjectTag(opt)}
                                disabled={on}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${on
                                    ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-default'
                                    : 'border-indigo-200 bg-white text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50'
                                  }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <input
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onBlur={() => {
                          if (tagDraft.trim()) commitTagDraft();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitTagDraft();
                          }
                        }}
                        className="form-input-hub"
                        placeholder={t('research:submit.fields.tags.placeholder')}
                      />
                      {tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tagValue, i) => (
                            <span
                              key={`${tagValue}-${i}`}
                              className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-[11px] font-bold text-indigo-800"
                            >
                              {tagValue}
                              <button
                                type="button"
                                onClick={() => removeTag(i)}
                                className="p-0.5 rounded-lg hover:bg-indigo-200/80 text-indigo-600 transition-colors"
                                aria-label={t('research:submit.fields.tags.removeAria', { tag: tagValue })}
                              >
                                <X size={14} strokeWidth={2.5} />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </Field>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: ASSETS & ACTIONS */}
          <div className="lg:col-span-4 space-y-6">

            {/* SOURCE SELECTOR CARD */}
            <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl shadow-indigo-900/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -z-0" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-6 relative z-10">{t('research:submit.source.title')}</h3>


              <div className="flex p-1.5 bg-white/5 rounded-2xl border border-white/10 mb-8 relative z-10">
                <button
                  type="button"
                  onClick={() => setSourceType('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sourceType === 'upload' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-white'}`}
                >
                  <FileUp size={14} /> {t('research:submit.source.upload')}
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('link')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sourceType === 'link' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-white'}`}
                >
                  <LinkIcon size={14} /> {t('research:submit.source.link')}
                </button>
              </div>

              <div className="space-y-6 relative z-10">
                {sourceType === 'upload' ? (
                  <>
                    <div className={`group relative border-2 border-dashed rounded-2xl p-8 text-center hover:border-indigo-400 hover:bg-white/5 transition-all cursor-pointer ${fieldErrors.file ? 'border-red-400/90 bg-red-500/10' : 'border-white/10'}`}>
                      <input
                        data-error-field="file"
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt"
                        onChange={(e) => {
                          clearFieldError('file');
                          setFile(e.target.files?.[0] ?? null);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <FileUp size={24} className="text-indigo-400" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] line-clamp-1 px-2">
                        {file ? file.name : t('research:submit.source.pickFile')}
                      </p>
                      <p className="text-[8px] text-slate-500 mt-2 uppercase tracking-widest font-bold">{t('research:submit.source.fileHint')}</p>
                    </div>
                    <FieldError message={fieldErrors.file} />
                  </>
                ) : (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t('research:submit.source.externalPdf')}</span>
                    <input
                      data-error-field="pdf_url"
                      value={form.pdf_url}
                      onChange={(e) => {
                        clearFieldError('pdf_url');
                        setForm((p) => ({ ...p, pdf_url: e.target.value }));
                      }}
                      className={`w-full rounded-xl px-4 py-4 text-sm text-white outline-none transition-all font-medium ${fieldErrors.pdf_url ? 'bg-red-500/10 border border-red-400/90 focus:border-red-300' : 'bg-white/5 border border-white/10 focus:border-indigo-400'}`}
                      placeholder="https://example.com/paper.pdf"
                    />
                    <FieldError message={fieldErrors.pdf_url} />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 pt-2">
                  <Checkbox label={t('research:submit.flags.peerReviewed')} checked={form.is_peer_reviewed} onChange={(v) => setForm(p => ({ ...p, is_peer_reviewed: v }))} />
                  <Checkbox label={t('research:submit.flags.openAccess')} checked={form.is_open_access} onChange={(v) => setForm(p => ({ ...p, is_open_access: v }))} />
                  {isVienTruong && (
                    <Checkbox
                      label={t('research:submit.flags.directorPublic')}
                      checked={directorPublishPublic}
                      onChange={setDirectorPublishPublic}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleReturn}
                  className="flex-1 h-16 inline-flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all active:scale-[0.98]"
                >
                  {t('common:actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2.5] h-16 inline-flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.3em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/30 disabled:opacity-50 active:scale-[0.98]"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  {t('research:submit.actions.submit')}
                </button>
              </div>

              <div className="p-6 bg-slate-100 border border-slate-200 rounded-[32px]">
                <div className="flex gap-4">
                  <AlertCircle size={18} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-wide">
                    {t('research:submit.protocol.prefix')}{' '}
                    <span className="font-medium normal-case">
                      {t(
                        isVienTruong
                          ? 'research:submit.protocol.bodyDirector'
                          : 'research:submit.protocol.body',
                      )}
                    </span>
                  </p>
                </div>
              </div>
            </div>

          </div>
        </form>
      </div>

      {/* DISCARD CONFIRMATION MODAL */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDiscardModal(false)} />
          <div className="bg-white rounded-[40px] p-10 max-w-md w-full relative z-10 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowDiscardModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-50 text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="w-16 h-16 rounded-3xl bg-red-50 flex items-center justify-center text-red-500 mb-6">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2 italic">{t('research:submit.discard.title')}</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">{t('research:submit.discard.hint')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDiscardModal(false)}
                className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                {t('research:submit.discard.keepEditing')}
              </button>
              <button
                onClick={() => navigate(-1)}
                className="flex-1 py-4 rounded-2xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all"
              >
                {t('research:submit.discard.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL STYLES FOR INPUTS */}
      <style>{`
        .form-input-hub {
          width: 100%;
          padding: 1rem 1.25rem;
          border-radius: 1.25rem;
          border: 1.5px solid #F1F5F9;
          background: #F8FAFC;
          font-size: 0.875rem;
          font-weight: 700;
          color: #1E293B;
          outline: none;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .form-input-hub:focus {
          border-color: #6366F1;
          background: #FFFFFF;
          box-shadow: 0 10px 30px -10px rgba(99, 102, 241, 0.15);
        }
        .form-input-hub::placeholder {
          color: #CBD5E1;
          font-weight: 500;
        }
        .form-input-hub--error {
          border-color: #EF4444;
          background: #FEF2F2;
          box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.2);
        }
        .form-input-hub--error:focus {
          border-color: #EF4444;
          background: #FFFFFF;
          box-shadow: 0 10px 30px -10px rgba(239, 68, 68, 0.35);
        }
      `}</style>
    </div>
  );
};

/* --- SHARED COMPONENTS --- */

const Field: React.FC<{ label: string; sub?: string; children: React.ReactNode }> = ({ label, sub, children }) => (
  <div className="space-y-2">
    <div className="flex flex-col px-1">
      <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{label}</span>
      {sub && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{sub}</span>}
    </div>
    {children}
  </div>
);

const FieldError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return <p className="px-1 text-xs font-semibold text-red-500">{message}</p>;
};

const Checkbox: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <label
    onClick={(e) => { e.preventDefault(); onChange(!checked); }}
    className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all group"
  >
    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 group-hover:text-white transition-colors">{label}</span>
    <div
      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${checked ? 'bg-indigo-500 border-indigo-500 scale-110' : 'border-white/20 bg-transparent'}`}
    >
      {checked && <CheckCircle size={14} className="text-white" strokeWidth={3} />}
    </div>
  </label>
);

export default ResearchSubmit;