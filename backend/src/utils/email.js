const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('./logger');

/** Đủ biến môi trường để thử gửi mail (thiếu thì không tạo transporter — tránh lỗi im lặng). */
function isSmtpConfigured() {
  const host = env.smtp?.host && String(env.smtp.host).trim();
  const user = env.smtp?.user && String(env.smtp.user).trim();
  const pass = env.smtp?.pass != null && String(env.smtp.pass).trim();
  return Boolean(host && user && pass);
}

let transporter = null;
function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: String(env.smtp.host).trim(),
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: {
        user: String(env.smtp.user).trim(),
        pass: String(env.smtp.pass).trim(),
      },
    });
  }
  return transporter;
}

let smtpMissingDetailedLogDone = false;

/**
 * @returns {Promise<boolean>} true nếu đã gửi qua SMTP thành công
 */
const sendMail = async (to, subject, html) => {
  if (!to || !String(to).trim()) {
    logger.warn('sendMail: thiếu địa chỉ người nhận, bỏ qua');
    return false;
  }
  if (!isSmtpConfigured()) {
    if (!smtpMissingDetailedLogDone) {
      logger.warn(
        'SMTP chưa cấu hình: đặt SMTP_HOST, SMTP_USER, SMTP_PASS trong .env (xem .env.example). Email hệ thống (mời dự án, xác thực, …) sẽ không được gửi.',
      );
      smtpMissingDetailedLogDone = true;
    }
    logger.warn(`sendMail: bỏ qua gửi tới ${String(to).trim()} — thiếu SMTP`);
    return false;
  }
  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: `"VKsLab" <${String(env.smtp.user).trim()}>`,
      to: String(to).trim(),
      subject,
      html,
    });
    logger.info(`sendMail: đã gửi tới ${String(to).trim()}`);
    return true;
  } catch (err) {
    logger.error('sendMail thất bại:', err?.message || err);
    return false;
  }
};

