import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, FolderTree, BookOpen, Microscope, FileText, ClipboardList,
  Send, Library, PlusCircle, FolderOpen, ShieldCheck, Cpu,
  Code2, Users, UserCog, ChevronRight, LayoutGrid, Sparkles, ArchiveX, type LucideIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ROUTER } from '../../routes/router';
import {
  clearDirectorWorkspaceFlow,
  setDirectorWorkspaceFlow,
} from '../../utils/directorWorkspaceFlow';

type WorkspaceLink = {
  to: string;
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
};

// Component thẻ Link được tách ra để tái sử dụng và code gọn hơn
const CardLink = ({ item, index }: { item: WorkspaceLink, index: number }) => {
  const { t } = useTranslation();
  const Icon = item.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className="h-full"
    >
      <Link
        to={item.to}
        onClick={() => setDirectorWorkspaceFlow()}
        className="group relative flex flex-col h-full rounded-[24px] border border-white/5 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.05] hover:border-indigo-500/50 hover:shadow-[0_0_30px_-10px_rgba(99,102,241,0.2)] overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-110 transition-all duration-300">
              <Icon size={24} strokeWidth={1.5} />
            </div>
            <ChevronRight size={18} className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>
          <div className="mt-2">
            <h3 className="text-base font-bold text-white leading-tight group-hover:text-indigo-300 transition-colors">
              {t(item.titleKey)}
            </h3>
            <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed line-clamp-2">
              {t(item.descKey)}
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
      </Link>
    </motion.div>
  );
};

