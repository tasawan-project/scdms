import React, { useState, useMemo } from 'react';
import {
  HomeroomAdvisor,
  Student,
  GradeLevel,
  SystemSettings,
  AppUser,
  ClassroomAdvisorGroup,
  ACADEMIC_DEPARTMENTS
} from '../types';
import { calculateStudentGrade } from '../utils/conductLogic';
import * as XLSX from 'xlsx';
import {
  Users,
  UserCheck,
  UserPlus,
  Upload,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  BookOpen,
  Edit2,
  Trash2,
  Eye,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  ClipboardPaste,
  X,
  Plus,
  GraduationCap,
  Sparkles,
  ChevronRight,
  School,
  Check,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';

interface AdvisorManagementViewProps {
  advisors: HomeroomAdvisor[];
  students: Student[];
  systemSettings: SystemSettings;
  currentUser: AppUser | null;
  onSaveAdvisor: (advisor: HomeroomAdvisor, syncToStudents: boolean) => Promise<void>;
  onBatchSaveAdvisors: (advisors: HomeroomAdvisor[], syncToStudents: boolean) => Promise<{ savedCount: number; syncedStudentsCount: number }>;
  onDeleteAdvisor: (advisorId: string) => Promise<void>;
  onDeleteAllAdvisors?: (clearStudentAdvisorNames: boolean) => Promise<{ deletedAdvisors: number; clearedStudents: number }>;
  onSyncAllAdvisors: () => Promise<number>;
  onSyncClassroom: (gradeLevel: GradeLevel, room: number, advisorName: string) => Promise<number>;
  onSelectStudent?: (studentId: string) => void;
}

const ALL_GRADES: GradeLevel[] = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

export const AdvisorManagementView: React.FC<AdvisorManagementViewProps> = ({
  advisors,
  students,
  systemSettings,
  currentUser,
  onSaveAdvisor,
  onBatchSaveAdvisors,
  onDeleteAdvisor,
  onDeleteAllAdvisors,
  onSyncAllAdvisors,
  onSyncClassroom,
  onSelectStudent
}) => {
  const currentAcademicYear = systemSettings.currentAcademicYear || 2569;
  const isPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'staff' || currentUser?.role === 'teacher';

  // Filters & Views
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<'ALL' | 'JUNIOR' | 'SENIOR' | GradeLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'CLASSROOMS' | 'LIST'>('CLASSROOMS');

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState<boolean>(false);
  const [editingAdvisor, setEditingAdvisor] = useState<HomeroomAdvisor | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [viewingClassGroup, setViewingClassGroup] = useState<ClassroomAdvisorGroup | null>(null);
  const [deletingAdvisorId, setDeletingAdvisorId] = useState<string | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState<boolean>(false);
  const [clearStudentNamesOnDelete, setClearStudentNamesOnDelete] = useState<boolean>(true);
  const [isDeletingAll, setIsDeletingAll] = useState<boolean>(false);

  // Status message / toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Group active students by classroom for the current academic year
  const activeStudents = useMemo(() => {
    return students.filter(s => s.status === 'ACTIVE');
  }, [students]);

  // Compute student grade & classroom mapping
  const studentClassroomMap = useMemo(() => {
    const map = new Map<string, Student[]>();
    activeStudents.forEach(st => {
      const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
      const roomNum = Number(st.room) || 1;
      const key = `${grade}/${roomNum}`;
      const list = map.get(key) || [];
      list.push(st);
      map.set(key, list);
    });
    return map;
  }, [activeStudents, currentAcademicYear]);

  // 2. Discover all distinct classrooms (from students + existing advisors)
  const classroomGroups = useMemo<ClassroomAdvisorGroup[]>(() => {
    const classSet = new Set<string>();

    // Add from students
    studentClassroomMap.forEach((_, key) => classSet.add(key));

    // Add from advisors for current year
    advisors.forEach(a => {
      if (a.academicYear === currentAcademicYear || !a.academicYear) {
        classSet.add(`${a.gradeLevel}/${a.room}`);
      }
    });

    // Fallback standard classrooms if empty
    if (classSet.size === 0) {
      ALL_GRADES.forEach(g => {
        classSet.add(`${g}/1`);
        classSet.add(`${g}/2`);
      });
    }

    const groups: ClassroomAdvisorGroup[] = [];

    classSet.forEach(classKey => {
      const [gradeStr, roomStr] = classKey.split('/');
      const gradeLevel = gradeStr as GradeLevel;
      const room = parseInt(roomStr || '1', 10);

      const matchingAdvisors = advisors.filter(
        a => (a.academicYear === currentAcademicYear || !a.academicYear) &&
             a.gradeLevel === gradeLevel &&
             Number(a.room) === room
      ).sort((a, b) => (a.advisorOrder || 1) - (b.advisorOrder || 1));

      const classStudents = studentClassroomMap.get(classKey) || [];
      const studentCount = classStudents.length;

      let totalScore = 0;
      let criticalCount = 0;
      let watchCount = 0;

      classStudents.forEach(s => {
        const sc = s.currentScore ?? 100;
        totalScore += sc;
        if (sc <= 50) criticalCount++;
        else if (sc <= 70) watchCount++;
      });

      const avgScore = studentCount > 0 ? Math.round((totalScore / studentCount) * 10) / 10 : 100;

      groups.push({
        classroom: classKey,
        gradeLevel,
        room,
        advisors: matchingAdvisors,
        studentCount,
        students: classStudents,
        averageConductScore: avgScore,
        criticalCount,
        watchCount
      });
    });

    // Sort classrooms by grade order, then room number
    return groups.sort((a, b) => {
      const gradeIdxA = ALL_GRADES.indexOf(a.gradeLevel);
      const gradeIdxB = ALL_GRADES.indexOf(b.gradeLevel);
      if (gradeIdxA !== gradeIdxB) return gradeIdxA - gradeIdxB;
      return a.room - b.room;
    });
  }, [studentClassroomMap, advisors, currentAcademicYear]);

  // 3. Filtered Classroom Groups
  const filteredClassroomGroups = useMemo(() => {
    return classroomGroups.filter(g => {
      // Grade filter
      if (selectedGradeFilter === 'JUNIOR') {
        if (!['ม.1', 'ม.2', 'ม.3'].includes(g.gradeLevel)) return false;
      } else if (selectedGradeFilter === 'SENIOR') {
        if (!['ม.4', 'ม.5', 'ม.6'].includes(g.gradeLevel)) return false;
      } else if (selectedGradeFilter !== 'ALL') {
        if (g.gradeLevel !== selectedGradeFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchClass = g.classroom.toLowerCase().includes(q);
        const matchAdvisor = g.advisors.some(
          a => a.fullName.toLowerCase().includes(q) ||
               (a.phone && a.phone.includes(q)) ||
               (a.department && a.department.toLowerCase().includes(q))
        );
        return matchClass || matchAdvisor;
      }

      return true;
    });
  }, [classroomGroups, selectedGradeFilter, searchQuery]);

  // 4. Flat filtered advisors list for table view
  const filteredAdvisorsList = useMemo(() => {
    return advisors.filter(a => {
      if (a.academicYear && a.academicYear !== currentAcademicYear) return false;

      // Grade filter
      if (selectedGradeFilter === 'JUNIOR') {
        if (!['ม.1', 'ม.2', 'ม.3'].includes(a.gradeLevel)) return false;
      } else if (selectedGradeFilter === 'SENIOR') {
        if (!['ม.4', 'ม.5', 'ม.6'].includes(a.gradeLevel)) return false;
      } else if (selectedGradeFilter !== 'ALL') {
        if (a.gradeLevel !== selectedGradeFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = a.fullName.toLowerCase().includes(q) ||
                          a.firstName.toLowerCase().includes(q) ||
                          a.lastName.toLowerCase().includes(q);
        const matchClass = a.classroom.toLowerCase().includes(q);
        const matchPhone = a.phone && a.phone.includes(q);
        const matchDept = a.department && a.department.toLowerCase().includes(q);
        return matchName || matchClass || matchPhone || matchDept;
      }

      return true;
    }).sort((a, b) => {
      const gradeIdxA = ALL_GRADES.indexOf(a.gradeLevel);
      const gradeIdxB = ALL_GRADES.indexOf(b.gradeLevel);
      if (gradeIdxA !== gradeIdxB) return gradeIdxA - gradeIdxB;
      if (a.room !== b.room) return a.room - b.room;
      return (a.advisorOrder || 1) - (b.advisorOrder || 1);
    });
  }, [advisors, currentAcademicYear, selectedGradeFilter, searchQuery]);

  // Overall KPI statistics
  const totalAdvisorsCount = advisors.filter(a => a.academicYear === currentAcademicYear || !a.academicYear).length;
  const totalClassroomsCount = classroomGroups.length;
  const assignedClassroomsCount = classroomGroups.filter(g => g.advisors.length > 0).length;
  const unassignedClassroomsCount = totalClassroomsCount - assignedClassroomsCount;
  const coveredStudentsCount = classroomGroups
    .filter(g => g.advisors.length > 0)
    .reduce((sum, g) => sum + g.studentCount, 0);

  // Sync all handler
  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const updatedCount = await onSyncAllAdvisors();
      showToast(`ซิงค์ข้อมูลครูที่ปรึกษาไปยังนักเรียนทั้งหมดเรียบร้อยแล้ว (${updatedCount} คน)`, 'success');
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาดในการซิงค์ข้อมูล: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync single classroom handler
  const handleSyncClassroom = async (group: ClassroomAdvisorGroup) => {
    if (group.advisors.length === 0) return;
    setIsSyncing(true);
    try {
      const advisorNames = group.advisors.map(a => a.fullName).join(', ');
      const updatedCount = await onSyncClassroom(group.gradeLevel, group.room, advisorNames);
      showToast(`ซิงค์ชื่อครูที่ปรึกษาให้นักเรียนห้อง ${group.classroom} เรียบร้อยแล้ว (${updatedCount} คน)`, 'success');
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาดในการซิงค์: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Export to Excel handler
  const handleExportExcel = () => {
    try {
      const exportRows = classroomGroups.map((g, idx) => {
        const advisor1 = g.advisors[0];
        const advisor2 = g.advisors[1];
        return {
          'ลำดับ': idx + 1,
          'ระดับชั้น': g.gradeLevel,
          'ห้อง': g.room,
          'ห้องเรียน': g.classroom,
          'ครูที่ปรึกษาหลัก (คนที่ 1)': advisor1 ? advisor1.fullName : '-',
          'เบอร์โทร (คนที่ 1)': advisor1?.phone || '-',
          'กลุ่มสาระฯ (คนที่ 1)': advisor1?.department || '-',
          'ครูที่ปรึกษาร่วม (คนที่ 2)': advisor2 ? advisor2.fullName : '-',
          'เบอร์โทร (คนที่ 2)': advisor2?.phone || '-',
          'จำนวนนักเรียน (คน)': g.studentCount,
          'คะแนนเฉลี่ยความประพฤติ': g.averageConductScore,
          'นักเรียนวิกฤต (≤50)': g.criticalCount,
          'นักเรียนเฝ้าระวัง (51-70)': g.watchCount,
          'ปีการศึกษา': currentAcademicYear
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `ครูที่ปรึกษา_${currentAcademicYear}`);
      XLSX.writeFile(wb, `รายชื่อครูที่ปรึกษา_ปีการศึกษา_${currentAcademicYear}.xlsx`);
      showToast('ส่งออกไฟล์ Excel เรียบร้อยแล้ว', 'success');
    } catch (e: any) {
      showToast('ไม่สามารถส่งออกไฟล์ได้: ' + e.message, 'error');
    }
  };

  // Print layout handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 transition-all animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span className="text-sm font-bold">{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-700 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HEADER SECTION */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-xs space-y-5">
        {/* Row 1: Title and Description */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-2xs flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                ทะเบียนครูที่ปรึกษาประจำชั้นเรียน
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                ปีการศึกษา {currentAcademicYear}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              จัดการรายชื่อครูที่ปรึกษา เชื่อมโยงข้อมูลกับห้องเรียนและนักเรียนปัจจุบัน พร้อมตรวจสอบและซิงค์ข้อมูลอัตโนมัติ
            </p>
          </div>
        </div>

        {/* Row 2: Action Buttons Toolbar (Dedicated Line) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {isPrivileged && (
              <>
                <button
                  id="btn-add-advisor"
                  onClick={() => {
                    setEditingAdvisor(null);
                    setIsAddEditModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>เพิ่มครูที่ปรึกษา</span>
                </button>

                <button
                  id="btn-import-advisors"
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>นำเข้า Excel/CSV</span>
                </button>

                <button
                  id="btn-sync-all-advisors"
                  onClick={handleSyncAll}
                  disabled={isSyncing}
                  title="อัปเดตชื่อครูที่ปรึกษาไปยังนักเรียนทุกคนในฐานข้อมูลตามห้องเรียน"
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>ซิงค์ชื่อครูไปยังนักเรียน</span>
                </button>

                {advisors.length > 0 && (
                  <button
                    id="btn-delete-all-advisors"
                    onClick={() => setIsDeleteAllModalOpen(true)}
                    className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="ลบข้อมูลครูประจำชั้นทั้งหมดออกจากระบบเพื่อเพิ่มข้อมูลใหม่ด้วยตนเอง"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>ลบข้อมูลครูทั้งหมด</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="ดาวน์โหลดเป็นไฟล์ Excel"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">ส่งออก Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
              title="พิมพ์เอกสาร"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* KPI METRICS OVERVIEW */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ครูที่ปรึกษาทั้งหมด</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{totalAdvisorsCount}</span>
              <span className="text-xs text-slate-500 font-medium">ท่าน</span>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">ห้องเรียนที่มีครูที่ปรึกษา</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-900">{assignedClassroomsCount}</span>
              <span className="text-xs text-emerald-700 font-medium">/ {totalClassroomsCount} ห้อง</span>
            </div>
          </div>

          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
            <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">ห้องที่ยังไม่มีครู</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-900">{unassignedClassroomsCount}</span>
              <span className="text-xs text-amber-700 font-medium">ห้อง</span>
            </div>
          </div>

          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl">
            <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">นักเรียนในความดูแล</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-900">{coveredStudentsCount}</span>
              <span className="text-xs text-indigo-700 font-medium">/ {activeStudents.length} คน</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FILTER CONTROLS & TAB SWITCHER */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Grade Level Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <button
            onClick={() => setSelectedGradeFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedGradeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด
          </button>

          <button
            onClick={() => setSelectedGradeFilter('JUNIOR')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedGradeFilter === 'JUNIOR'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            ม.ต้น (ม.1 - ม.3)
          </button>

          <button
            onClick={() => setSelectedGradeFilter('SENIOR')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedGradeFilter === 'SENIOR'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            ม.ปลาย (ม.4 - ม.6)
          </button>

          <div className="h-5 w-[1px] bg-slate-200 mx-1 flex-shrink-0" />

          {ALL_GRADES.map(grade => (
            <button
              key={grade}
              onClick={() => setSelectedGradeFilter(grade)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedGradeFilter === grade
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {grade}
            </button>
          ))}
        </div>

        {/* Right: Search Box & View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อครู, ห้อง, เบอร์โทร..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Tab Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 flex-shrink-0">
            <button
              onClick={() => setActiveTab('CLASSROOMS')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'CLASSROOMS'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              แยกตามห้องเรียน
            </button>
            <button
              onClick={() => setActiveTab('LIST')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'LIST'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ตารางรายชื่อ
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: CLASSROOM CARDS GRID (แยกเป็น ห้องเรียน , ระดับชั้น) */}
      {/* ========================================================================= */}
      {activeTab === 'CLASSROOMS' && (
        <div className="space-y-6">
          {filteredClassroomGroups.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">ไม่พบข้อมูลห้องเรียนที่ตรงกับเงื่อนไข</h3>
              <p className="text-xs text-slate-500 mt-1">ลองเปลี่ยนการค้นหาหรือเลือกระดับชั้นอื่น</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClassroomGroups.map(group => {
                const hasAdvisor = group.advisors.length > 0;
                const isJunior = ['ม.1', 'ม.2', 'ม.3'].includes(group.gradeLevel);

                return (
                  <div
                    key={group.classroom}
                    className={`bg-white rounded-3xl border transition-all hover:shadow-md flex flex-col justify-between overflow-hidden ${
                      hasAdvisor
                        ? 'border-slate-200'
                        : 'border-amber-300 bg-amber-50/20'
                    }`}
                  >
                    {/* Card Top Header */}
                    <div className="p-5 border-b border-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-xl text-sm font-black tracking-tight ${
                              isJunior
                                ? 'bg-indigo-600 text-white'
                                : 'bg-purple-600 text-white'
                            }`}
                          >
                            ห้อง {group.classroom}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {isJunior ? 'มัธยมศึกษาตอนต้น' : 'มัธยมศึกษาตอนปลาย'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Student Count Badge */}
                          <button
                            onClick={() => setViewingClassGroup(group)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            title="คลิกเพื่อดูรายชื่อนักเรียนในห้องนี้"
                          >
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            <span>{group.studentCount} คน</span>
                          </button>

                          {/* Quick Icon Button to Add Advisor to This Specific Classroom */}
                          {isPrivileged && (
                            <button
                              id={`btn-add-advisor-${group.gradeLevel}-${group.room}`}
                              onClick={() => {
                                const nextOrder = group.advisors.length > 0 ? group.advisors.length + 1 : 1;
                                setEditingAdvisor({
                                  id: '',
                                  prefix: 'นาย',
                                  firstName: '',
                                  lastName: '',
                                  fullName: '',
                                  gradeLevel: group.gradeLevel,
                                  room: group.room,
                                  classroom: group.classroom,
                                  academicYear: currentAcademicYear,
                                  advisorOrder: nextOrder,
                                  createdAt: new Date().toISOString(),
                                  updatedAt: new Date().toISOString()
                                });
                                setIsAddEditModalOpen(true);
                              }}
                              className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200/80 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
                              title={`เพิ่มครูประจำชั้น ห้อง ${group.classroom}`}
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Advisors List in Card */}
                      <div className="mt-4 space-y-3">
                        {hasAdvisor ? (
                          group.advisors.map((adv, aIdx) => (
                            <div
                              key={adv.id || aIdx}
                              className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 transition-colors flex items-start justify-between gap-3 group"
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                  {adv.firstName ? adv.firstName.charAt(0) : <UserCheck className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900 text-sm truncate">
                                      {adv.fullName}
                                    </span>
                                    {adv.advisorOrder === 1 && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        ครูที่ปรึกษา 1 (ที่ปรึกษาหลัก)
                                      </span>
                                    )}
                                    {adv.advisorOrder === 2 && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                        ครูที่ปรึกษา 2 (ที่ปรึกษาร่วม)
                                      </span>
                                    )}
                                    {(adv.advisorOrder || 1) > 2 && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                        ครูที่ปรึกษา {adv.advisorOrder}
                                      </span>
                                    )}
                                  </div>

                                  {adv.department && (
                                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                      {adv.department}
                                    </p>
                                  )}

                                  {adv.phone && (
                                    <a
                                      href={`tel:${adv.phone}`}
                                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 mt-1 inline-flex"
                                    >
                                      <Phone className="w-3 h-3" />
                                      <span>{adv.phone}</span>
                                    </a>
                                  )}
                                </div>
                              </div>

                              {/* Edit & Delete for Advisor */}
                              {isPrivileged && (
                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 flex-shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingAdvisor(adv);
                                      setIsAddEditModalOpen(true);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                                    title="แก้ไขข้อมูลครูประจำชั้น (บันทึกทับข้อมูลเดิม)"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingAdvisorId(adv.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                                    title="ลบครูประจำชั้น"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-center space-y-2.5">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto" />
                            <p className="text-xs font-bold text-amber-900">ยังไม่ได้ระบุครูประจำชั้นห้องนี้</p>
                            {isPrivileged && (
                              <button
                                onClick={() => {
                                  setEditingAdvisor({
                                    id: '',
                                    prefix: 'นาย',
                                    firstName: '',
                                    lastName: '',
                                    fullName: '',
                                    gradeLevel: group.gradeLevel,
                                    room: group.room,
                                    classroom: group.classroom,
                                    academicYear: currentAcademicYear,
                                    advisorOrder: 1,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString()
                                  });
                                  setIsAddEditModalOpen(true);
                                }}
                                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer hover:scale-105"
                                title={`เพิ่มครูประจำชั้น ห้อง ${group.classroom}`}
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>เพิ่มครูประจำชั้น</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Bottom Stats & Actions */}
                    <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">คะแนนเฉลี่ย</span>
                          <span className="font-black text-slate-800">{group.averageConductScore}</span>
                        </div>

                        {group.criticalCount > 0 && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md font-bold text-[10px]">
                            วิกฤต {group.criticalCount}
                          </span>
                        )}

                        {group.watchCount > 0 && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-md font-bold text-[10px]">
                            เฝ้าระวัง {group.watchCount}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {hasAdvisor && isPrivileged && (
                          <button
                            onClick={() => handleSyncClassroom(group)}
                            disabled={isSyncing}
                            className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="ซิงค์ชื่อครูที่ปรึกษาไปยังนักเรียนในห้องนี้"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>ซิงค์</span>
                          </button>
                        )}

                        <button
                          onClick={() => setViewingClassGroup(group)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-3 h-3" />
                          <span>ดูนักเรียน</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: TABLE DIRECTORY LIST (มุมมองตารางรายการครูที่ปรึกษา) */}
      {/* ========================================================================= */}
      {activeTab === 'LIST' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-xs">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">ลำดับ</th>
                  <th className="py-3.5 px-4">ชื่อ - นามสกุล ครูที่ปรึกษา</th>
                  <th className="py-3.5 px-4">ห้องเรียน</th>
                  <th className="py-3.5 px-4">ระดับชั้น</th>
                  <th className="py-3.5 px-4">หน้าที่</th>
                  <th className="py-3.5 px-4">กลุ่มสาระการเรียนรู้</th>
                  <th className="py-3.5 px-4">เบอร์โทรศัพท์</th>
                  <th className="py-3.5 px-4 text-center">นักเรียนในห้อง</th>
                  {isPrivileged && <th className="py-3.5 px-4 text-center w-28">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAdvisorsList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                          <Users className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-700">ยังไม่มีข้อมูลครูที่ปรึกษา</h4>
                        <p className="text-xs text-slate-500">
                          {searchQuery || selectedGradeFilter !== 'ALL'
                            ? 'ไม่พบข้อมูลครูที่ตรงกับเงื่อนไขการค้นหา'
                            : 'คุณสามารถเริ่มเพิ่มครูประจำชั้นรายบุคคล หรือนำเข้าพร้อมกันด้วยไฟล์ Excel/CSV'}
                        </p>
                        {isPrivileged && !searchQuery && selectedGradeFilter === 'ALL' && (
                          <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                              onClick={() => {
                                setEditingAdvisor(null);
                                setIsAddEditModalOpen(true);
                              }}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              เพิ่มครูที่ปรึกษา
                            </button>
                            <button
                              onClick={() => setIsImportModalOpen(true)}
                              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              นำเข้าไฟล์ Excel/CSV
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAdvisorsList.map((advisor, idx) => {
                    const classKey = `${advisor.gradeLevel}/${advisor.room}`;
                    const classStudents = studentClassroomMap.get(classKey) || [];

                    return (
                      <tr key={advisor.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
                              {advisor.firstName ? advisor.firstName.charAt(0) : 'ค'}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{advisor.fullName}</span>
                              {advisor.email && (
                                <span className="text-[11px] text-slate-400">{advisor.email}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-indigo-700">
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-md">
                            {advisor.classroom || `${advisor.gradeLevel}/${advisor.room}`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{advisor.gradeLevel}</td>
                        <td className="py-3.5 px-4">
                          {(advisor.advisorOrder || 1) === 1 ? (
                            <span className="text-indigo-700 font-bold text-xs bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                              ครูที่ปรึกษา 1 (ที่ปรึกษาหลัก)
                            </span>
                          ) : advisor.advisorOrder === 2 ? (
                            <span className="text-slate-700 font-semibold text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                              ครูที่ปรึกษา 2 (ที่ปรึกษาร่วม)
                            </span>
                          ) : (
                            <span className="text-slate-700 font-semibold text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                              ครูที่ปรึกษา {advisor.advisorOrder}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{advisor.department || '-'}</td>
                        <td className="py-3.5 px-4">
                          {advisor.phone ? (
                            <a
                              href={`tel:${advisor.phone}`}
                              className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{advisor.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-bold text-slate-800">{classStudents.length} คน</span>
                        </td>
                        {isPrivileged && (
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingAdvisor(advisor);
                                  setIsAddEditModalOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="แก้ไข"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingAdvisorId(advisor.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="ลบ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIALOG 1: ADD / EDIT ADVISOR MODAL */}
      {/* ========================================================================= */}
      {isAddEditModalOpen && (
        <AddEditAdvisorModal
          isOpen={isAddEditModalOpen}
          initialAdvisor={editingAdvisor}
          currentAcademicYear={currentAcademicYear}
          onClose={() => {
            setIsAddEditModalOpen(false);
            setEditingAdvisor(null);
          }}
          onSave={async (savedAdvisor, syncToStudents) => {
            await onSaveAdvisor(savedAdvisor, syncToStudents);
            setIsAddEditModalOpen(false);
            setEditingAdvisor(null);
            showToast(`บันทึกข้อมูลครูที่ปรึกษา ${savedAdvisor.fullName} เรียบร้อยแล้ว`, 'success');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* DIALOG 2: IMPORT ADVISORS MODAL (EXCEL / CSV) */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <ImportAdvisorsModal
          isOpen={isImportModalOpen}
          currentAcademicYear={currentAcademicYear}
          existingAdvisors={advisors}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={async (importedAdvisors, syncToStudents) => {
            const res = await onBatchSaveAdvisors(importedAdvisors, syncToStudents);
            setIsImportModalOpen(false);
            showToast(
              `นำเข้าข้อมูลครูที่ปรึกษาสำเร็จ ${res.savedCount} ท่าน (อัปเดตนักเรียน ${res.syncedStudentsCount} คน)`,
              'success'
            );
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* DIALOG 3: VIEW CLASS STUDENTS PREVIEW MODAL */}
      {/* ========================================================================= */}
      {viewingClassGroup && (
        <ViewClassStudentsModal
          group={viewingClassGroup}
          systemSettings={systemSettings}
          onClose={() => setViewingClassGroup(null)}
          onSelectStudent={(studentId) => {
            setViewingClassGroup(null);
            if (onSelectStudent) onSelectStudent(studentId);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* DIALOG 4: DELETE SINGLE ADVISOR MODAL (กล่องยืนยันการลบ) */}
      {/* ========================================================================= */}
      {deletingAdvisorId && (() => {
        const targetAdvisor = advisors.find(a => a.id === deletingAdvisorId);
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-2xs">
                <Trash2 className="w-7 h-7" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  ยืนยันการลบข้อมูลครูประจำชั้น?
                </h3>
                
                {targetAdvisor ? (
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-700 text-left space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{targetAdvisor.fullName}</span>
                      {targetAdvisor.advisorOrder === 1 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          ที่ปรึกษาหลัก
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">
                          คนที่ 2
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600">
                      ห้องเรียน: <span className="font-bold text-indigo-700">{targetAdvisor.classroom || `${targetAdvisor.gradeLevel}/${targetAdvisor.room}`}</span> ({targetAdvisor.gradeLevel})
                    </p>
                    {targetAdvisor.department && (
                      <p className="text-slate-500">กลุ่มสาระฯ: {targetAdvisor.department}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    การลบรายการนี้จะไม่ลบประวัตินักเรียน แต่ห้องเรียนนี้จะไม่มีครูประจำชั้นกำกับ
                  </p>
                )}
                
                <p className="text-[11px] text-rose-600 font-medium">
                  * เมื่อลบแล้ว ข้อมูลครูที่ปรึกษาในห้องนี้จะถูกนำออกจากระบบ
                </p>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingAdvisorId(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const idToDelete = deletingAdvisorId;
                    setDeletingAdvisorId(null);
                    await onDeleteAdvisor(idToDelete);
                    showToast('ลบข้อมูลครูประจำชั้นเรียบร้อยแล้ว', 'success');
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>ยืนยันลบข้อมูล</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* DIALOG 5: DELETE ALL ADVISORS CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  ลบข้อมูลครูประจำชั้นทั้งหมด
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ล้างข้อมูลครูที่ปรึกษาทั้งหมดออกจากฐานข้อมูลเพื่อเริ่มเพิ่มใหม่ด้วยตนเอง
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-2xl text-xs text-rose-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                ข้อมูลครูที่ปรึกษาทั้งหมด ({advisors.length} ท่าน) จะถูกลบถาวร
              </p>
              <p className="text-slate-600 pl-5">
                ระบบจะไม่นำเข้าหรือดึงข้อมูลตัวอย่างมาใช้อีก คุณสามารถเพิ่มข้อมูลครูประจำชั้นด้วยตนเองทีละท่าน หรือนำเข้าจากไฟล์ Excel / CSV ได้ทันที
              </p>
            </div>

            <div className="pt-1">
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  checked={clearStudentNamesOnDelete}
                  onChange={(e) => setClearStudentNamesOnDelete(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800">ล้างชื่อครูที่ปรึกษาในข้อมูลนักเรียนทุกคน</span>
                  <p className="text-slate-500 mt-0.5">
                    รีเซ็ตช่องชื่อครูที่ปรึกษาของนักเรียนเป็นค่าว่างเพื่อรอเชื่อมโยงกับครูชุดใหม่ที่คุณจะเพิ่ม
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                disabled={isDeletingAll}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeletingAll}
                onClick={async () => {
                  setIsDeletingAll(true);
                  try {
                    if (onDeleteAllAdvisors) {
                      const res = await onDeleteAllAdvisors(clearStudentNamesOnDelete);
                      showToast(`ลบข้อมูลครูประจำชั้นทั้งหมดเรียบร้อยแล้ว (${res.deletedAdvisors} ท่าน)`, 'success');
                    }
                    setIsDeleteAllModalOpen(false);
                  } catch (err: any) {
                    showToast('เกิดข้อผิดพลาดในการลบ: ' + err.message, 'error');
                  } finally {
                    setIsDeletingAll(false);
                  }
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingAll ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>ยืนยันลบทั้งหมด</span>
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

// =================================================================================
// SUB-COMPONENT: ADD / EDIT ADVISOR MODAL FORM
// =================================================================================
interface AddEditAdvisorModalProps {
  isOpen: boolean;
  initialAdvisor: HomeroomAdvisor | null;
  currentAcademicYear: number;
  onClose: () => void;
  onSave: (advisor: HomeroomAdvisor, syncToStudents: boolean) => Promise<void>;
}

const AddEditAdvisorModal: React.FC<AddEditAdvisorModalProps> = ({
  isOpen,
  initialAdvisor,
  currentAcademicYear,
  onClose,
  onSave
}) => {
  const isEditing = Boolean(
    initialAdvisor?.id && 
    initialAdvisor.id.trim().length > 0 && 
    initialAdvisor.firstName && 
    initialAdvisor.firstName.trim().length > 0
  );

  const [prefix, setPrefix] = useState<string>(initialAdvisor?.prefix || 'นาย');
  const [firstName, setFirstName] = useState<string>(initialAdvisor?.firstName || '');
  const [lastName, setLastName] = useState<string>(initialAdvisor?.lastName || '');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(initialAdvisor?.gradeLevel || 'ม.1');
  const [room, setRoom] = useState<number>(initialAdvisor?.room || 1);
  const [advisorOrder, setAdvisorOrder] = useState<number>(initialAdvisor?.advisorOrder || 1);
  const [phone, setPhone] = useState<string>(initialAdvisor?.phone || '');
  const [email, setEmail] = useState<string>(initialAdvisor?.email || '');
  
  // Initial department state
  const initialDept = initialAdvisor?.department || '';
  const isKnownDept = (ACADEMIC_DEPARTMENTS as readonly string[]).includes(initialDept);
  const [department, setDepartment] = useState<string>(
    initialDept ? (isKnownDept ? initialDept : 'อื่นๆ') : ''
  );
  const [customDepartment, setCustomDepartment] = useState<string>(
    initialDept && !isKnownDept ? initialDept : ''
  );

  const [notes, setNotes] = useState<string>(initialAdvisor?.notes || '');
  const [syncToStudents, setSyncToStudents] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('กรุณากรอกชื่อและนามสกุลให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const full = `${prefix ? prefix : ''}${firstName.trim()} ${lastName.trim()}`.trim();
      const classroom = `${gradeLevel}/${room}`;
      
      // When editing, keep the exact same ID so it edits in place
      const advisorId = isEditing && initialAdvisor?.id 
        ? initialAdvisor.id 
        : `adv_${currentAcademicYear}_${gradeLevel}_${room}_${Date.now()}`;

      const finalDepartment = department === 'อื่นๆ' 
        ? (customDepartment.trim() || 'อื่นๆ') 
        : (department.trim() || '');

      const updatedAdvisor: HomeroomAdvisor = {
        id: advisorId,
        prefix: prefix.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: full,
        gradeLevel,
        room: Number(room),
        classroom,
        academicYear: currentAcademicYear,
        advisorOrder: Number(advisorOrder),
        phone: phone.trim() || '',
        email: email.trim() || '',
        department: finalDepartment,
        notes: notes.trim() || '',
        createdAt: initialAdvisor?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSave(updatedAdvisor, syncToStudents);
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาด: ' + err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              {isEditing ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {isEditing ? 'แก้ไขข้อมูลครูประจำชั้น' : 'เพิ่มครูประจำชั้นใหม่'}
              </h3>
              <p className="text-xs text-slate-500">ปีการศึกษา {currentAcademicYear}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: คำนำหน้า, ชื่อ, สกุล */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">คำนำหน้า</label>
              <select
                value={prefix}
                onChange={e => setPrefix(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="นาย">นาย</option>
                <option value="นาง">นาง</option>
                <option value="นางสาว">นางสาว</option>
                <option value="ดร.">ดร.</option>
                <option value="ว่าที่ร้อยตรี">ว่าที่ร้อยตรี</option>
                <option value="ครู">ครู</option>
                <option value="">(ไม่มี)</option>
              </select>
            </div>

            <div className="col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อ *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="เช่น สมพร"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">นามสกุล *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="เช่น สอนดี"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Row 2: ระดับชั้น & ห้อง & ลำดับ */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ระดับชั้น *</label>
              <select
                value={gradeLevel}
                onChange={e => setGradeLevel(e.target.value as GradeLevel)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                {ALL_GRADES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ห้อง *</label>
              <input
                type="number"
                min={1}
                max={25}
                required
                value={room}
                onChange={e => setRoom(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">หน้าที่</label>
              <select
                value={advisorOrder}
                onChange={e => setAdvisorOrder(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value={1}>ที่ปรึกษาหลัก (1)</option>
                <option value={2}>ที่ปรึกษาร่วม (2)</option>
              </select>
            </div>
          </div>

          {/* Row 3: กลุ่มสาระการเรียนรู้ (9 กลุ่มสาระ) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">กลุ่มสาระการเรียนรู้</label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="">-- เลือกกลุ่มสาระการเรียนรู้ --</option>
              {ACADEMIC_DEPARTMENTS.map((dept, idx) => (
                <option key={dept} value={dept}>
                  {idx + 1}. {dept}
                </option>
              ))}
            </select>
            {department === 'อื่นๆ' && (
              <input
                type="text"
                placeholder="โปรดระบุกลุ่มสาระหรือฝ่ายงานเพิ่มเติม (ถ้ามี)"
                value={customDepartment}
                onChange={e => setCustomDepartment(e.target.value)}
                className="mt-2 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            )}
          </div>

          {/* Row 4: เบอร์โทร & อีเมล */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เบอร์โทรศัพท์ (ไม่บังคับ/ข้ามได้)</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="เช่น 081-234-5678"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">อีเมล (ข้ามได้ / ไม่จำเป็นต้องใส่)</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ข้ามการใส่อีเมลได้"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-600 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Row 5: หมายเหตุ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">หมายเหตุ (ถ้ามี)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="เช่น หัวหน้าสายชั้น ม.1, ห้องเรียนพิเศษ SMTE"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Sync Checkbox */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center gap-3">
            <input
              type="checkbox"
              id="chk-sync-students"
              checked={syncToStudents}
              onChange={e => setSyncToStudents(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="chk-sync-students" className="text-xs text-indigo-950 font-semibold cursor-pointer">
              อัปเดตชื่อครูที่ปรึกษาไปยังนักเรียนทุกคนในห้อง {gradeLevel}/{room} ทันที
            </label>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <span>{isEditing ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลครู'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =================================================================================
// SUB-COMPONENT: IMPORT ADVISORS MODAL (EXCEL / CSV / PASTE)
// =================================================================================
interface ImportAdvisorsModalProps {
  isOpen: boolean;
  currentAcademicYear: number;
  existingAdvisors: HomeroomAdvisor[];
  onClose: () => void;
  onImportSuccess: (importedAdvisors: HomeroomAdvisor[], syncToStudents: boolean) => Promise<void>;
}

const ImportAdvisorsModal: React.FC<ImportAdvisorsModalProps> = ({
  isOpen,
  currentAcademicYear,
  existingAdvisors,
  onClose,
  onImportSuccess
}) => {
  const [importMode, setImportMode] = useState<'FILE' | 'PASTE'>('FILE');
  const [pasteContent, setPasteContent] = useState<string>('');
  const [parsedAdvisors, setParsedAdvisors] = useState<HomeroomAdvisor[]>([]);
  const [syncToStudents, setSyncToStudents] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  // Process rows from Excel / CSV
  const processRawRows = (rows: any[]) => {
    try {
      const results: HomeroomAdvisor[] = [];
      const nowIso = new Date().toISOString();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // 1. First & Last name
        let prefix = String(row['คำนำหน้า'] || row['คำนำหน้าชื่อ'] || row['prefix'] || '').trim();
        let firstName = String(row['ชื่อ'] || row['firstName'] || row['firstname'] || '').trim();
        let lastName = String(row['สกุล'] || row['นามสกุล'] || row['lastName'] || row['lastname'] || '').trim();

        // Check if combined in "ชื่อ-สกุล"
        const combined = String(row['ชื่อ-นามสกุล'] || row['ชื่อ-สกุล'] || row['fullName'] || row['ชื่อ นามสกุล'] || '').trim();
        if (combined && (!firstName || !lastName)) {
          const parts = combined.split(/\s+/);
          if (parts[0].startsWith('นาย')) {
            prefix = 'นาย';
            firstName = parts[0].replace(/^นาย/, '');
            lastName = parts.slice(1).join(' ');
          } else if (parts[0].startsWith('นางสาว') || parts[0].startsWith('น.ส.')) {
            prefix = 'นางสาว';
            firstName = parts[0].replace(/^(นางสาว|น\.ส\.)/, '');
            lastName = parts.slice(1).join(' ');
          } else if (parts[0].startsWith('นาง')) {
            prefix = 'นาง';
            firstName = parts[0].replace(/^นาง/, '');
            lastName = parts.slice(1).join(' ');
          } else if (parts[0].startsWith('ดร.')) {
            prefix = 'ดร.';
            firstName = parts[0].replace(/^ดร\./, '');
            lastName = parts.slice(1).join(' ');
          } else {
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
          }
        }

        if (!firstName && !lastName) continue;

        // 2. Grade & Room
        const rawClass = String(row['ห้องเรียน'] || row['ชั้นเรียน'] || row['ชั้น/ห้อง'] || row['classroom'] || '').trim();
        let gradeLevel: GradeLevel = 'ม.1';
        let room: number = 1;

        if (rawClass.includes('/')) {
          const [gPart, rPart] = rawClass.split('/');
          if (gPart.includes('1') || gPart === '1' || gPart.includes('ม.1')) gradeLevel = 'ม.1';
          else if (gPart.includes('2') || gPart === '2' || gPart.includes('ม.2')) gradeLevel = 'ม.2';
          else if (gPart.includes('3') || gPart === '3' || gPart.includes('ม.3')) gradeLevel = 'ม.3';
          else if (gPart.includes('4') || gPart === '4' || gPart.includes('ม.4')) gradeLevel = 'ม.4';
          else if (gPart.includes('5') || gPart === '5' || gPart.includes('ม.5')) gradeLevel = 'ม.5';
          else if (gPart.includes('6') || gPart === '6' || gPart.includes('ม.6')) gradeLevel = 'ม.6';
          room = parseInt(rPart || '1', 10) || 1;
        } else {
          const rawGrade = String(row['ระดับชั้น'] || row['ชั้น'] || row['gradeLevel'] || 'ม.1').trim();
          if (rawGrade.includes('1') || rawGrade === 'ม.1') gradeLevel = 'ม.1';
          else if (rawGrade.includes('2') || rawGrade === 'ม.2') gradeLevel = 'ม.2';
          else if (rawGrade.includes('3') || rawGrade === 'ม.3') gradeLevel = 'ม.3';
          else if (rawGrade.includes('4') || rawGrade === 'ม.4') gradeLevel = 'ม.4';
          else if (rawGrade.includes('5') || rawGrade === 'ม.5') gradeLevel = 'ม.5';
          else if (rawGrade.includes('6') || rawGrade === 'ม.6') gradeLevel = 'ม.6';

          const rawRoom = String(row['ห้อง'] || row['room'] || '1').trim();
          room = parseInt(rawRoom, 10) || 1;
        }

        const rawOrder = String(row['ลำดับ'] || row['หน้าที่'] || row['ลำดับที่'] || row['advisorOrder'] || '1').trim();
        const advisorOrder = rawOrder.includes('2') ? 2 : 1;

        const phone = String(row['เบอร์โทร'] || row['เบอร์โทรศัพท์'] || row['phone'] || row['tel'] || '').trim();
        const email = String(row['อีเมล'] || row['email'] || '').trim();
        const department = String(row['กลุ่มสาระ'] || row['กลุ่มสาระการเรียนรู้'] || row['ฝ่ายงาน'] || row['department'] || '').trim();
        const notes = String(row['หมายเหตุ'] || row['notes'] || '').trim();

        const fullName = `${prefix ? prefix : ''}${firstName} ${lastName}`.trim();
        const classroom = `${gradeLevel}/${room}`;
        const id = `adv_${currentAcademicYear}_${gradeLevel}_${room}_${advisorOrder}`;

        results.push({
          id,
          prefix: prefix || '',
          firstName: firstName || 'ครู',
          lastName: lastName || '',
          fullName,
          gradeLevel,
          room,
          classroom,
          academicYear: currentAcademicYear,
          advisorOrder,
          phone: phone || '',
          email: email || '',
          department: department || '',
          notes: notes || '',
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }

      if (results.length === 0) {
        setErrorMsg('ไม่พบข้อมูลครูที่ถูกต้อง กรุณาตรวจสอบหัวคอลัมน์ในไฟล์');
      } else {
        setParsedAdvisors(results);
        setErrorMsg(null);
      }
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาดในการอ่านข้อมูล: ' + err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson = XLSX.utils.sheet_to_json(ws);
        processRawRows(rawJson);
      } catch (err: any) {
        setErrorMsg('ไม่สามารถอ่านไฟล์ได้: ' + err.message);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleParsePaste = () => {
    if (!pasteContent.trim()) {
      setErrorMsg('กรุณาวางข้อความก่อนกดประมวลผล');
      return;
    }

    try {
      const lines = pasteContent.trim().split('\n');
      if (lines.length === 0) return;

      const headers = lines[0].split('\t').map(h => h.trim());
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t').map(c => c.trim());
        if (cols.length === 0 || cols.every(c => !c)) continue;
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = cols[idx] || '';
        });
        rows.push(obj);
      }

      processRawRows(rows);
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาดในการแปลงข้อความ: ' + err.message);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'คำนำหน้า': 'นาย',
        'ชื่อ': 'สมพร',
        'สกุล': 'สอนดี',
        'ระดับชั้น': 'ม.1',
        'ห้อง': 1,
        'หน้าที่': 1,
        'กลุ่มสาระการเรียนรู้': 'ภาษาไทย',
        'เบอร์โทร': '081-234-5678',
        'หมายเหตุ': 'หัวหน้าสายชั้น'
      },
      {
        'คำนำหน้า': 'นางสาว',
        'ชื่อ': 'วิภา',
        'สกุล': 'รัตนพงษ์',
        'ระดับชั้น': 'ม.1',
        'ห้อง': 2,
        'หน้าที่': 1,
        'กลุ่มสาระการเรียนรู้': 'วิทยาศาสตร์',
        'เบอร์โทร': '082-345-6789',
        'หมายเหตุ': ''
      },
      {
        'คำนำหน้า': 'นาย',
        'ชื่อ': 'อนุชา',
        'สกุล': 'กิตติคุณ',
        'ระดับชั้น': 'ม.4',
        'ห้อง': 1,
        'หน้าที่': 1,
        'กลุ่มสาระการเรียนรู้': 'คณิตศาสตร์',
        'เบอร์โทร': '083-456-7890',
        'หมายเหตุ': 'ห้องพิเศษ SMTE'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ตัวอย่างนำเข้าครูที่ปรึกษา');
    XLSX.writeFile(wb, 'แบบฟอร์มนำเข้าครูที่ปรึกษา.xlsx');
  };

  const handleConfirmImport = async () => {
    if (parsedAdvisors.length === 0) return;
    setIsProcessing(true);
    try {
      await onImportSuccess(parsedAdvisors, syncToStudents);
    } catch (e: any) {
      setErrorMsg('เกิดข้อผิดพลาด: ' + e.message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                นำเข้ารายชื่อครูที่ปรึกษา (Excel / CSV)
              </h3>
              <p className="text-xs text-slate-500">ปีการศึกษา {currentAcademicYear}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode Tabs & Template Download */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setImportMode('FILE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  importMode === 'FILE'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>อัปโหลดไฟล์ (.xlsx / .csv)</span>
              </button>
              <button
                type="button"
                onClick={() => setImportMode('PASTE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  importMode === 'PASTE'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>วางตารางข้อความ</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ดาวน์โหลดแบบฟอร์ม</span>
            </button>
          </div>

          {/* File Upload Box */}
          {importMode === 'FILE' ? (
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 rounded-2xl p-6 text-center transition-colors">
              <Upload className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800">
                คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                รองรับไฟล์ Microsoft Excel (.xlsx, .xls) หรือ CSV
              </p>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="mt-4 block mx-auto text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                คัดลอกตารางจาก Excel หรือ Google Sheets แล้วนำมาวางในช่องด้านล่าง (มีหัวคอลัมน์)
              </p>
              <textarea
                rows={5}
                value={pasteContent}
                onChange={e => setPasteContent(e.target.value)}
                placeholder="คำนำหน้า&#9;ชื่อ&#9;สกุล&#9;ระดับชั้น&#9;ห้อง&#9;เบอร์โทร&#10;นาย&#9;สมพร&#9;สอนดี&#9;ม.1&#9;1&#9;0812345678"
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleParsePaste}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                ประมวลผลข้อความที่วาง
              </button>
            </div>
          )}

          {/* Preview Parsed Data */}
          {parsedAdvisors.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800">
                  ตัวอย่างข้อมูลที่ตรวจพบ ({parsedAdvisors.length} รายการ)
                </p>
                <span className="text-[11px] text-emerald-600 font-semibold">
                  ✓ ตรวจสอบรูปแบบถูกต้อง
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">ห้อง</th>
                      <th className="py-2 px-3">ชื่อ - นามสกุล</th>
                      <th className="py-2 px-3">หน้าที่</th>
                      <th className="py-2 px-3">เบอร์โทร</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedAdvisors.map((adv, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-indigo-700">{adv.classroom}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{adv.fullName}</td>
                        <td className="py-2 px-3 text-slate-500">
                          {adv.advisorOrder === 2 ? 'คนที่ 2' : 'ที่ปรึกษาหลัก'}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{adv.phone || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sync Checkbox */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center gap-3">
                <input
                  type="checkbox"
                  id="chk-sync-import-students"
                  checked={syncToStudents}
                  onChange={e => setSyncToStudents(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="chk-sync-import-students" className="text-xs text-indigo-950 font-semibold cursor-pointer">
                  อัปเดตชื่อครูที่ปรึกษาไปยังนักเรียนในห้องที่นำเข้าทันที (อัตโนมัติ)
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={parsedAdvisors.length === 0 || isProcessing}
            onClick={handleConfirmImport}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังนำเข้า...</span>
              </>
            ) : (
              <span>ยืนยันการนำเข้า ({parsedAdvisors.length} รายการ)</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// =================================================================================
// SUB-COMPONENT: VIEW CLASS STUDENTS PREVIEW MODAL
// =================================================================================
interface ViewClassStudentsModalProps {
  group: ClassroomAdvisorGroup;
  systemSettings: SystemSettings;
  onClose: () => void;
  onSelectStudent: (studentId: string) => void;
}

const ViewClassStudentsModal: React.FC<ViewClassStudentsModalProps> = ({
  group,
  systemSettings,
  onClose,
  onSelectStudent
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-indigo-600 text-white rounded-xl font-black text-sm">
                ห้อง {group.classroom}
              </span>
              <h3 className="text-base font-bold text-slate-900">รายชื่อนักเรียนในห้องเรียน</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ครูที่ปรึกษา: {group.advisors.length > 0 ? group.advisors.map(a => a.fullName).join(', ') : 'ยังไม่ระบุ'} • นักเรียน {group.studentCount} คน
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {group.students.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold">ยังไม่มีข้อมูลนักเรียนในห้อง {group.classroom}</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">เลขที่</th>
                    <th className="py-2.5 px-3">รหัสนักเรียน</th>
                    <th className="py-2.5 px-3">ชื่อ - นามสกุล</th>
                    <th className="py-2.5 px-3 text-center">คะแนนคงเหลือ</th>
                    <th className="py-2.5 px-3 text-center">สถานะ</th>
                    <th className="py-2.5 px-3 text-center w-20">ดูข้อมูล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.students.map((st, sIdx) => {
                    const score = st.currentScore ?? 100;
                    const isCritical = score <= 50;
                    const isWatch = score <= 70 && score > 50;

                    return (
                      <tr key={st.id || sIdx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                          {st.number || sIdx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          {st.id}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {st.title}{st.firstName} {st.lastName}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-black px-2 py-0.5 rounded-md ${
                              isCritical
                                ? 'bg-rose-100 text-rose-800'
                                : isWatch
                                ? 'bg-orange-100 text-orange-800'
                                : 'text-slate-800'
                            }`}
                          >
                            {score}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isCritical ? (
                            <span className="px-2 py-0.5 bg-rose-600 text-white rounded-md text-[10px] font-bold">
                              วิกฤต
                            </span>
                          ) : isWatch ? (
                            <span className="px-2 py-0.5 bg-orange-500 text-white rounded-md text-[10px] font-bold">
                              เฝ้าระวัง
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-semibold">
                              ปกติ
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => onSelectStudent(st.id)}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            ตรวจสอบ
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
