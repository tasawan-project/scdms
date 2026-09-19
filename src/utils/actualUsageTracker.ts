/**
 * Actual System Usage Tracker & Real Quota Analysis
 * ดึงข้อมูลจริงจากการใช้งาน Cloud Firestore และคำนวณสถิติตามการทำงานจริง
 */

import { Student, ConductLog, AppUser, StandardConductBehavior, StudentAccessGrant } from '../types';
import { calculateStudentGrade } from './conductLogic';

export const FIRESTORE_FREE_TIER = {
  DAILY_READS_LIMIT: 50000,
  DAILY_WRITES_LIMIT: 20000,
  DAILY_DELETES_LIMIT: 20000,
  STORAGE_BYTES_LIMIT: 1024 * 1024 * 1024, // 1 GiB (1,024 MB)
  STORAGE_MB_LIMIT: 1024,
  MONTHLY_EGRESS_BYTES_LIMIT: 10 * 1024 * 1024 * 1024, // 10 GiB
  MONTHLY_EGRESS_MB_LIMIT: 10240,
};

export const RTDB_FREE_TIER = {
  SIMULTANEOUS_CONNECTIONS_LIMIT: 100,
  MONTHLY_DOWNLOAD_GB_LIMIT: 10,
  STORAGE_GB_LIMIT: 1
};

export interface RealOperationRecord {
  id: string;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  type: 'READ' | 'WRITE' | 'DELETE';
  count: number;
  collectionName: string;
  action: string; // e.g., 'INITIAL_STUDENTS_SYNC', 'RECORD_CONDUCT_LOG', 'SAVE_STUDENT'
  details?: string;
  userId?: string;
}

export interface DailyUsageSummary {
  date: string; // YYYY-MM-DD
  reads: number;
  writes: number;
  deletes: number;
  conductLogsRecorded: number;
  studentsModified: number;
  hourlyReads: number[]; // 24 items
  hourlyWrites: number[]; // 24 items
  hourlyDeletes: number[]; // 24 items
  hourlyConductLogs: number[]; // 24 items
}

const STORAGE_KEY_OPERATIONS = 'conduct_real_operations_log_v2';
const STORAGE_KEY_DAILY_SUMMARIES = 'conduct_real_daily_summaries_v2';

/**
 * Get formatted local date string YYYY-MM-DD
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retrieve stored daily summaries from localStorage
 */
export function getStoredDailySummaries(): Record<string, DailyUsageSummary> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_SUMMARIES);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to parse daily summaries:', err);
  }
  return {};
}

/**
 * Save daily summaries to localStorage
 */
function saveDailySummaries(summaries: Record<string, DailyUsageSummary>): void {
  try {
    localStorage.setItem(STORAGE_KEY_DAILY_SUMMARIES, JSON.stringify(summaries));
  } catch (err) {
    console.warn('Failed to save daily summaries:', err);
  }
}

/**
 * Retrieve stored operation log
 */
export function getStoredOperationLogs(limit: number = 50): RealOperationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OPERATIONS);
    if (raw) {
      const list: RealOperationRecord[] = JSON.parse(raw);
      return list.slice(-limit).reverse();
    }
  } catch (err) {
    console.warn('Failed to parse operation logs:', err);
  }
  return [];
}

/**
 * Record a real Firestore operation (Read, Write, Delete)
 */
