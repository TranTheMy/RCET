const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');

// Route GET /api/search
router.get('/', searchController.searchAcademicData);
// Backward-compatible aliases for older clients.
router.get('/result', searchController.searchAcademicData);
router.get('/results', searchController.searchAcademicData);

module.exports = router;
