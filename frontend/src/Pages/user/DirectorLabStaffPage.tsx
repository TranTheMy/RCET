import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Search, UserCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { directorService, type DirectorLabStaffUser } from '../../services/director.service';
import { ROUTER } from '../../routes/router';
import { translateApiMessage } from '../../utils/apiErrorI18n';

type RoleConfirm = { user: DirectorLabStaffUser; next: 'member' | 'truong_lab' };

const DirectorLabStaffPage: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<DirectorLabStaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionId, setActionId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<RoleConfirm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await directorService.listLabStaff({
        role: role || undefined,
        search: appliedSearch.trim() || undefined,
        page,
        limit,
      });
      setUsers(res.data?.users ?? []);
      setTotalPages(res.data?.pagination?.totalPages ?? 1);
      setTotal(res.data?.pagination?.total ?? 0);
    } catch {
      toast.error(t('user:directorLabStaff.toasts.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [role, appliedSearch, page, limit, t]);

  useEffect(() => {
    load();
  }, [load]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(1);
  };

  const closeConfirm = () => {
    if (actionId) return;
    setPendingConfirm(null);
  };

  const executeRoleChange = async () => {
    const ctx = pendingConfirm;
    if (!ctx) return;
    const { user, next } = ctx;
    setActionId(user.id);
    try {
      await directorService.updateLabStaffSystemRole(user.id, { system_role: next });
      toast.success(t('user:directorLabStaff.toasts.updated'));
      setPendingConfirm(null);
      await load();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') || t('user:directorLabStaff.toasts.updateFailed'),
      );
    } finally {
      setActionId(null);
    }
  };

  const confirmIsPromote = pendingConfirm?.next === 'truong_lab';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-16">
      <div className="mb-6">
        <Link
          to={ROUTER.USER.DIRECTOR_WORKSPACE}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          <ArrowLeft size={18} aria-hidden />
          {t('user:directorLabStaff.backToHub')}
        </Link>
      </div>

      <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
            <UserCog size={14} className="text-blue-600" aria-hidden />
            Director
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">{t('user:directorLabStaff.title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">{t('user:directorLabStaff.subtitle')}</p>
        </div>
      </header>

      <form onSubmit={onSearchSubmit} className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{t('user:directorLabStaff.filters.searchPlaceholder')}</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
              placeholder={t('user:directorLabStaff.filters.searchPlaceholder')}
            />
          </div>
        </div>
        <div className="w-full sm:w-48">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{t('user:directorLabStaff.filters.allRoles')}</label>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
          >
            <option value="">{t('user:directorLabStaff.filters.allRoles')}</option>
            <option value="member">{t('user:directorLabStaff.filters.member')}</option>
            <option value="truong_lab">{t('user:directorLabStaff.filters.truong_lab')}</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          {t('user:directorLabStaff.filters.apply')}
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('user:directorLabStaff.table.name')}</th>
                <th className="px-4 py-3">{t('user:directorLabStaff.table.email')}</th>
                <th className="px-4 py-3">{t('user:directorLabStaff.table.department')}</th>
                <th className="px-4 py-3">{t('user:directorLabStaff.table.role')}</th>
                <th className="px-4 py-3">{t('user:directorLabStaff.table.status')}</th>
                <th className="px-4 py-3 text-right">{t('user:directorLabStaff.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <Loader2 className="inline h-6 w-6 animate-spin text-blue-600" aria-hidden />
                    <span className="ml-2">{t('user:directorLabStaff.table.loading')}</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {t('user:directorLabStaff.table.empty')}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const sys = u.system_role ?? '';
                  const busy = actionId === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-semibold text-slate-900">{u.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3 text-slate-600">{u.department || t('user:directorLabStaff.table.na')}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          {sys === 'member' || sys === 'truong_lab' ? t(`user:profile.roles.${sys}`) : sys || t('user:directorLabStaff.table.na')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-600">
                          {u.status === 'active' ||
                          u.status === 'pending' ||
                          u.status === 'rejected' ||
                          u.status === 'locked'
                            ? t(`user:profile.status.${u.status}`)
                            : u.status || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {sys === 'member' && (
                          <button
                            type="button"
                            disabled={busy || u.status !== 'active'}
                            onClick={() => setPendingConfirm({ user: u, next: 'truong_lab' })}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : t('user:directorLabStaff.actions.promote')}
                          </button>
                        )}
                        {sys === 'truong_lab' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setPendingConfirm({ user: u, next: 'member' })}
                            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : t('user:directorLabStaff.actions.demote')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>{t('user:directorLabStaff.pagination', { page, totalPages, total })}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        appearance="dark"
        variant={confirmIsPromote ? 'success' : 'danger'}
        title={
          pendingConfirm
            ? confirmIsPromote
              ? t('user:directorLabStaff.confirmModal.titlePromote')
              : t('user:directorLabStaff.confirmModal.titleDemote')
            : ''
        }
        description={
          pendingConfirm
            ? confirmIsPromote
              ? t('user:directorLabStaff.confirmModal.descriptionPromote', { name: pendingConfirm.user.full_name })
              : t('user:directorLabStaff.confirmModal.descriptionDemote', { name: pendingConfirm.user.full_name })
            : ''
        }
        confirmLabel={t('user:directorLabStaff.confirmModal.confirm')}
        cancelLabel={t('user:directorLabStaff.confirmModal.cancel')}
        loading={Boolean(actionId && pendingConfirm && pendingConfirm.user.id === actionId)}
        onConfirm={() => void executeRoleChange()}
        onClose={closeConfirm}
      />
    </div>
  );
};

export default DirectorLabStaffPage;
