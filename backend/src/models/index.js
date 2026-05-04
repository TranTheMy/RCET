const sequelize = require('../config/database');
const User = require('./User');
const ApprovalRequest = require('./ApprovalRequest');
const AuditLog = require('./AuditLog');
const Project = require('./Project');
const ProjectMember = require('./ProjectMember');
const Task = require('./Task');
const Milestone = require('./Milestone');
const MilestoneTask = require('./MilestoneTask');
const WeeklyReport = require('./WeeklyReport');
const Comment = require('./Comment');
const Commitment = require('./Commitment');
const RewardSheet = require('./RewardSheet');
const RewardSheetDetail = require('./RewardSheetDetail');
const Notification = require('./Notification');
const Category = require('./Category');
const Document = require('./Document');
const Curriculum = require('./Curriculum');
const Research = require('./Research');
const ForumPost = require('./ForumPost');
const ForumComment = require('./ForumComment');
const ForumLike = require('./ForumLike');
const VerilogProblem = require('./VerilogProblem');
const VerilogTestCase = require('./VerilogTestCase');
const VerilogSubmission = require('./VerilogSubmission');
const VerilogSubmissionResult = require('./VerilogSubmissionResult');
const ScientistApplication = require('./ScientistApplication');
const Checklist = require('./Checklist');
const ChecklistItem = require('./ChecklistItem');

// ======== User & Approval Associations ========
User.hasMany(ApprovalRequest, { foreignKey: 'user_id', as: 'approvalRequests' });
ApprovalRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ApprovalRequest.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

User.hasMany(AuditLog, { foreignKey: 'performed_by', as: 'performedAudits' });
User.hasMany(AuditLog, { foreignKey: 'target_user_id', as: 'targetAudits' });
AuditLog.belongsTo(User, { foreignKey: 'performed_by', as: 'performer' });
AuditLog.belongsTo(User, { foreignKey: 'target_user_id', as: 'target' });

// ======== Project Associations ========
Project.belongsTo(User, { foreignKey: 'leader_id', as: 'leader' });
User.hasMany(Project, { foreignKey: 'leader_id', as: 'ledProjects' });

// Quan hệ giữa Project và User (Đại diện pháp lý - Bên A)
// Project.belongsTo(User, { as: 'partyA', foreignKey: 'party_a_id' });
// User.hasMany(Project, { as: 'sponsoredProjects', foreignKey: 'party_a_id' });

// Project <-> Members (through ProjectMember)
Project.hasMany(ProjectMember, { foreignKey: 'project_id', as: 'members' });
ProjectMember.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
ProjectMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(ProjectMember, { foreignKey: 'user_id', as: 'projectMemberships' });

// Project <-> Tasks
Project.hasMany(Task, { foreignKey: 'project_id', as: 'tasks' });
Task.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

// Task <-> User (Assignee & Creator)
Task.belongsTo(User, { foreignKey: 'assignee_id', as: 'assignee' });
Task.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(Task, { foreignKey: 'assignee_id', as: 'assignedTasks' });
User.hasMany(Task, { foreignKey: 'created_by', as: 'createdTasks' });

// Project <-> Milestones
Project.hasMany(Milestone, { foreignKey: 'project_id', as: 'milestones' });
Milestone.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

// Milestone <-> Tasks (through MilestoneTask)
Milestone.belongsToMany(Task, { 
  through: MilestoneTask, 
  foreignKey: 'milestone_id', 
  as: 'linkedTasks',
  onDelete: 'CASCADE' // Nhánh này giữ nguyên CASCADE để khi xóa Milestone thì tự xóa liên kết
});

Task.belongsToMany(Milestone, { 
  through: MilestoneTask, 
  foreignKey: 'task_id', 
  as: 'milestones',
  onDelete: 'NO ACTION' // <--- THÊM DÒNG NÀY ĐỂ NGĂN SQL SERVER BÁO LỖI
});

// ======== CHECKLIST ASSOCIATIONS ========
Milestone.hasMany(Checklist, { foreignKey: 'milestone_id', as: 'checklists' });
Checklist.belongsTo(Milestone, { foreignKey: 'milestone_id', as: 'milestone' });

Checklist.hasMany(ChecklistItem, { foreignKey: 'checklist_id', as: 'items' });
ChecklistItem.belongsTo(Checklist, { foreignKey: 'checklist_id', as: 'checklist' });

ChecklistItem.belongsTo(User, { foreignKey: 'checked_by', as: 'checker' });
Checklist.belongsTo(User, { foreignKey: 'completed_by', as: 'completer' });

// Project <-> WeeklyReports
Project.hasMany(WeeklyReport, { foreignKey: 'project_id', as: 'weeklyReports' });
WeeklyReport.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
WeeklyReport.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
User.hasMany(WeeklyReport, { foreignKey: 'user_id', as: 'authoredWeeklyReports' });

WeeklyReport.hasMany(Comment, { foreignKey: 'weekly_report_id', as: 'comments' });
Comment.belongsTo(WeeklyReport, { foreignKey: 'weekly_report_id', as: 'weeklyReport' });
Comment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Comment, { foreignKey: 'user_id', as: 'weeklyReportComments' });

// ======== Notifications ========
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });

