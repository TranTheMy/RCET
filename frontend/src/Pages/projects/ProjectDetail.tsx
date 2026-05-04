import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Settings, Loader2, Cpu, Calendar,
  User, DollarSign, Activity, GitBranch, ExternalLink,
  RefreshCw, Shield, Hash, Binary, Zap, Globe, Coins, FileText,
  AlertCircle, XCircle, CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { projectService } from '../../services/project.service';
import { commitmentService } from '../../services/commitment.service';
import { realtimeService } from '../../services/realtime.service';
import { useAuthStore } from '../../store/authStore';
import type { Project, GitRepoInfo, UpdateGitRepoRequest, GitProvider, ProjectTag } from '../../types';
import toast from 'react-hot-toast';
import { allowedNextStatuses } from '../../constants/projectWorkflow';
import { translateApiMessage } from '../../utils/apiErrorI18n';

// Tabs Components
import OverviewTab from './tabs/OverviewTab';
import TasksTab from './tabs/TasksTab';
import ReportsTab from './tabs/ReportsTab';
import MembersTab from './tabs/MembersTab';
import MasterPlanTab from './tabs/MasterPlanTab';
import RewardsTab from './tabs/RewardsTab';
import CommitmentTab from './tabs/CommitmentTab';

type RejectModalKind = 'participation' | 'declineLeader' | 'leaderExit';

