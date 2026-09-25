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
import { School, CheckCircle2, User } from 'lucide-react';

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
        className="individual-report-container bg-white text-slate-900 border border-slate-300 shadow-xl rounded-sm p-6 sm:p-10 md:p-12 max-w-[210mm] mx-auto print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-full print:rounded-none relative"
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
        <div
          className="report-header text-center border-b-2 border-slate-800 pb-3 mb-4"
          style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px', textAlign: 'center' }}
        >
          <div
            className="header-logo-row flex items-center justify-center gap-3.5 mb-1.5"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '6px' }}
          >
            {systemSettings?.logoUrl ? (
              <div
                className="school-logo-wrapper"
                style={{
                  width: '42px',
                  height: '42px',
                  minWidth: '42px',
                  minHeight: '42px',
                  maxWidth: '42px',
                  maxHeight: '42px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}
              >
                <img
                  src={systemSettings.logoUrl}
                  alt="School Logo"
                  width={42}
                  height={42}
                  className="school-logo object-contain"
                  style={{
                    width: '100%',
                    height: '100%',
                    maxWidth: '42px',
                    maxHeight: '42px',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                />
              </div>
            ) : (
              <div
                className="school-logo-wrapper"
                style={{
                  width: '42px',
                  height: '42px',
                  minWidth: '42px',
                  minHeight: '42px',
                  maxWidth: '42px',
                  maxHeight: '42px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <School style={{ width: '22px', height: '22px' }} />
              </div>
            )}
            <div className="text-left" style={{ textAlign: 'left' }}>
              <h1
                className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-tight m-0"
                style={{ fontSize: '20px', fontWeight: 900, color: '#020617', margin: 0, lineHeight: 1.2 }}
              >
                {schoolName}
              </h1>
              <p
                className="text-xs sm:text-sm font-semibold text-slate-700 m-0"
                style={{ fontSize: '13px', fontWeight: 600, color: '#334155', margin: 0 }}
              >
                ฝ่ายกิจการนักเรียนและกลุ่มงานส่งเสริมวินัยนักเรียน
              </p>
            </div>
          </div>

          <h2
            className="text-base sm:text-lg font-bold text-slate-900 tracking-tight m-0"
            style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '4px 0 2px' }}
          >
            ใบบันทึกคะแนนและรายงานความประพฤตินักเรียนรายบุคคล
          </h2>
          <div
            className="text-xs text-slate-600 flex items-center justify-center gap-2 flex-wrap"
            style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <span>ประจำปีการศึกษา <strong>{currentAcademicYear}</strong></span>
            <span>•</span>
            <span>ภาคเรียนที่ <strong>{currentTerm}</strong></span>
            <span>•</span>
            <span>ข้อมูล ณ วันที่ {formatThaiDate(new Date().toISOString(), 'full')}</span>
          </div>
        </div>

        {/* 2. Student Bio & Score Summary Box (Guaranteed 2-column flex layout both in preview & print) */}
        <div
          className="report-bio-box border border-slate-400 rounded-lg p-3.5 sm:p-4 mb-4 bg-slate-50/70"
          style={{
            border: '1px solid #94a3b8',
            borderRadius: '8px',
            padding: '12px 16px',
            backgroundColor: '#f8fafc',
            marginBottom: '16px'
          }}
        >
          <div
            className="report-bio-inner flex flex-row items-center gap-4"
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            {/* Student Photo Column */}
            <div
              className="report-photo-col flex flex-col items-center justify-center text-center shrink-0"
              style={{
                width: '100px',
                minWidth: '100px',
                flexShrink: 0,
                textAlign: 'center'
              }}
            >
              <div
                className="student-photo-box rounded-md border-2 border-slate-400 bg-white overflow-hidden shadow-2xs flex items-center justify-center"
                style={{
                  width: '96px',
                  height: '124px',
                  minWidth: '96px',
                  minHeight: '124px',
                  maxWidth: '96px',
                  maxHeight: '124px',
                  margin: '0 auto',
                  borderRadius: '6px',
                  border: '1px solid #94a3b8',
                  backgroundColor: '#ffffff',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
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
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '6px' }}>
                    <User style={{ width: '38px', height: '38px', margin: '0 auto 2px' }} />
                    <span style={{ fontSize: '10px', fontWeight: 600, display: 'block' }}>รูปถ่ายนักเรียน</span>
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  marginTop: '4px',
                  display: 'block',
                  fontFamily: 'monospace'
                }}
              >
                {student.id}
              </span>
            </div>

            {/* Student Details & Score Summary Column */}
            <div
              className="report-details-col flex-1 min-w-0"
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {/* Top details: 2 columns */}
              <div
                className="report-details-grid border-b border-slate-200 pb-2 text-xs sm:text-sm"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '4px 16px',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '8px',
                  fontSize: '12px'
                }}
              >
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>ชื่อ - นามสกุล: </span>
                  <span style={{ fontWeight: 800, color: '#020617', fontSize: '13px' }}>
                    {student.title}{student.firstName} {student.lastName}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>รหัสประจำตัวนักเรียน: </span>
                  <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#020617', fontSize: '13px' }}>
                    {student.id}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>ระดับชั้น / ห้อง: </span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    {gradeInfo.grade}/{student.room}
                  </span>
                  {student.number && (
                    <span style={{ marginLeft: '6px', color: '#475569', fontWeight: 600 }}>
                      (เลขที่ {student.number})
                    </span>
                  )}
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>หอพัก: </span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{dormName}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>ครูที่ปรึกษา: </span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>
                    {advisorNamesList.length > 0 ? advisorNamesList.join(' , ') : '-'}
                  </span>
                </div>
              </div>

              {/* 4 Score Summary Cards in a neat single row */}
              <div
                className="report-score-cards"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '8px',
                  paddingTop: '2px',
                  textAlign: 'center'
                }}
              >
                <div
                  className="score-card"
                  style={{
                    padding: '6px 4px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px'
                  }}
                >
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 600 }}>คะแนนเริ่มต้น</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: '#1e293b' }}>
                    100
                  </span>
                </div>

                <div
                  className="score-card"
                  style={{
                    padding: '6px 4px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px'
                  }}
                >
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 600 }}>ถูกหักสะสม</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: '#e11d48' }}>
                    {totalDeducted > 0 ? `-${totalDeducted}` : '0'}
                  </span>
                  <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block', lineHeight: 1 }}>
                    ({deductionsCount} ครั้ง)
                  </span>
                </div>

                <div
                  className="score-card"
                  style={{
                    padding: '6px 4px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px'
                  }}
                >
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 600 }}>ได้รับเพิ่มสะสม</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: '#059669' }}>
                    {totalAdded > 0 ? `+${totalAdded}` : '0'}
                  </span>
                </div>

                <div
                  className="score-card-highlight"
                  style={{
                    padding: '6px 4px',
                    backgroundColor: '#eef2ff',
                    border: '2px solid #6366f1',
                    borderRadius: '6px'
                  }}
                >
                  <span style={{ fontSize: '10px', color: '#312e81', fontWeight: 700, display: 'block' }}>
                    คะแนนคงเหลือสุทธิ
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'monospace', color: '#3730a3' }}>
                    {student.currentScore}
                  </span>
                  {student.bankedPoints > 0 && (
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#7e22ce', display: 'block', lineHeight: 1 }}>
                      (สำรอง +{student.bankedPoints})
                    </span>
                  )}
                </div>
              </div>

              {/* Status and record summary line */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  paddingTop: '2px'
                }}
              >
                <div>
                  <span style={{ color: '#64748b' }}>สถานะความประพฤติ: </span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: '#0f172a',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      display: 'inline-block'
                    }}
                  >
                    {scoreCategory.label}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {student.hasNeverBeenDeducted ? 'รักษาคะแนนเต็มสมบูรณ์' : `มีประวัติการบันทึก ${studentLogs.length} รายการ`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Itemized Conduct History Table */}
        <div className="mb-4" style={{ marginBottom: '16px' }}>
          <div
            className="flex items-center justify-between mb-1.5"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}
          >
            <h3
              className="font-bold text-xs sm:text-sm text-slate-950 m-0"
              style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: 0 }}
            >
              รายการบันทึกคะแนนความประพฤติและกิจกรรม (Conduct History)
              <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748b', marginLeft: '6px' }}>
                ({studentLogs.length} รายการ)
              </span>
            </h3>
          </div>

          <table
            className="w-full text-xs border-collapse border border-slate-400"
            style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '11px' }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 4px', textAlign: 'center', width: '5%' }}>ที่</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 6px', textAlign: 'center', width: '15%', whiteSpace: 'nowrap' }}>วันที่ / เวลา</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 4px', textAlign: 'center', width: '12%', whiteSpace: 'nowrap' }}>ประเภท</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 8px', textAlign: 'left', width: '35%' }}>หัวข้อความประพฤติ / กิจกรรม / รายละเอียด</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 6px', textAlign: 'left', width: '13%' }}>หมวดหมู่</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 4px', textAlign: 'center', width: '7%', whiteSpace: 'nowrap' }}>คะแนน</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 4px', textAlign: 'center', width: '7%', whiteSpace: 'nowrap' }}>คงเหลือ</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 6px', textAlign: 'left', width: '12%' }}>ผู้บันทึก</th>
              </tr>
            </thead>
            <tbody>
              {studentLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      border: '1px solid #94a3b8',
                      padding: '24px',
                      textAlign: 'center',
                      color: '#475569',
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 style={{ width: '24px', height: '24px', color: '#059669', marginBottom: '4px' }} />
                      <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>
                        ไม่พบประวัติการถูกตัดคะแนนหรือกระทำผิดระเบียบ
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        นักเรียนรักษาคะแนนเต็ม 100 คะแนน และมีความประพฤติตามมาตรฐานของสถานศึกษาอย่างเรียบร้อย
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                studentLogs.map((log, index) => {
                  const isAdd = log.type === 'ADD';
                  const dateStr = log.violationDate || log.recordedAt;
                  const rowBg = index % 2 === 1 ? '#f8fafc' : '#ffffff';
                  return (
                    <tr
                      key={log.id}
                      style={{ backgroundColor: rowBg }}
                    >
                      <td style={{ border: '1px solid #94a3b8', padding: '5px 4px', textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>
                        {index + 1}
                      </td>
                      <td style={{ border: '1px solid #94a3b8', padding: '5px 6px', textAlign: 'center', fontWeight: 500, color: '#334155', whiteSpace: 'nowrap' }}>
                        {formatThaiDate(dateStr, 'short')}
                      </td>
                      <td style={{ border: '1px solid #94a3b8', padding: '5px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            display: 'inline-block',
                            backgroundColor: isAdd ? '#ecfdf5' : '#fff1f2',
                            color: isAdd ? '#065f46' : '#9f1239',
                            border: isAdd ? '1px solid #a7f3d0' : '1px solid #fecdd3'
                          }}
                        >
                          {isAdd ? '+ เพิ่มคะแนน' : '- หักคะแนน'}
                        </span>
                      </td>
                      <td style={{ border: '1px solid #94a3b8', padding: '5px 8px', color: '#0f172a', lineHeight: 1.35 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {log.behaviorTitle || log.reason || '-'}
                        </div>
                        {log.description && (
                          <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                            {log.description}
                          </div>
                        )}
                        {log.notes && log.notes !== log.description && (
                          <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                            หมายเหตุ: {log.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ border: '1px solid #94a3b8', padding: '5px 6px', color: '#334155', fontSize: '11px' }}>
                        {log.category || '-'}
                      </td>
                      <td style={{ border: '1px solid #94a3b8', padding: '5px 4px', textAlign: 'center', fontWeight: 800, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        <span style={{ color: isAdd ? '#059669' : '#e11d48' }}>
                          {isAdd ? `+${log.points}` : `-${log.points}`}
                        </span>
                      </td>
                      <td style={{ border: '1px solid #94a3b8', padding: '5px 4px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {log.scoreAfter ?? '-'}
                      </td>
                      <td style={{ border: '1px solid #94a3b8', padding: '5px 6px', color: '#475569', fontSize: '11px' }}>
                        {log.recordedByName || log.recordedBy || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Document Footer Note */}
        <div
          className="report-footer text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-200 pt-2"
          style={{
            borderTop: '1px solid #e2e8f0',
            paddingTop: '8px',
            fontSize: '10px',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>{schoolName} • ระบบบริหารจัดการคะแนนความประพฤตินักเรียน</span>
          <span>เอกสารพิมพ์เมื่อ: {formatThaiDate(new Date().toISOString(), 'full-with-time')}</span>
        </div>
      </div>
    </div>
  );
};
