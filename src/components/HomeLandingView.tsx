import React, { useState, useMemo } from 'react';
import {
  Student,
  ConductLog,
  SystemSettings,
  AppUser,
  HomeroomAdvisor,
  StandardConductBehavior,
  AppView
} from '../types';
import { calculateStudentGrade, getScoreCategory, getStudentAdvisors } from '../utils/conductLogic';
import { StudentAvatar } from './StudentAvatar';
import {
  Search,
  ShieldCheck,
  Award,
  GraduationCap,
  Users,
  Calendar,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  School,
  BookOpen,
  AlertCircle,
  TrendingUp,
  HeartHandshake,
  Eye,
  LogIn,
  Star,
  ShieldAlert,
  UserCheck,
  Check
} from 'lucide-react';

interface HomeLandingViewProps {
  students: Student[];
  conductLogs: ConductLog[];
  systemSettings: SystemSettings;
  advisors: HomeroomAdvisor[];
  standardBehaviors: StandardConductBehavior[];
  users: AppUser[];
  currentUser: AppUser | null;
  onNavigate: (view: AppView) => void;
  onSelectStudent: (studentId: string) => void;
  onOpenLogin: () => void;
  onDemoLogin: (user?: AppUser) => void;
}

export const HomeLandingView: React.FC<HomeLandingViewProps> = ({
  students = [],
  conductLogs = [],
  systemSettings,
  advisors = [],
  standardBehaviors = [],
  users = [],
  currentUser,
  onNavigate,
  onSelectStudent,
  onOpenLogin,
  onDemoLogin
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<'ALL' | string>('ALL');
  const [activeInfoTab, setActiveInfoTab] = useState<'CRITERIA' | 'BEHAVIORS' | 'ADVISORS'>('CRITERIA');

  const currentYear = systemSettings?.currentAcademicYear || 2569;
  const currentTerm = systemSettings?.currentTerm || 1;
  const schoolName = systemSettings?.schoolNameTh || systemSettings?.schoolName || 'โรงเรียนจุฬาภรณราชวิทยาลัย ชลบุรี';
  const appName = systemSettings?.appNameTh || 'ระบบบริหารจัดการคะแนนความประพฤตินักเรียน';

  // Active students
  const activeStudents = useMemo(() => {
    return (students || []).filter(s => s && s.status === 'ACTIVE');
  }, [students]);

  // Overall statistics
  const stats = useMemo(() => {
    const total = activeStudents.length;
    let sumScore = 0;
    let perfectScoreCount = 0;
    let positiveLogsCount = 0;

    activeStudents.forEach(s => {
      const score = s.currentScore ?? 100;
      sumScore += score;
      if (score >= 100 && (s.bankedPoints || 0) >= 0 && (s.totalDeductionsCount || 0) === 0) {
        perfectScoreCount++;
      }
    });

    (conductLogs || []).forEach(l => {
      if (l.type === 'ADD') {
        positiveLogsCount++;
      }
    });

    const averageScore = total > 0 ? (sumScore / total).toFixed(1) : '100.0';

    return {
      totalStudents: total,
      averageScore,
      perfectScoreCount,
      positiveLogsCount
    };
  }, [activeStudents, conductLogs]);

  // Live matching students for quick search
  const matchingStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return activeStudents
      .filter(s => {
        const idMatch = (s.id || '').toLowerCase().includes(query);
        const fullName = `${s.title || ''}${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
        const nameMatch = fullName.includes(query);
        const nickMatch = (s.nickname || '').toLowerCase().includes(query);
        const roomMatch = `ห้อง ${s.room}`.toLowerCase().includes(query) || `${s.room}` === query;

        const { grade } = calculateStudentGrade(s.entryYear, s.entryLevel, currentYear);
        const gradeMatch = grade.toLowerCase().includes(query) || `${grade}/${s.room}`.includes(query);

        return idMatch || nameMatch || nickMatch || roomMatch || gradeMatch;
      })
      .slice(0, 8); // Top 8 matches
  }, [activeStudents, searchQuery, currentYear]);

  // Top honour students showcase
  const topHonourStudents = useMemo(() => {
    return [...activeStudents]
      .filter(s => (s.currentScore ?? 100) >= 100)
      .sort((a, b) => {
        // First by bankedPoints, then by currentScore
        const bpA = a.bankedPoints || 0;
        const bpB = b.bankedPoints || 0;
        if (bpB !== bpA) return bpB - bpA;
        return (b.currentScore ?? 100) - (a.currentScore ?? 100);
      })
      .slice(0, 4);
  }, [activeStudents]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in duration-200">
      {/* 1. HERO SECTION & PORTAL BANNER */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 border border-slate-800 shadow-xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            {/* School & Term Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold backdrop-blur-md border border-white/10">
                <School className="w-3.5 h-3.5" />
                <span>{schoolName}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
                <Calendar className="w-3.5 h-3.5" />
                <span>ปีการศึกษา {currentYear} ภาคเรียนที่ {currentTerm}</span>
              </span>
            </div>

            {/* Title & Tagline */}
            <div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight text-white">
                {appName}
              </h1>
              <p className="text-sm sm:text-base text-slate-300 mt-2 leading-relaxed">
                ระบบสืบค้นและตรวจสอบคะแนนความประพฤติออนไลน์ พร้อมติดตามเกียรติประวัติ
                คะแนนสะสมความดี และระเบียบวินัยนักเรียนแบบเรียลไทม์
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('LOOKUP')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer hover:shadow-indigo-500/25"
              >
                <Search className="w-4 h-4" />
                <span>ค้นหาคะแนนนักเรียนทั้งหมด</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('HONOUR')}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm backdrop-blur-md transition-colors flex items-center gap-2 border border-white/15 cursor-pointer"
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>ทำเนียบเกียรติยศ (100+)</span>
              </button>

              {!currentUser ? (
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-indigo-200 rounded-xl font-bold text-sm border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>เข้าสู่ระบบครู/ฝ่ายปกครอง</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate('DASHBOARD')}
                  className="px-4 py-2.5 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-md transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>เข้าสู่แดชบอร์ดจัดการ ({currentUser.name})</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Stat Pill Cards */}
          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto min-w-[280px] sm:min-w-[340px]">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-between text-indigo-300 text-xs font-semibold">
                <span>นักเรียนทั้งหมด</span>
                <Users className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                {stats.totalStudents.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">ในระบบปัจจุบัน</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold">
                <span>คะแนนเฉลี่ย</span>
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                {stats.averageScore}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">จาก 100 คะแนนเต็ม</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-between text-amber-300 text-xs font-semibold">
                <span>ทำเนียบ 100+</span>
                <Award className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                {stats.perfectScoreCount}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">คะแนนเต็ม/มีแต้มสะสม</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-between text-sky-300 text-xs font-semibold">
                <span>บันทึกความดี</span>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                {stats.positiveLogsCount}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">ครั้งที่เพิ่มคะแนน</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. REAL-TIME SEARCH SECTION */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg mb-1">
              <Search className="w-3.5 h-3.5" />
              <span>ระบบค้นหาด่วน (Quick Search)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              ตรวจสอบคะแนนความประพฤตินักเรียน
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              พิมพ์รหัสนักเรียน (เช่น 05505), ชื่อ-นามสกุล, หรือชั้น/ห้อง เพื่อดูผลการประเมินคะแนนความประพฤติทันที
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('LOOKUP')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
            >
              <span>เปิดตารางค้นหาละเอียด</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาด้วย รหัสนักเรียน (5 หลัก), ชื่อ, นามสกุล หรือ ม.1/1..."
            className="w-full pl-11 pr-28 py-3.5 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium text-slate-800 placeholder:text-slate-400 shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-400 hover:text-slate-600 px-2 py-1 my-auto rounded-md cursor-pointer"
            >
              ล้างคำค้น
            </button>
          )}
        </div>

        {/* Live Search Results */}
        {searchQuery.trim() !== '' && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-500 mb-3 flex items-center justify-between">
              <span>ผลการค้นหาสำหรับ "{searchQuery}" ({matchingStudents.length} รายการ)</span>
              {matchingStudents.length > 0 && (
                <span className="text-slate-400">คลิกที่การ์ดเพื่อดูรายละเอียดประวัติคะแนน</span>
              )}
            </div>

            {matchingStudents.length === 0 ? (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-sm">ไม่พบข้อมูลนักเรียนที่ตรงกับคำค้นหา</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  กรุณาตรวจสอบรหัสนักเรียนหรือตัวสะกดชื่อ-นามสกุลใหม่อีกครั้ง หรือใช้ระบบค้นหาแบบละเอียด
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {matchingStudents.map((st) => {
                  const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentYear);
                  const cat = getScoreCategory(st, systemSettings);
                  const score = st.currentScore ?? 100;

                  return (
                    <div
                      key={st.id}
                      onClick={() => onSelectStudent(st.id)}
                      className="group p-3.5 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all cursor-pointer shadow-2xs hover:shadow-sm flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <StudentAvatar
                          student={st}
                          size="md"
                          className="shrink-0 group-hover:scale-105 transition-transform"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                              {st.id}
                            </span>
                            <span className="text-xs font-medium text-slate-500">
                              {grade}/{st.room}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate mt-1">
                            {st.title}{st.firstName} {st.lastName}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            ครูที่ปรึกษา: {st.advisorName || 'ไม่ได้ระบุ'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cat.badgeClass}`}>
                          {cat.label}
                        </span>
                        <div className="text-right">
                          <span className="font-black text-sm text-slate-900">
                            {score}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium"> / 100</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. FOUR CORE HUBS / NAVIGATION TILES */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hub 1: Lookup */}
        <div
          onClick={() => onNavigate('LOOKUP')}
          className="group p-5 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl shadow-xs transition-all cursor-pointer hover:border-indigo-300 hover:shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors">
              ค้นหาและสืบค้นคะแนน
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              ค้นหาข้อมูลนักเรียนแบบละเอียด กรองตามระดับชั้น ห้องเรียน และสถานะคะแนน
            </p>
          </div>
          <div className="pt-4 flex items-center text-xs font-bold text-indigo-600 gap-1 group-hover:translate-x-1 transition-transform">
            <span>เข้าสู่ระบบค้นหา</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Hub 2: Honour Roll */}
        <div
          onClick={() => onNavigate('HONOUR')}
          className="group p-5 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl shadow-xs transition-all cursor-pointer hover:border-amber-300 hover:shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 group-hover:text-amber-600 transition-colors">
              ทำเนียบเกียรติยศ (100+)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              เชิดชูเกียรตินักเรียนที่มีคะแนนความประพฤติเต็ม 100 และมีคะแนนสะสมความดี
            </p>
          </div>
          <div className="pt-4 flex items-center text-xs font-bold text-amber-600 gap-1 group-hover:translate-x-1 transition-transform">
            <span>ดูรายนามทำเนียบ</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Hub 3: Advisors */}
        <div
          onClick={() => {
            if (currentUser) {
              onNavigate('ADVISORS');
            } else {
              onNavigate('LOOKUP');
            }
          }}
          className="group p-5 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl shadow-xs transition-all cursor-pointer hover:border-blue-300 hover:shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors">
              ครูที่ปรึกษาประจำชั้น
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              ข้อมูลครูที่ปรึกษาประจำแต่ละห้องเรียนสำหรับติดต่อและขอคำปรึกษา
            </p>
          </div>
          <div className="pt-4 flex items-center text-xs font-bold text-blue-600 gap-1 group-hover:translate-x-1 transition-transform">
            <span>ตรวจสอบห้องเรียน</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Hub 4: Staff Portal */}
        <div
          onClick={() => {
            if (currentUser) {
              onNavigate('DASHBOARD');
            } else {
              onOpenLogin();
            }
          }}
          className="group p-5 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 hover:from-indigo-100/50 hover:to-purple-100/50 border border-indigo-100 rounded-2xl shadow-xs transition-all cursor-pointer hover:border-indigo-300 hover:shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
              <LogIn className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors">
              {currentUser ? 'แดชบอร์ดฝ่ายปกครอง' : 'เข้าสู่ระบบบุคลากร'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              สำหรับครูผู้สอนและเจ้าหน้าที่ บันทึกตัด/เพิ่มคะแนน และจัดการข้อมูล
            </p>
          </div>
          <div className="pt-4 flex items-center text-xs font-bold text-indigo-700 gap-1 group-hover:translate-x-1 transition-transform">
            <span>{currentUser ? 'เปิดแดชบอร์ด' : 'ลงชื่อเข้าใช้'}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </section>

      {/* 4. HONOUR ROLL SHOWCASE & INFORMATION TABS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Top Honour Students */}
        <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Star className="w-5 h-5 fill-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">นักเรียนตัวอย่าง</h3>
                  <p className="text-[11px] text-slate-500">คะแนนความประพฤติยอดเยี่ยม</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('HONOUR')}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-0.5 cursor-pointer"
              >
                <span>ดูทั้งหมด</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 mt-3">
              {topHonourStudents.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  ยังไม่มีข้อมูลในทำเนียบเกียรติยศ
                </div>
              ) : (
                topHonourStudents.map((st, idx) => {
                  const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentYear);
                  return (
                    <div
                      key={st.id}
                      onClick={() => onSelectStudent(st.id)}
                      className="p-2.5 bg-slate-50 hover:bg-amber-50/60 rounded-xl border border-slate-100 hover:border-amber-200 transition-colors flex items-center justify-between gap-2.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <StudentAvatar student={st} size="sm" />
                          <span className="absolute -top-1 -left-1 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] font-black flex items-center justify-center shadow-xs">
                            {idx + 1}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 truncate">
                            {st.title}{st.firstName} {st.lastName}
                          </h4>
                          <span className="text-[10px] text-slate-500">
                            {grade}/{st.room} • รหัส {st.id}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-amber-700">
                          {st.currentScore}
                        </div>
                        {(st.bankedPoints || 0) > 0 && (
                          <span className="text-[10px] font-bold text-emerald-600">
                            +{st.bankedPoints} สำรอง
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => onNavigate('HONOUR')}
              className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              เปิดดูทำเนียบเกียรติยศ 100+ ฉบับเต็ม
            </button>
          </div>
        </div>

        {/* Right Column: Regulations & Conduct Scoring Guidelines */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <span>ระเบียบและเกณฑ์การประเมินคะแนนความประพฤติ</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ข้อกำหนดและแนวปฏิบัติในการพิจารณาคะแนนตามระเบียบโรงเรียน
              </p>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveInfoTab('CRITERIA')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  activeInfoTab === 'CRITERIA'
                    ? 'bg-white text-indigo-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ระดับคะแนน
              </button>
              <button
                type="button"
                onClick={() => setActiveInfoTab('BEHAVIORS')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  activeInfoTab === 'BEHAVIORS'
                    ? 'bg-white text-indigo-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ตัวอย่างพฤติกรรม
              </button>
            </div>
          </div>

          {activeInfoTab === 'CRITERIA' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800">1. ระดับดีเยี่ยม (Honour)</span>
                  <span className="text-xs font-black text-emerald-700">100 คะแนน</span>
                </div>
                <p className="text-[11px] text-emerald-700/90 leading-relaxed">
                  นักเรียนที่มีคะแนนเต็ม 100 คะแนน และไม่เคยถูกหักคะแนนในภาคเรียนนั้น พร้อมสิทธิ์สะสมแต้มความดี
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-800">2. ระดับปกติ (Normal)</span>
                  <span className="text-xs font-black text-blue-700">80 - 100 คะแนน</span>
                </div>
                <p className="text-[11px] text-blue-700/90 leading-relaxed">
                  นักเรียนอยู่ในเกณฑ์มาตรฐานระเบียบวินัยปกติ สามารถเข้าร่วมกิจกรรมและรับการประเมินได้ตามปกติ
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800">3. ระดับตักเตือน (Caution)</span>
                  <span className="text-xs font-black text-amber-700">70 - 79 คะแนน</span>
                </div>
                <p className="text-[11px] text-amber-700/90 leading-relaxed">
                  ถูกตัดคะแนนสะสม 20-30 คะแนน ครูที่ปรึกษาเข้าตักเตือนและบันทึกข้อตกลงเพื่อปรับปรุงพฤติกรรม
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-800">4. ระดับวิกฤต (Critical)</span>
                  <span className="text-xs font-black text-rose-700">&lt; 50 คะแนน</span>
                </div>
                <p className="text-[11px] text-rose-700/90 leading-relaxed">
                  ระดับเตือนภัยสูงสุด เชิญผู้ปกครองเข้าพบ และเข้ารับการปรับปรุงพฤติกรรมตามมาตรการฝ่ายปกครอง
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="text-xs font-semibold text-slate-600 mb-2">
                หมวดพฤติกรรมและการตัด/เพิ่มคะแนนมาตรฐาน:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="font-bold text-rose-600">การหักคะแนน:</span>
                  <ul className="mt-1 space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                    <li>มาสาย / ไม่เข้าแถวเคารพธงชาติ (-5 คะแนน)</li>
                    <li>การแต่งกายผิดระเบียบโรงเรียน (-5 ถึง -10 คะแนน)</li>
                    <li>หนีเรียน / โดดเรียนประจำวิชา (-10 คะแนน)</li>
                  </ul>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="font-bold text-emerald-600">การเพิ่มคะแนนความดี:</span>
                  <ul className="mt-1 space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                    <li>จิตอาสาและช่วยงานโรงเรียน (+5 ถึง +10 คะแนน)</li>
                    <li>สร้างชื่อเสียงและแข่งขันทางวิชาการ (+10 ถึง +20 คะแนน)</li>
                    <li>เก็บของมีค่าได้และนำส่งคืน (+10 คะแนน)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Quick Demo Access Bar for Test / Evaluation */}
          {!currentUser && (
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-semibold text-slate-700">
                  ต้องการทดสอบระบบในฐานะผู้ดูแลระบบ (Admin Demo)?
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const adminUser = users.find(u => u.username === 'admin') || {
                      id: 'admin',
                      username: 'admin',
                      name: 'ผู้ดูแลระบบสูงสุด (Administrator)',
                      role: 'admin',
                      department: 'ศูนย์เทคโนโลยีและงานกิจการนักเรียน',
                      email: 'admin@school.ac.th',
                      isActive: true,
                      createdAt: new Date().toISOString()
                    };
                    onDemoLogin(adminUser);
                  }}
                  className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  เข้าสู่ระบบทันที (Admin Demo)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
