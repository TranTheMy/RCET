import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  memo,
} from 'react';
import Spline from '@splinetool/react-spline';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, Cpu, Bot, Users,
  ShieldCheck, ArrowRight, BookOpen,
  Microscope, Globe, Trophy, Star, ScrollText,
  Car, Activity, Zap
} from 'lucide-react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import ContactComponent from '../components/Contact';
import PartnerLogos from '../components/PartnerLogo';
import ResearchAwark from '../components/ResearchAwark';
import { researchService } from '../services/research.service';
import { projectService } from '../services/project.service';
import { documentService } from '../services/document.service';
import { curriculumService } from '../services/curriculum.service';
import { labService } from '../services/lab.service';
import { useAuthStore } from '../store/authStore';
import type { LucideIcon } from 'lucide-react';
import type { ResearchItem } from '../types';
import { isHeroSplineEnabled } from '../config/splineEnv';
import { HERO_SPLINE_SCENE, CAPABILITIES_SPLINE_SCENE } from '../config/splineScenes';
import '../splineHeroWarmup';
import { ROUTER } from '../routes/router';
import { HeroSplineBoundary } from '../components/home/HeroSplineBoundary';
import { HeroSplineCssFallback } from '../components/home/HeroSplineCssFallback';

const HOME_MARQUEE_STYLE = `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: 200%;
          animation: marquee 40s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
        @keyframes shine {
          100% { left: 125%; }
        }
        .animate-shine {
          animation: shine 0.8s ease-in-out;
        }
      `;

type StatCardModel = {
  label: string;
  value: string;
  highlight: string;
  Icon: LucideIcon;
};

const StatGrid = memo(function StatGrid({ items }: { items: StatCardModel[] }) {
  return (
    <>
      {items.map((stat) => (
        <div
          key={stat.highlight}
          className="relative bg-white border border-slate-200/60 p-6 rounded-[32px] shadow-sm flex flex-col justify-between hover:border-cyan-500/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 group overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex justify-between items-start relative z-10">
            <span className="text-3xl font-black text-[#0F172A] italic tracking-tighter">{stat.value}</span>
            <div className="p-2.5 bg-slate-50 text-cyan-600 rounded-xl group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
              <stat.Icon size={20} aria-hidden />
            </div>
          </div>
          <div className="relative z-10 mt-4">
            <p className="text-[8px] font-black text-cyan-600 uppercase mb-1 tracking-widest">{stat.highlight}</p>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight block">
              {stat.label}
            </span>
          </div>
        </div>
      ))}
    </>
  );
});

type CapabilityItem = {
  title: string;
  Icon: LucideIcon;
  badge: string;
  desc: string;
  color: string;
};

function useCapabilityItems(t: (key: string) => string): CapabilityItem[] {
  return [
    {
      title: t('home:capabilities.items.customIcDesign.title'),
      Icon: Cpu,
      badge: t('home:capabilities.items.customIcDesign.badge'),
      desc: t('home:capabilities.items.customIcDesign.desc'),
      color: 'from-white via-cyan-200 to-cyan-400',
    },
    {
      title: t('home:capabilities.items.advancedRobotics.title'),
      Icon: Bot,
      badge: t('home:capabilities.items.advancedRobotics.badge'),
      desc: t('home:capabilities.items.advancedRobotics.desc'),
      color: 'from-cyan-300 via-cyan-500 to-blue-500',
    },
    {
      title: t('home:capabilities.items.smartMobility.title'),
      Icon: Car,
      badge: t('home:capabilities.items.smartMobility.badge'),
      desc: t('home:capabilities.items.smartMobility.desc'),
      color: 'from-blue-400 via-blue-600 to-indigo-900',
    },
  ];
}

