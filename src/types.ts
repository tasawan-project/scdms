export type UserRole = 'admin' | 'staff' | 'teacher' | 'student';

export interface AppUser {
  id: string; // username or unique uid
  username: string;
  password?: string;
  name: string;
  role: 'admin' | 'staff' | 'teacher';
  department?: string; // กลุ่มสาระฯ / ฝ่ายงาน
  email?: string;
  phone?: string;
  isActive: boolean;
  isSuperAdmin?: boolean; // สิทธิ์ผู้ดูแลหลัก (Super Admin)
  createdAt: string;
  lastLoginAt?: string;
}

export interface StudentAccessGrant {
  id: string;
  studentId: string; // รหัสนักเรียนที่ได้รับอนุญาต
  studentName: string;
  grantedByUserId: string; // ผู้ให้สิทธิ์ (username)
  grantedByUserName: string; // ชื่อครู/เจ้าหน้าที่ผู้อนุญาต
  grantedByUserRole: 'admin' | 'staff' | 'teacher';
  grantedAt: string; // ISO string
  expiresAt?: string; // ISO string (optional)
  isActive: boolean;
  reason?: string; // เช่น "ขอตรวจคะแนนเพื่อประเมินตนเอง", "เข้าพบครูที่ปรึกษา"
  notes?: string;
}

export type EducationalLevel = 'JUNIOR' | 'SENIOR'; // มัธยมตอนต้น | มัธยมตอนปลาย

export type LevelCode = 'M' | 'P' | 'F'; // M = มัธยมศึกษาตอนต้น (ม.1-ม.3), P/F = มัธยมศึกษาตอนปลาย (ม.4-ม.6)

export type GradeLevel = 'ม.1' | 'ม.2' | 'ม.3' | 'ม.4' | 'ม.5' | 'ม.6';

export type EntryLevel = 'ม.1' | 'ม.4';

export type AppView =
  | 'HOME'
  | 'DASHBOARD'
  | 'LOOKUP'
  | 'ADVISORS'
  | 'HONOUR'
  | 'STUDENT_LIST'
  | 'IMPORT'
  | 'IMPORT_CONDUCT'
  | 'PHOTOS'
  | 'YEAR_CYCLE'
  | 'CRITICAL_ALERT'
  | 'SETTINGS'
  | 'SETTINGS_BRANDING'
  | 'SETTINGS_BEHAVIORS'
  | 'SETTINGS_USERS'
  | 'SETTINGS_DATABASE'
  | 'SETTINGS_GRANTS'
  | 'SETTINGS_MENU_PERMISSIONS';

export type ConductType = 'DEDUCT' | 'ADD'; // หักคะแนน หรือ เพิ่มคะแนน

export interface ConductLog {
  id: string;
  studentId: string; // รหัสนักเรียน
  type: ConductType;
  points: number; // จำนวนคะแนนที่ระบุในการบันทึก
  appliedToScore: number; // คะแนนที่นำไปหัก/เพิ่มเข้ากับคะแนนปัจจุบันจริง
  bankedPointsDelta: number; // คะแนนที่เข้า/ออกจากคะแนนสะสมสำรอง
  reason: string; // เหตุผล/รายละเอียดพฤติกรรม/กิจกรรม
  category: string; // หมวดหมู่ เช่น การเข้าเรียนและวินัย, จิตอาสา, การแต่งกาย
  violationDate?: string; // วันที่กระทำผิด / วันที่เกิดเหตุ หรือวันที่ทำกิจกรรม (YYYY-MM-DD หรือ ISO)
  recordedBy: string; // ผู้บันทึก (ชื่ออาจารย์)
  recordedByName?: string; // ชื่อผู้บันทึกแสดงผล
  recordedByRole?: UserRole; // บทบาทผู้บันทึก
  recordedAt: string; // ISO string วันที่บันทึก
  academicYear: number; // ปีการศึกษา เช่น 2569
  term: number; // ภาคเรียน (1 หรือ 2)
  scoreBefore?: number; // คะแนนคงเหลือก่อนทำรายการ
  bankedBefore?: number; // คะแนนสำรองก่อนทำรายการ
  scoreAfter?: number; // คะแนนคงเหลือหลังทำรายการ
  bankedAfter?: number; // คะแนนสำรองหลังทำรายการ
  notes?: string; // หมายเหตุเพิ่มเติม
}

