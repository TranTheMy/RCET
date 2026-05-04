/** Đánh dấu: viện trưởng vừa đi từ Không gian làm việc sang trang liên kết (session). */
const STORAGE_KEY = 'vkslab_director_workspace_flow';

export function setDirectorWorkspaceFlow(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearDirectorWorkspaceFlow(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasDirectorWorkspaceFlow(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
