import React, { useState, useMemo, useEffect } from 'react';
import { Pagination } from './Pagination';
import {
  Student,
  ConductLog,
  SystemSettings,
  AppUser,
  HomeroomAdvisor,
  StandardConductBehavior,
  GradeLevel
} from '../types';
import { calculateStudentGrade, getScoreCategory, getStudentAdvisors } from '../utils/conductLogic';
import * as XLSX from 'xlsx';
import {
  Printer,
  FileText,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Users,
  Award,
  CheckCircle2,
  PlusCircle,
  MinusCircle,
  School,
  ArrowUpDown,
  Sparkles,
  AlertOctagon,
  Clock,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  X,
  FileSpreadsheet
} from 'lucide-react';

export type ConductReportTab =
  | 'INDIVIDUAL'       // 1. รายงานแบบรายบุคคล ค้นหาด้วยข้อมูลนักเรียน
  | 'GRADE_LEVEL'      // 2. รายงานคะแนนแบบระดับชั้น
  | 'FULL_100'         // 3. รายงานนักเรียนครบ 100 คะแนน
  | 'HONOUR_100_PLUS'  // 4. รายงานนักเรียนดีเด่น 100+
  | 'POINTS_ADDED'     // 5. รายงานการเพิ่มคะแนน (ระบุช่วงเวลา)(ค้นหาหัวข้อความประพฤติ)
  | 'POINTS_DEDUCTED';  // 6. รายงานการหักคะแนน (ระบุช่วงเวลา)(ค้นหาหัวข้อความประพฤติ)

interface ConductReportViewProps {
  students: Student[];
  conductLogs: ConductLog[];
  currentAcademicYear: number;
  currentTerm: number;
  systemSettings: SystemSettings;
  advisors: HomeroomAdvisor[];
  standardBehaviors: StandardConductBehavior[];
  currentUser: AppUser | null;
  activeReportTab?: ConductReportTab;
  onChangeReportTab?: (tab: ConductReportTab) => void;
  onSelectStudent?: (studentId: string) => void;
  onClose?: () => void;
}

