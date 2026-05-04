const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const env = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    name: process.env.DB_NAME || 'vkslab_lab',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '1',
    encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
    /** Chuỗi semver cho Sequelize MSSQL (OFFSET/FETCH cần >= 11.0.0 ≈ SQL Server 2012+) */
    sqlServerVersion: process.env.SQL_SERVER_VERSION || '11.0.0',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  contactFormReceiverEmail: process.env.CONTACT_FORM_RECEIVER_EMAIL || '',

  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
  },

  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  },

  /** Đường dẫn .docx tùy chọn (ưu tiên). Mặc định: src/templates/Bản-cam-kết-NCKH-mẫu.docx, sau đó scientist-contract-default.docx */
  contractTemplatePath: process.env.CONTRACT_TEMPLATE_PATH || '',

  /** Địa điểm ký mặc định trên mẫu cam kết khi payload không có contractLocation (ví dụ: Trường ĐH …) */
  contractDefaultLocation: process.env.CONTRACT_DEFAULT_LOCATION || '',

  /** Upload (avatar, research PDF, …) — https://cloudinary.com */
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
};

module.exports = env;
