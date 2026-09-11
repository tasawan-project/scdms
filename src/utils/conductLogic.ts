import {
  Student,
  ConductLog,
  GradeLevel,
  EducationalLevel,
  EntryLevel,
  OutstandingSummary,
  LevelCode,
  ScoreCategoryInfo,
  ScoreCategoryType,
  SystemSettings,
  HomeroomAdvisor
} from '../types';

export interface ConductThresholdConfig {
  criticalScoreThreshold?: number; // วิกฤต: เช่น 70
  watchScoreThreshold?: number;    // เฝ้าระวัง: เช่น 30
  cautionScoreThreshold?: number;  // ตักเตือน: เช่น 20
  maxBankedPointsCap?: number;     // ยอดเยี่ยม: เพดานคะแนนสะสมสูงสุด เช่น 50
  warningScoreThreshold?: number;
  criticalThreshold?: number;
  warningThreshold?: number;
}

/**
 * Parses user-configured threshold values and derives mathematical cutoffs.
 * Baseline full score is 100.
 */
export function parseConductCutoffs(settings?: Partial<SystemSettings> | ConductThresholdConfig) {
  const rawCrit = settings?.criticalScoreThreshold ?? settings?.criticalThreshold ?? 70;
  const rawWatch = settings?.watchScoreThreshold ?? settings?.warningScoreThreshold ?? 30;
  const rawCaution = settings?.cautionScoreThreshold ?? 20;
  const maxBankedCap = settings?.maxBankedPointsCap ?? 50;

  // Derive cutoffs:
  // For critical: If user inputted 70 (or > 50), deducted points threshold is 70, remaining score threshold is 30 (100 - 70).
  // If user inputted <= 50 (e.g. 50), remaining score threshold is 50, deducted threshold is 50.
  const criticalDeductionCutoff = rawCrit > 50 ? rawCrit : (100 - rawCrit);
  const criticalScoreCutoff = 100 - criticalDeductionCutoff;

  // For watch: If user inputted 30 (or < 50), deducted points threshold is 30, remaining score threshold is 70 (100 - 30).
  // If user inputted >= 50 (e.g. 70), remaining score threshold is 70, deducted threshold is 30.
  const watchDeductionCutoff = rawWatch < 50 ? rawWatch : (100 - rawWatch);
  const watchScoreCutoff = 100 - watchDeductionCutoff;

  // For caution: If user inputted 20 (or < 50), deducted points threshold is 20, remaining score threshold is 80 (100 - 20).
  const cautionDeductionCutoff = rawCaution < 50 ? rawCaution : (100 - rawCaution);
  const cautionScoreCutoff = 100 - cautionDeductionCutoff;

  return {
    rawCrit,
    rawWatch,
    rawCaution,
    maxBankedCap,
    criticalDeductionCutoff,
    criticalScoreCutoff,
    watchDeductionCutoff,
    watchScoreCutoff,
    cautionDeductionCutoff,
    cautionScoreCutoff
  };
}

/**
 * Calculates current GradeLevel (ม.1 - ม.6) and EducationalLevel (JUNIOR/SENIOR)
 * based on entry year, entry level, and current academic year.
 *
 * M = มัธยมศึกษาตอนต้น (ม.1, ม.2, ม.3)
 * P = มัธยมศึกษาตอนปลาย (ม.4, ม.5, ม.6) [รองรับ F ด้วย]
 *
 * ตัวอย่างการประมวลผล (ตามปีการศึกษาปัจจุบัน เช่น 2569):
 * มัธยมศึกษาตอนต้น:
 * - ม.1 = M, 2569 (diff = 0)
 * - ม.2 = M, 2568 (diff = 1)
 * - ม.3 = M, 2567 (diff = 2)
 *
 * มัธยมศึกษาตอนปลาย:
 * - ม.4 = P, 2569 (diff = 0)
 * - ม.5 = P, 2568 (diff = 1)
 * - ม.6 = P, 2567 (diff = 2)
 */
