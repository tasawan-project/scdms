import { AppUser, AppView, StudentAccessGrant, MenuAccessRule, MenuPermissionsMap } from '../types';

/**
 * ตรวจสอบว่าเป็น "ผู้ดูแลหลัก" (Super Admin) หรือไม่
 * ตามข้อกำหนด: ผู้ดูแลหลักคือบัญชี admin หรือบัญชีที่มีบทบาท admin และตั้งค่า isSuperAdmin
 */
export function isSuperAdmin(user: AppUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role !== 'admin') return false;
  return (
    user.username?.toLowerCase() === 'admin' ||
    user.id === 'admin' ||
    user.id === 'usr-admin-01' ||
    user.isSuperAdmin === true
  );
}

/**
 * ลำดับขั้นสิทธิ์ของผู้ใช้งานในระบบ (Role Privilege Level):
 * - ระดับ 4: ผู้ดูแลหลัก (Super Admin)
 * - ระดับ 3: ผู้ดูแลระบบทั่วไป (Admin)
 * - ระดับ 2: เจ้าหน้าที่ฝ่ายกิจการนักเรียน/ปกครอง (Staff)
 * - ระดับ 1: ครูผู้สอน/ครูที่ปรึกษา (Teacher)
 * - ระดับ 0: นักเรียน / บุคคลทั่วไป (Student/Guest)
 */
export function getUserRoleLevel(user: AppUser | null | undefined): number {
  if (!user) return 0;
  if (isSuperAdmin(user)) return 4;
  if (user.role === 'admin') return 3;
  if (user.role === 'staff') return 2;
  if (user.role === 'teacher') return 1;
  return 0;
}

/**
 * ดึงระดับตัวเลขตามบทบาท
 */
export function getRoleLevelByRoleName(
  role: 'admin' | 'staff' | 'teacher' | 'student' | string,
  isSuper: boolean = false
): number {
  if (role === 'admin') return isSuper ? 4 : 3;
  if (role === 'staff') return 2;
  if (role === 'teacher') return 1;
  return 0;
}

/**
 * ดึงข้อมูลการแสดงผลระดับสิทธิ์ (ชื่อภาษาไทย, สี Badge, ไอคอน, คำอธิบาย)
 */
