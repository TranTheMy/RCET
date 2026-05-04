const bcrypt = require('bcryptjs');
const {
  sequelize, User, Project, ProjectMember, Task, Milestone, MilestoneTask, WeeklyReport,
  ForumPost, ForumComment, ForumLike,
  VerilogProblem, VerilogTestCase,
  Commitment,
} = require('../models');
const {
  USER_STATUS, SYSTEM_ROLES, PROJECT_STATUS, PROJECT_ROLES,
  TASK_STATUS, TASK_PRIORITY, REPORT_STATUS,
  PROJECT_TAGS, COMMITMENT_MODEL_TYPE,
  COMMITMENT_STATUS,
} = require('../config/constants');
const logger = require('../utils/logger');

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'Lab@12345';

// ─── Users ───────────────────────────────────────────────────────────────────
const USER_DEFS = [
  {
    key: 'admin',
    full_name: 'Quản trị VKsLab',
    email: 'admin@lab.com',
    password: 'Admin123!',
    system_role: SYSTEM_ROLES.ADMIN,
    student_code: null,
    department: 'Management',
  },
  {
    key: 'vien_truong',
    full_name: 'Nguyễn Văn Viện',
    email: 'vientruong@lab.com',
    system_role: SYSTEM_ROLES.VIEN_TRUONG,
    student_code: null,
    department: 'Board',
  },
  {
    key: 'truong_lab',
    full_name: 'Trần Thị Lan',
    email: 'truonglab@lab.com',
    system_role: SYSTEM_ROLES.TRUONG_LAB,
    student_code: null,
    department: 'Research Lab',
  },
  /** Chủ trì dự án trong seed — system_role member; vai trò chủ trì chỉ qua Project.leader_id + ProjectMember (PROJECT_ROLES.LEADER) */
  {
    key: 'projLead1',
    full_name: 'Nguyễn Văn Đức',
    email: 'leader1@lab.com',
    system_role: SYSTEM_ROLES.MEMBER,
    student_code: 'SV2020001',
    department: 'Robotics',
  },
  {
    key: 'projLead2',
    full_name: 'Trần Văn Hùng',
    email: 'leader2@lab.com',
    system_role: SYSTEM_ROLES.MEMBER,
    student_code: 'SV2020002',
    department: 'Electronics',
  },
  {
    key: 'leminhkhoa',
    full_name: 'Lê Minh Khoa',
    email: 'leminhkhoa@lab.com',
    system_role: SYSTEM_ROLES.MEMBER,
    student_code: 'SV2021001',
    department: 'Computer Science',
  },
  {
    key: 'phamthuha',
    full_name: 'Phạm Thu Hà',
    email: 'phamthuha@lab.com',
    system_role: SYSTEM_ROLES.MEMBER,
    student_code: 'SV2021002',
    department: 'Electronics',
  },
  {
    key: 'member1',
    full_name: 'Hoàng Văn An',
    email: 'member1@lab.com',
    system_role: SYSTEM_ROLES.MEMBER,
    student_code: 'SV2022001',
    department: 'Computer Science',
  },
  {
    key: 'member2',
    full_name: 'Nguyễn Hải Yến',
    email: 'member2@lab.com',
    system_role: SYSTEM_ROLES.MEMBER,
    student_code: 'SV2022002',
    department: 'Computer Science',
  },
  {
    key: 'member3',
    full_name: 'Võ Thành Đạt',
    email: 'member3@lab.com',
    system_role: SYSTEM_ROLES.MEMBER,
    student_code: 'SV2022003',
    department: 'Electronics',
  },
  {
    key: 'member4',
    full_name: 'Đặng Quỳnh Nga',
    email: 'member4@lab.com',
    system_role: SYSTEM_ROLES.MEMBER,
    student_code: 'SV2023001',
    department: 'Robotics',
  },
  {
    key: 'member5',
    full_name: 'Huỳnh Văn Anh',
    email: 'member5@lab.com',
    system_role: SYSTEM_ROLES.MEMBER,
    student_code: 'SV2023003',
    department: 'Robotics',
  },
  {
    key: 'member6',
    full_name: 'Huỳnh Văn Bình',
    email: 'member6@lab.com',
    system_role: SYSTEM_ROLES.MEMBER,
    student_code: 'SV2023002',
    department: 'Robotics',
  },
  {
    key: 'user',
    full_name: 'Phạm Thị Khánh',
    email: 'user@lab.com',
    password: 'User123!',
    system_role: SYSTEM_ROLES.USER,
    student_code: null,
    department: null,
  },
  {
    key: 'user11',
    full_name: 'Huỳnh Văn Minh',
    email: 'user11@lab.com',
    password: 'User123!',
    system_role: SYSTEM_ROLES.USER,
    student_code: null,
    department: null,
  },
  {
    key: 'member7',
    full_name: 'Lê Thị Bích',
    email: 'member7@lab.com',
    system_role: SYSTEM_ROLES.MEMBER,
    student_code: 'SV2024001',
    department: 'Computer Science',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function weeksAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Return ISO week number for a Date */
function isoWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/** Sunday of the week that contains `date` */
function weekSunday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (7 - day) % 7);
  d.setHours(23, 59, 59, 0);
  return d;
}

