const checklistService = require('../services/checklist.service');
const catchAsync = require('../utils/catchAsync');
const realtimeService = require('../services/realtime.service');

// Create a new checklist for a milestone
const createChecklist = catchAsync(async (req, res) => {
  const checklist = await checklistService.createChecklist(req.params.milestoneId, req.body, req.user);
  realtimeService.broadcastProjectUpdate(req.params.id, 'checklist_created', {
    checklistId: checklist.id,
    milestoneId: req.params.milestoneId,
  });
  res.status(201).json({
    status: 'success',
    data: { checklist },
  });
});

// Get all checklists for a milestone
const getChecklistsByMilestone = catchAsync(async (req, res) => {
  const checklists = await checklistService.getChecklistsByMilestone(req.params.milestoneId, req.user);
  res.status(200).json({
    status: 'success',
    data: { checklists },
  });
});

// Get a specific checklist by ID
const getChecklist = catchAsync(async (req, res) => {
  const checklist = await checklistService.getChecklistById(req.params.checklistId, req.user);
  res.status(200).json({
    status: 'success',
    data: { checklist },
  });
});

// Update a checklist
const updateChecklist = catchAsync(async (req, res) => {
  const checklist = await checklistService.updateChecklist(req.params.checklistId, req.body, req.user);
  realtimeService.broadcastProjectUpdate(req.params.id, 'checklist_updated', {
    checklistId: req.params.checklistId,
    milestoneId: req.params.milestoneId,
  });
  res.status(200).json({
    status: 'success',
    data: { checklist },
  });
});

// Delete a checklist
const deleteChecklist = catchAsync(async (req, res) => {
  const result = await checklistService.deleteChecklist(req.params.checklistId, req.user);
  realtimeService.broadcastProjectUpdate(req.params.id, 'checklist_deleted', {
    checklistId: req.params.checklistId,
    milestoneId: req.params.milestoneId,
  });
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

// Update a checklist item
const updateChecklistItem = catchAsync(async (req, res) => {
  const checklist = await checklistService.updateChecklistItem(req.params.itemId, req.body, req.user);
  realtimeService.broadcastProjectUpdate(req.params.id, 'checklist_item_updated', {
    checklistId: checklist.id,
    itemId: req.params.itemId,
    milestoneId: req.params.milestoneId,
  });
  res.status(200).json({
    status: 'success',
    data: { checklist },
  });
});

// Add a new item to a checklist
const addChecklistItem = catchAsync(async (req, res) => {
  const checklist = await checklistService.addChecklistItem(req.params.checklistId, req.body, req.user);
  realtimeService.broadcastProjectUpdate(req.params.id, 'checklist_item_created', {
    checklistId: checklist.id,
    milestoneId: req.params.milestoneId,
  });
  res.status(201).json({
    status: 'success',
    data: { checklist },
  });
});

// Delete a checklist item
const deleteChecklistItem = catchAsync(async (req, res) => {
  const checklist = await checklistService.deleteChecklistItem(req.params.itemId, req.user);
  realtimeService.broadcastProjectUpdate(req.params.id, 'checklist_item_deleted', {
    checklistId: checklist.id,
    itemId: req.params.itemId,
    milestoneId: req.params.milestoneId,
  });
  res.status(200).json({
    status: 'success',
    data: { checklist },
  });
});

module.exports = {
  createChecklist,
  getChecklistsByMilestone,
  getChecklist,
  updateChecklist,
  deleteChecklist,
  updateChecklistItem,
  addChecklistItem,
  deleteChecklistItem,
};