export function getRoleDisplayInfo(
  user: AppUser | { role: string; isSuperAdmin?: boolean; username?: string; id?: string } | null | undefined
): {
  level: number;
  levelName: string;
  title: string;
  shortTitle: string;
  badgeClass: string;
  borderClass: string;
  icon: string;
  description: string;
} {
  if (!user) {
    return {
      level: 0,
      levelName: 'ระดับ 0',
      title: 'นักเรียน / ผู้ใช้ทั่วไป',
      shortTitle: 'นักเรียน',
      badgeClass: 'bg-slate-100 text-slate-700',
      borderClass: 'border-slate-200',
      icon: '👤',
      description: 'ไม่มีสิทธิ์ในการจัดการผู้ใช้'
    };
  }

  const isSuper =
    'username' in user && user.username
      ? isSuperAdmin(user as AppUser)
      : !!user.isSuperAdmin;

  if (user.role === 'admin' && isSuper) {
    return {
      level: 4,
      levelName: 'ระดับ 4 (สูงสุด)',
      title: 'ผู้ดูแลระบบสูงสุด (Super Admin)',
      shortTitle: 'Super Admin',
      badgeClass: 'bg-purple-100 text-purple-900 border border-purple-300',
      borderClass: 'border-purple-200',
      icon: '👑',
      description: 'สามารถจัดการ Admin, Staff, และ Teacher ได้ทั้งหมด'
    };
  }
  if (user.role === 'admin') {
    return {
      level: 3,
      levelName: 'ระดับ 3',
      title: 'ผู้ดูแลระบบ (Admin)',
      shortTitle: 'Admin',
      badgeClass: 'bg-rose-100 text-rose-900 border border-rose-300',
      borderClass: 'border-rose-200',
      icon: '🛡️',
      description: 'สามารถจัดการสิทธิ์ Staff และ Teacher ได้ (ไม่สามารถจัดการ Admin หรือ Super Admin)'
    };
  }
  if (user.role === 'staff') {
    return {
      level: 2,
      levelName: 'ระดับ 2',
      title: 'เจ้าหน้าที่ฝ่ายปกครอง/กิจการ (Staff)',
      shortTitle: 'Staff',
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
      borderClass: 'border-amber-200',
      icon: '💼',
      description: 'สามารถจัดการสิทธิ์ Teacher ได้ (ไม่สามารถจัดการ Staff, Admin, หรือ Super Admin)'
    };
  }
  if (user.role === 'teacher') {
    return {
      level: 1,
      levelName: 'ระดับ 1',
      title: 'ครูผู้สอน / ครูที่ปรึกษา (Teacher)',
      shortTitle: 'Teacher',
      badgeClass: 'bg-indigo-100 text-indigo-900 border border-indigo-300',
      borderClass: 'border-indigo-200',
      icon: '👨‍🏫',
      description: 'ดูคะแนนและความประพฤตินักเรียนได้ทุกคน (โหมดดูได้อย่างเดียว ไม่สามารถเพิ่มหรือตัด/ลบคะแนนได้)'
    };
  }

  return {
    level: 0,
    levelName: 'ระดับ 0',
    title: 'ผู้ใช้งานทั่วไป',
    shortTitle: 'ทั่วไป',
    badgeClass: 'bg-slate-100 text-slate-700',
    borderClass: 'border-slate-200',
    icon: '👤',
    description: 'ไม่มีสิทธิ์ในการจัดการผู้ใช้'
  };
}

/**
 * เงื่อนไขหลัก: "ให้ผู้ใช้ สามารถจัดการสิทธิ์ได้เฉพาะผู้ที่มีสิทธิ์ต่ำกว่า"
 * - ตรวจสอบว่า currentUser มีสิทธิ์จัดการ (แก้ไข, เปลี่ยนสิทธิ์, ลบ) targetUser หรือไม่
 * - เงื่อนไขคือ currentUserLevel > targetUserLevel เท่านั้น (ต้องต่ำกว่าอย่างเคร่งครัด)
 */
export function canManageTargetUser(
  currentUser: AppUser | null | undefined,
  targetUser: AppUser | null | undefined
): boolean {
  if (!currentUser || !targetUser) return false;

  // บัญชีตนเอง: การแก้ไขตนเองทำผ่าน self-profile (ไม่อนุญาตให้เปลี่ยนระดับสิทธิ์ตนเอง)
  if (
    currentUser.id === targetUser.id ||
    currentUser.username?.toLowerCase() === targetUser.username?.toLowerCase()
  ) {
    return false;
  }

  const currentLevel = getUserRoleLevel(currentUser);
  const targetLevel = getUserRoleLevel(targetUser);

  // ผู้ใช้สามารถจัดการได้ "เฉพาะผู้ที่มีสิทธิ์ต่ำกว่าตนเองเท่านั้น" (currentLevel > targetLevel)
  return currentLevel > targetLevel;
}

/**
 * ตรวจสอบว่า currentUser สามารถลบ targetUser ได้หรือไม่
 * - ต้องมีสิทธิ์จัดการ (currentLevel > targetLevel)
 * - ห้ามลบบัญชี admin หลักของระบบ (id/username === 'admin')
 * - ห้ามลบบัญชีของตนเอง
 */
export function canDeleteTargetUser(
  currentUser: AppUser | null | undefined,
  targetUser: AppUser | null | undefined
): boolean {
  if (!currentUser || !targetUser) return false;
  if (targetUser.id === 'admin' || targetUser.username?.toLowerCase() === 'admin') {
    return false;
  }
  if (
    currentUser.id === targetUser.id ||
    currentUser.username?.toLowerCase() === targetUser.username?.toLowerCase()
  ) {
    return false;
  }
  return canManageTargetUser(currentUser, targetUser);
}