export function recordRealOperation(
  type: 'READ' | 'WRITE' | 'DELETE',
  count: number,
  collectionName: string,
  action: string,
  details?: string,
  userId?: string
): void {
  if (count <= 0) return;

  const now = new Date();
  const dateStr = getLocalDateString(now);
  const hour = now.getHours();

  // 1. Update Daily Summary
  const summaries = getStoredDailySummaries();
  if (!summaries[dateStr]) {
    summaries[dateStr] = {
      date: dateStr,
      reads: 0,
      writes: 0,
      deletes: 0,
      conductLogsRecorded: 0,
      studentsModified: 0,
      hourlyReads: Array(24).fill(0),
      hourlyWrites: Array(24).fill(0),
      hourlyDeletes: Array(24).fill(0),
      hourlyConductLogs: Array(24).fill(0)
    };
  }

  const current = summaries[dateStr];
  if (type === 'READ') {
    current.reads += count;
    current.hourlyReads[hour] = (current.hourlyReads[hour] || 0) + count;
  } else if (type === 'WRITE') {
    current.writes += count;
    current.hourlyWrites[hour] = (current.hourlyWrites[hour] || 0) + count;
    if (collectionName === 'conduct_logs') {
      current.conductLogsRecorded += count;
      current.hourlyConductLogs[hour] = (current.hourlyConductLogs[hour] || 0) + count;
    }
    if (collectionName === 'students') {
      current.studentsModified += count;
    }
  } else if (type === 'DELETE') {
    current.deletes += count;
    current.hourlyDeletes[hour] = (current.hourlyDeletes[hour] || 0) + count;
  }

  saveDailySummaries(summaries);

  // 2. Append to Operation Logs (keep last 200 items)
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OPERATIONS);
    const list: RealOperationRecord[] = raw ? JSON.parse(raw) : [];
    list.push({
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now.toISOString(),
      date: dateStr,
      hour,
      type,
      count,
      collectionName,
      action,
      details,
      userId
    });

    if (list.length > 200) {
      list.splice(0, list.length - 200);
    }
    localStorage.setItem(STORAGE_KEY_OPERATIONS, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to append operation log:', err);
  }
}

/**
 * Calculate actual database storage size in bytes and megabytes
 * Analyzes the serialized JSON size of real records plus Firestore metadata overhead
 */
export function calculateRealDatabaseSize(
  students: Student[],
  conductLogs: ConductLog[],
  users: AppUser[],
  standardBehaviors: StandardConductBehavior[],
  accessGrants: StudentAccessGrant[] = []
): {
  studentsBytes: number;
  conductLogsBytes: number;
  usersBytes: number;
  behaviorsBytes: number;
  grantsBytes: number;
  totalBytes: number;
  totalMb: number;
  totalDocs: number;
} {
  // Approximate document overhead in Firestore is ~100 bytes per document for index and metadata
  const DOC_OVERHEAD = 100;

  const studentsStr = JSON.stringify(students);
  const studentsBytes = new Blob([studentsStr]).size + students.length * DOC_OVERHEAD;

  const logsStr = JSON.stringify(conductLogs);
  const conductLogsBytes = new Blob([logsStr]).size + conductLogs.length * DOC_OVERHEAD;

  const usersStr = JSON.stringify(users);
  const usersBytes = new Blob([usersStr]).size + users.length * DOC_OVERHEAD;

  const behaviorsStr = JSON.stringify(standardBehaviors);
  const behaviorsBytes = new Blob([behaviorsStr]).size + standardBehaviors.length * DOC_OVERHEAD;

  const grantsStr = JSON.stringify(accessGrants);
  const grantsBytes = new Blob([grantsStr]).size + accessGrants.length * DOC_OVERHEAD;

  const totalBytes = studentsBytes + conductLogsBytes + usersBytes + behaviorsBytes + grantsBytes;
  const totalMb = +(totalBytes / (1024 * 1024)).toFixed(3);
  const totalDocs = students.length + conductLogs.length + users.length + standardBehaviors.length + accessGrants.length;

  return {
    studentsBytes,
    conductLogsBytes,
    usersBytes,
    behaviorsBytes,
    grantsBytes,
    totalBytes,
    totalMb,
    totalDocs
  };
}

/**
 * Real Hourly Statistics (24 Hours: 00:00 - 23:00)
 * Aggregates actual conduct logs timestamped hours + recorded operations
 */
export interface RealHourlyDataPoint {
  hour: number;
  timeLabel: string;
  conductLogsCount: number;
  deductionsCount: number;
  additionsCount: number;
  readsCount: number;
  writesCount: number;
  deletesCount: number;
  readsLimit: number;
  isPeak: boolean;
}

