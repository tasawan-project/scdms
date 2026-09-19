/**
 * Database Usage Simulator Logic & Mathematical Model
 * Cloud Firestore vs Realtime Database (RTDB) Free Tier (Spark Plan)
 */

export interface SimulatorParams {
  totalStudentsInDb: number; // จำนวนนักเรียนทั้งหมดในระบบ (เช่น 500 - 2,500)
  activeStudentsPerDay: number; // นักเรียนที่เข้าใช้งานต่อวัน
  lookupsPerStudent: number; // จำนวนครั้งที่นักเรียนค้นหา/ตรวจคะแนนตนเอง
  activeStaffPerDay: number; // ครู/เจ้าหน้าที่ที่เข้าสู่ระบบ
  conductActionsPerDay: number; // การบันทึกหัก/เพิ่มคะแนนต่อวัน
  reportsGeneratedPerDay: number; // การเปิดดูรายงานชั้นเรียน/สรุปผล
  enableRealtimeListeners: boolean; // มีการเปิด realtime onSnapshot สำหรับกระดานคะแนนสดหรือไม่
  batchImportsCount: number; // จำนวนแถวนำเข้านักเรียนหรือคะแนนแบบกลุ่ม
  photoUploadsCount: number; // จำนวนการอัปเดตรูปถ่าย
}

export interface SimulationResult {
  firestore: {
    reads: number;
    writes: number;
    deletes: number;
    readsLimit: number; // 50,000
    writesLimit: number; // 20,000
    deletesLimit: number; // 20,000
    readsPercent: number;
    writesPercent: number;
    deletesPercent: number;
    estimatedStorageMb: number;
    estimatedDailyEgressMb: number;
    quotaStatus: 'SAFE' | 'WARNING' | 'EXCEEDED';
    estimatedBlazeCostThb: number; // ถ้าเกินโควต้าฟรี จะต้องเสียประมาณกี่บาท
  };
  realtimeDb: {
    peakConnections: number;
    connectionsLimit: number; // 100
    connectionsPercent: number;
    dailyBandwidthMb: number;
    monthlyBandwidthGb: number;
    monthlyBandwidthLimitGb: number; // 10 GB
    bandwidthPercent: number;
    estimatedStorageMb: number;
    quotaStatus: 'SAFE' | 'WARNING' | 'EXCEEDED';
    estimatedBlazeCostThb: number;
  };
}

export type ScenarioKey =
  | 'NORMAL_DAY'
  | 'REPORT_DAY'
  | 'EXAM_WEEK'
  | 'SEMESTER_START'
  | 'CUSTOM';

export interface ScenarioPreset {
  key: ScenarioKey;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  params: SimulatorParams;
}

export const FIRESTORE_FREE_TIER = {
  DAILY_READS: 50000,
  DAILY_WRITES: 20000,
  DAILY_DELETES: 20000,
  STORAGE_GB: 1,
  MONTHLY_EGRESS_GB: 10,
  READ_COST_PER_100K_USD: 0.06,
  WRITE_COST_PER_100K_USD: 0.18,
  DELETE_COST_PER_100K_USD: 0.02,
  THB_PER_USD: 35.0
};

export const RTDB_FREE_TIER = {
  CONCURRENT_CONNECTIONS: 100,
  STORAGE_GB: 1,
  MONTHLY_DOWNLOAD_GB: 10,
  DOWNLOAD_COST_PER_GB_USD: 1.0,
  THB_PER_USD: 35.0
};

