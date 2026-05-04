import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Mail, Cpu, Sparkles } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { labService, type LabDirectoryUser, type LabInformationData } from '../../services/lab.service';
import { useTranslation } from 'react-i18next';

const ROLE_THEME = {
  vien_truong: { 
    labelKey: 'user:lab.roles.vien_truong',
    color: 'border-emerald-400 shadow-emerald-400/20', 
    avatar: 'from-emerald-400 to-teal-500', 
    tag: 'text-emerald-300',
    orbitSpeed: 25 
  },
  truong_lab: { 
    labelKey: 'user:lab.roles.truong_lab',
    color: 'border-purple-500 shadow-purple-500/20', 
    avatar: 'from-purple-500 to-indigo-500', 
    tag: 'text-purple-300',
    orbitSpeed: 30
  },
  leader: { 
    labelKey: 'user:lab.roles.leader',
    color: 'border-cyan-400 shadow-cyan-500/20', 
    avatar: 'from-cyan-400 to-blue-500', 
    tag: 'text-cyan-300',
    orbitSpeed: 35
  },
  member: { 
    labelKey: 'user:lab.roles.member',
    color: 'border-pink-500 shadow-pink-500/20', 
    avatar: 'from-pink-500 to-rose-500', 
    tag: 'text-pink-300',
    orbitSpeed: 40
  },
} as const;

/** Logo trung tâm — cùng file public với Header */
const SYSTEM_LOGO_SRC = '/tins-lab-logo.jpg';

/** Bán kính quỹ đạo (px) + thời gian một vòng (giây) — vòng ngoài chậm hơn, chuyển động mượt */
const ORBIT_LAYERS = {
  directors: { radius: 112, duration: 48, glow: 'shadow-emerald-500/20' },
  labHeads: { radius: 188, duration: 62, glow: 'shadow-violet-500/20' },
  team: { radius: 268, duration: 82, glow: 'shadow-cyan-500/15' },
} as const;

/** URL trong DB có thể hết hạn / sai — fallback khi <img> lỗi tải */
function LabOrbitAvatarFace({
  avatarUrl,
  themeAvatar,
  letter,
}: {
  avatarUrl?: string | null;
  themeAvatar: string;
  letter: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = avatarUrl?.trim();
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover z-10"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <>
      <div className={`absolute inset-0 bg-gradient-to-br ${themeAvatar} opacity-35`} />
      <span className="text-white font-black text-sm z-10 drop-shadow-md">{letter}</span>
    </>
  );
}

function MemberCardAvatarArea({
  member,
  theme,
  index,
  initialsStr,
}: {
  member: LabDirectoryUser;
  theme: (typeof ROLE_THEME)[keyof typeof ROLE_THEME];
  index: number;
  initialsStr: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = member.avatar?.trim();

  if (src && !broken) {
    return (
      <motion.img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        initial={{ opacity: 0.85 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35 }}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: index * 0.2 }}
        className={`w-24 h-24 rounded-3xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex items-center justify-center text-white text-3xl font-black relative z-10 bg-gradient-to-br ${theme.avatar}`}
      >
        {initialsStr}
      </motion.div>
      <div className="absolute bottom-10 w-16 h-4 bg-black/40 blur-md rounded-full" />
    </div>
  );
}

