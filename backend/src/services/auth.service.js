const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, ApprovalRequest, sequelize } = require('../models');
const env = require('../config/env');
const { USER_STATUS, APPROVAL_STATUS, AUDIT_ACTIONS } = require('../config/constants');
const { sendMail, emailTemplates } = require('../utils/email');
const auditService = require('./audit.service');

const SALT_ROUNDS = 12;

const generateAccessToken = (user) => {
  return jwt.sign(
    { user_id: user.id, system_role: user.system_role, status: user.status },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn },
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { user_id: user.id, system_role: user.system_role, status: user.status },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn },
  );
};

const register = async ({ full_name, email, password, student_code, department }) => {
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw { status: 409, message: 'Email already registered' };
  }

  if (student_code) {
    const existingCode = await User.findOne({ where: { student_code } });
    if (existingCode) {
      throw { status: 409, message: 'Student code already in use' };
    }
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const email_verify_token = crypto.randomBytes(32).toString('hex');
  const userId = require('uuid').v4();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Use raw SQL to avoid Sequelize issues
  await sequelize.query(
    `INSERT INTO [Users] ([id], [full_name], [email], [password_hash], [student_code], [department], [status], [system_role], [email_verified], [email_verify_token], [created_at], [updated_at])
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CONVERT(DATETIME, ?), CONVERT(DATETIME, ?))`,
    {
      replacements: [
        userId,
        full_name,
        email,
        password_hash,
        student_code || null,
        department || null,
        USER_STATUS.PENDING,
        null,
        0,
        email_verify_token,
        now,
        now,
      ],
    },
  );

  // Send verification email
  const verifyUrl = `${env.clientUrl}/auth/verify-email?token=${email_verify_token}`;
  const template = emailTemplates.verifyEmail(full_name, verifyUrl);
  sendMail(email, template.subject, template.html);

  await auditService.log(AUDIT_ACTIONS.USER_REGISTERED, userId, userId);

  return {
    id: userId,
    full_name,
    email,
    status: USER_STATUS.PENDING,
  };
};

const verifyEmail = async (token) => {
  const user = await User.findOne({ where: { email_verify_token: token } });
  if (!user) {
    throw { status: 400, message: 'Invalid or expired verification token' };
  }

  // Use raw SQL to update user
  await sequelize.query(
    `UPDATE [Users] SET [email_verified] = ?, [email_verify_token] = NULL WHERE [id] = ?`,
    { replacements: [1, user.id] },
  );

  // Create approval request
  const requestId = require('uuid').v4();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await sequelize.query(
    `INSERT INTO [ApprovalRequests] ([id], [user_id], [status], [created_at], [updated_at])
     VALUES (?, ?, ?, CONVERT(DATETIME, ?), CONVERT(DATETIME, ?))`,
    { replacements: [requestId, user.id, APPROVAL_STATUS.PENDING, now, now] },
  );

  await auditService.log(AUDIT_ACTIONS.EMAIL_VERIFIED, user.id, user.id);
  await auditService.log(AUDIT_ACTIONS.APPROVAL_CREATED, user.id, user.id);

  // Notify admin(s)
  const admins = await User.findAll({
    where: { system_role: 'admin', status: USER_STATUS.ACTIVE },
    attributes: ['email'],
  });
  for (const admin of admins) {
    sendMail(
      admin.email,
      'New Approval Request - VKsLab System',
      `<p>A new user <strong>${user.full_name}</strong> (${user.email}) has verified their email and is waiting for approval.</p>`,
    );
  }

  return { message: 'Email verified. Your account is pending admin approval.' };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw { status: 401, message: 'Invalid email or password' };
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw { status: 401, message: 'Invalid email or password' };
  }

  if (!user.email_verified) {
    throw { status: 403, message: 'Please verify your email before logging in' };
  }

  if (user.status === USER_STATUS.REJECTED) {
    throw { status: 403, message: 'Your account has been rejected' };
  }

  if (user.status === USER_STATUS.LOCKED) {
    throw { status: 403, message: 'Your account has been locked' };
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Don't save to DB — just generate and return tokens
  // Refresh token validation is done via JWT signature, not DB lookup

  await auditService.log(AUDIT_ACTIONS.USER_LOGIN, user.id, user.id);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      system_role: user.system_role,
      status: user.status,
    },
  };
};

const getMe = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: [
      'id',
      'full_name',
      'email',
      'student_code',
      'department',
      'phone_number',
      'system_role',
      'status',
      'email_verified',
      'created_at',
      'avatar',
    ],
  });
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }
  return user;
};

