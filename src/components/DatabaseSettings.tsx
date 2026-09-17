import React, { useState, useEffect, useRef } from 'react';
import {
  AppUser,
  Student,
  ConductLog,
  SystemSettings,
  HomeroomAdvisor,
  StandardConductBehavior,
  StudentAccessGrant
} from '../types';
import { testFirestoreConnection, getFirestoreConfigInfo } from '../firebase';
import { formatThaiDate } from '../utils/thaiDate';
import { AdminPasswordConfirmModal } from './AdminPasswordConfirmModal';
import { ConductResetManager } from './ConductResetManager';
import {
  Database,
  Download,
  Upload,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Cloud,
  HardDrive,
  Copy,
  Check,
  Activity,
  Wifi,
  WifiOff,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
  Clock,
  Layers,
  Users,
  FileText
} from 'lucide-react';

interface DatabaseSettingsProps {
  currentUser: AppUser;
  users?: AppUser[];
  students: Student[];
  conductLogs: ConductLog[];
  systemSettings?: SystemSettings;
  advisors?: HomeroomAdvisor[];
  standardBehaviors?: StandardConductBehavior[];
  accessGrants?: StudentAccessGrant[];
  currentAcademicYear?: number;
  onClose?: () => void;
  onExportBackup?: () => Promise<any>;
  onImportBackup?: (data: any) => Promise<void>;
  onSeedSampleData?: () => Promise<any>;
  onClearSampleData?: () => Promise<any>;
  onClearAllStudentPhotos?: () => Promise<any>;
  onClearIndividualStudentConduct?: (studentId: string) => Promise<any>;
  onClearAllConductData?: () => Promise<any>;
  onAuditAndReconcileConduct?: () => Promise<{ inspectedStudentsCount: number; fixedStudentsCount: number; fixedStudentIds: string[] }>;
  onResetToAdminOnly?: () => Promise<void>;
  onResetDatabase?: () => Promise<void>;
}

