import React, { useState, useRef } from 'react';
import { AppUser, Student, ConductLog, SystemSettings } from '../types';
import { AdminPasswordConfirmModal } from './AdminPasswordConfirmModal';
import { ConductResetManager } from './ConductResetManager';
import {
  Database,
  Download,
  Upload,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface DatabaseSettingsProps {
  currentUser: AppUser;
  users?: AppUser[];
  students: Student[];
  conductLogs: ConductLog[];
  systemSettings?: SystemSettings;
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
              สำรองไฟล์ JSON กู้คืนฐานข้อมูล และรีเซ็ตข้อมูลระบบ
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          ผู้ใช้งาน: <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.role === 'admin' ? '🛡️ ผู้ดูแลระบบ' : currentUser.role === 'staff' ? '👤 เจ้าหน้าที่' : 'ครู'})
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