export function computeRealHourlyStats(
  conductLogs: ConductLog[],
  selectedDateStr?: string
): RealHourlyDataPoint[] {
  const targetDate = selectedDateStr || getLocalDateString();
  const summaries = getStoredDailySummaries();
  const todaySummary = summaries[targetDate];

  // Initialize 24-hour bins
  const hourlyLogs: number[] = Array(24).fill(0);
  const hourlyDeductions: number[] = Array(24).fill(0);
  const hourlyAdditions: number[] = Array(24).fill(0);

  // Group real conductLogs by hour
  conductLogs.forEach((log) => {
    const rawDate = log.recordedAt || log.violationDate;
    if (!rawDate) return;
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return;
      const logDateStr = getLocalDateString(d);

      // If filtering by specific date, only match that date; otherwise include today or all logs if limited
      if (!selectedDateStr || logDateStr === selectedDateStr) {
        const h = d.getHours();
        if (h >= 0 && h < 24) {
          hourlyLogs[h]++;
          if (log.type === 'DEDUCT') {
            hourlyDeductions[h]++;
          } else {
            hourlyAdditions[h]++;
          }
        }
      }
    } catch {
      // ignore invalid date
    }
  });

  // Combine with tracked real operations
  const hourlyReads = todaySummary ? todaySummary.hourlyReads : Array(24).fill(0);
  const hourlyWrites = todaySummary ? todaySummary.hourlyWrites : Array(24).fill(0);
  const hourlyDeletes = todaySummary ? todaySummary.hourlyDeletes : Array(24).fill(0);

  // Find peak hour
  let maxActivity = 0;
  for (let h = 0; h < 24; h++) {
    const act = hourlyLogs[h] + hourlyReads[h] + hourlyWrites[h];
    if (act > maxActivity) maxActivity = act;
  }

  const result: RealHourlyDataPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const act = hourlyLogs[h] + hourlyReads[h] + hourlyWrites[h];
    result.push({
      hour: h,
      timeLabel: `${String(h).padStart(2, '0')}:00`,
      conductLogsCount: hourlyLogs[h],
      deductionsCount: hourlyDeductions[h],
      additionsCount: hourlyAdditions[h],
      readsCount: hourlyReads[h] || 0,
      writesCount: hourlyWrites[h] || 0,
      deletesCount: hourlyDeletes[h] || 0,
      readsLimit: FIRESTORE_FREE_TIER.DAILY_READS_LIMIT,
      isPeak: maxActivity > 0 && act === maxActivity
    });
  }

  return result;
}

/**
 * Real Daily Statistics (Past 7 or 14 days)
 */
export interface RealDailyDataPoint {
  date: string;
  dayName: string;
  conductLogsCount: number;
  deductionsCount: number;
  additionsCount: number;
  pointsDeducted: number;
  pointsAdded: number;
  readsCount: number;
  writesCount: number;
  deletesCount: number;
  readsPercent: number;
  writesPercent: number;
  isToday: boolean;
}

const THAI_DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export function computeRealDailyStats(
  conductLogs: ConductLog[],
  daysCount: number = 7
): RealDailyDataPoint[] {
  const summaries = getStoredDailySummaries();
  const todayStr = getLocalDateString();

  // Create date range for past N days
  const result: RealDailyDataPoint[] = [];
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = getLocalDateString(d);
    const dayName = THAI_DAY_NAMES[d.getDay()];

    // Count real conduct logs on this date
    let logsCount = 0;
    let deductCount = 0;
    let addCount = 0;
    let ptsDeduct = 0;
    let ptsAdd = 0;

    conductLogs.forEach((log) => {
      const rawDate = log.recordedAt || log.violationDate;
      if (!rawDate) return;
      try {
        const logDate = new Date(rawDate);
        if (getLocalDateString(logDate) === dateStr) {
          logsCount++;
          if (log.type === 'DEDUCT') {
            deductCount++;
            ptsDeduct += Number(log.points) || 0;
          } else {
            addCount++;
            ptsAdd += Number(log.points) || 0;
          }
        }
      } catch {}
    });

    const sum = summaries[dateStr];
    const reads = sum ? sum.reads : 0;
    // Real writes: sum writes + conduct logs count * 2 (log + student)
    const writes = sum ? sum.writes : (logsCount * 2);
    const deletes = sum ? sum.deletes : 0;

    result.push({
      date: dateStr,
      dayName: `${dayName} (${d.getDate()}/${d.getMonth() + 1})`,
      conductLogsCount: logsCount,
      deductionsCount: deductCount,
      additionsCount: addCount,
      pointsDeducted: ptsDeduct,
      pointsAdded: ptsAdd,
      readsCount: reads,
      writesCount: writes,
      deletesCount: deletes,
      readsPercent: +((reads / FIRESTORE_FREE_TIER.DAILY_READS_LIMIT) * 100).toFixed(2),
      writesPercent: +((writes / FIRESTORE_FREE_TIER.DAILY_WRITES_LIMIT) * 100).toFixed(2),
      isToday: dateStr === todayStr
    });
  }

  return result;
}