export const DatabaseSettings: React.FC<DatabaseSettingsProps> = ({
  currentUser,
  users = [],
  students,
  conductLogs,
  systemSettings,
  advisors = [],
  standardBehaviors = [],
  accessGrants = [],
  currentAcademicYear,
  onClose,
  onExportBackup,
  onImportBackup,
  onSeedSampleData,
  onClearSampleData,
  onClearAllStudentPhotos,
  onClearIndividualStudentConduct,
  onClearAllConductData,
  onAuditAndReconcileConduct,
  onResetToAdminOnly,
  onResetDatabase
}) => {
  const [dbLoading, setDbLoading] = useState(false);
  const [dbStatusMsg, setDbStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // Firestore Connection State
  const [connectionState, setConnectionState] = useState<'checking' | 'connected' | 'error'>('checking');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastCheckedTime, setLastCheckedTime] = useState<Date | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  const configInfo = getFirestoreConfigInfo();

  // Test Firestore Connection
  const runConnectionTest = async () => {
    setIsTestingConnection(true);
    setConnectionError(null);
    try {
      const res = await testFirestoreConnection();
      if (res.connected) {
        setConnectionState('connected');
        setLatencyMs(res.latencyMs);
        setLastCheckedTime(new Date());
      } else {
        setConnectionState('error');
        setConnectionError(res.error || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ Cloud Firestore ได้');
        setLatencyMs(res.latencyMs);
        setLastCheckedTime(new Date());
      }
    } catch (err: any) {
      setConnectionState('error');
      setConnectionError(err?.message || 'เกิดข้อผิดพลาดในการตรวจสอบ');
      setLastCheckedTime(new Date());
    } finally {
      setIsTestingConnection(false);
    }
  };

  useEffect(() => {
    runConnectionTest();
  }, []);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Admin Password Confirmation Popup State
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    targetName?: string;
    dangerLevel?: 'danger' | 'warning';
    confirmButtonText?: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  const academicYear = currentAcademicYear || systemSettings?.currentAcademicYear || 2568;

  const handleExportBackupClick = async () => {
    setDbLoading(true);
    setDbStatusMsg(null);
    try {
      if (onExportBackup) {
        const data = await onExportBackup();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conduct_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setDbStatusMsg({ type: 'success', text: 'ส่งออกไฟล์สำรองข้อมูล JSON เรียบร้อยแล้ว' });
      }
    } catch (err: any) {
      setDbStatusMsg({ type: 'error', text: 'เกิดข้อผิดพลาดในการส่งออก: ' + (err?.message || '') });
    } finally {
      setDbLoading(false);
    }
  };

  const handleBackupFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDbLoading(true);
    setDbStatusMsg(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (onImportBackup) {
          await onImportBackup(json);
          setDbStatusMsg({
            type: 'success',
            text: 'นำเข้าฐานข้อมูลสำเร็จ ข้อมูลได้รับการกู้คืนเรียบร้อยแล้ว'
          });
        }
      } catch (err: any) {
        setDbStatusMsg({
          type: 'error',
          text: 'นำเข้าฐานข้อมูลไม่สำเร็จ: ' + (err?.message || 'รูปแบบไฟล์ไม่ถูกต้อง')
        });
      } finally {
        setDbLoading(false);
        if (backupFileInputRef.current) {
          backupFileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSeedSampleDataClick = async () => {
    setDbLoading(true);
    setDbStatusMsg(null);
    try {
      if (onSeedSampleData) {
        const result = await onSeedSampleData();
        const studentCount = typeof result === 'object' && result !== null ? (result.seededStudents || 8) : 8;
        const logCount = typeof result === 'object' && result !== null ? (result.seededLogs || 9) : 9;
        setDbStatusMsg({
          type: 'success',
          text: `โหลดข้อมูลตัวอย่างเริ่มต้นสำเร็จ (นักเรียน ${studentCount} คน, ประวัติ ${logCount} รายการ)`
        });
      }
    } catch (err: any) {
      setDbStatusMsg({ type: 'error', text: 'เกิดข้อผิดพลาดในการโหลดข้อมูลตัวอย่าง: ' + (err?.message || '') });
    } finally {
      setDbLoading(false);
    }
  };

  const handleClearSampleDataClick = () => {
    setConfirmAction({
      isOpen: true,
      title: 'ยืนยันการลบข้อมูลตัวอย่างทั้งหมด (8 คน)',
      description: 'ระบบจะลบข้อมูลนักเรียนตัวอย่างทั้ง 8 คน (รหัส 05505 - 05512), ประวัติการตัด/เพิ่มคะแนนตัวอย่างทั้งหมด และสิทธิ์การเข้าดูของนักเรียนตัวอย่าง ออกจากฐานข้อมูลทั้งหมดอย่างสมบูรณ์ ข้อมูลที่สร้างขึ้นใหม่จะไม่ได้รับผลกระทบ',
      targetName: 'ลบข้อมูลตัวอย่าง 8 คนและประวัติทั้งหมดออกจากระบบ',
      dangerLevel: 'warning',
      confirmButtonText: 'ยืนยันลบข้อมูลตัวอย่างทั้งหมด',
      onConfirm: async () => {
        setDbLoading(true);
        setDbStatusMsg(null);
        try {
          if (onClearSampleData) {
            const result = await onClearSampleData();
            const count = typeof result === 'object' && result !== null ? (result.deletedStudents || 0) : (typeof result === 'number' ? result : 0);
            const logsCount = typeof result === 'object' && result !== null ? (result.deletedLogs || 0) : 0;
            setDbStatusMsg({
              type: 'success',
              text: `ลบข้อมูลตัวอย่างเรียบร้อยแล้ว (นักเรียน ${count} คน, ประวัติ ${logsCount} รายการ)`
            });
          }
        } catch (err: any) {
          setDbStatusMsg({ type: 'error', text: 'เกิดข้อผิดพลาดในการลบข้อมูลตัวอย่าง: ' + (err?.message || '') });
        } finally {
          setDbLoading(false);
        }
      }
    });
  };

  const handleResetDatabaseClick = () => {
    setConfirmAction({
      isOpen: true,
      title: 'ยืนยันการล้างข้อมูลทั้งระบบ (Reset to Admin Only)',
      description: 'ระบบจะลบข้อมูลนักเรียนทั้งหมด ประวัติการตัด/เพิ่มคะแนน สิทธิ์การดู และบัญชีผู้ใช้อื่นๆ ทั้งหมด โดยจะคืนค่าเหลือเฉพาะบัญชีผู้ดูแลระบบ (admin : 213894120)',
      targetName: 'ล้างฐานข้อมูลทั้งหมด -> คืนค่าเหลือ admin : 213894120',
      dangerLevel: 'danger',
      confirmButtonText: 'ยืนยันล้างข้อมูลทั้งระบบ',
      onConfirm: async () => {
        setDbLoading(true);
        setDbStatusMsg(null);
        try {
          const resetFn = onResetToAdminOnly || onResetDatabase;
          if (resetFn) await resetFn();
          setDbStatusMsg({
            type: 'success',
            text: 'ล้างฐานข้อมูลสำเร็จ ระบบถูกรีเซ็ตเหลือเฉพาะบัญชีผู้ดูแลระบบ (admin : 213894120)'
          });
        } catch (err: any) {
          setDbStatusMsg({ type: 'error', text: 'เกิดข้อผิดพลาดในการล้างฐานข้อมูล: ' + err?.message });
        } finally {
          setDbLoading(false);
        }
      }
    });
  };

  const handleRequestClearIndividualConduct = (targetStudent: Student, logsCount: number) => {
    setConfirmAction({
      isOpen: true,
      title: `ยืนยันลบประวัติและร่องรอยคะแนน (${targetStudent.id} ${targetStudent.firstName})`,
      description: `ระบบจะลบประวัติการเพิ่ม/หักคะแนนความประพฤติทั้งหมด (${logsCount} รายการ) และคืนคะแนนความประพฤติของนักเรียนกลับเป็น 100 คะแนนเต็ม พร้อมล้างคะแนนสะสมสำรองเป็น 0 และคืนสถานะไม่เคยถูกหักคะแนนอย่างถาวร ข้อมูลนักเรียนและห้องเรียนจะไม่สูญหาย`,
      targetName: `ลบประวัติและคืนคะแนน 100 ให้นักเรียน ${targetStudent.title || ''}${targetStudent.firstName} ${targetStudent.lastName} (${targetStudent.id})`,
      dangerLevel: 'warning',
      confirmButtonText: 'ยืนยันลบประวัติและคืนคะแนน 100',
      onConfirm: async () => {
        setDbLoading(true);
        setDbStatusMsg(null);
        try {
          if (onClearIndividualStudentConduct) {
            const res = await onClearIndividualStudentConduct(targetStudent.id);
            setDbStatusMsg({
              type: 'success',
              text: `ลบประวัติและคืนคะแนน 100 ให้นักเรียน ${targetStudent.firstName} ${targetStudent.lastName} เรียบร้อยแล้ว (ลบประวัติ ${res.deletedLogsCount} รายการ, คะแนนกลับเป็น 100 เต็ม)`
            });
          }
        } catch (err: any) {
          setDbStatusMsg({
            type: 'error',
            text: 'เกิดข้อผิดพลาดในการลบประวัติคะแนน: ' + (err?.message || '')
          });
        } finally {
          setDbLoading(false);
        }
      }
    });
  };

  const handleRequestClearAllConduct = (totalStudents: number, totalLogs: number) => {
    setConfirmAction({
      isOpen: true,
      title: `ยืนยันการลบประวัติและร่องรอยคะแนนนักเรียนทั้งหมด (${totalStudents} คน)`,
      description: `คำเตือนระดับสูง: การกระทำนี้จะลบประวัติการตัดและเพิ่มคะแนนความประพฤติทั้งหมดในระบบ (${totalLogs} รายการ) และปรับคืนคะแนนความประพฤติของนักเรียนทุกคน (${totalStudents} คน) กลับเป็น 100 คะแนนเต็ม พร้อมล้างคะแนนสะสมสำรองและคืนสถานะไม่เคยถูกตัดคะแนน ข้อมูลนักเรียนและบัญชีครูจะไม่ถูกลบ`,
      targetName: `ลบประวัติความประพฤติทั้งหมด ${totalLogs} รายการ และคืนคะแนน 100 เต็มให้นักเรียน ${totalStudents} คน`,
      dangerLevel: 'danger',
      confirmButtonText: 'ยืนยันลบประวัติและรีเซ็ตคะแนนทุกคน',
      onConfirm: async () => {
        setDbLoading(true);
        setDbStatusMsg(null);
        try {
          if (onClearAllConductData) {
            const res = await onClearAllConductData();
            setDbStatusMsg({
              type: 'success',
              text: `ลบประวัติและคืนคะแนน 100 ให้นักเรียนทั้งหมดเรียบร้อยแล้ว (ลบประวัติ ${res.deletedLogsCount} รายการ, ปรับคะแนนนักเรียน ${res.updatedStudentsCount} คน)`
            });
          }
        } catch (err: any) {
          setDbStatusMsg({
            type: 'error',
            text: 'เกิดข้อผิดพลาดในการล้างประวัติคะแนนทั้งหมด: ' + (err?.message || '')
          });
        } finally {
          setDbLoading(false);
        }
      }
    });
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header Breadcrumb Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-purple-600" />
                การกำหนดค่าระบบ
              </span>
              <span className="text-xs text-slate-500 font-medium">Cloud Database</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              ฐานข้อมูล & สำรอง
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              สำรองไฟล์ JSON กู้คืนฐานข้อมูล ตรวจสอบสถานะการเชื่อมต่อ และรีเซ็ตข้อมูลระบบ
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          ผู้ใช้งาน: <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.role === 'admin' ? '🛡️ ผู้ดูแลระบบ' : currentUser.role === 'staff' ? '👤 เจ้าหน้าที่' : 'ครู'})
        </div>
      </div>

      {/* 1. Database Connection Status Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-7 space-y-5">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border ${
              connectionState === 'connected'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                : connectionState === 'error'
                ? 'bg-rose-50 text-rose-600 border-rose-100'
                : 'bg-amber-50 text-amber-600 border-amber-100'
            }`}>
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  สถานะการเชื่อมต่อฐานข้อมูล (Cloud Database Status)
                </h2>
                {connectionState === 'connected' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    เชื่อมต่อสำเร็จ (ออนไลน์)
                  </span>
                ) : connectionState === 'error' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                    <WifiOff className="w-3 h-3 text-rose-600" />
                    ไม่สามารถเชื่อมต่อได้ (ออฟไลน์)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />
                    กำลังตรวจสอบการเชื่อมต่อ...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ระบบเชื่อมโยงและซิงค์ข้อมูลกับ Google Cloud Firestore แบบเรียลไทม์พร้อมแคชข้อมูลในเครื่อง
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={runConnectionTest}
              disabled={isTestingConnection}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin text-indigo-600' : 'text-slate-600'}`} />
              <span>{isTestingConnection ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อใหม่'}</span>
            </button>
          </div>
        </div>

        {/* Error Notification if any */}
        {connectionState === 'error' && connectionError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>พบปัญหาการเชื่อมต่อเซิร์ฟเวอร์ Firestore</span>
            </div>
            <p className="text-rose-700 pl-6">{connectionError}</p>
            <p className="text-[11px] text-rose-600 pl-6">
              หมายเหตุ: หากเบราว์เซอร์อยู่ในโหมดออฟไลน์ ระบบจะใช้ข้อมูลที่บันทึกไว้ในแคชบนเครื่อง (IndexedDB) เพื่อให้ระบบทำงานต่อไปได้ชั่วคราว
            </p>
          </div>
        )}

        {/* 4 Status Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Cloud Link & Latency */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                สถานะการเชื่อมโยง
              </span>
              <span className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-emerald-500' : connectionState === 'error' ? 'bg-rose-500' : 'bg-amber-400 animate-pulse'}`}></span>
            </div>
            <div className="text-base font-black text-slate-900 flex items-baseline gap-2">
              <span>{connectionState === 'connected' ? 'ออนไลน์สมบูรณ์' : connectionState === 'error' ? 'ออฟไลน์' : 'กำลังเชื่อมต่อ'}</span>
              {latencyMs !== null && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  {latencyMs} ms
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>ตรวจสอบ: {lastCheckedTime ? formatThaiDate(lastCheckedTime, 'time') : 'กำลังโหลด'}</span>
            </div>
          </div>

          {/* Card 2: Database Instance */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-purple-600" />
                ฐานข้อมูล Firestore
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                Instance
              </span>
            </div>
            <div className="flex items-center justify-between gap-1">
              <div className="text-xs font-mono font-bold text-slate-800 truncate" title={configInfo.firestoreDatabaseId}>
                {configInfo.firestoreDatabaseId}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(configInfo.firestoreDatabaseId, 'dbId')}
                className="p-1 text-slate-400 hover:text-purple-600 transition-colors cursor-pointer flex-shrink-0"
                title="คัดลอก Database ID"
              >
                {copiedField === 'dbId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-[11px] text-slate-500">
              {configInfo.mode}
            </div>
          </div>

          {/* Card 3: Cloud Project */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-sky-600" />
                GCP Project
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                Cloud
              </span>
            </div>
            <div className="flex items-center justify-between gap-1">
              <div className="text-xs font-mono font-bold text-slate-800 truncate" title={configInfo.projectId}>
                {configInfo.projectId}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(configInfo.projectId, 'projectId')}
                className="p-1 text-slate-400 hover:text-sky-600 transition-colors cursor-pointer flex-shrink-0"
                title="คัดลอก Project ID"
              >
                {copiedField === 'projectId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-[11px] text-slate-500 truncate" title={configInfo.authDomain}>
              {configInfo.authDomain}
            </div>
          </div>

          {/* Card 4: Local Cache Persistence */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                แคชเครื่อง (Offline Storage)
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                IndexedDB
              </span>
            </div>
            <div className="text-base font-black text-slate-900">
              Multi-Tab Cache
            </div>
            <div className="text-[11px] text-slate-500">
              รองรับเปิดหลายแท็บและทำงานได้ลื่นไหล
            </div>
          </div>
        </div>

        {/* Stored Data Summary (Cloud Collections Inventory) */}
        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              สรุปจำนวนข้อมูลที่บันทึกในฐานข้อมูลคลาวด์ปัจจุบัน
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Real-time Sync Active (อัตราการอัปเดตอัตโนมัติ)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-center shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">นักเรียน</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">{students.length.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400">คน</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-center shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">บันทึกประพฤติ</div>
              <div className="text-lg font-black text-indigo-700 mt-0.5">{conductLogs.length.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400">รายการ</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-center shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">ผู้ใช้งานระบบ</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">{users.length.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400">บัญชี</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-center shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">ครูที่ปรึกษา</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">{advisors.length.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400">ท่าน</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-center shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">เกณฑ์พฤติกรรม</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">{standardBehaviors.length.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400">หัวข้อ</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-center shadow-2xs">
              <div className="text-[11px] text-slate-500 font-medium">สิทธิ์ดูคะแนน</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">{accessGrants.length.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400">สิทธิ์</div>
            </div>
          </div>
        </div>

        {/* Collapsible Technical Specifications */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowTechDetails(!showTechDetails)}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>{showTechDetails ? 'ซ่อนข้อมูลจำเพาะเชิงเทคนิค' : 'ดูข้อมูลจำเพาะเชิงเทคนิคและความปลอดภัย (Technical Specs)'}</span>
            {showTechDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showTechDetails && (
            <div className="mt-3 p-4 rounded-2xl bg-slate-900 text-slate-200 text-xs font-mono space-y-2 border border-slate-800">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <span>Google Cloud Firestore Architecture</span>
                <span className="text-emerald-400 font-normal">Active & Secure</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                <div><span className="text-slate-400">Database ID:</span> <span className="text-indigo-300 ml-1">{configInfo.firestoreDatabaseId}</span></div>
                <div><span className="text-slate-400">GCP Project:</span> <span className="text-sky-300 ml-1">{configInfo.projectId}</span></div>
                <div><span className="text-slate-400">Transport:</span> <span className="text-slate-300 ml-1">{configInfo.transport}</span></div>
                <div><span className="text-slate-400">Persistence Cache:</span> <span className="text-amber-300 ml-1">{configInfo.cache}</span></div>
                <div><span className="text-slate-400">Auth Domain:</span> <span className="text-slate-300 ml-1">{configInfo.authDomain}</span></div>
                <div><span className="text-slate-400">Security Model:</span> <span className="text-emerald-300 ml-1">ABAC Rules v2</span></div>
                <div><span className="text-slate-400">Last Verified Ping:</span> <span className="text-slate-300 ml-1">{latencyMs ? `${latencyMs} ms` : '-'}</span></div>
                <div><span className="text-slate-400">Timestamp:</span> <span className="text-slate-300 ml-1">{lastCheckedTime ? formatThaiDate(lastCheckedTime, 'full-with-time') : '-'}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
        {dbStatusMsg && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
              dbStatusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {dbStatusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{dbStatusMsg.text}</span>
          </div>
        )}

        {/* Export & Import Backup */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5 font-bold text-slate-800 text-sm">
            <Database className="w-4 h-4 text-indigo-600" />
            <span>สำรองและกู้คืนฐานข้อมูล (Backup & Restore JSON)</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            ส่งออกข้อมูลทั้งหมดในระบบเป็นไฟล์ JSON เพื่อเก็บสำรองไว้ หรือนำเข้าไฟล์ที่สำรองไว้เพื่อกู้คืนข้อมูลนักเรียน บัญชีผู้ใช้ และประวัติความประพฤติ
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleExportBackupClick}
              disabled={dbLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออกไฟล์สำรอง (JSON)</span>
            </button>

            <input
              type="file"
              ref={backupFileInputRef}
              onChange={handleBackupFileSelect}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => backupFileInputRef.current?.click()}
              disabled={dbLoading}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>นำเข้าไฟล์กู้คืน (JSON)</span>
            </button>
          </div>
        </div>

        {/* 2. Load Sample Data */}
        <div className="p-5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 font-bold text-indigo-950 text-sm">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>โหลดข้อมูลตัวอย่างเริ่มต้น (Load Sample Data)</span>
              </div>
              <p className="text-xs text-indigo-800 leading-relaxed">
                โหลดข้อมูลนักเรียนตัวอย่าง 8 คน (รหัส 05505 - 05512) พร้อมประวัติการตัดและเพิ่มคะแนนตัวอย่างเข้าสู่ระบบ เพื่อทดลองและสาธิตการใช้งาน
              </p>
            </div>
            <button
              type="button"
              onClick={handleSeedSampleDataClick}
              disabled={dbLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>โหลดข้อมูลตัวอย่าง (8 คน)</span>
            </button>
          </div>
        </div>

        {/* 3. Clear Sample Data */}
        <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 font-bold text-amber-950 text-sm">
                <Trash2 className="w-4 h-4 text-amber-600" />
                <span>ลบข้อมูลตัวอย่างทั้งหมดออกจากระบบ (Clear Sample Data)</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                ลบข้อมูลนักเรียนตัวอย่างทั้ง 8 คน (รหัส 05505 - 05512), ประวัติการตัด/เพิ่มคะแนนตัวอย่างทั้งหมด และสิทธิ์เข้าดูของนักเรียนตัวอย่าง ออกจากฐานข้อมูลจริงทั้งหมดอย่างสมบูรณ์ (ต้องยืนยันรหัสผ่าน Admin)
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearSampleDataClick}
              disabled={dbLoading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบข้อมูลตัวอย่างทั้งหมด</span>
            </button>
          </div>
        </div>

        {/* 3.5 Conduct Logs and Traces Reset Manager (Individual or All) */}
        <ConductResetManager
          students={students}
          conductLogs={conductLogs}
          currentAcademicYear={academicYear}
          dbLoading={dbLoading}
          onRequestClearIndividual={handleRequestClearIndividualConduct}
          onRequestClearAll={handleRequestClearAllConduct}
          onAuditAndReconcile={onAuditAndReconcileConduct}
        />

        {/* 4. Reset to Admin Only */}
        <div className="p-5 bg-rose-50/60 border border-rose-200 rounded-2xl space-y-3">
          <div className="flex items-center gap-2.5 font-bold text-rose-900 text-sm">
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>ล้างฐานข้อมูลเริ่มต้นใหม่ทั้งหมด (Reset to Admin Only)</span>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            คำเตือน: การกระทำนี้จะลบข้อมูลนักเรียน ประวัติการตัด/เพิ่มคะแนน และบัญชีครูทั้งหมด เหลือเพียงบัญชีผู้ดูแลระบบ (admin : 213894120) บัญชีเดียวเท่านั้น (ต้องใช้รหัสผ่าน Admin ยืนยัน)
          </p>
          <button
            type="button"
            onClick={handleResetDatabaseClick}
            disabled={dbLoading}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            ล้างฐานข้อมูลเริ่มต้นใหม่
          </button>
        </div>
      </div>

      {/* Admin Password Confirm Modal */}
      <AdminPasswordConfirmModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        description={confirmAction.description}
        targetName={confirmAction.targetName}
        dangerLevel={confirmAction.dangerLevel}
        confirmButtonText={confirmAction.confirmButtonText}
        currentUser={currentUser}
        users={users}
        onClose={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmAction.onConfirm}
      />
    </div>
  );
};
