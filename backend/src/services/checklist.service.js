const { Checklist, ChecklistItem, Milestone, User, ProjectMember } = require('../models');
const { Op } = require('sequelize');
const { resolveProjectAccess } = require('../utils/projectAccess');

const createChecklist = async (milestoneId, data, user) => {
  // Verify milestone exists and user has access
  const milestone = await Milestone.findByPk(milestoneId, {
    include: [{ model: require('../models').Project, as: 'project' }]
  });

  if (!milestone) {
    throw { status: 404, message: 'Milestone not found' };
  }

  const accessLevel = await checkProjectAccess(user.system_role, milestone.project.id, milestone.project.leader_id, user.id);
  if (accessLevel === 'member') {
    throw { status: 403, message: 'You do not have permission to create checklists' };
  }

  const checklist = await Checklist.create({
    milestone_id: milestoneId,
    title: data.title,
    category: data.category || 'testing',
    description: data.description,
  });

  // Create checklist items if provided
  if (data.items && Array.isArray(data.items)) {
    const items = data.items.map((item, index) => ({
      checklist_id: checklist.id,
      title: item.title,
      description: item.description,
      expected_value: item.expected_value,
      order_index: index,
    }));

    await ChecklistItem.bulkCreate(items);
  }

  return await getChecklistById(checklist.id);
};

const getChecklistsByMilestone = async (milestoneId, user) => {
  // Verify milestone exists and user has access
  const milestone = await Milestone.findByPk(milestoneId, {
    include: [{ model: require('../models').Project, as: 'project' }]
  });

  if (!milestone) {
    throw { status: 404, message: 'Milestone not found' };
  }

  await checkProjectAccess(user.system_role, milestone.project.id, milestone.project.leader_id, user.id);

  const checklists = await Checklist.findAll({
    where: { milestone_id: milestoneId },
    include: [
      {
        model: ChecklistItem,
        as: 'items',
        order: [['order_index', 'ASC']],
      },
      {
        model: User,
        as: 'completer',
        attributes: ['id', 'full_name'],
      },
    ],
    order: [['created_at', 'ASC']],
  });

  return checklists;
};

const getChecklistById = async (checklistId, user = null) => {
  const checklist = await Checklist.findByPk(checklistId, {
    include: [
      {
        model: ChecklistItem,
        as: 'items',
        order: [['order_index', 'ASC']],
        include: [
          {
            model: User,
            as: 'checker',
            attributes: ['id', 'full_name'],
          },
        ],
      },
      {
        model: User,
        as: 'completer',
        attributes: ['id', 'full_name'],
      },
      {
        model: Milestone,
        as: 'milestone',
        attributes: ['id', 'title', 'project_id'],
      },
    ],
  });

  if (!checklist) {
    throw { status: 404, message: 'Checklist not found' };
  }

  if (user) {
    await checkProjectAccess(
      user.system_role,
      checklist.milestone.project_id,
      null,
      user.id
    );
  }

  return checklist;
};

const updateChecklist = async (checklistId, data, user) => {
  const checklist = await Checklist.findByPk(checklistId, {
    include: [{ model: Milestone, as: 'milestone', include: [{ model: require('../models').Project, as: 'project' }] }]
  });

  if (!checklist) {
    throw { status: 404, message: 'Checklist not found' };
  }

  const accessLevel = await checkProjectAccess(
    user.system_role,
    checklist.milestone.project.id,
    checklist.milestone.project.leader_id,
    user.id
  );
  if (accessLevel === 'member') {
    throw { status: 403, message: 'You do not have permission to update checklists' };
  }

  await checklist.update({
    title: data.title,
    category: data.category,
    description: data.description,
  });

  return await getChecklistById(checklistId);
};

const deleteChecklist = async (checklistId, user) => {
  const checklist = await Checklist.findByPk(checklistId, {
    include: [{ model: Milestone, as: 'milestone', include: [{ model: require('../models').Project, as: 'project' }] }]
  });

  if (!checklist) {
    throw { status: 404, message: 'Checklist not found' };
  }

  const accessLevel = await checkProjectAccess(
    user.system_role,
    checklist.milestone.project.id,
    checklist.milestone.project.leader_id,
    user.id
  );
  if (accessLevel === 'member') {
    throw { status: 403, message: 'You do not have permission to delete checklists' };
  }

  await checklist.destroy();
  return { message: 'Checklist deleted successfully' };
};