/**
 * หัวข้อหรือพฤติกรรมมาตรฐานที่บันทึกในฐานข้อมูล (Firestore)
 */
export interface StandardConductBehavior {
  id: string; // ID เอกสารใน Firestore
  title: string; // หัวข้อหรือชื่อพฤติกรรมมาตรฐาน เช่น "มาสาย / ไม่เข้าแถว"
  type: ConductType; // 'DEDUCT' (หักคะแนน) หรือ 'ADD' (เพิ่มคะแนน)
  points: number; // จำนวนคะแนน เช่น 5, 10, 15
  category: string; // หมวดหมู่ เช่น "การเข้าเรียนและวินัย", "จิตอาสา"
  description: string; // รายละเอียดพฤติกรรม
  isActive?: boolean; // สถานะเปิดใช้งาน
  createdAt?: string;
  updatedAt?: string;
}

export interface Student {
  id: string; // รหัสนักเรียน เช่น "05505"
  nationalId?: string; // เลขประจำตัวประชาชน (ถ้ามี)
  title: string; // นาย, นางสาว, เด็กชาย, เด็กหญิง
  firstName: string;
  lastName: string;
  entryYear: number; // ปีที่เข้าศึกษา เช่น 2568
  entryLevel: EntryLevel; // ระดับที่เข้าเรียน: 'ม.1' หรือ 'ม.4'
  levelCode?: LevelCode; // รหัสระดับ: 'M' (ม.ต้น ม.1-ม.3) หรือ 'F' (ม.ปลาย ม.4-ม.6)
  room: number; // ห้อง เช่น 1, 2, 3
  number?: number; // เลขที่
  
  // สถานะคะแนน
  currentScore: number; // คะแนนปัจจุบัน (เริ่มต้น 100, สูงสุด 100)
  bankedPoints: number; // คะแนนสะสมสำรอง (เมื่อเพิ่มคะแนนเกิน 100 หรือสะสมไว้ใช้หักคราวหน้า)
  totalDeductionsCount: number; // จำนวนครั้งที่เคยโดนหัก
  totalDeductedPoints: number; // คะแนนรวมที่เคยโดนหัก
  totalAddedPoints: number; // คะแนนรวมที่เคยได้รับเพิ่ม
  hasNeverBeenDeducted: boolean; // ไม่เคยมีประวัติการโดนหักคะแนนเลยหรือไม่

  // ข้อมูลติดต่อ
  phone?: string;
  guardianPhone?: string;
  guardianName?: string;
  advisorName?: string; // ครูที่ปรึกษา
  
  // รูปภาพ
  photoUrl?: string; // URL รูปถ่ายนักเรียน
  
  // สถานะนักเรียน
  status: 'ACTIVE' | 'GRADUATED' | 'TRANSFERRED';
  isSampleData?: boolean; // Flag to identify initial sample/mock student
  graduatedYear?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuAccessRule {
  allowedRoles: ('admin' | 'staff' | 'teacher' | 'student')[];
  allowGuest?: boolean;
  enabled: boolean;
}

export type MenuPermissionsMap = Record<string, MenuAccessRule>;

export interface SystemSettings {
  schoolNameTh: string;
  schoolNameEn: string;
  appNameTh: string;
  appNameEn: string;
  logoUrl?: string; // Base64 or URL
  currentAcademicYear: number; // เช่น 2569
  currentTerm: number; // 1 หรือ 2

  // บังคับให้ต้องเข้าสู่ระบบก่อนเข้าใช้งาน
  requireLoginBeforeAccess?: boolean;

  // สิทธิ์การเข้าถึงเมนูต่าง ๆ ในระบบ (ควบคุมโดยผู้ดูแลหลัก)
  menuPermissions?: MenuPermissionsMap;

  // เกณฑ์คะแนนความประพฤติและเพดานคะแนนสะสม
  criticalScoreThreshold: number; // วิกฤต: เช่น 70 (หักสะสม 70 แต้ม หรือเหลือ 30)
  watchScoreThreshold: number;    // เฝ้าระวัง: เช่น 30 (หักสะสม 30 แต้ม หรือเหลือ 70)
  cautionScoreThreshold: number;  // ตักเตือน: เช่น 20 (หักสะสม 20 แต้ม หรือเหลือ 80)
  maxBankedPointsCap: number;     // ยอดเยี่ยม: เพดานคะแนนสะสมสูงสุดที่นักเรียนเก็บได้ เช่น 50 แต้ม (0 = ไม่จำกัด)

