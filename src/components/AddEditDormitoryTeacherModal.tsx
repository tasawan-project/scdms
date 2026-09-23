import React, { useState, useEffect } from 'react';
import { Dormitory, DormitorySupervisor } from '../types';
import { X, UserCheck, Phone, Save, AlertCircle, Building2, Shield } from 'lucide-react';

interface AddEditDormitoryTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: (DormitorySupervisor & { dormitoryId?: string }) | null; // null = เพิ่มใหม่, object = แก้ไข
  dormitories: Dormitory[];
  onSave: (teacherData: {
    id: string;
    name: string;
    phone?: string;
    role?: string;
    dormitoryId: string;
    previousDormitoryId?: string;
  }) => Promise<void>;
}

const COMMON_ROLES = [
  'หัวหน้าครูหอพัก',
  'ครูหอพักประจำ',
  'ครูเวรหอพัก',
  'ผู้ช่วยครูหอพัก',
  'ครูผู้ดูแล'
];

export const AddEditDormitoryTeacherModal: React.FC<AddEditDormitoryTeacherModalProps> = ({
  isOpen,
  onClose,
  teacher,
  dormitories = [],
  onSave
}) => {
  const isEditing = !!teacher;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('ครูหอพักประจำ');
  const [dormitoryId, setDormitoryId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (teacher) {
      setName(teacher.name || '');
      setPhone(teacher.phone || '');
      setRole(teacher.role || 'ครูหอพักประจำ');
      setDormitoryId(teacher.dormitoryId || (dormitories[0]?.id ?? ''));
    } else {
      setName('');
      setPhone('');
      setRole('ครูหอพักประจำ');
      setDormitoryId(dormitories[0]?.id ?? '');
    }
    setError('');
  }, [isOpen, teacher, dormitories]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('กรุณากรอกชื่อ-นามสกุลครูหอพัก');
      return;
    }

    if (!dormitoryId) {
      setError('กรุณาเลือกหอพักที่สังกัด');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const teacherId = teacher?.id || `sup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await onSave({
        id: teacherId,
        name: trimmedName,
        phone: phone.trim() || undefined,
        role: role.trim() || 'ครูหอพักประจำ',
        dormitoryId,
        previousDormitoryId: teacher?.dormitoryId
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                {isEditing ? 'แก้ไขข้อมูลครูหอพัก' : 'เพิ่มครูหอพักใหม่'}
              </h3>
              <p className="text-xs text-indigo-100/90 font-medium">
                {isEditing ? 'ปรับปรุงข้อมูลครูผู้ดูแลและหอพักที่สังกัด' : 'กำหนดครูผู้ดูแลประจำหอพักนักเรียน'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* ชื่อ-นามสกุล */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ชื่อ-นามสกุล ครูหอพัก <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="เช่น นายสมศักดิ์ รักเรียน หรือ ครูวิภา สดใส"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                required
              />
            </div>
          </div>

          {/* สังกัดหอพัก */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              สังกัดหอพัก <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={dormitoryId}
                onChange={e => setDormitoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                required
              >
                <option value="" disabled>-- เลือกหอพัก --</option>
                {dormitories.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.gender === 'M' ? 'หอชาย' : d.gender === 'F' ? 'หอหญิง' : 'หอรวม'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ตำแหน่ง / หน้าที่ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ตำแหน่ง / หน้าที่
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="ระบุตำแหน่ง เช่น หัวหน้าครูหอพัก"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
              />
              {/* Quick Select Badges */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COMMON_ROLES.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      role === r
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* เบอร์โทรศัพท์ติดต่อ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              เบอร์โทรศัพท์ติดต่อ
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="เช่น 081-234-5678"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'กำลังบันทึก...' : isEditing ? 'บันทึกการแก้ไข' : 'เพิ่มครูหอพัก'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
