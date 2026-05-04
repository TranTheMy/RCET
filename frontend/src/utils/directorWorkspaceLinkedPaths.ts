import { ROUTER } from '../routes/router';

/**
 * Các route xuất phát từ Director Workspace (đồng bộ với `DirectorWorkspace.tsx`).
 * Dùng để chỉ hiện nút "Quay lại workspace" khi có cờ session + đang ở một trong các trang này.
 */
export function isDirectorWorkspaceLinkedPath(pathname: string): boolean {
  const p = (pathname.replace(/\/$/, '') || '/').toLowerCase();

  const ws = ROUTER.USER.DIRECTOR_WORKSPACE.replace(/\/$/, '').toLowerCase();
  if (p === ws || p.startsWith(`${ws}/`)) return false;

  const prefixes = [
    ROUTER.USER.USERPROFILE,
    ROUTER.USER.CATEGORY,
    ROUTER.USER.RESEARCH,
    ROUTER.USER.CURRICULUM,
    ROUTER.USER.DOCUMENTS,
    ROUTER.USER.CV_APPROVALS,
    '/verilog',
  ].map((x) => x.replace(/\/$/, '').toLowerCase());

  for (const pre of prefixes) {
    if (p === pre || p.startsWith(`${pre}/`)) return true;
  }
  return false;
}