const DirectorWorkspace: React.FC = () => {
  const { t } = useTranslation();

  useEffect(() => {
    clearDirectorWorkspaceFlow();
  }, []);

  // Đã phân loại lại data models để tối ưu layout
  const personalActions: WorkspaceLink[] = [
    { to: ROUTER.USER.USERPROFILE, titleKey: 'user:directorWorkspace.links.profile', descKey: 'user:directorWorkspace.links.profileDesc', icon: User },
    { to: ROUTER.USER.CATEGORY, titleKey: 'user:directorWorkspace.links.categories', descKey: 'user:directorWorkspace.links.categoriesDesc', icon: FolderTree },
  ];

  const publicationGroups = {
    research: [
      { to: ROUTER.USER.RESEARCH, titleKey: 'user:directorWorkspace.links.researchHub', descKey: 'user:directorWorkspace.links.researchHubDesc', icon: BookOpen },
      { to: ROUTER.USER.RESEARCH_SUBMIT, titleKey: 'user:directorWorkspace.links.researchSubmit', descKey: 'user:directorWorkspace.links.researchSubmitDesc', icon: Send },
      { to: ROUTER.USER.RESEARCH_MINE, titleKey: 'user:directorWorkspace.links.researchMine', descKey: 'user:directorWorkspace.links.researchMineDesc', icon: FolderOpen },
      { to: ROUTER.USER.RESEARCH_APPROVALS, titleKey: 'user:directorWorkspace.links.researchApprovals', descKey: 'user:directorWorkspace.links.researchApprovalsDesc', icon: ClipboardList },
      { to: ROUTER.USER.RESEARCH_WITHDRAWN, titleKey: 'user:directorWorkspace.links.researchWithdrawn', descKey: 'user:directorWorkspace.links.researchWithdrawnDesc', icon: ArchiveX },
    ],
    curriculum: [
      { to: ROUTER.USER.CURRICULUM, titleKey: 'user:directorWorkspace.links.curriculumHub', descKey: 'user:directorWorkspace.links.curriculumHubDesc', icon: Microscope },
      { to: ROUTER.USER.CURRICULUM_CREATE, titleKey: 'user:directorWorkspace.links.curriculumCreate', descKey: 'user:directorWorkspace.links.curriculumCreateDesc', icon: PlusCircle },
      { to: ROUTER.USER.CURRICULUM_MINE, titleKey: 'user:directorWorkspace.links.curriculumMine', descKey: 'user:directorWorkspace.links.curriculumMineDesc', icon: Library },
      { to: ROUTER.USER.CURRICULUM_APPROVALS, titleKey: 'user:directorWorkspace.links.curriculumApprovals', descKey: 'user:directorWorkspace.links.curriculumApprovalsDesc', icon: ShieldCheck },
    ],
    documents: [
      { to: ROUTER.USER.DOCUMENTS, titleKey: 'user:directorWorkspace.links.documentsHub', descKey: 'user:directorWorkspace.links.documentsHubDesc', icon: FileText },
      { to: ROUTER.USER.DOCUMENTS_CREATE, titleKey: 'user:directorWorkspace.links.documentsCreate', descKey: 'user:directorWorkspace.links.documentsCreateDesc', icon: PlusCircle },
      { to: ROUTER.USER.DOCUMENTS_MINE, titleKey: 'user:directorWorkspace.links.documentsMine', descKey: 'user:directorWorkspace.links.documentsMineDesc', icon: FolderOpen },
      { to: ROUTER.USER.DOCUMENTS_APPROVALS, titleKey: 'user:directorWorkspace.links.documentsApprovals', descKey: 'user:directorWorkspace.links.documentsApprovalsDesc', icon: ClipboardList },
    ]
  };

  const managementActions: WorkspaceLink[] = [
    { to: ROUTER.GUEST.VERILOG, titleKey: 'user:directorWorkspace.links.verilogPractice', descKey: 'user:directorWorkspace.links.verilogPracticeDesc', icon: Cpu },
    { to: '/verilog/management', titleKey: 'user:directorWorkspace.links.verilogManage', descKey: 'user:directorWorkspace.links.verilogManageDesc', icon: Code2 },
    { to: '/verilog/all-submissions', titleKey: 'user:directorWorkspace.links.verilogSubmissions', descKey: 'user:directorWorkspace.links.verilogSubmissionsDesc', icon: LayoutGrid },
    { to: ROUTER.USER.CV_APPROVALS, titleKey: 'user:directorWorkspace.links.cvApprovals', descKey: 'user:directorWorkspace.links.cvApprovalsDesc', icon: Users },
    { to: ROUTER.USER.DIRECTOR_LAB_STAFF, titleKey: 'user:directorWorkspace.links.labStaff', descKey: 'user:directorWorkspace.links.labStaffDesc', icon: UserCog },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 pb-24 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-600/10 to-transparent pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full" />
      
      <div className="max-w-7xl mx-auto px-6 pt-16 relative z-10">
        
        {/* Header Section */}
        <header className="mb-12 space-y-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 text-indigo-400 font-black text-[11px] uppercase tracking-[0.4em]"
          >
            <Sparkles size={16} />
            {t('user:directorWorkspace.kicker')}
          </motion.div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter italic uppercase">
                Director<span className="text-indigo-500 not-italic">.</span>Hub
              </h1>
              <p className="text-slate-400 text-sm mt-4 font-medium max-w-2xl leading-relaxed border-l-2 border-indigo-500/30 pl-4">
                {t('user:directorWorkspace.subtitle')}
              </p>
            </motion.div>
            
            <div className="hidden lg:block">
               <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Hệ thống vận hành</div>
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE OPERATIONAL DATA
                  </div>
               </div>
            </div>
          </div>
        </header>

        {/* CẤU TRÚC LAYOUT MỚI */}
        <div className="space-y-16">
          
          {/* 1. Personal & Quick Access (Tách riêng phần Account lên đầu để cá nhân hóa) */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-indigo-400/80 whitespace-nowrap">
                {t(`user:directorWorkspace.sections.account`)}
              </h2>
              <div className="h-[1px] w-full bg-gradient-to-r from-indigo-500/30 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {personalActions.map((item, idx) => (
                <CardLink key={item.to} item={item} index={idx} />
              ))}
            </div>
          </section>

          {/* 2. Core Publications (Chia nhóm 12 items thành 3 cột rõ ràng: Research - Curriculum - Documents) */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-emerald-400/80 whitespace-nowrap">
                {t(`user:directorWorkspace.sections.publication`)}
              </h2>
              <div className="h-[1px] w-full bg-gradient-to-r from-emerald-500/30 to-transparent" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cột 1: Research */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2 text-sm font-bold text-slate-300">
                  <BookOpen size={16} className="text-emerald-500" /> Research
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                  {publicationGroups.research.map((item, idx) => (
                    <CardLink key={item.to} item={item} index={idx} />
                  ))}
                </div>
              </div>

              {/* Cột 2: Curriculum */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2 text-sm font-bold text-slate-300">
                  <Microscope size={16} className="text-emerald-500" /> Curriculum
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                  {publicationGroups.curriculum.map((item, idx) => (
                    <CardLink key={item.to} item={item} index={idx} />
                  ))}
                </div>
              </div>

              {/* Cột 3: Documents */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2 text-sm font-bold text-slate-300">
                  <FileText size={16} className="text-emerald-500" /> Documents
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                  {publicationGroups.documents.map((item, idx) => (
                    <CardLink key={item.to} item={item} index={idx} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 3. Management & Operations (Gom Verilog và HR lại chung) */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-orange-400/80 whitespace-nowrap">
                System & HR Operations
              </h2>
              <div className="h-[1px] w-full bg-gradient-to-r from-orange-500/30 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {managementActions.map((item, idx) => (
                <CardLink key={item.to} item={item} index={idx} />
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* Footer System Status */}
      <footer className="mt-32 border-t border-white/5 py-12 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 opacity-40">
           <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                <Cpu size={14} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Encrypted Workspace v2.0.4
              </span>
           </div>
           <div className="text-[10px] font-medium text-slate-500">
              © 2024 Research & Education Management System. All nodes secured.
           </div>
        </div>
      </footer>
    </div>
  );
};

export default DirectorWorkspace;  