export function calculateStudentGrade(
  entryYear: number,
  entryLevel: EntryLevel,
  currentAcademicYear: number = 2569
): {
  grade: GradeLevel;
  level: EducationalLevel;
  levelCode: LevelCode; // 'M' | 'P'
  yearInLevel: number; // 1, 2, or 3
  isGraduated: boolean;
  gradeNumber: number; // 1, 2, 3, 4, 5, 6
} {
  const diff = currentAcademicYear - entryYear;

  if (entryLevel === 'ม.1') {
    if (diff === 0) return { grade: 'ม.1', level: 'JUNIOR', levelCode: 'M', yearInLevel: 1, isGraduated: false, gradeNumber: 1 };
    if (diff === 1) return { grade: 'ม.2', level: 'JUNIOR', levelCode: 'M', yearInLevel: 2, isGraduated: false, gradeNumber: 2 };
    if (diff === 2) return { grade: 'ม.3', level: 'JUNIOR', levelCode: 'M', yearInLevel: 3, isGraduated: false, gradeNumber: 3 };
    // If diff >= 3, graduated from junior high
    return { grade: 'ม.3', level: 'JUNIOR', levelCode: 'M', yearInLevel: 3, isGraduated: true, gradeNumber: 3 };
  } else {
    // entryLevel === 'ม.4'
    if (diff === 0) return { grade: 'ม.4', level: 'SENIOR', levelCode: 'P', yearInLevel: 1, isGraduated: false, gradeNumber: 4 };
    if (diff === 1) return { grade: 'ม.5', level: 'SENIOR', levelCode: 'P', yearInLevel: 2, isGraduated: false, gradeNumber: 5 };
    if (diff === 2) return { grade: 'ม.6', level: 'SENIOR', levelCode: 'P', yearInLevel: 3, isGraduated: false, gradeNumber: 6 };
    // If diff >= 3, graduated from senior high
    return { grade: 'ม.6', level: 'SENIOR', levelCode: 'P', yearInLevel: 3, isGraduated: true, gradeNumber: 6 };
  }
}

/**
 * Parses raw level and year strings to accurately determine:
 * - levelCode ('M' or 'P')
 * - entryLevel ('ม.1' or 'ม.4')
 * - entryYear (calculated accurately if relative grade like 'ม.2', 'ม.3', 'ม.5', 'ม.6' is given)
 */
