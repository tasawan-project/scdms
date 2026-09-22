import React, { useState, useMemo } from 'react';
import {
  Dormitory,
  Student,
  GradeLevel,
  StudentGender,
  DormitoryType,
  SystemSettings,
  ScoreFilterType
} from '../types';
import {
  calculateStudentGrade,
  getScoreCategory,
  parseConductCutoffs
} from '../utils/conductLogic';
import {
  getDormitoryTypeName,
  getDormitoryTypeBadge,
  getDormitorySupervisors,
  inferStudentGender,
  DEFAULT_DORMITORIES
} from '../utils/dormitoryLogic';
import { StudentAvatar } from './StudentAvatar';
import {
  Building2,
  Users,
  Search,
  Filter,
  Printer,
  Download,
  Phone,
  UserCheck,
  ShieldAlert,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  Bed,
  CheckCircle2,
  AlertTriangle,
  Award,
  SlidersHorizontal,
  ExternalLink,
  UserMinus,
  UserPlus,
  Loader2,
  X
} from 'lucide-react';

interface DormitoryStudentsViewProps {
  dormitories: Dormitory[];
  students: Student[];
  currentAcademicYear: number;
  initialDormId?: string;
  systemSettings?: SystemSettings;
  onSelectStudent?: (studentId: string) => void;
  onBackToDormitories?: () => void;
  onBackToDashboard?: () => void;
  onConductAction?: (student: Student, actionType: 'DEDUCT' | 'ADD') => void;
  onClearAllStudentDormitories?: () => Promise<number>;
  onAssignStudentDormitory?: (studentId: string, dormitoryId?: string, dormitoryName?: string) => Promise<void>;
  onBatchAssignStudentsDormitory?: (studentIds: string[], dormitoryId?: string, dormitoryName?: string) => Promise<number>;
}

const ALL_GRADES: GradeLevel[] = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

