import React from 'react';
import {
  Student,
  ConductLog,
  SystemSettings,
  HomeroomAdvisor,
  Dormitory
} from '../types';
import { calculateStudentGrade, getScoreCategory, getStudentAdvisors } from '../utils/conductLogic';
import { matchStudentToDormitory } from '../utils/dormitoryLogic';
import { formatThaiDate } from '../utils/thaiDate';
import { School, CheckCircle2, ShieldCheck, User } from 'lucide-react';

interface IndividualReportDocumentProps {
  student: Student;
  conductLogs: ConductLog[];
  currentAcademicYear: number;
  currentTerm: number;
  systemSettings?: SystemSettings;
  advisors?: HomeroomAdvisor[];
  dormitories?: Dormitory[];
  showPreviewBadge?: boolean;
}

export const IndividualReportDocument: React.FC<IndividualReportDocumentProps> = ({
  student,
  conductLogs,
  currentAcademicYear,
  currentTerm,
  systemSettings,
  advisors = [],
  dormitories = [],
  showPreviewBadge = false
}) => {
  const schoolName = systemSettings?.schoolNameTh || systemSettings?.schoolName || 'โรงเรียนตัวอย่างวิทยา';
  const gradeInfo = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);
  const scoreCategory = getScoreCategory(student, systemSettings);

  // Match Dormitory
  const matchedDorm = matchStudentToDormitory(student, dormitories, currentAcademicYear);
  const dormName = student.dormitoryName || matchedDorm.dormitory?.name || '-';

  // Matched Advisors
  const studentAdvisors = getStudentAdvisors(student, advisors, currentAcademicYear);
  const advisorNamesList: string[] = studentAdvisors.length > 0
    ? studentAdvisors.map(a => (a.fullName || `${a.prefix || ''}${a.firstName} ${a.lastName}`).trim()).filter(Boolean)
    : (student.advisorName ? [student.advisorName.trim()] : []);

  // Filter logs for this student
  const studentLogs = conductLogs
    .filter(log => log.studentId === student.id)
    .sort((a, b) => new Date(a.recordedAt || a.violationDate || 0).getTime() - new Date(b.recordedAt || b.violationDate || 0).getTime());

  const totalDeducted = student.totalDeductedPoints ?? studentLogs.filter(l => l.type === 'DEDUCT').reduce((sum, l) => sum + l.points, 0);
  const totalAdded = student.totalAddedPoints ?? studentLogs.filter(l => l.type === 'ADD').reduce((sum, l) => sum + l.points, 0);
  const deductionsCount = student.totalDeductionsCount ?? studentLogs.filter(l => l.type === 'DEDUCT').length;

  return (
    <div className="w-full">
      {/* Visual A4 Paper Container with realistic sheet shadow on HTML preview */}
      <div
        id="individual-report-paper"
        className="bg-white text-slate-900 border border-slate-300 shadow-xl rounded-sm p-6 sm:p-10 md:p-12 max-w-[210mm] mx-auto print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-full print:rounded-none relative"
        style={{
          fontFamily: "'Sarabun', 'TH Sarabun New', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}
      >
        {/* On-screen Preview Watermark / Tag */}
        {showPreviewBadge && (
          <div className="no-print absolute top-3 right-4 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300/80 rounded-md text-[11px] font-bold shadow-2xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>ตัวอย่างรูปแบบการพิมพ์บน HTML (ขนาด A4)</span>
          </div>
        )}

        {/* 1. Official Header / Letterhead */}
        <div className="text-center border-b-2 border-slate-800 pb-4 mb-5 space-y-1">
          <div className="flex items-center justify-center gap-3.5 mb-1.5">
            {systemSettings?.logoUrl ? (
              <img
                src={systemSettings.logoUrl}
                alt="School Logo"
                className="school-logo object-contain shrink-0"
                style={{
                  width: '48px',
                  height: '48px',
                  maxWidth: '48px',
                  maxHeight: '48px',
                  objectFit: 'contain',
                  display: 'inline-block'
                }}
              />
            ) : (
              <div
                className="school-logo rounded-xl bg-slate-900 text-white flex items-center justify-center print:bg-black shrink-0"
                style={{
                  width: '48px',
                  height: '48px',
                  minWidth: '48px',
                  minHeight: '48px'
                }}
              >
                <School className="w-7 h-7" />
              </div>
            )}
            <div className="text-left">
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-tight">
                {schoolName}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-700">
                ฝ่ายกิจการนักเรียนและกลุ่มงานส่งเสริมวินัยนักเรียน
              </p>
            </div>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-900 pt-1 tracking-tight">
            ใบบันทึกคะแนนและรายงานความประพฤตินักเรียนรายบุคคล
          </h2>
          <div className="text-xs text-slate-600 flex items-center justify-center gap-2 flex-wrap">
            <span>ประจำปีการศึกษา <strong>{currentAcademicYear}</strong></span>
            <span>•</span>
            <span>ภาคเรียนที่ <strong>{currentTerm}</strong></span>
            <span>•</span>
            <span>ข้อมูล ณ วันที่ {formatThaiDate(new Date().toISOString(), 'full')}</span>
          </div>
        </div>

        {/* 2. Student Bio & Score Summary Box */}
        <div className="border border-slate-400 rounded-lg p-3.5 sm:p-4 mb-5 bg-slate-50/50 print:bg-transparent">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Student Photo */}
            <div className="md:col-span-3 flex flex-col items-center justify-center text-center">
              <div
                className="student-photo-box rounded-md border-2 border-slate-400 bg-white overflow-hidden shadow-2xs flex items-center justify-center print:shadow-none"
                style={{
                  width: '96px',
                  height: '124px',
                  minWidth: '96px',
                  minHeight: '124px',
                  maxWidth: '96px',
                  maxHeight: '124px'
                }}
              >
                {student.photoUrl ? (
                  <img
                    src={student.photoUrl}
                    alt={student.firstName}
                    className="student-photo object-cover"
                    style={{
                      width: '100%',
                      height: '100%',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-2">
                    <User className="w-10 h-10 mb-1" />
                    <span className="text-[10px] font-semibold">รูปถ่ายนักเรียน</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 font-mono">{student.id}</span>
            </div>

            {/* Student Details Grid */}
            <div className="md:col-span-9 space-y-2 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 border-b border-slate-200 pb-2">
                <div>
                  <span className="text-slate-500 text-xs">ชื่อ - นามสกุล: </span>
                  <span className="font-bold text-slate-950 text-sm">
                    {student.title}{student.firstName} {student.lastName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">รหัสประจำตัวนักเรียน: </span>
                  <span className="font-bold font-mono text-slate-950">{student.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">ระดับชั้น / ห้อง: </span>
                  <span className="font-bold text-slate-900">{gradeInfo.grade}/{student.room}</span>
                  {student.number && (
                    <span className="ml-2 text-slate-600 font-semibold">(เลขที่ {student.number})</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 text-xs">หอพัก: </span>
                  <span className="font-semibold text-slate-900">{dormName}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 text-xs">ครูที่ปรึกษา: </span>
                  <span className="font-semibold text-slate-800">
                    {advisorNamesList.length > 0 ? advisorNamesList.join(' , ') : '-'}
                  </span>
                </div>
              </div>

              {/* Official Scores Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                <div className="p-2 bg-white border border-slate-300 rounded print:border-slate-400">
                  <span className="text-[10px] text-slate-500 block">คะแนนเริ่มต้น</span>
                  <span className="text-base font-bold font-mono text-slate-800">100</span>
                </div>
                <div className="p-2 bg-white border border-slate-300 rounded print:border-slate-400">
                  <span className="text-[10px] text-slate-500 block">ถูกหักสะสม</span>
                  <span className="text-base font-bold font-mono text-rose-600">
                    {totalDeducted > 0 ? `-${totalDeducted}` : '0'}
                  </span>
                  <span className="text-[9px] text-slate-400 block font-normal">({deductionsCount} ครั้ง)</span>
                </div>
                <div className="p-2 bg-white border border-slate-300 rounded print:border-slate-400">
                  <span className="text-[10px] text-slate-500 block">ได้รับเพิ่มสะสม</span>
                  <span className="text-base font-bold font-mono text-emerald-600">
                    {totalAdded > 0 ? `+${totalAdded}` : '0'}
                  </span>
                </div>
                <div className="p-2 bg-indigo-50/70 border-2 border-indigo-500/60 rounded print:bg-white print:border-slate-800">
                  <span className="text-[10px] text-indigo-950 font-bold block print:text-slate-800">คะแนนคงเหลือสุทธิ</span>
                  <span className="text-lg font-black font-mono text-indigo-900 print:text-black">
                    {student.currentScore}
                  </span>
                  {student.bankedPoints > 0 && (
                    <span className="text-[9px] font-bold text-purple-700 block">
                      (สำรอง +{student.bankedPoints})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <div>
                  <span className="text-slate-500">สถานะความประพฤติ: </span>
                  <span className="font-bold text-slate-900 px-2 py-0.5 rounded border border-slate-300 bg-white inline-block">
                    {scoreCategory.label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {student.hasNeverBeenDeducted ? 'รักษาคะแนนเต็มสมบูรณ์' : `มีประวัติการบันทึก ${studentLogs.length} รายการ`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Itemized Conduct History Table */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-xs sm:text-sm text-slate-950 flex items-center gap-1.5">
              <span>รายการบันทึกคะแนนความประพฤติและกิจกรรม (Conduct History)</span>
              <span className="text-xs font-normal text-slate-500">({studentLogs.length} รายการ)</span>
            </h3>
          </div>

          <table className="w-full text-xs border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100 text-slate-900 print:bg-slate-200">
                <th className="border border-slate-400 p-1.5 text-center w-8">ที่</th>
                <th className="border border-slate-400 p-1.5 text-center w-24">วันที่ / เวลา</th>
                <th className="border border-slate-400 p-1.5 text-center w-20">ประเภท</th>
                <th className="border border-slate-400 p-1.5 text-left">หัวข้อความประพฤติ / กิจกรรม / รายละเอียด</th>
                <th className="border border-slate-400 p-1.5 text-left w-24">หมวดหมู่</th>
                <th className="border border-slate-400 p-1.5 text-center w-14">คะแนน</th>
                <th className="border border-slate-400 p-1.5 text-center w-16">คงเหลือ</th>
                <th className="border border-slate-400 p-1.5 text-left w-24">ผู้บันทึก</th>
              </tr>
            </thead>
            <tbody>
              {studentLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="border border-slate-400 p-6 text-center text-slate-600 bg-slate-50/50">
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 mb-0.5" />
                      <span className="font-bold text-slate-800 text-xs">
                        ไม่พบประวัติการถูกตัดคะแนนหรือกระทำผิดระเบียบ
                      </span>
                      <span className="text-[11px] text-slate-500">
                        นักเรียนรักษาคะแนนเต็ม 100 คะแนน และมีความประพฤติตามมาตรฐานของสถานศึกษาอย่างเรียบร้อย
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                studentLogs.map((log, index) => {
                  const isAdd = log.type === 'ADD';
                  const dateStr = log.violationDate || log.recordedAt;
                  return (
                    <tr
                      key={log.id}
                      className={index % 2 === 1 ? 'bg-slate-50/70 print:bg-transparent' : 'bg-white'}
                    >
                      <td className="border border-slate-400 p-1.5 text-center text-slate-500 font-mono">
                        {index + 1}
                      </td>
                      <td className="border border-slate-400 p-1.5 text-center font-medium text-slate-700 whitespace-nowrap">
                        {formatThaiDate(dateStr, 'short')}
                      </td>
                      <td className="border border-slate-400 p-1.5 text-center whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isAdd
                            ? 'text-emerald-800 bg-emerald-50 border border-emerald-300 print:border-none'
                            : 'text-rose-800 bg-rose-50 border border-rose-300 print:border-none'
                        }`}>
                          {isAdd ? '+ เพิ่มคะแนน' : '- หักคะแนน'}
                        </span>
                      </td>
                      <td className="border border-slate-400 p-1.5 text-slate-900 leading-snug">
                        <div className="font-bold text-slate-900">
                          {log.behaviorTitle || log.reason || '-'}
                        </div>
                        {log.description && (
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            {log.description}
                          </div>
                        )}
                        {log.notes && log.notes !== log.description && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5">
                            หมายเหตุ: {log.notes}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-400 p-1.5 text-slate-700 text-[11px]">
                        {log.category || '-'}
                      </td>
                      <td className="border border-slate-400 p-1.5 text-center font-bold font-mono whitespace-nowrap">
                        <span className={isAdd ? 'text-emerald-700' : 'text-rose-700'}>
                          {isAdd ? `+${log.points}` : `-${log.points}`}
                        </span>
                      </td>
                      <td className="border border-slate-400 p-1.5 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                        {log.scoreAfter ?? '-'}
                      </td>
                      <td className="border border-slate-400 p-1.5 text-slate-600 text-[11px]">
                        {log.recordedByName || log.recordedBy || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Document Footer Note */}
        <div className="mt-8 pt-2 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-200">
          <span>{schoolName} • ระบบบริหารจัดการคะแนนความประพฤตินักเรียน</span>
          <span>เอกสารพิมพ์เมื่อ: {formatThaiDate(new Date().toISOString(), 'full-with-time')}</span>
        </div>
      </div>
    </div>
  );
};
