import { Mail, MapPin, Linkedin, Facebook, Youtube, ExternalLink, Cpu, Activity, Database, Network, Terminal, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="relative bg-[#0F172A] overflow-hidden border-t border-white/5">
      {/* BACKGROUND TECH GRID & GLOW */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[#6366F1] rounded-full blur-[150px] opacity-10 pointer-events-none" />

      {/* DẢI MÀU NEON TRANG TRÍ (Data Bus Line) */}
      <div className="relative h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-400 to-[#6366F1] shadow-[0_0_15px_#22D3EE]" />

      <div className="relative z-10 text-slate-400 pt-20 pb-10">
        <div className="max-w-[1500px] mx-auto px-6 md:px-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 mb-20">
            
            {/* CỘT 1: SYSTEM IDENTITY (4 cột) */}
            <div className="lg:col-span-4 space-y-8">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 bg-[#0F172A] border border-cyan-500/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.15)] overflow-hidden group">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#6366F144,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <Cpu size={24} className="text-cyan-400 z-10 group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute top-1 left-1 w-0.5 h-0.5 bg-cyan-400/50 rounded-full" />
                  <div className="absolute bottom-1 right-1 w-0.5 h-0.5 bg-cyan-400/50 rounded-full" />
                </div>
                <div>
                  <h3 className="text-white font-black text-2xl uppercase italic leading-none tracking-tighter">
                    VK<span className="text-cyan-400">sLab</span>
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Activity size={10} className="text-[#6366F1] animate-pulse" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                      {t('common:footer.labTagline')}
                    </span>
                  </div>
                </div>
              </div>
              <p className="leading-relaxed text-slate-400 text-xs max-w-sm font-medium">
                {t('common:footer.description')}
              </p>
              {/* Social Nodes */}
              <div className="flex gap-3">
                {[
                  { icon: Facebook, label: 'FB' },
                  { icon: Linkedin, label: 'IN' },
                  { icon: Youtube, label: 'YT' }
                ].map((item, idx) => (
                  <a key={idx} href="#" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-cyan-400/50 hover:text-cyan-300 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all duration-300 group relative">
                    <item.icon size={16} className="group-hover:scale-110 transition-transform" />
                    <span className="absolute -bottom-5 text-[7px] font-black uppercase tracking-widest text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.label}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {/* CỘT 2: SYSTEM INDEX (2 cột) */}
            <div className="lg:col-span-2">
              <h4 className="text-white font-black uppercase tracking-[0.2em] text-[10px] mb-8 flex items-center gap-2">
                <Database size={12} className="text-[#6366F1]" /> {t('common:footer.systemIndex.title')}
              </h4>
              <ul className="space-y-4 text-xs font-bold text-slate-400">
                {[
                  t('common:footer.systemIndex.items.platformIntro'),
                  t('common:footer.systemIndex.items.researchDatabase'),
                  t('common:footer.systemIndex.items.activeProjects'),
                  t('common:footer.systemIndex.items.partnerNetwork'),
                ].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-cyan-300 transition-colors flex items-center group">
                      <Terminal size={10} className="mr-2 opacity-0 group-hover:opacity-100 group-hover:text-cyan-400 transition-all -translate-x-2 group-hover:translate-x-0 absolute" />
                      <span className="group-hover:translate-x-4 transition-transform duration-300">{item}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* CỘT 3: RESEARCH CLUSTERS (3 cột) */}
            <div className="lg:col-span-3">
              <h4 className="text-white font-black uppercase tracking-[0.2em] text-[10px] mb-8 flex items-center gap-2">
                <Network size={12} className="text-[#6366F1]" /> {t('common:footer.researchClusters.title')}
              </h4>
              <div className="grid grid-cols-1 gap-3 text-xs font-bold">
                {[
                  { name: t('common:footer.researchClusters.items.npu'), path: '#' },
                  { name: t('common:footer.researchClusters.items.slam'), path: '#' },
                  { name: t('common:footer.researchClusters.items.edgeFpga'), path: '#' },
                  { name: t('common:footer.researchClusters.items.hri'), path: '#' },
                ].map((lab) => (
                  <a key={lab.name} href={lab.path} className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 text-slate-300 hover:text-white transition-all group shadow-inner">
                    <span className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-slate-600 rounded-full group-hover:bg-cyan-400 transition-colors" />
                      {lab.name}
                    </span>
                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-cyan-400 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>

            {/* CỘT 4: COMMS PROTOCOL (3 cột) */}
            <div className="lg:col-span-3">
              <h4 className="text-white font-black uppercase tracking-[0.2em] text-[10px] mb-8 flex items-center gap-2">
                <Activity size={12} className="text-[#6366F1]" /> {t('common:footer.contact.title')}
              </h4>
              <div className="space-y-6 text-xs font-medium">
                <div className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="mt-0.5 text-[#6366F1]"><Mail size={16} /></div>
                  <div>
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">{t('common:footer.contact.directEmail')}</p>
                    <p className="text-white font-bold tracking-wide">{t('common:footer.contact.emailValue')}</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="mt-0.5 text-cyan-500"><MapPin size={16} /></div>
                  <div>
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">{t('common:footer.contact.location')}</p>
                    <p className="text-slate-300 leading-relaxed font-bold">
                      {t('common:footer.contact.addressLine1')}<br />
                      {t('common:footer.contact.addressLine2')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* BOTTOM COPYRIGHT / SYSTEM STATUS */}
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">
              <span className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                {t('common:footer.systemRunning')}
              </span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-500">
                {t('common:footer.version', { version: '2026.03' })}
              </span>
            </div>
            
            <div className="flex gap-6 text-[9px] font-black uppercase tracking-widest text-slate-600">
              <a href="#" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                {t('common:footer.policies.data')} <ChevronRight size={10} />
              </a>
              <a href="#" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                {t('common:footer.policies.privacy')} <ChevronRight size={10} />
              </a>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;