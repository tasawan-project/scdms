import React, { useState, useMemo, useRef } from 'react';
import { Student, SystemSettings } from '../types';
import {
  compressStudentImageFileDetailed,
  CompressionResult,
  formatBytes,
  extractStudentIdFromFilename
} from '../utils/imageUtils';
import { calculateStudentGrade } from '../utils/conductLogic';
import { StudentAvatar } from './StudentAvatar';
import { Pagination } from './Pagination';
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Sparkles,
  Search,
  Filter,
  Users,
  HardDrive,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  FolderOpen,
  Camera,
  Check,
  AlertTriangle,
  HelpCircle,
  Eye,
  ExternalLink,
  Database
} from 'lucide-react';

interface BatchPhotoItem {
  id: string; // generated uid
  studentId: string;
  matchedStudent?: Student;
  result: CompressionResult;
  status: 'READY' | 'SAVED' | 'ERROR';
  errorMessage?: string;
}

interface StudentPhotoManagerModalProps {
  students: Student[];
  currentAcademicYear: number;
  systemSettings?: SystemSettings;
  isOpen?: boolean;
  isPage?: boolean;
  onClose: () => void;
  onBatchUpdateStudentPhotos: (photoUpdates: { id: string; photoUrl: string }[]) => Promise<void>;
  onClearAllStudentPhotos?: () => Promise<{ clearedCount: number }>;
  onUpdateSinglePhoto?: (studentId: string, photoUrl: string) => Promise<void>;
}

