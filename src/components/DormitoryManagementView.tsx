import React, { useState, useMemo } from 'react';
import {
  Dormitory,
  Student,
  GradeLevel,
  StudentGender,
  DormitoryType,
  AppUser,
  SystemSettings,
  HomeroomAdvisor
} from '../types';
import {
  DEFAULT_DORMITORIES,
  inferStudentGender,
  matchStudentToDormitory,
  syncAllStudentsWithDormitories,
  isClassroomAssignedToDorm,
  getDormitoryTypeName,
  getDormitoryTypeBadge,
  getDormitorySupervisors,
  formatSupervisorsList,
  getDormitoryRuleSummary,
  getDormitoryGradeGender
} from '../utils/dormitoryLogic';
import { calculateStudentGrade, getScoreCategory, parseConductCutoffs } from '../utils/conductLogic';
import { StudentAvatar } from './StudentAvatar';
import { AddEditDormitoryModal } from './AddEditDormitoryModal';
import {
  Building2,
  Users,
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  Edit,
  Save,
  X,
  Phone,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Printer,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  RotateCcw,
  SlidersHorizontal,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
  Loader2,
  CheckSquare,
  Square
} from 'lucide-react';

interface DormitoryManagementViewProps {
  dormitories: Dormitory[];
  students: Student[];
  currentAcademicYear: number;
  currentUser: AppUser | null;
  systemSettings?: SystemSettings;
  onSaveDormitory: (dorm: Dormitory) => Promise<void>;
  onBatchSaveDormitories: (dorms: Dormitory[]) => Promise<number>;
  onDeleteDormitory?: (dormId: string) => Promise<void>;
  onSyncStudentsWithDormitories: (updatedStudents: Student[]) => Promise<void>;
  onClearAllStudentDormitories?: () => Promise<number>;
  onAssignStudentDormitory?: (studentId: string, dormitoryId?: string, dormitoryName?: string) => Promise<void>;
  onBatchAssignStudentsDormitory?: (studentIds: string[], dormitoryId?: string, dormitoryName?: string) => Promise<number>;
  onResetDefaultDormitories: () => Promise<void>;
  onNavigateToStudentsView?: (dormId?: string) => void;
  homeroomAdvisors?: HomeroomAdvisor[];
  onSelectStudent?: (studentId: string) => void;
  onBackToDashboard?: () => void;
}

const ALL_GRADES: GradeLevel[] = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
const STANDARD_ROOMS = [1, 2, 3, 4, 5, 6, 7, 8];

