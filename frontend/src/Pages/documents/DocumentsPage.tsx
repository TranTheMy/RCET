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
  FileDown, // Thay đổi icon cho Document
  User,
  Calendar,
  Tag,
  CheckCircle2,
  SlidersHorizontal,
  X,
  Loader2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { documentService } from '../../services/document.service'; // Giả định service của bạn
import { categoryService } from '../../services/category.service';
import type { Category, DocumentItem, PaginatedListMeta } from '../../types';
import { ROUTER } from '../../routes/router';
import { useAuthStore } from '../../store/authStore';

const ITEMS_PER_PAGE = 8;

const DocumentListPage: React.FC = () => {
  const { user } = useAuthStore();
  const { t, i18n } = useTranslation();
  const isDirector = user?.system_role === 'vien_truong';
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data State
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [currentPage, setCurrentPage] = useState(1);

  // Quyền hạn (Tương tự Curriculum)
  const canCreate = useMemo(() => ['truong_lab', 'vien_truong'].includes(user?.system_role || ''), [user]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  // Load Categories
  useEffect(() => {
    categoryService.list().then(res => setCategories(res.data?.items ?? []));
  }, []);

  // Main Load Logic
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await documentService.listPublic({
        q: debouncedQ || undefined,
        category_id: categoryId || undefined,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });
      setItems(res.data?.items ?? []);
      setPagination(res.data?.pagination ?? {
        page: 1,
        limit: ITEMS_PER_PAGE,
        total: 0,
        totalPages: 1,
      });
    } catch {
      if (!opts?.silent) toast.error(t('documents:list.errors.fetchFailed'));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [debouncedQ, categoryId, currentPage, t]);

  useEffect(() => { load(); }, [load]);

  // Scroll & AOS
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    import('aos').then(mod => mod.default.init({ duration: 700, once: true }));
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const clearFilters = () => {
    setQ('');
    setCategoryId('');
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-300 pb-24 relative overflow-x-hidden font-sans">
      {/* Background Decor - Giống Curriculum */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-16 w-[520px] h-[520px] bg-cyan-500/10 rounded-full blur-[130px]" />
        <div className="absolute top-1/4 -right-24 w-[460px] h-[460px] bg-blue-500/10 rounded-full blur-[130px]" />
      </div>

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
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-400/85">{t('documents:list.kicker')}</p>
              </div>
              <h1 className="text-2xl font-[1000] uppercase italic leading-tight tracking-tight text-cyan-400 drop-shadow-[0_0_28px_rgba(34,211,238,0.28)] sm:text-3xl md:text-4xl">
                {t('documents:list.title1')}{' '}
                <span className="text-cyan-300">{t('documents:list.title2')}</span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 lg:shrink-0">
              {isDirector && (
                <Link
                  to={ROUTER.USER.DOCUMENTS_APPROVALS}
                  className="rounded-lg border border-amber-500/35 bg-[#12161f]/90 px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-amber-400 transition-colors hover:border-amber-400/55 hover:bg-amber-500/10"
                >
                  {t('documents:list.pendingReview')}
                </Link>
              )}
              {canCreate && (
                <Link
                  to={ROUTER.USER.DOCUMENTS_MINE}
                  className="rounded-lg border border-cyan-500/45 bg-[#12161f]/90 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-white transition-colors hover:border-cyan-400 hover:bg-cyan-500/10"
                >
                  {t('documents:list.myWorkspace')}
                </Link>
              )}
              {canCreate && (
                <Link
                  to={ROUTER.USER.DOCUMENTS_CREATE}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#020617] shadow-[0_0_26px_rgba(34,211,238,0.42)] transition-all hover:bg-cyan-300"
                >
                  <Plus size={16} strokeWidth={3} />
                  {t('documents:list.newAsset')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-[1] max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Search Bar - Phong cách Futuristic */}
        <section className="relative mb-8 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-500 transition-colors" size={22} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('documents:list.searchPlaceholder')}
            className="w-full pl-14 pr-6 py-5 rounded-3xl border border-white/10 bg-[#0f172a]/60 text-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/40 outline-none transition-all text-lg shadow-xl"
          />
        </section>

        {/* Filter Toolbar */}
        <section className="flex flex-wrap items-center gap-4 mb-10 p-4 rounded-2xl border border-white/5 bg-[#0b1226]/50 backdrop-blur-md">
          <div className="flex items-center gap-2 px-2 text-slate-500">
            <SlidersHorizontal size={16} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{t('documents:list.filters')}</span>
          </div>
          
          <select 
            value={categoryId} 
            onChange={e => setCategoryId(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#0f172a]/80 text-[11px] font-bold uppercase tracking-wider text-slate-300 px-4 py-3 outline-none focus:border-cyan-500/40 min-w-[180px]"
          >
            <option value="">{t('documents:list.allCategories')}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {categoryId !== '' && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase text-rose-400 hover:text-rose-300 transition-colors">
              <X size={14} /> {t('documents:list.clearFilters')}
            </button>
          )}
        </section>

        {/* List Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('documents:list.loading')}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-32 bg-white/[0.02] rounded-[48px] border border-white/5 border-dashed">
            <FileText className="w-16 h-16 text-slate-800 mx-auto mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">{t('documents:list.emptyTitle')}</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-8">
              {items.map((doc, idx) => (
                <div key={doc.id} data-aos="fade-up" data-aos-delay={idx * 50}>
                  <Link to={ROUTER.USER.DOCUMENTS_DETAIL.replace(':id', doc.id)} className="group relative block h-full p-8 rounded-[40px] bg-gradient-to-b from-white/[0.05] to-transparent border border-white/10 hover:border-cyan-500/40 transition-all duration-500 hover:-translate-y-2 shadow-lg hover:shadow-cyan-500/10">
                    {/* Icon & Status */}
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-110 transition-transform">
                        <FileDown size={24} />
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                      <span className="text-[9px] font-black uppercase text-emerald-500 tracking-tight">{t('documents:list.verified')}</span>
                      </div>
                    </div>

                    <h2 className="text-xl font-bold text-white uppercase mb-3 group-hover:text-cyan-400 transition-colors line-clamp-2">
                      {doc.title}
                    </h2>
                    
                    <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-8">
                      {doc.description || t('documents:list.defaultDescription')}
                    </p>

                    {/* Metadata - Giống Curriculum */}
                    <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Tag size={14} className="text-slate-600 shrink-0" />
                        <span className="text-[10px] font-bold uppercase text-slate-400 truncate">{doc.category?.name || t('documents:list.uncategorized')}</span>
                      </div>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <User size={14} className="text-slate-600 shrink-0" />
                        <span className="text-[10px] font-bold uppercase text-slate-400 truncate">{doc.created_by || t('documents:list.system')}</span>
                      </div>
                      <div className="flex items-center gap-2 col-span-2">
                        <Calendar size={14} className="text-slate-600" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {t('documents:list.updatedAt', { date: new Date(doc.updated_at || '').toLocaleDateString(dateLocale) })}
                        </span>
                      </div>
                    </div>

                    <div className="mt-8 flex items-center gap-2 text-cyan-400 font-black text-[11px] uppercase tracking-widest group-hover:gap-4 transition-all">
                      {t('documents:list.viewDetail')} <ArrowRight size={16} />
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            {/* Pagination - Giống Curriculum */}
            {pagination.totalPages > 1 && (
              <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">
                  {t('documents:list.page', { page: currentPage, totalPages: pagination.totalPages })}
                </span>
                <div className="flex gap-2">
                  <button 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-20 transition-all"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    disabled={currentPage === pagination.totalPages} 
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-20 transition-all"
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

export default DocumentListPage;