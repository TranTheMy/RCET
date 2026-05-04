import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ScrollText, ShieldCheck, Terminal, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ROUTER } from '../routes/router';

/* --- Hiệu ứng Meteor chuẩn: Đầu cắm xuống, từ phải sang trái --- */
const meteorStyles = `
  @keyframes meteor-effect {
    0% { transform: translate(500px, -500px) rotate(225deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translate(-1000px, 1000px) rotate(225deg); opacity: 0; }
  }
  .meteor {
    position: absolute;
    width: 1.5px;
    height: 100px;
    background: linear-gradient(to bottom, rgba(99, 102, 241, 0.8), transparent);
    animation: meteor-effect linear infinite;
    pointer-events: none;
    z-index: 1;
  }
`;

const SystemRulesPage: React.FC = () => {
  const { t } = useTranslation();
  const [meteors, setMeteors] = useState<number[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMeteors(prev => [...prev.slice(-5), Date.now()]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  
  const sectionKeys = [
    'access', 'publication', 'conduct', 'intellectualProperty',
    'security', 'privacy', 'acceptableUse', 'accountResponsibility',
    'contentIntegrity', 'systemSecurity', 'dataUsage', 'violationHandling',
    'updatePolicy',
  ] as const;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 pb-24 relative overflow-hidden font-sans">
      <style>{meteorStyles}</style>

      {/* BACKGROUND DECOR */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {meteors.map(id => (
          <div 
            key={id} 
            className="meteor" 
            style={{ 
              top: `${Math.random() * 50}%`, 
              right: `${Math.random() * 60}%`, 
              animationDuration: `${Math.random() * 2 + 1.5}s` 
            }} 
          />
        ))}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-indigo-600/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-16 relative z-10">
        {/* BACK BUTTON */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <Link
            to={ROUTER.USER.HOME}
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 hover:text-white transition-all mb-12 group"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            {t('home:systemRulesPage.backHome')}
          </Link>
        </motion.div>

        {/* HEADER SECTION */}
        <header className="mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="h-px w-12 bg-indigo-500/50" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500">
              Protocol v2.6.0
            </span>
          </motion.div>

          <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8">
            <div className="h-20 w-20 shrink-0 flex items-center justify-center rounded-[24px] bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-white/10 shadow-2xl shadow-indigo-500/10">
              <ShieldCheck size={40} className="text-indigo-400" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-black text-white uppercase italic tracking-tighter mb-2">
                {t('home:systemRulesPage.title')}
              </h1>
              <p className="text-slate-500 text-sm font-medium tracking-wide flex items-center gap-2">
                <Terminal size={14} /> System Governance & Compliance Framework
              </p>
            </div>
          </div>

          <motion.p 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg leading-relaxed font-medium max-w-3xl border-l-2 border-indigo-500/30 pl-6 py-2"
          >
            {t('home:systemRulesPage.intro')}
          </motion.p>
        </header>

        {/* RULES CONTENT */}
        <div className="grid grid-cols-1 gap-6">
          {sectionKeys.map((key, index) => (
            <motion.section
              key={key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group relative rounded-[32px] border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] p-8 transition-all duration-300 hover:border-indigo-500/30"
            >
              {/* Decorative Numbering */}
              <span className="absolute top-8 right-8 text-[40px] font-black text-white/[0.02] leading-none group-hover:text-indigo-500/5 transition-colors">
                {(index + 1).toString().padStart(2, '0')}
              </span>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Zap size={16} />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">
                  {t(`home:systemRulesPage.sections.${key}.heading`)}
                </h2>
              </div>

              <p className="text-slate-400 text-sm leading-relaxed font-medium relative z-10">
                {t(`home:systemRulesPage.sections.${key}.body`)}
              </p>
            </motion.section>
          ))}
        </div>

        {/* FOOTER ACTION */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-20 p-10 rounded-[40px] bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 text-center"
        >
          <ScrollText size={32} className="mx-auto mb-4 text-indigo-500/50" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            End of Documentation
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default SystemRulesPage;