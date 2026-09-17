import React, { useState, useMemo } from 'react';
import {
  Student,
  ConductLog,
  StudentAccessGrant,
  AppUser,
  SystemSettings,
  AppView,
  ScoreCategoryType
} from '../types';
import {
  ClipboardCheck,
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
  Unlock,
  AlertCircle,
  Users,
  Award,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Printer,
  Calendar,
  School,
  ExternalLink,
  ShieldAlert,
  Info,
  RefreshCw,
  Eye
} from 'lucide-react';
import { StudentAvatar } from './StudentAvatar';
import {
  calculateStudentGrade,
  getScoreCategory
} from '../utils/conductLogic';

interface ScoreCheckViewProps {
  students: Student[];
  conductLogs: ConductLog[];
  accessGrants: StudentAccessGrant[];
  currentUser: AppUser | null;
  studentGrant: StudentAccessGrant | null;
  systemSettings: SystemSettings;
  currentAcademicYear: number;
  currentTerm: number;
  onNavigate: (view: AppView) => void;
  onSelectStudent: (studentId: string) => void;
  onStudentAuthorizedView?: (student: Student, grant: StudentAccessGrant) => void;
  onUpdateSystemSettings: (newSettings: SystemSettings) => Promise<void> | void;
  onGrantAccess?: (grant: StudentAccessGrant) => Promise<void> | void;
  onBatchGrantAllStudents?: () => Promise<void> | void;
}

