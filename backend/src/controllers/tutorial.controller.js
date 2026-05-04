const { explainTerm } = require('../services/tutorialExplain.service');
const ApiResponse = require('../utils/response');

/**
 * POST /api/tutorial/explain — giải thích thuật ngữ khi bôi đen văn bản (yêu cầu đăng nhập).
 */
const explainSelection = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return ApiResponse.badRequest(res, 'Không có văn bản nào được chọn');
    }
    const result = await explainTerm(String(text).trim());
    return ApiResponse.success(res, {
      term: result.term,
      explanation: result.explanation,
    });
  } catch (err) {
    console.error('tutorial explain:', err);
    const statusCode = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    return ApiResponse.error(
      res,
      err.message || 'Hệ thống AI đang bận, không thể giải thích lúc này.',
      statusCode
    );
  }
};

module.exports = { explainSelection };