export const SCENARIO_PRESETS: Record<ScenarioKey, ScenarioPreset> = {
  NORMAL_DAY: {
    key: 'NORMAL_DAY',
    name: 'วันเรียนปกติทั่วไป (Normal Day)',
    badge: 'ปกติ (Green)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'นักเรียนเช็คคะแนนประปราย ครูประจำชั้นบันทึกการเข้าแถว/มาสาย และตัดคะแนนพฤติกรรมประจำวัน',
    params: {
      totalStudentsInDb: 800,
      activeStudentsPerDay: 120,
      lookupsPerStudent: 1.5,
      activeStaffPerDay: 20,
      conductActionsPerDay: 35,
      reportsGeneratedPerDay: 5,
      enableRealtimeListeners: false,
      batchImportsCount: 0,
      photoUploadsCount: 0
    }
  },
  REPORT_DAY: {
    key: 'REPORT_DAY',
    name: 'วันประกาศผลคะแนน / ตรวจความประพฤติ (Peak Traffic)',
    badge: 'ทราฟฟิกสูง (Amber)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'ช่วงประกาศคะแนนก่อนสอบปลายภาค นักเรียนและผู้ปกครองแห่เข้าตรวจคะแนนตนเองพร้อมกัน',
    params: {
      totalStudentsInDb: 800,
      activeStudentsPerDay: 650,
      lookupsPerStudent: 3.5,
      activeStaffPerDay: 45,
      conductActionsPerDay: 80,
      reportsGeneratedPerDay: 25,
      enableRealtimeListeners: true,
      batchImportsCount: 0,
      photoUploadsCount: 0
    }
  },
  EXAM_WEEK: {
    key: 'EXAM_WEEK',
    name: 'สัปดาห์ตัดเกรด & ประชุมผู้ปกครอง (Grading Week)',
    badge: 'รายงานเข้มข้น (Blue)',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'ครูประจำชั้นทุกห้องดึงรายงานสรุปรายชั้น พิมพ์ใบความประพฤติ และบันทึกคะแนนสะสมจิตอาสา',
    params: {
      totalStudentsInDb: 800,
      activeStudentsPerDay: 300,
      lookupsPerStudent: 2.0,
      activeStaffPerDay: 55,
      conductActionsPerDay: 250,
      reportsGeneratedPerDay: 80,
      enableRealtimeListeners: false,
      batchImportsCount: 0,
      photoUploadsCount: 5
    }
  },
  SEMESTER_START: {
    key: 'SEMESTER_START',
    name: 'เปิดภาคเรียนใหม่ & นำเข้าข้อมูลใหญ่ (Bulk Import)',
    badge: 'เขียนข้อมูลสูง (Purple)',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'นำเข้ารายชื่อนักเรียนใหม่ ม.1 และ ม.4 จาก Excel (หลายร้อยคน) อัปโหลดรูปภาพ และตั้งค่าปีการศึกษา',
    params: {
      totalStudentsInDb: 1000,
      activeStudentsPerDay: 180,
      lookupsPerStudent: 1.2,
      activeStaffPerDay: 30,
      conductActionsPerDay: 20,
      reportsGeneratedPerDay: 15,
      enableRealtimeListeners: false,
      batchImportsCount: 350,
      photoUploadsCount: 150
    }
  },
  CUSTOM: {
    key: 'CUSTOM',
    name: 'กำหนดสถานการณ์เอง (Custom Parameters)',
    badge: 'กำหนดเอง (Slate)',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    description: 'ปรับเปลี่ยนตัวแปรต่างๆ ได้อย่างอิสระเพื่อประเมินความสามารถรองรับของระบบ',
    params: {
      totalStudentsInDb: 800,
      activeStudentsPerDay: 200,
      lookupsPerStudent: 2,
      activeStaffPerDay: 25,
      conductActionsPerDay: 50,
      reportsGeneratedPerDay: 10,
      enableRealtimeListeners: false,
      batchImportsCount: 0,
      photoUploadsCount: 0
    }
  }
};

/**
 * คำนวณจำนวน Operations ของ Cloud Firestore และ Realtime Database
 */