export const DormitoryStudentsView: React.FC<DormitoryStudentsViewProps> = ({
  dormitories = [],
  students = [],
  currentAcademicYear,
  initialDormId,
  systemSettings,
  onSelectStudent,
  onBackToDormitories,
  onBackToDashboard,
  onConductAction,
  onClearAllStudentDormitories,
  onAssignStudentDormitory,
  onBatchAssignStudentsDormitory
}) => {
  const activeDorms = useMemo(() => {
    if (dormitories.length > 0) {
      return [...dormitories].sort((a, b) => a.dormNumber - b.dormNumber);
    }
    return DEFAULT_DORMITORIES;
  }, [dormitories]);

  // Active filter states
  const [selectedDormFilter, setSelectedDormFilter] = useState<string>(initialDormId || 'ALL'); // 'ALL' | 'UNASSIGNED' | dormId
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [batchTargetDormId, setBatchTargetDormId] = useState<string>('');
  const [isBatchAssigning, setIsBatchAssigning] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialDormId) {
      setSelectedDormFilter(initialDormId);
    }
  }, [initialDormId]);
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<'ALL' | 'M' | 'F'>('ALL');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('ALL');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('ALL');
  const [selectedScoreFilter, setSelectedScoreFilter] = useState<ScoreFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cutoffs for score badges
  const cutoffs = useMemo(() => parseConductCutoffs(systemSettings), [systemSettings]);

  // Active students filter (exclude transferred or graduated)
  const activeStudents = useMemo(() => {
    return students.filter(s => s.status !== 'GRADUATED' && s.status !== 'TRANSFERRED');
  }, [students]);

  // Map dormitories by ID
  const dormMap = useMemo(() => {
    const map = new Map<string, Dormitory>();
    activeDorms.forEach(d => map.set(d.id, d));
    return map;
  }, [activeDorms]);

  // Selected dormitory details object if specific dorm selected
  const activeDormObject = useMemo(() => {
    if (selectedDormFilter === 'ALL' || selectedDormFilter === 'UNASSIGNED') return null;
    return dormMap.get(selectedDormFilter) || null;
  }, [selectedDormFilter, dormMap]);

  // Filtered students list
  const filteredStudents = useMemo(() => {
    return activeStudents.filter(st => {
      // 1. Dormitory filter
      if (selectedDormFilter === 'UNASSIGNED') {
        if (st.dormitoryId) return false;
      } else if (selectedDormFilter !== 'ALL') {
        if (st.dormitoryId !== selectedDormFilter) return false;
      }

      // 2. Gender filter
      const stGender = st.gender || inferStudentGender(st);
      if (selectedGenderFilter !== 'ALL' && stGender !== selectedGenderFilter) {
        return false;
      }

      // 3. Grade & Room filter
      const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
      if (selectedGradeFilter !== 'ALL' && grade !== selectedGradeFilter) {
        return false;
      }
      if (selectedRoomFilter !== 'ALL' && String(st.room) !== selectedRoomFilter) {
        return false;
      }

      // 4. Score category filter
      if (selectedScoreFilter !== 'ALL') {
        const cat = getScoreCategory(st, systemSettings);
        if (cat.type !== selectedScoreFilter) return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${st.title || ''}${st.firstName} ${st.lastName}`.toLowerCase();
        const dormName = (st.dormitoryName || '').toLowerCase();
        const idMatch = st.id.toLowerCase().includes(q);
        const nameMatch = fullName.includes(q);
        const phoneMatch = (st.guardianPhone || '').includes(q);
        const dormMatch = dormName.includes(q);
        if (!idMatch && !nameMatch && !phoneMatch && !dormMatch) return false;
      }

      return true;
    });
  }, [
    activeStudents,
    selectedDormFilter,
    selectedGenderFilter,
    selectedGradeFilter,
    selectedRoomFilter,
    selectedScoreFilter,
    searchQuery,
    currentAcademicYear,
    systemSettings
  ]);

  // Aggregate statistics
  const stats = useMemo(() => {
    let maleCount = 0;
    let femaleCount = 0;
    let criticalCount = 0;
    let watchCount = 0;
    let assignedCount = 0;
    let unassignedCount = 0;

    activeStudents.forEach(st => {
      const g = st.gender || inferStudentGender(st);
      if (g === 'M') maleCount++;
      else femaleCount++;

      if (st.dormitoryId) assignedCount++;
      else unassignedCount++;

      const cat = getScoreCategory(st, systemSettings);
      if (cat.type === 'CRITICAL') criticalCount++;
      else if (cat.type === 'WATCH') watchCount++;
    });

    const totalCapacity = activeDorms.reduce((sum, d) => sum + (d.capacity || 80), 0);

    return {
      total: activeStudents.length,
      assignedCount,
      unassignedCount,
      maleCount,
      femaleCount,
      criticalCount,
      watchCount,
      totalCapacity,
      filteredCount: filteredStudents.length
    };
  }, [activeStudents, activeDorms, filteredStudents, systemSettings]);

  // Export to Excel (CSV UTF-8 BOM)
  const handleExportCSV = () => {
    const headers = [
      'ลำดับ',
      'รหัสนักเรียน',
      'คำนำหน้า',
      'ชื่อ',
      'นามสกุล',
      'เพศ',
      'ระดับชั้น',
      'ห้อง',
      'เลขที่',
      'หอพัก',
      'ประเภทหอพัก',
      'ครูหอพักผู้ดูแล',
      'คะแนนความประพฤติ',
      'สถานะคะแนน',
      'เบอร์โทรผู้ปกครอง'
    ];

    const rows = filteredStudents.map((st, idx) => {
      const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
      const dorm = st.dormitoryId ? dormMap.get(st.dormitoryId) : null;
      const sups = dorm ? getDormitorySupervisors(dorm).map(s => s.name).join(' / ') : '-';
      const dormType = dorm ? getDormitoryTypeName(dorm.gender) : '-';
      const cat = getScoreCategory(st, systemSettings);
      const genderLabel = (st.gender || inferStudentGender(st)) === 'M' ? 'ชาย' : 'หญิง';

      return [
        idx + 1,
        st.id,
        st.title || '',
        st.firstName,
        st.lastName,
        genderLabel,
        grade,
        st.room,
        st.number || '',
        st.dormitoryName || 'ยังไม่มีหอพัก',
        dormType,
        sups,
        st.currentScore ?? 100,
        cat.label,
        st.guardianPhone || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `รายชื่อนักเรียนหอพัก_${selectedDormFilter}_${currentAcademicYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClearAllDormitories = async () => {
    if (!onClearAllStudentDormitories) return;
    setIsClearing(true);
    try {
      const count = await onClearAllStudentDormitories();
      setFeedbackMessage(`เคลียร์หอพักสำเร็จ! ได้ปลดนักเรียนออกจากหอพักทั้งหมด ${count} คนเรียบร้อยแล้ว เจ้าหน้าที่สามารถจัดการจัดนักเรียนลงหอพักเองได้เลย`);
      setShowClearModal(false);
      setSelectedStudentIds([]);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการเคลียร์หอพัก: ' + (err.message || String(err)));
    } finally {
      setIsClearing(false);
    }
  };

  const handleAssignSingleStudent = async (studentId: string, dormId?: string) => {
    if (!onAssignStudentDormitory) return;
    try {
      const dorm = dormId ? activeDorms.find(d => d.id === dormId) : undefined;
      await onAssignStudentDormitory(studentId, dorm?.id, dorm?.name);
      setFeedbackMessage(dorm ? `จัดนักเรียนเข้า "${dorm.name}" สำเร็จ` : `ปลดนักเรียนออกจากหอพักเรียบร้อย`);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + (err.message || String(err)));
    }
  };

  const handleBatchAssign = async () => {
    if (!onBatchAssignStudentsDormitory || selectedStudentIds.length === 0) return;
    setIsBatchAssigning(true);
    try {
      const dorm = batchTargetDormId ? activeDorms.find(d => d.id === batchTargetDormId) : undefined;
      await onBatchAssignStudentsDormitory(selectedStudentIds, dorm?.id, dorm?.name);
      setFeedbackMessage(
        dorm
          ? `จัดนักเรียน ${selectedStudentIds.length} คน เข้า "${dorm.name}" เรียบร้อยแล้ว`
          : `ปลดนักเรียน ${selectedStudentIds.length} คน ออกจากหอพักเรียบร้อยแล้ว`
      );
      setSelectedStudentIds([]);
      setBatchTargetDormId('');
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + (err.message || String(err)));
    } finally {
      setIsBatchAssigning(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Header Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  รายชื่อนักเรียนในหอพัก
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  ปีการศึกษา {currentAcademicYear}
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  ทั้งหมด {stats.assignedCount} / {stats.total} คน
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                ตรวจสอบรายชื่อนักเรียนในแต่ละหอพัก แยกตามประเภทหอพัก (หอพักรวม, หอพักชาย, หอพักหญิง) พร้อมรายชื่อครูหอพักประจำและคะแนนความประพฤติ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {onBackToDormitories && (
              <button
                type="button"
                onClick={onBackToDormitories}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
              >
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>ไปที่ผังจัดการหอพัก</span>
              </button>
            )}

            {onClearAllStudentDormitories && (
              <button
                type="button"
                id="btn-clear-dormitories-view"
                onClick={() => setShowClearModal(true)}
                disabled={isClearing || stats.assignedCount === 0}
                className="px-3.5 py-2 text-xs font-bold rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-40"
                title="เอานักเรียนออกจากหอพักทั้งหมด เพื่อที่เจ้าหน้าที่จะทำการจัดการนักเรียนลงหอพักเอง"
              >
                <UserMinus className="w-3.5 h-3.5 text-rose-600" />
                <span>เคลียร์หอพัก (เอาออกทั้งหมด)</span>
              </button>
            )}

            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>แดชบอร์ด</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              title="ส่งออกรายชื่อเป็นไฟล์ Excel (.csv)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออก Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              title="พิมพ์รายงานรายชื่อ"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์รายชื่อ</span>
            </button>
          </div>
        </div>

        {feedbackMessage && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-800 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">{feedbackMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Dormitory Selection Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedDormFilter('ALL')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedDormFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            หอพักทั้งหมด ({activeStudents.length})
          </button>

          {activeDorms.map(dorm => {
            const isSelected = selectedDormFilter === dorm.id;
            const badge = getDormitoryTypeBadge(dorm.gender);
            const count = activeStudents.filter(s => s.dormitoryId === dorm.id).length;

            return (
              <button
                type="button"
                key={dorm.id}
                onClick={() => setSelectedDormFilter(dorm.id)}
                className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{dorm.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected
                      ? 'bg-indigo-700 text-white'
                      : `${badge.bgClass} ${badge.textClass}`
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedDormFilter('UNASSIGNED')}
            className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedDormFilter === 'UNASSIGNED'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <span>ยังไม่มีหอพัก</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-mono">
              {stats.unassignedCount}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Selected Dormitory Banner (If specific dorm chosen) */}
      {activeDormObject && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-400" />
                  <span>{activeDormObject.name}</span>
                </h3>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                    activeDormObject.gender === 'MIXED'
                      ? 'bg-purple-900/80 text-purple-200 border border-purple-400/30'
                      : activeDormObject.gender === 'M'
                      ? 'bg-blue-900/80 text-blue-200 border border-blue-400/30'
                      : 'bg-pink-900/80 text-pink-200 border border-pink-400/30'
                  }`}
                >
                  {getDormitoryTypeName(activeDormObject.gender)}
                </span>
                <span className="text-xs bg-white/10 text-slate-200 px-2.5 py-0.5 rounded-full">
                  ความจุ {activeDormObject.capacity || 80} เตียง
                </span>
              </div>
              <p className="text-xs text-slate-300">
                ระดับชั้น: {activeDormObject.assignedGrades.join(', ')} | ห้อง:{' '}
                {(!activeDormObject.assignedRooms || activeDormObject.assignedRooms.length === 0)
                  ? 'ทุกห้อง'
                  : activeDormObject.assignedRooms.join(', ')}
              </p>
            </div>

            {/* Multiple Supervisors Display (as required: ครูหอพักมีมากกว่า 1 คน) */}
            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 border border-white/15 max-w-md">
              <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider flex items-center gap-1 mb-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                <span>ครูผู้ดูแลหอพักประจำ ({getDormitorySupervisors(activeDormObject).length} คน)</span>
              </span>
              <div className="space-y-1">
                {getDormitorySupervisors(activeDormObject).map(sup => (
                  <div key={sup.id} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="font-bold text-white truncate">{sup.name}</span>
                      {sup.role && (
                        <span className="text-[10px] text-slate-300">({sup.role})</span>
                      )}
                    </div>
                    {sup.phone && (
                      <a
                        href={`tel:${sup.phone}`}
                        className="text-[11px] text-indigo-200 hover:text-white flex items-center gap-1 font-mono shrink-0"
                      >
                        <Phone className="w-3 h-3 text-emerald-400" />
                        <span>{sup.phone}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Filter Controls Row */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          {/* Search Box */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหารหัส, ชื่อ-นามสกุล, หรือเบอร์โทร..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Gender Filter */}
          <div>
            <select
              value={selectedGenderFilter}
              onChange={e => setSelectedGenderFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">เพศ: ทั้งหมด</option>
              <option value="M">♂ ชาย (M)</option>
              <option value="F">♀ หญิง (F)</option>
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <select
              value={selectedGradeFilter}
              onChange={e => setSelectedGradeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">ระดับชั้น: ทุกระดับชั้น</option>
              {ALL_GRADES.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Score Filter */}
          <div>
            <select
              value={selectedScoreFilter}
              onChange={e => setSelectedScoreFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">สถานะคะแนน: ทั้งหมด</option>
              <option value="NORMAL">ปกติ (100 คะแนน)</option>
              <option value="CAUTION">ตักเตือน (71 - 99)</option>
              <option value="WATCH">เฝ้าระวัง (51 - 70)</option>
              <option value="CRITICAL">วิกฤต (≤ 50 คะแนน)</option>
              <option value="OUTSTANDING">ดีเด่น / ยอดเยี่ยม</option>
            </select>
          </div>
        </div>

        {/* Filter Summary Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex-wrap gap-2">
          <span>
            ผลการค้นหา: <strong className="text-slate-800 font-bold">{filteredStudents.length}</strong> คน
            {selectedDormFilter !== 'ALL' && (
              <> ใน {selectedDormFilter === 'UNASSIGNED' ? 'นักเรียนที่ยังไม่มีหอพัก' : activeDormObject?.name}</>
            )}
          </span>

          {(selectedDormFilter !== 'ALL' ||
            selectedGenderFilter !== 'ALL' ||
            selectedGradeFilter !== 'ALL' ||
            selectedScoreFilter !== 'ALL' ||
            searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedDormFilter('ALL');
                setSelectedGenderFilter('ALL');
                setSelectedGradeFilter('ALL');
                setSelectedRoomFilter('ALL');
                setSelectedScoreFilter('ALL');
                setSearchQuery('');
              }}
              className="text-indigo-600 hover:underline font-bold cursor-pointer"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>
      </div>

      {/* 4. Student Roster Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        {/* Batch Selection Action Bar */}
        {onBatchAssignStudentsDormitory && selectedStudentIds.length > 0 && (
          <div className="p-3 bg-indigo-50 border-b border-indigo-200 flex items-center justify-between gap-3 flex-wrap animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-indigo-900">
                เลือกนักเรียน {selectedStudentIds.length} คน
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={batchTargetDormId}
                onChange={e => setBatchTargetDormId(e.target.value)}
                className="px-3 py-1.5 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">-- เลือกหอพักปลายทาง --</option>
                {activeDorms.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({getDormitoryTypeName(d.gender)})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleBatchAssign}
                disabled={!batchTargetDormId || isBatchAssigning}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isBatchAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                <span>จัดเข้าหอพักที่เลือก</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (window.confirm(`ต้องการปลดนักเรียนที่เลือกทั้ง ${selectedStudentIds.length} คน ออกจากหอพักใช่หรือไม่?`)) {
                    setIsBatchAssigning(true);
                    try {
                      await onBatchAssignStudentsDormitory(selectedStudentIds, undefined, undefined);
                      setFeedbackMessage(`ปลดนักเรียน ${selectedStudentIds.length} คน ออกจากหอพักเรียบร้อย`);
                      setSelectedStudentIds([]);
                    } catch (err: any) {
                      alert('เกิดข้อผิดพลาด: ' + (err.message || String(err)));
                    } finally {
                      setIsBatchAssigning(false);
                    }
                  }
                }}
                disabled={isBatchAssigning}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>ปลดออกจากหอพัก</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStudentIds([])}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                title="ยกเลิกการเลือก"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                {onBatchAssignStudentsDormitory && (
                  <th className="py-3 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudentIds(filteredStudents.map(s => s.id));
                        } else {
                          setSelectedStudentIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      title="เลือกทั้งหมด"
                    />
                  </th>
                )}
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-3 w-24">รหัสนักเรียน</th>
                <th className="py-3 px-3 min-w-[200px]">ชื่อ - นามสกุล</th>
                <th className="py-3 px-3 text-center w-20">เพศ</th>
                <th className="py-3 px-3 text-center w-24">ชั้น / ห้อง</th>
                <th className="py-3 px-3 text-center w-16">เลขที่</th>
                <th className="py-3 px-3 min-w-[170px]">หอพักที่สังกัด</th>
                <th className="py-3 px-3 min-w-[160px]">ครูผู้ดูแลหอพัก</th>
                <th className="py-3 px-3 text-center min-w-[130px]">คะแนนความประพฤติ</th>
                <th className="py-3 px-3 text-center w-28">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={onBatchAssignStudentsDormitory ? 11 : 10} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-sm text-slate-600">ไม่พบข้อมูลนักเรียนตามเงื่อนไขที่เลือก</p>
                    <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนตัวกรองหอพัก ระดับชั้น หรือคำค้นหา</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, index) => {
                  const { grade } = calculateStudentGrade(
                    st.entryYear,
                    st.entryLevel,
                    currentAcademicYear
                  );
                  const dorm = st.dormitoryId ? dormMap.get(st.dormitoryId) : null;
                  const dormSupervisors = dorm ? getDormitorySupervisors(dorm) : [];
                  const cat = getScoreCategory(st, systemSettings);
                  const stGender = st.gender || inferStudentGender(st);

                  return (
                    <tr
                      key={st.id}
                      className="hover:bg-indigo-50/40 transition-colors group"
                    >
                      {onBatchAssignStudentsDormitory && (
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(st.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentIds(prev => [...prev, st.id]);
                              } else {
                                setSelectedStudentIds(prev => prev.filter(id => id !== st.id));
                              }
                            }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                      )}

                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                        {index + 1}
                      </td>

                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        <button
                          type="button"
                          onClick={() => onSelectStudent && onSelectStudent(st.id)}
                          className="hover:text-indigo-600 hover:underline cursor-pointer"
                        >
                          {st.id}
                        </button>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <StudentAvatar
                            student={st}
                            photoUrl={st.photoUrl}
                            gender={stGender}
                            size="sm"
                          />
                          <div className="truncate">
                            <span
                              onClick={() => onSelectStudent && onSelectStudent(st.id)}
                              className="font-bold text-slate-900 hover:text-indigo-600 cursor-pointer block truncate"
                            >
                              {st.title || ''}{st.firstName} {st.lastName}
                            </span>
                            {st.guardianPhone && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                {st.guardianPhone}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                            stGender === 'M'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-pink-50 text-pink-700 border-pink-200'
                          }`}
                        >
                          {stGender === 'M' ? '♂ ชาย' : '♀ หญิง'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                        {grade}/{st.room}
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                        {st.number || '-'}
                      </td>

                      <td className="py-2.5 px-3">
                        {dorm ? (
                          <div>
                            <span className="font-bold text-slate-900 block truncate">
                              {dorm.name}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md inline-block mt-0.5 ${
                                getDormitoryTypeBadge(dorm.gender).bgClass
                              } ${getDormitoryTypeBadge(dorm.gender).textClass}`}
                            >
                              {getDormitoryTypeName(dorm.gender)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            ยังไม่มีหอพัก
                          </span>
                        )}

                        {onAssignStudentDormitory && (
                          <div className="mt-1">
                            <select
                              value={st.dormitoryId || ''}
                              onChange={(e) => handleAssignSingleStudent(st.id, e.target.value || undefined)}
                              className="w-full max-w-[155px] px-2 py-1 bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-400 rounded-lg text-[10px] font-bold text-slate-700 focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-colors shadow-2xs"
                              title="เปลี่ยนหอพักหรือเลือกหอพักให้นักเรียน"
                            >
                              <option value="">-- ยังไม่มีหอพัก --</option>
                              {activeDorms.map(d => (
                                <option key={d.id} value={d.id}>
                                  {d.name} ({getDormitoryTypeBadge(d.gender).shortLabel})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {dormSupervisors.length > 0 ? (
                          <div className="space-y-0.5 max-w-[180px]">
                            {dormSupervisors.map(sup => (
                              <div key={sup.id} className="truncate text-[11px] text-slate-700">
                                <span className="font-bold text-slate-800">{sup.name}</span>
                                {sup.phone && (
                                  <span className="text-[10px] text-slate-400 font-mono ml-1">
                                    ({sup.phone})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold text-[11px] inline-flex items-center gap-1 ${cat.badgeClass}`}
                        >
                          <span>{st.currentScore ?? 100} แต้ม</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {onSelectStudent && (
                            <button
                              type="button"
                              onClick={() => onSelectStudent(st.id)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="ดูประวัติคะแนนความประพฤติ"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {st.dormitoryId && onAssignStudentDormitory && (
                            <button
                              type="button"
                              onClick={() => handleAssignSingleStudent(st.id, undefined)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="ปลดนักเรียนออกจากหอพัก"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onConductAction && (
                            <button
                              type="button"
                              onClick={() => onConductAction(st, 'DEDUCT')}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-[10px] font-bold"
                              title="ตัดคะแนนความประพฤติ"
                            >
                              ตัดคะแนน
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal to Clear All Dormitories */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-scale-up">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">
                  ยืนยันเคลียร์หอพักทั้งหมด?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  การกระทำนี้จะ<strong>ปลดนักเรียนทั้งหมด ({stats.assignedCount} คน)</strong> ออกจากหอพักที่สังกัดอยู่ เพื่อให้เจ้าหน้าที่สามารถจัดการจัดนักเรียนลงหอพักเองได้
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-2xl text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>คำเตือน</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-rose-700">
                <li>ข้อมูลคะแนนความประพฤติและข้อมูลส่วนตัวของนักเรียนจะไม่ได้รับผลกระทบ</li>
                <li>นักเรียนจะกลายเป็นสถานะ "ยังไม่มีหอพัก" ทันที</li>
                <li>เจ้าหน้าที่สามารถเลือกจัดนักเรียนเข้าหอพักทีละคน หรือเลือกหลายคนแล้วจัดพร้อมกันได้</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={isClearing}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                id="btn-confirm-clear-dormitories-view"
                onClick={handleClearAllDormitories}
                disabled={isClearing}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังเคลียร์หอพัก...</span>
                  </>
                ) : (
                  <>
                    <UserMinus className="w-4 h-4" />
                    <span>ยืนยันเคลียร์นักเรียนทั้งหมด</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
