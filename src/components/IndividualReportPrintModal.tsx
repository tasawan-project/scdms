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

      // Collect all parent stylesheets
      const styleSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(el => el.outerHTML)
        .join('\n');

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
          ${styleSheets}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 10mm 12mm 10mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            html, body {
              font-family: 'Sarabun', 'TH Sarabun New', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-size: 10pt !important;
              line-height: 1.45 !important;
            }
            .no-print {
              display: none !important;
            }
            #individual-report-paper {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: #ffffff !important;
            }
            .report-bio-box {
              border: 1px solid #94a3b8 !important;
              border-radius: 8px !important;
              padding: 12px 16px !important;
              background-color: #f8fafc !important;
              margin-bottom: 16px !important;
            }
            .report-bio-inner {
              display: flex !important;
              flex-direction: row !important;
              align-items: center !important;
              gap: 16px !important;
            }
            .report-photo-col {
              width: 100px !important;
              min-width: 100px !important;
              flex-shrink: 0 !important;
              text-align: center !important;
            }
            .report-details-col {
              flex: 1 !important;
              min-width: 0 !important;
              display: flex !important;
              flex-direction: column !important;
              gap: 8px !important;
            }
            .report-details-grid {
              display: grid !important;
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 4px 16px !important;
              border-bottom: 1px solid #e2e8f0 !important;
              padding-bottom: 8px !important;
              font-size: 12px !important;
            }
            .report-score-cards {
              display: grid !important;
              grid-template-columns: repeat(4, 1fr) !important;
              gap: 8px !important;
              padding-top: 2px !important;
              text-align: center !important;
            }
            .score-card {
              padding: 6px 4px !important;
              background-color: #ffffff !important;
              border: 1px solid #cbd5e1 !important;
              border-radius: 6px !important;
            }
            .score-card-highlight {
              padding: 6px 4px !important;
              background-color: #eef2ff !important;
              border: 2px solid #6366f1 !important;
              border-radius: 6px !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-top: 4px !important;
              margin-bottom: 10px !important;
              font-size: 10pt !important;
            }
            th, td {
              border: 1px solid #94a3b8 !important;
              padding: 5px 6px !important;
              text-align: left !important;
              vertical-align: middle !important;
            }
            th {
              background-color: #f1f5f9 !important;
              font-weight: 700 !important;
              color: #0f172a !important;
            }
            tr {
              page-break-inside: avoid !important;
            }
            thead {
              display: table-header-group !important;
            }
            .text-center { text-align: center !important; }
            .text-right { text-align: right !important; }
            .text-left { text-align: left !important; }
            .font-bold { font-weight: bold !important; }
            .school-logo-wrapper {
              width: 42px !important;
              height: 42px !important;
              min-width: 42px !important;
              min-height: 42px !important;
              max-width: 42px !important;
              max-height: 42px !important;
              overflow: hidden !important;
              flex-shrink: 0 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
            }
            img.school-logo, .school-logo, img[alt="School Logo"] {
              width: 42px !important;
              height: 42px !important;
              min-width: 42px !important;
              min-height: 42px !important;
              max-width: 42px !important;
              max-height: 42px !important;
              object-fit: contain !important;
              display: block !important;
            }
            .student-photo-box {
              width: 96px !important;
              height: 124px !important;
              min-width: 96px !important;
              min-height: 124px !important;
              max-width: 96px !important;
              max-height: 124px !important;
              overflow: hidden !important;
              border: 1px solid #94a3b8 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              margin: 0 auto !important;
            }
            img.student-photo, .student-photo {
              width: 100% !important;
              height: 100% !important;
              max-width: 100% !important;
              max-height: 100% !important;
              object-fit: cover !important;
              display: block !important;
            }
          </style>
        </head>
        <body>
          ${contentClone.outerHTML}
        </body>
        </html>
      `);
      frameDoc.close();

      const triggerPrint = () => {
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
      };

      // Ensure all images (logo & student photo) in iframe are fully loaded before printing
      const imgs = frameDoc.images;
      if (imgs && imgs.length > 0) {
        let loaded = 0;
        const total = imgs.length;
        const checkDone = () => {
          loaded++;
          if (loaded >= total) {
            setTimeout(triggerPrint, 150);
          }
        };
        for (let i = 0; i < total; i++) {
          if (imgs[i].complete) {
            loaded++;
          } else {
            imgs[i].onload = checkDone;
            imgs[i].onerror = checkDone;
          }
        }
        if (loaded >= total) {
          setTimeout(triggerPrint, 150);
        } else {
          setTimeout(triggerPrint, 1000); // Fallback timeout
        }
      } else {
        setTimeout(triggerPrint, 200);
      }
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 individual-print-modal-container print:p-0 print:bg-white print:static print:overflow-visible">
      <div className="relative bg-slate-100 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden my-auto print:max-w-full print:max-h-none print:shadow-none print:border-none print:bg-white print:overflow-visible">
        {/* Header Bar */}
        <div className="no-print bg-white px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
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
            <div className="no-print bg-white/90 border border-slate-300 rounded-xl p-3 text-xs text-slate-600 flex items-center justify-between shadow-2xs gap-2 flex-wrap">
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
            <div className="no-print pt-2 pb-6 flex items-center justify-center gap-3">
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