export function calculateSimulation(params: SimulatorParams): SimulationResult {
  // 1. FIRESTORE READS CALCULATION
  // ก. การเปิดหน้าเว็บและโหลดข้อมูลตั้งต้น: settings(1), behaviors(~30), users(~5) = 36 reads ต่อ user session
  const totalSessions = params.activeStudentsPerDay + params.activeStaffPerDay;
  const initialAppLoadReads = totalSessions * 15; // แคชบางส่วนช่วยลด read จาก 36 เหลือเฉลี่ย 15

  // ข. การค้นหาตรวจคะแนนรายบุคคล: 1 doc student + ~5 docs conduct_logs = 6 reads ต่อการค้นหา
  const lookupReads = params.activeStudentsPerDay * params.lookupsPerStudent * 6;

  // ค. ครูเข้าดู Dashboard / รายชื่อนักเรียน (แบ่งหน้าครั้งละ 25-50 คน เฉลี่ย 35 docs ต่อ view)
  const staffDashboardViews = params.activeStaffPerDay * 4; // ครู 1 คนเปิดดู dashboard เฉลี่ย 4 ครั้ง
  const staffBrowseReads = staffDashboardViews * 35;

  // ง. การออกรายงานระดับชั้น / โรงเรียน (ดึงข้อมูลนักเรียนทั้งระดับชั้น เช่น 150-300 คน + logs)
  const reportReads = params.reportsGeneratedPerDay * 180;

  // จ. Realtime Listener overhead (ถ้าเปิด onSnapshot จะมีการ sync ข้อมูลเมื่อมีการเปลี่ยนแปลง)
  const realtimeListenerReads = params.enableRealtimeListeners
    ? params.conductActionsPerDay * (params.activeStaffPerDay * 0.4) * 20
    : 0;

  const totalReads = Math.round(
    initialAppLoadReads + lookupReads + staffBrowseReads + reportReads + realtimeListenerReads
  );

  // 2. FIRESTORE WRITES CALCULATION
  // ก. การบันทึกหัก/เพิ่มคะแนน: 1 write ใน conduct_logs + 1 update write ใน students (คะแนนคงเหลือ/สำรอง) = 2 writes
  const conductWrites = params.conductActionsPerDay * 2;

  // ข. การนำเข้าข้อมูลแบบ Batch (เช่น เพิ่มนักเรียนใหม่จาก Excel) = 1 write ต่อนักเรียน 1 คน
  const batchWrites = params.batchImportsCount;

  // ค. การอัปเดตรูปภาพ = 1 write ต่อนักเรียน
  const photoWrites = params.photoUploadsCount;

  // ง. การตั้งค่าระบบ หรือการมอบสิทธิ์นักเรียน
  const miscellaneousWrites = Math.round(params.activeStaffPerDay * 0.5);

  const totalWrites = Math.round(conductWrites + batchWrites + photoWrites + miscellaneousWrites);

  // 3. FIRESTORE DELETES CALCULATION
  // การลบรายการประวัติ หรือลบข้อมูลผิดพลาด (~3% ของจำนวนการทำรายการ)
  const totalDeletes = Math.round(params.conductActionsPerDay * 0.03 + (params.batchImportsCount > 0 ? 2 : 0));

  // 4. STORAGE & BANDWIDTH ESTIMATES
  // เอกสารนักเรียน ~1.2 KB, เอกสาร conduct_log ~0.8 KB
  const estimatedStorageMb = Number(
    ((params.totalStudentsInDb * 1.5 + params.totalStudentsInDb * 5 * 0.8) / 1024).toFixed(2)
  );
  // Firestore egress: ~2 KB ต่อ read doc
  const estimatedDailyEgressMb = Number(((totalReads * 2) / 1024).toFixed(2));

  // คำนวณเปอร์เซ็นต์โควต้าฟรี Firestore
  const readsPercent = Number(((totalReads / FIRESTORE_FREE_TIER.DAILY_READS) * 100).toFixed(1));
  const writesPercent = Number(((totalWrites / FIRESTORE_FREE_TIER.DAILY_WRITES) * 100).toFixed(1));
  const deletesPercent = Number(((totalDeletes / FIRESTORE_FREE_TIER.DAILY_DELETES) * 100).toFixed(1));

  let firestoreStatus: 'SAFE' | 'WARNING' | 'EXCEEDED' = 'SAFE';
  if (readsPercent >= 100 || writesPercent >= 100) {
    firestoreStatus = 'EXCEEDED';
  } else if (readsPercent >= 75 || writesPercent >= 75) {
    firestoreStatus = 'WARNING';
  }

  // คำนวณค่าบริการส่วนเกินหากอัปเกรดเป็น Blaze (ถ้าไม่เกิน = 0 บาท)
  const excessReads = Math.max(0, totalReads - FIRESTORE_FREE_TIER.DAILY_READS);
  const excessWrites = Math.max(0, totalWrites - FIRESTORE_FREE_TIER.DAILY_WRITES);
  const firestoreExcessUsd =
    (excessReads / 100000) * FIRESTORE_FREE_TIER.READ_COST_PER_100K_USD +
    (excessWrites / 100000) * FIRESTORE_FREE_TIER.WRITE_COST_PER_100K_USD;
  const estimatedBlazeCostThb = Number(
    (firestoreExcessUsd * FIRESTORE_FREE_TIER.THB_PER_USD).toFixed(2)
  );

  // -------------------------------------------------------------
  // 5. REALTIME DATABASE (RTDB) CALCULATIONS
  // RTDB ไม่คิดเงินเป็นรายเอกสาร Read/Write! แต่จำกัด 100 Simultaneous Connections และ 10 GB Bandwidth/เดือน
  // -------------------------------------------------------------
  // ก. Peak Concurrent Connections (สัดส่วนผู้ใช้พร้อมกันสูงสุดในช่วง Peak เช่น 15-25% ของ Daily Active Users)
  const peakConcurrencyRate = params.enableRealtimeListeners ? 0.28 : 0.18;
  const peakConnections = Math.round(
    (params.activeStudentsPerDay + params.activeStaffPerDay) * peakConcurrencyRate
  );
  const connectionsPercent = Number(
    ((peakConnections / RTDB_FREE_TIER.CONCURRENT_CONNECTIONS) * 100).toFixed(1)
  );

  // ข. RTDB Bandwidth (ดาวน์โหลด JSON tree)
  // ใน RTDB การ query node มักส่งก้อน JSON ขนาดใหญ่กว่า Firestore field selection
  // นักเรียน 1 ครั้งดูข้อมูล: ~15 KB (profile + logs)
  // ครูเปิดดูทั้งห้อง: ~250 KB ต่อห้อง
  // ครูเปิดรายงานทั้งโรงเรียน: ~1.2 MB
  const rtdbLookupMb = (params.activeStudentsPerDay * params.lookupsPerStudent * 18) / 1024;
  const rtdbStaffMb = (staffDashboardViews * 180) / 1024;
  const rtdbReportMb = (params.reportsGeneratedPerDay * 900) / 1024;
  const dailyBandwidthMb = Number((rtdbLookupMb + rtdbStaffMb + rtdbReportMb).toFixed(1));
  const monthlyBandwidthGb = Number(((dailyBandwidthMb * 30) / 1024).toFixed(2));
  const bandwidthPercent = Number(
    ((monthlyBandwidthGb / RTDB_FREE_TIER.MONTHLY_DOWNLOAD_GB) * 100).toFixed(1)
  );

  let rtdbStatus: 'SAFE' | 'WARNING' | 'EXCEEDED' = 'SAFE';
  if (connectionsPercent >= 100 || bandwidthPercent >= 100) {
    rtdbStatus = 'EXCEEDED';
  } else if (connectionsPercent >= 75 || bandwidthPercent >= 75) {
    rtdbStatus = 'WARNING';
  }

  const excessRtdbGb = Math.max(0, monthlyBandwidthGb - RTDB_FREE_TIER.MONTHLY_DOWNLOAD_GB);
  const rtdbExcessThb = Number(
    (excessRtdbGb * RTDB_FREE_TIER.DOWNLOAD_COST_PER_GB_USD * RTDB_FREE_TIER.THB_PER_USD).toFixed(2)
  );

  return {
    firestore: {
      reads: totalReads,
      writes: totalWrites,
      deletes: totalDeletes,
      readsLimit: FIRESTORE_FREE_TIER.DAILY_READS,
      writesLimit: FIRESTORE_FREE_TIER.DAILY_WRITES,
      deletesLimit: FIRESTORE_FREE_TIER.DAILY_DELETES,
      readsPercent,
      writesPercent,
      deletesPercent,
      estimatedStorageMb,
      estimatedDailyEgressMb,
      quotaStatus: firestoreStatus,
      estimatedBlazeCostThb
    },
    realtimeDb: {
      peakConnections,
      connectionsLimit: RTDB_FREE_TIER.CONCURRENT_CONNECTIONS,
      connectionsPercent,
      dailyBandwidthMb,
      monthlyBandwidthGb,
      monthlyBandwidthLimitGb: RTDB_FREE_TIER.MONTHLY_DOWNLOAD_GB,
      bandwidthPercent,
      estimatedStorageMb,
      quotaStatus: rtdbStatus,
      estimatedBlazeCostThb: rtdbExcessThb
    }
  };
}

