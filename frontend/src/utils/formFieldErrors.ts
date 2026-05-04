import axios from 'axios';

/** Lỗi theo tên field từ API (`errors` trong body) hoặc map thủ công ở component. */
export type FieldErrorsMap = Record<string, string | undefined>;

export type ParsedApiError = {
  /** Thông điệp chung từ backend (`message`) */
  message?: string;
  /** Map field → message (khi backend gửi `errors: { ... }`) */
  fieldErrors: FieldErrorsMap;
};

/**
 * Đọc `response.data` từ Axios: `message` + optional `errors`:
 * - object `field → string | string[]`
 * - array `{ field, message }[]` (Joi middleware backend)
 */
export function parseApiFormError(err: unknown): ParsedApiError {
  const fieldErrors: FieldErrorsMap = {};
  if (!axios.isAxiosError(err)) {
    return { fieldErrors };
  }
  const data = err.response?.data as
    | {
        message?: string;
        errors?:
          | Record<string, string | string[]>
          | Array<{ field?: string; message?: string }>;
      }
    | undefined;
  const raw = data?.errors;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item.field === 'string' && typeof item.message === 'string') {
        if (!fieldErrors[item.field]) fieldErrors[item.field] = item.message;
      }
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      fieldErrors[k] = Array.isArray(v) ? v[0] : String(v);
    }
  }
  return { message: typeof data?.message === 'string' ? data.message : undefined, fieldErrors };
}

/** Class input auth (dark theme): trạng thái lỗi dùng một lớp viền mềm, tránh chồng border+ring gắt. */
export function authInputClassNames(hasError: boolean): string {
  const base =
    'w-full pl-12 pr-5 py-3.5 bg-slate-950/50 rounded-xl outline-none transition-[border-color,box-shadow] duration-200 text-[11px] font-medium tracking-normal text-white placeholder:text-slate-600';
  if (hasError) {
    return `${base} border border-rose-500/40 bg-slate-950/70 focus:border-rose-400/55 focus:ring-2 focus:ring-rose-500/12`;
  }
  return `${base} border border-white/10 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5`;
}

/** Ô mật khẩu có nút hiện/ẩn bên phải — chừa padding phải. */
export function authPasswordInputClassNames(hasError: boolean): string {
  return `${authInputClassNames(hasError)} !pr-12`;
}

/** Dòng lỗi dưới ô auth: căn trái, thẳng hàng với chữ trong ô (pl-12 = padding-left của input). */
export function authFieldErrorMessageClassNames(): string {
  return 'mt-2 mb-1 w-full max-w-full text-left text-start pl-12 pr-3 text-[10px] font-medium leading-snug tracking-normal text-rose-300/95';
}