/**
 * Real Weekly Statistics (Past 4 Weeks)
 */
export interface RealWeeklyDataPoint {
  weekKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  conductLogsCount: number;
  deductionsCount: number;
  additionsCount: number;
  pointsDeducted: number;
  pointsAdded: number;
  totalReads: number;
  totalWrites: number;
  avgReadsPerDay: number;
}

export function computeRealWeeklyStats(
  conductLogs: ConductLog[]
): RealWeeklyDataPoint[] {
  const summaries = getStoredDailySummaries();
  const now = new Date();
  const result: RealWeeklyDataPoint[] = [];

  for (let w = 3; w >= 0; w--) {
    const end = new Date(now);
    end.setDate(now.getDate() - (w * 7));
    const start = new Date(end);
    start.setDate(end.getDate() - 6);

    const startStr = getLocalDateString(start);
    const endStr = getLocalDateString(end);

    let logsCount = 0;
    let deductCount = 0;
    let addCount = 0;
    let ptsDeduct = 0;
    let ptsAdd = 0;
    let reads = 0;
    let writes = 0;

    // Check conduct logs in range
    conductLogs.forEach((log) => {
      const rawDate = log.recordedAt || log.violationDate;
      if (!rawDate) return;
      try {
        const d = new Date(rawDate);
        const dStr = getLocalDateString(d);
        if (dStr >= startStr && dStr <= endStr) {
          logsCount++;
          if (log.type === 'DEDUCT') {
            deductCount++;
            ptsDeduct += Number(log.points) || 0;
          } else {
            addCount++;
            ptsAdd += Number(log.points) || 0;
          }
        }
      } catch {}
    });

    // Check daily summaries in range
    Object.keys(summaries).forEach((dStr) => {
      if (dStr >= startStr && dStr <= endStr) {
        reads += summaries[dStr].reads || 0;
        writes += summaries[dStr].writes || 0;
      }
    });

    if (writes === 0 && logsCount > 0) {
      writes = logsCount * 2;
    }

    result.push({
      weekKey: `W${4 - w}`,
      weekLabel: `สัปดาห์ที่ ${4 - w} (${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1})`,
      startDate: startStr,
      endDate: endStr,
      conductLogsCount: logsCount,
      deductionsCount: deductCount,
      additionsCount: addCount,
      pointsDeducted: ptsDeduct,
      pointsAdded: ptsAdd,
      totalReads: reads,
      totalWrites: writes,
      avgReadsPerDay: Math.round(reads / 7)
    });
  }

  return result;
}

/**
 * Real Monthly Statistics (12 Months)
 */
export interface RealMonthlyDataPoint {
  monthKey: string;
  monthName: string;
  year: number;
  conductLogsCount: number;
  deductionsCount: number;
  additionsCount: number;
  pointsDeducted: number;
  pointsAdded: number;
  totalReads: number;
  totalWrites: number;
}

