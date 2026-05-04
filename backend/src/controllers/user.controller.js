const { User } = require('../models');
const { Op } = require('sequelize');
const ApiResponse = require('../utils/response');

const listUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'full_name', 'email', 'system_role', 'status', 'department', 'created_at', 'updated_at'],
      order: [['full_name', 'ASC']],
    });
    return ApiResponse.success(res, users);
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = await User.findByPk(id, {
      attributes: ['id', 'full_name', 'email', 'system_role', 'status', 'department', 'email_verified', 'created_at', 'updated_at'],
    });
    if (!user) return ApiResponse.notFound(res, 'User not found');
    return ApiResponse.success(res, user);
  } catch (error) {
    next(error);
  }
};
const getPartyAList = async (req, res, next) => {
  try {
    console.log("=== BẮT ĐẦU LẤY DANH SÁCH BÊN A ===");
    const users = await User.findAll({
      where: {
        // Điều kiện 1: Phải là tài khoản không có mã sinh viên
        [Op.or]: [
          { student_code: null },
          { student_code: '' }
        ],
        // Điều kiện 2: Loại trừ chính xác tên của 2 tài khoản không mong muốn
        full_name: {
          [Op.notIn]: ['System Admin', 'Guest User']
        }
      },
      attributes: ['id', 'full_name', 'email'] 
    });
    console.log(`=> Đã tìm thấy ${users.length} giảng viên.`);
    return ApiResponse.success(res, users);
  } catch (error) {
    console.error("❌ LỖI GET PARTY A:", error);
    next(error);
  }
};
const getCurrentUser = async (req, res, next) => {
  try {
    console.log("=== BẮT ĐẦU LẤY THÔNG TIN CÁ NHÂN ===");
    // Lưu ý: Tùy vào cách cấu hình JWT Middleware, ID có thể nằm ở req.user.id hoặc req.user.userId
    const userId = req.user.id || req.user.userId; 
    
    const user = await User.findByPk(userId, {
      attributes: ['id', 'full_name', 'email', 'student_code']
    });
    
    if (!user) {
      console.log("❌ LỖI: Không tìm thấy user ID:", userId);
      return ApiResponse.notFound(res, 'Không tìm thấy thông tin người dùng.');
    }

    console.log("=> Đã lấy thành công thông tin của:", user.full_name);
    return ApiResponse.success(res, user);
  } catch (error) {
    console.error("❌ LỖI GET CURRENT USER:", error);
    next(error);
  }
};

module.exports = {
  listUsers,
  getUserById,
  // 2 hàm mới thêm vào
  getPartyAList,
  getCurrentUser
};