export const ConductReportView: React.FC<ConductReportViewProps> = ({
  students,
  conductLogs,
  currentAcademicYear,
  currentTerm,
  systemSettings,
  advisors,
  standardBehaviors,
  currentUser,
  activeReportTab,
  onChangeReportTab,
  onSelectStudent,
  onClose
}) => {
  // Active Tab (Controlled via sidebar/parent or fallback internal)
  const [activeTab, setActiveTab] = useState<ConductReportTab>(activeReportTab || 'INDIVIDUAL');

  useEffect(() => {
    if (activeReportTab && activeReportTab !== activeTab) {
      setActiveTab(activeReportTab);
    }
  }, [activeReportTab]);

  // Print Preview Modal
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Helper to resolve list of all advisor names for a student (each advisor as a separate string)
  const getAdvisorNamesList = (student: Student | null | undefined): string[] => {
    if (!student) return [];
    // 1. Check matched advisors in homeroom_advisors
    const matched = getStudentAdvisors(student, advisors, currentAcademicYear);
    if (matched && matched.length > 0) {
      return matched
        .map(a => (a.fullName || `${a.prefix || ''}${a.firstName} ${a.lastName}`).trim())
        .filter(Boolean);
    }
    // 2. Fallback to student.advisorName
    if (student.advisorName && student.advisorName.trim()) {
      const raw = student.advisorName.trim();
      if (raw.includes('\n')) {
        return raw.split('\n').map(s => s.trim()).filter(Boolean);
      }
      if (raw.includes(',')) {
        return raw.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (raw.includes('/')) {
        return raw.split('/').map(s => s.trim()).filter(Boolean);
      }
      return [raw];
    }
    return [];
  };

  // Pagination states for all report tables (default 25 items per page)
  const [individualLogPage, setIndividualLogPage] = useState<number>(1);
  const [individualLogPageSize, setIndividualLogPageSize] = useState<number>(25);

  const [gradePage, setGradePage] = useState<number>(1);
  const [gradePageSize, setGradePageSize] = useState<number>(25);

  const [full100Page, setFull100Page] = useState<number>(1);
  const [full100PageSize, setFull100PageSize] = useState<number>(25);

  const [honourPage, setHonourPage] = useState<number>(1);
  const [honourPageSize, setHonourPageSize] = useState<number>(25);

  const [pointsAddedPage, setPointsAddedPage] = useState<number>(1);
  const [pointsAddedPageSize, setPointsAddedPageSize] = useState<number>(25);

  const [pointsDeductedPage, setPointsDeductedPage] = useState<number>(1);
  const [pointsDeductedPageSize, setPointsDeductedPageSize] = useState<number>(25);

  // =========================================================================
  // TAB 1: รายงานแบบรายบุคคล ค้นหาด้วยข้อมูลนักเรียน
  // =========================================================================
  const [individualSearch, setIndividualSearch] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return students.length > 0 ? students[0].id : '';
  });

  // Selected student object
  const activeStudent = useMemo(() => {
    if (!selectedStudentId) return students[0] || null;
    return students.find(s => s.id === selectedStudentId) || students[0] || null;
  }, [students, selectedStudentId]);

  // Logs for active student
  const activeStudentLogs = useMemo(() => {
    if (!activeStudent) return [];
    return conductLogs
      .filter(log => log.studentId === activeStudent.id)
      .sort((a, b) => new Date(b.recordedAt || b.violationDate || 0).getTime() - new Date(a.recordedAt || a.violationDate || 0).getTime());
  }, [conductLogs, activeStudent]);

  // Search filtered candidates for quick selector
  const studentSearchCandidates = useMemo(() => {
    const q = individualSearch.trim().toLowerCase();
    if (!q) return [];
    return students.filter(s => {
      const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
      return (
        s.id.toLowerCase().includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        `${g.grade}/${s.room}`.includes(q) ||
        (s.advisorName && s.advisorName.toLowerCase().includes(q))
      );
    }).slice(0, 15);
  }, [students, individualSearch, currentAcademicYear]);

  // =========================================================================
  // TAB 2: รายงานคะแนนแบบระดับชั้น
  // =========================================================================
  const [gradeLevelFilter, setGradeLevelFilter] = useState<string>('ALL'); // 'ALL' | 'ม.1' - 'ม.6'
  const [gradeRoomFilter, setGradeRoomFilter] = useState<string>('ALL');   // 'ALL' | '1', '2', etc.
  const [gradeSortBy, setGradeSortBy] = useState<'SCORE_ASC' | 'SCORE_DESC' | 'ROOM_NUM' | 'ID'>('ROOM_NUM');
  const [gradeTextSearch, setGradeTextSearch] = useState<string>('');

  const gradeLevelStudents = useMemo(() => {
    return students.filter(s => {
      const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
      if (gradeLevelFilter !== 'ALL' && g.grade !== gradeLevelFilter) return false;
      if (gradeRoomFilter !== 'ALL' && String(s.room) !== gradeRoomFilter) return false;
      if (gradeTextSearch.trim()) {
        const q = gradeTextSearch.trim().toLowerCase();
        const matchesText =
          s.id.toLowerCase().includes(q) ||
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
          `${g.grade}/${s.room}`.includes(q);
        if (!matchesText) return false;
      }
      return true;
    }).sort((a, b) => {
      const gA = calculateStudentGrade(a.entryYear, a.entryLevel, currentAcademicYear);
      const gB = calculateStudentGrade(b.entryYear, b.entryLevel, currentAcademicYear);
      if (gradeSortBy === 'SCORE_DESC') {
        return (b.currentScore + (b.bankedPoints || 0)) - (a.currentScore + (a.bankedPoints || 0));
      }
      if (gradeSortBy === 'SCORE_ASC') {
        return a.currentScore - b.currentScore;
      }
      if (gradeSortBy === 'ID') {
        return a.id.localeCompare(b.id);
      }
      // Default: ROOM_NUM (Grade -> Room -> Number)
      if (gA.gradeNumber !== gB.gradeNumber) return gA.gradeNumber - gB.gradeNumber;
      if (a.room !== b.room) return a.room - b.room;
      return (a.number || 0) - (b.number || 0);
    });
  }, [students, gradeLevelFilter, gradeRoomFilter, gradeSortBy, gradeTextSearch, currentAcademicYear]);

  // Statistics for grade level
  const gradeStats = useMemo(() => {
    const total = gradeLevelStudents.length;
    if (total === 0) {
      return { total: 0, avgScore: 0, honourCount: 0, full100Count: 0, cautionCount: 0, watchCount: 0, criticalCount: 0 };
    }
    let totalScore = 0;
    let honourCount = 0;
    let full100Count = 0;
    let cautionCount = 0;
    let watchCount = 0;
    let criticalCount = 0;

    gradeLevelStudents.forEach(s => {
      totalScore += s.currentScore;
      const cat = getScoreCategory(s, systemSettings);
      if (cat.type === 'EXCELLENT' || cat.type === 'OUTSTANDING') honourCount++;
      else if (s.currentScore === 100 && (!s.bankedPoints || s.bankedPoints === 0)) full100Count++;
      else if (cat.type === 'CAUTION') cautionCount++;
      else if (cat.type === 'WATCH') watchCount++;
      else if (cat.type === 'CRITICAL') criticalCount++;
    });

    return {
      total,
      avgScore: Math.round((totalScore / total) * 10) / 10,
      honourCount,
      full100Count,
      cautionCount,
      watchCount,
      criticalCount
    };
  }, [gradeLevelStudents, systemSettings]);

  // Current classroom advisors if a specific grade & room is selected in TAB 2
  const currentRoomAdvisors = useMemo(() => {
    if (gradeLevelFilter === 'ALL' || gradeRoomFilter === 'ALL') return [];
    const matched = (advisors || []).filter(a => {
      const isYearMatch = !a.academicYear || a.academicYear === currentAcademicYear;
      return isYearMatch && a.gradeLevel === gradeLevelFilter && Number(a.room) === Number(gradeRoomFilter);
    }).sort((a, b) => (Number(a.advisorOrder) || 1) - (Number(b.advisorOrder) || 1));
    if (matched.length > 0) {
      return matched
        .map(a => (a.fullName || `${a.prefix || ''}${a.firstName} ${a.lastName}`).trim())
        .filter(Boolean);
    }
    const stWithAdv = gradeLevelStudents.find(s => s.advisorName && s.advisorName.trim());
    if (stWithAdv && stWithAdv.advisorName) {
      return getAdvisorNamesList(stWithAdv);
    }
    return [];
  }, [gradeLevelFilter, gradeRoomFilter, advisors, currentAcademicYear, gradeLevelStudents]);

  // =========================================================================
  // TAB 3: รายงานนักเรียนครบ 100 คะแนน
  // =========================================================================
  const [full100GradeFilter, setFull100GradeFilter] = useState<string>('ALL');
  const [full100Search, setFull100Search] = useState<string>('');

  const full100Students = useMemo(() => {
    return students.filter(s => {
      // Current score must be 100 and bankedPoints must be 0 (clean full 100)
      if (s.currentScore !== 100 || (s.bankedPoints && s.bankedPoints > 0)) return false;
      const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
      if (full100GradeFilter !== 'ALL' && g.grade !== full100GradeFilter) return false;
      if (full100Search.trim()) {
        const q = full100Search.trim().toLowerCase();
        return (
          s.id.toLowerCase().includes(q) ||
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
          `${g.grade}/${s.room}`.includes(q)
        );
      }
      return true;
    }).sort((a, b) => {
      const gA = calculateStudentGrade(a.entryYear, a.entryLevel, currentAcademicYear);
      const gB = calculateStudentGrade(b.entryYear, b.entryLevel, currentAcademicYear);
      if (gA.gradeNumber !== gB.gradeNumber) return gA.gradeNumber - gB.gradeNumber;
      if (a.room !== b.room) return a.room - b.room;
      return (a.number || 0) - (b.number || 0);
    });
  }, [students, full100GradeFilter, full100Search, currentAcademicYear]);

  // =========================================================================
  // TAB 4: รายงานนักเรียนดีเด่น 100+
  // =========================================================================
  const [honourSubTab, setHonourSubTab] = useState<'ALL' | 'EXCELLENT' | 'OUTSTANDING'>('ALL');
  const [honourGradeFilter, setHonourGradeFilter] = useState<string>('ALL');
  const [honourSearch, setHonourSearch] = useState<string>('');

  const honour100PlusStudents = useMemo(() => {
    return students.filter(s => {
      const cat = getScoreCategory(s, systemSettings);
      const is100Plus = cat.type === 'EXCELLENT' || cat.type === 'OUTSTANDING' || (s.bankedPoints && s.bankedPoints > 0);
      if (!is100Plus) return false;
      if (honourSubTab === 'EXCELLENT' && cat.type !== 'EXCELLENT') return false;
      if (honourSubTab === 'OUTSTANDING' && cat.type !== 'OUTSTANDING') return false;
      const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
      if (honourGradeFilter !== 'ALL' && g.grade !== honourGradeFilter) return false;
      if (honourSearch.trim()) {
        const q = honourSearch.trim().toLowerCase();
        return (
          s.id.toLowerCase().includes(q) ||
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
          `${g.grade}/${s.room}`.includes(q)
        );
      }
      return true;
    }).sort((a, b) => {
      const bTotal = b.currentScore + (b.bankedPoints || 0);
      const aTotal = a.currentScore + (a.bankedPoints || 0);
      if (bTotal !== aTotal) return bTotal - aTotal;
      return (b.bankedPoints || 0) - (a.bankedPoints || 0);
    });
  }, [students, honourSubTab, honourGradeFilter, honourSearch, currentAcademicYear, systemSettings]);

  // =========================================================================
  // TAB 5 & 6: รายงานการเพิ่มคะแนน & รายงานการหักคะแนน (ระบุช่วงเวลา & ค้นหาหัวข้อ)
  // =========================================================================
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [behaviorSearch, setBehaviorSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [gradeFilterForLogs, setGradeFilterForLogs] = useState<string>('ALL');

  // Reset pagination when active student or filters change
  useEffect(() => {
    setIndividualLogPage(1);
  }, [activeStudent?.id]);

  useEffect(() => {
    setGradePage(1);
  }, [gradeLevelFilter, gradeRoomFilter, gradeSortBy, gradeTextSearch]);

  useEffect(() => {
    setFull100Page(1);
  }, [full100GradeFilter, full100Search]);

  useEffect(() => {
    setHonourPage(1);
  }, [honourSubTab, honourGradeFilter, honourSearch]);

  useEffect(() => {
    setPointsAddedPage(1);
  }, [startDate, endDate, categoryFilter, behaviorSearch, gradeFilterForLogs]);

  useEffect(() => {
    setPointsDeductedPage(1);
  }, [startDate, endDate, categoryFilter, behaviorSearch, gradeFilterForLogs]);

  // Helper to extract log date (YYYY-MM-DD)
  const getLogDateString = (log: ConductLog) => {
    if (log.violationDate) return log.violationDate.slice(0, 10);
    if (log.recordedAt) return log.recordedAt.slice(0, 10);
    return '';
  };

  // Filter logs for Points Added (Tab 5)
  const pointsAddedLogs = useMemo(() => {
    return conductLogs.filter(log => {
      if (log.type !== 'ADD') return false;
      const logDate = getLogDateString(log);
      if (startDate && logDate && logDate < startDate) return false;
      if (endDate && logDate && logDate > endDate) return false;

      // Category filter
      if (categoryFilter !== 'ALL' && log.category !== categoryFilter) return false;

      // Behavior search
      if (behaviorSearch.trim()) {
        const q = behaviorSearch.trim().toLowerCase();
        const student = students.find(s => s.id === log.studentId);
        const matchesTopic =
          (log.behaviorTitle && log.behaviorTitle.toLowerCase().includes(q)) ||
          (log.reason && log.reason.toLowerCase().includes(q)) ||
          (log.category && log.category.toLowerCase().includes(q)) ||
          (log.description && log.description.toLowerCase().includes(q)) ||
          (log.recordedBy && log.recordedBy.toLowerCase().includes(q)) ||
          log.studentId.toLowerCase().includes(q) ||
          (student && `${student.firstName} ${student.lastName}`.toLowerCase().includes(q));
        if (!matchesTopic) return false;
      }

      // Grade filter
      if (gradeFilterForLogs !== 'ALL') {
        const student = students.find(s => s.id === log.studentId);
        if (!student) return false;
        const g = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);
        if (g.grade !== gradeFilterForLogs) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.recordedAt || b.violationDate || 0).getTime() - new Date(a.recordedAt || a.violationDate || 0).getTime());
  }, [conductLogs, startDate, endDate, categoryFilter, behaviorSearch, gradeFilterForLogs, students, currentAcademicYear]);

  // Filter logs for Points Deducted (Tab 6)
  const pointsDeductedLogs = useMemo(() => {
    return conductLogs.filter(log => {
      if (log.type !== 'DEDUCT') return false;
      const logDate = getLogDateString(log);
      if (startDate && logDate && logDate < startDate) return false;
      if (endDate && logDate && logDate > endDate) return false;

      // Category filter
      if (categoryFilter !== 'ALL' && log.category !== categoryFilter) return false;

      // Behavior search
      if (behaviorSearch.trim()) {
        const q = behaviorSearch.trim().toLowerCase();
        const student = students.find(s => s.id === log.studentId);
        const matchesTopic =
          (log.behaviorTitle && log.behaviorTitle.toLowerCase().includes(q)) ||
          (log.reason && log.reason.toLowerCase().includes(q)) ||
          (log.category && log.category.toLowerCase().includes(q)) ||
          (log.description && log.description.toLowerCase().includes(q)) ||
          (log.recordedBy && log.recordedBy.toLowerCase().includes(q)) ||
          log.studentId.toLowerCase().includes(q) ||
          (student && `${student.firstName} ${student.lastName}`.toLowerCase().includes(q));
        if (!matchesTopic) return false;
      }

      // Grade filter
      if (gradeFilterForLogs !== 'ALL') {
        const student = students.find(s => s.id === log.studentId);
        if (!student) return false;
        const g = calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear);
        if (g.grade !== gradeFilterForLogs) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.recordedAt || b.violationDate || 0).getTime() - new Date(a.recordedAt || a.violationDate || 0).getTime());
  }, [conductLogs, startDate, endDate, categoryFilter, behaviorSearch, gradeFilterForLogs, students, currentAcademicYear]);

  // Distinct categories available in logs
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    conductLogs.forEach(l => {
      if (l.category) cats.add(l.category);
    });
    standardBehaviors.forEach(b => {
      if (b.category) cats.add(b.category);
    });
    return Array.from(cats);
  }, [conductLogs, standardBehaviors]);

  // Format date helper (Thai locale or DD/MM/YYYY)
  const formatThaiDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Print Handler
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const handlePrint = () => {
    setIsPrinting(true);

    const reportElem = document.getElementById('printable-report-area');
    if (!reportElem) {
      window.print();
      setIsPrinting(false);
      return;
    }

    try {
      // Remove any existing print iframes
      const oldFrame = document.getElementById('conduct-print-iframe');
      if (oldFrame) {
        oldFrame.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'conduct-print-iframe';
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

      let docTitle = 'รายงานคะแนนความประพฤติ';
      if (activeTab === 'INDIVIDUAL' && activeStudent) {
        docTitle = `ใบบันทึกคะแนนความประพฤติ_${activeStudent.id}_${activeStudent.firstName}`;
      } else if (activeTab === 'GRADE_LEVEL') {
        docTitle = `รายงานคะแนนความประพฤติระดับชั้น_${gradeLevelFilter}`;
      } else if (activeTab === 'FULL_100') {
        docTitle = `รายงานนักเรียนครบ100คะแนน`;
      } else if (activeTab === 'HONOUR_100_PLUS') {
        docTitle = `ทำเนียบนักเรียนดีเด่น100+`;
      } else if (activeTab === 'POINTS_ADDED') {
        docTitle = `รายงานการเพิ่มคะแนนความดี`;
      } else if (activeTab === 'POINTS_DEDUCTED') {
        docTitle = `รายงานการหักคะแนนความประพฤติ`;
      }

      // Clone printable content and strip no-print elements
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
              margin-top: 8px;
              margin-bottom: 12px;
              font-size: 9pt;
            }
            th, td {
              border: 1px solid #94a3b8;
              padding: 5px 7px;
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
            tr.print-show-all {
              display: table-row !important;
            }
            thead {
              display: table-header-group;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: bold; }
            .font-black { font-weight: 900; }
            .signatures {
              margin-top: 28px;
              display: flex;
              justify-content: space-between;
              page-break-inside: avoid;
              font-size: 9pt;
              text-align: center;
            }
            .signature-box {
              flex: 1;
              padding: 0 10px;
            }
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

  // Quick Date Range Presets
  const handleSetDatePreset = (preset: 'TODAY' | 'WEEK' | 'MONTH' | 'TERM' | 'ALL') => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'WEEK') {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      setStartDate(lastWeek.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'MONTH') {
      const lastMonth = new Date();
      lastMonth.setDate(lastMonth.getDate() - 30);
      setStartDate(lastMonth.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'TERM') {
      // Rough term starts: Term 1 around May, Term 2 around Nov
      const currentYearAD = currentAcademicYear - 543;
      if (currentTerm === 1) {
        setStartDate(`${currentYearAD}-05-01`);
        setEndDate(`${currentYearAD}-10-31`);
      } else {
        setStartDate(`${currentYearAD}-11-01`);
        setEndDate(`${currentYearAD + 1}-03-31`);
      }
    }
  };

  // =========================================================================
  // EXPORT TO EXCEL HANDLERS
  // =========================================================================
  const exportCurrentReportToExcel = () => {
    const schoolName = systemSettings?.schoolNameTh || systemSettings?.schoolName || 'โรงเรียน';
    if (activeTab === 'INDIVIDUAL' && activeStudent) {
      const g = calculateStudentGrade(activeStudent.entryYear, activeStudent.entryLevel, currentAcademicYear);
      const rows = activeStudentLogs.map((log, idx) => ({
        'ลำดับ': idx + 1,
        'วันที่': formatThaiDate(log.violationDate || log.recordedAt),
        'ประเภท': log.type === 'ADD' ? 'เพิ่มคะแนน' : 'หักคะแนน',
        'คะแนน': log.points,
        'หัวข้อความประพฤติ': log.behaviorTitle || log.reason || '-',
        'หมวดหมู่': log.category || '-',
        'รายละเอียด': log.description || log.notes || '-',
        'คะแนนก่อนทำรายการ': log.scoreBefore ?? '-',
        'คะแนนหลังทำรายการ': log.scoreAfter ?? '-'
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ประวัติรายบุคคล');
      XLSX.writeFile(wb, `รายงานความประพฤติ_${activeStudent.id}_${activeStudent.firstName}_ปี${currentAcademicYear}.xlsx`);
    } else if (activeTab === 'GRADE_LEVEL') {
      const rows = gradeLevelStudents.map((s, idx) => {
        const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
        const cat = getScoreCategory(s, systemSettings);
        return {
          'ลำดับ': idx + 1,
          'รหัสนักเรียน': s.id,
          'ชื่อ-นามสกุล': `${s.title}${s.firstName} ${s.lastName}`,
          'ชั้น/ห้อง': `${g.grade}/${s.room}`,
          'เลขที่': s.number || '-',
          'คะแนนคงเหลือ': s.currentScore,
          'คะแนนสะสมสำรอง': s.bankedPoints || 0,
          'หักสะสม (แต้ม)': s.totalDeductedPoints || 0,
          'ได้รับเพิ่ม (แต้ม)': s.totalAddedPoints || 0,
          'จำนวนครั้งที่หัก': s.totalDeductionsCount || 0,
          'สถานะคะแนน': cat.shortLabel,
          'ครูที่ปรึกษา': getAdvisorNamesList(s).join('\n') || '-'
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'รายงานระดับชั้น');
      XLSX.writeFile(wb, `รายงานคะแนนระดับชั้น_${gradeLevelFilter}_ปี${currentAcademicYear}.xlsx`);
    } else if (activeTab === 'FULL_100') {
      const rows = full100Students.map((s, idx) => {
        const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
        return {
          'ลำดับ': idx + 1,
          'รหัสนักเรียน': s.id,
          'ชื่อ-นามสกุล': `${s.title}${s.firstName} ${s.lastName}`,
          'ชั้น/ห้อง': `${g.grade}/${s.room}`,
          'เลขที่': s.number || '-',
          'คะแนนความประพฤติ': s.currentScore,
          'สถานะ': 'รักษาคะแนนเต็ม 100',
          'ครูที่ปรึกษา': getAdvisorNamesList(s).join('\n') || '-'
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'นักเรียนครบ100คะแนน');
      XLSX.writeFile(wb, `รายชื่อนักเรียนครบ100คะแนน_ปี${currentAcademicYear}.xlsx`);
    } else if (activeTab === 'HONOUR_100_PLUS') {
      const rows = honour100PlusStudents.map((s, idx) => {
        const g = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
        const cat = getScoreCategory(s, systemSettings);
        return {
          'อันดับ': idx + 1,
          'รหัสนักเรียน': s.id,
          'ชื่อ-นามสกุล': `${s.title}${s.firstName} ${s.lastName}`,
          'ชั้น/ห้อง': `${g.grade}/${s.room}`,
          'เลขที่': s.number || '-',
          'คะแนนพื้นฐาน': s.currentScore,
          'คะแนนสะสมความดี': s.bankedPoints || 0,
          'คะแนนรวมสุทธิ': s.currentScore + (s.bankedPoints || 0),
          'ประเภทเกียรติยศ': cat.label,
          'ประวัติการถูกหัก': s.hasNeverBeenDeducted ? 'ไม่เคยถูกหักคะแนน' : `เคยโดนหัก ${s.totalDeductionsCount || 0} ครั้ง`,
          'ครูที่ปรึกษา': getAdvisorNamesList(s).join('\n') || '-'
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'นักเรียนดีเด่น100+');
      XLSX.writeFile(wb, `ทำเนียบนักเรียนดีเด่น100+_ปี${currentAcademicYear}.xlsx`);
    } else if (activeTab === 'POINTS_ADDED') {
      const rows = pointsAddedLogs.map((log, idx) => {
        const student = students.find(s => s.id === log.studentId);
        const g = student ? calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear) : null;
        return {
          'ลำดับ': idx + 1,
          'วันที่': formatThaiDate(log.violationDate || log.recordedAt),
          'รหัสนักเรียน': log.studentId,
          'ชื่อ-นามสกุล': student ? `${student.title}${student.firstName} ${student.lastName}` : '-',
          'ชั้น/ห้อง': g ? `${g.grade}/${student?.room}` : '-',
          'หัวข้อความประพฤติ': log.behaviorTitle || log.reason || '-',
          'หมวดหมู่': log.category || '-',
          'คะแนนที่ได้รับเพิ่ม': `+${log.points}`,
          'รายละเอียด': log.description || log.notes || '-'
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'รายงานเพิ่มคะแนน');
      XLSX.writeFile(wb, `รายงานการเพิ่มคะแนน_ปี${currentAcademicYear}.xlsx`);
    } else if (activeTab === 'POINTS_DEDUCTED') {
      const rows = pointsDeductedLogs.map((log, idx) => {
        const student = students.find(s => s.id === log.studentId);
        const g = student ? calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear) : null;
        return {
          'ลำดับ': idx + 1,
          'วันที่': formatThaiDate(log.violationDate || log.recordedAt),
          'รหัสนักเรียน': log.studentId,
          'ชื่อ-นามสกุล': student ? `${student.title}${student.firstName} ${student.lastName}` : '-',
          'ชั้น/ห้อง': g ? `${g.grade}/${student?.room}` : '-',
          'หัวข้อการกระทำผิด': log.behaviorTitle || log.reason || '-',
          'หมวดหมู่': log.category || '-',
          'คะแนนที่ถูกหัก': `-${log.points}`,
          'คะแนนคงเหลือหลังหัก': log.scoreAfter ?? '-',
          'รายละเอียด': log.description || log.notes || '-'
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'รายงานหักคะแนน');
      XLSX.writeFile(wb, `รายงานการหักคะแนน_ปี${currentAcademicYear}.xlsx`);
    }
  };

  const schoolName = systemSettings?.schoolNameTh || systemSettings?.schoolName || 'โรงเรียนตัวอย่างวิทยา';

  // Active report presentation info
  const reportInfo = useMemo(() => {
    switch (activeTab) {
      case 'INDIVIDUAL':
        return {
          title: 'รายงานรายบุคคล',
          subtitle: 'ค้นหาด้วยข้อมูลนักเรียน ดูประวัติคะแนนความประพฤติและพิมพ์หนังสือรับรอง',
          icon: User,
          badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        };
      case 'GRADE_LEVEL':
        return {
          title: 'รายงานแบบระดับชั้น',
          subtitle: 'สถิติและบัญชีรายชื่อคะแนนความประพฤติจำแนกตามระดับชั้นและห้องเรียน (ม.1 - ม.6)',
          icon: Users,
          badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        };
      case 'FULL_100':
        return {
          title: 'นักเรียนครบ 100 คะแนน',
          subtitle: `บัญชีรายชื่อนักเรียนที่รักษาคะแนนเต็ม 100 คะแนนสมบูรณ์ (${full100Students.length} คน)`,
          icon: CheckCircle2,
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'HONOUR_100_PLUS':
        return {
          title: 'นักเรียนดีเด่น 100+',
          subtitle: `ทำเนียบคะแนนเกียรติยศนักเรียนที่มีคะแนนสะสม 100 คะแนนขึ้นไป และไม่เคยกระทำผิด (${honour100PlusStudents.length} คน)`,
          icon: Award,
          badgeColor: 'bg-amber-50 text-amber-800 border-amber-300'
        };
      case 'POINTS_ADDED':
        return {
          title: 'รายงานการเพิ่มคะแนน',
          subtitle: `ประวัติการบันทึกเพิ่มคะแนนความดีและกิจกรรมเชิงบวก ตามช่วงเวลาและหัวข้อความประพฤติ (${pointsAddedLogs.length} รายการ)`,
          icon: PlusCircle,
          badgeColor: 'bg-teal-50 text-teal-700 border-teal-200'
        };
      case 'POINTS_DEDUCTED':
        return {
          title: 'รายงานการหักคะแนน',
          subtitle: `ประวัติการตัดคะแนนความประพฤติและการกระทำผิดระเบียบ ตามช่วงเวลาและหัวข้อความประพฤติ (${pointsDeductedLogs.length} รายการ)`,
          icon: MinusCircle,
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
        };
    }
  }, [activeTab, full100Students.length, honour100PlusStudents.length, pointsAddedLogs.length, pointsDeductedLogs.length]);

  const CurrentReportIcon = reportInfo.icon;

  return (
    <div className="w-full space-y-6">
      {/* PRINT-ONLY STYLESHEET OVERRIDE */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 15mm 10mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          #main-app-header,
          #main-sidebar,
          #header-top-row,
          aside,
          nav,
          .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
          }
          #printable-report-area {
            display: block !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          tr.print-show-all {
            display: table-row !important;
          }
          thead {
            display: table-header-group !important;
          }
        }
      `}</style>

      {/* ========================================================================= */}
      {/* HEADER BAR (Without internal report tabs; navigated via sidebar sub-menu) */}
      {/* ========================================================================= */}
      <div className="no-print bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-xs shrink-0">
              <CurrentReportIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  รายงานคะแนนความประพฤติ
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  {reportInfo.title}
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {reportInfo.subtitle} • {schoolName} (ปีการศึกษา {currentAcademicYear} ภาคเรียนที่ {currentTerm})
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer shrink-0"
              title="กลับหน้าหลัก"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Global Action Buttons on a dedicated new line */}
        <div className="pt-3 border-t border-slate-100 flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={exportCurrentReportToExcel}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs active:scale-95"
            title="ส่งออกรายงานปัจจุบันเป็นไฟล์ Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>ส่งออก Excel</span>
          </button>

          <button
            type="button"
            id="btn-print-conduct-report"
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            title="พิมพ์รายงานหน้านี้ออกเครื่องพิมพ์ หรือบันทึกเป็น PDF"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? 'กำลังเตรียมพิมพ์...' : 'พิมพ์รายงาน'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REPORT CONTENT AREA */}
      {/* ========================================================================= */}
      <div id="printable-report-area" className="space-y-6">

        {/* ======================================================================= */}
        {/* 1. REPORT: รายงานแบบรายบุคคล ค้นหาด้วยข้อมูลนักเรียน */}
        {/* ======================================================================= */}
        {activeTab === 'INDIVIDUAL' && (
          <div className="space-y-6">
            {/* Search and Student Selection Bar (Hidden during print) */}
            <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Search className="w-4 h-4 text-indigo-600" />
                  <span>ค้นหาข้อมูลนักเรียนเพื่อออกรายงานรายบุคคล</span>
                </div>
                <div className="text-xs text-slate-500">
                  ค้นหาด้วย รหัสนักเรียน, ชื่อ, นามสกุล, หรือชั้น/ห้อง
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={individualSearch}
                  onChange={e => setIndividualSearch(e.target.value)}
                  placeholder="พิมพ์รหัสนักเรียน หรือ ชื่อ-นามสกุล เช่น 05501 หรือ สมชาย..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                {individualSearch && (
                  <button
                    type="button"
                    onClick={() => setIndividualSearch('')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick Suggestion Chips */}
              {individualSearch.trim() && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
                  <span className="text-[11px] font-bold text-slate-400 shrink-0">นักเรียนที่ตรงกับคำค้น:</span>
                  {studentSearchCandidates.length > 0 ? (
                    studentSearchCandidates.map(st => {
                      const g = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
                      const isSelected = activeStudent?.id === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setSelectedStudentId(st.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <span>{st.id}</span>
                          <span>{st.firstName}</span>
                          <span className="opacity-75">({g.grade}/{st.room})</span>
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-400">ไม่พบนักเรียนที่ตรงกับคำค้นหา</span>
                  )}
                </div>
              )}
            </div>

            {/* Official Report Document: Individual Student */}
            {activeStudent ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                {/* Official Letterhead */}
                <div className="text-center border-b border-slate-200 pb-5 space-y-1.5">
                  <div className="flex items-center justify-center gap-3">
                    {systemSettings?.logoUrl ? (
                      <img
                        src={systemSettings.logoUrl}
                        alt="Logo"
                        className="w-12 h-12 object-contain rounded-xl"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-indigo-700 text-white flex items-center justify-center">
                        <School className="w-6 h-6" />
                      </div>
                    )}
                    <div className="text-left">
                      <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                        {schoolName}
                      </h2>
                      <p className="text-xs font-semibold text-slate-600">
                        ฝ่ายกิจการนักเรียนและกลุ่มงานส่งเสริมวินัยนักเรียน
                      </p>
                    </div>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-indigo-900 pt-2">
                    ใบบันทึกคะแนนและพฤติกรรมความประพฤติรายบุคคล
                  </h3>
                  <p className="text-xs text-slate-500">
                    ประจำปีการศึกษา {currentAcademicYear} ภาคเรียนที่ {currentTerm}
                  </p>
                </div>

                {/* Student Bio Card */}
                {(() => {
                  const g = calculateStudentGrade(activeStudent.entryYear, activeStudent.entryLevel, currentAcademicYear);
                  const cat = getScoreCategory(activeStudent, systemSettings);
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                      {/* Photo & Basic Info */}
                      <div className="flex items-center gap-3 md:col-span-2">
                        {activeStudent.photoUrl ? (
                          <img
                            src={activeStudent.photoUrl}
                            alt={activeStudent.firstName}
                            className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-2xs shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg border border-indigo-200 shrink-0">
                            {activeStudent.firstName.charAt(0)}
                          </div>
                        )}
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="font-black text-base text-slate-900 truncate">
                            {activeStudent.title}{activeStudent.firstName} {activeStudent.lastName}
                          </h4>
                          <div className="text-xs text-slate-600 flex items-center gap-2">
                            <span>รหัสประจำตัว: <strong>{activeStudent.id}</strong></span>
                            <span>•</span>
                            <span>ชั้น: <strong>{g.grade}/{activeStudent.room}</strong></span>
                            {activeStudent.number && (
                              <>
                                <span>•</span>
                                <span>เลขที่: <strong>{activeStudent.number}</strong></span>
                              </>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 pt-0.5">
                            <span className="font-semibold text-slate-700">ครูที่ปรึกษา:</span>
                            {(() => {
                              const advList = getAdvisorNamesList(activeStudent);
                              if (advList.length === 0) {
                                return <span className="text-slate-400 ml-1">ยังไม่ได้ระบุ</span>;
                              }
                              return (
                                <div className="mt-0.5 space-y-0.5 text-slate-700 font-medium" style={{ lineHeight: '1.35' }}>
                                  {advList.map((adv, aIdx) => (
                                    <div key={aIdx}>{adv}</div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Score Metrics */}
                      <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
                        <span className="text-xs text-slate-500">คะแนนความประพฤติคงเหลือ</span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className={`text-2xl font-black ${
                            activeStudent.currentScore >= 100
                              ? 'text-emerald-600'
                              : activeStudent.currentScore >= 71
                              ? 'text-amber-600'
                              : activeStudent.currentScore >= 51
                              ? 'text-orange-600'
                              : 'text-rose-600'
                          }`}>
                            {activeStudent.currentScore}
                          </span>
                          <span className="text-xs text-slate-400">/ 100</span>
                        </div>
                        {activeStudent.bankedPoints > 0 && (
                          <span className="text-xs font-bold text-purple-700">
                            + คะแนนสำรองความดี {activeStudent.bankedPoints} แต้ม
                          </span>
                        )}
                      </div>

                      {/* Status & Counts */}
                      <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4 space-y-1">
                        <div>
                          <span className="text-[11px] text-slate-400 block">สถานะความประพฤติ</span>
                          <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold ${cat.badgeClass}`}>
                            {cat.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ประวัติ: ได้รับเพิ่ม {activeStudent.totalAddedPoints || 0} แต้ม • ถูกหัก {activeStudent.totalDeductionsCount || 0} ครั้ง ({activeStudent.totalDeductedPoints || 0} แต้ม)
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Conduct Logs Itemized Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>รายการบันทึกคะแนนความประพฤติทั้งหมด ({activeStudentLogs.length} รายการ)</span>
                    </h4>
                    {onSelectStudent && (
                      <button
                        type="button"
                        onClick={() => onSelectStudent(activeStudent.id)}
                        className="no-print text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>เปิดประวัติในหน้าค้นหานักเรียน</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {activeStudentLogs.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-slate-700">ไม่พบประวัติการทำผิดหรือบันทึกคะแนน</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">นักเรียนรักษาคะแนนเต็ม 100 และมาตรฐานความประพฤติได้เรียบร้อยดี</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">#</th>
                              <th className="py-2.5 px-3 whitespace-nowrap">วันที่ / เวลา</th>
                              <th className="py-2.5 px-3 whitespace-nowrap">ประเภท</th>
                              <th className="py-2.5 px-3">หัวข้อความประพฤติ / กิจกรรม</th>
                              <th className="py-2.5 px-3 whitespace-nowrap">หมวดหมู่</th>
                              <th className="py-2.5 px-3 text-center whitespace-nowrap">คะแนน</th>
                              <th className="py-2.5 px-3 text-center whitespace-nowrap">คะแนนหลังบันทึก</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeStudentLogs.map((log, idx) => {
                              const isVisibleOnScreen = individualLogPageSize >= 999999 || (idx >= (individualLogPage - 1) * individualLogPageSize && idx < individualLogPage * individualLogPageSize);
                              const isAdd = log.type === 'ADD';
                              return (
                                <tr
                                  key={log.id}
                                  className={`hover:bg-slate-50/80 transition-colors ${!isVisibleOnScreen ? 'hidden print:table-row print-show-all' : ''}`}
                                >
                                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700">
                                    {formatThaiDate(log.violationDate || log.recordedAt)}
                                  </td>
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    {isAdd ? (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                                        + เพิ่มคะแนน
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                                        - หักคะแนน
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                                    <div>{log.behaviorTitle || log.reason || '-'}</div>
                                    {log.description && (
                                      <div className="text-[11px] text-slate-500 font-normal mt-0.5">{log.description}</div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                                    {log.category || '-'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-bold font-mono whitespace-nowrap">
                                    <span className={isAdd ? 'text-emerald-600' : 'text-rose-600'}>
                                      {isAdd ? `+${log.points}` : `-${log.points}`}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono text-slate-700 whitespace-nowrap">
                                    {log.scoreAfter ?? '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {activeStudentLogs.length > 0 && (
                        <div className="no-print mt-2">
                          <Pagination
                            currentPage={individualLogPage}
                            totalItems={activeStudentLogs.length}
                            pageSize={individualLogPageSize}
                            onPageChange={setIndividualLogPage}
                            onPageSizeChange={(size) => {
                              setIndividualLogPageSize(size);
                              setIndividualLogPage(1);
                            }}
                            pageSizeOptions={[25, 50, 100, 'ALL']}
                            itemLabel="รายการ"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>


              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                <User className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">กรุณาเลือกหรือค้นหานักเรียน</p>
                <p className="text-xs text-slate-400 mt-1">พิมพ์รหัสนักเรียนหรือชื่อในช่องค้นหาด้านบนเพื่อสร้างรายงานรายบุคคล</p>
              </div>
            )}
          </div>
        )}

        {/* ======================================================================= */}
        {/* 2. REPORT: รายงานคะแนนแบบระดับชั้น */}
        {/* ======================================================================= */}
        {activeTab === 'GRADE_LEVEL' && (
          <div className="space-y-6">
            {/* Filter Toolbar (Hidden during print) */}
            <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-bold text-slate-800">ตัวกรองระดับชั้นและห้องเรียน</span>
                </div>
                <div className="text-xs text-slate-500">
                  แสดงผล: <strong>{gradeLevelStudents.length}</strong> คน
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Grade Selector */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">ระดับชั้น</label>
                  <select
                    value={gradeLevelFilter}
                    onChange={e => {
                      setGradeLevelFilter(e.target.value);
                      setGradeRoomFilter('ALL');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ALL">ทุกระดับชั้น (ม.1 - ม.6)</option>
                    <option value="ม.1">มัธยมศึกษาปีที่ 1 (ม.1)</option>
                    <option value="ม.2">มัธยมศึกษาปีที่ 2 (ม.2)</option>
                    <option value="ม.3">มัธยมศึกษาปีที่ 3 (ม.3)</option>
                    <option value="ม.4">มัธยมศึกษาปีที่ 4 (ม.4)</option>
                    <option value="ม.5">มัธยมศึกษาปีที่ 5 (ม.5)</option>
                    <option value="ม.6">มัธยมศึกษาปีที่ 6 (ม.6)</option>
                  </select>
                </div>

                {/* Room Selector */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">ห้องเรียน</label>
                  <select
                    value={gradeRoomFilter}
                    onChange={e => setGradeRoomFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ALL">ทุกห้อง</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(r => (
                      <option key={r} value={String(r)}>ห้อง {r}</option>
                    ))}
                  </select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">เรียงลำดับตาม</label>
                  <select
                    value={gradeSortBy}
                    onChange={e => setGradeSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="ROOM_NUM">ชั้น / ห้อง / เลขที่</option>
                    <option value="SCORE_DESC">คะแนนสูงที่สุด -&gt; น้อยที่สุด</option>
                    <option value="SCORE_ASC">คะแนนน้อยที่สุด (เสี่ยง) -&gt; มากที่สุด</option>
                    <option value="ID">รหัสนักเรียน</option>
                  </select>
                </div>

                {/* Text Filter */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">ค้นหาในชั้น</label>
                  <input
                    type="text"
                    value={gradeTextSearch}
                    onChange={e => setGradeTextSearch(e.target.value)}
                    placeholder="รหัส หรือ ชื่อนักเรียน..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Official Report Document: Grade Level */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              {/* Official Document Header */}
              <div className="text-center border-b border-slate-200 pb-5 space-y-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {schoolName}
                </h2>
                <h3 className="text-sm sm:text-base font-bold text-indigo-900">
                  รายงานสรุปและบัญชีคะแนนความประพฤติ {gradeLevelFilter === 'ALL' ? 'ทุกระดับชั้น' : `ระดับชั้น ${gradeLevelFilter}`} {gradeRoomFilter !== 'ALL' ? `ห้อง ${gradeRoomFilter}` : ''}
                </h3>
                {currentRoomAdvisors.length > 0 && (
                  <div className="text-xs text-slate-600 pt-1">
                    <span className="font-semibold text-slate-700">ครูที่ปรึกษา:</span>
                    <div className="mt-0.5 space-y-0.5 font-medium text-slate-800" style={{ lineHeight: '1.35' }}>
                      {currentRoomAdvisors.map((adv, idx) => (
                        <div key={idx}>{adv}</div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  ปีการศึกษา {currentAcademicYear} ภาคเรียนที่ {currentTerm} • ข้อมูล ณ วันที่ {formatThaiDate(new Date().toISOString())}
                </p>
              </div>

              {/* Statistical KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">นักเรียนทั้งหมด</span>
                  <div className="text-xl font-black text-slate-800 mt-0.5">{gradeStats.total}</div>
                </div>
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase">คะแนนเฉลี่ย</span>
                  <div className="text-xl font-black text-indigo-900 mt-0.5">{gradeStats.avgScore}</div>
                </div>
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-violet-700 uppercase">100+ ดีเด่น</span>
                  <div className="text-xl font-black text-violet-900 mt-0.5">{gradeStats.honourCount}</div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">เต็ม 100</span>
                  <div className="text-xl font-black text-emerald-900 mt-0.5">{gradeStats.full100Count}</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-amber-700 uppercase">ตักเตือน (71-99)</span>
                  <div className="text-xl font-black text-amber-900 mt-0.5">{gradeStats.cautionCount}</div>
                </div>
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-orange-700 uppercase">เฝ้าระวัง (51-70)</span>
                  <div className="text-xl font-black text-orange-900 mt-0.5">{gradeStats.watchCount}</div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">วิกฤต (≤ 50)</span>
                  <div className="text-xl font-black text-rose-900 mt-0.5">{gradeStats.criticalCount}</div>
                </div>
              </div>

              {/* Roster Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">รหัสนักเรียน</th>
                      <th className="py-2.5 px-3">ชื่อ - นามสกุล</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">ชั้น/ห้อง</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">เลขที่</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">คะแนนคงเหลือ</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">คะแนนสำรอง</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">หักสะสม</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">สถานะ</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">ครูที่ปรึกษา</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gradeLevelStudents.map((st, idx) => {
                      const isVisibleOnScreen = gradePageSize >= 999999 || (idx >= (gradePage - 1) * gradePageSize && idx < gradePage * gradePageSize);
                      const g = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
                      const cat = getScoreCategory(st, systemSettings);
                      return (
                        <tr
                          key={st.id}
                          className={`hover:bg-slate-50 transition-colors ${!isVisibleOnScreen ? 'hidden print:table-row print-show-all' : ''}`}
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">{st.id}</td>
                          <td className="py-2 px-3 font-medium text-slate-900">
                            {st.title}{st.firstName} {st.lastName}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-700 whitespace-nowrap">
                            {g.grade}/{st.room}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-600">{st.number || '-'}</td>
                          <td className="py-2 px-3 text-center font-black font-mono">
                            <span className={
                              st.currentScore >= 100
                                ? 'text-emerald-700'
                                : st.currentScore >= 71
                                ? 'text-amber-700'
                                : st.currentScore >= 51
                                ? 'text-orange-700'
                                : 'text-rose-700'
                            }>
                              {st.currentScore}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-purple-700 font-bold whitespace-nowrap">
                            {st.bankedPoints > 0 ? `+${st.bankedPoints}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-rose-600 font-medium whitespace-nowrap">
                            {st.totalDeductedPoints ? `-${st.totalDeductedPoints}` : '0'}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${cat.badgeClass}`}>
                              {cat.shortLabel}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {(() => {
                              const advList = getAdvisorNamesList(st);
                              if (advList.length === 0) return <span className="text-slate-400">-</span>;
                              return (
                                <div className="space-y-0.5" style={{ lineHeight: '1.35' }}>
                                  {advList.map((adv, aIdx) => (
                                    <div key={aIdx}>{adv}</div>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {gradeLevelStudents.length > 0 && (
                <div className="no-print mt-2">
                  <Pagination
                    currentPage={gradePage}
                    totalItems={gradeLevelStudents.length}
                    pageSize={gradePageSize}
                    onPageChange={setGradePage}
                    onPageSizeChange={(size) => {
                      setGradePageSize(size);
                      setGradePage(1);
                    }}
                    pageSizeOptions={[25, 50, 100, 'ALL']}
                    itemLabel="คน"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* 3. REPORT: รายงานนักเรียนครบ 100 คะแนน */}
        {/* ======================================================================= */}
        {activeTab === 'FULL_100' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600">เลือกระดับชั้น:</span>
                {['ALL', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFull100GradeFilter(lvl)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      full100GradeFilter === lvl
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {lvl === 'ALL' ? 'ทุกชั้น' : lvl}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-64 relative">
                <input
                  type="text"
                  value={full100Search}
                  onChange={e => setFull100Search(e.target.value)}
                  placeholder="ค้นหาชื่อ หรือ รหัส..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Document: Full 100 Score Report */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="text-center border-b border-slate-200 pb-5 space-y-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {schoolName}
                </h2>
                <h3 className="text-sm sm:text-base font-bold text-emerald-800">
                  รายชื่อนักเรียนที่มีคะแนนความประพฤติเต็ม 100 คะแนน (รักษามาตรฐานวินัยสมบูรณ์)
                </h3>
                <p className="text-xs text-slate-500">
                  ปีการศึกษา {currentAcademicYear} ภาคเรียนที่ {currentTerm} • ทั้งหมด <strong>{full100Students.length}</strong> คน
                </p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">รหัสนักเรียน</th>
                      <th className="py-2.5 px-3">ชื่อ - นามสกุล</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">ระดับชั้น/ห้อง</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">เลขที่</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">คะแนนความประพฤติ</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">สถานะมาตรฐาน</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">ครูที่ปรึกษา</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {full100Students.map((st, idx) => {
                      const isVisibleOnScreen = full100PageSize >= 999999 || (idx >= (full100Page - 1) * full100PageSize && idx < full100Page * full100PageSize);
                      const g = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
                      return (
                        <tr
                          key={st.id}
                          className={`hover:bg-slate-50 transition-colors ${!isVisibleOnScreen ? 'hidden print:table-row print-show-all' : ''}`}
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">{st.id}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {st.title}{st.firstName} {st.lastName}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-700 whitespace-nowrap">
                            {g.grade}/{st.room}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-600">{st.number || '-'}</td>
                          <td className="py-2 px-3 text-center font-mono font-black text-emerald-600">
                            100
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
                              ปกติ (คะแนนเต็ม 100)
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {(() => {
                              const advList = getAdvisorNamesList(st);
                              if (advList.length === 0) return <span className="text-slate-400">-</span>;
                              return (
                                <div className="space-y-0.5" style={{ lineHeight: '1.35' }}>
                                  {advList.map((adv, aIdx) => (
                                    <div key={aIdx}>{adv}</div>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {full100Students.length > 0 && (
                <div className="no-print mt-2">
                  <Pagination
                    currentPage={full100Page}
                    totalItems={full100Students.length}
                    pageSize={full100PageSize}
                    onPageChange={setFull100Page}
                    onPageSizeChange={(size) => {
                      setFull100PageSize(size);
                      setFull100Page(1);
                    }}
                    pageSizeOptions={[25, 50, 100, 'ALL']}
                    itemLabel="คน"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* 4. REPORT: รายงานนักเรียนดีเด่น 100+ */}
        {/* ======================================================================= */}
        {activeTab === 'HONOUR_100_PLUS' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Sub category tabs */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHonourSubTab('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      honourSubTab === 'ALL'
                        ? 'bg-violet-700 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    ทั้งหมด 100+ ({honour100PlusStudents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHonourSubTab('EXCELLENT')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      honourSubTab === 'EXCELLENT'
                        ? 'bg-purple-700 text-white shadow-2xs'
                        : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                    }`}
                  >
                    ยอดเยี่ยม (ไม่เคยโดนหัก)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHonourSubTab('OUTSTANDING')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      honourSubTab === 'OUTSTANDING'
                        ? 'bg-blue-700 text-white shadow-2xs'
                        : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                    }`}
                  >
                    ดีเด่น (มีคะแนนสะสม)
                  </button>
                </div>

                <div className="w-full sm:w-64 relative">
                  <input
                    type="text"
                    value={honourSearch}
                    onChange={e => setHonourSearch(e.target.value)}
                    placeholder="ค้นหาชื่อ หรือ รหัส..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Grade filters */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 mr-1">ระดับชั้น:</span>
                {['ALL', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setHonourGradeFilter(lvl)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      honourGradeFilter === lvl
                        ? 'bg-violet-100 text-violet-900 font-bold border border-violet-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {lvl === 'ALL' ? 'ทุกชั้น' : lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Document: Outstanding 100+ Roster */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="text-center border-b border-slate-200 pb-5 space-y-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {schoolName}
                </h2>
                <h3 className="text-sm sm:text-base font-bold text-violet-900">
                  ทำเนียบเกียรติยศนักเรียนความประพฤติดีเด่นและยอดเยี่ยม (คะแนน 100+)
                </h3>
                <p className="text-xs text-slate-500">
                  ปีการศึกษา {currentAcademicYear} ภาคเรียนที่ {currentTerm} • นักเรียนในทำเนียบ <strong>{honour100PlusStudents.length}</strong> คน
                </p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">อันดับ</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">รหัสนักเรียน</th>
                      <th className="py-2.5 px-3">ชื่อ - นามสกุล</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">ชั้น/ห้อง</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">เลขที่</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">คะแนนพื้นฐาน</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">คะแนนความดีสำรอง</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">รวมคะแนนสุทธิ</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">เกียรติยศ</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">ครูที่ปรึกษา</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {honour100PlusStudents.map((st, idx) => {
                      const isVisibleOnScreen = honourPageSize >= 999999 || (idx >= (honourPage - 1) * honourPageSize && idx < honourPage * honourPageSize);
                      const g = calculateStudentGrade(st.entryYear, st.entryLevel, currentAcademicYear);
                      const cat = getScoreCategory(st, systemSettings);
                      return (
                        <tr
                          key={st.id}
                          className={`hover:bg-slate-50 transition-colors ${!isVisibleOnScreen ? 'hidden print:table-row print-show-all' : ''}`}
                        >
                          <td className="py-2 px-3 text-center font-bold font-mono text-amber-700">
                            #{idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">{st.id}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {st.title}{st.firstName} {st.lastName}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-700 whitespace-nowrap">
                            {g.grade}/{st.room}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-600">{st.number || '-'}</td>
                          <td className="py-2 px-3 text-center font-mono text-slate-700">100</td>
                          <td className="py-2 px-3 text-center font-mono font-black text-purple-700 whitespace-nowrap">
                            +{st.bankedPoints || 0} แต้ม
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-black text-amber-600 text-sm whitespace-nowrap">
                            {100 + (st.bankedPoints || 0)}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cat.badgeClass}`}>
                              {cat.label}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {(() => {
                              const advList = getAdvisorNamesList(st);
                              if (advList.length === 0) return <span className="text-slate-400">-</span>;
                              return (
                                <div className="space-y-0.5" style={{ lineHeight: '1.35' }}>
                                  {advList.map((adv, aIdx) => (
                                    <div key={aIdx}>{adv}</div>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {honour100PlusStudents.length > 0 && (
                <div className="no-print mt-2">
                  <Pagination
                    currentPage={honourPage}
                    totalItems={honour100PlusStudents.length}
                    pageSize={honourPageSize}
                    onPageChange={setHonourPage}
                    onPageSizeChange={(size) => {
                      setHonourPageSize(size);
                      setHonourPage(1);
                    }}
                    pageSizeOptions={[25, 50, 100, 'ALL']}
                    itemLabel="คน"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* 5. REPORT: รายงานการเพิ่มคะแนน (ระบุช่วงเวลา)(ค้นหาหัวข้อความประพฤติ) */}
        {/* ======================================================================= */}
        {activeTab === 'POINTS_ADDED' && (
          <div className="space-y-6">
            {/* Filter Bar (Hidden during print) */}
            <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Filter className="w-4 h-4 text-teal-600" />
                  <span>ตัวกรองช่วงเวลาและค้นหาหัวข้อความประพฤติ (เพิ่มคะแนน)</span>
                </div>
                {/* Date Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-400">ช่วงเวลาด่วน:</span>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('ALL')}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    ทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('TODAY')}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    วันนี้
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('WEEK')}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    7 วันล่าสุด
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('MONTH')}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    30 วันล่าสุด
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('TERM')}
                    className="px-2.5 py-1 text-xs font-semibold bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg cursor-pointer font-bold"
                  >
                    ภาคเรียนนี้
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                {/* Start Date */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">วันที่เริ่มต้น (Start Date)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">วันที่สิ้นสุด (End Date)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden"
                  />
                </div>

                {/* Search behavior topic */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">ค้นหาหัวข้อ / กิจกรรม</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={behaviorSearch}
                      onChange={e => setBehaviorSearch(e.target.value)}
                      placeholder="เช่น จิตอาสา, ช่วยเหลืองาน..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                {/* Category filter */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">หมวดหมู่ความประพฤติ</label>
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-hidden"
                  >
                    <option value="ALL">ทุกหมวดหมู่</option>
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Document: Points Added Report */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="text-center border-b border-slate-200 pb-5 space-y-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {schoolName}
                </h2>
                <h3 className="text-sm sm:text-base font-bold text-teal-800">
                  รายงานสรุปการเพิ่มคะแนนความประพฤติและกิจกรรมส่งเสริมความดี
                </h3>
                <p className="text-xs text-slate-500">
                  {startDate || endDate
                    ? `ช่วงวันที่ ${formatThaiDate(startDate) || 'เริ่มต้น'} ถึง ${formatThaiDate(endDate) || 'ปัจจุบัน'}`
                    : `ปีการศึกษา ${currentAcademicYear} ภาคเรียนที่ ${currentTerm}`}
                  {' • '}พบทั้งหมด <strong>{pointsAddedLogs.length}</strong> รายการ
                </p>
              </div>

              {/* KPI Summary for Points Added */}
              {(() => {
                const totalPoints = pointsAddedLogs.reduce((sum, l) => sum + (l.points || 0), 0);
                const uniqueStudents = new Set(pointsAddedLogs.map(l => l.studentId)).size;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-2xl text-center">
                      <span className="text-[11px] font-bold text-teal-700 uppercase">จำนวนครั้งที่เพิ่ม</span>
                      <div className="text-2xl font-black text-teal-900 mt-0.5">{pointsAddedLogs.length}</div>
                    </div>
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase">คะแนนความดีรวม</span>
                      <div className="text-2xl font-black text-emerald-900 mt-0.5">+{totalPoints}</div>
                    </div>
                    <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl text-center">
                      <span className="text-[11px] font-bold text-indigo-700 uppercase">นักเรียนที่ได้รับเพิ่ม</span>
                      <div className="text-2xl font-black text-indigo-900 mt-0.5">{uniqueStudents} คน</div>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">เฉลี่ยต่อครั้ง</span>
                      <div className="text-2xl font-black text-slate-800 mt-0.5">
                        {pointsAddedLogs.length > 0 ? (totalPoints / pointsAddedLogs.length).toFixed(1) : 0}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Logs Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">วันที่บันทึก</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">รหัสนักเรียน</th>
                      <th className="py-2.5 px-3">ชื่อ - นามสกุล</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">ชั้น/ห้อง</th>
                      <th className="py-2.5 px-3">หัวข้อความประพฤติ / กิจกรรม</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">หมวดหมู่</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">คะแนนที่เพิ่ม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pointsAddedLogs.map((log, idx) => {
                      const isVisibleOnScreen = pointsAddedPageSize >= 999999 || (idx >= (pointsAddedPage - 1) * pointsAddedPageSize && idx < pointsAddedPage * pointsAddedPageSize);
                      const student = students.find(s => s.id === log.studentId);
                      const g = student ? calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear) : null;
                      return (
                        <tr
                          key={log.id}
                          className={`hover:bg-slate-50 transition-colors ${!isVisibleOnScreen ? 'hidden print:table-row print-show-all' : ''}`}
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-slate-700 whitespace-nowrap">
                            {formatThaiDate(log.violationDate || log.recordedAt)}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">{log.studentId}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {student ? `${student.title}${student.firstName} ${student.lastName}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-700 whitespace-nowrap">
                            {g ? `${g.grade}/${student?.room}` : '-'}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-800">
                            <div>{log.behaviorTitle || log.reason || '-'}</div>
                            {log.description && (
                              <div className="text-[11px] text-slate-500 font-normal">{log.description}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-600">{log.category || '-'}</td>
                          <td className="py-2 px-3 text-center font-mono font-black text-emerald-600 whitespace-nowrap">
                            +{log.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pointsAddedLogs.length > 0 && (
                <div className="no-print mt-2">
                  <Pagination
                    currentPage={pointsAddedPage}
                    totalItems={pointsAddedLogs.length}
                    pageSize={pointsAddedPageSize}
                    onPageChange={setPointsAddedPage}
                    onPageSizeChange={(size) => {
                      setPointsAddedPageSize(size);
                      setPointsAddedPage(1);
                    }}
                    pageSizeOptions={[25, 50, 100, 'ALL']}
                    itemLabel="รายการ"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* 6. REPORT: รายงานการหักคะแนน (ระบุช่วงเวลา)(ค้นหาหัวข้อความประพฤติ) */}
        {/* ======================================================================= */}
        {activeTab === 'POINTS_DEDUCTED' && (
          <div className="space-y-6">
            {/* Filter Bar (Hidden during print) */}
            <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Filter className="w-4 h-4 text-rose-600" />
                  <span>ตัวกรองช่วงเวลาและค้นหาหัวข้อความประพฤติ (หักคะแนน)</span>
                </div>
                {/* Date Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-400">ช่วงเวลาด่วน:</span>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('ALL')}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    ทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('TODAY')}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    วันนี้
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('WEEK')}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    7 วันล่าสุด
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('MONTH')}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    30 วันล่าสุด
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDatePreset('TERM')}
                    className="px-2.5 py-1 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg cursor-pointer font-bold"
                  >
                    ภาคเรียนนี้
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                {/* Start Date */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">วันที่เริ่มต้น (Start Date)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">วันที่สิ้นสุด (End Date)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden"
                  />
                </div>

                {/* Search behavior topic */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">ค้นหาหัวข้อ / ความผิด</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={behaviorSearch}
                      onChange={e => setBehaviorSearch(e.target.value)}
                      placeholder="เช่น มาสาย, แต่งกาย, ทะเลาะ..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                {/* Category filter */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">หมวดหมู่ความผิด</label>
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-hidden"
                  >
                    <option value="ALL">ทุกหมวดหมู่</option>
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Document: Points Deducted Report */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="text-center border-b border-slate-200 pb-5 space-y-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {schoolName}
                </h2>
                <h3 className="text-sm sm:text-base font-bold text-rose-800">
                  รายงานสรุปการหักคะแนนความประพฤติและการกระทำผิดระเบียบโรงเรียน
                </h3>
                <p className="text-xs text-slate-500">
                  {startDate || endDate
                    ? `ช่วงวันที่ ${formatThaiDate(startDate) || 'เริ่มต้น'} ถึง ${formatThaiDate(endDate) || 'ปัจจุบัน'}`
                    : `ปีการศึกษา ${currentAcademicYear} ภาคเรียนที่ ${currentTerm}`}
                  {' • '}พบทั้งหมด <strong>{pointsDeductedLogs.length}</strong> รายการ
                </p>
              </div>

              {/* KPI Summary for Points Deducted */}
              {(() => {
                const totalPoints = pointsDeductedLogs.reduce((sum, l) => sum + (l.points || 0), 0);
                const uniqueStudents = new Set(pointsDeductedLogs.map(l => l.studentId)).size;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl text-center">
                      <span className="text-[11px] font-bold text-rose-700 uppercase">จำนวนครั้งที่หัก</span>
                      <div className="text-2xl font-black text-rose-900 mt-0.5">{pointsDeductedLogs.length}</div>
                    </div>
                    <div className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-2xl text-center">
                      <span className="text-[11px] font-bold text-orange-700 uppercase">คะแนนที่ถูกหักรวม</span>
                      <div className="text-2xl font-black text-orange-900 mt-0.5">-{totalPoints}</div>
                    </div>
                    <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl text-center">
                      <span className="text-[11px] font-bold text-indigo-700 uppercase">นักเรียนที่ถูกหักคะแนน</span>
                      <div className="text-2xl font-black text-indigo-900 mt-0.5">{uniqueStudents} คน</div>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">เฉลี่ยต่อครั้ง</span>
                      <div className="text-2xl font-black text-slate-800 mt-0.5">
                        {pointsDeductedLogs.length > 0 ? (totalPoints / pointsDeductedLogs.length).toFixed(1) : 0}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Logs Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">วันที่บันทึก</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">รหัสนักเรียน</th>
                      <th className="py-2.5 px-3">ชื่อ - นามสกุล</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">ชั้น/ห้อง</th>
                      <th className="py-2.5 px-3">หัวข้อการกระทำผิด / รายละเอียด</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">หมวดหมู่</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">คะแนนที่หัก</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">คงเหลือหลังหัก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pointsDeductedLogs.map((log, idx) => {
                      const isVisibleOnScreen = pointsDeductedPageSize >= 999999 || (idx >= (pointsDeductedPage - 1) * pointsDeductedPageSize && idx < pointsDeductedPage * pointsDeductedPageSize);
                      const student = students.find(s => s.id === log.studentId);
                      const g = student ? calculateStudentGrade(student.entryYear, student.entryLevel, currentAcademicYear) : null;
                      return (
                        <tr
                          key={log.id}
                          className={`hover:bg-slate-50 transition-colors ${!isVisibleOnScreen ? 'hidden print:table-row print-show-all' : ''}`}
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-slate-700 whitespace-nowrap">
                            {formatThaiDate(log.violationDate || log.recordedAt)}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">{log.studentId}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {student ? `${student.title}${student.firstName} ${student.lastName}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-700 whitespace-nowrap">
                            {g ? `${g.grade}/${student?.room}` : '-'}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-800">
                            <div>{log.behaviorTitle || log.reason || '-'}</div>
                            {log.description && (
                              <div className="text-[11px] text-slate-500 font-normal">{log.description}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-600">{log.category || '-'}</td>
                          <td className="py-2 px-3 text-center font-mono font-black text-rose-600 whitespace-nowrap">
                            -{log.points}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-700 whitespace-nowrap">
                            {log.scoreAfter ?? '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pointsDeductedLogs.length > 0 && (
                <div className="no-print mt-2">
                  <Pagination
                    currentPage={pointsDeductedPage}
                    totalItems={pointsDeductedLogs.length}
                    pageSize={pointsDeductedPageSize}
                    onPageChange={setPointsDeductedPage}
                    onPageSizeChange={(size) => {
                      setPointsDeductedPageSize(size);
                      setPointsDeductedPage(1);
                    }}
                    pageSizeOptions={[25, 50, 100, 'ALL']}
                    itemLabel="รายการ"
                  />
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
