import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Coins,
  Download,
  Loader2,
  RefreshCw,
  Lock,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../store/authStore';
import {
  rewardService,
  parseExportFilename,
  type RewardSheetData,
  type RewardSheetDetailRow,
} from '../../../services/reward.service';
import { realtimeService } from '../../../services/realtime.service';
import type { AxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { translateApiMessage } from '../../../utils/apiErrorI18n';

type PenaltyMeta = {
  late_reports?: { week?: number; due?: string }[];
  late_tasks?: { id?: string; title?: string; due?: string }[];
  pre_tax?: number;
  tax_amount?: number;
  is_kicked?: boolean;
  info?: string;
  sources?: { name: string; amount: number }[];
};

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function effectivePayout(d: RewardSheetDetailRow): number {
  if (d.is_overridden && d.final_override_amount !== null && d.final_override_amount !== undefined) {
    return num(d.final_override_amount);
  }
  return num(d.calculated_amount);
}

function parseMeta(raw: string | null | undefined): PenaltyMeta {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PenaltyMeta;
  } catch {
    return {};
  }
}

function errMessage(err: unknown, fallback: string, t: TFunction): string {
  const ax = err as AxiosError<{ message?: string }>;
  const raw = ax.response?.data?.message;
  if (typeof raw === 'string' && raw.trim()) return translateApiMessage(t, raw);
  return fallback;
}

