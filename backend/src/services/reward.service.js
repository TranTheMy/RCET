const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Project,
  ProjectMember,
  Task,
  WeeklyReport,
  Commitment,
  RewardSheet,
  RewardSheetDetail,
  User,
} = require('../models');
const { SYSTEM_ROLES } = require('../config/constants');
const logger = require('../utils/logger');
const ExcelJS = require('exceljs');

// --- ĐÃ XÓA MODEL_CONFIG CŨ (HARDCODE % CŨ) VÌ BÂY GIỜ LẤY % TỪ DATABASE ---

const GRADE_MULTIPLIER = {
  'A': 1.0,
  'B': 0.8,
  'C': 0.5,
};

const TASK_PENALTY_RATE = 0.05;

/**
 * 1. HÀM CORE: TỰ ĐỘNG TÍNH TOÁN (CẬP NHẬT FLOW MỚI: LẤY % TỪ PROJECT)
 */
const autoGenerateProjectReward = async (projectId, generatedBy) => {
  const transaction = await sequelize.transaction();

  try {
    const project = await Project.findByPk(projectId, {
      include: [
        { model: ProjectMember, as: 'members', include: [{ model: User, as: 'user' }] },
        { model: User, as: 'partyA' } // Load thông tin Bên A (Trưởng Lab/Viện trưởng)
      ],
      transaction
    });

    if (!project) throw { status: 404, message: 'Không tìm thấy dự án.' };
    if (project.status !== 'done') throw { status: 400, message: 'Chỉ tính thưởng khi dự án đã hoàn thành (done).' };

    // 🌟 FLOW MỚI: Lấy trực tiếp % đã chốt từ Project (Chia cho 100 để ra hệ số thập phân)
    const teacherPct = (Number(project.party_a_percent) || 0) / 100;
    const studentPct = (Number(project.party_b_percent) || 100) / 100;
    
    // Convert 'MODEL_1' -> 1 để lưu vào DB TINYINT
    const modelTypeInt = project.model_type ? parseInt(project.model_type.replace('MODEL_', '')) || 1 : null;

    // Lọc chỉ lấy các thành viên là sinh viên (Bên B) để chia tiền
    const students = project.members.filter(m => m.user_id !== project.party_a_id) || [];
    if (students.length === 0) throw { status: 400, message: 'Dự án không có thành viên (Bên B) nào để chia thưởng.' };

    const safeBudget = Number(project.budget) || 0;
    const baseShare = safeBudget / students.length;

    // 🛡️ CHUẨN BỊ BỘ NHỚ ĐỆM ĐỂ BACKUP DỮ LIỆU SỬA TAY
    const overrideCache = {};

    let sheet = await RewardSheet.findOne({ where: { project_id: projectId }, transaction });
    if (sheet) {
      if (sheet.status === 'FINALIZED') throw { status: 400, message: 'Bảng tính này đã chốt, không thể tính lại.' };

      // 🛡️ SAO LƯU DỮ LIỆU SỬA TAY
      const oldDetails = await RewardSheetDetail.findAll({ where: { sheet_id: sheet.id }, transaction });
      oldDetails.forEach(d => {
        if (d.is_overridden) {
          overrideCache[d.user_id] = d.final_override_amount;
        }
      });

      await RewardSheetDetail.destroy({ where: { sheet_id: sheet.id }, transaction });
    } else {
      sheet = await RewardSheet.create({
        id: uuidv4(),
        project_id: projectId,
        total_budget: safeBudget,
        generated_by: generatedBy,
        status: 'DRAFT'
      }, { transaction });
    }

    const rewardDetails = [];
    let teacherTotalCut = 0;
    const teacherSources = [];

    for (const member of students) {
      const userId = member.user_id;

      // 🌟 TÍNH TIỀN CHO BÊN B (SINH VIÊN) THEO FLOW MỚI
      const modelCutAmount = baseShare * studentPct;

      // 🌟 TÍCH LŨY TIỀN CHO BÊN A (GIẢNG VIÊN)
      const teacherCutFromThisStudent = baseShare * teacherPct;
      teacherTotalCut += teacherCutFromThisStudent;
      teacherSources.push({
        name: member.user ? member.user.full_name : 'Sinh viên',
        amount: Math.round(teacherCutFromThisStudent)
      });

      const reports = await WeeklyReport.findAll({
        where: { project_id: projectId, user_id: userId },
        transaction
      });
      const lateReports = reports.filter(r => r.status === 'LATE' || new Date(r.submitted_at) > new Date(r.due_date));

      let reportGrade = 'A';
      if (lateReports.length === 1) reportGrade = 'B';
      else if (lateReports.length >= 2) reportGrade = 'C';

      const gradeMultiplier = GRADE_MULTIPLIER[reportGrade];
      const amountAfterGrade = modelCutAmount * gradeMultiplier;

      const tasks = await Task.findAll({
        where: { project_id: projectId, assignee_id: userId },
        transaction
      });
      const lateTasks = tasks.filter(t =>
        (t.status !== 'done' && new Date() > new Date(t.due_date)) ||
        (t.status === 'done' && new Date(t.updated_at) > new Date(t.due_date))
      );

      // ==========================================
      // 🌟 LOGIC PHẠT TASK BẬC THANG
      // ==========================================
      let penaltyMultiplier = 0;
      const lateCount = lateTasks.length;
      
      if (lateCount >= 1) penaltyMultiplier += 0.03; 
      if (lateCount >= 2) penaltyMultiplier += 0.03; 
      if (lateCount >= 3) penaltyMultiplier += 0.20; 
      if (lateCount >= 4) penaltyMultiplier += 0.20; 
      if (lateCount >= 5) penaltyMultiplier += 0.50; 
      if (lateCount >= 6) penaltyMultiplier = 1.0;   

      if (penaltyMultiplier > 1.0) penaltyMultiplier = 1.0;

      // KẾT TOÁN: GỐC - PHẠT - THUẾ
      const grossAmount = amountAfterGrade; 
      const taxAmount = grossAmount * 0.10; 
      const penaltyAmount = grossAmount * penaltyMultiplier; 

      let calculatedAmount = grossAmount - penaltyAmount - taxAmount; 
      if (calculatedAmount < 0) calculatedAmount = 0;

      const penaltyMetadata = JSON.stringify({
        late_reports: lateReports.map(r => ({ week: r.week_number, due: r.due_date })),
        late_tasks: lateTasks.map(task => ({ id: task.id, title: task.title, due: task.due_date })),
        pre_tax: Math.round(grossAmount),
        tax_amount: Math.round(taxAmount),
        is_kicked: lateCount >= 6
      });

      const cachedOverride = overrideCache[userId];

      rewardDetails.push({
        id: uuidv4(),
        sheet_id: sheet.id,
        user_id: userId,
        role: member.role,
        model_type: modelTypeInt, // Lưu dạng số để không sập DB
        base_share: Math.round(baseShare),
        model_cut_amount: Math.round(modelCutAmount),
        report_grade: reportGrade,
        grade_multiplier: gradeMultiplier,
        late_task_count: lateTasks.length,
        penalty_amount: Math.round(penaltyAmount),
        calculated_amount: Math.round(calculatedAmount),
        final_override_amount: cachedOverride !== undefined ? cachedOverride : null, 
        is_overridden: cachedOverride !== undefined, 
        penalty_metadata: penaltyMetadata
      });
    }

    // 🛡️ XỬ LÝ LƯƠNG CHO TRƯỞNG LAB (BÊN A) THEO FLOW MỚI
    if (project.party_a_id) {
      const grossTeacher = teacherTotalCut;         
      const taxTeacher = grossTeacher * 0.10;      
      let calcTeacher = grossTeacher - taxTeacher; 

      const cachedOverrideTeacher = overrideCache[project.party_a_id];

      rewardDetails.push({
        id: uuidv4(), 
        sheet_id: sheet.id,
        user_id: project.party_a_id,
        role: project.partyA ? project.partyA.system_role : 'party_a',
        model_type: modelTypeInt,
        base_share: 0,
        model_cut_amount: Math.round(grossTeacher),
        report_grade: 'A',
        grade_multiplier: 1.0,
        late_task_count: 0,
        penalty_amount: 0,
        calculated_amount: Math.round(calcTeacher),
        final_override_amount: cachedOverrideTeacher !== undefined ? cachedOverrideTeacher : null,
        is_overridden: cachedOverrideTeacher !== undefined,
        penalty_metadata: JSON.stringify({
          info: `Quỹ Quản lý (${project.party_a_percent}%) trích từ sinh viên`,
          sources: teacherSources,
          pre_tax: Math.round(grossTeacher), 
          tax_amount: Math.round(taxTeacher) 
        })
      });
    }

    await RewardSheetDetail.bulkCreate(rewardDetails, { transaction });
    await transaction.commit();
    logger.info(`Đã tự động tính thưởng cho dự án ${projectId}.`);

    return sheet;
  } catch (error) {
    try {
      if (transaction) await transaction.rollback();
    } catch (rollbackError) {
      logger.warn('Transaction aborted by SQL Server.');
    }
    logger.error('Lỗi khi tính thưởng dự án:', error);
    throw error;
  }
};

