import React, { useState } from 'react';
import { Student, EntryLevel, LevelCode, HomeroomAdvisor } from '../types';
import { compressStudentImageFileDetailed, CompressionResult, formatBytes } from '../utils/imageUtils';
import { resolveStudentLevelAndYear } from '../utils/conductLogic';
import {
  X,
  UserPlus,
  Camera,
  Upload,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Save,
  User
} from 'lucide-react';

interface AddStudentModalProps {
  currentAcademicYear: number;
  advisors?: HomeroomAdvisor[];
  existingStudents: Student[];
  onClose: () => void;
  onSave: (student: Student) => Promise<void>;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  currentAcademicYear,
  advisors = [],
  existingStudents,
  onClose,
  onSave
}) => {
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('เด็กชาย');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [number, setNumber] = useState<string>('');
  const [room, setRoom] = useState<number>(1);
  const [gradeLevel, setGradeLevel] = useState<'ม.1' | 'ม.2' | 'ม.3' | 'ม.4' | 'ม.5' | 'ม.6'>('ม.1');
  const [phone, setPhone] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [advisorName, setAdvisorName] = useState('');

  // Photo state
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      setErrorMsg(null);
      const res = await compressStudentImageFileDetailed(file, 320, 380, 0.8);
      setPhotoDataUrl(res.dataUrl);
      setCompressionInfo(res);
      
      // If studentId is empty, auto-fill from filename if detected
      if (!studentId && res.extractedStudentId) {
        setStudentId(res.extractedStudentId);
      }
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ: ' + err.message);
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setPhotoDataUrl('');
    setCompressionInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanId = studentId.trim();
    if (!cleanId) {
      setErrorMsg('กรุณาระบุรหัสนักเรียน');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('กรุณากรอกชื่อและนามสกุล');
      return;
    }

    // Check duplicate ID
    if (existingStudents.some(s => s.id === cleanId)) {
      setErrorMsg(`รหัสนักเรียน ${cleanId} มีอยู่ในระบบแล้ว กรุณาตรวจสอบอีกครั้ง`);
      return;
    }

    // Resolve entry year and level
    const resolved = resolveStudentLevelAndYear(gradeLevel, undefined, currentAcademicYear);

    const nowIso = new Date().toISOString();
    const newStudent: Student = {
      id: cleanId,
      title,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      entryYear: resolved.entryYear,
      entryLevel: resolved.entryLevel,
      levelCode: resolved.levelCode,
      room: Number(room) || 1,
      number: number ? Number(number) : undefined,
      currentScore: 100,
      bankedPoints: 0,
      totalDeductionsCount: 0,
      totalDeductedPoints: 0,
      totalAddedPoints: 0,
      hasNeverBeenDeducted: true,
      phone: phone.trim() || undefined,
      guardianPhone: guardianPhone.trim() || undefined,
      guardianName: guardianName.trim() || undefined,
      advisorName: advisorName.trim() || undefined,
      photoUrl: photoDataUrl || undefined,
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    setIsSaving(true);
    try {
      await onSave(newStudent);
      onClose();
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">เพิ่มข้อมูลนักเรียนใหม่</h3>
              <p className="text-xs text-slate-500">บันทึกข้อมูลและแนบไฟล์รูปถ่าย (.jpg) พร้อมบีบอัดลง Firebase</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          
          {/* PHOTO UPLOAD SECTION */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
            
            {/* Photo Preview Box */}
            <div className="w-24 h-28 rounded-2xl bg-white border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center relative flex-shrink-0 shadow-xs">
              {photoDataUrl ? (
                <img
                  src={photoDataUrl}
                  alt="Student preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-2">
                  <User className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-400 font-bold block">ไม่มีรูปถ่าย</span>
                </div>
              )}

              {isCompressing && (
                <div className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center text-[10px] font-bold">
                  กำลังบีบอัด...
                </div>
              )}
            </div>

            {/* Upload Buttons & Compression Stats */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1 justify-center sm:justify-start">
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                  <span>รูปถ่ายนักเรียน (.jpg / .png)</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ระบบจะบีบอัดภาพให้อัตโนมัติ เพื่อประหยัดพื้นที่จัดเก็บบน Firebase Firestore
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <label
                  htmlFor="add-student-photo-file"
                  className="px-3.5 py-1.5 bg-white border border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{photoDataUrl ? 'เปลี่ยนรูปภาพ' : 'เลือกไฟล์รูปภาพ .jpg'}</span>
                </label>
                <input
                  id="add-student-photo-file"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {photoDataUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบรูป</span>
                  </button>
                )}
              </div>

              {compressionInfo && (
                <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-flex">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>
                    บีบอัดแล้ว: {formatBytes(compressionInfo.originalSize)} → {formatBytes(compressionInfo.compressedSize)} (ลดลง {compressionInfo.compressionRatio}%)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* BASIC INFO FIELDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Student ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                รหัสนักเรียน <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentId}
                onChange={e => setStudentId(e.target.value.trim())}
                placeholder="เช่น 06055"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">คำนำหน้า</label>
              <select
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden cursor-pointer"
              >
                <option value="เด็กชาย">เด็กชาย</option>
                <option value="เด็กหญิง">เด็กหญิง</option>
                <option value="นาย">นาย</option>
                <option value="นางสาว">นางสาว</option>
              </select>
            </div>

            {/* Number (เลขที่) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เลขที่</label>
              <input
                type="number"
                min="1"
                max="99"
                value={number}
                onChange={e => setNumber(e.target.value)}
                placeholder="เช่น 1"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* FIRST & LAST NAME */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="ชื่อจริง"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                นามสกุล <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="นามสกุล"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* GRADE & ROOM */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ระดับชั้นปัจจุบัน</label>
              <select
                value={gradeLevel}
                onChange={e => setGradeLevel(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden cursor-pointer"
              >
                <option value="ม.1">มัธยมศึกษาปีที่ 1 (ม.1)</option>
                <option value="ม.2">มัธยมศึกษาปีที่ 2 (ม.2)</option>
                <option value="ม.3">มัธยมศึกษาปีที่ 3 (ม.3)</option>
                <option value="ม.4">มัธยมศึกษาปีที่ 4 (ม.4)</option>
                <option value="ม.5">มัธยมศึกษาปีที่ 5 (ม.5)</option>
                <option value="ม.6">มัธยมศึกษาปีที่ 6 (ม.6)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ห้อง</label>
              <input
                type="number"
                min="1"
                max="20"
                required
                value={room}
                onChange={e => setRoom(parseInt(e.target.value) || 1)}
                placeholder="เช่น 1"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* CONTACT INFO (OPTIONAL) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เบอร์โทรศัพท์นักเรียน (ถ้ามี)</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="เช่น 0812345678"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เบอร์โทรผู้ปกครอง (ถ้ามี)</label>
              <input
                type="text"
                value={guardianPhone}
                onChange={e => setGuardianPhone(e.target.value)}
                placeholder="เช่น 0899999999"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* FOOTER BUTTONS */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลนักเรียน'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