/**
 * การจำลองแบ่งตามช่วงเวลาใน 1 วัน (Hourly / Time Periods)
 */
export interface HourlyDataPoint {
  timeLabel: string;
  hour: number;
  periodName: string;
  activeUsers: number;
  firestoreReads: number;
  firestoreWrites: number;
  firestoreDeletes: number;
  readsQuotaPercent: number; // % เทียบกับ 50,000 สะสม
  cumulativeReads: number;
  rtdbConnections: number;
  rtdbBandwidthMb: number;
  isPeak: boolean;
}

export function generateHourlySimulation(params: SimulatorParams): HourlyDataPoint[] {
  // สัดส่วนทราฟฟิก 24 ชม. ของโรงเรียน
  // 07:00-08:00 เป็นช่วงเช็คชื่อหน้าประตู / มาสาย (Peak 1)
  // 11:30-13:00 พักเที่ยง (Peak 2)
  // 15:30-17:00 หลังเลิกเรียน ครูสรุปคะแนน (Peak 3)
  const hourlyWeights: { hour: number; label: string; period: string; weight: number; isPeak?: boolean }[] = [
    { hour: 6, label: '06:00', period: 'เช้าตรู่', weight: 0.01 },
    { hour: 7, label: '07:00', period: 'เข้าแถว/หน้าประตู (Peak เช็คสาย)', weight: 0.16, isPeak: true },
    { hour: 8, label: '08:00', period: 'โฮมรูม/เริ่มคาบ 1', weight: 0.10 },
    { hour: 9, label: '09:00', period: 'คาบเรียนเช้า', weight: 0.05 },
    { hour: 10, label: '10:00', period: 'คาบเรียนเช้า', weight: 0.04 },
    { hour: 11, label: '11:00', period: 'ก่อนพักกลางวัน', weight: 0.06 },
    { hour: 12, label: '12:00', period: 'พักกลางวัน (Peak ตรวจคะแนน)', weight: 0.14, isPeak: true },
    { hour: 13, label: '13:00', period: 'คาบเรียนบ่าย', weight: 0.05 },
    { hour: 14, label: '14:00', period: 'คาบเรียนบ่าย', weight: 0.04 },
    { hour: 15, label: '15:00', period: 'คาบสุดท้าย', weight: 0.06 },
    { hour: 16, label: '16:00', period: 'เลิกเรียน (Peak ครูสรุปคะแนน)', weight: 0.15, isPeak: true },
    { hour: 17, label: '17:00', period: 'กิจกรรมหลังเลิกเรียน', weight: 0.05 },
    { hour: 18, label: '18:00', period: 'ช่วงเย็น', weight: 0.03 },
    { hour: 19, label: '19:00', period: 'หัวค่ำ (ผู้ปกครองตรวจ)', weight: 0.03 },
    { hour: 20, label: '20:00', period: 'ค่ำ', weight: 0.02 },
    { hour: 21, label: '21:00', period: 'ดึก', weight: 0.01 }
  ];

  const dailyResult = calculateSimulation(params);
  let runningReads = 0;

  return hourlyWeights.map(item => {
    const hourReads = Math.round(dailyResult.firestore.reads * item.weight);
    const hourWrites = Math.round(dailyResult.firestore.writes * item.weight);
    const hourDeletes = Math.round(dailyResult.firestore.deletes * item.weight);
    const hourUsers = Math.round(
      (params.activeStudentsPerDay + params.activeStaffPerDay) * item.weight * (item.isPeak ? 2.5 : 1.2)
    );
    const hourConnections = Math.round(
      dailyResult.realtimeDb.peakConnections * (item.weight / 0.16)
    );
    const hourBandwidth = Number((dailyResult.realtimeDb.dailyBandwidthMb * item.weight).toFixed(2));

    runningReads += hourReads;
    const readsQuotaPercent = Number(
      ((runningReads / FIRESTORE_FREE_TIER.DAILY_READS) * 100).toFixed(1)
    );

    return {
      timeLabel: item.label,
      hour: item.hour,
      periodName: item.period,
      activeUsers: Math.max(1, hourUsers),
      firestoreReads: hourReads,
      firestoreWrites: hourWrites,
      firestoreDeletes: hourDeletes,
      readsQuotaPercent,
      cumulativeReads: runningReads,
      rtdbConnections: Math.min(250, hourConnections),
      rtdbBandwidthMb: hourBandwidth,
      isPeak: !!item.isPeak
    };
  });
}

