require('./config/env');
const app = require('./app');
const env = require('./config/env');
const { sequelize } = require('./models');
const logger = require('./utils/logger');
const { isSmtpConfigured } = require('./utils/email');
const { ensureNotificationsSchema } = require('./utils/ensureNotificationsSchema');
const { ensureUserProfileColumns } = require('./utils/ensureUserAvatarColumn');
const { ensureScientistApplicationsSchema } = require('./utils/ensureScientistApplicationsSchema');
const { ensureProjectsSchema } = require('./utils/ensureProjectsSchema');
const { ensureVerilogTestCaseSubtestColumns } = require('./utils/ensureVerilogTestCaseSubtestColumns');
const http = require('http');
const socketIo = require('socket.io');
const realtimeService = require('./services/realtime.service');
const VerilogJudge = require('./services/verilog.judge');

const start = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Sync models: create tables if they don't exist (use npm run db:reset to rebuild schema)
    await sequelize.sync();
    await ensureNotificationsSchema();
    await ensureUserProfileColumns();
    await ensureScientistApplicationsSchema();
    await ensureProjectsSchema();
    await ensureVerilogTestCaseSubtestColumns();
    logger.info('Database models synchronized');

    if (isSmtpConfigured()) {
      logger.info('SMTP: đã cấu hình (email giao dịch được bật)');
    } else {
      logger.warn(
        'SMTP: chưa cấu hình — email (lời mời dự án, đăng ký, …) sẽ không gửi. Thêm SMTP_HOST, SMTP_USER, SMTP_PASS vào .env',
      );
    }

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.IO
    const io = socketIo(server, {
      cors: {
        origin: [
          env.clientUrl || 'http://localhost:5173',
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:3000',
          'null',
        ],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Initialize realtime service
    realtimeService.init(io);

    // Initialize Verilog judge service (optional — requires Yosys/Iverilog on host)
    try {
      const judge = VerilogJudge.getInstance();
      await judge.initialize();
      logger.info('Verilog judge service initialized');
    } catch (err) {
      logger.warn('Verilog judge service not available (Yosys/Iverilog may not be installed):', err.message);
    }

    // Start server
    server.listen(env.port, () => {
      logger.info(`Server running on port ${env.port} in ${env.nodeEnv} mode`);
      logger.info('WebSocket realtime updates enabled');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
