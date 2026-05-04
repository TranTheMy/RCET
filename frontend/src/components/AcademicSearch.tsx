import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, BookOpen, FileText, Presentation, Lightbulb } from 'lucide-react';
import api from '../config/api';

interface SearchItem {
  Id: number | string;
  Title: string;
  Type: 'document' | 'project' | 'curriculum' | 'research';
  Subtitle?: string;
  Status?: string;
}

interface SearchResults {
  documents: SearchItem[];
  curriculums: SearchItem[];
  projects: SearchItem[];
  research: SearchItem[];
}

interface SearchMeta {
  mode: 'global' | 'scoped';
  scope: string;
  keyword: string;
  scopeSource: 'query' | 'tag' | 'none';
}

interface AcademicSearchProps {
  isScrolled?: boolean;
  t?: (key: string) => string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const AcademicSearch = ({ isScrolled, t }: AcademicSearchProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({
    documents: [],
    curriculums: [],
    projects: [],
    research: [],
  });
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    const hasText = debouncedQuery.trim().length > 0;

    if (!hasText) {
      setResults({ documents: [], curriculums: [], projects: [], research: [] });
      setMeta(null);
      setIsOpen(false);
      return;
    }

    const fetchSearchResults = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string> = { q: debouncedQuery.trim() };

        const { data: body } = await api.get('/search', { params });

        if (body?.success && body.data) {
          const { meta: m, documents, curriculums, projects, research } = body.data as SearchResults & {
            meta: SearchMeta;
          };
          setMeta(m ?? null);
          setResults({
            documents: documents ?? [],
            curriculums: curriculums ?? [],
            projects: projects ?? [],
            research: research ?? [],
          });
          setIsOpen(true);
        }
      } catch {
        setResults({ documents: [], curriculums: [], projects: [], research: [] });
        setMeta(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSearchResults();
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigate = (type: string, id: number | string) => {
    setIsOpen(false);
    setQuery('');

    const routes: Record<string, string> = {
      project: `/projects/${id}`,
      document: `/documents/${id}`,
      curriculum: `/curriculum/${id}`,
      research: `/research/${id}`,
    };

    if (routes[type]) navigate(routes[type]);
  };

  const placeholder =
    t?.('tìm kiếm...') ??
    'Tìm kiếm… hoặc @project, @document, @curriculum, @research';

  const metaHint =
    meta?.mode === 'scoped'
      ? meta.keyword
        ? `Phân vùng: ${meta.scope} · từ khóa: “${meta.keyword}”`
        : `Phân vùng: ${meta.scope} · mới cập nhật`
      : meta?.keyword
        ? `Tìm toàn hệ thống: “${meta.keyword}”`
        : null;

  return (
    <div className="relative" ref={searchRef}>
      <div
        className={`hidden xl:flex items-center rounded-xl px-3 py-1.5 border transition-all focus-within:ring-1 focus-within:ring-cyan-500/50 ${
          isScrolled ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center min-w-0 flex-1">
          {isLoading ? (
            <Loader2 size={14} className="animate-spin text-cyan-500 shrink-0" />
          ) : (
            <Search size={14} className={isScrolled ? 'text-slate-400 shrink-0' : 'text-slate-500 shrink-0'} />
          )}

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (query.trim()) setIsOpen(true);
            }}
            className={`bg-transparent text-xs ml-2 outline-none w-28 focus:w-64 transition-all font-semibold ${
              isScrolled ? 'text-slate-100 placeholder:text-slate-400' : 'text-slate-700 placeholder:text-slate-400'
            }`}
            placeholder={placeholder}
            aria-label={t?.('actions.searchAria') ?? 'Tìm kiếm'}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 w-[380px] bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden z-50 right-0 animate-in fade-in zoom-in duration-200">
          {metaHint && (
            <div className="px-3 py-2 text-[10px] text-slate-500 border-b border-slate-100 bg-slate-50/80">
              {metaHint}
            </div>
          )}
          <div className="max-h-[450px] overflow-y-auto p-2 scrollbar-thin">
            <SearchSection
              title="Tài liệu"
              icon={<FileText size={12} />}
              items={results.documents}
              onItemClick={handleNavigate}
            />

            <SearchSection
              title="Khung chương trình"
              icon={<BookOpen size={12} />}
              items={results.curriculums}
              onItemClick={handleNavigate}
            />

            <SearchSection
              title="Dự án"
              icon={<Presentation size={12} />}
              items={results.projects}
              onItemClick={handleNavigate}
            />

            <SearchSection
              title="Nghiên cứu"
              icon={<Lightbulb size={12} />}
              items={results.research}
              onItemClick={handleNavigate}
            />

            {!results.documents.length &&
              !results.curriculums.length &&
              !results.projects.length &&
              !results.research.length && (
                <div className="py-10 text-center flex flex-col items-center justify-center text-slate-400">
                  <Search size={32} strokeWidth={1.5} className="mb-3 text-slate-200" />
                  <span className="text-sm font-medium text-slate-600">Không tìm thấy kết quả</span>
                  <span className="text-xs mt-1 px-10">
                    Thử từ khóa khác, chọn phân vùng bên trên, hoặc gõ @project, @document, @curriculum, @research
                    trong ô tìm.
                  </span>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

const SearchSection = ({
  title,
  icon,
  items,
  onItemClick,
}: {
  title: string;
  icon: React.ReactNode;
  items: SearchItem[];
  onItemClick: (t: string, id: string | number) => void;
}) => {
  if (!items?.length) return null;

  return (
    <div className="mb-4">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase px-3 mb-2 flex items-center gap-2 tracking-wider">
        {icon} {title}
      </h4>
      {items.map((item) => (
        <div
          key={String(item.Id)}
          role="button"
          tabIndex={0}
          onClick={() => onItemClick(item.Type, item.Id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onItemClick(item.Type, item.Id);
            }
          }}
          className="group px-3 py-2.5 hover:bg-cyan-50/50 rounded-lg cursor-pointer transition-all border border-transparent hover:border-cyan-100"
        >
          <div className="font-semibold text-slate-800 text-sm truncate group-hover:text-cyan-700">{item.Title}</div>
          {item.Subtitle && (
            <div className="text-[11px] text-slate-500 mt-0.5 truncate italic">{item.Subtitle}</div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AcademicSearch;
