import React, { useState, useMemo } from 'react';
import { Dormitory, Student, GradeLevel, StudentGender, AppUser, SystemSettings } from '../types';
import {
  matchStudentToDormitory,
  syncAllStudentsWithDormitories,
  inferStudentGender
} from '../utils/dormitoryLogic';
import { calculateStudentGrade, parseConductCutoffs } from '../utils/conductLogic';
import { StudentAvatar } from './StudentAvatar';
import { Pagination } from './Pagination';
import {
  Building2,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRightLeft,
  CheckSquare,
  Square,
  ChevronRight,
  UserCheck,
  UserX,
  Trash2,
  Loader2,
  ShieldAlert,
  GraduationCap,
  DoorOpen
} from 'lucide-react';

interface DormitoryStudentAssignmentViewProps {
  dormitories: Dormitory[];
  students: Student[];
  currentAcademicYear: number;
  currentUser: AppUser | null;
  systemSettings?: SystemSettings;
  onAssignStudentDormitory?: (studentId: string, dormitoryId?: string, dormitoryName?: string) => Promise<void>;
  onBatchAssignStudentsDormitory?: (studentIds: string[], dormitoryId?: string, dormitoryName?: string) => Promise<number>;
  onClearAllStudentDormitories?: () => Promise<number>;
  onSyncStudentsWithDormitories?: (updatedStudents: Student[]) => Promise<void>;
  onSelectStudent?: (studentId: string) => void;
  onNavigateToTab?: (tab: 'ASSIGN' | 'LIST' | 'TEACHERS') => void;
}

const ALL_GRADES: GradeLevel[] = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
const STANDARD_ROOMS = [1, 2, 3, 4, 5, 6, 7, 8];

