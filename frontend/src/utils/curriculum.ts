import type { CurriculumItem, CurriculumStatus } from '../types';

export function curriculumCreatedAt(d: CurriculumItem & { createdAt?: string }): string {
  return d.created_at ?? d.createdAt ?? '';
}

export function curriculumApprovedAt(d: CurriculumItem & { approvedAt?: string }): string {
  return d.approved_at ?? d.approvedAt ?? '';
}

const UNFINISHED: CurriculumStatus[] = ['draft', 'pending', 'revision'];

function versionNum(it: CurriculumItem): number {
  return it.version_number ?? 0;
}

/**
 * Gom theo version_group_id cho "My Curriculum":
 * - Có bản nháp/chờ duyệt/chỉnh sửa: vẫn hiển thị bản approved ngay trước đó (một bản) + các bản chưa hoàn tất + rejected/archived…
 * - Chỉ còn nhiều bản approved trong cùng nhóm (dữ liệu cũ / lỗi): chỉ giữ bản approved mới nhất.
 */
export function dedupeMineCurriculumItems(items: CurriculumItem[]): CurriculumItem[] {
  const byGroup = new Map<string, CurriculumItem[]>();
  for (const it of items) {
    const gid = it.version_group_id || it.id;
    if (!byGroup.has(gid)) byGroup.set(gid, []);
    byGroup.get(gid)!.push(it);
  }

  const out: CurriculumItem[] = [];

  for (const [, group] of byGroup) {
    const unfinished = group.filter((x) => UNFINISHED.includes(x.status));
    const approved = group.filter((x) => x.status === 'approved');
    const rest = group.filter((x) => x.status !== 'approved' && !UNFINISHED.includes(x.status));

    if (unfinished.length > 0) {
      const maxUnfinishedVer = Math.max(...unfinished.map(versionNum), 0);
      const olderApprovedPool = approved.filter((a) => versionNum(a) < maxUnfinishedVer);
      const oldApproved =
        olderApprovedPool.length === 0
          ? []
          : [
              olderApprovedPool.reduce((best, a) =>
                versionNum(a) > versionNum(best) ? a : best,
              ),
            ];
      out.push(...unfinished, ...oldApproved, ...rest);
    } else if (approved.length <= 1) {
      out.push(...group);
    } else {
      const best = approved.reduce((best, a) => (versionNum(a) > versionNum(best) ? a : best));
      out.push(best, ...rest);
    }
  }

  return out.sort((a, b) => {
    const ta = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    const tb = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    return ta - tb;
  });
}

/**
 * GET/POST curriculum trả về envelope `{ success, data: CurriculumItem }`;
 * một số client/proxy có thể lồng thêm một tầng `data`.
 */
export function extractCurriculumFromEnvelope(res: unknown): CurriculumItem | null {
  if (!res || typeof res !== 'object') return null;
  const r = res as Record<string, unknown>;
  const d = r.data;
  if (d && typeof d === 'object') {
    const inner = d as Record<string, unknown>;
    if (inner.data && typeof inner.data === 'object' && typeof (inner.data as Record<string, unknown>).id === 'string') {
      return inner.data as CurriculumItem;
    }
    if (typeof inner.id === 'string') {
      return d as CurriculumItem;
    }
  }
  if (typeof r.id === 'string') {
    return res as CurriculumItem;
  }
  return null;
}

/** Form chỉnh sửa: nháp hoặc bị từ chối (backend update sẽ đưa rejected → draft). */
export function canEditCurriculumInForm(status: string | undefined | null): boolean {
  const s = String(status ?? '').toLowerCase().trim();
  return s === 'draft' || s === 'rejected';
}
