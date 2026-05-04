require('./config/env'); // .env must load before routes/services read process.env (e.g. Groq)
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const passport = require('./config/passport');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const authRoutes = require('./routes/auth.routes');
const researchRoutes = require('./routes/research.routes');
const notificationRoutes = require('./routes/notification.routes');
const publicContentRoutes = require('./routes/publicContent.routes');
const scientistApplicationRoutes = require('./routes/scientistApplication.routes');
const errorHandler = require('./middlewares/error.middleware');
const ApiResponse = require('./utils/response');
const aiRoutes = require('./routes/ai.routes');

const app = express();
app.set('etag', false);
// Behind nginx reverse proxy in production.
app.set('trust proxy', 1);

// Security headers — disable CSP for Swagger UI; disable CORP to allow cross-origin access
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// CORS — allow dev frontend and configured domains (supports www/non-www + http/https variants)
const localDevOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
const rawConfiguredOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.FRONTEND_ORIGIN,
  process.env.ALLOWED_ORIGINS,
]
  .filter(Boolean)
  .flatMap((value) => String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean));

const allowedOrigins = new Set([...localDevOrigins, 'null']);

const addHostVariants = (host) => {
  if (!host) return;
  allowedOrigins.add(`http://${host}`);
  allowedOrigins.add(`https://${host}`);
  allowedOrigins.add(`http://www.${host}`);
  allowedOrigins.add(`https://www.${host}`);
};

rawConfiguredOrigins.forEach((rawOrigin) => {
  try {
    const parsed = new URL(rawOrigin);
    allowedOrigins.add(parsed.origin);
    addHostVariants(parsed.hostname.replace(/^www\./, ''));
  } catch {
    const normalized = rawOrigin
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .replace(/^www\./, '');
    addHostVariants(normalized);
  }
});

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (mobile, curl, Postman)
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // Axios (hoặc client khác) có thể gửi Cache-Control / Pragma — phải có trong preflight.
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle all preflight requests

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(morgan('dev'));

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Session middleware for OAuth
app.use(session({
  secret: process.env.JWT_ACCESS_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
/** Khách — chat thông tin VKsLab (systemPrompt), không cần đăng nhập */
const guestAiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'VKsLab API Docs',
  swaggerOptions: { persistAuthorization: true },
}));

// Swagger JSON spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health check
app.get('/api/health', (req, res) => {
  ApiResponse.success(res, { status: 'ok', timestamp: new Date().toISOString() });
});

// Ảnh đại diện đã upload (PATCH /auth/me/avatar)
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// Auth mount trực tiếp để mọi method (GET/PATCH /me, /me/avatar) luôn khớp
app.use('/api/auth', authRoutes);
app.use('/api/research', researchRoutes);
// API routes — /notifications & public stubs
app.use('/api/notifications', notificationRoutes);
app.use('/api/scientist-applications', scientistApplicationRoutes);
// Public routes trước router chính — tránh /lab/information bị nuốt bởi commentRoutes (auth bắt mọi path /)
app.use('/api', publicContentRoutes);
app.use('/ai', aiRoutes);
app.use('/api/ai-guest', guestAiLimiter, aiRoutes);
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  ApiResponse.notFound(res, `Route ${req.originalUrl} not found`);
});

// Global error handler
app.use(errorHandler);

module.exports = app;
