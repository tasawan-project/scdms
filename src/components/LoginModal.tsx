import React, { useState, useMemo } from 'react';
import {
  AppUser,
  SystemSettings,
  Student,
  StudentAccessGrant,
  ConductLog,
  HomeroomAdvisor,
  StandardConductBehavior
} from '../types';
import {
  calculateStudentGrade,
  getScoreCategory,
  formatStudentAdvisors
} from '../utils/conductLogic';
import { formatThaiDate } from '../utils/thaiDate';
import { StudentAvatar } from './StudentAvatar';
import { INITIAL_STANDARD_BEHAVIORS } from '../data/standardBehaviorsData';
import {
  ShieldCheck,
  Lock,
  User,
  KeyRound,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  School,
  GraduationCap,
  Eye,
  EyeOff,
  UserCheck,
  ArrowRight,
  ShieldAlert,
  X,
  FileText,
  RotateCcw,
  Sparkles,
  Award,
  MinusCircle,
  PlusCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface LoginModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  canClose?: boolean;
  systemSettings: SystemSettings;
  users?: AppUser[];
  students?: Student[];
  conductLogs?: ConductLog[];
  accessGrants?: StudentAccessGrant[];
  advisors?: HomeroomAdvisor[];
  currentAcademicYear?: number;
  standardBehaviors?: StandardConductBehavior[];
  onLoginStaff?: (user: AppUser) => void;
  onStaffLogin?: (user: AppUser) => void;
  onStudentAuthorizedView: (student: Student, grant: StudentAccessGrant) => void;
  onRequestGrant?: (studentId: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen = true,
  onClose,
  canClose = true,
  systemSettings,
  users = [],
  students = [],
  conductLogs = [],
  accessGrants = [],
  advisors = [],
  currentAcademicYear = 2569,
  standardBehaviors = [],
  onLoginStaff,
  onStaffLogin,
  onStudentAuthorizedView,
  onRequestGrant
}) => {
  const [tab, setTab] = useState<'STAFF' | 'STUDENT'>('STAFF');

  // Staff Login Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Student Score Verification Form state
  const [studentIdInput, setStudentIdInput] = useState('');
  const [studentCheckResult, setStudentCheckResult] = useState<{
    status: 'IDLE' | 'FOUND' | 'NOT_FOUND';
    student?: Student;
    grant?: StudentAccessGrant;
    message?: string;
  }>({ status: 'IDLE' });

  // Log filter tab & expansion state for student conduct history table
  const [logFilterTab, setLogFilterTab] = useState<'ALL' | 'DEDUCT' | 'ADD'>('ALL');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Build behaviors list for resolving behavior titles and descriptions
  const allBehaviors = useMemo(() => {
    const list = [...(standardBehaviors || []), ...INITIAL_STANDARD_BEHAVIORS];
    const map = new Map<string, StandardConductBehavior>();
    list.forEach(b => {
      if (b && b.id && !map.has(b.id)) {
        map.set(b.id, b);
      }
    });
    return Array.from(map.values());
  }, [standardBehaviors]);

  // Helper to resolve title and description for conduct logs
  const getLogBehaviorInfo = (log: ConductLog): { behaviorTitle: string; description: string } => {
    if (log.behaviorTitle && log.behaviorTitle.trim()) {
      const title = log.behaviorTitle.trim();
      let desc = (log.description || '').trim();
      if (!desc) {
        const match = allBehaviors.find(
          b => b.title.trim().toLowerCase() === title.toLowerCase() || b.id === log.behaviorId
        );
        if (match?.description && match.description.trim()) {
          desc = match.description.trim();
        } else if (log.reason && log.reason.trim() !== title) {
          desc = log.reason.trim();
        }
      }
      return { behaviorTitle: title, description: desc };
    }

    if (log.behaviorId) {
      const match = allBehaviors.find(b => b.id === log.behaviorId);
      if (match) {
        return {
          behaviorTitle: match.title,
          description: (log.description || match.description || (log.reason !== match.title ? log.reason : '')).trim()
        };
      }
    }

    const cleanReason = (log.reason || '').trim();
    if (cleanReason) {
      if (cleanReason.includes(' : ')) {
        const [t, ...rest] = cleanReason.split(' : ');
        return {
          behaviorTitle: t.trim(),
          description: rest.join(' : ').trim()
        };
      }
      return {
        behaviorTitle: cleanReason,
        description: (log.description || '').trim()
      };
    }

    return {
      behaviorTitle: log.type === 'DEDUCT' ? 'หักคะแนนความประพฤติ' : 'เพิ่มคะแนนความประพฤติ',
      description: (log.description || '').trim()
    };
  };

  if (isOpen === false) return null;

  // Handle Staff / Teacher / Admin Login
  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    const userList = users || [];

    const foundUser = userList.find(
      u => u && u.username && u.username.toLowerCase() === cleanUsername && u.isActive !== false
    );

    if (!foundUser) {
      setLoginError('ไม่พบบัญชีผู้ใช้งานนี้ หรือบัญชีถูกปิดการใช้งาน');
      setIsSubmitting(false);
      return;
    }

    if (foundUser.password !== cleanPassword) {
      setLoginError('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบใหม่อีกครั้ง');
      setIsSubmitting(false);
      return;
    }

    setTimeout(() => {
      setIsSubmitting(false);
      if (onStaffLogin) {
        onStaffLogin(foundUser);
      } else if (onLoginStaff) {
        onLoginStaff(foundUser);
      }
    }, 300);
  };

  // Handle Student Score Check on the Login Screen
  const handleCheckStudentAccess = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = studentIdInput.trim();
    if (!cleanId) return;

    const studentList = students || [];
    const grantList = accessGrants || [];

    // Find student by ID (exact match or case-insensitive)
    const student = studentList.find(
      s => s && (s.id.trim() === cleanId || s.id.trim().toLowerCase() === cleanId.toLowerCase())
    );

    if (!student) {
      setStudentCheckResult({
        status: 'NOT_FOUND',
        message: `ไม่พบข้อมูลนักเรียนรหัส "${cleanId}" ในระบบ กรุณาตรวจสอบรหัสประจำตัวใหม่อีกครั้ง`
      });
      return;
    }

    // Find active grant if any
    const activeGrant = grantList.find(
      g => g && g.studentId === student.id && g.isActive !== false
    );

    const schoolWideGrant: StudentAccessGrant = {
      id: `auto-login-${student.id}`,
      studentId: student.id,
      studentName: `${student.title || ''}${student.firstName} ${student.lastName}`,
      grantedByUserId: 'system',
      grantedByUserName: systemSettings.allStudentsScoreCheckGrantedBy || 'ระบบตรวจคะแนนหน้าล็อกอิน',
      grantedByUserRole: 'admin',
      grantedAt: new Date().toISOString(),
      isActive: true,
      reason: 'ตรวจสอบคะแนนผ่านหน้าต่างเข้าสู่ระบบ'
    };

    setStudentCheckResult({
      status: 'FOUND',
      student,
      grant: activeGrant || schoolWideGrant,
      message: activeGrant
        ? `ได้รับสิทธิ์การดูคะแนนโดย ${activeGrant.grantedByUserName} (${activeGrant.grantedByUserRole === 'admin' ? 'ผู้ดูแลระบบ' : activeGrant.grantedByUserRole === 'staff' ? 'เจ้าหน้าที่' : 'ครู'})`
        : systemSettings?.allowAllStudentsScoreCheck
        ? 'โรงเรียนเปิดระบบตรวจสอบคะแนนนักเรียน'
        : 'ตรวจสอบคะแนนผ่านรหัสประจำตัวนักเรียนเรียบร้อย'
    });

    // Reset log filter and expansions on new student check
    setLogFilterTab('ALL');
    setExpandedLogIds(new Set());
  };

  const handleResetStudentCheck = () => {
    setStudentCheckResult({ status: 'IDLE' });
    setStudentIdInput('');
    setLogFilterTab('ALL');
    setExpandedLogIds(new Set());
  };

  const toggleExpandLog = (id: string) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const schoolNameDisplay = systemSettings?.schoolNameTh || systemSettings?.schoolName || 'โรงเรียนตัวอย่างวิทยา';
  const appNameDisplay = systemSettings?.appNameTh || 'ระบบบริหารจัดการคะแนนความประพฤตินักเรียน';

  // Derived state for the checked student
  const checkedStudent = studentCheckResult.student;
  const gradeInfo = checkedStudent
    ? calculateStudentGrade(checkedStudent.entryYear, checkedStudent.entryLevel, currentAcademicYear)
    : null;
  const scoreCategory = checkedStudent ? getScoreCategory(checkedStudent, systemSettings) : null;
  const currentScore = checkedStudent?.currentScore ?? 100;
  const totalDeducted = checkedStudent
    ? (checkedStudent.totalDeductedPoints !== undefined
        ? checkedStudent.totalDeductedPoints
        : Math.max(0, 100 - currentScore))
    : 0;
  const bankedPoints = checkedStudent?.bankedPoints ?? 0;

  // Student conduct logs
  const studentLogs = useMemo(() => {
    if (!checkedStudent) return [];
    return conductLogs
      .filter(l => l.studentId === checkedStudent.id)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }, [conductLogs, checkedStudent]);

  // Filtered logs by tab
  const filteredLogs = useMemo(() => {
    if (logFilterTab === 'ALL') return studentLogs;
    return studentLogs.filter(l => l.type === logFilterTab);
  }, [studentLogs, logFilterTab]);

  const advisorDisplay = checkedStudent
    ? formatStudentAdvisors(checkedStudent, advisors, currentAcademicYear) || checkedStudent.advisorName || 'ยังไม่ได้ระบุ'
    : '';

  const isShowingStudentResult = tab === 'STUDENT' && Boolean(checkedStudent);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className={`bg-white w-full ${
          isShowingStudentResult ? 'max-w-3xl lg:max-w-4xl' : 'max-w-xl'
        } max-h-[94vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-8 animate-in fade-in zoom-in-95 duration-200 relative transition-all`}
      >
        {canClose && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header with School Branding */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-5 sm:p-7 text-white relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-3.5 sm:gap-4 relative z-10">
            {systemSettings.logoUrl ? (
              <img
                src={systemSettings.logoUrl}
                alt="School Logo"
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded-2xl bg-white/10 p-1.5 backdrop-blur-sm border border-white/20 shadow-md shrink-0"
              />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0">
                <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-200" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 text-[11px] sm:text-xs font-semibold border border-indigo-400/30 mb-1">
                <School className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="truncate max-w-[200px] sm:max-w-none">{schoolNameDisplay}</span>
              </span>
              <h2 className="text-lg sm:text-2xl font-black tracking-tight leading-snug">
                {appNameDisplay}
              </h2>
              {systemSettings.appNameEn && (
                <p className="text-[11px] sm:text-xs text-indigo-200/80 font-medium truncate">
                  {systemSettings.appNameEn}
                </p>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-white/10 p-1 rounded-2xl mt-5 border border-white/15 backdrop-blur-md">
            <button
              type="button"
              id="login-tab-staff"
              onClick={() => {
                setTab('STAFF');
                setLoginError('');
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                tab === 'STAFF'
                  ? 'bg-white text-indigo-950 shadow-md'
                  : 'text-indigo-100/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>ครู / เจ้าหน้าที่ / ผู้ดูแล</span>
            </button>
            <button
              type="button"
              id="login-tab-student"
              onClick={() => {
                setTab('STUDENT');
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                tab === 'STUDENT'
                  ? 'bg-white text-indigo-950 shadow-md'
                  : 'text-indigo-100/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>นักเรียนตรวจดูคะแนน</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-7">
          {/* Tab 1: Staff / Teacher / Admin Login Form */}
          {tab === 'STAFF' && (
            <div className="space-y-6">
              <div className="text-center sm:text-left">
                <h3 className="text-lg font-bold text-slate-900">
                  เข้าสู่ระบบสำหรับบุคลากรทางการศึกษา
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งานตามระดับสิทธิ์ที่ได้รับมอบหมาย
                </p>
              </div>

              {loginError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{loginError}</span>
                </div>
              )}

              <form onSubmit={handleStaffLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    ชื่อผู้ใช้งาน (Username)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      id="staff-login-username"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="เช่น admin, teacher01"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    รหัสผ่าน (Password)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="staff-login-password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  id="staff-login-submit-btn"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isSubmitting ? 'กำลังตรวจสอบสิทธิ์...' : 'เข้าสู่ระบบ'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Tab 2: Student Score Check directly at the Login Screen */}
          {tab === 'STUDENT' && (
            <div className="space-y-6">
              {/* Top Title & Search bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-indigo-600 shrink-0" />
                    <span>ตรวจสอบคะแนนความประพฤตินักเรียน</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    กรอกรหัสประจำตัวนักเรียน 5 หลัก เพื่อดูสรุปคะแนนคงเหลือและประวัติการบันทึกพฤติกรรม
                  </p>
                </div>

                {checkedStudent && (
                  <button
                    type="button"
                    onClick={handleResetStudentCheck}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>ค้นหารหัสอื่น</span>
                  </button>
                )}
              </div>

              {/* Search Form */}
              <form onSubmit={handleCheckStudentAccess} className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      id="student-score-check-input"
                      required
                      value={studentIdInput}
                      onChange={e => {
                        setStudentIdInput(e.target.value);
                        if (studentCheckResult.status !== 'IDLE') {
                          setStudentCheckResult({ status: 'IDLE' });
                        }
                      }}
                      placeholder="พิมพ์รหัสนักเรียน เช่น 05505, 05506..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden transition-all shadow-inner"
                    />
                  </div>
                  <button
                    type="submit"
                    id="student-score-check-submit-btn"
                    className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 text-sm transition-colors cursor-pointer shrink-0"
                  >
                    <Search className="w-4 h-4" />
                    <span>ตรวจสอบ</span>
                  </button>
                </div>
              </form>

              {/* Error / Not Found Message */}
              {studentCheckResult.status === 'NOT_FOUND' && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs font-semibold animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">{studentCheckResult.message}</p>
                    <p className="text-[11px] text-rose-600 font-normal">
                      โปรดตรวจสอบรหัสประจำตัวนักเรียน หรือติดต่อครูประจำชั้น / ฝ่ายกิจการนักเรียน
                    </p>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* DISPLAY STUDENT SCORE SUMMARY & CONDUCT LOGS HISTORY RIGHT AT LOGIN SCREEN */}
              {/* ========================================================================= */}
              {checkedStudent && gradeInfo && scoreCategory && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* 1. Student Identity Banner */}
                  <div className="bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 p-4 sm:p-5 rounded-2xl border border-indigo-100/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-xs border border-indigo-200/80 shrink-0 bg-white">
                        <StudentAvatar
                          student={checkedStudent}
                          currentAcademicYear={currentAcademicYear}
                          size="full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="font-mono text-xs font-black px-2 py-0.5 bg-indigo-600 text-white rounded-md shadow-2xs">
                            {checkedStudent.id}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${scoreCategory.badgeClass}`}
                          >
                            {scoreCategory.label}
                          </span>
                          {checkedStudent.hasNeverBeenDeducted && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>ไม่เคยโดนหักคะแนน</span>
                            </span>
                          )}
                        </div>
                        <h4 className="text-base sm:text-lg font-black text-slate-900 truncate">
                          {checkedStudent.title}
                          {checkedStudent.firstName} {checkedStudent.lastName}
                        </h4>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                          <span>
                            ระดับชั้น{' '}
                            <strong className="text-slate-800 font-bold">
                              {gradeInfo.grade} ห้อง {checkedStudent.room}
                            </strong>{' '}
                            {checkedStudent.number ? `(เลขที่ ${checkedStudent.number})` : ''}
                          </span>
                          <span className="text-slate-300 hidden sm:inline">•</span>
                          <span className="text-slate-500">
                            ครูที่ปรึกษา: <strong className="text-slate-700 font-medium">{advisorDisplay}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Three Bento Score Summary Cards */}
                  {/* สรุปคะแนนคงเหลือปัจจุบัน | คะแนนที่ถูกหัก | คะแนนสำรอง */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Card 1: สรุปคะแนนคงเหลือปัจจุบัน */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-center flex flex-col justify-between shadow-2xs">
                      <div className="text-xs font-bold text-slate-600 flex items-center justify-center gap-1.5 mb-1.5">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>คะแนนคงเหลือปัจจุบัน</span>
                      </div>
                      <div className="my-1">
                        <span
                          className={`text-3xl sm:text-4xl font-black font-mono ${
                            currentScore <= 50
                              ? 'text-rose-600'
                              : currentScore <= 70
                              ? 'text-amber-600'
                              : 'text-indigo-700'
                          }`}
                        >
                          {currentScore}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        คะแนนความประพฤติ (เต็ม 100)
                      </div>
                    </div>

                    {/* Card 2: คะแนนที่ถูกหัก */}
                    <div className="bg-rose-50/70 border border-rose-200/90 rounded-2xl p-4 text-center flex flex-col justify-between shadow-2xs">
                      <div className="text-xs font-bold text-rose-800 flex items-center justify-center gap-1.5 mb-1.5">
                        <MinusCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>คะแนนที่ถูกหัก</span>
                      </div>
                      <div className="my-1">
                        <span className="text-3xl sm:text-4xl font-black font-mono text-rose-600">
                          {totalDeducted > 0 ? `-${totalDeducted}` : '0'}
                        </span>
                      </div>
                      <div className="text-[11px] text-rose-700/80 font-medium">
                        คะแนนที่ถูกหักสะสมปัจจุบัน
                      </div>
                    </div>

                    {/* Card 3: คะแนนสำรอง */}
                    <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-4 text-center flex flex-col justify-between shadow-2xs">
                      <div className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5 mb-1.5">
                        <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>คะแนนสำรอง</span>
                      </div>
                      <div className="my-1">
                        <span className="text-3xl sm:text-4xl font-black font-mono text-emerald-600">
                          +{bankedPoints}
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-700/80 font-medium">
                        แต้มสะสมความดีสำรอง
                      </div>
                    </div>
                  </div>

                  {/* 3. Conduct History Table (ตารางประวัติการบันทึกพฤติกรรม) */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
                    {/* Table Header & Filter Tabs */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        <h4 className="font-bold text-slate-900 text-sm">
                          ตารางประวัติการบันทึกพฤติกรรม
                        </h4>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {studentLogs.length} รายการ
                        </span>
                      </div>

                      {/* Filter pills */}
                      <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setLogFilterTab('ALL')}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            logFilterTab === 'ALL'
                              ? 'bg-white text-slate-900 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ทั้งหมด ({studentLogs.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogFilterTab('DEDUCT')}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            logFilterTab === 'DEDUCT'
                              ? 'bg-white text-rose-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-rose-700'
                          }`}
                        >
                          ตัดคะแนน ({studentLogs.filter(l => l.type === 'DEDUCT').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogFilterTab('ADD')}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            logFilterTab === 'ADD'
                              ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-emerald-700'
                          }`}
                        >
                          เพิ่มคะแนน ({studentLogs.filter(l => l.type === 'ADD').length})
                        </button>
                      </div>
                    </div>

                    {/* Table View */}
                    {filteredLogs.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                        <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                        <p className="text-xs font-bold text-slate-800">
                          ไม่พบประวัติการบันทึกพฤติกรรมในหมวดนี้
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          นักเรียนมีความประพฤติดีเรียบร้อย ไม่มีประวัติถูกตัดคะแนน
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-100 max-h-72 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                            <tr>
                              <th className="py-2.5 px-3 whitespace-nowrap">วันที่</th>
                              <th className="py-2.5 px-2.5 whitespace-nowrap">ประเภท</th>
                              <th className="py-2.5 px-3 min-w-[180px]">รายละเอียดพฤติกรรม</th>
                              <th className="py-2.5 px-2.5 text-right whitespace-nowrap">คะแนน</th>
                              <th className="py-2.5 px-2.5 text-right whitespace-nowrap">คงเหลือ</th>
                              <th className="py-2.5 px-2 text-center w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredLogs.map(log => {
                              const isDeduct = log.type === 'DEDUCT';
                              const isExpanded = expandedLogIds.has(log.id);
                              const behaviorInfo = getLogBehaviorInfo(log);

                              return (
                                <React.Fragment key={log.id}>
                                  <tr
                                    onClick={() => toggleExpandLog(log.id)}
                                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                                      isExpanded ? 'bg-indigo-50/30' : ''
                                    }`}
                                  >
                                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-medium">
                                      <div>{formatThaiDate(log.recordedAt, 'short')}</div>
                                      {log.violationDate && (
                                        <div className="text-[10px] text-amber-700 font-normal">
                                          เกิดเหตุ: {formatThaiDate(log.violationDate, 'short')}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          isDeduct
                                            ? 'bg-rose-100 text-rose-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                      >
                                        {isDeduct ? 'หักคะแนน' : 'เพิ่มคะแนน'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 min-w-[180px] max-w-xs">
                                      <div
                                        className="font-bold text-slate-800 text-xs truncate"
                                        title={behaviorInfo.behaviorTitle}
                                      >
                                        {behaviorInfo.behaviorTitle}
                                      </div>
                                      {behaviorInfo.description ? (
                                        <div
                                          className="text-slate-500 text-[11px] truncate mt-0.5"
                                          title={behaviorInfo.description}
                                        >
                                          {behaviorInfo.description}
                                        </div>
                                      ) : null}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-mono font-bold whitespace-nowrap">
                                      <span className={isDeduct ? 'text-rose-600' : 'text-emerald-600'}>
                                        {isDeduct ? `-${log.points}` : `+${log.points}`}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                      {log.scoreAfter ?? 100}
                                    </td>
                                    <td className="py-2.5 px-2 text-center text-slate-400">
                                      {isExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5 mx-auto text-indigo-600" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5 mx-auto" />
                                      )}
                                    </td>
                                  </tr>

                                  {/* Expanded Row Detail */}
                                  {isExpanded && (
                                    <tr className="bg-slate-50/90">
                                      <td colSpan={6} className="p-3 border-t border-slate-100">
                                        <div className="space-y-2 text-xs text-slate-600">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                              <span className="text-slate-400 block text-[10px]">
                                                หัวข้อ / ชื่อพฤติกรรมมาตรฐาน:
                                              </span>
                                              <span className="font-bold text-slate-800">
                                                {behaviorInfo.behaviorTitle}
                                              </span>
                                              {log.category && (
                                                <span className="inline-block ml-1 text-[10px] text-slate-500 bg-slate-200/80 px-1.5 py-0.2 rounded">
                                                  หมวด: {log.category}
                                                </span>
                                              )}
                                            </div>
                                            <div>
                                              <span className="text-slate-400 block text-[10px]">
                                                ผู้บันทึกข้อมูล:
                                              </span>
                                              <span className="font-bold text-slate-800">
                                                {log.recordedByName || log.recordedBy || 'เจ้าหน้าที่'}
                                              </span>
                                            </div>
                                          </div>

                                          {behaviorInfo.description && (
                                            <div>
                                              <span className="text-slate-400 block text-[10px]">
                                                เกณฑ์การพิจารณา / รายละเอียด:
                                              </span>
                                              <p className="text-slate-700 leading-relaxed">
                                                {behaviorInfo.description}
                                              </p>
                                            </div>
                                          )}

                                          {log.notes && (
                                            <div className="p-2 bg-amber-50 rounded-lg border border-amber-200/80 text-[11px] text-amber-900">
                                              <strong className="block font-bold">บันทึกเพิ่มเติม:</strong>
                                              <p className="mt-0.5">{log.notes}</p>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Table Footer Summary Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <span className="text-[11px] text-slate-500">
                        แสดง <strong>{filteredLogs.length}</strong> จาก <strong>{studentLogs.length}</strong> รายการ
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 font-bold border border-rose-200 text-[11px]">
                          <span>รวมหักสะสม:</span>
                          <span className="font-mono">-{totalDeducted}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[11px]">
                          <span>สำรองสะสม:</span>
                          <span className="font-mono">+{bankedPoints}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-center sm:justify-start pt-2">
                    <button
                      type="button"
                      onClick={handleResetStudentCheck}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>ตรวจสอบนักเรียนคนอื่น</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Helper text when idle */}
              {studentCheckResult.status === 'IDLE' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-center text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">
                    💡 นักเรียนสามารถตรวจสอบผลคะแนนความประพฤติได้ด้วยตนเอง
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
                    พิมพ์รหัสประจำตัวนักเรียน 5 หลัก (เช่น 05505) แล้วกดปุ่ม &quot;ตรวจสอบ&quot; ระบบจะแสดงสรุปคะแนนคงเหลือปัจจุบัน คะแนนที่ถูกหัก คะแนนสำรอง และตารางประวัติการบันทึกพฤติกรรมทันที
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Security Session Indicator */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium text-center shrink-0">
          <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>ระบบความปลอดภัย: การตรวจสอบคะแนนผ่านหน้านี้สามารถดูข้อมูลสรุปและประวัติของตนเองได้ทันที</span>
        </div>
      </div>
    </div>
  );
};

