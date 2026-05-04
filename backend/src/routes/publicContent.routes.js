const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { User } = require('../models');
const { Op } = require('sequelize');
const { SYSTEM_ROLES, USER_STATUS } = require('../config/constants');
const env = require('../config/env');
const { sendMail } = require('../utils/email');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

/** --- Lab directory --- */
router.get('/lab/information', async (req, res) => {
  try {
    const users = await User.findAll({
      where: { status: 'active' },
      attributes: ['id', 'full_name', 'email', 'system_role', 'department', 'avatar'],
      limit: 200,
      order: [['full_name', 'ASC']],
    });
    const directory_users = users.map((u) => {
      const j = u.toJSON();
      return {
        id: j.id,
        full_name: j.full_name,
        email: j.email,
        system_role: j.system_role || 'user',
        department: j.department ?? null,
        avatar: j.avatar ?? null,
      };
    });
    return ApiResponse.success(res, {
      directory_users,
      total_directory_units: directory_users.length,
    });
  } catch (err) {
    logger.error('lab/information:', err);
    return ApiResponse.error(res, err.message);
  }
});

const contactContractLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Gửi quá nhanh, vui lòng thử lại sau.' },
});

/** --- Public contact contract proposal --- */
router.post('/public/contact-contract', contactContractLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const org = String(body.org || '').trim();
    const email = String(body.email || '').trim();
    const stack = String(body.stack || '').trim();
    const summary = String(body.summary || '').trim();

    if (!org || !email || !stack || !summary) {
      return ApiResponse.badRequest(res, 'Thiếu thông tin bắt buộc');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ApiResponse.badRequest(res, 'Email liên hệ không hợp lệ');
    }

    const configuredReceiver = String(env.contactFormReceiverEmail || '').trim();
    let receiverEmails = configuredReceiver ? [configuredReceiver] : [];

    if (!receiverEmails.length) {
      const directors = await User.findAll({
        where: {
          status: USER_STATUS.ACTIVE,
          system_role: {
            [Op.in]: [SYSTEM_ROLES.VIEN_TRUONG],
          },
        },
        attributes: ['email', 'full_name'],
        limit: 20,
      });

      receiverEmails = directors
        .map((d) => d.email)
        .filter((x) => x && String(x).trim())
        .map((x) => String(x).trim());
    }

    if (!receiverEmails.length) {
      return ApiResponse.error(res, 'Không tìm thấy email viện trưởng để nhận form', 500);
    }

    const subject = `[VKsLab Contact] Đề xuất hợp tác từ ${org}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h3>Đề xuất hợp tác từ khách truy cập</h3>
        <p><strong>Đơn vị / Phòng lab:</strong> ${org}</p>
        <p><strong>Email liên hệ:</strong> ${email}</p>
        <p><strong>Hướng công nghệ quan tâm:</strong> ${stack}</p>
        <p><strong>Tóm tắt đề xuất:</strong></p>
        <p style="white-space:pre-wrap">${summary}</p>
        <hr />
        <p style="font-size:12px;color:#64748b">
          Nguồn: Form Contact (public)<br/>
          IP: ${req.ip || 'N/A'}<br/>
          User-Agent: ${(req.headers['user-agent'] || '').toString().slice(0, 500)}
        </p>
      </div>
    `;

    await sendMail(receiverEmails.join(','), subject, html);
    return ApiResponse.success(res, null, 'Đã gửi đề xuất thành công');
  } catch (err) {
    logger.error('public contact-contract:', err);
    return ApiResponse.error(res, err.message || 'Không thể gửi đề xuất lúc này', 500);
  }
});

module.exports = router;
