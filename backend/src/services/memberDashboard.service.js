const { User, Project, ProjectMember, Task, WeeklyReport, Milestone, AuditLog } = require('../models');
const { Op } = require('sequelize');
const realtimeService = require('./realtime.service');

class MemberDashboardService {
  async completeTask(userId, taskId) {
    const task = await Task.findOne({
      where: {
        id: taskId,
        assignee_id: userId,
      },
      attributes: ['id', 'status'],
    });

    if (!task) {
      const err = new Error('Task not found');
      err.statusCode = 404;
      throw err;
    }

    if (task.status === 'done') {
      return task;
    }

    task.status = 'done';
    await task.save();
    realtimeService.emitMemberDashboardTaskCompleted(userId, {
      taskId: task.id,
      status: task.status,
    });
    return task;
  }

  /**
   * Get comprehensive member dashboard data
   * @param {string} userId - Member's user ID
   * @returns {Object} Dashboard data
   */
  async getMemberDashboard(userId) {
    try {
      // Get user info
      const user = await User.findByPk(userId, {
        attributes: ['id', 'full_name', 'email', 'student_code', 'department', 'system_role', 'created_at']
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get active projects for this member
      const projects = await this.getMemberProjects(userId);

      // Get tasks for this member
      const tasks = await this.getMemberTasks(userId);

      // Get weekly reports compliance
      const reports = await this.getMemberReports(userId);

      // Calculate performance metrics
      const metrics = await this.calculatePerformanceMetrics(userId, projects, tasks, reports);

      // Get recent activities
      const activities = await this.getRecentActivities(userId);

      return {
        success: true,
        data: {
          personal: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            student_code: user.student_code,
            department: user.department,
            system_role: user.system_role,
            joined_at: user.created_at
          },
          projects: projects.map(p => JSON.parse(JSON.stringify(p))),
          tasks: JSON.parse(JSON.stringify(tasks)),
          reports: JSON.parse(JSON.stringify(reports)),
          metrics: JSON.parse(JSON.stringify(metrics)),
          activities: JSON.parse(JSON.stringify(activities))
        }
      };
    } catch (error) {
      console.error('Error getting member dashboard:', error);
      return {
        success: false,
        message: 'Failed to load dashboard data',
        error: error.message
      };
    }
  }

  /**
   * Get projects where member is active
   */
  async getMemberProjects(userId) {
    const dashboardProjectStatuses = ['planning', 'active', 'paused'];

    const projectMembers = await ProjectMember.findAll({
      where: { user_id: userId },
      include: [{
        model: Project,
        as: 'project',
        where: { status: { [Op.in]: dashboardProjectStatuses } },
        required: true,
        attributes: ['id', 'name', 'code', 'status', 'end_date']
      }],
      attributes: ['role', 'joined_at']
    });

    const projects = [];

    for (const pm of projectMembers) {
      const project = pm.project;

      // Get task counts for this member in this project
      const taskStats = await this.getProjectTaskStats(userId, project.id);

      // Get report rate for this member in this project
      const reportRate = await this.getProjectReportRate(userId, project.id);

      // Get next milestones
      const nextMilestones = await this.getProjectNextMilestones(project.id);

      // Check if project is at risk
      const atRisk = reportRate < 70 || taskStats.overdue > 0;

      projects.push({
        id: project.id,
        name: project.name,
        code: project.code,
        role: pm.role,
        joined_at: pm.joined_at,
        tasks: taskStats,
        report_rate: reportRate,
        at_risk: atRisk,
        next_milestones: nextMilestones.slice(0, 3) // Top 3
      });
    }

    return projects;
  }

  /**
   * Get task statistics for member in a project
   */
  async getProjectTaskStats(userId, projectId) {
    const tasks = await Task.findAll({
      where: {
        assignee_id: userId,
        project_id: projectId
      },
      attributes: ['status', 'due_date']
    });

    const stats = {
      total: tasks.length,
      done: 0,
      in_progress: 0,
      todo: 0,
      review: 0,
      overdue: 0
    };

    const now = new Date();

    tasks.forEach(task => {
      stats[task.status] = (stats[task.status] || 0) + 1;
      if (task.due_date && task.due_date < now && task.status !== 'done') {
        stats.overdue++;
      }
    });

    return stats;
  }

  /**
   * Get report compliance rate for member in a project
   */
  async getProjectReportRate(userId, projectId) {
    // Get last 8 weeks of reports
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const reports = await WeeklyReport.findAll({
      where: {
        user_id: userId,
        project_id: projectId,
        created_at: { [Op.gte]: eightWeeksAgo }
      },
      attributes: ['status']
    });

    if (reports.length === 0) return 0;

    const onTimeCount = reports.filter(r => r.status === 'submitted').length;
    return Math.round((onTimeCount / reports.length) * 100);
  }

  /**
   * Get next milestones for a project
   */
  async getProjectNextMilestones(projectId) {
    const now = new Date();
    const milestones = await Milestone.findAll({
      where: {
        project_id: projectId,
        due_date: { [Op.gte]: now }
      },
      attributes: ['title', 'due_date', 'done'],
      order: [['due_date', 'ASC']],
      limit: 3
    });

    return milestones.map(m => ({
      title: m.title,
      due_date: m.due_date,
      done: m.done
    }));
  }

  /**
   * Get member's tasks organized by status
   */
  async getMemberTasks(userId) {
    const tasks = await Task.findAll({
      where: { assignee_id: userId },
      include: [{
        model: Project,
        as: 'project',
        attributes: ['id', 'name', 'code']
      }],
      attributes: ['id', 'title', 'status', 'priority', 'due_date', 'created_at', 'updated_at'],
      order: [
        ['due_date', 'ASC'],
        ['priority', 'DESC']
      ]
    });

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const categorized = {
      in_progress: [],
      todo: [],
      done_this_week: [],
      overdue: []
    };

    tasks.forEach(task => {
      const taskData = {
        id: task.id,
        title: task.title,
        priority: task.priority,
        due_date: task.due_date,
        project: {
          id: task.project.id,
          name: task.project.name,
          code: task.project.code
        }
      };

      if (task.status === 'done' && task.updated_at >= oneWeekAgo) {
        categorized.done_this_week.push(taskData);
      } else if (task.due_date && new Date(task.due_date) < now && task.status !== 'done') {
        categorized.overdue.push(taskData);
      } else if (task.status === 'in_progress' || task.status === 'review') {
        categorized.in_progress.push(taskData);
      } else if (task.status === 'todo') {
        categorized.todo.push(taskData);
      }
    });

    return categorized;
  }

  /**
   * Get member's weekly reports compliance
   */
  async getMemberReports(userId) {
    // Get last 8 weeks
    const reports = await WeeklyReport.findAll({
      where: { user_id: userId },
      attributes: ['week_number', 'year', 'status', 'submitted_at', 'due_date'],
      order: [['year', 'DESC'], ['week_number', 'DESC']],
      limit: 8
    });

    const compliance = {
      history: [],
      rate: 0,
      streak: 0,
      next_due: null
    };

    if (reports.length > 0) {
      // Calculate compliance rate
      const onTimeCount = reports.filter(r => r.status === 'submitted').length;
      compliance.rate = Math.round((onTimeCount / reports.length) * 100);

      // Calculate current streak
      let streak = 0;
      for (const report of reports) {
        if (report.status === 'submitted') {
          streak++;
        } else {
          break;
        }
      }
      compliance.streak = streak;

      // Format history
      compliance.history = reports.map(r => ({
        week: r.week_number,
        year: r.year,
        status: r.status,
        submitted_at: r.submitted_at,
        due_date: r.due_date
      }));

      // Calculate next due date (next week)
      const lastReport = reports[0];
      const nextWeek = lastReport.week_number + 1;
      const nextYear = nextWeek > 52 ? lastReport.year + 1 : lastReport.year;
      const nextWeekNum = nextWeek > 52 ? 1 : nextWeek;

      // Simple due date calculation (Friday of next week)
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + (5 - nextDue.getDay() + 7) % 7 + 7);
      compliance.next_due = nextDue;
    }

    return compliance;
  }

