import React, { useState, useMemo } from 'react';
import {
  Dormitory,
  Student,
  SystemSettings
} from '../types';
import {
  calculateStudentGrade
} from '../utils/conductLogic';
import {
  getDormitorySupervisors,
  cleanDormDisplayName
} from '../utils/dormitoryLogic';
import { THAI_MONTHS_FULL } from '../utils/thaiDate';
import {
  Printer,
  X,
  Layers,
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
  ExternalLink,
  FileText
} from 'lucide-react';

interface DormitoryStudentsPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  dormitories: Dormitory[];
  displayedStudents: Student[]; // นักเรียนตามผลการค้นหาและตัวกรองที่แสดงในตาราง
  currentAcademicYear: number;
  selectedDormFilter?: string;
  systemSettings?: SystemSettings;
  searchQuery?: string;
  selectedGradeFilter?: string;
  selectedRoomFilter?: string;
}

/**
 * ฟังก์ชันเรียงลำดับนักเรียนตาม:
 * 1. ระดับชั้น (ม.1 -> ม.6) จากน้อยไปหามาก
 * 2. ห้อง (1 -> 2 -> 3...) จากน้อยไปหามาก
 * 3. เลขที่ (1 -> 2 -> 3...) จากน้อยไปหามาก
 * 4. รหัสนักเรียน (สำรอง)
 */
export function sortStudentsByGradeRoomAndNumber(
  studentList: Student[],
  academicYear: number
): Student[] {
  return [...studentList].sort((a, b) => {
    const gradeA = calculateStudentGrade(a.entryYear, a.entryLevel, academicYear);
    const gradeB = calculateStudentGrade(b.entryYear, b.entryLevel, academicYear);

    // 1. ระดับชั้น (ม.1 = 1, ม.2 = 2, ..., ม.6 = 6)
    if (gradeA.gradeNumber !== gradeB.gradeNumber) {
      return gradeA.gradeNumber - gradeB.gradeNumber;
    }

    // 2. ห้องเรียน
    const roomA = Number(a.room) || 0;
    const roomB = Number(b.room) || 0;
    if (roomA !== roomB) {
      return roomA - roomB;
    }

    // 3. เลขที่
    const numA = typeof a.number === 'number' && !isNaN(a.number) && a.number > 0 ? a.number : 99999;
    const numB = typeof b.number === 'number' && !isNaN(b.number) && b.number > 0 ? b.number : 99999;
    if (numA !== numB) {
      return numA - numB;
    }

    // สำรอง: รหัสนักเรียน
    return a.id.localeCompare(b.id, 'th', { numeric: true });
  });
}

/**
 * สร้างชื่อหัวกระดาษตามข้อกำหนด:
 * "คะแนนความประพฤตินักเรียน หอพัก......"
 */
export function formatDormitoryReportTitle(dorm?: Dormitory | null, fallbackDormName?: string): string {
  if (dorm) {
    const cleanName = cleanDormDisplayName(dorm.name);
    if (cleanName.startsWith('หอพัก')) {
      return `คะแนนความประพฤตินักเรียน ${cleanName}`;
    }
    return `คะแนนความประพฤตินักเรียน หอพัก${cleanName}`;
  }
  if (fallbackDormName) {
    const cleanName = cleanDormDisplayName(fallbackDormName);
    if (cleanName.startsWith('หอพัก')) {
      return `คะแนนความประพฤตินักเรียน ${cleanName}`;
    }
    return `คะแนนความประพฤตินักเรียน หอพัก${cleanName}`;
  }
  return 'คะแนนความประพฤตินักเรียน หอพัก (ทั้งหมด)';
}

/**
 * สร้างข้อความครูหอพักผู้ดูแล:
 * "ครูหอพักผู้ดูแล: ..."
 */
export function formatDormitorySupervisorsText(dorm?: Dormitory | null): string {
  if (!dorm) return 'ครูหอพักผู้ดูแล: -';
  const supervisors = getDormitorySupervisors(dorm);
  if (supervisors.length === 0) return 'ครูหอพักผู้ดูแล: ยังไม่ได้กำหนด';
  return `ครูหอพักผู้ดูแล: ${supervisors.map(s => s.name).join(', ')}`;
}

/**
 * สไตล์ไฮไลท์สีสำหรับคะแนนคงเหลือ (รูปแบบไฮไลท์ข้อความ ไม่ใช่กล่องข้อความ/ปุ่ม)
 */