/**
 * การจำลองรายวัน (Daily - 7 วัน หรือ 1 สัปดาห์)
 */
export interface DailyDataPoint {
  dayName: string;
  dayShort: string;
  dayType: 'WEEKDAY' | 'WEEKEND';
  activeUsers: number;
  firestoreReads: number;
  firestoreWrites: number;
  firestoreDeletes: number;
  readsQuotaPercent: number;
  writesQuotaPercent: number;
  rtdbPeakConnections: number;
  rtdbBandwidthMb: number;
  status: 'SAFE' | 'WARNING' | 'EXCEEDED';
}

export function generateDailySimulation(params: SimulatorParams): DailyDataPoint[] {
  const days = [
    { dayName: 'วันจันทร์', dayShort: 'จ.', multiplier: 1.25, note: 'เข้าแถวใหญ่ ตรวจวินัยเข้ม' },
    { dayName: 'วันอังคาร', dayShort: 'อ.', multiplier: 0.95, note: 'วันเรียนปกติ' },
    { dayName: 'วันพุธ', dayShort: 'พ.', multiplier: 1.05, note: 'กิจกรรมพัฒนาผู้เรียน' },
    { dayName: 'วันพฤหัสบดี', dayShort: 'พฤ.', multiplier: 0.90, note: 'วันเรียนปกติ' },
    { dayName: 'วันศุกร์', dayShort: 'ศ.', multiplier: 1.15, note: 'สรุปประจำสัปดาห์ / ตัดคะแนนสะสม' },
    { dayName: 'วันเสาร์', dayShort: 'ส.', multiplier: 0.15, note: 'วันหยุด (เข้าดูประปราย)' },
    { dayName: 'วันอาทิตย์', dayShort: 'อา.', multiplier: 0.20, note: 'เตรียมตัวเปิดสัปดาห์ใหม่' }
  ];

  const baseResult = calculateSimulation(params);

  return days.map(d => {
    const isWeekend = d.multiplier < 0.3;
    const reads = Math.round(baseResult.firestore.reads * d.multiplier);
    const writes = Math.round(baseResult.firestore.writes * d.multiplier);
    const deletes = Math.round(baseResult.firestore.deletes * d.multiplier);
    const users = Math.round((params.activeStudentsPerDay + params.activeStaffPerDay) * d.multiplier);
    const connections = Math.round(baseResult.realtimeDb.peakConnections * (isWeekend ? 0.25 : d.multiplier));
    const bandwidth = Number((baseResult.realtimeDb.dailyBandwidthMb * d.multiplier).toFixed(1));

    const readsPct = Number(((reads / FIRESTORE_FREE_TIER.DAILY_READS) * 100).toFixed(1));
    const writesPct = Number(((writes / FIRESTORE_FREE_TIER.DAILY_WRITES) * 100).toFixed(1));

    let status: 'SAFE' | 'WARNING' | 'EXCEEDED' = 'SAFE';
    if (readsPct >= 100 || writesPct >= 100 || connections >= 100) {
      status = 'EXCEEDED';
    } else if (readsPct >= 75 || writesPct >= 75 || connections >= 75) {
      status = 'WARNING';
    }

    return {
      dayName: d.dayName,
      dayShort: d.dayShort,
      dayType: isWeekend ? 'WEEKEND' : 'WEEKDAY',
      activeUsers: Math.max(5, users),
      firestoreReads: reads,
      firestoreWrites: writes,
      firestoreDeletes: deletes,
      readsQuotaPercent: readsPct,
      writesQuotaPercent: writesPct,
      rtdbPeakConnections: connections,
      rtdbBandwidthMb: bandwidth,
      status
    };
  });
}

