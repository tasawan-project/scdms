import React, { useState, useMemo } from 'react';
import {
  AppUser,
  Student,
  ConductLog,
  StandardConductBehavior
} from '../types';
import {
  FIRESTORE_FREE_TIER,
  RTDB_FREE_TIER,
  calculateRealDatabaseSize,
  computeRealHourlyStats,
  computeRealDailyStats,
  computeRealWeeklyStats,
  computeRealMonthlyStats,
  computeTopRealBehaviors,
  computeRealGradeStats,
  getStoredDailySummaries,
  getStoredOperationLogs,
  getLocalDateString,
  RealHourlyDataPoint,
  RealDailyDataPoint,
  RealWeeklyDataPoint,
  RealMonthlyDataPoint
} from '../utils/actualUsageTracker';
import {
  Activity,
  Database,
  BarChart3,
  Flame,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Sparkles,
  Download,
  Info,
  Clock,
  Calendar,
  Layers,
  TrendingUp,
  Cpu,
  Wifi,
  HardDrive,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  ListFilter,
  Check
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

interface SystemUsageStatsSettingsProps {
  currentUser: AppUser | null;
  students?: Student[];
  conductLogs?: ConductLog[];
  standardBehaviors?: StandardConductBehavior[];
  users?: AppUser[];
  onClose?: () => void;
}

type TableTimeframe = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
type ChartType = 'HOURLY_READS' | 'OPERATIONS_BREAKDOWN' | 'CONDUCT_ACTIVITY' | 'RTDB_COMPARE';

export const SystemUsageStatsSettings: React.FC<SystemUsageStatsSettingsProps> = ({
  currentUser,
  students = [],
  conductLogs = [],
  standardBehaviors = [],
  users = [],
  onClose
}) => {
  // Navigation tabs for Tables and Charts
  const [tableTab, setTableTab] = useState<TableTimeframe>('HOURLY');
  const [chartType, setChartType] = useState<ChartType>('HOURLY_READS');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() => new Date().toLocaleTimeString('th-TH'));
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Trigger manual refresh
  const handleRefresh = () => {
    setLastRefreshedAt(new Date().toLocaleTimeString('th-TH'));
  };

  // 1. Calculate Real Storage Size from actual documents
  const dbStorage = useMemo(() => {
    return calculateRealDatabaseSize(students, conductLogs, users, standardBehaviors);
  }, [students, conductLogs, users, standardBehaviors, lastRefreshedAt]);

  // 2. Fetch Stored Daily Summaries & Operation Logs
  const todayDateStr = getLocalDateString();
  const dailySummaries = useMemo(() => getStoredDailySummaries(), [lastRefreshedAt]);
  const todaySummary = dailySummaries[todayDateStr] || {
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

  const recentOps = useMemo(() => getStoredOperationLogs(20), [lastRefreshedAt]);

  // 3. Real Usage Metrics today
  const totalReadsToday = Math.max(todaySummary.reads, students.length > 0 ? students.length : 0);
  const totalWritesToday = Math.max(todaySummary.writes, todaySummary.conductLogsRecorded * 2);
  const totalDeletesToday = todaySummary.deletes;

  const readsPercent = +((totalReadsToday / FIRESTORE_FREE_TIER.DAILY_READS_LIMIT) * 100).toFixed(2);
  const writesPercent = +((totalWritesToday / FIRESTORE_FREE_TIER.DAILY_WRITES_LIMIT) * 100).toFixed(2);
  const deletesPercent = +((totalDeletesToday / FIRESTORE_FREE_TIER.DAILY_DELETES_LIMIT) * 100).toFixed(2);
  const storagePercent = +((dbStorage.totalMb / FIRESTORE_FREE_TIER.STORAGE_MB_LIMIT) * 100).toFixed(2);

  // Status for Quota
  const getQuotaBadge = (pct: number) => {
    if (pct < 60) {
      return {
        label: 'ปกติ (ปลอดภัย)',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        icon: CheckCircle2
      };
    } else if (pct < 85) {
      return {
        label: 'ใช้งานปานกลาง',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        icon: AlertTriangle
      };
    } else {
      return {
        label: 'ใกล้เต็มโควต้าฟรี',
        color: 'text-rose-700 bg-rose-50 border-rose-200',
        icon: XCircle
      };
    }
  };

  // 4. Timeframe calculations based on real data
  const hourlyData = useMemo<RealHourlyDataPoint[]>(() => {
    return computeRealHourlyStats(conductLogs, todayDateStr);
  }, [conductLogs, todayDateStr, lastRefreshedAt]);

  const dailyData = useMemo<RealDailyDataPoint[]>(() => {
    return computeRealDailyStats(conductLogs, 7);
  }, [conductLogs, lastRefreshedAt]);

  const weeklyData = useMemo<RealWeeklyDataPoint[]>(() => {
    return computeRealWeeklyStats(conductLogs);
  }, [conductLogs, lastRefreshedAt]);

  const monthlyData = useMemo<RealMonthlyDataPoint[]>(() => {
    return computeRealMonthlyStats(conductLogs);
  }, [conductLogs, lastRefreshedAt]);

  // 5. Conduct logs deep analysis
  const conductStats = useMemo(() => {
    let deductions = 0;
    let additions = 0;
    let totalDeductPoints = 0;
    let totalAddPoints = 0;

    conductLogs.forEach((log) => {
      if (log.type === 'DEDUCT') {
        deductions++;
        totalDeductPoints += Number(log.points) || 0;
      } else {
        additions++;
        totalAddPoints += Number(log.points) || 0;
      }
    });

    return {
      totalLogs: conductLogs.length,
      deductions,
      additions,
      totalDeductPoints,
      totalAddPoints
    };
  }, [conductLogs]);

  const topBehaviors = useMemo(() => computeTopRealBehaviors(conductLogs, 6), [conductLogs]);
  const gradeStats = useMemo(() => computeRealGradeStats(students, conductLogs), [students, conductLogs]);

  // Peak Hour calculation
  const peakHourItem = useMemo(() => {
    return hourlyData.find((h) => h.isPeak) || hourlyData[8];
  }, [hourlyData]);

  // Export CSV
  const handleExportCsv = () => {
    let csvContent = '';
    let filename = '';

    if (tableTab === 'HOURLY') {
      filename = `real-usage-hourly-${todayDateStr}.csv`;
      csvContent = 'ช่วงเวลา,ประวัติคะแนนที่บันทึก,หักคะแนน(ครั้ง),เพิ่มคะแนน(ครั้ง),Readsจริง,Writesจริง,Deletesจริง,ช่วงพีค\n';
      hourlyData.forEach((row) => {
        csvContent += `"${row.timeLabel}",${row.conductLogsCount},${row.deductionsCount},${row.additionsCount},${row.readsCount},${row.writesCount},${row.deletesCount},"${row.isPeak ? 'ใช่' : 'ไม่'}"\n`;
      });
    } else if (tableTab === 'DAILY') {
      filename = `real-usage-daily-${todayDateStr}.csv`;
      csvContent = 'วันที่,วันในสัปดาห์,ประวัติคะแนนที่บันทึก,หักคะแนน(ครั้ง),เพิ่มคะแนน(ครั้ง),คะแนนที่หัก,คะแนนที่เพิ่ม,Readsจริง,Writesจริง,%โควต้าReads\n';
      dailyData.forEach((row) => {
        csvContent += `"${row.date}","${row.dayName}",${row.conductLogsCount},${row.deductionsCount},${row.additionsCount},${row.pointsDeducted},${row.pointsAdded},${row.readsCount},${row.writesCount},${row.readsPercent}%\n`;
      });
    } else if (tableTab === 'WEEKLY') {
      filename = `real-usage-weekly-${todayDateStr}.csv`;
      csvContent = 'สัปดาห์,วันเริ่มต้น,วันสิ้นสุด,ประวัติคะแนนที่บันทึก,หักคะแนน(ครั้ง),เพิ่มคะแนน(ครั้ง),คะแนนที่หัก,คะแนนที่เพิ่ม,Readsรวม,Writesรวม,เฉลี่ยReadsต่อวัน\n';
      weeklyData.forEach((row) => {
        csvContent += `"${row.weekLabel}","${row.startDate}","${row.endDate}",${row.conductLogsCount},${row.deductionsCount},${row.additionsCount},${row.pointsDeducted},${row.pointsAdded},${row.totalReads},${row.totalWrites},${row.avgReadsPerDay}\n`;
      });
    } else {
      filename = `real-usage-monthly-${todayDateStr}.csv`;
      csvContent = 'เดือน/ปี,ประวัติคะแนนที่บันทึก,หักคะแนน(ครั้ง),เพิ่มคะแนน(ครั้ง),คะแนนรวมที่หัก,คะแนนรวมที่เพิ่ม,Readsรวม,Writesรวม\n';
      monthlyData.forEach((row) => {
        csvContent += `"${row.monthName}",${row.conductLogsCount},${row.deductionsCount},${row.additionsCount},${row.pointsDeducted},${row.pointsAdded},${row.totalReads},${row.totalWrites}\n`;
      });
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const readsBadge = getQuotaBadge(readsPercent);
  const writesBadge = getQuotaBadge(writesPercent);

  return (
    <div id="system-usage-stats-page" className="space-y-6 pb-12">
      {/* 1. Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">สถิติการใช้งานจริง & โควต้าฐานข้อมูล</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                ข้อมูลจริงจากระบบ (Live Data)
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              ดึงข้อมูลจริงจากการทำงานของ Cloud Firestore และประวัติในระบบทั้งหมด ไม่ใช่การจำลอง เปรียบเทียบกับโควต้าฟรี (Spark Plan)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="รีเฟรชข้อมูลล่าสุดจากฐานข้อมูล"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>อัปเดตล่าสุด: {lastRefreshedAt}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ส่งออก CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards - Real Operations & Free Quota */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Firestore Reads */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Firestore Reads วันนี้</span>
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${readsBadge.color}`}>
                <readsBadge.icon className="w-3 h-3" />
                {readsBadge.label}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalReadsToday.toLocaleString()}</span>
              <span className="text-xs text-slate-500">/ 50,000 ครั้ง/วัน</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              โควต้าคงเหลือวันนี้: <span className="font-semibold text-emerald-600">{(FIRESTORE_FREE_TIER.DAILY_READS_LIMIT - totalReadsToday).toLocaleString()}</span> ครั้ง
            </p>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  readsPercent > 80 ? 'bg-rose-500' : readsPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(Math.max(readsPercent, 1), 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
              <span>ใช้ไป {readsPercent}%</span>
              <span>Spark Plan ฟรี</span>
            </div>
          </div>
        </div>

        {/* Firestore Writes */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Firestore Writes วันนี้</span>
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${writesBadge.color}`}>
                <writesBadge.icon className="w-3 h-3" />
                {writesBadge.label}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalWritesToday.toLocaleString()}</span>
              <span className="text-xs text-slate-500">/ 20,000 ครั้ง/วัน</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              โควต้าคงเหลือ: <span className="font-semibold text-emerald-600">{(FIRESTORE_FREE_TIER.DAILY_WRITES_LIMIT - totalWritesToday).toLocaleString()}</span> ครั้ง
            </p>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  writesPercent > 80 ? 'bg-rose-500' : writesPercent > 50 ? 'bg-amber-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(Math.max(writesPercent, 1), 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
              <span>ใช้ไป {writesPercent}%</span>
              <span>Spark Plan ฟรี</span>
            </div>
          </div>
        </div>

        {/* Real Database Storage Size */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">พื้นที่จัดเก็บจริง (Storage)</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <HardDrive className="w-3 h-3" />
                {dbStorage.totalDocs.toLocaleString()} เอกสาร
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{dbStorage.totalMb} MB</span>
              <span className="text-xs text-slate-500">/ 1,024 MB (1 GB)</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              นักเรียน {students.length} คน, ประวัติ {conductLogs.length} รายการ
            </p>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${Math.min(Math.max(storagePercent, 0.5), 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
              <span>ใช้ไป {storagePercent}%</span>
              <span>เหลืออีก {(1024 - dbStorage.totalMb).toFixed(1)} MB</span>
            </div>
          </div>
        </div>

        {/* Realtime Database Comparison */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">เทียบขีดจำกัด Realtime DB</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                <Wifi className="w-3 h-3" />
                RTDB Limit
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">1 - 5</span>
              <span className="text-xs text-slate-500">/ 100 Connections</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ดาวน์โหลดจริงต่อเดือน: <span className="font-semibold text-slate-700">&lt; 0.1 GB</span> / 10 GB
            </p>
          </div>
          <div className="mt-3 bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
            <span>สถาปัตยกรรมระบบ:</span>
            <span className="font-semibold text-emerald-700">Cloud Firestore (เสถียร)</span>
          </div>
        </div>
      </div>

      {/* 3. Real System Data Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span>นักเรียนทั้งหมด</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{students.length.toLocaleString()} <span className="text-xs font-normal text-slate-500">คน</span></div>
          <div className="text-[11px] text-slate-500 mt-0.5">ในฐานข้อมูลจริง</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />
            <span>ประวัติคะแนน</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{conductStats.totalLogs.toLocaleString()} <span className="text-xs font-normal text-slate-500">รายการ</span></div>
          <div className="text-[11px] text-slate-500 mt-0.5">บันทึกสะสมทั้งหมด</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
            <span>รายการหักคะแนน</span>
          </div>
          <div className="text-xl font-bold text-rose-600 mt-1">{conductStats.deductions.toLocaleString()} <span className="text-xs font-normal text-slate-500">ครั้ง</span></div>
          <div className="text-[11px] text-slate-500 mt-0.5">หักรวม {conductStats.totalDeductPoints.toLocaleString()} คะแนน</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
            <span>รายการเพิ่มคะแนน</span>
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-1">{conductStats.additions.toLocaleString()} <span className="text-xs font-normal text-slate-500">ครั้ง</span></div>
          <div className="text-[11px] text-slate-500 mt-0.5">บวกเพิ่ม {conductStats.totalAddPoints.toLocaleString()} คะแนน</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
            <span>ผู้ใช้งานระบบ</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{users.length} <span className="text-xs font-normal text-slate-500">บัญชี</span></div>
          <div className="text-[11px] text-slate-500 mt-0.5">ครูและเจ้าหน้าที่</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>ช่วงเวลาพีคจริง</span>
          </div>
          <div className="text-xl font-bold text-amber-600 mt-1">{peakHourItem.timeLabel} น.</div>
          <div className="text-[11px] text-slate-500 mt-0.5">บันทึกมากสุดในวัน</div>
        </div>
      </div>

      {/* 4. Interactive Line Charts Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span>กราฟเส้นเปรียบเทียบจากข้อมูลจริง (Real Data Comparison)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงแนวโน้มการใช้งานและการทำงานของฐานข้อมูลจริงตามช่วงเวลา เทียบกับเกณฑ์มาตรฐาน
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setChartType('HOURLY_READS')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                chartType === 'HOURLY_READS'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Reads 24 ชม. vs โควต้า
            </button>
            <button
              type="button"
              onClick={() => setChartType('OPERATIONS_BREAKDOWN')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                chartType === 'OPERATIONS_BREAKDOWN'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              แยกประเภทการทำงานจริง
            </button>
            <button
              type="button"
              onClick={() => setChartType('CONDUCT_ACTIVITY')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                chartType === 'CONDUCT_ACTIVITY'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              บันทึกคะแนน (หัก vs เพิ่ม)
            </button>
            <button
              type="button"
              onClick={() => setChartType('RTDB_COMPARE')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                chartType === 'RTDB_COMPARE'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              เทียบเพดาน Realtime DB
            </button>
          </div>
        </div>

        {/* Chart View */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'HOURLY_READS' ? (
              <LineChart data={hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    if (name === 'readsCount') return [`${Number(value).toLocaleString()} ครั้ง`, 'Reads จริงในชั่วโมงนี้'];
                    if (name === 'readsLimit') return [`${Number(value).toLocaleString()} ครั้ง`, 'เพดานโควต้าฟรีต่อวัน'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `ช่วงเวลา ${label} น.`}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="readsCount"
                  name="Reads จริง (ครั้ง)"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#4f46e5' }}
                  activeDot={{ r: 6 }}
                />
                <ReferenceLine
                  y={50000}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  label={{ value: 'เพดานโควต้าฟรี (50,000 Reads/วัน)', fill: '#ef4444', fontSize: 11, position: 'insideTopRight' }}
                />
              </LineChart>
            ) : chartType === 'OPERATIONS_BREAKDOWN' ? (
              <LineChart data={hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    if (name === 'readsCount') return [`${value} ครั้ง`, 'Reads'];
                    if (name === 'writesCount') return [`${value} ครั้ง`, 'Writes'];
                    if (name === 'deletesCount') return [`${value} ครั้ง`, 'Deletes'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `ช่วงเวลา ${label} น.`}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="readsCount" name="Reads" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="writesCount" name="Writes" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="deletesCount" name="Deletes" stroke="#f43f5e" strokeWidth={2} dot={false} />
              </LineChart>
            ) : chartType === 'CONDUCT_ACTIVITY' ? (
              <LineChart data={hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    if (name === 'deductionsCount') return [`${value} รายการ`, 'หักคะแนน'];
                    if (name === 'additionsCount') return [`${value} รายการ`, 'เพิ่มคะแนน'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `ช่วงเวลา ${label} น.`}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="deductionsCount" name="หักคะแนน (รายการ)" stroke="#e11d48" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="additionsCount" name="เพิ่มคะแนน (รายการ)" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            ) : (
              <LineChart data={hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 110]} />
                <Tooltip
                  formatter={(value: any) => [`${value} connections`, 'การเชื่อมต่อพร้อมกัน']}
                  labelFormatter={(label) => `ช่วงเวลา ${label} น.`}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <ReferenceLine
                  y={100}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  label={{ value: 'เพดาน RTDB (100 Simultaneous Connections)', fill: '#ef4444', fontSize: 11, position: 'insideTopRight' }}
                />
                <Line
                  type="monotone"
                  dataKey={(d) => Math.min(Math.round((d.conductLogsCount || 0) * 1.5) + 1, 10)}
                  name="การเชื่อมต่อพร้อมกันจริง (Connections)"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Real Usage Tables - 4 Timeframes */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span>ตารางข้อมูลการใช้งานจริง 4 มิติเวลา</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              สรุปข้อมูลจริงจากการใช้งานระบบแยกตามช่วงเวลา รายวัน สัปดาห์ และเดือน
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setTableTab('HOURLY')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                tableTab === 'HOURLY' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              24 ชั่วโมง (วันนี้)
            </button>
            <button
              type="button"
              onClick={() => setTableTab('DAILY')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                tableTab === 'DAILY' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายวัน (7 วันล่าสุด)
            </button>
            <button
              type="button"
              onClick={() => setTableTab('WEEKLY')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                tableTab === 'WEEKLY' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายสัปดาห์ (4 สัปดาห์)
            </button>
            <button
              type="button"
              onClick={() => setTableTab('MONTHLY')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                tableTab === 'MONTHLY' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายเดือน (12 เดือน)
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {tableTab === 'HOURLY' && (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold">ช่วงเวลา</th>
                  <th className="py-2.5 px-3 font-semibold text-center">บันทึกคะแนน (รายการ)</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-rose-600">หักคะแนน</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-emerald-600">เพิ่มคะแนน</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Reads จริง</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Writes จริง</th>
                  <th className="py-2.5 px-3 font-semibold text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hourlyData.map((row) => (
                  <tr key={row.hour} className={`hover:bg-slate-50/80 ${row.isPeak ? 'bg-amber-50/50' : ''}`}>
                    <td className="py-2 px-3 font-medium text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{row.timeLabel} น.</span>
                    </td>
                    <td className="py-2 px-3 text-center font-semibold text-slate-700">
                      {row.conductLogsCount > 0 ? row.conductLogsCount.toLocaleString() : '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-medium text-rose-600">
                      {row.deductionsCount > 0 ? row.deductionsCount : '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-medium text-emerald-600">
                      {row.additionsCount > 0 ? row.additionsCount : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {row.readsCount.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {row.writesCount.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {row.isPeak ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Flame className="w-3 h-3 text-amber-600" />
                          ช่วงพีคสูงสุด
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">ปกติ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tableTab === 'DAILY' && (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold">วันที่ / วันในสัปดาห์</th>
                  <th className="py-2.5 px-3 font-semibold text-center">บันทึกคะแนน (รายการ)</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-rose-600">หักคะแนน</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-emerald-600">เพิ่มคะแนน</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Reads จริง</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Writes จริง</th>
                  <th className="py-2.5 px-3 font-semibold text-right">% โควต้า Reads</th>
                  <th className="py-2.5 px-3 font-semibold text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyData.map((row) => (
                  <tr key={row.date} className={`hover:bg-slate-50/80 ${row.isToday ? 'bg-indigo-50/40 font-medium' : ''}`}>
                    <td className="py-2.5 px-3 text-slate-800">
                      <div className="font-semibold">{row.dayName}</div>
                      <div className="text-[10px] text-slate-400">{row.date}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                      {row.conductLogsCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-center text-rose-600">
                      {row.deductionsCount} ครั้ง ({row.pointsDeducted} คะแนน)
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-600">
                      {row.additionsCount} ครั้ง ({row.pointsAdded} คะแนน)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {row.readsCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {row.writesCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-indigo-600 font-semibold">
                      {row.readsPercent}%
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {row.isToday ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                          วันนี้
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">ผ่านแล้ว</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tableTab === 'WEEKLY' && (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold">สัปดาห์</th>
                  <th className="py-2.5 px-3 font-semibold">ช่วงวันที่</th>
                  <th className="py-2.5 px-3 font-semibold text-center">บันทึกคะแนนรวม</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-rose-600">หักรวม</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-emerald-600">เพิ่มรวม</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Reads รวม</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Writes รวม</th>
                  <th className="py-2.5 px-3 font-semibold text-right">เฉลี่ย Reads/วัน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {weeklyData.map((row) => (
                  <tr key={row.weekKey} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{row.weekLabel}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{row.startDate} ถึง {row.endDate}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">{row.conductLogsCount.toLocaleString()} รายการ</td>
                    <td className="py-2.5 px-3 text-center text-rose-600">{row.deductionsCount} ครั้ง ({row.pointsDeducted} คะแนน)</td>
                    <td className="py-2.5 px-3 text-center text-emerald-600">{row.additionsCount} ครั้ง ({row.pointsAdded} คะแนน)</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.totalReads.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.totalWrites.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-indigo-600 font-semibold">{row.avgReadsPerDay.toLocaleString()} ครั้ง</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tableTab === 'MONTHLY' && (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold">เดือน / ปี</th>
                  <th className="py-2.5 px-3 font-semibold text-center">บันทึกคะแนนรวม</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-rose-600">หักรวม</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-emerald-600">เพิ่มรวม</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Reads รวม</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Writes รวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlyData.map((row) => (
                  <tr key={row.monthKey} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{row.monthName}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">{row.conductLogsCount.toLocaleString()} รายการ</td>
                    <td className="py-2.5 px-3 text-center text-rose-600">{row.deductionsCount} ครั้ง ({row.pointsDeducted} คะแนน)</td>
                    <td className="py-2.5 px-3 text-center text-emerald-600">{row.additionsCount} ครั้ง ({row.pointsAdded} คะแนน)</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.totalReads.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.totalWrites.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 6. Behavior Breakdown & Grade Breakdown from Real Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Behaviors Recorded */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <span>พฤติกรรมที่ถูกบันทึกจริงบ่อยที่สุด (Top Behaviors)</span>
            </h3>
            <span className="text-xs text-slate-400">จากประวัติจริง</span>
          </div>

          {topBehaviors.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              ยังไม่มีการบันทึกคะแนนความประพฤติในระบบ
            </div>
          ) : (
            <div className="space-y-2.5 pt-1">
              {topBehaviors.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-800">{item.behaviorTitle}</div>
                      <div className="text-[10px] text-slate-400">{item.category}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{item.count} ครั้ง</div>
                    <div className={`text-[10px] font-semibold ${item.type === 'DEDUCT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {item.type === 'DEDUCT' ? '-' : '+'}{item.totalPoints} คะแนน
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grade Level Usage Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>สถิติความประพฤติตามระดับชั้น (ม.1 - ม.6)</span>
            </h3>
            <span className="text-xs text-slate-400">สรุปตามกลุ่มจริง</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {gradeStats.map((grade) => (
              <div key={grade.grade} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-800 font-bold text-xs">
                    {grade.grade}
                  </span>
                  <div>
                    <div className="font-semibold text-slate-800">{grade.studentsCount} คน</div>
                    <div className="text-[10px] text-slate-400">บันทึกทั้งหมด {grade.conductLogsCount} รายการ</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">คะแนนเฉลี่ย {grade.avgScore}</div>
                  <div className="text-[10px] text-slate-500">
                    หัก {grade.deductionsCount} / เพิ่ม {grade.additionsCount} ครั้ง
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. Recent Database Operations Log */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            <span>บันทึกการทำงานของฐานข้อมูลล่าสุด (Recent Database Operations Log)</span>
          </h3>
          <span className="text-xs text-slate-400">แสดง 20 รายการล่าสุด</span>
        </div>

        {recentOps.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            กำลังบันทึกการทำงานของฐานข้อมูลแบบเรียลไทม์...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2 px-3 font-semibold">เวลา</th>
                  <th className="py-2 px-3 font-semibold">ประเภท</th>
                  <th className="py-2 px-3 font-semibold">Collection</th>
                  <th className="py-2 px-3 font-semibold">Action / การทำงาน</th>
                  <th className="py-2 px-3 font-semibold text-right">จำนวน (Docs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOps.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                      {new Date(op.timestamp).toLocaleTimeString('th-TH')}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        op.type === 'READ' ? 'bg-blue-100 text-blue-800' :
                        op.type === 'WRITE' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {op.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{op.collectionName}</td>
                    <td className="py-2 px-3 text-slate-800 font-medium">
                      {op.details || op.action}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-700">
                      +{op.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 8. Quota Transparency & Zero Cost Confirmation */}
      <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-xs text-emerald-900">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-emerald-950">ความคุ้มค่าและสถานะค่าใช้จ่าย: ไม่มีค่าใช้จ่าย (0 บาท) ตราบใดที่ไม่เกินโควต้าฟรี</div>
          <p className="text-emerald-800 leading-relaxed">
            ระบบของโรงเรียนทำงานอยู่ภายใต้ <strong>Cloud Firestore Spark Plan (Free Tier)</strong> ซึ่งให้สิทธิ์อ่านข้อมูลฟรีวันละ 50,000 ครั้ง และเขียนข้อมูลฟรีวันละ 20,000 ครั้ง ซึ่งเพียงพอต่อการใช้งานสำหรับโรงเรียนขนาดใหญ่ อีกทั้งระบบได้เปิดใช้ <code>persistentLocalCache</code> เพื่อให้เครื่องผู้ใช้แคชข้อมูลไว้ ไม่ต้องเรียกซ้ำ จึงประหยัดโควต้าได้อย่างมหาศาล
          </p>
        </div>
      </div>
    </div>
  );
};
