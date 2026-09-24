import React, { useState, useMemo, useEffect } from 'react';
import { Student, ConductLog, GradeLevel, EducationalLevel, AppUser, StudentAccessGrant, ScoreFilterType, ScoreCategoryType, SystemSettings, HomeroomAdvisor, Dormitory } from '../types';
import { calculateStudentGrade, getScoreCategory, getOutstandingStudents, parseConductCutoffs, getStudentAdvisors } from '../utils/conductLogic';
import { matchStudentToDormitory } from '../utils/dormitoryLogic';
import { formatThaiDate } from '../utils/thaiDate';
import { StudentAvatar } from './StudentAvatar';
import { ScoreStatusSelect } from './ScoreStatusSelect';
import { Pagination } from './Pagination';
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Crown,
  Award,
  Sparkles,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Download,
  PlusCircle,
  MinusCircle,
  Eye,
  TrendingDown,
  TrendingUp,
  Calendar,
  CheckCircle2,
  GraduationCap,
  UserCheck,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Info,
  Clock,
  BookOpen,
  RotateCcw,
  Folder,
  Edit,
  UserPlus,
  FileSpreadsheet,
  Building2
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface DashboardProps {
  students: Student[];
  conductLogs: ConductLog[];
  currentAcademicYear: number;
  currentTerm: number;
  currentUser: AppUser | null;
  studentGrant: StudentAccessGrant | null;
  systemSettings?: SystemSettings;
  advisors?: HomeroomAdvisor[];
  dormitories?: Dormitory[];
  onSelectStudent: (studentId: string) => void;
  onOpenConductAction: (student: Student, defaultType: 'DEDUCT' | 'ADD') => void;
  onOpenGrantModal: (student: Student) => void;
  onOpenHonourModal: () => void;
  onOpenImportModal: () => void;
  onOpenImportConductModal?: () => void;
  onOpenPhotoManager?: () => void;
  onOpenAddStudent?: () => void;
  onOpenEditStudent?: (student: Student) => void;
  viewMode?: 'OVERVIEW' | 'STUDENT_LIST';
}