/** Khớp project.service: TAG = cam kết Bên A + leader/members; SELF_JOIN = chỉ Bên A đã duyệt. */
async function seedCommitmentsForProject(project, def, users) {
  const partyAId = def.party_a_id || null;
  if (partyAId) {
    const [ca] = await Commitment.findOrCreate({
      where: { project_id: project.id, user_id: partyAId },
      defaults: { status: COMMITMENT_STATUS.A_APPROVED },
    });
    if (ca.status !== COMMITMENT_STATUS.A_APPROVED) {
      await ca.update({ status: COMMITMENT_STATUS.A_APPROVED });
    }
  }

  if (def.participation_mode === 'SELF_JOIN') {
    return;
  }

  const leaderId = def.leader ? def.leader.id : null;
  if (leaderId && leaderId !== partyAId) {
    const [cl] = await Commitment.findOrCreate({
      where: { project_id: project.id, user_id: leaderId },
      defaults: { status: COMMITMENT_STATUS.ACTIVE },
    });
    if (![COMMITMENT_STATUS.ACTIVE, COMMITMENT_STATUS.B_APPROVED].includes(cl.status)) {
      await cl.update({ status: COMMITMENT_STATUS.ACTIVE });
    }
  }

  for (const memberKey of def.members || []) {
    const uid = users[memberKey].id;
    if (!uid || uid === partyAId || uid === leaderId) continue;
    const [cm] = await Commitment.findOrCreate({
      where: { project_id: project.id, user_id: uid },
      defaults: { status: COMMITMENT_STATUS.ACTIVE },
    });
    if (![COMMITMENT_STATUS.ACTIVE, COMMITMENT_STATUS.B_APPROVED].includes(cm.status)) {
      await cm.update({ status: COMMITMENT_STATUS.ACTIVE });
    }
  }
}