function getScoreHighlightHtml(score: number): string {
  if (score >= 100) {
    // เต็ม 100: ไฮไลท์เขียวอ่อนเป็นทางการ
    return `<span class="hl-score-100">${score}</span>`;
  }
  if (score >= 80) {
    // 80-99: ไฮไลท์ฟ้าอ่อน
    return `<span class="hl-score-good">${score}</span>`;
  }
  if (score >= 60) {
    // 60-79: ไฮไลท์เหลืองเตือน
    return `<span class="hl-score-warn">${score}</span>`;
  }
  // < 60: ไฮไลท์ชมพูแดงวิกฤต
  return `<span class="hl-score-critical">${score}</span>`;
}

/**
 * สร้างโครงสร้าง HTML ฉบับสมบูรณ์สำหรับแสดงในแท็บใหม่และสั่งพิมพ์ผ่านหน้าเว็บ
 * รูปแบบสีเรียบง่าย ดูเป็นทางการ ข้อความในตารางใช้รูปแบบไฮไลท์สีแทนกล่องข้อความ
 */
export function generateDormitoryReportHtml(options: {
  dormTitle: string;
  supervisorText: string;
  thaiDateFormatted: string;
  students: Student[];
  currentAcademicYear: number;
  rowsPerPage?: number;
}): string {
  const {
    dormTitle,
    supervisorText,
    thaiDateFormatted,
    students,
    currentAcademicYear,
    rowsPerPage = 25
  } = options;

  // สถิติรวมสำหรับแสดงที่ส่วนท้ายรายงาน
  const totalStudents = students.length;
  const perfectScoreCount = students.filter(s => (s.currentScore ?? 100) >= 100).length;
  const needRepairCount = students.filter(s => (s.currentScore ?? 100) < 100).length;
  const criticalCount = students.filter(s => (s.currentScore ?? 100) < 60).length;

  // แบ่งหน้านักเรียน
  const pages: Student[][] = [];
  if (students.length === 0) {
    pages.push([]);
  } else {
    for (let i = 0; i < students.length; i += rowsPerPage) {
      pages.push(students.slice(i, i + rowsPerPage));
    }
  }

  const totalPages = pages.length;

  let pagesHtml = '';
  pages.forEach((pageStudents, pageIdx) => {
    const pageNumber = pageIdx + 1;
    const isLastPage = pageNumber === totalPages;

    let rowsHtml = '';
    if (pageStudents.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: #64748b; font-size: 10pt; background-color: #fafafa;">
            ไม่พบข้อมูลนักเรียนตามผลการค้นหา
          </td>
        </tr>
      `;
    } else {
      pageStudents.forEach((st, idxOnPage) => {
        const globalIndex = (pageIdx * rowsPerPage) + idxOnPage + 1;
        const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
        const currentScore = st.currentScore ?? 100;
        const pointsToRepair = Math.max(0, 100 - currentScore);

        const isEven = idxOnPage % 2 === 1;
        const rowBgColor = isEven ? '#fcfcfd' : '#ffffff';

        // ข้อความชั้น/ห้อง และเลขที่ (ข้อความเรียบง่าย ไม่มีกล่อง)
        const classRoomText = `${grade}/${st.room}${st.number ? ` (เลขที่ ${st.number})` : ''}`;

        rowsHtml += `
          <tr style="height: 28px; background-color: ${rowBgColor};">
            <td style="text-align: center; color: #475569; font-size: 9pt;">${globalIndex}</td>
            <td style="text-align: center; font-weight: 600; color: #1e293b; font-size: 9pt;">
              ${st.id}
            </td>
            <td style="text-align: left; padding-left: 10px; color: #0f172a; font-size: 9.5pt;">
              ${st.title || ''}${st.firstName} ${st.lastName}
            </td>
            <td style="text-align: center; color: #334155; font-size: 9pt;">
              ${classRoomText}
            </td>
            <td style="text-align: center;">
              ${getScoreHighlightHtml(currentScore)}
            </td>
            <td style="text-align: center;">
              ${pointsToRepair > 0 ? `
                <span class="hl-repair-warning">-${pointsToRepair}</span>
              ` : `
                <span class="hl-repair-zero">0</span>
              `}
            </td>
          </tr>
        `;
      });
    }

    pagesHtml += `
      <div class="print-page ${!isLastPage ? 'page-break' : ''}">
        <!-- หัวกระดาษแบบทางการ เรียบง่าย สง่างาม -->
        <div class="report-header">
          <!-- 1. ชื่อหอพัก (หัวข้อหลักตัวหนาทางการ) -->
          <div class="header-line-1">
            ${dormTitle}
          </div>

          <!-- 2. รายชื่อครูหอพักผู้ดูแล -->
          <div class="header-line-2">
            ${supervisorText}
          </div>

          <!-- 3. ข้อมูล ณ วันที่ และ หน้าที่...จาก... -->
          <div class="header-line-3">
            <div class="header-date">
              ข้อมูล ณ วันที่ <span style="font-weight: 600;">${thaiDateFormatted}</span>
            </div>
            <div class="header-page">
              หน้าที่ ${pageNumber} จาก ${totalPages}
            </div>
          </div>
        </div>

        <!-- 4. ตารางรายชื่อนักเรียน สไตล์ทางการ สะอาด เรียบง่าย ไฮไลท์เฉพาะจุดสำคัญ -->
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 7%; text-align: center;">ที่</th>
              <th style="width: 17%; text-align: center;">รหัสนักเรียน</th>
              <th style="width: 37%; text-align: left; padding-left: 10px;">ชื่อ - สกุล</th>
              <th style="width: 17%; text-align: center;">ชั้น / ห้อง</th>
              <th style="width: 11%; text-align: center;">คะแนนคงเหลือ</th>
              <th style="width: 11%; text-align: center;">คะแนนที่ต้องแก้</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- ท้ายตาราง: สรุปภาพรวมแบบทางการ เรียบง่าย (เฉพาะหน้าสุดท้าย) -->
        ${isLastPage ? `
          <div class="report-summary">
            <div class="summary-left">
              รวมนักเรียนทั้งหมด <strong>${totalStudents}</strong> คน
            </div>
            <div class="summary-right">
              <span>คะแนนเต็ม 100: <span class="hl-score-100">${perfectScoreCount}</span> คน</span>
              <span class="summary-divider">•</span>
              <span>ต้องปรับปรุงคะแนน: ${needRepairCount > 0 ? `<span class="hl-repair-warning">${needRepairCount}</span>` : '0'} คน</span>
              ${criticalCount > 0 ? `
                <span class="summary-divider">•</span>
                <span>ต่ำกว่า 60: <span class="hl-score-critical">${criticalCount}</span> คน</span>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <title>${dormTitle} - ณ วันที่ ${thaiDateFormatted}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Sarabun', 'TH Sarabun New', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background-color: #334155;
      font-size: 9.5pt;
      line-height: 1.35;
    }

    /* Screen Top Toolbar (สไตล์ทางการ เรียบหรู) */
    .screen-toolbar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: #1e293b;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      z-index: 9999;
      border-bottom: 1px solid #334155;
    }

    .toolbar-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .toolbar-title {
      font-size: 12pt;
      font-weight: 700;
      color: #f8fafc;
      letter-spacing: -0.2px;
    }

    .toolbar-subtitle {
      font-size: 8.5pt;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-print {
      background: #0284c7;
      color: #ffffff;
      border: 1px solid #0369a1;
      padding: 8px 18px;
      border-radius: 8px;
      font-family: inherit;
      font-size: 9.5pt;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease;
    }

    .btn-print:hover {
      background: #0369a1;
    }

    .btn-close {
      background: transparent;
      color: #cbd5e1;
      border: 1px solid #475569;
      padding: 8px 14px;
      border-radius: 8px;
      font-family: inherit;
      font-size: 9pt;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-close:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }

    /* Screen Paper Preview Container */
    .document-container {
      padding: 24px 12px 64px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }

    .print-page {
      width: 210mm;
      min-height: 297mm;
      background: #ffffff;
      padding: 14mm 16mm 14mm 16mm;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
      display: flex;
      flex-direction: column;
      position: relative;
    }

    /* Header Section (เรียบง่าย เป็นทางการ) */
    .report-header {
      margin-bottom: 8px;
      text-align: center;
    }

    .header-line-1 {
      font-size: 14.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
      letter-spacing: -0.2px;
    }

    .header-line-2 {
      font-size: 10pt;
      font-weight: 500;
      color: #334155;
      margin-bottom: 8px;
    }

    .header-line-3 {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9pt;
      color: #475569;
      padding-top: 6px;
      padding-bottom: 6px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
    }

    /* Table Section (หัวตารางสีกรมท่าเป็นทางการ ข้อมูลสะอาดตา) */
    table.report-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 9pt;
    }

    table.report-table th, 
    table.report-table td {
      border: 1px solid #94a3b8;
      padding: 5px 6px;
      vertical-align: middle;
    }

    table.report-table th {
      background-color: #1e3a5f !important;
      color: #ffffff !important;
      font-weight: 600;
      text-align: center;
      font-size: 9pt;
      padding: 6px 4px;
      border-color: #1e3a5f !important;
    }

    /* สไตล์ไฮไลท์สีข้อความ (Text Color Highlight - ไม่มีกล่องข้อความ) */
    .hl-score-100 {
      background-color: #dcfce7 !important;
      color: #166534 !important;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 2px;
      display: inline-block;
    }

    .hl-score-good {
      background-color: #e0f2fe !important;
      color: #0369a1 !important;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 2px;
      display: inline-block;
    }

    .hl-score-warn {
      background-color: #fef08a !important;
      color: #854d0e !important;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 2px;
      display: inline-block;
    }

    .hl-score-critical {
      background-color: #fee2e2 !important;
      color: #991b1b !important;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 2px;
      display: inline-block;
    }

    .hl-repair-warning {
      background-color: #fee2e2 !important;
      color: #b91c1c !important;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 2px;
      display: inline-block;
    }

    .hl-repair-zero {
      color: #64748b;
      font-weight: 500;
    }

    /* Summary Bar at bottom of table */
    .report-summary {
      margin-top: 10px;
      padding: 6px 8px;
      border-top: 1.5px solid #1e3a5f;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5pt;
      color: #334155;
      page-break-inside: avoid;
    }

    .summary-left {
      font-weight: 500;
    }

    .summary-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .summary-divider {
      color: #cbd5e1;
    }

    /* Print Styles */
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 12mm 14mm;
    }

    @media print {
      body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      .no-print {
        display: none !important;
      }

      .document-container {
        padding: 0 !important;
        gap: 0 !important;
        display: block !important;
      }

      .print-page {
        width: 100% !important;
        min-height: auto !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }

      .page-break {
        page-break-after: always !important;
        break-after: page !important;
      }
    }
  </style>
</head>
<body>
  <!-- Top Bar for Screen Preview -->
  <div class="screen-toolbar no-print">
    <div class="toolbar-info">
      <div class="toolbar-title">
        ${dormTitle}
      </div>
      <div class="toolbar-subtitle">
        <span>ข้อมูล ณ วันที่ ${thaiDateFormatted}</span>
        <span>•</span>
        <span>นักเรียน ${students.length} คน</span>
        <span>•</span>
        <span>${totalPages} หน้า (A4 แนวตั้ง)</span>
      </div>
    </div>
    <div class="toolbar-actions">
      <button type="button" class="btn-print" onclick="window.print()">
        <span>พิมพ์รายงาน (Print / PDF)</span>
      </button>
      <button type="button" class="btn-close" onclick="window.close()">
        <span>ปิดหน้านี้</span>
      </button>
    </div>
  </div>

  <!-- Document View with A4 Pages -->
  <div class="document-container">
    ${pagesHtml}
  </div>

  <script>
    // Shortcut Ctrl+P / Cmd+P
    window.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    });
  </script>
