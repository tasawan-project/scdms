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
  Check,
  Info,
  Sparkles,
  SlidersHorizontal,
  CheckCircle2
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
const STANDARD_ROOMS = [1, 2, 3, 4, 5, 6, 7, 8];

export const AddEditDormitoryModal: React.FC<AddEditDormitoryModalProps> = ({
  isOpen,
  onClose,
  dormitory,
  existingDorms,
  onSave,
  onDelete,
  homeroomAdvisors = []
}) => {
  const isEditing = !!dormitory;

  // Form states
  const [dormNumber, setDormNumber] = useState<number>(1);
  const [name, setName] = useState<string>('');
  const [gender, setGender] = useState<DormitoryType>('MIXED');
  const [capacity, setCapacity] = useState<number>(80);
  const [assignedGrades, setAssignedGrades] = useState<GradeLevel[]>(['ม.1']);
  const [assignedRooms, setAssignedRooms] = useState<number[]>([]);
  const [notes, setNotes] = useState<string>('');

  // Grade-specific gender rules: e.g. ม.1 MIXED, ม.2 F, ม.3 F
  const [gradeRules, setGradeRules] = useState<
    Record<GradeLevel, { gender: DormitoryType; rooms: number[] }>
  >({
    'ม.1': { gender: 'MIXED', rooms: [] },
    'ม.2': { gender: 'MIXED', rooms: [] },
    'ม.3': { gender: 'MIXED', rooms: [] },
    'ม.4': { gender: 'MIXED', rooms: [] },
    'ม.5': { gender: 'MIXED', rooms: [] },
    'ม.6': { gender: 'MIXED', rooms: [] }
  });

  // Supervisors state: ครูหอพัก (ต้องการเพิ่มเอง ไม่มีปล่อยว่างไว้ และครูหอพักมีมากกว่า 1 คน)
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
      setGender(dormitory.gender || 'M');
      setCapacity(dormitory.capacity || 80);
      setAssignedGrades(dormitory.assignedGrades || ['ม.1']);
      setAssignedRooms(dormitory.assignedRooms || []);
      setNotes(dormitory.notes || '');

      // Load grade rules
      const initialRules: Record<GradeLevel, { gender: DormitoryType; rooms: number[] }> = {
        'ม.1': { gender: 'MIXED', rooms: [] },
        'ม.2': { gender: 'MIXED', rooms: [] },
        'ม.3': { gender: 'MIXED', rooms: [] },
        'ม.4': { gender: 'MIXED', rooms: [] },
        'ม.5': { gender: 'MIXED', rooms: [] },
        'ม.6': { gender: 'MIXED', rooms: [] }
      };

      const rulesSource = dormitory.gradeGenderRules || dormitory.assignedClassrooms || [];
      ALL_GRADES.forEach(g => {
        const found = rulesSource.find(r => r.grade === g);
        if (found) {
          initialRules[g] = {
            gender: found.gender || dormitory.gender || 'MIXED',
            rooms: found.rooms || []
          };
        } else {
          initialRules[g] = {
            gender: dormitory.gender || 'MIXED',
            rooms: dormitory.assignedRooms || []
          };
        }
      });
      setGradeRules(initialRules);

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
        // Start with at least 1 empty entry for the user to fill
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
      setAssignedGrades(['ม.1']);
      setAssignedRooms([]);
      setNotes('');

      const defaultRules: Record<GradeLevel, { gender: DormitoryType; rooms: number[] }> = {
        'ม.1': { gender: 'MIXED', rooms: [] },
        'ม.2': { gender: 'MIXED', rooms: [] },
        'ม.3': { gender: 'MIXED', rooms: [] },
        'ม.4': { gender: 'MIXED', rooms: [] },
        'ม.5': { gender: 'MIXED', rooms: [] },
        'ม.6': { gender: 'MIXED', rooms: [] }
      };
      setGradeRules(defaultRules);

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

    // Also update default gender of all grade rules to match
    setGradeRules(prev => {
      const next = { ...prev };
      ALL_GRADES.forEach(g => {
        next[g] = {
          gender: newType,
          rooms: next[g]?.rooms || []
        };
      });
      return next;
    });
  };

  // Preset based on exact user prompt: ม.1 ทั้งชายและหญิง, ม.2 หญิง, ม.3 หญิง
  const handleApplyUserExample = () => {
    setGender('MIXED');
    setAssignedGrades(['ม.1', 'ม.2', 'ม.3']);
    setGradeRules(prev => ({
      ...prev,
      'ม.1': { gender: 'MIXED', rooms: [] },
      'ม.2': { gender: 'F', rooms: [] },
      'ม.3': { gender: 'F', rooms: [] }
    }));
    setName(`หอพัก ${dormNumber} (หอพักรวม - ม.1 รวม / ม.2-3 หญิง)`);
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

  // Update a supervisor field
  const handleUpdateSupervisor = (
    id: string,
    field: keyof DormitorySupervisor,
    value: string
  ) => {
    setSupervisors(prev =>
      prev.map(s => (s.id === id ? { ...s, [field]: value } : s))
    );
    // Clear error for supervisors if fixed
    if (field === 'name' && value.trim()) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[`sup_name_${id}`];
        delete next.supervisors;
        return next;
      });
    }
  };

  // Form submission with strict validation:
  // "ครูหอพัก ต้องการเพิ่มเอง ไม่มีปล่อยว่างไว้และครูหอพักมีมากกว่า 1 คน"
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'กรุณาระบุชื่อหอพัก';
    }

    if (dormNumber <= 0) {
      newErrors.dormNumber = 'หมายเลขหอพักต้องมากกว่า 0';
    }

    if (assignedGrades.length === 0) {
      newErrors.assignedGrades = 'กรุณาเลือกระดับชั้นที่สังกัดหอพักอย่างน้อย 1 ระดับชั้น';
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

      // Build structured grade rules
      const builtClassroomRules: DormitoryClassroomRule[] = assignedGrades.map(g => ({
        grade: g,
        gender: gradeRules[g]?.gender || gender,
        rooms: (gradeRules[g]?.rooms && gradeRules[g].rooms.length > 0)
          ? gradeRules[g].rooms
          : (assignedRooms || [])
      }));

      // Calculate effective overall dorm gender based on grade rules
      const hasMale = builtClassroomRules.some(r => r.gender === 'M' || r.gender === 'MIXED');
      const hasFemale = builtClassroomRules.some(r => r.gender === 'F' || r.gender === 'MIXED');
      let effectiveGender: DormitoryType = gender;
      if (hasMale && hasFemale) {
        effectiveGender = 'MIXED';
      } else if (hasMale && !hasFemale) {
        effectiveGender = 'M';
      } else if (hasFemale && !hasMale) {
        effectiveGender = 'F';
      }

      const updatedDorm: Dormitory = {
        id: dormId,
        dormNumber,
        name: name.trim(),
        gender: effectiveGender,
        assignedGrades,
        assignedRooms,
        assignedClassrooms: builtClassroomRules,
        gradeGenderRules: builtClassroomRules,
        capacity: Number(capacity) || 80,
        supervisors: cleanedSupervisors,
        supervisorName: cleanedSupervisors[0]?.name || '',
        supervisorPhone: cleanedSupervisors[0]?.phone || '',
        notes: notes.trim(),
        createdAt: dormitory?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSave(updatedDorm);
      onClose();
    } catch (err: any) {
      setErrors({ form: 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!dormitory || !onDelete) return;
    if (
      window.confirm(
        `คุณแน่ใจหรือไม่ว่าต้องการลบ "${dormitory.name}" ออกจากระบบ? นักเรียนที่เคยผูกกับหอพักนี้จะถูกปลดออก`
      )
    ) {
      try {
        setIsDeleting(true);
        await onDelete(dormitory.id);
        onClose();
      } catch (err: any) {
        alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 transition-all">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-indigo-50/40 to-white">
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
                กำหนดประเภทหอพัก ระดับชั้น/ห้อง และรายชื่อครูผู้ดูแลหอพักประจำ
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

          {/* Section 1: ประเภทหอพัก (3 ประเภท ตามที่ผู้ใช้ต้องการ) */}
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

          {/* Section 3: ครูผู้ดูแลหอพัก (สำคัญ: เพิ่มเองได้มากกว่า 1 คน และห้ามปล่อยว่างไว้) */}
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

            {/* Quick-suggest teachers from HomeroomAdvisors if available */}
            {homeroomAdvisors.length > 0 && (
              <div className="pt-2 border-t border-amber-200/60">
                <span className="text-[11px] text-slate-500 block mb-1 font-medium">
                  💡 หรือเลือกเร็วจากรายชื่อครูในระบบ:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                  {homeroomAdvisors.slice(0, 10).map(adv => (
                    <button
                      type="button"
                      key={adv.id}
                      onClick={() => {
                        // Fill into first empty or add new
                        const emptySlot = supervisors.find(s => !s.name.trim());
                        if (emptySlot) {
                          handleUpdateSupervisor(emptySlot.id, 'name', adv.fullName);
                          if (adv.phone) handleUpdateSupervisor(emptySlot.id, 'phone', adv.phone);
                        } else {
                          setSupervisors(prev => [
                            ...prev,
                            {
                              id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                              name: adv.fullName,
                              phone: adv.phone || '',
                              role: 'ครูหอพักประจำ'
                            }
                          ]);
                        }
                      }}
                      className="text-[10px] bg-white hover:bg-amber-100 text-slate-700 border border-amber-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                    >
                      + {adv.fullName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: ระดับชั้นที่สังกัดหอพัก (ม.1 - ม.6) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-700">
                ระดับชั้นที่สังกัดหอพักนี้ <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssignedGrades(['ม.1', 'ม.2', 'ม.3'])}
                  className="text-[11px] text-indigo-600 hover:underline font-bold"
                >
                  ม.ต้น
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setAssignedGrades(['ม.4', 'ม.5', 'ม.6'])}
                  className="text-[11px] text-indigo-600 hover:underline font-bold"
                >
                  ม.ปลาย
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setAssignedGrades([...ALL_GRADES])}
                  className="text-[11px] text-indigo-600 hover:underline font-bold"
                >
                  ทั้งหมด
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {ALL_GRADES.map(grade => {
                const isSelected = assignedGrades.includes(grade);
                return (
                  <button
                    type="button"
                    key={grade}
                    onClick={() => {
                      setAssignedGrades(prev =>
                        isSelected
                          ? prev.filter(g => g !== grade)
                          : [...prev, grade].sort()
                      );
                    }}
                    className={`py-2 rounded-xl font-bold transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {grade}
                  </button>
                );
              })}
            </div>
            {errors.assignedGrades && (
              <span className="text-[11px] text-rose-500 font-bold block">
                {errors.assignedGrades}
              </span>
            )}
          </div>

          {/* Section 4.5: กำหนดเพศที่รับในแต่ละระดับชั้น (Grade-specific Gender Rules) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200/90 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-indigo-950 text-xs sm:text-sm flex items-center gap-2">
                    <span>กำหนดเพศที่รับแยกตามระดับชั้น</span>
                    <span className="text-[10px] bg-indigo-200/70 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                      ละเอียดตามระดับชั้น
                    </span>
                  </h4>
                  <p className="text-[11px] text-indigo-700">
                    กำหนดได้ว่าแต่ละระดับชั้นรับเฉพาะเพศใด เช่น ม.1 รับทั้งชายและหญิง, ม.2 และ ม.3 รับเฉพาะหญิง
                  </p>
                </div>
              </div>

              {/* User Example Preset Button */}
              <button
                type="button"
                onClick={handleApplyUserExample}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs shrink-0"
                title="คลิกเพื่อตั้งค่าตัวอย่าง: ม.1 รับทั้งชายและหญิง, ม.2 และ ม.3 รับเฉพาะหญิง"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>ใช้ตัวอย่าง: ม.1 รวม / ม.2-3 หญิง</span>
              </button>
            </div>

            {/* Quick Batch Change for selected grades */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-indigo-200/60 text-[11px]">
              <span className="font-bold text-slate-700">ตั้งค่าทุกชั้นที่เลือกเป็น:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setGradeRules(prev => {
                      const next = { ...prev };
                      assignedGrades.forEach(g => {
                        next[g] = { ...(next[g] || { rooms: [] }), gender: 'MIXED' };
                      });
                      return next;
                    });
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-bold cursor-pointer transition-colors shadow-2xs"
                >
                  ⚥ ทั้งชายและหญิง (รวม)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGradeRules(prev => {
                      const next = { ...prev };
                      assignedGrades.forEach(g => {
                        next[g] = { ...(next[g] || { rooms: [] }), gender: 'M' };
                      });
                      return next;
                    });
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold cursor-pointer transition-colors shadow-2xs"
                >
                  ♂ เฉพาะชาย (M)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGradeRules(prev => {
                      const next = { ...prev };
                      assignedGrades.forEach(g => {
                        next[g] = { ...(next[g] || { rooms: [] }), gender: 'F' };
                      });
                      return next;
                    });
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-pink-50 text-pink-700 border border-pink-200 rounded-lg font-bold cursor-pointer transition-colors shadow-2xs"
                >
                  ♀ เฉพาะหญิง (F)
                </button>
              </div>
            </div>

            {/* List of Grade Cards */}
            <div className="space-y-2 pt-1">
              {assignedGrades.length === 0 ? (
                <div className="p-3 bg-white/70 rounded-xl text-center text-xs text-slate-400 italic">
                  กรุณาเลือกระดับชั้นด้านบนก่อน เพื่อกำหนดเพศที่รับในแต่ละชั้น
                </div>
              ) : (
                assignedGrades.map(grade => {
                  const rule = gradeRules[grade] || { gender: gender || 'MIXED', rooms: [] };
                  const currentGender = rule.gender || 'MIXED';

                  return (
                    <div
                      key={grade}
                      className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                          {grade}
                        </span>
                        <div>
                          <div className="font-bold text-slate-800 text-xs sm:text-sm">
                            ระดับชั้น {grade}
                          </div>
                          <div className="text-[11px] mt-0.5">
                            {currentGender === 'MIXED' ? (
                              <span className="text-purple-700 font-bold bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                <span>⚥ รับนักเรียน {grade} ทั้งหมด ทั้งชายและหญิง</span>
                              </span>
                            ) : currentGender === 'M' ? (
                              <span className="text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                <span>♂ รับเฉพาะนักเรียนชาย {grade} ทั้งหมด</span>
                              </span>
                            ) : (
                              <span className="text-pink-700 font-bold bg-pink-50 border border-pink-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                <span>♀ รับเฉพาะนักเรียนหญิง {grade} ทั้งหมด</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Gender Toggle for this Grade */}
                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setGradeRules(prev => ({
                              ...prev,
                              [grade]: {
                                ...(prev[grade] || { rooms: [] }),
                                gender: 'MIXED'
                              }
                            }));
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            currentGender === 'MIXED'
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-purple-700 hover:bg-slate-200/60'
                          }`}
                        >
                          ⚥ ชายและหญิง
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setGradeRules(prev => ({
                              ...prev,
                              [grade]: {
                                ...(prev[grade] || { rooms: [] }),
                                gender: 'M'
                              }
                            }));
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            currentGender === 'M'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-blue-700 hover:bg-slate-200/60'
                          }`}
                        >
                          ♂ เฉพาะชาย
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setGradeRules(prev => ({
                              ...prev,
                              [grade]: {
                                ...(prev[grade] || { rooms: [] }),
                                gender: 'F'
                              }
                            }));
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            currentGender === 'F'
                              ? 'bg-pink-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-pink-700 hover:bg-slate-200/60'
                          }`}
                        >
                          ♀ เฉพาะหญิง
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 5: ห้องเรียนที่สังกัดหอพัก (เว้นว่างไว้ = รับทุกห้อง) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-700">
                ห้องเรียนที่สังกัด (เว้นว่างไว้ = รับทุกห้อง)
              </label>
              <button
                type="button"
                onClick={() =>
                  setAssignedRooms(
                    assignedRooms.length === STANDARD_ROOMS.length ? [] : [...STANDARD_ROOMS]
                  )
                }
                className="text-[11px] text-indigo-600 hover:underline font-bold"
              >
                {assignedRooms.length === STANDARD_ROOMS.length
                  ? 'ล้างห้อง (รับทุกห้อง)'
                  : 'เลือกห้อง 1-8 ทั้งหมด'}
              </button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {STANDARD_ROOMS.map(roomNum => {
                const isSelected = assignedRooms.includes(roomNum);
                return (
                  <button
                    type="button"
                    key={roomNum}
                    onClick={() => {
                      setAssignedRooms(prev =>
                        isSelected
                          ? prev.filter(r => r !== roomNum)
                          : [...prev, roomNum].sort((a, b) => a - b)
                      );
                    }}
                    className={`py-1.5 rounded-lg font-mono font-bold transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    ห้อง {roomNum}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] text-slate-500 block">
              {assignedRooms.length === 0
                ? '✨ รับนักเรียนทุกห้องเรียนในระดับชั้นที่เลือก'
                : `เฉพาะห้องเรียน: ${assignedRooms.join(', ')}`}
            </span>
          </div>

          {/* Section 6: ความจุและหมายเหตุ */}
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
                placeholder="เช่น หอพักนักเรียน ม.ต้น หรือ อาคาร 3"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSubmitting}
                className="px-3.5 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'กำลังลบ...' : 'ลบหอพักนี้'}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isDeleting}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="px-5 py-2 text-white bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกหอพัก'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
