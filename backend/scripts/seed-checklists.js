const db = require('../src/models');

const seedChecklists = async () => {
  const { Milestone, Checklist, ChecklistItem } = db;
  try {
    console.log('Starting checklist seeding...');

    // Get first milestone to add checklists to
    const milestone = await Milestone.findOne();
    if (!milestone) {
      console.log('No milestones found, skipping checklist seeding');
      return;
    }

    console.log(`Adding checklists to milestone: ${milestone.title}`);

    // Create checklist for Fire Alarm System
    const fireAlarmChecklist = await Checklist.create({
      milestone_id: milestone.id,
      title: 'May Bao Chay - Cam Bien va Thu Thap Du Lieu',
      category: 'hardware',
      description: 'Kiem tra cac thong so ky thuat cua he thong cam bien khoi va nhiet',
    });

    const fireAlarmItems = [
      {
        checklist_id: fireAlarmChecklist.id,
        title: 'Sai so cua cam bien khoi co nam trong dai cho phep (+/-5%)',
        description: 'Do do nhay cua cam bien khoi o cac muc nong do khac nhau',
        expected_value: '+/-5%',
        order_index: 0,
      },
      {
        checklist_id: fireAlarmChecklist.id,
        title: 'Thoi gian phan hoi tu luc co khoi den khi vi xu ly nhan tin hieu',
        description: 'Do latency tu sensor den microcontroller',
        expected_value: '< 100ms',
        order_index: 1,
      },
      {
        checklist_id: fireAlarmChecklist.id,
        title: 'Do on dinh tin hieu trong moi truong nhiet do cao',
        description: 'Test sensor performance o 50C',
        expected_value: 'Stable',
        order_index: 2,
      },
    ];

    await ChecklistItem.bulkCreate(fireAlarmItems);

    // Create checklist for Robot Arm
    const robotChecklist = await Checklist.create({
      milestone_id: milestone.id,
      title: 'Tay May Robot - Dong Hoc va Co Cau Chap Hanh',
      category: 'hardware',
      description: 'Kiem tra cac khop va co cau chap hanh cua robot',
    });

    const robotItems = [
      {
        checklist_id: robotChecklist.id,
        title: 'Cac khop chuyen dong muot ma, khong bi ket hay keu to',
        description: 'Visual inspection va manual testing cua tat ca joints',
        expected_value: 'Smooth',
        order_index: 0,
      },
      {
        checklist_id: robotChecklist.id,
        title: 'Do ro (Backlash) cua banh rang co nam trong muc cho phep',
        description: 'Measure backlash cua gearbox',
        expected_value: '< 0.5mm',
        order_index: 1,
      },
      {
        checklist_id: robotChecklist.id,
        title: 'Do chinh xac dinh vi sau 100 lan lap lai',
        description: 'Repeatability test',
        expected_value: '+/-0.1mm',
        order_index: 2,
      },
    ];

    await ChecklistItem.bulkCreate(robotItems);

    // Create software checklist
    const softwareChecklist = await Checklist.create({
      milestone_id: milestone.id,
      title: 'Lap Trinh Quy Dao - Inverse Kinematics',
      category: 'software',
      description: 'Kiem tra thuat toan tinh toan quy dao cua robot',
    });

    const softwareItems = [
      {
        checklist_id: softwareChecklist.id,
        title: 'Robot co gap dung vat the o vi tri toa do da dinh truoc',
        description: 'Test pick-and-place accuracy',
        expected_value: '+/-1mm',
        order_index: 0,
      },
      {
        checklist_id: softwareChecklist.id,
        title: 'Sai so vi tri sau 100 lan chay thu',
        description: 'Statistical analysis cua positioning error',
        expected_value: '< 2mm',
        order_index: 1,
      },
      {
        checklist_id: softwareChecklist.id,
        title: 'Thoi gian tinh toan inverse kinematics',
        description: 'Performance benchmark',
        expected_value: '< 50ms',
        order_index: 2,
      },
    ];

    await ChecklistItem.bulkCreate(softwareItems);

    console.log('Checklist seeding completed successfully!');
    console.log(`Created ${fireAlarmItems.length + robotItems.length + softwareItems.length} checklist items`);

  } catch (error) {
    console.error('Error seeding checklists:', error);
  }
};

module.exports = { seedChecklists };

// Run if called directly
if (require.main === module) {
  seedChecklists().then(() => {
    console.log('Seeding done');
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