// --- CÁC HÀM CÒN LẠI GIỮ NGUYÊN HOÀN TOÀN ---

const getRewardSheetByProject = async (projectId, requestingUser) => {
  const sheet = await RewardSheet.findOne({
    where: { project_id: projectId },
    include: [{
      model: RewardSheetDetail,
      as: 'details',
      include: [{ model: User, as: 'user', attributes: ['full_name', 'email', 'system_role'] }]
    }]
  });

  if (!sheet) throw { status: 404, message: 'Bảng tính thưởng dự án này chưa được tạo.' };

  const sheetData = sheet.toJSON();

  if (requestingUser.system_role !== 'vien_truong') {
    sheetData.details = sheetData.details.filter(detail => detail.user_id === requestingUser.id);
  }

  return sheetData;
};

const updateRewardOverride = async (detailId, overrideAmount, requestingUser) => {
  if (requestingUser.system_role !== 'vien_truong') {
    throw { status: 403, message: 'Chỉ Viện Trưởng mới có quyền chỉnh sửa số tiền.' };
  }

  const detail = await RewardSheetDetail.findByPk(detailId, {
    include: [{ model: RewardSheet, as: 'sheet' }]
  });

  if (!detail) throw { status: 404, message: 'Không tìm thấy chi tiết thưởng.' };
  if (detail.sheet.status === 'FINALIZED') throw { status: 400, message: 'Bảng tính đã chốt, không thể chỉnh sửa.' };

  detail.final_override_amount = overrideAmount;
  detail.is_overridden = overrideAmount !== null && overrideAmount !== undefined;
  await detail.save();

  return detail;
};

