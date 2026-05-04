import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { verilogService } from '../../services/verilog.service';
import { useTranslation } from 'react-i18next';
import type {
  VerilogProblemDetail as VerilogProblemDetailData,
  VerilogSubmissionDetail,
  VerilogSubmissionListItem,
} from '../../types';
import { ROUTER } from '../../routes/router';
import { useAuthStore } from '../../store/authStore';

const FAIL_LABEL_KEY: Record<string, string> = {
  CE: 'verilog:problemDetail.fail.CE',
  RLE: 'verilog:problemDetail.fail.RLE',
  TLE: 'verilog:problemDetail.fail.TLE',
  WA: 'verilog:problemDetail.fail.WA',
  NONE: 'verilog:problemDetail.fail.NONE',
  NA: 'verilog:problemDetail.fail.NA',
};

const VerilogProblemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, initialized } = useAuthStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [problem, setProblem] = useState<VerilogProblemDetailData | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<'verilog' | 'systemverilog'>('verilog');
  const [submitting, setSubmitting] = useState(false);
  const [activeSubmission, setActiveSubmission] = useState<VerilogSubmissionDetail | null>(null);
  const [history, setHistory] = useState<VerilogSubmissionListItem[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadProblem = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadErr(null);
    try {
      const p = await verilogService.getProblem(id);
      setProblem(p);
      setCode(p.template_code || '');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { message?: string }; status?: number } }).response?.data?.message
        : undefined;
      const status = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { status?: number } }).response?.status
        : undefined;
      setLoadErr(status === 404 ? t('verilog:problemDetail.errors.notFound') : (msg || t('verilog:problemDetail.errors.fetchFailed')));
      setProblem(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  const loadHistory = useCallback(async () => {
    if (!id || !isAuthenticated) {
      setHistory([]);
      return;
    }
    try {
      const res = await verilogService.listSubmissions({ problem_id: id, limit: 8, page: 1 });
      setHistory(res.submissions);
    } catch {
      setHistory([]);
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    void loadProblem();
  }, [loadProblem]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const pollSubmission = useCallback(
    (submissionId: string) => {
      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const sub = await verilogService.getSubmission(submissionId);
          setActiveSubmission(sub);
          if (sub.status === 'DONE' || sub.status === 'ERROR') {
            stopPoll();
            void loadHistory();
            if (sub.status === 'DONE') {
              toast.success(t('verilog:problemDetail.toasts.judged', { score: sub.total_grade, max: sub.max_grade }));
            } else {
              toast.error(t('verilog:problemDetail.toasts.judgeError'));
            }
          }
        } catch {
          stopPoll();
        }
      }, 1600);
    },
    [stopPoll, loadHistory, t],
  );

  const handleSubmit = async () => {
    if (!id || !problem) return;
    if (!initialized || !isAuthenticated) {
      toast.error(t('verilog:problemDetail.toasts.loginRequired'));
      navigate(ROUTER.USER.LOGIN);
      return;
    }
    if (!code.trim()) {
      toast.error(t('verilog:problemDetail.toasts.codeRequired'));
      return;
    }
    setSubmitting(true);
    setActiveSubmission(null);
    try {
      const res = await verilogService.submit({ problem_id: id, code, language });
      toast.success(res.message || t('verilog:problemDetail.toasts.received'));
      const pending: VerilogSubmissionDetail = {
        id: res.id,
        problem_id: id,
        user_id: '',
        code,
        language,
        status: 'PENDING',
        total_grade: 0,
        max_grade: problem.testcases?.reduce((s, t) => s + t.grade, 0) ?? 0,
        passed_count: 0,
        total_count: problem.testcases?.length ?? 0,
        overall_failure: 'NA',
        judge_log: null,
        judge_method: null,
        created_at: new Date().toISOString(),
      };
      setActiveSubmission(pending);
      try {
        const first = await verilogService.getSubmission(res.id);
        setActiveSubmission(first);
        if (first.status === 'DONE' || first.status === 'ERROR') {
          void loadHistory();
          if (first.status === 'DONE') {
            toast.success(t('verilog:problemDetail.toasts.judged', { score: first.total_grade, max: first.max_grade }));
          } else {
            toast.error(t('verilog:problemDetail.toasts.judgeError'));
          }
        } else {
          pollSubmission(res.id);
        }
      } catch {
        pollSubmission(res.id);
      }
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast.error(msg || t('verilog:problemDetail.toasts.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!id) {
    return <NavigateMissing />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (loadErr || !problem) {
    return (
      <div className="min-h-screen bg-[#020617] px-8 py-12 max-w-[900px] mx-auto text-slate-300">
        <p className="text-rose-400 mb-4">{loadErr}</p>
        <Link to={ROUTER.GUEST.VERILOG} className="text-cyan-400 hover:underline">
          ← {t('common:actions.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] font-sans text-slate-200 pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-16 w-[520px] h-[520px] bg-cyan-500/10 rounded-full blur-[130px]" />
        <div className="absolute top-1/4 -right-24 w-[460px] h-[460px] bg-blue-500/10 rounded-full blur-[130px]" />
      </div>
      <div className="max-w-[1100px] mx-auto px-6 pt-10">
        <Link
          to={ROUTER.GUEST.VERILOG}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common:actions.backToList')}
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div>
            <p className="text-slate-500 text-sm font-mono mb-1">#{problem.logic_id}</p>
            <h1 className="text-3xl font-black tracking-tight text-white">{problem.name}</h1>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="bg-white/10 border border-white/10 px-3 py-1 rounded-full text-sm text-slate-200">{t(`verilog:levels.${problem.level}`)}</span>
              {problem.deadline && (
                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-sm">
                  {t('verilog:problemDetail.deadline', { date: new Date(problem.deadline).toLocaleString('vi-VN') })}
                </span>
              )}
            </div>
          </div>
        </div>

        {problem.description && (
          <section className="mb-8 max-w-none">
            <h2 className="text-lg font-semibold mb-2 text-white">{t('verilog:problems')}</h2>
            <div className="whitespace-pre-wrap text-slate-300 text-sm leading-relaxed border border-white/10 rounded-xl p-4 bg-[#0f172a]/60">
              {problem.description}
            </div>
          </section>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {problem.description_input && (
            <section>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">{t('verilog:problemDetail.input')}</h3>
              <pre className="text-xs bg-[#0b1226] border border-white/10 text-slate-100 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap">
                {problem.description_input}
              </pre>
            </section>
          )}
          {problem.description_output && (
            <section>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">{t('verilog:problemDetail.output')}</h3>
              <pre className="text-xs bg-[#0b1226] border border-white/10 text-slate-100 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap">
                {problem.description_output}
              </pre>
            </section>
          )}
        </div>

        {problem.testcases && problem.testcases.length > 0 && (
          <section className="mb-8">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">{t('verilog:problemDetail.testsTitle')}</h3>
            <ul className="text-sm space-y-1">
              {problem.testcases.map((tc) => (
                <li key={tc.id} className="flex justify-between gap-4 border-b border-slate-100 py-2">
                  <span>{tc.name}</span>
                  <span className="text-slate-500">{t('verilog:problemDetail.points', { points: tc.grade })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-10">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-lg font-semibold text-white">{t('verilog:submit')}</h2>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'verilog' | 'systemverilog')}
              className="text-sm border border-white/10 rounded-lg px-2 py-1 bg-[#0f172a] text-slate-200"
              disabled={!isAuthenticated}
            >
              <option value="verilog">Verilog</option>
              <option value="systemverilog">SystemVerilog</option>
            </select>
          </div>
          {!isAuthenticated && (
            <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
              <Link to={ROUTER.USER.LOGIN} className="font-medium underline">{t('common:actions.login')}</Link>
              {' '}{t('verilog:problemDetail.loginHint')}
            </p>
          )}
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="w-full min-h-[280px] font-mono text-sm border border-white/10 bg-[#0b1226] text-slate-100 rounded-xl p-4 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 outline-none"
            placeholder={t('verilog:problemDetail.codePlaceholder')}
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !initialized}
            className="mt-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-[#020617] px-8 py-2.5 rounded-xl text-sm font-semibold"
          >
            {submitting ? t('common:status.loading') : t('verilog:submit')}
          </button>
        </section>

        {activeSubmission && (
          <section className="mb-10 border border-white/10 rounded-2xl p-6 bg-[#0f172a]/70">
            <h3 className="text-lg font-semibold mb-2 text-white">{t('verilog:result')}</h3>
            <SubmissionPanel submission={activeSubmission} />
          </section>
        )}

        {isAuthenticated && history.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold mb-3 text-white">{t('verilog:history')}</h3>
            <div className="overflow-x-auto border border-white/10 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-left text-slate-400">
                    <th className="px-3 py-2">{t('common:table.time')}</th>
                    <th className="px-3 py-2">{t('common:table.status')}</th>
                    <th className="px-3 py-2 text-right">{t('common:table.score')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-white/5">
                      <td className="px-3 py-2 text-slate-400">
                        {new Date(h.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-3 py-2">
                        {t(`verilog:submissions.statusCode.${h.status}`, { defaultValue: h.status })}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {h.total_grade} / {h.max_grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

function SubmissionPanel({ submission }: { submission: VerilogSubmissionDetail }) {
  const { t } = useTranslation();
  const done = submission.status === 'DONE' || submission.status === 'ERROR';
  const statusLabel = t(`verilog:submissions.statusCode.${submission.status}`, { defaultValue: submission.status });
  return (
    <div>
      <div className="flex flex-wrap gap-4 text-sm mb-4 text-slate-300">
        <span>
          {t('common:table.status')}: <strong>{statusLabel}</strong>
        </span>
        {done && (
          <>
            <span>
              {t('common:table.score')}: <strong>{submission.total_grade}</strong> / {submission.max_grade}
            </span>
            <span>
              {t('verilog:result')}: {t(FAIL_LABEL_KEY[submission.overall_failure] ?? submission.overall_failure)}
            </span>
          </>
        )}
      </div>
      {!done && (
        <p className="text-slate-400 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('verilog:submissions.status.judging')}
        </p>
      )}
      {submission.results && submission.results.length > 0 && (
        <table className="w-full text-xs mt-4 border border-white/10 rounded-lg overflow-hidden bg-[#0b1226]">
          <thead>
            <tr className="bg-white/5 text-slate-400">
              <th className="text-left px-2 py-2">{t('verilog:problemDetail.resultTable.test')}</th>
              <th className="text-left px-2 py-2">{t('verilog:problemDetail.resultTable.failure')}</th>
              <th className="text-right px-2 py-2">{t('common:table.score')}</th>
            </tr>
          </thead>
          <tbody>
            {submission.results
              .slice()
              .sort((a, b) => (a.testcase?.order_index ?? 0) - (b.testcase?.order_index ?? 0))
              .map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-2 py-2">{r.testcase?.name ?? r.testcase_id}</td>
                  <td className="px-2 py-2">{t(FAIL_LABEL_KEY[r.possible_failure] ?? r.possible_failure)}</td>
                  <td className="px-2 py-2 text-right">{r.grade}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      {submission.judge_log && done && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-slate-400">{t('verilog:problemDetail.judgeLog')}</summary>
          <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
            {submission.judge_log}
          </pre>
        </details>
      )}
    </div>
  );
}

function NavigateMissing() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-600">{t('verilog:problemDetail.errors.missingProblemId')}</p>
    </div>
  );
}

export default VerilogProblemDetailPage;
