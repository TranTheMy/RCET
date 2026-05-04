const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');

// Route GET /api/search
router.get('/', searchController.searchAcademicData);

module.exports = router;