export function resolveStudentLevelAndYear(
  rawLevelInput: string = '',
  rawYearInput: string | number = '',
  currentAcademicYear: number = 2569,
  rawRoomInput: string = '',
  fallbackEntryLevel: EntryLevel = 'ม.1'
): {
  levelCode: LevelCode;
  entryLevel: EntryLevel;
  entryYear: number;
} {
  const levelStr = String(rawLevelInput || '').trim().toUpperCase();
  const roomStr = String(rawRoomInput || '').trim();
  
  let entryYear = typeof rawYearInput === 'number' ? rawYearInput : parseInt(String(rawYearInput || ''));
  const hasExplicitValidYear = !isNaN(entryYear) && entryYear >= 2500;

  let levelCode: LevelCode = 'M';
  let entryLevel: EntryLevel = fallbackEntryLevel;

  // 1. Check if user wrote explicit senior level (P, F, ม.ปลาย, ม.4, ม.5, ม.6)
  if (
    levelStr === 'P' ||
    levelStr === 'F' ||
    levelStr.includes('ม.ปลาย') ||
    levelStr.includes('ปลาย') ||
    levelStr.includes('SENIOR') ||
    levelStr === 'ม.4' ||
    levelStr === 'ม.5' ||
    levelStr === 'ม.6' ||
    levelStr === '4' ||
    levelStr === '5' ||
    levelStr === '6'
  ) {
    levelCode = 'P';
    entryLevel = 'ม.4';

    if (!hasExplicitValidYear) {
      if (levelStr === 'ม.5' || levelStr === '5') {
        entryYear = currentAcademicYear - 1;
      } else if (levelStr === 'ม.6' || levelStr === '6') {
        entryYear = currentAcademicYear - 2;
      } else {
        entryYear = currentAcademicYear;
      }
    }
  }
  // 2. Check if user wrote junior level (M, ม.ต้น, ม.1, ม.2, ม.3)
  else if (
    levelStr === 'M' ||
    levelStr.includes('ม.ต้น') ||
    levelStr.includes('ต้น') ||
    levelStr.includes('JUNIOR') ||
    levelStr === 'ม.1' ||
    levelStr === 'ม.2' ||
    levelStr === 'ม.3' ||
    levelStr === '1' ||
    levelStr === '2' ||
    levelStr === '3'
  ) {
    levelCode = 'M';
    entryLevel = 'ม.1';

    if (!hasExplicitValidYear) {
      if (levelStr === 'ม.2' || levelStr === '2') {
        entryYear = currentAcademicYear - 1;
      } else if (levelStr === 'ม.3' || levelStr === '3') {
        entryYear = currentAcademicYear - 2;
      } else {
        entryYear = currentAcademicYear;
      }
    }
  }
  // 3. Fallback inference from room string (e.g. 4/1, 5/2, 6/3, 1/1, 2/1, 3/1)
  else if (
    roomStr.includes('4/') || roomStr.includes('5/') || roomStr.includes('6/') ||
    roomStr.startsWith('ม.4') || roomStr.startsWith('ม.5') || roomStr.startsWith('ม.6') ||
    roomStr.startsWith('4') || roomStr.startsWith('5') || roomStr.startsWith('6')
  ) {
    levelCode = 'P';
    entryLevel = 'ม.4';
    if (!hasExplicitValidYear) {
      if (roomStr.includes('5/') || roomStr.startsWith('ม.5') || roomStr.startsWith('5')) {
        entryYear = currentAcademicYear - 1;
      } else if (roomStr.includes('6/') || roomStr.startsWith('ม.6') || roomStr.startsWith('6')) {
        entryYear = currentAcademicYear - 2;
      } else {
        entryYear = currentAcademicYear;
      }
    }
  } else if (
    roomStr.includes('1/') || roomStr.includes('2/') || roomStr.includes('3/') ||
    roomStr.startsWith('ม.1') || roomStr.startsWith('ม.2') || roomStr.startsWith('ม.3') ||
    roomStr.startsWith('1') || roomStr.startsWith('2') || roomStr.startsWith('3')
  ) {
    levelCode = 'M';
    entryLevel = 'ม.1';
    if (!hasExplicitValidYear) {
      if (roomStr.includes('2/') || roomStr.startsWith('ม.2') || roomStr.startsWith('2')) {
        entryYear = currentAcademicYear - 1;
      } else if (roomStr.includes('3/') || roomStr.startsWith('ม.3') || roomStr.startsWith('3')) {
        entryYear = currentAcademicYear - 2;
      } else {
        entryYear = currentAcademicYear;
      }
    }
  } else {
    // Default fallback
    if (fallbackEntryLevel === 'ม.4') {
      levelCode = 'P';
      entryLevel = 'ม.4';
    } else {
      levelCode = 'M';
      entryLevel = 'ม.1';
    }
    if (!hasExplicitValidYear) {
      entryYear = currentAcademicYear;
    }
  }

  // Ensure entryYear is valid number >= 2500
  if (isNaN(entryYear) || entryYear < 2500) {
    entryYear = currentAcademicYear;
  }

  return {
    levelCode,
    entryLevel,
    entryYear
  };
}

/**
 * Apply conduct point deduction.
 * - Deducts from banked reserve points first if any exist.
 * - Remaining points are deducted from currentScore (down to min 0).
 */
export function calculateDeduction(
  student: Student,
  pointsToDeduct: number
): {
  newCurrentScore: number;
  newBankedPoints: number;
  scoreDeductionDelta: number;
  bankedPointsDelta: number;
} {
  let remainingDeduction = pointsToDeduct;
  let newBanked = student.bankedPoints || 0;
  let bankedDelta = 0;

  if (newBanked > 0) {
    if (newBanked >= remainingDeduction) {
      newBanked -= remainingDeduction;
      bankedDelta = -remainingDeduction;
      remainingDeduction = 0;
    } else {
      bankedDelta = -newBanked;
      remainingDeduction -= newBanked;
      newBanked = 0;
    }
  }

  const currentScore = student.currentScore ?? 100;
  const newCurrentScore = Math.max(0, currentScore - remainingDeduction);
  const scoreDeductionDelta = currentScore - newCurrentScore;

  return {
    newCurrentScore,
    newBankedPoints: newBanked,
    scoreDeductionDelta,
    bankedPointsDelta: bankedDelta
  };
}