  /**
   * Calculate performance metrics
   */
  async calculatePerformanceMetrics(userId, projects, tasks, reports) {
    // Task completion rate
    const allTasks = await Task.findAll({
      where: { assignee_id: userId },
      attributes: ['status']
    });

    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === 'done').length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Average completion time (simplified - would need actual timestamps)
    const avgCompletionTime = 3.2; // Placeholder - would calculate from task created/updated

    // Team ranking (simplified)
    const teamRanking = await this.calculateTeamRanking(userId);

    return {
      task_completion_rate: taskCompletionRate,
      report_submission_rate: reports.rate,
      average_completion_time: avgCompletionTime,
      team_ranking: teamRanking,
      achievements: this.getAchievements(completedTasks, reports.streak, taskCompletionRate)
    };
  }

  /**
   * Calculate team ranking (simplified)
   */
  async calculateTeamRanking(userId) {
    // This is a simplified ranking - in real implementation would compare with all team members
    return {
      position: 2,
      total_members: 5,
      percentile: 40
    };
  }

  /**
   * Get achievements based on performance
   */
  getAchievements(completedTasks, streak, completionRate) {
    const achievements = [];

    if (completedTasks >= 5) {
      achievements.push('Completed 5+ tasks this month');
    }

    if (streak >= 2) {
      achievements.push(`${streak} consecutive on-time reports`);
    }

    if (completionRate >= 80) {
      achievements.push('High task completion rate (80%+)');
    }

    return achievements;
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(userId) {
    // Get recent task completions
    const recentTasks = await Task.findAll({
      where: {
        assignee_id: userId,
        status: 'done'
      },
      include: [{
        model: Project,
        as: 'project',
        attributes: ['name']
      }],
      attributes: ['title', 'updated_at'],
      order: [['updated_at', 'DESC']],
      limit: 5
    });

    // Get recent reports
    const recentReports = await WeeklyReport.findAll({
      where: { user_id: userId },
      attributes: ['week_number', 'year', 'submitted_at'],
      order: [['submitted_at', 'DESC']],
      limit: 5
    });

    // Combine and sort activities
    const activities = [];

    recentTasks.forEach(task => {
      activities.push({
        type: 'task_completed',
        description: `Completed task "${task.title}"`,
        project: task.project.name,
        timestamp: task.updated_at,
        icon: '📋'
      });
    });

    recentReports.forEach(report => {
      activities.push({
        type: 'report_submitted',
        description: `Submitted weekly report for Week ${report.week_number}`,
        timestamp: report.submitted_at,
        icon: '📝'
      });
    });

    // Sort by timestamp and take top 10
    return activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);
  }
}

module.exports = new MemberDashboardService();