// ─── Seed ────────────────────────────────────────────────────────────────────
const seed = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connected for seeding');
    await sequelize.sync();

    // ── 1. Users ──────────────────────────────────────────────────────────────
    const users = {};
    for (const def of USER_DEFS) {
      let user = await User.findOne({ where: { email: def.email } });
      if (user) {
        logger.info(`User ${def.email} already exists — skipping`);
        users[def.key] = user;
        continue;
      }
      const hash = await bcrypt.hash(def.password || DEFAULT_PASSWORD, SALT_ROUNDS);
      user = await User.create({
        full_name: def.full_name,
        email: def.email,
        password_hash: hash,
        system_role: def.system_role,
        status: USER_STATUS.ACTIVE,
        email_verified: true,
        student_code: def.student_code || null,
        department: def.department || null,
      });
      logger.info(`Created user: ${def.email}`);
      users[def.key] = user;
    }

    // ── 2. Projects ───────────────────────────────────────────────────────────
    const projectDefs = [
      {
        key: 'roboarm',
        code: 'ROBOARM-24',
        name: 'Cánh tay robot tự động (RoboArm)',
        description:
          'Nghiên cứu cánh tay robot 6 DOF cho dây chuyền: mô hình 3D, điều khiển PID, inverse kinematics và tích hợp cảm biến lực.',
        tag: PROJECT_TAGS.ROBOTICS,
        status: PROJECT_STATUS.ACTIVE,
        participation_mode: 'TAG',
        model_type: COMMITMENT_MODEL_TYPE.MODEL_1,
        party_a_percent: 70,
        party_b_percent: 30,
        leader: users.projLead1,
        party_a_id: users.vien_truong.id,
        start_date: '2025-06-01',
        end_date: '2026-12-31',
        budget: 150000000,
        git_repo_url: 'https://github.com/vkslab-lab/roboarm-24',
        git_provider: 'github',
        git_default_branch: 'main',
        git_visibility: 'private',
        git_last_commit_sha: 'a3f8c21d',
        git_last_commit_author: 'leminhkhoa@lab.com',
        git_last_commit_message: 'feat: add inverse kinematics module',
        git_last_commit_date: weeksAgo(1),
        members: ['member1', 'member2', 'member3'],
      },
      {
        key: 'aivision',
        code: 'AIVISION-25',
        name: 'Hệ thống nhận dạng hình ảnh AI',
        description:
          'Pipeline nhận dạng khuôn mặt / vật thể thời gian thực: thu thập dataset, fine-tune YOLOv8 và API inference.',
        tag: PROJECT_TAGS.AI_ML,
        status: PROJECT_STATUS.ACTIVE,
        participation_mode: 'TAG',
        model_type: COMMITMENT_MODEL_TYPE.MODEL_1,
        party_a_percent: 70,
        party_b_percent: 30,
        leader: users.projLead2,
        party_a_id: users.vien_truong.id,
        start_date: '2025-08-01',
        end_date: '2026-08-31',
        budget: 80000000,
        members: ['member2', 'member4'],
      },
      {
        key: 'fpgadsp',
        code: 'FPGA-DSP-24',
        name: 'Xử lý tín hiệu số trên FPGA',
        description:
          'Đã hoàn thành: FFT, bộ lọc FIR và tối ưu timing trên Xilinx Artix-7; handover IP và tài liệu.',
        tag: PROJECT_TAGS.FPGA,
        status: PROJECT_STATUS.DONE,
        participation_mode: 'TAG',
        model_type: COMMITMENT_MODEL_TYPE.MODEL_1,
        party_a_percent: 70,
        party_b_percent: 30,
        leader: users.projLead1,
        party_a_id: users.vien_truong.id,
        start_date: '2024-02-01',
        end_date: '2025-06-30',
        budget: 60000000,
        members: ['member3'],
      },
      {
        key: 'iotmonitor',
        code: 'IOT-MON-25',
        name: 'Hệ thống giám sát môi trường IoT',
        description:
          'Sensor ESP32 (nhiệt độ, độ ẩm, MQ-135), firmware, PCB và dashboard — giai đoạn lập kế hoạch và thiết kế.',
        tag: PROJECT_TAGS.IOT,
        status: PROJECT_STATUS.PLANNING,
        // SELF_JOIN + PLANNING: chủ trì gán sau khi đủ thành viên; user tự join (project.service createProject)
        participation_mode: 'SELF_JOIN',
        model_type: COMMITMENT_MODEL_TYPE.MODEL_1,
        party_a_percent: 70,
        party_b_percent: 30,
        required_members: 4,
        leader: null,
        party_a_id: users.vien_truong.id,
        start_date: '2026-05-01',
        end_date: '2026-12-31',
        budget: 45000000,
        members: [],
      },
    ];

    const projects = {};
    for (const def of projectDefs) {
      let project = await Project.findOne({ where: { code: def.code } });
      if (project) {
        logger.info(`Project ${def.code} already exists — skipping`);
        projects[def.key] = project;
        continue;
      }

      const partyA = def.party_a_percent != null ? def.party_a_percent : 70;
      const partyB = def.party_b_percent != null ? def.party_b_percent : 30;

      project = await Project.create({
        code: def.code,
        name: def.name,
        description: def.description,
        tag: def.tag,
        status: def.status,
        participation_mode: def.participation_mode || 'TAG',
        model_type: def.model_type || null,
        party_a_id: def.party_a_id || null,
        created_by: users.truong_lab.id,
        party_a_percent: partyA,
        party_b_percent: partyB,
        leader_id: def.leader ? def.leader.id : null,
        required_members: def.required_members != null ? def.required_members : null,
        start_date: def.start_date,
        end_date: def.end_date,
        budget: def.budget || null,
        git_repo_url: def.git_repo_url || null,
        git_provider: def.git_provider || null,
        git_default_branch: def.git_default_branch || null,
        git_visibility: def.git_visibility || null,
        git_last_commit_sha: def.git_last_commit_sha || null,
        git_last_commit_author: def.git_last_commit_author || null,
        git_last_commit_message: def.git_last_commit_message || null,
        git_last_commit_date: def.git_last_commit_date || null,
      });
      logger.info(`Created project: ${def.code}`);
      projects[def.key] = project;

      if (def.leader) {
        await ProjectMember.findOrCreate({
          where: { project_id: project.id, user_id: def.leader.id },
          defaults: { role: PROJECT_ROLES.LEADER, joined_at: new Date() },
        });
      }

      for (const memberKey of (def.members || [])) {
        await ProjectMember.findOrCreate({
          where: { project_id: project.id, user_id: users[memberKey].id },
          defaults: { role: PROJECT_ROLES.MEMBER, joined_at: new Date() },
        });
      }

      await seedCommitmentsForProject(project, def, users);
    }

    // Đồng bộ DB cũ với luồng SELF_JOIN hiện tại (leader null, required_members, % cam kết)
    await Project.update(
      {
        participation_mode: 'SELF_JOIN',
        leader_id: null,
        required_members: 4,
        party_a_percent: 70,
        party_b_percent: 30,
        created_by: users.truong_lab.id,
      },
      { where: { code: 'IOT-MON-25' } },
    );

    const iotExisting = await Project.findOne({ where: { code: 'IOT-MON-25' } });
    if (iotExisting) {
      await Commitment.findOrCreate({
        where: { project_id: iotExisting.id, user_id: users.vien_truong.id },
        defaults: { status: COMMITMENT_STATUS.A_APPROVED },
      });
    }

    // ── 3. Tasks ──────────────────────────────────────────────────────────────
    const taskDefs = [
      // ROBOARM-24 tasks
      {
        project: 'roboarm',
        title: 'Thiết kế mô hình 3D cánh tay robot',
        description: 'Dùng SolidWorks thiết kế 6 khớp và xuất file STL để in 3D.',
        status: TASK_STATUS.DONE,
        priority: TASK_PRIORITY.HIGH,
        assignee: 'member1',
        created_by: 'projLead1',
        due_date: daysAgoStr(60),
      },
      {
        project: 'roboarm',
        title: 'Lập trình bộ điều khiển PID',
        description: 'Cài đặt PID cho từng khớp, chỉnh tham số Kp/Ki/Kd.',
        status: TASK_STATUS.IN_PROGRESS,
        priority: TASK_PRIORITY.URGENT,
        assignee: 'member2',
        created_by: 'projLead1',
        due_date: daysFromNow(14),
      },
      {
        project: 'roboarm',
        title: 'Xây dựng module Inverse Kinematics',
        description: 'Tính toán góc khớp từ vị trí tọa độ đích.',
        status: TASK_STATUS.IN_PROGRESS,
        priority: TASK_PRIORITY.HIGH,
        assignee: 'member1',
        created_by: 'projLead1',
        due_date: daysFromNow(21),
      },
      {
        project: 'roboarm',
        title: 'Tích hợp cảm biến lực',
        description: 'Gắn load cell vào khớp cổ tay, đọc dữ liệu qua SPI.',
        status: TASK_STATUS.TODO,
        priority: TASK_PRIORITY.MEDIUM,
        assignee: 'member3',
        created_by: 'projLead1',
        due_date: daysFromNow(30),
      },
      {
        project: 'roboarm',
        title: 'Viết báo cáo tổng kết giai đoạn 1',
        description: 'Tổng hợp kết quả thiết kế và lập trình giai đoạn 1.',
        status: TASK_STATUS.REVIEW,
        priority: TASK_PRIORITY.MEDIUM,
        assignee: 'projLead1',
        created_by: 'projLead1',
        due_date: daysFromNow(7),
      },
      // AIVISION-25 tasks
      {
        project: 'aivision',
        title: 'Thu thập và gán nhãn dataset khuôn mặt',
        description: 'Thu thập 5000 ảnh, gán nhãn bounding box.',
        status: TASK_STATUS.DONE,
        priority: TASK_PRIORITY.HIGH,
        assignee: 'member4',
        created_by: 'projLead2',
        due_date: daysAgoStr(30),
      },
      {
        project: 'aivision',
        title: 'Fine-tune YOLOv8 trên dataset nội bộ',
        description: 'Train model 50 epochs, đánh giá mAP@50.',
        status: TASK_STATUS.IN_PROGRESS,
        priority: TASK_PRIORITY.URGENT,
        assignee: 'member2',
        created_by: 'projLead2',
        due_date: daysFromNow(10),
      },
      {
        project: 'aivision',
        title: 'Xây dựng REST API inference',
        description: 'FastAPI endpoint nhận ảnh, trả kết quả detect JSON.',
        status: TASK_STATUS.TODO,
        priority: TASK_PRIORITY.HIGH,
        assignee: 'projLead2',
        created_by: 'projLead2',
        due_date: daysFromNow(20),
      },
      // FPGA-DSP-24 tasks (dự án đã đóng — dữ liệu lịch sử)
      {
        project: 'fpgadsp',
        title: 'Tối ưu pipeline FFT và FIR trên FPGA',
        description: 'Vivado synthesis/implementation, timing closure trên Xilinx Artix-7.',
        status: TASK_STATUS.DONE,
        priority: TASK_PRIORITY.HIGH,
        assignee: 'member3',
        created_by: 'projLead1',
        due_date: daysAgoStr(150),
      },
      {
        project: 'fpgadsp',
        title: 'Báo cáo tổng kết và handover',
        description: 'Tài liệu IP cores, hướng dẫn build và chuyển giao cho lab.',
        status: TASK_STATUS.DONE,
        priority: TASK_PRIORITY.MEDIUM,
        assignee: 'projLead1',
        created_by: 'projLead1',
        due_date: daysAgoStr(75),
      },
      // IOT-MON-25 tasks (SELF_JOIN: chưa gán người — gán sau khi có thành viên)
      {
        project: 'iotmonitor',
        title: 'Chọn linh kiện và lên bill of materials',
        description: 'ESP32, DHT22, MQ-135, OLED display.',
        status: TASK_STATUS.TODO,
        priority: TASK_PRIORITY.MEDIUM,
        assignee: null,
        created_by: 'truong_lab',
        due_date: daysFromNow(14),
      },
      {
        project: 'iotmonitor',
        title: 'Thiết kế sơ đồ mạch PCB',
        description: 'KiCad schematic và layout PCB 2 lớp.',
        status: TASK_STATUS.TODO,
        priority: TASK_PRIORITY.MEDIUM,
        assignee: null,
        created_by: 'truong_lab',
        due_date: daysFromNow(30),
      },
      {
        project: 'iotmonitor',
        title: 'Phát triển firmware đọc sensor và MQTT',
        description: 'ESP-IDF: DHT/MQ-135, publish JSON lên MQTT broker.',
        status: TASK_STATUS.TODO,
        priority: TASK_PRIORITY.HIGH,
        assignee: null,
        created_by: 'truong_lab',
        due_date: daysFromNow(45),
      },
    ];

    const tasks = {};
    for (const def of taskDefs) {
      const project = projects[def.project];
      if (!project) continue;
      // skip if a task with same title exists in this project
      const existing = await Task.findOne({
        where: { project_id: project.id, title: def.title },
      });
      if (existing) {
        tasks[`${def.project}_${def.title}`] = existing;
        continue;
      }
      const task = await Task.create({
        project_id: project.id,
        title: def.title,
        description: def.description,
        status: def.status,
        priority: def.priority,
        assignee_id: users[def.assignee]?.id || null,
        created_by: users[def.created_by].id,
        due_date: def.due_date,
      });
      tasks[`${def.project}_${def.title}`] = task;
    }
    logger.info(`Seeded ${Object.keys(tasks).length} tasks`);

    // ── 4. Milestones ─────────────────────────────────────────────────────────
    const milestoneDefs = [
      {
        project: 'roboarm',
        title: 'Hoàn thiện thiết kế cơ khí',
        description: 'Toàn bộ bản vẽ 3D và mô hình in thử đã hoàn chỉnh.',
        due_date: daysAgoStr(45),
        done: true,
        done_at: weeksAgo(6),
      },
      {
        project: 'roboarm',
        title: 'Tích hợp phần cứng + firmware',
        description: 'Bo mạch điều khiển + driver servo đã chạy được.',
        due_date: daysFromNow(14),
        done: false,
      },
      {
        project: 'roboarm',
        title: 'Demo cuối kỳ',
        description: 'Trình diễn cánh tay phân loại sản phẩm tự động.',
        due_date: daysFromNow(90),
        done: false,
      },
      {
        project: 'aivision',
        title: 'Dataset chuẩn bị xong',
        description: '5000 ảnh đã gán nhãn và chia train/val/test.',
        due_date: daysAgoStr(20),
        done: true,
        done_at: weeksAgo(3),
      },
      {
        project: 'aivision',
        title: 'Model đạt mAP ≥ 85%',
        description: 'Mô hình fine-tune đạt chỉ số hiệu suất yêu cầu.',
        due_date: daysFromNow(12),
        done: false,
      },
      {
        project: 'iotmonitor',
        title: 'Phê duyệt thiết kế phần cứng',
        description: 'BOM và sơ đồ mạch được truong_lab duyệt.',
        due_date: daysFromNow(21),
        done: false,
      },
      {
        project: 'iotmonitor',
        title: 'Triển khai firmware ESP32 (sensor + MQTT)',
        description: 'Hoàn thành đọc cảm biến và publish lên broker.',
        due_date: daysFromNow(60),
        done: false,
      },
      {
        project: 'fpgadsp',
        title: 'Hoàn tất triển khai IP DSP trên Artix-7',
        description: 'FFT/FIR đạt timing, đã verify trên hardware.',
        due_date: daysAgoStr(160),
        done: true,
        done_at: weeksAgo(18),
      },
      {
        project: 'fpgadsp',
        title: 'Bàn giao tài liệu và đào tạo',
        description: 'Handover tài liệu kỹ thuật và session đào tạo ngắn.',
        due_date: daysAgoStr(85),
        done: true,
        done_at: weeksAgo(12),
      },
    ];

    for (const def of milestoneDefs) {
      const project = projects[def.project];
      if (!project) continue;
      const existing = await Milestone.findOne({
        where: { project_id: project.id, title: def.title },
      });
      if (existing) continue;
      await Milestone.create({
        project_id: project.id,
        title: def.title,
        description: def.description,
        due_date: def.due_date,
        done: def.done || false,
        done_at: def.done_at || null,
      });
    }
    logger.info('Seeded milestones');

    // Liên kết milestone ↔ task (bảng MilestoneTask)
    const milestoneTaskLinks = [
      {
        pKey: 'roboarm',
        milestoneTitle: 'Hoàn thiện thiết kế cơ khí',
        taskTitles: ['Thiết kế mô hình 3D cánh tay robot'],
      },
      {
        pKey: 'roboarm',
        milestoneTitle: 'Tích hợp phần cứng + firmware',
        taskTitles: [
          'Lập trình bộ điều khiển PID',
          'Xây dựng module Inverse Kinematics',
          'Tích hợp cảm biến lực',
        ],
      },
      {
        pKey: 'roboarm',
        milestoneTitle: 'Demo cuối kỳ',
        taskTitles: ['Viết báo cáo tổng kết giai đoạn 1'],
      },
      {
        pKey: 'aivision',
        milestoneTitle: 'Dataset chuẩn bị xong',
        taskTitles: ['Thu thập và gán nhãn dataset khuôn mặt'],
      },
      {
        pKey: 'aivision',
        milestoneTitle: 'Model đạt mAP ≥ 85%',
        taskTitles: ['Fine-tune YOLOv8 trên dataset nội bộ'],
      },
      {
        pKey: 'iotmonitor',
        milestoneTitle: 'Phê duyệt thiết kế phần cứng',
        taskTitles: ['Chọn linh kiện và lên bill of materials', 'Thiết kế sơ đồ mạch PCB'],
      },
      {
        pKey: 'iotmonitor',
        milestoneTitle: 'Triển khai firmware ESP32 (sensor + MQTT)',
        taskTitles: ['Phát triển firmware đọc sensor và MQTT'],
      },
      {
        pKey: 'fpgadsp',
        milestoneTitle: 'Hoàn tất triển khai IP DSP trên Artix-7',
        taskTitles: ['Tối ưu pipeline FFT và FIR trên FPGA'],
      },
      {
        pKey: 'fpgadsp',
        milestoneTitle: 'Bàn giao tài liệu và đào tạo',
        taskTitles: ['Báo cáo tổng kết và handover'],
      },
    ];

    for (const row of milestoneTaskLinks) {
      const proj = projects[row.pKey];
      if (!proj) continue;
      const ms = await Milestone.findOne({
        where: { project_id: proj.id, title: row.milestoneTitle },
      });
      if (!ms) continue;
      for (const tt of row.taskTitles) {
        const tk = tasks[`${row.pKey}_${tt}`];
        if (!tk) continue;
        await MilestoneTask.findOrCreate({
          where: { milestone_id: ms.id, task_id: tk.id },
          defaults: {},
        });
      }
    }
    logger.info('Seeded milestone–task links');

    // ── 5. Weekly Reports ─────────────────────────────────────────────────────
    // Generate 8 weeks of reports for active projects
    const activeProjects = [
      { pKey: 'roboarm', memberKeys: ['projLead1', 'member1', 'member2', 'member3'] },
      { pKey: 'aivision', memberKeys: ['projLead2', 'member2', 'member4'] },
    ];

    for (const { pKey, memberKeys } of activeProjects) {
      const project = projects[pKey];
      if (!project) continue;

      for (let wOffset = 7; wOffset >= 1; wOffset--) {
        const reportDate = weeksAgo(wOffset);
        const wNum = isoWeek(reportDate);
        const wYear = reportDate.getFullYear();
        const due = weekSunday(reportDate);

        for (const mKey of memberKeys) {
          const user = users[mKey];
          if (!user) continue;

          const existing = await WeeklyReport.findOne({
            where: {
              project_id: project.id,
              user_id: user.id,
              week_number: wNum,
              year: wYear,
            },
          });
          if (existing) continue;

          // Simulate some missing/late reports for realism
          // member3 misses every 4th week; member4 submits late every 3rd week
          const skip = (mKey === 'member3' && wOffset % 4 === 0);
          if (skip) continue; // missing

          const submitDate = new Date(due.getTime());
          let status;
          if (mKey === 'member4' && wOffset % 3 === 0) {
            // late: submit 2 days after due
            submitDate.setDate(submitDate.getDate() + 2);
            status = REPORT_STATUS.LATE;
          } else {
            // on time: submit 1 day before due
            submitDate.setDate(submitDate.getDate() - 1);
            status = REPORT_STATUS.SUBMITTED;
          }

          await WeeklyReport.create({
            project_id: project.id,
            user_id: user.id,
            week_number: wNum,
            year: wYear,
            content: `Báo cáo tuần ${wNum}/${wYear} của ${user.full_name}:\n- Hoàn thành các task được giao.\n- Gặp khó khăn về: cần hỗ trợ thêm.\n- Kế hoạch tuần tới: tiếp tục sprint hiện tại.`,
            status,
            submitted_at: submitDate,
            due_date: due.toISOString().slice(0, 10),
          });
        }
      }
    }
    logger.info('Seeded weekly reports');

    // ── 6. Forum seeded data ─────────────────────────────────────────────
    if (!ForumPost || !ForumComment || !ForumLike) {
      logger.warn('Forum models not available; skipping forum seeding');
    } else {
      const existingForumPosts = await ForumPost.count();
      if (existingForumPosts === 0) {
        const initialPosts = [
          {
            title: 'Giới thiệu forum mới',
            content: 'Hãy sử dụng forum để thảo luận về tiến độ, kỹ thuật và chia sẻ kiến thức.',
            user: users.projLead1,
          },
          {
            title: 'Cách triển khai API mới',
            content: 'Mọi người bình luận về cách tối ưu hóa backend và query database.',
            user: users.member1,
          },
        ];

        for (const p of initialPosts) {
          const post = await ForumPost.create({ title: p.title, content: p.content, user_id: p.user.id });
          await ForumComment.create({
            post_id: post.id,
            user_id: users.member2.id,
            content: 'Tôi đồng ý, nếu dùng index thì sẽ tốt hơn.',
          });
          await ForumLike.create({ post_id: post.id, user_id: users.projLead2.id });
        }
        logger.info('Seeded forum posts/comments/likes');
      } else {
        logger.info('Forum posts already seeded — skipping');
      }
    }

    // ── 7. Verilog Problems & Test Cases ─────────────────────────────────
    if (!VerilogProblem || !VerilogTestCase) {
      logger.warn('Verilog models not available; skipping verilog seeding');
      logger.info('✅  Seeding complete');
      logger.info('');
      logger.info('── Login credentials ──────────────────────────────');
      logger.info('  admin@lab.com        Admin123!   (admin)');
      logger.info('  vientruong@lab.com   Lab@12345   (vien_truong)');
      logger.info('  truonglab@lab.com    Lab@12345   (truong_lab)');
      logger.info('  leader1@lab.com      Lab@12345   (member; seed key projLead1 — chủ trì dự án)');
      logger.info('  leader2@lab.com      Lab@12345   (member; seed key projLead2 — chủ trì dự án)');
      logger.info('  member1@lab.com      Lab@12345   (member)');
      logger.info('  member2@lab.com      Lab@12345   (member)');
      logger.info('  member3@lab.com      Lab@12345   (member)');
      logger.info('  member4@lab.com      Lab@12345   (member)');
      logger.info('  guest@lab.com        Lab@12345   (guest)');
      logger.info('  user@lab.com         Lab@12345   (user)');
      logger.info('');
      return;
    }

    const verilogProblemDefs = [
      {
        key: 'and_gate_custom_tb',
        name: 'AND Gate (Custom Testbench)',
        description: 'Bài tập dùng testbench tự viết (custom_uploaded).\n\nYêu cầu: Thiết kế cổng AND 2 đầu vào.\n- Đầu vào: a, b\n- Đầu ra: y = a & b\n\nLưu ý: Bài này dùng testbench do viện trưởng cung cấp.',
        description_input: 'input wire a, b',
        description_output: 'output wire y',
        level: 'easy',
        tags: 'combinational,gate,custom_tb',
        template_code: 'module and_gate(\n    input wire a,\n    input wire b,\n    output wire y\n);\n    // Code here\nendmodule',
        testbench_type: 'custom_uploaded',
        testbench: `\`timescale 1ns / 1ps

module and_gate_tb;
    reg a, b;
    wire y;

    and_gate uut (.a(a), .b(b), .y(y));

    initial begin
        $dumpfile("output.vcd");
        $dumpvars(0, and_gate_tb);
    end

    initial begin
        a = 0; b = 0; #10; if (y !== 1'b0) $display("ERROR: 0&0 expected 0, got %b", y);
        a = 0; b = 1; #10; if (y !== 1'b0) $display("ERROR: 0&1 expected 0, got %b", y);
        a = 1; b = 0; #10; if (y !== 1'b0) $display("ERROR: 1&0 expected 0, got %b", y);
        a = 1; b = 1; #10; if (y !== 1'b1) $display("ERROR: 1&1 expected 1, got %b", y);
        #10;
        $finish;
    end

    initial begin
        $monitor("Time=%0t a=%b b=%b y=%b", $time, a, b, y);
    end
endmodule
`,
        testcases: [
          { name: 'Run custom testbench', input: null, expected_output: null, grade: 10, order_index: 0, time_limit: 10 },
        ],
      },
      {
        key: 'not_gate_custom_vkslab',
        name: 'NOT Gate — ví dụ TB tự viết + VKSLAB (chia điểm)',
        description:
          'Ví dụ bài **testbench tự viết** (`custom_uploaded`) với **chia điểm theo subtest**.\n\n' +
          '- Sinh viên viết `module not_gate`: đầu vào `a`, đầu ra `y = ~a`.\n' +
          '- Testbench do giảng viên gắn vào bài; có block `VKSLAB_SUBTESTS_JSON` và in dòng `VKSLAB_SUBTEST` sau mỗi kiểm tra.\n' +
          '- Hai testcase trong DB có `subtest_key` khớp `id` trong JSON → judge chạy **một lần** mô phỏng, cộng điểm từng subtest.\n\n' +
          'Ở bài thật, có thể tạo testcase bằng nút **Đồng bộ testcase** trong Quản lý Verilog sau khi dán TB.',
        description_input: 'input wire a',
        description_output: 'output wire y',
        level: 'easy',
        tags: 'combinational,custom_tb,vkslab,example',
        template_code:
          'module not_gate(\n    input wire a,\n    output wire y\n);\n    // Gán y là phủ định của a (gợi ý: assign hoặc not)\nendmodule',
        testbench_type: 'custom_uploaded',
        testbench: `\`timescale 1ns / 1ps

/* VKSLAB_SUBTESTS_JSON
[
  { "id": "t0", "name": "NOT(0)", "grade": 5 },
  { "id": "t1", "name": "NOT(1)", "grade": 5 }
]
*/

module not_gate_tb;
    reg a;
    wire y;

    not_gate uut (.a(a), .y(y));

    initial begin
        $dumpfile("output.vcd");
        $dumpvars(0, not_gate_tb);
    end

    initial begin
        a = 1'b0;
        #10;
        if (y !== 1'b1)
            $display("VKSLAB_SUBTEST id=t0 status=FAIL");
        else
            $display("VKSLAB_SUBTEST id=t0 status=PASS");

        a = 1'b1;
        #10;
        if (y !== 1'b0)
            $display("VKSLAB_SUBTEST id=t1 status=FAIL");
        else
            $display("VKSLAB_SUBTEST id=t1 status=PASS");

        #10;
        $finish;
    end

    initial begin
        $monitor("Time=%0t a=%b y=%b", $time, a, y);
    end
endmodule
`,
        testcases: [
          {
            name: 'NOT(0)',
            input: null,
            expected_output: null,
            grade: 5,
            order_index: 0,
            time_limit: 15,
            subtest_key: 't0',
            synced_from_tb: true,
          },
          {
            name: 'NOT(1)',
            input: null,
            expected_output: null,
            grade: 5,
            order_index: 1,
            time_limit: 15,
            subtest_key: 't1',
            synced_from_tb: true,
          },
        ],
      },
      {
        key: 'hello_verilog',
        name: 'Hello Verilog',
        description: 'Bài tập cơ bản nhất: gán đầu ra bằng đầu vào.\n\nViết một module Verilog nhận một tín hiệu đầu vào và gán trực tiếp cho đầu ra.',
        description_input: 'input wire in',
        description_output: 'output wire out',
        level: 'easy',
        tags: 'combinational,basic',
        template_code: 'module hello_verilog(\n    input wire in,\n    output wire out\n);\n    // Code here\nendmodule',
        testcases: [
          { name: 'Input 0', input: 'in=0', expected_output: 'out=0', grade: 5, order_index: 0 },
          { name: 'Input 1', input: 'in=1', expected_output: 'out=1', grade: 5, order_index: 1 },
        ],
      },
      {
        key: 'and_gate',
        name: 'AND Gate',
        description: 'Thiết kế cổng AND 2 đầu vào.\n\nModule nhận 2 tín hiệu đầu vào a, b và xuất kết quả phép AND ra đầu ra y.',
        description_input: 'input wire a, b',
        description_output: 'output wire y',
        level: 'easy',
        tags: 'combinational,gate',
        template_code: 'module and_gate(\n    input wire a,\n    input wire b,\n    output wire y\n);\n    // Code here\nendmodule',
        testcases: [
          { name: 'a=0,b=0', input: 'a=0,b=0', expected_output: 'y=0', grade: 5, order_index: 0 },
          { name: 'a=0,b=1', input: 'a=0,b=1', expected_output: 'y=0', grade: 5, order_index: 1 },
          { name: 'a=1,b=0', input: 'a=1,b=0', expected_output: 'y=0', grade: 5, order_index: 2 },
          { name: 'a=1,b=1', input: 'a=1,b=1', expected_output: 'y=1', grade: 5, order_index: 3 },
        ],
      },
      {
        key: 'adder_4bit',
        name: '4-bit Adder',
        description: 'Thiết kế bộ cộng 4-bit.\n\nModule nhận hai số 4-bit a và b, xuất tổng sum (4-bit) và carry out cout.',
        description_input: 'input wire [3:0] a, b',
        description_output: 'output wire [3:0] sum\noutput wire cout',
        level: 'medium',
        tags: 'combinational,arithmetic',
        template_code: 'module adder_4bit(\n    input wire [3:0] a,\n    input wire [3:0] b,\n    output wire [3:0] sum,\n    output wire cout\n);\n    // Code here\nendmodule',
        testcases: [
          { name: '0+0', input: 'a=0000,b=0000', expected_output: 'sum=0000,cout=0', grade: 5, order_index: 0 },
          { name: '3+4', input: 'a=0011,b=0100', expected_output: 'sum=0111,cout=0', grade: 5, order_index: 1 },
          { name: '15+1', input: 'a=1111,b=0001', expected_output: 'sum=0000,cout=1', grade: 10, order_index: 2 },
          { name: '7+8', input: 'a=0111,b=1000', expected_output: 'sum=1111,cout=0', grade: 10, order_index: 3 },
        ],
      },
      {
        key: 'dff',
        name: 'D Flip-Flop',
        description: 'Thiết kế D Flip-Flop cơ bản với clock và reset.\n\nModule lưu giá trị đầu vào D vào thanh ghi khi có cạnh lên clock. Reset đồng bộ đưa đầu ra Q về 0.',
        description_input: 'input wire clk, rst, d',
        description_output: 'output reg q',
        level: 'medium',
        tags: 'sequential,flip-flop',
        template_code: 'module dff(\n    input wire clk,\n    input wire rst,\n    input wire d,\n    output reg q\n);\n    // Code here\nendmodule',
        testcases: [
          { name: 'Reset', input: 'clk=1,rst=1,d=1', expected_output: 'q=0', grade: 10, order_index: 0 },
          { name: 'Load 1', input: 'clk=1,rst=0,d=1', expected_output: 'q=1', grade: 10, order_index: 1 },
          { name: 'Load 0', input: 'clk=1,rst=0,d=0', expected_output: 'q=0', grade: 10, order_index: 2 },
        ],
      },
      {
        key: 'fsm_traffic',
        name: 'FSM Traffic Light',
        description: 'Thiết kế bộ điều khiển đèn giao thông bằng máy trạng thái hữu hạn (FSM).\n\nModule có 3 trạng thái: GREEN (00), YELLOW (01), RED (10). Chuyển trạng thái theo chu kỳ clock.',
        description_input: 'input wire clk, rst',
        description_output: 'output reg [1:0] light',
        level: 'hard',
        tags: 'sequential,fsm',
        template_code: 'module fsm_traffic_light(\n    input wire clk,\n    input wire rst,\n    output reg [1:0] light\n);\n    // States: GREEN=00, YELLOW=01, RED=10\n    // Code here\nendmodule',
        testcases: [
          { name: 'Reset to GREEN', input: 'clk=1,rst=1', expected_output: 'light=00', grade: 10, order_index: 0 },
          { name: 'GREEN->YELLOW', input: 'clk=1,rst=0', expected_output: 'light=01', grade: 15, order_index: 1 },
          { name: 'YELLOW->RED', input: 'clk=1,rst=0', expected_output: 'light=10', grade: 15, order_index: 2 },
        ],
      },
    ];

    for (const def of verilogProblemDefs) {
      const exists = await VerilogProblem.findOne({ where: { name: def.name } });
      if (exists) {
        logger.info(`Verilog problem "${def.name}" already exists — skipping`);
        continue;
      }
      const problem = await VerilogProblem.create({
        name: def.name,
        description: def.description,
        description_input: def.description_input,
        description_output: def.description_output,
        level: def.level,
        tags: def.tags,
        template_code: def.template_code,
        testbench: def.testbench || null,
        testbench_type: def.testbench_type || 'auto_generated',
        owner_id: users.truong_lab.id,
        is_published: true,
      });
      for (const tc of def.testcases) {
        await VerilogTestCase.create({
          problem_id: problem.id,
          name: tc.name,
          type: 'SIM',
          grade: tc.grade,
          input: tc.input,
          expected_output: tc.expected_output,
          time_limit: tc.time_limit || 60,
          mem_limit: 128,
          order_index: tc.order_index,
          subtest_key: tc.subtest_key ?? null,
          synced_from_tb: tc.synced_from_tb ?? false,
        });
      }
      logger.info(`Created verilog problem: ${def.name} with ${def.testcases.length} test cases`);
    }
    logger.info('Seeded verilog problems');

    logger.info('✅  Seeding complete');
    logger.info('');
    logger.info('── Login credentials ──────────────────────────────');
    logger.info('  admin@lab.com        Admin123!   (admin)');
    logger.info('  vientruong@lab.com   Lab@12345   (vien_truong)');
    logger.info('  truonglab@lab.com    Lab@12345   (truong_lab)');
    logger.info('  leader1@lab.com      Lab@12345   (member; seed key projLead1 — chủ trì dự án)');
    logger.info('  leader2@lab.com      Lab@12345   (member; seed key projLead2 — chủ trì dự án)');
    logger.info('  member1@lab.com      Lab@12345   (member)');
    logger.info('  member2@lab.com      Lab@12345   (member)');
    logger.info('  member3@lab.com      Lab@12345   (member)');
    logger.info('  member4@lab.com      Lab@12345   (member)');
    logger.info('  guest@lab.com        Guest123!   (user)');
    logger.info('───────────────────────────────────────────────────');

    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
