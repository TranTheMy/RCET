import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, ChevronLeft, FileSignature, Loader2, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { scientistApplicationService } from '../../services/scientistApplication.service';
import type { ScientistApplicationItem } from '../../types';
import { ROUTER } from '../../routes/router';
import { useTranslation } from 'react-i18next';

function todayInputDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const inputClass =
  'w-full bg-black/35 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40';

const labelClass = 'block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5';

const ScientistContractPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loadingApp, setLoadingApp] = useState(true);
  const [row, setRow] = useState<ScientistApplicationItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [partyAName, setPartyAName] = useState('');
  const [partyATitle, setPartyATitle] = useState('');
  const [partyAWorkUnit, setPartyAWorkUnit] = useState('');
  const [partyAAddress, setPartyAAddress] = useState('');
  const [partyAEmail, setPartyAEmail] = useState('');
  const [partyAPhone, setPartyAPhone] = useState('');

  const [partyBName, setPartyBName] = useState('');
  const [partyBStudentId, setPartyBStudentId] = useState('');
  const [partyBFaculty, setPartyBFaculty] = useState('');
  const [partyBAddress, setPartyBAddress] = useState('');
  const [partyBEmail, setPartyBEmail] = useState('');
  const [partyBPhone, setPartyBPhone] = useState('');

  const [contractDate, setContractDate] = useState(todayInputDate);
  const [contractLocation, setContractLocation] = useState('');
  const [contractSummary, setContractSummary] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoadingApp(true);
    try {
      const res = await scientistApplicationService.getOne(id);
      const app = res.data ?? null;
      setRow(app);
      if (app) {
        setPartyBName(app.fullName || '');
        setPartyBEmail(app.email || '');
        setPartyBPhone(app.phone || '');
        setContractSummary(
          t('user:cv.contract.defaultSummary', { position: app.position }),
        );
      }
    } catch {
      toast.error(t('user:cv.contract.toasts.fetchFailed'));
      setRow(null);
    } finally {
      setLoadingApp(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!row || loadingApp) return;
    if (row.status !== 'approved') {
      toast.error(t('user:cv.contract.toasts.notApproved'));
      navigate(ROUTER.USER.CV_APPROVALS, { replace: true });
      return;
    }
    if (row.contractCreatedAt) {
      toast.error(t('user:cv.contract.toasts.alreadyHasContract'));
      navigate(ROUTER.USER.CV_APPROVALS, { replace: true });
    }
  }, [row, loadingApp, navigate, t]);

  const canSubmit = useMemo(() => {
    return (
      partyAName.trim() &&
      partyAWorkUnit.trim() &&
      partyAEmail.trim() &&
      partyBName.trim() &&
      partyBEmail.trim() &&
      contractSummary.trim()
    );
  }, [partyAName, partyAWorkUnit, partyAEmail, partyBName, partyBEmail, contractSummary]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !canSubmit) {
      if (!contractSummary.trim()) toast.error(t('user:cv.contract.toasts.summaryRequired'));
      else toast.error(t('user:cv.contract.toasts.requiredFields'));
      return;
    }
    setSubmitting(true);
    try {
      await scientistApplicationService.generateContractFromTemplate(id, {
        partyAName: partyAName.trim(),
        partyAEmail: partyAEmail.trim(),
        partyAPhone: partyAPhone.trim() || undefined,
        partyAAddress: partyAAddress.trim() || undefined,
        partyATitle: partyATitle.trim() || undefined,
        partyAWorkUnit: partyAWorkUnit.trim(),
        partyBName: partyBName.trim(),
        partyBEmail: partyBEmail.trim(),
        partyBPhone: partyBPhone.trim() || undefined,
        partyBAddress: partyBAddress.trim() || undefined,
        partyBStudentId: partyBStudentId.trim() || undefined,
        partyBFaculty: partyBFaculty.trim() || undefined,
        contractDate: contractDate.trim() || undefined,
        contractLocation: contractLocation.trim() || undefined,
        contractSummary: contractSummary.trim(),
      });
      toast.success(t('user:cv.contract.toasts.created'));
      navigate(ROUTER.USER.CV_APPROVALS, { replace: true });
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || t('user:cv.contract.toasts.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen text-slate-200 pb-24 pt-6 md:pt-10 px-4 md:px-8"
      style={{
        background:
          'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(34,211,238,0.08), transparent), #020617',
      }}
    >
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-4 mb-8 pb-6 border-b border-white/[0.07]">
          <Link
            to={ROUTER.USER.CV_APPROVALS}
            className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-cyan-500/35 transition-all shrink-0"
            aria-label={t('user:cv.contract.actions.backAria')}
          >
            <ChevronLeft size={20} className="text-cyan-400" />
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <FileSignature className="text-cyan-400" size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-black text-white uppercase tracking-tight truncate">
                {t('user:cv.contract.title')}
              </h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                {t('user:cv.contract.subtitle')}
              </p>
            </div>
          </div>
        </header>

        {loadingApp ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
          </div>
        ) : !row ? (
          <p className="text-center text-slate-500 py-16 text-sm">{t('user:cv.contract.empty')}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-8">
            <p className="text-sm text-slate-400 leading-relaxed rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              {t('user:cv.contract.notice')}
            </p>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-6 ring-1 ring-white/[0.05]">
              <div className="flex items-center gap-2 mb-5">
                <Building2 className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white">{t('user:cv.contract.partyA.title')}</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t('user:cv.contract.partyA.name')}</label>
                  <input className={inputClass} value={partyAName} onChange={(e) => setPartyAName(e.target.value)} required placeholder={t('user:cv.contract.partyA.namePlaceholder')} />
                </div>
                <div>
                  <label className={labelClass}>{t('user:cv.contract.partyA.titleLabel')}</label>
                  <input className={inputClass} value={partyATitle} onChange={(e) => setPartyATitle(e.target.value)} placeholder={t('user:cv.contract.partyA.titlePlaceholder')} />
                </div>
                <div>
                  <label className={labelClass}>{t('user:cv.contract.partyA.workUnit')}</label>
                  <input className={inputClass} value={partyAWorkUnit} onChange={(e) => setPartyAWorkUnit(e.target.value)} required placeholder={t('user:cv.contract.partyA.workUnitPlaceholder')} />
                </div>
                <div>
                  <label className={labelClass}>{t('user:cv.contract.partyA.email')}</label>
                  <input className={inputClass} type="email" value={partyAEmail} onChange={(e) => setPartyAEmail(e.target.value)} required />
                </div>
                <div>
                  <label className={labelClass}>{t('user:cv.contract.partyA.phone')}</label>
                  <input className={inputClass} value={partyAPhone} onChange={(e) => setPartyAPhone(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t('user:cv.contract.partyA.address')}</label>
                  <input className={inputClass} value={partyAAddress} onChange={(e) => setPartyAAddress(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-6 ring-1 ring-white/[0.05]">
              <div className="flex items-center gap-2 mb-5">
                <User className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white">{t('user:cv.contract.partyB.title')}</h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">{t('user:cv.contract.partyB.hint')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t('user:cv.contract.partyB.name')}</label>
                  <input className={inputClass} value={partyBName} onChange={(e) => setPartyBName(e.target.value)} required />
                </div>
                <div>
                  <label className={labelClass}>{t('user:cv.contract.partyB.studentId')}</label>
                  <input className={inputClass} value={partyBStudentId} onChange={(e) => setPartyBStudentId(e.target.value)} placeholder={t('user:cv.contract.partyB.studentIdPlaceholder')} />
                </div>
                <div>
                  <label className={labelClass}>{t('user:cv.contract.partyB.faculty')}</label>
                  <input className={inputClass} value={partyBFaculty} onChange={(e) => setPartyBFaculty(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>{t('user:cv.contract.partyB.email')}</label>
                  <input className={inputClass} type="email" value={partyBEmail} onChange={(e) => setPartyBEmail(e.target.value)} required />
                </div>
                <div>
                  <label className={labelClass}>{t('user:cv.contract.partyB.phone')}</label>
                  <input className={inputClass} value={partyBPhone} onChange={(e) => setPartyBPhone(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t('user:cv.contract.partyB.address')}</label>
                  <input className={inputClass} value={partyBAddress} onChange={(e) => setPartyBAddress(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-6 ring-1 ring-white/[0.05]">
              <h2 className="text-sm font-black uppercase tracking-widest text-white mb-4">{t('user:cv.contract.meta.title')}</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>{t('user:cv.contract.meta.date')}</label>
                  <input className={inputClass} type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>{t('user:cv.contract.meta.location')}</label>
                  <input
                    className={inputClass}
                    value={contractLocation}
                    onChange={(e) => setContractLocation(e.target.value)}
                    placeholder={t('user:cv.contract.meta.locationPlaceholder')}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t('user:cv.contract.meta.summary')}</label>
                  <textarea
                    value={contractSummary}
                    onChange={(e) => setContractSummary(e.target.value)}
                    rows={5}
                    className={`${inputClass} min-h-[120px] resize-y`}
                    required
                    placeholder={t('user:cv.contract.meta.summaryPlaceholder')}
                  />
                </div>
              </div>
            </section>

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-2">
              <Link
                to={ROUTER.USER.CV_APPROVALS}
                className="py-3.5 px-6 rounded-xl border border-white/15 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/5"
              >
                {t('common:actions.cancel')}
              </Link>
              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="py-3.5 px-8 rounded-xl bg-cyan-400 text-[#020617] text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-500/25 hover:bg-cyan-300 disabled:opacity-45 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {submitting ? t('user:cv.contract.actions.creating') : t('user:cv.contract.actions.saveCreate')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ScientistContractPage;
