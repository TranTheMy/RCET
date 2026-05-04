const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middlewares/auth.middleware');
const forbidBasicUser = require('../middlewares/forbidBasicUser.middleware');
const tutorialController = require('../controllers/tutorial.controller');

const router = express.Router();

const explainLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again shortly' },
});

router.post('/explain', explainLimiter, authMiddleware, forbidBasicUser, tutorialController.explainSelection);

module.exports = router;
