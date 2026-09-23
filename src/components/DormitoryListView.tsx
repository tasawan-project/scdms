import React, { useState, useMemo } from 'react';
import { Dormitory, Student, GradeLevel, AppUser, SystemSettings, HomeroomAdvisor } from '../types';
import {
  DEFAULT_DORMITORIES,
  getDormitoryTypeName,
  getDormitoryTypeBadge,
  getDormitorySupervisors,
  formatSupervisorsList,
  inferStudentGender
} from '../utils/dormitoryLogic';
import { calculateStudentGrade } from '../utils/conductLogic';
import { AddEditDormitoryModal } from './AddEditDormitoryModal';
import { Pagination } from './Pagination';
import {
  Building2,
  Users,
  Plus,
  Edit,
  Trash2,
  Phone,
  UserCheck,
  CheckCircle2,
  ChevronRight,
  Printer,
  Sparkles,
  SlidersHorizontal,
  DoorOpen,
  Filter,
  Search,
  Eye,
  AlertCircle
} from 'lucide-react';

interface DormitoryListViewProps {
  dormitories: Dormitory[];
  students: Student[];
  currentAcademicYear: number;
  currentUser: AppUser | null;
  systemSettings?: SystemSettings;
  homeroomAdvisors?: HomeroomAdvisor[];
  onSaveDormitory: (dorm: Dormitory) => Promise<void>;
  onDeleteDormitory?: (dormId: string) => Promise<void>;
  onSelectStudent?: (studentId: string) => void;
  onNavigateToTab?: (tab: 'ASSIGN' | 'LIST' | 'TEACHERS') => void;
  onViewDormStudents?: (dormId: string) => void;
}

