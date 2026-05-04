const { Category } = require('../models');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

function toItem(row) {
  const j = row.toJSON ? row.toJSON() : row;
  return {
    id: j.id,
    name: j.name,
    description: j.description != null && String(j.description).trim() !== '' ? j.description : null,
  };
}

const list = async (req, res) => {
  try {
    const rows = await Category.findAll({
      order: [['name', 'ASC']],
    });
    return ApiResponse.success(res, { items: rows.map(toItem) });
  } catch (err) {
    logger.error('category list:', err?.message || err);
    return ApiResponse.error(res, err?.message || 'Lỗi máy chủ', 500);
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await Category.findByPk(id);
    if (!row) {
      return ApiResponse.notFound(res, 'Không tìm thấy category');
    }
    return ApiResponse.success(res, toItem(row));
  } catch (err) {
    logger.error('category getById:', err?.message || err);
    return ApiResponse.error(res, err?.message || 'Lỗi máy chủ', 500);
  }
};

const create = async (req, res) => {
  try {
    const { name, description } = req.body;
    const desc =
      description != null && String(description).trim() !== '' ? String(description).trim() : null;
    const row = await Category.create({
      name: String(name).trim(),
      description: desc,
    });
    return ApiResponse.created(res, toItem(row), 'Đã tạo category');
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return ApiResponse.conflict(res, 'Tên category đã tồn tại');
    }
    logger.error('category create:', err?.message || err);
    return ApiResponse.error(res, err?.message || 'Lỗi máy chủ', 500);
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const row = await Category.findByPk(id);
    if (!row) {
      return ApiResponse.notFound(res, 'Không tìm thấy category');
    }
    const desc =
      description != null && String(description).trim() !== '' ? String(description).trim() : null;
    row.name = String(name).trim();
    row.description = desc;
    await row.save();
    return ApiResponse.success(res, toItem(row), 'Đã cập nhật category');
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return ApiResponse.conflict(res, 'Tên category đã tồn tại');
    }
    logger.error('category update:', err?.message || err);
    return ApiResponse.error(res, err?.message || 'Lỗi máy chủ', 500);
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await Category.findByPk(id);
    if (!row) {
      return ApiResponse.notFound(res, 'Không tìm thấy category');
    }
    await row.destroy();
    return ApiResponse.success(res, null, 'Đã xóa category');
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      return ApiResponse.error(
        res,
        'Không thể xóa category đang được dùng bởi Curriculum hoặc Document',
        409,
      );
    }
    logger.error('category remove:', err?.message || err);
    return ApiResponse.error(res, err?.message || 'Lỗi máy chủ', 500);
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