/**
 * รายการบทบาทที่ currentUser ได้รับอนุญาตให้สร้างหรือมอบหมายให้ผู้อื่นได้
 * กฎ: สามารถมอบหมายได้เฉพาะบทบาทที่มีระดับสิทธิ์ "ต่ำกว่า" ตนเองเท่านั้น!
 */
export function getAllowedAssignableRoles(currentUser: AppUser | null | undefined): {
  role: 'teacher' | 'staff' | 'admin';
  label: string;
  level: number;
  icon: string;
  description: string;
}[] {
  const currentLevel = getUserRoleLevel(currentUser);
  const options: {
    role: 'teacher' | 'staff' | 'admin';
    label: string;
    level: number;
    icon: string;
    description: string;
  }[] = [];

  // ระดับ 1: Teacher (level 1) - ต้องการ currentLevel > 1 (Staff, Admin, Super Admin สามารถกำหนดได้)
  if (currentLevel > 1) {
    options.push({
      role: 'teacher',
      label: 'ครูผู้สอน / ครูที่ปรึกษา (Teacher - ระดับ 1)',
      level: 1,
      icon: '👨‍🏫',
      description: 'ดูคะแนนนักเรียนได้ทุกคน (โหมดดูได้อย่างเดียว ไม่สามารถเพิ่มหรือตัดคะแนนพฤติกรรมได้)'
    });
  }

  // ระดับ 2: Staff (level 2) - ต้องการ currentLevel > 2 (Admin, Super Admin สามารถกำหนดได้)
  if (currentLevel > 2) {
    options.push({
      role: 'staff',
      label: 'เจ้าหน้าที่ฝ่ายปกครอง/กิจการ (Staff - ระดับ 2)',
      level: 2,
      icon: '💼',
      description: 'หัก/เพิ่มคะแนนความประพฤติ และจัดการผู้ใช้ระดับครู'
    });
  }

  // ระดับ 3: Admin (level 3) - ต้องการ currentLevel > 3 (เฉพาะ Super Admin เท่านั้นที่สามารถกำหนดได้)
  if (currentLevel > 3) {
    options.push({
      role: 'admin',
      label: 'ผู้ดูแลระบบ (Admin - ระดับ 3)',
      level: 3,
      icon: '👑',
      description: 'จัดการระบบ ฐานข้อมูล และจัดการผู้ใช้ระดับ Staff และ Teacher'
    });
  }

  return options;
}

/**
 * ตรวจสอบสิทธิ์การแก้ไขรหัสผ่าน
 * ข้อกำหนด: "ให้ผู้ใช้ สามารถจัดการสิทธิ์ได้เฉพาะผู้ที่มีสิทธิ์ต่ำกว่า" (และตนเองสามารถเปลี่ยนรหัสผ่านตนเองได้)
 * - เจ้าของบัญชี (Self): สามารถเปลี่ยนรหัสผ่านของตนเองได้
 * - ผู้ดูแลสิทธิ์สูงกว่า: สามารถรีเซ็ตรหัสผ่านให้แก่ผู้ใช้งานที่มีระดับสิทธิ์ต่ำกว่าตนเองได้
 * - ผู้มีสิทธิ์เท่ากันหรือต่ำกว่า: ไม่มีสิทธิ์แก้ไขรหัสผ่านของผู้ที่มีสิทธิ์เท่ากันหรือสูงกว่า
 */
export function canEditUserPassword(
  currentUser: AppUser | null | undefined,
  targetUser: AppUser | null | undefined
): boolean {
  if (!currentUser || !targetUser) return false;

  // 1. เจ้าของบัญชีสามารถเปลี่ยนรหัสผ่านของตนเองได้
  if (
    currentUser.id === targetUser.id ||
    currentUser.username?.toLowerCase() === targetUser.username?.toLowerCase()
  ) {
    return true;
  }

  // 2. ผู้ใช้สามารถรีเซ็ตรหัสผ่านให้แก่ผู้ที่มีสิทธิ์ต่ำกว่าตนเองได้
  return canManageTargetUser(currentUser, targetUser);
}