const finalizeRewardSheet = async (projectId, requestingUser) => {
  if (requestingUser.system_role !== 'vien_truong') {
    throw { status: 403, message: 'Chỉ Viện Trưởng mới có quyền chốt sổ (Finalize).' };
  }

  const sheet = await RewardSheet.findOne({
    where: { project_id: projectId },
    include: [{ model: RewardSheetDetail, as: 'details' }]
  });

  if (!sheet) throw { status: 404, message: 'Không tìm thấy bảng tính thưởng.' };
  if (sheet.status === 'FINALIZED') throw { status: 400, message: 'Bảng này đã được chốt từ trước.' };

  const pendingAppeals = sheet.details.filter(d => d.appeal_status === 'PENDING');
  if (pendingAppeals.length > 0) {
    throw {
      status: 400,
      message: `Không thể chốt sổ! Đang có ${pendingAppeals.length} khiếu nại chưa được giải quyết.`
    };
  }

  let totalActualPayout = 0;
  for (const detail of sheet.details) {
    const payoutForUser = detail.is_overridden
      ? Number(detail.final_override_amount)
      : Number(detail.calculated_amount);
    totalActualPayout += payoutForUser;
  }

  const projectBudget = Number(sheet.total_budget);
  const safeTotalPayout = Math.round(totalActualPayout);
  const safeProjectBudget = Math.round(projectBudget);

  if (safeTotalPayout > safeProjectBudget) {
    const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
    throw {
      status: 400,
      message: `Không thể chốt sổ! Tổng tiền chi trả (${formatter.format(safeTotalPayout)}) đang VƯỢT QUÁ ngân sách dự án (${formatter.format(safeProjectBudget)}).`
    };
  }

  sheet.status = 'FINALIZED';
  sheet.finalized_by = requestingUser.id;
  sheet.finalized_at = new Date();
  await sheet.save();

  return {
    ...sheet.toJSON(),
    summary: {
      total_budget: safeProjectBudget,
      total_payout: safeTotalPayout,
      budget_saved: safeProjectBudget - safeTotalPayout
    }
  };
};