/**
 * Apply conduct point addition.
 * - Automatically brings currentScore back up to 100.
 * - Any surplus/remaining points are stored in bankedPoints for future deductions.
 */
export function calculateAddition(
  student: Student,
  pointsToAdd: number,
  maxBankedCap?: number
): {
  newCurrentScore: number;
  newBankedPoints: number;
  scoreAdditionDelta: number;
  bankedPointsDelta: number;
} {
  const currentScore = student.currentScore ?? 100;
  const currentBanked = student.bankedPoints ?? 0;

  const neededToFull = Math.max(0, 100 - currentScore);

  let scoreAdditionDelta = 0;
  let surplus = 0;

  if (pointsToAdd <= neededToFull) {
    scoreAdditionDelta = pointsToAdd;
    surplus = 0;
  } else {
    scoreAdditionDelta = neededToFull;
    surplus = pointsToAdd - neededToFull;
  }

  const cap = typeof maxBankedCap === 'number' && maxBankedCap > 0 ? maxBankedCap : 0;
  let newBankedPoints = currentBanked + surplus;
  let bankedDelta = surplus;

  if (cap > 0 && newBankedPoints > cap) {
    newBankedPoints = cap;
    bankedDelta = Math.max(0, cap - currentBanked);
  }

  const newCurrentScore = currentScore + scoreAdditionDelta;

  return {
    newCurrentScore,
    newBankedPoints,
    scoreAdditionDelta,
    bankedPointsDelta: bankedDelta
  };
}

/**
 * Categorize student status for UI badges and alerts according to 6 defined criteria:
 * 1. วิกฤต : หักคะแนนสะสมถึงเกณฑ์ (เช่น ≥ 70) หรือ คะแนนคงเหลือลดลงถึงเกณฑ์ (เช่น ≤ 30)
 * 2. เฝ้าระวัง : หักคะแนนสะสมถึงเกณฑ์ (เช่น ≥ 30) หรือ คะแนนคงเหลือลดลงถึงเกณฑ์ (เช่น ≤ 70)
 * 3. ตักเตือน : หักคะแนนสะสมถึงเกณฑ์ (เช่น ≥ 20) หรือ คะแนนคงเหลือลดลงถึงเกณฑ์ (เช่น ≤ 80 หรือ < 100)
 * 4. ปกติ : มีคะแนนเต็ม 100 คะแนน
 * 5. ดีเด่น : มีคะแนนเกิน 100 คะแนน
 * 6. ยอดเยี่ยม : มีคะแนนเกิน 100 คะแนนและไม่เคยโดนหักคะแนนเลยในรอบ 3 ปี (สะสมได้ตามเพดาน)
 */
