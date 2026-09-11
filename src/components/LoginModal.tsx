import React, { useState } from 'react';
import { AppUser, SystemSettings, Student, StudentAccessGrant } from '../types';
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
  X
} from 'lucide-react';

interface LoginModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  canClose?: boolean;
  systemSettings: SystemSettings;
  users?: AppUser[];
  students?: Student[];
  accessGrants?: StudentAccessGrant[];
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
  accessGrants = [],
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
    status: 'IDLE' | 'GRANTED' | 'NOT_GRANTED' | 'NOT_FOUND';
    student?: Student;
    grant?: StudentAccessGrant;
    message?: string;
  }>({ status: 'IDLE' });

  if (isOpen === false) return null;

  // Handle Staff / Teacher / Admin Login
  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    const userList = users || [];

    // Check user credentials
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

    // Success
    setTimeout(() => {
      setIsSubmitting(false);
      if (onStaffLogin) {
        onStaffLogin(foundUser);
      } else if (onLoginStaff) {
        onLoginStaff(foundUser);
      }
    }, 300);
  };

  // Handle Student Permission Check
  const handleCheckStudentAccess = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = studentIdInput.trim();
    if (!cleanId) return;

    const studentList = students || [];
    const grantList = accessGrants || [];

    const student = studentList.find(s => s && s.id === cleanId);
    if (!student) {
      setStudentCheckResult({
        status: 'NOT_FOUND',
        message: `ไม่พบข้อมูลนักเรียนรหัส "${cleanId}" ในระบบ`
      });
      return;
    }

    // Find active grant for this student
    const activeGrant = grantList.find(
      g => g && g.studentId === cleanId && g.isActive !== false
    );

    if (activeGrant) {
      setStudentCheckResult({
        status: 'GRANTED',
        student,
        grant: activeGrant,
        message: `ได้รับอนุญาตให้ดูคะแนนแล้ว โดย ${activeGrant.grantedByUserName} (${activeGrant.grantedByUserRole})`
      });
    } else {
      setStudentCheckResult({
        status: 'NOT_GRANTED',
        student,
        message: 'ยังไม่ได้รับอนุญาตให้เปิดดูคะแนน กรุณาติดต่อครูที่ปรึกษาหรือเจ้าหน้าที่ฝ่ายปกครองเพื่อขอเปิดสิทธิ์'
      });
    }
  };

  const schoolNameDisplay = systemSettings?.schoolNameTh || systemSettings?.schoolName || 'โรงเรียนตัวอย่างวิทยา';
  const appNameDisplay = systemSettings?.appNameTh || 'ระบบบริหารจัดการคะแนนความประพฤตินักเรียน';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200 relative">
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
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-5 sm:p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-3.5 sm:gap-4 relative z-10">
            {systemSettings.logoUrl ? (
              <img
                src={systemSettings.logoUrl}
                alt="School Logo"
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded-2xl bg-white/10 p-1.5 backdrop-blur-sm border border-white/20 shadow-md flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center text-white shadow-md flex-shrink-0">
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
              {canClose === false && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 text-[11px] font-bold border border-amber-400/30">
                  <Lock className="w-3 h-3 text-amber-300" />
                  <span>ต้องเข้าสู่ระบบก่อนจึงสามารถเข้าใช้ระบบได้</span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-white/10 p-1 rounded-2xl mt-6 border border-white/15 backdrop-blur-md">
            <button
              type="button"
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
              onClick={() => {
                setTab('STUDENT');
                setStudentCheckResult({ status: 'IDLE' });
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

        {/* Tab 1: Staff / Teacher / Admin Login Form */}
        {tab === 'STAFF' && (
          <div className="p-6 sm:p-8 space-y-6">
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
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
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
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                <Lock className="w-4 h-4" />
                <span>{isSubmitting ? 'กำลังตรวจสอบสิทธิ์...' : 'เข้าสู่ระบบ'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Student Viewing Gate with Authorization Check */}
        {tab === 'STUDENT' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-center sm:text-left">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-600" />
                <span>ตรวจสอบคะแนนความประพฤตินักเรียน</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                นักเรียนสามารถดูข้อมูลได้เฉพาะเมื่อได้รับการอนุญาตจากครูหรือเจ้าหน้าที่แล้วเท่านั้น
              </p>
            </div>

            <form onSubmit={handleCheckStudentAccess} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  รหัสประจำตัวนักเรียน
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={studentIdInput}
                      onChange={e => {
                        setStudentIdInput(e.target.value);
                        if (studentCheckResult.status !== 'IDLE') {
                          setStudentCheckResult({ status: 'IDLE' });
                        }
                      }}
                      placeholder="เช่น 05505, 05506"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm flex items-center gap-1.5 text-sm transition-colors cursor-pointer"
                  >
                    <span>ตรวจสอบ</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>

            {/* Verification Result Display */}
            {studentCheckResult.status === 'GRANTED' && studentCheckResult.student && studentCheckResult.grant && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">
                      ได้รับสิทธิ์การดูคะแนนเรียบร้อยแล้ว
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      นักเรียน: <strong className="font-semibold">{studentCheckResult.student.title}{studentCheckResult.student.firstName} {studentCheckResult.student.lastName}</strong> ({studentCheckResult.student.id})
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>ผู้อนุญาต: <strong>{studentCheckResult.grant.grantedByUserName}</strong> ({studentCheckResult.grant.grantedByUserRole === 'admin' ? 'ผู้ดูแลระบบ' : studentCheckResult.grant.grantedByUserRole === 'staff' ? 'เจ้าหน้าที่' : 'ครู'})</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onStudentAuthorizedView(studentCheckResult.student!, studentCheckResult.grant!)
                  }
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>เปิดดูข้อมูลคะแนนและประวัติความประพฤติ</span>
                </button>
              </div>
            )}

            {studentCheckResult.status === 'NOT_GRANTED' && studentCheckResult.student && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-950">
                      ยังไม่ได้รับอนุญาตให้เปิดดูคะแนน
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      นักเรียน: {studentCheckResult.student.title}{studentCheckResult.student.firstName} {studentCheckResult.student.lastName} ({studentCheckResult.student.id})
                    </p>
                    <p className="text-xs text-amber-700 mt-1.5 leading-relaxed">
                      ตามระเบียบโรงเรียน การเปิดดูคะแนนรายบุคคลต้องได้รับอนุญาตจากครูที่ปรึกษา ({studentCheckResult.student.advisorName || 'ครูประจำชั้น'}), ครูผู้สอน หรือเจ้าหน้าที่ฝ่ายปกครองก่อน
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
                  <span className="text-amber-800 font-medium">หากครู/เจ้าหน้าที่อยู่ด้วย:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('STAFF');
                    }}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white px-3 py-1.5 rounded-lg border border-amber-300 shadow-2xs cursor-pointer"
                  >
                    ล็อกอินเพื่อกดอนุญาตทันที
                  </button>
                </div>
              </div>
            )}

            {studentCheckResult.status === 'NOT_FOUND' && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-semibold animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{studentCheckResult.message}</span>
              </div>
            )}

            <div className="text-center text-xs text-slate-400 pt-2">
              <span>สามารถติดต่อห้องฝ่ายกิจการนักเรียน หรือครูที่ปรึกษา เพื่อขอตรวจสอบคะแนน</span>
            </div>
          </div>
        )}

        {/* Security Session Indicator */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium text-center">
          <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>ระบบความปลอดภัย: การเข้าสู่ระบบจะสิ้นสุดลงทันทีเมื่อปิดหน้าต่างเบราว์เซอร์ หรือเมื่อกดออกจากระบบ</span>
        </div>
      </div>
    </div>
  );
};
