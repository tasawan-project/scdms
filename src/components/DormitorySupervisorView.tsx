import React, { useState, useMemo } from 'react';
import { Dormitory, DormitorySupervisor, AppUser, SystemSettings } from '../types';
import { getDormitorySupervisors } from '../utils/dormitoryLogic';
import { AddEditDormitoryTeacherModal } from './AddEditDormitoryTeacherModal';
import { Pagination } from './Pagination';
import {
  UserCheck,
  Building2,
  Plus,
  Edit,
  Trash2,
  Phone,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  DoorOpen,
  Users,
  ShieldCheck,
  PhoneCall
} from 'lucide-react';

interface DormitorySupervisorViewProps {
  dormitories: Dormitory[];
  currentUser: AppUser | null;
  systemSettings?: SystemSettings;
  onSaveDormitory: (dorm: Dormitory) => Promise<void>;
  onNavigateToTab?: (tab: 'ASSIGN' | 'LIST' | 'TEACHERS') => void;
}

interface TeacherRow extends DormitorySupervisor {
  dormitoryId: string;
  dormitoryName: string;
  dormitoryGender: string;
}

export const DormitorySupervisorView: React.FC<DormitorySupervisorViewProps> = ({
  dormitories = [],
  currentUser,
  systemSettings,
  onSaveDormitory,
  onNavigateToTab
}) => {
  const activeDorms = useMemo(() => {
    return [...dormitories].sort((a, b) => a.dormNumber - b.dormNumber);
  }, [dormitories]);

  // Modal states for Add / Edit teacher
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<(DormitorySupervisor & { dormitoryId?: string }) | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDormFilter, setSelectedDormFilter] = useState<string>('ALL');

  // Pagination state: 25, 50, 75, 100, ทั้งหมด
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedDormFilter, searchQuery, pageSize]);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Aggregate all teachers from all dormitories
  const allTeachers = useMemo(() => {
    const list: TeacherRow[] = [];
    activeDorms.forEach(dorm => {
      const sups = getDormitorySupervisors(dorm);
      sups.forEach(sup => {
        list.push({
          ...sup,
          dormitoryId: dorm.id,
          dormitoryName: dorm.name,
          dormitoryGender: dorm.gender
        });
      });
    });
    return list;
  }, [activeDorms]);

  // Filtered teachers list
  const filteredTeachers = useMemo(() => {
    return allTeachers.filter(t => {
      if (selectedDormFilter !== 'ALL' && t.dormitoryId !== selectedDormFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = t.name.toLowerCase().includes(q);
        const phoneMatch = (t.phone || '').toLowerCase().includes(q);
        const roleMatch = (t.role || '').toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !roleMatch) return false;
      }
      return true;
    });
  }, [allTeachers, selectedDormFilter, searchQuery]);

  const paginatedTeachers = useMemo(() => {
    if (pageSize >= 999999) return filteredTeachers;
    const start = (currentPage - 1) * pageSize;
    return filteredTeachers.slice(start, start + pageSize);
  }, [filteredTeachers, currentPage, pageSize]);

  // Handle Save (Add or Edit) Teacher
  const handleSaveTeacher = async (data: {
    id: string;
    name: string;
    phone?: string;
    role?: string;
    dormitoryId: string;
    previousDormitoryId?: string;
  }) => {
    setIsProcessing(true);
    setFeedback(null);

    try {
      const { id, name, phone, role, dormitoryId, previousDormitoryId } = data;

      // 1. If moved from another dormitory, remove from previous dormitory
      if (previousDormitoryId && previousDormitoryId !== dormitoryId) {
        const prevDorm = activeDorms.find(d => d.id === previousDormitoryId);
        if (prevDorm) {
          const currentSups = getDormitorySupervisors(prevDorm);
          const updatedSups = currentSups.filter(s => s.id !== id);
          const updatedPrevDorm: Dormitory = {
            ...prevDorm,
            supervisors: updatedSups,
            supervisorName: updatedSups[0]?.name || '',
            supervisorPhone: updatedSups[0]?.phone || '',
            updatedAt: new Date().toISOString()
          };
          await onSaveDormitory(updatedPrevDorm);
        }
      }

      // 2. Add or update in target dormitory
      const targetDorm = activeDorms.find(d => d.id === dormitoryId);
      if (!targetDorm) {
        throw new Error('ไม่พบหอพักที่ระบุ');
      }

      const currentSups = getDormitorySupervisors(targetDorm);
      const existsIndex = currentSups.findIndex(s => s.id === id);

      let updatedSups: DormitorySupervisor[];
      if (existsIndex >= 0) {
        updatedSups = [...currentSups];
        updatedSups[existsIndex] = { id, name, phone, role };
      } else {
        updatedSups = [...currentSups, { id, name, phone, role }];
      }

      const updatedTargetDorm: Dormitory = {
        ...targetDorm,
        supervisors: updatedSups,
        supervisorName: updatedSups[0]?.name || name,
        supervisorPhone: updatedSups[0]?.phone || phone || '',
        updatedAt: new Date().toISOString()
      };

      await onSaveDormitory(updatedTargetDorm);

      setFeedback({
        message: `บันทึกข้อมูลครูหอพัก "${name}" ประจำ "${targetDorm.name}" เรียบร้อยแล้ว`,
        type: 'success'
      });
      setIsModalOpen(false);
      setEditingTeacher(null);
    } catch (err: any) {
      setFeedback({
        message: 'เกิดข้อผิดพลาดในการบันทึก: ' + (err?.message || String(err)),
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Delete Teacher
  const handleDeleteTeacher = async (teacher: TeacherRow) => {
    if (!confirm(`คุณต้องการลบข้อมูลครูหอพัก "${teacher.name}" ออกจาก "${teacher.dormitoryName}" ใช่หรือไม่?`)) {
      return;
    }

    setIsProcessing(true);
    setFeedback(null);

    try {
      const dorm = activeDorms.find(d => d.id === teacher.dormitoryId);
      if (!dorm) throw new Error('ไม่พบข้อมูลหอพัก');

      const currentSups = getDormitorySupervisors(dorm);
      const updatedSups = currentSups.filter(s => s.id !== teacher.id);

      const updatedDorm: Dormitory = {
        ...dorm,
        supervisors: updatedSups,
        supervisorName: updatedSups[0]?.name || '',
        supervisorPhone: updatedSups[0]?.phone || '',
        updatedAt: new Date().toISOString()
      };

      await onSaveDormitory(updatedDorm);

      setFeedback({
        message: `ลบครูหอพัก "${teacher.name}" ออกจาก "${teacher.dormitoryName}" เรียบร้อยแล้ว`,
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({
        message: 'เกิดข้อผิดพลาดในการลบ: ' + (err?.message || String(err)),
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
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  ครูหอพัก
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  จัดการข้อมูลครูหอพัก เพิ่ม แก้ไข และลบครูผู้ดูแลประจำหอพักนักเรียน
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
                  onClick={() => onNavigateToTab('LIST')}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>รายชื่อหอพัก</span>
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-white text-indigo-700 font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 cursor-default"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>ครูหอพัก</span>
                </button>
              </div>
            )}

            {/* "+ เพิ่มครูหอพัก" Button */}
            <button
              type="button"
              onClick={() => {
                setEditingTeacher(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มครูหอพัก</span>
            </button>
          </div>
        </div>

        {/* 2. Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
          <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/70 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-indigo-900">ครูหอพักทั้งหมด</div>
              <div className="text-xl font-black text-indigo-700">
                {allTeachers.length} <span className="text-xs font-semibold text-indigo-600">คน</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-900">หอพักที่มีครูประจำ</div>
              <div className="text-xl font-black text-emerald-700">
                {activeDorms.filter(d => getDormitorySupervisors(d).length > 0).length} / {activeDorms.length} <span className="text-xs font-semibold text-emerald-600">หอ</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-amber-900">พร้อมเบอร์ติดต่อ</div>
              <div className="text-xl font-black text-amber-700">
                {allTeachers.filter(t => !!t.phone).length} <span className="text-xs font-semibold text-amber-600">คน</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Feedback Notification */}
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

      {/* 4. Filter & Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Dormitory Filter */}
        <div className="w-full sm:w-72">
          <select
            value={selectedDormFilter}
            onChange={e => setSelectedDormFilter(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 text-slate-800"
          >
            <option value="ALL">ทุกหอพัก ({allTeachers.length} คน)</option>
            {activeDorms.map(d => {
              const sups = getDormitorySupervisors(d);
              return (
                <option key={d.id} value={d.id}>
                  {d.name} ({sups.length} คน)
                </option>
              );
            })}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อครูหอพัก, เบอร์โทร, ตำแหน่ง..."
            className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 text-slate-800"
          />
        </div>
      </div>

      {/* 5. Teachers Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredTeachers.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
              <UserCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                ยังไม่มีข้อมูลครูหอพัก
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {allTeachers.length === 0
                  ? 'ยังไม่ได้เพิ่มครูหอพักในระบบ กดปุ่ม "+ เพิ่มครูหอพัก" เพื่อเริ่มต้นกำหนดครูประจำหอ'
                  : 'ไม่พบครูหอพักตามเงื่อนไขการค้นหาหรือหอพักที่เลือก'}
              </p>
            </div>
            {allTeachers.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  setEditingTeacher(null);
                  setIsModalOpen(true);
                }}
                className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มครูหอพักคนแรก</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                  <th className="py-3 px-4">สังกัดหอพัก</th>
                  <th className="py-3 px-4">ตำแหน่ง / หน้าที่</th>
                  <th className="py-3 px-4">เบอร์โทรศัพท์ติดต่อ</th>
                  <th className="py-3 px-4 w-32 text-right">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTeachers.map((teacher, idx) => (
                  <tr key={`${teacher.dormitoryId}-${teacher.id}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono">
                      {(pageSize >= 999999 ? 0 : (currentPage - 1) * pageSize) + idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                          {teacher.name.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            {teacher.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            รหัส: {teacher.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200/80 text-indigo-800 rounded-xl font-bold text-xs">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{teacher.dormitoryName}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs">
                        {teacher.role || 'ครูหอพักประจำ'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {teacher.phone ? (
                        <a
                          href={`tel:${teacher.phone}`}
                          className="inline-flex items-center gap-1.5 font-mono text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{teacher.phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">ไม่ได้ระบุเบอร์โทร</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeacher(teacher);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl transition-colors cursor-pointer"
                          title="แก้ไขข้อมูลครูหอพัก"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTeacher(teacher)}
                          className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                          title="ลบครูหอพัก"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Component */}
        {filteredTeachers.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredTeachers.length}
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

      {/* 6. Modal for Add / Edit Teacher */}
      {isModalOpen && (
        <AddEditDormitoryTeacherModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTeacher(null);
          }}
          teacher={editingTeacher}
          dormitories={activeDorms}
          onSave={handleSaveTeacher}
        />
      )}
    </div>
  );
};