/** Hover chỉ re-render block thẻ — không kéo cả Hero / ticker. */
const CapabilityCards = memo(function CapabilityCards({ items }: { items: CapabilityItem[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  return (
    <div className="space-y-6">
      {items.map((item, i) => (
        <motion.div
          key={item.title}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          initial={{ x: 0, y: 0, scale: 1 }}
          animate={{
            x: hoveredIndex === i ? 25 : 0,
            y: hoveredIndex === i ? -5 : 0,
            scale: hoveredIndex === i ? 1.02 : 1,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={`group p-8 bg-white/[0.03] backdrop-blur-md border rounded-[40px] transition-all duration-500 relative overflow-hidden cursor-pointer
            ${hoveredIndex === i ? 'border-transparent' : 'border-white/5'}
          `}
        >
          <div
            className={`absolute inset-0 bg-gradient-to-r ${item.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
          />
          {hoveredIndex === i && (
            <div className={`absolute inset-0 p-[1px] bg-gradient-to-r ${item.color} rounded-[40px] -z-10`}>
              <div className="w-full h-full bg-[#020617] rounded-[39px]" />
            </div>
          )}
          <div className="flex items-center gap-8 relative z-10">
            <div
              className={`w-20 h-20 bg-[#0F172A] rounded-3xl flex items-center justify-center transition-all duration-500 shadow-xl flex-shrink-0
                ${hoveredIndex === i ? 'text-white scale-110' : 'text-cyan-400'}
              `}
              style={{
                backgroundColor: hoveredIndex === i ? (i === 0 ? '#06b6d4' : i === 1 ? '#0284c7' : '#1e3a8a') : '#0F172A',
              }}
            >
              <item.Icon className="h-9 w-9" strokeWidth={1.5} aria-hidden />
            </div>
            <div>
              <span
                className={`text-[8px] font-black uppercase tracking-widest block mb-1 opacity-60 transition-colors duration-500
                  ${hoveredIndex === i ? 'text-white' : 'text-cyan-500'}
                `}
              >
                {item.badge}
              </span>
              <h3 className="text-xl font-[900] text-white uppercase italic">{item.title}</h3>
              <p
                className={`text-sm mt-2 font-medium leading-snug transition-colors duration-500
                  ${hoveredIndex === i ? 'text-slate-200' : 'text-slate-500'}
                `}
              >
                {item.desc}
              </p>
            </div>
          </div>
          <div
            className={`absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/10 opacity-40 
              ${hoveredIndex === i ? 'animate-shine' : ''}`}
          />
        </motion.div>
      ))}
    </div>
  );
});

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, initialized, user } = useAuthStore();
  const systemRole = user?.system_role ?? null;
  const isCvReviewer = systemRole === 'truong_lab' || systemRole === 'vien_truong';
  const isMemberRole = systemRole === 'member';
  const isAdminRole = systemRole === 'admin';
  const reduceMotion = useReducedMotion();
  const showHeroSpline = isHeroSplineEnabled() && !reduceMotion;
  const capabilitiesSectionRef = useRef<HTMLElement | null>(null);
  const capabilitiesInView = useInView(capabilitiesSectionRef, { amount: 0.15, margin: '0px 0px -8% 0px' });
  const [capabilitiesSplineDesktop, setCapabilitiesSplineDesktop] = useState(false);
  const showCapabilitiesSpline =
    isHeroSplineEnabled() &&
    !reduceMotion &&
    capabilitiesSplineDesktop &&
    capabilitiesInView;
  const [researchItems, setResearchItems] = useState<ResearchItem[]>([]);
  const [publishedDocsCount, setPublishedDocsCount] = useState<number | null>(null);
  const [publishedCurriculumCount, setPublishedCurriculumCount] = useState<number | null>(null);
  const [labRosterCount, setLabRosterCount] = useState<number | null>(null);
  const [activeProjectsCount, setActiveProjectsCount] = useState<number | null>(null);

  /** Cột trái (Core Research Lab): ẩn trái → sau 10s vào vị trí → sau 10s trượt ẩn lại, lặp */
  const [labIntroVisible, setLabIntroVisible] = useState(false);

  /** Luôn true — khung Spline full ngay; trước đây false + setTimeout 2s làm robot nhỏ/muộn. */
  const heroRevealed = true;

  /** Warm HTTP cache cho scene Capabilities — dùng fetch, không dùng `<link rel="preload">` (tránh cảnh báo Chrome + tag còn sót trong head khi rời Home). */
  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetch(CAPABILITIES_SPLINE_SCENE, { mode: 'cors', credentials: 'omit' }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, []);

  /** lg+: phải sync media query — không thì capabilitiesSplineDesktop luôn false → robot không render. */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setCapabilitiesSplineDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loop = async () => {
      await new Promise((r) => setTimeout(r, 10_000));
      if (cancelled) return;
      setLabIntroVisible(true);
      await new Promise((r) => setTimeout(r, 10_000));
      if (cancelled) return;
      setLabIntroVisible(false);
      loop();
    };

    loop();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;
    const loadSystemSnapshot = async () => {
      const [rRes, lRes] = await Promise.allSettled([
        researchService.listPublic(),
        labService.getInformation(),
      ]);
      if (cancelled) return;

      setResearchItems(rRes.status === 'fulfilled' ? (rRes.value.data?.items ?? []) : []);
      setLabRosterCount(
        lRes.status === 'fulfilled' ? (lRes.value.data?.total_directory_units ?? null) : null
      );

      const [dRes, cRes] = await Promise.allSettled([
        documentService.listPublic(),
        curriculumService.listPublic(),
      ]);
      if (cancelled) return;
      setPublishedDocsCount(
        dRes.status === 'fulfilled' ? (dRes.value.data?.items?.length ?? 0) : 0
      );
      setPublishedCurriculumCount(
        cRes.status === 'fulfilled' ? (cRes.value.data?.items?.length ?? 0) : 0
      );
    };
    loadSystemSnapshot();
    return () => {
      cancelled = true;
    };
  }, [initialized]);

  useEffect(() => {
    const loadActiveProjects = async () => {
      const usePublicCount = !isAuthenticated || user?.system_role === 'user';
      if (usePublicCount) {
        try {
          const { total } = await projectService.getPublicActiveCount();
          setActiveProjectsCount(typeof total === 'number' ? total : null);
        } catch {
          setActiveProjectsCount(null);
        }
        return;
      }
      try {
        const payload = await projectService.list({ status: 'active', page: 1, limit: 1 });
        const total = payload.pagination?.total;
        setActiveProjectsCount(typeof total === 'number' ? total : payload.projects?.length || 0);
      } catch {
        setActiveProjectsCount(null);
      }
    };
    loadActiveProjects();
  }, [isAuthenticated, user?.system_role]);

  /** Chỉ Q1/Q2 — không fallback sang bài khác; section Academic gắn với ResearchAwark chỉ hiện khi có dữ liệu Q1/Q2. */
  const topResearch = useMemo(() => {
    const q1q2 = researchItems.filter(
      (item) => item.impact_rank === 'Q1' || item.impact_rank === 'Q2',
    );
    return [...q1q2].sort((a, b) => (b.total_citations || 0) - (a.total_citations || 0)).slice(0, 3);
  }, [researchItems]);

  const technicalAssetsCount = useMemo(() => {
    if (publishedDocsCount == null || publishedCurriculumCount == null) return null;
    return publishedDocsCount + publishedCurriculumCount;
  }, [publishedDocsCount, publishedCurriculumCount]);

  const stats = useMemo((): StatCardModel[] => {
    const activeProjectsLabel = activeProjectsCount == null ? '—' : `${activeProjectsCount}+`;
    const q1q2Count = researchItems.filter((item) => item.impact_rank === 'Q1' || item.impact_rank === 'Q2').length;
    const q1q2Label = q1q2Count > 0 ? `${q1q2Count}+` : String(q1q2Count);

    const assetsLabel =
      technicalAssetsCount == null ? '—' : technicalAssetsCount > 0 ? `${technicalAssetsCount}+` : '0';

    const rosterLabel = labRosterCount == null ? '—' : labRosterCount > 0 ? `${labRosterCount}+` : '0';

    return [
      {
        label: t('home:stats.q1q2.label'),
        value: q1q2Label,
        Icon: BookOpen,
        highlight: t('home:stats.q1q2.highlight'),
      },
      {
        label: t('home:stats.assets.label'),
        value: assetsLabel,
        Icon: ShieldCheck,
        highlight: t('home:stats.assets.highlight'),
      },
      {
        label: t('home:stats.activeProjects.label'),
        value: activeProjectsLabel,
        Icon: Activity,
        highlight: t('home:stats.activeProjects.highlight'),
      },
      {
        label: t('home:stats.roster.label'),
        value: rosterLabel,
        Icon: Users,
        highlight: t('home:stats.roster.highlight'),
      },
    ];
  }, [researchItems, activeProjectsCount, technicalAssetsCount, labRosterCount, t]);

  const tickerLines = useMemo(() => {
    const fromDb = researchItems
      .filter((r) => r.title?.trim())
      .slice(0, 5)
      .map((r) => {
        const t = r.title.trim();
        return t.length > 72 ? `${t.slice(0, 69)}…` : t;
      });
    const fallback = [
      t('home:ticker.fallback.0'),
      t('home:ticker.fallback.1'),
      t('home:ticker.fallback.2'),
      t('home:ticker.fallback.3'),
    ];
    const lines = fromDb.length > 0 ? [...fromDb, ...fallback] : fallback;
    return lines.flatMap((x) => [x, x]);
  }, [researchItems, t]);

  const handleSplineTransparentBg = useCallback((app: { setBackgroundColor: (c: string) => void }) => {
    app.setBackgroundColor('transparent');
  }, []);

  const scientistPathfinderCard = useMemo(() => {
    const cardShell =
      'bg-[#020617] rounded-[48px] p-12 group relative overflow-hidden shadow-2xl border border-white/5 hover:border-cyan-500/20 transition-colors';
    const glow = (
      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl group-hover:bg-cyan-500/10 transition-all duration-500" />
    );

    if (!isAuthenticated) {
      return (
        <Link to={ROUTER.USER.SUBMITCV} className={`${cardShell} block`}>
          <Microscope size={44} className="text-cyan-400 mb-8 relative z-10" />
          <h3 className="text-2xl font-[900] text-white uppercase italic mb-4 relative z-10">{t('home:pathfinder.scientist.title')}</h3>
          <p className="text-slate-400 text-base leading-relaxed mb-10 relative z-10 font-medium">
            {t('home:pathfinder.scientist.guest.desc')}
          </p>
          <span className="flex items-center gap-4 text-[11px] font-[900] uppercase tracking-widest text-white group-hover:gap-8 group-hover:text-cyan-400 transition-all relative z-10">
            {t('home:pathfinder.scientist.guest.cta')}
            <ArrowRight size={18} className="text-cyan-400" />
          </span>
          <p className="text-[10px] text-slate-500 mt-4 relative z-10 font-medium">
            {t('home:pathfinder.scientist.guest.note')}
          </p>
          {glow}
        </Link>
      );
    }

    if (isCvReviewer) {
      return (
        <Link to={ROUTER.USER.CV_APPROVALS} className={`${cardShell} block`}>
          <Microscope size={44} className="text-cyan-400 mb-8 relative z-10" />
          <h3 className="text-2xl font-[900] text-white uppercase italic mb-4 relative z-10">{t('home:pathfinder.scientist.title')}</h3>
          <p className="text-slate-400 text-base leading-relaxed mb-10 relative z-10 font-medium">
            {t('home:pathfinder.scientist.reviewer.desc')}
          </p>
          <span className="flex items-center gap-4 text-[11px] font-[900] uppercase tracking-widest text-white group-hover:gap-8 group-hover:text-cyan-400 transition-all relative z-10">
            {t('home:pathfinder.scientist.reviewer.cta')}
            <ArrowRight size={18} className="text-cyan-400" />
          </span>
          {glow}
        </Link>
      );
    }

    if (isMemberRole) {
      return (
        <div className={`${cardShell} cursor-default`}>
          <Microscope size={44} className="text-cyan-400 mb-8 relative z-10" />
          <h3 className="text-2xl font-[900] text-white uppercase italic mb-4 relative z-10">{t('home:pathfinder.scientist.title')}</h3>
          <p className="text-slate-400 text-base leading-relaxed mb-10 relative z-10 font-medium">
            {t('home:pathfinder.scientist.member.desc', {
              roleLabel: t('home:pathfinder.scientist.member.roleMember'),
            })}
          </p>
          <span className="inline-flex items-center gap-2 text-[11px] font-[900] uppercase tracking-widest text-cyan-400/90 relative z-10">
            <ShieldCheck size={18} className="text-cyan-400 shrink-0" />
            {t('home:pathfinder.scientist.member.badge')}
          </span>
          {glow}
        </div>
      );
    }

    if (isAdminRole) {
      return (
        <Link to={ROUTER.ADMIN.ADMIN_DASHBOARD} className={`${cardShell} block`}>
          <Microscope size={44} className="text-cyan-400 mb-8 relative z-10" />
          <h3 className="text-2xl font-[900] text-white uppercase italic mb-4 relative z-10">{t('home:pathfinder.scientist.title')}</h3>
          <p className="text-slate-400 text-base leading-relaxed mb-10 relative z-10 font-medium">
            {t('home:pathfinder.scientist.admin.desc')}
          </p>
          <span className="flex items-center gap-4 text-[11px] font-[900] uppercase tracking-widest text-white group-hover:gap-8 group-hover:text-cyan-400 transition-all relative z-10">
            {t('home:pathfinder.scientist.admin.cta')}
            <ArrowRight size={18} className="text-cyan-400" />
          </span>
          {glow}
        </Link>
      );
    }

    return (
      <Link to={ROUTER.USER.SUBMITCV} className={`${cardShell} block`}>
        <Microscope size={44} className="text-cyan-400 mb-8 relative z-10" />
        <h3 className="text-2xl font-[900] text-white uppercase italic mb-4 relative z-10">{t('home:pathfinder.scientist.title')}</h3>
        <p className="text-slate-400 text-base leading-relaxed mb-10 relative z-10 font-medium">
          {t('home:pathfinder.scientist.guest.desc')}
        </p>
        <span className="flex items-center gap-4 text-[11px] font-[900] uppercase tracking-widest text-white group-hover:gap-8 group-hover:text-cyan-400 transition-all relative z-10">
          {t('home:pathfinder.scientist.guest.cta')}
          <ArrowRight size={18} className="text-cyan-400" />
        </span>
        {glow}
      </Link>
    );
  }, [isAuthenticated, isCvReviewer, isMemberRole, isAdminRole, systemRole, t]);

  // `useCapabilityItems` is a hook -> must be called directly (not inside useMemo callback).
  const capabilityItems = useCapabilityItems(t);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#0F172A] selection:bg-cyan-500 selection:text-white overflow-x-hidden">

      {/* 1. HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pt-10 md:pt-14 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-9 bg-[#030712] rounded-[48px] p-8 md:p-16 relative overflow-hidden shadow-2xl border border-white/5 group min-h-[320px] md:min-h-[420px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,#22D3EE15,transparent_50%)]" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]" />
            {/* Nền hero: Spline 3D mặc định; tắt bằng VITE_DISABLE_SPLINE / VITE_HERO_SPLINE=false hoặc reduced motion. */}
            <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center px-4 sm:px-6 md:px-8">
              <div className="relative isolate mx-auto flex h-[min(72vh,640px)] w-full max-w-[880px] items-center justify-center overflow-hidden lg:h-[min(78%,680px)]">
                {showHeroSpline ? (
                  <HeroSplineBoundary fallback={<HeroSplineCssFallback heroRevealed={heroRevealed} />}>
                    <Spline
                      scene={HERO_SPLINE_SCENE}
                      renderOnDemand={false}
                      onLoad={handleSplineTransparentBg}
                      style={{ background: 'transparent' }}
                      className="relative h-full w-full !bg-transparent [&_canvas]:mx-auto [&_canvas]:block [&_canvas]:max-h-full [&_canvas]:max-w-full [&_canvas]:bg-transparent [&_canvas]:object-contain"
                    >
                      {/* Thư viện ẩn canvas tới khi load() xong — hiển thị fallback ngay, tránh ô đen ~2s */}
                      <div className="pointer-events-none absolute inset-0 z-0 min-h-[200px]">
                        <HeroSplineCssFallback heroRevealed={heroRevealed} />
                      </div>
                    </Spline>
                  </HeroSplineBoundary>
                ) : (
                  <HeroSplineCssFallback heroRevealed={heroRevealed} />
                )}
              </div>
              {/* Che watermark: full ngang cả thẻ hero (badge có thể rộng hơn khung Spline) */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[300] h-24 bg-[#030712] sm:h-28 md:h-32"
                style={{ boxShadow: '0 -32px 64px 40px #030712' }}
                aria-hidden
              />
            </div>
            <motion.div
              className="relative z-10 flex flex-col h-full"
              initial={reduceMotion ? false : { y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.33, 0, 0.2, 1] }}
            >
              <div className="flex items-center gap-3 mb-10">
                <span className="h-[2px] w-10 bg-cyan-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400/80">{t('home:hero.kicker')}</span>
                <div className="px-3 py-1 bg-cyan-400/10 border border-cyan-400/20 rounded-full flex items-center gap-2">
                  <Trophy size={10} className="text-cyan-400" />
                  <span className="text-[9px] font-black text-cyan-400 uppercase">{t('home:hero.badge')}</span>
                </div>
              </div>
              <h1 className="text-5xl md:text-7xl lg:text-[84px] font-[900] text-white tracking-tighter leading-[0.9] uppercase italic">
                {t('home:hero.title.line1')} <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">{t('home:hero.title.line2')}</span> <br />
                {t('home:hero.title.line3')}
              </h1>
              <p className="text-slate-400 mt-10 max-w-xl text-lg font-medium leading-relaxed opacity-90">
                {t('home:hero.description')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-12">
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('contract')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }
                  className="bg-cyan-500 text-[#030712] px-10 py-5 rounded-2xl text-[11px] font-[900] uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-cyan-500/20 text-center"
                >
                  {t('home:hero.actions.transfer')}
                </button>
                <Link to="/publication/research" className="bg-white/5 text-white border border-white/10 backdrop-blur-md px-10 py-5 rounded-2xl text-[11px] font-[900] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-white/10 transition-all">
                  {t('home:hero.actions.library')} <ArrowUpRight size={18} className="text-cyan-400" />
                </Link>
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <StatGrid items={stats} />
          </div>
        </div>
      </section>

      {/* 2. NEWS TICKER */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pb-12">
        <div className="w-full bg-[#0F172A] rounded-[24px] py-5 overflow-hidden whitespace-nowrap shadow-inner border border-white/5">
          <div className="flex animate-marquee gap-16 items-center">
            {tickerLines.map((text, i) => (
              <div key={`${text}-${i}`} className="flex items-center gap-4">
                <Zap size={12} className="text-cyan-400 fill-cyan-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. CAPABILITIES - TÍCH HỢP SPLINE 3D & HIỆU ỨNG GẮP THẺ */}
      <section ref={capabilitiesSectionRef} className="max-w-7xl mx-auto px-4 md:px-6 pb-20 overflow-x-hidden">
        <div className="bg-[#020617] py-20 md:py-28 relative overflow-hidden rounded-[56px] shadow-3xl border border-white/5">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />

          {/* Nền trái: gradient + Spline (cùng scene hero) — mount khi scroll tới + delay; tắt theo splineEnv / reduced motion */}
          <div className="pointer-events-none absolute left-0 top-0 isolate z-10 h-full w-full overflow-hidden lg:w-[60%]">
            <div
              className="absolute -left-[20%] top-1/2 h-[min(120%,900px)] w-[min(140%,700px)] -translate-y-1/2 rounded-full bg-gradient-to-br from-cyan-500/25 via-blue-600/15 to-indigo-900/20 blur-3xl"
              aria-hidden
            />
            <div
              className="absolute left-[10%] bottom-0 h-[55%] w-[70%] rounded-full bg-cyan-400/10 blur-[100px]"
              aria-hidden
            />
            {showCapabilitiesSpline ? (
              <div className="absolute inset-0 z-[15] flex items-center justify-center lg:pl-4 lg:pr-0">
                <HeroSplineBoundary fallback={<HeroSplineCssFallback heroRevealed />}>
                  <Spline
                    scene={CAPABILITIES_SPLINE_SCENE}
                    renderOnDemand={false}
                    onLoad={handleSplineTransparentBg}
                    style={{ background: 'transparent' }}
                    className="relative h-[min(72vh,560px)] w-full max-w-[640px] !bg-transparent opacity-[0.92] [&_canvas]:mx-auto [&_canvas]:block [&_canvas]:max-h-full [&_canvas]:max-w-full [&_canvas]:bg-transparent [&_canvas]:object-contain"
                  >
                    <div className="pointer-events-none absolute inset-0 z-0 min-h-[200px]">
                      <HeroSplineCssFallback heroRevealed />
                    </div>
                  </Spline>
                </HeroSplineBoundary>
              </div>
            ) : null}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[300] h-24 bg-[#020617] sm:h-28 md:h-32"
              style={{ boxShadow: '0 -32px 64px 40px #020617' }}
              aria-hidden
            />
          </div>

          <div className="max-w-7xl mx-auto px-6 sm:px-10 relative z-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center lg:justify-items-stretch">
              <motion.div
                className="bg-[#020617]/40 backdrop-blur-sm p-6 rounded-3xl lg:bg-transparent lg:backdrop-blur-none lg:justify-self-start lg:max-w-xl w-full"
                initial={false}
                animate={{
                  x: labIntroVisible ? 0 : '-115%',
                  opacity: labIntroVisible ? 1 : 0,
                }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                style={{ pointerEvents: labIntroVisible ? 'auto' : 'none' }}
                aria-hidden={!labIntroVisible}
              >
                <span className="text-cyan-400 font-black text-[10px] uppercase tracking-[0.4em] mb-5 block">{t('home:capabilities.kicker')}</span>
                <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic leading-[0.95]">
                  {t('home:capabilities.title.line1')} <br /> <span className="text-slate-600">{t('home:capabilities.title.line2')}</span>
                </h2>
                <p className="text-slate-400 mt-8 text-lg leading-relaxed font-medium opacity-80">
                  {t('home:capabilities.description')}
                </p>

                <div className="grid grid-cols-2 gap-10 mt-14 pt-14 border-t border-white/10">
                  <div className="group cursor-default">
                    <Globe size={28} className="text-cyan-400 mb-5 group-hover:scale-110 transition-transform" />
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                      {t('home:capabilities.features.ieee.title')} <ShieldCheck size={14} className="text-cyan-500" />
                    </h4>
                    <p className="text-slate-500 text-xs mt-3 leading-loose">{t('home:capabilities.features.ieee.desc')}</p>
                  </div>
                  <div className="group cursor-default">
                    <Microscope size={28} className="text-cyan-400 mb-5 group-hover:scale-110 transition-transform" />
                    <h4 className="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                      {t('home:capabilities.features.deepRd.title')} <Star size={14} className="text-amber-400" />
                    </h4>
                    <p className="text-slate-500 text-xs mt-3 leading-loose">{t('home:capabilities.features.deepRd.desc')}</p>
                  </div>
                </div>
              </motion.div>

              <CapabilityCards items={capabilityItems} />
            </div>
          </div>
        </div>
      </section>

      {/* 4. ACADEMIC EXCELLENCE */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        {topResearch.length > 0 && (
          <ResearchAwark
            items={topResearch}
            maxItems={3}
            paginate={false}
            tagLabel={t('home:academic.tagLabel')}
            title={t('home:academic.title')}
            ctaLabel={t('home:academic.cta')}
            ctaHref="/publication/research"
          />
        )}
      </section>

      {/* 5. PATHFINDER */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white border border-slate-200 rounded-[48px] p-12 group hover:border-cyan-500/20 transition-all relative overflow-hidden shadow-sm">
            <ScrollText size={44} className="text-cyan-600 mb-8 relative z-10" strokeWidth={1.75} />
            <h3 className="text-2xl font-[900] uppercase italic mb-4 relative z-10 text-[#0F172A]">{t('home:pathfinder.systemRules.title')}</h3>
            <p className="text-slate-500 text-base leading-relaxed mb-10 relative z-10 font-medium">{t('home:pathfinder.systemRules.desc')}</p>
            <Link
              to={ROUTER.USER.SYSTEM_RULES}
              className="inline-flex items-center gap-4 text-[11px] font-[900] uppercase tracking-widest text-[#0F172A] hover:gap-8 hover:text-cyan-600 transition-all relative z-10"
            >
              {t('home:pathfinder.systemRules.cta')} <ArrowRight size={18} />
            </Link>
          </div>
          {scientistPathfinderCard}
        </div>
      </section>

      {/* 6. CONTACT / HỢP TÁC — anchor #contract (hero CTA scroll) */}
      <section
        id="contract"
        className="max-w-7xl mx-auto px-4 md:px-6 pb-20 scroll-mt-[5.5rem] lg:scroll-mt-[4.5rem]"
      >
        <div className="bg-white rounded-[56px] border border-slate-100 shadow-xl overflow-hidden">
          <ContactComponent />
        </div>
      </section>

      <div className="bg-white border-t border-slate-100 py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-cyan-50 border border-cyan-100 text-[10px] font-black uppercase tracking-[0.35em] text-cyan-600 mb-12 italic">
          {t('home:partners.title')}
          </p>
          <PartnerLogos />
        </div>
      </div>

      {/* TÍCH HỢP CSS HIỆU ỨNG QUÉT SÁNG CÙNG MARQUEE CÓ SẴN CỦA BẠN */}
      <style>{HOME_MARQUEE_STYLE}</style>
    </div>
  );
};

export default Home;