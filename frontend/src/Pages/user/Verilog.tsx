import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock3, FileText, FlaskConical, Loader2, Target, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { verilogService } from '../../services/verilog.service';
import type { VerilogLevel, VerilogProblemListItem, VerilogUserProblemStatus } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { ROUTER } from '../../routes/router';

const LIBRARY_ITEMS = [
  {
    key: 'research',
    icon: FlaskConical,
    path: ROUTER.USER.RESEARCH,
  },
  {
    key: 'curriculum',
    icon: BookOpen,
    path: ROUTER.USER.CURRICULUM,
  },
  {
    key: 'documents',
    icon: FileText,
    path: ROUTER.USER.DOCUMENTS,
  },
] as const;

const Verilog: React.FC = () => {
  const { isAuthenticated, initialized } = useAuthStore();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<'' | VerilogLevel>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [problems, setProblems] = useState<VerilogProblemListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [stats, setStats] = useState<{ submitted_problems: number; accepted_problems: number; total_score: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await verilogService.listProblems({
        page,
        limit,
        search: search || undefined,
        level: level || undefined,
      });
      setProblems(res.problems);
      setPagination(res.pagination);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setErr(msg || t('verilog:dashboard.errors.fetchProblemsFailed'));
      setProblems([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, level, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!initialized || !isAuthenticated) {
      setStats(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const s = await verilogService.getStats();
        if (!cancelled) setStats(s);
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialized, isAuthenticated]);

  const goPage = (p: number) => {
    if (p < 1 || p > pagination.totalPages) return;
    setPage(p);
  };

  const totalAvailable = Math.max(pagination.total, 1);
  const acceptedCount = stats?.accepted_problems ?? 0;
  const submittedCount = stats?.submitted_problems ?? 0;
  const progressPct = Math.min(100, Math.round((acceptedCount / totalAvailable) * 100));

  const suggestedProblems = [...problems]
    .sort((a, b) => {
      const statusPriority = (s?: VerilogUserProblemStatus) => (s === 'accepted' ? 2 : s === 'attempted' ? 1 : 0);
      const levelPriority = (lv: VerilogLevel) => (lv === 'easy' ? 0 : lv === 'medium' ? 1 : 2);
      return statusPriority(a.user_status) - statusPriority(b.user_status) || levelPriority(a.level) - levelPriority(b.level);
    })
    .slice(0, 3);

  const upcomingDeadline = problems
    .map((p) => ({ ...p, deadline: (p as VerilogProblemListItem & { deadline?: string }).deadline }))
    .filter((p) => Boolean(p.deadline))
    .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())[0];

  return (
    <div className="min-h-screen bg-[#0B0E14] font-sans text-slate-200 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[700px] h-[420px] rounded-full bg-cyan-500/5 blur-[110px]" />
        <div className="absolute bottom-0 left-0 w-[560px] h-[420px] rounded-full bg-blue-600/5 blur-[110px]" />
      </div>

      <section className="max-w-[1400px] mx-auto px-6 md:px-8 pt-12 mb-10 relative z-10">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 text-white">Verilog</h1>
        <p className="text-slate-400 mb-6 bg-white/5 border border-white/10 inline-block px-3 py-1.5 rounded-lg text-sm">
          {t('verilog:dashboard.welcome')}
        </p>

        {initialized && isAuthenticated && stats && (
          <div className="flex flex-wrap gap-4 mb-6 text-sm">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <span className="text-slate-400">{t('verilog:dashboard.stats.submitted')}</span>
              <span className="font-semibold text-white">{stats.submitted_problems}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <span className="text-slate-400">{t('verilog:dashboard.stats.accepted')}</span>
              <span className="font-semibold text-emerald-300">{stats.accepted_problems}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <span className="text-slate-400">{t('verilog:dashboard.stats.totalScore')}</span>
              <span className="font-semibold text-cyan-300">{Number(stats.total_score).toFixed(1)}</span>
            </div>
          </div>
        )}

        <div className="w-full rounded-3xl border border-white/10 bg-gradient-to-r from-[#0F1219] via-[#131A24] to-[#0F1219] shadow-2xl shadow-black/30 p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Progress + CTA */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-cyan-300">
                <Trophy size={16} />
                <p className="text-[11px] font-black uppercase tracking-[0.2em]">{t('verilog:dashboard.progress.title')}</p>
              </div>
              <div>
                <div className="flex items-end justify-between mb-2">
                  <p className="text-sm text-slate-300 font-semibold">
                    {t('verilog:dashboard.progress.acceptedCount', { accepted: acceptedCount, total: totalAvailable })}
                  </p>
                  <p className="text-cyan-300 text-sm font-black">{progressPct}%</p>
                </div>
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={suggestedProblems[0] ? `/verilog/${suggestedProblems[0].id}` : '/verilog'}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 text-[#020617] text-[11px] font-black uppercase tracking-widest hover:bg-cyan-400 transition-colors"
                >
                  <Target size={14} /> {t('verilog:dashboard.actions.nextProblem')}
                </Link>
                <Link
                  to="/verilog/submissions"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                >
                  <Clock3 size={14} /> {t('verilog:submissions.title')}
                </Link>
              </div>
              <p className="text-xs text-slate-400">
                {t('verilog:dashboard.progress.submittedHint', { submitted: submittedCount })}
              </p>
            </div>

            {/* Right: Suggestions + Deadline */}
            <div className="space-y-4">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">{t('verilog:dashboard.suggestions.title')}</p>
              <div className="space-y-2">
                {suggestedProblems.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
                    {t('verilog:dashboard.suggestions.empty')}
                  </div>
                ) : (
                  suggestedProblems.map((p) => (
                    <Link
                      key={p.id}
                      to={`/verilog/${p.id}`}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {t(`verilog:levels.${p.level}`)} • {t(`verilog:dashboard.problemStatus.${p.user_status || 'none'}`)}
                        </p>
                      </div>
                      <ArrowRight size={14} className="text-cyan-300 shrink-0" />
                    </Link>
                  ))
                )}
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-300 mb-1">{t('verilog:dashboard.deadlineNotice.title')}</p>
                <p className="text-sm text-amber-100">
                  {upcomingDeadline?.deadline
                    ? t('verilog:dashboard.deadlineNotice.hasDeadline', {
                        name: upcomingDeadline.name,
                        date: new Date(upcomingDeadline.deadline).toLocaleDateString('vi-VN'),
                      })
                    : t('verilog:dashboard.deadlineNotice.none')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-6 md:px-8 mb-16 relative z-10">
        <div className="bg-[#0F1219]/90 border border-white/10 p-6 rounded-3xl shadow-2xl shadow-black/20">
          <div className="flex flex-col md:flex-row gap-3 mb-4 flex-wrap items-stretch md:items-center">
            <input
              type="search"
              placeholder={t('verilog:dashboard.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 min-w-[200px] rounded-xl px-4 py-2.5 text-sm border border-white/10 bg-[#0B0E14] text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50"
            />
            <div className="flex gap-2 flex-wrap">
              {(['', 'easy', 'medium', 'hard'] as const).map((lv) => (
                <button
                  key={lv || 'all'}
                  type="button"
                  onClick={() => { setLevel(lv); setPage(1); }}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                    level === lv ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-[#0B0E14] text-slate-300 border-white/10 hover:border-white/20'
                  }`}
                >
                  {lv === '' ? t('verilog:dashboard.filters.all') : t(`verilog:levels.${lv}`)}
                </button>
              ))}
            </div>
          </div>

          {err && (
            <p className="text-rose-400 text-sm mb-3">{err}</p>
          )}

          <div className="overflow-x-auto bg-[#0B0E14] border border-white/10 rounded-2xl p-2 min-h-[120px]">
            {loading ? (
              <div className="flex justify-center items-center py-16 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                {t('verilog:dashboard.loading')}
              </div>
            ) : (
              <table className="w-full text-[11px] border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-slate-500 text-left uppercase tracking-tighter">
                    <th className="px-4 py-2 font-semibold">{t('verilog:dashboard.table.logicId')}</th>
                    <th className="px-4 py-2 font-semibold">{t('common:table.status')}</th>
                    <th className="px-4 py-2 font-semibold">{t('verilog:dashboard.table.title')}</th>
                    <th className="px-4 py-2 font-semibold text-center">{t('verilog:dashboard.table.level')}</th>
                    <th className="px-4 py-2 font-semibold text-center">{t('verilog:dashboard.table.testCount')}</th>
                    <th className="px-4 py-2 font-semibold">{t('verilog:dashboard.table.tags')}</th>
                    <th className="px-4 py-2 font-semibold">{t('verilog:dashboard.table.createdAt')}</th>
                    <th className="px-4 py-2 font-semibold text-center">{t('verilog:dashboard.table.maxScore')}</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        {t('verilog:dashboard.empty')}
                      </td>
                    </tr>
                  ) : (
                    problems.map((item) => (
                      <tr key={item.id} className="bg-white/[0.03] border border-white/10 shadow-sm hover:bg-white/[0.06] transition-colors">
                        <td className="px-4 py-3 text-center border border-white/10 rounded-l-lg font-mono text-slate-200">{item.logic_id}</td>
                        <td className="px-4 py-3">
                          <span className="bg-white/10 px-2 py-1 rounded text-[10px] text-slate-200">
                            {t(`verilog:dashboard.problemStatus.${item.user_status || 'none'}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-200 max-w-[300px]">
                          <Link to={`/verilog/${item.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline truncate block">
                            {item.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-white/10 px-3 py-1 rounded-full text-slate-200">{t(`verilog:levels.${item.level}`)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-white/10 px-3 py-1 rounded-full text-slate-200">{item.testcase_count}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-white/10 px-3 py-1 rounded-full inline-block max-w-[180px] truncate text-slate-200" title={Array.isArray(item.tags) ? item.tags.join(', ') : ''}>
                            {Array.isArray(item.tags) && item.tags.length ? item.tags.join(', ') : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="px-4 py-3 text-center border border-white/10 rounded-r-lg font-bold text-white">{item.total_grade}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6 text-xs text-slate-500 flex-wrap">
              <button
                type="button"
                className="hover:text-white disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => goPage(page - 1)}
              >
                {t('verilog:submissions.pagination.prev')}
              </button>
              <span>
                {t('verilog:dashboard.pagination.page', { page: pagination.page, totalPages: pagination.totalPages })}
              </span>
              <button
                type="button"
                className="hover:text-white disabled:opacity-40"
                disabled={page >= pagination.totalPages}
                onClick={() => goPage(page + 1)}
              >
                {t('verilog:submissions.pagination.next')}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-6 md:px-8 mb-24 relative z-10">
        <h2 className="text-3xl md:text-4xl font-black mb-1 text-white">{t('verilog:dashboard.library.title')}</h2>
        <p className="text-slate-400 mb-8">{t('verilog:dashboard.library.subtitle')}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {LIBRARY_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.path}
                className="text-left bg-[#0F1219]/90 border border-white/10 p-6 rounded-2xl relative group cursor-pointer hover:-translate-y-1 hover:border-cyan-500/30 transition-all duration-300 shadow-xl shadow-black/20 block"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-cyan-500/10 border-cyan-500/20 text-cyan-300">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-cyan-400">{t(`verilog:dashboard.library.items.${item.key}.title`)}</p>
                    <h4 className="text-base font-bold text-white">{t(`verilog:dashboard.library.items.${item.key}.subtitle`)}</h4>
                  </div>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed pr-10">
                  {t(`verilog:dashboard.library.items.${item.key}.description`)}
                </p>
                <div className="absolute bottom-6 right-6 w-8 h-8 bg-[#1A2130] text-cyan-300 rounded-lg flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-black transition-colors shadow-lg">
                  <ArrowRight size={16} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Verilog;
