import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ExternalLink,
  Microscope,
  Quote,
  Star,
  Award,
  Trophy,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import { researchService } from '../services/research.service';
import type { ResearchImpactRank, ResearchItem } from '../types';
import { useTranslation } from 'react-i18next';

type FeaturedResearchItem = {
  id: ResearchItem['id'];
  title: ResearchItem['title'];
  authors: ResearchItem['authors'];
  journal: ResearchItem['journal'];
  description?: string | null;
  pdf_url?: string | null;
  source_type?: ResearchItem['source_type'];
  impact_rank?: ResearchItem['impact_rank'] | string;
  total_citations?: number | null;
};

/** Bộ lọc đồng bộ với GET /research/public|internal (backend). */
export type ResearchAwarkServerFilters = {
  q: string;
  tags: string[];
  impact_ranks: ResearchImpactRank[];
  peer_reviewed: 'all' | 'yes' | 'no';
  open_access: 'all' | 'yes' | 'no';
  source_type: 'all' | 'upload' | 'link';
  readonly_highlight: boolean;
};

/** Chỉ hiển thị bài Q1 / Q2 (Scimago). Luôn áp dụng; không cho override qua `serverFilters`. */
const AWARK_ONLY_IMPACT_RANKS: ResearchImpactRank[] = ['Q1', 'Q2'];

const DEFAULT_SERVER_FILTERS: ResearchAwarkServerFilters = {
  q: '',
  tags: [],
  impact_ranks: AWARK_ONLY_IMPACT_RANKS,
  peer_reviewed: 'all',
  open_access: 'all',
  source_type: 'all',
  // false: mọi Q1/Q2 gồm upload có PDF; true = segment readonly (backend).
  readonly_highlight: false,
};

type ResearchAwarkProps = {
  /** Số thẻ mỗi trang (server) hoặc kích thước trang / tối đa (props). */
  maxItems?: number;
  /**
   * Chỉ dùng khi `serverScope` không có: phân trang cục bộ trên `items`.
   * Trang chủ: `paginate={false}`.
   */
  paginate?: boolean;
  tagLabel?: string;
  title?: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Chế độ props (Home, …) */
  items?: FeaturedResearchItem[];
  /** Phân trang + lọc trên server */
  serverScope?: 'public' | 'internal';
  serverFilters?: Partial<ResearchAwarkServerFilters>;
  /** Tăng sau mỗi lần tải lại danh sách lớn (vd. realtime). */
  refreshKey?: number;
};

