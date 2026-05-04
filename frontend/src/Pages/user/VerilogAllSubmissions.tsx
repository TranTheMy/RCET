import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, ChevronLeft, ChevronRight, Clock, CheckCircle2,
  XCircle, AlertTriangle, Users, Search, ArrowLeft,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { verilogService } from '../../services/verilog.service';
import { adminService, type AdminUser } from '../../services/admin.service';
import type {
  VerilogSubmissionListItem, VerilogSubmissionDetail,
  VerilogSubmissionStatus, VerilogFailureCode,
} from '../../types';

const FAILURE_LABELS: Record<string, string> = {
  CE: 'verilog:submissions.failure.CE',
  RLE: 'verilog:submissions.failure.RLE',
  TLE: 'verilog:submissions.failure.TLE',
  WA: 'verilog:submissions.failure.WA',
  NONE: 'verilog:submissions.failure.NONE',
  NA: 'verilog:submissions.failure.NA',
};

const StatusBadge: React.FC<{ status: VerilogSubmissionStatus; failure: VerilogFailureCode }> = ({ status, failure }) => {
  const { t } = useTranslation();
  if (status === 'PENDING' || status === 'JUDGING') {
    return <span className="flex items-center gap-1 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium"><Clock className="w-3 h-3" /> {t('verilog:submissions.status.judging')}</span>;
  }
  if (status === 'ERROR') {
    return <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium"><AlertTriangle className="w-3 h-3" /> {t('verilog:submissions.status.error')}</span>;
  }
  if (failure === 'NONE') {
    return <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium"><CheckCircle2 className="w-3 h-3" /> {t('verilog:submissions.status.accepted')}</span>;
  }
  return <span className="flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium"><XCircle className="w-3 h-3" /> {t(FAILURE_LABELS[failure] || failure)}</span>;
};