// ======== Categories / Documents / Curriculum ========
Category.hasMany(Document, { foreignKey: 'category_id', as: 'documents' });
Document.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Document.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Document.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });
Document.belongsTo(Document, { foreignKey: 'parent_document_id', as: 'parent' });
Document.hasMany(Document, { foreignKey: 'parent_document_id', as: 'versions' });

Category.hasMany(Curriculum, { foreignKey: 'category_id', as: 'curriculums' });
Curriculum.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Curriculum.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Curriculum.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });
Curriculum.belongsTo(Curriculum, { foreignKey: 'parent_curriculum_id', as: 'parent' });
Curriculum.hasMany(Curriculum, { foreignKey: 'parent_curriculum_id', as: 'versions' });

// ======== Commitment Associations ========
// Project.hasMany(Commitment, { foreignKey: 'project_id', as: 'commitments' });
// Commitment.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
// Commitment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
// User.hasMany(Commitment, { foreignKey: 'user_id', as: 'commitments' });

// ======== Reward Associations ========
// Thêm liên kết 1-1 giữa Project và RewardSheet
Project.hasOne(RewardSheet, { foreignKey: 'project_id', as: 'rewardSheet' });
RewardSheet.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

// Liên kết giữa Sheet và Detail
RewardSheet.hasMany(RewardSheetDetail, { foreignKey: 'sheet_id', as: 'details' });
RewardSheetDetail.belongsTo(RewardSheet, { foreignKey: 'sheet_id', as: 'sheet' });

RewardSheetDetail.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(RewardSheetDetail, { foreignKey: 'user_id', as: 'rewardDetails' });

RewardSheet.belongsTo(User, { foreignKey: 'generated_by', as: 'generator' });
RewardSheet.belongsTo(User, { foreignKey: 'finalized_by', as: 'finalizer' });

// ======== Forum Associations ========
ForumPost.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
User.hasMany(ForumPost, { foreignKey: 'user_id', as: 'forumPosts' });

ForumComment.belongsTo(ForumPost, { foreignKey: 'post_id', as: 'post' });
ForumPost.hasMany(ForumComment, { foreignKey: 'post_id', as: 'comments' });
ForumComment.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
User.hasMany(ForumComment, { foreignKey: 'user_id', as: 'forumComments' });

ForumLike.belongsTo(ForumPost, { foreignKey: 'post_id', as: 'post' });
ForumPost.hasMany(ForumLike, { foreignKey: 'post_id', as: 'likes' });
ForumLike.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(ForumLike, { foreignKey: 'user_id', as: 'forumLikes' });

// ======== Verilog Associations ========
VerilogProblem.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
User.hasMany(VerilogProblem, { foreignKey: 'owner_id', as: 'verilogProblems' });

VerilogTestCase.belongsTo(VerilogProblem, { foreignKey: 'problem_id', as: 'problem' });
VerilogProblem.hasMany(VerilogTestCase, { foreignKey: 'problem_id', as: 'testcases' });

VerilogSubmission.belongsTo(VerilogProblem, { foreignKey: 'problem_id', as: 'problem' });
VerilogProblem.hasMany(VerilogSubmission, { foreignKey: 'problem_id', as: 'submissions' });
VerilogSubmission.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(VerilogSubmission, { foreignKey: 'user_id', as: 'verilogSubmissions' });

VerilogSubmissionResult.belongsTo(VerilogSubmission, { foreignKey: 'submission_id', as: 'submission' });
VerilogSubmission.hasMany(VerilogSubmissionResult, { foreignKey: 'submission_id', as: 'results' });

VerilogSubmissionResult.belongsTo(VerilogTestCase, { foreignKey: 'testcase_id', as: 'testcase' });
VerilogTestCase.hasMany(VerilogSubmissionResult, { foreignKey: 'testcase_id', as: 'submissionResults' });

// ======== Scientist applications (CV / hợp đồng cộng tác) ========
ScientistApplication.belongsTo(User, { foreignKey: 'user_id', as: 'applicant' });
User.hasMany(ScientistApplication, { foreignKey: 'user_id', as: 'scientistApplications' });
ScientistApplication.belongsTo(User, { foreignKey: 'lab_reviewed_by', as: 'labReviewer' });
ScientistApplication.belongsTo(User, { foreignKey: 'director_reviewed_by', as: 'directorReviewer' });
ScientistApplication.belongsTo(User, { foreignKey: 'contract_created_by', as: 'contractCreator' });
ScientistApplication.belongsTo(User, { foreignKey: 'contract_confirmed_by', as: 'contractConfirmer' });

const db = {
  sequelize,
  User,
  ApprovalRequest,
  AuditLog,
  Project,
  ProjectMember,
  Task,
  Milestone,
  MilestoneTask,
  WeeklyReport,
  Comment,
  Commitment,
  RewardSheet,
  RewardSheetDetail,
  Notification,
  Category,
  Document,
  Curriculum,
  Research,
  ForumPost,
  ForumComment,
  ForumLike,
  VerilogProblem,
  VerilogTestCase,
  VerilogSubmission,
  VerilogSubmissionResult,
  ScientistApplication,
  Checklist,
  ChecklistItem,
};

// Gọi hàm associate của các model nếu chúng tồn tại
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;