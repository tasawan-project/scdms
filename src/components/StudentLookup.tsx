import React, { useState, useEffect, useMemo } from 'react';
import {
  Student,
  ConductLog,
  AppUser,
  StudentAccessGrant,
  SystemSettings,
  HomeroomAdvisor,
  ScoreFilterType,
  EducationalLevel,
  GradeLevel
} from '../types';
import {
  calculateStudentGrade,
  getScoreCategory,
  parseConductCutoffs,
  getStudentAdvisors,
  recalculateStudentScoresFromLogs,
  computeLogsWithRunningScores
} from '../utils/conductLogic';
import { formatThaiDate } from '../utils/thaiDate';
import { StudentAvatar } from './StudentAvatar';
import { ScoreStatusSelect } from './ScoreStatusSelect';
import { Pagination } from './Pagination';
import { EditConductLogModal } from './EditConductLogModal';
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Crown,
  Award,
  Sparkles,
  Clock,
  User,
  Calendar,
  PlusCircle,
  MinusCircle,
  FileText,
  Printer,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Eye,
  Info,
  UserCheck,
  Lock,
  GraduationCap,
  X,
  Users,
  UserPlus,
  Edit,
  Camera,
  Trash2,
  Maximize2
} from 'lucide-react';

interface StudentLookupProps {
  students: Student[];
  conductLogs: ConductLog[];
  currentAcademicYear: number;
  currentTerm: number;
  currentUser: AppUser | null;
  studentGrant: StudentAccessGrant | null;
  systemSettings?: SystemSettings;
  advisors?: HomeroomAdvisor[];
  onOpenConductAction: (student: Student, defaultType: 'DEDUCT' | 'ADD') => void;
  onOpenGrantModal: (student: Student) => void;
  initialStudentId?: string;
  onUpdateStudentPhoto?: (studentId: string, photoUrl: string) => Promise<void> | void;
  onOpenAddStudent?: () => void;
  onOpenEditStudent?: (student: Student) => void;
  onDeleteStudent?: (studentId: string) => Promise<void>;
  onEditConductLog?: (updatedLog: ConductLog, updatedStudent: Student) => Promise<void>;
  onDeleteConductLog?: (log: ConductLog, updatedStudent: Student) => Promise<void>;
  onOpenPhotoManager?: () => void;
}