export function getScoreCategory(
  student: Student,
  settings?: Partial<SystemSettings> | ConductThresholdConfig
): ScoreCategoryInfo {
  const score = Number(student.currentScore ?? 100);
  const banked = Number(student.bankedPoints ?? 0);

  // สถานะไม่เคยถูกหักคะแนนเลย หรือได้รับการลบร่องรอยและประวัติความผิดกลับเป็นสถานะเริ่มต้น
  const isNeverDeducted =
    student.hasNeverBeenDeducted === true ||
    ((student.totalDeductionsCount ?? 0) === 0 && (student.totalDeductedPoints ?? 0) === 0 && score >= 100);

  // ถ้านักเรียนไม่เคยถูกหักคะแนน (หรือลบประวัติความผิดแล้ว) คะแนนหักสะสมต้องเป็น 0 เสมอ
  const totalDeducted = isNeverDeducted ? 0 : Math.max(0, Number(student.totalDeductedPoints ?? (100 - score)));
  const hasNeverBeenDeducted = isNeverDeducted && (student.totalDeductionsCount ?? 0) === 0;

  const cutoffs = parseConductCutoffs(settings);

  // 1. วิกฤต : หักคะแนนเกินเกณฑ์ หรือ คะแนนคงเหลือต่ำกว่าเกณฑ์
  if (totalDeducted >= cutoffs.criticalDeductionCutoff || score <= cutoffs.criticalScoreCutoff) {
    return {
      type: 'CRITICAL',
      label: `วิกฤต (หักเกิน ${cutoffs.criticalDeductionCutoff} คะแนน)`,
      shortLabel: 'วิกฤต',
      badgeClass: 'bg-rose-600 text-white border-rose-700 shadow-2xs',
      bgClass: 'bg-rose-50 text-rose-900 border-rose-200',
      textClass: 'text-rose-600',
      borderClass: 'border-rose-300',
      description: `หักคะแนนสะสมเกิน ${cutoffs.criticalDeductionCutoff} คะแนน (คะแนนคงเหลือ ≤ ${cutoffs.criticalScoreCutoff}) ต้องประสานงานครูที่ปรึกษาและแจ้งผู้ปกครองปรับปรุงพฤติกรรมด่วน`
    };
  }

  // 2. เฝ้าระวัง : หักคะแนนเกินเกณฑ์ หรือ คะแนนคงเหลือต่ำกว่าเกณฑ์
  if (totalDeducted >= cutoffs.watchDeductionCutoff || score <= cutoffs.watchScoreCutoff) {
    return {
      type: 'WATCH',
      label: `เฝ้าระวัง (หักเกิน ${cutoffs.watchDeductionCutoff} คะแนน)`,
      shortLabel: 'เฝ้าระวัง',
      badgeClass: 'bg-orange-500 text-white border-orange-600 shadow-2xs',
      bgClass: 'bg-orange-50 text-orange-950 border-orange-200',
      textClass: 'text-orange-600',
      borderClass: 'border-orange-300',
      description: `หักคะแนนสะสมเกิน ${cutoffs.watchDeductionCutoff} คะแนน (คะแนนคงเหลือ ≤ ${cutoffs.watchScoreCutoff}) ต้องติดตามพฤติกรรมใกล้ชิด`
    };
  }

  // 3. ตักเตือน : หักคะแนนไม่เกินเกณฑ์ตักเตือน หรือคะแนนคงเหลือ < 100
  if (score < 100 || totalDeducted >= cutoffs.cautionDeductionCutoff || (totalDeducted > 0 && banked <= 0)) {
    return {
      type: 'CAUTION',
      label: `ตักเตือน (หักสะสม ${cutoffs.cautionDeductionCutoff}+ คะแนน)`,
      shortLabel: 'ตักเตือน',
      badgeClass: 'bg-amber-500 text-white border-amber-600 shadow-2xs',
      bgClass: 'bg-amber-50 text-amber-950 border-amber-200',
      textClass: 'text-amber-600',
      borderClass: 'border-amber-300',
      description: `หักคะแนนสะสม ${cutoffs.cautionDeductionCutoff} คะแนนขึ้นไป (คะแนนคงเหลือ ${score}) ตักเตือนและบันทึกข้อตกลงร่วมกัน`
    };
  }

  // 6. ยอดเยี่ยม : มีคะแนนเกิน 100 คะแนนและไม่เคยโดนหักคะแนนเลยในรอบ 3 ปี
  if (banked > 0 && hasNeverBeenDeducted) {
    const capInfo = cutoffs.maxBankedCap > 0 ? ` (เพดานสะสมสูงสุด ${cutoffs.maxBankedCap} แต้ม)` : '';
    return {
      type: 'EXCELLENT',
      label: 'ยอดเยี่ยม (100+ ไม่เคยถูกหักคะแนน 3 ปี)',
      shortLabel: 'ยอดเยี่ยม',
      badgeClass: 'bg-purple-600 text-white border-purple-700 shadow-2xs',
      bgClass: 'bg-purple-50 text-purple-950 border-purple-200',
      textClass: 'text-purple-600',
      borderClass: 'border-purple-300',
      description: `มีคะแนนเกิน 100 คะแนน (+${banked} แต้ม${capInfo}) และไม่เคยโดนหักคะแนนเลยในรอบ 3 ปี`
    };
  }

  // 5. ดีเด่น : มีคะแนนเกิน 100 คะแนน (มีคะแนนสะสมสำรอง > 0 แต่เคยโดนหักคะแนนมาก่อน)
  if (banked > 0) {
    const capInfo = cutoffs.maxBankedCap > 0 ? ` (เพดานสะสมสูงสุด ${cutoffs.maxBankedCap} แต้ม)` : '';
    return {
      type: 'OUTSTANDING',
      label: 'ดีเด่น (มีคะแนนเกิน 100 คะแนน)',
      shortLabel: 'ดีเด่น',
      badgeClass: 'bg-blue-600 text-white border-blue-700 shadow-2xs',
      bgClass: 'bg-blue-50 text-blue-950 border-blue-200',
      textClass: 'text-blue-600',
      borderClass: 'border-blue-300',
      description: `มีคะแนนเกิน 100 คะแนน (คะแนนสำรองความดี +${banked} แต้ม${capInfo})`
    };
  }

  // 4. ปกติ : มีคะแนนเต็ม 100 คะแนน
  return {
    type: 'NORMAL',
    label: 'ปกติ (คะแนนเต็ม 100)',
    shortLabel: 'ปกติ',
    badgeClass: 'bg-emerald-600 text-white border-emerald-700 shadow-2xs',
    bgClass: 'bg-emerald-50 text-emerald-950 border-emerald-200',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-300',
    description: 'มีคะแนนเต็ม 100 คะแนน รักษามาตรฐานความประพฤติได้ดี'
  };
}