/**
 * การจำลองรายสัปดาห์ (Weekly - 4 สัปดาห์ของเดือน)
 */
export interface WeeklyDataPoint {
  weekName: string;
  weekRange: string;
  description: string;
  totalUsers: number;
  totalFirestoreReads: number;
  totalFirestoreWrites: number;
  totalFirestoreDeletes: number;
  avgDailyReads: number;
  avgDailyReadsPercent: number;
  rtdbBandwidthMb: number;
  status: 'SAFE' | 'WARNING' | 'EXCEEDED';
}

export function generateWeeklySimulation(params: SimulatorParams): WeeklyDataPoint[] {
  const weeks = [
    { name: 'สัปดาห์ที่ 1', range: '1-7 ของเดือน', mult: 0.90, desc: 'เปิดเดือนใหม่ ทราฟฟิกปานกลาง' },
    { name: 'สัปดาห์ที่ 2', range: '8-14 ของเดือน', mult: 1.00, desc: 'กิจกรรมโรงเรียนและการเรียนปกติ' },
    { name: 'สัปดาห์ที่ 3', range: '15-21 ของเดือน', mult: 1.20, desc: 'ติดตามกลุ่มวิกฤตและตรวจผลความประพฤติ' },
    { name: 'สัปดาห์ที่ 4', range: '22-28 ของเดือน', mult: 1.35, desc: 'สรุปรายงานประจำเดือนและออกเอกสาร' }
  ];

  const baseResult = calculateSimulation(params);

  return weeks.map(w => {
    // 5 วันเรียน + 2 วันหยุด = ~5.4 day equivalents
    const totalReads = Math.round(baseResult.firestore.reads * 5.4 * w.mult);
    const totalWrites = Math.round(baseResult.firestore.writes * 5.4 * w.mult);
    const totalDeletes = Math.round(baseResult.firestore.deletes * 5.4 * w.mult);
    const totalUsers = Math.round((params.activeStudentsPerDay + params.activeStaffPerDay) * 5.4 * w.mult);
    const avgDailyReads = Math.round(totalReads / 7);
    const avgDailyReadsPercent = Number(((avgDailyReads / FIRESTORE_FREE_TIER.DAILY_READS) * 100).toFixed(1));
    const rtdbBandwidthMb = Number((baseResult.realtimeDb.dailyBandwidthMb * 5.4 * w.mult).toFixed(1));

    let status: 'SAFE' | 'WARNING' | 'EXCEEDED' = 'SAFE';
    if (avgDailyReadsPercent >= 100) {
      status = 'EXCEEDED';
    } else if (avgDailyReadsPercent >= 75) {
      status = 'WARNING';
    }

    return {
      weekName: w.name,
      weekRange: w.range,
      description: w.desc,
      totalUsers,
      totalFirestoreReads: totalReads,
      totalFirestoreWrites: totalWrites,
      totalFirestoreDeletes: totalDeletes,
      avgDailyReads,
      avgDailyReadsPercent,
      rtdbBandwidthMb,
      status
    };
  });
}

