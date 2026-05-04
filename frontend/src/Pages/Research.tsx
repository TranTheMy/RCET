import React, { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Search, Quote, LayoutGrid, List, ArrowUpRight, Cpu, Bot, Download,
  Database, ShieldCheck, Microscope, SlidersHorizontal, X, Link as LinkIcon, Tag,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { researchService } from '../services/research.service';
import { realtimeService } from '../services/realtime.service';
import type { ResearchItem, ResearchImpactRank, ResearchListQueryParams, ResearchListPaginationMeta } from '../types';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import ResearchAwark from '../components/ResearchAwark';
import { useTranslation } from 'react-i18next';

const getUploadsBaseUrl = () => {
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000/api';
  return apiUrl.replace(/\/api\/?$/, '');
};

const resolveUploadHref = (raw?: string | null): string | null => {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = getUploadsBaseUrl();
  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

const IMPACT_OPTIONS: ResearchImpactRank[] = ['No Rank', 'Q1', 'Q2', 'Q3', 'Q4'];

/** Tag gợi ý — luôn hiển thị trong sidebar & bộ lọc, cộng thêm mọi tag từ API */
const TAG_PRESET = ['AI/ML', 'FPGA', 'Robotics', 'Embedded', 'DSP', 'IoT', 'Other'] as const;

function normalizeTag(t: string): string {
  return String(t).trim();
}

const RESEARCH_SYNC_EVENT = 'research-status-updated';
const RESEARCH_POLLING_MS = 5000;
const RESEARCH_DB_PAGE_SIZE = 8;

/** Khớp ResearchAwark (Q1/Q2, không segment). `limit: 1` chỉ để đọc `pagination.total`. */
const Q1Q2_AWARK_PROBE_PARAMS: ResearchListQueryParams = {
  page: 1,
  limit: 1,
  impact_ranks: ['Q1', 'Q2'],
  peer_reviewed: 'all',
  open_access: 'all',
  source_type: 'all',
};

function mergeAllTagsFromFacets(tagCounts: Record<string, number>, locale: string): string[] {
  const set = new Set<string>([...TAG_PRESET, ...Object.keys(tagCounts)]);
  return Array.from(set).sort((a, b) => a.localeCompare(b, locale));
}

function normalizeListPagination(
  payload: { items?: ResearchItem[]; pagination?: ResearchListPaginationMeta } | undefined,
  fallbackPage: number,
  limit: number,
): ResearchListPaginationMeta {
  const p = payload?.pagination;
  if (p) return p;
  const n = payload?.items?.length ?? 0;
  return {
    page: fallbackPage,
    limit,
    total: n,
    totalPages: Math.max(1, Math.ceil(n / limit) || 1),
  };
}

/* Sao băng: từ góc trên-phải → góc dưới-trái; gradient to top = đầu sáng ở đầu quỹ đạo (đầu cắm theo hướng rơi) */
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

const ResearchHero: React.FC<{
  isAuthenticated: boolean;
  isBasicUser: boolean;
  isVienTruong: boolean;
  isAdmin: boolean;
}> = ({ isAuthenticated, isBasicUser, isVienTruong, isAdmin }) => {
  const { t } = useTranslation();
  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMeteors((prev) => {
        const spec: MeteorSpec = {
          id: Date.now(),
          top: `${-(4 + Math.random() * 14)}%`,
          right: `${Math.random() * 38}%`,
          animationDuration: `${Math.random() * 2 + 2}s`,
        };
        return [...prev.slice(-10), spec];
      });
    }, 1500);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="bg-[#0F172A] pt-28 pb-48 relative overflow-hidden border-b border-white/5">
      <style>{meteorStyles}</style>

      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(#6366F1 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {meteors.map((m) => (
          <div
            key={m.id}
            className="meteor"
            style={{
              top: m.top,
              right: m.right,
              animationDuration: m.animationDuration,
            }}
          />
        ))}

        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#6366F1] rounded-full blur-[150px] opacity-20 -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-500 rounded-full blur-[150px] opacity-10 translate-y-1/2 -translate-x-1/4" />
      </div>

      <div className="max-w-[1440px] mx-auto px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
          <div className="flex-1 space-y-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
              <div className="flex -space-x-2">
                <div className="w-5 h-5 rounded-full border border-[#0F172A] bg-[#6366F1] flex items-center justify-center">
                  <Cpu size={10} className="text-white" />
                </div>
                <div className="w-5 h-5 rounded-full border border-[#0F172A] bg-cyan-400 flex items-center justify-center">
                  <Bot size={10} className="text-slate-900" />
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">{t('research:hero.kicker')}</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-black tracking-tight text-white leading-[0.9] uppercase">
              Robotics <span className="italic font-light text-slate-500">&</span> <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] via-indigo-400 to-cyan-300">
                AI Chip Research.
              </span>
            </h1>

            <p className="text-slate-400 text-lg font-medium max-w-xl leading-relaxed">{t('research:hero.description')}</p>

            <div className="flex flex-wrap gap-4 pt-4">
              {isAuthenticated && !isBasicUser && (
                <>
                  {isVienTruong ? (
                    <Link
                      to="/publication/research/approvals"
                      className="group flex items-center gap-3 px-8 py-4 bg-[#6366F1] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-500 transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]"
                    >
                      {t('research:hero.actions.approvals')}{' '}
                      <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </Link>
                  ) : (
                    !isAdmin && (
                      <>
                        <Link
                          to="/publication/research/submit"
                          className="group flex items-center gap-3 px-8 py-4 bg-[#6366F1] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-500 transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]"
                        >
                          {t('research:hero.actions.submit')}{' '}
                          <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </Link>
                        <Link
                          to="/publication/research/mine"
                          className="group flex items-center gap-3 px-8 py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-white/10 transition-all"
                        >
                          {t('research:hero.actions.mine')}{' '}
                          <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </Link>
                      </>
                    )
                  )}
                </>
              )}
            </div>
          </div>

          <div className="hidden lg:block w-96 relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-[#6366F1] to-cyan-400 rounded-[40px] blur-3xl opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className="relative bg-slate-900/80 backdrop-blur-3xl border border-white/10 p-8 rounded-[40px] shadow-2xl">
              <div className="space-y-6">
                <div className="flex justify-between items-end border-b border-white/5 pb-4">
                  <span className="text-slate-500 text-[10px] font-black uppercase">Active Nodes</span>
                  <span className="text-white font-mono text-xl">05.21.00</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-4">
                  <span className="text-slate-500 text-[10px] font-black uppercase">Core Citations</span>
                  <span className="text-[#6366F1] font-mono text-xl">1.24k+</span>
                </div>
                <div className="pt-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-500 text-[10px] font-black uppercase">Hub Status</span>
                    <span className="text-cyan-400 text-[10px] font-black uppercase">Optimal</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="w-[85%] h-full bg-gradient-to-r from-[#6366F1] to-cyan-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Research: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [dlItems, setDlItems] = useState<ResearchItem[]>([]);
  const [roItems, setRoItems] = useState<ResearchItem[]>([]);
  const [dlPagination, setDlPagination] = useState<ResearchListPaginationMeta>({
    page: 1,
    limit: RESEARCH_DB_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [roPagination, setRoPagination] = useState<ResearchListPaginationMeta>({
    page: 1,
    limit: RESEARCH_DB_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [dlPage, setDlPage] = useState(1);
  const [roPage, setRoPage] = useState(1);
  const [q, setQ] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  /** Lọc theo từ khóa (tags) — chọn nhiều: bài khớp nếu có ít nhất một tag đã chọn */
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [impactRanks, setImpactRanks] = useState<ResearchImpactRank[]>([]);
  const [peerMode, setPeerMode] = useState<'all' | 'yes' | 'no'>('all');
  const [openMode, setOpenMode] = useState<'all' | 'yes' | 'no'>('all');
  const [sourceMode, setSourceMode] = useState<'all' | 'upload' | 'link'>('all');
  const [highlightRefresh, setHighlightRefresh] = useState(0);
  /** Chỉ mount ResearchAwark khi có ≥1 bài Q1/Q2 đã duyệt (probe trong load). */
  const [hasQ1Q2ForAwark, setHasQ1Q2ForAwark] = useState(false);
  const filterWrapRef = useRef<HTMLDivElement>(null);

  const { isAuthenticated, user, initialized } = useAuthStore();
  const role = user?.system_role;
  const isBasicUser = role === 'user';
  /** Sau khi auth init xong: member+ dùng internal; khách & role `user` dùng public (tránh 401/403) */
  const useInternalResearchApi = initialized && isAuthenticated && !isBasicUser;
  const isVienTruong = role === 'vien_truong';
  const isAdmin = role === 'admin';
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  const impactLabel = useCallback(
    (rank: ResearchImpactRank) => {
      if (rank === 'No Rank') return t('research:impact.noRank');
      return rank;
    },
    [t],
  );

  const buildDbParams = useCallback(
    (segment: 'downloadable' | 'readonly', page: number): ResearchListQueryParams => ({
      page,
      limit: RESEARCH_DB_PAGE_SIZE,
      q: q.trim() || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
      impact_ranks: impactRanks.length ? impactRanks : undefined,
      peer_reviewed: peerMode,
      open_access: openMode,
      source_type: sourceMode,
      segment,
    }),
    [q, selectedTags, impactRanks, peerMode, openMode, sourceMode],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!initialized) return;
      if (!silent) setLoading(true);

      const fetchLists = async (useInternal: boolean) => {
        const listFn = useInternal ? researchService.listApprovedAll : researchService.listPublic;
        const facetsFn = useInternal ? researchService.tagFacetsInternal : researchService.tagFacetsPublic;
        const [facetsRes, dlRes, roRes, q1q2ProbeRes] = await Promise.all([
          facetsFn(),
          listFn(buildDbParams('downloadable', dlPage)),
          listFn(buildDbParams('readonly', roPage)),
          listFn(Q1Q2_AWARK_PROBE_PARAMS),
        ]);
        setTagCounts(facetsRes.data?.tagCounts ?? {});
        const dlPayload = dlRes.data;
        const roPayload = roRes.data;
        setDlItems(dlPayload?.items ?? []);
        setRoItems(roPayload?.items ?? []);
        setDlPagination(normalizeListPagination(dlPayload, dlPage, RESEARCH_DB_PAGE_SIZE));
        setRoPagination(normalizeListPagination(roPayload, roPage, RESEARCH_DB_PAGE_SIZE));

        const q1q2Payload = q1q2ProbeRes.data;
        const q1q2Total = normalizeListPagination(q1q2Payload, 1, 1).total;
        const hasQ1Q2 = q1q2Total > 0;
        setHasQ1Q2ForAwark(hasQ1Q2);
        if (hasQ1Q2) setHighlightRefresh((n) => n + 1);
      };

      try {
        await fetchLists(useInternalResearchApi);
      } catch (err) {
        if (
          useInternalResearchApi &&
          axios.isAxiosError(err) &&
          err.response?.status === 401
        ) {
          try {
            await fetchLists(false);
          } catch {
            if (!silent) toast.error(t('research:database.toasts.fetchFailed'));
          }
        } else if (!silent) {
          toast.error(t('research:database.toasts.fetchFailed'));
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [initialized, useInternalResearchApi, buildDbParams, dlPage, roPage, t],
  );

  const dbFiltersKey = useMemo(
    () =>
      JSON.stringify({
        q: q.trim(),
        selectedTags,
        impactRanks,
        peerMode,
        openMode,
        sourceMode,
        useInternalResearchApi,
      }),
    [q, selectedTags, impactRanks, peerMode, openMode, sourceMode, useInternalResearchApi],
  );

  useLayoutEffect(() => {
    setDlPage(1);
    setRoPage(1);
  }, [dbFiltersKey]);

  useEffect(() => {
    if (!initialized) return;
    load();
  }, [load, initialized]);

  useEffect(() => {
    if (!initialized) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load({ silent: true });
      }
    }, RESEARCH_POLLING_MS);
    return () => window.clearInterval(id);
  }, [load, initialized]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === RESEARCH_SYNC_EVENT) load({ silent: true });
    };
    const onLocalSync = () => load({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    const onFocus = () => load({ silent: true });
    window.addEventListener('storage', onStorage);
    window.addEventListener(RESEARCH_SYNC_EVENT, onLocalSync);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(RESEARCH_SYNC_EVENT, onLocalSync);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleLoad = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => load({ silent: true }), 400);
    };

    const socket = realtimeService.connect(user?.id);
    const unsubStatus = realtimeService.onResearchStatusUpdated(scheduleLoad);
    const unsubPending = realtimeService.onResearchPendingSubmitted(scheduleLoad);

    const onSocketConnect = () => {
      load({ silent: true });
    };
    socket.on('connect', onSocketConnect);
    socket.on('connect_error', () => {});

    return () => {
      clearTimeout(debounceTimer);
      unsubStatus();
      unsubPending();
      socket.off('connect', onSocketConnect);
    };
  }, [user?.id, load]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!filterOpen) return;
      const el = filterWrapRef.current;
      if (el && !el.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterOpen]);

  const allTags = useMemo(() => mergeAllTagsFromFacets(tagCounts, dateLocale), [tagCounts, dateLocale]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (q.trim()) n += 1;
    if (selectedTags.length > 0) n += 1;
    if (impactRanks.length > 0) n += 1;
    if (peerMode !== 'all') n += 1;
    if (openMode !== 'all') n += 1;
    if (sourceMode !== 'all') n += 1;
    return n;
  }, [q, selectedTags, impactRanks, peerMode, openMode, sourceMode]);

  const clearFilters = useCallback(() => {
    setQ('');
    setSelectedTags([]);
    setImpactRanks([]);
    setPeerMode('all');
    setOpenMode('all');
    setSourceMode('all');
  }, []);

  const toggleImpact = (rank: ResearchImpactRank) => {
    setImpactRanks((prev) =>
      prev.includes(rank) ? prev.filter((r) => r !== rank) : [...prev, rank],
    );
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  // Quyền tải về: Upload có file_url/file_path => được tải. Còn lại => link/đọc
  const downloadAllowed = (it: ResearchItem) =>
    it.source_type === 'upload' && !!(it.file_url || it.file_path);

  /** Khối tiêu biểu: Q1/Q2 toàn bộ (kể cả upload có PDF), không đồng bộ ô tìm kiếm / lưới. */
  const awarkServerFilters = useMemo(
    () =>
      ({
        q: '',
        tags: [] as string[],
        peer_reviewed: 'all' as const,
        open_access: 'all' as const,
        source_type: 'all' as const,
        readonly_highlight: false as const,
      }),
    [],
  );

  // HÀM RENDER COMPONENT CARD CHUNG CHO CẢ 2 DANH SÁCH
  const renderItemCard = (it: ResearchItem) => {
    const isDownload = downloadAllowed(it);
    const fileHref = resolveUploadHref(it.file_url || it.file_path);
    const linkHref = it.pdf_url || null;
    const targetUrl = isDownload ? fileHref : linkHref;

    return (
      <article key={it.id} className="group bg-white rounded-[32px] border border-slate-100 p-8 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] hover:border-indigo-100 transition-all flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isDownload ? 'bg-cyan-500' : 'bg-rose-400'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{it.journal || t('research:database.card.journalFallback')}</span>
          </div>
          <div className="px-3 py-1 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase italic border border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
            {t('research:database.card.rankPrefix')}: {it.impact_rank ? impactLabel(it.impact_rank) : t('research:database.card.na')}
          </div>
        </div>

        <h3 className="text-xl font-black text-slate-900 leading-tight mb-4 group-hover:text-[#6366F1] transition-colors line-clamp-2">
          {it.title}
        </h3>

        <div
          className={`flex items-center gap-2 ${it.tags && it.tags.length > 0 ? 'mb-4' : 'mb-6'}`}
        >
          <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center"><Microscope size={12} className="text-[#6366F1]" /></div>
          <p className="text-xs font-bold text-slate-600 italic line-clamp-1">{it.authors}</p>
        </div>

        {it.tags && it.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mb-6" aria-label={t('research:database.card.tagsAria')}>
            {(it.tags || []).map((raw, ti) => {
              const label = normalizeTag(raw);
              if (!label) return null;
              return (
                <span
                  key={`${it.id}-tag-${ti}-${label}`}
                  className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-50 text-[10px] font-bold text-slate-600 border border-slate-100"
                >
                  {label}
                </span>
              );
            })}
          </div>
        ) : null}

        <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {targetUrl ? (
              <a
                href={targetUrl}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  isDownload ? 'text-indigo-500 hover:text-slate-900' : 'text-rose-500 hover:text-rose-900'
                }`}
              >
                {isDownload ? (
                  <>
                    <Download size={14} /> {t('research:database.card.downloadPdf')}
                  </>
                ) : (
                  <>
                    <LinkIcon size={14} /> {t('research:database.card.externalLink')}
                  </>
                )}
              </a>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                {t('research:database.card.unavailable')}
              </span>
            )}
            <span className="text-[10px] font-bold text-slate-300 uppercase italic flex items-center gap-1">
              <Quote size={10} /> {t('research:database.card.citations', { count: it.total_citations || 0 })}
            </span>
          </div>
          <Link to={`/publication/research/${it.id}`} className="p-3 bg-slate-900 text-white rounded-xl hover:bg-[#6366F1] transition-all group-hover:rotate-[-45deg]">
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-[#6366F1] selection:text-white">

      <ResearchHero
        isAuthenticated={isAuthenticated}
        isBasicUser={isBasicUser}
        isVienTruong={isVienTruong}
        isAdmin={isAdmin}
      />

      {/* 2. MAIN CONTENT (HIGHLIGHTS + DATA GRID) */}
      <section className="max-w-[1440px] mx-auto px-8 -mt-28 relative z-20 pb-32">

        {hasQ1Q2ForAwark ? (
          <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <ResearchAwark
              serverScope={useInternalResearchApi ? 'internal' : 'public'}
              serverFilters={awarkServerFilters}
              refreshKey={highlightRefresh}
              maxItems={3}
              tagLabel="R&D Intelligence Highlights"
              title="Nghiên cứu tiêu biểu."
              ctaLabel="View Full Archive"
              ctaHref="#database"
            />
          </div>
        ) : null}

        {/* Search Bar + Filter pop-up */}
        <div id="database" className="mb-16 max-w-4xl mx-auto scroll-mt-32">
          <div
            ref={filterWrapRef}
            className="bg-white/70 backdrop-blur-2xl p-3 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white relative z-30"
          >
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative flex-1 flex items-center min-w-0">
                <Search className="absolute left-6 text-slate-400 shrink-0" size={20} />
                <input
                  type="text"
                  placeholder={t('research:database.searchPlaceholder')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full pl-16 pr-4 py-4 bg-transparent border-none rounded-2xl outline-none text-slate-800 font-bold placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={() => setFilterOpen((o) => !o)}
                className={`shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterOpen || activeFilterCount > 0
                    ? 'bg-[#6366F1] text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)]'
                    : 'bg-slate-900 text-white hover:bg-[#6366F1]'
                }`}
              >
                <SlidersHorizontal size={16} />
                {t('research:filters.button')}
                {activeFilterCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-white/20 text-[9px] font-black flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {filterOpen && (
              <div className="absolute left-3 right-3 top-[calc(100%+8px)] z-50 rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)] p-5 space-y-5 text-left">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t('research:filters.title')}</p>
                  <div className="flex items-center gap-2">
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-[10px] font-bold text-[#6366F1] hover:underline"
                      >
                        {t('research:filters.clear')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFilterOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={t('research:filters.closeAria')}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                    {t('research:filters.tags')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((name) => {
                      const on = selectedTags.includes(name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleTagFilter(name)}
                          className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-colors text-left break-words ${
                            on
                              ? 'bg-indigo-50 text-[#6366F1] border-[#6366F1]'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {name}
                          <span className="ml-1 tabular-nums opacity-60">({tagCounts[name] ?? 0})</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1.5">{t('research:filters.tagsHint')}</p>
                </div>

                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('research:filters.impact')}</p>
                  <div className="flex flex-wrap gap-2">
                    {IMPACT_OPTIONS.map((rank) => {
                      const on = impactRanks.includes(rank);
                      return (
                        <button
                          key={rank}
                          type="button"
                          onClick={() => toggleImpact(rank)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-colors ${
                            on
                              ? 'bg-[#6366F1] text-white border-[#6366F1]'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                        {impactLabel(rank)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1.5">{t('research:filters.impactHint')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Peer-reviewed</p>
                    <select
                      value={peerMode}
                      onChange={(e) => setPeerMode(e.target.value as 'all' | 'yes' | 'no')}
                      className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                    >
                      <option value="all">{t('research:filters.options.all')}</option>
                      <option value="yes">{t('research:filters.options.yesPeerReviewed')}</option>
                      <option value="no">{t('research:filters.options.no')}</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Open access</p>
                    <select
                      value={openMode}
                      onChange={(e) => setOpenMode(e.target.value as 'all' | 'yes' | 'no')}
                      className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                    >
                      <option value="all">{t('research:filters.options.all')}</option>
                      <option value="yes">{t('research:filters.options.yesOpenAccess')}</option>
                      <option value="no">{t('research:filters.options.no')}</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('research:filters.source')}</p>
                    <select
                      value={sourceMode}
                      onChange={(e) => setSourceMode(e.target.value as 'all' | 'upload' | 'link')}
                      className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                    >
                      <option value="all">{t('research:filters.options.all')}</option>
                      <option value="upload">{t('research:filters.options.upload')}</option>
                      <option value="link">{t('research:filters.options.link')}</option>
                    </select>
                  </div>
                </div>

                <p className="text-[9px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
                  {t('research:filters.apiHint')}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">

          {/* SIDEBAR NAVIGATION */}
          <aside className="w-full lg:w-72 space-y-8">
            <div className="space-y-2">
              <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                {t('research:filters.tags')}
              </p>
              {allTags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTagFilter(tag)}
                    className={`w-full flex items-start justify-between gap-2 p-4 rounded-2xl transition-all text-left ${
                      active
                        ? 'bg-white shadow-md ring-2 ring-[#6366F1]/30'
                        : 'hover:bg-white hover:shadow-sm group'
                    }`}
                  >
                    <div
                      className={`flex items-start gap-3 min-w-0 font-bold text-sm ${
                        active ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-900'
                      }`}
                    >
                      <Tag size={16} className="text-[#6366F1] shrink-0 mt-0.5" />
                      <span className="break-words">{tag}</span>
                    </div>
                    <span
                      className={`text-[10px] font-black tabular-nums shrink-0 ${
                        active ? 'text-[#6366F1]' : 'text-slate-300 group-hover:text-cyan-500'
                      }`}
                    >
                      {tagCounts[tag] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-6 rounded-[32px] bg-gradient-to-br from-[#6366F1] to-indigo-700 text-white relative overflow-hidden group">
              <div className="relative z-10">
                <ShieldCheck className="mb-4 opacity-50" size={32} />
                <h5 className="font-black uppercase text-xs tracking-widest mb-2">{t('research:sidebar.verifiedTitle')}</h5>
                <p className="text-[11px] text-white/70 font-medium leading-relaxed">{t('research:sidebar.verifiedHint')}</p>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            </div>
          </aside>

          {/* MAIN DATA FEED - ĐÃ ĐƯỢC CHIA THÀNH 2 PHẦN */}
          <main className="flex-1 space-y-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Database size={18} className="text-[#6366F1]" />
                <h2 className="text-xl font-black uppercase tracking-tighter">{t('research:database.title')}</h2>
              </div>
              <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#F8FAFC] text-[#6366F1]' : 'text-slate-300'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#F8FAFC] text-[#6366F1]' : 'text-slate-300'}`}><List size={18} /></button>
              </div>
            </div>

            {loading ? (
              <div className="col-span-full h-64 flex items-center justify-center bg-white rounded-[40px] border border-dashed border-slate-200 text-slate-400 font-bold uppercase tracking-widest italic">
                {t('research:database.loading')}
              </div>
            ) : dlPagination.total === 0 && roPagination.total === 0 ? (
              <div className="col-span-full min-h-[220px] flex flex-col items-center justify-center gap-2 px-6 py-10 bg-white rounded-[40px] border border-slate-100 text-center">
                <p className="text-slate-700 font-bold text-sm md:text-base max-w-lg leading-relaxed">
                  {activeFilterCount > 0
                    ? t('research:database.emptyFiltered')
                    : t('research:database.emptyPublic')}
                </p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-2 text-[11px] font-black uppercase tracking-widest text-[#6366F1] hover:underline"
                  >
                    {t('research:filters.clear')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-12">
                {dlPagination.total > 0 && (
                  <div className="space-y-6">
                    <h3 className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-slate-800 pb-4 border-b border-slate-200/60">
                      <Download size={16} className="text-[#6366F1]" />
                      {t('research:database.sections.downloadable', { count: dlPagination.total })}
                    </h3>
                    <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
                      {dlItems.map(renderItemCard)}
                    </div>
                    {dlPagination.totalPages > 1 && (
                      <div className="flex items-center justify-center gap-4 pt-2">
                        <button
                          type="button"
                          disabled={dlPage <= 1}
                          onClick={() => setDlPage((p) => Math.max(1, p - 1))}
                          className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-[#6366F1] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          aria-label={t('research:database.pagination.prevAriaDownload')}
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                          {t('research:database.pagination.pageOf', { page: dlPage, totalPages: dlPagination.totalPages })}
                        </span>
                        <button
                          type="button"
                          disabled={dlPage >= dlPagination.totalPages}
                          onClick={() => setDlPage((p) => Math.min(dlPagination.totalPages, p + 1))}
                          className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-[#6366F1] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          aria-label={t('research:database.pagination.nextAriaDownload')}
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {roPagination.total > 0 && (
                  <div className="space-y-6">
                    <h3 className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-slate-800 pb-4 border-b border-slate-200/60">
                      <LinkIcon size={16} className="text-rose-500" />
                      {t('research:database.sections.links', { count: roPagination.total })}
                    </h3>
                    <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
                      {roItems.map(renderItemCard)}
                    </div>
                    {roPagination.totalPages > 1 && (
                      <div className="flex items-center justify-center gap-4 pt-2">
                        <button
                          type="button"
                          disabled={roPage <= 1}
                          onClick={() => setRoPage((p) => Math.max(1, p - 1))}
                          className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-rose-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          aria-label={t('research:database.pagination.prevAriaLinks')}
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                          {t('research:database.pagination.pageOf', { page: roPage, totalPages: roPagination.totalPages })}
                        </span>
                        <button
                          type="button"
                          disabled={roPage >= roPagination.totalPages}
                          onClick={() => setRoPage((p) => Math.min(roPagination.totalPages, p + 1))}
                          className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-rose-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          aria-label={t('research:database.pagination.nextAriaLinks')}
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
};

export default Research;