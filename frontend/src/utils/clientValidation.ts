/**
 * Client-side checks aligned with backend Joi rules in `auth.validator.js`
 * (email format, password length + complexity). Use before submit; API remains source of truth.
 */

/** Same character-class pattern as register / change-password / reset-password on the server */
const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/;

/** Practical email shape check (non-empty local + domain with TLD) */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  return EMAIL_SHAPE.test(s);
}

export type PasswordPolicyFailure = 'minLength' | 'complexity';

export function validatePasswordPolicy(
  password: string
): { ok: true } | { ok: false; reason: PasswordPolicyFailure } {
  if (password.length < 8) return { ok: false, reason: 'minLength' };
  if (!PASSWORD_COMPLEXITY.test(password)) return { ok: false, reason: 'complexity' };
  return { ok: true };
}
