const router = require('express').Router();
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const env = require('../config/env');
const avatarUpload = require('../middlewares/avatarUpload.middleware');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} = require('../validators/auth.validator');

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/verify-email', authController.verifyEmail);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/api/auth/google/error' }),
  authController.googleCallback,
);
router.get('/google/error', authController.googleError);

// Protected routes — đặt /me/avatar trước /me nếu sau này có route param
router.get('/me', authMiddleware, authController.getMe);
router.patch(
  '/me/avatar',
  authMiddleware,
  avatarUpload.single('avatar'),
  authController.uploadAvatar,
);
router.patch(
  '/me',
  authMiddleware,
  validate(updateProfileSchema),
  authController.updateProfile,
);
router.post('/change-password', authMiddleware, validate(changePasswordSchema), authController.changePassword);

module.exports = router;