export const ScoreCheckView: React.FC<ScoreCheckViewProps> = ({
  students = [],
  conductLogs = [],
  accessGrants = [],
  currentUser,
  studentGrant,
  systemSettings,
  currentAcademicYear,
  currentTerm,
  onNavigate,
  onSelectStudent,
  onStudentAuthorizedView,
  onUpdateSystemSettings,
  onBatchGrantAllStudents
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedStudentForInspection, setSelectedStudentForInspection] = useState<Student | null>(null);
  const [isTogglingAccess, setIsTogglingAccess] = useState(false);
  const [isBatchGranting, setIsBatchGranting] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Determine if current user is Admin or Staff (only these roles can grant all-students access)
  const canManageAllGrants = currentUser?.role === 'admin' || currentUser?.role === 'staff';
  const isTeacher = currentUser?.role === 'teacher';

  const isAllAccessEnabled = Boolean(systemSettings?.allowAllStudentsScoreCheck);

  // Filter active students
  const activeStudents = useMemo(() => {
    return students.filter(s => s.status !== 'INACTIVE' && s.status !== 'GRADUATED');
  }, [students]);

  // Active individual grants map
  const activeGrantsMap = useMemo(() => {
    const map = new Map<string, StudentAccessGrant>();
    for (const g of accessGrants) {
      if (g.isActive !== false) {
        map.set(g.studentId, g);
      }
    }
    return map;
  }, [accessGrants]);

  // Search & Filter students
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return activeStudents.filter(student => {
      const { grade } = calculateStudentGrade(
        student.entryYear,
        student.entryLevel,
        currentAcademicYear
      );

      // Grade filter
      if (selectedGrade !== 'ALL' && grade !== selectedGrade) {
        return false;
      }

      // Query filter
      if (!query) return true;

      const fullName = `${student.title || ''}${student.firstName} ${student.lastName}`.toLowerCase();
      const idMatch = student.id.toLowerCase().includes(query);
      const nameMatch = fullName.includes(query);
      const classMatch = `${grade}/${student.room}`.toLowerCase().includes(query);

      return idMatch || nameMatch || classMatch;
    });
  }, [activeStudents, searchQuery, selectedGrade, currentAcademicYear]);

  // Quick stats
  const stats = useMemo(() => {
    const total = activeStudents.length;
    const withActiveGrant = activeStudents.filter(s => activeGrantsMap.has(s.id)).length;
    return {
      total,
      withActiveGrant,
      allAccess: isAllAccessEnabled
    };
  }, [activeStudents, activeGrantsMap, isAllAccessEnabled]);

  // One-click toggle handler for Admin and Staff
  const handleToggleAllStudentsAccess = async () => {
    if (!canManageAllGrants) return;

    try {
      setIsTogglingAccess(true);
      const newStatus = !isAllAccessEnabled;

      const updatedSettings: SystemSettings = {
        ...systemSettings,
        allowAllStudentsScoreCheck: newStatus,
        allStudentsScoreCheckGrantedBy: newStatus
          ? `${currentUser?.name || 'ผู้ดูแลระบบ'} (${currentUser?.role === 'admin' ? 'ผู้ดูแลหลัก' : 'เจ้าหน้าที่ฝ่ายปกครอง'})`
          : undefined,
        allStudentsScoreCheckGrantedAt: newStatus ? new Date().toISOString() : undefined
      };

      await onUpdateSystemSettings(updatedSettings);

      setActionSuccessMessage(
        newStatus
          ? 'เปิดอนุญาตให้นักเรียนทุกคนตรวจสอบคะแนนตัวเองได้เรียบร้อยแล้ว (คลิกเดียวสำเร็จ)'
          : 'ปิดการอนุญาตทั่วไปแล้ว ระบบกลับสู่โหมดจำกัดสิทธิ์รายบุคคล'
      );

      setTimeout(() => {
        setActionSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('Failed to toggle all students access:', err);
    } finally {
      setIsTogglingAccess(false);
    }
  };

  // Optional batch grant handler (creates grant entries for all students)
  const handleBatchGrantAll = async () => {
    if (!canManageAllGrants || !onBatchGrantAllStudents) return;
    if (!window.confirm(`ยืนยันการออกใบอนุญาต (Grant) บันทึกลงฐานข้อมูลให้นักเรียนทุกคนจำนวน ${activeStudents.length} คน?`)) {
      return;
    }

    try {
      setIsBatchGranting(true);
      await onBatchGrantAllStudents();
      setActionSuccessMessage(`ออกใบอนุญาตบันทึกลงฐานข้อมูลให้นักเรียนทั้งหมด ${activeStudents.length} คนเรียบร้อยแล้ว`);
      setTimeout(() => {
        setActionSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('Batch grant error:', err);
    } finally {
      setIsBatchGranting(false);
    }
  };

  // Check if a specific student is authorized to view their scores
  const checkStudentAuthorization = (student: Student) => {
    // If logged in as staff or admin or teacher, always allowed
    if (currentUser) return { isAuthorized: true, reason: 'ดูในฐานะครู/เจ้าหน้าที่' };

    // If school-wide permission is active
    if (isAllAccessEnabled) {
      return {
        isAuthorized: true,
        reason: 'ได้รับอนุญาตแบบทั่วถึงทั้งโรงเรียน (โดยผู้ดูแล/ฝ่ายปกครอง)'
      };
    }

    // If student has individual active grant
    const grant = activeGrantsMap.get(student.id);
    if (grant) {
      return {
        isAuthorized: true,
        reason: `ได้รับอนุญาตรายบุคคล โดย ${grant.grantedByUserName || 'ครูที่ปรึกษา'}`
      };
    }

    // If current session is authorized for this student
    if (studentGrant && studentGrant.studentId === student.id && studentGrant.isActive !== false) {
      return { isAuthorized: true, reason: 'ได้รับสิทธิ์ในเซสชันนี้' };
    }

    return {
      isAuthorized: false,
      reason: 'ยังไม่ได้รับอนุญาตให้ดูคะแนนตนเอง (ต้องขอสิทธิ์จากครูที่ปรึกษาหรือฝ่ายปกครอง)'
    };
  };

  // Handle viewing student full profile/lookup
  const handleViewFullRecord = (student: Student) => {
    const auth = checkStudentAuthorization(student);
    if (!auth.isAuthorized) return;

    if (!currentUser && onStudentAuthorizedView) {
      // Create effective grant for the student view
      const grant: StudentAccessGrant = activeGrantsMap.get(student.id) || {
        id: `grant-view-${student.id}`,
        studentId: student.id,
        studentName: `${student.title || ''}${student.firstName} ${student.lastName}`,
        grantedByUserId: currentUser?.id || 'admin',
        grantedByUserName: systemSettings.allStudentsScoreCheckGrantedBy || 'ผู้ดูแลระบบ / ฝ่ายกิจการนักเรียน',
        grantedByUserRole: 'admin',
        grantedAt: systemSettings.allStudentsScoreCheckGrantedAt || new Date().toISOString(),
        isActive: true,
        reason: 'เปิดสิทธิ์ให้นักเรียนทุกคนดูคะแนนตนเองได้ทั่วถึงทั้งโรงเรียน'
      };
      onStudentAuthorizedView(student, grant);
    } else {
      onSelectStudent(student.id);
      onNavigate('LOOKUP');
    }
  };

  // Inspect student directly from search
  const inspectedStudent = selectedStudentForInspection || (filteredStudents.length === 1 && searchQuery.trim() !== '' ? filteredStudents[0] : null);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. HEADER SECTION */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-100/60 via-indigo-50/20 to-transparent rounded-bl-full pointer-events-none -mr-16 -mt-16" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200/70">
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>ระบบตรวจสอบคะแนนความประพฤติ</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>ปีการศึกษา {currentAcademicYear} ภาคเรียนที่ {currentTerm}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ตรวจสอบคะแนนนักเรียน
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              สืบค้นคะแนนความประพฤติ ประวัติการตัด/เพิ่มคะแนน และเกียรติประวัติของนักเรียน
              พร้อมแผงควบคุมสิทธิ์การเปิดดูคะแนนแบบคลิกเดียวสำหรับผู้ดูแลและเจ้าหน้าที่
            </p>
          </div>

          {/* Quick status pill */}
          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold shadow-2xs ${
                isAllAccessEnabled
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-slate-50 border-slate-300 text-slate-700'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isAllAccessEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>
                {isAllAccessEnabled
                  ? 'สถานะ: อนุญาตให้นักเรียนทุกคนดูคะแนนได้'
                  : 'สถานะ: ปิดการดูคะแนนทั่วไป (จำกัดสิทธิ์)'}
              </span>
            </div>
            {isAllAccessEnabled && systemSettings.allStudentsScoreCheckGrantedBy && (
              <span className="text-[11px] text-slate-500">
                อนุมัติโดย: {systemSettings.allStudentsScoreCheckGrantedBy}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl flex items-center justify-between gap-3 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ADMINISTRATIVE CONTROL CARD (FOR ADMIN & STAFF ONLY) */}
      {/* ========================================================================= */}
      {canManageAllGrants ? (
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 border border-indigo-800 shadow-md relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-800/80 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
                  <ShieldCheck className="w-6 h-6 text-indigo-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                      ศูนย์ควบคุมสิทธิ์ตรวจสอบคะแนน
                    </h2>
                    <span className="bg-indigo-500/30 text-indigo-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                      เฉพาะผู้ดูแลและเจ้าหน้าที่
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-indigo-200/80 mt-0.5">
                    อนุญาตแบบคลิกเดียว ให้นักเรียนทุกคนดูคะแนนของตนเองได้ทั่วถึงทั้งโรงเรียน
                  </p>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <div
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    isAllAccessEnabled
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                      : 'bg-white/10 border-white/20 text-slate-300'
                  }`}
                >
                  {isAllAccessEnabled ? (
                    <>
                      <Unlock className="w-4 h-4 text-emerald-400" />
                      <span>เปิดสิทธิ์ให้นักเรียนทุกคนแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span>ปิดการดูคะแนนทั่วไป</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* The One-Click Action Area */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 backdrop-blur-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>การเปิดสิทธิ์ตรวจสอบคะแนนแบบทันที (One-Click Permission)</span>
                </div>
                <p className="text-xs text-indigo-200/90 leading-relaxed">
                  {isAllAccessEnabled
                    ? 'ขณะนี้ระบบเปิดอนุญาตให้นักเรียนทุกคนเข้าตรวจสอบคะแนนความประพฤติของตนเองได้ทันทีโดยไม่ต้องขอรหัสผ่านหรือใบอนุญาตรายคน คุณสามารถคลิกเพื่อปิดระบบและกลับสู่โหมดจำกัดสิทธิ์ได้ทันที'
                    : 'คลิกเพียงครั้งเดียวเพื่อเปิดสิทธิ์ให้นักเรียนทุกคนในโรงเรียน (ทั้ง ' +
                      activeStudents.length.toLocaleString() +
                      ' คน) สามารถกรอกรหัสประจำตัวเพื่อดูผลคะแนนและประวัติความประพฤติของตนเองได้ทันที'}
                </p>
                {isAllAccessEnabled && systemSettings.allStudentsScoreCheckGrantedBy && (
                  <div className="text-[11px] text-emerald-300 font-medium pt-1">
                    ✓ อนุมัติการเปิดสิทธิ์โดย: {systemSettings.allStudentsScoreCheckGrantedBy}{' '}
                    {systemSettings.allStudentsScoreCheckGrantedAt &&
                      `เมื่อ ${new Date(systemSettings.allStudentsScoreCheckGrantedAt).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}`}
                  </div>
                )}
              </div>

              {/* Main One-Click Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <button
                  type="button"
                  id="one-click-grant-all-students-btn"
                  onClick={handleToggleAllStudentsAccess}
                  disabled={isTogglingAccess}
                  className={`px-5 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer ${
                    isAllAccessEnabled
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40 hover:shadow-rose-900/60'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-900/40 hover:shadow-emerald-900/60'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isTogglingAccess ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : isAllAccessEnabled ? (
                    <Lock className="w-5 h-5" />
                  ) : (
                    <Unlock className="w-5 h-5" />
                  )}
                  <span>
                    {isTogglingAccess
                      ? 'กำลังบันทึกข้อมูล...'
                      : isAllAccessEnabled
                      ? 'ปิดการอนุญาตทั่วไป (จำกัดสิทธิ์)'
                      : '✨ อนุญาตให้นักเรียนทุกคนดูคะแนนได้ (คลิกเดียว)'}
                  </span>
                </button>

                {onBatchGrantAllStudents && (
                  <button
                    type="button"
                    onClick={handleBatchGrantAll}
                    disabled={isBatchGranting}
                    className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs border border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    title="สร้างใบอนุญาต (Grant records) บันทึกรายบุคคลในฐานข้อมูลสำหรับนักเรียนทุกคน"
                  >
                    {isBatchGranting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Users className="w-4 h-4 text-indigo-300" />
                    )}
                    <span>ออกใบอนุญาตทุกคน ({activeStudents.length} คน)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
                <span className="text-[11px] text-indigo-300 font-medium">นักเรียนในระบบ</span>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">
                  {stats.total.toLocaleString()} คน
                </div>
              </div>

              <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
                <span className="text-[11px] text-indigo-300 font-medium">สิทธิ์รายบุคคล (Active)</span>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">
                  {stats.withActiveGrant.toLocaleString()} สิทธิ์
                </div>
              </div>

              <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
                <span className="text-[11px] text-indigo-300 font-medium">สิทธิ์แบบคลิกเดียว</span>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">
                  {isAllAccessEnabled ? '🟢 เปิดอยู่' : '⚪ ปิดอยู่'}
                </div>
              </div>

              <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between">
                <span className="text-[11px] text-indigo-300 font-medium">ประวัติสิทธิ์ทั้งหมด</span>
                <button
                  type="button"
                  onClick={() => onNavigate('SETTINGS_GRANTS')}
                  className="text-xs font-bold text-indigo-300 hover:text-white flex items-center gap-1 mt-1 cursor-pointer transition-colors"
                >
                  <span>จัดการสิทธิ์</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : isTeacher ? (
        /* Teacher notice card explaining restricted access */
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs sm:text-sm text-amber-900">
            <div className="font-bold text-amber-950">
              ข้อกำหนดสิทธิ์การใช้งาน (Role Permissions)
            </div>
            <p className="text-amber-800 leading-relaxed">
              สิทธิ์การอนุญาตแบบคลิกเดียว ให้นักเรียนทุกคนดูคะแนนตัวเองได้ สงวนไว้สำหรับ{' '}
              <span className="font-bold underline">ผู้ดูแลระบบ (Admin)</span> และ{' '}
              <span className="font-bold underline">เจ้าหน้าที่ฝ่ายปกครอง (Staff)</span>{' '}
              เท่านั้น คุณครูสามารถออกสิทธิ์รายบุคคลให้นักเรียนในที่ปรึกษาได้ที่เมนูค้นหานักเรียน
            </p>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* 3. STUDENT SCORE VERIFICATION / SEARCH PORTAL */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg mb-1">
              <Search className="w-3.5 h-3.5" />
              <span>ค้นหาและตรวจคะแนนด่วน</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              ค้นหาคะแนนความประพฤตินักเรียน
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              กรอกรหัสประจำตัวนักเรียน 5 หลัก, ชื่อ-นามสกุล หรือเลือกระดับชั้น เพื่อตรวจสอบผลคะแนนและสถานะ
            </p>
          </div>

          {/* Quick grade level filter pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {['ALL', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'].map(grade => (
              <button
                key={grade}
                type="button"
                onClick={() => setSelectedGrade(grade)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedGrade === grade
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {grade === 'ALL' ? 'ทุกระดับชั้น' : grade}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            id="score-check-search-input"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSelectedStudentForInspection(null);
            }}
            placeholder="พิมพ์รหัสนักเรียน 5 หลัก (เช่น 05505), ชื่อ-สกุล หรือ ม.1/1..."
            className="w-full pl-11 pr-24 py-3.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium text-slate-800 placeholder:text-slate-400 shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedStudentForInspection(null);
              }}
              className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-400 hover:text-slate-600 px-2 py-1 my-auto rounded-md cursor-pointer"
            >
              ล้างคำค้น
            </button>
          )}
        </div>

        {/* Selected / Inspected Student Showcase Card */}
        {inspectedStudent && (
          <div className="bg-gradient-to-br from-slate-50 to-indigo-50/50 border-2 border-indigo-200 rounded-3xl p-6 shadow-sm animate-in zoom-in-95 duration-200">
            {(() => {
              const student = inspectedStudent;
              const { grade } = calculateStudentGrade(
                student.entryYear,
                student.entryLevel,
                currentAcademicYear
              );
              const category = getScoreCategory(student, systemSettings);
              const auth = checkStudentAuthorization(student);
              const score = student.currentScore ?? 100;
              const banked = student.bankedPoints ?? 0;
              const advisorDisplay = student.advisorName || 'ยังไม่ได้ระบุ';

              return (
                <div className="space-y-6">
                  {/* Top Profile Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                    <div className="flex items-center gap-4">
                      <StudentAvatar
                        student={student}
                        size="lg"
                        className="ring-4 ring-white shadow-md rounded-2xl"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                            {student.title || ''}{student.firstName} {student.lastName}
                          </h3>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700">
                            ID: {student.id}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
                          <span>ชั้น {grade}/{student.room}</span>
                          {student.number && <span>เลขที่ {student.number}</span>}
                          <span>ครูที่ปรึกษา: <span className="font-semibold text-slate-800">{advisorDisplay}</span></span>
                        </div>
                      </div>
                    </div>

                    {/* Authorization Status Badge */}
                    <div className="shrink-0">
                      {auth.isAuthorized ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>ได้รับอนุญาตให้ดูคะแนนแล้ว</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 font-bold text-xs border border-rose-200">
                          <Lock className="w-4 h-4 text-rose-600" />
                          <span>ยังไม่ได้รับอนุญาตให้ดูคะแนน</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* If Authorized: Show Rich Score Card */}
                  {auth.isAuthorized ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Big Score Block */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                          <span>คะแนนความประพฤติปัจจุบัน</span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${category.badgeClass}`}>
                            {category.label}
                          </span>
                        </div>
                        <div className="my-3 flex items-baseline gap-2">
                          <span className={`text-4xl font-black ${category.textClass}`}>
                            {score}
                          </span>
                          <span className="text-slate-400 font-bold text-sm">/ 100 คะแนน</span>
                        </div>
                        {/* Visual Progress Bar */}
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              score >= 100 ? 'bg-indigo-600' : score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                          />
                        </div>
                      </div>

                      {/* Banked Points Block */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                          <span>คะแนนสะสมความดี (Banked)</span>
                          <Award className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="my-3 flex items-baseline gap-2">
                          <span className="text-4xl font-black text-amber-600">
                            +{banked}
                          </span>
                          <span className="text-slate-400 font-bold text-sm">แต้มสำรอง</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ใช้ชดเชยเมื่อถูกตัดคะแนนอัตโนมัติ
                        </div>
                      </div>

                      {/* Action & Full View Block */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between gap-3">
                        <div>
                          <div className="text-xs text-slate-500 font-medium">การเข้าดูข้อมูล</div>
                          <div className="text-xs text-slate-700 font-semibold mt-1">
                            {auth.reason}
                          </div>
                        </div>

                        <div className="space-y-2 pt-2">
                          <button
                            type="button"
                            onClick={() => handleViewFullRecord(student)}
                            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                            <span>ดูประวัติและคะแนนฉบับเต็ม</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Locked Notice for Unauthorized Student */
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto text-rose-600">
                        <Lock className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-bold text-rose-950">
                        รหัสนักเรียน {student.id} ยังไม่ได้รับอนุญาตให้เปิดดูคะแนน
                      </h4>
                      <p className="text-xs sm:text-sm text-rose-800 max-w-md mx-auto leading-relaxed">
                        ขณะนี้โรงเรียนปิดการตรวจสอบคะแนนทั่วไปชั่วคราว นักเรียนต้องขอสิทธิ์จากครูที่ปรึกษา ({advisorDisplay}) หรือเจ้าหน้าที่ฝ่ายปกครองเพื่อเปิดสิทธิ์การดูคะแนน
                      </p>
                      {canManageAllGrants && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={handleToggleAllStudentsAccess}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Unlock className="w-4 h-4" />
                            <span>คลิกเปิดอนุญาตให้นักเรียนทุกคนดูได้ทันที</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Student Cards Grid (List) */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-3">
            <span>
              รายชื่อนักเรียน ({filteredStudents.length} คน)
              {selectedGrade !== 'ALL' && ` — ชั้น ${selectedGrade}`}
              {searchQuery && ` — คำค้น "${searchQuery}"`}
            </span>
            <span className="text-slate-400">คลิกที่การ์ดเพื่อตรวจสอบคะแนน</span>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-bold text-sm text-slate-700">ไม่พบข้อมูลนักเรียนที่ตรงกับเงื่อนไข</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                กรุณาตรวจสอบรหัสนักเรียน หรือคำสะกดชื่อ-นามสกุลอีกครั้ง
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredStudents.slice(0, 48).map(st => {
                const { grade } = calculateStudentGrade(
                  st.entryYear,
                  st.entryLevel,
                  currentAcademicYear
                );
                const category = getScoreCategory(st, systemSettings);
                const auth = checkStudentAuthorization(st);
                const score = st.currentScore ?? 100;
                const isSelected = inspectedStudent?.id === st.id;

                return (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStudentForInspection(st)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-2xs flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-300'
                        : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <StudentAvatar student={st} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-mono font-bold text-indigo-600">
                            {st.id}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${category.badgeClass}`}>
                            {category.label}
                          </span>
                        </div>
                        <div className="font-bold text-sm text-slate-900 truncate mt-0.5">
                          {st.title || ''}{st.firstName} {st.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ม.{grade}/{st.room} {st.number ? `(เลขที่ ${st.number})` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500">คะแนน:</span>
                        <span className={`font-black ${category.textClass}`}>
                          {score}
                        </span>
                        {st.bankedPoints && st.bankedPoints > 0 ? (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded">
                            +{st.bankedPoints}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1">
                        {auth.isAuthorized ? (
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ดูได้</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>จำกัด</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredStudents.length > 48 && (
            <div className="text-center pt-4 text-xs text-slate-500">
              แสดง 48 รายการแรก จากทั้งหมด {filteredStudents.length} คน (กรุณาใช้ช่องค้นหาเพื่อเจาะจงนักเรียนที่ต้องการ)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