const THAI_MONTH_NAMES = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export function computeRealMonthlyStats(
  conductLogs: ConductLog[]
): RealMonthlyDataPoint[] {
  const summaries = getStoredDailySummaries();
  const now = new Date();
  const currentYear = now.getFullYear();

  // Create 12 months array
  const result: RealMonthlyDataPoint[] = [];

  for (let m = 0; m < 12; m++) {
    const monthIndex = m; // 0 = Jan, 11 = Dec
    const monthName = THAI_MONTH_NAMES[monthIndex];
    const monthPrefix = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}`;

    let logsCount = 0;
    let deductCount = 0;
    let addCount = 0;
    let ptsDeduct = 0;
    let ptsAdd = 0;
    let reads = 0;
    let writes = 0;

    conductLogs.forEach((log) => {
      const rawDate = log.recordedAt || log.violationDate;
      if (!rawDate) return;
      try {
        const d = new Date(rawDate);
        if (d.getFullYear() === currentYear && d.getMonth() === monthIndex) {
          logsCount++;
          if (log.type === 'DEDUCT') {
            deductCount++;
            ptsDeduct += Number(log.points) || 0;
          } else {
            addCount++;
            ptsAdd += Number(log.points) || 0;
          }
        }
      } catch {}
    });

    Object.keys(summaries).forEach((dStr) => {
      if (dStr.startsWith(monthPrefix)) {
        reads += summaries[dStr].reads || 0;
        writes += summaries[dStr].writes || 0;
      }
    });

    if (writes === 0 && logsCount > 0) {
      writes = logsCount * 2;
    }

    result.push({
      monthKey: `${currentYear}-${monthIndex + 1}`,
      monthName: `${monthName} ${currentYear + 543}`,
      year: currentYear + 543,
      conductLogsCount: logsCount,
      deductionsCount: deductCount,
      additionsCount: addCount,
      pointsDeducted: ptsDeduct,
      pointsAdded: ptsAdd,
      totalReads: reads,
      totalWrites: writes
    });
  }

  return result;
}

/**
 * Top Behaviors Recorded in Reality
 */
export interface TopBehaviorStat {
  behaviorTitle: string;
  category: string;
  type: 'DEDUCT' | 'ADD';
  count: number;
  totalPoints: number;
}

export function computeTopRealBehaviors(conductLogs: ConductLog[], limit: number = 8): TopBehaviorStat[] {
  const map = new Map<string, TopBehaviorStat>();

  conductLogs.forEach((log) => {
    const title = log.behaviorTitle || log.reason || 'พฤติกรรมทั่วไป';
    const existing = map.get(title);
    if (existing) {
      existing.count++;
      existing.totalPoints += Number(log.points) || 0;
    } else {
      map.set(title, {
        behaviorTitle: title,
        category: log.category || 'ทั่วไป',
        type: log.type,
        count: 1,
        totalPoints: Number(log.points) || 0
      });
    }
  });

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Real Stats by Grade Level (ม.1 - ม.6)
 */
export interface GradeLevelUsageStat {
  grade: string;
  studentsCount: number;
  conductLogsCount: number;
  deductionsCount: number;
  additionsCount: number;
  avgScore: number;
}

export function computeRealGradeStats(
  students: Student[],
  conductLogs: ConductLog[],
  academicYear: number = 2569
): GradeLevelUsageStat[] {
  const grades = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

  return grades.map((g) => {
    const gradeStudents = students.filter((s) => {
      const { grade } = calculateStudentGrade(s.entryYear, s.entryLevel, academicYear);
      return grade === g;
    });
    const studentIds = new Set(gradeStudents.map((s) => s.id));

    let logsCount = 0;
    let deductions = 0;
    let additions = 0;

    conductLogs.forEach((log) => {
      if (studentIds.has(log.studentId)) {
        logsCount++;
        if (log.type === 'DEDUCT') deductions++;
        else additions++;
      }
    });

    const totalScore = gradeStudents.reduce((acc, s) => acc + (Number(s.currentScore) || 0), 0);
    const avgScore = gradeStudents.length > 0 ? +(totalScore / gradeStudents.length).toFixed(1) : 100;

    return {
      grade: g,
      studentsCount: gradeStudents.length,
      conductLogsCount: logsCount,
      deductionsCount: deductions,
      additionsCount: additions,
      avgScore
    };
  });
}
