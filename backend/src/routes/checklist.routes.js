const express = require('express');
const router = express.Router({ mergeParams: true });
const checklistController = require('../controllers/checklist.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  createChecklistSchema,
  updateChecklistSchema,
  updateChecklistItemSchema,
  addChecklistItemSchema,
} = require('../validators/checklist.validator');

// All routes require authentication
router.use(authMiddleware);

// Routes for checklists within a milestone
router
  .route('/')
  .get(checklistController.getChecklistsByMilestone)
  .post(validate(createChecklistSchema), checklistController.createChecklist);

// Routes for specific checklist
router
  .route('/:checklistId')
  .get(checklistController.getChecklist)
  .put(validate(updateChecklistSchema), checklistController.updateChecklist)
  .delete(checklistController.deleteChecklist);

// Routes for checklist items
router
  .route('/:checklistId/items')
  .post(validate(addChecklistItemSchema), checklistController.addChecklistItem);

router
  .route('/items/:itemId')
  .put(validate(updateChecklistItemSchema), checklistController.updateChecklistItem)
  .delete(checklistController.deleteChecklistItem);

module.exports = router;
