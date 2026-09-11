import React, { useState } from 'react';
import { Student, AppUser, StudentAccessGrant } from '../types';
import {
  ShieldCheck,
  UserCheck,
  X,
  CheckCircle2,
  Calendar,
  User,
  Clock,
  HelpCircle,
  FileText
} from 'lucide-react';

interface GrantAccessModalProps {
  isOpen?: boolean;
  student: Student;
  currentUser: AppUser;
  onClose: () => void;
  onGrantAccess?: (grant: StudentAccessGrant) => Promise<void> | void;
  onGrantSuccess?: (grant: StudentAccessGrant) => Promise<void> | void;
}

export const GrantAccessModal: React.FC<GrantAccessModalProps> = ({
  isOpen = true,
  student,
  currentUser,
  onClose,
  onGrantAccess,
  onGrantSuccess
}) => {
  const [reason, setReason] = useState('นักเรียนขอตรวจสอบคะแนนความประพฤติและประวัติพฤติกรรม');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState<'1_DAY' | '7_DAYS' | 'SEMESTER' | 'PERMANENT'>('SEMESTER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  if (isOpen === false) return null;

  const calculateExpiry = () => {
    const now = new Date();
    if (duration === '1_DAY') {
      now.setDate(now.getDate() + 1);
      return now.toISOString();
    }
    if (duration === '7_DAYS') {
      now.setDate(now.getDate() + 7);
      return now.toISOString();
    }
    if (duration === 'SEMESTER') {
      now.setMonth(now.getMonth() + 5);
      return now.toISOString();
    }
    return undefined; // Permanent
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const grant: StudentAccessGrant = {
      id: `grant-${student.id}-${Date.now()}`,
      studentId: student.id,
      studentName: `${student.title}${student.firstName} ${student.lastName}`,
      grantedByUserId: currentUser.username,
      grantedByUserName: currentUser.name,
      grantedByUserRole: currentUser.role,
      grantedAt: new Date().toISOString(),
      expiresAt: calculateExpiry(),
      isActive: true,
      reason: reason.trim(),
      notes: notes.trim() || undefined
    };

    try {
      if (onGrantAccess) await onGrantAccess(grant);
      if (onGrantSuccess) await onGrantSuccess(grant);
      setSuccessMsg(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-indigo-900 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-700 text-white flex items-center justify-center shadow-inner">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                อนุญาตให้นักเรียนเปิดดูคะแนน
              </h3>
              <p className="text-xs text-indigo-200 mt-0.5">
                บันทึกประวัติผู้อนุญาตและวันเวลาที่ให้สิทธิ์โดยอัตโนมัติ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">
              บันทึกการอนุญาตสำเร็จ
            </h4>
            <p className="text-xs text-slate-500">
              นักเรียนรหัส {student.id} สามารถตรวจสอบคะแนนได้แล้ว
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Student Card Summary */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">นักเรียนที่ขอเปิดสิทธิ์</span>
                <p className="font-bold text-sm text-slate-900">
                  {student.title}{student.firstName} {student.lastName}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  รหัสประจำตัว: {student.id} • ห้อง {student.room}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-400 uppercase">คะแนนปัจจุบัน</span>
                <p className="text-lg font-black font-mono text-indigo-600">
                  {student.currentScore}
                </p>
              </div>
            </div>

            {/* Grantor Info */}
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>ผู้อนุญาต: <strong>{currentUser.name}</strong></span>
              </span>
              <span className="px-2 py-0.5 bg-indigo-200/80 rounded-md font-bold text-[10px] text-indigo-950">
                {currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : currentUser.role === 'staff' ? 'เจ้าหน้าที่ฝ่ายปกครอง' : 'ครูผู้สอน/ที่ปรึกษา'}
              </span>
            </div>

            {/* Duration Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                ระยะเวลาที่อนุญาตให้ดู
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: '1_DAY', label: '1 วัน' },
                  { id: '7_DAYS', label: '7 วัน' },
                  { id: 'SEMESTER', label: 'ตลอดภาคเรียน' },
                  { id: 'PERMANENT', label: 'ตลอดไป' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDuration(opt.id as any)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      duration === opt.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                เหตุผลในการขอเปิดสิทธิ์
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
              >
                <option value="นักเรียนขอตรวจสอบคะแนนความประพฤติและประวัติพฤติกรรม">
                  นักเรียนขอตรวจสอบคะแนนความประพฤติและประวัติพฤติกรรม
                </option>
                <option value="ครูที่ปรึกษาเปิดสิทธิ์ให้ตรวจสอบประจำสัปดาห์">
                  ครูที่ปรึกษาเปิดสิทธิ์ให้ตรวจสอบประจำสัปดาห์
                </option>
                <option value="ผู้ปกครองติดต่อขอตรวจสอบข้อมูลร่วมกับนักเรียน">
                  ผู้ปกครองติดต่อขอตรวจสอบข้อมูลร่วมกับนักเรียน
                </option>
                <option value="การประเมินเพื่อรับรางวัลนักเรียนความประพฤติดีเด่น">
                  การประเมินเพื่อรับรางวัลนักเรียนความประพฤติดีเด่น
                </option>
                <option value="นักเรียนเข้าร่วมกิจกรรมปรับปรุงพฤติกรรม">
                  นักเรียนเข้าร่วมกิจกรรมปรับปรุงพฤติกรรม
                </option>
              </select>
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                หมายเหตุเพิ่มเติม (ถ้ามี)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="เช่น อนุญาตหลังเข้าพบครูประจำชั้น..."
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
              />
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <UserCheck className="w-4 h-4" />
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการอนุญาต'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
