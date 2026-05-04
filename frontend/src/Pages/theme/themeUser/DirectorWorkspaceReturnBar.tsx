import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import { ROUTER } from '../../../routes/router';
import { hasDirectorWorkspaceFlow } from '../../../utils/directorWorkspaceFlow';
import { isDirectorWorkspaceLinkedPath } from '../../../utils/directorWorkspaceLinkedPaths';

/**
 * Chỉ hiện khi: viện trưởng + vừa đi từ workspace (session) + đang ở route liên kết workspace.
 */
const DirectorWorkspaceReturnBar = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { pathname } = useLocation();

  if (user?.system_role !== 'vien_truong') return null;
  if (!hasDirectorWorkspaceFlow()) return null;
  if (!isDirectorWorkspaceLinkedPath(pathname)) return null;

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3 pb-1">
      <Link
        to={ROUTER.USER.DIRECTOR_WORKSPACE}
        className="inline-flex w-fit max-w-full items-center justify-center gap-2 rounded-full border border-slate-200/90 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-blue-900 shadow-sm transition-colors hover:border-blue-200 hover:bg-sky-50/90 hover:text-blue-950"
      >
        <ArrowLeft size={15} strokeWidth={2.5} className="shrink-0 text-blue-900" aria-hidden />
        <LayoutGrid size={15} strokeWidth={2} className="shrink-0 text-blue-900 opacity-90" aria-hidden />
        <span className="leading-tight">{t('user:directorWorkspace.backToWorkspace')}</span>
      </Link>
    </div>
  );
};

export default DirectorWorkspaceReturnBar;
