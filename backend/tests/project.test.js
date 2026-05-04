/**
 * Integration tests for the Project Management API.
 *
 * Seed data required (run `npm run seed` before testing):
 *   admin@lab.com   / Admin123!  — system_role: admin
 *
 * This test suite creates its own lab-specific users so it does not
 * depend on any particular existing user.  All created data is cleaned
 * up in afterAll.
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const {
  sequelize, User, Project, ProjectMember, Task, Milestone, WeeklyReport, AuditLog,
} = require('../src/models');
const { PROJECT_ROLES } = require('../src/config/constants');

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

async function login(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.body.message}`);
  return res.body.data.access_token;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

// -------------------------------------------------------------------------
// Test state — filled in beforeAll
// -------------------------------------------------------------------------

let adminToken;       // system_role: admin (exists from seed)
let truongToken;      // system_role: truong_lab (created here)
let leaderToken;      // project leader (leader_id); system_role: member
let memberToken;      // system_role: member   (created here)
let outsiderToken;    // system_role: member, NOT in the project

let truongUser;
let leaderUser;
let memberUser;
let outsiderUser;

let projectId;        // main test project
let taskId;
let milestoneId;
let reportId;

// -------------------------------------------------------------------------
// Setup / teardown
// -------------------------------------------------------------------------

beforeAll(async () => {
  // Auth admin first (must exist from seed)
  adminToken = await login('admin@lab.com', 'Admin123!');

  // Create test users directly in DB (bypass email-verification flow)
  const hash = await bcrypt.hash('Test1234!', 10);

  const createUser = (overrides) =>
    User.create({
      full_name: overrides.full_name,
      email: overrides.email,
      password_hash: hash,
      system_role: overrides.system_role,
      status: 'active',
      email_verified: true,
    });

  [truongUser, leaderUser, memberUser, outsiderUser] = await Promise.all([
    createUser({ full_name: 'Test TruongLab',  email: `truong_${Date.now()}@test.com`,   system_role: 'truong_lab' }),
    createUser({ full_name: 'Test Leader',     email: `leader_${Date.now()}@test.com`,   system_role: 'member' }),
    createUser({ full_name: 'Test Member',     email: `member_${Date.now()}@test.com`,   system_role: 'member' }),
    createUser({ full_name: 'Test Outsider',   email: `outsider_${Date.now()}@test.com`, system_role: 'member' }),
  ]);

  [truongToken, leaderToken, memberToken, outsiderToken] = await Promise.all([
    login(truongUser.email, 'Test1234!'),
    login(leaderUser.email, 'Test1234!'),
    login(memberUser.email, 'Test1234!'),
    login(outsiderUser.email, 'Test1234!'),
  ]);
});

afterAll(async () => {
  // Remove test data in reverse FK order
  if (Array.isArray(projectId)) {
    for (const id of projectId) await cleanProject(id);
  } else if (projectId) {
    await cleanProject(projectId);
  }

  // Remove test users — delete audit logs first to avoid FK violations
  const ids = [truongUser, leaderUser, memberUser, outsiderUser]
    .filter(Boolean)
    .map((u) => u.id);
  if (ids.length) {
    // AuditLog has performed_by and target_user_id referencing User
    if (AuditLog) {
      await AuditLog.destroy({ where: { performed_by: ids } });
      await AuditLog.destroy({ where: { target_user_id: ids } });
    }
    await User.destroy({ where: { id: ids } });
  }

  await sequelize.close();
});

async function cleanProject(id) {
  if (!id) return;
  await WeeklyReport.destroy({ where: { project_id: id } });
  await Milestone.destroy({ where: { project_id: id } });
  await Task.destroy({ where: { project_id: id } });
  await ProjectMember.destroy({ where: { project_id: id } });
  await Project.destroy({ where: { id } });
}

// -------------------------------------------------------------------------
// 1. Check code
// -------------------------------------------------------------------------

describe('GET /api/projects/check-code', () => {
  it('returns exists:false for a brand-new code', async () => {
    const res = await request(app)
      .get('/api/projects/check-code')
      .query({ code: `NEWCODE_${Date.now()}` })
      .set(auth(truongToken))
      .expect(200);
    expect(res.body.data.exists).toBe(false);
  });

  it('requires authentication', async () => {
    await request(app)
      .get('/api/projects/check-code')
      .query({ code: 'ANY' })
      .expect(401);
  });
});

// -------------------------------------------------------------------------
// 2. Create project
// -------------------------------------------------------------------------

describe('POST /api/projects', () => {
  const code = `TST_${Date.now()}`;

  it('truong_lab can create a project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(auth(truongToken))
      .send({
        code,
        name: 'Test Project',
        tag: 'AI/ML',
        leader_id: leaderUser.id,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      })
      .expect(201);

    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.code).toBe(code.toUpperCase());
    projectId = res.body.data.id;
  });

  it('returns 409 when code already exists', async () => {
    await request(app)
      .post('/api/projects')
      .set(auth(truongToken))
      .send({
        code,
        name: 'Duplicate',
        leader_id: leaderUser.id,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      })
      .expect(409);
  });

  it('member is forbidden from creating projects', async () => {
    await request(app)
      .post('/api/projects')
      .set(auth(memberToken))
      .send({
        code: `MBR_${Date.now()}`,
        name: 'Should Fail',
        leader_id: leaderUser.id,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      })
      .expect(403);
  });

  it('returns 400 on invalid payload (missing name)', async () => {
    await request(app)
      .post('/api/projects')
      .set(auth(truongToken))
      .send({ code: 'NONAME', leader_id: leaderUser.id })
      .expect(400);
  });
});

// -------------------------------------------------------------------------
// 3. Check code — now should return exists:true for the created code
// -------------------------------------------------------------------------

describe('GET /api/projects/check-code (after create)', () => {
  it('returns exists:true for an existing code', async () => {
    // projectId is set by the create test above
    const project = await Project.findByPk(projectId);
    const res = await request(app)
      .get('/api/projects/check-code')
      .query({ code: project.code })
      .set(auth(truongToken))
      .expect(200);
    expect(res.body.data.exists).toBe(true);
  });
});

// -------------------------------------------------------------------------
// 4. List projects
// -------------------------------------------------------------------------

describe('GET /api/projects', () => {
  it('truong_lab sees the project', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set(auth(truongToken))
      .expect(200);
    const ids = res.body.data.projects.map((p) => p.id);
    expect(ids).toContain(projectId);
  });

  it('outsider (not a member) does not see the project', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set(auth(outsiderToken))
      .expect(200);
    const ids = res.body.data.projects.map((p) => p.id);
    expect(ids).not.toContain(projectId);
  });
});

// -------------------------------------------------------------------------
// 5. Get project detail
// -------------------------------------------------------------------------

describe('GET /api/projects/:id', () => {
  it('truong_lab can fetch project detail', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set(auth(truongToken))
      .expect(200);
    expect(res.body.data).toHaveProperty('id', projectId);
  });

  it('leader (auto-added as member) can fetch detail', async () => {
    await request(app)
      .get(`/api/projects/${projectId}`)
      .set(auth(leaderToken))
      .expect(200);
  });

  it('outsider gets 403', async () => {
    await request(app)
      .get(`/api/projects/${projectId}`)
      .set(auth(outsiderToken))
      .expect(403);
  });

  it('unknown uuid gets 404', async () => {
    await request(app)
      .get('/api/projects/00000000-0000-0000-0000-000000000000')
      .set(auth(truongToken))
      .expect(404);
  });
});

// -------------------------------------------------------------------------
// 6. Update project
// -------------------------------------------------------------------------

describe('PUT /api/projects/:id', () => {
  it('truong_lab can rename a project', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set(auth(truongToken))
      .send({ name: 'Renamed Project' })
      .expect(200);
    expect(res.body.data.name).toBe('Renamed Project');
  });

  it('leader can update name', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set(auth(leaderToken))
      .send({ name: 'Leader Renamed' })
      .expect(200);
    expect(res.body.data.name).toBe('Leader Renamed');
  });

  it('member gets 403 when trying to update', async () => {
    // member not yet in project → 403 access
    await request(app)
      .put(`/api/projects/${projectId}`)
      .set(auth(memberToken))
      .send({ name: 'By Member' })
      .expect(403);
  });

  it('invalid status transition returns 400', async () => {
    // planning → done is not allowed
    await request(app)
      .put(`/api/projects/${projectId}`)
      .set(auth(truongToken))
      .send({ status: 'done' })
      .expect(400);
  });

  it('valid status transition: planning → active', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set(auth(truongToken))
      .send({ status: 'active' })
      .expect(200);
    expect(res.body.data.status).toBe('active');
  });
});

// -------------------------------------------------------------------------
// 7. Project overview
// -------------------------------------------------------------------------

describe('GET /api/projects/:id/overview', () => {
  it('returns overview for a project member', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/overview`)
      .set(auth(leaderToken))
      .expect(200);
    // overview returns flat object: { ...project fields, task_counts, ... }
    expect(res.body.data).toHaveProperty('task_counts');
    expect(res.body.data).toHaveProperty('code');
  });

  it('outsider gets 403', async () => {
    await request(app)
      .get(`/api/projects/${projectId}/overview`)
      .set(auth(outsiderToken))
      .expect(403);
  });
});

// -------------------------------------------------------------------------
// 8. Member management
// -------------------------------------------------------------------------

describe('Members', () => {
  it('GET /members returns the leader as a member', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/members`)
      .set(auth(leaderToken))
      .expect(200);
    // listMembers returns an array directly
    expect(Array.isArray(res.body.data)).toBe(true);
    const ids = res.body.data.map((m) => m.user_id);
    expect(ids).toContain(leaderUser.id);
  });

  it('leader can add a new member', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set(auth(leaderToken))
      .send({ user_id: memberUser.id, role: 'member' })
      .expect(201);
    expect(res.body.data).toHaveProperty('project_id', projectId);
  });

  it('adding the same member again returns 409', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set(auth(leaderToken))
      .send({ user_id: memberUser.id, role: 'member' })
      .expect(409);
  });

  it('outsider cannot add members', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set(auth(outsiderToken))
      .send({ user_id: outsiderUser.id, role: 'member' })
      .expect(403);
  });

  it('leader cannot remove themselves (the project leader)', async () => {
    // memberId is the ProjectMember row id, not user_id — fetch leader's membership row
    const leaderMembership = await require('../src/models').ProjectMember.findOne({
      where: { project_id: projectId, user_id: leaderUser.id },
    });
    expect(leaderMembership).not.toBeNull();
    await request(app)
      .delete(`/api/projects/${projectId}/members/${leaderMembership.id}`)
      .set(auth(truongToken))
      .expect(400);
  });

  it('truong_lab can remove a regular member', async () => {
    // memberId is the ProjectMember row id, not user_id
    const memberMembership = await require('../src/models').ProjectMember.findOne({
      where: { project_id: projectId, user_id: memberUser.id },
    });
    expect(memberMembership).not.toBeNull();
    const res = await request(app)
      .delete(`/api/projects/${projectId}/members/${memberMembership.id}`)
      .set(auth(truongToken))
      .expect(200);
    expect(res.body.success).toBe(true);
  });
});

// -------------------------------------------------------------------------
// 9. Tasks
// -------------------------------------------------------------------------

describe('Tasks', () => {
  it('GET /tasks returns empty list initially', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set(auth(leaderToken))
      .expect(200);
    expect(res.body.data).toHaveProperty('tasks');
  });

  it('leader can create a task', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(auth(leaderToken))
      .send({
        title: 'Setup dev environment',
        priority: 'high',
        assignee_id: leaderUser.id,
      })
      .expect(201);
    expect(res.body.data).toHaveProperty('id');
    taskId = res.body.data.id;
  });

  it('truong_lab cannot create a task when not a project member or leader', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(auth(truongToken))
      .send({ title: 'Write docs', priority: 'low' })
      .expect(403);
    expect(res.body.message).toMatch(/thành viên|trưởng dự án/i);
  });

  it('truong_lab can create a task when they are a project member', async () => {
    await ProjectMember.create({
      project_id: projectId,
      user_id: truongUser.id,
      role: PROJECT_ROLES.MEMBER,
      joined_at: new Date(),
    });
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set(auth(truongToken))
      .send({ title: 'Write docs', priority: 'low' })
      .expect(201);
    expect(res.body.data).toHaveProperty('id');
    await Task.destroy({ where: { id: res.body.data.id } });
  });

  it('GET /tasks/:taskId returns the task', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set(auth(leaderToken))
      .expect(200);
    expect(res.body.data).toHaveProperty('id', taskId);
  });

  it('truong_lab can update task fields', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .set(auth(truongToken))
      .send({ status: 'in_progress', priority: 'urgent' })
      .expect(200);
    expect(res.body.data.status).toBe('in_progress');
    expect(res.body.data.priority).toBe('urgent');
  });

  it('non-member cannot access tasks', async () => {
    await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set(auth(outsiderToken))
      .expect(403);
  });
});

// -------------------------------------------------------------------------
// 10. Milestones
// -------------------------------------------------------------------------

describe('Milestones', () => {
  it('leader can create a milestone', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/milestones`)
      .set(auth(leaderToken))
      .send({
        title: 'Phase 1 complete',
        due_date: '2025-06-30',
      })
      .expect(201);
    expect(res.body.data).toHaveProperty('id');
    milestoneId = res.body.data.id;
  });

  it('GET /milestones returns list with progress', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/milestones`)
      .set(auth(leaderToken))
      .expect(200);
    expect(res.body.data).toHaveProperty('progress');
    expect(res.body.data).toHaveProperty('milestones');
    expect(Array.isArray(res.body.data.milestones)).toBe(true);
  });

  it('truong_lab can mark milestone done', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/milestones/${milestoneId}`)
      .set(auth(truongToken))
      .send({ done: true })
      .expect(200);
    expect(res.body.data.done).toBe(true);
    // may include warning about incomplete tasks
  });

  it('non-member cannot list milestones', async () => {
    await request(app)
      .get(`/api/projects/${projectId}/milestones`)
      .set(auth(outsiderToken))
      .expect(403);
  });
});

// -------------------------------------------------------------------------
// 11. Weekly reports
// -------------------------------------------------------------------------

describe('Reports', () => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  // Use week 1 to avoid date conflicts with real current week
  const weekNumber = 1;

  it('leader can submit a weekly report', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/reports`)
      .set(auth(leaderToken))
      .send({
        week_number: weekNumber,
        year,
        content: 'Completed initial setup and planning.',
      })
      .expect(201);
    expect(res.body.data).toHaveProperty('id');
    reportId = res.body.data.id;
  });

  it('submitting the same week twice returns 409', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/reports`)
      .set(auth(leaderToken))
      .send({ week_number: weekNumber, year, content: 'Duplicate' })
      .expect(409);
  });

  it('GET /reports returns the report', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/reports`)
      .set(auth(leaderToken))
      .expect(200);
    const ids = res.body.data.reports.map((r) => r.id);
    expect(ids).toContain(reportId);
  });

  it('GET /reports/compliance returns matrix', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/reports/compliance`)
      .set(auth(truongToken))
      .expect(200);
    // compliance matrix returns an array directly: [ { user, weeks: [...] } ]
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('user');
    expect(res.body.data[0]).toHaveProperty('weeks');
  });

  it('non-member cannot submit a report', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/reports`)
      .set(auth(outsiderToken))
      .send({ week_number: 2, year, content: 'Outsider' })
      .expect(403);
  });
});

// -------------------------------------------------------------------------
// 12. Git repository
// -------------------------------------------------------------------------

describe('Git Repo', () => {
  it('truong_lab can set git repo', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/git`)
      .set(auth(truongToken))
      .send({
        git_repo_url: 'https://github.com/test/repo',
        git_provider: 'github',
        git_default_branch: 'main',
        git_visibility: 'private',
      })
      .expect(200);
    // updateGitRepo returns { message, repo_url }
    expect(res.body.data.repo_url).toBe('https://github.com/test/repo');
  });

  it('truong_lab can fetch git info', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/git`)
      .set(auth(truongToken))
      .expect(200);
    // getGitRepo returns { repo_url, provider, default_branch, visibility, last_commit }
    expect(res.body.data).toHaveProperty('repo_url');
  });

  it('leader cannot access git info (403)', async () => {
    await request(app)
      .get(`/api/projects/${projectId}/git`)
      .set(auth(leaderToken))
      .expect(403);
  });

  it('leader cannot update git info (403)', async () => {
    await request(app)
      .put(`/api/projects/${projectId}/git`)
      .set(auth(leaderToken))
      .send({ git_repo_url: 'https://github.com/other/repo', git_provider: 'github' })
      .expect(403);
  });

  it('git webhook updates last_commit', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/git/webhook`)
      .send({
        // gitWebhookSchema expects: sha, author, message, timestamp
        sha: 'abc1234',
        author: 'dev@example.com',
        message: 'Initial commit',
        timestamp: new Date().toISOString(),
      })
      .expect(200);
    expect(res.body.success).toBe(true);
  });
});