/**
 * การจำลองรายเดือน (Monthly - 12 เดือนของปีการศึกษาไทย พ.ค. - เม.ย.)
 */
export interface MonthlyDataPoint {
  monthName: string;
  monthShort: string;
  academicTerm: string;
  eventType: string;
  activeUsersMonthly: number;
  monthlyFirestoreReads: number;
  monthlyFirestoreWrites: number;
  dailyAvgReads: number;
  dailyAvgReadsPercent: number;
  rtdbMonthlyBandwidthGb: number;
  rtdbBandwidthPercent: number;
  status: 'SAFE' | 'WARNING' | 'EXCEEDED';
}

export function generateMonthlySimulation(params: SimulatorParams): MonthlyDataPoint[] {
  const months = [
    { name: 'พฤษภาคม', short: 'พ.ค.', term: 'เทอม 1', mult: 1.5, event: 'เปิดเทอม 1 / นำเข้านักเรียนใหม่ ม.1/ม.4' },
    { name: 'มิถุนายน', short: 'มิ.ย.', term: 'เทอม 1', mult: 1.0, event: 'เรียนปกติ / จัดระเบียบแถว' },
    { name: 'กรกฎาคม', short: 'ก.ค.', term: 'เทอม 1', mult: 1.3, event: 'สอบกลางภาค / ตรวจคะแนนประเมินตนเอง' },
    { name: 'สิงหาคม', short: 'ส.ค.', term: 'เทอม 1', mult: 1.1, event: 'กิจกรรมวันสำคัญ / สะสมจิตอาสา' },
    { name: 'กันยายน', short: 'ก.ย.', term: 'เทอม 1', mult: 1.6, event: 'สอบปลายภาค 1 / สรุปเกรดความประพฤติ' },
    { name: 'ตุลาคม', short: 'ต.ค.', term: 'ปิดเทอม 1', mult: 0.25, event: 'ปิดภาคเรียนที่ 1' },
    { name: 'พฤศจิกายน', short: 'พ.ย.', term: 'เทอม 2', mult: 1.1, event: 'เปิดเทอม 2 / ตรวจสอบความพร้อม' },
    { name: 'ธันวาคม', short: 'ธ.ค.', term: 'เทอม 2', mult: 0.95, event: 'กิจกรรมสิ้นปี / กีฬาสี' },
    { name: 'มกราคม', short: 'ม.ค.', term: 'เทอม 2', mult: 1.2, event: 'สอบกลางภาค 2 / เตือนกลุ่มเสี่ยง' },
    { name: 'กุมภาพันธ์', short: 'ก.พ.', term: 'เทอม 2', mult: 1.7, event: 'เตรียมจบการศึกษา / ซ่อมแซมคะแนน' },
    { name: 'มีนาคม', short: 'มี.ค.', term: 'เทอม 2', mult: 1.8, event: 'สอบปลายภาค 2 / ออกใบ ปพ. / อนุมัติจบ' },
    { name: 'เมษายน', short: 'เม.ย.', term: 'ปิดเทอมใหญ่', mult: 0.20, event: 'ปิดภาคเรียนใหญ่ / เลื่อนชั้น' }
  ];

  const baseResult = calculateSimulation(params);

  return months.map(m => {
    // เดือนปกติมีประมาณ 22 วันทำการ
    const workingDays = m.mult < 0.3 ? 8 : 22;
    const monthlyReads = Math.round(baseResult.firestore.reads * workingDays * m.mult);
    const monthlyWrites = Math.round(baseResult.firestore.writes * workingDays * m.mult);
    const dailyAvgReads = Math.round(monthlyReads / 30);
    const dailyAvgReadsPct = Number(((dailyAvgReads / FIRESTORE_FREE_TIER.DAILY_READS) * 100).toFixed(1));
    const monthlyBandwidthGb = Number(
      ((baseResult.realtimeDb.dailyBandwidthMb * workingDays * m.mult) / 1024).toFixed(2)
    );
    const rtdbBwPercent = Number(
      ((monthlyBandwidthGb / RTDB_FREE_TIER.MONTHLY_DOWNLOAD_GB) * 100).toFixed(1)
    );

    let status: 'SAFE' | 'WARNING' | 'EXCEEDED' = 'SAFE';
    if (dailyAvgReadsPct >= 100 || rtdbBwPercent >= 100) {
      status = 'EXCEEDED';
    } else if (dailyAvgReadsPct >= 75 || rtdbBwPercent >= 75) {
      status = 'WARNING';
    }

    return {
      monthName: m.name,
      monthShort: m.short,
      academicTerm: m.term,
      eventType: m.event,
      activeUsersMonthly: Math.round(
        (params.activeStudentsPerDay + params.activeStaffPerDay) * workingDays * m.mult
      ),
      monthlyFirestoreReads: monthlyReads,
      monthlyFirestoreWrites: monthlyWrites,
      dailyAvgReads,
      dailyAvgReadsPercent: dailyAvgReadsPct,
      rtdbMonthlyBandwidthGb: monthlyBandwidthGb,
      rtdbBandwidthPercent: rtdbBwPercent,
      status
    };
  });
}