const updateChecklistItem = async (itemId, data, user) => {
  const item = await ChecklistItem.findByPk(itemId, {
    include: [
      {
        model: Checklist,
        as: 'checklist',
        include: [
          {
            model: Milestone,
            as: 'milestone',
            include: [{ model: require('../models').Project, as: 'project' }]
          }
        ]
      }
    ]
  });

  if (!item) {
    throw { status: 404, message: 'Checklist item not found' };
  }

  const accessLevel = await checkProjectAccess(
    user.system_role,
    item.checklist.milestone.project.id,
    item.checklist.milestone.project.leader_id,
    user.id
  );
  if (accessLevel === 'member') {
    throw { status: 403, message: 'You do not have permission to update checklist items' };
  }

  await item.update({
    actual_value: data.actual_value,
    status: data.status,
    notes: data.notes,
    checked_at: data.status !== 'pending' ? new Date() : null,
    checked_by: data.status !== 'pending' ? user.id : null,
  });

  // Check if all items are completed to mark checklist as completed
  await checkChecklistCompletion(item.checklist_id, user.id);

  return await getChecklistById(item.checklist_id);
};

const addChecklistItem = async (checklistId, data, user) => {
  const checklist = await Checklist.findByPk(checklistId, {
    include: [{ model: Milestone, as: 'milestone', include: [{ model: require('../models').Project, as: 'project' }] }]
  });

  if (!checklist) {
    throw { status: 404, message: 'Checklist not found' };
  }

  const accessLevel = await checkProjectAccess(
    user.system_role,
    checklist.milestone.project.id,
    checklist.milestone.project.leader_id,
    user.id
  );
  if (accessLevel === 'member') {
    throw { status: 403, message: 'You do not have permission to add checklist items' };
  }

  // Get max order_index
  const maxOrder = await ChecklistItem.max('order_index', { where: { checklist_id: checklistId } }) || 0;

  await ChecklistItem.create({
    checklist_id: checklistId,
    title: data.title,
    description: data.description,
    expected_value: data.expected_value,
    order_index: maxOrder + 1,
  });

  return await getChecklistById(checklistId);
};

const deleteChecklistItem = async (itemId, user) => {
  const item = await ChecklistItem.findByPk(itemId, {
    include: [
      {
        model: Checklist,
        as: 'checklist',
        include: [
          {
            model: Milestone,
            as: 'milestone',
            include: [{ model: require('../models').Project, as: 'project' }]
          }
        ]
      }
    ]
  });

  if (!item) {
    throw { status: 404, message: 'Checklist item not found' };
  }

  const accessLevel = await checkProjectAccess(
    user.system_role,
    item.checklist.milestone.project.id,
    item.checklist.milestone.project.leader_id,
    user.id
  );
  if (accessLevel === 'member') {
    throw { status: 403, message: 'You do not have permission to delete checklist items' };
  }

  await item.destroy();

  // Check if checklist should be marked as incomplete
  await checkChecklistCompletion(item.checklist_id, null);

  return await getChecklistById(item.checklist_id);
};

const checkChecklistCompletion = async (checklistId, userId) => {
  const items = await ChecklistItem.findAll({
    where: { checklist_id: checklistId },
  });

  const allCompleted = items.length > 0 && items.every(item =>
    item.status === 'pass' || item.status === 'fail' || item.status === 'na'
  );

  const checklist = await Checklist.findByPk(checklistId);
  if (checklist) {
    await checklist.update({
      is_completed: allCompleted,
      completed_at: allCompleted ? new Date() : null,
      completed_by: allCompleted ? userId : null,
    });
  }
};

const checkProjectAccess = async (userRole, projectId, projectLeaderId, userId) => {
  const level = await resolveProjectAccess(
    { id: projectId, leader_id: projectLeaderId },
    { id: userId, system_role: userRole },
  );
  if (level === 'admin' || level === 'leader') {
    return level;
  }

  const membership = await ProjectMember.findOne({
    where: { project_id: projectId, user_id: userId },
    attributes: ['id'],
  });
  if (!membership) {
    throw { status: 403, message: 'You do not have permission to access this checklist' };
  }

  return 'member';
};

module.exports = {
  createChecklist,
  getChecklistsByMilestone,
  getChecklistById,
  updateChecklist,
  deleteChecklist,
  updateChecklistItem,
  addChecklistItem,
  deleteChecklistItem,
};
