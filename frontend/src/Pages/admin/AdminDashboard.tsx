import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, Users, Shield, ChevronDown, Terminal, Fingerprint, Database } from 'lucide-react';
import { adminService, type ApprovalRequestItem } from '../../services/admin.service';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { translateApiMessage } from '../../utils/apiErrorI18n';

/** Luồng duyệt từ admin: chỉ gán `user` (đồng bộ backend `admin.validator`). */
const APPROVAL_ASSIGNED_ROLE = 'user' as const;

const STATUS_BADGE: Record<string, { bg: string; icon: React.ReactNode }> = {
  pending: { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]', icon: <Clock size={12} /> },
  approved: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]', icon: <CheckCircle2 size={12} /> },
  rejected: { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]', icon: <XCircle size={12} /> },
};

const STATUS_LABEL_KEY: Record<string, string> = {
  pending: 'admin:dashboard.status.pending',
  approved: 'admin:dashboard.status.approved',
  rejected: 'admin:dashboard.status.rejected',
};

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<ApprovalRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getApprovalRequests({
        status: filterStatus || undefined,
      });
      setRequests(res.data?.requests || []);
    } catch {
      toast.error(t('admin:dashboard.toasts.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, t]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (requestId: string, role: string, note: string) => {
    setActionLoading(requestId);
    try {
      await adminService.approveUser(requestId, { system_role: role, review_note: note || undefined });
      toast.success(t('admin:dashboard.toasts.approved'));
      loadRequests();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const raw = error.response?.data?.message;
      toast.error(
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
          t('admin:dashboard.toasts.approveFailed'),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string, note: string) => {
    setActionLoading(requestId);
    try {
      await adminService.rejectUser(requestId, { review_note: note || undefined });
      toast.success(t('admin:dashboard.toasts.rejected'));
      loadRequests();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const raw = error.response?.data?.message;
      toast.error(
        (typeof raw === 'string' ? translateApiMessage(t, raw) : '') ||
          t('admin:dashboard.toasts.rejectFailed'),
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full bg-[#020617] font-sans relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] opacity-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col min-h-0 w-full p-4 md:p-6 relative z-10">
        <div className="flex-1 flex flex-col min-h-0 rounded-[32px] border border-white/5 bg-[#0F172A]/80 backdrop-blur-2xl overflow-hidden shadow-[0_24px_90px_-60px_rgba(6,182,212,0.2)]">
          <div className="px-5 md:px-8 py-8 border-b border-white/5 relative overflow-hidden">
            
            {/* Edge Scanline */}
            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-cyan-500/0 via-cyan-500 to-cyan-500/0 opacity-50" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-3xl font-black tracking-tighter text-white uppercase italic flex items-center gap-4">
                  <div className="relative group">
                    <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all">
                      <Shield size={24} />
                    </span>
                  </div>
                  {t('admin:dashboard.title')}
                </h1>
                <p className="text-slate-500 text-[10px] md:text-[11px] font-mono tracking-widest mt-3 uppercase">
                  {t('admin:dashboard.subtitle')}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500">
                <span className="px-4 py-2 rounded-xl bg-[#020617] border border-white/5 flex items-center gap-2 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                  <Terminal size={12} className="text-slate-500" />
                  {t(STATUS_LABEL_KEY[filterStatus] || 'admin:dashboard.status.all')}
                  <span className="text-white ml-2">[{loading ? '...' : requests.length}]</span>
                </span>
              </div>
            </div>

            {/* Filter tabs - Cyber Style */}
            <div className="mt-8 flex gap-2 bg-[#020617]/50 rounded-2xl border border-white/5 p-1.5 overflow-x-auto custom-scrollbar">
              {[
                { key: 'pending', labelKey: 'admin:dashboard.filters.pending', icon: <Clock size={14} /> },
                { key: 'approved', labelKey: 'admin:dashboard.filters.approved', icon: <CheckCircle2 size={14} /> },
                { key: 'rejected', labelKey: 'admin:dashboard.filters.rejected', icon: <XCircle size={14} /> },
                { key: '', labelKey: 'admin:dashboard.filters.all', icon: <Users size={14} /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterStatus(tab.key)}
                  className={`group flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl whitespace-nowrap transition-all ${
                    filterStatus === tab.key
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                      : 'text-slate-500 border border-transparent hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className={`transition-colors ${filterStatus === tab.key ? 'text-cyan-400' : 'text-slate-600 group-hover:text-slate-400'}`}>
                    {tab.icon}
                  </span>
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Requests list */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-8 bg-[#0B1121]">
            {loading ? (
              <div className="flex flex-1 flex-col items-center justify-center py-20 space-y-4 min-h-[12rem]">
                <div className="relative w-12 h-12 flex items-center justify-center">
                   <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-full border-t-cyan-500 animate-spin" />
                   <Database size={20} className="text-cyan-500 animate-pulse" />
                </div>
                <span className="text-[10px] font-mono tracking-[0.3em] text-cyan-500/70 uppercase">{t('admin:dashboard.loading')}</span>
              </div>
            ) : requests.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[12rem] py-12 rounded-3xl border border-white/5 bg-[#020617]/50">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  <Fingerprint size={32} className="text-slate-600" />
                </div>
                <p className="text-white font-black tracking-widest text-sm uppercase">{t('admin:dashboard.empty.title')}</p>
                <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest mt-2">{t('admin:dashboard.empty.hint')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <ApprovalCard
                    key={req.id}
                    request={req}
                    loading={actionLoading === req.id}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// COMPONENT: TỪNG THẺ YÊU CẦU DUYỆT
const ApprovalCard: React.FC<{
  request: ApprovalRequestItem;
  loading: boolean;
  onApprove: (id: string, role: string, note: string) => void;
  onReject: (id: string, note: string) => void;
}> = ({ request, loading, onApprove, onReject }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const badge = STATUS_BADGE[request.status] || STATUS_BADGE.pending;
  const user = request.user;

  return (
    <div className="bg-[#0F172A] rounded-2xl border border-white/5 overflow-hidden transition-all hover:border-cyan-500/30 group">
      <button
        type="button"
        className="w-full text-left p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#020617] border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-mono font-bold text-lg shadow-[inset_0_0_15px_rgba(6,182,212,0.1)] group-hover:border-cyan-400 transition-colors">
            {user.full_name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="text-[13px] md:text-[15px] font-black uppercase text-white tracking-widest leading-tight">
              {user.full_name}
            </h3>
            <p className="text-[10px] font-mono text-slate-500 mt-1">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-end md:self-auto">
          {user.department && (
            <span className="text-[9px] font-mono uppercase tracking-widest bg-[#020617] text-slate-400 px-3 py-1.5 rounded-lg border border-white/5 hidden sm:block">
              {user.department}
            </span>
          )}
          <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border flex items-center gap-2 ${badge.bg}`}>
            {badge.icon} {t(STATUS_LABEL_KEY[request.status] || request.status)}
          </span>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border border-white/5 text-slate-400 bg-[#020617] transition-all ${expanded ? 'rotate-180 bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : ''}`}>
            <ChevronDown size={14} />
          </div>
        </div>
      </button>

      {/* CHI TIẾT KHI EXPAND */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/5 pt-5 bg-[#020617]/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <CyberDataBlock label={t('admin:dashboard.card.studentCode')} value={user.student_code || t('admin:dashboard.card.na')} />
            <CyberDataBlock label={t('admin:dashboard.card.department')} value={user.department || t('admin:dashboard.card.na')} />
            <CyberDataBlock 
              label={t('admin:dashboard.card.emailVerified')}
              value={user.email_verified ? t('admin:dashboard.card.verified') : t('admin:dashboard.card.unverified')}
              isWarning={!user.email_verified} 
            />
            <CyberDataBlock label={t('admin:dashboard.card.createdAt')} value={user.created_at?.slice(0, 10)} />
          </div>

          {request.status === 'pending' && (
            <div className="bg-[#0F172A] rounded-2xl p-5 border border-white/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-500/70 mb-2 block flex items-center gap-2">
                    <Terminal size={10} /> {t('admin:dashboard.card.assignRole')}
                  </label>
                  <div className="w-full px-4 py-3 bg-[#020617] rounded-xl text-[11px] font-mono font-bold tracking-widest uppercase border border-white/10 text-cyan-400">
                    {t('admin:roles.user')}
                  </div>
                  <p className="mt-2 text-[9px] font-mono text-slate-500 leading-relaxed">
                    {t('admin:dashboard.card.roleFixedHint')}
                  </p>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 block">
                    {t('admin:dashboard.card.noteLabel')}
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
                    placeholder={t('admin:dashboard.card.notePlaceholder')}
                    className="w-full px-4 py-3 bg-[#020617] rounded-xl text-xs font-mono outline-none border border-white/10 focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-slate-300 transition-all placeholder:text-slate-700"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-5 mt-5 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => onApprove(request.id, APPROVAL_ASSIGNED_ROLE, note)}
                  disabled={loading}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-[#020617] rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {t('admin:dashboard.card.actions.approve')}
                </button>
                <button
                  type="button"
                  onClick={() => onReject(request.id, note)}
                  disabled={loading}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  {t('admin:dashboard.card.actions.reject')}
                </button>
              </div>
            </div>
          )}

          {request.review_note && (
            <div className="mt-4 bg-[#020617] rounded-xl p-4 border border-white/5 border-l-4 border-l-cyan-500/50">
              <span className="text-[8px] font-mono text-cyan-500 uppercase tracking-widest block mb-1">
                {t('admin:dashboard.card.systemLogPrefix')}
              </span>
              <p className="text-xs font-mono text-slate-400 leading-relaxed">{request.review_note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// UI Component phụ trợ
const CyberDataBlock = ({
  label,
  value,
  isWarning = false,
}: {
  label: string;
  value: React.ReactNode;
  isWarning?: boolean;
}) => (
  <div>
    <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-1">{label}</span>
    <span className={`text-[11px] font-mono uppercase tracking-wider ${isWarning ? 'text-rose-400' : 'text-cyan-100'}`}>
      {value}
    </span>
  </div>
);

export default AdminDashboard;