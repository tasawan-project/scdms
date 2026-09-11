import React, { useState, useMemo } from 'react';
import { Student, ConductLog } from '../types';
import { StudentAvatar } from './StudentAvatar';
import { calculateStudentGrade } from '../utils/conductLogic';
import {
  Trash2,
  User,
  Users,
  Search,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  History,
  X,
  ChevronDown,
  ChevronUp,
  Award,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface ConductResetManagerProps {
  students: Student[];
  conductLogs: ConductLog[];
  currentAcademicYear?: number;
  dbLoading?: boolean;
  onRequestClearIndividual: (student: Student, logsCount: number) => void;
  onRequestClearAll: (totalStudents: number, totalLogs: number) => void;
  onAuditAndReconcile?: () => Promise<{ inspectedStudentsCount: number; fixedStudentsCount: number; fixedStudentIds: string[] }>;
}

export const ConductResetManager: React.FC<ConductResetManagerProps> = ({
  students,
  conductLogs,
  currentAcademicYear = 2569,
  dbLoading = false,
  onRequestClearIndividual,
  onRequestClearAll,
  onAuditAndReconcile
}) => {
  const [resetScope, setResetScope] = useState<'INDIVIDUAL' | 'ALL'>('INDIVIDUAL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [showLogsDetail, setShowLogsDetail] = useState<boolean>(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<{ inspectedCount: number; fixedCount: number } | null>(null);

  const handleRunAudit = async () => {
    if (!onAuditAndReconcile) return;
    setIsAuditing(true);
    setAuditResult(null);
    try {
      const res = await onAuditAndReconcile();
      setAuditResult({ inspectedCount: res.inspectedStudentsCount, fixedCount: res.fixedStudentsCount });
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการตรวจสอบ: ' + (err.message || 'กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setIsAuditing(false);
    }
  };

  // Selected student object
  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return students.find(s => s.id === selectedStudentId) || null;
  }, [selectedStudentId, students]);

  // Logs for selected student
  const selectedStudentLogs = useMemo(() => {
    if (!selectedStudentId) return [];
    return conductLogs
      .filter(l => l.studentId === selectedStudentId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }, [selectedStudentId, conductLogs]);

  // Counts for selected student
  const studentDeductLogs = useMemo(() => {
    return selectedStudentLogs.filter(l => l.type === 'DEDUCT' || (l.pointsDelta ?? 0) < 0);
  }, [selectedStudentLogs]);

  const studentAddLogs = useMemo(() => {
    return selectedStudentLogs.filter(l => l.type === 'ADD' || (l.pointsDelta ?? 0) > 0);
  }, [selectedStudentLogs]);

  // Filter students for search in INDIVIDUAL mode
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) {
      return students.slice(0, 6);
    }
    const q = searchQuery.toLowerCase().trim();
    return students
      .filter(s => {
        const idMatch = s.id?.toLowerCase().includes(q);
        const nameMatch = `${s.title || ''}${s.firstName || ''} ${s.lastName || ''}`.toLowerCase().includes(q);
        const gradeInfo = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
        const roomMatch = `${gradeInfo.grade}/${s.room}`.toLowerCase().includes(q);
        return idMatch || nameMatch || roomMatch;
      })
      .slice(0, 8);
  }, [students, searchQuery, currentAcademicYear]);

  // Overall statistics for ALL mode
  const systemStats = useMemo(() => {
    const totalLogs = conductLogs.length;
    const totalStudents = students.length;
    const studentsWithLogsSet = new Set(conductLogs.map(l => l.studentId));
    const studentsWithModifiedScore = students.filter(
      s =>
        (s.currentScore ?? 100) !== 100 ||
        (s.bankedPoints ?? 0) > 0 ||
        !s.hasNeverBeenDeducted ||
        (s.totalDeductionsCount ?? 0) > 0 ||
        (s.totalDeductedPoints ?? 0) > 0 ||
        (s.totalAddedPoints ?? 0) > 0
    );
    const affectedCount = new Set([...Array.from(studentsWithLogsSet), ...studentsWithModifiedScore.map(s => s.id)]).size;
    const totalDeductLogs = conductLogs.filter(l => l.type === 'DEDUCT' || (l.pointsDelta ?? 0) < 0).length;
    const totalAddLogs = conductLogs.filter(l => l.type === 'ADD' || (l.pointsDelta ?? 0) > 0).length;

    return {
      totalLogs,
      totalStudents,
      affectedCount,
      totalDeductLogs,
      totalAddLogs
    };
  }, [students, conductLogs]);

  return (
    <div className="p-5 bg-rose-50/40 border border-rose-200/90 rounded-2xl space-y-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
            <RotateCcw className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <span>ลบประวัติและร่องรอยคะแนนความประพฤติ</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                ลบประวัติ & คืนคะแนน 100
              </span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              ลบประวัติการเพิ่ม/หักคะแนน พร้อมคืนคะแนนเริ่มต้นเป็น 100 คะแนน ล้างคะแนนสะสม และคืนสถานะไม่เคยถูกหักคะแนน
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center p-1 bg-white border border-slate-200 rounded-xl shadow-2xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setResetScope('INDIVIDUAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              resetScope === 'INDIVIDUAL'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>เลือกเป็นรายบุคคล</span>
          </button>
          <button
            type="button"
            onClick={() => setResetScope('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              resetScope === 'ALL'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>เลือกทั้งหมด ({students.length})</span>
          </button>
        </div>
      </div>

      {/* 6 Criteria Clean Slate Audit Tool */}
      <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/90 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                ตรวจสอบและลบร่องรอยออกจาก 6 เกณฑ์มาตรฐาน
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                สถานะปกติ 100 เต็ม
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              ตรวจสอบนักเรียนที่โดนลบประวัติและร่องรอยคะแนนความประพฤติ แล้วลบประวัติออกจาก 6 เกณฑ์มาตรฐาน ให้กลับสู่สถานะ <strong>ปกติ (คะแนนเต็ม 100)</strong> เหมือนไม่เคยทำความผิด และไม่เคยเพิ่มความดี โดยสมบูรณ์
            </p>
            {auditResult && (
              <p className="text-[11px] font-bold text-emerald-800 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  ตรวจสอบนักเรียน {auditResult.inspectedCount} คน {auditResult.fixedCount > 0 ? `(ปรับปรุงข้อมูลเรียบร้อย ${auditResult.fixedCount} คน)` : '(ข้อมูลสะอาดสมบูรณ์ ไม่มีร่องรอยค้าง)'}
                </span>
              </p>
            )}
          </div>
        </div>

        {onAuditAndReconcile && (
          <button
            type="button"
            disabled={dbLoading || isAuditing}
            onClick={handleRunAudit}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-stretch sm:self-auto justify-center"
          >
            {isAuditing ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังตรวจสอบ...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>ตรวจสอบและลบร่องรอยทันที</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* MODE 1: INDIVIDUAL STUDENT */}
      {resetScope === 'INDIVIDUAL' && (
        <div className="space-y-3 pt-1">
          {!selectedStudent ? (
            <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <label className="block text-xs font-bold text-slate-700">
                ค้นหาและเลือกนักเรียนที่ต้องการลบประวัติและคืนคะแนน
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="พิมพ์รหัสประจำตัว, ชื่อ-นามสกุล หรือ ชั้น/ห้อง (เช่น 05505, สมชาย, ม.1/1)..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              {/* Student Results List */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">
                    ไม่พบข้อมูลนักเรียนที่ตรงกับคำค้นหา
                  </div>
                ) : (
                  filteredStudents.map(st => {
                    const stLogs = conductLogs.filter(l => l.studentId === st.id);
                    const isPristine =
                      (st.currentScore ?? 100) === 100 &&
                      (st.bankedPoints ?? 0) === 0 &&
                      st.hasNeverBeenDeducted &&
                      (st.totalDeductionsCount ?? 0) === 0 &&
                      (st.totalDeductedPoints ?? 0) === 0 &&
                      (st.totalAddedPoints ?? 0) === 0 &&
                      stLogs.length === 0;
                    const gradeInfo = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);

                    return (
                      <div
                        key={st.id}
                        onClick={() => {
                          setSelectedStudentId(st.id);
                          setShowLogsDetail(false);
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-rose-50/70 border border-transparent hover:border-rose-200 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <StudentAvatar student={st} size="sm" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                {st.id}
                              </span>
                              <span className="text-xs font-bold text-slate-800 group-hover:text-rose-900">
                                {st.title || ''}{st.firstName} {st.lastName}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>{gradeInfo.grade}/{st.room}</span>
                              <span>•</span>
                              <span>เลขที่ {st.number}</span>
                              {st.advisorName && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[120px]">ครู{st.advisorName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <div className="text-xs font-black">
                              <span className={st.currentScore < 50 ? 'text-rose-600' : st.currentScore < 80 ? 'text-amber-600' : 'text-emerald-600'}>
                                {st.currentScore ?? 100}
                              </span>
                              <span className="text-slate-400 font-normal">/100</span>
                              {(st.bankedPoints ?? 0) > 0 && (
                                <span className="ml-1 text-[10px] font-bold text-sky-600 bg-sky-50 px-1 py-0.2 rounded">
                                  +{st.bankedPoints}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {stLogs.length > 0 ? (
                                <span className="text-rose-600 font-semibold">{stLogs.length} รายการประวัติ</span>
                              ) : isPristine ? (
                                <span className="text-emerald-600">คะแนนเต็ม (ไม่มีประวัติ)</span>
                              ) : (
                                <span>ไม่มีประวัติ</span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            เลือก
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Selected Student Detail Card */
            <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <StudentAvatar student={selectedStudent} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {selectedStudent.id}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {selectedStudent.title || ''}{selectedStudent.firstName} {selectedStudent.lastName}
                      </h4>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{calculateStudentGrade(selectedStudent.entryYear, selectedStudent.entryLevel, currentAcademicYear).grade}/{selectedStudent.room}</span>
                      <span>•</span>
                      <span>เลขที่ {selectedStudent.number}</span>
                      {selectedStudent.advisorName && (
                        <>
                          <span>•</span>
                          <span>ครูที่ปรึกษา: {selectedStudent.advisorName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudentId(null);
                    setShowLogsDetail(false);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>เปลี่ยนคน</span>
                </button>
              </div>

              {/* Status Comparison Grid: Before -> After */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-semibold">คะแนนปัจจุบัน</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-base font-black text-slate-800">
                      {selectedStudent.currentScore ?? 100}
                    </span>
                    <span className="text-xs text-rose-600 font-bold">➔ 100 เต็ม</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-semibold">คะแนนสะสมสำรอง</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-base font-black text-slate-800">
                      +{selectedStudent.bankedPoints ?? 0}
                    </span>
                    <span className="text-xs text-rose-600 font-bold">➔ 0 แต้ม</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-semibold">สถานะการตัดคะแนน</div>
                  <div className="mt-1 text-xs font-bold text-slate-800 flex items-center gap-1">
                    {selectedStudent.hasNeverBeenDeducted ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> ไม่เคยถูกหัก
                      </span>
                    ) : (
                      <span className="text-amber-700 flex items-center gap-1">
                        <RotateCcw className="w-3.5 h-3.5 text-rose-600" /> คืนสถานะใหม่
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-semibold">6 เกณฑ์มาตรฐาน</div>
                  <div className="mt-1 text-xs font-black text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>➔ ปกติ (100 เต็ม)</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-semibold">ประวัติที่จะถูกลบ</div>
                  <div className="mt-1 text-xs font-black text-rose-700 flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{selectedStudentLogs.length} รายการ</span>
                  </div>
                </div>
              </div>

              {/* Logs Breakdown & Preview */}
              {selectedStudentLogs.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600 flex items-center gap-3">
                      <span>ประวัติหักคะแนน: <strong className="text-rose-600">{studentDeductLogs.length}</strong> รายการ</span>
                      <span>•</span>
                      <span>ประวัติเพิ่มคะแนน: <strong className="text-emerald-600">{studentAddLogs.length}</strong> รายการ</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLogsDetail(!showLogsDetail)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showLogsDetail ? 'ซ่อนรายการประวัติ' : 'ดูรายการประวัติที่จะถูกลบ'}</span>
                      {showLogsDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {showLogsDetail && (
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs bg-slate-50/50">
                      {selectedStudentLogs.map(log => {
                        const isDeduct = log.type === 'DEDUCT' || (log.pointsDelta ?? 0) < 0;
                        return (
                          <div key={log.id} className="p-2.5 flex items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${isDeduct ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                <span>{log.reason}</span>
                                <span className="text-[10px] text-slate-400 font-normal">({log.category})</span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                <span>{new Date(log.recordedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                {log.recordedByName && <span> • โดย {log.recordedByName}</span>}
                              </div>
                            </div>
                            <div className={`font-mono font-black ${isDeduct ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {isDeduct ? `-${Math.abs(log.points)}` : `+${log.points}`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>นักเรียนคนนี้ไม่มีประวัติการตัดหรือเพิ่มคะแนนในระบบ (คะแนน {selectedStudent.currentScore ?? 100}/100)</span>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  เมื่อยืนยัน ระบบจะลบประวัติของนักเรียนคนนี้ออกจากฐานข้อมูล ปรับคะแนนเป็น 100 เต็ม และนำออกจาก 6 เกณฑ์มาตรฐาน (คืนสู่เกณฑ์ปกติ เหมือนไม่เคยทำความผิดและไม่เคยเพิ่มความดี)
                </div>

                <button
                  type="button"
                  disabled={dbLoading}
                  onClick={() => onRequestClearIndividual(selectedStudent, selectedStudentLogs.length)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบประวัติและรีเซ็ตคะแนนนักเรียนคนนี้</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: ALL STUDENTS */}
      {resetScope === 'ALL' && (
        <div className="space-y-3 bg-white p-4 rounded-xl border border-rose-200 shadow-xs">
          {/* Warning Banner */}
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="font-bold text-xs text-rose-950">
                คำเตือน: การลบประวัติและร่องรอยคะแนนความประพฤติของนักเรียนทั้งหมดในระบบ
              </h5>
              <p className="text-xs text-rose-850 leading-relaxed">
                การดำเนินการนี้จะทำการล้างประวัติการตัดคะแนนและเพิ่มคะแนนทั้งหมดของโรงเรียนอย่างถาวร
                พร้อมปรับคืนคะแนนความประพฤติของนักเรียนทุกคนกลับเป็น <strong>100 คะแนนเต็ม</strong>, ล้างคะแนนสะสมสำรองเป็น 0 และคืนสถานะ "ไม่เคยถูกหักคะแนน"
              </p>
            </div>
          </div>

          {/* System Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <div className="text-[11px] text-slate-500 font-semibold">นักเรียนทั้งหมด</div>
              <div className="text-lg font-black text-slate-800 mt-0.5">{systemStats.totalStudents} คน</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <div className="text-[11px] text-slate-500 font-semibold">นักเรียนที่มีประวัติ/คะแนนเปลี่ยน</div>
              <div className="text-lg font-black text-amber-700 mt-0.5">{systemStats.affectedCount} คน</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <div className="text-[11px] text-slate-500 font-semibold">ประวัติการตัดคะแนน</div>
              <div className="text-lg font-black text-rose-600 mt-0.5">{systemStats.totalDeductLogs} รายการ</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <div className="text-[11px] text-slate-500 font-semibold">ประวัติการเพิ่มคะแนน</div>
              <div className="text-lg font-black text-emerald-600 mt-0.5">{systemStats.totalAddLogs} รายการ</div>
            </div>
          </div>

          {/* Detailed Consequences Checklist */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
            <div className="font-bold text-slate-800">ผลของการดำเนินการ:</div>
            <ul className="space-y-1 pl-4 list-disc text-slate-600">
              <li>ลบรายการในตารางประวัติความประพฤติ (Conduct Logs) ทั้งหมด {systemStats.totalLogs} รายการ</li>
              <li>ปรับคะแนนความประพฤตินักเรียนทุกคน ({systemStats.totalStudents} คน) กลับเป็น 100 คะแนนเต็ม</li>
              <li>รีเซ็ตคะแนนสะสมสำรอง (Banked Points) ของทุกคนเป็น 0 แต้ม</li>
              <li>คืนสถานะ "ไม่เคยถูกหักคะแนน" ให้กับนักเรียนทุกคน</li>
              <li className="text-emerald-700 font-medium">
                <strong>ข้อมูลที่จะไม่ถูกลบ:</strong> รายชื่อนักเรียน, รหัสประจำตัว, ข้อมูลชั้น/ห้อง, ข้อมูลครูที่ปรึกษา, บัญชีผู้ใช้งานระบบ และการตั้งค่าโรงเรียนจะยังคงอยู่ครบถ้วน
              </li>
            </ul>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              ต้องยืนยันรหัสผ่านผู้ดูแลระบบ (Admin) ก่อนดำเนินการ
            </div>

            <button
              type="button"
              disabled={dbLoading}
              onClick={() => onRequestClearAll(systemStats.totalStudents, systemStats.totalLogs)}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบประวัติและรีเซ็ตคะแนนนักเรียนทั้งหมด ({systemStats.totalStudents} คน)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
