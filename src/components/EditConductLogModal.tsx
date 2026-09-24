import React, { useState, useMemo, useEffect } from 'react';
import { Student, ConductLog, ConductType, StandardConductBehavior } from '../types';
import { fetchStandardBehaviors } from '../firebase';
import { recalculateStudentScoresFromLogs, calculateStudentGrade, computeLogsWithRunningScores } from '../utils/conductLogic';
import { StudentAvatar } from './StudentAvatar';
import {
  X,
  MinusCircle,
  PlusCircle,
  CheckCircle2,
  ArrowRight,
  Database,
  Search,
  ShieldAlert
} from 'lucide-react';

interface EditConductLogModalProps {
  isOpen?: boolean;
  log: ConductLog;
  student: Student;
  allStudentLogs?: ConductLog[];
  currentAcademicYear?: number;
  currentTerm?: number;
  maxBankedPoints?: number;
  standardBehaviors?: StandardConductBehavior[];
  onClose: () => void;
  onSave: (updatedLog: ConductLog, updatedStudent: Student) => Promise<void>;
}

export const EditConductLogModal: React.FC<EditConductLogModalProps> = ({
  isOpen = true,
  log,
  student,
  allStudentLogs = [],
  currentAcademicYear = 2569,
  currentTerm = 1,
  maxBankedPoints = 50,
  standardBehaviors: propBehaviors = [],
  onClose,
  onSave
}) => {
  if (!isOpen) return null;

  const [type, setType] = useState<ConductType>(log.type);
  const [points, setPoints] = useState<number | ''>(log.points || 5);
  const [category, setCategory] = useState<string>(log.category || '');
  const [behaviorTitle, setBehaviorTitle] = useState<string>(log.behaviorTitle || '');
  const [reason, setReason] = useState<string>(log.reason || '');
  const [notes, setNotes] = useState<string>(log.notes || '');
  const [recordedBy, setRecordedBy] = useState<string>(log.recordedBy || 'เจ้าหน้าที่ฝ่ายปกครอง');
  const [violationDate, setViolationDate] = useState<string>(
    log.violationDate ? log.violationDate.slice(0, 10) : (log.recordedAt ? log.recordedAt.slice(0, 10) : new Date().toISOString().slice(0, 10))
  );
  const [recordedAt] = useState<string>(
    log.recordedAt ? log.recordedAt.slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [academicYear, setAcademicYear] = useState<number>(log.academicYear || currentAcademicYear);
  const [term, setTerm] = useState<number>(log.term || currentTerm);
  
  // Standard behaviors from database (ONLY user-created, NO system automatic presets)
  const [dbBehaviors, setDbBehaviors] = useState<StandardConductBehavior[]>(propBehaviors || []);
  const [selectedBehaviorId, setSelectedBehaviorId] = useState<string | null>(log.behaviorId || null);
  const [behaviorSearch, setBehaviorSearch] = useState<string>('');
  const [selectedPresetCategory, setSelectedPresetCategory] = useState<string>('ALL');
  const [autoFilledBehaviorTitle, setAutoFilledBehaviorTitle] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sync prop behaviors or fetch if empty
  useEffect(() => {
    if (propBehaviors && propBehaviors.length > 0) {
      setDbBehaviors(propBehaviors);
    } else {
      let isMounted = true;
      fetchStandardBehaviors()
        .then(items => {
          if (isMounted && items) {
            setDbBehaviors(items);
          }
        })
        .catch(err => {
          console.error('Error fetching standard behaviors in EditConductLogModal:', err);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [propBehaviors]);

  const gradeInfo = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);
  const isDeduct = type === 'DEDUCT';

  // Quick points chips
  const quickPoints = isDeduct ? [5, 10, 15, 20, 30] : [5, 10, 15, 20, 25];
  const numericPoints = typeof points === 'number' ? points : (parseInt(String(points), 10) || 0);

  // Filter standard behaviors for the currently active conduct type (DEDUCT / ADD)
  // STRICTLY only include behaviors created by the user (exclude any hardcoded system presets)
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
    // เรียงตามชื่อพฤติกรรมมาตรฐาน (ก-ฮ)
    return result.sort((a, b) => {
      const titleCompare = (a.title || '').localeCompare(b.title || '', 'th');
      if (titleCompare !== 0) return titleCompare;
      return (Number(a.points) || 0) - (Number(b.points) || 0);
    });
  }, [dbBehaviors, type]);

  // Distinct categories in current user-created behaviors
  const presetCategories = useMemo(() => {
    const cats = new Set<string>();
    currentTypeBehaviors.forEach(b => {
      if (b.category && b.category.trim()) cats.add(b.category.trim());
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'th'));
  }, [currentTypeBehaviors]);

  // Filtered by search & category, sorted by title (ชื่อพฤติกรรม ก-ฮ)
  const filteredTypeBehaviors = useMemo(() => {
    return currentTypeBehaviors.filter(b => {
      if (selectedPresetCategory !== 'ALL' && b.category !== selectedPresetCategory) return false;
      if (behaviorSearch.trim()) {
        const q = behaviorSearch.trim().toLowerCase();
        const matchTitle = (b.title || '').toLowerCase().includes(q);
        const matchCat = (b.category || '').toLowerCase().includes(q);
        const matchDesc = (b.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCat && !matchDesc) return false;
      }
      return true;
    }).sort((a, b) => {
      const titleCompare = (a.title || '').localeCompare(b.title || '', 'th');
      if (titleCompare !== 0) return titleCompare;
      return (Number(a.points) || 0) - (Number(b.points) || 0);
    });
  }, [currentTypeBehaviors, selectedPresetCategory, behaviorSearch]);

  // Quick preset selection
  const selectPreset = (b: StandardConductBehavior) => {
    setSelectedBehaviorId(b.id);
    setPoints(b.points);
    if (b.category && b.category.trim()) {
      setCategory(b.category.trim());
    }
    setBehaviorTitle(b.title);
    if (b.description && b.description.trim()) {
      setReason(b.description.trim());
    }
    setAutoFilledBehaviorTitle(b.title);
  };

  // Quick date setters
  const setDateToday = () => {
    setViolationDate(new Date().toISOString().split('T')[0]);
  };

  const setDateYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setViolationDate(d.toISOString().split('T')[0]);
  };

  // Compute simulated updated student after applying this edit to all student logs
  const { simulatedUpdatedStudent, updatedEnrichedLog } = useMemo(() => {
    const safePoints = Math.max(1, numericPoints);
    const updatedCandidate: ConductLog = {
      ...log,
      type,
      points: safePoints,
      category: category.trim() || log.category || '',
      behaviorTitle: behaviorTitle.trim() || log.behaviorTitle || undefined,
      description: reason.trim() || undefined,
      reason: reason.trim() || log.reason || (type === 'DEDUCT' ? 'หักคะแนนความประพฤติ' : 'เพิ่มคะแนนความประพฤติ'),
      violationDate: violationDate || undefined,
      notes: notes.trim() || undefined,
      recordedBy: recordedBy.trim() || 'เจ้าหน้าที่ฝ่ายปกครอง',
      recordedByName: recordedBy.trim() || 'เจ้าหน้าที่ฝ่ายปกครอง',
      recordedAt: recordedAt ? new Date(recordedAt).toISOString() : log.recordedAt,
      academicYear,
      term
    };

    const studentLogs = (allStudentLogs && allStudentLogs.length > 0)
      ? allStudentLogs
      : [log];

    const logsToReplay = studentLogs.map(l => (l.id === log.id ? updatedCandidate : l));
    if (!logsToReplay.some(l => l.id === log.id)) {
      logsToReplay.push(updatedCandidate);
    }

    const calculatedStudent = recalculateStudentScoresFromLogs(student, logsToReplay, maxBankedPoints);
    const enrichedLogs = computeLogsWithRunningScores(student, logsToReplay, maxBankedPoints);
    const enrichedLog = enrichedLogs.find(l => l.id === log.id) || updatedCandidate;

    return {
      simulatedUpdatedStudent: calculatedStudent,
      updatedEnrichedLog: enrichedLog
    };
  }, [log, student, allStudentLogs, type, numericPoints, category, behaviorTitle, reason, violationDate, notes, recordedBy, recordedAt, academicYear, term, maxBankedPoints]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    if (numericPoints <= 0) {
      alert('จำนวนคะแนนต้องมากกว่า 0');
      return;
    }

    // ปิดกล่องรับข้อมูลทันทีเมื่อกดบันทึกข้อมูล
    onClose();

    // บันทึกการแก้ไขแบบทันใจ (Optimistic UI & Background persistence)
    onSave(updatedEnrichedLog, simulatedUpdatedStudent).catch((err: any) => {
      console.error('Error saving edited log:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกการแก้ไข: ' + (err?.message || 'กรุณาลองใหม่อีกครั้ง'));
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - matching ConductActionModal theme */}
        <div
          className={`p-4 sm:p-5 text-white flex items-center justify-between transition-colors ${
            isDeduct
              ? 'bg-gradient-to-r from-rose-600 via-rose-700 to-red-800'
              : 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-xs shrink-0">
              {isDeduct ? (
                <MinusCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {isDeduct ? 'แก้ไขการหักคะแนนความประพฤติ' : 'แก้ไขการเพิ่มคะแนนความประพฤติ'}
              </h2>
              <p className="text-xs text-white/80">
                รหัสบันทึก: <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded">{log.id}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Quick Card & Live Recalculation Strip */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
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
              <span
                className={`text-sm sm:text-base font-black ${
                  isDeduct ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {numericPoints > 0 ? simulatedUpdatedStudent.currentScore : student.currentScore}
              </span>
              <span className="text-[10px] text-slate-400">/ 100</span>
              {(simulatedUpdatedStudent.bankedPoints ?? 0) > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 ml-0.5">
                  (+{simulatedUpdatedStudent.bankedPoints} สำรอง)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Form Body - matching ConductActionModal exactly */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Action Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setType('DEDUCT');
                setSelectedBehaviorId(null);
                setAutoFilledBehaviorTitle(null);
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
                setAutoFilledBehaviorTitle(null);
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
                จำนวนคะแนน ({isDeduct ? 'หัก' : 'เพิ่ม'}):
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
                        ? isDeduct
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {isDeduct ? `-${p}` : `+${p}`}
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

          {/* Standard Behaviors (Database / Presets) */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>พฤติกรรมมาตรฐาน:</span>
              </label>
              <span className="text-[11px] text-slate-400">
                แตะเพื่อเลือกหัวข้อและคะแนนอัตโนมัติ
              </span>
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
            {currentTypeBehaviors.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center">
                <p className="text-xs text-slate-600 font-medium mb-1">
                  ยังไม่มีรายการ{isDeduct ? 'หักคะแนน' : 'เพิ่มคะแนน'}ที่คุณเพิ่มไว้ในระบบ
                </p>
                <p className="text-[11px] text-slate-400">
                  (ระบบไม่แทรกรายการมาตรฐานอัตโนมัติ จะแสดงเฉพาะรายการที่คุณเพิ่มเองในฐานข้อมูลเท่านั้น)
                </p>
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
                          ? isDeduct
                            ? 'bg-rose-50 border-rose-300 shadow-2xs ring-1 ring-rose-400'
                            : 'bg-emerald-50 border-emerald-300 shadow-2xs ring-1 ring-emerald-400'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="font-bold text-xs text-slate-800 line-clamp-1">
                          {preset.title}
                        </span>
                        <span
                          className={`font-mono text-[11px] font-extrabold px-1.5 py-0.2 rounded shrink-0 ${
                            isDeduct ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isDeduct ? `-${preset.points}` : `+${preset.points}`}
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

          {/* Behavior Title / Standard Topic */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              หัวข้อ / ชื่อพฤติกรรมมาตรฐาน:
            </label>
            <input
              type="text"
              value={behaviorTitle}
              onChange={e => {
                setBehaviorTitle(e.target.value);
                setAutoFilledBehaviorTitle(null);
              }}
              placeholder="เช่น การมาสาย / ไม่เข้าแถว, ช่วยงานกิจกรรมของโรงเรียน..."
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Reason / Details & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                รายละเอียดพฤติกรรม / เกณฑ์การพิจารณา (ถ้ามี):
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="ระบุรายละเอียดเพิ่มเติม หรือเกณฑ์การพิจารณา (ถ้ามีให้ระบุ ไม่มีปล่อยว่างได้)"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>{isDeduct ? 'วันที่เกิดเหตุ:' : 'วันที่ทำ:'}</span>
                <div className="flex gap-1 text-[10px]">
                  <button type="button" onClick={setDateToday} className="text-indigo-600 hover:underline cursor-pointer">
                    วันนี้
                  </button>
                  <span>•</span>
                  <button type="button" onClick={setDateYesterday} className="text-indigo-600 hover:underline cursor-pointer">
                    วานนี้
                  </button>
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

          {/* Academic Year & Term */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ปีการศึกษา:
              </label>
              <input
                type="number"
                value={academicYear}
                onChange={e => setAcademicYear(parseInt(e.target.value) || currentAcademicYear)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ภาคเรียน (เทอม):
              </label>
              <select
                value={term}
                onChange={e => setTerm(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                <option value={1}>เทอม 1</option>
                <option value={2}>เทอม 2</option>
              </select>
            </div>
          </div>

          {/* Recorder & Notes */}
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

          {/* Live Outcome Summary Box - matching ConductActionModal exactly */}
          <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs space-y-1">
            <div className="font-bold text-indigo-900 flex items-center justify-between">
              <span>ผลการคำนวณคะแนนตามกฎ:</span>
              <span className="font-mono text-xs sm:text-sm">
                {numericPoints > 0 ? (
                  `${student.currentScore ?? 100} ➔ ${simulatedUpdatedStudent.currentScore} คะแนน`
                ) : (
                  `${student.currentScore ?? 100} คะแนน (รอระบุแต้ม)`
                )}
              </span>
            </div>
            {numericPoints > 0 && (
              <div className="text-[11px] text-slate-600">
                {isDeduct ? (
                  (simulatedUpdatedStudent.bankedPoints ?? 0) < (student.bankedPoints ?? 0) ? (
                    <span className="text-emerald-700 font-semibold">
                      🛡️ นำแต้มสะสมสำรองมาช่วยหัก {(student.bankedPoints ?? 0) - (simulatedUpdatedStudent.bankedPoints ?? 0)} แต้ม
                    </span>
                  ) : (
                    <span>หักจากคะแนนหลัก {numericPoints} คะแนน</span>
                  )
                ) : (
                  <span>
                    เติมคะแนนหลักจนเต็ม 100
                    {(simulatedUpdatedStudent.bankedPoints ?? 0) > (student.bankedPoints ?? 0) && (
                      <span className="text-emerald-700 font-bold ml-1">
                        (มีแต้มเหลือ +{(simulatedUpdatedStudent.bankedPoints ?? 0) - (student.bankedPoints ?? 0)} เข้าคะแนนสะสมสำรอง)
                      </span>
                    )}
                  </span>
                )}
                {isDeduct && simulatedUpdatedStudent.currentScore <= 50 && (
                  <div className="text-rose-600 font-bold mt-0.5 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>คำเตือน: คะแนนหลังหักจะเหลือ ≤ 50 คะแนน (ระดับวิกฤต)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving || numericPoints <= 0}
              className={`w-full sm:w-auto px-5 py-2 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                isDeduct
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>กำลังบันทึกการแก้ไข...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>บันทึกการแก้ไขทันที</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
