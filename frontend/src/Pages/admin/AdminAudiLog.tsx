import React, { useCallback, useEffect, useState } from 'react';
import { adminService, type AuditLogRow } from '../../services/admin.service';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Database, ScrollText, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const formatMeta = (m: AuditLogRow['metadata'], emptyLabel: string): string => {
  if (m == null) return emptyLabel;
  if (typeof m === 'string') return m.length > 120 ? `${m.slice(0, 120)}…` : m;
  try {
    return JSON.stringify(m);
  } catch {
    return emptyLabel;
  }
};

const ACTION_LABELS: Record<string, string> = {
  RESEARCH_CREATED: 'Research tạo mới',
  RESEARCH_APPROVED: 'Research được duyệt',
  RESEARCH_REJECTED: 'Research bị từ chối',
  RESEARCH_DOWNLOADED: 'Research được tải/xem',
  RESEARCH_PUBLIC_IP_BLOCKED: 'Research public bị chặn IP',
  CURRICULUM_CREATED: 'Curriculum tạo mới',
  CURRICULUM_APPROVED: 'Curriculum được duyệt',
  CURRICULUM_REJECTED: 'Curriculum bị từ chối',
  CURRICULUM_DOWNLOADED: 'Curriculum được tải',
  DOCUMENT_CREATED: 'Document tạo mới',
  DOCUMENT_APPROVED: 'Document được duyệt',
  DOCUMENT_REJECTED: 'Document bị từ chối',
  DOCUMENT_DOWNLOADED: 'Document được tải',
  PROJECT_STATUS_CHANGED: 'Đổi trạng thái dự án',
  USER_AUTO_BANNED: 'Khóa tài khoản tự động',
};

const QUICK_FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: 'DOWNLOADED', label: 'Download/Preview' },
  { key: 'APPROVED', label: 'Approve' },
  { key: 'REJECTED', label: 'Reject' },
  { key: 'PROJECT_STATUS_CHANGED', label: 'Project Status' },
  { key: 'USER_AUTO_BANNED', label: 'Auto Ban' },
];

const AdminAuditLogPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const actionDisplay = (action: string) => ACTION_LABELS[action] || action;

  const load = useCallback(
    async (pageArg?: number, actionArg?: string) => {
      const p = pageArg ?? page;
      const actionVal = actionArg ?? actionFilter;
      setLoading(true);
      try {
        const res = await adminService.getAuditLogs({
          action: actionVal.trim() || undefined,
          page: p,
          limit,
        });
        setLogs(res.data?.logs ?? []);
        setTotalPages(res.data?.pagination?.totalPages ?? 0);
        setTotal(res.data?.pagination?.total ?? 0);
      } catch {
        toast.error(t('admin:audit.toasts.fetchFailed'));
      } finally {
        setLoading(false);
      }
    },
    [actionFilter, page, limit, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmitFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void load(1);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full bg-[#020617] font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] opacity-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col min-h-0 w-full p-4 md:p-6 relative z-10">
        <div className="flex-1 flex flex-col min-h-0 rounded-[32px] border border-white/5 bg-[#0F172A]/80 backdrop-blur-2xl overflow-hidden shadow-[0_24px_90px_-60px_rgba(6,182,212,0.2)]">
          <div className="px-5 md:px-8 py-8 border-b border-white/5 relative overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-cyan-500/0 via-cyan-500 to-cyan-500/0 opacity-50" />

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div>
                <h1 className="text-xl md:text-3xl font-black tracking-tighter text-white uppercase italic flex items-center gap-4">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    <Shield size={24} />
                  </span>
                  {t('admin:audit.title')}
                </h1>
                <p className="text-slate-500 text-[10px] md:text-[11px] font-mono tracking-widest mt-3 uppercase">
                  {t('admin:audit.subtitle')}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500">
                <span className="px-4 py-2 rounded-xl bg-[#020617] border border-white/5 flex items-center gap-2">
                  <ScrollText size={12} className="text-slate-500" />
                  {t('admin:audit.total')}
                  <span className="text-white ml-1">{total}</span>
                </span>
              </div>
            </div>

            <form onSubmit={onSubmitFilter} className="mt-8 flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                placeholder={t('admin:audit.filterPlaceholder')}
                className="flex-1 px-4 py-3 bg-[#020617] rounded-xl text-xs font-mono outline-none border border-white/10 focus:border-cyan-500/50 text-slate-300 placeholder:text-slate-600"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-500/20"
              >
                {t('admin:audit.filterAction')}
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_FILTERS.map((f) => (
                <button
                  key={f.key || 'all'}
                  type="button"
                  onClick={() => {
                    const nextAction = f.key;
                    setActionFilter(nextAction);
                    setPage(1);
                    void load(1, nextAction);
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-[0.18em] ${
                    actionFilter === f.key
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                      : 'border-white/10 text-slate-500 hover:text-cyan-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-auto p-4 md:p-8 bg-[#0B1121]">
            {loading ? (
              <div className="flex flex-1 flex-col items-center justify-center py-20 space-y-4 min-h-[12rem]">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-full border-t-cyan-500 animate-spin" />
                  <Database size={20} className="text-cyan-500 animate-pulse" />
                </div>
                <span className="text-[10px] font-mono tracking-[0.3em] text-cyan-500/70 uppercase">{t('admin:audit.loading')}</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[12rem] py-12 rounded-3xl border border-white/5 bg-[#020617]/50">
                <p className="text-white font-black tracking-widest text-sm uppercase">{t('admin:audit.empty.title')}</p>
                <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest mt-2">{t('admin:audit.empty.hint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/5">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#020617] text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-4 py-3 whitespace-nowrap">{t('admin:audit.table.time')}</th>
                      <th className="px-4 py-3 whitespace-nowrap">{t('admin:audit.table.action')}</th>
                      <th className="px-4 py-3 whitespace-nowrap">{t('admin:audit.table.performer')}</th>
                      <th className="px-4 py-3 whitespace-nowrap">{t('admin:audit.table.target')}</th>
                      <th className="px-4 py-3 min-w-[200px]">{t('admin:audit.table.metadata')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((row) => (
                      <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02] text-slate-300">
                        <td className="px-4 py-3 whitespace-nowrap text-cyan-500/90">
                          {row.created_at?.replace('T', ' ').slice(0, 19) ?? t('admin:audit.dash')}
                        </td>
                        <td className="px-4 py-3 text-white font-bold tracking-wide">
                          {actionDisplay(row.action)}
                          <div className="text-[9px] text-slate-600 mt-1">{row.action}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {row.performer ? (
                            <>
                              {row.performer.full_name}
                              <br />
                              <span className="text-[10px] text-slate-600">{row.performer.email}</span>
                            </>
                          ) : (
                            <span className="text-slate-600">{t('admin:audit.dash')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {row.target ? (
                            <>
                              {row.target.full_name}
                              <br />
                              <span className="text-[10px] text-slate-600">{row.target.email}</span>
                            </>
                          ) : (
                            <span className="text-slate-600">{t('admin:audit.dash')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 break-all max-w-md align-top">{formatMeta(row.metadata, t('admin:audit.dash'))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && logs.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-cyan-400 disabled:opacity-30"
                >
                  <ChevronLeft size={14} /> {t('admin:audit.pagination.prev')}
                </button>
                <span className="text-[10px] font-mono text-slate-500">
                  {t('admin:audit.pagination.pageOf', { page, totalPages })}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-cyan-400 disabled:opacity-30"
                >
                  {t('admin:audit.pagination.next')} <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLogPage;