export interface MenuItemDefinition {
  key: AppView;
  title: string;
  shortTitle: string;
  category: 'CORE' | 'STUDENT_MGMT' | 'SETTINGS';
  categoryName: string;
  description: string;
  defaultRoles: ('admin' | 'staff' | 'teacher' | 'student')[];
  defaultAllowGuest: boolean;
  defaultEnabled: boolean;
  isSuperAdminOnly?: boolean; // บังคับให้เฉพาะผู้ดูแลหลักเท่านั้น เช่น จัดการสิทธิ์เข้าถึงเมนู
  iconName: string;
}

export const ALL_MENU_DEFINITIONS: MenuItemDefinition[] = [
  // หมวดที่ 1: เมนูหลัก (CORE)
  {
    key: 'HOME',
    title: 'หน้าแรก (พอร์ทัล)',
    shortTitle: 'หน้าแรก',
    category: 'CORE',
    categoryName: 'เมนูหลัก',
    description: 'หน้าหลักระบบ ข้อมูลประชาสัมพันธ์เบื้องต้น และช่องทางเข้าใช้งาน',
    defaultRoles: ['admin', 'staff', 'teacher', 'student'],
    defaultAllowGuest: true,
    defaultEnabled: true,
    iconName: 'School'
  },
  {
    key: 'DASHBOARD',
    title: 'ภาพรวมคะแนน (แดชบอร์ด)',
    shortTitle: 'ภาพรวมคะแนน',
    category: 'CORE',
    categoryName: 'เมนูหลัก',
    description: 'สถิติภาพรวมคะแนน กราฟแนวโน้ม และรายงานสถานะความประพฤตินักเรียน',
    defaultRoles: ['admin', 'staff', 'teacher'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'LayoutDashboard'
  },
  {
    key: 'CHECK_SCORE',
    title: 'ตรวจสอบคะแนนนักเรียน',
    shortTitle: 'ตรวจสอบคะแนน',
    category: 'CORE',
    categoryName: 'เมนูหลัก',
    description: 'ระบบสืบค้นและตรวจสอบคะแนนความประพฤตินักเรียน พร้อมระบบอนุญาตแบบคลิกเดียวให้นักเรียนทุกคนดูคะแนนตัวเองได้ (สิทธิ์เฉพาะผู้ดูแลและเจ้าหน้าที่)',
    defaultRoles: ['admin', 'staff', 'teacher', 'student'],
    defaultAllowGuest: true,
    defaultEnabled: true,
    iconName: 'ClipboardCheck'
  },
  {
    key: 'LOOKUP',
    title: 'ค้นหาและดูคะแนนนักเรียน',
    shortTitle: 'ค้นหานักเรียน',
    category: 'CORE',
    categoryName: 'เมนูหลัก',
    description: 'ค้นหาประวัติคะแนน รายการตัด/เพิ่มคะแนน และดูรายละเอียดนักเรียนรายบุคคล',
    defaultRoles: ['admin', 'staff', 'teacher', 'student'],
    defaultAllowGuest: true,
    defaultEnabled: true,
    iconName: 'Search'
  },
  {
    key: 'ADVISORS',
    title: 'ครูที่ปรึกษาประจำห้องเรียน',
    shortTitle: 'ครูที่ปรึกษา',
    category: 'CORE',
    categoryName: 'เมนูหลัก',
    description: 'โครงสร้างครูที่ปรึกษาประจำชั้น ม.1-ม.6 และการซิงค์ข้อมูลกับนักเรียน',
    defaultRoles: ['admin', 'staff', 'teacher'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'Users'
  },
  {
    key: 'HONOUR',
    title: 'ทำเนียบ 100+ (เกียรติยศ)',
    shortTitle: 'ทำเนียบ 100+',
    category: 'CORE',
    categoryName: 'เมนูหลัก',
    description: 'ทำเนียบนักเรียนความประพฤติดีเด่นและยอดเยี่ยมที่มีคะแนนสะสม 100 ขึ้นไป',
    defaultRoles: ['admin', 'staff', 'teacher', 'student'],
    defaultAllowGuest: true,
    defaultEnabled: true,
    iconName: 'Award'
  },
  {
    key: 'REPORTS',
    title: 'รายงานความประพฤติ',
    shortTitle: 'รายงานความประพฤติ',
    category: 'CORE',
    categoryName: 'เมนูหลัก',
    description: 'รายงานและพิมพ์เอกสารคะแนนความประพฤติ รายบุคคล ระดับชั้น นักเรียน 100 คะแนน ดีเด่น 100+ และประวัติเพิ่ม/หักคะแนน',
    defaultRoles: ['admin', 'staff', 'teacher'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'Printer'
  },
  {
    key: 'CRITICAL_ALERT',
    title: 'แจ้งเตือนกลุ่มวิกฤต (≤ 50 คะแนน)',
    shortTitle: 'กลุ่มวิกฤต',
    category: 'CORE',
    categoryName: 'เมนูหลัก',
    description: 'ระบบเฝ้าระวังและติดตามนักเรียนที่มีคะแนนพฤติกรรมลดลงสู่เกณฑ์วิกฤต',
    defaultRoles: ['admin', 'staff', 'teacher'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'AlertOctagon'
  },

  // หมวดที่ 2: จัดการนักเรียน (STUDENT_MGMT)
  {
    key: 'STUDENT_LIST',
    title: 'จัดการรายชื่อนักเรียน',
    shortTitle: 'รายชื่อนักเรียน',
    category: 'STUDENT_MGMT',
    categoryName: 'จัดการนักเรียน',
    description: 'ดูรายชื่อนักเรียนทั้งหมด แก้ไขข้อมูล เพิ่ม ลบ และจัดกลุ่มนักเรียน',
    defaultRoles: ['admin', 'staff'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'GraduationCap'
  },
  {
    key: 'DORMITORIES',
    title: 'จัดการหอพักนักเรียน',
    shortTitle: 'จัดการหอพัก',
    category: 'STUDENT_MGMT',
    categoryName: 'จัดการนักเรียน',
    description: 'จัดการหอพัก 3 ประเภท (หอรวม, หอชาย, หอหญิง) ครูผู้ดูแล และผูกนักเรียนกับหอพักอัตโนมัติ',
    defaultRoles: ['admin', 'staff', 'teacher'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'Building2'
  },
  {
    key: 'DORMITORY_STUDENTS',
    title: 'รายชื่อนักเรียนในหอพัก',
    shortTitle: 'รายชื่อในหอพัก',
    category: 'STUDENT_MGMT',
    categoryName: 'จัดการนักเรียน',
    description: 'ดูรายชื่อนักเรียนแยกตามหอพัก กรองเพศ ระดับชั้น ห้องเรียน และส่งออกข้อมูล CSV',
    defaultRoles: ['admin', 'staff', 'teacher'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'Users'
  },
  {
    key: 'IMPORT',
    title: 'นำเข้านักเรียนด้วยไฟล์ Excel / CSV',
    shortTitle: 'นำเข้านักเรียน CSV',
    category: 'STUDENT_MGMT',
    categoryName: 'จัดการนักเรียน',
    description: 'นำเข้าข้อมูลนักเรียนจำนวนมากเข้าสู่ฐานข้อมูลระบบ',
    defaultRoles: ['admin', 'staff'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'Upload'
  },
  {
    key: 'IMPORT_CONDUCT',
    title: 'นำเข้าข้อมูลการกระทำผิด (Excel)',
    shortTitle: 'นำเข้าการกระทำผิด',
    category: 'STUDENT_MGMT',
    categoryName: 'จัดการนักเรียน',
    description: 'นำเข้าประวัติการกระทำผิดและตัดคะแนนความประพฤติจากไฟล์ Excel อ้างอิงรหัสนักเรียน',
    defaultRoles: ['admin', 'staff'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'FileSpreadsheet'
  },
  {
    key: 'PHOTOS',
    title: 'นำเข้ารูปถ่ายนักเรียนตามรหัส',
    shortTitle: 'นำเข้ารูปนักเรียน',
    category: 'STUDENT_MGMT',
    categoryName: 'จัดการนักเรียน',
    description: 'อัปโหลดและผูกรูปถ่ายนักเรียนตามรหัสประจำตัวแบบกลุ่ม (ZIP หรือหลายไฟล์)',
    defaultRoles: ['admin', 'staff'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'Camera'
  },
  {
    key: 'YEAR_CYCLE',
    title: 'จัดการรอบ 3 ปี (เลื่อนชั้น/จบการศึกษา)',
    shortTitle: 'จัดการรอบ 3 ปี',
    category: 'STUDENT_MGMT',
    categoryName: 'จัดการนักเรียน',
    description: 'เลื่อนระดับชั้นอัตโนมัติ และจำหน่ายนักเรียนที่จบการศึกษา ม.3 และ ม.6',
    defaultRoles: ['admin', 'staff'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'Calendar'
  },

  // หมวดที่ 3: ตั้งค่าระบบ (SETTINGS)
  {
    key: 'SETTINGS_BRANDING',
    title: 'ข้อมูลโรงเรียนและระบบ',
    shortTitle: 'ข้อมูลโรงเรียน',
    category: 'SETTINGS',
    categoryName: 'ตั้งค่าระบบ',
    description: 'ตั้งค่าชื่อโรงเรียน ตราสัญลักษณ์ ปีการศึกษา ภาคเรียน และเกณฑ์คะแนน',
    defaultRoles: ['admin'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'School'
  },
  {
    key: 'SETTINGS_BEHAVIORS',
    title: 'หัวข้อพฤติกรรมมาตรฐาน',
    shortTitle: 'พฤติกรรมมาตรฐาน',
    category: 'SETTINGS',
    categoryName: 'ตั้งค่าระบบ',
    description: 'กำหนดรายการความผิด/ความดี แต้มคะแนนมาตรฐานที่ใช้ตัดหรือเพิ่มคะแนน',
    defaultRoles: ['admin', 'staff'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'Folder'
  },
  {
    key: 'SETTINGS_USERS',
    title: 'จัดการผู้ใช้งานระบบ',
    shortTitle: 'จัดการผู้ใช้',
    category: 'SETTINGS',
    categoryName: 'ตั้งค่าระบบ',
    description: 'สร้าง แก้ไข ลบ บัญชีผู้ใช้งานระบบ และกำหนดระดับบทบาทบุคลากร (เฉพาะผู้ที่มีสิทธิ์ต่ำกว่า)',
    defaultRoles: ['admin', 'staff'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'UserCheck'
  },
  {
    key: 'SETTINGS_MENU_PERMISSIONS',
    title: 'จัดการสิทธิ์เข้าถึงเมนู (ผู้ดูแลหลัก)',
    shortTitle: 'จัดการสิทธิ์เข้าถึงเมนู',
    category: 'SETTINGS',
    categoryName: 'ตั้งค่าระบบ',
    description: 'กำหนดสิทธิ์การมองเห็นและเข้าใช้งานเมนูต่างๆ ในระบบ โดยมีเฉพาะผู้ดูแลหลักเท่านั้นที่ได้รับอนุญาต',
    defaultRoles: ['admin'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    isSuperAdminOnly: true, // เฉพาะผู้ดูแลหลักเท่านั้น!
    iconName: 'ShieldCheck'
  },
  {
    key: 'SETTINGS_DATABASE',
    title: 'ฐานข้อมูลและสำรองข้อมูล',
    shortTitle: 'ฐานข้อมูล & สำรอง',
    category: 'SETTINGS',
    categoryName: 'ตั้งค่าระบบ',
    description: 'สำรองข้อมูล กู้คืนข้อมูล นำเข้าข้อมูลตัวอย่าง และล้างข้อมูลประวัติ',
    defaultRoles: ['admin'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'Folder'
  },
  {
    key: 'SETTINGS_GRANTS',
    title: 'ประวัติการให้สิทธิ์นักเรียน',
    shortTitle: 'ประวัติสิทธิ์นักเรียน',
    category: 'SETTINGS',
    categoryName: 'ตั้งค่าระบบ',
    description: 'ประวัติการอนุญาตให้นักเรียนเปิดดูคะแนนและบัตรประจำตัวรายบุคคล',
    defaultRoles: ['admin', 'staff', 'teacher'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'Sparkles'
  },
  {
    key: 'SETTINGS_USAGE_STATS',
    title: 'สถิติการใช้งานระบบและจำลองโควต้าฐานข้อมูล',
    shortTitle: 'สถิติการใช้งาน & โควต้า',
    category: 'SETTINGS',
    categoryName: 'ตั้งค่าระบบ',
    description: 'จำลองจำนวนการทำงานและวิเคราะห์โควต้าฟรีของ Cloud Firestore และ Realtime Database ตามสถานการณ์จำลอง',
    defaultRoles: ['admin', 'staff'],
    defaultAllowGuest: false,
    defaultEnabled: true,
    iconName: 'Activity'
  }
];

/**
 * ดึงค่าเริ่มต้นสิทธิ์เมนูทั้งหมด
 */
export function getDefaultMenuPermissions(): MenuPermissionsMap {
  const map: MenuPermissionsMap = {};
  for (const item of ALL_MENU_DEFINITIONS) {
    map[item.key] = {
      allowedRoles: [...item.defaultRoles],
      allowGuest: item.defaultAllowGuest,
      enabled: item.defaultEnabled
    };
  }
  return map;
}

/**
 * ตรวจสอบว่าผู้ใช้งานปัจจุบันสามารถเข้าถึงเมนู view นั้นได้หรือไม่
 * - เมนู 'SETTINGS_MENU_PERMISSIONS': ต้องเป็นผู้ดูแลหลัก (Super Admin) เท่านั้น!
 * - หากเป็น Super Admin: เข้าถึงได้ทุกเมนูที่เปิดใช้งาน
 * - สำหรับ Role อื่น: ตรวจสอบจาก SystemSettings.menuPermissions หรือค่าตั้งต้น
 */
export function canUserAccessMenu(
  view: AppView,
  user: AppUser | null,
  studentGrantOrPermissions?: StudentAccessGrant | MenuPermissionsMap | null,
  customPermissions?: MenuPermissionsMap
): boolean {
  // Disambiguate studentGrant vs customPermissions if passed in 3rd argument slot
  let studentGrant: StudentAccessGrant | null = null;
  let effectivePermissions: MenuPermissionsMap | undefined = customPermissions;

  if (studentGrantOrPermissions && typeof studentGrantOrPermissions === 'object') {
    if (
      'studentId' in studentGrantOrPermissions ||
      'token' in studentGrantOrPermissions ||
      'grantedAt' in studentGrantOrPermissions
    ) {
      studentGrant = studentGrantOrPermissions as StudentAccessGrant;
    } else {
      // 3rd argument is actually the custom permissions map
      effectivePermissions = studentGrantOrPermissions as MenuPermissionsMap;
    }
  }

  // กฎเหล็ก: เมนูจัดการสิทธิ์เข้าถึงเมนู อนุญาตให้เฉพาะ "ผู้ดูแลหลัก" เท่านั้น
  if (view === 'SETTINGS_MENU_PERMISSIONS') {
    return isSuperAdmin(user);
  }

  // ผู้ดูแลหลัก (Super Admin) มีสิทธิ์เข้าถึงทุกเมนูของระบบเสมอ
  if (isSuperAdmin(user)) {
    return true;
  }

  // กรณีเมนูรวมการตั้งค่า 'SETTINGS' ให้ตรวจสอบว่ามีสิทธิ์เข้าถึงเมนูย่อยในการตั้งค่าอย่างน้อย 1 เมนูหรือไม่
  if (view === 'SETTINGS') {
    const settingsSubViews: AppView[] = [
      'SETTINGS_BRANDING',
      'SETTINGS_BEHAVIORS',
      'SETTINGS_USERS',
      'SETTINGS_DATABASE',
      'SETTINGS_GRANTS',
      'SETTINGS_MENU_PERMISSIONS',
      'SETTINGS_USAGE_STATS'
    ];
    return settingsSubViews.some(subView =>
      canUserAccessMenu(subView, user, studentGrant, effectivePermissions)
    );
  }

  // กรณีเมนูย่อยรายงานความประพฤติ ให้ตรวจสอบสิทธิ์เข้าถึงเมนู REPORTS หลัก
  if (
    view === 'REPORT_INDIVIDUAL' ||
    view === 'REPORT_GRADE_LEVEL' ||
    view === 'REPORT_FULL_100' ||
    view === 'REPORT_HONOUR_100' ||
    view === 'REPORT_POINTS_ADDED' ||
    view === 'REPORT_POINTS_DEDUCTED'
  ) {
    return canUserAccessMenu('REPORTS', user, studentGrant, effectivePermissions);
  }

  const def = ALL_MENU_DEFINITIONS.find(m => m.key === view);
  if (!def) {
    // ถ้าไม่มีคำจำกัดความ (เช่น เมนูย่อยหรือ alias) ให้พิจารณาว่าเข้าถึงได้
    return true;
  }

  // ถ้าเมนูนี้ถูกระบุว่าเป็น superAdminOnly
  if (def.isSuperAdminOnly) {
    return isSuperAdmin(user);
  }

  const rule: MenuAccessRule = effectivePermissions?.[view] || {
    allowedRoles: def.defaultRoles,
    allowGuest: def.defaultAllowGuest,
    enabled: def.defaultEnabled
  };

  // ถ้าเมนูถูกปิดใช้งาน (Disabled)
  if (!rule.enabled) {
    return false;
  }

  // กรณีผู้ใช้ยังไม่ได้ล็อกอิน (Guest)
  if (!user && !studentGrant) {
    return rule.allowGuest === true;
  }

  // กรณีเป็นนักเรียนที่ได้รับรหัสสิทธิ์เปิดดู (Student Access Grant)
  if (!user && studentGrant) {
    return rule.allowedRoles.includes('student') || rule.allowGuest === true;
  }

  // กรณีเป็นผู้ใช้งานที่เข้าสู่ระบบ (admin, staff, teacher)
  if (user) {
    return rule.allowedRoles.includes(user.role);
  }

  return false;
}

/**
 * ตรวจสอบสิทธิ์การเพิ่มหรือตัด/ลบคะแนนพฤติกรรม:
 * - Admin (ระดับ 3, 4) และ Staff (ระดับ 2): สามารถเพิ่มหรือตัด/ลบคะแนนพฤติกรรมได้
 * - Teacher (ระดับ 1): ไม่สามารถเพิ่มหรือตัด/ลบคะแนนพฤติกรรมได้ (โหมดดูได้อย่างเดียว แต่ดูคะแนนได้ทุกคน)
 * - Student/Guest (ระดับ 0): โหมดดูเฉพาะบุคคลหรือทั่วไป
 */
export function canUserModifyConductScore(user: AppUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'staff';
}

