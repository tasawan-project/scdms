import React, { useState } from 'react';
import {
  Student,
  SystemSettings,
  HomeroomAdvisor,
  Dormitory
} from '../types';
import { calculateStudentGrade, getScoreCategory, getStudentAdvisors } from '../utils/conductLogic';
import { formatThaiDate } from '../utils/thaiDate';
import {
  Printer,
  X,
  FileText,
  CheckCircle2,
  Building2,
  Maximize2,
  SlidersHorizontal
} from 'lucide-react';

interface DormitoryReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  dormitory: Dormitory | null;
  dormitoryFilter: string;
  printTypeFilter: 'ALL' | 'DEDUCTED_ONLY' | 'LESS_THAN_100' | 'FULL_100_ONLY';
  sortBy: 'ROOM_NUM' | 'NUM_ROOM' | 'SCORE_DESC' | 'SCORE_ASC' | 'ID';
  gradeFilter: string;
  currentAcademicYear: number;
  currentTerm: number;
  systemSettings?: SystemSettings;
  advisors?: HomeroomAdvisor[];
  supervisors?: { name: string; role?: string; phone?: string }[];
}

export interface ColumnDefinition {
  id: string;
  label: string;
  shortLabel: string;
  visible: boolean;
  align: 'left' | 'center' | 'right';
  width: string;
}

const DEFAULT_COLUMNS: ColumnDefinition[] = [
  { id: 'index', label: 'ลำดับ (#)', shortLabel: '#', visible: true, align: 'center', width: '38px' },
  { id: 'classRoom', label: 'ชั้น/ห้อง', shortLabel: 'ชั้น/ห้อง', visible: true, align: 'center', width: '68px' },
  { id: 'number', label: 'เลขที่', shortLabel: 'เลขที่', visible: true, align: 'center', width: '48px' },
  { id: 'studentId', label: 'รหัสนักเรียน', shortLabel: 'รหัส', visible: true, align: 'center', width: '78px' },
  { id: 'name', label: 'ชื่อ - นามสกุล', shortLabel: 'ชื่อ-นามสกุล', visible: true, align: 'left', width: 'auto' },
  { id: 'score', label: 'คะแนนคงเหลือ', shortLabel: 'คะแนนคงเหลือ', visible: true, align: 'center', width: '78px' },
  { id: 'banked', label: 'คะแนนสำรอง', shortLabel: 'คะแนนสำรอง', visible: true, align: 'center', width: '68px' },
  { id: 'deducted', label: 'หักสะสม', shortLabel: 'หักสะสม', visible: true, align: 'center', width: '68px' },
  { id: 'status', label: 'สถานะคะแนน', shortLabel: 'สถานะ', visible: true, align: 'center', width: '85px' },
  { id: 'advisor', label: 'ครูที่ปรึกษา', shortLabel: 'ครูที่ปรึกษา', visible: true, align: 'left', width: '140px' }
];

