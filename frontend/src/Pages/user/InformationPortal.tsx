import { useState, useMemo } from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { Lock, Cpu, Radio, Zap, LayoutGrid, Share2, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// --- 1. DATA FANPAGE HỆ THỐNG VKsLab ---
const PORTALS = [
  {
    id: '01',
    nameKey: 'user:portal.items.aiRobotics.name',
    code: 'NODE-ALPHA',
    link: 'https://facebook.com/your-page-1',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=1000',
    icon: Cpu,
  },
  {
    id: '02',
    nameKey: 'user:portal.items.verilogHub.name',
    code: 'NODE-BETA',
    link: 'https://facebook.com/your-page-2',
    image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1000',
    icon: Radio,
  },
  {
    id: '03',
    nameKey: 'user:portal.items.embeddedNews.name',
    code: 'NODE-GAMMA',
    link: 'https://facebook.com/your-page-3',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000',
    icon: Zap,
  },
  {
    id: '04',
    nameKey: 'user:portal.items.startupCommunity.name',
    code: 'NODE-DELTA',
    link: 'https://facebook.com/your-page-4',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000',
    icon: LayoutGrid,
  },
] as const;

const VaultCard = ({ item }: { item: (typeof PORTALS)[number] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  const vaultTransition: Transition = {
    type: "spring",
    stiffness: 40,
    damping: 14,
    mass: 1.5
  };

  return (
    <motion.div 
      className="relative h-[650px] w-full group overflow-hidden bg-black/40 rounded-[40px] border border-white/10 backdrop-blur-md shadow-2xl"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* --- LỚP NỘI DUNG FANPAGE (BÊN TRONG) --- */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${item.image})` }}
          animate={{ scale: isOpen ? 1.05 : 1.2, filter: isOpen ? "brightness(0.7) blur(0px)" : "brightness(0) blur(20px)" }}
          transition={{ duration: 1 }}
        />
        {/* Lớp phủ màu Tech Blue */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-blue-900/20 to-transparent" />
        
        <motion.div 
          className="absolute inset-0 p-10 flex flex-col justify-end z-10"
          animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : 40 }}
        >
          <div className="flex items-center gap-3 mb-4">
             <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <item.icon size={24} />
             </div>
             <span className="text-cyan-400 font-mono text-[11px] tracking-[0.4em] uppercase">{item.code}</span>
          </div>
          
          <h3 className="text-4xl font-black text-white italic tracking-tighter mb-2 leading-none">{t(item.nameKey)}</h3>
          <p className="text-slate-400 text-xs mb-8 font-light tracking-wide uppercase">{t('user:portal.card.subtitle')}</p>
          
          <a 
            href={item.link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="group/btn relative flex items-center justify-between px-8 py-5 rounded-2xl bg-white text-black font-black uppercase text-[11px] tracking-widest transition-all hover:bg-cyan-400"
          >
            <span>{t('user:portal.card.visit')}</span>
            <Globe size={18} className="group-hover/btn:rotate-180 transition-transform duration-700" />
          </a>
        </motion.div>
      </div>

      {/* --- HỆ THỐNG CỬA TRƯỢT NGANG (DOUBLE DOOR) --- */}
      {/* Cánh cửa Trái */}
      <motion.div 
        className="absolute inset-y-0 left-0 w-1/2 z-20 origin-left"
        animate={{ x: isOpen ? "-100%" : "0%" }}
        transition={vaultTransition}
      >
        <div className="absolute inset-0 bg-[#0a0f1d]/90 backdrop-blur-3xl border-r border-cyan-500/40 shadow-[10px_0_40px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/circuit-board.png')]" />
          <div className="absolute inset-y-0 right-0 w-[1px] bg-cyan-500 shadow-[0_0_15px_#22d3ee]" />
          {/* Số ID Card */}
          <div className="absolute bottom-10 left-10 text-white/10 text-6xl font-black italic select-none">{item.id}</div>
        </div>
      </motion.div>

      {/* Cánh cửa Phải */}
      <motion.div 
        className="absolute inset-y-0 right-0 w-1/2 z-20 origin-right"
        animate={{ x: isOpen ? "100%" : "0%" }}
        transition={vaultTransition}
      >
        <div className="absolute inset-0 bg-[#0a0f1d]/90 backdrop-blur-3xl border-l border-cyan-500/40 shadow-[-10px_0_40px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/circuit-board.png')]" />
          <div className="absolute inset-y-0 left-0 w-[1px] bg-cyan-500 shadow-[0_0_15px_#22d3ee]" />
        </div>
      </motion.div>

      {/* --- CỤM KHÓA QUANG HỌC --- */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div 
            className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
            exit={{ scale: 1.5, opacity: 0 }}
          >
            <div className="relative">
              <div className="absolute -inset-20 bg-cyan-500/20 blur-[80px] rounded-full animate-pulse" />
              <div className="w-24 h-24 rounded-full border-2 border-white/10 flex items-center justify-center bg-black/40 backdrop-blur-md relative overflow-hidden">
                <motion.div 
                   animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                   className="absolute inset-1 border border-dashed border-cyan-500/40 rounded-full" 
                />
                <Lock className="text-cyan-400 drop-shadow-[0_0_8px_#22d3ee]" size={28} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ForumsClubs = () => {
  const { t } = useTranslation();
  const portals = useMemo(() => PORTALS, []);
  const dataParticles = useMemo(() => {
    const rand01 = (i: number, salt: number) => {
      const x = Math.imul(i ^ salt, 0x45d9f3b) ^ 0x6d2b79f5;
      const y = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
      const z = y ^ (y >>> 16);
      return (z >>> 0) / 4294967296;
    };
    return Array.from({ length: 15 }, (_, i) => ({
      x: rand01(i, 101) * 2000,
      duration: 3 + rand01(i, 103) * 5,
      delay: rand01(i, 107) * 10,
    }));
  }, []);
  return (
    <div className="min-h-screen bg-[#010208] py-32 px-10 relative overflow-hidden font-sans selection:bg-cyan-500/30">
      
      {/* --- BACKGROUND VŨ TRỤ & VI MẠCH TỔNG HỢP --- */}
      <div className="absolute inset-0 z-0">
        {/* 1. Tinh vân vũ trụ sâu */}
        <div className="absolute inset-0 opacity-30 bg-[url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2000')] bg-cover scale-110 animate-pulse-slow" />
        
        {/* 2. Lưới vi mạch tổng hợp (Chip/Circuit) */}
        <div className="absolute inset-0 opacity-20 mix-blend-screen bg-[url('https://www.transparenttextures.com/patterns/circuit-board.png')]" />
        
        {/* 3. Gradient tạo chiều sâu và tập trung ánh sáng */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#010208] via-transparent to-[#010208]" />
        <div className="absolute inset-0 bg-radial-gradient from-blue-900/20 via-transparent to-transparent opacity-50" />

        {/* 4. Hiệu ứng hạt node dữ liệu bay */}
        {dataParticles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-[1px] h-[40px] bg-gradient-to-b from-transparent via-cyan-500 to-transparent"
            initial={{ x: p.x, y: -100, opacity: 0 }}
            animate={{ y: 1200, opacity: [0, 1, 0] }}
            transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "linear" }}
          />
        ))}
      </div>

      <div className="max-w-[1700px] mx-auto relative z-10">
        <header className="mb-32 flex flex-col items-center text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 px-6 py-2 bg-cyan-500/5 border border-cyan-500/20 rounded-full mb-8 backdrop-blur-xl"
            >
              <Share2 size={16} className="text-cyan-400 animate-pulse" />
              <span className="text-[10px] font-black tracking-[0.6em] text-cyan-400 uppercase">{t('user:portal.kicker')}</span>
            </motion.div>
            
            <h2 className="text-8xl md:text-9xl font-black text-white italic tracking-tighter uppercase leading-none">
              {t('user:portal.titlePrefix')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-blue-600 drop-shadow-[0_0_40px_rgba(34,211,238,0.5)]">{t('user:portal.titleHighlight')}</span>
            </h2>
            <div className="h-1 w-64 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mt-10 shadow-[0_0_20px_#22d3ee]" />
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {portals.map(portal => (
            <VaultCard key={portal.id} item={portal} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ForumsClubs;