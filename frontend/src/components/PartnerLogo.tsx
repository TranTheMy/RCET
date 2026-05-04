import React from 'react';
import { Cpu, Globe, Award, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PARTNERS: Array<{
  name: string;
  categoryKey: string;
  render: (t: (key: string) => string) => React.ReactNode;
}> = [
  {
    name: 'BOSCH',
    categoryKey: 'common:partners.items.bosch',
    render: () => (
      <div className="text-xl font-black text-[#E20015] italic group-hover:tracking-wider transition-all">BOSCH</div>
    ),
  },
  {
    name: 'Uniquify',
    categoryKey: 'common:partners.items.uniquify',
    render: (t) => (
      <div className="text-lg font-bold text-[#003B71] flex flex-col leading-none items-center">
        Uniquify
        <span className="text-[6px] font-black text-[#6366F1] uppercase tracking-[0.3em] mt-1">
          {t('common:partners.foundryPartner')}
        </span>
      </div>
    ),
  },
  {
    name: 'FARADAY',
    categoryKey: 'common:partners.items.faraday',
    render: () => (
      <div className="text-lg font-black text-slate-700 flex items-center gap-2">
        <div className="w-4 h-4 bg-slate-900 rounded-[2px] rotate-45" />
        FARADAY
      </div>
    ),
  },
  {
    name: 'FPT Software',
    categoryKey: 'common:partners.items.fptSoftware',
    render: () => (
      <div className="text-lg font-bold flex items-center">
        <span className="text-[#003B71] italic tracking-tighter">FPT</span>
        <span className="text-[#F37021] ml-0.5">Software</span>
      </div>
    ),
  },
];

const PartnerLogos: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div>
      
      {/* HEADER: DYNAMIC STATUS */}
      <div className="flex flex-col md:flex-row items-center gap-8 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <Globe size={20} className="text-slate-400" />
          </div>
          <div>
            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.4em]">{t('common:partners.title')}</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">{t('common:partners.subtitle')}</p>
          </div>
        </div>
        <div className="h-[1px] flex-1 bg-gradient-to-r from-slate-100 via-slate-200 to-transparent" />
      </div>

      {/* Grid Partner: Industrial Frame Design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-100 border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
        {PARTNERS.map((partner, index) => (
          <div 
            key={index} 
            className="group relative bg-white h-40 flex flex-col items-center justify-center p-6 transition-all duration-500 hover:z-10"
          >
            {/* Category Label */}
            <span className="absolute top-6 text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] group-hover:text-[#6366F1] transition-colors">
              {t(partner.categoryKey)}
            </span>

            {/* Logo Content */}
            <div className="filter grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 scale-90 group-hover:scale-100">
              {partner.render(t)}
            </div>

            {/* Interactive Corner Accent */}
            <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[20px] border-r-[20px] border-transparent group-hover:border-b-indigo-50 group-hover:border-r-indigo-50 transition-all" />
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Cpu size={10} className="text-[#6366F1]" />
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER: SYSTEM SPECS */}
      <div className="mt-4 flex flex-wrap justify-center items-center gap-6 md:gap-10">
        <div className="flex items-center gap-3">
          <Award size={16} className="text-amber-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('common:partners.footer.foundryCertified')}</span>
        </div>
        <div className="flex items-center gap-3">
          <ShieldCheck size={16} className="text-emerald-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('common:partners.footer.nda')}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
             {[1,2,3,4].map(i => <div key={i} className="w-1 h-1 bg-[#6366F1] rounded-full animate-bounce" style={{animationDelay: `${i*0.2}s`}} />)}
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('common:partners.footer.sync')}</span>
        </div>
      </div>

    </div>
  );
};

export default PartnerLogos;