const RewardsTab: React.FC<{ projectId: string; projectBudget: number | null | undefined }> = ({
  projectId,
  projectBudget,
}) => {
  const { t } = useTranslation('projects');
  const { user } = useAuthStore();
  const role = user?.system_role ?? '';
  const isVienTruong = role === 'vien_truong';
  const canExport = ['vien_truong', 'truong_lab', 'member'].includes(role);

  const [sheet, setSheet] = useState<RewardSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [overrideDraft, setOverrideDraft] = useState<Record<string, string>>({});
  const [appealOpenId, setAppealOpenId] = useState<string | null>(null);
  const [appealText, setAppealText] = useState('');
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await rewardService.getByProject(projectId);
      setSheet(data);
    } catch (err: unknown) {
      const ax = err as AxiosError<{ message?: string }>;
      if (ax.response?.status === 404) {
        setSheet(null);
        setNotFound(true);
      } else {
        toast.error(errMessage(err, t('detail.rewards.errors.load'), t));
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const socket = realtimeService.connect();
    realtimeService.subscribeProject(projectId);
    const unsubProjectUpdate = realtimeService.onProjectUpdate((payload: unknown) => {
      const updateType = (payload as { type?: string })?.type;
      const incomingProjectId = (payload as { projectId?: string })?.projectId;
      if (incomingProjectId && incomingProjectId !== projectId) return;
      if (
        !updateType ||
        ![
          'reward_recalculated',
          'reward_override_updated',
          'reward_finalized',
          'reward_appeal_created',
          'reward_appeal_resolved',
          'reward_imported',
          'project_updated',
        ].includes(updateType)
      ) {
        return;
      }
      void load();
    });
    return () => {
      unsubProjectUpdate();
      socket.off('connect');
    };
  }, [projectId, load]);

  useEffect(() => {
    if (!finalizeModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [finalizeModalOpen]);

  const totals = useMemo(() => {
    if (!sheet?.details?.length) return { payout: 0, count: 0 };
    let payout = 0;
    for (const d of sheet.details) payout += effectivePayout(d);
    return { payout: Math.round(payout), count: sheet.details.length };
  }, [sheet]);

  const budgetNum = projectBudget != null ? Math.round(Number(projectBudget)) : num(sheet?.total_budget);

  const onRecalculate = async () => {
    setBusy('recalc');
    try {
      const data = await rewardService.recalculate(projectId);
      setSheet(data);
      setNotFound(false);
      toast.success(t('detail.rewards.success.recalculated'));
    } catch (err: unknown) {
      toast.error(errMessage(err, t('detail.rewards.errors.recalculate'), t));
    } finally {
      setBusy(null);
    }
  };

  const closeFinalizeModal = () => {
    if (busy === 'finalize') return;
    setFinalizeModalOpen(false);
  };

  const runFinalize = async () => {
    setBusy('finalize');
    try {
      const data = await rewardService.finalize(projectId);
      setSheet(data);
      toast.success(t('detail.rewards.success.finalized'));
      setFinalizeModalOpen(false);
    } catch (err: unknown) {
      toast.error(errMessage(err, t('detail.rewards.errors.finalize'), t));
    } finally {
      setBusy(null);
    }
  };

  const onSaveOverride = async (detailId: string) => {
    const raw = overrideDraft[detailId]?.trim();
    let value: number | null = null;
    if (raw !== undefined && raw !== '') {
      const n = Number(raw.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, ''));
      if (!Number.isFinite(n)) {
        toast.error(t('detail.rewards.errors.invalidAmount'));
        return;
      }
      value = n;
    }
    setBusy(`ov-${detailId}`);
    try {
      await rewardService.updateOverride(detailId, value);
      toast.success(t('detail.rewards.success.override'));
      await load();
    } catch (err: unknown) {
      toast.error(errMessage(err, t('detail.rewards.errors.override'), t));
    } finally {
      setBusy(null);
    }
  };

  const onExport = async () => {
    setBusy('export');
    try {
      const res = await rewardService.exportExcel(projectId);
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const name =
        parseExportFilename(res.headers['content-disposition']) || `BangTinhThuong_${projectId}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('detail.rewards.success.export'));
    } catch (err: unknown) {
      toast.error(errMessage(err, t('detail.rewards.errors.export'), t));
    } finally {
      setBusy(null);
    }
  };

  const onImportPick = () => fileRef.current?.click();

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('import');
    try {
      const r = await rewardService.importExcel(projectId, file);
      toast.success(t('detail.rewards.success.import', { count: r.successCount }));
      await load();
    } catch (err: unknown) {
      toast.error(errMessage(err, t('detail.rewards.errors.import'), t));
    } finally {
      setBusy(null);
    }
  };

  const onAppeal = async (detailId: string) => {
    const reason = appealText.trim();
    if (!reason) {
      toast.error(t('detail.rewards.errors.appealReason'));
      return;
    }
    setBusy(`ap-${detailId}`);
    try {
      await rewardService.appeal(detailId, reason);
      setAppealOpenId(null);
      setAppealText('');
      toast.success(t('detail.rewards.success.appeal'));
      await load();
    } catch (err: unknown) {
      toast.error(errMessage(err, t('detail.rewards.errors.appeal'), t));
    } finally {
      setBusy(null);
    }
  };

  const onResolve = async (detailId: string, resolutionStatus: 'RESOLVED' | 'REJECTED') => {
    setBusy(`rs-${detailId}`);
    try {
      await rewardService.resolveAppeal(detailId, resolutionStatus);
      toast.success(t('detail.rewards.success.resolve'));
      await load();
    } catch (err: unknown) {
      toast.error(errMessage(err, t('detail.rewards.errors.resolve'), t));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
        <p className="text-[10px] font-black uppercase tracking-widest">{t('detail.rewards.loading')}</p>
      </div>
    );
  }

  if (notFound && !sheet) {
    return (
      <div className="rounded-[32px] border border-white/5 bg-[#0F1219]/80 backdrop-blur-xl p-10 text-center space-y-6">
        <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase italic text-white tracking-tight mb-2">
            {t('detail.rewards.emptyTitle')}
          </h2>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">{t('detail.rewards.emptyHint')}</p>
        </div>
        {isVienTruong ? (
          <button
            type="button"
            disabled={busy === 'recalc'}
            onClick={() => void onRecalculate()}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-cyan-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-cyan-400 disabled:opacity-50"
          >
            {busy === 'recalc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {t('detail.rewards.runCalculation')}
          </button>
        ) : (
          <p className="text-xs text-slate-600">{t('detail.rewards.waitDirector')}</p>
        )}
      </div>
    );
  }

  if (!sheet) return null;

  const finalized = sheet.status === 'FINALIZED';
  const details = sheet.details ?? [];
  const colCount = isVienTruong ? 10 : 8; // Đã cập nhật lại tổng số cột

  return (
    <div className="space-y-8">
      {/* HEADER BẢNG LƯƠNG */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Coins className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter">
              {t('detail.rewards.title')}
            </h2>
            <p className="text-sm text-slate-500 mt-1">{t('detail.rewards.subtitle')}</p>
            <div className="flex flex-wrap gap-3 mt-4 text-[10px] font-black uppercase tracking-widest">
              <span
                className={`px-3 py-1.5 rounded-full border ${
                  finalized
                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}
              >
                {finalized ? t('detail.rewards.status.finalized') : t('detail.rewards.status.draft')}
              </span>
              <span className="px-3 py-1.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                {t('detail.rewards.budget')}: {budgetNum.toLocaleString('vi-VN')} {t('detail.currency')}
              </span>
              {isVienTruong && (
                <span className="px-3 py-1.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                  {t('detail.rewards.payout')}: {totals.payout.toLocaleString('vi-VN')} / {details.length}{' '}
                  {t('detail.rewards.rows')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canExport && (
            <button
              type="button"
              disabled={busy === 'export'}
              onClick={() => void onExport()}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 disabled:opacity-50"
            >
              {busy === 'export' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {t('detail.rewards.export')}
            </button>
          )}
          {isVienTruong && !finalized && (
            <>
              <button
                type="button"
                disabled={busy === 'recalc'}
                onClick={() => void onRecalculate()}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-[10px] font-black uppercase tracking-widest text-cyan-300 disabled:opacity-50"
              >
                {busy === 'recalc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {t('detail.rewards.recalculate')}
              </button>
              <button
                type="button"
                disabled={busy === 'import'}
                onClick={onImportPick}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-[10px] font-black uppercase tracking-widest text-violet-300 disabled:opacity-50"
              >
                {busy === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {t('detail.rewards.import')}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => void onImportFile(e)}
              />
              <button
                type="button"
                disabled={busy === 'finalize'}
                onClick={() => setFinalizeModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {busy === 'finalize' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {t('detail.rewards.finalize')}
              </button>
            </>
          )}
        </div>
      </div>

      {finalized && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 text-sm text-blue-200/90 flex items-center gap-3">
          <Lock className="w-5 h-5 shrink-0" />
          <span>{t('detail.rewards.finalizedNotice')}</span>
        </div>
      )}

      {/* BẢNG DỮ LIỆU */}
      <div className="rounded-[28px] border border-white/5 bg-[#0F1219]/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-5 py-4">{t('detail.rewards.cols.member')}</th>
                <th className="px-3 py-4">{t('detail.rewards.cols.role')}</th>
                <th className="px-3 py-4">{t('detail.rewards.cols.grade')}</th>
                <th className="px-3 py-4 text-center">{t('detail.rewards.cols.lateTasks')}</th>
                <th className="px-3 py-4 text-right">{t('detail.rewards.cols.auto')}</th>
                {isVienTruong && <th className="px-3 py-4 text-right">{t('detail.rewards.cols.override')}</th>}
                <th className="px-3 py-4 text-right">{t('detail.rewards.cols.final')}</th>
                <th className="px-3 py-4">APPEAL</th>
                {isVienTruong && <th className="px-3 py-4 text-center">RESOLVE</th>}
                <th className="px-5 py-4 text-center">EXPLAINATION</th>
              </tr>
            </thead>
            <tbody>
              {details.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-5 py-16 text-center text-slate-500">
                    {t('detail.rewards.noRows')}
                  </td>
                </tr>
              ) : (
                details.map((row) => {
                  const meta = parseMeta(row.penalty_metadata);
                  const exp = expanded[row.id];
                  const ovKey = row.id;
                  const draft = overrideDraft[ovKey] ?? (row.final_override_amount != null ? String(num(row.final_override_amount)) : '');
                  
                  // Quyền khiếu nại
                  const canAppealOwn = !finalized && row.user_id === user?.id && ['member', 'truong_lab'].includes(role) && row.appeal_status === 'NONE';
                  const appealPending = row.appeal_status === 'PENDING';

                  return (
                    <React.Fragment key={row.id}>
                      {/* DÒNG DỮ LIỆU CHÍNH */}
                      <tr className={`border-b border-white/5 hover:bg-white/[0.02] ${meta.is_kicked ? 'opacity-50 bg-red-900/10' : ''}`}>
                        <td className="px-5 py-4">
                          <div className="font-bold text-white flex items-center gap-2">
                            {row.user?.full_name ?? '—'}
                            {meta.is_kicked && <span className="px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider bg-red-500 text-white">Bị loại</span>}
                          </div>
                          <div className="text-[11px] text-slate-500">{row.user?.email}</div>
                        </td>
                        <td className="px-3 py-4 text-slate-400 uppercase text-[11px] font-bold">{row.role}</td>
                        <td className="px-3 py-4">
                          <span className="text-cyan-400 font-mono font-bold">{row.report_grade ?? '—'}</span>
                        </td>
                        <td className="px-3 py-4 text-center text-slate-300">{row.late_task_count}</td>
                        <td className="px-3 py-4 text-right font-mono text-slate-300">
                          {num(row.calculated_amount).toLocaleString('vi-VN')}
                        </td>
                        
                        {/* Cột OVERRIDE (Viện trưởng) */}
                        {isVienTruong && (
                          <td className="px-3 py-4 text-right">
                            {!finalized ? (
                              <div className="flex flex-col items-end gap-1">
                                <input
                                  value={draft}
                                  onChange={(e) => setOverrideDraft((s) => ({ ...s, [ovKey]: e.target.value }))}
                                  placeholder="—"
                                  className={`w-28 bg-black/40 border ${row.is_overridden ? 'border-amber-500/50 text-amber-300' : 'border-white/10 text-white'} rounded-lg px-2 py-1.5 text-right font-mono text-xs`}
                                />
                                <button
                                  type="button"
                                  disabled={busy === `ov-${row.id}`}
                                  onClick={() => void onSaveOverride(row.id)}
                                  className="text-[9px] font-black uppercase text-cyan-400 hover:text-cyan-300"
                                >
                                  {t('detail.rewards.saveOverride')}
                                </button>
                              </div>
                            ) : (
                              <span className={`font-mono ${row.is_overridden ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                                {row.final_override_amount != null ? num(row.final_override_amount).toLocaleString('vi-VN') : '—'}
                              </span>
                            )}
                          </td>
                        )}

                        {/* Cột PAYOUT */}
                        <td className="px-3 py-4 text-right font-mono font-bold text-emerald-400">
                          {effectivePayout(row).toLocaleString('vi-VN')}
                        </td>

                        {/* Cột APPEAL */}
                        <td className="px-3 py-4">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                              appealPending ? 'bg-amber-500/10 text-amber-400'
                                : row.appeal_status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400'
                                : row.appeal_status === 'REJECTED' ? 'bg-red-500/10 text-red-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {row.appeal_status}
                          </span>
                          {appealPending && row.appeal_reason && (
                            <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 italic border-l-2 border-slate-700 pl-2">{row.appeal_reason}</p>
                          )}
                          {/* Nút Khiếu nại */}
                          {canAppealOwn && appealOpenId !== row.id && (
                            <button
                              type="button"
                              onClick={() => { setAppealOpenId(row.id); setAppealText(''); }}
                              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase transition-all"
                            >
                              <span>⚠️</span> Khiếu nại
                            </button>
                          )}
                        </td>

                        {/* Cột RESOLVE (Dành cho Viện Trưởng) */}
                        {isVienTruong && (
                          <td className="px-3 py-4 text-center">
                            {appealPending && !finalized && (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button" disabled={busy === `rs-${row.id}`}
                                  onClick={() => void onResolve(row.id, 'RESOLVED')}
                                  className="px-2 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 text-[9px] font-black uppercase transition"
                                >Duyệt</button>
                                <button
                                  type="button" disabled={busy === `rs-${row.id}`}
                                  onClick={() => void onResolve(row.id, 'REJECTED')}
                                  className="px-2 py-1 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-300 text-[9px] font-black uppercase transition"
                                >Bác bỏ</button>
                              </div>
                            )}
                          </td>
                        )}

                        {/* Cột GIẢI TRÌNH */}
                        <td className="px-5 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setExpanded((s) => ({ ...s, [row.id]: !exp }))}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${exp ? 'bg-slate-700 text-white' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400'}`}
                          >
                            <span>ℹ️</span> {exp ? 'CLOSE' : 'EXPLAIN'}
                          </button>
                        </td>
                      </tr>

                      {/* DÒNG EXPANDED: CHI TIẾT GIẢI TRÌNH VÀ FORM KHIẾU NẠI */}
                      {(exp || appealOpenId === row.id) && (
                        <tr className="bg-black/40 border-b border-white/5">
                          <td colSpan={colCount} className="px-8 py-6">
                            
                            {/* === GIAO DIỆN GIẢI TRÌNH === */}
                            {exp && (
                              <div className="mb-6">
                                <div className="grid md:grid-cols-3 gap-4 mb-6 pb-6 border-b border-white/5">
                                  <div>
                                    <p className="text-[9px] font-black uppercase text-slate-600 mb-1">Principal amount before Tax/Penalty</p>
                                    <p className="font-mono text-slate-300 text-sm">{(meta.pre_tax ?? 0).toLocaleString('vi-VN')} đ</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black uppercase text-orange-600/70 mb-1">Personal income tax (10%)</p>
                                    <p className="font-mono text-orange-400/80 text-sm">-{(meta.tax_amount ?? 0).toLocaleString('vi-VN')} đ</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black uppercase text-red-600/70 mb-1">Deduction for Violations (Penalties)</p>
                                    <p className="font-mono text-red-400/80 text-sm">-{num(row.penalty_amount).toLocaleString('vi-VN')} đ</p>
                                  </div>
                                </div>

                                {meta.info ? (
                                  <div className="bg-blue-500/5 border border-blue-500/20 p-5 rounded-2xl">
                                    <div className="font-bold flex items-center gap-2 mb-2 text-blue-300"><span>💰</span> Nguồn gốc thu nhập:</div>
                                    <p className="text-sm mb-4 text-blue-200/70 italic">{meta.info}</p>
                                    {meta.sources && meta.sources.length > 0 && (
                                      <ul className="space-y-3 border-t border-blue-500/20 pt-4">
                                        {meta.sources.map((s, i) => (
                                          <li key={i} className="flex justify-between items-center text-sm">
                                            <span className="text-blue-300/70">Từ sinh viên: <b className="text-blue-300">{s.name}</b></span>
                                            <span className="font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">+{s.amount.toLocaleString('vi-VN')} đ</span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    {(!meta.late_reports?.length && !meta.late_tasks?.length) ? (
                                      <div className="text-center py-8 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                                        <div className="text-4xl mb-3">🎉</div>
                                        <p className="text-emerald-400 font-bold text-lg">GREAT!</p>
                                        <p className="text-emerald-500/70 text-sm mt-1">You have not violated any Tasks or Reports in this project.</p>
                                      </div>
                                    ) : (
                                      <div className="grid md:grid-cols-2 gap-8">
                                        {meta.late_reports && meta.late_reports.length > 0 && (
                                          <div className="bg-red-500/5 p-5 rounded-2xl border border-red-500/10">
                                            <h4 className="font-bold text-red-400 border-b border-red-500/20 pb-3 mb-4 flex items-center gap-2"><span>📄</span> Late Reports ({meta.late_reports.length})</h4>
                                            <ul className="list-disc list-inside space-y-2 text-slate-400 text-sm">
                                              {meta.late_reports.map((r, i) => (
                                                <li key={i}>
                                                  <span className="font-semibold text-slate-300">Report Week {r.week}</span>
                                                  <span className="text-xs text-slate-500 ml-2 italic">(Due: {new Date(r.due!).toLocaleDateString('vi-VN')})</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {meta.late_tasks && meta.late_tasks.length > 0 && (
                                          <div className="bg-red-500/5 p-5 rounded-2xl border border-red-500/10">
                                            <h4 className="font-bold text-red-400 border-b border-red-500/20 pb-3 mb-4 flex items-center gap-2"><span>✅</span> Late Tasks ({meta.late_tasks.length})</h4>
                                            <ul className="list-disc list-inside space-y-2 text-slate-400 text-sm">
                                              {meta.late_tasks.map((t, i) => (
                                                <li key={i}>
                                                  <span className="font-semibold text-slate-300">{t.title}</span>
                                                  <span className="text-xs text-slate-500 ml-2 italic">(Due: {new Date(t.due!).toLocaleDateString('vi-VN')})</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}

                            {/* === GIAO DIỆN KHU VỰC NHẬP LÝ DO KHIẾU NẠI === */}
                            {appealOpenId === row.id && (
                              <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl">
                                <h4 className="text-amber-400 font-bold mb-3 flex items-center gap-2"><span>⚠️</span> Send Appeal</h4>
                                <textarea
                                  value={appealText}
                                  onChange={(e) => setAppealText(e.target.value)}
                                  rows={3}
                                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 mb-4 focus:border-amber-500/50 outline-none transition-colors"
                                  placeholder={t('detail.rewards.appealPlaceholder')}
                                />
                                <div className="flex gap-3">
                                  <button
                                    type="button" disabled={busy === `ap-${row.id}`}
                                    onClick={() => void onAppeal(row.id)}
                                    className="px-5 py-2.5 rounded-xl bg-amber-500 text-black text-[11px] font-black uppercase hover:bg-amber-400 transition"
                                  >
                                    {t('detail.rewards.sendAppeal')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setAppealOpenId(null); setAppealText(''); }}
                                    className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] font-black uppercase text-slate-400 transition"
                                  >
                                    {t('detail.rewards.cancelAppeal')}
                                  </button>
                                </div>
                              </div>
                            )}

                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {finalizeModalOpen && (
              <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" role="presentation">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-[#0B0E14]/80 backdrop-blur-sm"
                  onClick={closeFinalizeModal}
                  aria-hidden
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="finalize-reward-title"
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-md rounded-[28px] border border-emerald-500/20 bg-[#0F1219] p-8 shadow-2xl"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                    <Lock size={24} />
                  </div>
                  <h3 id="finalize-reward-title" className="text-lg font-black uppercase tracking-widest text-white">
                    {t('detail.rewards.finalizeModal.title')}
                  </h3>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    {t('detail.rewards.finalizeModal.description')}
                  </p>
                  <div className="mt-8 flex gap-3">
                    <button
                      type="button"
                      onClick={closeFinalizeModal}
                      disabled={busy === 'finalize'}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                      {t('detail.rewards.finalizeModal.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void runFinalize()}
                      disabled={busy === 'finalize'}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-emerald-600 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {busy === 'finalize' ? (
                        <Loader2 className="h-[18px] w-[18px] animate-spin" />
                      ) : (
                        t('detail.rewards.finalizeModal.confirm')
                      )}
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

export default RewardsTab;