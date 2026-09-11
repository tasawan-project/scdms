import React, { useState, useEffect, useMemo } from 'react';
import { Student, ConductLog, ConductType, StandardConductBehavior } from '../types';
import { calculateDeduction, calculateAddition, calculateStudentGrade } from '../utils/conductLogic';
import { formatThaiDate } from '../utils/thaiDate';
import { fetchStandardBehaviors, saveStandardBehavior } from '../firebase';
import { StudentAvatar } from './StudentAvatar';
import confetti from 'canvas-confetti';
import {
  X,
  MinusCircle,
  PlusCircle,
  AlertTriangle,
  Sparkles,
  Calendar,
  User,
  FileText,
  Tag,
  CheckCircle2,
  Plus,
  Database,
  Clock,
  Layers,
  Search,
  Zap,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

interface ConductActionModalProps {
  student: Student;
  defaultType: ConductType;
  currentAcademicYear: number;
  currentTerm: number;
  recordedByName: string;
  maxBankedPoints?: number;
  standardBehaviors?: StandardConductBehavior[];
  onSaveStandardBehavior?: (behavior: StandardConductBehavior) => Promise<void>;
  onClose: () => void;
  onSubmit: (log: ConductLog, updatedStudent: Student) => Promise<void>;
}

export const ConductActionModal: React.FC<ConductActionModalProps> = ({
  student,
  defaultType,
  currentAcademicYear,
  currentTerm,
  recordedByName,
  maxBankedPoints = 100,
  standardBehaviors: propBehaviors,
  onSaveStandardBehavior,
  onClose,
  onSubmit
}) => {
  const [type, setType] = useState<ConductType>(defaultType);
  const [points, setPoints] = useState<number | ''>('');
  const [category, setCategory] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [recordedBy, setRecordedBy] = useState<string>(recordedByName || 'อาจารย์ฝ่ายปกครอง');
  
  // วันที่กระทำผิด / วันที่เกิดเหตุ (Default วันที่ปัจจุบัน YYYY-MM-DD)
  const [violationDate, setViolationDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Fast saving & optional safety confirm
  const [requireConfirm, setRequireConfirm] = useState<boolean>(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Standard behaviors from database
  const [dbBehaviors, setDbBehaviors] = useState<StandardConductBehavior[]>(propBehaviors || []);
  const [isLoadingBehaviors, setIsLoadingBehaviors] = useState<boolean>(false);
  const [selectedBehaviorId, setSelectedBehaviorId] = useState<string | null>(null);

  // Quick Add Standard Behavior Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newType, setNewType] = useState<ConductType>(defaultType);
  const [newPoints, setNewPoints] = useState<number>(5);
  const [newCategory, setNewCategory] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [isSavingNewBehavior, setIsSavingNewBehavior] = useState<boolean>(false);

  // Quick Select search & filter & feedback states
  const [behaviorSearch, setBehaviorSearch] = useState<string>('');
  const [selectedPresetCategory, setSelectedPresetCategory] = useState<string>('ALL');
  const [autoFilledBehaviorTitle, setAutoFilledBehaviorTitle] = useState<string | null>(null);

  const gradeInfo = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);

  // Quick point chips
  const quickPoints = type === 'DEDUCT' ? [5, 10, 15, 20, 30] : [5, 10, 15, 20, 25];

  // Sync propBehaviors whenever it changes
  useEffect(() => {
    if (propBehaviors !== undefined) {
      setDbBehaviors(propBehaviors);
    }
  }, [propBehaviors]);

  // Load standard behaviors from database on mount if not provided
  useEffect(() => {
    if (!propBehaviors) {
      let isMounted = true;
      setIsLoadingBehaviors(true);
      fetchStandardBehaviors()
        .then(items => {
          if (isMounted) {
            setDbBehaviors(items);
          }
        })
        .catch(err => {
          console.error('Error fetching standard behaviors in modal:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingBehaviors(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [propBehaviors]);

  // Filter standard behaviors for the currently active conduct type (DEDUCT / ADD)
  const currentTypeBehaviors = useMemo(() => {
    const seen = new Set<string>();
    const result: StandardConductBehavior[] = [];
    for (const b of dbBehaviors) {
      if (!b || !b.id || seen.has(b.id)) continue;
      if (
        b.type === type &&
        b.isActive !== false &&
        !b.id.startsWith('bhv-deduct-') &&
        !b.id.startsWith('bhv-add-')
      ) {
        seen.add(b.id);
        result.push(b);
      }
    }
    return result;
  }, [dbBehaviors, type]);

  // Distinct categories in current type
  const presetCategories = useMemo(() => {
    const cats = new Set<string>();
    currentTypeBehaviors.forEach(b => {
      if (b.category) cats.add(b.category);
    });
    return Array.from(cats);
  }, [currentTypeBehaviors]);

  // Filtered by search & category
  const filteredTypeBehaviors = useMemo(() => {
    return currentTypeBehaviors.filter(b => {
      if (selectedPresetCategory !== 'ALL' && b.category !== selectedPresetCategory) return false;
      if (behaviorSearch.trim()) {
        const q = behaviorSearch.toLowerCase();
        const matchTitle = (b.title || '').toLowerCase().includes(q);
        const matchCat = (b.category || '').toLowerCase().includes(q);
        const matchDesc = (b.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCat && !matchDesc) return false;
      }
      return true;
    });
  }, [currentTypeBehaviors, selectedPresetCategory, behaviorSearch]);

  // Preview score calculation
  const numericPoints = typeof points === 'number' ? points : (parseInt(String(points), 10) || 0);
  const preview = type === 'DEDUCT'
    ? calculateDeduction(student, numericPoints)
    : calculateAddition(student, numericPoints, maxBankedPoints);

  // Select standard behavior preset
  const selectPreset = (b: StandardConductBehavior) => {
    setSelectedBehaviorId(b.id);
    setPoints(b.points);
    setCategory(b.category);
    setReason(b.description && b.description.trim() ? b.description.trim() : b.title);
    const today = new Date().toISOString().split('T')[0];
    setViolationDate(today);
    setAutoFilledBehaviorTitle(b.title);
  };

  // Quick dates
  const setDateToday = () => {
    setViolationDate(new Date().toISOString().split('T')[0]);
  };

  const setDateYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setViolationDate(d.toISOString().split('T')[0]);
  };

  // Core execution helper for saving
  const executeSubmit = async (
    targetType: ConductType,
    targetPoints: number,
    targetCategory: string,
    targetReason: string,
    targetDate: string
  ) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const activePreview = targetType === 'DEDUCT'
        ? calculateDeduction(student, targetPoints)
        : calculateAddition(student, targetPoints, maxBankedPoints);

      const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();

      const updatedStudent: Student = {
        ...student,
        currentScore: activePreview.newCurrentScore,
        bankedPoints: activePreview.newBankedPoints,
        totalDeductionsCount: targetType === 'DEDUCT'
          ? (student.totalDeductionsCount || 0) + 1
          : (student.totalDeductionsCount || 0),
        totalDeductedPoints: targetType === 'DEDUCT'
          ? (student.totalDeductedPoints || 0) + targetPoints
          : (student.totalDeductedPoints || 0),
        totalAddedPoints: targetType === 'ADD'
          ? (student.totalAddedPoints || 0) + targetPoints
          : (student.totalAddedPoints || 0),
        hasNeverBeenDeducted: targetType === 'DEDUCT' ? false : student.hasNeverBeenDeducted,
        updatedAt: nowIso
      };

      const log: ConductLog = {
        id: logId,
        studentId: student.id,
        type: targetType,
        points: targetPoints,
        appliedToScore: targetType === 'DEDUCT'
          ? (activePreview as any).scoreDeductionDelta
          : (activePreview as any).scoreAdditionDelta,
        bankedPointsDelta: activePreview.bankedPointsDelta,
        scoreBefore: student.currentScore ?? 100,
        scoreAfter: activePreview.newCurrentScore,
        bankedBefore: student.bankedPoints ?? 0,
        bankedAfter: activePreview.newBankedPoints,
        category: targetCategory.trim() || (targetType === 'DEDUCT' ? 'วินัยทั่วไป' : 'ความดีทั่วไป'),
        reason: targetReason.trim() || (targetType === 'DEDUCT' ? 'หักคะแนนความประพฤติ' : 'เพิ่มคะแนนความประพฤติ'),
        violationDate: targetDate || nowIso.split('T')[0],
        notes: notes.trim() || undefined,
        recordedBy: recordedBy.trim() || 'เจ้าหน้าที่ฝ่ายปกครอง',
        recordedByName: recordedBy.trim() || 'เจ้าหน้าที่ฝ่ายปกครอง',
        recordedAt: nowIso,
        academicYear: currentAcademicYear,
        term: currentTerm
      };

      await onSubmit(log, updatedStudent);

      if (targetType === 'ADD') {
        confetti({
          particleCount: 75,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      setShowConfirmDialog(false);
      onClose();
    } catch (err: any) {
      console.error('Error submitting conduct log:', err);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || 'กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Standard Form Submit (Checks for critical score or user confirm preference)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numPoints = typeof points === 'number' ? points : parseInt(String(points), 10);
    if (!numPoints || isNaN(numPoints) || numPoints <= 0) {
      alert('กรุณาระบุจำนวนคะแนนที่มากกว่า 0');
      return;
    }

    const effectiveCategory = category.trim() || (type === 'DEDUCT' ? 'วินัยทั่วไป' : 'ความดีทั่วไป');
    const effectiveReason = reason.trim() || autoFilledBehaviorTitle || (type === 'DEDUCT' ? 'หักคะแนนความประพฤติ' : 'เพิ่มคะแนนความประพฤติ');
    const effectiveDate = violationDate || new Date().toISOString().split('T')[0];

    // If score is critical (<= 50) on deduction or user explicitly checked confirm, prompt safety modal
    if (requireConfirm || (type === 'DEDUCT' && preview.newCurrentScore <= 50)) {
      setShowConfirmDialog(true);
      return;
    }

    // Otherwise, fast direct save!
    await executeSubmit(type, numPoints, effectiveCategory, effectiveReason, effectiveDate);
  };

  // Save from safety confirmation dialog
  const handleConfirmSubmit = async () => {
    const numPoints = typeof points === 'number' ? points : parseInt(String(points), 10);
    if (!numPoints || isNaN(numPoints) || numPoints <= 0) return;
    const effectiveCategory = category.trim() || (type === 'DEDUCT' ? 'วินัยทั่วไป' : 'ความดีทั่วไป');
    const effectiveReason = reason.trim() || autoFilledBehaviorTitle || (type === 'DEDUCT' ? 'หักคะแนนความประพฤติ' : 'เพิ่มคะแนนความประพฤติ');
    const effectiveDate = violationDate || new Date().toISOString().split('T')[0];
    await executeSubmit(type, numPoints, effectiveCategory, effectiveReason, effectiveDate);
  };

  // Open Quick Add Behavior Modal
  const openAddBehaviorModal = () => {
    setNewTitle('');
    setNewType(type);
    setNewPoints(type === 'ADD' ? 10 : 5);
    setNewCategory(category || (type === 'ADD' ? 'จิตอาสา' : 'การเข้าเรียนและวินัย'));
    setNewDescription('');
    setShowAddModal(true);
  };

  // Save new standard behavior directly to database
  const handleSaveNewBehavior = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('กรุณากรอกชื่อหรือหัวข้อพฤติกรรม');
      return;
    }
    if (newPoints <= 0) {
      alert('จำนวนคะแนนต้องมากกว่า 0');
      return;
    }
    if (!newCategory.trim()) {
      alert('กรุณาระบุหมวดหมู่พฤติกรรม');
      return;
    }

    setIsSavingNewBehavior(true);
    try {
      const id = `bhv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const createdBehavior: StandardConductBehavior = {
        id,
        title: newTitle.trim(),
        type: newType,
        points: Number(newPoints),
        category: newCategory.trim(),
        description: newDescription.trim(),
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (onSaveStandardBehavior) {
        await onSaveStandardBehavior(createdBehavior);
      } else {
        await saveStandardBehavior(createdBehavior);
      }

      setDbBehaviors(prev => {
        const idx = prev.findIndex(b => b.id === createdBehavior.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = createdBehavior;
          return updated;
        }
        return [...prev, createdBehavior];
      });

      if (newType === type) {
        selectPreset(createdBehavior);
      }

      setShowAddModal(false);
    } catch (err: any) {
      console.error('Error saving new behavior to database:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกลงฐานข้อมูล: ' + (err.message || ''));
    } finally {
      setIsSavingNewBehavior(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-4 sm:my-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 text-white flex items-center justify-between ${
          type === 'DEDUCT'
            ? 'bg-gradient-to-r from-rose-600 via-rose-700 to-red-700'
            : 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
              {type === 'DEDUCT' ? <MinusCircle className="w-5 h-5 sm:w-6 sm:h-6" /> : <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {type === 'DEDUCT' ? 'บันทึกการหักคะแนนความประพฤติ' : 'บันทึกการเพิ่มคะแนนความประพฤติ'}
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                ปีการศึกษา {currentAcademicYear} ภาคเรียนที่ {currentTerm}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Summary & Live Recalculation Strip */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <StudentAvatar
              student={student}
              currentAcademicYear={currentAcademicYear}
              size="sm"
            />
            <div className="min-w-0">
              <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                {student.title}{student.firstName} {student.lastName}
              </div>
              <div className="text-[11px] text-slate-500 font-mono truncate">
                รหัส {student.id} • ชั้น {gradeInfo.grade}/{student.room}
              </div>
            </div>
          </div>

          <div className="bg-white px-3 py-1.5 rounded-2xl border border-slate-200 shadow-2xs shrink-0 text-right">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
              คะแนนปัจจุบัน ➔ สุทธิ:
            </div>
            <div className="flex items-center justify-end gap-1.5 font-mono">
              <span className="text-xs text-slate-500">{student.currentScore}</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span className={`text-sm sm:text-base font-black ${
                type === 'DEDUCT' ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                {numericPoints > 0 ? preview.newCurrentScore : student.currentScore}
              </span>
              <span className="text-[10px] text-slate-400">/ 100</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Action Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setType('DEDUCT');
                setSelectedBehaviorId(null);
              }}
              className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                type === 'DEDUCT'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MinusCircle className="w-4 h-4" />
              <span>หักคะแนน</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType('ADD');
                setSelectedBehaviorId(null);
              }}
              className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                type === 'ADD'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>เพิ่มคะแนน</span>
            </button>
          </div>

          {/* Quick Points with Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800">
                จำนวนคะแนน ({type === 'DEDUCT' ? 'หัก' : 'เพิ่ม'}):
              </label>
              <span className="text-[11px] text-slate-400">แตะแต้มด่วนหรือระบุเอง</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-32">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={points}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '') {
                      setPoints('');
                    } else {
                      const num = parseInt(val, 10);
                      setPoints(isNaN(num) ? '' : Math.max(1, Math.min(100, num)));
                    }
                    setSelectedBehaviorId(null);
                  }}
                  placeholder="คะแนน"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  required
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  แต้ม
                </span>
              </div>

              {/* Quick Point Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {quickPoints.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPoints(p);
                      setSelectedBehaviorId(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      points === p
                        ? type === 'DEDUCT'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {type === 'DEDUCT' ? `-${p}` : `+${p}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              หมวดหมู่:
            </label>
            <input
              type="text"
              value={category}
              onChange={e => {
                setCategory(e.target.value);
                setSelectedBehaviorId(null);
              }}
              placeholder="ระบุชื่อหมวดหมู่ที่ต้องการ..."
              className="w-full px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Database-Driven Standard Behaviors */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>พฤติกรรมมาตรฐาน:</span>
              </label>
              <button
                type="button"
                onClick={openAddBehaviorModal}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>เพิ่มพฤติกรรมใหม่</span>
              </button>
            </div>

            {/* Notification when standard behavior selected */}
            {autoFilledBehaviorTitle && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate text-[11px]">
                    เลือก: <strong>"{autoFilledBehaviorTitle}"</strong> (ปรับคะแนน {points} แต้ม, หมวด {category})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoFilledBehaviorTitle(null)}
                  className="text-emerald-500 hover:text-emerald-800 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Search and Category Filter if behaviors > 3 */}
            {currentTypeBehaviors.length > 3 && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={behaviorSearch}
                    onChange={e => setBehaviorSearch(e.target.value)}
                    placeholder="ค้นหาพฤติกรรม..."
                    className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                {presetCategories.length > 1 && (
                  <select
                    value={selectedPresetCategory}
                    onChange={e => setSelectedPresetCategory(e.target.value)}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="ALL">ทุกหมวด ({currentTypeBehaviors.length})</option>
                    {presetCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Behaviors List */}
            {isLoadingBehaviors ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>กำลังโหลดรายการพฤติกรรม...</span>
              </div>
            ) : currentTypeBehaviors.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center">
                <p className="text-xs text-slate-600 mb-1">
                  ยังไม่มีรายการ{type === 'DEDUCT' ? 'หักคะแนน' : 'เพิ่มคะแนน'}ในระบบ
                </p>
                <button
                  type="button"
                  onClick={openAddBehaviorModal}
                  className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer"
                >
                  + เพิ่มพฤติกรรมมาตรฐาน
                </button>
              </div>
            ) : filteredTypeBehaviors.length === 0 ? (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                ไม่พบพฤติกรรมที่ตรงกับ "{behaviorSearch}"
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1.5 bg-slate-50 rounded-2xl border border-slate-200">
                {filteredTypeBehaviors.map(preset => {
                  const isSelected = selectedBehaviorId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => selectPreset(preset)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? type === 'DEDUCT'
                            ? 'bg-rose-50 border-rose-300 shadow-2xs ring-1 ring-rose-400'
                            : 'bg-emerald-50 border-emerald-300 shadow-2xs ring-1 ring-emerald-400'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="font-bold text-xs text-slate-800 line-clamp-1">
                          {preset.title}
                        </span>
                        <span className={`font-mono text-[11px] font-extrabold px-1.5 py-0.2 rounded shrink-0 ${
                          type === 'DEDUCT' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {type === 'DEDUCT' ? `-${preset.points}` : `+${preset.points}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-[10px] text-slate-500 truncate">
                          {preset.category}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reason / Details & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                รายละเอียดเหตุผล / กิจกรรม:
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => {
                  setReason(e.target.value);
                  setSelectedBehaviorId(null);
                }}
                placeholder="ระบุพฤติกรรม (หรือเว้นว่างเพื่อใช้ชื่อตามหมวด)"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>{type === 'DEDUCT' ? 'วันที่เกิดเหตุ:' : 'วันที่ทำ:'}</span>
                <div className="flex gap-1 text-[10px]">
                  <button type="button" onClick={setDateToday} className="text-indigo-600 hover:underline cursor-pointer">วันนี้</button>
                  <span>•</span>
                  <button type="button" onClick={setDateYesterday} className="text-indigo-600 hover:underline cursor-pointer">วานนี้</button>
                </div>
              </label>
              <input
                type="date"
                value={violationDate}
                onChange={e => setViolationDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Recorder & Notes (Collapsed or Compact) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                ผู้บันทึก:
              </label>
              <input
                type="text"
                value={recordedBy}
                onChange={e => setRecordedBy(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                หมายเหตุเพิ่มเติม (ถ้ามี):
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="เช่น แจ้งผู้ปกครองแล้ว, ตักเตือนวาจา"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Live Outcome Summary Box */}
          <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs space-y-1">
            <div className="font-bold text-indigo-900 flex items-center justify-between">
              <span>ผลการคำนวณคะแนนตามกฎ:</span>
              <span className="font-mono text-xs sm:text-sm">
                {numericPoints > 0 ? (
                  `${student.currentScore ?? 100} ➔ ${preview.newCurrentScore} คะแนน`
                ) : (
                  `${student.currentScore ?? 100} คะแนน (รอระบุแต้ม)`
                )}
              </span>
            </div>
            {numericPoints > 0 && (
              <div className="text-[11px] text-slate-600">
                {type === 'DEDUCT' ? (
                  preview.bankedPointsDelta < 0 ? (
                    <span className="text-emerald-700 font-semibold">
                      🛡️ นำแต้มสะสมสำรองมาช่วยหัก {Math.abs(preview.bankedPointsDelta)} แต้ม (หักคะแนนหลักเพียง {(preview as any).scoreDeductionDelta} แต้ม)
                    </span>
                  ) : (
                    <span>หักจากคะแนนหลัก {numericPoints} คะแนน</span>
                  )
                ) : (
                  <span>
                    เติมคะแนนหลักจนเต็ม 100
                    {preview.bankedPointsDelta > 0 && (
                      <span className="text-emerald-700 font-bold ml-1">
                        (มีแต้มเหลือ +{preview.bankedPointsDelta} เข้าคะแนนสะสมสำรอง)
                      </span>
                    )}
                  </span>
                )}
                {type === 'DEDUCT' && preview.newCurrentScore <= 50 && (
                  <div className="text-rose-600 font-bold mt-0.5 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>คำเตือน: คะแนนหลังหักจะเหลือ ≤ 50 คะแนน (ระดับวิกฤต)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Row & 1-Click Fast Submit */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
            {/* Safety confirm toggle */}
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={requireConfirm}
                onChange={e => setRequireConfirm(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>ถามยืนยันก่อนบันทึก</span>
            </label>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || numericPoints <= 0}
                className={`px-5 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  type === 'DEDUCT'
                    ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>บันทึก{type === 'DEDUCT' ? 'หักคะแนน' : 'เพิ่มคะแนน'}ทันที</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Quick Add Behavior Modal Form */}
        {showAddModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <h3 className="font-bold text-sm">เพิ่มพฤติกรรมมาตรฐานใหม่ลงฐานข้อมูล</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-white/80 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveNewBehavior} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ประเภทพฤติกรรม:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewType('DEDUCT')}
                      className={`py-1.5 rounded-lg font-bold border transition-colors cursor-pointer ${
                        newType === 'DEDUCT'
                          ? 'bg-rose-50 border-rose-300 text-rose-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      หักคะแนน
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewType('ADD')}
                      className={`py-1.5 rounded-lg font-bold border transition-colors cursor-pointer ${
                        newType === 'ADD'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      เพิ่มคะแนน
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    หัวข้อ / ชื่อพฤติกรรม: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="เช่น มาสายเกิน 15 นาที, จิตอาสาช่วยงานโรงเรียน"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      จำนวนคะแนน: <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={newPoints}
                      onChange={e => setNewPoints(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      หมวดหมู่: <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      placeholder="เช่น การเข้าเรียน, วินัย"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    รายละเอียดเพิ่มเติม (ถ้ามี):
                  </label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="ระบุข้อกำหนดหรือแนวทางเพิ่มเติม..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    disabled={isSavingNewBehavior}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingNewBehavior}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg cursor-pointer"
                  >
                    {isSavingNewBehavior ? 'กำลังบันทึก...' : 'บันทึกลงฐานข้อมูล'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Safety Confirm Dialog (Shown only if checked or critical score) */}
        {showConfirmDialog && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={e => e.stopPropagation()}
            >
              <div className={`p-4 text-white flex items-center justify-between ${
                type === 'DEDUCT' ? 'bg-rose-600' : 'bg-emerald-600'
              }`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-200" />
                  <h3 className="font-bold text-sm">ยืนยันการบันทึกคะแนนความประพฤติ</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  className="p-1 text-white/80 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">นักเรียน:</span>
                    <span className="font-bold text-slate-800">
                      {student.title}{student.firstName} {student.lastName} ({student.id})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">รายการ:</span>
                    <span className={`font-bold font-mono ${type === 'DEDUCT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {type === 'DEDUCT' ? `-${numericPoints}` : `+${numericPoints}`} คะแนน
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">หมวดหมู่:</span>
                    <span className="font-medium text-slate-700">{category || '-'}</span>
                  </div>
                </div>

                {/* Score Summary */}
                <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100 flex items-center justify-between text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 block">คะแนนเดิม</span>
                    <span className="font-mono font-bold text-sm text-slate-700">
                      {student.currentScore ?? 100}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">คะแนนสุทธิใหม่</span>
                    <span className={`font-mono font-extrabold text-base ${
                      preview.newCurrentScore <= 50 ? 'text-rose-600' : 'text-indigo-600'
                    }`}>
                      {preview.newCurrentScore}
                    </span>
                  </div>
                </div>

                {preview.newCurrentScore <= 50 && type === 'DEDUCT' && (
                  <div className="p-2 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-[11px] font-bold">
                    ⚠️ คำเตือน: คะแนนของนักเรียนจะลดลงอยู่ในระดับวิกฤต (≤ 50 คะแนน)
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-200 text-xs cursor-pointer"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={isSubmitting}
                  className={`px-4 py-1.5 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer ${
                    type === 'DEDUCT' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันบันทึก'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