  // Compatibility fields
  warningScoreThreshold?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  schoolName?: string;
}

export type ScoreCategoryType =
  | 'CRITICAL'    // วิกฤต: หักคะแนนเกิน 50 คะแนนขึ้นไป (เหลือ ≤ 50)
  | 'WATCH'       // เฝ้าระวัง: หักคะแนนเกิน 30 คะแนนขึ้นไป (เหลือ 51 - 70)
  | 'CAUTION'     // ตักเตือน: หักคะแนนไม่เกิน 29 คะแนน (เหลือ 71 - 99)
  | 'NORMAL'      // ปกติ: มีคะแนนเต็ม 100 คะแนน
  | 'OUTSTANDING' // ดีเด่น: มีคะแนนเกิน 100 คะแนน
  | 'EXCELLENT';  // ยอดเยี่ยม: มีคะแนนเกิน 100 คะแนนและไม่เคยโดนหักคะแนนเลยในรอบ 3 ปี

export type ScoreFilterType = 'ALL' | ScoreCategoryType;

export interface ScoreCategoryInfo {
  type: ScoreCategoryType;
  label: string;
  shortLabel: string;
  badgeClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  description: string;
}

export interface OutstandingSummary {
  junior: Student[]; // ม.ต้น ที่คะแนน >= 100 และไม่เคยโดนหัก
  senior: Student[]; // ม.ปลาย ที่คะแนน >= 100 และไม่เคยโดนหัก
}

export interface FilterOptions {
  searchQuery: string;
  level: 'ALL' | EducationalLevel;
  grade: 'ALL' | GradeLevel;
  room: 'ALL' | number;
  classroom: 'ALL' | string; // เช่น 'ม.1/1', 'ม.2/3'
  scoreStatus: ScoreFilterType;
  sortBy: keyof Student | 'calculatedGrade' | 'totalConductScore';
  sortDirection: 'asc' | 'desc';
}

export interface HomeroomAdvisor {
  id: string; // รหัสอ้างอิง เช่น adv_2569_m1_1_01 หรือ uid
  prefix?: string; // คำนำหน้า เช่น นาย, นาง, นางสาว, ดร., ว่าที่ร้อยตรี
  firstName: string; // ชื่อ
  lastName: string; // สกุล
  fullName: string; // ชื่อ-นามสกุล เต็ม เช่น "ครูสมพร สอนดี" หรือ "นายสมพร สอนดี"
  gradeLevel: GradeLevel; // 'ม.1' | 'ม.2' | 'ม.3' | 'ม.4' | 'ม.5' | 'ม.6'
  room: number; // ห้อง เช่น 1, 2, 3
  classroom: string; // เช่น 'ม.1/1', 'ม.2/3'
  academicYear: number; // ปีการศึกษา เช่น 2569
  advisorOrder?: number; // ลำดับครูที่ปรึกษาในห้อง เช่น 1 (ครูที่ปรึกษาคนที่ 1), 2 (ครูที่ปรึกษาคนที่ 2)
  phone?: string; // เบอร์โทรศัพท์ เช่น 081-234-5678
  email?: string; // อีเมล
  department?: string; // กลุ่มสาระการเรียนรู้ เช่น ภาษาไทย, สังคมศึกษา, ฯลฯ
  notes?: string; // หมายเหตุ
  isSampleData?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const ACADEMIC_DEPARTMENTS = [
  'ภาษาไทย',
  'สังคมศึกษา',
  'พลศึกษา',
  'ศิลปะศึกษา',
  'วิทยาศาสตร์และเทคโนโลยี',
  'การงานอาชีพ',
  'คณิตศาสตร์',
  'ภาษาต่างประเทศ',
  'อื่นๆ'
] as const;

export type AcademicDepartment = typeof ACADEMIC_DEPARTMENTS[number];

export interface ClassroomAdvisorGroup {
  classroom: string; // e.g. "ม.1/1"
  gradeLevel: GradeLevel;
  room: number;
  advisors: HomeroomAdvisor[];
  studentCount: number;
  students: Student[];
  averageConductScore: number;
  criticalCount: number;
  watchCount: number;
}


