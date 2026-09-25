import React, { useState } from 'react';
import {
  Student,
  ConductLog,
  SystemSettings,
  HomeroomAdvisor,
  Dormitory
} from '../types';
import { IndividualReportDocument } from './IndividualReportDocument';
import { calculateStudentGrade } from '../utils/conductLogic';
import { formatThaiDate } from '../utils/thaiDate';
import * as XLSX from 'xlsx';
import {
  Printer,
  X,
  FileSpreadsheet,
  ExternalLink,
  FileText,
  Sparkles,
  Check
} from 'lucide-react';

interface IndividualReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  conductLogs: ConductLog[];
  currentAcademicYear: number;
  currentTerm: number;
  systemSettings?: SystemSettings;
  advisors?: HomeroomAdvisor[];
  dormitories?: Dormitory[];
  onNavigateToFullReport?: (studentId: string) => void;
}

export const IndividualReportPrintModal: React.FC<IndividualReportPrintModalProps> = ({
  isOpen,
  onClose,
  student,
  conductLogs,
  currentAcademicYear,
  currentTerm,
  systemSettings,
  advisors = [],
  dormitories = [],
  onNavigateToFullReport
}) => {
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printSuccess, setPrintSuccess] = useState<boolean>(false);

  if (!isOpen || !student) return null;

  const gradeInfo = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);

  // Print using hidden iframe for clean, pure document output
  const handlePrint = () => {
    setIsPrinting(true);

    const reportElem = document.getElementById('individual-report-paper');
    if (!reportElem) {
      window.print();
      setIsPrinting(false);
      return;
    }

    try {
      const oldFrame = document.getElementById('individual-print-iframe');
      if (oldFrame) {
        oldFrame.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'individual-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document;
      if (!frameDoc) {
        window.print();
        setIsPrinting(false);
        return;
      }

      const docTitle = `รายงานความประพฤติรายบุคคล_${student.id}_${student.firstName}`;
      const contentClone = reportElem.cloneNode(true) as HTMLElement;
      const noPrints = contentClone.querySelectorAll('.no-print');
      noPrints.forEach(el => el.remove());

      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
          <meta charset="utf-8">
          <title>${docTitle}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 10mm 15mm 10mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Sarabun', 'TH Sarabun New', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #0f172a;
              font-size: 10pt;
              line-height: 1.45;
            }
            .no-print {
              display: none !important;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              margin-bottom: 10px;
              font-size: 9pt;
            }
            th, td {
              border: 1px solid #64748b;
              padding: 4px 6px;
              text-align: left;
              vertical-align: middle;
            }
            th {
              background-color: #f1f5f9 !important;
              font-weight: 700;
              color: #0f172a;
            }
            tr {
              page-break-inside: avoid;
            }
            thead {
              display: table-header-group;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: bold; }
          </style>
        </head>
        <body>
          ${contentClone.innerHTML}
        </body>
        </html>
      `);
      frameDoc.close();

      setTimeout(() => {
        setIsPrinting(false);
        setPrintSuccess(true);
        setTimeout(() => setPrintSuccess(false), 3000);
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.warn('Iframe print failed, falling back to window.print', err);
          window.print();
        }
        setTimeout(() => {
          try {
            iframe.remove();
          } catch {}
        }, 4000);
      }, 400);
    } catch (e) {
      console.error('Print error:', e);
      setIsPrinting(false);
      window.print();
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    const studentLogs = conductLogs
      .filter(l => l.studentId === student.id)
      .sort((a, b) => new Date(a.recordedAt || a.violationDate || 0).getTime() - new Date(b.recordedAt || b.violationDate || 0).getTime());

    const rows = studentLogs.map((log, idx) => ({
      'ลำดับ': idx + 1,
      'วันที่': formatThaiDate(log.violationDate || log.recordedAt, 'short'),
      'ประเภท': log.type === 'ADD' ? 'เพิ่มคะแนน' : 'หักคะแนน',
      'คะแนน': log.points,
      'หัวข้อความประพฤติ': log.behaviorTitle || log.reason || '-',
      'หมวดหมู่': log.category || '-',
      'รายละเอียด': log.description || log.notes || '-',
      'คะแนนคงเหลือหลังบันทึก': log.scoreAfter ?? '-',
      'ผู้บันทึก': log.recordedByName || log.recordedBy || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ประวัติความประพฤติ');
    XLSX.writeFile(wb, `รายงานความประพฤติ_${student.id}_${student.firstName}_ปี${currentAcademicYear}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-slate-100 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header Bar */}
        <div className="bg-white px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  ตัวอย่างรูปแบบการพิมพ์รายงานรายบุคคล
                </h3>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  A4 Portrait
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {student.title}{student.firstName} {student.lastName} ({student.id}) • ชั้น {gradeInfo.grade}/{student.room}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="ส่งออกประวัติความประพฤติเป็นไฟล์ Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>

            {onNavigateToFullReport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToFullReport(student.id);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="เปิดในหน้ารายงานรายบุคคลฉบับเต็ม"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden md:inline">เปิดหน้ารายงาน</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              title="พิมพ์รายงานออกเครื่องพิมพ์ หรือบันทึกเป็น PDF"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'กำลังเตรียมพิมพ์...' : printSuccess ? 'ส่งพิมพ์แล้ว!' : 'พิมพ์รายงาน'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70">
          <div className="max-w-[210mm] mx-auto space-y-4">
            {/* HTML Preview Bar Notice */}
            <div className="bg-white/90 border border-slate-300 rounded-xl p-3 text-xs text-slate-600 flex items-center justify-between shadow-2xs gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>ตัวอย่างรูปแบบเอกสารจริง (Print Preview) ขนาด A4 พร้อมสั่งพิมพ์ได้ทันที</span>
              </div>
              <div className="text-[11px] text-slate-500">
                คะแนนคงเหลือ: <strong className="text-slate-800 font-bold">{student.currentScore}</strong> / 100
              </div>
            </div>

            {/* Document Component */}
            <IndividualReportDocument
              student={student}
              conductLogs={conductLogs}
              currentAcademicYear={currentAcademicYear}
              currentTerm={currentTerm}
              systemSettings={systemSettings}
              advisors={advisors}
              dormitories={dormitories}
              showPreviewBadge={false}
            />

            {/* Bottom Actions inside preview */}
            <div className="pt-2 pb-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrinting ? 'กำลังเตรียมพิมพ์...' : 'พิมพ์รายงานฉบับนี้'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
