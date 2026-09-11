import React, { useState, useEffect } from 'react';
import { Student, SystemSettings, HomeroomAdvisor } from '../types';
import { compressStudentImageFileDetailed, CompressionResult, formatBytes } from '../utils/imageUtils';
import { calculateStudentGrade, resolveStudentLevelAndYear } from '../utils/conductLogic';
import {
  X,
  Edit,
  Camera,
  Upload,
  Sparkles,
  Trash2,
  AlertCircle,
  Save,
  User,
  AlertTriangle
} from 'lucide-react';

interface EditStudentModalProps {
  student: Student;
  currentAcademicYear: number;
  advisors?: HomeroomAdvisor[];
  systemSettings?: SystemSettings;
  onClose: () => void;
  onSave: (updatedStudent: Student) => Promise<void>;
  onDelete?: (studentId: string) => Promise<void>;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  student,
  currentAcademicYear,
  advisors = [],
  systemSettings,
  onClose,
  onSave,
  onDelete
}) => {
  const currentGradeInfo = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);

  const [title, setTitle] = useState(student.title || 'เด็กชาย');
  const [firstName, setFirstName] = useState(student.firstName || '');
  const [lastName, setLastName] = useState(student.lastName || '');
  const [number, setNumber] = useState<string>(student.number !== undefined ? String(student.number) : '');
  const [room, setRoom] = useState<number>(student.room || 1);
  const [gradeLevel, setGradeLevel] = useState<'ม.1' | 'ม.2' | 'ม.3' | 'ม.4' | 'ม.5' | 'ม.6'>(currentGradeInfo.grade);
  const [currentScore, setCurrentScore] = useState<number>(student.currentScore ?? 100);
  const [phone, setPhone] = useState(student.phone || '');
  const [guardianPhone, setGuardianPhone] = useState(student.guardianPhone || '');
  const [guardianName, setGuardianName] = useState(student.guardianName || '');
  const [advisorName, setAdvisorName] = useState(student.advisorName || '');
  const [status, setStatus] = useState<'ACTIVE' | 'GRADUATED' | 'TRANSFERRED'>(student.status || 'ACTIVE');

  // Photo state
  const [photoDataUrl, setPhotoDataUrl] = useState<string>(student.photoUrl || '');
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('กรุณากรอกชื่อและนามสกุล');
      return;
    }

    // Resolve entry year and level
    const resolved = resolveStudentLevelAndYear(gradeLevel, undefined, currentAcademicYear);

    const updated: Student = {
      ...student,
      title,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      entryYear: resolved.entryYear,
      entryLevel: resolved.entryLevel,
      levelCode: resolved.levelCode,
      room: Number(room) || 1,
      number: number ? Number(number) : undefined,
      currentScore: Number(currentScore) || 0,
      phone: phone.trim() || undefined,
      guardianPhone: guardianPhone.trim() || undefined,
      guardianName: guardianName.trim() || undefined,
      advisorName: advisorName.trim() || undefined,
      photoUrl: photoDataUrl || undefined,
      status,
      updatedAt: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      await onSave(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(student.id);
      onClose();
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาดในการลบข้อมูล: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-lg">แก้ไขข้อมูลนักเรียน</h3>
                <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {student.id}
                </span>
              </div>
              <p className="text-xs text-slate-500">จัดการข้อมูล แก้ไขรูปถ่าย หรือลบนักเรียนออกจากฐานข้อมูล</p>
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
          
          {/* PHOTO MANAGEMENT SECTION */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
            
            {/* Photo Preview Box */}
            <div className="w-24 h-28 rounded-2xl bg-white border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center relative flex-shrink-0 shadow-xs">
              {photoDataUrl ? (
                <img
                  src={photoDataUrl}
                  alt={student.firstName}
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
                  เลือกไฟล์รูปภาพเพื่อบีบอัดและอัพเดทลงฐานข้อมูล Firebase
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <label
                  htmlFor="edit-student-photo-file"
                  className="px-3.5 py-1.5 bg-white border border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{photoDataUrl ? 'เปลี่ยนรูปภาพ' : 'เลือกไฟล์รูปภาพ .jpg'}</span>
                </label>
                <input
                  id="edit-student-photo-file"
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

            {/* First Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                นามสกุล <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* GRADE, ROOM, NUMBER, SCORE */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ระดับชั้น</label>
              <select
                value={gradeLevel}
                onChange={e => setGradeLevel(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden cursor-pointer"
              >
                <option value="ม.1">ม.1</option>
                <option value="ม.2">ม.2</option>
                <option value="ม.3">ม.3</option>
                <option value="ม.4">ม.4</option>
                <option value="ม.5">ม.5</option>
                <option value="ม.6">ม.6</option>
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เลขที่</label>
              <input
                type="number"
                min="1"
                max="99"
                value={number}
                onChange={e => setNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">คะแนนปัจจุบัน</label>
              <input
                type="number"
                min="0"
                max="100"
                required
                value={currentScore}
                onChange={e => setCurrentScore(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* STATUS & CONTACT INFO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">สถานะ</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden cursor-pointer"
              >
                <option value="ACTIVE">กำลังศึกษา (ACTIVE)</option>
                <option value="GRADUATED">จบการศึกษา (GRADUATED)</option>
                <option value="TRANSFERRED">ย้ายสถานศึกษา (TRANSFERRED)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เบอร์โทรศัพท์นักเรียน</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="08xxxxxxxx"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เบอร์โทรผู้ปกครอง</label>
              <input
                type="text"
                value={guardianPhone}
                onChange={e => setGuardianPhone(e.target.value)}
                placeholder="08xxxxxxxx"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* FOOTER BUTTONS & DELETE BUTTON */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            {onDelete ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full sm:w-auto px-4 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>ลบนักเรียนคนนี้</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 sm:flex-none px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                ยืนยันการลบนักเรียน ({student.id})?
              </h3>
              <p className="text-xs text-slate-500">
                คุณกำลังจะลบข้อมูลของ <strong>{student.title}{student.firstName} {student.lastName}</strong> รวมถึงไฟล์รูปภาพออกจาก Firebase Firestore การดำเนินการนี้ไม่สามารถยกเลิกได้
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