/**
 * Filter outstanding students with >=100 and no deductions ever.
 */
export function getOutstandingStudents(
  students: Student[],
  currentAcademicYear: number = 2569
): OutstandingSummary {
  const activeStudents = students.filter(s => s.status !== 'GRADUATED');

  const honourStudents = activeStudents.filter(s => {
    const isUnpenalized = s.hasNeverBeenDeducted === true || (s.totalDeductionsCount ?? 0) === 0;
    const isScoreFullOrSurplus = (s.currentScore >= 100) && ((s.bankedPoints ?? 0) >= 0);
    return isUnpenalized && isScoreFullOrSurplus;
  });

  const junior: Student[] = [];
  const senior: Student[] = [];

  honourStudents.forEach(student => {
    const { level } = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);
    if (level === 'JUNIOR') {
      junior.push(student);
    } else {
      senior.push(student);
    }
  });

  // Sort by banked points descending, then by student id
  junior.sort((a, b) => (b.bankedPoints ?? 0) - (a.bankedPoints ?? 0) || a.id.localeCompare(b.id));
  senior.sort((a, b) => (b.bankedPoints ?? 0) - (a.bankedPoints ?? 0) || a.id.localeCompare(b.id));

  return { junior, senior };
}

/**
 * Resolves all homeroom advisors for a specific student, strictly sorted starting with ครูที่ปรึกษา 1 first, then 2, 3...
 */
export function getStudentAdvisors(
  student: Student | null | undefined,
  advisors: HomeroomAdvisor[] = [],
  academicYear: number = 2569
): HomeroomAdvisor[] {
  if (!student) return [];
  const { grade } = calculateStudentGrade(student.entryYear, student.entryLevel, academicYear);
  const roomNum = Number(student.room);

  const matched = (advisors || []).filter(a => {
    const isYearMatch = !a.academicYear || a.academicYear === academicYear;
    return isYearMatch && a.gradeLevel === grade && Number(a.room) === roomNum;
  });

  return matched.sort((a, b) => (Number(a.advisorOrder) || 1) - (Number(b.advisorOrder) || 1));
}

/**
 * Formats a student's advisor list as a clean readable string, ordered with ครูที่ปรึกษา 1 first.
 */
export function formatStudentAdvisors(
  student: Student | null | undefined,
  advisors: HomeroomAdvisor[] = [],
  academicYear: number = 2569
): string {
  if (!student) return 'ยังไม่ได้ระบุ';
  const matched = getStudentAdvisors(student, advisors, academicYear);
  if (matched.length > 0) {
    if (matched.length === 1) {
      return matched[0].fullName;
    }
    return matched.map((a, idx) => {
      const order = Number(a.advisorOrder) || (idx + 1);
      return `${order}. ${a.fullName} (ครูที่ปรึกษา ${order})`;
    }).join(', ');
  }

  // Fallback to student.advisorName
  return student.advisorName || 'ยังไม่ได้ระบุ';
}

