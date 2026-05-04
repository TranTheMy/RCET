import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Search, Users, Shield, CheckCircle2, XCircle, MailCheck, ChevronLeft, ChevronRight, Terminal, Database, Fingerprint } from 'lucide-react';
import { adminService, type AdminUser } from '../../services/admin.service';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { translateApiMessage } from '../../utils/apiErrorI18n';

const ROLE_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: '', labelKey: 'admin:users.filters.allRoles' },
  { value: 'user', labelKey: 'admin:roles.user' },
  { value: 'member', labelKey: 'admin:roles.member' },
  { value: 'truong_lab', labelKey: 'admin:roles.truong_lab' },
  { value: 'vien_truong', labelKey: 'admin:roles.vien_truong' },
  { value: 'admin', labelKey: 'admin:roles.admin' },
];

const STATUS_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: '', labelKey: 'admin:users.filters.allStatuses' },
  { value: 'pending', labelKey: 'admin:users.status.pending' },
  { value: 'active', labelKey: 'admin:users.status.active' },
  { value: 'rejected', labelKey: 'admin:users.status.rejected' },
  { value: 'locked', labelKey: 'admin:users.status.locked' },
];

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
  rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]',
  locked: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.12)]',
};

const AdminUsersPage: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getUsers({
        status: status || undefined,
        role: role || undefined,
        search: search || undefined,
        page,
        limit,
      });
      setUsers(res.data?.users || []);
      setTotalPages(res.data?.pagination?.totalPages || 1);
      setTotal(res.data?.pagination?.total || 0);
    } catch {
      toast.error(t('admin:users.toasts.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [status, role, search, page, limit, t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleChangeFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const handleBanToggle = async (user: AdminUser) => {
    if (user.system_role === 'admin') return;
    setActionUserId(user.id);
    try {
      if (user.status === 'locked') {
        await adminService.unbanUser(user.id);
        toast.success(t('admin:users.toasts.unbanned'));
      } else {
        await adminService.banUser(user.id);
        toast.success(t('admin:users.toasts.banned'));
      }
      await loadUsers();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
          t('admin:users.toasts.updateStatusFailed'),
      );
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full bg-[#020617] font-sans relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] opacity-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col min-h-0 w-full p-4 md:p-6 relative z-10">
        
        {/* HEADER SECTION */}
        <div className="mb-6 flex-shrink-0 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white flex items-center gap-4">
              <div className="relative group">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  <Users size={24} />
                </span>
              </div>
              {t('admin:users.title')}
            </h1>
            <p className="text-slate-500 text-[10px] md:text-[11px] font-mono tracking-widest mt-2 uppercase">
              {t('admin:users.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500">
            <span className="px-4 py-2 rounded-xl bg-[#0F172A]/80 border border-white/5 flex items-center gap-2 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] backdrop-blur-md">
              <Terminal size={12} className="text-slate-500" />
              {t('admin:users.totalActiveLabel')}
              <span className="text-white ml-1">[{total}]</span>
            </span>
          </div>
        </div>

        {/* MAIN CONSOLE PANEL */}
        <div className="flex-1 flex flex-col min-h-0 rounded-[32px] border border-white/5 bg-[#0F172A]/80 backdrop-blur-2xl overflow-hidden shadow-[0_24px_90px_-60px_rgba(6,182,212,0.2)]">
          
          {/* FILTER CONTROLS */}
          <div className="flex-shrink-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 md:p-6 pb-6 border-b border-white/5">
            <form onSubmit={handleSearchSubmit} className="w-full md:max-w-md">
              <div className="relative group">
                <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('admin:users.searchPlaceholder')}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/10 bg-[#020617] text-xs font-mono outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-white placeholder:text-slate-600 transition-all uppercase tracking-wider"
                />
              </div>
            </form>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={status}
                onChange={(e) => handleChangeFilter(setStatus)(e.target.value)}
                className="px-4 py-3 bg-[#020617] rounded-xl text-[10px] font-mono font-bold uppercase tracking-[0.15em] border border-white/10 focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-cyan-400 transition-all appearance-none cursor-pointer"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#0F172A] text-slate-300">
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
              <select
                value={role}
                onChange={(e) => handleChangeFilter(setRole)(e.target.value)}
                className="px-4 py-3 bg-[#020617] rounded-xl text-[10px] font-mono font-bold uppercase tracking-[0.15em] border border-white/10 focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-cyan-400 transition-all appearance-none cursor-pointer"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#0F172A] text-slate-300">
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DATA TABLE */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#0B1121]">
            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar p-4 md:p-8">
            {loading ? (
              <div className="flex flex-1 flex-col items-center justify-center py-20 space-y-4 min-h-[12rem]">
                <div className="relative w-12 h-12 flex items-center justify-center">
                   <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-full border-t-cyan-500 animate-spin" />
                   <Database size={20} className="text-cyan-500 animate-pulse" />
                </div>
                <span className="text-[10px] font-mono tracking-[0.3em] text-cyan-500/70 uppercase">{t('admin:users.loading')}</span>
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center min-h-[12rem] py-12 rounded-2xl border border-white/5 bg-[#020617]/50">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  <Fingerprint size={32} className="text-slate-600" />
                </div>
                <p className="text-white font-black tracking-widest text-sm uppercase">{t('admin:users.empty.title')}</p>
                <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest mt-2">{t('admin:users.empty.hint')}</p>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-500/70 border-b border-white/10">
                    <th className="py-4 pr-4 text-left">{t('admin:users.table.node')}</th>
                    <th className="py-4 px-4 text-left">{t('admin:users.table.contact')}</th>
                    <th className="py-4 px-4 text-left">{t('admin:users.table.department')}</th>
                    <th className="py-4 px-4 text-left">{t('admin:users.table.role')}</th>
                    <th className="py-4 px-4 text-left">{t('common:table.status')}</th>
                    <th className="py-4 px-4 text-left">{t('admin:users.table.createdAt')}</th>
                    <th className="py-4 pl-4 text-left">{t('admin:users.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const statusClass = STATUS_BADGE[u.status] || 'bg-slate-800 text-slate-400 border-white/10';
                    return (
                      <tr key={u.id} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-[#020617] border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm shadow-[inset_0_0_10px_rgba(6,182,212,0.1)] group-hover:border-cyan-400 transition-colors">
                              {u.full_name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="text-[13px] font-black uppercase tracking-wider text-white leading-tight">
                                {u.full_name}
                              </p>
                              <p className="text-[10px] font-mono text-slate-500 mt-1">
                                {t('admin:users.table.idPrefix')}: {u.student_code || t('admin:users.na')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                            <MailCheck size={14} className={u.email_verified ? 'text-emerald-500' : 'text-slate-600'} />
                            <span className="truncate max-w-[200px]" title={u.email}>
                              {u.email}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{u.department || t('admin:users.na')}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#020617] text-cyan-400 border border-cyan-500/20 text-[9px] font-black uppercase tracking-[0.2em] shadow-[inset_0_0_10px_rgba(6,182,212,0.05)]">
                            <Shield size={10} />
                            {u.system_role || t('admin:users.na')}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-[0.2em] ${statusClass}`}
                          >
                            {u.status === 'active' && <CheckCircle2 size={12} />}
                            {u.status === 'rejected' && <XCircle size={12} />}
                            {u.status === 'pending' && <Loader2 size={12} className="animate-spin" />}
                            {t(STATUS_OPTIONS.find((opt) => opt.value === u.status)?.labelKey || u.status)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-[11px] font-mono text-slate-500">
                          {u.created_at?.slice(0, 10)}
                        </td>
                        <td className="py-4 pl-4">
                          {u.system_role === 'admin' ? (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                              {t('admin:users.actions.protected')}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleBanToggle(u)}
                              disabled={actionUserId === u.id}
                              className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50 ${
                                u.status === 'locked'
                                  ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                                  : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                              }`}
                            >
                              {actionUserId === u.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : u.status === 'locked' ? (
                                t('admin:users.actions.unban')
                              ) : (
                                t('admin:users.actions.ban')
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            </div>

          {/* PAGINATION */}
          {!loading && totalPages > 1 && (
            <div className="flex-shrink-0 px-4 md:px-6 pb-4 md:pb-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                <Terminal size={12} className="text-cyan-500/50" />
                {t('admin:users.pagination.blockOf', { page, totalPages })}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#020617] border border-white/10 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-400 disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-slate-400 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#020617] border border-white/10 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-400 disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-slate-400 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(2, 6, 23, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.4);
        }
      `}} />
    </div>
  );
};

export default AdminUsersPage;