const updateProfile = async (userId, body) => {
  const user = await User.findByPk(userId);
  if (!user) throw { status: 404, message: 'User not found' };
  const { full_name, student_code, department, phone_number } = body;
  const updates = {};
  if (full_name !== undefined) updates.full_name = full_name.trim();
  if (student_code !== undefined) updates.student_code = student_code ? String(student_code).trim() : null;
  if (department !== undefined) updates.department = department ? String(department).trim() : null;
  if (phone_number !== undefined) {
    const p = phone_number === null || phone_number === '' ? null : String(phone_number).trim();
    if (p) {
      const taken = await User.findOne({
        where: {
          phone_number: p,
          id: { [Op.ne]: userId },
        },
      });
      if (taken) {
        throw {
          status: 409,
          message: 'Số điện thoại này đã được sử dụng bởi tài khoản khác trong hệ thống.',
        };
      }
    }
    updates.phone_number = p;
  }
  if (Object.keys(updates).length === 0) {
    return getMe(userId);
  }
  await user.update(updates);
  return getMe(userId);
};

const setAvatarUrl = async (userId, avatarUrl) => {
  const user = await User.findByPk(userId);
  if (!user) throw { status: 404, message: 'User not found' };
  await user.update({ avatar: avatarUrl });
  return getMe(userId);
};

const forgotPassword = async (email) => {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    // Don't reveal whether email exists
    return { message: 'If this email is registered, you will receive a password reset link.' };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  // Use raw SQL to update user
  await sequelize.query(
    `UPDATE [Users] SET [password_reset_token] = ?, [password_reset_expires] = CONVERT(DATETIME, ?) WHERE [id] = ?`,
    { replacements: [hashedToken, resetExpires, user.id] },
  );

  const resetUrl = `${env.clientUrl}/auth/reset-password?token=${resetToken}`;
  const template = emailTemplates.resetPassword(user.full_name, resetUrl);
  sendMail(user.email, template.subject, template.html);

  return { message: 'If this email is registered, you will receive a password reset link.' };
};

const resetPassword = async ({ token, password }) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Use raw SQL to avoid Sequelize date issues
  const [user] = await sequelize.query(
    `SELECT [id], [full_name], [email] FROM [Users] WHERE [password_reset_token] = ? AND [password_reset_expires] > CONVERT(DATETIME, ?)`,
    { replacements: [hashedToken, now], type: sequelize.QueryTypes.SELECT },
  );

  if (!user) {
    throw { status: 400, message: 'Invalid or expired reset token' };
  }

  // Update password using raw SQL
  await sequelize.query(
    `UPDATE [Users] SET [password_hash] = ?, [password_reset_token] = NULL, [password_reset_expires] = NULL WHERE [id] = ?`,
    { replacements: [await bcrypt.hash(password, SALT_ROUNDS), user.id] },
  );

  await auditService.log(AUDIT_ACTIONS.PASSWORD_RESET, user.id, user.id);

  return { message: 'Password reset successfully. Please log in with your new password.' };
};

const changePassword = async (userId, { current_password, new_password }) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }

  const isMatch = await bcrypt.compare(current_password, user.password_hash);
  if (!isMatch) {
    throw { status: 401, message: 'Current password is incorrect' };
  }

  // Use raw SQL to avoid Sequelize issues
  await sequelize.query(
    `UPDATE [Users] SET [password_hash] = ? WHERE [id] = ?`,
    { replacements: [await bcrypt.hash(new_password, SALT_ROUNDS), userId] },
  );

  await auditService.log(AUDIT_ACTIONS.PASSWORD_CHANGED, userId, userId);

  return { message: 'Password changed successfully' };
};

const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, env.jwt.refreshSecret);
    const user = await User.findByPk(decoded.user_id);

    if (!user) {
      throw { status: 401, message: 'User no longer exists' };
    }

    const accessToken = generateAccessToken(user);
    return { access_token: accessToken };
  } catch (error) {
    if (error.status) throw error;
    throw { status: 401, message: 'Invalid or expired refresh token' };
  }
};

const googleLogin = async (user) => {
  if (!user) {
    throw { status: 401, message: 'User not found after Google auth' };
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Don't save refresh_token to DB — JWT signature is validation

  await auditService.log(AUDIT_ACTIONS.USER_LOGIN, user.id, user.id, { method: 'google' });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      system_role: user.system_role,
      status: user.status,
    },
  };
};

module.exports = {
  register,
  verifyEmail,
  login,
  getMe,
  updateProfile,
  setAvatarUrl,
  forgotPassword,
  resetPassword,
  changePassword,
  refreshAccessToken,
  googleLogin,
};