const submitAppeal = async (detailId, reason, requestingUser) => {
  const detail = await RewardSheetDetail.findOne({
    where: { id: detailId, user_id: requestingUser.id },
    include: [{ model: RewardSheet, as: 'sheet' }]
  });

  if (!detail) throw { status: 404, message: 'Không tìm thấy dữ liệu thưởng của bạn.' };
  if (detail.sheet.status === 'FINALIZED') throw { status: 400, message: 'Bảng tính đã chốt, không thể khiếu nại nữa.' };

  detail.appeal_status = 'PENDING';
  detail.appeal_reason = reason;
  await detail.save();

  return detail;
};

const resolveAppeal = async (detailId, resolutionStatus, requestingUser) => {
  if (requestingUser.system_role !== 'vien_truong') {
    throw { status: 403, message: 'Chỉ Viện Trưởng mới có quyền giải quyết khiếu nại.' };
  }

  if (!['RESOLVED', 'REJECTED'].includes(resolutionStatus)) {
    throw { status: 400, message: 'Trạng thái giải quyết không hợp lệ.' };
  }

  const detail = await RewardSheetDetail.findByPk(detailId, {
    include: [{ model: RewardSheet, as: 'sheet' }]
  });

  if (!detail) throw { status: 404, message: 'Không tìm thấy chi tiết thưởng.' };
  if (detail.appeal_status !== 'PENDING') throw { status: 400, message: 'Mục này không có khiếu nại nào đang chờ xử lý.' };
  if (detail.sheet.status === 'FINALIZED') throw { status: 400, message: 'Bảng tính đã chốt.' };

  detail.appeal_status = resolutionStatus;
  await detail.save();

  return detail;
};

