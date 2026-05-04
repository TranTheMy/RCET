const router = require('express').Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const forbidBasicUser = require('../middlewares/forbidBasicUser.middleware');

// All user endpoints require authentication
router.use(authMiddleware);

// Hồ sơ bản thân — mọi role (kể cả `user` cơ bản)
router.get('/me', userController.getCurrentUser);

router.use(forbidBasicUser);

// 1. API lấy danh sách Bên A (Tất cả tài khoản không có student_code)
router.get('/party-a', userController.getPartyAList);

// List users
router.get('/', userController.listUsers);

// Get user by ID (Route chứa :id luôn luôn phải nằm ở cuối cùng)
router.get('/:id', userController.getUserById);

module.exports = router;