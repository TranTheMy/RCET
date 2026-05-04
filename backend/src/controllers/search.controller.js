const searchService = require('../services/search.service');
const ApiResponse = require('../utils/response');

/**
 * GET /api/search?q=...&scope=all|project|document|curriculum|research
 * - Không scope / all: tìm toàn cục theo từ khóa.
 * - scope hoặc tag @ trong q: tìm theo phân vùng.
 */
const searchAcademicData = async (req, res) => {
  try {
    const { q, scope } = req.query;
    const data = await searchService.searchAllData({ q, scope });
    return ApiResponse.success(res, data);
  } catch (error) {
    console.error('Search Controller Error:', error);
    return ApiResponse.error(res, error.message || 'Lỗi Server', 500);
  }
};

module.exports = { searchAcademicData };