export const Dashboard: React.FC<DashboardProps> = ({
  students = [],
  conductLogs = [],
  currentAcademicYear,
  currentTerm,
  currentUser,
  studentGrant,
  systemSettings,
  advisors = [],
  dormitories = [],
  onSelectStudent,
  onOpenConductAction,
  onOpenGrantModal,
  onOpenHonourModal,
  onOpenImportModal,
  onOpenImportConductModal,
  onOpenPhotoManager,
  onOpenAddStudent,
  onOpenEditStudent,
  viewMode = 'OVERVIEW'
}) => {
  const cutoffs = useMemo(() => parseConductCutoffs(systemSettings), [systemSettings]);
  const userRole = currentUser?.role || 'student';
  // ผู้ใช้งาน "Teacher (ระดับ 1)" ไม่สามารถ เพิ่ม หรือ ลบ/ตัด คะแนนพฤติกรรมได้ ให้ดูได้อย่างเดียว แต่ดูคะแนนได้ทุกคน
  const canDeductAndAdd = userRole === 'admin' || userRole === 'staff';
  const canGrantAccess = userRole === 'admin' || userRole === 'staff' || userRole === 'teacher';

  // Table filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | EducationalLevel>('ALL');
  const [classroomFilter, setClassroomFilter] = useState<string>('ALL'); // 'ALL' or 'GRADE_ม.1' or 'ม.1/1'
  const [scoreStatusFilter, setScoreStatusFilter] = useState<ScoreFilterType>('ALL');
  const [dormitoryFilter, setDormitoryFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<string>('currentScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Reset pagination on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, levelFilter, classroomFilter, scoreStatusFilter, dormitoryFilter, pageSize]);

  // Expandable Accordion rows state (Track which student IDs are expanded)
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set());

  const toggleExpandStudent = (studentId: string) => {
    setExpandedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandedStudentIds.size >= filteredStudents.length && filteredStudents.length > 0) {
      setExpandedStudentIds(new Set());
    } else {
      setExpandedStudentIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const getStudentLogs = (studentId: string) => {
    return (conductLogs || []).filter(l => l.studentId === studentId);
  };

  // Calculate statistics
  const activeStudents = useMemo(() => (students || []).filter(s => s && s.status === 'ACTIVE'), [students]);

  // Map student ID to resolved dormitory information for fast lookup & sorting
  const studentDormMap = useMemo(() => {
    const map = new Map<string, { dormId?: string; dormName: string; gender: 'M' | 'F' }>();
    (students || []).forEach(s => {
      if (!s) return;
      const matched = matchStudentToDormitory(s, dormitories || [], currentAcademicYear);
      const dormName = s.dormitoryName || matched.dormitory?.name || '';
      map.set(s.id, {
        dormId: s.dormitoryId || matched.dormitory?.id,
        dormName: dormName || 'ยังไม่ระบุ',
        gender: s.gender || matched.gender
      });
    });
    return map;
  }, [students, dormitories, currentAcademicYear]);

  // Extract distinct grades and classrooms dynamically from database
  const availableClassrooms = useMemo(() => {
    const classMap = new Map<string, { label: string; grade: GradeLevel; room: number; level: EducationalLevel; count: number }>();

    activeStudents.forEach(s => {
      const { grade, level } = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
      const key = `${grade}/${s.room}`;
      if (!classMap.has(key)) {
        classMap.set(key, {
          label: key,
          grade,
          room: s.room,
          level,
          count: 1
        });
      } else {
        const item = classMap.get(key)!;
        item.count++;
      }
    });

    const list = Array.from(classMap.values());
    const gradeOrder: Record<string, number> = { 'ม.1': 1, 'ม.2': 2, 'ม.3': 3, 'ม.4': 4, 'ม.5': 5, 'ม.6': 6 };
    list.sort((a, b) => {
      const gDiff = (gradeOrder[a.grade] || 99) - (gradeOrder[b.grade] || 99);
      if (gDiff !== 0) return gDiff;
      return a.room - b.room;
    });

    return list;
  }, [activeStudents, currentAcademicYear]);

  // Classrooms filtered by current levelFilter
  const filteredClassroomsList = useMemo(() => {
    if (levelFilter === 'ALL') return availableClassrooms;
    return availableClassrooms.filter(c => c.level === levelFilter);
  }, [availableClassrooms, levelFilter]);

  // Categorize students strictly according to the 6 criteria
  const categoryCounts = useMemo(() => {
    let critical = 0;
    let watch = 0;
    let caution = 0;
    let normal = 0;
    let outstanding = 0;
    let excellent = 0;

    activeStudents.forEach(s => {
      const cat = getScoreCategory(s, systemSettings);
      if (cat.type === 'CRITICAL') critical++;
      else if (cat.type === 'WATCH') watch++;
      else if (cat.type === 'CAUTION') caution++;
      else if (cat.type === 'NORMAL') normal++;
      else if (cat.type === 'OUTSTANDING') outstanding++;
      else if (cat.type === 'EXCELLENT') excellent++;
    });

    return { critical, watch, caution, normal, outstanding, excellent };
  }, [activeStudents, systemSettings]);

  const criticalStudents = useMemo(() => activeStudents.filter(s => getScoreCategory(s, systemSettings).type === 'CRITICAL'), [activeStudents, systemSettings]);
  const watchStudents = useMemo(() => activeStudents.filter(s => getScoreCategory(s, systemSettings).type === 'WATCH'), [activeStudents, systemSettings]);
  
  const outstanding = useMemo(() => getOutstandingStudents(activeStudents, currentAcademicYear), [activeStudents, currentAcademicYear]);
  const totalOutstandingCount = outstanding.junior.length + outstanding.senior.length;

  const scoreCountsMap = useMemo<Partial<Record<ScoreFilterType, number>>>(() => ({
    ALL: activeStudents.length,
    CRITICAL: categoryCounts.critical,
    WATCH: categoryCounts.watch,
    CAUTION: categoryCounts.caution,
    NORMAL: categoryCounts.normal,
    OUTSTANDING: categoryCounts.outstanding,
    EXCELLENT: categoryCounts.excellent
  }), [activeStudents.length, categoryCounts]);

  // Chart data: 6-Tier Score Distribution
  const pieData = useMemo(() => {
    return [
      { name: `วิกฤต (หักสะสม ≥${cutoffs.criticalDeductionCutoff})`, value: categoryCounts.critical, color: '#e11d48', type: 'CRITICAL' },
      { name: `เฝ้าระวัง (หักสะสม ≥${cutoffs.watchDeductionCutoff})`, value: categoryCounts.watch, color: '#ea580c', type: 'WATCH' },
      { name: `ตักเตือน (หักสะสม ≥${cutoffs.cautionDeductionCutoff})`, value: categoryCounts.caution, color: '#d97706', type: 'CAUTION' },
      { name: 'ปกติ (เต็ม 100)', value: categoryCounts.normal, color: '#10b981', type: 'NORMAL' },
      { name: 'ดีเด่น (เกิน 100)', value: categoryCounts.outstanding, color: '#2563eb', type: 'OUTSTANDING' },
      { name: 'ยอดเยี่ยม (100+ ไม่เคยถูกหัก)', value: categoryCounts.excellent, color: '#7c3aed', type: 'EXCELLENT' }
    ].filter(d => d.value > 0);
  }, [categoryCounts, cutoffs]);

  // Chart data: Grade level comparison
  const gradeBarData = useMemo(() => {
    const grades: GradeLevel[] = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
    return grades.map(g => {
      const inGrade = activeStudents.filter(s => {
        const info = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
        return info.grade === g;
      });
      const avgScore = inGrade.length > 0
        ? Math.round((inGrade.reduce((sum, s) => sum + s.currentScore, 0) / inGrade.length) * 10) / 10
        : 100;
      const criticalCount = inGrade.filter(s => getScoreCategory(s, systemSettings).type === 'CRITICAL').length;
      const watchCount = inGrade.filter(s => getScoreCategory(s, systemSettings).type === 'WATCH').length;
      const excellentCount = inGrade.filter(s => getScoreCategory(s, systemSettings).type === 'EXCELLENT').length;

      return {
        grade: g,
        count: inGrade.length,
        avgScore,
        criticalCount,
        watchCount,
        excellentCount
      };
    });
  }, [activeStudents, currentAcademicYear]);

  // Table filtering and sorting strictly respecting:
  // 1. ระดับ : มัธยมตอนต้น , มัธยมตอนปลาย
  // 2. ชั้น : ม.1/1 - ม.6/7 ให้อ้างอิงจากฐานข้อมูล
  // 3. หอพัก : กรองตามหอพักที่นักเรียนสังกัด
  // 4. ระดับคะแนน : วิกฤต, เฝ้าระวัง, ตักเตือน, ปกติ, ดีเด่น, ยอดเยี่ยม
  const filteredStudents = useMemo(() => {
    return activeStudents.filter(student => {
      const { grade, level } = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);
      const classroomKey = `${grade}/${student.room}`;
      const fullName = `${student.title || ''}${student.firstName} ${student.lastName}`.toLowerCase();
      const idMatch = (student.id || '').includes(searchQuery.trim());
      const nameMatch = fullName.includes(searchQuery.toLowerCase().trim());
      const dormInfo = studentDormMap.get(student.id);
      const dormMatch = (dormInfo?.dormName || '').toLowerCase().includes(searchQuery.toLowerCase().trim());
      
      if (searchQuery.trim() && !idMatch && !nameMatch && !dormMatch) return false;
      
      // 1. Filter by Level (มัธยมตอนต้น, มัธยมตอนปลาย)
      if (levelFilter !== 'ALL' && level !== levelFilter) return false;

      // 2. Filter by Grade / Classroom (ม.1/1 - ม.6/7 อ้างอิงจากฐานข้อมูล)
      if (classroomFilter !== 'ALL') {
        if (classroomFilter.startsWith('GRADE_')) {
          const targetGrade = classroomFilter.replace('GRADE_', '');
          if (grade !== targetGrade) return false;
        } else {
          if (classroomKey !== classroomFilter) return false;
        }
      }

      // 3. Filter by Dormitory (หอพัก)
      if (dormitoryFilter !== 'ALL') {
        if (dormitoryFilter === 'UNASSIGNED') {
          if (dormInfo && dormInfo.dormId) return false;
        } else {
          if (!dormInfo || dormInfo.dormId !== dormitoryFilter) return false;
        }
      }

      // 4. Filter by Score Category (วิกฤต, เฝ้าระวัง, ตักเตือน, ปกติ, ดีเด่น, ยอดเยี่ยม)
      if (scoreStatusFilter !== 'ALL') {
        const cat = getScoreCategory(student, systemSettings);
        if (cat.type !== scoreStatusFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA: any = a[sortField as keyof Student];
      let valB: any = b[sortField as keyof Student];

      // Custom fields
      if (sortField === 'grade') {
        valA = calculateStudentGrade(a.entryYear, a.entryLevel, currentAcademicYear).grade;
        valB = calculateStudentGrade(b.entryYear, b.entryLevel, currentAcademicYear).grade;
      } else if (sortField === 'classroom') {
        const gA = calculateStudentGrade(a.entryYear, a.entryLevel, currentAcademicYear).grade;
        const gB = calculateStudentGrade(b.entryYear, b.entryLevel, currentAcademicYear).grade;
        valA = `${gA}/${String(a.room).padStart(2, '0')}`;
        valB = `${gB}/${String(b.room).padStart(2, '0')}`;
      } else if (sortField === 'name') {
        valA = `${a.firstName} ${a.lastName}`;
        valB = `${b.firstName} ${b.lastName}`;
      } else if (sortField === 'dormitory') {
        valA = studentDormMap.get(a.id)?.dormName || '';
        valB = studentDormMap.get(b.id)?.dormName || '';
      } else if (sortField === 'status') {
        const rankMap: Record<string, number> = {
          CRITICAL: 1,
          WATCH: 2,
          CAUTION: 3,
          NORMAL: 4,
          OUTSTANDING: 5,
          EXCELLENT: 6
        };
        valA = rankMap[getScoreCategory(a, systemSettings).type] || 0;
        valB = rankMap[getScoreCategory(b, systemSettings).type] || 0;
      } else if (sortField === 'totalConduct') {
        valA = (a.currentScore ?? 100) + (a.bankedPoints ?? 0);
        valB = (b.currentScore ?? 100) + (b.bankedPoints ?? 0);
      }

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      return sortDirection === 'asc'
        ? String(valA).localeCompare(String(valB), 'th')
        : String(valB).localeCompare(String(valA), 'th');
    });
  }, [activeStudents, studentDormMap, searchQuery, levelFilter, classroomFilter, dormitoryFilter, scoreStatusFilter, sortField, sortDirection, currentAcademicYear]);

  // Paginated students slice
  const paginatedStudents = useMemo(() => {
    if (pageSize >= 999999) return filteredStudents;
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 font-bold" />
    );
  };

  return (
    <div className="space-y-5">
      {/* If in STUDENT_LIST mode, show dedicated management banner */}
      {viewMode === 'STUDENT_LIST' && (
        <div className="bg-indigo-50 border border-indigo-200/90 text-indigo-950 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base md:text-lg text-slate-900">
                  จัดการรายชื่อนักเรียน
                </h2>
                <span className="text-xs font-mono font-bold bg-indigo-200 text-indigo-900 px-2.5 py-0.5 rounded-md">
                  ทั้งหมด {students.length} คน
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-600 mt-0.5">
                ค้นหา คัดกรองรายห้อง เพิ่ม/แก้ไขข้อมูลนักเรียน และบันทึกคะแนนความประพฤติ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenImportConductModal && (canDeductAndAdd || userRole === 'admin') && (
              <button
                type="button"
                onClick={onOpenImportConductModal}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="นำเข้าข้อมูลการกระทำผิดและตัดคะแนนจากไฟล์ Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>นำเข้าการกระทำผิด (Excel)</span>
              </button>
            )}
            {onOpenAddStudent && (canDeductAndAdd || userRole === 'admin') && (
              <button
                type="button"
                onClick={onOpenAddStudent}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>เพิ่มนักเรียนใหม่</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* OVERVIEW CHARTS & KPI CARDS (Displayed in OVERVIEW mode) */}
      {viewMode !== 'STUDENT_LIST' && (
        <>
          {/* 1. BENTO ROW: CRITICAL ALERT BANNER ON MAIN SCREEN */}
          {categoryCounts.critical > 0 && (
            <div className="bg-rose-50 border border-rose-200/90 text-rose-950 rounded-2xl p-5 shadow-xs">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 bg-rose-600 text-white rounded-xl flex-shrink-0 animate-pulse">
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base md:text-lg text-rose-900 flex items-center gap-2">
                        <span>⚠️ แจ้งเตือนระดับวิกฤต (หักคะแนนสะสม ≥ {cutoffs.criticalDeductionCutoff} คะแนนขึ้นไป)</span>
                        <span className="text-xs font-mono font-bold bg-rose-200 text-rose-800 px-2 py-0.5 rounded-md">
                          {categoryCounts.critical} คน
                        </span>
                      </h3>
                    </div>
                    <p className="text-rose-700 text-xs md:text-sm mt-0.5 leading-relaxed">
                      มีนักเรียนที่คะแนนลดลงถึงเกณฑ์วิกฤต ต้องประสานงานครูที่ปรึกษาและแจ้งผู้ปกครองเพื่อปรับปรุงพฤติกรรมทันที
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap self-stretch md:self-auto">
                  <button
                    onClick={() => setScoreStatusFilter(scoreStatusFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
                  >
                    {scoreStatusFilter === 'CRITICAL' ? 'แสดงทั้งหมด' : 'กรองเฉพาะกลุ่มวิกฤต'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. BENTO ROW: WATCH ALERT BANNER */}
          {categoryCounts.watch > 0 && (
            <div className="bg-amber-50/90 border border-amber-200 text-amber-950 rounded-2xl p-4 md:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500 text-white rounded-xl flex-shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm md:text-base text-amber-900">
                      กลุ่มเฝ้าระวัง: มีนักเรียน {categoryCounts.watch} คน (หักคะแนนสะสม ≥ {cutoffs.watchDeductionCutoff} คะแนนขึ้นไป / คะแนนคงเหลือ ≤ {cutoffs.watchMaxScoreRemaining})
                    </span>
                    <p className="text-amber-700 text-xs mt-0.5">
                      แนะนำมอบหมายกิจกรรมบำเพ็ญประโยชน์เพื่อฟื้นฟูคะแนน
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setScoreStatusFilter(scoreStatusFilter === 'WATCH' ? 'ALL' : 'WATCH')}
                  className="px-3.5 py-1.5 bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold rounded-xl shadow-2xs transition-colors self-end sm:self-auto cursor-pointer"
                >
                  {scoreStatusFilter === 'WATCH' ? 'แสดงทั้งหมด' : 'กรองกลุ่มเฝ้าระวัง'}
                </button>
              </div>
            </div>
          )}

      {/* 3. BENTO GRID: 6-TIER CONDUCT STATUS KPI SUMMARY STATS TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-3.5">
        {/* Total Active */}
        <div
          onClick={() => setScoreStatusFilter('ALL')}
          className={`rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer flex flex-col justify-between ${
            scoreStatusFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${scoreStatusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
              ทั้งหมด
            </span>
            <Users className={`w-3.5 h-3.5 ${scoreStatusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${scoreStatusFilter === 'ALL' ? 'text-white' : 'text-slate-900'}`}>
              {activeStudents.length}
            </div>
            <p className={`text-[10px] mt-0.5 ${scoreStatusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`}>
              ปีการศึกษา {currentAcademicYear}
            </p>
          </div>
        </div>

        {/* 1. Critical (วิกฤต) */}
        <div
          onClick={() => setScoreStatusFilter('CRITICAL')}
          className={`rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer flex flex-col justify-between ${
            scoreStatusFilter === 'CRITICAL'
              ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
              : 'bg-rose-50/50 text-rose-900 border-rose-200 hover:border-rose-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${scoreStatusFilter === 'CRITICAL' ? 'text-rose-100' : 'text-rose-700'}`}>
              วิกฤต (≥{cutoffs.criticalDeductionCutoff})
            </span>
            <AlertOctagon className={`w-3.5 h-3.5 ${scoreStatusFilter === 'CRITICAL' ? 'text-white' : 'text-rose-500'}`} />
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${scoreStatusFilter === 'CRITICAL' ? 'text-white' : 'text-rose-600'}`}>
              {categoryCounts.critical}
            </div>
            <p className={`text-[10px] mt-0.5 ${scoreStatusFilter === 'CRITICAL' ? 'text-rose-100' : 'text-rose-600'}`}>
              คะแนนคงเหลือ ≤ {cutoffs.criticalMaxScoreRemaining}
            </p>
          </div>
        </div>

        {/* 2. Watch (เฝ้าระวัง) */}
        <div
          onClick={() => setScoreStatusFilter(scoreStatusFilter === 'WATCH' ? 'ALL' : 'WATCH')}
          className={`rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer flex flex-col justify-between ${
            scoreStatusFilter === 'WATCH'
              ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
              : 'bg-orange-50/50 text-orange-900 border-orange-200 hover:border-orange-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${scoreStatusFilter === 'WATCH' ? 'text-orange-100' : 'text-orange-700'}`}>
              เฝ้าระวัง (≥{cutoffs.watchDeductionCutoff})
            </span>
            <AlertTriangle className={`w-3.5 h-3.5 ${scoreStatusFilter === 'WATCH' ? 'text-white' : 'text-orange-500'}`} />
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${scoreStatusFilter === 'WATCH' ? 'text-white' : 'text-orange-600'}`}>
              {categoryCounts.watch}
            </div>
            <p className={`text-[10px] mt-0.5 ${scoreStatusFilter === 'WATCH' ? 'text-orange-100' : 'text-orange-600'}`}>
              คะแนนคงเหลือ ≤ {cutoffs.watchMaxScoreRemaining}
            </p>
          </div>
        </div>

        {/* 3. Caution (ตักเตือน) */}
        <div
          onClick={() => setScoreStatusFilter(scoreStatusFilter === 'CAUTION' ? 'ALL' : 'CAUTION')}
          className={`rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer flex flex-col justify-between ${
            scoreStatusFilter === 'CAUTION'
              ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
              : 'bg-amber-50/50 text-amber-900 border-amber-200 hover:border-amber-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${scoreStatusFilter === 'CAUTION' ? 'text-amber-100' : 'text-amber-700'}`}>
              ตักเตือน (≥{cutoffs.cautionDeductionCutoff})
            </span>
            <AlertCircle className={`w-3.5 h-3.5 ${scoreStatusFilter === 'CAUTION' ? 'text-white' : 'text-amber-500'}`} />
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${scoreStatusFilter === 'CAUTION' ? 'text-white' : 'text-amber-600'}`}>
              {categoryCounts.caution}
            </div>
            <p className={`text-[10px] mt-0.5 ${scoreStatusFilter === 'CAUTION' ? 'text-amber-100' : 'text-amber-600'}`}>
              คะแนนคงเหลือ ≤ {cutoffs.cautionMaxScoreRemaining}
            </p>
          </div>
        </div>

        {/* 4. Normal (ปกติ: เต็ม 100) */}
        <div
          onClick={() => setScoreStatusFilter(scoreStatusFilter === 'NORMAL' ? 'ALL' : 'NORMAL')}
          className={`rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer flex flex-col justify-between ${
            scoreStatusFilter === 'NORMAL'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
              : 'bg-emerald-50/50 text-emerald-900 border-emerald-200 hover:border-emerald-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${scoreStatusFilter === 'NORMAL' ? 'text-emerald-100' : 'text-emerald-700'}`}>
              ปกติ (เต็ม 100)
            </span>
            <ShieldCheck className={`w-3.5 h-3.5 ${scoreStatusFilter === 'NORMAL' ? 'text-white' : 'text-emerald-500'}`} />
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${scoreStatusFilter === 'NORMAL' ? 'text-white' : 'text-emerald-600'}`}>
              {categoryCounts.normal}
            </div>
            <p className={`text-[10px] mt-0.5 ${scoreStatusFilter === 'NORMAL' ? 'text-emerald-100' : 'text-emerald-600'}`}>
              ไม่มีประวัติหัก
            </p>
          </div>
        </div>

        {/* 5. Outstanding & Excellent (ดีเด่น & ยอดเยี่ยม: เกิน 100) */}
        <div
          onClick={() => setScoreStatusFilter(scoreStatusFilter === 'EXCELLENT' ? 'ALL' : 'EXCELLENT')}
          className={`rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer flex flex-col justify-between ${
            scoreStatusFilter === 'EXCELLENT'
              ? 'bg-purple-700 text-white border-purple-800 shadow-xs'
              : 'bg-purple-50/50 text-purple-900 border-purple-200 hover:border-purple-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${scoreStatusFilter === 'EXCELLENT' ? 'text-purple-100' : 'text-purple-700'}`}>
              ยอดเยี่ยม / ดีเด่น
            </span>
            <Crown className={`w-3.5 h-3.5 ${scoreStatusFilter === 'EXCELLENT' ? 'text-white' : 'text-purple-500'}`} />
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${scoreStatusFilter === 'EXCELLENT' ? 'text-white' : 'text-purple-600'}`}>
              {categoryCounts.excellent + categoryCounts.outstanding}
            </div>
            <p className={`text-[10px] mt-0.5 ${scoreStatusFilter === 'EXCELLENT' ? 'text-purple-100' : 'text-purple-600'}`}>
              ยอดเยี่ยม {categoryCounts.excellent} • ดีเด่น {categoryCounts.outstanding}
            </p>
          </div>
        </div>
      </div>

      {/* 4. BENTO GRID: STATS & SUMMARY MODULES */}
      <div className="grid grid-cols-12 gap-4">
        {/* Bento Box 1: Score Distribution (Col-span-12 md:col-span-6 lg:col-span-4) */}
        <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-1.5">
                <span>สัดส่วนคะแนนความประพฤติ (6 เกณฑ์)</span>
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                ภาพรวม
              </span>
            </div>
            <p className="text-xs text-slate-400">
              การกระจายตัวของระดับคะแนนความประพฤติตามเกณฑ์โรงเรียน
            </p>
          </div>

          <div className="h-48 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${value} คน`, 'จำนวนนักเรียน']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-xs pt-2 border-t border-slate-100">
            {pieData.map(item => (
              <button
                key={item.name}
                type="button"
                onClick={() => setScoreStatusFilter(scoreStatusFilter === item.type ? 'ALL' : item.type as any)}
                className={`flex items-center gap-1.5 text-left p-1 rounded-md transition-colors cursor-pointer ${
                  scoreStatusFilter === item.type ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-xs flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate text-slate-600 text-[11px]">{item.name.split(' ')[0]}:</span>
                <span className="font-bold text-slate-800 text-[11px]">{item.value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bento Box 2: Grade Level Summary (Col-span-12 md:col-span-6 lg:col-span-5) */}
        <div className="col-span-12 md:col-span-6 lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-2">
                <span>📈 สรุปสถิติตามระดับชั้น</span>
              </h3>
              <span className="text-xs text-slate-400 font-normal">
                ปีการศึกษา {currentAcademicYear} เทอม {currentTerm}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              คะแนนเฉลี่ยและสัดส่วนนักเรียนตามระดับชั้น
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 my-3">
            {/* Junior High (M.1 - M.3) */}
            <div className="flex flex-col">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-bold">มัธยมศึกษาตอนต้น</p>
              <div className="space-y-2.5">
                {gradeBarData.slice(0, 3).map(g => (
                  <div key={g.grade} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-slate-700">{g.grade} (เฉลี่ย {g.avgScore})</span>
                      <span className="font-bold text-indigo-600">{g.count} คน</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (g.count / (activeStudents.length || 1)) * 300)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Senior High (M.4 - M.6) */}
            <div className="flex flex-col border-l border-slate-100 pl-4">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-bold">มัธยมศึกษาตอนปลาย</p>
              <div className="space-y-2.5">
                {gradeBarData.slice(3, 6).map(g => (
                  <div key={g.grade} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-slate-700">{g.grade} (เฉลี่ย {g.avgScore})</span>
                      <span className="font-bold text-emerald-600">{g.count} คน</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (g.count / (activeStudents.length || 1)) * 300)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
            <span>โครงสร้างรอบ 3 ปี (6 ภาคเรียน)</span>
            <span className="font-semibold text-indigo-600">รีเซ็ต 100 แต้มเมื่อเข้า ม.4</span>
          </div>
        </div>

        {/* Bento Box 3: Dark Bento Outstanding Card (Col-span-12 md:col-span-12 lg:col-span-3) */}
        <div className="col-span-12 md:col-span-12 lg:col-span-3 bg-indigo-900 border border-indigo-950 rounded-2xl p-4 sm:p-5 shadow-xs text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-indigo-200 font-bold text-xs uppercase tracking-widest">
                ยอดเยี่ยม / ดีเด่น (Score &gt; 100)
              </h3>
              <button
                onClick={onOpenHonourModal}
                className="text-[11px] bg-white/10 hover:bg-white/20 text-indigo-100 font-bold px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                ดูทำเนียบ
              </button>
            </div>

            <div className="text-center py-4">
              <div className="text-5xl font-black mb-1 text-white font-mono">
                {categoryCounts.excellent}
              </div>
              <p className="text-xs text-indigo-300">
                นักเรียนที่มีความประพฤติยอดเยี่ยม<br />(เกิน 100 และไม่เคยโดนหัก 3 ปี)
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-2 pt-2 border-t border-indigo-800">
            <div className="flex justify-between text-xs text-indigo-200 border-b border-indigo-800/80 pb-1.5">
              <span>มัธยมต้น (ม.1-3)</span>
              <span className="font-bold text-white font-mono">{outstanding.junior.length} คน</span>
            </div>
            <div className="flex justify-between text-xs text-indigo-200">
              <span>มัธยมปลาย (ม.4-6)</span>
              <span className="font-bold text-white font-mono">{outstanding.senior.length} คน</span>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* 5. BENTO GRID: INTERACTIVE ALL-STUDENT TABLE BOX */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        {/* Responsive Controls Bar */}
        <div className="flex flex-col gap-3">
          {/* Title Header */}
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>รายชื่อและคะแนนความประพฤตินักเรียน</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              ค้นหาตามระดับ (ม.ต้น/ม.ปลาย), ชั้น (ม.1/1 - ม.6/7 จากฐานข้อมูล), และระดับคะแนนความประพฤติ 6 ระดับ
            </p>
          </div>

          {/* Action Row: ปุ่มเพิ่มนักเรียน, ยอดที่พบ, กางออก/พับเข้า (1 บรรทัด) */}
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenAddStudent && (userRole === 'admin' || userRole === 'staff') && (
              <button
                type="button"
                onClick={onOpenAddStudent}
                className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs shadow-indigo-200"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>เพิ่มนักเรียน</span>
              </button>
            )}

            {userRole === 'teacher' && (
              <div className="text-xs font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>โหมดดูคะแนนอย่างเดียว (สิทธิ์ระดับ 1 - ดูได้ทุกคน)</span>
              </div>
            )}

            <div className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-2.5 py-1.5 rounded-xl">
              พบ {filteredStudents.length} คน จากทั้งหมด {activeStudents.length} คน
            </div>

            {filteredStudents.length > 0 && (
              <button
                type="button"
                onClick={toggleExpandAll}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="กางออกหรือพับแถวข้อมูลทั้งหมดในตาราง"
              >
                {expandedStudentIds.size >= filteredStudents.length ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>พับเข้า</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>กางออก</span>
                  </>
                )}
              </button>
            )}

            {(levelFilter !== 'ALL' || classroomFilter !== 'ALL' || scoreStatusFilter !== 'ALL' || dormitoryFilter !== 'ALL' || searchQuery.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setLevelFilter('ALL');
                  setClassroomFilter('ALL');
                  setScoreStatusFilter('ALL');
                  setDormitoryFilter('ALL');
                }}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ล้างตัวกรอง</span>
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 pt-1">
            {/* Search Input */}
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัสประจำตัว, ชื่อ-นามสกุล หรือหอพัก..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            {/* 1. Level Filter: ระดับ มัธยมตอนต้น, มัธยมตอนปลาย */}
            <select
              value={levelFilter}
              onChange={e => {
                const newLevel = e.target.value as any;
                setLevelFilter(newLevel);
                setClassroomFilter('ALL');
              }}
              className="text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">ระดับ: ทุกระดับ (ม.ต้น & ม.ปลาย)</option>
              <option value="JUNIOR">ระดับ: มัธยมตอนต้น (ม.1-3)</option>
              <option value="SENIOR">ระดับ: มัธยมตอนปลาย (ม.4-6)</option>
            </select>

            {/* 2. Grade & Classroom Filter: ชั้น ม.1/1 - ม.6/7 ให้อ้างอิงจากฐานข้อมูล */}
            <select
              value={classroomFilter}
              onChange={e => setClassroomFilter(e.target.value)}
              className="text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">ชั้น: ทุกห้อง/ชั้น</option>
              
              {/* Grade-level bulk groups */}
              <optgroup label="── แยกตามระดับชั้น ──">
                {levelFilter !== 'SENIOR' && (
                  <>
                    <option value="GRADE_ม.1">ชั้น ม.1 ทั้งหมด</option>
                    <option value="GRADE_ม.2">ชั้น ม.2 ทั้งหมด</option>
                    <option value="GRADE_ม.3">ชั้น ม.3 ทั้งหมด</option>
                  </>
                )}
                {levelFilter !== 'JUNIOR' && (
                  <>
                    <option value="GRADE_ม.4">ชั้น ม.4 ทั้งหมด</option>
                    <option value="GRADE_ม.5">ชั้น ม.5 ทั้งหมด</option>
                    <option value="GRADE_ม.6">ชั้น ม.6 ทั้งหมด</option>
                  </>
                )}
              </optgroup>

              {/* Dynamic classrooms from database: ม.1/1 - ม.6/7 */}
              <optgroup label="── รายห้องจากฐานข้อมูล ──">
                {filteredClassroomsList.map(c => (
                  <option key={c.label} value={c.label}>
                    ชั้น {c.label} ({c.count} คน)
                  </option>
                ))}
              </optgroup>
            </select>

            {/* 3. Dormitory Filter: หอพัก */}
            <select
              value={dormitoryFilter}
              onChange={e => {
                setDormitoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">หอพัก: ทุกหอพัก</option>
              {dormitories && dormitories.length > 0 && (
                dormitories.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))
              )}
              <option value="UNASSIGNED">ยังไม่ระบุหอพัก</option>
            </select>

            {/* 4. Score Category Filter: วิกฤต, เฝ้าระวัง, ตักเตือน, ปกติ, ดีเด่น, ยอดเยี่ยม */}
            <ScoreStatusSelect
              value={scoreStatusFilter}
              onChange={setScoreStatusFilter}
              counts={scoreCountsMap}
            />
          </div>
        </div>

        {/* UNIFIED RESPONSIVE OVERVIEW TABLE (Displays รหัส, ชื่อ-สกุล, ชั้น, หอพัก, คะแนน by default, rest on expand) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-2xs bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700 border-collapse">
              <thead className="bg-slate-50 text-[11px] sm:text-xs font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  {/* Expand toggle */}
                  <th className="py-3 px-2 sm:px-3 text-center w-8 sm:w-10">
                    <span className="sr-only">กาง/พับแถว</span>
                  </th>
                  {/* 1. รหัส */}
                  <th
                    onClick={() => handleSort('id')}
                    className="py-3 px-2.5 sm:px-3.5 cursor-pointer hover:bg-slate-100 transition-colors w-24 sm:w-28"
                  >
                    <div className="flex items-center gap-1">
                      <span>รหัส</span>
                      {getSortIcon('id')}
                    </div>
                  </th>
                  {/* 2. ชื่อ-สกุล */}
                  <th
                    onClick={() => handleSort('name')}
                    className="py-3 px-2.5 sm:px-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>ชื่อ-สกุล</span>
                      {getSortIcon('name')}
                    </div>
                  </th>
                  {/* 3. ชั้น */}
                  <th
                    onClick={() => handleSort('grade')}
                    className="py-3 px-2 sm:px-3 cursor-pointer hover:bg-slate-100 transition-colors text-center w-20 sm:w-28"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>ชั้น</span>
                      {getSortIcon('grade')}
                    </div>
                  </th>
                  {/* 4. หอพัก */}
                  <th
                    onClick={() => handleSort('dormitory')}
                    className="py-3 px-2 sm:px-3 cursor-pointer hover:bg-slate-100 transition-colors text-center w-28 sm:w-36"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>หอพัก</span>
                      {getSortIcon('dormitory')}
                    </div>
                  </th>
                  {/* 5. คะแนน */}
                  <th
                    onClick={() => handleSort('currentScore')}
                    className="py-3 px-2.5 sm:px-3.5 cursor-pointer hover:bg-slate-100 transition-colors text-right w-24 sm:w-32"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>คะแนน</span>
                      {getSortIcon('currentScore')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      <Search className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                      <p className="font-semibold text-slate-600">ไม่พบข้อมูลนักเรียนตามเงื่อนไข</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">ลองปรับตัวกรองหรือคำค้นหาใหม่</p>
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map(student => {
                    const gradeInfo = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);
                    const status = getScoreCategory(student, systemSettings);
                    const isCritical = status.type === 'CRITICAL';
                    const isWarning = status.type === 'WATCH' || status.type === 'CAUTION';
                    const isExpanded = expandedStudentIds.has(student.id);
                    const studentLogs = getStudentLogs(student.id);

                    return (
                      <React.Fragment key={student.id}>
                        {/* Master Row: รหัส, ชื่อ-สกุล, ชั้น, หอพัก, คะแนน */}
                        <tr
                          className={`transition-colors group cursor-pointer ${
                            isExpanded
                              ? 'bg-indigo-50/50 font-medium'
                              : isCritical
                              ? 'bg-rose-50/40 hover:bg-rose-50/70'
                              : isWarning
                              ? 'bg-amber-50/30 hover:bg-amber-50/60'
                              : 'hover:bg-slate-50/90'
                          }`}
                          onClick={() => toggleExpandStudent(student.id)}
                        >
                          {/* Chevron Expand Indicator */}
                          <td className="py-3 px-2 sm:px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandStudent(student.id);
                              }}
                              className={`p-1.5 rounded-lg transition-transform duration-200 cursor-pointer ${
                                isExpanded ? 'bg-indigo-100 text-indigo-700 rotate-180' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                              }`}
                              title={isExpanded ? 'พับแถว' : 'กางดูรายละเอียด'}
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </td>

                          {/* 1. รหัส */}
                          <td className="py-3 px-2.5 sm:px-3.5 font-mono font-bold text-slate-900 text-xs sm:text-sm">
                            <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200 inline-block">
                              {student.id}
                            </span>
                          </td>

                          {/* 2. ชื่อ-สกุล */}
                          <td className="py-3 px-2.5 sm:px-3.5 text-slate-900 font-bold text-xs sm:text-sm">
                            <span className="truncate">
                              {student.title}{student.firstName} {student.lastName}
                            </span>
                          </td>

                          {/* 3. ชั้น */}
                          <td className="py-3 px-2 sm:px-3 text-center text-xs sm:text-sm">
                            <span className="font-bold text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded-md">
                              {gradeInfo.grade}/{student.room}
                            </span>
                          </td>

                          {/* 4. หอพัก */}
                          <td className="py-3 px-2 sm:px-3 text-center text-xs">
                            {(() => {
                              const dorm = studentDormMap.get(student.id);
                              if (!dorm || !dorm.dormName || dorm.dormName === 'ยังไม่ระบุ') {
                                return <span className="text-slate-400 text-xs">-</span>;
                              }
                              return (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] border whitespace-nowrap ${
                                  dorm.gender === 'M'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : dorm.gender === 'F'
                                    ? 'bg-pink-50 text-pink-700 border-pink-200'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}>
                                  <Building2 className="w-3 h-3 shrink-0 opacity-70" />
                                  <span>{dorm.dormName}</span>
                                </span>
                              );
                            })()}
                          </td>

                          {/* 5. คะแนน */}
                          <td className="py-3 px-2.5 sm:px-3.5 text-right font-mono">
                            <div className="flex items-center justify-end gap-1">
                              <span
                                className={`font-black text-xs sm:text-sm px-2 py-0.5 rounded-md inline-block ${
                                  isCritical
                                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                    : isWarning
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : student.currentScore >= 100
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-800 border border-slate-200'
                                }`}
                              >
                                {student.currentScore}
                              </span>
                              {(student.bankedPoints ?? 0) > 0 && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 hidden sm:inline-block">
                                  +{student.bankedPoints}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Details Section (มองเห็นเมื่อขยายตาราง: รูป, ปีที่เข้า, ครูที่ปรึกษา, หอพัก, ประวัติหักคะแนน, แต้มสะสม, บันทึกคะแนนล่าสุด, ปุ่มจัดการ) */}
                        {isExpanded && (
                          <tr className="bg-slate-50/95 border-y-2 border-indigo-200/80 animate-in fade-in duration-150">
                            <td colSpan={6} className="p-3.5 sm:p-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                                {/* Sub-Card 1: Student Profile & Photo Avatar from Drive */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-start gap-3.5">
                                  <StudentAvatar
                                    student={student}
                                    currentAcademicYear={currentAcademicYear}
                                    size="lg"
                                  />
                                  <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                                        {student.id}
                                      </span>
                                      <span className="font-bold text-xs text-slate-800">
                                        {gradeInfo.grade}/{student.room} {student.number ? `เลขที่ ${student.number}` : ''}
                                      </span>
                                    </div>
                                    <div className="font-bold text-slate-900 text-sm">
                                      {student.title}{student.firstName} {student.lastName}
                                    </div>
                                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-0.5">
                                      <p>ปีที่เข้าศึกษา: <span className="font-semibold text-slate-700">{student.entryYear} ({student.entryLevel})</span></p>
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-400">หอพัก:</span>
                                        <span className="font-semibold text-indigo-700 inline-flex items-center gap-1">
                                          <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
                                          <span>{studentDormMap.get(student.id)?.dormName || 'ยังไม่ระบุ'}</span>
                                        </span>
                                      </div>
                                      {(() => {
                                        const stAdvisors = getStudentAdvisors(student, advisors, currentAcademicYear);
                                        return (
                                          <div className="flex items-start gap-1">
                                            <span className="text-slate-400 flex-shrink-0">ครูที่ปรึกษา:</span>
                                            <div className="font-semibold text-slate-700 flex-1">
                                              {stAdvisors.length > 0 ? (
                                                <div className="space-y-0.5">
                                                  {stAdvisors.map((adv, idx) => {
                                                    const order = Number(adv.advisorOrder) || (idx + 1);
                                                    return (
                                                      <div key={adv.id || idx} className="flex items-center gap-1">
                                                        <span>{adv.fullName}</span>
                                                        <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                                                          order === 1
                                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                        }`}>
                                                          {order === 1 ? 'ครูที่ปรึกษา 1' : `ครูที่ปรึกษา ${order}`}
                                                        </span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              ) : (
                                                <span>{student.advisorName || '-'}</span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>

                                {/* Sub-Card 2: Conduct Score Breakdown Bento */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                                    <span>สรุปยอดคะแนนความประพฤติ</span>
                                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${status.badgeClass}`}>
                                      {status.label}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                                      <span className="text-[10px] text-slate-400 block">ตั้งต้น</span>
                                      <span className="text-sm font-mono font-bold text-slate-800">100</span>
                                    </div>
                                    <div className="p-2 bg-rose-50/70 rounded-xl border border-rose-100">
                                      <span className="text-[10px] text-rose-500 block">โดนหัก</span>
                                      <span className="text-sm font-mono font-bold text-rose-700">
                                        {student.totalDeductionsCount ? `${student.totalDeductionsCount} ครั้ง` : '0'}
                                      </span>
                                    </div>
                                    <div className="p-2 bg-emerald-50/70 rounded-xl border border-emerald-100">
                                      <span className="text-[10px] text-emerald-600 block">สะสมสำรอง</span>
                                      <span className="text-sm font-mono font-bold text-emerald-700">
                                        {student.bankedPoints ? `+${student.bankedPoints}` : '0'}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-tight">
                                    {status.description}
                                  </p>
                                </div>

                                {/* Sub-Card 3: Recent Activity & Quick Action Shortcuts */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3 md:col-span-2 lg:col-span-1">
                                  <div>
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        ประวัติล่าสุด ({studentLogs.length} รายการ)
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => onSelectStudent(student.id)}
                                        className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
                                      >
                                        <span>ดูทั้งหมด</span>
                                        <ChevronRight className="w-3 h-3" />
                                      </button>
                                    </div>

                                    {studentLogs.length === 0 ? (
                                      <div className="p-2 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center text-[11px] text-emerald-800 font-medium">
                                        🌟 ไม่มีประวัติการหักคะแนน คะแนนเต็ม 100 ตลอดภาคเรียน
                                      </div>
                                    ) : (
                                      <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                                        {studentLogs.slice(0, 2).map(log => (
                                          <div
                                            key={log.id}
                                            className="p-1.5 bg-slate-50 rounded-lg border border-slate-100 text-[11px] flex items-center justify-between gap-1.5"
                                          >
                                            <div className="min-w-0">
                                              <div className="font-semibold text-slate-800 truncate">{log.reason}</div>
                                              <div className="text-[10px] text-slate-400">
                                                {formatThaiDate(log.recordedAt, 'short')} • {log.recordedBy}
                                              </div>
                                            </div>
                                            <span
                                              className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                                                log.type === 'DEDUCT'
                                                  ? 'bg-rose-100 text-rose-700'
                                                  : 'bg-emerald-100 text-emerald-700'
                                              }`}
                                            >
                                              {log.type === 'DEDUCT' ? `-${log.points}` : `+${log.points}`}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Actions in Accordion */}
                                  <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => onSelectStudent(student.id)}
                                      className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>บัตรคะแนนเต็ม</span>
                                    </button>

                                    {canGrantAccess && (
                                      <button
                                        type="button"
                                        onClick={() => onOpenGrantModal(student)}
                                        className="py-1.5 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer border border-indigo-200 transition-colors"
                                        title="อนุญาตให้นักเรียนเปิดดูคะแนน"
                                      >
                                        <UserCheck className="w-3.5 h-3.5" />
                                        <span>ให้สิทธิ์</span>
                                      </button>
                                    )}

                                    {onOpenEditStudent && (userRole === 'admin' || userRole === 'staff') && (
                                      <button
                                        type="button"
                                        onClick={() => onOpenEditStudent(student)}
                                        className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer border border-slate-200 transition-colors"
                                        title="แก้ไขข้อมูล / รูปถ่ายนักเรียน"
                                      >
                                        <Edit className="w-3.5 h-3.5 text-slate-700" />
                                      </button>
                                    )}

                                    {canDeductAndAdd && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => onOpenConductAction(student, 'DEDUCT')}
                                          className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer border border-rose-200 transition-colors"
                                          title="หักคะแนน"
                                        >
                                          <MinusCircle className="w-3.5 h-3.5" />
                                          <span>หัก</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onOpenConductAction(student, 'ADD')}
                                          className="py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer border border-emerald-200 transition-colors"
                                          title="เพิ่มคะแนน"
                                        >
                                          <PlusCircle className="w-3.5 h-3.5" />
                                          <span>เพิ่ม</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination when filtered students > 0 */}
        {filteredStudents.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredStudents.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            pageSizeOptions={[25, 50, 100, 'ALL']}
            itemLabel="คน"
            className="pt-2"
          />
        )}

        {/* Table footer info */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>แสดง {paginatedStudents.length} จากค้นพบ {filteredStudents.length} คน (ทั้งหมดในระบบ {activeStudents.length} คน)</span>
          <span>คลิกที่แถวหรือไอคอนลูกศรเพื่อกาง/พับดูรายละเอียด • ระบบคะแนน 100 คะแนน รอบ 3 ปี</span>
        </div>
      </div>
    </div>
  );
};