const LabInformation: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<LabInformationData | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Scroll logic cho hiệu ứng Zoom-in xuyên không gian
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const spaceZoom = useSpring(useTransform(scrollYProgress, [0, 0.3], [1, 1.5]), { stiffness: 50 });
  const opacityOut = useTransform(scrollYProgress, [0.2, 0.4], [1, 0]);

  useEffect(() => {
    (async () => {
      try {
        const res = await labService.getInformation();
        if (res?.success && res?.data) {
          setData(res.data);
          return;
        }
        throw new Error('Primary source failed');
      } catch {
        try {
          const envBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
          const publicUrl = envBase ? `${envBase}/lab/information` : '/api/lab/information';
          const response = await fetch(publicUrl, { method: 'GET' });
          if (!response.ok) throw new Error('Public endpoint failed');

          const payload = await response.json();
          if (payload?.success && payload?.data) {
            setData(payload.data);
            return;
          }

          throw new Error('Invalid public payload');
        } catch {
          toast.error(t('user:lab.toasts.fetchFailed'));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const orderedUsers = useMemo(() => {
    const users = data?.directory_users ?? [];
    const rank: Record<string, number> = { vien_truong: 0, truong_lab: 1, leader: 2, member: 3 };
    return [...users].sort((a, b) => {
      const roleDiff = (rank[a.system_role] ?? 9) - (rank[b.system_role] ?? 9);
      return roleDiff !== 0 ? roleDiff : a.full_name.localeCompare(b.full_name);
    });
  }, [data?.directory_users]);

  /** Vòng 1: Viện trưởng — Vòng 2: Trưởng lab — Vòng 3: Leader + Member */
  const orbitDirectors = useMemo(
    () => orderedUsers.filter((u) => u.system_role === 'vien_truong'),
    [orderedUsers]
  );
  const orbitLabHeads = useMemo(
    () => orderedUsers.filter((u) => u.system_role === 'truong_lab'),
    [orderedUsers]
  );
  const orbitTeam = useMemo(
    () => orderedUsers.filter((u) => u.system_role === 'member'),
    [orderedUsers]
  );

  if (loading) return <LoadingScreen />;

  return (
    <div ref={containerRef} className="min-h-[300vh] bg-[#020205] text-white font-sans overflow-x-hidden relative">
      {/* Background Stars & Nebula */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(20,20,50,1)_0%,rgba(2,2,5,1)_100%)]" />
        <StarField />
      </div>

      <main className="relative z-10">
        {/* HERO SECTION - ORBITAL SYSTEM */}
        <section className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden">
          <motion.div style={{ scale: spaceZoom, opacity: opacityOut }} className="text-center z-30 mb-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300 mb-6"
            >
              <Sparkles size={14} /> {t('user:lab.hero.kicker')}
            </motion.div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic italic-shadow">
              {t('user:lab.hero.titlePrefix')} <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500">{t('user:lab.hero.titleHighlight')}</span>
            </h1>
          </motion.div>

          {/* Central logo + 3 quỹ đạo: Viện trưởng → Trưởng lab → Leader/Member */}
          <motion.div
            style={{ scale: spaceZoom, opacity: opacityOut }}
            className="relative w-[min(92vw,600px)] h-[min(92vw,600px)] max-w-[600px] max-h-[600px] flex items-center justify-center"
          >
            {/* Vòng elip trang trí (3 tầng) */}
            {[224, 376, 536].map((size, idx) => (
              <div
                key={size}
                className="absolute rounded-full border border-white/[0.07] pointer-events-none"
                style={{
                  width: size,
                  height: size,
                  transform: 'rotateX(62deg) rotateY(12deg)',
                  boxShadow: idx === 0 ? 'inset 0 0 40px rgba(16,185,129,0.06)' : idx === 1 ? 'inset 0 0 36px rgba(139,92,246,0.05)' : 'inset 0 0 28px rgba(34,211,238,0.04)',
                }}
              />
            ))}

            <OrbitRing
              users={orbitDirectors}
              config={ORBIT_LAYERS.directors}
              reduceMotion={reduceMotion ?? false}
            />
            <OrbitRing
              users={orbitLabHeads}
              config={ORBIT_LAYERS.labHeads}
              reduceMotion={reduceMotion ?? false}
            />
            <OrbitRing
              users={orbitTeam}
              config={ORBIT_LAYERS.team}
              reduceMotion={reduceMotion ?? false}
            />

            {/* Logo hệ thống — trung tâm */}
            <div className="relative z-20 group cursor-default pointer-events-auto">
              <motion.div
                className="absolute inset-0 rounded-full bg-cyan-400/30 blur-[48px] opacity-30 group-hover:opacity-50 transition-opacity duration-700"
                animate={reduceMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.25, 0.4, 0.25] }}
                transition={reduceMotion ? undefined : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="relative w-[8rem] h-[8rem] sm:w-36 sm:h-36 rounded-full border border-white/20 bg-black/75 backdrop-blur-md flex items-center justify-center overflow-hidden shadow-[0_0_60px_rgba(34,211,238,0.25)]"
                whileHover={{ scale: 1.04 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              >
                <img
                  src={SYSTEM_LOGO_SRC}
                  alt={t('user:lab.hero.logoAlt')}
                  className="h-full w-full rounded-full object-cover select-none drop-shadow-[0_0_12px_rgba(34,211,238,0.35)]"
                />
              </motion.div>
            </div>
          </motion.div>
          
          <motion.div 
            style={{ opacity: opacityOut }}
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute bottom-10 flex flex-col items-center gap-2 text-slate-500 font-black text-[10px] tracking-[0.4em] uppercase"
          >
            {t('user:lab.hero.scrollHint')}
            <div className="w-px h-12 bg-gradient-to-b from-cyan-500 to-transparent" />
          </motion.div>
        </section>

        {/* DATA NODES GRID */}
        <section className="relative max-w-7xl mx-auto px-6 py-32">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {orderedUsers.map((member, index) => (
              <MemberSpaceCard key={member.id} member={member} index={index} />
            ))}
          </div>
        </section>
      </main>

    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* SUB-COMPONENTS                                */
/* -------------------------------------------------------------------------- */

/** Một vòng quỹ đạo: phân bố đều theo góc + quay đều + counter-rotate để avatar không bị nghiêng */
function OrbitRing({
  users,
  config,
  reduceMotion,
}: {
  users: LabDirectoryUser[];
  config: (typeof ORBIT_LAYERS)[keyof typeof ORBIT_LAYERS];
  reduceMotion: boolean;
}) {
  if (users.length === 0) return null;

  const { radius, duration } = config;

  const nodes = users.map((user, i) => {
    const angleDeg = (360 / users.length) * i;
    const inner = (
      <OrbitAvatar user={user} ringGlow={config.glow} />
    );

    return (
      <div
        key={user.id}
        className="absolute left-1/2 top-1/2 w-0 h-0 pointer-events-auto z-[15]"
        style={{ transform: `rotate(${angleDeg}deg) translateX(${radius}px)` }}
      >
        {reduceMotion ? (
          <div className="relative -translate-x-1/2 -translate-y-1/2">{inner}</div>
        ) : (
          <motion.div
            className="relative -translate-x-1/2 -translate-y-1/2"
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration, ease: 'linear' }}
          >
            {inner}
          </motion.div>
        )}
      </div>
    );
  });

  if (reduceMotion) {
    return (
      <div className="absolute inset-0 z-[12] flex items-center justify-center pointer-events-none">{nodes}</div>
    );
  }

  return (
    <motion.div
      className="absolute inset-0 z-[12] flex items-center justify-center pointer-events-none"
      style={{ willChange: 'transform' }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration, ease: 'linear' }}
    >
      {nodes}
    </motion.div>
  );
}

function OrbitAvatar({ user, ringGlow }: { user: LabDirectoryUser; ringGlow: string }) {
  const { t } = useTranslation();
  const theme = ROLE_THEME[user.system_role as keyof typeof ROLE_THEME] || ROLE_THEME.member;
  const letter = user.full_name.split(' ').pop()?.[0] ?? '?';

  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={`group relative w-[3.75rem] h-[3.75rem] sm:w-16 sm:h-16 rounded-2xl border-2 ${theme.color} ${ringGlow} bg-black/92 flex items-center justify-center overflow-hidden cursor-help shadow-[0_12px_40px_rgba(0,0,0,0.55)]`}
    >
      <LabOrbitAvatarFace avatarUrl={user.avatar} themeAvatar={theme.avatar} letter={letter} />

      <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 top-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-44 p-3 bg-black/92 border border-white/12 rounded-xl backdrop-blur-xl transition-all duration-200 z-20 shadow-xl pointer-events-none">
        <p className={`text-[10px] font-black uppercase leading-none mb-1 ${theme.tag}`}>{t(theme.labelKey)}</p>
        <p className="text-xs font-bold text-white truncate">{user.full_name}</p>
      </div>
    </motion.div>
  );
}

function MemberSpaceCard({ member, index }: { member: LabDirectoryUser; index: number }) {
  const { t } = useTranslation();
  const theme = ROLE_THEME[member.system_role as keyof typeof ROLE_THEME] || ROLE_THEME.member;
  const initials = member.full_name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('');

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ delay: (index % 4) * 0.1 }}
      whileHover={{ y: -10 }}
      className="group relative"
    >
      <div className={`absolute inset-0 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-700 bg-gradient-to-br ${theme.avatar}`} />
      
      <div className="relative bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 overflow-hidden h-full flex flex-col">
        {/* Card Header: avatar ảnh full khung; không ảnh thì khối nhỏ gradient + chữ */}
        <div className="relative w-full aspect-square mb-6 rounded-2xl overflow-hidden bg-[#050508]">
          <MemberCardAvatarArea member={member} theme={theme} index={index} initialsStr={initials} />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
        </div>

        <div className="space-y-2 mb-6">
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${theme.tag}`}>{t(theme.labelKey)}</p>
          <h3 className="text-xl font-bold tracking-tight group-hover:text-cyan-300 transition-colors">{member.full_name}</h3>
          <p className="text-slate-400 text-xs font-medium">{member.department || t('user:lab.fallback.department')}</p>
        </div>

        <div className="mt-auto pt-4 border-t border-white/5">
           <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-[11px] text-slate-300 hover:text-cyan-300 transition-colors truncate">
             <Mail size={12} className="shrink-0" />
             <span className="truncate">{member.email}</span>
           </a>
        </div>
      </div>
    </motion.div>
  );
}

function StarField() {
  // React hooks lint rule `purity` forbids `Math.random()` during render (even inside useMemo).
  // Use a deterministic hash-based pseudo-random so output is stable & still "random-looking".
  const stars = useMemo(() => {
    const rand01 = (i: number, salt: number) => {
      // Integer hash -> [0,1). Pure & deterministic.
      const x = Math.imul(i ^ salt, 0x45d9f3b) ^ 0x6d2b79f5;
      const y = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
      const z = y ^ (y >>> 16);
      return (z >>> 0) / 4294967296;
    };

    return Array.from({ length: 100 }, (_, i) => {
      const size = rand01(i, 11) * 2;
      return {
        size,
        top: `${rand01(i, 23) * 100}%`,
        left: `${rand01(i, 37) * 100}%`,
        duration: 2 + rand01(i, 53) * 3,
        delay: rand01(i, 71) * 5,
      };
    });
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {stars.map((s, i) => (
        <motion.div
          key={i}
          className="absolute bg-white rounded-full"
          style={{
            width: s.size,
            height: s.size,
            top: s.top,
            left: s.left,
          }}
          animate={{
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: s.duration,
            repeat: Infinity,
            delay: s.delay,
          }}
        />
      ))}
    </div>
  );
}

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#020205] flex flex-col items-center justify-center text-white">
      <div className="relative">
        <Cpu className="animate-spin text-cyan-400 mb-6" size={48} />
        <div className="absolute inset-0 bg-cyan-400 blur-2xl opacity-20 animate-pulse" />
      </div>
      <div className="text-[10px] tracking-[1em] uppercase font-black text-slate-500 animate-pulse">
        {t('user:lab.loading')}
      </div>
    </div>
  );
}


export default LabInformation;