export const DormitoryReportPrintModal: React.FC<DormitoryReportPrintModalProps> = ({
  isOpen,
  onClose,
  students,
  dormitory,
  dormitoryFilter,
  printTypeFilter,
  sortBy,
  currentAcademicYear,
  currentTerm,
  systemSettings,
  advisors = [],
  supervisors = []
}) => {
  // Paper orientation state: 'portrait' (แนวตั้ง) | 'landscape' (แนวนอน)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Column visibility settings
  const [columns, setColumns] = useState<ColumnDefinition[]>(DEFAULT_COLUMNS);
  const [showColumnPicker, setShowColumnPicker] = useState<boolean>(false);

  if (!isOpen) return null;

  // School name & School logo from System Settings ("เมนูตั้งค่าระบบ ข้อมูลโรงเรียนและระบบ")
  const schoolName = systemSettings?.schoolNameTh || systemSettings?.schoolName || 'โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย เชียงราย';
  const schoolLogo = systemSettings?.logoUrl || systemSettings?.schoolLogoUrl || '/favicon.svg';

  // Dormitory display name on the document header
  const dormDisplayName = dormitory
    ? dormitory.name
    : dormitoryFilter === 'ALL'
    ? 'ทุกหอพัก (รวมทุกหอพัก)'
    : 'นักเรียนที่ยังไม่ระบุหอพัก';

  // Condition label text
  const conditionLabel =
    printTypeFilter === 'DEDUCTED_ONLY'
      ? '(เฉพาะนักเรียนที่โดนหักคะแนน)'
      : printTypeFilter === 'LESS_THAN_100'
      ? '(เฉพาะนักเรียนที่คะแนนไม่ถึง 100)'
      : printTypeFilter === 'FULL_100_ONLY'
      ? '(เฉพาะนักเรียนที่คะแนนครบ 100 คะแนน)'
      : '(นักเรียนทั้งหมด)';

  // Sort description label
  const sortLabel =
    sortBy === 'ROOM_NUM'
      ? 'ชั้น/ห้อง ตามด้วย เลขที่ (จากน้อยไปหามาก)'
      : sortBy === 'NUM_ROOM'
      ? 'เลขที่ ตามด้วย ชั้น/ห้อง'
      : sortBy === 'SCORE_DESC'
      ? 'คะแนนมากที่สุดไปน้อยที่สุด'
      : sortBy === 'SCORE_ASC'
      ? 'คะแนนน้อยที่สุดไปมากที่สุด'
      : 'รหัสนักเรียน';

  // Advisor helper
  const getAdvisorNames = (student: Student): string => {
    const list = getStudentAdvisors(student, advisors, currentAcademicYear);
    if (list && list.length > 0) {
      return list
        .map(a => (a.fullName || `${a.prefix || ''}${a.firstName} ${a.lastName}`).trim())
        .filter(Boolean)
        .join(', ');
    }
    if (student.advisorName && student.advisorName.trim()) {
      return student.advisorName.trim();
    }
    return '-';
  };

  // Toggle specific column visibility
  const toggleColumn = (id: string) => {
    setColumns(prev =>
      prev.map(col => (col.id === id ? { ...col, visible: !col.visible } : col))
    );
  };

  // Reset columns to all visible
  const resetColumns = (allVisible: boolean = true) => {
    setColumns(prev => prev.map(col => ({ ...col, visible: allVisible })));
  };

  // Check if a column is visible
  const isColVisible = (id: string) => {
    return columns.find(c => c.id === id)?.visible ?? true;
  };

  const visibleCount = columns.filter(c => c.visible).length;

  // Execution: Pure print iframe with orientation, visible columns and repeated thead
  const executePrint = () => {
    setIsPrinting(true);

    try {
      const oldFrame = document.getElementById('dormitory-print-modal-iframe');
      if (oldFrame) {
        oldFrame.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'dormitory-print-modal-iframe';
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

      const docTitle = `รายงานคะแนนความประพฤติ_${dormDisplayName}_${printTypeFilter}`;

      // Build table headers HTML based on column visibility
      const headersHtml = columns
        .filter(c => c.visible)
        .map(c => {
          const alignStyle = c.align === 'left' ? 'text-align: left; padding-left: 6px;' : 'text-align: center;';
          const widthStyle = c.width !== 'auto' ? `width: ${c.width};` : '';
          return `<th style="${widthStyle} ${alignStyle}">${c.label}</th>`;
        })
        .join('');

      // Build rows HTML based on visible columns
      const rowsHtml = students
        .map((st, idx) => {
          const g = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
          const cat = getScoreCategory(st, systemSettings);
          const advName = getAdvisorNames(st);

          // Score color
          let scoreColor = '#15803d'; // emerald-700
          if (st.currentScore < 50) scoreColor = '#b91c1c'; // rose-700
          else if (st.currentScore <= 70) scoreColor = '#c2410c'; // orange-700
          else if (st.currentScore <= 99) scoreColor = '#b45309'; // amber-700

          const cells: string[] = [];

          if (isColVisible('index')) {
            cells.push(`<td style="text-align: center; padding: 4px; font-family: monospace;">${idx + 1}</td>`);
          }
          if (isColVisible('classRoom')) {
            cells.push(`<td style="text-align: center; padding: 4px; font-weight: bold; background-color: #f8fafc;">${g.grade}/${st.room}</td>`);
          }
          if (isColVisible('number')) {
            cells.push(`<td style="text-align: center; padding: 4px; font-weight: bold;">${st.number || '-'}</td>`);
          }
          if (isColVisible('studentId')) {
            cells.push(`<td style="text-align: center; padding: 4px; font-family: monospace; font-weight: bold;">${st.id}</td>`);
          }
          if (isColVisible('name')) {
            cells.push(`<td style="padding: 4px 6px; font-weight: 500; white-space: nowrap;">${st.title}${st.firstName} ${st.lastName}</td>`);
          }
          if (isColVisible('score')) {
            cells.push(`<td style="text-align: center; padding: 4px; font-weight: bold; font-family: monospace; color: ${scoreColor};">${st.currentScore}</td>`);
          }
          if (isColVisible('banked')) {
            cells.push(`<td style="text-align: center; padding: 4px; font-family: monospace; color: #7e22ce;">${st.bankedPoints > 0 ? `+${st.bankedPoints}` : '-'}</td>`);
          }
          if (isColVisible('deducted')) {
            cells.push(`<td style="text-align: center; padding: 4px; font-family: monospace; color: #e11d48;">${st.totalDeductedPoints ? `-${st.totalDeductedPoints}` : '0'}</td>`);
          }
          if (isColVisible('status')) {
            cells.push(`
              <td style="text-align: center; padding: 4px;">
                <span style="display: inline-block; padding: 1px 5px; border-radius: 4px; font-weight: bold; border: 1px solid #cbd5e1; background-color: #f8fafc;">
                  ${cat.shortLabel}
                </span>
              </td>
            `);
          }
          if (isColVisible('advisor')) {
            cells.push(`<td style="padding: 4px 6px; color: #334155; line-height: 1.25;">${advName}</td>`);
          }

          return `
            <tr style="page-break-inside: avoid;">
              ${cells.join('')}
            </tr>
          `;
        })
        .join('');

      // Supervisors HTML
      let supervisorsHtml = '';
      if (supervisors && supervisors.length > 0) {
        supervisorsHtml = `
          <div style="font-size: 9.5pt; color: #334155; margin-top: 4px;">
            <span style="font-weight: bold; color: #1e293b;">ครูหอพักผู้ดูแล:</span>
            ${supervisors.map(s => `${s.name}${s.role ? ` (${s.role})` : ''}${s.phone ? ` โทร. ${s.phone}` : ''}`).join(' • ')}
          </div>
        `;
      }

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
              size: A4 ${orientation};
              margin: ${orientation === 'landscape' ? '8mm 8mm 10mm 8mm' : '10mm 8mm 12mm 8mm'};
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
              font-size: 9pt !important;
              line-height: 1.35 !important;
            }
            .header-container {
              text-align: center;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1.5px solid #0f172a;
            }
            .school-logo {
              width: 48px;
              height: 48px;
              object-fit: contain;
              margin: 0 auto 5px auto;
              display: block;
            }
            .school-title {
              font-size: 14pt;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 2px 0;
            }
            .report-title {
              font-size: 11.5pt;
              font-weight: 700;
              color: #1e1b4b;
              margin: 0 0 3px 0;
            }
            .dorm-badge {
              font-size: 11.5pt;
              font-weight: 800;
              color: #1e1b4b;
            }
            .condition-badge {
              font-size: 10.5pt;
              font-weight: 600;
              color: #475569;
              margin-left: 6px;
            }
            .meta-info {
              font-size: 10pt !important;
              font-weight: 600 !important;
              color: #1e293b !important;
              margin-top: 6px !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              page-break-inside: auto !important;
            }
            thead {
              display: table-header-group !important;
            }
            tbody {
              display: table-row-group !important;
            }
            tfoot {
              display: table-footer-group !important;
            }
            tr {
              page-break-inside: avoid !important;
              page-break-after: auto !important;
            }
            /* UNIFORM TABLE FONT SIZE (ขนาดตัวอักษรเท่ากันทั้งหมดในตาราง) */
            table, th, td, td *, th * {
              font-size: 9pt !important;
              line-height: 1.35 !important;
            }
            th {
              background-color: #f1f5f9 !important;
              color: #0f172a !important;
              font-weight: 700 !important;
              border: 1px solid #cbd5e1 !important;
              padding: 6px 4px !important;
              white-space: nowrap !important;
            }
            td {
              border: 1px solid #cbd5e1 !important;
              page-break-inside: avoid !important;
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            ${schoolLogo ? `<img src="${schoolLogo}" class="school-logo" alt="ตราโรงเรียน" />` : ''}
            <div class="school-title">${schoolName}</div>
            <div class="report-title">
              รายงานสรุปและบัญชีคะแนนความประพฤตินักเรียน
              <span class="dorm-badge">หอพัก: ${dormDisplayName}</span>
              <span class="condition-badge">${conditionLabel}</span>
            </div>
            ${supervisorsHtml}
            <div class="meta-info">
              ปีการศึกษา ${currentAcademicYear} ภาคเรียนที่ ${currentTerm} • 
              จัดเรียง: ${sortLabel} • 
              ข้อมูล ณ วันที่ ${formatThaiDate(new Date().toISOString())} • 
              จำนวนนักเรียนทั้งหมด: ${students.length} คน
            </div>
          </div>

          <table>
            <thead>
              <tr>
                ${headersHtml}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
        </html>
      `);
      frameDoc.close();

      const triggerPrint = () => {
        setIsPrinting(false);
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

      // Check image loading
      const imgs = frameDoc.images;
      if (imgs && imgs.length > 0) {
        let loaded = 0;
        const total = imgs.length;
        const checkDone = () => {
          loaded++;
          if (loaded >= total) triggerPrint();
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
          setTimeout(triggerPrint, 1000);
        }
      } else {
        setTimeout(triggerPrint, 200);
      }
    } catch (e) {
      console.error('Print modal error:', e);
      setIsPrinting(false);
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* Top Modal Toolbar (Light Tone Theme) */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shrink-0 flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-xs z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
                หน้าแสดงตัวอย่างการพิมพ์ (Print Preview)
              </h2>
              <span className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                รายงานแบบหอพัก
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              หอพัก: <span className="font-semibold text-slate-800">{dormDisplayName}</span> • {conditionLabel} • นักเรียน {students.length} คน
            </p>
          </div>
        </div>

        {/* Center Controls: Orientation + Column Visibility */}
        <div className="flex items-center gap-2 flex-wrap self-start xl:self-center">
          {/* Orientation Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                orientation === 'portrait'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="วางแนวกระดาษแบบแนวตั้ง (A4 Portrait)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>แนวตั้ง</span>
            </button>

            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                orientation === 'landscape'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="วางแนวกระดาษแบบแนวนอน (A4 Landscape)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>แนวนอน</span>
            </button>
          </div>

          {/* Column Visibility Selector Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColumnPicker(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                showColumnPicker
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
              title="เลือกซ่อนและแสดงคอลัมน์ที่ต้องการพิมพ์"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
              <span>เลือกคอลัมน์ ({visibleCount}/{columns.length})</span>
            </button>

            {/* Column Picker Popover */}
            {showColumnPicker && (
              <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-30 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">
                    ซ่อน/แสดงคอลัมน์ในรายงาน
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => resetColumns(true)}
                      className="text-[10px] text-indigo-600 hover:underline font-bold"
                    >
                      เลือกทั้งหมด
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setShowColumnPicker(false)}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      ปิด
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1 max-h-64 overflow-y-auto pr-1">
                  {columns.map(col => (
                    <label
                      key={col.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs transition-colors select-none"
                    >
                      <span className="font-medium text-slate-700">{col.label}</span>
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => toggleColumn(col.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Print & Close Buttons */}
        <div className="flex items-center gap-2.5 self-end xl:self-auto">
          <button
            type="button"
            onClick={executePrint}
            disabled={isPrinting || students.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            title="ส่งคำสั่งพิมพ์ไปยังเครื่องพิมพ์ หรือบันทึกเป็น PDF"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? 'กำลังเตรียมพิมพ์...' : 'สั่งพิมพ์เอกสาร'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="ปิดหน้าต่างตัวอย่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Helpful Notification Banner (Light Theme) */}
      <div className="bg-indigo-50/80 border-b border-indigo-100 px-4 py-1.5 text-center text-xs text-indigo-900 flex items-center justify-center gap-2 shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        <span>
          พิมพ์ซ้ำหัวตารางในหน้าต่อไปอัตโนมัติ (thead group) • ตัดคอลัมน์หอพักออกและแสดงบนหัวกระดาษ • ขนาดตัวอักษรในตารางเท่ากันทั้งหมด
        </span>
      </div>

      {/* Main Preview Container with Bright Light Canvas */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/90 flex flex-col items-center">
        {/* Paper Sheet Preview: h-auto so paper length naturally matches table height */}
        <div
          className={`bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200/90 transition-all p-6 sm:p-10 mb-12 h-auto ${
            orientation === 'landscape'
              ? 'w-full max-w-[1100px]'
              : 'w-full max-w-[840px]'
          }`}
          style={{ fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif" }}
        >
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-4 space-y-1">
            {/* School Logo directly from System Settings ("เมนูตั้งค่าระบบ ข้อมูลโรงเรียนและระบบ") */}
            {schoolLogo && (
              <img
                src={schoolLogo}
                alt="School Logo"
                className="w-14 h-14 object-contain mx-auto mb-1.5"
              />
            )}

            <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              {schoolName}
            </h1>
            <h2 className="text-sm sm:text-base font-extrabold text-indigo-950 flex items-center justify-center gap-2 flex-wrap">
              <span>รายงานสรุปและบัญชีคะแนนความประพฤตินักเรียน</span>
              <span className="text-indigo-900 underline decoration-indigo-300 underline-offset-2">
                หอพัก: {dormDisplayName}
              </span>
              <span className="text-slate-600 font-semibold">{conditionLabel}</span>
            </h2>

            {supervisors && supervisors.length > 0 && (
              <div className="text-xs text-slate-700 pt-1">
                <span className="font-bold text-slate-900">ครูหอพักผู้ดูแล:</span>{' '}
                {supervisors.map(s => `${s.name}${s.role ? ` (${s.role})` : ''}${s.phone ? ` โทร. ${s.phone}` : ''}`).join(' • ')}
              </div>
            )}

            {/* Adjusted Font Size for Meta Information Line */}
            <p className="text-xs sm:text-sm font-semibold text-slate-700 pt-1">
              ปีการศึกษา {currentAcademicYear} ภาคเรียนที่ {currentTerm} • 
              จัดเรียง: {sortLabel} • 
              ข้อมูล ณ วันที่ {formatThaiDate(new Date().toISOString())} • 
              จำนวนนักเรียนทั้งหมด: {students.length} คน
            </p>
          </div>

          {/* Student Table (Uniform Font Size text-xs across all cells!) */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border border-slate-300">
                  {isColVisible('index') && (
                    <th className="py-2 px-2 text-center border border-slate-300 w-9 text-xs font-bold">#</th>
                  )}
                  {isColVisible('classRoom') && (
                    <th className="py-2 px-2 text-center border border-slate-300 w-16 whitespace-nowrap text-xs font-bold">ชั้น/ห้อง</th>
                  )}
                  {isColVisible('number') && (
                    <th className="py-2 px-2 text-center border border-slate-300 w-12 whitespace-nowrap text-xs font-bold">เลขที่</th>
                  )}
                  {isColVisible('studentId') && (
                    <th className="py-2 px-2 text-center border border-slate-300 w-20 whitespace-nowrap text-xs font-bold">รหัสนักเรียน</th>
                  )}
                  {isColVisible('name') && (
                    <th className="py-2 px-3 text-left border border-slate-300 text-xs font-bold">ชื่อ - นามสกุล</th>
                  )}
                  {isColVisible('score') && (
                    <th className="py-2 px-2 text-center border border-slate-300 w-20 whitespace-nowrap text-xs font-bold">คะแนนคงเหลือ</th>
                  )}
                  {isColVisible('banked') && (
                    <th className="py-2 px-2 text-center border border-slate-300 w-16 whitespace-nowrap text-xs font-bold">คะแนนสำรอง</th>
                  )}
                  {isColVisible('deducted') && (
                    <th className="py-2 px-2 text-center border border-slate-300 w-16 whitespace-nowrap text-xs font-bold">หักสะสม</th>
                  )}
                  {isColVisible('status') && (
                    <th className="py-2 px-2 text-center border border-slate-300 w-22 whitespace-nowrap text-xs font-bold">สถานะคะแนน</th>
                  )}
                  {isColVisible('advisor') && (
                    <th className="py-2 px-3 text-left border border-slate-300 w-36 whitespace-nowrap text-xs font-bold">ครูที่ปรึกษา</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {students.length > 0 ? (
                  students.map((st, idx) => {
                    const g = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
                    const cat = getScoreCategory(st, systemSettings);
                    const advName = getAdvisorNames(st);

                    return (
                      <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                        {isColVisible('index') && (
                          <td className="py-1.5 px-2 text-center border border-slate-300 text-slate-600 font-mono text-xs">
                            {idx + 1}
                          </td>
                        )}
                        {isColVisible('classRoom') && (
                          <td className="py-1.5 px-2 text-center border border-slate-300 font-bold text-slate-800 bg-slate-50/70 whitespace-nowrap text-xs">
                            {g.grade}/{st.room}
                          </td>
                        )}
                        {isColVisible('number') && (
                          <td className="py-1.5 px-2 text-center border border-slate-300 font-bold font-mono text-slate-800 whitespace-nowrap text-xs">
                            {st.number || '-'}
                          </td>
                        )}
                        {isColVisible('studentId') && (
                          <td className="py-1.5 px-2 text-center border border-slate-300 font-mono font-bold text-slate-700 whitespace-nowrap text-xs">
                            {st.id}
                          </td>
                        )}
                        {isColVisible('name') && (
                          <td className="py-1.5 px-3 text-left border border-slate-300 font-medium text-slate-900 whitespace-nowrap text-xs">
                            {st.title}{st.firstName} {st.lastName}
                          </td>
                        )}
                        {isColVisible('score') && (
                          <td className="py-1.5 px-2 text-center border border-slate-300 font-black font-mono text-xs">
                            <span
                              className={
                                st.currentScore >= 100
                                  ? 'text-emerald-700'
                                  : st.currentScore >= 71
                                  ? 'text-amber-700'
                                  : st.currentScore >= 51
                                  ? 'text-orange-700'
                                  : 'text-rose-700'
                              }
                            >
                              {st.currentScore}
                            </span>
                          </td>
                        )}
                        {isColVisible('banked') && (
                          <td className="py-1.5 px-2 text-center border border-slate-300 font-mono text-purple-700 font-bold whitespace-nowrap text-xs">
                            {st.bankedPoints > 0 ? `+${st.bankedPoints}` : '-'}
                          </td>
                        )}
                        {isColVisible('deducted') && (
                          <td className="py-1.5 px-2 text-center border border-slate-300 font-mono text-rose-600 font-medium whitespace-nowrap text-xs">
                            {st.totalDeductedPoints ? `-${st.totalDeductedPoints}` : '0'}
                          </td>
                        )}
                        {isColVisible('status') && (
                          <td className="py-1.5 px-2 text-center border border-slate-300 whitespace-nowrap text-xs">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold border border-slate-200 ${cat.badgeClass}`}>
                              {cat.shortLabel}
                            </span>
                          </td>
                        )}
                        {isColVisible('advisor') && (
                          <td className="py-1.5 px-3 text-left border border-slate-300 text-slate-700 whitespace-nowrap text-xs">
                            {advName}
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={visibleCount || 1}
                      className="py-8 text-center text-slate-400 border border-slate-300 text-xs"
                    >
                      ไม่พบข้อมูลนักเรียนตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
