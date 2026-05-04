import type { DocumentItem } from '../types';

/** Sequelize có thể trả createdAt hoặc created_at */
export function docCreatedAt(d: DocumentItem & { createdAt?: string }): string {
  return d.created_at ?? d.createdAt ?? '';
}

export function docPublishedAt(d: DocumentItem & { publishedAt?: string }): string {
  return d.published_at ?? d.publishedAt ?? '';
}

export function formatTechnicalMeta(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}