export const DormitoryListView: React.FC<DormitoryListViewProps> = ({
  dormitories = [],
  students = [],
  currentAcademicYear,
  currentUser,
  systemSettings,
  homeroomAdvisors = [],
  onSaveDormitory,
  onDeleteDormitory,
  onSelectStudent,
  onNavigateToTab,
  onViewDormStudents
}) => {
  const activeDorms = useMemo(() => {
    if (dormitories.length > 0) {
      return [...dormitories].sort((a, b) => a.dormNumber - b.dormNumber);
    }
    return DEFAULT_DORMITORIES;
  }, [dormitories]);

  // Modal states for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDorm, setEditingDorm] = useState<Dormitory | null>(null);

  // Filter tab: ALL | MALE | FEMALE | MIXED
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'M' | 'F' | 'MIXED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected dorm for viewing student list in drawer/modal
  const [viewingDormId, setViewingDormId] = useState<string | null>(null);
  const [modalPage, setModalPage] = useState<number>(1);
  const [modalPageSize, setModalPageSize] = useState<number>(25);

  React.useEffect(() => {
    setModalPage(1);
  }, [viewingDormId, modalPageSize]);

  // Active students only
  const activeStudents = useMemo(() => {
    return students.filter(s => s.status !== 'INACTIVE' && s.status !== 'GRADUATED');
  }, [students]);

  // Calculate statistics per dormitory
  const { dormStats, totalCapacity, totalOccupancy } = useMemo(() => {
    const stats: Record<string, { count: number; maleCount: number; femaleCount: number; students: Student[] }> = {};
    let cap = 0;
    let occ = 0;

    activeDorms.forEach(d => {
      stats[d.id] = { count: 0, maleCount: 0, femaleCount: 0, students: [] };
      cap += d.capacity || 80;
    });

    activeStudents.forEach(st => {
      if (st.dormitoryId && stats[st.dormitoryId]) {
        stats[st.dormitoryId].students.push(st);
        stats[st.dormitoryId].count++;
        occ++;
        const g = st.gender || inferStudentGender(st);
        if (g === 'M') {
          stats[st.dormitoryId].maleCount++;
        } else if (g === 'F') {
          stats[st.dormitoryId].femaleCount++;
        }
      }
    });

    return { dormStats: stats, totalCapacity: cap, totalOccupancy: occ };
  }, [activeDorms, activeStudents]);

  // Filtered dorm list
  const filteredDorms = useMemo(() => {
    return activeDorms.filter(dorm => {
      if (typeFilter !== 'ALL' && dorm.gender !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = dorm.name.toLowerCase().includes(q);
        const supervisorMatch = (dorm.supervisors || []).some(s => s.name.toLowerCase().includes(q));
        if (!nameMatch && !supervisorMatch) return false;
      }
      return true;
    });
  }, [activeDorms, typeFilter, searchQuery]);

  const handleOpenAddModal = () => {
    setEditingDorm(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (dorm: Dormitory) => {
    setEditingDorm(dorm);
    setIsModalOpen(true);
  };

  const handleDeleteDorm = async (dorm: Dormitory) => {
    if (!onDeleteDormitory) return;
    const count = dormStats[dorm.id]?.count || 0;
    const confirmMsg = count > 0
      ? `หอพัก "${dorm.name}" มีนักเรียนพักอยู่ ${count} คน หากลบหอพัก นักเรียนเหล่านี้จะกลายเป็น "ไม่มีหอพัก" คุณต้องการลบใช่หรือไม่?`
      : `คุณต้องการลบหอพัก "${dorm.name}" ใช่หรือไม่?`;

    if (!confirm(confirmMsg)) return;

    try {
      await onDeleteDormitory(dorm.id);
      if (viewingDormId === dorm.id) {
        setViewingDormId(null);
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบหอพัก: ' + (err?.message || String(err)));
    }
  };

  const viewingDorm = useMemo(() => {
    return activeDorms.find(d => d.id === viewingDormId) || null;
  }, [activeDorms, viewingDormId]);

  const modalStudents = useMemo(() => {
    if (!viewingDorm) return [];
    return dormStats[viewingDorm.id]?.students || [];
  }, [viewingDorm, dormStats]);

  const paginatedModalStudents = useMemo(() => {
    if (modalPageSize >= 999999) return modalStudents;
    const start = (modalPage - 1) * modalPageSize;
    return modalStudents.slice(start, start + modalPageSize);
  }, [modalStudents, modalPage, modalPageSize]);

  // Classrooms in viewing dorm with gender breakdown
  const modalClassroomsList = useMemo(() => {
    if (!viewingDorm) return [];
    const counts: Record<string, { total: number; male: number; female: number }> = {};
    modalStudents.forEach(st => {
      const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
      const key = `${grade}/${st.room}`;
      if (!counts[key]) {
        counts[key] = { total: 0, male: 0, female: 0 };
      }
      counts[key].total++;
      const g = st.gender || inferStudentGender(st);
      if (g === 'M') counts[key].male++;
      else if (g === 'F') counts[key].female++;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'th', { numeric: true }));
  }, [viewingDorm, modalStudents, currentAcademicYear]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Navigation Sub-Tabs */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  รายชื่อหอพัก
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  แสดงรายการหอพักทั้งหมด เพิ่มหอพักใหม่ แก้ไขข้อมูล และดูสถิตินักเรียนแต่ละหอ
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {/* Sub-navigation tabs */}
            {onNavigateToTab && (
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => onNavigateToTab('ASSIGN')}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span>จัดนักเรียนเข้าหอ</span>
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-white text-indigo-700 font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 cursor-default"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>รายชื่อหอพัก</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToTab('TEACHERS')}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>ครูหอพัก</span>
                </button>
              </div>
            )}

            {/* "+ เพิ่มหอพัก" Button */}
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มหอพัก</span>
            </button>
          </div>
        </div>

        {/* 2. Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100">
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

          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-900">นักเรียนในหอรวม</div>
              <div className="text-xl font-black text-emerald-700">
                {totalOccupancy} <span className="text-xs font-semibold text-emerald-600">คน</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-purple-50/80 border border-purple-200/70 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-purple-900">ความจุทั้งหมด</div>
              <div className="text-xl font-black text-purple-700">
                {totalCapacity} <span className="text-xs font-semibold text-purple-600">เตียง</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-amber-900">อัตราการเข้าพัก</div>
              <div className="text-xl font-black text-amber-700">
                {totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setTypeFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              typeFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({activeDorms.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('M')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              typeFilter === 'M'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            หอชาย ({activeDorms.filter(d => d.gender === 'M').length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('F')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              typeFilter === 'F'
                ? 'bg-pink-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            หอหญิง ({activeDorms.filter(d => d.gender === 'F').length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('MIXED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              typeFilter === 'MIXED'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            หอรวม ({activeDorms.filter(d => d.gender === 'MIXED').length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อหอพัก หรือครูหอพัก..."
            className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 text-slate-800"
          />
        </div>
      </div>

      {/* 4. Dormitories Grid */}
      {filteredDorms.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="font-black text-slate-900 text-sm">ไม่พบข้อมูลหอพัก</h3>
          <p className="text-xs text-slate-500">
            ลองปรับเปลี่ยนคำค้นหา หรือกดปุ่ม &quot;+ เพิ่มหอพัก&quot; เพื่อสร้างหอพักใหม่
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredDorms.map(dorm => {
            const count = dormStats[dorm.id]?.count || 0;
            const cap = dorm.capacity || 80;
            const percent = Math.min(100, Math.round((count / cap) * 100));
            const supervisors = getDormitorySupervisors(dorm);
            const badge = getDormitoryTypeBadge(dorm.gender);

            const dormStudents = dormStats[dorm.id]?.students || [];
            const classroomData: Record<string, { total: number; male: number; female: number }> = {};
            dormStudents.forEach(st => {
              const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
              const key = `${grade}/${st.room}`;
              if (!classroomData[key]) {
                classroomData[key] = { total: 0, male: 0, female: 0 };
              }
              classroomData[key].total++;
              const g = st.gender || inferStudentGender(st);
              if (g === 'M') {
                classroomData[key].male++;
              } else if (g === 'F') {
                classroomData[key].female++;
              }
            });
            const classroomsList = Object.entries(classroomData).sort((a, b) => {
              return a[0].localeCompare(b[0], 'th', { numeric: true });
            });

            return (
              <div
                key={dorm.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black text-lg shadow-2xs">
                          {dorm.dormNumber}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-base">
                            {dorm.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}>
                              {badge.label}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              ความจุ {cap} คน
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(dorm)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                          title="แก้ไขหอพัก"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {currentUser?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDorm(dorm)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="ลบหอพัก"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Body: Occupancy & Rules */}
                  <div className="p-5 space-y-4">
                    {/* Occupancy bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-600">นักเรียนที่เข้าพัก:</span>
                        <span className="text-slate-900">
                          {count} / {cap} คน <span className="text-slate-400 font-medium">({percent}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            percent >= 90
                              ? 'bg-rose-500'
                              : percent >= 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* ห้องเรียนที่อยู่ในหอพัก */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                      <div className="font-bold text-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <DoorOpen className="w-3.5 h-3.5 text-indigo-500" />
                          <span>ห้องเรียนที่อยู่ในหอพัก:</span>
                        </div>
                        {classroomsList.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                              {classroomsList.length} ห้องเรียน
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              (ช {dormStats[dorm.id]?.maleCount || 0} • ญ {dormStats[dorm.id]?.femaleCount || 0})
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-slate-600 text-[11px] leading-relaxed">
                        {classroomsList.length === 0 ? (
                          <span className="text-slate-400 italic">ยังไม่มีนักเรียนในหอพักนี้</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {classroomsList.map(([roomKey, data]) => (
                              <span
                                key={roomKey}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-800 font-bold text-[11px] shadow-2xs"
                              >
                                <span className="font-black text-slate-900">{roomKey}</span>
                                <span className="text-[10px] text-slate-500 font-normal">
                                  ({data.total} คน •{' '}
                                  {data.male > 0 && data.female > 0 ? (
                                    <>
                                      <span className="text-blue-600 font-bold">ช {data.male}</span>{' '}
                                      <span className="text-pink-600 font-bold">ญ {data.female}</span>
                                    </>
                                  ) : data.male > 0 ? (
                                    <span className="text-blue-600 font-bold">ชาย {data.male}</span>
                                  ) : data.female > 0 ? (
                                    <span className="text-pink-600 font-bold">หญิง {data.female}</span>
                                  ) : (
                                    <span>{data.total} คน</span>
                                  )}
                                  )
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Supervisors */}
                    <div className="space-y-1.5 text-xs">
                      <div className="font-bold text-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                          <span>ครูหอพัก ({supervisors.length} คน):</span>
                        </div>
                      </div>

                      {supervisors.length === 0 ? (
                        <div className="text-xs text-amber-600 italic">
                          ยังไม่ได้กำหนดครูหอพัก
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {supervisors.map(sup => (
                            <div
                              key={sup.id}
                              className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-slate-200/70 rounded-xl text-xs"
                            >
                              <span className="font-bold text-slate-800 truncate">
                                {sup.name}
                              </span>
                              {sup.phone && (
                                <a
                                  href={`tel:${sup.phone}`}
                                  className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 shrink-0 ml-2"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>{sup.phone}</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer: View Students Button */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setViewingDormId(dorm.id)}
                    className="w-full py-2 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 border border-slate-200 hover:border-indigo-200 font-bold rounded-xl text-xs transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>ดูรายชื่อนักเรียน ({count} คน)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Add / Edit Dormitory Modal */}
      {isModalOpen && (
        <AddEditDormitoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          dormitory={editingDorm}
          existingDorms={activeDorms}
          onSave={onSaveDormitory}
          onDelete={onDeleteDormitory}
          homeroomAdvisors={homeroomAdvisors}
        />
      )}

      {/* 6. Students List Modal for Selected Dorm */}
      {viewingDorm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 to-indigo-800 text-white shrink-0 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center font-black text-lg">
                    {viewingDorm.dormNumber}
                  </div>
                  <div>
                    <h3 className="font-black text-base">{viewingDorm.name}</h3>
                    <p className="text-xs text-indigo-200 font-medium">
                      นักเรียนทั้งหมด {modalStudents.length} คน (ความจุ {viewingDorm.capacity || 80} คน)
                      <span className="text-indigo-300"> • ชาย {dormStats[viewingDorm.id]?.maleCount || 0} คน • หญิง {dormStats[viewingDorm.id]?.femaleCount || 0} คน</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingDormId(null)}
                  className="text-white/80 hover:text-white cursor-pointer font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Classrooms in this dorm with male and female separation */}
              {modalClassroomsList.length > 0 && (
                <div className="pt-2 border-t border-white/15 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] text-indigo-200 font-bold flex items-center gap-1 mr-1">
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>ห้องเรียน ({modalClassroomsList.length} ห้อง):</span>
                  </span>
                  {modalClassroomsList.map(([roomKey, data]) => (
                    <span
                      key={roomKey}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/15 text-white font-bold text-[10px] backdrop-blur-xs border border-white/10"
                    >
                      <span>{roomKey}</span>
                      <span className="text-indigo-200 font-normal">
                        ({data.total} คน •{' '}
                        {data.male > 0 && data.female > 0 ? (
                          <>
                            <span className="text-blue-300 font-bold">ช {data.male}</span>{' '}
                            <span className="text-pink-300 font-bold">ญ {data.female}</span>
                          </>
                        ) : data.male > 0 ? (
                          <span className="text-blue-300 font-bold">ชาย {data.male}</span>
                        ) : data.female > 0 ? (
                          <span className="text-pink-300 font-bold">หญิง {data.female}</span>
                        ) : (
                          <span>{data.total} คน</span>
                        )}
                        )
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Students Table */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {modalStudents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  ยังไม่มีนักเรียนถูกจัดสรรเข้าหอพักนี้
                </div>
              ) : (
                <>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">รหัส</th>
                        <th className="py-2.5 px-3">ชื่อ - นามสกุล</th>
                        <th className="py-2.5 px-3">ชั้น/ห้อง</th>
                        <th className="py-2.5 px-3">เพศ</th>
                        <th className="py-2.5 px-3 text-right">คะแนนพฤติกรรม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedModalStudents.map(st => {
                        const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
                        const room = st.room;
                        return (
                          <tr key={st.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                              {st.id}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {st.title || ''}{st.firstName} {st.lastName}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {grade}/{room}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  st.gender === 'M'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-pink-50 text-pink-700'
                                }`}
                              >
                                {st.gender === 'M' ? 'ชาย' : 'หญิง'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                              {st.currentScore ?? 100}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <Pagination
                    currentPage={modalPage}
                    totalItems={modalStudents.length}
                    pageSize={modalPageSize}
                    onPageChange={setModalPage}
                    onPageSizeChange={(newSize) => {
                      setModalPageSize(newSize);
                      setModalPage(1);
                    }}
                    pageSizeOptions={[25, 50, 75, 100, 'ALL']}
                    itemLabel="คน"
                  />
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                {viewingDorm.name}
              </span>
              <button
                type="button"
                onClick={() => setViewingDormId(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
