import React, { useState, useEffect } from 'react';
import {
  Dormitory,
  DormitoryType,
  DormitorySupervisor,
  DormitoryClassroomRule,
  GradeLevel,
  HomeroomAdvisor
} from '../types';
import {
  Building2,
  X,
  Plus,
  Trash2,
  UserCheck,
  Phone,
  Shield,
  Save,
  AlertCircle,
  Users,
  Check
} from 'lucide-react';

interface AddEditDormitoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  dormitory: Dormitory | null; // null = เพิ่มหอพักใหม่, Dormitory = แก้ไขหอพัก
  existingDorms: Dormitory[];
  onSave: (dorm: Dormitory) => Promise<void>;
  onDelete?: (dormId: string) => Promise<void>;
  homeroomAdvisors?: HomeroomAdvisor[];
}

const ALL_GRADES: GradeLevel[] = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

export const AddEditDormitoryModal: React.FC<AddEditDormitoryModalProps> = ({
  isOpen,
  onClose,
  dormitory,
  existingDorms,
  onSave,
  onDelete
}) => {
  const isEditing = !!dormitory;

  // Form states
  const [dormNumber, setDormNumber] = useState<number>(1);
  const [name, setName] = useState<string>('');
  const [gender, setGender] = useState<DormitoryType>('MIXED');
  const [capacity, setCapacity] = useState<number>(80);
  const [notes, setNotes] = useState<string>('');

  // Supervisors state: ครูหอพัก (เพิ่มเองได้มากกว่า 1 คน ไม่ปล่อยว่างไว้)
  const [supervisors, setSupervisors] = useState<DormitorySupervisor[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initialize or reset form when modal opens or dormitory changes
  useEffect(() => {
    if (!isOpen) return;

    if (dormitory) {
      // Edit mode
      setDormNumber(dormitory.dormNumber || 1);
      setName(dormitory.name || '');
      setGender(dormitory.gender || 'MIXED');
      setCapacity(dormitory.capacity || 80);
      setNotes(dormitory.notes || '');

      // Parse supervisors
      if (dormitory.supervisors && dormitory.supervisors.length > 0) {
        setSupervisors(
          dormitory.supervisors.map(s => ({
            id: s.id || `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: s.name || '',
            phone: s.phone || '',
            role: s.role || 'ครูหอพักประจำ'
          }))
        );
      } else if (dormitory.supervisorName) {
        setSupervisors([
          {
            id: `sup-${Date.now()}-1`,
            name: dormitory.supervisorName,
            phone: dormitory.supervisorPhone || '',
            role: 'หัวหน้าครูหอพัก'
          }
        ]);
      } else {
        setSupervisors([
          {
            id: `sup-${Date.now()}-1`,
            name: '',
            phone: '',
            role: 'หัวหน้าครูหอพัก'
          }
        ]);
      }
    } else {
      // New mode: auto-calculate next dorm number
      const highestNumber = existingDorms.reduce(
        (max, d) => (d.dormNumber > max ? d.dormNumber : max),
        0
      );
      const nextNumber = highestNumber + 1;
      setDormNumber(nextNumber);
      setName(`หอพัก ${nextNumber} (หอพักรวม)`);
      setGender('MIXED');
      setCapacity(80);
      setNotes('');

      // Start with 2 supervisor slots ready for user input (more than 1 person)
      setSupervisors([
        {
          id: `sup-${Date.now()}-1`,
          name: '',
          phone: '',
          role: 'หัวหน้าครูหอพัก'
        },
        {
          id: `sup-${Date.now()}-2`,
          name: '',
          phone: '',
          role: 'ครูหอพักประจำ'
        }
      ]);
    }
    setErrors({});
  }, [isOpen, dormitory, existingDorms]);

  // Handle Dormitory Type change with automatic assistance
  const handleTypeChange = (newType: DormitoryType) => {
    setGender(newType);
    const typeLabel =
      newType === 'MIXED' ? 'หอพักรวม' : newType === 'M' ? 'ชาย' : 'หญิง';
    if (!name || name.startsWith('หอพัก ')) {
      setName(`หอพัก ${dormNumber} (${typeLabel})`);
    }
  };

  // Add a new supervisor field
  const handleAddSupervisor = () => {
    const newIndex = supervisors.length + 1;
    const defaultRole = newIndex === 1 ? 'หัวหน้าครูหอพัก' : 'ครูหอพักประจำ';
    setSupervisors(prev => [
      ...prev,
      {
        id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        phone: '',
        role: defaultRole
      }
    ]);
  };

  // Remove a supervisor field
  const handleRemoveSupervisor = (id: string) => {
    if (supervisors.length <= 1) {
      setErrors(prev => ({
        ...prev,
        supervisors: 'ต้องมีครูหอพักอย่างน้อย 1 คน (ห้ามลบออกจนหมด)'
      }));
      return;
    }
    setSupervisors(prev => prev.filter(s => s.id !== id));
  };

  // Update specific supervisor field
  const handleUpdateSupervisor = (
    id: string,
    field: keyof DormitorySupervisor,
    value: string
  ) => {
    setSupervisors(prev =>
      prev.map(s => (s.id === id ? { ...s, [field]: value } : s))
    );
    if (field === 'name' && value.trim()) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[`sup_name_${id}`];
        delete next.supervisors;
        return next;
      });
    }
  };

  // Form submission with validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'กรุณาระบุชื่อหอพัก';
    }

    if (dormNumber <= 0) {
      newErrors.dormNumber = 'หมายเลขหอพักต้องมากกว่า 0';
    }

    // Validate supervisors: "ไม่มีปล่อยว่างไว้และครูหอพักมีมากกว่า 1 คน"
    if (supervisors.length === 0) {
      newErrors.supervisors = 'กรุณาเพิ่มครูผู้ดูแลหอพักอย่างน้อย 1 คน';
    } else {
      let hasBlank = false;
      supervisors.forEach((s, idx) => {
        if (!s.name || s.name.trim() === '') {
          newErrors[`sup_name_${s.id}`] = `กรุณากรอกชื่อครูหอพักคนที่ ${idx + 1} (ห้ามปล่อยว่างไว้)`;
          hasBlank = true;
        }
      });
      if (hasBlank) {
        newErrors.supervisors = 'ครูหอพักต้องระบุชื่อ-สกุลให้ครบถ้วนทุกช่อง (ห้ามปล่อยว่างไว้)';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      const cleanedSupervisors = supervisors.map(s => ({
        ...s,
        name: s.name.trim(),
        phone: s.phone?.trim() || '',
        role: s.role?.trim() || 'ครูหอพักประจำ'
      }));

      const dormId = dormitory ? dormitory.id : `dorm-${dormNumber}`;
      const existingAssignedGrades = dormitory?.assignedGrades || ALL_GRADES;
      const existingAssignedRooms = dormitory?.assignedRooms || [];

      const builtClassroomRules: DormitoryClassroomRule[] = existingAssignedGrades.map(g => ({
        grade: g,
        gender: gender,
        rooms: existingAssignedRooms
      }));

      const updatedDorm: Dormitory = {
        id: dormId,
        dormNumber,
        name: name.trim(),
        gender: gender,
        assignedGrades: existingAssignedGrades,
        assignedRooms: existingAssignedRooms,
        assignedClassrooms: dormitory?.assignedClassrooms || builtClassroomRules,
        gradeGenderRules: dormitory?.gradeGenderRules || builtClassroomRules,
        capacity: Number(capacity) || 80,
        supervisors: cleanedSupervisors,
        supervisorName: cleanedSupervisors[0]?.name || '',
        supervisorPhone: cleanedSupervisors[0]?.phone || '',
        notes: notes.trim(),
        createdAt: dormitory?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // ปิดกล่องรับข้อมูลทันทีเมื่อกดบันทึกข้อมูล
      onClose();

      // บันทึกข้อมูลหอพักแบบเบื้องหลัง
      onSave(updatedDorm).catch((err: any) => {
        console.error('Error saving dormitory:', err);
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลหอพัก: ' + (err?.message || ''));
      });
    } catch (err: any) {
      setErrors({ form: 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!dormitory || !onDelete) return;
    if (
      window.confirm(
        `คุณแน่ใจหรือไม่ว่าต้องการลบ "${dormitory.name}" ออกจากระบบ? นักเรียนที่เคยผูกกับหอพักนี้จะถูกปลดออก`
      )
    ) {
      // ปิดกล่องรับข้อมูลทันที
      onClose();

      // ดำเนินการลบแบบเบื้องหลัง
      onDelete(dormitory.id).catch((err: any) => {
        console.error('Error deleting dormitory:', err);
        alert('เกิดข้อผิดพลาดในการลบ: ' + (err?.message || ''));
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0 ${
                gender === 'MIXED'
                  ? 'bg-gradient-to-br from-purple-600 to-indigo-700'
                  : gender === 'M'
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-700'
                  : 'bg-gradient-to-br from-pink-600 to-rose-600'
              }`}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900">
                  {isEditing ? `แก้ไขข้อมูล: ${dormitory.name}` : 'เพิ่มหอพักนักเรียนใหม่'}
                </h3>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    gender === 'MIXED'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : gender === 'M'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-pink-50 text-pink-700 border-pink-200'
                  }`}
                >
                  {gender === 'MIXED'
                    ? 'หอพักรวม (M/F)'
                    : gender === 'M'
                    ? 'หอพักชาย (M)'
                    : 'หอพักหญิง (F)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                กำหนดประเภทหอพัก หมายเลข ชื่อ และรายชื่อครูผู้ดูแลหอพักประจำ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 text-xs sm:text-sm max-h-[80vh] overflow-y-auto">
          {errors.form && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.form}</span>
            </div>
          )}

          {/* Section 1: ประเภทหอพัก (3 ประเภท) */}
          <div className="space-y-2">
            <label className="block font-black text-slate-800 text-xs uppercase tracking-wider">
              ประเภทหอพัก (3 ประเภท) <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* ประเภท 1: หอพักรวม (M)(F) */}
              <button
                type="button"
                onClick={() => handleTypeChange('MIXED')}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer relative ${
                  gender === 'MIXED'
                    ? 'border-purple-600 bg-purple-50/70 shadow-xs ring-2 ring-purple-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-purple-900 text-xs sm:text-sm">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    <span>1. หอพักรวม (M)(F)</span>
                  </div>
                  {gender === 'MIXED' && <Check className="w-4 h-4 text-purple-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  รับทั้งนักเรียนชาย (M) และหญิง (F)
                </p>
              </button>

              {/* ประเภท 2: หอพักชาย (M) */}
              <button
                type="button"
                onClick={() => handleTypeChange('M')}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer relative ${
                  gender === 'M'
                    ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-blue-900 text-xs sm:text-sm">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>2. หอพักชาย (M)</span>
                  </div>
                  {gender === 'M' && <Check className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  สำหรับนักเรียนชาย (M) เท่านั้น
                </p>
              </button>

              {/* ประเภท 3: หอพักหญิง (F) */}
              <button
                type="button"
                onClick={() => handleTypeChange('F')}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer relative ${
                  gender === 'F'
                    ? 'border-pink-600 bg-pink-50/70 shadow-xs ring-2 ring-pink-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-pink-900 text-xs sm:text-sm">
                    <span className="w-2 h-2 rounded-full bg-pink-600" />
                    <span>3. หอพักหญิง (F)</span>
                  </div>
                  {gender === 'F' && <Check className="w-4 h-4 text-pink-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  สำหรับนักเรียนหญิง (F) เท่านั้น
                </p>
              </button>
            </div>
          </div>

          {/* Section 2: ข้อมูลพื้นฐาน (หมายเลข, ชื่อ, ความจุ) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                หมายเลขหอพัก <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={dormNumber}
                onChange={e => {
                  const num = parseInt(e.target.value) || 1;
                  setDormNumber(num);
                  if (!name || name.startsWith('หอพัก ')) {
                    const typeLabel =
                      gender === 'MIXED' ? 'หอพักรวม' : gender === 'M' ? 'ชาย' : 'หญิง';
                    setName(`หอพัก ${num} (${typeLabel})`);
                  }
                }}
                required
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                  errors.dormNumber ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                }`}
              />
              {errors.dormNumber && (
                <span className="text-[11px] text-rose-500 mt-0.5 block">{errors.dormNumber}</span>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                ชื่อหอพัก <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="เช่น หอพัก 7 (หอพักรวม), หอพัก 1 (ชาย)"
                required
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                  errors.name ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                }`}
              />
              {errors.name && (
                <span className="text-[11px] text-rose-500 mt-0.5 block">{errors.name}</span>
              )}
            </div>
          </div>

          {/* Section 3: ความจุและหมายเหตุ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                ความจุเตียง/คน (คน)
              </label>
              <input
                type="number"
                min="1"
                value={capacity}
                onChange={e => setCapacity(parseInt(e.target.value) || 80)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                หมายเหตุ / คำอธิบาย
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="เช่น อาคารหอพักฝั่งตะวันออก หรือ หอพักปรับปรุงใหม่"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 4: ครูผู้ดูแลหอพัก (เพิ่มเองได้มากกว่า 1 คน และห้ามปล่อยว่างไว้) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-amber-950 text-xs sm:text-sm">
                    ครูผู้ดูแลหอพัก (เพิ่มเองได้มากกว่า 1 คน)
                  </h4>
                  <p className="text-[11px] text-amber-800">
                    ห้ามปล่อยว่างไว้ กรุณาระบุชื่อ-นามสกุลครูผู้ดูแลหอพักให้ครบถ้วน
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddSupervisor}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ เพิ่มครูหอพักอีกคน</span>
              </button>
            </div>

            {errors.supervisors && (
              <div className="p-2.5 bg-rose-100/80 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errors.supervisors}</span>
              </div>
            )}

            {/* List of Supervisors */}
            <div className="space-y-2.5">
              {supervisors.map((sup, index) => {
                const nameError = errors[`sup_name_${sup.id}`];
                return (
                  <div
                    key={sup.id}
                    className="p-3 bg-white rounded-xl border border-amber-200/90 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                        ครูหอพักคนที่ {index + 1}
                      </span>
                      {supervisors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSupervisor(sup.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="ลบครูคนนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Name (Required, no blank allowed) */}
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          ชื่อ-นามสกุล <span className="text-rose-500">* ห้ามว่าง</span>
                        </label>
                        <input
                          type="text"
                          value={sup.name}
                          onChange={e =>
                            handleUpdateSupervisor(sup.id, 'name', e.target.value)
                          }
                          placeholder="เช่น ครูสมศักดิ์ วินัยเด่น"
                          className={`w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                            nameError ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                          }`}
                        />
                        {nameError && (
                          <span className="text-[10px] text-rose-500 font-bold block mt-0.5">
                            {nameError}
                          </span>
                        )}
                      </div>

                      {/* Phone */}
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          เบอร์โทรศัพท์
                        </label>
                        <input
                          type="text"
                          value={sup.phone || ''}
                          onChange={e =>
                            handleUpdateSupervisor(sup.id, 'phone', e.target.value)
                          }
                          placeholder="08x-xxx-xxxx"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>

                      {/* Role */}
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          ตำแหน่ง / หน้าที่
                        </label>
                        <input
                          type="text"
                          value={sup.role || ''}
                          onChange={e =>
                            handleUpdateSupervisor(sup.id, 'role', e.target.value)
                          }
                          placeholder="เช่น หัวหน้าครูหอพัก, ครูประจำ"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <div>
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting || isSubmitting}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeleting ? 'กำลังลบ...' : 'ลบหอพัก'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูลหอพัก'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
