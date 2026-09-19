import React, { useState, useMemo } from 'react';
import {
  AppUser,
  Student,
  ConductLog,
  StandardConductBehavior
} from '../types';
import {
  calculateSimulation,
  generateHourlySimulation,
  generateDailySimulation,
  generateWeeklySimulation,
  generateMonthlySimulation,
  SCENARIO_PRESETS,
  ScenarioKey,
  SimulatorParams,
  FIRESTORE_FREE_TIER,
  RTDB_FREE_TIER
} from '../utils/databaseSimulatorLogic';
import {
  Activity,
  Database,
  BarChart3,
  Flame,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sliders,
  RotateCcw,
  Sparkles,
  Download,
  Info,
  Clock,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  Wifi,
  HardDrive,
  Users,
  ShieldAlert
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
  onClose?: () => void;
}

type TableTimeframe = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
type ChartType = 'FIRESTORE_QUOTA' | 'OPERATIONS_BREAKDOWN' | 'RTDB_CONNECTIONS' | 'BANDWIDTH_COMPARE';

export const SystemUsageStatsSettings: React.FC<SystemUsageStatsSettingsProps> = ({
  currentUser,
  students = [],
  conductLogs = [],
  standardBehaviors = [],
  onClose
}) => {
  // Current Scenario
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('NORMAL_DAY');

  // Custom Simulator Parameters
  const [params, setParams] = useState<SimulatorParams>(() => {
    const base = { ...SCENARIO_PRESETS.NORMAL_DAY.params };
    if (students.length > 0) {
      base.totalStudentsInDb = Math.max(students.length, 50);
    }
    return base;
  });

  // Table & Chart tabs
  const [tableTab, setTableTab] = useState<TableTimeframe>('HOURLY');
  const [chartType, setChartType] = useState<ChartType>('FIRESTORE_QUOTA');
  const [showAdvancedControls, setShowAdvancedControls] = useState<boolean>(false);

  // Switch scenario preset
  const handleSelectScenario = (key: ScenarioKey) => {
    setActiveScenario(key);
    if (key !== 'CUSTOM') {
      const preset = SCENARIO_PRESETS[key];
      setParams({
        ...preset.params,
        totalStudentsInDb: students.length > 0 ? Math.max(students.length, preset.params.totalStudentsInDb) : preset.params.totalStudentsInDb
      });
    }
  };

  // Sync real counts from current database in this app
  const handleSyncRealData = () => {
    setParams(prev => ({
      ...prev,
      totalStudentsInDb: students.length > 0 ? students.length : 800,
      conductActionsPerDay: Math.max(15, Math.round(conductLogs.length > 0 ? conductLogs.length * 0.2 : 35))
    }));
    setActiveScenario('CUSTOM');
  };

  // Run Calculations
  const simulation = useMemo(() => calculateSimulation(params), [params]);
  const hourlyData = useMemo(() => generateHourlySimulation(params), [params]);
  const dailyData = useMemo(() => generateDailySimulation(params), [params]);
  const weeklyData = useMemo(() => generateWeeklySimulation(params), [params]);
  const monthlyData = useMemo(() => generateMonthlySimulation(params), [params]);

  // Export current table to CSV
  const handleExportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    let filename = `database-usage-simulation-${tableTab.toLowerCase()}.csv`;

    if (tableTab === 'HOURLY') {
      csvContent += 'ช่วงเวลา,ช่วงเหตุการณ์,ผู้ใช้งาน,Firestore Reads,Firestore Writes,Firestore Deletes,% โควต้าสะสม,RTDB Connections,RTDB Bandwidth (MB)\n';
      hourlyData.forEach(r => {
        csvContent += `"${r.timeLabel}","${r.periodName}",${r.activeUsers},${r.firestoreReads},${r.firestoreWrites},${r.firestoreDeletes},${r.readsQuotaPercent}%,${r.rtdbConnections},${r.rtdbBandwidthMb}\n`;
      });
    } else if (tableTab === 'DAILY') {
      csvContent += 'วัน,ประเภทวัน,ผู้ใช้งาน,Firestore Reads,% Reads โควต้า,Firestore Writes,% Writes โควต้า,RTDB Peak Connections,RTDB Bandwidth (MB),สถานะ\n';
      dailyData.forEach(r => {
        csvContent += `"${r.dayName}","${r.dayType}",${r.activeUsers},${r.firestoreReads},${r.readsQuotaPercent}%,${r.firestoreWrites},${r.writesQuotaPercent}%,${r.rtdbPeakConnections},${r.rtdbBandwidthMb},"${r.status}"\n`;
      });
    } else if (tableTab === 'WEEKLY') {
      csvContent += 'สัปดาห์,ช่วงวัน,คำอธิบาย,ผู้ใช้งานรวม,Firestore Reads รวม,เฉลี่ยต่อวัน,% Reads โควต้าเฉลี่ย,Firestore Writes รวม,RTDB Bandwidth (MB),สถานะ\n';
      weeklyData.forEach(r => {
        csvContent += `"${r.weekName}","${r.weekRange}","${r.description}",${r.totalUsers},${r.totalFirestoreReads},${r.avgDailyReads},${r.avgDailyReadsPercent}%,${r.totalFirestoreWrites},${r.rtdbBandwidthMb},"${r.status}"\n`;
      });
    } else {
      csvContent += 'เดือน,ภาคเรียน,กิจกรรม,ผู้ใช้งานทั้งเดือน,Firestore Reads ทั้งเดือน,เฉลี่ยต่อวัน,% Reads โควต้าเฉลี่ย,Firestore Writes,RTDB Bandwidth (GB),สถานะ\n';
      monthlyData.forEach(r => {
        csvContent += `"${r.monthName}","${r.academicTerm}","${r.eventType}",${r.activeUsersMonthly},${r.monthlyFirestoreReads},${r.dailyAvgReads},${r.dailyAvgReadsPercent}%,${r.monthlyFirestoreWrites},${r.rtdbMonthlyBandwidthGb},"${r.status}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-6 animate-fade-in pb-12">
      {/* ========================================================================= */}
      {/* 1. Header & Title Banner */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-44 h-44 bg-gradient-to-br from-indigo-100/50 to-emerald-100/40 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
              <Activity className="w-4 h-4" />
              <span>Database Operations & Traffic Simulator</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>สถิติการใช้งานระบบ & จำลองโควต้าฐานข้อมูล</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Cloud Firestore Free (Spark)
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              จำลองปริมาณการทำงาน (Reads, Writes, Deletes, Concurrent Connections, Bandwidth)
              เมื่อเชื่อมต่อฐานข้อมูล <strong className="text-slate-800">Cloud Firestore</strong> เทียบกับ{' '}
              <strong className="text-slate-800">Realtime Database</strong> ตามสถานการณ์ผู้ใช้งานจริงของโรงเรียน
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSyncRealData}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="ดึงจำนวนนักเรียนและประวัติจากระบบจริงมาเป็นค่าเริ่มต้น"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>ดึงค่าจากระบบจริง ({students.length} คน)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAdvancedControls(!showAdvancedControls)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                showAdvancedControls
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showAdvancedControls ? 'ซ่อนตัวปรับแต่ง' : 'ปรับแต่งพารามิเตอร์'}</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Scenario Presets Selector */}
        {/* ========================================================================= */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>เลือกสถานการณ์จำลอง (Scenario Presets):</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {(Object.keys(SCENARIO_PRESETS) as ScenarioKey[]).map(key => {
              const preset = SCENARIO_PRESETS[key];
              const isSelected = activeScenario === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectScenario(key)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-200/80 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${preset.badgeColor}`}
                    >
                      {preset.badge}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-900 line-clamp-1">{preset.name}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-snug">
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Interactive Parameter Sliders (Customizable Controls) */}
      {/* ========================================================================= */}
      {showAdvancedControls && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">
                แผงปรับแต่งพารามิเตอร์จำลอง (Custom Simulation Parameters)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => handleSelectScenario('NORMAL_DAY')}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>รีเซ็ตกลับค่าตั้งต้น</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Control 1: Total Students */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300 font-medium">จำนวนนักเรียนในโรงเรียน</span>
                <span className="font-mono font-bold text-indigo-400">{params.totalStudentsInDb} คน</span>
              </div>
              <input
                type="range"
                min="50"
                max="2500"
                step="50"
                value={params.totalStudentsInDb}
                onChange={e => {
                  setParams(p => ({ ...p, totalStudentsInDb: Number(e.target.value) }));
                  setActiveScenario('CUSTOM');
                }}
                className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>50</span>
                <span>1,200</span>
                <span>2,500</span>
              </div>
            </div>

            {/* Control 2: Active Students */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300 font-medium">นักเรียนเข้าใช้งานต่อวัน</span>
                <span className="font-mono font-bold text-emerald-400">
                  {params.activeStudentsPerDay} คน ({Math.round((params.activeStudentsPerDay / params.totalStudentsInDb) * 100)}%)
                </span>
              </div>
              <input
                type="range"
                min="10"
                max={params.totalStudentsInDb}
                step="10"
                value={Math.min(params.activeStudentsPerDay, params.totalStudentsInDb)}
                onChange={e => {
                  setParams(p => ({ ...p, activeStudentsPerDay: Number(e.target.value) }));
                  setActiveScenario('CUSTOM');
                }}
                className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>10</span>
                <span>{Math.round(params.totalStudentsInDb / 2)}</span>
                <span>{params.totalStudentsInDb}</span>
              </div>
            </div>

            {/* Control 3: Lookups per student */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300 font-medium">ตรวจคะแนน/คน/วัน</span>
                <span className="font-mono font-bold text-amber-400">{params.lookupsPerStudent} ครั้ง</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="0.5"
                value={params.lookupsPerStudent}
                onChange={e => {
                  setParams(p => ({ ...p, lookupsPerStudent: Number(e.target.value) }));
                  setActiveScenario('CUSTOM');
                }}
                className="w-full accent-amber-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>1 ครั้ง</span>
                <span>4 ครั้ง</span>
                <span>8 ครั้ง</span>
              </div>
            </div>

            {/* Control 4: Active Teachers */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300 font-medium">ครู/เจ้าหน้าที่เข้าสู่ระบบ</span>
                <span className="font-mono font-bold text-indigo-400">{params.activeStaffPerDay} ท่าน</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={params.activeStaffPerDay}
                onChange={e => {
                  setParams(p => ({ ...p, activeStaffPerDay: Number(e.target.value) }));
                  setActiveScenario('CUSTOM');
                }}
                className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>5</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            {/* Control 5: Conduct Actions */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300 font-medium">บันทึกตัด/เพิ่มคะแนนต่อวัน</span>
                <span className="font-mono font-bold text-rose-400">{params.conductActionsPerDay} รายการ</span>
              </div>
              <input
                type="range"
                min="5"
                max="400"
                step="5"
                value={params.conductActionsPerDay}
                onChange={e => {
                  setParams(p => ({ ...p, conductActionsPerDay: Number(e.target.value) }));
                  setActiveScenario('CUSTOM');
                }}
                className="w-full accent-rose-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>5</span>
                <span>200</span>
                <span>400</span>
              </div>
            </div>

            {/* Control 6: Reports Generated */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300 font-medium">ดึงรายงานระดับชั้น/ห้อง</span>
                <span className="font-mono font-bold text-sky-400">{params.reportsGeneratedPerDay} ครั้ง</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={params.reportsGeneratedPerDay}
                onChange={e => {
                  setParams(p => ({ ...p, reportsGeneratedPerDay: Number(e.target.value) }));
                  setActiveScenario('CUSTOM');
                }}
                className="w-full accent-sky-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            {/* Control 7: Batch Imports */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300 font-medium">นำเข้าข้อมูลใหม่แบบ Batch</span>
                <span className="font-mono font-bold text-purple-400">{params.batchImportsCount} คน</span>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="25"
                value={params.batchImportsCount}
                onChange={e => {
                  setParams(p => ({ ...p, batchImportsCount: Number(e.target.value) }));
                  setActiveScenario('CUSTOM');
                }}
                className="w-full accent-purple-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>0</span>
                <span>250</span>
                <span>500</span>
              </div>
            </div>

            {/* Control 8: Realtime Listener Toggle */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300 font-medium">เปิด onSnapshot Listener</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    params.enableRealtimeListeners ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {params.enableRealtimeListeners ? 'เปิดใช้งาน' : 'ปิด (One-time fetch)'}
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={params.enableRealtimeListeners}
                  onChange={e => {
                    setParams(p => ({ ...p, enableRealtimeListeners: e.target.checked }));
                    setActiveScenario('CUSTOM');
                  }}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-500"
                />
                <span className="text-[11px] text-slate-300">ซิงค์กระดานคะแนนสดแบบ Real-time</span>
              </label>
              <span className="text-[10px] text-slate-400 mt-1">
                *หมายเหตุ: เพิ่ม Read ทุกครั้งที่ข้อมูลใน query เปลี่ยนแปลง
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Side-by-Side Comparison Cards (Firestore vs Realtime Database) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Cloud Firestore Spark Free Tier */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-2xs">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                    <span>Cloud Firestore</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                      Spark Plan (Free)
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">คิดราคาตามจำนวนครั้งของ Document Operations</p>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {simulation.firestore.quotaStatus === 'SAFE' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>อยู่ในโควต้าฟรี 100%</span>
                  </span>
                ) : simulation.firestore.quotaStatus === 'WARNING' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>พึงระวัง (ใช้ &gt; 75%)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>เกินโควต้าฟรี</span>
                  </span>
                )}
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="space-y-3.5 mt-4">
              {/* Reads Metric */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <span>📖 Document Reads (อ่านข้อมูล)</span>
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {simulation.firestore.reads.toLocaleString()}
                    </span>
                    <span className="text-slate-400 text-[11px]"> / 50,000 ครั้ง/วัน</span>
                    <span
                      className={`ml-1.5 text-xs font-bold ${
                        simulation.firestore.readsPercent > 100
                          ? 'text-rose-600 font-mono'
                          : simulation.firestore.readsPercent > 75
                          ? 'text-amber-600 font-mono'
                          : 'text-emerald-600 font-mono'
                      }`}
                    >
                      ({simulation.firestore.readsPercent}%)
                    </span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      simulation.firestore.readsPercent > 100
                        ? 'bg-rose-500'
                        : simulation.firestore.readsPercent > 75
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, simulation.firestore.readsPercent)}%` }}
                  />
                </div>
              </div>

              {/* Writes Metric */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <span>✍️ Document Writes (เขียน/อัปเดต)</span>
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {simulation.firestore.writes.toLocaleString()}
                    </span>
                    <span className="text-slate-400 text-[11px]"> / 20,000 ครั้ง/วัน</span>
                    <span className="ml-1.5 text-xs font-bold text-emerald-600 font-mono">
                      ({simulation.firestore.writesPercent}%)
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, simulation.firestore.writesPercent)}%` }}
                  />
                </div>
              </div>

              {/* Deletes Metric */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <span>🗑️ Document Deletes (ลบข้อมูล)</span>
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {simulation.firestore.deletes.toLocaleString()}
                    </span>
                    <span className="text-slate-400 text-[11px]"> / 20,000 ครั้ง/วัน</span>
                    <span className="ml-1.5 text-xs font-bold text-slate-500 font-mono">
                      ({simulation.firestore.deletesPercent}%)
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, simulation.firestore.deletesPercent)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Storage & Egress Pills */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[11px] block">พื้นที่จัดเก็บประเมิน</span>
                <span className="font-bold text-slate-800 font-mono">
                  {simulation.firestore.estimatedStorageMb} MB
                </span>
                <span className="text-slate-400 text-[10px]"> (ฟรี 1,024 MB)</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[11px] block">Egress Bandwidth</span>
                <span className="font-bold text-slate-800 font-mono">
                  {simulation.firestore.estimatedDailyEgressMb} MB/วัน
                </span>
                <span className="text-slate-400 text-[10px]"> (ฟรี 10 GB/เดือน)</span>
              </div>
            </div>
          </div>

          {/* Firestore Summary Footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs flex items-center justify-between">
            <span className="text-slate-500">ค่าใช้จ่ายส่วนเกิน (Blaze):</span>
            <span
              className={`font-bold font-mono ${
                simulation.firestore.estimatedBlazeCostThb > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              {simulation.firestore.estimatedBlazeCostThb > 0
                ? `~฿${simulation.firestore.estimatedBlazeCostThb} บาท/วัน`
                : '฿0.00 บาท (ฟรีไม่มีค่าใช้จ่าย)'}
            </span>
          </div>
        </div>

        {/* Right: Firebase Realtime Database (RTDB) Spark Free Tier */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                    <span>Realtime Database</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                      Spark Plan (Free)
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">คิดราคาตาม Bandwidth ดาวน์โหลด และจำกัด 100 Connections</p>
                </div>
              </div>

              {/* RTDB Status Badge */}
              <div>
                {simulation.realtimeDb.quotaStatus === 'SAFE' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>อยู่ในโควต้าฟรี</span>
                  </span>
                ) : simulation.realtimeDb.quotaStatus === 'WARNING' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>ใกล้ชนเพดาน Connection</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>เกินขีดจำกัดฟรี (100 Conns)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="space-y-3.5 mt-4">
              {/* Simultaneous Connections */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <span>⚡ Concurrent Connections (เชื่อมต่อพร้อมกัน)</span>
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {simulation.realtimeDb.peakConnections}
                    </span>
                    <span className="text-slate-400 text-[11px]"> / 100 connections</span>
                    <span
                      className={`ml-1.5 text-xs font-bold ${
                        simulation.realtimeDb.connectionsPercent > 100
                          ? 'text-rose-600 font-mono'
                          : simulation.realtimeDb.connectionsPercent > 75
                          ? 'text-amber-600 font-mono'
                          : 'text-emerald-600 font-mono'
                      }`}
                    >
                      ({simulation.realtimeDb.connectionsPercent}%)
                    </span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      simulation.realtimeDb.connectionsPercent > 100
                        ? 'bg-rose-500'
                        : simulation.realtimeDb.connectionsPercent > 75
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, simulation.realtimeDb.connectionsPercent)}%` }}
                  />
                </div>
                {simulation.realtimeDb.connectionsPercent >= 100 && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>หากเกิน 100 ผู้ใช้พร้อมกัน RTDB จะตัดการเชื่อมต่อผู้ใช้คนที่ 101 ทันทีในแพ็กเกจฟรี</span>
                  </p>
                )}
              </div>

              {/* Download Bandwidth */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <span>🌐 Monthly Download Bandwidth (ดาวน์โหลด JSON)</span>
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {simulation.realtimeDb.monthlyBandwidthGb} GB
                    </span>
                    <span className="text-slate-400 text-[11px]"> / 10 GB/เดือน</span>
                    <span className="ml-1.5 text-xs font-bold text-indigo-600 font-mono">
                      ({simulation.realtimeDb.bandwidthPercent}%)
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, simulation.realtimeDb.bandwidthPercent)}%` }}
                  />
                </div>
              </div>

              {/* Free Operations Note */}
              <div className="p-2.5 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>จุดเด่น RTDB: ไม่คิดค่า Document Read/Write</span>
                </div>
                <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                  RTDB ให้อ่าน/เขียนกี่ล้านครั้งก็ได้ฟรี แต่ถ้า query node ใหญ่ จะดาวน์โหลด JSON ทั้งก้อนกินโควต้า Bandwidth ไวมาก
                </p>
              </div>
            </div>

            {/* Storage & Daily Bandwidth Pills */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[11px] block">ดาวน์โหลดรายวัน (เฉลี่ย)</span>
                <span className="font-bold text-slate-800 font-mono">
                  {simulation.realtimeDb.dailyBandwidthMb} MB/วัน
                </span>
                <span className="text-slate-400 text-[10px]"> (เฉลี่ยไม่ควรเกิน 333 MB)</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-slate-500 text-[11px] block">พื้นที่จัดเก็บประเมิน</span>
                <span className="font-bold text-slate-800 font-mono">
                  {simulation.firestore.estimatedStorageMb} MB
                </span>
                <span className="text-slate-400 text-[10px]"> (ฟรี 1 GB)</span>
              </div>
            </div>
          </div>

          {/* RTDB Summary Footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs flex items-center justify-between">
            <span className="text-slate-500">ค่าใช้จ่ายส่วนเกิน (Blaze):</span>
            <span
              className={`font-bold font-mono ${
                simulation.realtimeDb.estimatedBlazeCostThb > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              {simulation.realtimeDb.estimatedBlazeCostThb > 0
                ? `~฿${simulation.realtimeDb.estimatedBlazeCostThb} บาท/เดือน`
                : '฿0.00 บาท (ฟรีไม่มีค่าใช้จ่าย)'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. Comparison Summary Insights: Why Firestore is Better for Conduct System */}
      {/* ========================================================================= */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 sm:p-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-indigo-600" />
          <span>บทวิเคราะห์เปรียบเทียบความเหมาะสมสำหรับระบบคะแนนความประพฤตินี้</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-2xs">
            <div className="font-bold text-indigo-700 mb-1 flex items-center gap-1.5">
              <span>🎯 การสืบค้นและการแบ่งหน้า (Pagination)</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Firestore ชนะขาด:</strong> สามารถ Query กรองตามระดับชั้น (เช่น ม.1, ม.4),
              เรียงลำดับคะแนน, หรือดึงเฉพาะนักเรียนกลุ่มวิกฤตได้โดยตรง ไม่ต้องโหลดข้อมูลนักเรียนทั้งโรงเรียนมาประมวลผลที่เครื่องผู้ใช้
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-2xs">
            <div className="font-bold text-amber-700 mb-1 flex items-center gap-1.5">
              <span>👥 ขีดจำกัดผู้ใช้พร้อมกัน (Concurrent Users)</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Firestore ยืดหยุ่นกว่า:</strong> ไม่มีเพดาน 100 Connections แบบ RTDB!
              ในช่วงเข้าแถวเช้าหรือวันประกาศผลคะแนน หากนักเรียน 500 คนเข้าพร้อมกัน Firestore จะยังคงให้บริการได้ตามปกติ
              โดยนับตามจำนวน Document Reads (50,000 ครั้ง/วัน)
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-2xs">
            <div className="font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
              <span>🛡️ ความปลอดภัย & Local Cache</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              ระบบนี้ตั้งค่า <strong className="text-slate-800">persistentLocalCache</strong> ในตัวแล้ว
              ทำให้เมื่อนักเรียนหรือครูเปิดหน้าเดิม ข้อมูลจะถูกดึงจากแคชในเครื่องทันทีโดยไม่เสียโควต้า Read ไปยัง Cloud Firestore ซ้ำ!
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. Visual Line Charts Section (แสดงกราฟเส้นเปรียบเทียบ) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-base font-black text-slate-900">กราฟเส้นแสดงการทำงานและเปรียบเทียบโควต้า</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงการกระจายตัวของปริมาณการใช้งานตามช่วงเวลา 24 ชั่วโมง และเปรียบเทียบกับเพดานใช้งานฟรี
            </p>
          </div>

          {/* Chart Type Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setChartType('FIRESTORE_QUOTA')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === 'FIRESTORE_QUOTA'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Firestore Reads vs Limit
            </button>
            <button
              type="button"
              onClick={() => setChartType('OPERATIONS_BREAKDOWN')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === 'OPERATIONS_BREAKDOWN'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              แยกประเภท (Read/Write/Delete)
            </button>
            <button
              type="button"
              onClick={() => setChartType('RTDB_CONNECTIONS')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === 'RTDB_CONNECTIONS'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              RTDB Conns vs Limit (100)
            </button>
            <button
              type="button"
              onClick={() => setChartType('BANDWIDTH_COMPARE')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === 'BANDWIDTH_COMPARE'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bandwidth (MB)
            </button>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'FIRESTORE_QUOTA' ? (
              <LineChart data={hourlyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 'dataMax + 2000']} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${Number(value).toLocaleString()} ครั้ง`,
                    name === 'cumulativeReads'
                      ? 'Reads สะสมตลอดวัน'
                      : name === 'firestoreReads'
                      ? 'Reads ในช่วงเวลานี้'
                      : name
                  ]}
                  labelFormatter={(label) => `ช่วงเวลา ${label} น.`}
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <ReferenceLine
                  y={FIRESTORE_FREE_TIER.DAILY_READS}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: 'เพดานฟรี 50,000 Reads/วัน', fill: '#ef4444', fontSize: 11, position: 'insideTopRight' }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeReads"
                  name="Firestore Reads สะสม"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  dot={{ r: 3, fill: '#4f46e5' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="firestoreReads"
                  name="Reads ในช่วงเวลานั้น"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  dot={{ r: 2 }}
                />
              </LineChart>
            ) : chartType === 'OPERATIONS_BREAKDOWN' ? (
              <LineChart data={hourlyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  formatter={(value: any, name: any) => [`${Number(value).toLocaleString()} ครั้ง`, name]}
                  labelFormatter={(label) => `ช่วงเวลา ${label} น.`}
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="firestoreReads"
                  name="Reads (อ่านเอกสาร)"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="firestoreWrites"
                  name="Writes (เขียน/อัปเดต)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="firestoreDeletes"
                  name="Deletes (ลบเอกสาร)"
                  stroke="#f43f5e"
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                />
              </LineChart>
            ) : chartType === 'RTDB_CONNECTIONS' ? (
              <LineChart data={hourlyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, Math.max(120, simulation.realtimeDb.peakConnections + 20)]} />
                <Tooltip
                  formatter={(value: any) => [`${Number(value).toLocaleString()} connections`, 'RTDB ผู้ใช้พร้อมกัน']}
                  labelFormatter={(label) => `ช่วงเวลา ${label} น.`}
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <ReferenceLine
                  y={100}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: 'เพดานฟรี RTDB (100 Conns)', fill: '#ef4444', fontSize: 11, position: 'insideTopRight' }}
                />
                <Line
                  type="monotone"
                  dataKey="rtdbConnections"
                  name="Realtime DB Connections พร้อมกัน"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#f59e0b' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            ) : (
              <LineChart data={hourlyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="timeLabel" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  formatter={(value: any, name: any) => [`${Number(value).toLocaleString()} MB`, name]}
                  labelFormatter={(label) => `ช่วงเวลา ${label} น.`}
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="rtdbBandwidthMb"
                  name="RTDB ดาวน์โหลด (MB)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. Usage Data Tables (ตารางข้อมูลการใช้งาน รายวัน สัปดาห์ เดือน ช่วงเวลา) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <h3 className="text-base font-black text-slate-900">ตารางข้อมูลการใช้งานระบบจำลอง</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงตัวเลขการทำงานอย่างละเอียดแยกตามมิติเวลา (ช่วงเวลา, รายวัน, สัปดาห์, เดือน)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Timeframe Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setTableTab('HOURLY')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  tableTab === 'HOURLY' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>ช่วงเวลา (24 ชม.)</span>
              </button>
              <button
                type="button"
                onClick={() => setTableTab('DAILY')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  tableTab === 'DAILY' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>รายวัน (7 วัน)</span>
              </button>
              <button
                type="button"
                onClick={() => setTableTab('WEEKLY')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  tableTab === 'WEEKLY' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>รายสัปดาห์ (4 สัปดาห์)</span>
              </button>
              <button
                type="button"
                onClick={() => setTableTab('MONTHLY')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  tableTab === 'MONTHLY' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>รายเดือน (12 เดือน)</span>
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออก CSV</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          {tableTab === 'HOURLY' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">ช่วงเวลา</th>
                  <th className="py-2.5 px-3">ช่วงกิจกรรมในโรงเรียน</th>
                  <th className="py-2.5 px-3 text-right">ผู้ใช้งาน (คน)</th>
                  <th className="py-2.5 px-3 text-right">Firestore Reads</th>
                  <th className="py-2.5 px-3 text-right">Writes</th>
                  <th className="py-2.5 px-3 text-right">% โควต้าสะสม</th>
                  <th className="py-2.5 px-3 text-right">RTDB Conns</th>
                  <th className="py-2.5 px-3 text-right">RTDB ดาวน์โหลด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                {hourlyData.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      row.isPeak ? 'bg-amber-50/40 font-medium' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{row.timeLabel} น.</span>
                      {row.isPeak && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                          Peak
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-sans text-slate-600">{row.periodName}</td>
                    <td className="py-2 px-3 text-right text-slate-800">{row.activeUsers.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-bold text-indigo-700">
                      {row.firestoreReads.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700">
                      {row.firestoreWrites.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`font-bold ${
                          row.readsQuotaPercent > 100
                            ? 'text-rose-600'
                            : row.readsQuotaPercent > 75
                            ? 'text-amber-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {row.readsQuotaPercent}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`font-bold ${
                          row.rtdbConnections > 100 ? 'text-rose-600' : 'text-slate-700'
                        }`}
                      >
                        {row.rtdbConnections}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">{row.rtdbBandwidthMb} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tableTab === 'DAILY' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">วัน</th>
                  <th className="py-2.5 px-3 text-right">ผู้ใช้งาน (คน)</th>
                  <th className="py-2.5 px-3 text-right">Firestore Reads</th>
                  <th className="py-2.5 px-3 text-right">% โควต้า (50k)</th>
                  <th className="py-2.5 px-3 text-right">Firestore Writes</th>
                  <th className="py-2.5 px-3 text-right">% โควต้า (20k)</th>
                  <th className="py-2.5 px-3 text-right">RTDB Peak Conns</th>
                  <th className="py-2.5 px-3 text-right">RTDB ดาวน์โหลด</th>
                  <th className="py-2.5 px-3 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                {dailyData.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      row.dayType === 'WEEKEND' ? 'bg-slate-50/40 text-slate-500' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-bold text-slate-900 font-sans flex items-center gap-1.5">
                      <span>{row.dayName}</span>
                      {row.dayType === 'WEEKEND' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          วันหยุด
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-800">{row.activeUsers.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-bold text-indigo-700">
                      {row.firestoreReads.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-bold">
                      <span
                        className={
                          row.readsQuotaPercent > 100
                            ? 'text-rose-600'
                            : row.readsQuotaPercent > 75
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }
                      >
                        {row.readsQuotaPercent}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700">
                      {row.firestoreWrites.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">{row.writesQuotaPercent}%</td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`font-bold ${
                          row.rtdbPeakConnections > 100 ? 'text-rose-600' : 'text-slate-700'
                        }`}
                      >
                        {row.rtdbPeakConnections}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">{row.rtdbBandwidthMb} MB</td>
                    <td className="py-2 px-3 text-center font-sans">
                      {row.status === 'SAFE' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          ปกติ
                        </span>
                      ) : row.status === 'WARNING' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          พึงระวัง
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          เกินโควต้า
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tableTab === 'WEEKLY' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">สัปดาห์</th>
                  <th className="py-2.5 px-3">เหตุการณ์จำลอง</th>
                  <th className="py-2.5 px-3 text-right">ผู้ใช้งานรวม (คน)</th>
                  <th className="py-2.5 px-3 text-right">Reads รวม</th>
                  <th className="py-2.5 px-3 text-right">เฉลี่ยต่อวัน</th>
                  <th className="py-2.5 px-3 text-right">% โควต้าต่อวัน</th>
                  <th className="py-2.5 px-3 text-right">Writes รวม</th>
                  <th className="py-2.5 px-3 text-right">RTDB ดาวน์โหลด</th>
                  <th className="py-2.5 px-3 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                {weeklyData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 font-bold text-slate-900 font-sans">
                      <div>{row.weekName}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{row.weekRange}</div>
                    </td>
                    <td className="py-2 px-3 font-sans text-slate-600">{row.description}</td>
                    <td className="py-2 px-3 text-right text-slate-800">{row.totalUsers.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-bold text-indigo-700">
                      {row.totalFirestoreReads.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-900">{row.avgDailyReads.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-bold">
                      <span
                        className={
                          row.avgDailyReadsPercent > 100
                            ? 'text-rose-600'
                            : row.avgDailyReadsPercent > 75
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }
                      >
                        {row.avgDailyReadsPercent}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700">
                      {row.totalFirestoreWrites.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">{row.rtdbBandwidthMb} MB</td>
                    <td className="py-2 px-3 text-center font-sans">
                      {row.status === 'SAFE' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          ปกติ
                        </span>
                      ) : row.status === 'WARNING' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          พึงระวัง
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          เกินโควต้า
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">เดือน</th>
                  <th className="py-2.5 px-3">ภาคเรียน / กิจกรรม</th>
                  <th className="py-2.5 px-3 text-right">ผู้ใช้งาน (ทั้งเดือน)</th>
                  <th className="py-2.5 px-3 text-right">Reads ทั้งเดือน</th>
                  <th className="py-2.5 px-3 text-right">เฉลี่ยต่อวัน</th>
                  <th className="py-2.5 px-3 text-right">% โควต้าต่อวัน</th>
                  <th className="py-2.5 px-3 text-right">Writes ทั้งเดือน</th>
                  <th className="py-2.5 px-3 text-right">RTDB ดาวน์โหลด</th>
                  <th className="py-2.5 px-3 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                {monthlyData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 font-bold text-slate-900 font-sans">
                      <span>{row.monthName}</span>
                    </td>
                    <td className="py-2 px-3 font-sans text-slate-600">
                      <span className="font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] mr-1.5">
                        {row.academicTerm}
                      </span>
                      <span>{row.eventType}</span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-800">
                      {row.activeUsersMonthly.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-indigo-700">
                      {row.monthlyFirestoreReads.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-900">{row.dailyAvgReads.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-bold">
                      <span
                        className={
                          row.dailyAvgReadsPercent > 100
                            ? 'text-rose-600'
                            : row.dailyAvgReadsPercent > 75
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }
                      >
                        {row.dailyAvgReadsPercent}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700">
                      {row.monthlyFirestoreWrites.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {row.rtdbMonthlyBandwidthGb} GB{' '}
                      <span className="text-[10px] text-slate-400">({row.rtdbBandwidthPercent}%)</span>
                    </td>
                    <td className="py-2 px-3 text-center font-sans">
                      {row.status === 'SAFE' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          ปกติ
                        </span>
                      ) : row.status === 'WARNING' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          พึงระวัง
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          เกินโควต้า
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. Architecture Optimization Guide & Best Practices */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center gap-2 border-b border-indigo-800/60 pb-3">
          <ShieldAlert className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold">
            แนวทางปฏิบัติที่ดีที่สุดเพื่อรักษาโควต้าฟรี (Best Practices & Quota Optimization)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-indigo-950/60 border border-indigo-800/40 p-3.5 rounded-xl space-y-1.5">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>1. เปิดใช้งาน Multi-Tab Local Cache</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              ใน <code className="text-indigo-200 font-mono">src/firebase.ts</code> ได้เปิด{' '}
              <code className="text-indigo-200 font-mono">persistentLocalCache</code> เรียบร้อยแล้ว
              ทำให้เมื่อนักเรียนหรือครูเปิดดูข้อมูลเดิม เบราว์เซอร์จะดึงจาก IndexedDB ทันทีโดยไม่ส่ง Query ไปยัง Firestore
              ช่วยลดจำนวน Read ได้มากกว่า 60-70% ต่อวัน
            </p>
          </div>

          <div className="bg-indigo-950/60 border border-indigo-800/40 p-3.5 rounded-xl space-y-1.5">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>2. จัดการข้อมูลนักเรียนด้วย Pagination</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              หน้ารายชื่อนักเรียนในระบบนี้แบ่งหน้าทีละ 25-50 คน แทนการโหลด 1,000 คนพร้อมกัน
              ทำให้ประหยัด Read จาก 1,000 ครั้ง เหลือเพียง 25 ครั้งต่อหน้า
            </p>
          </div>

          <div className="bg-indigo-950/60 border border-indigo-800/40 p-3.5 rounded-xl space-y-1.5">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>3. รวมการอัปเดตด้วย writeBatch()</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              เมื่อมีการนำเข้าข้อมูลนักเรียนใหม่จากไฟล์ Excel หรือการให้สิทธิ์นักเรียนแบบ One-Click Batch
              ระบบจะใช้ <code className="text-indigo-200 font-mono">writeBatch</code> รวมได้ถึง 500 รายการต่อ 1 คำสั่ง
              ช่วยให้ทำงานเสร็จเร็วขึ้นและลดภาระการเชื่อมต่อ
            </p>
          </div>

          <div className="bg-indigo-950/60 border border-indigo-800/40 p-3.5 rounded-xl space-y-1.5">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>4. ข้อควรระวัง: Realtime Listener บน Collection ขนาดใหญ่</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              หลีกเลี่ยงการเปิด <code className="text-amber-200 font-mono">onSnapshot</code> บนคอลเลกชันนักเรียนทั้งหมดโดยไม่มีเงื่อนไข{' '}
              <code className="text-amber-200 font-mono">where()</code> หรือ <code className="text-amber-200 font-mono">limit()</code>{' '}
              เพราะหากมีครูบันทึกคะแนน 1 ครั้ง ทุกคนที่ต่อ listener อยู่จะถูกนับ Read ใหม่ทั้งชุดทันที
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
