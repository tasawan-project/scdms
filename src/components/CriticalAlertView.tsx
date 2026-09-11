import React, { useState, useMemo, useEffect } from 'react';
import { Student, AppUser, ConductType, ScoreCategoryType, SystemSettings, HomeroomAdvisor } from '../types';
import { calculateStudentGrade, getScoreCategory, parseConductCutoffs, getStudentAdvisors } from '../utils/conductLogic';
import { StudentAvatar } from './StudentAvatar';
import { Pagination } from './Pagination';
import {
  ShieldAlert,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Layers,
  Search,
  Download,
  ExternalLink,
  PlusCircle,
  MinusCircle,
  KeyRound,
  UserCheck,
  RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface CriticalAlertViewProps {
  students: Student[];
  currentAcademicYear: number;
  currentUser: AppUser | null;
  warningThreshold?: number;
  criticalThreshold?: number;
  systemSettings?: SystemSettings;
  advisors?: HomeroomAdvisor[];
  onBack: () => void;
  onSelectStudent: (studentId: string) => void;
  onOpenConductAction: (student: Student, defaultType: ConductType) => void;
  onOpenGrantModal: (student: Student) => void;
}

export const CriticalAlertView: React.FC<CriticalAlertViewProps> = ({
  students,
  currentAcademicYear,
  currentUser,
  systemSettings,
  advisors = [],
  onBack,
  onSelectStudent,
  onOpenConductAction,
  onOpenGrantModal
}) => {
  const cutoffs = useMemo(() => parseConductCutoffs(systemSettings), [systemSettings]);
  const [filterType, setFilterType] = useState<'ALL' | 'CRITICAL' | 'WATCH' | 'CAUTION'>('ALL');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'JUNIOR' | 'SENIOR'>('ALL');
  const [classroomFilter, setClassroomFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, levelFilter, classroomFilter, searchQuery, pageSize]);

  // Extract unique classrooms dynamically from database
  const availableClassrooms = useMemo(() => {
    const map = new Map<string, { label: string; grade: string; room: string; level: 'JUNIOR' | 'SENIOR'; count: number }>();
    students.forEach(s => {
      if (s.status === 'GRADUATED') return;
      const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
      const label = `${g.grade}/${s.room}`;
      if (!map.has(label)) {
        map.set(label, { label, grade: g.grade, room: s.room, level: g.level, count: 1 });
      } else {
        map.get(label)!.count += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const order = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
      const gA = order.indexOf(a.grade);
      const gB = order.indexOf(b.grade);
      if (gA !== gB) return gA - gB;
      return a.room.localeCompare(b.room, undefined, { numeric: true });
    });
  }, [students, currentAcademicYear]);

  // Identify at-risk students according to user rules
  const { criticalList, watchList, cautionList } = useMemo(() => {
    const critical: Student[] = [];
    const watch: Student[] = [];
    const caution: Student[] = [];

    students.forEach(s => {
      if (s.status !== 'ACTIVE') return;
      const cat = getScoreCategory(s, systemSettings);
      if (cat.type === 'CRITICAL') {
        critical.push(s);
      } else if (cat.type === 'WATCH') {
        watch.push(s);
      } else if (cat.type === 'CAUTION') {
        caution.push(s);
      }
    });

    // Sort ascending by score (lowest score first)
    critical.sort((a, b) => a.currentScore - b.currentScore || a.id.localeCompare(b.id));
    watch.sort((a, b) => a.currentScore - b.currentScore || a.id.localeCompare(b.id));
    caution.sort((a, b) => a.currentScore - b.currentScore || a.id.localeCompare(b.id));

    return { criticalList: critical, watchList: watch, cautionList: caution };
  }, [students, systemSettings]);

  // Combined and filtered list
  const filteredStudents = useMemo(() => {
    let list: Student[] = [];
    if (filterType === 'ALL') {
      list = [...criticalList, ...watchList, ...cautionList];
    } else if (filterType === 'CRITICAL') {
      list = [...criticalList];
    } else if (filterType === 'WATCH') {
      list = [...watchList];
    } else if (filterType === 'CAUTION') {
      list = [...cautionList];
    }

    // Level filter
    if (levelFilter !== 'ALL') {
      list = list.filter(s => {
        const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
        return g.level === levelFilter;
      });
    }

    // Classroom / Grade filter
    if (classroomFilter !== 'ALL') {
      if (classroomFilter.startsWith('GRADE_')) {
        const targetGrade = classroomFilter.replace('GRADE_', '');
        list = list.filter(s => {
          const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
          return g.grade === targetGrade;
        });
      } else {
        list = list.filter(s => {
          const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
          return `${g.grade}/${s.room}` === classroomFilter;
        });
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s =>
        s.id.includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        (s.advisorName && s.advisorName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [filterType, levelFilter, classroomFilter, searchQuery, criticalList, watchList, cautionList, currentAcademicYear]);

  // Paginated students
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  // Export to Excel
  const exportToExcel = () => {
    const data = filteredStudents.map((s, idx) => {
      const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
      const cat = getScoreCategory(s, systemSettings);
      return {
        'ลำดับ': idx + 1,
        'สถานะคะแนน': cat.label,
        'รหัสนักเรียน': s.id,
        'ชื่อ-นามสกุล': `${s.title}${s.firstName} ${s.lastName}`,
        'ระดับ': g.level === 'JUNIOR' ? 'มัธยมตอนต้น' : 'มัธยมตอนปลาย',
        'ระดับชั้น': g.grade,
        'ห้อง': s.room,
        'เลขที่': s.number || '-',
        'คะแนนปัจจุบัน': s.currentScore,
        'จำนวนครั้งที่โดนหัก': s.totalDeductionsCount || 0,
        'คะแนนที่โดนหักสะสม': s.totalDeductedPoints || 0,
        'ครูที่ปรึกษา': s.advisorName || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'นักเรียนกลุ่มที่ถูกหักคะแนน');
    XLSX.writeFile(workbook, `รายงานนักเรียนกลุ่มเสี่ยงและถูกหักคะแนน_ปี${currentAcademicYear}.xlsx`);
  };

  const isStaffOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'staff' || currentUser?.role === 'teacher';

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                ระบบติดตามและแจ้งเตือนคะแนน
              </span>
              <span className="text-xs text-slate-500 font-medium">ปีการศึกษา {currentAcademicYear}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <span>แจ้งเตือนกลุ่มคะแนนวิกฤต เฝ้าระวัง และตักเตือน</span>
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออกรายงาน Excel ({filteredStudents.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards for the 3 Attention Tiers */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* 1. Critical Group Card */}
        <div
          onClick={() => setFilterType(filterType === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
          className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
            filterType === 'CRITICAL'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/50 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-rose-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-xl flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              วิกฤต (หัก ≥ {cutoffs.criticalDeductionCutoff})
            </span>
            <span className="text-2xl font-black text-rose-600">{criticalList.length}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2.5">
            หักคะแนนสะสม ≥ {cutoffs.criticalDeductionCutoff} คะแนน (คะแนนคงเหลือ ≤ {cutoffs.criticalMaxScoreRemaining}) ต้องเรียกพบผู้ปกครองด่วน
          </p>
        </div>

        {/* 2. Watch Group Card */}
        <div
          onClick={() => setFilterType(filterType === 'WATCH' ? 'ALL' : 'WATCH')}
          className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
            filterType === 'WATCH'
              ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-400/50 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-orange-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-800 bg-orange-100 px-2.5 py-1 rounded-xl flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
              เฝ้าระวัง (หัก ≥ {cutoffs.watchDeductionCutoff})
            </span>
            <span className="text-2xl font-black text-orange-600">{watchList.length}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2.5">
            หักคะแนนสะสม ≥ {cutoffs.watchDeductionCutoff} คะแนน (คะแนนคงเหลือ ≤ {cutoffs.watchMaxScoreRemaining}) แนะนำบำเพ็ญประโยชน์
          </p>
        </div>

        {/* 3. Caution Group Card */}
        <div
          onClick={() => setFilterType(filterType === 'CAUTION' ? 'ALL' : 'CAUTION')}
          className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
            filterType === 'CAUTION'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/50 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-amber-200 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-xl flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              ตักเตือน (หัก ≥ {cutoffs.cautionDeductionCutoff})
            </span>
            <span className="text-2xl font-black text-amber-600">{cautionList.length}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2.5">
            หักคะแนนสะสม ≥ {cutoffs.cautionDeductionCutoff} คะแนน (คะแนนคงเหลือ ≤ {cutoffs.cautionMaxScoreRemaining}) ตักเตือนและติดตามพฤติกรรม
          </p>
        </div>

        {/* 4. Total Risk Card */}
        <div
          onClick={() => setFilterType('ALL')}
          className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
            filterType === 'ALL'
              ? 'bg-slate-900 text-white border-slate-800 shadow-md'
              : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
              filterType === 'ALL' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
            }`}>
              รวมกลุ่มที่ถูกหักคะแนน
            </span>
            <span className={`text-2xl font-black ${filterType === 'ALL' ? 'text-amber-400' : 'text-slate-900'}`}>
              {criticalList.length + watchList.length + cautionList.length}
            </span>
          </div>
          <p className={`text-xs mt-2.5 ${filterType === 'ALL' ? 'text-slate-400' : 'text-slate-500'}`}>
            คิดเป็น {students.length > 0 ? (((criticalList.length + watchList.length + cautionList.length) / students.length) * 100).toFixed(1) : 0}% ของนักเรียนทั้งหมด
          </p>
        </div>
      </div>

      {/* Filter and Search Bar: ระดับ, ชั้น (ม.1/1 - ม.6/7 จากฐานข้อมูล), ระดับคะแนน, ค้นหา */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        {/* Status Tab Filter Buttons */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setFilterType('ALL')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterType === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>ทั้งหมด ({criticalList.length + watchList.length + cautionList.length})</span>
            </button>
            <button
              onClick={() => setFilterType('CRITICAL')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterType === 'CRITICAL'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>วิกฤต ({criticalList.length})</span>
            </button>
            <button
              onClick={() => setFilterType('WATCH')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterType === 'WATCH'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-orange-700 hover:bg-orange-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>เฝ้าระวัง ({watchList.length})</span>
            </button>
            <button
              onClick={() => setFilterType('CAUTION')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterType === 'CAUTION'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>ตักเตือน ({cautionList.length})</span>
            </button>
          </div>

          {(levelFilter !== 'ALL' || classroomFilter !== 'ALL' || filterType !== 'ALL' || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setLevelFilter('ALL');
                setClassroomFilter('ALL');
                setFilterType('ALL');
              }}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>ล้างตัวกรอง</span>
            </button>
          )}
        </div>

        {/* Dropdown Filters Row: ระดับ, ชั้น ม.1/1 - ม.6/7, ค้นหา */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={e => {
              setLevelFilter(e.target.value as any);
              setClassroomFilter('ALL');
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">ระดับ: ทุกระดับ (ม.ต้น & ม.ปลาย)</option>
            <option value="JUNIOR">ระดับ: มัธยมตอนต้น (ม.1-3)</option>
            <option value="SENIOR">ระดับ: มัธยมตอนปลาย (ม.4-6)</option>
          </select>

          {/* Classroom Filter from Database */}
          <select
            value={classroomFilter}
            onChange={e => setClassroomFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">ชั้น: ทุกห้อง/ชั้น</option>
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
            <optgroup label="── รายห้องจากฐานข้อมูล ──">
              {availableClassrooms
                .filter(c => levelFilter === 'ALL' || c.level === levelFilter)
                .map(c => (
                  <option key={c.label} value={c.label}>
                    ชั้น {c.label} ({c.count} คน)
                  </option>
                ))}
            </optgroup>
          </select>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหารหัส, ชื่อ, นามสกุล, ครูที่ปรึกษา..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Student List Cards */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <UserCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">ไม่พบนักเรียนตามเงื่อนไขที่เลือก</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            ยินดีด้วย! ไม่มีนักเรียนที่อยู่ในเกณฑ์ที่เลือก หรือลองเปลี่ยนตัวกรองระดับชั้น/คำค้นหา
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedStudents.map(student => {
              const g = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);
              const cat = getScoreCategory(student, systemSettings);

            return (
              <div
                key={student.id}
                className={`p-4 sm:p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 ${
                  cat.type === 'CRITICAL'
                    ? 'bg-white border-rose-200/90 shadow-2xs hover:shadow-md hover:border-rose-400'
                    : cat.type === 'WATCH'
                    ? 'bg-white border-orange-200/90 shadow-2xs hover:shadow-md hover:border-orange-400'
                    : 'bg-white border-amber-200/90 shadow-2xs hover:shadow-md hover:border-amber-400'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <StudentAvatar
                    student={student}
                    currentAcademicYear={currentAcademicYear}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {student.id}
                      </span>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {g.grade}/{student.room} {student.number ? `(เลขที่ ${student.number})` : ''}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cat.badgeClass}`}>
                        {cat.shortLabel}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 truncate mt-1">
                      {student.title}{student.firstName} {student.lastName}
                    </h4>

                    {/* Advisor Info */}
                    <div className="text-xs text-slate-500 mt-1">
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

                  {/* Score Badge */}
                  <div className="flex flex-col items-end flex-shrink-0">
                    <div className={`text-2xl sm:text-3xl font-black ${cat.textClass}`}>
                      {student.currentScore}
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">/ 100 คะแนน</span>
                    <span className="text-[10px] text-rose-600 font-bold mt-1">
                      ตัดไป {student.totalDeductionsCount || 0} ครั้ง (-{student.totalDeductedPoints || 0})
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    onClick={() => onSelectStudent(student.id)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                    <span>ดูประวัติคะแนน</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {isStaffOrAdmin && (
                      <>
                        <button
                          onClick={() => onOpenConductAction(student, 'ADD')}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="เพิ่มคะแนนความประพฤติ/ทำความดี"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>เพิ่มคะแนน</span>
                        </button>
                        <button
                          onClick={() => onOpenConductAction(student, 'DEDUCT')}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="ตัดคะแนนความประพฤติ"
                        >
                          <MinusCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>ตัดคะแนน</span>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onOpenGrantModal(student)}
                      className="p-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl transition-colors cursor-pointer"
                      title="ให้สิทธิ์นักเรียนเปิดดูคะแนน"
                    >
                      <KeyRound className="w-4 h-4 text-violet-600" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* Pagination when filtered students > 20 */}
          {filteredStudents.length > 20 && (
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredStudents.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemLabel="คน"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

