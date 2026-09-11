import React, { useState, useMemo } from 'react';
import { Student, SystemSettings, AppUser, ConductLog } from '../types';
import { calculateStudentGrade, getScoreCategory } from '../utils/conductLogic';
import { AdminPasswordConfirmModal } from './AdminPasswordConfirmModal';
import { StudentAvatar } from './StudentAvatar';
import { Pagination } from './Pagination';
import {
  Calendar,
  AlertTriangle,
  GraduationCap,
  Trash2,
  CheckCircle2,
  X,
  Info,
  Search,
  Users,
  CheckSquare,
  Square,
  MinusSquare,
  RotateCcw,
  Check
} from 'lucide-react';

interface YearResetModalProps {
  students: Student[];
  systemSettings: SystemSettings;
  conductLogs?: ConductLog[];
  currentUser?: AppUser | null;
  users?: AppUser[];
  isPage?: boolean;
  onClose: () => void;
  onUpdateSettings: (newSettings: SystemSettings) => Promise<void>;
  onGraduateStudents: (studentIds: string[]) => Promise<void>;
  onPromoteToM4?: (studentIds: string[], newEntryYear: number) => Promise<void>;
}

export const YearResetModal: React.FC<YearResetModalProps> = ({
  students,
  systemSettings,
  conductLogs = [],
  currentUser = null,
  users = [],
  isPage = false,
  onClose,
  onUpdateSettings,
  onGraduateStudents
}) => {
  const [targetYear, setTargetYear] = useState<number>(systemSettings.currentAcademicYear);
  const [targetTerm, setTargetTerm] = useState<number>(systemSettings.currentTerm);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionTab, setActionTab] = useState<'GRADUATION' | 'SETTINGS'>('GRADUATION');

  // Filter & Search states for Graduation table
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'ม.3' | 'ม.6'>('ALL');
  const [roomFilter, setRoomFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Admin Password Confirm Modal State
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    targetName?: string;
    dangerLevel?: 'danger' | 'warning';
    confirmButtonText?: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  // Calculate logs map by studentId for fast lookup
  const logsCountMap = useMemo(() => {
    const map = new Map<string, number>();
    conductLogs.forEach(l => {
      map.set(l.studentId, (map.get(l.studentId) || 0) + 1);
    });
    return map;
  }, [conductLogs]);

  // Identify M.3 and M.6 active students (จบการศึกษา)
  const gradStudents = useMemo(() => {
    return students.filter(s => {
      const g = calculateStudentGrade(s.entryYear, s.entryLevel, systemSettings.currentAcademicYear);
      return (g.grade === 'ม.3' || g.grade === 'ม.6') && s.status === 'ACTIVE';
    });
  }, [students, systemSettings.currentAcademicYear]);

  const m3Students = useMemo(() => {
    return gradStudents.filter(s => {
      const g = calculateStudentGrade(s.entryYear, s.entryLevel, systemSettings.currentAcademicYear);
      return g.grade === 'ม.3';
    });
  }, [gradStudents, systemSettings.currentAcademicYear]);

  const m6Students = useMemo(() => {
    return gradStudents.filter(s => {
      const g = calculateStudentGrade(s.entryYear, s.entryLevel, systemSettings.currentAcademicYear);
      return g.grade === 'ม.6';
    });
  }, [gradStudents, systemSettings.currentAcademicYear]);

  // Sort students: เรียงตามห้อง (M.3 first, then M.6, room numeric ascending, number ascending, ID)
  const sortedGradStudents = useMemo(() => {
    return [...gradStudents].sort((a, b) => {
      const gradeA = calculateStudentGrade(a.entryYear, a.entryLevel, systemSettings.currentAcademicYear).grade;
      const gradeB = calculateStudentGrade(b.entryYear, b.entryLevel, systemSettings.currentAcademicYear).grade;

      // ม.3 มาก่อน ม.6
      if (gradeA !== gradeB) {
        return gradeA.localeCompare(gradeB, 'th');
      }

      // เรียงตามห้อง (Numeric if possible)
      const numRoomA = Number(a.room);
      const numRoomB = Number(b.room);
      if (!isNaN(numRoomA) && !isNaN(numRoomB) && numRoomA !== numRoomB) {
        return numRoomA - numRoomB;
      }
      const roomComp = String(a.room).localeCompare(String(b.room), 'th', { numeric: true });
      if (roomComp !== 0) return roomComp;

      // เรียงตามเลขที่
      const numA = Number(a.number) || 0;
      const numB = Number(b.number) || 0;
      if (numA !== numB) return numA - numB;

      // เรียงตามรหัสประจำตัว
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [gradStudents, systemSettings.currentAcademicYear]);

  // Unique rooms list sorted for dropdown filter
  const availableRooms = useMemo(() => {
    const map = new Map<string, { key: string; label: string; grade: string; room: any; count: number }>();
    sortedGradStudents.forEach(s => {
      const g = calculateStudentGrade(s.entryYear, s.entryLevel, systemSettings.currentAcademicYear).grade;
      const key = `${g}/${s.room}`;
      if (!map.has(key)) {
        map.set(key, { key, label: `ชั้น ${g}/${s.room}`, grade: g, room: s.room, count: 0 });
      }
      map.get(key)!.count++;
    });
    return Array.from(map.values());
  }, [sortedGradStudents, systemSettings.currentAcademicYear]);

  // Filtered students according to current filters & search query
  const filteredStudents = useMemo(() => {
    return sortedGradStudents.filter(s => {
      const g = calculateStudentGrade(s.entryYear, s.entryLevel, systemSettings.currentAcademicYear).grade;
      if (levelFilter !== 'ALL' && g !== levelFilter) return false;
      if (roomFilter !== 'ALL' && `${g}/${s.room}` !== roomFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = (s.id || '').toLowerCase().includes(q);
        const nameMatch = `${s.title || ''}${s.firstName || ''} ${s.lastName || ''}`.toLowerCase().includes(q);
        const roomMatch = `${g}/${s.room}`.toLowerCase().includes(q);
        const numMatch = String(s.number).includes(q);
        const advisorMatch = (s.advisorName || '').toLowerCase().includes(q);
        if (!idMatch && !nameMatch && !roomMatch && !numMatch && !advisorMatch) return false;
      }
      return true;
    });
  }, [sortedGradStudents, levelFilter, roomFilter, searchQuery, systemSettings.currentAcademicYear]);

  // Paginated students
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  // Selected counts analysis
  const selectedCount = selectedIds.size;
  const selectedM3Count = useMemo(() => {
    return m3Students.filter(s => selectedIds.has(s.id)).length;
  }, [m3Students, selectedIds]);

  const selectedM6Count = useMemo(() => {
    return m6Students.filter(s => selectedIds.has(s.id)).length;
  }, [m6Students, selectedIds]);

  // Header checkbox state
  const areAllFilteredSelected =
    filteredStudents.length > 0 && filteredStudents.every(s => selectedIds.has(s.id));
  const isSomeFilteredSelected =
    filteredStudents.some(s => selectedIds.has(s.id)) && !areAllFilteredSelected;

  // Toggle selection for a single student
  const handleToggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle select all filtered students
  const handleToggleSelectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (areAllFilteredSelected) {
        filteredStudents.forEach(s => next.delete(s.id));
      } else {
        filteredStudents.forEach(s => next.add(s.id));
      }
      return next;
    });
  };

  // Quick select helpers
  const handleSelectAllM3 = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      m3Students.forEach(s => next.add(s.id));
      return next;
    });
  };

  const handleSelectAllM6 = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      m6Students.forEach(s => next.add(s.id));
      return next;
    });
  };

  const handleSelectRoom = (roomKey: string) => {
    const roomStudents = sortedGradStudents.filter(s => {
      const g = calculateStudentGrade(s.entryYear, s.entryLevel, systemSettings.currentAcademicYear).grade;
      return `${g}/${s.room}` === roomKey;
    });
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allInRoomSelected = roomStudents.every(s => next.has(s.id));
      if (allInRoomSelected) {
        roomStudents.forEach(s => next.delete(s.id));
      } else {
        roomStudents.forEach(s => next.add(s.id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Delete Selected Students
  const handleDeleteSelected = () => {
    if (selectedCount === 0) {
      alert('กรุณาเลือกนักเรียนที่ต้องการลบข้อมูลอย่างน้อย 1 คน');
      return;
    }

    const idsToDelete = Array.from(selectedIds);
    const breakdown = `ม.3: ${selectedM3Count} คน, ม.6: ${selectedM6Count} คน`;

    setConfirmAction({
      isOpen: true,
      title: 'ยืนยันการจบการศึกษาและลบข้อมูลนักเรียนที่เลือก',
      description: `คุณต้องการจบการศึกษาและลบข้อมูลนักเรียนที่เลือกจำนวน ${idsToDelete.length} คน (${breakdown}) ออกจากระบบตามรอบ 3 ปีใช่หรือไม่? การกระทำนี้จะลบข้อมูลประวัติความประพฤติและข้อมูลนักเรียนอย่างถาวร (ต้องใช้รหัสผ่าน Admin ยืนยัน)`,
      targetName: `นักเรียนจบการศึกษาที่เลือกจำนวน ${idsToDelete.length} คน (${breakdown})`,
      dangerLevel: 'danger',
      confirmButtonText: `ยืนยันลบข้อมูลนักเรียนจบการศึกษา (${idsToDelete.length} คน)`,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          await onGraduateStudents(idsToDelete);
          setSelectedIds(new Set());
          alert(`ลบข้อมูลนักเรียนจบการศึกษา ${idsToDelete.length} คนเรียบร้อยแล้ว`);
        } catch (err: any) {
          alert('เกิดข้อผิดพลาด: ' + (err.message || 'กรุณาลองใหม่อีกครั้ง'));
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  const handleSaveSettings = async () => {
    setIsProcessing(true);
    try {
      await onUpdateSettings({
        ...systemSettings,
        currentAcademicYear: targetYear,
        currentTerm: targetTerm
      });
      alert('บันทึกปีการศึกษาและภาคเรียนเรียบร้อย');
      onClose();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const mainContent = (
    <div className="space-y-6">
      {/* Tab Switcher - Only 2 Tabs (ต่อ ม.4 Removed) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActionTab('GRADUATION')}
          className={`py-3 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-2 ${
            actionTab === 'GRADUATION'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>จบ ม.3 / ม.6 ({gradStudents.length} คน)</span>
        </button>
        <button
          type="button"
          onClick={() => setActionTab('SETTINGS')}
          className={`py-3 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-2 ${
            actionTab === 'SETTINGS'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>ตั้งค่าปีการศึกษา & เทอม</span>
        </button>
      </div>

      {/* TAB 1: 3-YEAR GRADUATION (M.3 & M.6 DELETION TABLE) */}
      {actionTab === 'GRADUATION' && (
        <div className="space-y-4">
          {/* Info Notice Banner */}
          <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-950">
            <div className="flex items-start gap-2.5">
              <GraduationCap className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-indigo-950">
                  รายชื่อนักเรียนจบการศึกษาตามรอบ 3 ปี (ม.3 และ ม.6)
                </h4>
                <p className="text-xs text-indigo-800/90 mt-0.5 leading-relaxed">
                  แสดงรายชื่อนักเรียนเรียงตามห้อง สามารถเลือกติ๊กถูกเฉพาะรายชื่อหรือห้องที่ต้องการลบข้อมูลจบการศึกษาออกจากระบบได้อย่างแม่นยำ
                </p>
              </div>
            </div>

            {/* Quick Stat Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 font-bold text-indigo-900 shadow-2xs text-xs">
                ม.3 ทั้งหมด: <span className="font-mono text-indigo-600">{m3Students.length}</span> คน
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 font-bold text-indigo-900 shadow-2xs text-xs">
                ม.6 ทั้งหมด: <span className="font-mono text-purple-600">{m6Students.length}</span> คน
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold shadow-2xs text-xs">
                รวม: <span className="font-mono">{gradStudents.length}</span> คน
              </span>
            </div>
          </div>

          {/* Filter & Action Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Level Filter Tabs */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setLevelFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    levelFilter === 'ALL'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ทั้งหมด ({gradStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLevelFilter('ม.3');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    levelFilter === 'ม.3'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  เฉพาะ ม.3 ({m3Students.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLevelFilter('ม.6');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    levelFilter === 'ม.6'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  เฉพาะ ม.6 ({m6Students.length})
                </button>
              </div>

              {/* Room Filter Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">ห้อง:</span>
                <select
                  value={roomFilter}
                  onChange={e => {
                    setRoomFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">ทุกห้อง ({sortedGradStudents.length} คน)</option>
                  {availableRooms.map(rm => (
                    <option key={rm.key} value={rm.key}>
                      {rm.label} ({rm.count} คน)
                    </option>
                  ))}
                </select>

                {/* Search Box */}
                <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="ค้นหาชื่อ, รหัส, เลขที่..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Selection Buttons */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] font-bold text-slate-400 mr-1">เลือกด่วน:</span>
                <button
                  type="button"
                  onClick={handleToggleSelectAllFiltered}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                >
                  {areAllFilteredSelected ? (
                    <CheckSquare className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <Square className="w-3 h-3 text-slate-400" />
                  )}
                  <span>{areAllFilteredSelected ? 'ยกเลิกที่แสดง' : `เลือกทั้งหมดที่แสดง (${filteredStudents.length})`}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllM3}
                  className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold rounded-lg border border-sky-200 transition-colors cursor-pointer text-[11px]"
                >
                  เลือก ม.3 ทั้งหมด ({m3Students.length})
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllM6}
                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold rounded-lg border border-purple-200 transition-colors cursor-pointer text-[11px]"
                >
                  เลือก ม.6 ทั้งหมด ({m6Students.length})
                </button>
                {selectedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition-colors cursor-pointer text-[11px]"
                  >
                    ล้างการเลือก ({selectedCount})
                  </button>
                )}
              </div>

              {/* Room Quick-Select Chips (when viewing ALL or level) */}
              {availableRooms.length > 0 && availableRooms.length <= 12 && (
                <div className="hidden sm:flex items-center gap-1 text-[11px]">
                  <span className="text-slate-400 font-medium">เลือกห้อง:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {availableRooms.map(rm => {
                      const roomStudents = sortedGradStudents.filter(s => {
                        const g = calculateStudentGrade(s.entryYear, s.entryLevel, systemSettings.currentAcademicYear).grade;
                        return `${g}/${s.room}` === rm.key;
                      });
                      const allSelected = roomStudents.length > 0 && roomStudents.every(s => selectedIds.has(s.id));
                      return (
                        <button
                          key={rm.key}
                          type="button"
                          onClick={() => handleSelectRoom(rm.key)}
                          className={`px-2 py-0.5 rounded-md font-mono font-bold transition-all cursor-pointer text-[10px] ${
                            allSelected
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title={`คลิกเพื่อเลือก/ยกเลิกทั้งห้อง ${rm.label}`}
                        >
                          {rm.key}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky / Floating Action Bar when students are selected */}
          {selectedCount > 0 && (
            <div className="p-3.5 bg-gradient-to-r from-rose-50 via-rose-100/70 to-amber-50 border-2 border-rose-300 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-rose-950 flex items-center gap-2">
                    <span>เลือกข้อมูลนักเรียนจบการศึกษาที่จะลบ:</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono font-black text-xs">
                      {selectedCount} คน
                    </span>
                  </div>
                  <div className="text-[11px] text-rose-800 font-medium mt-0.5 flex items-center gap-2">
                    <span>(ม.3: <strong>{selectedM3Count}</strong> คน • ม.6: <strong>{selectedM6Count}</strong> คน จากทั้งหมด {gradStudents.length} คน)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิกการเลือก
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleDeleteSelected}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบข้อมูลนักเรียนที่เลือก ({selectedCount} คน)</span>
                </button>
              </div>
            </div>
          )}

          {/* Students Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAllFiltered}
                        className="p-1 text-slate-600 hover:text-indigo-600 cursor-pointer inline-flex items-center justify-center rounded"
                        title={areAllFilteredSelected ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมดในหน้านี้'}
                      >
                        {areAllFilteredSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : isSomeFilteredSelected ? (
                          <MinusSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-2 w-12 text-center text-slate-400 font-medium">ลำดับ</th>
                    <th className="py-3 px-3 w-28">เลขประจำตัว</th>
                    <th className="py-3 px-3">ชื่อ - นามสกุล</th>
                    <th className="py-3 px-3 w-24 text-center">ชั้น/ห้อง</th>
                    <th className="py-3 px-2 w-16 text-center">เลขที่</th>
                    <th className="py-3 px-3">ครูที่ปรึกษา</th>
                    <th className="py-3 px-3 text-right">คะแนนความประพฤติ</th>
                    <th className="py-3 px-3 text-center">สถานะคะแนน</th>
                    <th className="py-3 px-3 text-center">ประวัติ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <GraduationCap className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-slate-600">ไม่พบข้อมูลนักเรียนจบการศึกษา ม.3 หรือ ม.6</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {searchQuery ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรองระดับชั้น/ห้อง' : 'ยังไม่มีนักเรียนในระดับชั้น ม.3 หรือ ม.6 ในปีการศึกษานี้'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((st, idx) => {
                      const isSelected = selectedIds.has(st.id);
                      const gradeInfo = calculateStudentGrade(st.entryYear, st.entryLevel, systemSettings.currentAcademicYear);
                      const scoreStatus = getScoreCategory(st, systemSettings);
                      const logsCount = logsCountMap.get(st.id) || 0;
                      const isM3 = gradeInfo.grade === 'ม.3';
                      const globalIndex = (currentPage - 1) * pageSize + idx + 1;

                      return (
                        <tr
                          key={st.id}
                          onClick={() => handleToggleStudent(st.id)}
                          className={`transition-colors cursor-pointer select-none ${
                            isSelected
                              ? 'bg-rose-50/70 hover:bg-rose-100/70'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleStudent(st.id)}
                              className="p-1 text-slate-500 hover:text-indigo-600 cursor-pointer inline-flex items-center justify-center rounded"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                              )}
                            </button>
                          </td>

                          {/* Index */}
                          <td className="py-2.5 px-2 text-center font-mono text-[11px] text-slate-400">
                            {globalIndex}
                          </td>

                          {/* Student ID */}
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              {st.id}
                            </span>
                          </td>

                          {/* Avatar & Name */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <StudentAvatar student={st} size="sm" />
                              <div>
                                <span className="font-bold text-slate-900 block leading-tight">
                                  {st.title || ''}{st.firstName} {st.lastName}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  เข้าปี {st.entryYear} ({st.entryLevel})
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Grade / Room */}
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold border ${
                                isM3
                                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                                  : 'bg-purple-50 text-purple-800 border-purple-200'
                              }`}
                            >
                              {gradeInfo.grade}/{st.room}
                            </span>
                          </td>

                          {/* Number */}
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                            {st.number ?? '-'}
                          </td>

                          {/* Advisor Name */}
                          <td className="py-2.5 px-3 text-slate-600 text-xs">
                            {st.advisorName ? (
                              <span>ครู{st.advisorName}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Score */}
                          <td className="py-2.5 px-3 text-right font-mono">
                            <span
                              className={`font-black text-xs ${
                                (st.currentScore ?? 100) < 50
                                  ? 'text-rose-600'
                                  : (st.currentScore ?? 100) < 80
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {st.currentScore ?? 100}
                            </span>
                            <span className="text-slate-400 text-[10px]">/100</span>
                            {(st.bankedPoints ?? 0) > 0 && (
                              <span className="ml-1 text-[10px] font-bold text-sky-600 bg-sky-50 px-1 py-0.2 rounded border border-sky-200">
                                +{st.bankedPoints}
                              </span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${scoreStatus.badgeClass}`}
                            >
                              {scoreStatus.shortLabel}
                            </span>
                          </td>

                          {/* Conduct Logs */}
                          <td className="py-2.5 px-3 text-center">
                            {logsCount > 0 ? (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                {logsCount} รายการ
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">ไม่มีประวัติ</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Component */}
            {filteredStudents.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredStudents.length}
                pageSize={pageSize}
                onPageChange={p => setCurrentPage(p)}
                onPageSizeChange={s => {
                  setPageSize(s);
                  setCurrentPage(1);
                }}
                itemLabel="คน"
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ACADEMIC YEAR SETTINGS */}
      {actionTab === 'SETTINGS' && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl text-xs text-indigo-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              การเปลี่ยนปีการศึกษาจะมีผลต่อการคำนวณระดับชั้น (ม.1 - ม.6) อัตโนมัติจากปีที่เข้าศึกษา (เช่น ม.1 เข้าปี 2568 เมื่อถึงปี 2569 จะกลายเป็น ม.2)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ปีการศึกษาปัจจุบัน (พ.ศ.):
              </label>
              <input
                type="number"
                value={targetYear}
                onChange={e => setTargetYear(parseInt(e.target.value) || 2569)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ภาคเรียน (เทอม):
              </label>
              <select
                value={targetTerm}
                onChange={e => setTargetTerm(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                <option value={1}>ภาคเรียนที่ 1 (เทอม 1)</option>
                <option value={2}>ภาคเรียนที่ 2 (เทอม 2)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={isProcessing}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-colors cursor-pointer"
          >
            บันทึกการเปลี่ยนแปลงปีการศึกษา
          </button>
        </div>
      )}
    </div>
  );

  if (isPage) {
    return (
      <div className="space-y-6 w-full pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  จัดการรอบปีการศึกษา
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                  รอบ 3 ปี
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                จัดการรอบ 3 ปี (Admin)
              </h1>
            </div>
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleDeleteSelected}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบข้อมูลนักเรียนที่เลือก ({selectedCount} คน)</span>
              </button>
            </div>
          )}
        </div>

        {/* Main Card */}
        <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs">
          {mainContent}
        </div>

        {/* Admin Password Confirm Modal */}
        <AdminPasswordConfirmModal
          isOpen={confirmAction.isOpen}
          title={confirmAction.title}
          description={confirmAction.description}
          targetName={confirmAction.targetName}
          dangerLevel={confirmAction.dangerLevel}
          confirmButtonText={confirmAction.confirmButtonText}
          users={users}
          currentUser={currentUser}
          onConfirm={confirmAction.onConfirm}
          onClose={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">จัดการรอบ 3 ปี & จบการศึกษา ม.3 / ม.6</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                แสดงรายชื่อนักเรียนเรียงตามห้อง และเลือกข้อมูลที่จะลบเมื่อจบการศึกษา
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {mainContent}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {selectedCount > 0 ? (
              <span className="text-rose-600 font-bold">
                เลือกไว้ {selectedCount} คน (ม.3: {selectedM3Count}, ม.6: {selectedM6Count})
              </span>
            ) : (
              <span>จบ ม.3 และ ม.6 รวม {gradStudents.length} คน</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleDeleteSelected}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบข้อมูลที่เลือก ({selectedCount})</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>

        {/* Admin Password Confirm Modal */}
        <AdminPasswordConfirmModal
          isOpen={confirmAction.isOpen}
          title={confirmAction.title}
          description={confirmAction.description}
          targetName={confirmAction.targetName}
          dangerLevel={confirmAction.dangerLevel}
          confirmButtonText={confirmAction.confirmButtonText}
          users={users}
          currentUser={currentUser}
          onConfirm={confirmAction.onConfirm}
          onClose={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
    </div>
  );
};
