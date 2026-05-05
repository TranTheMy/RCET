import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Loader2, X, UserPlus, Trash2, Users, 
  ShieldCheck, Mail, Calendar, Search,
  Sparkles, Fingerprint, Crown 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { projectService } from '../../../services/project.service';
import { realtimeService } from '../../../services/realtime.service';
import { useAuthStore } from '../../../store/authStore'; 
import type { ProjectMember, User as UserType } from '../../../types';
import toast from 'react-hot-toast';
import { translateApiMessage } from '../../../utils/apiErrorI18n';

interface MembersTabProps {
  projectId: string; 
  canEdit: boolean;
  projectStatus?: string; 
  awaitingLeaderAssignment?: boolean;
  pendingLeaderUserId?: string | null;
  onReloadProject?: () => void; 
}

const MembersTab: React.FC<MembersTabProps> = ({ 
  projectId, 
  canEdit, 
  projectStatus, 
  awaitingLeaderAssignment,
  pendingLeaderUserId,
  onReloadProject 
}) => {
  const { t } = useTranslation();
  const { user } = useAuthStore(); 
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [leaderConfirmMember, setLeaderConfirmMember] = useState<ProjectMember | null>(null);
  const [assigningLeader, setAssigningLeader] = useState(false);
  const [removeConfirmMember, setRemoveConfirmMember] = useState<ProjectMember | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Kiểm tra quyền Admin
  const isAdmin = user?.system_role === 'truong_lab' || user?.system_role === 'vien_truong';

  /** Mời thêm thành viên: trưởng lab / viện trưởng khi dự án planning hoặc paused. */
  const canAddMembers = isAdmin && (projectStatus === 'planning' || projectStatus === 'paused');

  const loadMembers = useCallback(async () => {
    try {
      const rows = await projectService.listMembers(projectId);
      setMembers(Array.isArray(rows) ? rows : []);
    } catch { /* silent */ } 
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  useEffect(() => {
    if (!leaderConfirmMember && !removeConfirmMember) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [leaderConfirmMember, removeConfirmMember]);

  useEffect(() => {
    const socket = realtimeService.connect();
    realtimeService.subscribeProject(projectId);
    const unsub = realtimeService.onProjectUpdate((payload: unknown) => {
      const updateType = (payload as { type?: string })?.type;
      const incomingProjectId = (payload as { projectId?: string })?.projectId;
      if (incomingProjectId && incomingProjectId !== projectId) return;
      if (
        !updateType ||
        !['member_added', 'member_removed', 'project_activated', 'commitment_updated', 'project_updated'].includes(updateType)
      )
        return;
      loadMembers();
      if (onReloadProject) onReloadProject();
    });
    return () => {
      unsub();
      socket.off('connect');
    };
  }, [projectId, loadMembers, onReloadProject]);

  /** Trưởng lab / viện trưởng quản lý roster: TAG hay SELF_JOIN đều cho phép khi planning hoặc paused. */
  const canManageMemberActions = isAdmin && (projectStatus === 'planning' || projectStatus === 'paused');

  // Gán / đề cử chủ trì: không chặn theo "đã có leader" — vẫn có thể đề cử lại khi lập kế hoạch hoặc tạm dừng.
  const canAssignLeader = canManageMemberActions;

  /** Cột thao tác: chủ trì (canEdit) hoặc BLĐ khi planning/paused — áp dụng cả TAG và SELF_JOIN. */
  const canShowRosterColumn = canEdit || canManageMemberActions;

  const closeAssignLeaderModal = () => {
    if (assigningLeader) return;
    setLeaderConfirmMember(null);
  };

  const closeRemoveMemberModal = () => {
    if (removingMemberId) return;
    setRemoveConfirmMember(null);
  };

  const confirmAssignLeader = async () => {
    const member = leaderConfirmMember;
    if (!member) return;
    setAssigningLeader(true);
    try {
      await projectService.assignNewLeader(projectId, member.user_id);
      toast.success(t('projects:members.assignLeaderModal.toastSuccess'));
      setLeaderConfirmMember(null);
      await loadMembers();
      if (onReloadProject) onReloadProject();
    } catch (err: any) {
      const raw = err.response?.data?.message;
      toast.error(
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
          t('projects:members.toasts.actionFailed'),
      );
    } finally {
      setAssigningLeader(false);
    }
  };

  const confirmRemoveMember = async () => {
    const member = removeConfirmMember;
    if (!member) return;
    setRemovingMemberId(member.id);
    try {
      await projectService.removeMember(projectId, member.id);
      toast.success(t('projects:members.toasts.updated'));
      setRemoveConfirmMember(null);
      await loadMembers();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
        t('projects:members.toasts.actionFailed');
      toast.error(msg);
    } finally {
      setRemovingMemberId(null);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">{t('projects:members.loading')}</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* Header Actions */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2">
            <Users size={14} className="text-cyan-600" /> {t('projects:members.title')}
          </h3>
          <p className="text-[11px] font-bold text-slate-900 uppercase mt-1">
            {t('projects:members.currentCount')}: <span className="text-cyan-600 italic">{members.length}</span>
          </p>
        </div>
        
        {canAddMembers && (
          <button 
            onClick={() => setShowAddModal(true)} 
            className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:bg-cyan-600 hover:shadow-xl hover:shadow-cyan-100 transition-all active:scale-95"
          >
            <UserPlus size={14} /> {t('projects:members.addMember')}
          </button>
        )}
      </div>

      {/* Members Grid / Table */}
      <div className="bg-white border border-slate-100 rounded-[40px] overflow-hidden shadow-xl shadow-slate-200/40">
        {members.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="p-8">{t('projects:members.table.member')}</th>
                  <th className="p-8 text-center">{t('projects:members.table.role')}</th>
                  <th className="p-8 text-center">{t('projects:members.table.tasks')}</th>
                  <th className="p-8">{t('projects:members.table.reportRate')}</th>
                  <th className="p-8">{t('projects:members.table.joinedAt')}</th>
                  {canShowRosterColumn && <th className="p-8"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {members.map((m) => {
                  const isPendingLeaderCandidate = Boolean(
                    awaitingLeaderAssignment &&
                      pendingLeaderUserId &&
                      m.user_id === pendingLeaderUserId &&
                      m.role !== 'leader',
                  );
                  return (
                  <tr key={m.id} className="group hover:bg-cyan-50/30 transition-colors">
                    <td className="p-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-cyan-100 group-hover:scale-105 transition-transform">
                          {m.user?.full_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 mb-0.5">{m.user?.full_name}</p>
                          <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-tighter">
                            <Mail size={10} className="text-cyan-600" /> {m.user?.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                          m.role === 'leader' 
                            ? 'bg-cyan-50 text-cyan-600 border border-cyan-100' 
                            : 'bg-indigo-50 text-indigo-500 border border-indigo-100'
                        }`}>
                          {m.role === 'leader' ? <Crown size={10} /> : <ShieldCheck size={10} />} {m.role}
                        </span>
                        {isPendingLeaderCandidate && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100">
                            <Crown size={10} /> {t('projects:members.pendingLeaderConfirmation')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-8 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-lg font-black text-slate-900">{m.task_count ?? 0}</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('projects:members.table.taskLabel')}</span>
                      </div>
                    </td>
                    <td className="p-8">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[100px]">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${m.report_rate ?? 100}%` }}
                            className={`h-full rounded-full transition-all ${
                              (m.report_rate ?? 100) >= 80 ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]' : 
                              (m.report_rate ?? 100) >= 50 ? 'bg-amber-400' : 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.3)]'
                            }`}
                          />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 tabular-nums">{m.report_rate ?? 100}%</span>
                      </div>
                    </td>
                    <td className="p-8">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-tight">
                        <Calendar size={12} className="text-cyan-600" />
                        {m.joined_at?.slice(0, 10)}
                      </div>
                    </td>
                    {canShowRosterColumn && (
                      <td className="p-8 text-right">
                        <div className="flex items-center justify-end gap-2">
                          
                          {/* NÚT GÁN LEADER MỚI HOẶC BỔ SUNG LEADER CHO MODE 2 */}
                          {canAssignLeader && m.role !== 'leader' && (
                            <button
                              type="button"
                              onClick={() => setLeaderConfirmMember(m)}
                              className="px-3 py-2 bg-cyan-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-100"
                            >
                              <Crown size={12} /> {t('projects:members.setLeader')}
                            </button>
                          )}

                          {m.role !== 'leader' && (
                            <button 
                              onClick={() => setRemoveConfirmMember(m)} 
                              className="p-3 bg-slate-50 hover:bg-rose-50 rounded-2xl text-slate-300 hover:text-rose-500 transition-all border border-transparent hover:border-rose-100 shadow-sm"
                              title={t('projects:members.removeTitle')}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center py-24 bg-white">
            <div className="w-16 h-16 bg-slate-50 rounded-[28px] flex items-center justify-center mb-6 border border-slate-100 shadow-inner">
              <Users size={32} className="text-slate-200" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 italic text-center">{t('projects:members.empty')}</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddMemberModal 
          projectId={projectId} 
          existingIds={members.map((m) => m.user_id)} 
          onClose={() => setShowAddModal(false)} 
          onAdded={() => { setShowAddModal(false); loadMembers(); }} 
        />
      )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {leaderConfirmMember && (
              <div
                key={leaderConfirmMember.id}
                className="fixed inset-0 z-[210] flex items-center justify-center p-4"
                role="presentation"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-[#0B0E14]/75 backdrop-blur-sm"
                  onClick={closeAssignLeaderModal}
                  aria-hidden
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="assign-leader-title"
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#0F1219] p-8 shadow-2xl"
                >
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-400">
                    <Crown size={24} />
                  </div>
                  <h3 id="assign-leader-title" className="text-lg font-black uppercase tracking-widest text-white">
                    {t('projects:members.assignLeaderModal.title')}
                  </h3>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    {t('projects:members.assignLeaderModal.description', {
                      name: leaderConfirmMember.user?.full_name || '—',
                    })}
                  </p>
                  <div className="mt-8 flex gap-3">
                    <button
                      type="button"
                      onClick={closeAssignLeaderModal}
                      disabled={assigningLeader}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                      {t('common:actions.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={confirmAssignLeader}
                      disabled={assigningLeader}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-cyan-500 py-3 text-[10px] font-black uppercase tracking-widest text-black transition-colors hover:bg-cyan-400 disabled:opacity-50"
                    >
                      {assigningLeader ? <Loader2 size={18} className="animate-spin" /> : t('projects:members.assignLeaderModal.confirm')}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
            {removeConfirmMember && (
              <div
                key={`remove-${removeConfirmMember.id}`}
                className="fixed inset-0 z-[220] flex items-center justify-center p-4"
                role="presentation"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-[#0B0E14]/75 backdrop-blur-sm"
                  onClick={closeRemoveMemberModal}
                  aria-hidden
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="remove-member-title"
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#0F1219] p-8 shadow-2xl"
                >
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
                    <Trash2 size={22} />
                  </div>
                  <h3 id="remove-member-title" className="text-lg font-black uppercase tracking-widest text-white">
                    {t('projects:members.removeTitle')}
                  </h3>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    {t('projects:members.confirmRemove', {
                      name: removeConfirmMember.user?.full_name || '—',
                    })}
                  </p>
                  <div className="mt-8 flex gap-3">
                    <button
                      type="button"
                      onClick={closeRemoveMemberModal}
                      disabled={Boolean(removingMemberId)}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                      {t('common:actions.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={confirmRemoveMember}
                      disabled={Boolean(removingMemberId)}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-rose-500 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-rose-400 disabled:opacity-50"
                    >
                      {removingMemberId ? <Loader2 size={18} className="animate-spin" /> : t('projects:members.removeTitle')}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
};

const AddMemberModal: React.FC<{ projectId: string; existingIds: string[]; onClose: () => void; onAdded: () => void }> = ({ projectId, existingIds, onClose, onAdded }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserType[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkInviting, setBulkInviting] = useState(false);

  const eligibleUsers = useMemo(() => results.filter((u) => !u.at_project_limit), [results]);

  const selectedEligibleCount = useMemo(
    () => selectedIds.filter((id) => eligibleUsers.some((u) => u.id === id)).length,
    [selectedIds, eligibleUsers],
  );

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const users = await projectService.searchActiveUsers(search, {
          excludeVienTruong: true,
          checkCapacity: true,
        });
        const list = Array.isArray(users) ? users : [];
        setResults(list.filter((u) => !existingIds.includes(u.id)));
      } catch { setResults([]); }
    }, 400);
    return () => clearTimeout(timer);
  }, [search, existingIds]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => results.some((r) => r.id === id)));
  }, [results]);

  useEffect(() => {
    setSelectedIds([]);
  }, [search]);

  const toggleSelect = (userId: string, blocked: boolean) => {
    if (blocked || bulkInviting) return;
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId],
    );
  };

  const selectAllEligible = () => {
    if (bulkInviting) return;
    setSelectedIds(eligibleUsers.map((u) => u.id));
  };

  const clearSelection = () => setSelectedIds([]);

  const inviteOne = async (u: UserType) => {
    const data = (await projectService.addMember(projectId, {
      user_id: u.id,
      role: 'member',
    })) as { alreadyInvited?: boolean; message?: string };
    return Boolean(data?.alreadyInvited);
  };

  const handleBulkInvite = async () => {
    const toInvite = eligibleUsers.filter((u) => selectedIds.includes(u.id));
    if (toInvite.length === 0) {
      toast.error(t('projects:members.modal.noneSelected'));
      return;
    }
    setBulkInviting(true);
    let ok = 0;
    let fail = 0;
    let firstErrMsg = '';
    try {
      for (const u of toInvite) {
        try {
          await inviteOne(u);
          ok += 1;
        } catch (err: unknown) {
          fail += 1;
          const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          if (typeof raw === 'string' && !firstErrMsg) {
            firstErrMsg = translateApiMessage(t, raw) || raw;
          }
        }
      }
      if (ok > 0 && fail === 0) {
        toast.success(t('projects:members.modal.toasts.bulkSuccess', { count: ok }));
      } else if (ok > 0 && fail > 0) {
        toast.success(t('projects:members.modal.toasts.bulkPartial', { ok, fail }));
      } else {
        toast.error(firstErrMsg || t('projects:members.modal.toasts.bulkFailed'));
      }
      if (ok > 0) {
        setSelectedIds([]);
        onAdded();
      }
    } finally {
      setBulkInviting(false);
    }
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
        onClick={() => !bulkInviting && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-[1] isolate flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[48px] border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 p-10 pb-4">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-600" /> {t('projects:members.modal.title')}
              </h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{t('projects:members.modal.subtitle')}</p>
            </div>
            <button type="button" onClick={() => !bulkInviting && onClose()} disabled={bulkInviting} className="p-3 hover:bg-slate-50 rounded-full text-slate-400 transition-colors disabled:opacity-40" aria-label={t('common:actions.close')}>
              <X size={20} />
            </button>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              value={search}
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('projects:members.modal.searchPlaceholder')}
              disabled={bulkInviting}
              className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm text-slate-900 focus:border-cyan-500 focus:bg-white transition-all placeholder:text-slate-300 font-bold disabled:opacity-50"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-10 pb-4 custom-scrollbar">
          {results.map((u) => {
            const blocked = !!u.at_project_limit;
            const checked = selectedIds.includes(u.id);
            return (
              <label
                key={u.id}
                className={`flex cursor-pointer items-center gap-4 p-5 border rounded-[24px] transition-all shadow-sm ${
                  blocked
                    ? 'bg-amber-50/40 border-amber-100 opacity-90 cursor-not-allowed'
                    : checked
                      ? 'border-cyan-300 bg-cyan-50/40 ring-1 ring-cyan-200/50'
                      : 'bg-slate-50/50 border-slate-100 hover:border-cyan-200 hover:bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:opacity-40"
                  checked={checked}
                  disabled={blocked || bulkInviting}
                  onChange={() => toggleSelect(u.id, blocked)}
                />
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 p-[1px] shrink-0">
                  <div className="w-full h-full bg-white rounded-[11px] flex items-center justify-center text-cyan-600 text-[12px] font-black uppercase">
                    {u.full_name.charAt(0)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-black truncate ${blocked ? 'text-slate-500' : 'text-slate-900'}`}>
                    {u.full_name}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate">{u.email}</p>
                  {blocked && (
                    <p className="text-[9px] font-bold text-amber-700 mt-1 uppercase tracking-wide">
                      Đã đủ số dự án — không thể mời
                    </p>
                  )}
                </div>
              </label>
            );
          })}
          
          {search.length >= 2 && results.length === 0 && (
            <div className="flex flex-col items-center py-12 text-slate-300">
              <Fingerprint size={48} className="mb-4 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-center">
                {t('projects:members.modal.noResultsLine1')}<br />{t('projects:members.modal.noResultsLine2')}
              </p>
            </div>
          )}

          {search.length < 2 && (
            <div className="py-16 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 italic">{t('projects:members.modal.typeToSearch')}</p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/90 px-10 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllEligible}
                disabled={bulkInviting || eligibleUsers.length === 0}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-cyan-300 hover:text-cyan-700 disabled:opacity-40"
              >
                {t('projects:members.modal.selectAll')}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={bulkInviting || selectedIds.length === 0}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-slate-300 disabled:opacity-40"
              >
                {t('projects:members.modal.clearSelection')}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleBulkInvite()}
              disabled={bulkInviting || selectedEligibleCount === 0}
              className="flex min-h-[48px] items-center justify-center rounded-2xl bg-slate-900 px-8 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-cyan-600 disabled:opacity-40"
            >
              {bulkInviting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                t('projects:members.modal.inviteSelected', { count: selectedEligibleCount })
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
    ),
    document.body
  );
};

export default MembersTab;