import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import 'aos/dist/aos.css';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
  ArrowRight,
  BookOpen,
  User,
  Calendar,
  Layers,
  CheckCircle2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { curriculumService } from '../../services/curriculum.service';
import { categoryService } from '../../services/category.service';
import { realtimeService } from '../../services/realtime.service';
import type { Category, CurriculumItem, CurriculumSourceType, PaginatedListMeta } from '../../types';
import { ROUTER } from '../../routes/router';
import { useAuthStore } from '../../store/authStore';
import { curriculumApprovedAt } from '../../utils/curriculum';
import { useTranslation } from 'react-i18next';

// --- Constants & Types ---
const SOURCE_OPTIONS: { value: CurriculumSourceType; labelKey: string }[] = [
  { value: 'upload', labelKey: 'curriculum:list.source.upload' },
  { value: 'link', labelKey: 'curriculum:list.source.link' },
];

type SortKey = 'newest' | 'oldest' | 'title';
const ITEMS_PER_PAGE = 8;

const meteorStyles = `
  @keyframes list-meteor-fx {
    0% { transform: translate(500px, -500px) rotate(225deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translate(-1000px, 1000px) rotate(225deg); opacity: 0; }
  }
  .list-meteor {
    position: absolute;
    width: 1.5px;
    height: 100px;
    background: linear-gradient(to bottom, rgba(6, 182, 212, 0.75), transparent);
    animation: list-meteor-fx linear infinite;
    pointer-events: none;
    z-index: 1;
  }
`;
type MeteorSpec = { id: number; top: string; right: string; animationDuration: string };

// --- Sub-Component: Skeleton Card ---
const SkeletonCard = () => (
  <div className="p-8 rounded-[36px] bg-white/5 border border-white/10 animate-pulse">
    <div className="flex justify-between mb-4">
      <div className="w-12 h-12 bg-white/10 rounded-2xl" />
      <div className="w-24 h-6 bg-white/10 rounded-full" />
    </div>
    <div className="h-6 bg-white/10 rounded w-3/4 mb-4" />
    <div className="h-4 bg-white/10 rounded w-full mb-2" />
    <div className="h-4 bg-white/10 rounded w-2/3 mb-6" />
    <div className="pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
      <div className="h-3 bg-white/10 rounded" />
      <div className="h-3 bg-white/10 rounded" />
    </div>
  </div>
);