export const DormitoryManagementView: React.FC<DormitoryManagementViewProps> = ({
  dormitories = [],
  students = [],
  currentAcademicYear,
  currentUser,
  systemSettings,
  onSaveDormitory,
  onBatchSaveDormitories,
  onDeleteDormitory,
  onSyncStudentsWithDormitories,
  onClearAllStudentDormitories,
  onAssignStudentDormitory,
  onBatchAssignStudentsDormitory,
  onResetDefaultDormitories,
  onNavigateToStudentsView,
  homeroomAdvisors = [],
  onSelectStudent,
  onBackToDashboard
}) => {
  const activeDorms = useMemo(() => {
    if (dormitories.length > 0) {
      return [...dormitories].sort((a, b) => a.dormNumber - b.dormNumber);
    }
    return DEFAULT_DORMITORIES;
  }, [dormitories]);

  // Tab filter: ALL | MIXED | MALE | FEMALE | UNASSIGNED
  const [activeTab, setActiveTab] = useState<'ALL' | 'MIXED' | 'MALE' | 'FEMALE' | 'UNASSIGNED'>('ALL');
  const [selectedDormId, setSelectedDormId] = useState<string | null>(null);

  // Modal states for Add / Edit Dormitory
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingDorm, setEditingDorm] = useState<Dormitory | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [batchSelectedStudentIds, setBatchSelectedStudentIds] = useState<string[]>([]);
  const [batchTargetDormId, setBatchTargetDormId] = useState<string>('');
  const [isBatchAssigning, setIsBatchAssigning] = useState(false);

  const [syncFeedback, setSyncFeedback] = useState<{
    assignedCount: number;
    unassignedCount: number;
    message: string;
  } | null>(null);

  // Roster filters inside selected dorm
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [roomFilter, setRoomFilter] = useState<string>('ALL');

  // Cutoffs for score styling
  const cutoffs = useMemo(() => parseConductCutoffs(systemSettings), [systemSettings]);

  // Active students only
  const activeStudents = useMemo(() => {
    return students.filter(s => s.status === 'ACTIVE');
  }, [students]);

  // Compute student counts and occupancy per dormitory
  const dormStats = useMemo(() => {
    const stats: Record<
      string,
      {
        students: Student[];
        count: number;
        avgScore: number;
        criticalCount: number;
        watchCount: number;
        gradeCounts: Record<string, number>;
      }
    > = {};

    activeDorms.forEach(d => {
      stats[d.id] = {
        students: [],
        count: 0,
        avgScore: 100,
        criticalCount: 0,
        watchCount: 0,
        gradeCounts: {}
      };
    });

    const unassigned: {
      student: Student;
      gender: StudentGender;
      grade: GradeLevel;
      room: number;
      reason: string;
    }[] = [];

    activeStudents.forEach(st => {
      // Only count students with an explicit dormitory assignment
      const matchedDormId = st.dormitoryId;

      if (matchedDormId && stats[matchedDormId]) {
        stats[matchedDormId].students.push(st);
        stats[matchedDormId].count++;
        const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
        stats[matchedDormId].gradeCounts[grade] = (stats[matchedDormId].gradeCounts[grade] || 0) + 1;

        if (st.currentScore <= cutoffs.criticalScoreCutoff) {
          stats[matchedDormId].criticalCount++;
        } else if (st.currentScore <= cutoffs.watchScoreCutoff) {
          stats[matchedDormId].watchCount++;
        }
      } else {
        const m = matchStudentToDormitory(st, activeDorms, currentAcademicYear);
        unassigned.push({
          student: st,
          gender: (st.gender as StudentGender) || m.gender,
          grade: m.grade,
          room: m.room,
          reason: st.dormitoryId ? 'หอพักที่ระบุไม่อยู่ในระบบ' : (m.dormitory ? `แนะนำ: ${m.dormitory.name}` : (m.reason || 'ยังไม่ได้กำหนดหอพัก'))
        });
      }
    });

    // Compute averages
    Object.keys(stats).forEach(id => {
      const sList = stats[id].students;
      if (sList.length > 0) {
        const total = sList.reduce((acc, curr) => acc + (curr.currentScore ?? 100), 0);
        stats[id].avgScore = Math.round((total / sList.length) * 10) / 10;
      }
    });

    return {
      byDorm: stats,
      unassigned,
      totalAssigned: activeStudents.length - unassigned.length,
      totalStudents: activeStudents.length
    };
  }, [activeDorms, activeStudents, currentAcademicYear, cutoffs]);

  // Filtered dorms based on tab
  const displayedDorms = useMemo(() => {
    if (activeTab === 'MIXED') {
      return activeDorms.filter(d => d.gender === 'MIXED' || (d.gender as string) === 'ALL');
    }
    if (activeTab === 'MALE') {
      return activeDorms.filter(d => d.gender === 'M');
    }
    if (activeTab === 'FEMALE') {
      return activeDorms.filter(d => d.gender === 'F');
    }
    return activeDorms;
  }, [activeDorms, activeTab]);

  const handleSaveFromModal = async (savedDorm: Dormitory) => {
    setIsSaving(true);
    try {
      await onSaveDormitory(savedDorm);
      const exists = activeDorms.some(d => d.id === savedDorm.id);
      const updatedDorms = exists
        ? activeDorms.map(d => (d.id === savedDorm.id ? savedDorm : d))
        : [...activeDorms, savedDorm];
      const syncRes = syncAllStudentsWithDormitories(
        activeStudents,
        updatedDorms,
        currentAcademicYear
      );
      await onSyncStudentsWithDormitories(syncRes.updatedStudents);
      setIsAddModalOpen(false);
      setEditingDorm(null);
      setSyncFeedback({
        assignedCount: syncRes.assignedCount,
        unassignedCount: syncRes.unassignedCount,
        message: `บันทึกข้อมูลหอพัก "${savedDorm.name}" และผูกนักเรียนเรียบร้อยแล้ว!`
      });
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFromModal = async (dormId: string) => {
    if (!onDeleteDormitory) return;
    setIsSaving(true);
    try {
      await onDeleteDormitory(dormId);
      setIsAddModalOpen(false);
      setEditingDorm(null);
      if (selectedDormId === dormId) {
        setSelectedDormId(null);
      }
      setSyncFeedback({
        assignedCount: 0,
        unassignedCount: 0,
        message: 'ลบหอพักเรียบร้อยแล้ว'
      });
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  // Selected dorm object
  const selectedDorm = useMemo(() => {
    return activeDorms.find(d => d.id === selectedDormId) || null;
  }, [activeDorms, selectedDormId]);

  // Students in selected dorm
  const selectedDormStudents = useMemo(() => {
    if (!selectedDorm) return [];
    const list = dormStats.byDorm[selectedDorm.id]?.students || [];

    return list.filter(st => {
      const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
      if (gradeFilter !== 'ALL' && grade !== gradeFilter) return false;
      if (roomFilter !== 'ALL' && String(st.room) !== roomFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${st.title || ''}${st.firstName} ${st.lastName}`.toLowerCase();
        const idMatch = st.id.toLowerCase().includes(q);
        const nameMatch = fullName.includes(q);
        const phoneMatch = (st.guardianPhone || '').includes(q);
        if (!idMatch && !nameMatch && !phoneMatch) return false;
      }
      return true;
    });
  }, [selectedDorm, dormStats, gradeFilter, roomFilter, searchQuery, currentAcademicYear]);

  // Execute Auto-Linking
  const handleAutoSync = async () => {
    try {
      setIsSyncing(true);
      const result = syncAllStudentsWithDormitories(activeStudents, activeDorms, currentAcademicYear);
      await onSyncStudentsWithDormitories(result.updatedStudents);
      setSyncFeedback({
        assignedCount: result.assignedCount,
        unassignedCount: result.unassignedCount,
        message: `ผูกข้อมูลนักเรียนกับหอพักสำเร็จ! จัดเข้าหอพักได้ ${result.assignedCount} คน (ยังไม่เข้าเกณฑ์ ${result.unassignedCount} คน)`
      });
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการผูกข้อมูล: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // เคลียร์หอพัก - เอานักเรียนออกจากหอพักทั้งหมด
  const handleClearAllDorms = async () => {
    setIsClearing(true);
    try {
      if (onClearAllStudentDormitories) {
        const clearedCount = await onClearAllStudentDormitories();
        setSyncFeedback({
          assignedCount: 0,
          unassignedCount: activeStudents.length,
          message: `เคลียร์หอพักสำเร็จ! ได้ปลดนักเรียนออกจากหอพักทั้งหมด ${clearedCount} คนเรียบร้อยแล้ว เจ้าหน้าที่สามารถจัดการจัดนักเรียนลงหอพักเองได้เลย`
        });
      } else {
        const clearedStudents = activeStudents.map(s => ({
          ...s,
          dormitoryId: undefined,
          dormitoryName: undefined
        }));
        await onSyncStudentsWithDormitories(clearedStudents);
        setSyncFeedback({
          assignedCount: 0,
          unassignedCount: activeStudents.length,
          message: `เคลียร์หอพักสำเร็จ! ได้ปลดนักเรียนออกจากหอพักทั้งหมดเรียบร้อยแล้ว`
        });
      }
      setShowClearConfirmModal(false);
      setBatchSelectedStudentIds([]);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการเคลียร์หอพัก: ' + (err.message || String(err)));
    } finally {
      setIsClearing(false);
    }
  };

  // จัดนักเรียนคนเดียวเข้าหอพัก
  const handleAssignSingleStudent = async (studentId: string, dormId?: string) => {
    try {
      const dorm = dormId ? activeDorms.find(d => d.id === dormId) : undefined;
      if (onAssignStudentDormitory) {
        await onAssignStudentDormitory(studentId, dorm?.id, dorm?.name);
      } else {
        const updated = activeStudents.map(s => (s.id === studentId ? {
          ...s,
          dormitoryId: dorm?.id,
          dormitoryName: dorm?.name
        } : s));
        await onSyncStudentsWithDormitories(updated);
      }
      setSyncFeedback({
        assignedCount: dorm ? dormStats.totalAssigned + 1 : Math.max(0, dormStats.totalAssigned - 1),
        unassignedCount: dorm ? Math.max(0, dormStats.unassigned.length - 1) : dormStats.unassigned.length + 1,
        message: dorm ? `จัดนักเรียนเข้า "${dorm.name}" สำเร็จ` : `ปลดนักเรียนออกจากหอพักเรียบร้อย`
      });
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + (err.message || String(err)));
    }
  };

  // จัดนักเรียนหลายคนเข้าหอพักพร้อมกัน
  const handleBatchAssignStudents = async () => {
    if (batchSelectedStudentIds.length === 0) return;
    setIsBatchAssigning(true);
    try {
      const dorm = batchTargetDormId ? activeDorms.find(d => d.id === batchTargetDormId) : undefined;
      if (onBatchAssignStudentsDormitory) {
        await onBatchAssignStudentsDormitory(batchSelectedStudentIds, dorm?.id, dorm?.name);
      } else {
        const updated = activeStudents.map(s => {
          if (batchSelectedStudentIds.includes(s.id)) {
            return {
              ...s,
              dormitoryId: dorm?.id,
              dormitoryName: dorm?.name
            };
          }
          return s;
        });
        await onSyncStudentsWithDormitories(updated);
      }
      setSyncFeedback({
        assignedCount: dorm ? dormStats.totalAssigned + batchSelectedStudentIds.length : dormStats.totalAssigned,
        unassignedCount: dorm ? Math.max(0, dormStats.unassigned.length - batchSelectedStudentIds.length) : dormStats.unassigned.length,
        message: dorm
          ? `จัดนักเรียน ${batchSelectedStudentIds.length} คน เข้า "${dorm.name}" สำเร็จเรียบร้อย`
          : `ปลดนักเรียน ${batchSelectedStudentIds.length} คน ออกจากหอพักเรียบร้อย`
      });
      setBatchSelectedStudentIds([]);
      setBatchTargetDormId('');
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + (err.message || String(err)));
    } finally {
      setIsBatchAssigning(false);
    }
  };

  // ปลดนักเรียนทั้งหมดในหอพักนี้
  const handleClearSpecificDorm = async (dorm: Dormitory) => {
    const studentsInDorm = activeStudents.filter(s => s.dormitoryId === dorm.id);
    if (studentsInDorm.length === 0) {
      alert(`ไม่มีนักเรียนสังกัดใน ${dorm.name}`);
      return;
    }
    if (!window.confirm(`ต้องการปลดนักเรียนทั้งหมดใน "${dorm.name}" จำนวน ${studentsInDorm.length} คน ออกจากหอพักใช่หรือไม่?`)) {
      return;
    }
    setIsClearing(true);
    try {
      if (onBatchAssignStudentsDormitory) {
        await onBatchAssignStudentsDormitory(studentsInDorm.map(s => s.id), undefined, undefined);
      } else {
        const updated = activeStudents.map(s => s.dormitoryId === dorm.id ? {
          ...s,
          dormitoryId: undefined,
          dormitoryName: undefined
        } : s);
        await onSyncStudentsWithDormitories(updated);
      }
      setSyncFeedback({
        assignedCount: Math.max(0, dormStats.totalAssigned - studentsInDorm.length),
        unassignedCount: dormStats.unassigned.length + studentsInDorm.length,
        message: `ปลดนักเรียนออกจาก "${dorm.name}" (${studentsInDorm.length} คน) เรียบร้อยแล้ว`
      });
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + (err.message || String(err)));
    } finally {
      setIsClearing(false);
    }
  };

  // Reset to default dorms
  const handleResetDefaults = async () => {
    if (
      window.confirm(
        'ต้องการรีเซ็ตการตั้งค่าหอพัก 1 - 6 เป็นค่าเริ่มต้นของโรงเรียนหรือไม่? (หอ 1-3 ชาย, หอ 4-6 หญิง)'
      )
    ) {
      setIsSaving(true);
      try {
        await onResetDefaultDormitories();
      } catch (err: any) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Print Roster
  const handlePrintRoster = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-6 select-none">
      {/* 1. Header Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  จัดการหอพักนักเรียน (หอ 1 - 6)
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  แยกชาย (M) / หญิง (F)
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  ปีการศึกษา {currentAcademicYear}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                ระบบจัดการหอพักนักเรียน 6 หอพัก อ้างอิงจากระดับชั้น (ม.1 - ม.6) ห้องเรียน และเพศ
              </p>
            </div>
          </div>

          {onBackToDashboard && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onBackToDashboard}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>กลับแดชบอร์ด</span>
              </button>
            </div>
          )}
        </div>

        {/* แถบเครื่องมือจัดการหอพัก (บรรทัดใหม่) */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* ปุ่มเพิ่มหอพักใหม่ */}
            <button
              type="button"
              id="btn-add-dormitory"
              onClick={() => {
                setEditingDorm(null);
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-2"
              title="สร้างหอพักใหม่ (หอพักรวม / ชาย / หญิง พร้อมครูผู้ดูแล)"
            >
              <Plus className="w-4 h-4" />
              <span>+ เพิ่มหอพัก</span>
            </button>

            {/* ปุ่มเปิดหน้ารายชื่อนักเรียนในหอพัก */}
            {onNavigateToStudentsView && (
              <button
                type="button"
                id="btn-view-dormitory-students"
                onClick={() => onNavigateToStudentsView(selectedDormId || undefined)}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all cursor-pointer flex items-center gap-2"
                title="เปิดหน้าแสดงรายชื่อนักเรียนในหอพักทั้งหมดพร้อมค้นหาและส่งออก CSV"
              >
                <Users className="w-4 h-4" />
                <span>รายชื่อนักเรียนในหอพัก</span>
              </button>
            )}

            {/* ปุ่มเคลียร์หอพัก - เอานักเรียนออกจากหอพักทั้งหมด */}
            <button
              type="button"
              id="btn-clear-all-dormitories"
              onClick={() => setShowClearConfirmModal(true)}
              disabled={isClearing || isSyncing}
              className="px-3.5 py-2 text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-2xs disabled:opacity-50"
              title="เอานักเรียนออกจากหอพักทั้งหมด เพื่อที่เจ้าหน้าที่จะทำการจัดการนักเรียนลงหอพักเอง"
            >
              <UserMinus className="w-4 h-4 text-rose-600" />
              <span>เคลียร์หอพัก (เอาออกทั้งหมด)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* ปุ่มพิมพ์รายชื่อ */}
            <button
              type="button"
              onClick={handlePrintRoster}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์รายชื่อ</span>
            </button>
          </div>
        </div>

        {/* Sync feedback notification */}
        {syncFeedback && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between text-xs sm:text-sm animate-fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-medium">{syncFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncFeedback(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. Quick Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 mt-5 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              หอพักทั้งหมด
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {activeDorms.length} <span className="text-xs font-normal text-slate-500">หอพัก</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-purple-700 font-bold">รวม {activeDorms.filter(d => d.gender === 'MIXED' || (d.gender as string) === 'ALL').length}</span>
              <span>•</span>
              <span className="text-indigo-600 font-bold">ชาย {activeDorms.filter(d => d.gender === 'M').length}</span>
              <span>•</span>
              <span className="text-rose-600 font-bold">หญิง {activeDorms.filter(d => d.gender === 'F').length}</span>
            </div>
          </div>

          <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100">
            <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
              นักเรียนที่จัดหอพักแล้ว
            </div>
            <div className="text-xl font-black text-indigo-950 mt-0.5">
              {dormStats.totalAssigned}{' '}
              <span className="text-xs font-normal text-indigo-600">
                / {dormStats.totalStudents} คน
              </span>
            </div>
            <div className="text-[11px] text-indigo-700 mt-1 font-medium">
              คิดเป็น{' '}
              {dormStats.totalStudents > 0
                ? Math.round((dormStats.totalAssigned / dormStats.totalStudents) * 100)
                : 100}
              % ของนักเรียนทั้งหมด
            </div>
          </div>

          <div
            onClick={() => setActiveTab('UNASSIGNED')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              dormStats.unassigned.length > 0
                ? 'bg-amber-50/80 border-amber-200 hover:bg-amber-100/70'
                : 'bg-slate-50/80 border-slate-100'
            }`}
          >
            <div
              className={`text-[11px] font-bold uppercase tracking-wider ${
                dormStats.unassigned.length > 0 ? 'text-amber-800' : 'text-slate-500'
              }`}
            >
              ยังไม่ตรงเงื่อนไขหอ
            </div>
            <div
              className={`text-xl font-black mt-0.5 ${
                dormStats.unassigned.length > 0 ? 'text-amber-900' : 'text-slate-900'
              }`}
            >
              {dormStats.unassigned.length}{' '}
              <span className="text-xs font-normal text-slate-500">คน</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {dormStats.unassigned.length > 0 ? 'คลิกเพื่อตรวจสอบรายชื่อ' : 'จัดครบถ้วนทุกคน'}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ความจุรวม
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {activeDorms.reduce((sum, d) => sum + (d.capacity || 80), 0)}{' '}
              <span className="text-xs font-normal text-slate-500">เตียง</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">เฉลี่ย 80 คน/หอพัก</div>
          </div>
        </div>
      </div>

      {/* 3. Dormitory Tabs Filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-2xl text-xs font-bold flex-wrap">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ALL');
              setSelectedDormId(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            หอพักทั้งหมด ({activeDorms.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('MIXED');
              setSelectedDormId(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'MIXED'
                ? 'bg-purple-600 text-white shadow-xs font-black'
                : 'text-purple-800 hover:text-purple-950'
            }`}
          >
            <span>⚥ หอพักรวม (M)(F) ({activeDorms.filter(d => d.gender === 'MIXED' || (d.gender as string) === 'ALL').length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('MALE');
              setSelectedDormId(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'MALE'
                ? 'bg-indigo-600 text-white shadow-xs font-black'
                : 'text-indigo-800 hover:text-indigo-950'
            }`}
          >
            <span>♂ หอพักชาย (M) ({activeDorms.filter(d => d.gender === 'M').length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('FEMALE');
              setSelectedDormId(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'FEMALE'
                ? 'bg-rose-600 text-white shadow-xs font-black'
                : 'text-rose-800 hover:text-rose-950'
            }`}
          >
            <span>♀ หอพักหญิง (F) ({activeDorms.filter(d => d.gender === 'F').length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('UNASSIGNED');
              setSelectedDormId(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'UNASSIGNED'
                ? 'bg-amber-500 text-white shadow-xs font-black'
                : 'text-amber-800 hover:text-amber-950'
            }`}
          >
            <span>นักเรียนยังไม่มีหอ ({dormStats.unassigned.length})</span>
          </button>
        </div>

        {selectedDorm && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">กำลังดู:</span>
            <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl">
              {selectedDorm.name}
            </span>
            <button
              type="button"
              onClick={() => setSelectedDormId(null)}
              className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              ดูการ์ดทั้งหมด
            </button>
          </div>
        )}
      </div>

      {/* 4. Tab: UNASSIGNED STUDENTS VIEW */}
      {activeTab === 'UNASSIGNED' ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>รายชื่อนักเรียนที่ยังไม่มีหอพัก ({dormStats.unassigned.length} คน)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                เจ้าหน้าที่สามารถเลือกนักเรียนและจัดเข้าหอพักที่ต้องการได้ทันที โดยเลือกทีละคน หรือเลือกหลายคนเพื่อจัดเข้าหอพักพร้อมกัน
              </p>
            </div>

            {/* Batch Assign Toolbar */}
            {batchSelectedStudentIds.length > 0 && (
              <div className="flex items-center gap-2 p-2 bg-indigo-50 border border-indigo-200 rounded-2xl animate-fade-in flex-wrap">
                <span className="text-xs font-black text-indigo-900 px-2">
                  เลือก {batchSelectedStudentIds.length} คน
                </span>
                <select
                  value={batchTargetDormId}
                  onChange={e => setBatchTargetDormId(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- เลือกหอพักปลายทาง --</option>
                  {activeDorms.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({getDormitoryTypeBadge(d.gender).shortLabel})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleBatchAssignStudents}
                  disabled={!batchTargetDormId || isBatchAssigning}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isBatchAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>จัดเข้าหอพัก</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchSelectedStudentIds([])}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  title="ยกเลิกการเลือก"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {dormStats.unassigned.length === 0 ? (
            <div className="p-8 text-center bg-emerald-50/60 rounded-2xl border border-emerald-100">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <div className="text-sm font-bold text-emerald-900">
                นักเรียนทุกคนถูกผูกเข้าหอพักครบถ้วนแล้ว!
              </div>
              <p className="text-xs text-emerald-700 mt-1">
                ไม่มีนักเรียนที่ตกค้างหรือไม่มีหอพัก
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          dormStats.unassigned.length > 0 &&
                          batchSelectedStudentIds.length === dormStats.unassigned.length
                        }
                        onChange={e => {
                          if (e.target.checked) {
                            setBatchSelectedStudentIds(dormStats.unassigned.map(u => u.student.id));
                          } else {
                            setBatchSelectedStudentIds([]);
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">รหัสนักเรียน</th>
                    <th className="py-2.5 px-3">ชื่อ - สกุล</th>
                    <th className="py-2.5 px-3 text-center">เพศ (M/F)</th>
                    <th className="py-2.5 px-3 text-center">ระดับชั้น/ห้อง</th>
                    <th className="py-2.5 px-3">สถานะ / คำแนะนำ</th>
                    <th className="py-2.5 px-3 text-center">จัดเข้าหอพักทันที</th>
                    <th className="py-2.5 px-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {dormStats.unassigned.map(({ student, gender, grade, room, reason }) => {
                    const isSelected = batchSelectedStudentIds.includes(student.id);

                    return (
                      <tr
                        key={student.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelected ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => {
                              if (e.target.checked) {
                                setBatchSelectedStudentIds(prev => [...prev, student.id]);
                              } else {
                                setBatchSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          {student.id}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <StudentAvatar
                              student={student}
                              photoUrl={student.photoUrl}
                              gender={student.gender || gender}
                              size="sm"
                            />
                            <span>
                              {student.title || ''}{student.firstName} {student.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              gender === 'M'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {gender === 'M' ? '♂ ชาย (M)' : '♀ หญิง (F)'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {grade} / ห้อง {room}
                        </td>
                        <td className="py-2.5 px-3 text-amber-700 font-normal">
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md text-[11px]">
                            {reason}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <select
                            defaultValue=""
                            onChange={e => {
                              if (e.target.value) {
                                handleAssignSingleStudent(student.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-indigo-700 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                          >
                            <option value="">+ จัดเข้าหอพัก...</option>
                            {activeDorms.map(d => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({getDormitoryTypeBadge(d.gender).shortLabel})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {onSelectStudent && (
                            <button
                              type="button"
                              onClick={() => onSelectStudent(student.id)}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                            >
                              ดูโปรไฟล์
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* 5. DORMITORY CARDS GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedDorms.map(dorm => {
            const stats = dormStats.byDorm[dorm.id] || {
              students: [],
              count: 0,
              avgScore: 100,
              criticalCount: 0,
              watchCount: 0,
              gradeCounts: {}
            };
            const isMixed = dorm.gender === 'MIXED' || (dorm.gender as string) === 'ALL';
            const isMale = dorm.gender === 'M';
            const isFemale = dorm.gender === 'F';
            const capacity = dorm.capacity || 80;
            const occupancyPct = Math.min(100, Math.round((stats.count / capacity) * 100));
            const isSelected = selectedDormId === dorm.id;
            const supervisors = getDormitorySupervisors(dorm);

            return (
              <div
                key={dorm.id}
                className={`bg-white border rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-200'
                    : isMixed
                    ? 'border-purple-200 hover:border-purple-300'
                    : isMale
                    ? 'border-indigo-100 hover:border-indigo-300'
                    : 'border-rose-100 hover:border-rose-300'
                }`}
              >
                <div>
                  {/* Card Header: Dorm Number + Type Badge + Edit button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-xs ${
                          isMixed
                            ? 'bg-gradient-to-br from-purple-600 to-indigo-700'
                            : isMale
                            ? 'bg-gradient-to-br from-indigo-600 to-indigo-800'
                            : 'bg-gradient-to-br from-rose-500 to-rose-700'
                        }`}
                      >
                        {dorm.dormNumber}
                      </div>
                      <div>
                        <h3 className="font-black text-base text-slate-900 leading-tight">
                          {dorm.name}
                        </h3>
                        <span className="text-[11px] text-slate-500">
                          {getDormitoryTypeName(dorm.gender)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1 border ${
                          isMixed
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : isMale
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {getDormitoryTypeBadge(dorm.gender).shortLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDorm(dorm);
                          setIsAddModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="แก้ไขการตั้งค่าหอพัก"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Assigned Levels, Genders and Rooms */}
                  <div className="mt-4 p-3 bg-slate-50/90 rounded-2xl border border-slate-100 space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                      <span>เกณฑ์ระดับชั้นและเพศ:</span>
                      <span className="font-mono text-slate-600">
                        {dorm.assignedGrades.join(', ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {dorm.assignedGrades.map(g => {
                        const gradeGender = getDormitoryGradeGender(dorm, g);
                        return (
                          <span
                            key={g}
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border shadow-2xs flex items-center gap-1 ${
                              gradeGender === 'MIXED'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : gradeGender === 'M'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            <span>{g}</span>
                            <span className="text-[10px] font-normal opacity-80">
                              ({gradeGender === 'MIXED' ? 'รวม' : gradeGender === 'M' ? '♂ชาย' : '♀หญิง'})
                            </span>
                          </span>
                        );
                      })}

                      <span className="text-[11px] text-slate-500 ml-1">
                        {dorm.assignedRooms && dorm.assignedRooms.length > 0
                          ? `ห้อง ${dorm.assignedRooms.join(', ')}`
                          : 'ทุกห้อง'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 bg-white/80 px-2 py-1 rounded-lg border border-slate-200/60 font-medium">
                      💡 {getDormitoryRuleSummary(dorm)}
                    </div>

                    {dorm.notes && (
                      <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60 truncate">
                        {dorm.notes}
                      </p>
                    )}
                  </div>

                  {/* Occupancy Progress Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>จำนวนนักเรียน:</span>
                      </span>
                      <span className="text-slate-900 font-black">
                        {stats.count} <span className="text-slate-500 font-normal">/ {capacity} คน</span>
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isMixed
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600'
                            : isMale
                            ? 'bg-indigo-600'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${occupancyPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Conduct Stats within Dorm */}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">คะแนนเฉลี่ย</div>
                      <div className="text-sm font-black text-slate-900 mt-0.5">
                        {stats.avgScore} <span className="text-[10px] font-normal text-slate-500">แต้ม</span>
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">เฝ้าระวัง/วิกฤต</div>
                      <div
                        className={`text-sm font-black mt-0.5 ${
                          stats.criticalCount > 0
                            ? 'text-rose-600'
                            : stats.watchCount > 0
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {stats.criticalCount + stats.watchCount}{' '}
                        <span className="text-[10px] font-normal text-slate-500">คน</span>
                      </div>
                    </div>
                  </div>

                  {/* Supervisors List (ครูหอพัก มีมากกว่า 1 คน) */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400 text-[11px] font-bold flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-indigo-500" />
                        <span>ครูผู้ดูแลประจำหอ ({supervisors.length} คน):</span>
                      </span>
                    </div>

                    {supervisors.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">ยังไม่ได้ระบุครูผู้ดูแล</span>
                    ) : (
                      <div className="space-y-1 mt-1">
                        {supervisors.map((sp, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-slate-50/80 px-2.5 py-1.5 rounded-xl border border-slate-100"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                              <span className="font-bold text-slate-800 truncate">{sp.name}</span>
                              {sp.role && (
                                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded-md font-medium shrink-0">
                                  {sp.role}
                                </span>
                              )}
                            </div>
                            {sp.phone && (
                              <a
                                href={`tel:${sp.phone}`}
                                className="text-indigo-600 font-mono text-[11px] flex items-center gap-1 hover:underline ml-2 shrink-0"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{sp.phone}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDormId(dorm.id)}
                    className={`flex-1 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : isMixed
                        ? 'bg-purple-50 hover:bg-purple-100 text-purple-700'
                        : isMale
                        ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                    }`}
                  >
                    <span>ดูรายชื่อ ({stats.count})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {onNavigateToStudentsView && (
                    <button
                      type="button"
                      onClick={() => onNavigateToStudentsView(dorm.id)}
                      className="p-2 text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                      title="เปิดหน้ารายชื่อนักเรียนในหอพักนี้แบบเต็มจอ"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setEditingDorm(dorm);
                      setIsAddModalOpen(true);
                    }}
                    className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    title="แก้ไขการตั้งค่าหอพัก"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Selected Dormitory Detailed Roster Drawer */}
      {selectedDorm && activeTab !== 'UNASSIGNED' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">
                  รายชื่อนักเรียน: {selectedDorm.name}
                </h3>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    selectedDorm.gender === 'MIXED' || (selectedDorm.gender as string) === 'ALL'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : selectedDorm.gender === 'M'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {getDormitoryTypeBadge(selectedDorm.gender).shortLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ระดับชั้น {selectedDorm.assignedGrades.join(', ')} • ความจุ {selectedDorm.capacity || 80} เตียง • ครูผู้ดูแล: {formatSupervisorsList(selectedDorm)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleClearSpecificDorm(selectedDorm)}
                disabled={isClearing || selectedDormStudents.length === 0}
                className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
                title="ปลดนักเรียนทั้งหมดในหอนี้ออก"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>ปลดทั้งหมดในหอนี้ ({selectedDormStudents.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingDorm(selectedDorm)}
                className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>แก้ไขการตั้งค่าหอ</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDormId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                title="ปิด"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Roster Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัส หรือชื่อนักเรียน..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={gradeFilter}
                onChange={e => setGradeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">ทุกระดับชั้น</option>
                {selectedDorm.assignedGrades.map(g => (
                  <option key={g} value={g}>
                    ชั้น {g}
                  </option>
                ))}
              </select>

              <select
                value={roomFilter}
                onChange={e => setRoomFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">ทุกห้อง</option>
                {STANDARD_ROOMS.map(r => (
                  <option key={r} value={String(r)}>
                    ห้อง {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          {selectedDormStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl">
              ไม่พบรายชื่อนักเรียนที่ตรงกับเงื่อนไขการค้นหา
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                    <th className="py-2.5 px-3">รหัสนักเรียน</th>
                    <th className="py-2.5 px-3">ชื่อ - สกุล</th>
                    <th className="py-2.5 px-3 text-center">ชั้น / ห้อง</th>
                    <th className="py-2.5 px-3 text-center">เลขที่</th>
                    <th className="py-2.5 px-3 text-center">คะแนนความประพฤติ</th>
                    <th className="py-2.5 px-3">ครูที่ปรึกษา</th>
                    <th className="py-2.5 px-3">เบอร์โทรผู้ปกครอง</th>
                    <th className="py-2.5 px-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {selectedDormStudents.map(student => {
                    const { grade } = calculateStudentGrade(
                      student.entryYear,
                      student.entryLevel,
                      currentAcademicYear
                    );
                    const categoryInfo = getScoreCategory(student, systemSettings);

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          {student.id}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <StudentAvatar
                              student={student}
                              photoUrl={student.photoUrl}
                              gender={student.gender || selectedDorm.gender}
                              size="sm"
                            />
                            <span>
                              {student.title || ''}{student.firstName} {student.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {grade} / {student.room}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {student.number || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${categoryInfo.badgeClass}`}
                          >
                            {student.currentScore ?? 100} แต้ม
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {student.advisorName || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {student.guardianPhone || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {onSelectStudent && (
                              <button
                                type="button"
                                onClick={() => onSelectStudent(student.id)}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                              >
                                ดูประวัติ
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleAssignSingleStudent(student.id, undefined)}
                              className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                              title="ปลดนักเรียนคนนี้ออกจากหอพัก"
                            >
                              <UserMinus className="w-3 h-3" />
                              <span>ปลดออก</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 7. Modal: Add / Edit Dormitory Settings */}
      {isAddModalOpen && (
        <AddEditDormitoryModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingDorm(null);
          }}
          dormitory={editingDorm}
          existingDorms={activeDorms}
          onSave={handleSaveFromModal}
          onDelete={onDeleteDormitory ? handleDeleteFromModal : undefined}
          homeroomAdvisors={homeroomAdvisors}
        />
      )}

      {/* 8. Modal: Confirmation to Clear All Dormitories */}
      {showClearConfirmModal && (
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
                  การกระทำนี้จะ<strong>ปลดนักเรียนทั้งหมด ({dormStats.totalAssigned} คน)</strong> ออกจากหอพักที่สังกัดอยู่ เพื่อให้เจ้าหน้าที่สามารถจัดการจัดนักเรียนลงหอพักเองได้
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
                <li>รายชื่อนักเรียนจะย้ายไปอยู่ในแท็บ "ยังไม่มีหอพัก" ทั้งหมดทันที</li>
                <li>คุณสามารถจัดนักเรียนทีละคน หรือเลือกหลายคนแล้วจัดพร้อมกันได้ตามต้องการ</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                disabled={isClearing}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                id="btn-confirm-clear-dormitories"
                onClick={handleClearAllDorms}
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
