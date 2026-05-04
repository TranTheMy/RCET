import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Download, Eye, FileText, Loader2, Mail, Microscope, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { scientistApplicationService } from '../../services/scientistApplication.service';
import { useAuthStore } from '../../store/authStore';
import type { ScientistApplicationItem } from '../../types';
import { ROUTER } from '../../routes/router';
import { PdfPreviewPanel } from '../../components/preview/PdfPreviewPanel';
import { useTranslation } from 'react-i18next';

const statusLabel: Record<string, string> = {
  pending_lab_review: 'pending_lab_review',
  lab_rejected: 'lab_rejected',
  pending_director_review: 'pending_director_review',
  director_rejected: 'director_rejected',
  approved: 'approved',
};

function cvFileKindFromUrl(url: string): 'pdf' | 'word' | 'unknown' {
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.pdf')) return 'pdf';
  if (path.endsWith('.doc') || path.endsWith('.docx')) return 'word';
  return 'unknown';
}

async function sniffCvKind(url: string): Promise<'pdf' | 'word' | 'unknown'> {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-7' } });
    if (!r.ok && r.status !== 206) return 'unknown';
    const buf = await r.arrayBuffer();
    if (buf.byteLength < 4) return 'unknown';
    const u8 = new Uint8Array(buf);
    const sig4 = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
    if (sig4 === '%PDF') return 'pdf';
    if (u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04) return 'word';
    if (u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0) return 'word';
  } catch {
    /* CORS / mạng */
  }
  return 'unknown';
}

const CvDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const role = useAuthStore((s) => s.user?.system_role);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<ScientistApplicationItem | null>(null);
  const [sniffedKind, setSniffedKind] = useState<'pdf' | 'word' | 'unknown' | null>(null);
  

  const backHref =
    role === 'truong_lab' || role === 'vien_truong' ? ROUTER.USER.CV_APPROVALS : ROUTER.USER.HOME;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await scientistApplicationService.getOne(id);
      setRow(res.data ?? null);
    } catch {
      toast.error(t('user:cv.detail.toasts.fetchFailed'));
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const fileUrl = row?.fileUrl?.trim() ?? '';
  const urlKind = fileUrl ? cvFileKindFromUrl(fileUrl) : 'unknown';

  useEffect(() => {
    setSniffedKind(null);
    if (!fileUrl || urlKind !== 'unknown') return;
    let cancelled = false;
    sniffCvKind(fileUrl).then((k) => {
      if (!cancelled) setSniffedKind(k);
    });
    return () => {
      cancelled = true;
    };
  }, [fileUrl, urlKind]);

  const effectiveKind = urlKind !== 'unknown' ? urlKind : sniffedKind ?? 'unknown';
  const sniffPending = Boolean(fileUrl && urlKind === 'unknown' && sniffedKind === null);

  const downloadName = useMemo(() => {
    if (!row?.fullName || !fileUrl) return 'cv';
    const fromUrl = fileUrl.split('?')[0].match(/\.(pdf|docx?)$/i)?.[0];
    const fromKind =
      effectiveKind === 'pdf' ? '.pdf' : effectiveKind === 'word' ? '.docx' : null;
    const ext = fromUrl ?? fromKind ?? '.pdf';
    const safe = row.fullName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'cv';
    return `${safe}${ext}`;
  }, [row?.fullName, fileUrl, effectiveKind]);

  const loadRemoteBlob = useCallback(() => {
    return fetch(fileUrl).then((r) => {
      if (!r.ok) throw new Error(t('user:cv.detail.errors.fileFetchFailed'));
      return r.blob();
    });
  }, [fileUrl, t]);

  const downloadBtnClass =
    'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-400 text-[#020617] text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-500/20 hover:bg-cyan-300 transition-colors';

  return (
    <div
      className="min-h-screen text-slate-200 pb-24 pt-6 md:pt-10 px-4 md:px-8"
      style={{
        background:
          'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(34,211,238,0.08), transparent), #020617',
      }}
    >
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center gap-4 mb-8 md:mb-10 pb-6 border-b border-white/[0.07]">
          <Link
            to={backHref}
            className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-cyan-500/35 hover:bg-white/[0.06] transition-all shrink-0"
            aria-label={backHref === ROUTER.USER.CV_APPROVALS ? t('user:cv.detail.actions.backToApprovalsAria') : t('user:cv.detail.actions.backHomeAria')}
          >
            <ChevronLeft size={20} className="text-cyan-400" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-black text-white uppercase tracking-tight">{t('user:cv.detail.title')}</h1>
            <p className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
              {t('user:cv.detail.subtitle')}
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
          </div>
        ) : !row ? (
          <p className="text-center text-slate-500 py-20 text-sm">{t('user:cv.detail.empty')}</p>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8">
            {/* Trái: xem trước CV */}
            <section className="min-w-0 flex-1 order-1 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-2xl shadow-black/50 overflow-hidden ring-1 ring-white/[0.06]">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 md:px-5 border-b border-white/10 bg-black/30">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/25 shrink-0">
                    <Eye className="w-4 h-4 text-cyan-400" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Xem trước</p>
                    <p className="text-sm font-semibold text-white truncate">{t('user:cv.detail.preview.attachment')}</p>
                  </div>
                </div>
                {fileUrl ? (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={downloadName}
                    className={downloadBtnClass}
                  >
                    <Download size={15} strokeWidth={2.5} />
                    {t('user:cv.detail.actions.downloadCv')}
                  </a>
                ) : (
                  <span className="text-xs text-slate-500 italic">{t('user:cv.detail.preview.noFile')}</span>
                )}
              </div>

              <div className="bg-[#050a12]">
                {!fileUrl ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-24 px-6 text-center">
                    <FileText className="w-12 h-12 text-slate-600" strokeWidth={1.25} />
                    <p className="text-sm text-slate-500 max-w-sm">{t('user:cv.detail.preview.noFileHint')}</p>
                  </div>
                ) : null}

                {fileUrl && sniffPending ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-28">
                    <Loader2 className="w-9 h-9 animate-spin text-cyan-500" />
                    <p className="text-xs text-slate-500">{t('user:cv.detail.preview.sniffing')}</p>
                  </div>
                ) : null}

                {fileUrl && !sniffPending && effectiveKind === 'pdf' ? (
                  <PdfPreviewPanel
                    title={t('user:cv.detail.preview.pdfTitle')}
                    directPdfUrl={fileUrl}
                    tabOpenUrl={fileUrl}
                    showToolbar={false}
                    className="!shadow-none"
                  />
                ) : null}

                {fileUrl && !sniffPending && (effectiveKind === 'word' || effectiveKind === 'unknown') ? (
                  <div>
                    <PdfPreviewPanel
                      title={t('user:cv.detail.preview.title')}
                      loadPreviewBlob={loadRemoteBlob}
                      tabOpenUrl={fileUrl}
                      showToolbar={false}
                      className="!shadow-none"
                    />
                    <p className="text-[10px] leading-relaxed text-slate-500 px-4 py-3 border-t border-white/10 bg-black/40">
                      {t('user:cv.detail.preview.wordHintPrefix')}{' '}
                      <span className="text-slate-400 font-semibold">{t('user:cv.detail.actions.downloadCv')}</span>.
                    </p>
                  </div>
                ) : null}
              </div>
            </section>

            {/* Phải: thông tin ứng viên */}
            <aside className="w-full lg:w-[min(100%,380px)] xl:w-[400px] shrink-0 order-2 lg:sticky lg:top-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-6 md:p-7 shadow-xl shadow-black/40 ring-1 ring-white/[0.05] relative overflow-hidden">
                <div
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500/0 via-cyan-500/60 to-cyan-500/0 pointer-events-none"
                  aria-hidden
                />
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-cyan-500/12 border border-cyan-500/25 text-[10px] font-black uppercase tracking-widest text-cyan-400">
                  {t(`user:cv.status.${statusLabel[row.status] ?? row.status}`)}
                </span>
                <h2 className="text-2xl font-bold text-white mt-4 tracking-tight">{row.fullName}</h2>
                <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">{t('user:cv.detail.candidate')}</p>

                <div className="mt-6 space-y-4">
                  <div className="flex gap-3 items-start">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 border border-white/10">
                      <Mail className="w-4 h-4 text-cyan-400/90" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('user:cv.detail.email')}</p>
                      <a href={`mailto:${row.email}`} className="text-sm text-slate-200 hover:text-cyan-300 break-all transition-colors">
                        {row.email}
                      </a>
                    </div>
                  </div>
                  {row.phone ? (
                    <div className="flex gap-3 items-start">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 border border-white/10">
                        <Phone className="w-4 h-4 text-cyan-400/90" />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('user:cv.detail.phone')}</p>
                        <a href={`tel:${row.phone}`} className="text-sm text-slate-200 hover:text-cyan-300 transition-colors">
                          {row.phone}
                        </a>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex gap-3 items-start">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 border border-white/10">
                      <Microscope className="w-4 h-4 text-cyan-400/90" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('user:cv.detail.field')}</p>
                      <p className="text-sm text-slate-200">{row.position}</p>
                    </div>
                  </div>
                </div>

                {row.portfolioUrl ? (
                  <div className="mt-5 pt-5 border-t border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('user:cv.detail.links')}</p>
                    <a
                      href={row.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 break-all leading-relaxed"
                    >
                      {row.portfolioUrl}
                    </a>
                  </div>
                ) : null}

                {row.coverLetter ? (
                  <div className="mt-5 pt-5 border-t border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('user:cv.detail.coverLetter')}</p>
                    <div className="rounded-xl bg-black/35 border border-white/[0.06] px-4 py-3 max-h-48 overflow-y-auto">
                      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{row.coverLetter}</p>
                    </div>
                  </div>
                ) : null}

                {row.labComment ? (
                  <p className="text-xs text-amber-200/85 mt-5 pt-5 border-t border-white/10 border-l-2 border-amber-500/60 pl-3 leading-relaxed">
                    <span className="font-bold text-amber-400/90">{t('user:cv.detail.labels.lab')}:</span> {row.labComment}
                  </p>
                ) : null}
                {row.directorComment ? (
                  <p className="text-xs text-rose-200/85 mt-3 border-l-2 border-rose-500/60 pl-3 leading-relaxed">
                    <span className="font-bold text-rose-400/90">{t('user:cv.detail.labels.director')}:</span> {row.directorComment}
                  </p>
                ) : null}
                {row.contractSummary || row.contractFileUrl ? (
                  <div className="mt-5 pt-5 border-t border-white/10 text-xs text-emerald-300/90 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/80">{t('user:cv.detail.contract.title')}</p>
                    {row.contractSummary ? <p className="leading-relaxed text-emerald-200/90">{row.contractSummary}</p> : null}
                    {row.contractFileUrl ? (
                      <a
                        href={row.contractFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                      >
                        <FileText size={14} />
                        {t('user:cv.detail.contract.file')}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default CvDetailPage;
