import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Phone, MapPin, Send, Network, CircuitBoard, Activity, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../config/api';
import { translateApiMessage } from '../utils/apiErrorI18n';

function useOnClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onOutside: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      const el = ref.current;
      if (el && !el.contains(target)) onOutside();
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [enabled, onOutside, ref]);
}

const ContactComponent: React.FC = () => {
  const { t } = useTranslation();
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const stackOptions = useMemo(() => {
    const keys = [
      'common:contact.stackOptions.0',
      'common:contact.stackOptions.1',
      'common:contact.stackOptions.2',
      'common:contact.stackOptions.3',
    ] as const;
    return keys.map((k) => t(k));
  }, [t]);

  // Store index (stable across language changes) instead of translated string.
  const [stackIndex, setStackIndex] = useState(0);
  const [stackOpen, setStackOpen] = useState(false);
  const stackWrapRef = useRef<HTMLDivElement | null>(null);

  const stackValue = stackOptions[stackIndex] ?? stackOptions[0] ?? '';

  useOnClickOutside(stackWrapRef, () => setStackOpen(false), stackOpen);

  const locationTags = useMemo(
    () => [
      t('common:contact.location.tags.0'),
      t('common:contact.location.tags.1'),
      t('common:contact.location.tags.2'),
    ],
    [t],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const payload = {
      org: org.trim(),
      email: email.trim(),
      stack: stackValue,
      summary: summary.trim(),
    };
    if (!payload.org || !payload.email || !payload.summary) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/public/contact-contract', payload);
      if (data?.success) {
        toast.success(data.message || 'Đã gửi đề xuất thành công');
        setOrg('');
        setEmail('');
        setSummary('');
        setStackIndex(0);
      } else {
        toast.error(
          translateApiMessage(t, data?.message as string | undefined) ||
            'Không thể gửi đề xuất lúc này',
        );
      }
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg =
        translateApiMessage(t, typeof raw === 'string' ? raw : '') || 'Lỗi kết nối. Vui lòng thử lại.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white font-sans text-slate-800 py-16 overflow-x-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-8">
        
        {/* HEADER: HUB SYSTEM STATUS */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-[#6366F1] animate-pulse" />
                <span className="text-[#6366F1] font-black text-[10px] uppercase tracking-[0.4em]">{t('common:contact.kicker')}</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-[#0F172A] italic uppercase tracking-tighter leading-none">
                {t('common:contact.titlePrefix')}{' '}
                <span className="text-[#6366F1]">{t('common:contact.titleHighlight')}</span>
            </h2>
          </div>
          <div className="hidden md:block h-[1px] flex-1 bg-slate-100 mx-10 mb-2" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[200px] leading-tight">
              {t('common:contact.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* BÊN TRÁI: RESEARCH PROPOSAL FORM */}
          <div className="lg:col-span-6 bg-[#0F172A] p-10 rounded-[48px] shadow-2xl relative overflow-hidden border border-slate-800 group h-full">
            {/* Background Tech Gradients */}
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_90%_10%,#6366F115,transparent_40%)]" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-2xl bg-[#6366F1]/20 flex items-center justify-center border border-[#6366F1]/30">
                  <CircuitBoard size={20} className="text-[#6366F1]" />
                </div>
                <div>
                  <h3 className="text-white font-black text-sm uppercase tracking-widest">{t('common:contact.form.title')}</h3>
                  <p className="text-slate-500 text-[9px] uppercase tracking-[0.2em] mt-1">{t('common:contact.form.kicker')}</p>
                </div>
              </div>
              
              <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('common:contact.form.fields.org')}</label>
                  <input
                    type="text"
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    placeholder={t('common:contact.form.placeholders.org')}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs text-white focus:ring-2 focus:ring-[#6366F1]/50 outline-none transition-all"
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('common:contact.form.fields.email')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('common:contact.form.placeholders.email')}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs text-white focus:ring-2 focus:ring-[#6366F1]/50 outline-none transition-all"
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('common:contact.form.fields.stack')}</label>
                  <div ref={stackWrapRef} className="relative w-full">
                    <input type="hidden" name="technology_stack_interest" value={stackValue} />
                    <button
                      type="button"
                      onClick={() => setStackOpen((v) => !v)}
                      aria-haspopup="listbox"
                      aria-expanded={stackOpen}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs text-white focus:text-white focus:ring-2 focus:ring-[#6366F1]/50 outline-none transition-all appearance-none cursor-pointer flex items-center justify-between gap-3"
                    >
                      <span className="truncate">{stackValue}</span>
                      <ChevronDown size={16} className="shrink-0 text-white/80" />
                    </button>

                    {stackOpen && (
                      <div
                        role="listbox"
                        className="absolute left-0 right-0 top-full bg-[#0F172A] border border-white/10 border-t-0 rounded-b-2xl rounded-t-none overflow-hidden z-50"
                      >
                        {stackOptions.map((opt, idx) => {
                          const selected = idx === stackIndex;
                          return (
                            <div
                              key={`${idx}-${opt}`}
                              role="option"
                              aria-selected={selected}
                              onClick={() => {
                                setStackIndex(idx);
                                setStackOpen(false);
                              }}
                              className={`px-5 py-3 cursor-pointer text-xs font-bold uppercase tracking-widest transition-colors ${
                                selected ? 'bg-[#6366F1]/20 text-white' : 'text-white hover:bg-[#6366F1]/10'
                              }`}
                            >
                              {opt}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('common:contact.form.fields.summary')}</label>
                  <textarea
                    rows={4}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder={t('common:contact.form.placeholders.summary')}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs text-white focus:ring-2 focus:ring-[#6366F1]/50 outline-none transition-all resize-none"
                    required
                    disabled={submitting}
                  ></textarea>
                </div>

              {/* SECTION: FORM ACTIONS */}
              <div className="mt-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
                {/* Left side: Status Indicator */}
                <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/5">
                  <div className="relative flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
                    <div className="w-2 h-2 rounded-full bg-emerald-500 relative" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase whitespace-nowrap">
                    {t('common:contact.form.encryption')}
                  </span>
                </div>

                {/* Right side: Action Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className={`
                    relative group overflow-hidden
                    w-full sm:w-auto min-w-[220px] 
                    bg-[#6366F1] hover:bg-white
                    text-white hover:text-[#0F172A] 
                    px-10 py-4 rounded-2xl 
                    text-[11px] font-black uppercase tracking-[0.2em]
                    shadow-[0_10px_30px_-10px_rgba(99,102,241,0.5)]
                    transition-all duration-300 ease-out
                    flex items-center justify-center gap-3
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {/* Nút lấp lánh khi hover */}
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />

                  <span className="relative z-10 flex items-center gap-2">
                    {submitting ? (
                      <>
                        <Activity size={16} className="animate-spin" />
                        {t('common:contact.form.sending') || 'PROCESSING...'}
                      </>
                    ) : (
                      <>
                        {t('common:contact.form.submit')}
                        <Send
                          size={16}
                          className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                        />
                      </>
                    )}
                  </span>
                </button>
              </div>
              </form>
            </div>
          </div>

          {/* BÊN PHẢI: HUB CONNECTIVITY & NODE INFO */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            {/* Map/Location Box */}
            <div className="flex-1 bg-slate-50 rounded-[48px] border border-slate-100 p-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8">
                <MapPin size={40} className="text-slate-200 group-hover:text-[#6366F1]/20 transition-colors" />
              </div>
              
              <span className="text-[10px] font-black text-[#6366F1] uppercase tracking-[0.3em] mb-4 block">{t('common:contact.location.kicker')}</span>
              <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter mb-6">{t('common:contact.location.title')}</h3>
              
              <div className="space-y-6 max-w-sm">
                <div className="flex gap-4">
                  <div className="text-[10px] font-black text-slate-400 mt-1 uppercase">{t('common:contact.location.addressLabel')}</div>
                  <p className="text-sm font-bold text-slate-600 leading-relaxed">
                    {t('common:contact.location.addressValue')}
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="text-[10px] font-black text-slate-400 mt-1 uppercase">{t('common:contact.location.emailLabel')}</div>
                  <p className="text-sm font-bold text-slate-900">{t('common:contact.location.emailValue')}</p>
                </div>
              </div>

              {/* Technical Tags */}
              <div className="mt-12 flex flex-wrap gap-2">
                {locationTags.map((tag) => (
                  <span key={tag} className="px-4 py-2 bg-white rounded-full border border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Contact Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-100 p-8 rounded-[40px] hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                <Phone size={24} className="text-[#6366F1] mb-4 group-hover:scale-110 transition-transform" />
                <h4 className="text-xs font-black uppercase tracking-widest mb-1">{t('common:contact.quick.hotline')}</h4>
                <p className="text-lg font-black italic text-slate-900">{t('common:contact.quick.hotlineValue')}</p>
              </div>
              <div className="bg-[#6366F1] p-8 rounded-[40px] shadow-xl shadow-indigo-500/20 group cursor-pointer hover:-translate-y-1 transition-all">
                <Network size={24} className="text-white mb-4" />
                <h4 className="text-xs font-black text-indigo-200 uppercase tracking-widest mb-1">{t('common:contact.quick.community')}</h4>
                <p className="text-sm font-bold text-white leading-tight">{t('common:contact.quick.communityDesc')}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ContactComponent;