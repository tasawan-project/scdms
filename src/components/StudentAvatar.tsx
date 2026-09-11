import React, { useState } from 'react';
import { Student } from '../types';
import { compressStudentImageFileDetailed, CompressionResult, formatBytes } from '../utils/imageUtils';
import { calculateStudentGrade } from '../utils/conductLogic';
import {
  User,
  Camera,
  X,
  Sparkles,
  Save,
  CheckCircle2,
  Image as ImageIcon,
  Trash2,
  Upload,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2
} from 'lucide-react';

interface StudentAvatarProps {
  student: Student;
  currentAcademicYear?: number;
  driveBaseUrl?: string; // Optional legacy prop
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  fitMode?: 'cover' | 'contain';
  showDrivePathTooltip?: boolean;
  canEditPhoto?: boolean;
  onUpdatePhoto?: (studentId: string, photoUrl: string) => Promise<void> | void;
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  student,
  currentAcademicYear = 2569,
  size = 'md',
  fitMode = 'cover',
  canEditPhoto = false,
  onUpdatePhoto
}) => {
  const [imageError, setImageError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputUrl, setInputUrl] = useState(student.photoUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastCompressedInfo, setLastCompressedInfo] = useState<CompressionResult | null>(null);
  const [previewFitMode, setPreviewFitMode] = useState<'cover' | 'contain'>(fitMode);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const photoUrl = student.photoUrl?.trim() || null;
  const { grade } = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-16 h-16 text-base',
    xl: 'w-24 h-24 text-xl',
    full: 'w-full h-full text-xl'
  };

  const getInitials = () => {
    const f = student.firstName?.charAt(0) || '';
    const l = student.lastName?.charAt(0) || '';
    return `${f}${l}` || 'นร';
  };

  // Dynamic avatar background gradient based on student ID hash
  const getAvatarBg = () => {
    const colors = [
      'from-blue-500 to-indigo-600',
      'from-emerald-500 to-teal-600',
      'from-violet-500 to-purple-600',
      'from-amber-500 to-orange-600',
      'from-cyan-500 to-blue-600',
      'from-rose-500 to-pink-600'
    ];
    const hash = (student.id || '0').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSaving(true);
      const res = await compressStudentImageFileDetailed(file, 360, 480, 0.85);
      setLastCompressedInfo(res);
      setInputUrl(res.dataUrl);
      if (onUpdatePhoto) {
        await onUpdatePhoto(student.id, res.dataUrl);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ: ' + err.message);
    } finally {
      setIsSaving(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!onUpdatePhoto) return;
    if (!confirm('คุณต้องการลบรูปภาพนักเรียนคนนี้ออกจากระบบใช่หรือไม่?')) return;

    setIsSaving(true);
    try {
      await onUpdatePhoto(student.id, '');
      setInputUrl('');
      setLastCompressedInfo(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบรูปภาพ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        className="relative group inline-block flex-shrink-0 cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        <div
          className={`${sizeClasses[size]} rounded-2xl overflow-hidden shadow-xs border-2 border-white ring-1 ring-slate-200/80 flex items-center justify-center transition-transform hover:scale-105 bg-slate-100`}
        >
          {photoUrl && !imageError ? (
            <img
              src={photoUrl}
              alt={`${student.title} ${student.firstName} ${student.lastName}`}
              className={`w-full h-full ${fitMode === 'contain' ? 'object-contain' : 'object-cover object-top'}`}
              onError={() => setImageError(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${getAvatarBg()} text-white flex flex-col items-center justify-center font-bold font-sans`}
            >
              <span>{getInitials()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Preview & Edit Photo Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Photo Preview Card */}
            <div className="text-center">
              <div className="w-52 h-64 mx-auto rounded-2xl overflow-hidden shadow-md border-4 border-white ring-1 ring-slate-200 mb-3 flex items-center justify-center bg-slate-900 relative group">
                {photoUrl && !imageError ? (
                  <img
                    src={photoUrl}
                    alt="Student preview"
                    className={`w-full h-full transition-transform duration-150 ${
                      previewFitMode === 'contain' ? 'object-contain' : 'object-cover object-top'
                    }`}
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'top center'
                    }}
                    onError={() => setImageError(true)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${getAvatarBg()} text-white flex flex-col items-center justify-center p-4`}>
                    <User className="w-16 h-16 mb-2 opacity-80" />
                    <span className="font-semibold text-base">{student.firstName} {student.lastName}</span>
                    <span className="text-xs text-white/70 mt-1">ยังไม่มีรูปถ่ายประจำตัว</span>
                  </div>
                )}

                {canEditPhoto && onUpdatePhoto && (
                  <label
                    htmlFor={`upload-photo-${student.id}`}
                    className="absolute inset-0 bg-slate-950/70 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-bold gap-1 backdrop-blur-xs"
                  >
                    <Camera className="w-6 h-6" />
                    <span>เปลี่ยนรูปภาพ (.jpg)</span>
                  </label>
                )}
              </div>

              {/* Fit Mode & Zoom Controls */}
              {photoUrl && (
                <div className="space-y-2 mb-3">
                  {/* Zoom Controls */}
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">ย่อ-ขยาย:</span>
                    <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs text-slate-700">
                      <button
                        type="button"
                        onClick={() => setZoomLevel(prev => Math.max(0.5, Number((prev - 0.15).toFixed(2))))}
                        className="p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer text-slate-600 hover:text-slate-900"
                        title="ย่อขนาด (-)"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-[11px] font-bold px-1.5 min-w-[45px] text-center text-slate-800">
                        {Math.round(zoomLevel * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoomLevel(prev => Math.min(2.5, Number((prev + 0.15).toFixed(2))))}
                        className="p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer text-slate-600 hover:text-slate-900"
                        title="ขยายขนาด (+)"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomLevel(1)}
                        className="p-1.5 hover:bg-white rounded-lg transition-colors cursor-pointer text-slate-500 hover:text-indigo-600"
                        title="ขนาดปกติ 100%"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fit Mode Toggle */}
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">การจัดวาง:</span>
                    <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setPreviewFitMode('cover')}
                        className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          previewFitMode === 'cover'
                            ? 'bg-white text-indigo-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        เต็มกรอบ (Cover)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewFitMode('contain')}
                        className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          previewFitMode === 'contain'
                            ? 'bg-white text-indigo-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        พอดีกรอบ (Contain)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {canEditPhoto && onUpdatePhoto && (
                <input
                  type="file"
                  id={`upload-photo-${student.id}`}
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              )}

              <h3 className="font-bold text-lg text-slate-900">
                {student.title}{student.firstName} {student.lastName}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                รหัสประจำตัว: <span className="font-mono font-bold text-indigo-600">{student.id}</span> • ชั้น {grade}/{student.room} {student.number ? `(เลขที่ ${student.number})` : ''}
              </p>
            </div>

            {/* Photo Edit Controls */}
            {canEditPhoto && onUpdatePhoto && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <label
                    htmlFor={`upload-photo-btn-${student.id}`}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{photoUrl ? 'เปลี่ยนรูปถ่าย .jpg' : 'แนบรูปถ่าย .jpg'}</span>
                  </label>
                  <input
                    type="file"
                    id={`upload-photo-btn-${student.id}`}
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {photoUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={isSaving}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบรูปภาพ</span>
                    </button>
                  )}
                </div>

                {lastCompressedInfo && (
                  <div className="text-[10px] text-emerald-700 font-bold flex items-center justify-center gap-1 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>
                      บีบอัดอัตโนมัติ: {formatBytes(lastCompressedInfo.originalSize)} → {formatBytes(lastCompressedInfo.compressedSize)} (ลดลง {lastCompressedInfo.compressionRatio}%)
                    </span>
                  </div>
                )}

                {saveSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>บันทึกรูปภาพลงฐานข้อมูล Firebase สำเร็จ</span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
