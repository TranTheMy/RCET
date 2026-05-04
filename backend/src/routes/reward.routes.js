const router = require('express').Router();
const rewardController = require('../controllers/reward.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const checkRole = require('../middlewares/role.middleware'); // Middleware phân quyền của bạn
const { SYSTEM_ROLES } = require('../config/constants');
const multer = require('multer');
// 🛠️ FIX: Đọc thẳng vào RAM, không cần tạo thư mục uploads nữa
const upload = multer({ storage: multer.memoryStorage() });

// Tất cả các API thưởng đều yêu cầu đăng nhập
router.use(authMiddleware);

// ==========================================
// 1. LẤY DỮ LIỆU BẢNG TÍNH THƯỞNG DỰ ÁN
// ==========================================
// Quyền: Ai cũng gọi được. (Logic che giấu tiền của người khác đã xử lý ở Service)
router.get(
  '/project/:projectId',
  rewardController.getProjectRewardSheet
);

// ==========================================
// 2. TÍNH TOÁN LẠI BẢNG THƯỞNG (RECALCULATE)
// ==========================================
// Quyền: Chỉ Viện Trưởng mới có quyền chạy lại luồng tính toán (nếu có sai sót dữ liệu)
router.post(
  '/project/:projectId/recalculate',
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  rewardController.recalculateProjectReward
);

// ==========================================
// 3. ĐIỀU CHỈNH TIỀN THỦ CÔNG (OVERRIDE)
// ==========================================
// Quyền: Chỉ Viện Trưởng mới được sửa tiền
router.put(
  '/detail/:detailId/override',
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  rewardController.updateOverrideAmount
);

// ==========================================
// 4. CHỐT SỔ BẢNG THƯỞNG (FINALIZE)
// ==========================================
// Quyền: Chỉ Viện Trưởng mới được chốt sổ. Sau khi chốt thì không ai sửa hay khiếu nại được nữa.
router.post(
  '/project/:projectId/finalize',
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  rewardController.finalizeSheet
);

// ==========================================
// 5. GỬI KHIẾU NẠI (APPEAL)
// ==========================================
// Quyền: Member, Leader, Truong Lab (Những người nhận thưởng)
router.post(
  '/detail/:detailId/appeal',
  checkRole(SYSTEM_ROLES.MEMBER, SYSTEM_ROLES.TRUONG_LAB),
  rewardController.appealRewardDetail
);
router.put(
  '/detail/:detailId/resolve-appeal',
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  rewardController.resolveRewardAppeal
);

// ==========================================
// 6. XUẤT FILE EXCEL
// ==========================================
router.get(
  '/project/:projectId/export',
  checkRole(SYSTEM_ROLES.VIEN_TRUONG, SYSTEM_ROLES.TRUONG_LAB, SYSTEM_ROLES.MEMBER),
  rewardController.exportExcel
);

// ==========================================
// 7. IMPORT FILE EXCEL
// ==========================================
router.post(
  '/project/:projectId/import',
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  upload.single('excel_file'), // 👈 Middleware bắt file có tên là 'excel_file' từ giao diện gửi lên
  rewardController.importExcel
);
module.exports = router;