const CurriculumListPage: React.FC = () => {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  
  // Auth memoization
  const canCreate = useMemo(() => ['truong_lab', 'vien_truong'].includes(user?.system_role || ''), [user]);
  const isDirector = user?.system_role === 'vien_truong';

  // UI State
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);

  // Data State
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginatedListMeta>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 1,
  });

  // Filter State
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sourceType, setSourceType] = useState<'all' | CurriculumSourceType>('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setCurrentPage(1); // Reset page on search
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  // Fetch categories once
  useEffect(() => {
    categoryService.list()
      .then(res => setCategories(res.data?.items ?? []))
      .catch(() => setCategories([]))
      .finally(() => setCategoriesLoading(false));
  }, []);

  // Main Load Logic
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await curriculumService.listPublic({
        q: debouncedQ || undefined,
        category_id: categoryId || undefined,
        source_type: sourceType === 'all' ? undefined : sourceType,
        sort: sortBy,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });

      const payload = res.data;
      setItems(payload?.items ?? []);
      if (payload?.pagination) setPagination(payload.pagination);
    } catch {
      if (!opts?.silent) {
        toast.error(t('curriculum:list.toasts.dbError'));
        setItems([]);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [debouncedQ, categoryId, sourceType, sortBy, currentPage, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMeteors((prev) => {
        const spec: MeteorSpec = {
          id: Date.now(),
          top: `${Math.random() * -10}%`,
          right: `${Math.random() * 80}%`,
          animationDuration: `${Math.random() * 2 + 2}s`,
        };
        return [...prev.slice(-10), spec];
      });
    }, 1500);
    return () => window.clearInterval(interval);
  }, []);

  // Realtime Logic
  useEffect(() => {
    const unsubStatus = realtimeService.onCurriculumStatusUpdated(() => load({ silent: true }));
    const unsubPending = realtimeService.onCurriculumPendingSubmitted(() => load({ silent: true }));
    return () => {
      unsubStatus();
      unsubPending();
    };
  }, [load]);

  // Scroll & Animation Init
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    
    import('aos').then((mod) => {
      mod.default.init({ duration: 700, once: true, offset: 40 });
    });
    
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Refresh AOS when data changes
  useEffect(() => {
    import('aos').then(mod => mod.default.refresh());
  }, [items, loading]);

  const hasActiveFilters = Boolean(categoryId || sourceType !== 'all' || sortBy !== 'newest' || q.trim());
  const clearFilters = () => {
    setQ('');
    setCategoryId('');
    setSourceType('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  const selectClass = "rounded-xl border border-white/10 bg-[#0f172a]/80 text-[11px] font-bold uppercase tracking-wider text-slate-300 px-4 py-3 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 min-w-[160px] transition-all cursor-pointer hover:bg-[#1e293b]";

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-300 pb-24 relative overflow-x-hidden font-sans">
      <style>{meteorStyles}</style>
      {/* Background Decor + sao rơi */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 w-[520px] h-[520px] bg-cyan-500/10 rounded-full blur-[130px]" />
        <div className="absolute top-1/4 -right-24 w-[460px] h-[460px] bg-blue-500/10 rounded-full blur-[130px]" />
        {meteors.map((m) => (
          <div
            key={m.id}
            className="list-meteor"
            style={{
              top: m.top,
              right: m.right,
              animationDuration: m.animationDuration,
            }}
          />
        ))}
      </div>

      {/* Header — sticky khớp offset navbar; nút phụ đồng bộ mockup */}
      <header
        className={`sticky top-5 z-30 border-b backdrop-blur-xl transition-all duration-500 ${
          scrolled ? 'bg-[#020617]/95 border-cyan-500/20 shadow-2xl' : 'bg-[#0f172a]/70 border-white/5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-0.5 flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" aria-hidden />
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-400/85">{t('curriculum:list.kicker')}</p>
              </div>
              <h1 className="text-2xl font-[1000] uppercase italic leading-tight tracking-tight text-cyan-400 drop-shadow-[0_0_28px_rgba(34,211,238,0.28)] sm:text-3xl md:text-4xl">
                {t('curriculum:list.titlePrefix')}{' '}
                <span className="text-cyan-300">{t('curriculum:list.titleHighlight')}</span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 lg:shrink-0">
              {isDirector && (
                <Link
                  to={ROUTER.USER.CURRICULUM_APPROVALS}
                  className="rounded-lg border border-amber-500/35 bg-[#12161f]/90 px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-amber-400 transition-colors hover:border-amber-400/55 hover:bg-amber-500/10"
                >
                  {t('curriculum:list.actions.pendingReview')}
                </Link>
              )}
              {canCreate && (
                <Link
                  to={ROUTER.USER.CURRICULUM_MINE}
                  className="rounded-lg border border-cyan-500/45 bg-[#12161f]/90 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-white transition-colors hover:border-cyan-400 hover:bg-cyan-500/10"
                >
                  {t('curriculum:list.actions.myWorkspace')}
                </Link>
              )}
              {canCreate && (
                <Link
                  to={ROUTER.USER.CURRICULUM_CREATE}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#020617] shadow-[0_0_26px_rgba(34,211,238,0.42)] transition-all hover:bg-cyan-300"
                >
                  <Plus size={16} strokeWidth={3} />
                  {t('curriculum:list.actions.newAsset')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-[1] max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Search Bar */}
        <section className="relative mb-8 group" data-aos="fade-up">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-500 transition-colors" size={22} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('curriculum:list.searchPlaceholder')}
            className="w-full pl-14 pr-6 py-5 rounded-3xl border border-white/10 bg-[#0f172a]/60 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/40 outline-none transition-all text-lg shadow-xl"
          />
        </section>

        {/* Filter Toolbar */}
        <section className="flex flex-wrap items-center gap-4 mb-10 p-4 rounded-2xl border border-white/5 bg-[#0b1226]/50 backdrop-blur-md" data-aos="fade-up" data-aos-delay="100">
          <div className="flex items-center gap-2 px-2 text-slate-500">
            <SlidersHorizontal size={16} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{t('curriculum:list.filters.title')}</span>
          </div>
          
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} disabled={categoriesLoading} className={selectClass}>
            <option value="">{t('curriculum:list.filters.allCategories')}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as 'all' | CurriculumSourceType)}
            className={selectClass}
          >
            <option value="all">{t('curriculum:list.filters.allSources')}</option>
            {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className={selectClass}
          >
            <option value="newest">{t('curriculum:list.sort.newest')}</option>
            <option value="oldest">{t('curriculum:list.sort.oldest')}</option>
            <option value="title">{t('curriculum:list.sort.title')}</option>
          </select>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase text-rose-400 hover:text-rose-300 transition-colors">
              <X size={14} /> {t('curriculum:list.filters.clearAll')}
            </button>
          )}
        </section>

        {/* Content Area */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-8">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-32 bg-white/[0.02] rounded-[48px] border border-white/5 border-dashed" data-aos="zoom-in">
            <FileText className="w-16 h-16 text-slate-800 mx-auto mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">{t('curriculum:list.empty.title')}</p>
            {hasActiveFilters && (
               <button onClick={clearFilters} className="mt-4 text-cyan-500 text-xs font-bold underline">{t('curriculum:list.empty.tryDifferentFilters')}</button>
            )}
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-8">
              {items.map((item, idx) => (
                <div key={item.id} data-aos="fade-up" data-aos-delay={idx * 50}>
                  <Link to={ROUTER.USER.CURRICULUM_DETAIL.replace(':id', item.id)} className="group relative block h-full p-8 rounded-[40px] bg-gradient-to-b from-white/[0.05] to-transparent border border-white/10 hover:border-cyan-500/40 transition-all duration-500 hover:-translate-y-2 shadow-lg hover:shadow-cyan-500/10">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-110 transition-transform">
                        <BookOpen size={24} />
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span className="text-[9px] font-black uppercase text-emerald-500 tracking-tight">{t('curriculum:list.card.verified')}</span>
                      </div>
                    </div>

                    <h2 className="text-xl font-bold text-white uppercase mb-3 group-hover:text-cyan-400 transition-colors line-clamp-2">
                      {item.title}
                    </h2>
                    
                    <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-8 font-medium">
                      {item.description || t('curriculum:list.card.noDescription')}
                    </p>

                    <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Layers size={14} className="text-slate-600 shrink-0" />
                        <span className="text-[10px] font-bold uppercase text-slate-400 truncate">{item.category?.name || t('curriculum:list.card.uncategorized')}</span>
                      </div>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <User size={14} className="text-slate-600 shrink-0" />
                        <span className="text-[10px] font-bold uppercase text-slate-400 truncate">{item.authors || t('curriculum:list.card.na')}</span>
                      </div>
                      <div className="flex items-center gap-2 col-span-2">
                        <Calendar size={14} className="text-slate-600" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {t('curriculum:list.card.approvedAt', { date: curriculumApprovedAt(item)?.slice(0, 10) || '---' })}
                        </span>
                      </div>
                    </div>

                    <div className="mt-8 flex items-center gap-2 text-cyan-400 font-black text-[11px] uppercase tracking-widest group-hover:gap-4 transition-all">
                      {t('curriculum:list.card.analyze')} <ArrowRight size={16} />
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">
                  {t('curriculum:list.pagination.pageOf', { page: currentPage, totalPages: pagination.totalPages, total: pagination.total })}
                </span>
                <div className="flex gap-2">
                  <button 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-20 transition-all"
                    aria-label={t('curriculum:list.pagination.prevAria')}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    disabled={currentPage === pagination.totalPages} 
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-20 transition-all"
                    aria-label={t('curriculum:list.pagination.nextAria')}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CurriculumListPage;