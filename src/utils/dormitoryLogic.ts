import { Student, Dormitory, GradeLevel, StudentGender, DormitoryType, DormitorySupervisor, DormitoryClassroomRule } from '../types';
import { calculateStudentGrade } from './conductLogic';

/**
 * ดึงข้อมูลประเภทหอพัก (3 ประเภท)
 * 1. หอพักรวม (M)(F)
 * 2. หอพักชาย (M)
 * 3. หอพักหญิง (F)
 */
export function getDormitoryTypeName(type: DormitoryType | string): string {
  if (type === 'MIXED' || type === 'ALL' || type === 'COED') return 'หอพักรวม (M/F)';
  if (type === 'M') return 'หอพักชาย (M)';
  if (type === 'F') return 'หอพักหญิง (F)';
  return 'หอพักทั่วไป';
}

export function getDormitoryTypeBadge(type: DormitoryType | string): {
  label: string;
  shortLabel: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  if (type === 'MIXED' || type === 'ALL' || type === 'COED') {
    return {
      label: 'หอพักรวม (M)(F)',
      shortLabel: 'หอรวม (M/F)',
      bgClass: 'bg-purple-50',
      textClass: 'text-purple-700',
      borderClass: 'border-purple-200'
    };
  }
  if (type === 'M') {
    return {
      label: 'หอพักชาย (M)',
      shortLabel: 'ชาย (M)',
      bgClass: 'bg-blue-50',
      textClass: 'text-blue-700',
      borderClass: 'border-blue-200'
    };
  }
  return {
    label: 'หอพักหญิง (F)',
    shortLabel: 'หญิง (F)',
    bgClass: 'bg-pink-50',
    textClass: 'text-pink-700',
    borderClass: 'border-pink-200'
  };
}

/**
 * ดึงรายชื่อครูหอพักทั้งหมดของหอพัก (รองรับมากกว่า 1 คน และย้อนหลังกับ supervisorName)
 */
export function getDormitorySupervisors(dorm: Dormitory): DormitorySupervisor[] {
  if (dorm.supervisors && dorm.supervisors.length > 0) {
    return dorm.supervisors.filter(s => s.name && s.name.trim() !== '');
  }
  if (dorm.supervisorName && dorm.supervisorName.trim() !== '') {
    return [
      {
        id: `sup-${dorm.id}-legacy`,
        name: dorm.supervisorName.trim(),
        phone: dorm.supervisorPhone?.trim() || '',
        role: 'หัวหน้าครูหอพัก'
      }
    ];
  }
  return [];
}

/**
 * แปลงรายชื่อครูหอพักเป็นข้อความสรุป
 */
export function formatSupervisorsList(dorm: Dormitory): string {
  const sups = getDormitorySupervisors(dorm);
  if (sups.length === 0) return 'ยังไม่ได้กำหนดครูหอพัก';
  return sups.map(s => s.name).join(', ');
}

/**
 * โครงสร้างหอพักเริ่มต้น 1 - 6
 * หอ 1 - 3: หอพักชาย (M)
 * หอ 4 - 6: หอพักหญิง (F)
 * พร้อมครูหอพักประจำมากกว่า 1 คน ไม่ปล่อยว่าง
 */
