import { useState, useEffect, useRef, useMemo } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Menu, X, User, LogOut, ChevronDown,
  BookOpen, Microscope, Zap, Package, LayoutGrid,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../../store/authStore";
import { NotificationBell } from "../../../components/NotificationBell";
import { ROUTER } from "../../../routes/router";
import AcademicSearch from "../../../components/AcademicSearch";
import { projectService } from "../../../services/project.service";

const Header = () => {
  const { t, i18n } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'research' | 'connection' | 'training' | null>(null);
  const [truongLabHasProjects, setTruongLabHasProjects] = useState(false);

  const { user, isAuthenticated, logout, initialized } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const activePath = location.pathname;

  const navRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // --- Logic Thoát ---
  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate("/login");
  };

  // --- Click outside để đóng User Menu ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isGuest = initialized && (!isAuthenticated || !user);
  /** Tài khoản `user` (cơ bản): cùng phạm vi menu / khóa với khách — không Dự án / Đào tạo / thành viên */
  const treatsAsGuest = isGuest || user?.system_role === "user";

  type PubLink = {
    label: string;
    path: string;
    icon: typeof BookOpen;
    /** false = chỉ member+; khách / role `user`: ẩn mục (không dùng ổ khóa) */
    guestAllowed?: boolean;
    hasSubDropdown?: boolean;
    subItems?: Array<{ label: string; path: string; icon: typeof BookOpen; guestAllowed?: boolean }>;
  };

  const booksLinks: PubLink["subItems"] = useMemo(
    () => [
      {
        label: t('header.publications.books.curriculum'),
        path: "/publication/curriculum",
        icon: Microscope,
        guestAllowed: false,
      },
      {
        label: t('header.publications.books.documents'),
        path: "/publication/books/documents",
        icon: Zap,
        guestAllowed: false,
      },
    ],
    [t],
  );

  const researchLinks: PubLink[] = useMemo(
    () => [
      { label: t('header.publications.researchPapers'), path: ROUTER.USER.RESEARCH, icon: BookOpen, guestAllowed: true },
      {
        label: t('header.publications.booksAndPublications'),
        path: ROUTER.USER.DOCUMENTS,
        icon: Microscope,
        hasSubDropdown: true,
        subItems: booksLinks,
      },
    ],
    [t, booksLinks],
  );

  const connectionLinks: PubLink[] = useMemo(
    () => [
      { label: t('header.connection.info'), path: ROUTER.USER.INFORMATION, icon: Zap, guestAllowed: true },
      { label: t('header.connection.portal'), path: ROUTER.USER.INFORMATION_PORTAL, icon: BookOpen, guestAllowed: true },
      { label: t('header.connection.forums'), path: ROUTER.USER.FORUMS, icon: Package, guestAllowed: false },
    ],
    [t],
  );

  const trainingLinks: PubLink[] = useMemo(
    () => [{ label: t('header.training.verilog'), path: "/verilog", icon: BookOpen, guestAllowed: false }],
    [t],
  );

  const filterPubLinksForGuestOrBasicUser = (links: PubLink[], hideRestricted: boolean): PubLink[] => {
    if (!hideRestricted) return links;
    return links.flatMap((link) => {
      if (link.hasSubDropdown && link.subItems?.length) {
        const sub = link.subItems.filter((s) => s.guestAllowed === true);
        if (sub.length === 0) return [];
        return [{ ...link, subItems: sub }];
      }
      if (link.guestAllowed === false) return [];
      return [link];
    });
  };

  const visibleResearchLinks = useMemo(
    () => filterPubLinksForGuestOrBasicUser(researchLinks, treatsAsGuest),
    [researchLinks, treatsAsGuest],
  );
  const visibleConnectionLinks = useMemo(
    () => filterPubLinksForGuestOrBasicUser(connectionLinks, treatsAsGuest),
    [connectionLinks, treatsAsGuest],
  );
  const visibleTrainingLinks = useMemo(
    () => filterPubLinksForGuestOrBasicUser(trainingLinks, treatsAsGuest),
    [trainingLinks, treatsAsGuest],
  );

  const publicationRowClass =
    "flex items-center gap-3 px-3 py-2.5 text-[9px] font-bold rounded-lg transition-all w-full text-left";
  const publicationRowOpen = `${publicationRowClass} text-slate-300 hover:bg-white/5 hover:text-cyan-400`;

  type NavItem = {
    label: string;
    path?: string;
    hasDropdown?: boolean;
    dropdownKey?: 'research' | 'connection' | 'training';
  };

  const navItems = useMemo(() => {
    const base: NavItem[] = [
      { label: t("nav.home"), path: "/" },
      { label: t("nav.publications"), hasDropdown: true, dropdownKey: 'research' as const },
      { label: t("nav.connection"), hasDropdown: true, dropdownKey: 'connection' as const },
    ];
    if (!initialized || !isAuthenticated || !user) return base;
    if (user.system_role === "user") return base;
    const role = user?.system_role?.toLowerCase();
    if (role === "admin") return [...base, { label: t("nav.dashboard"), path: "/admin" }];
    return [
      ...base,
      { label: t("nav.projects"), path: "/projects" },
      { label: t("nav.training"), hasDropdown: true, dropdownKey: 'training' as const },
    ];
  }, [initialized, isAuthenticated, user, t]);

  const userRole = user?.system_role?.toLowerCase();
  const showDashboardLink =
    userRole === "member" || (userRole === "truong_lab" && truongLabHasProjects);
  const showDirectorWorkspaceLink = userRole === "vien_truong";

  useEffect(() => {
    let cancelled = false;

    const checkTruongLabProjects = async () => {
      if (!isAuthenticated || userRole !== "truong_lab") {
        setTruongLabHasProjects(false);
        return;
      }
      try {
        const payload = await projectService.list({ page: 1, limit: 1 });
        if (cancelled) return;
        const total = payload?.pagination?.total ?? payload?.projects?.length ?? 0;
        setTruongLabHasProjects(total > 0);
      } catch {
        if (!cancelled) setTruongLabHasProjects(false);
      }
    };

    void checkTruongLabProjects();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userRole]);

  // --- FIX THANH SÁNG (INDICATOR) CHẠY THEO HOVER ---
  useEffect(() => {
    const updateIndicator = () => {
      const nav = navRef.current;
      const indicator = indicatorRef.current;
      if (!nav || !indicator) return;

      const currentActive = navItems.find(i =>
        activePath === i.path || (i.path && i.path !== "/" && activePath.startsWith(i.path))
      );

      const targetPath = hoveredPath || currentActive?.path;
      const targetEl = nav.querySelector(`[data-path="${targetPath}"]`) as HTMLElement;

      if (targetEl) {
        const navRect = nav.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        indicator.style.opacity = "1";
        indicator.style.width = `${targetRect.width}px`;
        indicator.style.transform = `translateX(${targetRect.left - navRect.left}px)`;
      } else {
        indicator.style.opacity = "0";
      }
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [hoveredPath, activePath, navItems]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
        isScrolled
          ? 'border-b border-white/5 bg-[#020617]/95 py-2 shadow-xl backdrop-blur-md'
          : 'bg-transparent py-3 sm:py-3'
      }`}
    >
      <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between">

        {/* LEFT: Logo */}
        <div className="flex-1 flex justify-start">
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
              <img src="/tins-lab-logo.jpg" alt="VKsLab logo" className="h-8 w-auto" />
            </div>
            <div className="hidden md:flex flex-col">
              <span className={`font-black text-xl tracking-tighter uppercase italic leading-none ${isScrolled ? "text-white" : "text-slate-900"}`}>
                VK<span className="text-cyan-400">sLab</span>
              </span>
              <span className="text-[7px] font-bold text-cyan-500 uppercase tracking-widest mt-0.5">RESEARCH HUB</span>
            </div>
          </NavLink>
        </div>

        {/* CENTER: Navigation */}
        <nav ref={navRef} className="hidden lg:flex items-center gap-1 relative bg-white/5 p-1 rounded-2xl border border-white/10">
          {navItems.map((item) => (
            <div
              key={item.path ?? `nav-${item.label}`}
              className="relative z-10"
              onMouseEnter={() => {
                setHoveredPath(item.path || null);
                if (item.hasDropdown && item.dropdownKey) setOpenDropdown(item.dropdownKey);
              }}
              onMouseLeave={() => {
                setHoveredPath(null);
                if (item.hasDropdown) setOpenDropdown(null);
              }}
            >
              {item.hasDropdown ? (
                <button
                  type="button"
                  className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-1 ${
                    openDropdown === item.dropdownKey ? "text-cyan-400" : isScrolled ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  {item.label}
                  <ChevronDown size={10} className={`${openDropdown === item.dropdownKey ? "rotate-180" : ""} transition-transform`} />
                </button>
              ) : (
                <NavLink
                  to={item.path || ""}
                  data-path={item.path}
                  className={({ isActive }) => `
                    px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-1
                    ${isActive || hoveredPath === item.path ? "text-cyan-400" : isScrolled ? "text-slate-400" : "text-slate-600"}
                  `}
                >
                  {item.label}
                </NavLink>
              )}

              {/* DROPDOWN CẤP 1 (Ấn phẩm) */}
              {item.hasDropdown && openDropdown === item.dropdownKey && (
                <div className="absolute top-full left-0 w-64 pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-[#0f172a] border border-white/10 rounded-xl p-1.5 shadow-2xl backdrop-blur-xl">
                    {(item.dropdownKey === 'research'
                      ? visibleResearchLinks
                      : item.dropdownKey === 'connection'
                        ? visibleConnectionLinks
                        : visibleTrainingLinks
                    ).map((sub) => (
                      <div key={sub.path} className="relative group/sub">
                        {sub.hasSubDropdown ? (
                          <>
                            <div className="flex items-center justify-between px-3 py-2.5 text-[9px] font-bold rounded-lg cursor-pointer text-slate-300 hover:bg-white/5 hover:text-cyan-400">
                              <div className="flex items-center gap-3 min-w-0">
                                <sub.icon size={14} className="text-cyan-500/50" />
                                <span className="truncate">{sub.label}</span>
                              </div>
                              <ChevronDown size={10} className="-rotate-90 shrink-0" aria-hidden />
                            </div>
                            <div className="absolute top-0 left-full ml-1 w-48 bg-[#0f172a] border border-white/10 rounded-xl p-1.5 shadow-2xl opacity-0 invisible group-hover/sub:opacity-100 group-hover/sub:visible transition-all duration-200">
                              {sub.subItems?.map((book) => (
                                <Link
                                  key={book.path}
                                  to={book.path}
                                  className={`${publicationRowOpen} text-slate-400`}
                                >
                                  <book.icon size={12} className="shrink-0" />
                                  {book.label}
                                </Link>
                              ))}
                            </div>
                          </>
                        ) : (
                          <Link to={sub.path} className={publicationRowOpen}>
                            <sub.icon size={14} className="text-cyan-500/50 shrink-0" />
                            {sub.label}
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <span ref={indicatorRef} className="absolute bottom-1 left-0 h-[2px] bg-cyan-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_#22d3ee] pointer-events-none" />
        </nav>

        {/* RIGHT: Search & User */}
        <div className="flex-1 flex justify-end items-center gap-4">
          {/* LANGUAGE SWITCH */}
          <button
            type="button"
            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'vi' : 'en')}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              isScrolled ? 'bg-white/5 border-white/10 text-slate-200 hover:text-cyan-300' : 'bg-white border-slate-200 text-slate-700 hover:text-cyan-600'
            }`}
            title={t('language.label')}
            aria-label={t('language.label')}
          >
            {i18n.language === 'en' ? t('language.en') : t('language.vi')}
          </button>

          {/* SEARCH BAR */}
          <AcademicSearch isScrolled={isScrolled} t={t} />

          {isAuthenticated && user && user.system_role !== "user" && (
            <NotificationBell isScrolled={isScrolled} />
          )}

          {isAuthenticated && user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex items-center gap-2 p-1 pr-2 rounded-xl border transition-all ${isScrolled ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-sm"
                  }`}
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-black uppercase ring-1 ring-white/10">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.full_name?.charAt(0) ?? '?'
                  )}
                </div>
                <ChevronDown size={12} className={isScrolled ? "text-slate-400" : "text-slate-600"} />
              </button>

              {/* PHỤC HỒI USER MENU ĐẦY ĐỦ */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-3 w-60 bg-[#020617]/95 border border-white/10 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in duration-150 backdrop-blur-xl">
                  <div className="p-4 border-b border-white/5 mb-1 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-black uppercase ring-1 ring-white/10">
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        user.full_name?.charAt(0) ?? '?'
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-white uppercase truncate">{user.full_name}</p>
                      <p className="text-[7px] text-cyan-500 font-bold uppercase tracking-widest mt-0.5">{user.system_role}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {showDirectorWorkspaceLink && (
                      <Link
                        to={ROUTER.USER.DIRECTOR_WORKSPACE}
                        className="flex items-center gap-3 px-3 py-2.5 text-[9px] font-bold text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-300 rounded-lg transition-all border border-cyan-500/20 mb-1"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <LayoutGrid size={14} /> {t('header.userMenu.directorWorkspace')}
                      </Link>
                    )}
                    <Link to={ROUTER.USER.USERPROFILE} className="flex items-center gap-3 px-3 py-2.5 text-[9px] font-bold text-slate-300 hover:bg-white/5 hover:text-cyan-400 rounded-lg transition-all" onClick={() => setUserMenuOpen(false)}>
                      <User size={14} /> {t('header.userMenu.profile')}
                    </Link>
                  {showDashboardLink && (
                    <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2.5 text-[9px] font-bold text-slate-300 hover:bg-white/5 hover:text-cyan-400 rounded-lg transition-all" onClick={() => setUserMenuOpen(false)}>
                      <User size={14} /> {t('header.userMenu.dashboard')}
                    </Link>
                  )}
                    <div className="h-px bg-white/5 my-1" />
                    <button onClick={handleLogout} className="w-full flex items-center justify-between px-3 py-2.5 text-[9px] font-black text-red-400 hover:bg-red-500/10 rounded-lg transition-all group">
                      {t('actions.logout')} <LogOut size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="px-5 py-2.5 bg-cyan-500 text-white text-[10px] font-black rounded-xl hover:bg-cyan-400 transition-all shadow-lg active:scale-95">
              {t('actions.login')}
            </Link>
          )}

          <button onClick={() => setIsOpen(!isOpen)} className={`lg:hidden p-2 ${isScrolled ? "text-white" : "text-slate-900"}`}>
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;