const commitmentService = require('../services/commitment.service');
const ApiResponse = require('../utils/response');

/**
 * Xuất file cam kết (ZIP chứa nhiều PDF)
 * Controller điều phối Request -> Gọi Service -> Trả ZIP về Client
 */
const exportCommitments = async (req, res, next) => {
  try {
    // 1. Lấy dữ liệu từ Request (Express)
    const { projectId } = req.params;
    const ids = req.query.ids ? req.query.ids.split(',') : [];

    // 2. Gọi Service xử lý lõi (Database + Puppeteer + Archiver)
    const result = await commitmentService.exportCommitments(projectId, ids);

    // Xử lý trường hợp không có file
    if (!result || !result.data) {
      return ApiResponse.error(res, 'Không có bản cam kết nào hợp lệ để xuất', 404);
    }

    // 3. Chuẩn hóa tên file và set Header để tải xuống
    const encodedFileName = encodeURIComponent(result.fileName);
    
    if (result.type === 'zip') {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition', 
        `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`
      );
      
      // 4. Bắn luồng dữ liệu (stream) file ZIP trực tiếp về client
      result.data.pipe(res); 

      // Bắt lỗi stream
      result.data.on('error', (err) => {
        if (!res.headersSent) next(err);
      });
    }

  } catch (error) {
    // Bắt các lỗi throw từ Service (ví dụ: 'Project not found')
    if (error.message === 'Project not found' || error.message === 'Party A (Lecturer) not found for this project') {
      return ApiResponse.error(res, error.message, 404);
    }
    next(error);
  }
};

/**
 * [GIỮ NGUYÊN] Lưu trữ bản cứng hàng loạt
 */
const bulkArchiveCommitments = async (req, res, next) => {
  try {
    const result = await commitmentService.bulkArchiveCommitments({
      commitmentIds: req.body.commitmentIds,
      userId: req.user.id,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

/**
 * [GIỮ NGUYÊN] Lấy danh sách cam kết cá nhân
 */
const getMyCommitments = async (req, res, next) => {
  try {
    const data = await commitmentService.getMyCommitments(req.user.id);
    return ApiResponse.success(res, data);
  } catch (error) { 
    next(error); 
  }
};

/**
 * [GIỮ NGUYÊN] Cập nhật trạng thái (Đồng ý/Từ chối)
 */
const updateStatus = async (req, res, next) => {
  try {
    const data = await commitmentService.updateStatus(req.params.id, req.user.id, req.body);
    return ApiResponse.success(res, data);
  } catch (error) { 
    next(error); 
  }
};

module.exports = {
  exportCommitments,
  bulkArchiveCommitments,
  getMyCommitments,
  updateStatus,
};