const ResearchAwark: React.FC<ResearchAwarkProps> = ({
  maxItems = 3,
  paginate = true,
  tagLabel,
  title,
  ctaLabel,
  ctaHref,
  items: itemsProp,
  serverScope,
  serverFilters: serverFiltersPartial,
  refreshKey = 0,
}) => {
  const { t } = useTranslation();
  const pageSize = Math.max(1, maxItems);
  const isServer = serverScope === 'public' || serverScope === 'internal';

  const serverFx = useMemo((): ResearchAwarkServerFilters => {
    const merged = { ...DEFAULT_SERVER_FILTERS, ...serverFiltersPartial };
    return { ...merged, impact_ranks: AWARK_ONLY_IMPACT_RANKS };
  }, [serverFiltersPartial]);
  const filtersKey = useMemo(() => JSON.stringify(serverFx), [serverFx]);

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(isServer);
  const [rows, setRows] = useState<FeaturedResearchItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [apiPage, setApiPage] = useState(1);

  useLayoutEffect(() => {
    if (!isServer) return;
    setPage(1);
  }, [filtersKey, isServer]);

  useEffect(() => {
    if (!isServer) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = {
          page,
          limit: pageSize,
          q: serverFx.q,
          tags: serverFx.tags,
          impact_ranks: serverFx.impact_ranks,
          peer_reviewed: serverFx.peer_reviewed,
          open_access: serverFx.open_access,
          source_type: serverFx.source_type,
          readonly_highlight: serverFx.readonly_highlight,
        };
        const fetchOnce = async (scope: 'public' | 'internal') => {
          const res =
            scope === 'public'
              ? await researchService.listPublic(params)
              : await researchService.listApprovedAll(params);
          if (cancelled) return;
          const payload = res.data;
          setRows((payload?.items ?? []) as FeaturedResearchItem[]);
          const p = payload?.pagination;
          if (p) {
            setTotalPages(Math.max(1, p.totalPages));
            setTotalCount(p.total);
            setApiPage(p.page);
          } else {
            setTotalPages(1);
            setTotalCount(payload?.items?.length ?? 0);
            setApiPage(1);
          }
        };

        try {
          await fetchOnce(serverScope === 'public' ? 'public' : 'internal');
        } catch (firstErr) {
          if (
            serverScope === 'internal' &&
            axios.isAxiosError(firstErr) &&
            firstErr.response?.status === 401
          ) {
            await fetchOnce('public');
          } else {
            throw firstErr;
          }
        }
      } catch {
        if (!cancelled) {
          toast.error(t('research:awards.toasts.fetchFailed'));
          setRows([]);
          setTotalPages(1);
          setTotalCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isServer, serverScope, page, pageSize, serverFx, refreshKey, t]);

  useEffect(() => {
    if (!isServer) return;
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [isServer, totalPages]);

  const itemsQ1Q2 = useMemo(() => {
    const list = itemsProp ?? [];
    return list.filter((it) => it.impact_rank === 'Q1' || it.impact_rank === 'Q2');
  }, [itemsProp]);

  /** Props mode: phân trang cục bộ */
  const itemsKey = useMemo(() => itemsQ1Q2.map((i) => i.id).join('|'), [itemsQ1Q2]);

  useEffect(() => {
    if (isServer) return;
    setPage(1);
  }, [itemsKey, isServer]);

  const propsTotalPages = useMemo(() => {
    if (isServer) return 1;
    if (!paginate) return 1;
    return Math.max(1, Math.ceil(itemsQ1Q2.length / pageSize));
  }, [isServer, paginate, itemsQ1Q2.length, pageSize]);

  const propsSafePage = Math.min(Math.max(1, page), propsTotalPages);

  useEffect(() => {
    if (isServer) return;
    if (page !== propsSafePage) setPage(propsSafePage);
  }, [isServer, page, propsSafePage]);

  const propsFeatured = useMemo(() => {
    if (isServer) return [];
    if (!paginate) return itemsQ1Q2.slice(0, pageSize);
    const start = (propsSafePage - 1) * pageSize;
    return itemsQ1Q2.slice(start, start + pageSize);
  }, [isServer, itemsQ1Q2, pageSize, paginate, propsSafePage]);

  const featured = isServer ? rows : propsFeatured;
  const safePage = isServer ? Math.min(Math.max(1, page), totalPages) : propsSafePage;
  const effectiveTotalPages = isServer ? totalPages : propsTotalPages;
  const showPagination = isServer
    ? !loading && totalCount > pageSize
    : paginate && itemsQ1Q2.length > pageSize;

  const rangeStart = isServer
    ? totalCount === 0
      ? 0
      : (apiPage - 1) * pageSize + 1
    : (safePage - 1) * pageSize + 1;
  const rangeEnd = isServer
    ? Math.min(apiPage * pageSize, totalCount)
    : Math.min(safePage * pageSize, itemsQ1Q2.length);

  if (isServer && !loading && featured.length === 0) return null;
  if (!isServer && featured.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6 px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-[#6366F1]" />
            <span className="text-[#6366F1] font-black text-[10px] uppercase tracking-[0.4em]">
              {tagLabel || t('research:awards.tagLabel')}
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none flex items-center gap-3">
            {title || t('research:awards.title')}
            <Sparkles size={28} className="text-amber-400" />
          </h2>
        </div>

        {ctaLabel && ctaHref && (
          <Link
            to={ctaHref}
            className="group flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-[#6366F1] transition-all"
          >
            <span className="border-b-2 border-transparent group-hover:border-[#6366F1] pb-1">{ctaLabel}</span>
            <ArrowUpRight size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </Link>
        )}
      </div>

      {isServer && loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {Array.from({ length: pageSize }).map((_, i) => (
            <div
              key={`sk-${i}`}
              className="rounded-[40px] border border-slate-100 bg-white/80 p-8 shadow-sm animate-pulse h-[320px]"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {featured.map((it, index) => {
            const globalIndex = isServer
              ? (apiPage - 1) * pageSize + index
              : (safePage - 1) * pageSize + index;
            return (
              <div key={it.id} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-orange-500 to-[#6366F1] rounded-[40px] blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-700" />

                <article className="relative h-full bg-white/90 backdrop-blur-sm rounded-[40px] border border-slate-100 p-8 shadow-sm hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] hover:border-amber-200/50 transition-all duration-500 flex flex-col z-10">
                  <div className="absolute -top-3 -right-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-black uppercase tracking-widest py-2 px-4 rounded-full shadow-lg shadow-orange-500/30 flex items-center gap-1.5 z-20 group-hover:scale-110 transition-transform duration-300">
                    <Trophy size={12} className="fill-white/20" />
                    {globalIndex === 0 ? t('research:awards.badges.bestPaper') : t('research:awards.badges.topImpact')}
                  </div>

                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-full border border-amber-100/50 group-hover:border-amber-200 transition-colors">
                      <Star size={10} className="text-amber-500 fill-amber-500" />
                      <span className="text-[9px] font-black uppercase text-amber-700">
                        {t('research:awards.rankPrefix')}: {it.impact_rank || t('research:awards.noRank')}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic pt-1">
                      {it.journal || t('research:awards.journalFallback')}
                    </span>
                  </div>

                  <h4 className="text-xl font-black text-slate-900 leading-tight mb-4 group-hover:text-[#6366F1] transition-colors line-clamp-3">
                    {it.title}
                  </h4>

                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-amber-50 transition-colors">
                      <Microscope size={14} className="text-slate-400 group-hover:text-amber-500" />
                    </div>
                    <p className="text-[13px] font-bold text-slate-600 italic line-clamp-1">{it.authors}</p>
                  </div>

                  <div className="mt-auto pt-8 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      {it.pdf_url ? (
                        <a
                          href={it.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#6366F1] hover:text-slate-900 transition-colors"
                        >
                          <ExternalLink size={14} /> {t('research:awards.openSource')}
                        </a>
                      ) : (
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">{t('research:awards.confidential')}</span>
                      )}

                      <div className="flex items-center gap-1.5 text-orange-400/80 group-hover:text-orange-500 transition-colors">
                        <Quote size={12} className="fill-current opacity-50" />
                        <span className="text-[11px] font-black italic">{t('research:awards.citations', { count: it.total_citations ?? 0 })}</span>
                      </div>
                    </div>

                    <Link
                      to={`/publication/research/${it.id}`}
                      className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-gradient-to-br hover:from-amber-400 hover:to-orange-500 hover:shadow-lg hover:shadow-orange-500/20 transition-all group-hover:rotate-[-45deg]"
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  </div>

                  <div className="absolute top-0 right-10 w-24 h-[1px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </article>
              </div>
            );
          })}
        </div>
      )}

      {showPagination ? (
        <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-2">
          <p className="text-[11px] font-bold text-slate-500 tabular-nums">
            {t('research:awards.pagination.showing', {
              start: rangeStart,
              end: rangeEnd,
              total: isServer ? totalCount : itemsQ1Q2.length,
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t('research:awards.pagination.prevAria')}
              disabled={safePage <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-[#6366F1] hover:text-[#6366F1] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-1 px-2 min-h-[2.25rem]">
              {effectiveTotalPages <= 7 ? (
                Array.from({ length: effectiveTotalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={loading}
                    onClick={() => setPage(p)}
                    className={`min-w-[2.25rem] h-9 rounded-xl text-[11px] font-black tabular-nums transition-colors ${
                      p === safePage
                        ? 'bg-[#6366F1] text-white shadow-md shadow-indigo-500/25'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))
              ) : (
                <span className="px-4 text-[11px] font-black text-slate-600 tabular-nums tracking-tight">
                  {t('research:awards.pagination.pageOf', { page: safePage, totalPages: effectiveTotalPages })}
                </span>
              )}
            </div>
            <button
              type="button"
              aria-label={t('research:awards.pagination.nextAria')}
              disabled={safePage >= effectiveTotalPages || loading}
              onClick={() => setPage((p) => Math.min(effectiveTotalPages, p + 1))}
              className="inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-[#6366F1] hover:text-[#6366F1] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default ResearchAwark;
