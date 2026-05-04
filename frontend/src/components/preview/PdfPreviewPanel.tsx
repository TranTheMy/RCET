import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2, FileWarning, ExternalLink } from 'lucide-react';
// docx-preview 0.3.x: không có file CSS trong "exports" của package — đừng import .../dist/docx-preview.css (Vite báo lỗi). Style do renderAsync inject.
import { renderAsync } from 'docx-preview';
import { useTranslation } from 'react-i18next';

export interface PdfPreviewPanelProps {
  title: string;
  /**
   * PDF qua URL công khai — nhúng iframe trực tiếp (không qua API).
   * Lưu ý: nhiều CDN (Cloudinary, S3, …) gửi header chặn nhúng iframe → khung trắng.
   * Trang chi tiết giáo trình/tài liệu nên ưu tiên `loadPreviewBlob` (proxy JWT).
   */
  directPdfUrl?: string | null;
  /**
   * Khi không có `directPdfUrl` (file chỉ lưu trên server) — tải blob qua `/preview` + JWT.
   */
  loadPreviewBlob?: () => Promise<Blob>;
  gateLoading?: boolean;
  /** « Tab mới » / mở ngoài — nên là URL tải/xem được (download-url hoặc pdf_url) */
  tabOpenUrl?: string | null;
  onRetryOpenTab?: () => void;
  className?: string;
  /** false: ẩn thanh « Live preview » — dùng khi trang đã có tiêu đề / nút tải */
  showToolbar?: boolean;
}

type BlobStatus = 'idle' | 'loading' | 'ready' | 'ready-docx' | 'error' | 'unsupported';