export const StudentLookup: React.FC<StudentLookupProps> = ({
  students = [],
  conductLogs = [],
  currentAcademicYear,
  currentTerm,
  currentUser,
  studentGrant,
  systemSettings,
  advisors = [],
  onOpenConductAction,
  onOpenGrantModal,
  initialStudentId = '',
  onUpdateStudentPhoto,
  onOpenAddStudent,
  onOpenEditStudent,
  onDeleteStudent,
  onEditConductLog,
  onDeleteConductLog,
  onOpenPhotoManager
}) => {
  const cutoffs = useMemo(() => parseConductCutoffs(systemSettings), [systemSettings]);
  const userRole = currentUser?.role || 'student';
  const isStudentView = userRole === 'student' || studentGrant !== null;
  const canDeductAndAdd = userRole === 'admin' || userRole === 'staff' || userRole === 'teacher';
  const canGrantAccess = userRole === 'admin' || userRole === 'staff' || userRole === 'teacher';
  const canManageLogs = userRole === 'admin' || userRole === 'staff' || userRole === 'teacher';

  const [searchId, setSearchId] = useState(initialStudentId || (studentGrant?.studentId || ''));
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(() => {
    const list = students || [];
    if (studentGrant) {
      return list.find(s => s && s.id === studentGrant.studentId) || null;
    }
    if (initialStudentId) {
      return list.find(s => s && s.id === initialStudentId) || null;
    }
    return null;
  });

  // Always derive latest student data from students list
  const currentStudent = useMemo(() => {
    if (!selectedStudent) return null;
    return (students || []).find(s => s && s.id === selectedStudent.id) || selectedStudent;
  }, [selectedStudent, students]);

  const [photoFitMode, setPhotoFitMode] = useState<'cover' | 'contain'>('cover');
  const [editingLog, setEditingLog] = useState<ConductLog | null>(null);
  const [deletingLog, setDeletingLog] = useState<ConductLog | null>(null);
  const [isDeletingLog, setIsDeletingLog] = useState<boolean>(false);

  // Table state for Recent Scores / Student Conduct Table
  const [levelFilter, setLevelFilter] = useState<'ALL' | EducationalLevel>('ALL');
  const [classroomFilter, setClassroomFilter] = useState<string>('ALL');
  const [scoreStatusFilter, setScoreStatusFilter] = useState<ScoreFilterType>('ALL');
  const [tableSortBy, setTableSortBy] = useState<'latestUpdate' | 'id' | 'name' | 'grade' | 'currentScore'>('latestUpdate');
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedTableStudentIds, setExpandedTableStudentIds] = useState<Set<string>>(new Set());
  const [tablePage, setTablePage] = useState<number>(1);
  const [tablePageSize, setTablePageSize] = useState<number>(20);

  // Active students only
  const activeStudents = useMemo(() => (students || []).filter(s => s && s.status === 'ACTIVE'), [students]);

  // Extract available classrooms from database
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

  // Filter classrooms by level
  const filteredClassroomsList = useMemo(() => {
    if (levelFilter === 'ALL') return availableClassrooms;
    return availableClassrooms.filter(c => c.level === levelFilter);
  }, [availableClassrooms, levelFilter]);

  // Score distribution counts
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

  const scoreCountsMap = useMemo(() => ({
    ALL: activeStudents.length,
    CRITICAL: categoryCounts.critical,
    WATCH: categoryCounts.watch,
    CAUTION: categoryCounts.caution,
    NORMAL: categoryCounts.normal,
    OUTSTANDING: categoryCounts.outstanding,
    EXCELLENT: categoryCounts.excellent
  }), [activeStudents.length, categoryCounts]);

  // Map each student to their latest conduct log and update timestamp
  const studentLatestInfoMap = useMemo(() => {
    const logsByStudent = new Map<string, ConductLog[]>();
    (conductLogs || []).forEach(log => {
      if (!log.studentId) return;
      const list = logsByStudent.get(log.studentId) || [];
      list.push(log);
      logsByStudent.set(log.studentId, list);
    });

    const map = new Map<string, { latestLog: ConductLog | null; latestTimestamp: number; logs: ConductLog[] }>();

    (students || []).forEach(s => {
      const sLogs = logsByStudent.get(s.id) || [];
      sLogs.sort((a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime());
      const latestLog = sLogs.length > 0 ? sLogs[0] : null;

      let ts = 0;
      if (latestLog?.recordedAt) {
        ts = new Date(latestLog.recordedAt).getTime();
      } else if (s.updatedAt) {
        ts = new Date(s.updatedAt).getTime();
      } else if (s.createdAt) {
        ts = new Date(s.createdAt).getTime();
      }

      map.set(s.id, { latestLog, latestTimestamp: ts, logs: sLogs });
    });

    return map;
  }, [students, conductLogs]);

  // Filtered & Sorted Table Students
  const filteredTableStudents = useMemo(() => {
    let result = activeStudents;

    // Search query
    const clean = searchId.trim().toLowerCase();
    if (clean) {
      result = result.filter(s => {
        if (!s) return false;
        const idMatch = (s.id || '').toLowerCase().includes(clean);
        const fullName = `${s.title || ''}${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
        const nameMatch = fullName.includes(clean);
        const nickMatch = (s.nickname || '').toLowerCase().includes(clean);
        const roomMatch = `${s.room || ''}` === clean;
        return idMatch || nameMatch || nickMatch || roomMatch;
      });
    }

    // Level filter
    if (levelFilter !== 'ALL') {
      result = result.filter(s => {
        const { level } = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
        return level === levelFilter;
      });
    }

    // Classroom filter
    if (classroomFilter !== 'ALL') {
      if (classroomFilter.startsWith('GRADE_')) {
        const targetGrade = classroomFilter.replace('GRADE_', '');
        result = result.filter(s => {
          const { grade } = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
          return grade === targetGrade;
        });
      } else {
        result = result.filter(s => {
          const { grade } = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
          return `${grade}/${s.room}` === classroomFilter;
        });
      }
    }

    // Score status filter
    if (scoreStatusFilter !== 'ALL') {
      result = result.filter(s => {
        const cat = getScoreCategory(s, systemSettings);
        return cat.type === scoreStatusFilter;
      });
    }

    // Sorting
    const sorted = [...result].sort((a, b) => {
      let comparison = 0;

      if (tableSortBy === 'latestUpdate') {
        const tsA = studentLatestInfoMap.get(a.id)?.latestTimestamp || 0;
        const tsB = studentLatestInfoMap.get(b.id)?.latestTimestamp || 0;
        comparison = tsA - tsB;
        if (comparison === 0) {
          comparison = a.id.localeCompare(b.id);
        }
      } else if (tableSortBy === 'id') {
        comparison = a.id.localeCompare(b.id);
      } else if (tableSortBy === 'name') {
        const nameA = `${a.firstName} ${a.lastName}`;
        const nameB = `${b.firstName} ${b.lastName}`;
        comparison = nameA.localeCompare(nameB, 'th');
      } else if (tableSortBy === 'grade') {
        const gA = calculateStudentGrade(a.entryYear, a.entryLevel, currentAcademicYear);
        const gB = calculateStudentGrade(b.entryYear, b.entryLevel, currentAcademicYear);
        const gradeOrder: Record<string, number> = { 'ม.1': 1, 'ม.2': 2, 'ม.3': 3, 'ม.4': 4, 'ม.5': 5, 'ม.6': 6 };
        const diff = (gradeOrder[gA.grade] || 99) - (gradeOrder[gB.grade] || 99);
        comparison = diff !== 0 ? diff : a.room - b.room;
      } else if (tableSortBy === 'currentScore') {
        comparison = a.currentScore - b.currentScore;
      }

      return tableSortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [
    activeStudents,
    searchId,
    levelFilter,
    classroomFilter,
    scoreStatusFilter,
    tableSortBy,
    tableSortDirection,
    currentAcademicYear,
    systemSettings,
    studentLatestInfoMap
  ]);

  const paginatedTableStudents = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredTableStudents.slice(start, start + tablePageSize);
  }, [filteredTableStudents, tablePage, tablePageSize]);

  useEffect(() => {
    setTablePage(1);
  }, [searchId, levelFilter, classroomFilter, scoreStatusFilter, tableSortBy, tableSortDirection, tablePageSize]);

  const toggleExpandStudent = (studentId: string) => {
    setExpandedTableStudentIds(prev => {
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
    if (expandedTableStudentIds.size >= filteredTableStudents.length && filteredTableStudents.length > 0) {
      setExpandedTableStudentIds(new Set());
    } else {
      setExpandedTableStudentIds(new Set(filteredTableStudents.map(s => s.id)));
    }
  };

  const handleTableSort = (field: 'latestUpdate' | 'id' | 'name' | 'grade' | 'currentScore') => {
    if (tableSortBy === field) {
      setTableSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTableSortBy(field);
      setTableSortDirection(field === 'currentScore' || field === 'latestUpdate' ? 'desc' : 'asc');
    }
  };

  const getSortIcon = (field: 'latestUpdate' | 'id' | 'name' | 'grade' | 'currentScore') => {
    if (tableSortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    }
    return tableSortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-600" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-600" />
    );
  };

  const hasActiveFilters = searchId.trim().length > 0 || levelFilter !== 'ALL' || classroomFilter !== 'ALL' || scoreStatusFilter !== 'ALL';

  const handleClearAllFilters = () => {
    setSearchId('');
    setLevelFilter('ALL');
    setClassroomFilter('ALL');
    setScoreStatusFilter('ALL');
  };

  // Calculate all advisors for selected student, strictly sorted with ครูที่ปรึกษา 1 first
  const studentAdvisors = useMemo(() => {
    if (!currentStudent) return [];
    return getStudentAdvisors(currentStudent, advisors, currentAcademicYear);
  }, [currentStudent, advisors, currentAcademicYear]);

  // Formatted string for alerts and descriptions
  const advisorDisplaySummary = useMemo(() => {
    if (studentAdvisors.length > 0) {
      return studentAdvisors.map((a, idx) => {
        const order = Number(a.advisorOrder) || (idx + 1);
        return `${a.fullName} (${order === 1 ? 'ครูที่ปรึกษา 1' : `ครูที่ปรึกษา ${order}`})`;
      }).join(', ');
    }
    return currentStudent?.advisorName || 'ครูประจำชั้น';
  }, [studentAdvisors, currentStudent]);

  // Real-time automatic search matching
  const matchingStudents = useMemo(() => {
    const clean = searchId.trim().toLowerCase();
    if (!clean) return [];
    
    return (students || []).filter(s => {
      if (!s) return false;
      const idMatch = (s.id || '').toLowerCase().includes(clean);
      const fullName = `${s.title || ''}${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
      const nameMatch = fullName.includes(clean);
      const nickMatch = (s.nickname || '').toLowerCase().includes(clean);
      const roomMatch = `${s.room || ''}` === clean;
      return idMatch || nameMatch || nickMatch || roomMatch;
    });
  }, [students, searchId]);

  const hasSearchQuery = searchId.trim().length > 0;
  const hasNoResults = hasSearchQuery && matchingStudents.length === 0;

  // Sync initialStudentId or studentGrant prop changes
  useEffect(() => {
    const list = students || [];
    if (list.length === 0) {
      setSelectedStudent(null);
      setSearchId('');
      return;
    }
    if (initialStudentId) {
      const found = list.find(s => s && s.id === initialStudentId);
      if (found) {
        setSelectedStudent(found);
        setSearchId(found.id);
      } else {
        setSelectedStudent(null);
        setSearchId(initialStudentId);
      }
    } else if (studentGrant) {
      const found = list.find(s => s && s.id === studentGrant.studentId);
      if (found) {
        setSelectedStudent(found);
        setSearchId(found.id);
      }
    } else {
      setSelectedStudent(null);
      setSearchId('');
    }
  }, [initialStudentId, studentGrant]);

  const [activeTab, setActiveTab] = useState<'ALL' | 'DEDUCT' | 'ADD'>('ALL');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Reset page when activeTab or selectedStudent changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedStudent?.id, pageSize]);

  const toggleExpandLog = (logId: string) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const toggleExpandAllLogs = () => {
    if (expandedLogIds.size >= filteredLogs.length && filteredLogs.length > 0) {
      setExpandedLogIds(new Set());
    } else {
      setExpandedLogIds(new Set(filteredLogs.map(l => l.id)));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchId.trim();
    if (!clean) {
      setSelectedStudent(null);
      return;
    }

    // If student view, check if they are trying to search someone they aren't permitted to
    if (isStudentView && studentGrant && studentGrant.studentId !== clean) {
      return;
    }

    if (matchingStudents.length > 0) {
      setSelectedStudent(matchingStudents[0]);
    } else {
      setSelectedStudent(null);
    }
  };

  const handleClearSearch = () => {
    setSearchId('');
    setSelectedStudent(null);
  };

  // Deduplicate and enrich logs with exact running scores to prevent overlapping or missing data
  const studentLogs = useMemo(() => {
    if (!currentStudent) return [];
    
    // Deduplicate by log.id
    const seen = new Set<string>();
    const rawLogs = (conductLogs || []).filter(log => {
      if (!log || log.studentId !== currentStudent.id) return false;
      if (seen.has(log.id)) return false;
      seen.add(log.id);
      return true;
    });

    return computeLogsWithRunningScores(currentStudent, rawLogs, systemSettings?.maxBankedPoints || 50);
  }, [currentStudent, conductLogs, systemSettings?.maxBankedPoints]);

  const filteredLogs = studentLogs.filter(log => {
    if (activeTab === 'ALL') return true;
    return log.type === activeTab;
  });

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const gradeInfo = currentStudent
    ? calculateStudentGrade(currentStudent.entryYear, currentStudent.entryLevel, currentAcademicYear)
    : null;

  const scoreCategory = currentStudent ? getScoreCategory(currentStudent, systemSettings) : null;

  // Real-time calculation of student score if the selected log is deleted
  const deleteSimulatedStudent = useMemo(() => {
    if (!deletingLog || !currentStudent) return null;
    const remainingLogs = studentLogs.filter(l => l.id !== deletingLog.id);
    return recalculateStudentScoresFromLogs(currentStudent, remainingLogs, systemSettings?.maxBankedPoints || 50);
  }, [deletingLog, currentStudent, studentLogs, systemSettings?.maxBankedPoints]);

  const handleConfirmDeleteLog = async () => {
    if (!deletingLog || !currentStudent || !deleteSimulatedStudent || isDeletingLog) return;
    setIsDeletingLog(true);
    try {
      if (onDeleteConductLog) {
        await onDeleteConductLog(deletingLog, deleteSimulatedStudent);
      }
      setDeletingLog(null);
    } catch (err: any) {
      console.error('Error deleting conduct log:', err);
      alert('เกิดข้อผิดพลาดในการลบรายการ: ' + (err.message || 'กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setIsDeletingLog(false);
    }
  };

  const totalDeducted = studentLogs
    .filter(l => l.type === 'DEDUCT')
    .reduce((sum, l) => sum + l.points, 0);

  const totalAdded = studentLogs
    .filter(l => l.type === 'ADD')
    .reduce((sum, l) => sum + l.points, 0);

  const handleBackToTable = () => {
    setSelectedStudent(null);
    setSearchId('');
  };

  return (
    <div className="space-y-5">
      {/* Student Grant Notice if viewing as student */}
      {studentGrant && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-emerald-900">
                เข้าดูข้อมูลผลคะแนนความประพฤติส่วนบุคคล
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                ได้รับอนุญาตจาก: <span className="font-bold">{studentGrant.grantedByName}</span> ({studentGrant.grantedByRole === 'admin' ? 'ผู้ดูแลระบบ' : studentGrant.grantedByRole === 'staff' ? 'เจ้าหน้าที่' : 'ครูผู้สอน'}) • {formatThaiDate(studentGrant.grantedAt, 'short')}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-300">
            รหัส {studentGrant.studentId}
          </span>
        </div>
      )}

      {/* 1. Auto Search Bar Section (Shown only when viewing a student to switch between students) */}
      {!isStudentView && currentStudent && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <form onSubmit={handleSearch} className="relative flex-1 w-full">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="input-student-auto-search"
                  type="text"
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                  placeholder="กรอกรหัสนักเรียน (เช่น 05505) หรือพิมพ์ชื่อ-นามสกุล เพื่อค้นหาอัตโนมัติ..."
                  className="w-full pl-10 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
                  autoComplete="off"
                />
                <div className="absolute right-2.5 flex items-center gap-1.5">
                  {hasSearchQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      title="ล้างคำค้นหา"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <span className="hidden sm:inline text-[11px] font-medium text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                    ค้นหาอัตโนมัติ
                  </span>
                </div>
              </div>
            </form>

            {/* Quick Action Tools for Staff/Admin/Teacher */}
            {(userRole === 'admin' || userRole === 'staff' || userRole === 'teacher') && onOpenAddStudent && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onOpenAddStudent}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-indigo-200"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>เพิ่มนักเรียน</span>
                </button>
              </div>
            )}
          </div>

          {/* Real-time Match Results or Not Found Alert */}
          {hasSearchQuery && (
            <div>
              {hasNoResults ? (
                /* แจ้งเตือนเมื่อไม่พบข้อมูล */
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200">
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-rose-900">
                      ไม่พบข้อมูลนักเรียนที่ตรงกับคำค้นหา: <span className="underline font-mono">"{searchId}"</span>
                    </h4>
                    <p className="text-xs text-rose-700 mt-0.5">
                      กรุณาตรวจสอบความถูกต้องของรหัสประจำตัวนักเรียน (เช่น 05505) หรือชื่อ-นามสกุล และลองใหม่อีกครั้ง
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="px-3 py-1 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    ล้างคำค้นหา
                  </button>
                </div>
              ) : (
                /* แสดงรายการผลการค้นหาแบบสด */
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5 font-bold text-indigo-900">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      พบนักเรียน {matchingStudents.length} คน ที่ตรงกับคำค้นหา
                    </span>
                    <span>คลิกเพื่อดูรายละเอียด</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-100">
                    {matchingStudents.slice(0, 10).map(s => {
                      const isSelected = selectedStudent?.id === s.id;
                      const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
                      const cat = getScoreCategory(s, systemSettings);

                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedStudent(s);
                          }}
                          className={`text-xs px-3 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs ring-2 ring-indigo-200'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-900 shadow-2xs'
                          }`}
                        >
                          <span className={`font-mono font-bold ${isSelected ? 'text-white' : 'text-indigo-600'}`}>
                            {s.id}
                          </span>
                          <span className="truncate max-w-[120px]">
                            {s.title}{s.firstName} {s.lastName}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'}`}>
                            {g.grade}/{s.room}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected 
                              ? 'bg-white text-indigo-900' 
                              : cat.badgeClass
                          }`}>
                            {s.currentScore} แต้ม
                          </span>
                        </button>
                      );
                    })}
                    {matchingStudents.length > 10 && (
                      <span className="text-[11px] text-slate-400 px-2 py-1">
                        + อีก {matchingStudents.length - 10} คน
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {currentStudent && gradeInfo && scoreCategory ? (
        <div className="space-y-5">
          {/* Top Return Navigation Bar */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackToTable}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 font-bold text-xs rounded-xl flex items-center gap-2 border border-indigo-200 transition-colors cursor-pointer shadow-2xs group"
            >
              <ChevronLeft className="w-4 h-4 text-indigo-600 group-hover:-translate-x-0.5 transition-transform" />
              <span>กลับไปตารางรายชื่อและคะแนนล่าสุด</span>
            </button>
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-slate-800">
                {currentStudent.title}{currentStudent.firstName} {currentStudent.lastName}
              </span>
              <span className="text-[11px] text-slate-400 font-mono ml-2">
                รหัส {currentStudent.id} • {gradeInfo.grade}/{currentStudent.room}
              </span>
            </div>
          </div>
          {/* Critical / Warning Alert Bento Box */}
          {scoreCategory.type === 'CRITICAL' ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-950 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-rose-600 text-white rounded-xl flex-shrink-0 animate-pulse">
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-rose-200 text-rose-800 font-bold rounded text-xs">
                      แจ้งเตือนระดับวิกฤต (หักสะสม ≥ {cutoffs.criticalDeductionCutoff} คะแนน)
                    </span>
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-rose-900 mt-1">
                    คะแนนความประพฤติคงเหลือ {currentStudent.currentScore} คะแนน (เกณฑ์วิกฤต ≤ {cutoffs.criticalMaxScoreRemaining})
                  </h3>
                  <p className="text-rose-700 text-xs mt-0.5 leading-relaxed">
                    ต้องประสานงานครูที่ปรึกษา ({advisorDisplaySummary}) และแจ้งผู้ปกครองเพื่อเข้ารับการปรับปรุงพฤติกรรมด่วน
                  </p>
                </div>
              </div>
              {canDeductAndAdd && (
                <button
                  onClick={() => onOpenConductAction(currentStudent, 'ADD')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-2xs text-xs transition-all whitespace-nowrap self-stretch md:self-auto text-center cursor-pointer"
                >
                  บันทึกกิจกรรมเพิ่มคะแนน
                </button>
              )}
            </div>
          ) : scoreCategory.type === 'WATCH' ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-amber-500 text-white rounded-xl flex-shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-800 font-bold rounded text-xs">
                      แจ้งเตือนเฝ้าระวัง (หักสะสม ≥ {cutoffs.watchDeductionCutoff} คะแนน)
                    </span>
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-amber-900 mt-1">
                    คะแนนความประพฤติคงเหลือ {currentStudent.currentScore} คะแนน (เกณฑ์เฝ้าระวัง ≤ {cutoffs.watchMaxScoreRemaining})
                  </h3>
                  <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                    คะแนนลดลงถึงเกณฑ์เฝ้าระวัง แนะนำประสานครูที่ปรึกษา ({advisorDisplaySummary}) และติดตามพฤติกรรม
                  </p>
                </div>
              </div>
              {canDeductAndAdd && (
                <button
                  onClick={() => onOpenConductAction(currentStudent, 'ADD')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-2xs text-xs transition-all whitespace-nowrap self-stretch md:self-auto text-center cursor-pointer"
                >
                  บันทึกกิจกรรมเพิ่มคะแนน
                </button>
              )}
            </div>
          ) : null}

          {/* Bento Grid: Student Profile Card & Transaction History */}
          <div className="grid grid-cols-12 gap-5">
            {/* LEFT BENTO BOX: Student Profile & Scores (Col-span-12 lg:col-span-5) */}
            <div className="col-span-12 lg:col-span-5 space-y-4">
              {/* Profile Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-28 sm:w-28 sm:h-32 bg-slate-100 rounded-2xl overflow-hidden border-2 border-white shadow-xs ring-1 ring-slate-200 flex-shrink-0 relative group">
                    <StudentAvatar
                      student={currentStudent}
                      currentAcademicYear={currentAcademicYear}
                      size="full"
                      fitMode={photoFitMode}
                      canEditPhoto={userRole === 'admin' || userRole === 'staff' || userRole === 'advisor' || userRole === 'teacher'}
                      onUpdatePhoto={onUpdateStudentPhoto}
                    />
                    {currentStudent?.photoUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoFitMode(prev => prev === 'cover' ? 'contain' : 'cover');
                        }}
                        className="absolute bottom-1 right-1 p-1 bg-slate-900/80 hover:bg-slate-900 text-white rounded-md shadow-xs transition-opacity opacity-80 hover:opacity-100 z-10 cursor-pointer"
                        title={photoFitMode === 'cover' ? 'ปรับเป็นพอดีกรอบ (Contain)' : 'ปรับเป็นเต็มกรอบ (Cover)'}
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
                        {currentStudent.id}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${scoreCategory.badgeClass}`}>
                        {scoreCategory.label}
                      </span>
                      {currentStudent.hasNeverBeenDeducted && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-0.5">
                          <ShieldCheck className="w-3 h-3" /> ไม่เคยโดนหัก
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 truncate">
                      {currentStudent.title}{currentStudent.firstName} {currentStudent.lastName}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ชั้น <span className="font-bold text-slate-800">{gradeInfo.grade} ห้อง {currentStudent.room}</span> {currentStudent.number ? `(เลขที่ ${currentStudent.number})` : ''}
                    </p>
                  </div>
                </div>

                {/* Score Tiles */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {/* Current Score Bento Tile */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                    <span className="text-[11px] text-slate-500 font-medium mb-1">คะแนนปัจจุบัน</span>
                    <span className={`text-3xl font-black font-mono ${
                      currentStudent.currentScore <= 50
                        ? 'text-rose-600'
                        : currentStudent.currentScore <= 70
                        ? 'text-amber-600'
                        : 'text-indigo-600'
                    }`}>
                      {currentStudent.currentScore}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">เต็ม 100</span>
                  </div>

                  {/* Status / Banked Points Bento Tile */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                    <span className="text-[11px] text-slate-500 font-medium mb-1">คะแนนสะสมสำรอง</span>
                    <span className="text-3xl font-black font-mono text-emerald-600">
                      +{currentStudent.bankedPoints || 0}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">แต้มสะสมความดี</span>
                  </div>
                </div>

                {/* Detailed Information Rows */}
                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">กลุ่มการศึกษา:</span>
                    <span className="font-medium text-slate-800">
                      {gradeInfo.level === 'JUNIOR' ? 'มัธยมศึกษาตอนต้น' : 'มัธยมศึกษาตอนปลาย'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">ปีที่เข้าศึกษา:</span>
                    <span className="font-medium text-slate-800">
                      {currentStudent.entryYear} ({currentStudent.entryLevel})
                    </span>
                  </div>
                  <div className="flex justify-between items-start text-slate-600">
                    <span className="text-slate-400 flex-shrink-0 pt-0.5">ครูที่ปรึกษา:</span>
                    <div className="text-right space-y-1">
                      {studentAdvisors.length > 0 ? (
                        studentAdvisors.map((adv, idx) => {
                          const order = Number(adv.advisorOrder) || (idx + 1);
                          return (
                            <div key={adv.id || idx} className="flex items-center gap-1.5 justify-end">
                              <span className="font-semibold text-slate-800">{adv.fullName}</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                order === 1
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {order === 1 ? 'ครูที่ปรึกษา 1' : `ครูที่ปรึกษา ${order}`}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <span className="font-medium text-slate-800">
                          {currentStudent.advisorName || 'ยังไม่ได้ระบุ'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Management Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  {canDeductAndAdd && (
                    <>
                      <button
                        onClick={() => onOpenConductAction(currentStudent, 'DEDUCT')}
                        className="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <MinusCircle className="w-4 h-4 text-rose-600" />
                        <span>ตัดคะแนน</span>
                      </button>
                      <button
                        onClick={() => onOpenConductAction(currentStudent, 'ADD')}
                        className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4 text-emerald-600" />
                        <span>เพิ่มคะแนน</span>
                      </button>
                    </>
                  )}

                  {canGrantAccess && (
                    <button
                      onClick={() => onOpenGrantModal(currentStudent)}
                      className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
                      title="ให้สิทธิ์นักเรียนดูคะแนนเฉพาะบุคคล"
                    >
                      <UserCheck className="w-4 h-4 text-indigo-600" />
                    </button>
                  )}

                  {onOpenEditStudent && (userRole === 'admin' || userRole === 'staff' || userRole === 'teacher') && (
                    <button
                      onClick={() => onOpenEditStudent(currentStudent)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
                      title="แก้ไขข้อมูล / รูปถ่ายนักเรียน"
                    >
                      <Edit className="w-4 h-4 text-slate-700" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT BENTO BOX: Conduct History & Activity Log (Col-span-12 lg:col-span-7) */}
            <div className="col-span-12 lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {/* Header & Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-slate-800 text-sm">ประวัติการบันทึกพฤติกรรม</h3>
                    <span className="text-xs text-slate-400">({studentLogs.length} รายการ)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Tab Pills */}
                    <div className="flex p-1 bg-slate-100 rounded-xl text-xs font-medium">
                      <button
                        onClick={() => setActiveTab('ALL')}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          activeTab === 'ALL'
                            ? 'bg-white text-slate-800 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        ทั้งหมด ({studentLogs.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('DEDUCT')}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          activeTab === 'DEDUCT'
                            ? 'bg-white text-rose-700 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        ตัดคะแนน ({studentLogs.filter(l => l.type === 'DEDUCT').length})
                      </button>
                      <button
                        onClick={() => setActiveTab('ADD')}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          activeTab === 'ADD'
                            ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        เพิ่มคะแนน ({studentLogs.filter(l => l.type === 'ADD').length})
                      </button>
                    </div>

                    {filteredLogs.length > 0 && (
                      <button
                        onClick={toggleExpandAllLogs}
                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        title={expandedLogIds.size >= filteredLogs.length ? 'ย่อทั้งหมด' : 'ขยายทั้งหมด'}
                      >
                        {expandedLogIds.size >= filteredLogs.length ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">ย่อ</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">ขยาย</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Table of Conduct Logs */}
                {paginatedLogs.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-700">ไม่พบประวัติพฤติกรรมในหมวดหมู่นี้</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">นักเรียนมีความประพฤติดีเรียบร้อย</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase border-b border-slate-100">
                        <tr>
                          <th className="py-2.5 px-3">วันที่ / เวลา</th>
                          <th className="py-2.5 px-3">ประเภท</th>
                          <th className="py-2.5 px-3">รายการพฤติกรรม / เหตุผล</th>
                          <th className="py-2.5 px-3 text-right">คะแนน</th>
                          <th className="py-2.5 px-3 text-center">คงเหลือ</th>
                          {canManageLogs && (
                            <th className="py-2.5 px-3 text-center w-20">จัดการ</th>
                          )}
                          <th className="py-2.5 px-2 text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedLogs.map(log => {
                          const isDeduct = log.type === 'DEDUCT';
                          const isExpanded = expandedLogIds.has(log.id);

                          return (
                            <React.Fragment key={log.id}>
                              <tr
                                onClick={() => toggleExpandLog(log.id)}
                                className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                                  isExpanded ? 'bg-slate-50/50' : ''
                                }`}
                              >
                                <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-medium">
                                  {formatThaiDate(log.recordedAt, 'short')}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
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
                                <td className="py-2.5 px-3 text-slate-800 max-w-xs truncate font-medium">
                                  {log.reason}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                                  <span className={isDeduct ? 'text-rose-600' : 'text-emerald-600'}>
                                    {isDeduct ? `-${log.points}` : `+${log.points}`}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 whitespace-nowrap">
                                  <span>{log.scoreAfter}</span>
                                  {typeof log.bankedAfter === 'number' && log.bankedAfter > 0 && (
                                    <span className="block text-[10px] text-emerald-600 font-normal">
                                      (+{log.bankedAfter} สำรอง)
                                    </span>
                                  )}
                                </td>
                                {canManageLogs && (
                                  <td className="py-2.5 px-2 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setEditingLog(log)}
                                        className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                        title="แก้ไขข้อมูลพฤติกรรมนี้"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeletingLog(log)}
                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                        title="ลบประวัติพฤติกรรมนี้"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                                <td className="py-2.5 px-2 text-center text-slate-400">
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 mx-auto text-indigo-600" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 mx-auto" />
                                  )}
                                </td>
                              </tr>

                              {/* Expanded Row Details */}
                              {isExpanded && (
                                <tr className="bg-slate-50/80">
                                  <td colSpan={canManageLogs ? 7 : 6} className="p-3 border-t border-slate-100">
                                    <div className="space-y-2.5">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                                        <div>
                                          <span className="text-slate-400 block text-[10px]">ผู้บันทึก:</span>
                                          <span className="font-bold text-slate-800">{log.recordedByName || log.recordedBy}</span>
                                        </div>
                                        <div>
                                          <span className="text-slate-400 block text-[10px]">ผลต่อคะแนน:</span>
                                          <span className="font-bold text-slate-800">
                                            {isDeduct ? `หัก ${log.points} คะแนน` : `เพิ่ม ${log.points} คะแนน`}
                                            {log.bankedPointsDelta !== 0 && ` (สำรอง ${log.bankedPointsDelta > 0 ? `+${log.bankedPointsDelta}` : log.bankedPointsDelta})`}
                                          </span>
                                        </div>
                                      </div>

                                      {log.notes && (
                                        <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 text-[11px] text-amber-900">
                                          <span className="font-bold block mb-0.5">บันทึกเพิ่มเติม / พฤติกรรม:</span>
                                          <p className="leading-relaxed">{log.notes}</p>
                                        </div>
                                      )}

                                      {canManageLogs && (
                                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60" onClick={e => e.stopPropagation()}>
                                          <button
                                            type="button"
                                            onClick={() => setEditingLog(log)}
                                            className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                          >
                                            <Edit className="w-3.5 h-3.5" />
                                            <span>แก้ไขข้อมูล</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setDeletingLog(log)}
                                            className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>ลบประวัตินี้</span>
                                          </button>
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

                {/* Pagination when filtered logs > 20 */}
                {filteredLogs.length > 20 && (
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredLogs.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                    itemLabel="รายการ"
                    className="pt-2"
                  />
                )}
              </div>

              <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span>แสดง {paginatedLogs.length} จากทั้งหมด {filteredLogs.length} รายการ</span>
                <span>รวมหัก -{totalDeducted} แต้ม • รวมเพิ่ม +{totalAdded} แต้ม</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-200">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 flex-wrap">
                    <span>รายชื่อและคะแนนความประพฤตินักเรียน</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      ปรับปรุงคะแนนล่าสุด
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    แสดงข้อมูลนักเรียนเรียงลำดับตามการปรับปรุงหรือบันทึกคะแนนล่าสุด สามารถค้นหา คัดกรองตามระดับ ชั้นเรียน และตรวจสอบคะแนนคงเหลือ
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions & Stats */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                พบ <strong className="text-indigo-700 font-bold">{filteredTableStudents.length}</strong> คน จากทั้งหมด {activeStudents.length} คน
              </span>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="ล้างการค้นหาและตัวกรอง"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>ล้างตัวกรอง</span>
                </button>
              )}

              <button
                type="button"
                onClick={toggleExpandAll}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {expandedTableStudentIds.size >= filteredTableStudents.length && filteredTableStudents.length > 0 ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>พับทั้งหมด</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>กางทั้งหมด</span>
                  </>
                )}
              </button>

              {(userRole === 'admin' || userRole === 'staff' || userRole === 'teacher') && onOpenAddStudent && (
                <button
                  type="button"
                  onClick={onOpenAddStudent}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shadow-indigo-200"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>เพิ่มนักเรียน</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/70">
            {/* 1. Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                placeholder="ค้นหารหัส หรือ ชื่อ-สกุล..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all shadow-2xs"
              />
              {searchId.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchId('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
                  title="ล้างข้อความค้นหา"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 2. Educational Level */}
            <select
              value={levelFilter}
              onChange={e => {
                setLevelFilter(e.target.value as 'ALL' | EducationalLevel);
                setClassroomFilter('ALL');
              }}
              className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
            >
              <option value="ALL">ระดับ: ทุกระดับ (ม.ต้น & ม.ปลาย)</option>
              <option value="JUNIOR">ระดับ: มัธยมตอนต้น (ม.1 - ม.3)</option>
              <option value="SENIOR">ระดับ: มัธยมตอนปลาย (ม.4 - ม.6)</option>
            </select>

            {/* 3. Classroom */}
            <select
              value={classroomFilter}
              onChange={e => setClassroomFilter(e.target.value)}
              className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
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
                {filteredClassroomsList.map(c => (
                  <option key={c.label} value={c.label}>
                    ชั้น {c.label} ({c.count} คน)
                  </option>
                ))}
              </optgroup>
            </select>

            {/* 4. Score Status */}
            <ScoreStatusSelect
              value={scoreStatusFilter}
              onChange={setScoreStatusFilter}
              counts={scoreCountsMap}
            />
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-2xs bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-slate-700 border-collapse">
                <thead className="bg-slate-50 text-[11px] sm:text-xs font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-2 sm:px-3 text-center w-8 sm:w-10">
                      <span className="sr-only">กาง/พับ</span>
                    </th>
                    <th
                      onClick={() => handleTableSort('id')}
                      className="py-3 px-2.5 sm:px-3.5 cursor-pointer hover:bg-slate-100 transition-colors w-24 sm:w-28"
                    >
                      <div className="flex items-center gap-1">
                        <span>รหัส</span>
                        {getSortIcon('id')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleTableSort('name')}
                      className="py-3 px-2.5 sm:px-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>ชื่อ-สกุล</span>
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleTableSort('grade')}
                      className="py-3 px-2 sm:px-3 cursor-pointer hover:bg-slate-100 transition-colors text-center w-20 sm:w-24"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>ชั้น</span>
                        {getSortIcon('grade')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleTableSort('currentScore')}
                      className="py-3 px-2.5 sm:px-3.5 cursor-pointer hover:bg-slate-100 transition-colors text-right w-24 sm:w-28"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>คะแนน</span>
                        {getSortIcon('currentScore')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleTableSort('latestUpdate')}
                      className="py-3 px-2.5 sm:px-3.5 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>ปรับปรุงคะแนนล่าสุด</span>
                        {getSortIcon('latestUpdate')}
                      </div>
                    </th>
                    <th className="py-3 px-2.5 sm:px-3.5 text-center w-28 sm:w-32">
                      <span>บัตรคะแนน</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedTableStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                        <p className="font-bold text-slate-600 text-sm">ไม่พบข้อมูลนักเรียนตามเงื่อนไข</p>
                        <p className="text-xs text-slate-400 mt-1">ลองปรับคำค้นหา หรือเลือกตัวกรองระดับชั้น/สถานะคะแนนใหม่</p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={handleClearAllFilters}
                            className="mt-3 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors cursor-pointer"
                          >
                            ล้างตัวกรองทั้งหมด
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedTableStudents.map(student => {
                      const g = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);
                      const status = getScoreCategory(student, systemSettings);
                      const isCritical = status.type === 'CRITICAL';
                      const isWarning = status.type === 'WATCH' || status.type === 'CAUTION';
                      const isExpanded = expandedTableStudentIds.has(student.id);
                      const latestInfo = studentLatestInfoMap.get(student.id);
                      const latestLog = latestInfo?.latestLog;
                      const sLogs = latestInfo?.logs || [];

                      return (
                        <React.Fragment key={student.id}>
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
                            {/* Chevron */}
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

                            {/* รหัส */}
                            <td className="py-3 px-2.5 sm:px-3.5 font-mono font-bold text-slate-900 text-xs sm:text-sm">
                              <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200 inline-block">
                                {student.id}
                              </span>
                            </td>

                            {/* ชื่อ-สกุล */}
                            <td className="py-3 px-2.5 sm:px-3.5 text-slate-900 font-bold text-xs sm:text-sm">
                              <span className="truncate">
                                {student.title}{student.firstName} {student.lastName}
                              </span>
                              {student.nickname && (
                                <span className="text-slate-400 text-xs font-normal ml-1 hidden sm:inline">
                                  ({student.nickname})
                                </span>
                              )}
                            </td>

                            {/* ชั้น */}
                            <td className="py-3 px-2 sm:px-3 text-center text-xs sm:text-sm">
                              <span className="font-bold text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded-md">
                                {g.grade}/{student.room}
                              </span>
                            </td>

                            {/* คะแนน */}
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

                            {/* ปรับปรุงคะแนนล่าสุด */}
                            <td className="py-3 px-2.5 sm:px-3.5 text-xs">
                              {latestLog ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${
                                    latestLog.type === 'DEDUCT'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-emerald-100 text-emerald-700'
                                  }`}>
                                    {latestLog.type === 'DEDUCT' ? `-${latestLog.points}` : `+${latestLog.points}`}
                                  </span>
                                  <span className="text-slate-400 text-[11px]">
                                    {formatThaiDate(latestLog.recordedAt, 'short')}
                                  </span>
                                  <span className="text-slate-600 truncate max-w-[140px] sm:max-w-[180px]" title={latestLog.reason}>
                                    {latestLog.reason}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-300" />
                                  <span>คะแนนเริ่มต้น (100)</span>
                                </span>
                              )}
                            </td>

                            {/* Action บัตรคะแนน */}
                            <td className="py-3 px-2.5 sm:px-3.5 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStudent(student);
                                }}
                                className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs w-full"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>เปิดบัตรคะแนน</span>
                              </button>
                            </td>
                          </tr>

                          {/* Accordion Row */}
                          {isExpanded && (
                            <tr className="bg-slate-50/95 border-y-2 border-indigo-200/80 animate-in fade-in duration-150">
                              <td colSpan={7} className="p-3.5 sm:p-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                                  {/* Profile Card */}
                                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-start gap-3.5">
                                    <StudentAvatar
                                      student={student}
                                      currentAcademicYear={currentAcademicYear}
                                      size="lg"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
                                          {student.id}
                                        </span>
                                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                          {g.grade}/{student.room} {student.number ? `เลขที่ ${student.number}` : ''}
                                        </span>
                                      </div>
                                      <h4 className="text-sm font-bold text-slate-900 mt-1 truncate">
                                        {student.title}{student.firstName} {student.lastName}
                                      </h4>
                                      <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                                        <div>เข้าเรียนปี {student.entryYear} ({student.entryLevel})</div>
                                        <div className="truncate text-indigo-700 font-medium">
                                          ครูที่ปรึกษา: {getStudentAdvisors(student, advisors, currentAcademicYear).map(a => a.fullName).join(', ') || student.advisorName || '-'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Conduct Score Breakdown */}
                                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-slate-700">ภาพรวมคะแนนความประพฤติ</span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.badgeClass}`}>
                                        {status.shortLabel}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="text-[10px] text-slate-400">คะแนนปัจจุบัน</div>
                                        <div className="text-base font-black text-slate-800 font-mono">
                                          {student.currentScore} <span className="text-[10px] font-normal text-slate-500">/ 100</span>
                                        </div>
                                      </div>
                                      <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <div className="text-[10px] text-emerald-600">คะแนนสำรอง</div>
                                        <div className="text-base font-black text-emerald-700 font-mono">
                                          +{student.bankedPoints ?? 0}
                                        </div>
                                      </div>
                                      <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
                                        <div className="text-[10px] text-rose-600">หักสะสมทั้งหมด</div>
                                        <div className="text-base font-black text-rose-700 font-mono">
                                          -{student.totalDeductedPoints ?? 0}
                                        </div>
                                      </div>
                                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="text-[10px] text-slate-400">โดนหักคะแนน</div>
                                        <div className="text-base font-black text-slate-800 font-mono">
                                          {student.totalDeductionsCount ?? 0} <span className="text-[10px] font-normal text-slate-500">ครั้ง</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Recent Logs & Quick Actions */}
                                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between md:col-span-2 lg:col-span-1 space-y-3">
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-700">ประวัติบันทึกล่าสุด</span>
                                        <span className="text-[10px] text-slate-400">ทั้งหมด {sLogs.length} รายการ</span>
                                      </div>
                                      {sLogs.length === 0 ? (
                                        <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 rounded-xl">
                                          ยังไม่มีประวัติการตัดหรือเพิ่มคะแนน
                                        </div>
                                      ) : (
                                        <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                          {sLogs.slice(0, 3).map(log => (
                                            <div key={log.id} className="text-xs p-1.5 bg-slate-50 rounded-lg flex items-center justify-between gap-2">
                                              <div className="truncate flex-1">
                                                <span className="text-slate-400 text-[10px] mr-1">{formatThaiDate(log.recordedAt, 'short')}:</span>
                                                <span className="text-slate-700 font-medium">{log.reason}</span>
                                              </div>
                                              <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                                                log.type === 'DEDUCT' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                                              }`}>
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
                                        onClick={() => setSelectedStudent(student)}
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

                                      {onOpenEditStudent && (userRole === 'admin' || userRole === 'staff' || userRole === 'teacher') && (
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

            {/* Table Pagination */}
            {filteredTableStudents.length > 0 && (
              <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/50">
                <Pagination
                  currentPage={tablePage}
                  totalItems={filteredTableStudents.length}
                  pageSize={tablePageSize}
                  onPageChange={setTablePage}
                  onPageSizeChange={setTablePageSize}
                  itemLabel="คน"
                />
              </div>
            )}
          </div>
        </div>
      )}
      {/* Edit Conduct Log Modal */}
      {editingLog && currentStudent && (
        <EditConductLogModal
          isOpen={!!editingLog}
          log={editingLog}
          student={currentStudent}
          allStudentLogs={studentLogs}
          currentAcademicYear={currentAcademicYear}
          currentTerm={currentTerm}
          maxBankedPoints={systemSettings?.maxBankedPointsCap ?? systemSettings?.maxBankedPoints ?? 50}
          onClose={() => setEditingLog(null)}
          onSave={async (updatedLog, updatedStudent) => {
            if (onEditConductLog) {
              await onEditConductLog(updatedLog, updatedStudent);
            }
            setEditingLog(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingLog && currentStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl flex-shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-800">
                  ยืนยันการลบรายการพฤติกรรม?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  การลบรายการนี้จะคำนวณและปรับคืนคะแนนความประพฤติของนักเรียนให้โดยอัตโนมัติ
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">นักเรียน:</span>
                <span className="font-bold text-slate-800">
                  {currentStudent.title}{currentStudent.firstName} {currentStudent.lastName} ({currentStudent.id})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ประเภทรายการ:</span>
                <span className={`font-bold ${deletingLog.type === 'DEDUCT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {deletingLog.type === 'DEDUCT' ? `หักคะแนน (-${deletingLog.points})` : `เพิ่มคะแนน (+${deletingLog.points})`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">เหตุผล / พฤติกรรม:</span>
                <span className="font-medium text-slate-800 text-right truncate max-w-[200px]" title={deletingLog.reason}>
                  {deletingLog.reason}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">วันที่บันทึก:</span>
                <span className="text-slate-700">{formatThaiDate(deletingLog.recordedAt, 'short')}</span>
              </div>
              {deleteSimulatedStudent && (
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-semibold">คะแนนคงเหลือหลังลบรายการ:</span>
                  <div className="text-right">
                    <span className="font-mono font-black text-sm text-indigo-600">
                      {deleteSimulatedStudent.currentScore} แต้ม
                    </span>
                    {deleteSimulatedStudent.bankedPoints > 0 && (
                      <span className="text-[10px] text-emerald-600 ml-1 font-bold">
                        (สำรอง +{deleteSimulatedStudent.bankedPoints})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingLog(null)}
                disabled={isDeletingLog}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLog}
                disabled={isDeletingLog}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingLog ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ยืนยันลบรายการ</span>
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