const exportRewardExcel = async (projectId, requestingUser) => {
  const sheetData = await getRewardSheetByProject(projectId, requestingUser);
  const project = await Project.findByPk(projectId);
  let fileName = `BangTinhThuong_${projectId}.xlsx`;

  if (project) {
    const sanitizeString = (str) => {
      if (!str) return '';
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_");
    };
    const safeName = sanitizeString(project.name);
    const safeCode = sanitizeString(project.code);
    const namePart = [safeName, safeCode].filter(Boolean).join('_');
    if (namePart) {
      fileName = `BangTinhThuong_${namePart}.xlsx`;
    }
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Bảng Tính Thưởng');

  worksheet.columns = [
    { header: 'ID Chi Tiết (KHÔNG SỬA)', key: 'id', width: 40 },
    { header: 'Họ và Tên', key: 'name', width: 25 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Vai trò', key: 'role', width: 15 },
    { header: 'Trước Thuế (VNĐ)', key: 'pre_tax', width: 20 },
    { header: 'Thuế 10% (VNĐ)', key: 'tax_amount', width: 20 },
    { header: 'Thực nhận tự động (VNĐ)', key: 'auto_amount', width: 25 },
    { header: 'Điều chỉnh tay (VNĐ)', key: 'override_amount', width: 25 },
    { header: 'Trạng thái Khiếu nại', key: 'appeal', width: 20 },
  ];

  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

  sheetData.details.forEach(row => {
    let meta = {};
    try { 
        meta = JSON.parse(row.penalty_metadata || '{}'); 
    } catch(e) {}

    worksheet.addRow({
      id: row.id,
      name: row.user ? row.user.full_name : 'N/A', 
      email: row.user ? row.user.email : 'N/A',
      role: row.role,
      pre_tax: meta.pre_tax || 0,        
      tax_amount: meta.tax_amount || 0,  
      auto_amount: Number(row.calculated_amount),
      override_amount: row.final_override_amount !== null ? Number(row.final_override_amount) : '',
      appeal: row.appeal_status
    });
  });

  worksheet.getColumn('id').hidden = true;
  return { workbook, fileName };
};

const importOverrideExcel = async (projectId, fileBuffer, requestingUser) => {
  if (requestingUser.system_role !== 'vien_truong') {
    throw { status: 403, message: 'Chỉ Viện Trưởng mới có quyền Import file.' };
  }

  const sheet = await RewardSheet.findOne({ where: { project_id: projectId } });
  if (!sheet) throw { status: 404, message: 'Bảng tính chưa tồn tại.' };
  if (sheet.status === 'FINALIZED') throw { status: 400, message: 'Bảng này đã chốt, không thể Import ghi đè.' };

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const worksheet = workbook.getWorksheet(1);

  const updates = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const rawId = row.getCell(1).value;
      let detailId = typeof rawId === 'object' ? (rawId?.text || rawId?.result) : rawId;

      let rawVal = row.getCell(8).value;
      let overrideVal = rawVal;

      if (rawVal !== null && rawVal !== undefined) {
          if (typeof rawVal === 'object') {
              if (rawVal.result !== undefined) {
                  overrideVal = rawVal.result; 
              } else if (rawVal.formula) {
                  throw { status: 400, message: `Lỗi dòng ${rowNumber}: Cột "Điều chỉnh tay" đang chứa công thức (${rawVal.formula}) nhưng không có kết quả. Hãy bôi đen cột đó trong Excel -> Copy -> Paste as Values (Dán giá trị) rồi Import lại!` };
              }
          }

          if (typeof overrideVal === 'string') {
              overrideVal = overrideVal.replace(/[,.\s]/g, '');
          }
          
          overrideVal = Number(overrideVal);
          if (isNaN(overrideVal)) overrideVal = null;
      } else {
          overrideVal = null; 
      }

      if (detailId) {
        updates.push({
          detailId: detailId.toString().trim(),
          overrideVal: overrideVal
        });
      }
    }
  });

  let successCount = 0;
  for (const item of updates) {
    const detail = await RewardSheetDetail.findOne({
      where: { id: item.detailId, sheet_id: sheet.id }
    });

    if (detail) {
      const currentVal = detail.final_override_amount !== null ? Number(detail.final_override_amount) : null;
      
      if (currentVal !== item.overrideVal) {
        detail.final_override_amount = item.overrideVal;
        detail.is_overridden = item.overrideVal !== null;
        await detail.save();
        successCount++;
      }
    }
  }

  return { successCount };
};

module.exports = {
  autoGenerateProjectReward,
  getRewardSheetByProject,
  updateRewardOverride,
  finalizeRewardSheet,
  submitAppeal,
  resolveAppeal,
  exportRewardExcel,
  importOverrideExcel,
};