const VerilogAllSubmissions: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [submissions, setSubmissions] = useState<VerilogSubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeSubmission, setActiveSubmission] = useState<VerilogSubmissionDetail | null>(null);
  const [searchUser, setSearchUser] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const limit = 15;

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (selectedUserId) params.user_id = selectedUserId;
      const res = await verilogService.listAllSubmissions(params);
      setSubmissions(res.submissions);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch {
      toast.error(t('verilog:submissions.toasts.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [page, selectedUserId, t]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);
  useEffect(() => {
    (async () => {
      try {
        const res = await adminService.getUsers({ page: 1, limit: 200 });
        setUsers(res.data.users);
      } catch {
        // Keep page usable even if user list fails.
      }
    })();
  }, []);

  const viewDetail = async (id: string) => {
    try {
      const res = await verilogService.getSubmission(id);
      setActiveSubmission(res);
    } catch { /* ignore */ }
  };

  const filteredSubmissions = searchUser
    ? submissions.filter((s) => {
        const name = s.user?.full_name || '';
        return name.toLowerCase().includes(searchUser.toLowerCase());
      })
    : submissions;

  return (
    <div className="min-h-screen bg-[#020617] font-sans text-slate-200">
      <div className="max-w-[1400px] mx-auto px-8 pt-12 pb-20">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate('/verilog');
            }}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-300 transition-colors hover:bg-white/10 hover:text-cyan-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('documents:back')}
          </button>
          <div className="flex items-center gap-3 mb-1">
            <Users size={24} className="text-cyan-400" />
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">
              {t('verilog:allSubmissions.title')}
            </h1>
          </div>
          <p className="text-slate-400 text-sm">
            {t('verilog:allSubmissions.subtitle')}
            {total > 0 && <span className="ml-1">{t('verilog:submissions.totalCount', { total })}</span>}
          </p>
        </div>

        <div className="flex gap-6" style={{ minHeight: 500 }}>
          {/* Left: Submission list */}
          <div className="flex-1">
            <div className="bg-[#0f172a] p-6 rounded-2xl shadow-sm border border-white/10">
              {/* Search */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder={t('verilog:allSubmissions.searchPlaceholder')}
                    className="w-full pl-9 pr-4 py-1.5 bg-[#020617] text-slate-200 rounded-lg text-sm outline-none border border-white/10 focus:border-cyan-500/40"
                  />
                </div>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setPage(1);
                    setActiveSubmission(null);
                  }}
                  className="bg-[#020617] text-slate-200 rounded-lg text-sm px-3 py-1.5 outline-none border border-white/10 focus:border-cyan-500/40 min-w-[220px]"
                >
                  <option value="">{t('verilog:allSubmissions.allUsers')}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto bg-[#020617] rounded-xl shadow-inner p-3 border border-white/10">
                {loading ? (
                  <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>
                ) : filteredSubmissions.length === 0 ? (
                  <div className="text-center py-20 text-slate-400">{t('verilog:submissions.empty')}</div>
                ) : (
                  <table className="w-full text-xs border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-slate-300 text-left uppercase tracking-wider">
                        <th className="px-4 py-2 font-semibold">{t('common:table.time')}</th>
                        <th className="px-4 py-2 font-semibold">{t('verilog:allSubmissions.table.submitter')}</th>
                        <th className="px-4 py-2 font-semibold">{t('verilog:submissions.table.problem')}</th>
                        <th className="px-4 py-2 font-semibold text-center">{t('common:table.status')}</th>
                        <th className="px-4 py-2 font-semibold text-center">{t('common:table.score')}</th>
                        <th className="px-4 py-2 font-semibold text-center">{t('verilog:submissions.table.testsPassed')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => viewDetail(s.id)}
                          className={`bg-[#0b1226] border border-white/10 shadow-sm hover:bg-[#111a33] transition-colors cursor-pointer ${activeSubmission?.id === s.id ? 'ring-2 ring-cyan-500/30 border-cyan-500/30' : ''}`}
                        >
                          <td className="px-4 py-3 rounded-l-lg text-slate-400">
                            {new Date(s.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-200">
                              {s.user?.full_name || t('verilog:allSubmissions.unknownUser')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/verilog/${s.problem_id}`); }}
                              className="font-medium text-slate-200 hover:text-cyan-300 transition-colors truncate max-w-[200px] block"
                            >
                              {s.problem?.name || s.problem_id}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={s.status} failure={s.overall_failure} />
                          </td>
                          <td className="px-4 py-3 text-center font-bold">{s.total_grade}/{s.max_grade}</td>
                          <td className="px-4 py-3 text-center rounded-r-lg text-slate-400">{s.passed_count}/{s.total_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6 text-xs text-slate-400">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="hover:text-white disabled:opacity-30 flex items-center gap-1">
                    <ChevronLeft className="w-3 h-3" /> {t('verilog:submissions.pagination.prev')}
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    return (
                      <button key={pageNum} onClick={() => setPage(pageNum)}
                        className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${page === pageNum ? 'bg-cyan-500 text-[#020617] shadow-md' : 'hover:bg-white/10'}`}>
                        {pageNum}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="hover:text-white disabled:opacity-30 flex items-center gap-1">
                    {t('verilog:submissions.pagination.next')} <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Submission detail */}
          {activeSubmission && (
            <div className="w-[400px] shrink-0">
              <div className="bg-[#0f172a] rounded-2xl p-5 sticky top-24 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-200">{t('verilog:submissions.detailTitle')}</h2>
                  <StatusBadge status={activeSubmission.status} failure={activeSubmission.overall_failure} />
                </div>

                {/* User info */}
                <div className="bg-[#020617] rounded-xl p-3 mb-3 flex items-center gap-3 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-black uppercase">
                    {activeSubmission.user?.full_name?.charAt(0) ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{activeSubmission.user?.full_name || t('verilog:allSubmissions.unknownUser')}</p>
                    <p className="text-[10px] text-slate-400">{new Date(activeSubmission.created_at).toLocaleString('vi-VN')}</p>
                  </div>
                </div>

                <div className="bg-[#020617] rounded-xl p-4 mb-3 border border-white/10">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">{t('common:table.score')}</span>
                      <p className="font-bold text-lg">{activeSubmission.total_grade}<span className="text-slate-400 text-sm font-normal">/{activeSubmission.max_grade}</span></p>
                    </div>
                    <div>
                      <span className="text-slate-400">{t('verilog:submissions.testsPassed')}</span>
                      <p className="font-bold text-lg">{activeSubmission.passed_count}<span className="text-slate-400 text-sm font-normal">/{activeSubmission.total_count}</span></p>
                    </div>
                  </div>
                  {activeSubmission.judge_method && (
                    <div className="mt-2 text-[10px] text-slate-400">
                      {t('verilog:submissions.judgeMethod')}: <span className="font-medium text-slate-300">{activeSubmission.judge_method}</span>
                    </div>
                  )}
                </div>

                {/* Test results */}
                {activeSubmission.results && activeSubmission.results.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {activeSubmission.results.map((r, i) => (
                      <div key={r.id} className="bg-[#020617] rounded-lg p-3 border border-white/10">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">Test {i + 1}: {r.testcase?.name || `#${i + 1}`}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold">{t('verilog:submissions.points', { points: r.grade })}</span>
                            {r.possible_failure === 'NONE' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        </div>
                        {r.possible_failure !== 'NONE' && r.possible_failure !== 'NA' && (
                          <span className="text-[10px] text-orange-600 font-medium">{t(FAILURE_LABELS[r.possible_failure] || r.possible_failure)}</span>
                        )}
                        {r.log && (
                          <details className="mt-1">
                            <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-200">{t('verilog:submissions.log')}</summary>
                            <pre className="text-[9px] bg-slate-900 text-green-400 rounded-lg p-2 mt-1 overflow-x-auto whitespace-pre-wrap max-h-32">
                              {r.log}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Code */}
                {activeSubmission.code && (
                  <details>
                    <summary className="text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer hover:text-slate-700 mb-1">{t('verilog:submissions.sourceCode')}</summary>
                    <pre className="text-[10px] bg-slate-900 text-slate-300 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap max-h-60 font-mono">
                      {activeSubmission.code}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerilogAllSubmissions;