export const StudentPhotoManagerModal: React.FC<StudentPhotoManagerModalProps> = ({
  students = [],
  currentAcademicYear,
  systemSettings,
  isOpen = true,
  isPage = false,
  onClose,
  onBatchUpdateStudentPhotos,
  onClearAllStudentPhotos,
  onUpdateSinglePhoto
}) => {
  const [activeTab, setActiveTab] = useState<'BATCH_UPLOAD' | 'GALLERY'>('BATCH_UPLOAD');

  // --- BATCH UPLOAD STATE ---
  const [batchItems, setBatchItems] = useState<BatchPhotoItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);
  const [saveSuccessCount, setSaveSuccessCount] = useState<number | null>(null);
  const [batchFilter, setBatchFilter] = useState<'ALL' | 'MATCHED' | 'UNMATCHED'>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- GALLERY STATE ---
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryPhotoFilter, setGalleryPhotoFilter] = useState<'ALL' | 'HAS_PHOTO' | 'NO_PHOTO'>('ALL');
  const [galleryClassFilter, setGalleryClassFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Map of studentId -> Student for fast lookup
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach(s => {
      if (s && s.id) {
        map.set(s.id.trim(), s);
        // Also map without leading zeros or with padded 5 digits if needed
        const numOnly = s.id.replace(/\D/g, '');
        if (numOnly) {
          map.set(numOnly, s);
          map.set(numOnly.padStart(5, '0'), s);
        }
      }
    });
    return map;
  }, [students]);

  // Extract classrooms for filtering
  const availableClassrooms = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      const { grade } = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
      set.add(`${grade}/${s.room}`);
    });
    return Array.from(set).sort();
  }, [students, currentAcademicYear]);

  // Total space calculations for batch
  const batchStats = useMemo(() => {
    let totalOriginal = 0;
    let totalCompressed = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    batchItems.forEach(item => {
      totalOriginal += item.result.originalSize;
      totalCompressed += item.result.compressedSize;
      if (item.matchedStudent) {
        matchedCount++;
      } else {
        unmatchedCount++;
      }
    });

    const savedBytes = Math.max(0, totalOriginal - totalCompressed);
    const savedPercent = totalOriginal > 0 ? ((savedBytes / totalOriginal) * 100).toFixed(1) : '0';

    return {
      totalFiles: batchItems.length,
      matchedCount,
      unmatchedCount,
      totalOriginal,
      totalCompressed,
      savedBytes,
      savedPercent
    };
  }, [batchItems]);

  // Process files selected or dropped
  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));
    if (files.length === 0) {
      alert('กรุณาเลือกไฟล์รูปภาพ (.jpg, .jpeg, .png)');
      return;
    }

    setIsProcessingFiles(true);
    const newItems: BatchPhotoItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const studentId = extractStudentIdFromFilename(file.name);
        const matched = studentMap.get(studentId) || studentMap.get(studentId.padStart(5, '0'));
        
        // Auto compress with 320x380 px, 0.8 JPEG quality
        const result = await compressStudentImageFileDetailed(file, 320, 380, 0.8);
        
        newItems.push({
          id: `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
          studentId: matched ? matched.id : studentId,
          matchedStudent: matched,
          result,
          status: 'READY'
        });
      } catch (err: any) {
        console.error('Error processing file:', file.name, err);
      }
    }

    setBatchItems(prev => [...prev, ...newItems]);
    setIsProcessingFiles(false);
    setSaveSuccessCount(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeItem = (id: string) => {
    setBatchItems(prev => prev.filter(item => item.id !== id));
  };

  const clearBatch = () => {
    setBatchItems([]);
    setSaveSuccessCount(null);
  };

  // Bulk save matched photos to Firestore
  const handleSaveBatchToFirestore = async () => {
    const matchedItems = batchItems.filter(item => item.matchedStudent && item.status !== 'SAVED');
    if (matchedItems.length === 0) {
      alert('ไม่มีรูปภาพที่ตรงกับรหัสนักเรียนในระบบให้บันทึก');
      return;
    }

    setIsSavingBatch(true);
    setSaveProgress({ current: 0, total: matchedItems.length });

    try {
      const photoUpdates = matchedItems.map(item => ({
        id: item.matchedStudent!.id,
        photoUrl: item.result.dataUrl
      }));

      await onBatchUpdateStudentPhotos(photoUpdates);

      // Mark items as SAVED
      setBatchItems(prev =>
        prev.map(item => {
          if (item.matchedStudent && item.status !== 'SAVED') {
            return { ...item, status: 'SAVED' };
          }
          return item;
        })
      );

      setSaveSuccessCount(matchedItems.length);
      setSaveProgress(null);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึกรูปภาพ: ' + (err.message || 'กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Filtered batch items for display
  const displayedBatchItems = useMemo(() => {
    if (batchFilter === 'MATCHED') {
      return batchItems.filter(item => item.matchedStudent);
    }
    if (batchFilter === 'UNMATCHED') {
      return batchItems.filter(item => !item.matchedStudent);
    }
    return batchItems;
  }, [batchItems, batchFilter]);

  // --- GALLERY FILTERING & PAGINATION ---
  const filteredGalleryStudents = useMemo(() => {
    return students.filter(s => {
      // 1. Search Query
      if (gallerySearch.trim()) {
        const q = gallerySearch.toLowerCase().trim();
        const matchId = s.id.toLowerCase().includes(q);
        const matchName = `${s.title}${s.firstName} ${s.lastName}`.toLowerCase().includes(q);
        if (!matchId && !matchName) return false;
      }

      // 2. Photo Status
      const hasPhoto = Boolean(s.photoUrl && s.photoUrl.trim() !== '');
      if (galleryPhotoFilter === 'HAS_PHOTO' && !hasPhoto) return false;
      if (galleryPhotoFilter === 'NO_PHOTO' && hasPhoto) return false;

      // 3. Classroom
      if (galleryClassFilter !== 'ALL') {
        const { grade } = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
        const key = `${grade}/${s.room}`;
        if (key !== galleryClassFilter) return false;
      }

      return true;
    });
  }, [students, gallerySearch, galleryPhotoFilter, galleryClassFilter, currentAcademicYear]);

  const paginatedGalleryStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGalleryStudents.slice(start, start + pageSize);
  }, [filteredGalleryStudents, currentPage, pageSize]);

  // Handle single photo upload for student in gallery
  const handleSinglePhotoUpload = async (studentId: string, file: File) => {
    try {
      const compressed = await compressStudentImageFileDetailed(file, 320, 380, 0.8);
      if (onUpdateSinglePhoto) {
        await onUpdateSinglePhoto(studentId, compressed.dataUrl);
      } else {
        await onBatchUpdateStudentPhotos([{ id: studentId, photoUrl: compressed.dataUrl }]);
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ: ' + err.message);
    }
  };

  // Handle single photo removal
  const handleSinglePhotoRemove = async (studentId: string) => {
    if (!confirm('คุณต้องการลบรูปถ่ายของนักเรียนรหัส ' + studentId + ' ออกจากฐานข้อมูลใช่หรือไม่?')) {
      return;
    }
    try {
      if (onUpdateSinglePhoto) {
        await onUpdateSinglePhoto(studentId, '');
      } else {
        await onBatchUpdateStudentPhotos([{ id: studentId, photoUrl: '' }]);
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบรูปภาพ: ' + err.message);
    }
  };

  // Handle clear all photos
  const handleClearAllPhotos = async () => {
    if (!onClearAllStudentPhotos) return;
    setIsClearingAll(true);
    try {
      const res = await onClearAllStudentPhotos();
      alert(`ล้างรูปถ่ายนักเรียนเรียบร้อยแล้วทั้งหมด ${res.clearedCount} รายการ เพื่อประหยัดพื้นที่จัดเก็บ`);
      setShowClearConfirm(false);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsClearingAll(false);
    }
  };

  // Statistics on existing students
  const totalStudentsWithPhoto = useMemo(() => {
    return students.filter(s => s.photoUrl && s.photoUrl.trim() !== '').length;
  }, [students]);

  return (
    <div className={isPage ? "w-full pb-12" : "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"}>
      <div className={`bg-white rounded-3xl border border-slate-200/80 w-full overflow-hidden flex flex-col ${isPage ? "min-h-[85vh] shadow-xs" : "max-w-5xl max-h-[92vh] shadow-2xl"}`}>
        
        {/* ========================================================================= */}
        {/* HEADER */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-indigo-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shadow-inner">
              <Camera className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">ระบบแนบและจัดการรูปถ่ายนักเรียน (.jpg)</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold">
                  บีบอัดอัตโนมัติ 90%+
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                ตั้งชื่อไฟล์ด้วยรหัสนักเรียน เช่น <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded font-bold text-white">06055.jpg</span> บีบอัดและแนบลงฐานข้อมูล Firebase Firestore โดยตรง
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://console.firebase.google.com/project/ai-studio-smartconductscor-4396ee42-1c9a-4d27-9a07-793753d38de1/firestore"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-colors shadow-2xs"
              title="เปิดหน้าจัดการฐานข้อมูล Firebase Firestore Console"
            >
              <Database className="w-3.5 h-3.5 text-amber-300" />
              <span>ไปยัง Firebase Console</span>
              <ExternalLink className="w-3 h-3 text-indigo-200" />
            </a>

            <button
              onClick={onClose}
              className="p-2 text-indigo-200 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* NAVIGATION TABS & SUMMARY BAR */}
        {/* ========================================================================= */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          {/* View Switcher Tabs */}
          <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('BATCH_UPLOAD')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'BATCH_UPLOAD'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>นำเข้ารูปภาพแบบกลุ่ม (.jpg ตามรหัส)</span>
              {batchItems.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  {batchItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('GALLERY')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'GALLERY'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>คลังรูปภาพนักเรียนทั้งหมด</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                {totalStudentsWithPhoto}/{students.length}
              </span>
            </button>
          </div>

          {/* Quick Info & Cloud Console Link / Clean Photos */}
          <div className="flex items-center gap-2.5 text-xs text-slate-500 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-slate-400" />
              <span>บันทึกลง Firebase: <strong className="text-slate-800 font-mono">{totalStudentsWithPhoto}</strong> / {students.length} คน</span>
            </div>

            <a
              href="https://console.firebase.google.com/project/ai-studio-smartconductscor-4396ee42-1c9a-4d27-9a07-793753d38de1/firestore"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 text-[11px] font-bold transition-colors cursor-pointer"
              title="เปิดฐานข้อมูล Firestore ในแท็บใหม่"
            >
              <Database className="w-3 h-3 text-amber-600" />
              <span>Cloud Firestore</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
            </a>

            {totalStudentsWithPhoto > 0 && onClearAllStudentPhotos && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                title="ล้างข้อมูลรูปถ่ายนักเรียนทั้งหมดเพื่อประหยัดพื้นที่"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ล้างรูปทั้งหมด</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: BATCH UPLOAD (.jpg by Student ID) */}
        {/* ========================================================================= */}
        {activeTab === 'BATCH_UPLOAD' && (
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
            
            {/* 1. Drag & Drop Upload Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/70 transition-all rounded-3xl p-8 text-center cursor-pointer relative group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="max-w-md mx-auto space-y-3">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    ลากไฟล์รูปภาพ .jpg วางที่นี่ หรือคลิกเพื่อเลือกไฟล์
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    รองรับการเลือกทีละหลายร้อยไฟล์พร้อมกัน ระบบจะตรวจจับรหัสนักเรียนจากชื่อไฟล์ (เช่น <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono font-bold">06055.jpg</code>, <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono font-bold">05505.png</code>) และบีบอัดภาพให้อัตโนมัติ
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-indigo-100 rounded-full text-xs text-indigo-700 font-bold shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>ประหยัดพื้นที่จัดเก็บ: บีบอัดเหลือประมาณ 15-30 KB ต่อรูป</span>
                </div>
              </div>
            </div>

            {/* 2. Loading indicator while processing */}
            {isProcessingFiles && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center gap-3 text-indigo-800 text-xs font-bold animate-pulse">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                <span>กำลังประมวลผลและบีบอัดรูปภาพนักเรียน... กรุณารอสักครู่</span>
              </div>
            )}

            {/* 3. Batch Items Loaded & Metrics */}
            {batchItems.length > 0 && (
              <div className="space-y-4">
                
                {/* KPI Metrics Dashboard Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">ไฟล์รูปที่เลือกทั้งหมด</span>
                    <span className="text-2xl font-black text-slate-800 font-mono mt-1">{batchStats.totalFiles} รูป</span>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex flex-col justify-between">
                    <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ตรงกับรหัสนักเรียน</span>
                    </span>
                    <span className="text-2xl font-black text-emerald-700 font-mono mt-1">{batchStats.matchedCount} คน</span>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-col justify-between">
                    <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>ไม่พบรหัสในระบบ</span>
                    </span>
                    <span className="text-2xl font-black text-amber-700 font-mono mt-1">{batchStats.unmatchedCount} รูป</span>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 flex flex-col justify-between">
                    <span className="text-[11px] text-indigo-700 font-medium flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>ประหยัดพื้นที่จัดเก็บ</span>
                    </span>
                    <div className="mt-1">
                      <span className="text-2xl font-black text-indigo-700 font-mono">{batchStats.savedPercent}%</span>
                      <span className="text-[10px] text-indigo-500 block">
                        {formatBytes(batchStats.totalOriginal)} → {formatBytes(batchStats.totalCompressed)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Filter and Action Header */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full sm:w-auto text-xs font-bold">
                    <button
                      onClick={() => setBatchFilter('ALL')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        batchFilter === 'ALL' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ทั้งหมด ({batchItems.length})
                    </button>
                    <button
                      onClick={() => setBatchFilter('MATCHED')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        batchFilter === 'MATCHED' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-emerald-700'
                      }`}
                    >
                      ตรงกับนักเรียน ({batchStats.matchedCount})
                    </button>
                    <button
                      onClick={() => setBatchFilter('UNMATCHED')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        batchFilter === 'UNMATCHED' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-amber-700'
                      }`}
                    >
                      ไม่พบในระบบ ({batchStats.unmatchedCount})
                    </button>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={clearBatch}
                      disabled={isSavingBatch}
                      className="px-3 py-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      ล้างรายการ
                    </button>

                    <button
                      onClick={handleSaveBatchToFirestore}
                      disabled={isSavingBatch || batchStats.matchedCount === 0}
                      className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      {isSavingBatch ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>กำลังบันทึกลง Firebase...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>บันทึก {batchStats.matchedCount} รูปภาพลง Firebase Firestore</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Save Success Alert */}
                {saveSuccessCount !== null && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs font-bold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm">บันทึกรูปภาพนักเรียนสำเร็จเรียบร้อยแล้ว {saveSuccessCount} คน!</p>
                      <p className="text-emerald-700 font-normal mt-0.5">
                        ข้อมูลรูปภาพถูกบีบอัดและจัดเก็บลงในเอกสารของนักเรียนบน Firebase Firestore เรียบร้อยแล้ว
                      </p>
                    </div>
                  </div>
                )}

                {/* Items Grid List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto p-1">
                  {displayedBatchItems.map(item => {
                    const isMatched = Boolean(item.matchedStudent);
                    const gradeInfo = item.matchedStudent
                      ? calculateStudentGrade(item.matchedStudent.entryYear, item.matchedStudent.entryLevel, currentAcademicYear)
                      : null;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition-all flex items-start gap-3 relative ${
                          item.status === 'SAVED'
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : isMatched
                            ? 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                            : 'bg-amber-50/40 border-amber-200'
                        }`}
                      >
                        {/* Compressed Image Preview */}
                        <div className="w-14 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 relative">
                          <img
                            src={item.result.dataUrl}
                            alt={item.result.filename}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[9px] text-center font-mono py-0.5">
                            {formatBytes(item.result.compressedSize)}
                          </span>
                        </div>

                        {/* Student Details & Status */}
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-indigo-700">{item.studentId}</span>
                            {item.status === 'SAVED' ? (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> บันทึกแล้ว
                              </span>
                            ) : isMatched ? (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold">
                                ตรงในระบบ
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                                ไม่พบรหัส
                              </span>
                            )}
                          </div>

                          {isMatched && item.matchedStudent ? (
                            <div className="mt-1">
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {item.matchedStudent.title}{item.matchedStudent.firstName} {item.matchedStudent.lastName}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                ชั้น {gradeInfo?.grade}/{item.matchedStudent.room}
                              </p>
                            </div>
                          ) : (
                            <div className="mt-1">
                              <p className="text-xs text-slate-600 truncate font-mono">{item.result.filename}</p>
                              <p className="text-[10px] text-amber-700 mt-0.5">ไม่พบรหัส {item.studentId} ในฐานข้อมูล</p>
                            </div>
                          )}

                          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                            <span>บีบอัดลด {item.result.compressionRatio}%</span>
                          </div>
                        </div>

                        {/* Remove item button */}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="ลบออกจากรายการ"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: STUDENT PHOTO GALLERY & QUICK UPLOADER */}
        {/* ========================================================================= */}
        {activeTab === 'GALLERY' && (
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
            
            {/* Gallery Filters & Search Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              
              {/* Search input */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={gallerySearch}
                  onChange={e => {
                    setGallerySearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="ค้นหารหัส หรือชื่อนักเรียน..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Status & Classroom Filters */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Photo Filter */}
                <select
                  value={galleryPhotoFilter}
                  onChange={e => {
                    setGalleryPhotoFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">สถานะรูปภาพทั้งหมด ({students.length})</option>
                  <option value="HAS_PHOTO">มีรูปถ่ายแล้ว ({totalStudentsWithPhoto})</option>
                  <option value="NO_PHOTO">ยังไม่มีรูปถ่าย ({students.length - totalStudentsWithPhoto})</option>
                </select>

                {/* Classroom Filter */}
                <select
                  value={galleryClassFilter}
                  onChange={e => {
                    setGalleryClassFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">ทุกห้องเรียน</option>
                  {availableClassrooms.map(cls => (
                    <option key={cls} value={cls}>ชั้น {cls}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results Header */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>แสดง {filteredGalleryStudents.length} รายการ</span>
              <span>หน้า {currentPage} จาก {Math.ceil(filteredGalleryStudents.length / pageSize) || 1}</span>
            </div>

            {/* Gallery Cards Grid */}
            {filteredGalleryStudents.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">ไม่พบนักเรียนตามเงื่อนไขที่เลือก</p>
                <p className="text-xs text-slate-400 mt-0.5">ลองปรับตัวกรองหรือคำค้นหาใหม่อีกครั้ง</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {paginatedGalleryStudents.map(student => {
                  const { grade } = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);
                  const hasPhoto = Boolean(student.photoUrl && student.photoUrl.trim() !== '');

                  return (
                    <div
                      key={student.id}
                      className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-3 shadow-2xs hover:shadow-md transition-all flex flex-col items-center text-center relative group"
                    >
                      {/* Avatar / Photo with direct change overlay */}
                      <div className="relative mb-2">
                        <StudentAvatar
                          student={student}
                          currentAcademicYear={currentAcademicYear}
                          size="lg"
                          canEditPhoto={true}
                          onUpdatePhoto={async (id, url) => {
                            if (onUpdateSinglePhoto) {
                              await onUpdateSinglePhoto(id, url);
                            } else {
                              await onBatchUpdateStudentPhotos([{ id, photoUrl: url }]);
                            }
                          }}
                        />

                        {/* Quick single file upload trigger */}
                        <label
                          htmlFor={`gallery-upload-${student.id}`}
                          className="absolute -bottom-1 -right-1 p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs cursor-pointer transition-transform hover:scale-110"
                          title="อัพโหลดรูปภาพ (.jpg)"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </label>
                        <input
                          id={`gallery-upload-${student.id}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleSinglePhotoUpload(student.id, file);
                            e.target.value = '';
                          }}
                        />
                      </div>

                      {/* Student Info */}
                      <span className="text-xs font-bold text-slate-800 truncate w-full">
                        {student.title}{student.firstName} {student.lastName}
                      </span>
                      <p className="text-[11px] font-mono text-indigo-600 font-bold mt-0.5">
                        {student.id}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {grade}/{student.room} • เลขที่ {student.number || '-'}
                      </p>

                      {/* Remove photo button if photo exists */}
                      {hasPhoto && (
                        <button
                          onClick={() => handleSinglePhotoRemove(student.id)}
                          className="mt-2 text-[10px] text-rose-500 hover:text-rose-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-0.5"
                          title="ลบรูปถ่ายออกเพื่อประหยัดพื้นที่"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>ลบรูป</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {filteredGalleryStudents.length > pageSize && (
              <div className="pt-2">
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredGalleryStudents.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* FOOTER ACTIONS */}
        {/* ========================================================================= */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>รูปภาพทั้งหมดจะถูกจัดเก็บไว้กับข้อมูลนักเรียนใน</span>
            <a
              href="https://console.firebase.google.com/project/ai-studio-smartconductscor-4396ee42-1c9a-4d27-9a07-793753d38de1/firestore"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline inline-flex items-center gap-1"
            >
              <span>Firebase Firestore</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-slate-400">| Project: ai-studio-smartconductscor-4396ee42</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer w-full sm:w-auto"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">ยืนยันการล้างรูปถ่ายนักเรียนทั้งหมด?</h3>
              <p className="text-xs text-slate-500">
                การดำเนินการนี้จะลบรูปถ่ายนักเรียนทั้งหมดออกจากฐานข้อมูล Firebase Firestore เพื่อประหยัดพื้นที่จัดเก็บ โดยข้อมูลคะแนนและประวัติความประพฤติจะไม่ได้รับผลกระทบ
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearingAll}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleClearAllPhotos}
                disabled={isClearingAll}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                {isClearingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isClearingAll ? 'กำลังล้าง...' : 'ยืนยันล้างรูปทั้งหมด'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
