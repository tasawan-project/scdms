import React, { useState, useMemo } from 'react';
import { Student, ConductLog, ConductType } from '../types';
import { recalculateStudentScoresFromLogs, calculateStudentGrade, computeLogsWithRunningScores } from '../utils/conductLogic';
import { formatThaiDate } from '../utils/thaiDate';
import { StudentAvatar } from './StudentAvatar';
import {
  X,
  Edit,
  MinusCircle,
  PlusCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileText,
  User,
  Clock,
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface EditConductLogModalProps {
  isOpen?: boolean;
  log: ConductLog;
  student: Student;
  allStudentLogs?: ConductLog[];
  currentAcademicYear?: number;
  currentTerm?: number;
  maxBankedPoints?: number;
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
  onClose,
  onSave
}) => {
  if (!isOpen) return null;

  const [type, setType] = useState<ConductType>(log.type);
  const [points, setPoints] = useState<number>(log.points || 5);
  const [category, setCategory] = useState<string>(log.category || (log.type === 'DEDUCT' ? 'วินัยทั่วไป' : 'กิจกรรมทั่วไป'));
  const [reason, setReason] = useState<string>(log.reason || '');
  const [notes, setNotes] = useState<string>(log.notes || '');
  const [recordedBy, setRecordedBy] = useState<string>(log.recordedBy || 'เจ้าหน้าที่ฝ่ายปกครอง');
  const [violationDate, setViolationDate] = useState<string>(
    log.violationDate ? log.violationDate.slice(0, 10) : (log.recordedAt ? log.recordedAt.slice(0, 10) : new Date().toISOString().slice(0, 10))
  );
  const [recordedAt, setRecordedAt] = useState<string>(
    log.recordedAt ? log.recordedAt.slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [academicYear, setAcademicYear] = useState<number>(log.academicYear || currentAcademicYear);
  const [term, setTerm] = useState<number>(log.term || currentTerm);
  
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const gradeInfo = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);

  // Quick points chips
  const quickPoints = type === 'DEDUCT' ? [5, 10, 15, 20, 30] : [5, 10, 15, 20, 25];

  // Compute simulated updated student after applying this edit to all student logs
  const { simulatedUpdatedStudent, updatedEnrichedLog } = useMemo(() => {
    const rawPoints = Math.max(1, Number(points) || 1);
    const updatedCandidate: ConductLog = {
      ...log,
      type,
      points: rawPoints,
      category: category.trim() || (type === 'DEDUCT' ? 'วินัยทั่วไป' : 'ความดีทั่วไป'),
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
  }, [log, student, allStudentLogs, type, points, category, reason, violationDate, notes, recordedBy, recordedAt, academicYear, term, maxBankedPoints]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    if (points <= 0) {
      alert('จำนวนคะแนนต้องมากกว่า 0');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(updatedEnrichedLog, simulatedUpdatedStudent);
      onClose();
    } catch (err: any) {
      console.error('Error saving edited log:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกการแก้ไข: ' + (err.message || 'กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-700 via-indigo-800 to-blue-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
              <Edit className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">แก้ไขข้อมูลประวัติคะแนนความประพฤติ</h2>
              <p className="text-xs text-white/80 mt-0.5">
                รหัสบันทึก: <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded">{log.id}</span>
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

        {/* Student Summary & Live Recalculation Preview Strip */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StudentAvatar
              student={student}
              currentAcademicYear={currentAcademicYear}
              size="sm"
            />
            <div>
              <div className="font-bold text-slate-900 text-sm">
                {student.title}{student.firstName} {student.lastName}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                รหัส {student.id} • ชั้น {gradeInfo.grade}/{student.room}
              </div>
            </div>
          </div>

          <div className="bg-white px-3.5 py-2 rounded-2xl border border-slate-200/80 shadow-2xs text-right">
            <div className="text-[11px] font-semibold text-slate-500">ผลคะแนนรวมหลังแก้ไข:</div>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-xs text-slate-400 font-mono line-through">
                {student.currentScore}
              </span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span className="font-mono font-black text-sm sm:text-base text-indigo-600">
                {simulatedUpdatedStudent.currentScore}
              </span>
              <span className="text-xs text-slate-400 font-normal">/ 100</span>
              {(simulatedUpdatedStudent.bankedPoints ?? 0) > 0 && (
                <span className="text-xs font-bold text-emerald-600 ml-0.5">
                  (+{simulatedUpdatedStudent.bankedPoints} สำรอง)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Type Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ประเภทการบันทึก:
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setType('DEDUCT')}
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
                onClick={() => setType('ADD')}
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
          </div>

          {/* Points Section with Quick Chips */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                จำนวนคะแนน ({type === 'DEDUCT' ? 'หัก' : 'เพิ่ม'}):
              </label>
              <span className="text-[11px] text-slate-400">เลือกแต้มด่วนหรือระบุเอง</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={points}
                  onChange={e => setPoints(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  required
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  แต้ม
                </span>
              </div>
              {/* Quick Point Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {quickPoints.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPoints(p)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      points === p
                        ? type === 'DEDUCT'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
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
            <label className="block text-xs font-bold text-slate-700 mb-1">
              หมวดหมู่พฤติกรรม:
            </label>
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="ระบุหมวดหมู่พฤติกรรม เช่น วินัยทั่วไป, จิตอาสา"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              required
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              เหตุผล / รายละเอียดพฤติกรรม:
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="ระบุพฤติกรรมหรือกิจกรรมอย่างละเอียด..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Date & Term */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {type === 'DEDUCT' ? 'วันที่กระทำผิด:' : 'วันที่ทำกิจกรรม:'}
              </label>
              <input
                type="date"
                value={violationDate}
                onChange={e => setViolationDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ปีการศึกษา:
              </label>
              <input
                type="number"
                value={academicYear}
                onChange={e => setAcademicYear(parseInt(e.target.value) || currentAcademicYear)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ภาคเรียน (เทอม):
              </label>
              <select
                value={term}
                onChange={e => setTerm(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                <option value={1}>เทอม 1</option>
                <option value={2}>เทอม 2</option>
              </select>
            </div>
          </div>

          {/* Recorder & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ผู้บันทึก:
              </label>
              <input
                type="text"
                value={recordedBy}
                onChange={e => setRecordedBy(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                หมายเหตุเพิ่มเติม:
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="เช่น ปรับปรุงแก้ไขตามข้อตกลง"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
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
