import type { TFunction } from 'i18next';
import type { FieldErrorsMap } from './formFieldErrors';

/**
 * Maps exact `message` strings from the Node API (and Joi custom messages) to i18n keys.
 * Unmapped strings are returned as-is (often already Vietnamese from the server).
 */
const MESSAGE_TO_I18N_KEY: Record<string, string> = {
  // Auth service
  'Invalid email or password': 'auth:login.errors.invalidCredentials',
  'Please verify your email before logging in': 'auth:login.errors.verifyEmailFirst',
  'Your account has been rejected': 'auth:login.errors.accountRejected',
  'Your account has been locked': 'auth:login.errors.accountLocked',
  'Email already registered': 'common:apiErrors.emailAlreadyRegistered',
  'Student code already in use': 'common:apiErrors.studentCodeInUse',
  'Invalid or expired verification token': 'common:apiErrors.invalidVerificationToken',
  'Invalid or expired reset token': 'common:apiErrors.invalidResetToken',
  'User not found': 'common:apiErrors.userNotFound',
  'If this email is registered, you will receive a password reset link.':
    'common:apiErrors.forgotPasswordHint',
  'Current password is incorrect': 'common:apiErrors.currentPasswordIncorrect',
  'Password changed successfully': 'common:apiErrors.passwordChanged',
  'User no longer exists': 'common:apiErrors.userNoLongerExists',
  'Invalid or expired refresh token': 'common:apiErrors.invalidRefreshToken',
  'User not found after Google auth': 'common:apiErrors.googleAuthUserNotFound',
  'Email verified. Your account is pending admin approval.': 'common:apiErrors.emailVerifiedPending',
  'Password reset successfully. Please log in with your new password.': 'common:apiErrors.resetSuccess',

  // Auth Joi (auth.validator.js)
  'Full name must be at least 2 characters': 'common:apiErrors.joiFullNameMin',
  'Please provide a valid email address': 'common:apiErrors.joiEmailInvalid',
  'Password must contain at least one uppercase, one lowercase, one digit, and one special character':
    'common:apiErrors.joiPasswordComplexity',
  'Password must be at least 8 characters': 'common:apiErrors.joiPasswordMin',

  // Rate limit / app
  'Too many requests, please try again later': 'common:apiErrors.rateLimit',
  'Too many requests, please try again shortly': 'common:apiErrors.rateLimitShort',

  // project.service.js (English)
  'Project not found': 'common:apiErrors.projectNotFound',
  'You do not have access to this project': 'common:apiErrors.noProjectAccess',
  'Bạn đã từ chối hoặc không còn liên quan tới dự án này. Không thể xem chi tiết.':
    'common:apiErrors.noProjectAccessAfterReject',
  'You do not have permission to update this project': 'common:apiErrors.noPermissionUpdateProject',
  'Only truong_lab can archive a project': 'common:apiErrors.onlyTruongLabArchive',
  'Members cannot create tasks': 'common:apiErrors.membersCannotCreateTasks',
  'Assignee is not a member of this project': 'common:apiErrors.assigneeNotMember',
  'Task not found': 'common:apiErrors.taskNotFound',
  'Task title is required': 'projects:tasks.modal.errors.titleRequired',
  '"title" is not allowed to be empty': 'projects:tasks.modal.errors.titleRequired',
  '"title" length must be less than or equal to 255 characters': 'projects:tasks.modal.errors.titleMaxLength',
  'You can only update your own tasks': 'common:apiErrors.onlyOwnTasks',
  'Members can only update task status': 'common:apiErrors.membersOnlyTaskStatus',
  'User is not a member of this project': 'common:apiErrors.userNotProjectMember',
  'You do not have permission to add members': 'common:apiErrors.noPermissionAddMembers',
  'Chỉ trưởng lab hoặc viện trưởng mới được mời thêm thành viên.':
    'common:apiErrors.onlyTruongLabVienTruongInviteMembers',
  'Chỉ có thể mời thêm thành viên khi dự án đang tạm dừng (paused).':
    'common:apiErrors.addMembersOnlyWhenPaused',
  'User not found or not active': 'common:apiErrors.userNotFoundOrInactive',
  'Member not found': 'common:apiErrors.memberNotFound',
  'Cannot remove the project leader': 'common:apiErrors.cannotRemoveLeader',
  'Member removed successfully': 'common:apiErrors.memberRemoved',
  'You do not have permission to create milestones': 'common:apiErrors.noPermissionCreateMilestones',
  'Only non-completed tasks from this project can be linked to a milestone':
    'common:apiErrors.milestoneTaskLink',
  'You do not have permission to update milestones': 'common:apiErrors.noPermissionUpdateMilestones',
  'Milestone not found': 'common:apiErrors.milestoneNotFound',
  'Report for this week already submitted': 'common:apiErrors.reportWeekDuplicate',
  'Forbidden': 'common:apiErrors.forbidden',
  'Git repository updated': 'common:apiErrors.gitRepoUpdated',
  'Webhook processed': 'common:apiErrors.webhookProcessed',

  // commitment.service.js
  'Commitment IDs are required.': 'common:apiErrors.commitmentIdsRequired',
  'Commitment not found or unauthorized': 'common:apiErrors.commitmentNotFound',
  'Only pending commitments can be updated': 'common:apiErrors.commitmentOnlyPending',

  // Generic validation wrapper
  'Validation error': 'common:apiErrors.validationError',
};

const FALLBACK_RULES: Array<{ test: (s: string) => boolean; key: string }> = [
  {
    test: (s) => /invalid email or password/i.test(s),
    key: 'auth:login.errors.invalidCredentials',
  },
  {
    test: (s) => /please verify your email before logging in/i.test(s),
    key: 'auth:login.errors.verifyEmailFirst',
  },
  {
    test: (s) => /your account has been rejected/i.test(s),
    key: 'auth:login.errors.accountRejected',
  },
  {
    test: (s) => /your account has been locked/i.test(s),
    key: 'auth:login.errors.accountLocked',
  },
];

export function translateApiMessage(t: TFunction, raw?: string | null): string {
  if (raw == null || typeof raw !== 'string') return raw ?? '';
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  const key = MESSAGE_TO_I18N_KEY[trimmed] ?? MESSAGE_TO_I18N_KEY[raw];
  if (key) return t(key);

  for (const rule of FALLBACK_RULES) {
    if (rule.test(trimmed)) return t(rule.key);
  }

  return raw;
}

export function translateFieldErrors(t: TFunction, fe: FieldErrorsMap): FieldErrorsMap {
  const out: FieldErrorsMap = {};
  for (const [k, v] of Object.entries(fe)) {
    if (typeof v === 'string' && v) out[k] = translateApiMessage(t, v);
    else out[k] = v;
  }
  return out;
}