const STATUS_CONFIG: Record<string, { label: string; color: string; glow: string; bg: string; border: string }> = {
  planning: { label: 'planning', color: 'text-cyan-400', glow: 'shadow-cyan-500/20', bg: 'bg-cyan-500/5', border: 'border-cyan-500/20' },
  active: { label: 'active', color: 'text-emerald-400', glow: 'shadow-emerald-500/20', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' },
  paused: { label: 'paused', color: 'text-amber-400', glow: 'shadow-amber-500/20', bg: 'bg-amber-500/5', border: 'border-amber-500/20' },
  done: { label: 'done', color: 'text-blue-400', glow: 'shadow-blue-500/20', bg: 'bg-blue-500/5', border: 'border-blue-500/20' },
  archived: { label: 'archived', color: 'text-slate-500', glow: 'shadow-slate-500/10', bg: 'bg-slate-500/5', border: 'border-slate-500/20' },
};

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [leaderBusy, setLeaderBusy] = useState(false);
  const [rejectModalKind, setRejectModalKind] = useState<RejectModalKind | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState('');

  const [editData, setEditData] = useState({
    name: '',
    description: '',
    status: '' as Project['status'],
    tag: '' as ProjectTag | '',
    start_date: '',
    end_date: '',
    budget: '',
  });

  const isTruongLab = user?.system_role === 'truong_lab';
  const isAdmin = user?.system_role === 'truong_lab' || user?.system_role === 'vien_truong';
  /** Được gán leader_id khi tạo dự án (chưa chắc đã là chủ trì trong ProjectMember). */
  const designatedLeader = project?.leader_id === user?.id;
  const viewerMembership = project?.viewer_membership;
  const isProjectLeader = viewerMembership?.role === 'leader';
  const isTagMode = (project as any)?.participation_mode === 'TAG';

  // Mode 2: còn mở slot tự join (planning + chưa đủ required_members)
  const selfJoinSlotsFull = useMemo(() => {
    const req = (project as Project)?.required_members;
    const cnt = project?.member_count;
    if (req == null || req <= 0 || cnt == null) return false;
    return cnt >= req;
  }, [project]);

  const isOpen =
    (project as any)?.participation_mode === 'SELF_JOIN' &&
    project?.status === 'planning' &&
    !selfJoinSlotsFull;

  // 1. Xác định cam kết của User hiện tại (Cực kỳ quan trọng để hiện nút)
  const myCommitment = useMemo(() => {
    return (project as any)?.commitments?.find((c: any) => c.user_id === user?.id);
  }, [project, user]);

  /**
   * Đã xác nhận cam kết phía B (đồng ý tham gia).
   * Không suy luận "đã tham gia" chỉ theo leader_id để tránh khóa cứng leader candidate.
   */
  const hasAcceptedParticipation = Boolean(
    myCommitment?.status === 'b_approved' ||
      myCommitment?.status === 'active' ||
      viewerMembership?.role === 'member' ||
      viewerMembership?.role === 'leader',
  );

  /** Chưa là chủ trì thật (ProjectMember LEADER): giao diện giống thành viên. */
  const isStrictMember = Boolean(
    user && !isAdmin && (!isProjectLeader || !hasAcceptedParticipation),
  );

  const isActualMember = useMemo(() => {
    if (isAdmin) return true;
    return hasAcceptedParticipation;
  }, [isAdmin, hasAcceptedParticipation]);

  // Git tab must be visible to truong_lab only (aligned with backend route guard).
  const canViewGit = Boolean(project && isTruongLab);
  /** Chỉnh sửa dự án khi admin hoặc đã là chủ trì (LEADER trong ProjectMember). */
  const canEdit = isAdmin || (isProjectLeader && hasAcceptedParticipation);

  // 2. Logic hiển thị nút JOIN / xác nhận tham gia (kể cả chủ trì dự kiến đang chờ cam kết)
  /** Dự án paused vẫn cho xác nhận/từ chối lời mời TAG (cam kết chờ B); self-join mở chỉ khi planning. */
  const canShowJoin = useMemo(() => {
    const invitePending = myCommitment?.status === 'pending_b_approval';
    const statusAllowsJoin =
      project?.status === 'planning' ||
      (project?.status === 'paused' && invitePending);

    if (!statusAllowsJoin) return false;

    if (designatedLeader && !isOpen && invitePending) return true;

    if (designatedLeader) return false;

    if (!isOpen && invitePending) return true;

    if (isOpen && !myCommitment) return true;

    return false;
  }, [designatedLeader, project, myCommitment, isOpen]);

  const isInviteAcceptJoin = Boolean(
    !isOpen && myCommitment?.status === 'pending_b_approval',
  );

  const isLeaderPendingCommitment = Boolean(
    designatedLeader && !isOpen && myCommitment?.status === 'pending_b_approval',
  );

  /** Đã tham gia (MEMBER) nhưng được đề cử chủ trì — chọn nhận hoặc từ chối vai trò chủ trì. */
  const canShowLeaderRoleChoice = Boolean(
    project?.status === 'planning' &&
      !isOpen &&
      isTagMode &&
      hasAcceptedParticipation &&
      designatedLeader &&
      viewerMembership?.role === 'member',
  );

  const canShowRejectParticipation = Boolean(
    (project?.status === 'planning' || project?.status === 'paused') &&
      !isOpen &&
      myCommitment?.status === 'pending_b_approval',
  );

  /** Chủ trì thật (LEADER) rút hoàn toàn — reject API cũ. */
  const canShowRejectLeaderExit = Boolean(
    project?.status === 'planning' &&
      !isOpen &&
      hasAcceptedParticipation &&
      isProjectLeader,
  );

  const loadProject = useCallback(async () => {
    if (!id) return;
    try {
      const data = await projectService.getDetail(id!);
      setProject(data);
      setEditData({
        name: data.name,
        description: data.description || '',
        status: data.status,
        tag: (data.tag as ProjectTag) || '',
        start_date: data.start_date?.slice(0, 10) || '',
        end_date: data.end_date?.slice(0, 10) || '',
        budget: data.budget != null ? String(data.budget) : '',
      });
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') || t('projects:detail.errors.fetchFailed'),
      );
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, t]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (!id) return;
    const socket = realtimeService.connect();
    realtimeService.subscribeProject(id);
    const unsubProjectUpdate = realtimeService.onProjectUpdate((payload: unknown) => {
      const updateType = (payload as { type?: string })?.type;
      const incomingProjectId = (payload as { projectId?: string })?.projectId;
      if (incomingProjectId && incomingProjectId !== id) return;
      if (
        !updateType ||
        ![
          'project_updated',
          'project_activated',
          'member_removed',
          'member_added',
          'commitment_updated',
        ].includes(updateType)
      )
        return;
      loadProject();
    });
    return () => {
      unsubProjectUpdate();
      socket.off('connect');
    };
  }, [id, loadProject]);

  const statusOptions = useMemo(() => {
    if (!project) return [] as Project['status'][];
    const cur = project.status;
    const next = allowedNextStatuses(cur, user?.system_role ?? undefined);
    return [...new Set([cur, ...next])];
  }, [project, user?.system_role]);

  const handleSave = async () => {
    if (!project) return;
    try {
      const payload: any = {
        name: editData.name,
        description: editData.description || undefined,
        status: editData.status,
      };
      if (isAdmin) {
        payload.tag = editData.tag || undefined;
        payload.start_date = editData.start_date || undefined;
        payload.end_date = editData.end_date || undefined;
        payload.budget = editData.budget ? Number(editData.budget) : undefined;
      }
      const updated = await projectService.update(project.id, payload);
      setProject({ ...project, ...updated });
      setEditing(false);
      toast.success(t('projects:detail.success.saved'));
    } catch {
      toast.error(t('projects:detail.errors.updateFailed'));
    }
  };

  const handleJoinProject = async () => {
    if (!project || !canShowJoin) return;
    setJoining(true);
    try {
      const pendingCommitmentId = (myCommitment as { id?: string } | undefined)?.id;
      if (designatedLeader && myCommitment?.status === 'pending_b_approval' && pendingCommitmentId) {
        await commitmentService.updateStatus(pendingCommitmentId, { status: 'b_approved' });
        toast.success(t('projects:detail.success.joined'));
      } else {
        await projectService.joinProject(project.id);
        toast.success(t('projects:detail.success.joined'));
      }
      loadProject();
    } catch (err: any) {
      const raw = err.response?.data?.message;
      toast.error(
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
          t('projects:detail.errors.cannotJoin'),
      );
    } finally {
      setJoining(false);
    }
  };

  const closeRejectModal = () => {
    if (rejecting || leaderBusy) return;
    setRejectModalKind(null);
    setRejectReasonText('');
  };

  const handleRejectParticipation = () => {
    if (!project || !canShowRejectParticipation) return;
    setRejectModalKind('participation');
    setRejectReasonText('');
  };

  const handleAcceptLeaderRole = async () => {
    if (!project || !canShowLeaderRoleChoice) return;
    setLeaderBusy(true);
    try {
      await projectService.acceptLeaderRole(project.id);
      toast.success(t('projects:detail.leaderRole.toastAccepted'));
      await loadProject();
    } catch (err: any) {
      const raw = err.response?.data?.message;
      toast.error(
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
          t('projects:detail.errors.leaderRoleFailed'),
      );
    } finally {
      setLeaderBusy(false);
    }
  };

  const handleDeclineLeaderRole = () => {
    if (!project || !canShowLeaderRoleChoice) return;
    setRejectModalKind('declineLeader');
    setRejectReasonText('');
  };

  const handleRejectLeaderExit = () => {
    if (!project || !canShowRejectLeaderExit) return;
    setRejectModalKind('leaderExit');
    setRejectReasonText('');
  };

  const handleConfirmRejectModal = async () => {
    if (!project || !rejectModalKind) return;
    const trimmed = rejectReasonText.trim();
    if (rejectModalKind === 'participation' || rejectModalKind === 'leaderExit') {
      if (!trimmed) {
        toast.error(t('projects:detail.reject.modal.reasonRequired'));
        return;
      }
    }
    if (rejectModalKind === 'participation') {
      setRejecting(true);
      try {
        await projectService.rejectProject(project.id, { reason: trimmed });
        toast.success(t('projects:detail.reject.toastParticipation'));
        setRejectModalKind(null);
        setRejectReasonText('');
        navigate('/projects');
      } catch {
        toast.error(t('projects:detail.errors.rejectFailed'));
      } finally {
        setRejecting(false);
      }
      return;
    }
    if (rejectModalKind === 'declineLeader') {
      setLeaderBusy(true);
      try {
        await projectService.declineLeaderRole(project.id, { reason: trimmed || undefined });
        toast.success(t('projects:detail.leaderRole.toastDeclined'));
        setRejectModalKind(null);
        setRejectReasonText('');
        await loadProject();
      } catch (err: any) {
        const raw = err.response?.data?.message;
        toast.error(
          (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
            t('projects:detail.errors.leaderRoleFailed'),
        );
      } finally {
        setLeaderBusy(false);
      }
      return;
    }
    if (rejectModalKind === 'leaderExit') {
      setRejecting(true);
      try {
        await projectService.rejectProject(project.id, { reason: trimmed });
        toast.success(t('projects:detail.reject.toastLeaderExit'));
        setRejectModalKind(null);
        setRejectReasonText('');
        navigate('/projects');
      } catch {
        toast.error(t('projects:detail.errors.rejectFailed'));
      } finally {
        setRejecting(false);
      }
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0B0E14] flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
        <div className="absolute inset-0 blur-lg bg-cyan-500/20 animate-pulse" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">{t('projects:detail.loading')}</p>
    </div>
  );

  if (!project) return null;

  const TABS = [
    { key: 'overview', label: t('projects:detail.tabs.overview'), icon: Activity },
    ...(isActualMember ? [
      { key: 'tasks', label: t('projects:detail.tabs.tasks'), icon: Binary },
      { key: 'reports', label: t('projects:detail.tabs.reports'), icon: Shield },
      { key: 'members', label: t('projects:detail.tabs.members'), icon: User },
      { key: 'masterplan', label: t('projects:detail.tabs.masterplan'), icon: Calendar },
    ] : []),
    ...(canViewGit && isActualMember ? [{ key: 'git', label: t('projects:detail.tabs.git'), icon: GitBranch }] : []),
    ...(isActualMember && project.status === 'done' ? [{ key: 'rewards', label: t('projects:detail.tabs.rewards'), icon: Coins }] : []),
    ...(isAdmin ? [{ key: 'commitments', label: 'BẢN CAM KẾT', icon: FileText }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-300 font-sans pb-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/5 blur-[100px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 pt-10 relative z-10">
        <button
          onClick={() => navigate('/projects')}
          className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 hover:text-cyan-400 transition-all mb-10"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-2 transition-transform" />
          {t('projects:detail.breadcrumb')} / <span className="text-white/40">{project.code}</span>
        </button>

        {/* Chờ chỉ định chủ trì (planning + cờ — không chặn cam kết / lời mời) */}
        {Boolean(project.awaiting_leader_assignment) &&
          project.status === 'planning' && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-6 bg-cyan-500/10 border border-cyan-500/25 rounded-[32px] flex items-center gap-6 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-cyan-500 flex items-center justify-center text-black">
                <AlertCircle size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black uppercase text-cyan-400 tracking-widest">
                  {t('projects:detail.awaitingLeader.title')}
                </h3>
                <p className="text-xs text-slate-400 mt-1 italic leading-relaxed">
                  {t('projects:detail.awaitingLeader.description')}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('members')}
                  className="px-6 py-2 bg-cyan-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shrink-0"
                >
                  {t('projects:detail.awaitingLeader.cta')}
                </button>
              )}
            </motion.div>
          )}

        {/* Dự án tạm dừng (trạng thái paused — thường từ vận hành) */}
        {project.status === 'paused' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-amber-500/10 border border-amber-500/20 rounded-[32px] flex items-center gap-6 shadow-2xl"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-black">
              <AlertCircle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black uppercase text-amber-500 tracking-widest">
                {t('projects:detail.pausedBanner.title')}
              </h3>
              <p className="text-xs text-slate-400 mt-1 italic leading-relaxed">
                {t('projects:detail.pausedBanner.description')}
              </p>
              {canShowJoin && (
                <p className="text-xs text-amber-200/90 mt-2 font-semibold leading-relaxed">
                  {t('projects:detail.pausedBanner.invitePendingHint')}
                </p>
              )}
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className="px-6 py-2 bg-amber-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shrink-0"
              >
                {t('projects:detail.awaitingLeader.cta')}
              </button>
            )}
          </motion.div>
        )}

        {/* HEADER CONSOLE */}
        <div className="bg-[#0F1219]/80 backdrop-blur-2xl border border-white/5 rounded-[40px] p-10 mb-10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

          <AnimatePresence mode="wait">
            {editing ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-cyan-500 tracking-widest">{t('projects:detail.edit.fields.name')}</label>
                    <input
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full bg-black/40 text-2xl font-black uppercase italic tracking-tighter text-white rounded-2xl px-6 py-4 outline-none border border-white/10 focus:border-cyan-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-cyan-500 tracking-widest">{t('projects:detail.edit.fields.status')}</label>
                    <select
                      value={editData.status}
                      onChange={(e) => setEditData({ ...editData, status: e.target.value as any })}
                      className="w-full bg-black/40 text-white px-6 py-4 rounded-2xl text-sm font-bold border border-white/10 outline-none focus:border-cyan-500/50"
                    >
                      {statusOptions.map((k) => (
                        <option key={k} value={k}>
                          {t(`projects:manager.status.${STATUS_CONFIG[k]?.label ?? k}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-cyan-500 tracking-widest">{t('projects:detail.edit.fields.description')}</label>
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={3}
                    className="w-full bg-black/40 text-sm text-slate-400 rounded-2xl px-6 py-5 outline-none border border-white/10 focus:border-cyan-500/50 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setEditing(false)} className="px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all">{t('common:actions.cancel')}</button>
                  <button onClick={handleSave} className="px-10 py-3 bg-cyan-500 text-black rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20">{t('projects:detail.edit.save')}</button>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
                <div className="flex-1 space-y-6">
                  
                  {/* BỔ SUNG HUY HIỆU ĐANG MỞ VÀO ĐÂY */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-cyan-500/10 text-cyan-500 px-4 py-1.5 rounded-full border border-cyan-500/20">
                      <Hash size={12} />
                      <span className="text-[11px] font-black font-mono tracking-tight">{project.code}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.15em] border ${STATUS_CONFIG[project.status].bg} ${STATUS_CONFIG[project.status].color} ${STATUS_CONFIG[project.status].border}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shadow-[0_0_8px_currentColor]" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{t(`projects:manager.status.${STATUS_CONFIG[project.status].label}`)}</span>
                    </div>
                    
                    {isOpen && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.15em] border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                        </span>
                        ĐANG MỞ
                      </div>
                    )}
                  </div>

                  <div>
                    <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white mb-4">
                      {project.name}
                    </h1>
                    <p className="text-sm text-slate-500 max-w-4xl leading-relaxed font-medium italic">
                      {project.description || t('projects:detail.noDescription')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:flex flex-wrap items-center gap-10 pt-4">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-800 to-black flex items-center justify-center text-sm font-black border border-white/10 text-cyan-500 shadow-xl">
                        {project.leader?.full_name.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{t('projects:detail.meta.leader')}</p>
                        <p className="text-xs font-bold text-slate-200">{project.leader?.full_name || t('projects:detail.unknown')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/5 rounded-2xl text-slate-600 border border-white/5">
                        <Globe size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{t('projects:detail.meta.lifecycle')}</p>
                        <p className="text-xs font-mono font-bold text-slate-200">
                          {project.start_date?.slice(0, 10)} <span className="text-cyan-500/50 mx-1">→</span> {project.end_date?.slice(0, 10)}
                        </p>
                      </div>
                    </div>

                    {project.budget != null && (
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-500/5 rounded-2xl text-cyan-500/50 border border-cyan-500/10">
                          <DollarSign size={18} />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{t('projects:detail.meta.budget')}</p>
                          <p className="text-xs font-bold text-emerald-400">{project.budget.toLocaleString()} <span className="text-[10px] opacity-40">{t('projects:detail.currency')}</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap justify-end gap-3">
                    {canShowJoin && (
                      <button
                        onClick={handleJoinProject}
                        disabled={joining || rejecting || leaderBusy}
                        className={`px-8 py-4 text-black rounded-[24px] text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 shadow-xl ${
                          isInviteAcceptJoin || isLeaderPendingCommitment
                            ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'
                            : 'bg-cyan-500 hover:bg-cyan-400 shadow-cyan-500/20'
                        }`}
                      >
                        {joining ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : isInviteAcceptJoin || isLeaderPendingCommitment ? (
                          <CheckCircle2 size={16} strokeWidth={2.5} />
                        ) : (
                          <Zap size={16} fill="currentColor" />
                        )}
                        {t(
                          isInviteAcceptJoin || isLeaderPendingCommitment
                            ? 'projects:detail.join.ctaInvite'
                            : 'projects:detail.join.cta',
                        )}
                      </button>
                    )}

                    {canShowLeaderRoleChoice && (
                      <>
                        <button
                          type="button"
                          onClick={handleAcceptLeaderRole}
                          disabled={joining || rejecting || leaderBusy}
                          className="px-8 py-4 text-black rounded-[24px] text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 shadow-xl bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20"
                        >
                          {leaderBusy ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={16} strokeWidth={2.5} />
                          )}
                          {t('projects:detail.leaderRole.ctaAccept')}
                        </button>
                        <button
                          type="button"
                          onClick={handleDeclineLeaderRole}
                          disabled={joining || rejecting || leaderBusy}
                          className="px-8 py-4 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-[24px] text-[11px] font-black uppercase tracking-widest transition-all hover:bg-amber-500/25 disabled:opacity-50 flex items-center gap-2"
                        >
                          {leaderBusy ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <XCircle size={16} />
                          )}
                          {t('projects:detail.leaderRole.ctaDecline')}
                        </button>
                      </>
                    )}

                    {canShowRejectParticipation && (
                      <button
                        type="button"
                        onClick={handleRejectParticipation}
                        disabled={joining || rejecting || leaderBusy}
                        className="px-8 py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-[24px] text-[11px] font-black uppercase tracking-widest transition-all hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-red-500/10"
                      >
                        {rejecting ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                        {t('projects:detail.join.rejectParticipation')}
                      </button>
                    )}

                    {canShowRejectLeaderExit && (
                      <button
                        type="button"
                        onClick={handleRejectLeaderExit}
                        disabled={joining || rejecting || leaderBusy}
                        className="px-8 py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-[24px] text-[11px] font-black uppercase tracking-widest transition-all hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-red-500/10"
                      >
                        {rejecting ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                        {t('projects:detail.join.rejectLeader')}
                      </button>
                    )}
                    </div>
                    {canShowJoin && isLeaderPendingCommitment && (
                      <p className="text-[10px] text-slate-500 max-w-sm text-right leading-relaxed">
                        {t('projects:detail.join.leaderInviteHint')}
                      </p>
                    )}
                    {canShowLeaderRoleChoice && (
                      <p className="text-[10px] text-slate-500 max-w-sm text-right leading-relaxed">
                        {t('projects:detail.leaderRole.choiceHint')}
                      </p>
                    )}
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => setEditing(true)}
                      className="p-5 bg-white/5 hover:bg-cyan-500 hover:text-black text-slate-500 rounded-[24px] transition-all border border-white/5 group shadow-xl"
                    >
                      <Settings size={22} className="group-hover:rotate-90 transition-transform duration-700" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex items-center gap-1 bg-[#0F1219]/50 backdrop-blur-md border border-white/5 p-1.5 rounded-[24px] mb-10 overflow-x-auto no-scrollbar shadow-xl">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all group shrink-0 ${
                  isActive
                    ? 'bg-white text-black shadow-2xl shadow-white/10 scale-[1.02]'
                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon 
                  size={14} 
                  className={`shrink-0 ${isActive ? 'text-cyan-500' : 'group-hover:scale-110 transition-transform'}`} 
                />
                <span className="shrink-0 whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* CONTENT AREA */}
        <motion.main
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {activeTab === 'overview' && <OverviewTab projectId={project.id} />}
          {activeTab === 'tasks' && <TasksTab projectId={project.id} canEdit={canEdit} isStrictMember={isStrictMember} currentUserId={user?.id} />}
          {activeTab === 'reports' && <ReportsTab projectId={project.id} />}
          {activeTab === 'members' && (
            <MembersTab
              projectId={project.id}
              canEdit={canEdit}
              projectStatus={project.status}
              onReloadProject={loadProject}
            />
          )}
          {activeTab === 'masterplan' && <MasterPlanTab projectId={project.id} canEdit={canEdit} />}
          {activeTab === 'git' && canViewGit && <GitTab projectId={project.id} canManageGit={Boolean(isTruongLab)} />}
          {activeTab === 'rewards' && project.status === 'done' && (
            <RewardsTab projectId={project.id} projectBudget={project.budget} />
          )}
          {activeTab === 'commitments' && isAdmin && (
            <CommitmentTab
              projectId={project.id}
              projectName={project.name}
              commitments={(project as any).commitments || []}
              onReload={loadProject}
            />
          )}
        </motion.main>
      </div>

      <AnimatePresence mode="wait">
        {rejectModalKind && (
          <motion.div
            key={rejectModalKind}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
            onClick={() => closeRejectModal()}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0F1219] p-8 shadow-2xl"
            >
              <h3 className="text-lg font-black uppercase tracking-widest text-white mb-2">
                {t(`projects:detail.reject.modal.${rejectModalKind}.title`)}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                {t(`projects:detail.reject.modal.${rejectModalKind}.description`)}
              </p>
              <textarea
                rows={4}
                value={rejectReasonText}
                onChange={(e) => setRejectReasonText(e.target.value)}
                placeholder={t(`projects:detail.reject.modal.${rejectModalKind}.placeholder`)}
                className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/15 resize-none mb-6"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeRejectModal}
                  disabled={rejecting || leaderBusy}
                  className="flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                >
                  {t('common:actions.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectModal}
                  disabled={rejecting || leaderBusy}
                  className="flex-1 min-h-[44px] py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-red-500/90 text-white hover:bg-red-500 transition-colors flex justify-center items-center disabled:opacity-50"
                >
                  {rejecting || leaderBusy ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    t(`projects:detail.reject.modal.${rejectModalKind}.confirm`)
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* --- GIT TAB COMPONENT --- */
const GitTab: React.FC<{ projectId: string; canManageGit: boolean }> = ({ projectId, canManageGit }) => {
  const { t } = useTranslation();
  const [gitInfo, setGitInfo] = useState<GitRepoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateGitRepoRequest>({ git_repo_url: '', git_provider: 'github' });

  const loadGit = useCallback(async () => {
    setLoading(true);
    try {
      const info = await projectService.getGitRepo(projectId);
      setGitInfo(info);
      if (info?.repo_url) {
        setForm({
          git_repo_url: info.repo_url,
          git_provider: info.provider || 'github',
          git_default_branch: info.default_branch,
          git_visibility: info.visibility,
        });
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadGit(); }, [loadGit]);

  const handleSave = async () => {
    try {
      await projectService.updateGitRepo(projectId, form);
      toast.success(t('projects:detail.git.success.synced'));
      setEditing(false);
      loadGit();
    } catch {
      toast.error(t('projects:detail.git.errors.syncFailed'));
    }
  };

  if (loading) return (
    <div className="bg-[#0F1219] border border-white/5 rounded-[40px] p-24 flex flex-col items-center justify-center">
      <RefreshCw className="w-10 h-10 text-cyan-500 animate-spin mb-6" />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">{t('projects:detail.git.loading')}</p>
    </div>
  );

  return (
    <div className="bg-[#0F1219]/80 backdrop-blur-xl border border-white/5 rounded-[40px] p-10 shadow-2xl relative">
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-[24px] bg-black flex items-center justify-center text-cyan-500 border border-white/10 shadow-inner">
            <GitBranch size={32} />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-widest text-white">{t('projects:detail.git.title')}</h2>
            <p className="text-[10px] text-cyan-500/50 font-black uppercase tracking-widest italic">{t('projects:detail.git.subtitle')}</p>
          </div>
        </div>
        {canManageGit && (
          <button
            onClick={() => setEditing(!editing)}
            className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${editing ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-cyan-500 text-black'
              }`}
          >
            {editing ? t('projects:detail.git.cancelEdit') : t('projects:detail.git.reconfigure')}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-8 max-w-4xl animate-in slide-in-from-bottom-4">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-2">{t('projects:detail.git.fields.repoUrl')}</label>
            <input
              type="url"
              value={form.git_repo_url}
              onChange={(e) => setForm({ ...form, git_repo_url: e.target.value })}
              className="w-full bg-black border border-white/5 rounded-2xl px-6 py-5 text-sm font-mono text-cyan-400 outline-none focus:border-cyan-500/40 transition-all"
              placeholder={t('projects:detail.git.placeholders.repoUrl')}
            />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-2">{t('projects:detail.git.fields.provider')}</label>
              <select
                value={form.git_provider}
                onChange={(e) => setForm({ ...form, git_provider: e.target.value as GitProvider })}
                className="w-full bg-black border border-white/5 rounded-2xl px-6 py-5 text-sm font-bold text-white outline-none"
              >
                <option value="github">{t('projects:detail.git.providers.github')}</option>
                <option value="gitlab">{t('projects:detail.git.providers.gitlab')}</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-2">{t('projects:detail.git.fields.defaultBranch')}</label>
              <input value={form.git_default_branch || ''} onChange={(e) => setForm({ ...form, git_default_branch: e.target.value })} className="w-full bg-black border border-white/5 rounded-2xl px-6 py-5 text-sm font-mono text-white outline-none" placeholder={t('projects:detail.git.placeholders.defaultBranch')} />
            </div>
          </div>
          <button onClick={handleSave} className="flex items-center gap-3 px-10 py-4 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 transition-all">
            <Zap size={16} fill="currentColor" /> {t('projects:detail.git.saveConnection')}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {gitInfo?.repo_url ? (
            <>
              <div className="group bg-black/60 rounded-[32px] border border-white/5 p-8 transition-all hover:border-cyan-500/20">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{t('projects:detail.git.currentUrl')}</p>
                  <ExternalLink size={14} className="text-slate-600 group-hover:text-cyan-500" />
                </div>
                <a href={gitInfo.repo_url} target="_blank" rel="noopener noreferrer" className="text-xl font-mono font-bold text-white hover:text-cyan-400 transition-colors">
                  {gitInfo.repo_url}
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: t('projects:detail.git.meta.provider'), val: gitInfo.provider, icon: Cpu },
                  { label: t('projects:detail.git.meta.branch'), val: gitInfo.default_branch || t('projects:detail.git.defaults.defaultBranch'), icon: Binary },
                  { label: t('projects:detail.git.meta.visibility'), val: gitInfo.visibility, icon: Shield },
                ].map((item, idx) => (
                  <div key={idx} className="bg-black/30 border border-white/5 rounded-3xl p-6">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2 flex items-center gap-2">
                      <item.icon size={12} className="text-cyan-500" /> {item.label}
                    </p>
                    <p className="text-sm font-bold text-slate-200 uppercase">{item.val || '---'}</p>
                  </div>
                ))}
              </div>

              {gitInfo.last_commit && (
                <div className="bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-[32px] p-8 space-y-6">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">{t('projects:detail.git.lastCommit')}</p>
                    <span className="text-[10px] font-mono text-slate-600 tracking-tighter">{new Date(gitInfo.last_commit.date).toLocaleString()}</span>
                  </div>
                  <p className="text-lg font-bold text-white italic">"{gitInfo.last_commit.message}"</p>
                  <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                      <span className="text-[10px] font-mono text-cyan-500">{gitInfo.last_commit.sha?.substring(0, 7)}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('projects:detail.git.by', { author: gitInfo.last_commit.author })}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-white/5 rounded-[40px] bg-black/20">
              <GitBranch size={48} className="text-slate-800 mb-6" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8">{t('projects:detail.git.noRepo')}</p>
              <button onClick={() => setEditing(true)} className="px-10 py-4 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 transition-all">{t('projects:detail.git.initialSetup')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;