</body>
</html>`;
}

/**
 * เปิดหน้ารายงาน HTML ในแท็บใหม่
 */
export function openDormitoryReportInNewTab(htmlContent: string): { success: boolean; blobUrl: string } {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  let opened = false;

  try {
    const newWindow = window.open(blobUrl, '_blank');
    if (newWindow) {
      opened = true;
    }
  } catch (err) {
    console.warn('Direct window.open blob failed', err);
  }

  if (!opened) {
    try {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.open();
        newWindow.document.write(htmlContent);
        newWindow.document.close();
        opened = true;
      }
    } catch (err2) {
      console.warn('Fallback window.open document.write failed', err2);
    }
  }

  return { success: opened, blobUrl };
}

export const DormitoryStudentsPrintModal: React.FC<DormitoryStudentsPrintModalProps> = ({
  isOpen,
  onClose,
  dormitories = [],
  displayedStudents = [],
  currentAcademicYear,
  selectedDormFilter = 'ALL',
  systemSettings,
  searchQuery,
  selectedGradeFilter = 'ALL',
  selectedRoomFilter = 'ALL'
}) => {
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [popupBlockedUrl, setPopupBlockedUrl] = useState<string | null>(null);

  // ข้อมูลนักเรียนที่จะพิมพ์ พร้อมเรียงลำดับ ชั้น/ห้อง และ เลขที่
  const studentsToPrint = useMemo(() => {
    return sortStudentsByGradeRoomAndNumber(displayedStudents, currentAcademicYear);
  }, [displayedStudents, currentAcademicYear]);

  // สถิติรวม
  const stats = useMemo(() => {
    const total = studentsToPrint.length;
    const perfect = studentsToPrint.filter(s => (s.currentScore ?? 100) >= 100).length;
    const repair = studentsToPrint.filter(s => (s.currentScore ?? 100) < 100).length;
    const critical = studentsToPrint.filter(s => (s.currentScore ?? 100) < 60).length;
    return { total, perfect, repair, critical };
  }, [studentsToPrint]);

  // หาหอพักที่เกี่ยวข้องจากตัวกรอง
  const targetDorm = useMemo(() => {
    if (selectedDormFilter && selectedDormFilter !== 'ALL' && selectedDormFilter !== 'UNASSIGNED') {
      return dormitories.find(d => d.id === selectedDormFilter) || null;
    }
    const uniqueDormIds = Array.from(new Set(studentsToPrint.map(s => s.dormitoryId).filter(Boolean)));
    if (uniqueDormIds.length === 1) {
      return dormitories.find(d => d.id === uniqueDormIds[0]) || null;
    }
    return null;
  }, [dormitories, selectedDormFilter, studentsToPrint]);

  // Thai Date formatting
  const thaiDateFormatted = useMemo(() => {
    const today = new Date();
    const day = today.getDate();
    const monthIdx = today.getMonth();
    const thaiYear = today.getFullYear() + 543;
    return `${day} ${THAI_MONTHS_FULL[monthIdx]} พ.ศ. ${thaiYear}`;
  }, []);

  // หัวเรื่อง
  const dormTitle = useMemo(() => {
    if (selectedDormFilter === 'UNASSIGNED') {
      return 'คะแนนความประพฤตินักเรียน (ยังไม่ได้จัดหอพัก)';
    }
    return formatDormitoryReportTitle(targetDorm);
  }, [targetDorm, selectedDormFilter]);

  const supervisorText = useMemo(() => {
    if (selectedDormFilter === 'UNASSIGNED') {
      return 'ครูหอพักผู้ดูแล: -';
    }
    if (targetDorm) {
      return formatDormitorySupervisorsText(targetDorm);
    }
    return 'ครูหอพักผู้ดูแล: ครูผู้ดูแลหอพักประจำสถานศึกษา';
  }, [targetDorm, selectedDormFilter]);

  // แบ่งหน้านักเรียนสำหรับ Preview
  const pages = useMemo(() => {
    if (studentsToPrint.length === 0) {
      return [[]];
    }
    const chunks: Student[][] = [];
    for (let i = 0; i < studentsToPrint.length; i += rowsPerPage) {
      chunks.push(studentsToPrint.slice(i, i + rowsPerPage));
    }
    return chunks;
  }, [studentsToPrint, rowsPerPage]);

  const totalPages = pages.length;

  // คำนวณสรุปตัวกรองการค้นหา
  const searchSummary = useMemo(() => {
    const parts: string[] = [];
    if (searchQuery && searchQuery.trim()) {
      parts.push(`คำค้นหา: "${searchQuery.trim()}"`);
    }
    if (selectedGradeFilter && selectedGradeFilter !== 'ALL') {
      parts.push(`ชั้น: ${selectedGradeFilter}`);
    }
    if (selectedRoomFilter && selectedRoomFilter !== 'ALL') {
      parts.push(`ห้อง: ${selectedRoomFilter}`);
    }
    return parts.join(' | ');
  }, [searchQuery, selectedGradeFilter, selectedRoomFilter]);

  // คำนวณโค้ด HTML รายงานฉบับเต็ม
  const reportHtml = useMemo(() => {
    return generateDormitoryReportHtml({
      dormTitle,
      supervisorText,
      thaiDateFormatted,
      students: studentsToPrint,
      currentAcademicYear,
      rowsPerPage
    });
  }, [dormTitle, supervisorText, thaiDateFormatted, studentsToPrint, currentAcademicYear, rowsPerPage]);

  // ฟังก์ชันเปิดรายงานในแท็บใหม่
  const handleOpenInNewTab = () => {
    const res = openDormitoryReportInNewTab(reportHtml);
    if (!res.success) {
      setPopupBlockedUrl(res.blobUrl);
    } else {
      setPopupBlockedUrl(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-xl border border-slate-300 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header Bar: สไตล์เรียบง่ายเป็นทางการ */}
        <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between gap-4 shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-200">
              <FileText className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  ตัวอย่างรายงานคะแนนความประพฤติ (รูปแบบทางการ)
                </h3>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">
                  A4 แนวตั้ง
                </span>
              </div>
              <p className="text-xs text-slate-300">
                เปิดแสดงผลในรูปแบบ HTML ในแท็บใหม่ แล้วสั่งพิมพ์ผ่านหน้าเว็บ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenInNewTab}
              disabled={studentsToPrint.length === 0}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>เปิดในแท็บใหม่ &amp; สั่งพิมพ์</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* แจ้งเตือนกรณี Popup Blocker */}
        {popupBlockedUrl && (
          <div className="px-5 py-2.5 bg-amber-500 text-slate-950 flex items-center justify-between gap-3 text-xs font-medium shrink-0">
            <span>เบราว์เซอร์บล็อกหน้าต่างใหม่ กรุณากดปุ่มเพื่อเปิดแท็บรายงานโดยตรง:</span>
            <a
              href={popupBlockedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-slate-900 text-white rounded hover:bg-black transition-colors"
            >
              เปิดแท็บใหม่ทันที ↗
            </a>
          </div>
        )}

        {/* Toolbar & Filter Info Bar */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap text-xs shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-700 font-medium">
              รวมนักเรียน: <strong className="text-slate-900">{studentsToPrint.length}</strong> คน
            </span>

            <span className="text-slate-400">•</span>

            <span className="text-slate-600">
              คะแนนเต็ม 100: <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[11px]">{stats.perfect}</span> คน
            </span>

            {stats.repair > 0 && (
              <>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600">
                  ต้องปรับปรุง: <span className="bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded text-[11px]">{stats.repair}</span> คน
                </span>
              </>
            )}

            {searchSummary && (
              <>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">({searchSummary})</span>
              </>
            )}

            {/* แถวต่อหน้า */}
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-slate-600">แถวต่อหน้า:</span>
              <select
                value={rowsPerPage}
                onChange={e => {
                  setRowsPerPage(Number(e.target.value));
                  setPreviewPage(1);
                }}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-800 font-medium cursor-pointer"
              >
                <option value={20}>20 คน / หน้า</option>
                <option value={25}>25 คน / หน้า (มาตรฐาน A4)</option>
                <option value={28}>28 คน / หน้า</option>
                <option value={30}>30 คน / หน้า</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              ทั้งหมด {totalPages} หน้า
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                  disabled={previewPage === 1}
                  className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-slate-700 px-1">
                  {previewPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewPage(p => Math.min(totalPages, p + 1))}
                  disabled={previewPage === totalPages}
                  className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="หน้าถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Paper Sheet Preview Area: สไตล์ทางการ เรียบง่าย ไฮไลท์เฉพาะจุดสำคัญ */}
        <div className="p-4 sm:p-6 bg-slate-200 overflow-y-auto flex-1 flex flex-col items-center">
          <div className="bg-white shadow-md border border-slate-300 w-full max-w-[800px] p-6 sm:p-8 font-['Sarabun',sans-serif] text-slate-900 flex flex-col min-h-[700px]">
            {/* Header: ชื่อหอพักทางการ */}
            <div className="text-center font-bold text-lg text-slate-900">
              {dormTitle}
            </div>

            {/* Header: ครูหอพักผู้ดูแล */}
            <div className="text-center text-xs text-slate-700 mt-1 mb-2">
              {supervisorText}
            </div>

            {/* Header: ข้อมูล ณ วันที่ / หน้าที่ */}
            <div className="flex items-center justify-between text-xs text-slate-600 py-1.5 border-t border-b border-slate-300 my-1">
              <div>
                ข้อมูล ณ วันที่ <span className="font-medium text-slate-800">{thaiDateFormatted}</span>
              </div>
              <div>
                หน้าที่ {previewPage} จาก {totalPages}
              </div>
            </div>

            {/* Table: ตารางรายชื่อนักเรียนแบบทางการ (ไม่มีกล่องข้อความ ใช้ไฮไลท์สีแทน) */}
            <div className="mt-2 overflow-x-auto flex-1">
              <table className="w-full text-left text-xs border-collapse border border-slate-400">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white">
                    <th className="border border-[#1e3a5f] py-2 px-2 text-center w-12 font-semibold">ที่</th>
                    <th className="border border-[#1e3a5f] py-2 px-2 text-center w-28 font-semibold">รหัสนักเรียน</th>
                    <th className="border border-[#1e3a5f] py-2 px-3 text-left font-semibold">ชื่อ - สกุล</th>
                    <th className="border border-[#1e3a5f] py-2 px-2 text-center w-28 font-semibold">ชั้น / ห้อง</th>
                    <th className="border border-[#1e3a5f] py-2 px-2 text-center w-24 font-semibold">คะแนนคงเหลือ</th>
                    <th className="border border-[#1e3a5f] py-2 px-2 text-center w-24 font-semibold">คะแนนที่ต้องแก้</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsToPrint.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 bg-slate-50">
                        ไม่พบข้อมูลนักเรียนตามผลการค้นหา
                      </td>
                    </tr>
                  ) : (
                    (pages[previewPage - 1] || []).map((st, idx) => {
                      const globalIdx = (previewPage - 1) * rowsPerPage + idx + 1;
                      const { grade } = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
                      const currentScore = st.currentScore ?? 100;
                      const pointsToRepair = Math.max(0, 100 - currentScore);
                      const isEven = idx % 2 === 1;

                      return (
                        <tr
                          key={st.id}
                          className={`border-b border-slate-300 ${
                            isEven ? 'bg-slate-50/60' : 'bg-white'
                          }`}
                        >
                          <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-600">
                            {globalIdx}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center font-medium text-slate-800">
                            {st.id}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-3 text-slate-900">
                            {st.title || ''}{st.firstName} {st.lastName}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-700">
                            {grade}/{st.room}{st.number ? ` (เลขที่ ${st.number})` : ''}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center">
                            {/* รูปแบบไฮไลท์สี ไม่ใส่กล่องข้อความ */}
                            {currentScore >= 100 ? (
                              <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-xs">
                                {currentScore}
                              </span>
                            ) : currentScore >= 80 ? (
                              <span className="bg-sky-100 text-sky-800 font-semibold px-1.5 py-0.5 rounded-xs">
                                {currentScore}
                              </span>
                            ) : currentScore >= 60 ? (
                              <span className="bg-yellow-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-xs">
                                {currentScore}
                              </span>
                            ) : (
                              <span className="bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded-xs">
                                {currentScore}
                              </span>
                            )}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center">
                            {pointsToRepair > 0 ? (
                              <span className="bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded-xs">
                                -{pointsToRepair}
                              </span>
                            ) : (
                              <span className="text-slate-500">
                                0
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary: เรียบง่ายเป็นทางการ */}
            {previewPage === totalPages && studentsToPrint.length > 0 && (
              <div className="mt-3 pt-2 border-t border-slate-400 flex items-center justify-between text-xs text-slate-700 flex-wrap gap-2">
                <div>
                  รวมนักเรียนทั้งหมด <strong>{studentsToPrint.length}</strong> คน
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <span>คะแนนเต็ม 100: <strong className="text-emerald-700">{stats.perfect}</strong> คน</span>
                  <span>•</span>
                  <span>ต้องปรับปรุง: <strong className={stats.repair > 0 ? 'text-rose-700' : 'text-slate-600'}>{stats.repair}</strong> คน</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Page Navigator */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center gap-1 bg-white px-3 py-1 rounded shadow-xs border border-slate-300 text-xs">
              <span className="text-slate-500 mr-1">หน้า:</span>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPreviewPage(p)}
                  className={`w-5 h-5 rounded font-medium transition-colors cursor-pointer ${
                    previewPage === p
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            จัดเอกสาร A4 แนวตั้ง แบบทางการ พิมพ์ซ้ำหัวกระดาษทุกหน้า
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              ปิด
            </button>
            <button
              type="button"
              onClick={handleOpenInNewTab}
              disabled={studentsToPrint.length === 0}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>เปิดในแท็บใหม่ &amp; สั่งพิมพ์</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
