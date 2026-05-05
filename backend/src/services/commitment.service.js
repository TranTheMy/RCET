const { Op } = require('sequelize');
const path = require('path');
const puppeteer = require('puppeteer');
const archiver = require('archiver');
const slugify = require('slugify');
const { Commitment, Project, User, ProjectMember, sequelize } = require('../models');
const {
  COMMITMENT_STATUS,
  PROJECT_STATUS,
  PROJECT_LIMITS,
  SYSTEM_ROLES,
  PROJECT_ROLES,
  AUDIT_ACTIONS,
} = require('../config/constants');
const {
  assertMemberUnderProjectLimit,
  countMemberConfirmedActiveProjects,
} = require('../utils/memberProjectLimits');
const auditService = require('./audit.service');
const projectService = require('./project.service');
const realtimeService = require('./realtime.service');

const getCommitmentHtml = (data) => {
  const { date, partyA, partyB, modelType, projectName } = data;

  const getModelContent = (type) => {
    switch (type) {
      case 'MODEL_1':
        return `
          <p><strong>Mô hình 1: Giảng viên làm chính – Sinh viên học việc</strong><br/>
          <em>(Áp dụng cho sinh viên năm 2–3, mới tham gia nghiên cứu)</em></p>
          <ul>
            <li>Bên A: <strong>65–70%</strong> tổng giá trị tiền thưởng</li>
            <li>Tập thểBên B: <strong>30–35%</strong> tổng giá trị tiền thưởng</li>
          </ul>`;
      case 'MODEL_2':
        return `
          <p><strong>Mô hình 2: Đồng tác giả thực chất</strong><br/>
          <em>(Áp dụng cho sinh viên năm cuối, cao học hoặc sinh viên tham gia đầy đủ các khâu nghiên cứu)</em></p>
          <ul>
            <li>Bên A: <strong>50–60%</strong> tổng giá trị tiền thưởng</li>
            <li>Tập thể Bên B: <strong>40–50%</strong> tổng giá trị tiền thưởng</li>
          </ul>`;
      case 'MODEL_3':
        return `
          <p><strong>Mô hình 3: Sinh viên làm chính – Giảng viên bảo trợ học thuật</strong><br/>
          <em>(Áp dụng khi sinh viên thực hiện phần lớn công việc nghiên cứu và viết bài)</em></p>
          <ul>
            <li>Bên A: <strong>40–50%</strong> tổng giá trị tiền thưởng</li>
            <li>Tập thể Bên B: <strong>50–60%</strong> tổng giá trị tiền thưởng</li>
          </ul>`;
      default:
        // Hỗ trợ debug nếu DB bị lưu sai kiểu
        return `<p><em>(Lỗi: Không xác định được mô hình phân bổ. Giá trị hiện tại: ${type})</em></p>`;
    }
  };

  return `
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.5; margin: 0; color: #000; }
    .header { text-align: center; font-weight: bold; margin-bottom: 30px; }
    .header p { margin: 5px 0; }
    .title { text-align: center; font-weight: bold; font-size: 14pt; margin: 20px 0; text-transform: uppercase; }
    .section-title { font-weight: bold; margin-top: 20px; text-transform: uppercase; }
    .info-block p { margin: 5px 0; }
    p { text-align: justify; margin: 8px 0; }
    ul { margin-top: 5px; margin-bottom: 10px; padding-left: 40px; }
    li { text-align: justify; margin-bottom: 5px; }
    .signature-table { width: 100%; margin-top: 40px; border-collapse: collapse; }
    .signature-table td { width: 50%; text-align: center; vertical-align: top; }
    .space-for-sign { height: 100px; }
  </style>
  </head>
  <body>
    <div class="header" style="text-align: center; font-weight: bold; margin-bottom: 30px;">
  <p style="margin: 5px 0;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
  <p style="margin: 5px 0;">Độc lập – Tự do – Hạnh phúc</p>
  <p style="margin: 5px 0;">***</p>
</div>

    <div class="title">BẢN CAM KẾT BẢO MẬT THÔNG TIN, QUYỀN VÀ NGHĨA VỤ<br>TRONG HOẠT ĐỘNG NGHIÊN CỨU KHOA HỌC</div>
    <p style="text-align:center; font-style:italic;">(V/v: Tham gia dự án "${projectName}")</p>

    <p>Hôm nay, ngày ${date.day} tháng ${date.month} năm ${date.year}, tại ${date.location}, chúng tôi gồm có:</p>

    <div class="info-block">
      <p><strong>BÊN A: GIẢNG VIÊN – NGHIÊN CỨU VIÊN (Người hướng dẫn chính)</strong></p>
      <p>- Họ và tên: <strong>${partyA.name}</strong></p>
      <p>- Chức danh: ${partyA.title}</p>
      <p>- Đơn vị công tác: ${partyA.office}</p>
      <p>- Email: ${partyA.email}</p>
      <p><em>(Sau đây gọi là “Bên A”)</em></p>
    </div>

    <div class="info-block" style="margin-top: 15px;">
      <p><strong>BÊN B: SINH VIÊN THAM GIA NGHIÊN CỨU KHOA HỌC</strong></p>
      <p>- Họ và tên: <strong>${partyB.name}</strong></p>
      <p>- Mã số sinh viên: ${partyB.mssv}</p>
      <p>- Lớp/Khoa/Trường: ${partyB.class}</p>
      <p>- Email: ${partyB.email}</p>
      <p><em>(Sau đây gọi là “Bên B”)</em></p>
    </div>

    <p>Hai bên cùng thống nhất ký kết Cam kết bảo mật thông tin và phân bổ quyền lợi trong hoạt động nghiên cứu khoa học với các điều khoản sau:</p>

    <div class="section-title">ĐIỀU 1. PHẠM VI ÁP DỤNG</div>
    <p>Cam kết này áp dụng cho toàn bộ:</p>
    <ul>
      <li>Đề tài nghiên cứu khoa học, khóa luận, luận văn, bài báo khoa học, báo cáo hội thảo;</li>
      <li>Ý tưởng nghiên cứu, giả thuyết khoa học, phương pháp, dữ liệu, kết quả nghiên cứu;</li>
      <li>Tài liệu, bản thảo, số liệu thô, hình ảnh, biểu đồ, mã nguồn và mọi thông tin liên quan mà Bên B được tiếp cận trong quá trình Bên A hướng dẫn.</li>
    </ul>

    <div class="section-title">ĐIỀU 2. BẢO MẬT THÔNG TIN</div>
    <p>Bên B cam kết không tiết lộ, không sao chép, không chuyển giao cho bất kỳ bên thứ ba nào các thông tin nghiên cứu nêu tại Điều 1 dưới bất kỳ hình thức nào khi chưa có sự đồng ý bằng văn bản của Bên A.</p>
    <p>Nghĩa vụ bảo mật có hiệu lực trong suốt quá trình nghiên cứu và tiếp tục có hiệu lực sau khi đề tài kết thúc, Bên B tốt nghiệp hoặc không còn tham gia nhóm nghiên cứu.</p>

    <div class="section-title">ĐIỀU 3. QUYỀN TÁC GIẢ VÀ QUYỀN SỞ HỮU TRÍ TUỆ</div>
    <p><strong>Bên A</strong> được xác định là người hướng dẫn chính và/hoặc người đề xuất ý tưởng nghiên cứu, chịu trách nhiệm chính về định hướng khoa học của đề tài.</p>
    <p>Quyền tác giả và thứ tự tên tác giả trong các công bố khoa học được xác định dựa trên:</p>
    <ul>
      <li>Mức độ đóng góp thực tế của từng bên;</li>
      <li>Thông lệ học thuật;</li>
      <li>Quy định của pháp luật và của cơ sở đào tạo;</li>
      <li>Quyết định cuối cùng của Bên A với tinh thần minh bạch và công bằng.</li>
    </ul>
    <p><strong>Bên B</strong> không được tự ý nộp bài, công bố, đăng tải hoặc sử dụng một phần hay toàn bộ kết quả nghiên cứu khi chưa có sự chấp thuận của Bên A.</p>

    <div class="section-title">ĐIỀU 4. NGUYÊN TẮC PHÂN BỔ QUYỀN LỢI TÀI CHÍNH</div>
    <p>1. Nguyên tắc cốt lõi:</p>
    <ul>
      <li>Quyền tác giả được xác nhận và định nghĩa khác với Quyền tiền thưởng;</li>
      <li>Mức tiền thưởng được phân bổ theo mức đóng góp thực tế;</li>
      <li>Sinh viên luôn được xem xét có phần thưởng;</li>
      <li>Giảng viên là người quyết định cuối cùng nhưng mọi thông tin phải được minh bạch.</li>
    </ul>
    <p>2. Trường hợp bài báo, báo cáo hội thảo hoặc công bố khoa học phát sinh khoản thưởng từ nhà trường hoặc đơn vị tài trợ (dự kiến từ 40.000.000 đến 100.000.000 VNĐ hoặc theo quy định từng thời kỳ), khoản thưởng này được xem là quyền lợi phát sinh từ hoạt động nghiên cứu chung.</p>
    <p>3. Việc phân bổ tiền thưởng được thực hiện trên cơ sở:</p>
    <ul>
      <li>Mức độ đóng góp thực tế của từng bên;</li>
      <li>Vai trò trong nghiên cứu (ý tưởng, thiết kế nghiên cứu, thực nghiệm, phân tích dữ liệu, viết và chỉnh sửa bài);</li>
      <li>Thông lệ học thuật và quy định của nhà trường.</li>
    </ul>
    <p>4. Sinh viên tham gia nghiên cứu luôn được xem xét phân bổ quyền lợi tài chính tương xứng, không bị coi là lao động không thù lao.</p>

    <div class="section-title">ĐIỀU 5. CÁC MÔ HÌNH PHÂN BỔ TIỀN THƯỞNG THAM KHẢO</div>
    <p>Hai bên thống nhất áp dụng một trong các mô hình sau, tùy theo tính chất và mức độ đóng góp của Bên B trong từng đề tài cụ thể:</p>
    ${getModelContent(modelType)}
    <p>Tỷ lệ phân bổ cụ thể sẽ được hai bên xác nhận bằng văn bản hoặc email trước thời điểm nhận thưởng.</p>

    <div class="section-title">ĐIỀU 6. QUYỀN VÀ NGHĨA VỤ CỦA SINH VIÊN (BÊN B)</div>
    <ul>
      <li>Thực hiện nghiên cứu trung thực, nghiêm túc, tuân thủ đạo đức học thuật.</li>
      <li>Tôn trọng vai trò hướng dẫn khoa học của Bên A.</li>
      <li>Ghi nhận đầy đủ sự hướng dẫn và đóng góp của Bên A trong mọi sản phẩm học thuật.</li>
      <li>Chịu trách nhiệm trước pháp luật và nhà trường nếu vi phạm các cam kết đã ký.</li>
    </ul>

    <div class="section-title">ĐIỀU 7. XỬ LÝ VI PHẠM</div>
    <p>Trường hợp Bên B vi phạm cam kết, Bên A có quyền yêu cầu chấm dứt hành vi vi phạm, không cho phép sử dụng kết quả nghiên cứu và báo cáo vụ việc với nhà trường hoặc cơ quan có thẩm quyền.</p>
    <p>Bên vi phạm phải chịu trách nhiệm bồi thường thiệt hại (nếu có) theo quy định pháp luật Việt Nam hiện hành, bao gồm nhưng không giới hạn ở:</p>
    <ul>
      <li>Bộ luật Dân sự năm 2015, đặc biệt là các Điều 584, 585 và 589 về căn cứ phát sinh trách nhiệm bồi thường thiệt hại, nguyên tắc bồi thường và thiệt hại được bồi thường;</li>
      <li>Luật Sở hữu trí tuệ năm 2005, sửa đổi, bổ sung các năm 2009, 2019 và 2022, đặc biệt là các Điều 28, 35, 198 và 202 liên quan đến hành vi xâm phạm quyền tác giả, quyền liên quan và biện pháp xử lý, bồi thường thiệt hại;</li>
      <li>Các văn bản pháp luật khác có liên quan và quy định nội bộ của cơ sở đào tạo (nếu có).</li>
    </ul>

    <div class="section-title">ĐIỀU 8. HIỆU LỰC CAM KẾT VÀ GIÁ TRỊ PHÁP LÝ</div>
    <p>1. Cam kết này được xem là thỏa thuận dân sự theo quy định của Bộ luật Dân sự năm 2015, có bản chất pháp lý tương tự một hợp đồng dân sự, được xác lập trên cơ sở tự nguyện, bình đẳng, thiện chí và trung thực của các bên.</p>
    <p>2. Cam kết này đáp ứng các điều kiện có hiệu lực của giao dịch dân sự theo Điều 117 Bộ luật Dân sự năm 2015 và được pháp luật Việt Nam bảo vệ.</p>
    <p>3. Cam kết này có hiệu lực kể từ ngày ký.</p>
    <p>4. Cam kết được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản.</p>

    <table class="signature-table">
      <tr>
        <td>
          <strong>BÊN A</strong><br/>
          <em>(Ký, ghi rõ họ tên)</em>
          <div class="space-for-sign"></div>
          <strong>${partyA.name}</strong>
        </td>
        <td>
          <strong>BÊN B</strong><br/>
          <em>(Ký, ghi rõ họ tên)</em>
          <div class="space-for-sign"></div>
          <strong>${partyB.name}</strong>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
};

const exportCommitments = async (projectId, commitmentIds) => {
  const project = await Project.findByPk(projectId, {
    include: [{ model: User, as: 'partyA' }],
  });

  if (!project) {
    throw new Error('Project not found');
  }
  if (!project.partyA) {
    throw new Error('Party A (Lecturer) not found for this project');
  }

  const whereClause = {
    project_id: projectId,
    status: COMMITMENT_STATUS.B_APPROVED,
  };
  if (commitmentIds && commitmentIds.length > 0) {
    whereClause.id = { [Op.in]: commitmentIds };
  }

  const approvedCommitments = await Commitment.findAll({
    where: whereClause,
    include: [{ model: User, as: 'user' }],
  });

  if (approvedCommitments.length === 0) {
    return {
      type: 'zip',
      data: null,
      fileName: `No_Approved_Commitments.zip`,
    };
  }

  const archive = archiver('zip', { zlib: { level: 9 } });

  const getFileBaseName = (memberName, memberId) => {
    const safeProjectName = slugify(project.name || 'project', {
      replacement: '_',
      remove: /[*+~.()'"!:@]/g,
      locale: 'vi',
      strict: true,
      trim: true,
    }) || 'project';
    const safeMemberName = slugify(memberName || `user-${memberId}`, {
      replacement: '_',
      remove: /[*+~.()'"!:@]/g,
      locale: 'vi',
      strict: true,
      trim: true,
    }) || `user-${memberId}`;

    return `Ban_Cam_Ket_${safeProjectName}_${safeMemberName}`;
  };

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (launchError) {
    console.error('[CommitmentExport] Puppeteer launch failed, fallback to HTML export.', launchError);
  }

  const commonDate = new Date();

  for (const commitment of approvedCommitments) {
    const templateData = {
      projectName: project.name,
      date: {
        day: commonDate.getDate().toString().padStart(2, '0'),
        month: (commonDate.getMonth() + 1).toString().padStart(2, '0'),
        year: commonDate.getFullYear(),
        location: 'TinLab',
      },
      partyA: {
        name: project.partyA.full_name || '',
        title: project.partyA.role || 'Giảng viên',
        office: '',
        email: project.partyA.email || '',
      },
      partyB: {
        name: commitment.user.full_name || '',
        mssv: commitment.user.student_code || '',
        class: '',
        email: commitment.user.email || '',
      },
      // SỬA LỖI ĐIỀU 5: Bỏ modelTypeMap, gán trực tiếp chuỗi từ database
      modelType: project.model_type || 'UNKNOWN',
    };

    const htmlContent = getCommitmentHtml(templateData);
    const fileBaseName = getFileBaseName(commitment.user.full_name, commitment.user_id);

    if (!browser) {
      archive.append(Buffer.from(htmlContent, 'utf-8'), { name: `${fileBaseName}.html` });
      continue;
    }

    let page;
    try {
      page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfData = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '30mm' },
      });

      if (pdfData) {
        archive.append(Buffer.from(pdfData), { name: `${fileBaseName}.pdf` });
      } else {
        console.error(`[CommitmentExport] PDF generation returned empty data for user: ${commitment.user?.full_name}`);
        archive.append(Buffer.from(htmlContent, 'utf-8'), { name: `${fileBaseName}.html` });
      }
    } catch (error) {
      console.error(`[CommitmentExport] Error during PDF generation for user ${commitment.user?.full_name}:`, error);
      archive.append(Buffer.from(htmlContent, 'utf-8'), { name: `${fileBaseName}.html` });
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  if (browser) {
    await browser.close();
  }
  archive.finalize();

  return {
    type: 'zip',
    data: archive,
    fileName: `Ban_Cam_Ket_NCKH_${slugify(project.name, { replacement: '_' })}.zip`,
  };
};
// --- GIỮ NGUYÊN LOGIC CÁC HÀM CÒN LẠI ---
const bulkArchiveCommitments = async ({ commitmentIds, userId }) => {
  if (!commitmentIds || commitmentIds.length === 0) throw { status: 400, message: 'Commitment IDs are required.' };
  const [updateCount] = await Commitment.update(
    { status: COMMITMENT_STATUS.ACTIVE, hardcopy_filed_at: new Date() },
    { where: { id: { [Op.in]: commitmentIds }, status: COMMITMENT_STATUS.B_APPROVED } }
  );
  if (updateCount > 0) await auditService.log(AUDIT_ACTIONS.COMMITMENT_BULK_ARCHIVED, userId, null, { count: updateCount, commitment_ids: commitmentIds });
  if (updateCount > 0) {
    const rows = await Commitment.findAll({
      where: { id: { [Op.in]: commitmentIds } },
      attributes: ['project_id'],
    });
    const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))];
    for (const pid of projectIds) {
      realtimeService.broadcastProjectUpdate(pid, 'commitment_updated', {
        source: 'bulk_archive',
        commitmentIds,
      });
    }
  }
  return { message: `Successfully archived ${updateCount} commitments.` };
};

const getMyCommitments = async (userId) => {
  const commitments = await Commitment.findAll({
    where: { user_id: userId },
    include: [{
      model: Project,
      attributes: ['id', 'name', 'code', 'model_type', 'party_a_percent', 'party_b_percent', 'leader_id'],
      include: [{ model: User, as: 'leader', attributes: ['full_name'] }],
    }],
    order: [['created_at', 'DESC']],
  });
  const pairs = commitments
    .map((c) => c.Project)
    .filter(Boolean)
    .map((p) => ({ id: p.id, leader_id: p.leader_id }));
  const shown = await projectService.batchProjectIdsWhereLeaderUserIsShown(pairs);
  for (const c of commitments) {
    const P = c.Project;
    if (!P || !P.leader_id) continue;
    if (!shown.has(P.id)) {
      P.setDataValue('leader', null);
    }
  }
  return commitments;
};

const updateStatus = async (commitmentId, userId, data) => {
  const commitment = await Commitment.findOne({ where: { id: commitmentId, user_id: userId } });
  if (!commitment) throw { status: 404, message: 'Commitment not found or unauthorized' };
  if (commitment.status !== COMMITMENT_STATUS.PENDING_B_APPROVAL) {
    throw { status: 400, message: 'Only pending commitments can be updated' };
  }

  if (data.status === COMMITMENT_STATUS.B_APPROVED) {
    const currentUser = await User.findByPk(userId, { attributes: ['id', 'system_role'] });
    if (currentUser && currentUser.system_role === SYSTEM_ROLES.MEMBER) {
      const cnt = await countMemberConfirmedActiveProjects(userId, undefined, {
        excludeProjectId: commitment.project_id,
      });
      if (cnt >= PROJECT_LIMITS.MAX_ACTIVE_PROJECTS_PER_USER) {
        throw {
          status: 400,
          message:
            `Bạn đã tham gia đủ tối đa ${PROJECT_LIMITS.MAX_ACTIVE_PROJECTS_PER_USER} dự án (lập kế hoạch, đang hoạt động hoặc tạm dừng). Vui lòng hoàn tất hoặc rút khỏi một dự án trước khi xác nhận cam kết này.`,
          code: 'MEMBER_PROJECT_LIMIT_REACHED',
        };
      }
    }
  }

  const t = await sequelize.transaction();
  let rejectedAsDesignatedLeader = false;
  try {
    if (data.status === COMMITMENT_STATUS.B_REJECTED) {
      const preProject = await Project.findByPk(commitment.project_id, {
        attributes: ['leader_id'],
        transaction: t,
      });
      rejectedAsDesignatedLeader = Boolean(preProject && preProject.leader_id === userId);
    }

    await commitment.update(
      {
        status: data.status,
        reject_reason: data.status === COMMITMENT_STATUS.B_REJECTED ? data.reason : null,
      },
      { transaction: t },
    );

    if (data.status === COMMITMENT_STATUS.B_REJECTED) {
      await ProjectMember.destroy({
        where: { project_id: commitment.project_id, user_id: userId },
        transaction: t,
      });
      const projForReject = await Project.findByPk(commitment.project_id, {
        attributes: ['id', 'leader_id', 'status'],
        transaction: t,
      });
      if (
        projForReject &&
        projForReject.leader_id === userId &&
        projForReject.status === PROJECT_STATUS.PLANNING
      ) {
        await projForReject.update(
          {
            leader_id: null,
            awaiting_leader_assignment: true,
          },
          { transaction: t },
        );
      }
    }

    /** Lời mời TAG: sau khi đồng ý cam kết, ghi nhận ProjectMember — chủ trì dự kiến → LEADER, còn lại → MEMBER. */
    if (data.status === COMMITMENT_STATUS.B_APPROVED) {
      const project = await Project.findByPk(commitment.project_id, {
        attributes: ['id', 'leader_id'],
        transaction: t,
      });
      const existingPm = await ProjectMember.findOne({
        where: { project_id: commitment.project_id, user_id: userId },
        transaction: t,
      });
      if (!existingPm && project) {
        await assertMemberUnderProjectLimit(userId, t, { asSelf: true });
        /** Cả chủ trì dự kiến cũng vào nhóm với MEMBER; nhận vai trò LEADER qua acceptLeaderRole. */
        await ProjectMember.create(
          {
            project_id: commitment.project_id,
            user_id: userId,
            role: PROJECT_ROLES.MEMBER,
            joined_at: new Date(),
          },
          { transaction: t },
        );
        await auditService.log(
          AUDIT_ACTIONS.PROJECT_MEMBER_ADDED,
          userId,
          null,
          {
            project_id: commitment.project_id,
            note: 'Xác nhận tham gia từ trang cam kết (lời mời tag).',
          },
          { transaction: t },
        );
      }
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  void projectService.notifyCommitmentResponseStakeholders(
    commitment.project_id,
    userId,
    data.status === COMMITMENT_STATUS.B_APPROVED ? 'approved' : 'rejected',
    data.status === COMMITMENT_STATUS.B_REJECTED ? (data.reason || null) : null,
    { rejectedAsDesignatedLeader },
  );

  const reloaded = await commitment.reload();
  const pid = reloaded.project_id;
  if (data.status === COMMITMENT_STATUS.B_APPROVED) {
    realtimeService.broadcastProjectUpdate(pid, 'member_added', {
      source: 'commitment_response',
      userId,
      commitmentId: reloaded.id,
    });
  } else if (data.status === COMMITMENT_STATUS.B_REJECTED) {
    realtimeService.broadcastProjectUpdate(pid, 'member_removed', {
      source: 'commitment_response',
      userId,
      commitmentId: reloaded.id,
    });
  }
  realtimeService.broadcastProjectUpdate(pid, 'commitment_updated', {
    commitmentId: reloaded.id,
    status: data.status,
    userId,
  });

  return reloaded;
};

module.exports = { exportCommitments, bulkArchiveCommitments, getMyCommitments, updateStatus };