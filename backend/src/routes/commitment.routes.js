const express = require('express');
const commitmentController = require('../controllers/commitment.controller');

// 1. Import đúng các file Middleware
const authMiddleware = require('../middlewares/auth.middleware');
const checkRole = require('../middlewares/role.middleware'); // Đã thêm checkRole
const validate = require('../middlewares/validate.middleware');

const { SYSTEM_ROLES } = require('../config/constants');

// 2. Import ĐẦY ĐỦ 2 cái Schema
const { 
  updateCommitmentStatusSchema, 
  bulkArchiveCommitmentsSchema 
} = require('../validators/commitment.validator');
const forbidBasicUser = require('../middlewares/forbidBasicUser.middleware');

const router = express.Router();

// Endpoint to download all approved commitment documents as a zip file
router.get(
  // 3. Sửa lại path (Gốc ở index.js đã là /commitments rồi)
  '/projects/:projectId/export',
  authMiddleware,
  checkRole(SYSTEM_ROLES.TRUONG_LAB, SYSTEM_ROLES.VIEN_TRUONG), // Gọi checkRole đúng chuẩn
  commitmentController.exportCommitments
);

// Endpoint to bulk-archive commitments (set status to ACTIVE and timestamp)
router.post(
  '/bulk-archive',
  authMiddleware,
  checkRole(SYSTEM_ROLES.TRUONG_LAB, SYSTEM_ROLES.VIEN_TRUONG), // Gọi checkRole đúng chuẩn
  validate(bulkArchiveCommitmentsSchema),
  commitmentController.bulkArchiveCommitments
);

// API cho Member xem cam kết của mình
router.get('/me', authMiddleware, forbidBasicUser, commitmentController.getMyCommitments);

// API cho Member Đồng ý / Từ chối
router.patch(
  '/:id/status',
  authMiddleware,
  forbidBasicUser,
  validate(updateCommitmentStatusSchema),
  commitmentController.updateStatus
);

module.exports = router;