/**
 * Replays and recalculates a student's total scores, banked points, and deduction counts
 * from their complete set of conduct logs in chronological order.
 * This guarantees 100% data integrity when a log is added, edited, or deleted.
 */
export function recalculateStudentScoresFromLogs(
  student: Student,
  allStudentLogs: ConductLog[],
  maxBankedCap: number = 50
): Student {
  // Sort logs chronologically (oldest first: recordedAt ascending)
  const sorted = [...allStudentLogs].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  let score = 100;
  let banked = 0;
  let totalDeductionsCount = 0;
  let totalDeductedPoints = 0;
  let totalAddedPoints = 0;
  let hasNeverBeenDeducted = true;

  for (const log of sorted) {
    const points = Number(log.points) || 0;
    if (log.type === 'DEDUCT') {
      hasNeverBeenDeducted = false;
      totalDeductionsCount += 1;
      totalDeductedPoints += points;

      let remainingDeduction = points;
      if (banked > 0) {
        if (banked >= remainingDeduction) {
          banked -= remainingDeduction;
          remainingDeduction = 0;
        } else {
          remainingDeduction -= banked;
          banked = 0;
        }
      }
      score = Math.max(0, score - remainingDeduction);
    } else if (log.type === 'ADD') {
      totalAddedPoints += points;

      const neededToFull = Math.max(0, 100 - score);
      if (points <= neededToFull) {
        score += points;
      } else {
        score = 100;
        const surplus = points - neededToFull;
        banked += surplus;
        if (maxBankedCap > 0 && banked > maxBankedCap) {
          banked = maxBankedCap;
        }
      }
    }
  }

  return {
    ...student,
    currentScore: score,
    bankedPoints: banked,
    totalDeductionsCount,
    totalDeductedPoints,
    totalAddedPoints,
    hasNeverBeenDeducted,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Replays conduct logs in chronological order to compute exact scoreBefore, scoreAfter,
 * bankedBefore, and bankedAfter for every log item. This prevents missing or overlapping score data in the UI.
 */
export function computeLogsWithRunningScores(
  student: Student,
  logs: ConductLog[],
  maxBankedCap: number = 50
): ConductLog[] {
  if (!logs || logs.length === 0) return [];

  // Sort ascending by time (oldest first)
  const sorted = [...logs].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  let runningScore = 100;
  let runningBanked = 0;
  const enriched: ConductLog[] = [];

  for (const log of sorted) {
    const scoreBefore = runningScore;
    const bankedBefore = runningBanked;
    const points = Number(log.points) || 0;
    let appliedToScore = 0;
    let bankedPointsDelta = 0;

    if (log.type === 'DEDUCT') {
      let remainingDeduction = points;
      if (runningBanked > 0) {
        if (runningBanked >= remainingDeduction) {
          runningBanked -= remainingDeduction;
          bankedPointsDelta = -remainingDeduction;
          remainingDeduction = 0;
        } else {
          bankedPointsDelta = -runningBanked;
          remainingDeduction -= runningBanked;
          runningBanked = 0;
        }
      }
      const newScore = Math.max(0, runningScore - remainingDeduction);
      appliedToScore = runningScore - newScore;
      runningScore = newScore;
    } else {
      const neededToFull = Math.max(0, 100 - runningScore);
      if (points <= neededToFull) {
        runningScore += points;
        appliedToScore = points;
      } else {
        appliedToScore = neededToFull;
        runningScore = 100;
        const surplus = points - neededToFull;
        const oldBanked = runningBanked;
        runningBanked += surplus;
        if (maxBankedCap > 0 && runningBanked > maxBankedCap) {
          runningBanked = maxBankedCap;
        }
        bankedPointsDelta = runningBanked - oldBanked;
      }
    }

    enriched.push({
      ...log,
      scoreBefore: scoreBefore,
      scoreAfter: runningScore,
      bankedBefore: bankedBefore,
      bankedAfter: runningBanked,
      appliedToScore: appliedToScore,
      bankedPointsDelta: bankedPointsDelta
    });
  }

  // Return sorted descending (newest first for UI display)
  return enriched.sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );
}