export const DEFAULT_DORMITORIES: Dormitory[] = [
  {
    id: 'dorm-1',
    dormNumber: 1,
    name: 'หอพัก 1 (ชาย)',
    gender: 'M',
    assignedGrades: ['ม.1', 'ม.2'],
    assignedRooms: [1, 2, 3, 4],
    assignedClassrooms: [
      { grade: 'ม.1', rooms: [1, 2, 3, 4], gender: 'M' },
      { grade: 'ม.2', rooms: [1, 2, 3, 4], gender: 'M' }
    ],
    gradeGenderRules: [
      { grade: 'ม.1', rooms: [1, 2, 3, 4], gender: 'M' },
      { grade: 'ม.2', rooms: [1, 2, 3, 4], gender: 'M' }
    ],
    supervisors: [
      { id: 'sup-1-1', name: 'ครูสมศักดิ์ วินัยเด่น', phone: '081-111-2233', role: 'หัวหน้าครูหอพัก' },
      { id: 'sup-1-2', name: 'ครูกิตติพงษ์ บุญชู', phone: '081-111-2244', role: 'ครูหอพักประจำ' }
    ],
    supervisorName: 'ครูสมศักดิ์ วินัยเด่น',
    supervisorPhone: '081-111-2233',
    capacity: 80,
    notes: 'หอพักนักเรียนชาย ระดับชั้น ม.1 และ ม.2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'dorm-2',
    dormNumber: 2,
    name: 'หอพัก 2 (ชาย)',
    gender: 'M',
    assignedGrades: ['ม.3', 'ม.4'],
    assignedRooms: [1, 2, 3, 4],
    assignedClassrooms: [
      { grade: 'ม.3', rooms: [1, 2, 3, 4], gender: 'M' },
      { grade: 'ม.4', rooms: [1, 2, 3, 4], gender: 'M' }
    ],
    gradeGenderRules: [
      { grade: 'ม.3', rooms: [1, 2, 3, 4], gender: 'M' },
      { grade: 'ม.4', rooms: [1, 2, 3, 4], gender: 'M' }
    ],
    supervisors: [
      { id: 'sup-2-1', name: 'ครูธีรพล สุจริต', phone: '082-222-3344', role: 'หัวหน้าครูหอพัก' },
      { id: 'sup-2-2', name: 'ครูวิชาญ พัฒนา', phone: '082-222-3355', role: 'ครูหอพักประจำ' }
    ],
    supervisorName: 'ครูธีรพล สุจริต',
    supervisorPhone: '082-222-3344',
    capacity: 80,
    notes: 'หอพักนักเรียนชาย ระดับชั้น ม.3 และ ม.4',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'dorm-3',
    dormNumber: 3,
    name: 'หอพัก 3 (ชาย)',
    gender: 'M',
    assignedGrades: ['ม.5', 'ม.6'],
    assignedRooms: [1, 2, 3, 4],
    assignedClassrooms: [
      { grade: 'ม.5', rooms: [1, 2, 3, 4], gender: 'M' },
      { grade: 'ม.6', rooms: [1, 2, 3, 4], gender: 'M' }
    ],
    gradeGenderRules: [
      { grade: 'ม.5', rooms: [1, 2, 3, 4], gender: 'M' },
      { grade: 'ม.6', rooms: [1, 2, 3, 4], gender: 'M' }
    ],
    supervisors: [
      { id: 'sup-3-1', name: 'ครูประดิษฐ์ มั่นคง', phone: '083-333-4455', role: 'หัวหน้าครูหอพัก' },
      { id: 'sup-3-2', name: 'ครูอภิสิทธิ์ ก้าวหน้า', phone: '083-333-4466', role: 'ครูหอพักประจำ' }
    ],
    supervisorName: 'ครูประดิษฐ์ มั่นคง',
    supervisorPhone: '083-333-4455',
    capacity: 80,
    notes: 'หอพักนักเรียนชาย ระดับชั้น ม.5 และ ม.6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'dorm-4',
    dormNumber: 4,
    name: 'หอพัก 4 (หญิง)',
    gender: 'F',
    assignedGrades: ['ม.1', 'ม.2'],
    assignedRooms: [1, 2, 3, 4],
    assignedClassrooms: [
      { grade: 'ม.1', rooms: [1, 2, 3, 4], gender: 'F' },
      { grade: 'ม.2', rooms: [1, 2, 3, 4], gender: 'F' }
    ],
    gradeGenderRules: [
      { grade: 'ม.1', rooms: [1, 2, 3, 4], gender: 'F' },
      { grade: 'ม.2', rooms: [1, 2, 3, 4], gender: 'F' }
    ],
    supervisors: [
      { id: 'sup-4-1', name: 'ครูณัฐพร รักศิษย์', phone: '084-444-5566', role: 'หัวหน้าครูหอพัก' },
      { id: 'sup-4-2', name: 'ครูวารุณี สดใส', phone: '084-444-5577', role: 'ครูหอพักประจำ' }
    ],
    supervisorName: 'ครูณัฐพร รักศิษย์',
    supervisorPhone: '084-444-5566',
    capacity: 80,
    notes: 'หอพักนักเรียนหญิง ระดับชั้น ม.1 และ ม.2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'dorm-5',
    dormNumber: 5,
    name: 'หอพัก 5 (หญิง)',
    gender: 'F',
    assignedGrades: ['ม.3', 'ม.4'],
    assignedRooms: [1, 2, 3, 4],
    assignedClassrooms: [
      { grade: 'ม.3', rooms: [1, 2, 3, 4], gender: 'F' },
      { grade: 'ม.4', rooms: [1, 2, 3, 4], gender: 'F' }
    ],
    gradeGenderRules: [
      { grade: 'ม.3', rooms: [1, 2, 3, 4], gender: 'F' },
      { grade: 'ม.4', rooms: [1, 2, 3, 4], gender: 'F' }
    ],
    supervisors: [
      { id: 'sup-5-1', name: 'ครูพิมพา สุขเกษม', phone: '085-555-6677', role: 'หัวหน้าครูหอพัก' },
      { id: 'sup-5-2', name: 'ครูนภาลัย สว่างแดน', phone: '085-555-6688', role: 'ครูหอพักประจำ' }
    ],
    supervisorName: 'ครูพิมพา สุขเกษม',
    supervisorPhone: '085-555-6677',
    capacity: 80,
    notes: 'หอพักนักเรียนหญิง ระดับชั้น ม.3 และ ม.4',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'dorm-6',
    dormNumber: 6,
    name: 'หอพัก 6 (หญิง)',
    gender: 'F',
    assignedGrades: ['ม.5', 'ม.6'],
    assignedRooms: [1, 2, 3, 4],
    assignedClassrooms: [
      { grade: 'ม.5', rooms: [1, 2, 3, 4], gender: 'F' },
      { grade: 'ม.6', rooms: [1, 2, 3, 4], gender: 'F' }
    ],
    gradeGenderRules: [
      { grade: 'ม.5', rooms: [1, 2, 3, 4], gender: 'F' },
      { grade: 'ม.6', rooms: [1, 2, 3, 4], gender: 'F' }
    ],
    supervisors: [
      { id: 'sup-6-1', name: 'ครูศิริรัตน์ กุลบุตร', phone: '086-666-7788', role: 'หัวหน้าครูหอพัก' },
      { id: 'sup-6-2', name: 'ครูอรทัย ใจงาม', phone: '086-666-7799', role: 'ครูหอพักประจำ' }
    ],
    supervisorName: 'ครูศิริรัตน์ กุลบุตร',
    supervisorPhone: '086-666-7788',
    capacity: 80,
    notes: 'หอพักนักเรียนหญิง ระดับชั้น ม.5 และ ม.6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

/**
 * ดึงเพศที่หอพักเปิดรับสำหรับระดับชั้นนั้นๆ (Grade-specific Gender)
 * เช่น หอรวม แต่ ม.1 รับ MIXED, ม.2 รับเฉพาะ F, ม.3 รับเฉพาะ F
 */
export function getDormitoryGradeGender(
  dorm: Dormitory,
  grade: GradeLevel
): DormitoryType {
  const rules = dorm.gradeGenderRules || dorm.assignedClassrooms;
  if (rules && rules.length > 0) {
    const found = rules.find(r => r.grade === grade);
    if (found && found.gender) {
      return found.gender;
    }
  }
  return dorm.gender || 'MIXED';
}

/**
 * ดึงห้องเรียนที่สังกัดในระดับชั้นนั้นๆ
 */
export function getGradeRooms(dorm: Dormitory, grade: GradeLevel): number[] {
  const rules = dorm.gradeGenderRules || dorm.assignedClassrooms;
  if (rules && rules.length > 0) {
    const found = rules.find(r => r.grade === grade);
    if (found && found.rooms && found.rooms.length > 0) {
      return found.rooms;
    }
  }
  return dorm.assignedRooms || [];
}

/**
 * ข้อความกำกับเพศที่รับสำหรับระดับชั้น
 */
export function getGradeGenderLabel(gender: DormitoryType | string): string {
  if (gender === 'MIXED' || gender === 'ALL' || gender === 'COED') {
    return 'ทั้งชายและหญิง (M/F)';
  }
  if (gender === 'M') {
    return 'เฉพาะชาย (M)';
  }
  if (gender === 'F') {
    return 'เฉพาะหญิง (F)';
  }
  return 'ทั่วไป';
}

/**
 * สรุปกฎเกณฑ์การรับนักเรียนของหอพักเป็นข้อความภาษาไทยที่อ่านง่าย
 * ตัวอย่าง: "ม.1 (ชายและหญิง), ม.2 (เฉพาะหญิง), ม.3 (เฉพาะหญิง)"
 */
export function getDormitoryRuleSummary(dorm: Dormitory): string {
  if (!dorm.assignedGrades || dorm.assignedGrades.length === 0 || dorm.assignedGrades.length === 6) {
    if (dorm.notes) return dorm.notes;
    return 'เปิดรับทุกระดับชั้น (ตามประเภทหอพัก)';
  }

  const parts = dorm.assignedGrades.map(grade => {
    const gender = getDormitoryGradeGender(dorm, grade);
    const rooms = getGradeRooms(dorm, grade);
    const roomStr = rooms.length > 0 ? ` ห้อง ${rooms.join(',')}` : '';
    
    let genderStr = 'ชาย/หญิง';
    if (gender === 'M') genderStr = 'เฉพาะชาย';
    else if (gender === 'F') genderStr = 'เฉพาะหญิง';

    return `${grade} (${genderStr}${roomStr})`;
  });

  return parts.join(', ');
}

/**
 * ตรวจสอบว่าหอพักนี้เปิดรับนักเรียนคนนี้หรือไม่
 * โดยพิจารณา:
 * 1. ระดับชั้น (grade)
 * 2. เพศที่รับเฉพาะสำหรับระดับชั้นนี้ (gender rule per grade)
 * 3. ห้องเรียน (room)
 */
export function doesDormitoryAcceptStudent(
  dorm: Dormitory,
  studentGender: StudentGender,
  grade: GradeLevel,
  room: number
): boolean {
  // 1. ตรวจสอบว่าระดับชั้นนี้สังกัดหอนี้หรือไม่
  const hasGrade =
    (dorm.assignedGrades && dorm.assignedGrades.includes(grade)) ||
    (dorm.assignedClassrooms && dorm.assignedClassrooms.some(r => r.grade === grade)) ||
    (dorm.gradeGenderRules && dorm.gradeGenderRules.some(r => r.grade === grade));

  if (!hasGrade) return false;

  // 2. ตรวจสอบเพศที่รับสำหรับระดับชั้นนี้ (สำคัญมากสำหรับกรณีหอรวมที่มีเงื่อนไขเพศตามระดับชั้น)
  const acceptedGender = getDormitoryGradeGender(dorm, grade);
  if (acceptedGender === 'MIXED' || (acceptedGender as string) === 'ALL' || (acceptedGender as string) === 'COED') {
    // หอพักรวมสำหรับระดับชั้นนี้ ยอมรับทั้งเพศชาย (M) และเพศหญิง (F)
  } else if (acceptedGender === 'M') {
    if (studentGender !== 'M') return false;
  } else if (acceptedGender === 'F') {
    if (studentGender !== 'F') return false;
  } else {
    // Fallback to top-level dorm.gender
    if (dorm.gender !== 'MIXED' && (dorm.gender as string) !== 'ALL' && dorm.gender !== studentGender) {
      return false;
    }
  }

  // 3. ตรวจสอบห้องเรียน
  const rules = dorm.gradeGenderRules || dorm.assignedClassrooms;
  if (rules && rules.length > 0) {
    const rule = rules.find(r => r.grade === grade);
    if (rule && rule.rooms && rule.rooms.length > 0) {
      return rule.rooms.includes(room);
    }
  }

  if (dorm.assignedRooms && dorm.assignedRooms.length > 0) {
    return dorm.assignedRooms.includes(room);
  }

  return true;
}

/**
 * ระบุเพศนักเรียน (M หรือ F) จากข้อมูลที่มี หรือวิเคราะห์จากคำนำหน้าชื่อ
 */
export function inferStudentGender(student: Partial<Student>): StudentGender {
  if (student.gender === 'M' || student.gender === 'F') {
    return student.gender;
  }

  const title = (student.title || '').trim().toLowerCase();

  // เพศหญิง (F)
  if (
    title.includes('หญิง') ||
    title.includes('นางสาว') ||
    title.includes('นาง') ||
    title.startsWith('ด.ญ') ||
    title.startsWith('น.ส') ||
    title === 'f' ||
    title === 'female'
  ) {
    return 'F';
  }

  // เพศชาย (M)
  if (
    title.includes('ชาย') ||
    title.includes('นาย') ||
    title.startsWith('ด.ช') ||
    title === 'm' ||
    title === 'male'
  ) {
    return 'M';
  }

  // Fallback defaults to 'M'
  return 'M';
}

/**
 * ตรวจสอบว่าหอพักนี้ตรงกับระดับชั้น ห้อง และเพศที่ระบุหรือไม่
 */
export function isClassroomAssignedToDorm(
  dorm: Dormitory,
  grade: GradeLevel,
  room: number,
  gender?: StudentGender
): boolean {
  if (gender) {
    return doesDormitoryAcceptStudent(dorm, gender, grade, room);
  }

  // 1. ตรวจสอบจาก assignedClassrooms / gradeGenderRules (กฎละเอียด) ถ้ามี
  const rules = dorm.gradeGenderRules || dorm.assignedClassrooms;
  if (rules && rules.length > 0) {
    const rule = rules.find(r => r.grade === grade);
    if (rule) {
      if (!rule.rooms || rule.rooms.length === 0) return true; // ทุกห้องในระดับชั้นนี้
      return rule.rooms.includes(room);
    }
  }

  // 2. ตรวจสอบจาก assignedGrades และ assignedRooms ทั่วไป
  if (dorm.assignedGrades && dorm.assignedGrades.includes(grade)) {
    if (!dorm.assignedRooms || dorm.assignedRooms.length === 0) return true;
    return dorm.assignedRooms.includes(room);
  }

  return false;
}

/**
 * ค้นหาหอพักที่ตรงกับนักเรียน โดยอ้างอิงจาก เพศ ระดับชั้น และห้อง
 * รองรับการกำหนดเพศแยกตามระดับชั้น (เช่น ม.1 ทั้งชายและหญิง, ม.2 เฉพาะหญิง, ม.3 เฉพาะหญิง)
 */
export function matchStudentToDormitory(
  student: Student,
  dormitories: Dormitory[],
  currentAcademicYear: number
): {
  dormitory: Dormitory | null;
  gender: StudentGender;
  grade: GradeLevel;
  room: number;
  reason?: string;
} {
  const gender = inferStudentGender(student);
  const { grade } = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);
  const room = Number(student.room) || 1;

  // กรองเฉพาะหอพักที่ยอมรับนักเรียนคนนี้ ทั้งระดับชั้น เพศสำหรับระดับชั้นนี้ และห้อง
  const candidateDorms = dormitories
    .filter(dorm => doesDormitoryAcceptStudent(dorm, gender, grade, room))
    .sort((a, b) => {
      // ตรวจสอบความเจาะจงของเพศในระดับชั้นนี้
      const aGradeGender = getDormitoryGradeGender(a, grade);
      const bGradeGender = getDormitoryGradeGender(b, grade);

      const aIsSpecific = aGradeGender === gender;
      const bIsSpecific = bGradeGender === gender;

      // ถ้าหอใดระบุรับเพศนี้โดยตรง (M หรือ F) ให้ได้ความสำคัญก่อนหอรวม (MIXED)
      if (aIsSpecific && !bIsSpecific) return -1;
      if (!aIsSpecific && bIsSpecific) return 1;

      // ถ้าความเจาะจงเท่ากัน ให้เรียงตามลำดับหอพัก (dormNumber)
      return a.dormNumber - b.dormNumber;
    });

  if (candidateDorms.length > 0) {
    return {
      dormitory: candidateDorms[0],
      gender,
      grade,
      room
    };
  }

  // ตรวจสอบว่าในระบบมีหอพักใดเปิดรับระดับชั้นนี้หรือไม่ เพื่อให้เหตุผลที่ชัดเจน
  const hasGradeDorm = dormitories.some(
    d =>
      (d.assignedGrades && d.assignedGrades.includes(grade)) ||
      (d.assignedClassrooms && d.assignedClassrooms.some(r => r.grade === grade))
  );

  let reason = `ไม่มีหอพักที่เปิดรับเพศ ${gender === 'M' ? 'ชาย (M)' : 'หญิง (F)'} สำหรับระดับชั้น ${grade} ห้อง ${room}`;
  if (!hasGradeDorm) {
    reason = `ยังไม่มีหอพักใดเปิดรับนักเรียนระดับชั้น ${grade}`;
  }

  return {
    dormitory: null,
    gender,
    grade,
    room,
    reason
  };
}

/**
 * ผูกนักเรียนคนเดียวกับหอพัก
 */
export function linkStudentToDormitory(
  student: Student,
  dormitories: Dormitory[],
  currentAcademicYear: number
): Student {
  const match = matchStudentToDormitory(student, dormitories, currentAcademicYear);
  if (match.dormitory) {
    return {
      ...student,
      gender: match.gender,
      dormitoryId: match.dormitory.id,
      dormitoryName: match.dormitory.name
    };
  }
  return {
    ...student,
    gender: match.gender,
    dormitoryId: undefined,
    dormitoryName: undefined
  };
}

/**
 * ประมวลผลและผูกนักเรียนทั้งหมดกับหอพัก 1 - 6
 * คืนค่ารายการนักเรียนที่อัปเดตแล้ว สถิติจำนวนที่จัดหอได้ และรายชื่อที่ยังไม่เข้าเกณฑ์หอใด
 */
export function syncAllStudentsWithDormitories(
  students: Student[],
  dormitories: Dormitory[],
  currentAcademicYear: number
): {
  updatedStudents: Student[];
  assignedCount: number;
  unassignedCount: number;
  countsByDorm: Record<string, number>;
  unassignedList: {
    student: Student;
    gender: StudentGender;
    grade: GradeLevel;
    room: number;
    reason: string;
  }[];
} {
  const countsByDorm: Record<string, number> = {};
  dormitories.forEach(d => {
    countsByDorm[d.id] = 0;
  });

  const unassignedList: {
    student: Student;
    gender: StudentGender;
    grade: GradeLevel;
    room: number;
    reason: string;
  }[] = [];

  const updatedStudents = students.map(st => {
    // ข้ามหรือยังจัดให้นักเรียนที่จบการศึกษาแล้วได้ตามต้องการ แต่สำหรับนักเรียนทั่วไป:
    const match = matchStudentToDormitory(st, dormitories, currentAcademicYear);
    if (match.dormitory) {
      countsByDorm[match.dormitory.id] = (countsByDorm[match.dormitory.id] || 0) + 1;
      return {
        ...st,
        gender: match.gender,
        dormitoryId: match.dormitory.id,
        dormitoryName: match.dormitory.name
      };
    } else {
      unassignedList.push({
        student: st,
        gender: match.gender,
        grade: match.grade,
        room: match.room,
        reason: match.reason || 'ไม่ตรงกับเงื่อนไขหอพักใด'
      });
      return {
        ...st,
        gender: match.gender,
        dormitoryId: undefined,
        dormitoryName: undefined
      };
    }
  });

  const assignedCount = updatedStudents.filter(s => !!s.dormitoryId).length;
  const unassignedCount = unassignedList.length;

  return {
    updatedStudents,
    assignedCount,
    unassignedCount,
    countsByDorm,
    unassignedList
  };
}