export const DormitoryStudentAssignmentView: React.FC<DormitoryStudentAssignmentViewProps> = ({
  dormitories = [],
  students = [],
  currentAcademicYear,
  currentUser,
  systemSettings,
  onAssignStudentDormitory,
  onBatchAssignStudentsDormitory,
  onClearAllStudentDormitories,
  onSyncStudentsWithDormitories,
  onSelectStudent,
  onNavigateToTab
}) => {
  const activeDorms = useMemo(() => {
    return [...dormitories].sort((a, b) => a.dormNumber - b.dormNumber);
  }, [dormitories]);

  // Active students only
  const activeStudents = useMemo(() => {
    return students.filter(s => s.status !== 'INACTIVE' && s.status !== 'GRADUATED');
  }, [students]);

  // Main list toggle: 'UNASSIGNED' (นักเรียนที่ไม่มีหอพัก) vs 'ASSIGNED' (นักเรียนที่มีหอพักแล้ว)
  const [viewScope, setViewScope] = useState<'UNASSIGNED' | 'ASSIGNED'>('UNASSIGNED');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'M' | 'F'>('ALL');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [roomFilter, setRoomFilter] = useState<string>('ALL');
  const [assignedDormFilter, setAssignedDormFilter] = useState<string>('ALL');

  // Selected student IDs for batch movement
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [targetDormId, setTargetDormId] = useState<string>('');

  // Pagination state: 25, 50, 75, 100, ทั้งหมด
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Loading states & notifications
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Single student quick move modal / popup state
  const [quickMoveStudent, setQuickMoveStudent] = useState<Student | null>(null);
  const [quickMoveTargetDormId, setQuickMoveTargetDormId] = useState<string>('');

  // Clear all confirmation modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Calculate stats
  const cutoffs = useMemo(() => parseConductCutoffs(systemSettings), [systemSettings]);

  // Separate unassigned and assigned students
  const { unassignedStudents, assignedStudents, dormStudentCounts } = useMemo(() => {
    const unassigned: {
      student: Student;
      gender: StudentGender;
      grade: GradeLevel;
      room: number;
      recommendedDorm?: Dormitory;
      recommendationReason?: string;
    }[] = [];

    const assigned: {
      student: Student;
      gender: StudentGender;
      grade: GradeLevel;
      room: number;
      dormitory?: Dormitory;
    }[] = [];

    const counts: Record<string, number> = {};
    activeDorms.forEach(d => {
      counts[d.id] = 0;
    });

    activeStudents.forEach(st => {
      const dormExists = activeDorms.some(d => d.id === st.dormitoryId);
      const isAssigned = !!st.dormitoryId && dormExists;

      const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
      const room = st.room;
      const gender = (st.gender as StudentGender) || inferStudentGender(st);

      if (isAssigned) {
        counts[st.dormitoryId!] = (counts[st.dormitoryId!] || 0) + 1;
        const dorm = activeDorms.find(d => d.id === st.dormitoryId);
        assigned.push({ student: st, gender, grade, room, dormitory: dorm });
      } else {
        const matchRes = matchStudentToDormitory(st, activeDorms, currentAcademicYear);
        unassigned.push({
          student: st,
          gender,
          grade,
          room,
          recommendedDorm: matchRes.dormitory || undefined,
          recommendationReason: matchRes.reason
        });
      }
    });

    return {
      unassignedStudents: unassigned,
      assignedStudents: assigned,
      dormStudentCounts: counts
    };
  }, [activeStudents, activeDorms, currentAcademicYear]);

  // Filter unassigned list
  const filteredUnassigned = useMemo(() => {
    return unassignedStudents.filter(item => {
      const { student, gender, grade, room } = item;

      if (genderFilter !== 'ALL' && gender !== genderFilter) return false;
      if (gradeFilter !== 'ALL' && grade !== gradeFilter) return false;
      if (roomFilter !== 'ALL' && String(room) !== roomFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${student.title || ''}${student.firstName} ${student.lastName}`.toLowerCase();
        const id = (student.id || '').toLowerCase();
        if (!fullName.includes(q) && !id.includes(q)) return false;
      }

      return true;
    });
  }, [unassignedStudents, genderFilter, gradeFilter, roomFilter, searchQuery]);

  // Filter assigned list
  const filteredAssigned = useMemo(() => {
    return assignedStudents.filter(item => {
      const { student, gender, grade, room, dormitory } = item;

      if (assignedDormFilter !== 'ALL' && dormitory?.id !== assignedDormFilter) return false;
      if (genderFilter !== 'ALL' && gender !== genderFilter) return false;
      if (gradeFilter !== 'ALL' && grade !== gradeFilter) return false;
      if (roomFilter !== 'ALL' && String(room) !== roomFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${student.title || ''}${student.firstName} ${student.lastName}`.toLowerCase();
        const id = (student.id || '').toLowerCase();
        if (!fullName.includes(q) && !id.includes(q)) return false;
      }

      return true;
    });
  }, [assignedStudents, assignedDormFilter, genderFilter, gradeFilter, roomFilter, searchQuery]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [viewScope, searchQuery, genderFilter, gradeFilter, roomFilter, assignedDormFilter, pageSize]);

  const currentList = viewScope === 'UNASSIGNED' ? filteredUnassigned : filteredAssigned;

  const paginatedList = useMemo(() => {
    if (pageSize >= 999999) return currentList;
    const start = (currentPage - 1) * pageSize;
    return currentList.slice(start, start + pageSize);
  }, [currentList, currentPage, pageSize]);

  // Handle select / unselect all in visible page
  const isAllSelected = useMemo(() => {
    if (paginatedList.length === 0) return false;
    return paginatedList.every(i => selectedStudentIds.includes(i.student.id));
  }, [paginatedList, selectedStudentIds]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const listIds = paginatedList.map(i => i.student.id);
      setSelectedStudentIds(prev => prev.filter(id => !listIds.includes(id)));
    } else {
      const listIds = paginatedList.map(i => i.student.id);
      setSelectedStudentIds(prev => Array.from(new Set([...prev, ...listIds])));
    }
  };

  const toggleSelectOne = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  // Execute Batch Move / Assignment
  const handleBatchMove = async () => {
    if (selectedStudentIds.length === 0) {
      setFeedback({ message: 'กรุณาเลือกนักเรียนอย่างน้อย 1 คน', type: 'error' });
      return;
    }

    if (!targetDormId) {
      setFeedback({ message: 'กรุณาเลือกหอพักปลายทางที่ต้องการย้ายเข้า', type: 'error' });
      return;
    }

    const targetDorm = activeDorms.find(d => d.id === targetDormId);
    if (!targetDorm) {
      setFeedback({ message: 'ไม่พบข้อมูลหอพักปลายทาง', type: 'error' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);

    try {
      if (onBatchAssignStudentsDormitory) {
        await onBatchAssignStudentsDormitory(selectedStudentIds, targetDorm.id, targetDorm.name);
      } else if (onAssignStudentDormitory) {
        for (const sid of selectedStudentIds) {
          await onAssignStudentDormitory(sid, targetDorm.id, targetDorm.name);
        }
      }

      setFeedback({
        message: `ย้ายนักเรียน ${selectedStudentIds.length} คน เข้าสู่ "${targetDorm.name}" เรียบร้อยแล้ว!`,
        type: 'success'
      });
      setSelectedStudentIds([]);
      setTargetDormId('');
    } catch (err: any) {
      setFeedback({
        message: 'เกิดข้อผิดพลาดในการย้ายหอพัก: ' + (err?.message || String(err)),
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick single move
  const handleQuickMoveSubmit = async () => {
    if (!quickMoveStudent || !quickMoveTargetDormId) return;
    const targetDorm = activeDorms.find(d => d.id === quickMoveTargetDormId);
    if (!targetDorm) return;

    setIsProcessing(true);
    try {
      if (onAssignStudentDormitory) {
        await onAssignStudentDormitory(quickMoveStudent.id, targetDorm.id, targetDorm.name);
      }
      setFeedback({
        message: `ย้าย ${quickMoveStudent.title || ''}${quickMoveStudent.firstName} เข้าสู่ "${targetDorm.name}" สำเร็จ`,
        type: 'success'
      });
      setQuickMoveStudent(null);
      setQuickMoveTargetDormId('');
    } catch (err: any) {
      setFeedback({
        message: 'เกิดข้อผิดพลาด: ' + (err?.message || String(err)),
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Release student from dorm back to unassigned list
  const handleReleaseStudent = async (student: Student) => {
    if (!confirm(`คุณต้องการปลด ${student.title || ''}${student.firstName} ${student.lastName} ออกจากหอพักใช่หรือไม่? (จะถูกย้ายกลับมาที่รายการไม่มีหอพัก)`)) {
      return;
    }

    setIsProcessing(true);
    try {
      if (onAssignStudentDormitory) {
        await onAssignStudentDormitory(student.id, undefined, undefined);
      }
      setFeedback({
        message: `ปลดนักเรียนออกจากหอพักเรียบร้อยแล้ว รายชื่อจะปรากฏในหน้านี้`,
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({
        message: 'เกิดข้อผิดพลาด: ' + (err?.message || String(err)),
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto match all unassigned students according to system rules
  const handleAutoMatchAll = async () => {
    if (unassignedStudents.length === 0) {
      setFeedback({ message: 'ไม่มีนักเรียนที่ยังไม่ได้จัดสรรหอพักในระบบ', type: 'error' });
      return;
    }

    if (!confirm(`ระบบจะทำการตรวจสอบเพศ ระดับชั้น และห้องเรียนของนักเรียนที่ยังไม่มีหอพัก ${unassignedStudents.length} คน แล้วจัดสรรเข้าหอพักที่ตรงเกณฑ์โดยอัตโนมัติ ยืนยันหรือไม่?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const syncRes = syncAllStudentsWithDormitories(activeStudents, activeDorms, currentAcademicYear);
      if (onSyncStudentsWithDormitories) {
        await onSyncStudentsWithDormitories(syncRes.updatedStudents);
      }
      setFeedback({
        message: `จัดสรรอัตโนมัติสำเร็จ! จัดเข้าหอพักได้ ${syncRes.assignedCount} คน (คงเหลือยังไม่ตรงเกณฑ์ ${syncRes.unassignedCount} คน)`,
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({
        message: 'เกิดข้อผิดพลาดในการจัดสรรอัตโนมัติ: ' + (err?.message || String(err)),
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear all students from dormitories
  const handleClearAll = async () => {
    if (!onClearAllStudentDormitories) return;
    setIsProcessing(true);
    setShowClearConfirm(false);
    try {
      const count = await onClearAllStudentDormitories();
      setFeedback({
        message: `ปลดนักเรียนทุกคนออกจากหอพักเรียบร้อยแล้ว (${count} คน) นักเรียนทั้งหมดจะมารวมอยู่ที่หน้านี้`,
        type: 'success'
      });
      setSelectedStudentIds([]);
    } catch (err: any) {
      setFeedback({
        message: 'เกิดข้อผิดพลาดในการเคลียร์หอพัก: ' + (err?.message || String(err)),
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Navigation Sub-Tabs */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                <DoorOpen className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  จัดการนักเรียนเข้าหอพัก
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  รายชื่อนักเรียนที่ไม่มีหอพักทั้งหมด เลือกนักเรียนแล้วย้ายเข้าหอพักที่ต้องการได้ทันที
                </p>
              </div>
            </div>
          </div>

          {/* Quick Sub-navigation tabs */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl self-start md:self-auto">
            <button
              type="button"
              className="px-3.5 py-1.5 bg-white text-indigo-700 font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 cursor-default"
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>จัดนักเรียนเข้าหอ</span>
            </button>
            {onNavigateToTab && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateToTab('LIST')}
                  className="px-3.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>รายชื่อหอพัก</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToTab('TEACHERS')}
                  className="px-3.5 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>ครูหอพัก</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 2. Stat Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100">
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-amber-900">ยังไม่มีหอพัก</div>
              <div className="text-xl font-black text-amber-700">
                {unassignedStudents.length} <span className="text-xs font-semibold text-amber-600">คน</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-900">มีหอพักแล้ว</div>
              <div className="text-xl font-black text-emerald-700">
                {assignedStudents.length} <span className="text-xs font-semibold text-emerald-600">คน</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/70 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-indigo-900">จำนวนหอพัก</div>
              <div className="text-xl font-black text-indigo-700">
                {activeDorms.length} <span className="text-xs font-semibold text-indigo-600">หอ</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-700">นักเรียนทั้งหมด</div>
              <div className="text-xl font-black text-slate-900">
                {activeStudents.length} <span className="text-xs font-semibold text-slate-500">คน</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline hover:no-underline cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* 4. Top Action Toolbar: Batch Move Action Bar */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 rounded-3xl shadow-lg border border-indigo-700/50 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/15">
              <ArrowRightLeft className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                <span>เลือกรายชื่อแล้วย้ายเข้าหอพัก</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  เลือกแล้ว {selectedStudentIds.length} คน
                </span>
              </h2>
              <p className="text-xs text-indigo-200">
                เลือกหอพักปลายทางที่ต้องการ แล้วกดปุ่มย้ายเข้าหอพัก ข้อมูลจะอัปเดตทันที
              </p>
            </div>
          </div>

          {/* Quick Buttons: Auto Match & Clear All */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoMatchAll}
              disabled={isProcessing || unassignedStudents.length === 0}
              className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white font-bold rounded-xl text-xs border border-white/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title="จัดสรรเข้าหอพักอัตโนมัติตามเกณฑ์เพศและระดับชั้น"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>จัดสรรอัตโนมัติ</span>
            </button>

            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={isProcessing}
                className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold rounded-xl text-xs border border-rose-400/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                <span>ปลดทุกคนออกจากหอ</span>
              </button>
            )}
          </div>
        </div>

        {/* Move Selector Bar */}
        <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15 backdrop-blur-xs flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:w-auto text-xs font-bold text-indigo-100 flex items-center gap-2 shrink-0">
            <Building2 className="w-4 h-4 text-amber-300" />
            <span>ย้ายไปที่:</span>
          </div>

          <div className="w-full flex-1">
            <select
              value={targetDormId}
              onChange={e => setTargetDormId(e.target.value)}
              className="w-full bg-slate-900/90 text-white border border-indigo-300/40 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-hidden transition-all"
            >
              <option value="" className="bg-slate-900 text-slate-300">
                -- เลือกหอพักปลายทางที่ต้องการย้ายเข้า --
              </option>
              {activeDorms.map(d => {
                const count = dormStudentCounts[d.id] || 0;
                const cap = d.capacity || 80;
                const typeText = d.gender === 'M' ? 'หอชาย' : d.gender === 'F' ? 'หอหญิง' : 'หอรวม';
                return (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    {d.name} ({typeText}) - นักเรียน {count}/{cap} คน
                  </option>
                );
              })}
            </select>
          </div>

          <button
            type="button"
            onClick={handleBatchMove}
            disabled={isProcessing || selectedStudentIds.length === 0 || !targetDormId}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="w-4 h-4" />
            )}
            <span>ย้ายเข้าหอพักที่เลือก ({selectedStudentIds.length})</span>
          </button>
        </div>
      </div>

      {/* 5. Main Content Card with Scope Tabs (ไม่มีหอพัก vs มีหอพักแล้ว) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Scope Switcher Tabs */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setViewScope('UNASSIGNED');
                setSelectedStudentIds([]);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                viewScope === 'UNASSIGNED'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <UserX className="w-4 h-4" />
              <span>รายชื่อที่ไม่มีหอพัก</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  viewScope === 'UNASSIGNED' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-800'
                }`}
              >
                {unassignedStudents.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewScope('ASSIGNED');
                setSelectedStudentIds([]);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                viewScope === 'ASSIGNED'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>รายชื่อที่มีหอพักแล้ว</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  viewScope === 'ASSIGNED' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-800'
                }`}
              >
                {assignedStudents.length}
              </span>
            </button>
          </div>

          {/* Quick select/deselect toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isAllSelected ? (
                <>
                  <Square className="w-3.5 h-3.5 text-indigo-600" />
                  <span>ยกเลิกเลือกทั้งหมด</span>
                </>
              ) : (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                  <span>เลือกทั้งหมดในหน้านี้</span>
                </>
              )}
            </button>

            {selectedStudentIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedStudentIds([])}
                className="px-2.5 py-1.5 text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
              >
                ล้างการเลือก
              </button>
            )}
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อ, นามสกุล หรือรหัสนักเรียน..."
              className="w-full pl-10 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all text-slate-800"
            />
          </div>

          {/* Gender */}
          <div>
            <select
              value={genderFilter}
              onChange={e => setGenderFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all text-slate-800"
            >
              <option value="ALL">ทุกเพศ (ชาย/หญิง)</option>
              <option value="M">เฉพาะนักเรียนชาย</option>
              <option value="F">เฉพาะนักเรียนหญิง</option>
            </select>
          </div>

          {/* Grade Level */}
          <div>
            <select
              value={gradeFilter}
              onChange={e => setGradeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all text-slate-800"
            >
              <option value="ALL">ทุกระดับชั้น (ม.1 - ม.6)</option>
              {ALL_GRADES.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Room / Assigned Dorm Filter */}
          {viewScope === 'UNASSIGNED' ? (
            <div>
              <select
                value={roomFilter}
                onChange={e => setRoomFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all text-slate-800"
              >
                <option value="ALL">ทุกห้องเรียน (1-8)</option>
                {STANDARD_ROOMS.map(r => (
                  <option key={r} value={String(r)}>ห้อง {r}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <select
                value={assignedDormFilter}
                onChange={e => setAssignedDormFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all text-slate-800"
              >
                <option value="ALL">ทุกหอพัก</option>
                {activeDorms.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 6. Students Table / Grid */}
        <div className="overflow-x-auto">
          {viewScope === 'UNASSIGNED' ? (
            filteredUnassigned.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    ไม่พบรายชื่อนักเรียนที่ไม่มีหอพัก
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {unassignedStudents.length === 0
                      ? 'ยอดเยี่ยมมาก! นักเรียนทุกคนในโรงเรียนได้รับการจัดสรรเข้าหอพักเรียบร้อยแล้ว'
                      : 'ไม่พบนักเรียนตามเงื่อนไขการค้นหาหรือตัวกรองที่เลือก'}
                  </p>
                </div>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        aria-label="เลือกทั้งหมด"
                      />
                    </th>
                    <th className="py-3 px-4 w-28">รหัสนักเรียน</th>
                    <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                    <th className="py-3 px-4 w-28">ระดับชั้น/ห้อง</th>
                    <th className="py-3 px-4 w-20">เพศ</th>
                    <th className="py-3 px-4">คำแนะนำหอพักที่ตรงเกณฑ์</th>
                    <th className="py-3 px-4 w-36 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedList.map(item => {
                    const { student, gender, grade, room, recommendedDorm, recommendationReason } = item;
                    const isSelected = selectedStudentIds.includes(student.id);

                    return (
                      <tr
                        key={student.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(student.id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            aria-label={`เลือก ${student.firstName}`}
                          />
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {student.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <StudentAvatar
                              studentId={student.id}
                              photoUrl={student.photoUrl}
                              name={`${student.firstName} ${student.lastName}`}
                              size="sm"
                            />
                            <div>
                              <button
                                type="button"
                                onClick={() => onSelectStudent && onSelectStudent(student.id)}
                                className="font-bold text-slate-900 hover:text-indigo-600 transition-colors text-left cursor-pointer"
                              >
                                {student.title || ''}{student.firstName} {student.lastName}
                              </button>
                              <div className="text-[11px] text-slate-400">
                                คะแนนพฤติกรรม: <span className="font-bold text-slate-700">{student.currentScore ?? 100}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-700">
                            {grade}/{room}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              gender === 'M'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-pink-50 text-pink-700 border border-pink-200'
                            }`}
                          >
                            {gender === 'M' ? 'ชาย' : 'หญิง'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {recommendedDorm ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md font-bold text-[11px] flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                {recommendedDorm.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onAssignStudentDormitory) {
                                    onAssignStudentDormitory(student.id, recommendedDorm.id, recommendedDorm.name);
                                    setFeedback({
                                      message: `ย้าย ${student.title || ''}${student.firstName} เข้าสู่ ${recommendedDorm.name} เรียบร้อยแล้ว`,
                                      type: 'success'
                                    });
                                  }
                                }}
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                              >
                                ย้ายตามคำแนะนำ
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              {recommendationReason || 'ไม่มีคำแนะนำอัตโนมัติ'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setQuickMoveStudent(student);
                              setQuickMoveTargetDormId(recommendedDorm?.id || activeDorms[0]?.id || '');
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[11px] shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <DoorOpen className="w-3.5 h-3.5" />
                            <span>ย้ายเข้าหอ</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            /* ASSIGNED LIST */
            filteredAssigned.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                  <UserX className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    ไม่พบนักเรียนที่มีหอพักตามเงื่อนไข
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    ลองปรับเปลี่ยนตัวกรองหอพัก ระดับชั้น หรือคำค้นหา
                  </p>
                </div>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        aria-label="เลือกทั้งหมด"
                      />
                    </th>
                    <th className="py-3 px-4 w-28">รหัสนักเรียน</th>
                    <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                    <th className="py-3 px-4 w-28">ระดับชั้น/ห้อง</th>
                    <th className="py-3 px-4 w-20">เพศ</th>
                    <th className="py-3 px-4">หอพักปัจจุบัน</th>
                    <th className="py-3 px-4 w-44 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedList.map(item => {
                    const { student, gender, grade, room, dormitory } = item;
                    const isSelected = selectedStudentIds.includes(student.id);

                    return (
                      <tr
                        key={student.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(student.id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            aria-label={`เลือก ${student.firstName}`}
                          />
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {student.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <StudentAvatar
                              studentId={student.id}
                              photoUrl={student.photoUrl}
                              name={`${student.firstName} ${student.lastName}`}
                              size="sm"
                            />
                            <div>
                              <button
                                type="button"
                                onClick={() => onSelectStudent && onSelectStudent(student.id)}
                                className="font-bold text-slate-900 hover:text-indigo-600 transition-colors text-left cursor-pointer"
                              >
                                {student.title || ''}{student.firstName} {student.lastName}
                              </button>
                              <div className="text-[11px] text-slate-400">
                                คะแนนพฤติกรรม: <span className="font-bold text-slate-700">{student.currentScore ?? 100}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-700">
                            {grade}/{room}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              gender === 'M'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-pink-50 text-pink-700 border border-pink-200'
                            }`}
                          >
                            {gender === 'M' ? 'ชาย' : 'หญิง'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg font-bold text-xs flex items-center gap-1.5 w-max">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                            {dormitory?.name || student.dormitoryName || 'ระบุหอพัก'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setQuickMoveStudent(student);
                                setQuickMoveTargetDormId(dormitory?.id || activeDorms[0]?.id || '');
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                              title="เปลี่ยนหอพัก"
                            >
                              เปลี่ยนหอ
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReleaseStudent(student)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                              title="ปลดออกจากหอพัก"
                            >
                              ปลดออก
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* Pagination Component */}
        {currentList.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={currentList.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            pageSizeOptions={[25, 50, 75, 100, 'ALL']}
            itemLabel="คน"
          />
        )}
      </div>

      {/* 7. Modal: Quick Move Single Student */}
      {quickMoveStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DoorOpen className="w-5 h-5 text-amber-300" />
                <h3 className="font-black text-sm">ย้ายนักเรียนเข้าหอพัก</h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickMoveStudent(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
                <StudentAvatar
                  studentId={quickMoveStudent.id}
                  photoUrl={quickMoveStudent.photoUrl}
                  name={`${quickMoveStudent.firstName} ${quickMoveStudent.lastName}`}
                  size="md"
                />
                <div>
                  <div className="font-black text-sm text-slate-900">
                    {quickMoveStudent.title || ''}{quickMoveStudent.firstName} {quickMoveStudent.lastName}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    รหัส {quickMoveStudent.id} | ห้อง {quickMoveStudent.room}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  เลือกหอพักที่ต้องการย้ายเข้า:
                </label>
                <select
                  value={quickMoveTargetDormId}
                  onChange={e => setQuickMoveTargetDormId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 text-slate-800"
                >
                  <option value="" disabled>-- เลือกหอพัก --</option>
                  {activeDorms.map(d => {
                    const count = dormStudentCounts[d.id] || 0;
                    const cap = d.capacity || 80;
                    return (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.gender === 'M' ? 'หอชาย' : d.gender === 'F' ? 'หอหญิง' : 'หอรวม'}) - {count}/{cap} คน
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickMoveStudent(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleQuickMoveSubmit}
                  disabled={isProcessing || !quickMoveTargetDormId}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DoorOpen className="w-3.5 h-3.5" />}
                  <span>ยืนยันย้ายเข้าหอพัก</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Confirmation to Clear All */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-black text-slate-900">
                ยืนยันการปลดนักเรียนทุกคนออกจากหอพัก?
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                การดำเนินการนี้จะลบการผูกหอพักของนักเรียนทุกคนในโรงเรียน ({assignedStudents.length} คน) และนำรายชื่อทั้งหมดกลับมาอยู่ที่หน้านี้เพื่อจัดสรรใหม่อีกครั้ง
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isProcessing}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>ยืนยันปลดทุกคน</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