function normalizeDirectPdfUrl(url: string | null | undefined): string | undefined {
  const u = url?.trim();
  if (!u || !/^https?:\/\//i.test(u)) return undefined;
  return u;
}

/** Phân loại nội dung blob: PDF (iframe), DOCX (docx-preview), hoặc không xem được trong trang (.doc, Excel, …). */
async function classifyPreviewBlob(blob: Blob): Promise<'pdf' | 'docx' | 'unsupported'> {
  const t = blob.type.toLowerCase();
  if (t.includes('spreadsheetml') || t.includes('presentationml')) return 'unsupported';
  if (t.includes('msword') && !t.includes('wordprocessingml')) return 'unsupported';

  if (t.includes('pdf')) return 'pdf';
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const pdfMagic =
    head.length >= 4 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
  if (pdfMagic) return 'pdf';

  if (t.includes('wordprocessingml') || t.includes('officedocument.wordprocessingml.document')) {
    return 'docx';
  }

  const zipMagic = head.length >= 2 && head[0] === 0x50 && head[1] === 0x4b;
  if (zipMagic && (t === '' || t.includes('octet-stream') || t === 'application/zip')) {
    return 'docx';
  }

  return 'unsupported';
}

/**
 * Xem trước tài liệu: PDF (iframe), .docx (render HTML). .doc cũ / Excel / … → chỉ mở ngoài.
 */
export const PdfPreviewPanel: React.FC<PdfPreviewPanelProps> = ({
  title,
  directPdfUrl,
  loadPreviewBlob,
  gateLoading = false,
  tabOpenUrl,
  onRetryOpenTab,
  className = '',
  showToolbar = true,
}) => {
  const { t } = useTranslation();
  const objectUrlRef = useRef<string | null>(null);
  const docxBlobRef = useRef<Blob | null>(null);
  const docxHostRef = useRef<HTMLDivElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [blobStatus, setBlobStatus] = useState<BlobStatus>('idle');

  const directSrc = normalizeDirectPdfUrl(directPdfUrl ?? null);
  const useDirect = !!directSrc;
  const useBlob = !useDirect && typeof loadPreviewBlob === 'function';

  useEffect(() => {
    const docxHost = docxHostRef.current;
    if (gateLoading || useDirect) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      docxBlobRef.current = null;
      if (docxHost) docxHost.innerHTML = '';
      return;
    }

    if (!useBlob || !loadPreviewBlob) {
      return;
    }

    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setBlobStatus('loading');
      setObjectUrl(null);
    });
    docxBlobRef.current = null;
    if (docxHost) docxHost.innerHTML = '';
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    loadPreviewBlob()
      .then(async (blob) => {
        if (cancelled) return;
        const kind = await classifyPreviewBlob(blob);
        if (cancelled) return;
        if (kind === 'pdf') {
          const u = URL.createObjectURL(blob);
          objectUrlRef.current = u;
          Promise.resolve().then(() => {
            if (cancelled) return;
            setObjectUrl(u);
            setBlobStatus('ready');
          });
          return;
        }
        if (kind === 'docx') {
          docxBlobRef.current = blob;
          Promise.resolve().then(() => {
            if (cancelled) return;
            setBlobStatus('ready-docx');
          });
          return;
        }
        Promise.resolve().then(() => {
          if (cancelled) return;
          setBlobStatus('unsupported');
        });
      })
      .catch(() => {
        if (cancelled) return;
        Promise.resolve().then(() => {
          if (cancelled) return;
          setBlobStatus('error');
        });
      });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      docxBlobRef.current = null;
      if (docxHost) docxHost.innerHTML = '';
    };
  }, [gateLoading, useDirect, useBlob, loadPreviewBlob]);

  useLayoutEffect(() => {
    if (blobStatus !== 'ready-docx') return;
    const host = docxHostRef.current;
    const blob = docxBlobRef.current;
    if (!host || !blob) return;

    host.innerHTML = '';
    let cancelled = false;

    renderAsync(blob, host, undefined, {
      inWrapper: true,
      ignoreWidth: true,
      ignoreHeight: false,
      className: 'docx-preview-vkslab',
    }).catch(() => {
      if (!cancelled) setBlobStatus('unsupported');
    });

    return () => {
      cancelled = true;
      host.innerHTML = '';
    };
  }, [blobStatus]);

  const showSpinner = gateLoading || (useBlob && blobStatus === 'loading');
  const showIframeBlob = useBlob && !!objectUrl && blobStatus === 'ready';
  const showDocx = useBlob && blobStatus === 'ready-docx';
  const showIframeDirect = useDirect && !gateLoading;
  const showBlobError = useBlob && !gateLoading && blobStatus === 'error';
  const showUnsupportedFormat = useBlob && !gateLoading && blobStatus === 'unsupported';
  const showNoSource =
    !gateLoading && !useDirect && !useBlob && !loadPreviewBlob;

  const tabHref = normalizeDirectPdfUrl(tabOpenUrl ?? null) || tabOpenUrl?.trim() || undefined;

  return (
    <div
      className={`flex flex-col overflow-hidden ${showToolbar ? 'rounded-[28px] border border-white/10 bg-[#0f172a] shadow-xl' : 'rounded-none border-0 bg-transparent shadow-none'} ${className}`}
    >
      {showToolbar ? (
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3 bg-black/20">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500/90">{t('common:preview.livePreview')}</span>
          {tabHref && (
            <a
              href={tabHref}
              target="_blank"
              rel="noreferrer"
              className="text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink size={12} /> {t('common:preview.newTab')}
            </a>
          )}
        </div>
      ) : null}

      <div className="relative flex-1 min-h-[min(70vh,820px)] w-full bg-[#1e293b]">
        {showSpinner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500 z-10 bg-[#1e293b]/80">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
            <p className="text-[10px] font-black uppercase tracking-widest">{t('common:preview.loading')}</p>
          </div>
        )}

        {showIframeDirect && (
          <iframe
            src={directSrc}
            title={title}
            className="absolute inset-0 w-full h-full border-0 bg-white"
          />
        )}

        {showIframeBlob && (
          <iframe
            src={objectUrl!}
            title={title}
            className="absolute inset-0 w-full h-full border-0 bg-white"
          />
        )}

        {showDocx && (
          <div
            ref={docxHostRef}
            className="docx-preview-host absolute inset-0 overflow-auto bg-white text-slate-900 p-4 text-[15px] leading-relaxed"
            title={title}
          />
        )}

        {showUnsupportedFormat && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <FileWarning className="w-12 h-12 text-amber-500/60" />
            <p className="text-sm text-slate-300 max-w-md font-medium">
              {t('common:preview.unsupportedTitle')}
            </p>
            <p className="text-xs text-slate-500 max-w-md">
              {t('common:preview.unsupportedHint')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {tabHref && (
                <a
                  href={tabHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 text-[10px] font-black uppercase tracking-widest border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
                >
                  <ExternalLink size={14} /> {t('common:preview.actions.openNewTab')}
                </a>
              )}
              {onRetryOpenTab && (
                <button
                  type="button"
                  onClick={onRetryOpenTab}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <ExternalLink size={14} /> {t('common:preview.actions.download')}
                </button>
              )}
            </div>
          </div>
        )}

        {showBlobError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <FileWarning className="w-12 h-12 text-amber-500/60" />
            <p className="text-sm text-slate-400 max-w-md">
              {t('common:preview.blobErrorTitle')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {tabHref && (
                <a
                  href={tabHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 text-[10px] font-black uppercase tracking-widest border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
                >
                  <ExternalLink size={14} /> {t('common:preview.actions.open')}
                </a>
              )}
              {onRetryOpenTab && (
                <button
                  type="button"
                  onClick={onRetryOpenTab}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <ExternalLink size={14} /> {t('common:preview.actions.tryOpen')}
                </button>
              )}
            </div>
          </div>
        )}

        {showNoSource && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <FileWarning className="w-12 h-12 text-amber-500/60" />
            <p className="text-sm text-slate-400 max-w-sm">{t('common:preview.noSource')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