function escapeHtml(text) {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const emailTemplates = {
  // 1. Xác thực email
  verifyEmail: (name, verifyUrl) => ({
    subject: 'Xác thực Địa chỉ Email | VKsLab System',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #0f172a; padding: 25px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">VKsLab System</h2>
        </div>
        <div style="padding: 35px; background-color: #ffffff;">
          <h3 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 15px;">Xác thực tài khoản</h3>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Xin chào <strong>${escapeHtml(name)}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Cảm ơn bạn đã đăng ký tài khoản trên hệ thống <strong>VKsLab</strong>. Vui lòng nhấn vào nút bên dưới để xác thực địa chỉ email của bạn:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 12px 30px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">Xác thực Email</a>
          </div>

          <p style="color: #64748b; font-size: 13px; line-height: 1.6;">Nếu bạn không thực hiện yêu cầu đăng ký này, vui lòng bỏ qua email này.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">Trân trọng,<br><strong style="color: #0f172a;">Ban Quản trị VKsLab</strong></p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Đây là email tự động từ hệ thống. Vui lòng không phản hồi trực tiếp email này.
        </div>
      </div>
    `,
  }),

  // 2. Phê duyệt tài khoản thành công
  approvalSuccess: (name, role) => ({
    subject: 'Tài khoản đã được Phê duyệt | VKsLab System',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #0f172a; padding: 25px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">VKsLab System</h2>
        </div>
        <div style="padding: 35px; background-color: #ffffff;">
          <h3 style="color: #059669; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 15px;">Tài khoản đã được kích hoạt</h3>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Xin chào <strong>${escapeHtml(name)}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Tài khoản của bạn đã được quản trị viên phê duyệt thành công.</p>
          
          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 6px 6px 0;">
            <p style="margin: 0; font-size: 14px; color: #1f2937;">Vai trò được cấp: <strong>${escapeHtml(role)}</strong></p>
          </div>

          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hiện tại bạn đã có thể đăng nhập và truy cập các tài nguyên trên hệ thống.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">Trân trọng,<br><strong style="color: #0f172a;">Ban Quản trị VKsLab</strong></p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Đây là email tự động từ hệ thống. Vui lòng không phản hồi trực tiếp email này.
        </div>
      </div>
    `,
  }),

  // 3. Từ chối duyệt tài khoản
  approvalRejected: (name, reason) => ({
    subject: 'Thông báo Kết quả Đăng ký Tài khoản | VKsLab System',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #0f172a; padding: 25px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">VKsLab System</h2>
        </div>
        <div style="padding: 35px; background-color: #ffffff;">
          <h3 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 15px;">Kết quả đăng ký tài khoản</h3>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Xin chào <strong>${escapeHtml(name)}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Rất tiếc, yêu cầu đăng ký tài khoản của bạn chưa được phê duyệt ở thời điểm này.</p>
          
          ${reason ? `
          <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 15px; margin: 20px 0; border-radius: 0 6px 6px 0;">
            <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 4px;">Lý do từ quản trị viên:</strong>
            <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(reason)}</p>
          </div>
          ` : ''}

          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Nếu bạn tin rằng đây là một sự nhầm lẫn, vui lòng liên hệ với quản trị viên hệ thống để được hỗ trợ.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">Trân trọng,<br><strong style="color: #0f172a;">Ban Quản trị VKsLab</strong></p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Đây là email tự động từ hệ thống. Vui lòng không phản hồi trực tiếp email này.
        </div>
      </div>
    `,
  }),

  // 4. Đặt lại mật khẩu
  resetPassword: (name, resetUrl) => ({
    subject: 'Yêu cầu Đặt lại Mật khẩu | VKsLab System',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #0f172a; padding: 25px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">VKsLab System</h2>
        </div>
        <div style="padding: 35px; background-color: #ffffff;">
          <h3 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 15px;">Khôi phục mật khẩu</h3>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Xin chào <strong>${escapeHtml(name)}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Bạn đã gửi yêu cầu đặt lại mật khẩu cho tài khoản của mình. Vui lòng nhấn vào liên kết bên dưới để tạo mật khẩu mới:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 30px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">Đặt lại mật khẩu</a>
          </div>

          <p style="color: #ef4444; font-size: 13px; line-height: 1.6;"><strong>Lưu ý:</strong> Liên kết này sẽ hết hạn sau 1 giờ.</p>
          <p style="color: #64748b; font-size: 13px; line-height: 1.6;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email và mật khẩu của bạn vẫn được giữ an toàn.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">Trân trọng,<br><strong style="color: #0f172a;">Ban Quản trị VKsLab</strong></p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Đây là email tự động từ hệ thống. Vui lòng không phản hồi trực tiếp email này.
        </div>
      </div>
    `,
  }),

  // 5. Phê duyệt bài nghiên cứu / ấn phẩm (Viện trưởng duyệt trên hệ thống)
  approvalResearch: (name, researchTitle, extra = {}) => {
    const isPublic = extra.isPublic === true;
    const reviewNote =
      extra.reviewNote != null && String(extra.reviewNote).trim() !== ''
        ? String(extra.reviewNote).trim()
        : null;
    const visibilityLabel = isPublic ? 'Công khai' : 'Nội bộ';
    const visibilityDetail = isPublic
      ? 'Bài hiển thị trên mục Ấn phẩm cho mọi người (kể cả chưa đăng nhập).'
      : 'Chỉ thành viên đăng nhập mới xem được bài trên hệ thống.';

    return {
      subject: 'Chúc mừng — Bài nghiên cứu đã được phê duyệt | VKsLab System',
      html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #0f172a; padding: 25px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">VKsLab System</h2>
        </div>
        <div style="padding: 35px; background-color: #ffffff;">
          <h3 style="color: #059669; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 15px;">Bài nghiên cứu đã được phê duyệt</h3>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Xin chào <strong>${escapeHtml(name)}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Bài nghiên cứu: <strong>"${escapeHtml(researchTitle)}"</strong> đã được <strong>Viện trưởng</strong> phê duyệt trên hệ thống VKsLab.
          </p>

          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 6px 6px 0;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #1f2937;"><strong>Phạm vi hiển thị:</strong> ${escapeHtml(visibilityLabel)}</p>
            <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;">${visibilityDetail}</p>
          </div>

          ${
            reviewNote
              ? `
          <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 15px; margin: 20px 0; border-radius: 0 6px 6px 0;">
            <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 4px;">Ghi chú từ người duyệt:</strong>
            <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(reviewNote)}</p>
          </div>
          `
              : ''
          }

          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Bạn có thể đăng nhập vào hệ thống để xem bài trong mục Ấn phẩm.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">Trân trọng,<br><strong style="color: #0f172a;">VKsLab</strong></p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Đây là email tự động từ hệ thống. Vui lòng không phản hồi trực tiếp email này.
        </div>
      </div>
    `,
    };
  },

  // 6. Từ chối bài nghiên cứu / ấn phẩm
  rejectionResearch: (name, researchTitle, reason) => ({
    subject: 'Thông báo kết quả xét duyệt bài nghiên cứu | VKsLab System',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #0f172a; padding: 25px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">VKsLab System</h2>
        </div>
        <div style="padding: 35px; background-color: #ffffff;">
          <h3 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 15px;">Kết quả xét duyệt bài nghiên cứu</h3>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Xin chào <strong>${escapeHtml(name)}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Cảm ơn bạn đã nộp bài. Sau khi xem xét, chúng tôi thông báo bài <strong>"${escapeHtml(researchTitle)}"</strong> chưa được phê duyệt ở thời điểm này.
          </p>

          ${reason ? `
          <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 15px; margin: 20px 0; border-radius: 0 6px 6px 0;">
            <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 4px;">Lý do / ghi chú từ người duyệt:</strong>
            <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(reason)}</p>
          </div>
          ` : ''}

          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Bạn có thể chỉnh sửa và gửi lại bài trên hệ thống khi sẵn sàng.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">Trân trọng,<br><strong style="color: #0f172a;">VKsLab</strong></p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Đây là email tự động từ hệ thống. Vui lòng không phản hồi trực tiếp email này.
        </div>
      </div>
    `,
  }),

  // 7. Thông báo chào mừng
  welcomeNotification: (name) => ({
    subject: 'Chào mừng bạn đến với VKsLab System',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #0f172a; padding: 25px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">VKsLab System</h2>
        </div>
        <div style="padding: 35px; background-color: #ffffff;">
          <h3 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 15px;">Lời chào mừng</h3>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Xin chào <strong>${escapeHtml(name)}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Chào mừng bạn đã gia nhập <strong>VKsLab System</strong>. Hiện tại mọi tính năng được phân quyền cho tài khoản của bạn đã sẵn sàng để sử dụng.</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Chúc bạn có những trải nghiệm làm việc và nghiên cứu hiệu quả trên nền tảng của chúng tôi.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">Trân trọng,<br><strong style="color: #0f172a;">Ban Quản trị VKsLab</strong></p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Đây là email tự động từ hệ thống. Vui lòng không phản hồi trực tiếp email này.
        </div>
      </div>
    `,
  }),
  /** Hồ sơ nhà khoa học được viện trưởng phê duyệt — gửi cho email ứng viên */
  scientistCvDirectorApproved: (fullName) => ({
    subject: 'Chúc mừng — Hồ sơ của bạn đã được phê duyệt | VKsLab System',
    html: `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
      
      <div style="background-color: #0f172a; padding: 25px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">VKsLab System</h2>
      </div>
      
      <div style="padding: 35px; background-color: #ffffff;">
        <h3 style="color: #059669; font-size: 22px; font-weight: 600; margin-top: 0; margin-bottom: 15px;">Thư Chúc Mừng</h3>
        
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>
        
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
          Chúng tôi rất hân hạnh được thông báo: Hồ sơ năng lực nhà khoa học của bạn đã chính thức được <strong>phê duyệt</strong>. Chào mừng bạn đã vượt qua các vòng thẩm định khắt khe để gia nhập hệ thống nghiên cứu của <strong>VKsLab</strong>.
        </p>
        
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px 20px; margin: 25px 0; border-radius: 0 6px 6px 0;">
          <strong style="color: #047857; font-size: 14px; display: block; margin-bottom: 6px;">📍 Bước tiếp theo:</strong>
          <p style="color: #1f2937; font-size: 14px; line-height: 1.6; margin: 0;">
            Về <strong>thời gian ký kết hợp đồng chính thức</strong>, bộ phận Hành chính - Nhân sự sẽ trực tiếp liên hệ với bạn qua số điện thoại sớm nhất có thể. 
            Bạn vui lòng chú ý theo dõi các cuộc gọi và tin nhắn để không bỏ lỡ lịch hẹn quan trọng này.
          </p>
        </div>
  
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 35px;">
          Chúng tôi rất kỳ vọng vào những đóng góp mang tính đột phá của bạn cho các dự án sắp tới tại Hệ thống VKsLab.
        </p>
        
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;" />
        
        <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">
          Trân trọng,<br>
          <strong style="color: #0f172a;">Ban Điều hành VKsLab</strong><br>
          <span style="color: #94a3b8;">Hệ thống Quản lý Nghiên cứu Khoa học</span>
        </p>
      </div>
      
      <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        Đây là email tự động từ hệ thống. Vui lòng không phản hồi trực tiếp email này.
      </div>
    </div>
    `,
  }),

  /** Viện trưởng từ chối hồ sơ nhà khoa học — gửi cho email ứng viên */
  scientistCvRejected: (fullName, comment) => {
    const reason =
      comment != null && String(comment).trim() !== ''
        ? String(comment).trim()
        : 'Hồ sơ chưa đáp ứng đủ các tiêu chí chuyên môn của hệ thống trong giai đoạn này.';

    return {
      subject: 'Thông báo Kết quả Xét duyệt Hồ sơ | VKsLab System',
      html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
        
        <div style="background-color: #0f172a; padding: 25px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">VKsLab System</h2>
        </div>
        
        <div style="padding: 35px; background-color: #ffffff;">
          <h3 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 15px;">Thông báo về kết quả hồ sơ</h3>
          
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>
          
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Cảm ơn bạn đã dành thời gian nộp hồ sơ và bày tỏ sự quan tâm đến các dự án nghiên cứu tại <strong>VKsLab</strong>. 
            Hội đồng chuyên môn đã tiến hành xem xét và đánh giá rất kỹ lưỡng hồ sơ của bạn.
          </p>
          
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Tuy nhiên, chúng tôi rất tiếc phải thông báo rằng hồ sơ của bạn chưa phù hợp với các tiêu chí tuyển chọn khắt khe của hệ thống ở thời điểm hiện tại.
          </p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 15px 20px; margin: 25px 0; border-radius: 0 6px 6px 0;">
            <strong style="color: #0f172a; font-size: 14px; display: block; margin-bottom: 6px;">Chi tiết từ Hội đồng xét duyệt:</strong>
            <div style="color: #475569; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(reason)}</div>
          </div>
  
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Hồ sơ của bạn vẫn sẽ được lưu trữ trong cơ sở dữ liệu nhân tài của hệ thống. Chúng tôi sẽ chủ động liên hệ lại nếu có các vị trí hoặc dự án phù hợp hơn trong tương lai.
          </p>
          
          <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
            Chúc bạn luôn giữ vững ngọn lửa đam mê và gặt hái được nhiều thành công rực rỡ trên con đường sự nghiệp.
          </p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;" />
          
          <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">
            Trân trọng,<br>
            <strong style="color: #0f172a;">Hội đồng Thẩm định VKsLab</strong><br>
            <span style="color: #94a3b8;">Hệ thống Quản lý Nghiên cứu Khoa học</span>
          </p>
        </div>
        
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Đây là email tự động từ hệ thống. Vui lòng không phản hồi trực tiếp email này.
        </div>
      </div>
      `,
    };
  },

  /** Lời mời tham gia dự án — cam kết chờ Bên B */
  projectCommitmentInvite: (fullName, projectName, projectUrl) => ({
    subject: `Lời mời tham gia dự án: ${escapeHtml(projectName)} | VKsLab`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #0f172a; padding: 25px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">VKsLab System</h2>
        </div>
        <div style="padding: 35px; background-color: #ffffff;">
          <h3 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 15px;">Lời mời tham gia dự án</h3>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Bạn được mời tham gia dự án <strong>${escapeHtml(projectName)}</strong>. Vui lòng đăng nhập hệ thống và xác nhận cam kết phía Bên B (nếu đồng ý).
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${escapeHtml(projectUrl)}" style="display: inline-block; padding: 12px 28px; background-color: #0891b2; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Mở trang dự án</a>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.6;">Nếu nút không hoạt động, sao chép liên kết: ${escapeHtml(projectUrl)}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">Trân trọng,<br><strong style="color: #0f172a;">Ban Quản trị VKsLab</strong></p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Đây là email tự động từ hệ thống. Vui lòng không phản hồi trực tiếp email này.
        </div>
      </div>
    `,
  }),

  /** Bảng tính thưởng dự án đã được Viện trưởng chốt sổ */
  rewardSheetFinalized: (recipientName, finalizerName, projectName, projectUrl) => ({
    subject: `Bảng tính thưởng đã chốt sổ: ${escapeHtml(projectName)} | VKsLab`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #0f172a; padding: 25px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">VKsLab System</h2>
        </div>
        <div style="padding: 35px; background-color: #ffffff;">
          <h3 style="color: #059669; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 15px;">Bảng tính thưởng đã chốt sổ</h3>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Xin chào <strong>${escapeHtml(recipientName)}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            <strong>${escapeHtml(finalizerName)}</strong> (Viện trưởng) đã <strong>chốt sổ</strong> bảng tính thưởng cho dự án <strong>${escapeHtml(projectName)}</strong>.
          </p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Bạn có thể đăng nhập hệ thống để xem chi tiết và thông báo trong ứng dụng.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${escapeHtml(projectUrl)}" style="display: inline-block; padding: 12px 28px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Mở trang dự án</a>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.6;">Nếu nút không hoạt động, sao chép liên kết: ${escapeHtml(projectUrl)}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">Trân trọng,<br><strong style="color: #0f172a;">Ban Quản trị VKsLab</strong></p>
        </div>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Đây là email tự động từ hệ thống. Vui lòng không phản hồi trực tiếp email này.
        </div>
      </div>
    `,
  }),
};

/**
 * Gửi email cho tác giả khi Viện trưởng phê duyệt bài nghiên cứu (Ấn phẩm).
 * @param {string} to — email người nộp
 * @param {string} submitterName
 * @param {string} researchTitle
 * @param {{ isPublic?: boolean, reviewNote?: string | null }} [options]
 */
async function sendResearchApprovedEmail(to, submitterName, researchTitle, options = {}) {
  const tpl = emailTemplates.approvalResearch(submitterName, researchTitle, {
    isPublic: options.isPublic,
    reviewNote: options.reviewNote,
  });
  await sendMail(to, tpl.subject, tpl.html);
}

/**
 * Gửi email cho tác giả khi Viện trưởng từ chối bài nghiên cứu.
 */
async function sendResearchRejectedEmail(to, submitterName, researchTitle, reason) {
  const tpl = emailTemplates.rejectionResearch(submitterName, researchTitle, reason || '');
  await sendMail(to, tpl.subject, tpl.html);
}

module.exports = {
  sendMail,
  isSmtpConfigured,
  emailTemplates,
  sendResearchApprovedEmail,
  sendResearchRejectedEmail,
};
