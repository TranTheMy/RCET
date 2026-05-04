const authService = require('../services/auth.service');
const ApiResponse = require('../utils/response');
const { uploadBuffer, isConfigured } = require('../config/cloudinary');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    return ApiResponse.created(res, result, 'Registration successful. Please check your email to verify your account.');
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return ApiResponse.badRequest(res, 'Verification token is required');
    const result = await authService.verifyEmail(token);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return ApiResponse.success(res, result, 'Login successful');
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const result = await authService.getMe(req.user.id);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const result = await authService.updateProfile(req.user.id, req.body);
    return ApiResponse.success(res, result, 'Đã cập nhật hồ sơ');
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.body);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const result = await authService.changePassword(req.user.id, req.body);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return ApiResponse.badRequest(res, 'Refresh token is required');
    const result = await authService.refreshAccessToken(refresh_token);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const googleCallback = async (req, res) => {
  try {
    const user = req.user;
    const result = await authService.googleLogin(user);
    const redirectUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/callback?access_token=${result.access_token}&refresh_token=${result.refresh_token}&status=${user.status}`;
    res.redirect(redirectUrl);
  } catch (error) {
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/error?message=${error.message}`);
  }
};

const googleError = (req, res) => {
  ApiResponse.unauthorized(res, 'Google authentication failed or was cancelled');
};

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) return ApiResponse.badRequest(res, 'Không có file ảnh');
    if (!isConfigured()) {
      return ApiResponse.error(res, 'Cloudinary chưa cấu hình (CLOUDINARY_* trong .env)', 503);
    }
    const uploaded = await uploadBuffer(req.file.buffer, {
      folder: 'vkslab/avatars',
      resource_type: 'image',
      /** Ảnh đại diện: giới hạn cạnh dài, tối ưu giao hàng */
      transformation: [
        { width: 512, height: 512, crop: 'limit', fetch_format: 'auto', quality: 'auto' },
      ],
    });
    const avatarUrl = uploaded.secure_url;
    const user = await authService.setAvatarUrl(req.user.id, avatarUrl);
    return ApiResponse.success(res, user, 'Đã cập nhật ảnh đại diện');
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

module.exports = {
  register,
  verifyEmail,
  login,
  getMe,
  updateProfile,
  uploadAvatar,
  forgotPassword,
  resetPassword,
  changePassword,
  refreshToken,
  googleCallback,
  googleError,
};

