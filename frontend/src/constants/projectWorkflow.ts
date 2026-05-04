import type { ProjectStatus } from '../types';

/** Khớp `PROJECT_STATUS_TRANSITIONS` backend — dùng cho UI chọn trạng thái hợp lệ */
export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  planning: ['active'],
  active: ['paused', 'done'],
  paused: ['active'],
  done: ['archived'],
  archived: [],
};

export function allowedNextStatuses(current: ProjectStatus, userRole: string | undefined): ProjectStatus[] {
  const next = PROJECT_STATUS_TRANSITIONS[current] || [];
  if (next.includes('archived') && userRole !== 'truong_lab') {
    return next.filter((s) => s !== 'archived');
  }
  return next;
}
