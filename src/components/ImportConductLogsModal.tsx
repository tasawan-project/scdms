import React, { useState, useMemo, useEffect } from 'react';
import { Student, ConductLog, AppUser, SystemSettings } from '../types';
import { calculateDeduction, calculateStudentGrade } from '../utils/conductLogic';
import { parseDateToYyyyMmDd, formatThaiDate } from '../utils/thaiDate';
import { StudentAvatar } from './StudentAvatar';
import { Pagination } from './Pagination';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  ClipboardPaste,
  ArrowRight,
  MinusCircle,
  Calendar,
  User,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Info,
  ChevronRight,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

export interface ParsedConductRow {
  rowIndex: number;
  rawStudentId: string;
  matchedStudent?: Student;
  reason: string;
  ruleCategory: string;
  violationDate: string; // YYYY-MM-DD
  pointsToDeduct: number;
  notes?: string;
  status: 'VALID' | 'STUDENT_NOT_FOUND' | 'INVALID_POINTS' | 'MISSING_ID';
  errorMessage?: string;
  // Calculated projection
  scoreBefore: number;
  scoreAfter: number;
  bankedBefore: number;
  bankedAfter: number;
}

interface ImportConductLogsModalProps {
  students: Student[];
  currentAcademicYear: number;
  currentTerm: number;
  currentUser: AppUser | null;
  systemSettings?: SystemSettings;
  isPage?: boolean;
  onClose: () => void;
  onImportSuccess: (logs: ConductLog[], updatedStudents: Student[]) => Promise<void>;
}

export const ImportConductLogsModal: React.FC<ImportConductLogsModalProps> = ({
  students,
  currentAcademicYear,
  currentTerm,
  currentUser,
  systemSettings,
  isPage = false,
  onClose,
  onImportSuccess
}) => {
  const [importMode, setImportMode] = useState<'FILE' | 'PASTE'>('FILE');
  const [targetAcademicYear, setTargetAcademicYear] = useState<number>(currentAcademicYear);
  const [targetTerm, setTargetTerm] = useState<number>(currentTerm);
  const [recordedByName, setRecordedByName] = useState<string>(
    currentUser?.name || 'ฝ่ายกิจการนักเรียนและวินัย'
  );
  const [skipUnmatched, setSkipUnmatched] = useState<boolean>(true);

  // Raw file & text input states
  const [fileName, setFileName] = useState<string>('');
  const [pasteContent, setPasteContent] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitProgress, setSubmitProgress] = useState<number>(0);
  const [submitStatusText, setSubmitStatusText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importCompleted, setImportCompleted] = useState<boolean>(false);
  const [completedSummary, setCompletedSummary] = useState<{
    totalLogs: number;
    totalStudents: number;
    totalPoints: number;
  } | null>(null);

  // Parsed rows & filter states
  const [parsedRows, setParsedRows] = useState<ParsedConductRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'VALID' | 'ISSUES'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Quick lookup map by student ID (trimmed, lowercased)
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    (students || []).forEach(s => {
      if (s && s.id) {
        map.set(String(s.id).trim().toLowerCase(), s);
      }
    });
    return map;
  }, [students]);

  // Reset page when rows change
  useEffect(() => {
    setCurrentPage(1);
  }, [parsedRows.length, filterStatus, searchQuery, pageSize]);

  // Download Sample Excel Template (.xlsx)
  const downloadSampleTemplate = () => {
    // Pick real student IDs if present, otherwise realistic fallbacks
    const sampleIds = students.slice(0, 5).map(s => s.id);
    const id1 = sampleIds[0] || '05501';
    const id2 = sampleIds[1] || '05502';
    const id3 = sampleIds[2] || '05503';
    const id4 = sampleIds[3] || '05504';
    const id5 = sampleIds[4] || '05505';

    const sampleData = [
      {
        'รหัสนักเรียน': id1,
        'กระทำผิดเรื่อง': 'มาสายเกิน 3 ครั้งใน 1 สัปดาห์',
        'วันที่กระทำผิด': new Date().toISOString().split('T')[0],
        'ผิดระเบียบข้อ': 'ข้อ 4.1 การตรงต่อเวลาและการเข้าแถว',
        'หักคะแนน': 5,
        'หมายเหตุ': 'ตักเตือนด้วยวาจาแล้ว'
      },
      {
        'รหัสนักเรียน': id2,
        'กระทำผิดเรื่อง': 'แต่งกายผิดระเบียบโรงเรียน (ไม่สวมเข็มขัด)',
        'วันที่กระทำผิด': new Date().toISOString().split('T')[0],
        'ผิดระเบียบข้อ': 'ข้อ 5.2 ระเบียบการแต่งกายและเครื่องแบบ',
        'หักคะแนน': 5,
        'หมายเหตุ': 'ยืมอุปกรณ์ฝ่ายปกครอง'
      },
      {
        'รหัสนักเรียน': id3,
        'กระทำผิดเรื่อง': 'ใช้โทรศัพท์มือถือในเวลาเรียนโดยไม่ได้รับอนุญาต',
        'วันที่กระทำผิด': new Date().toISOString().split('T')[0],
        'ผิดระเบียบข้อ': 'ข้อ 6.3 อุปกรณ์อิเล็กทรอนิกส์ในห้องเรียน',
        'หักคะแนน': 10,
        'หมายเหตุ': 'ส่งมอบให้ครูที่ปรึกษา'
      },
      {
        'รหัสนักเรียน': id4,
        'กระทำผิดเรื่อง': 'ออกนอกบริเวณโรงเรียนโดยไม่ได้รับอนุญาต',
        'วันที่กระทำผิด': new Date().toISOString().split('T')[0],
        'ผิดระเบียบข้อ': 'ข้อ 7.1 การออกจากบริเวณสถานศึกษา',
        'หักคะแนน': 15,
        'หมายเหตุ': 'ติดต่อผู้ปกครองรับทราบ'
      },
      {
        'รหัสนักเรียน': id5,
        'กระทำผิดเรื่อง': 'ไม่ส่งงานตามกำหนดและขาดการร่วมกิจกรรมหน้าเสาธง',
        'วันที่กระทำผิด': new Date().toISOString().split('T')[0],
        'ผิดระเบียบข้อ': 'ข้อ 4.2 กิจกรรมรวมของสถานศึกษา',
        'หักคะแนน': 5,
        'หมายเหตุ': '-'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    // Set friendly column widths
    ws['!cols'] = [
      { wch: 16 }, // รหัสนักเรียน
      { wch: 42 }, // กระทำผิดเรื่อง
      { wch: 18 }, // วันที่กระทำผิด
      { wch: 38 }, // ผิดระเบียบข้อ
      { wch: 14 }, // หักคะแนน
      { wch: 28 }  // หมายเหตุ
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'การกระทำผิด');
    XLSX.writeFile(wb, `แบบฟอร์มนำเข้าการกระทำผิด_ปี${targetAcademicYear}.xlsx`);
  };

  /**
   * Process raw tabular rows (from Excel or Paste)
   * Matches columns flexibly and calculates running score deductions
   */
  const processRawRows = (rawRows: any[]) => {
    if (!rawRows || rawRows.length === 0) {
      setErrorMsg('ไม่พบข้อมูลในไฟล์ กรุณาตรวจสอบว่ามีข้อมูลและหัวตารางถูกต้อง');
      setParsedRows([]);
      return;
    }

    try {
      // Map to hold running students simulation so multiple rows for same student accumulate correctly
      const runningStudents = new Map<string, Student>();
      const processed: ParsedConductRow[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];

        // 1. Find Student ID
        const rawId = String(
          row['รหัสนักเรียน'] ||
          row['รหัสประจำตัว'] ||
          row['รหัส'] ||
          row['studentId'] ||
          row['student_id'] ||
          row['เลขประจำตัว'] ||
          row['id'] ||
          ''
        ).trim();

        // 2. Find Reason (กระทำผิดเรื่อง)
        const reason = String(
          row['กระทำผิดเรื่อง'] ||
          row['เรื่อง'] ||
          row['การกระทำผิด'] ||
          row['พฤติกรรม'] ||
          row['เหตุผล'] ||
          row['รายละเอียด'] ||
          row['reason'] ||
          row['description'] ||
          row['title'] ||
          'กระทำผิดระเบียบวินัย'
        ).trim();

        // 3. Find Violation Date (วันที่กระทำผิด)
        const rawDate =
          row['วันที่กระทำผิด'] ||
          row['วันที่เกิดเหตุ'] ||
          row['วันที่'] ||
          row['date'] ||
          row['violationDate'] ||
          row['violation_date'];
        const violationDate = parseDateToYyyyMmDd(rawDate);

        // 4. Find Regulation Rule / Category (ผิดระเบียบข้อ)
        const ruleCategory = String(
          row['ผิดระเบียบข้อ'] ||
          row['ระเบียบข้อ'] ||
          row['ข้อ'] ||
          row['ข้อที่'] ||
          row['หมวดหมู่'] ||
          row['category'] ||
          row['rule'] ||
          row['clause'] ||
          'วินัยทั่วไป'
        ).trim();

        // 5. Find Points (หักคะแนน)
        const rawPoints =
          row['หักคะแนน'] ||
          row['คะแนนที่หัก'] ||
          row['คะแนน'] ||
          row['points'] ||
          row['deductedPoints'] ||
          row['score'] ||
          row['แต้มที่หัก'];

        let numPoints = 0;
        if (rawPoints !== undefined && rawPoints !== null && String(rawPoints).trim() !== '') {
          const parsedNum = Math.abs(parseFloat(String(rawPoints).replace(/[^\d.-]/g, '')));
          if (!isNaN(parsedNum)) {
            numPoints = parsedNum;
          }
        }

        // 6. Notes (หมายเหตุ)
        const notes = String(
          row['หมายเหตุ'] || row['notes'] || row['note'] || row['remark'] || ''
        ).trim();

        // Evaluate Row Status & Validate
        let status: ParsedConductRow['status'] = 'VALID';
        let errorMessage: string | undefined = undefined;

        if (!rawId) {
          status = 'MISSING_ID';
          errorMessage = 'ไม่พบรหัสนักเรียนในแถวนี้';
        }

        const normalizedId = rawId.toLowerCase();
        const existingStudent = studentMap.get(normalizedId);

        if (status === 'VALID' && !existingStudent) {
          status = 'STUDENT_NOT_FOUND';
          errorMessage = `ไม่พบรหัสนักเรียน "${rawId}" ในฐานข้อมูลระบบ`;
        }

        if (status === 'VALID' && (!numPoints || numPoints <= 0)) {
          status = 'INVALID_POINTS';
          errorMessage = 'จำนวนคะแนนที่หักต้องมากกว่า 0';
        }

        // Compute Before & After Projections
        let scoreBefore = 100;
        let scoreAfter = 100;
        let bankedBefore = 0;
        let bankedAfter = 0;

        if (status === 'VALID' && existingStudent) {
          // Retrieve running copy of student for cumulative calculation
          let currentRunning = runningStudents.get(normalizedId);
          if (!currentRunning) {
            currentRunning = { ...existingStudent };
          }

          scoreBefore = currentRunning.currentScore ?? 100;
          bankedBefore = currentRunning.bankedPoints ?? 0;

          const deduction = calculateDeduction(currentRunning, numPoints);
          scoreAfter = deduction.newCurrentScore;
          bankedAfter = deduction.newBankedPoints;

          // Update running copy
          currentRunning = {
            ...currentRunning,
            currentScore: deduction.newCurrentScore,
            bankedPoints: deduction.newBankedPoints,
            totalDeductionsCount: (currentRunning.totalDeductionsCount || 0) + 1,
            totalDeductedPoints: (currentRunning.totalDeductedPoints || 0) + numPoints,
            hasNeverBeenDeducted: false
          };
          runningStudents.set(normalizedId, currentRunning);
        }

        processed.push({
          rowIndex: i + 1,
          rawStudentId: rawId,
          matchedStudent: existingStudent,
          reason,
          ruleCategory,
          violationDate,
          pointsToDeduct: numPoints,
          notes: notes || undefined,
          status,
          errorMessage,
          scoreBefore,
          scoreAfter,
          bankedBefore,
          bankedAfter
        });
      }

      setParsedRows(processed);
      setErrorMsg(null);
    } catch (err: any) {
      console.error('Error processing conduct rows:', err);
      setErrorMsg('เกิดข้อผิดพลาดในการประมวลผลข้อมูล: ' + (err.message || ''));
    }
  };

  // Handle Excel File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true
        });

        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setErrorMsg('ไฟล์ไม่มีแผ่นงาน (Sheet)');
          setIsParsing(false);
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        processRawRows(jsonData);
      } catch (err: any) {
        console.error('Excel parse error:', err);
        setErrorMsg('ไม่สามารถอ่านไฟล์ Excel ได้: ' + (err.message || ''));
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg('เกิดข้อผิดพลาดในการอ่านไฟล์');
      setIsParsing(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // Handle Drag and Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true
        });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        processRawRows(jsonData);
      } catch (err: any) {
        setErrorMsg('ไม่สามารถอ่านไฟล์ได้: ' + (err.message || ''));
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle Paste from Clipboard
  const handleParsePaste = () => {
    if (!pasteContent.trim()) {
      setErrorMsg('กรุณาวางข้อมูลจาก Excel ในช่องข้อความ');
      return;
    }

    try {
      const lines = pasteContent.trim().split(/\r?\n/);
      if (lines.length === 0) return;

      const firstLineCols = lines[0].split('\t').map(c => c.trim());
      const hasHeader =
        firstLineCols.some(c => c.includes('รหัส') || c.includes('id') || c.includes('เรื่อง')) ||
        isNaN(Number(firstLineCols[0]));

      const startIndex = hasHeader ? 1 : 0;
      const headers = hasHeader
        ? firstLineCols
        : ['รหัสนักเรียน', 'กระทำผิดเรื่อง', 'วันที่กระทำผิด', 'ผิดระเบียบข้อ', 'หักคะแนน', 'หมายเหตุ'];

      const rows: any[] = [];
      for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split('\t').map(c => c.trim());
        if (cols.length === 0 || cols.every(c => c === '')) continue;

        const rowObj: Record<string, any> = {};
        if (hasHeader) {
          headers.forEach((h, idx) => {
            rowObj[h] = cols[idx] || '';
          });
        } else {
          rowObj['รหัสนักเรียน'] = cols[0] || '';
          rowObj['กระทำผิดเรื่อง'] = cols[1] || '';
          rowObj['วันที่กระทำผิด'] = cols[2] || '';
          rowObj['ผิดระเบียบข้อ'] = cols[3] || '';
          rowObj['หักคะแนน'] = cols[4] || '';
          rowObj['หมายเหตุ'] = cols[5] || '';
        }
        rows.push(rowObj);
      }

      processRawRows(rows);
    } catch (err: any) {
      setErrorMsg('แปลงข้อมูลไม่สำเร็จ: ' + err.message);
    }
  };

  // Metrics computation
  const summaryMetrics = useMemo(() => {
    const total = parsedRows.length;
    const valid = parsedRows.filter(r => r.status === 'VALID').length;
    const missingStudents = parsedRows.filter(r => r.status === 'STUDENT_NOT_FOUND').length;
    const invalidPoints = parsedRows.filter(r => r.status === 'INVALID_POINTS').length;
    const missingIds = parsedRows.filter(r => r.status === 'MISSING_ID').length;

    const validRows = parsedRows.filter(r => r.status === 'VALID');
    const uniqueStudentIds = new Set(validRows.map(r => r.rawStudentId.toLowerCase()));
    const totalPointsDeducted = validRows.reduce((sum, r) => sum + r.pointsToDeduct, 0);

    return {
      total,
      valid,
      issues: missingStudents + invalidPoints + missingIds,
      missingStudents,
      invalidPoints,
      missingIds,
      uniqueStudentsCount: uniqueStudentIds.size,
      totalPointsDeducted
    };
  }, [parsedRows]);

  // Filtered rows for table view
  const filteredRows = useMemo(() => {
    return parsedRows.filter(row => {
      // 1. Status filter
      if (filterStatus === 'VALID' && row.status !== 'VALID') return false;
      if (filterStatus === 'ISSUES' && row.status === 'VALID') return false;

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = row.rawStudentId.toLowerCase().includes(q);
        const matchReason = row.reason.toLowerCase().includes(q);
        const matchRule = row.ruleCategory.toLowerCase().includes(q);
        const matchName = row.matchedStudent
          ? `${row.matchedStudent.firstName} ${row.matchedStudent.lastName}`.toLowerCase().includes(q)
          : false;

        if (!matchId && !matchReason && !matchRule && !matchName) {
          return false;
        }
      }

      return true;
    });
  }, [parsedRows, filterStatus, searchQuery]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Reset all state to start over
  const handleReset = () => {
    setParsedRows([]);
    setFileName('');
    setPasteContent('');
    setErrorMsg(null);
    setImportCompleted(false);
    setCompletedSummary(null);
  };

  // Submit and execute batch transaction
  const handleConfirmImport = async () => {
    const rowsToImport = parsedRows.filter(r => r.status === 'VALID');
    if (rowsToImport.length === 0) {
      alert('ไม่มีรายการที่ถูกต้องพร้อมนำเข้า');
      return;
    }

    if (summaryMetrics.issues > 0 && !skipUnmatched) {
      const ok = confirm(
        `พบรายการที่มีข้อผิดพลาดหรือไม่พบรหัสนักเรียน ${summaryMetrics.issues} รายการ ต้องการข้ามรายการเหล่านี้และนำเข้าเฉพาะรายการที่ถูกต้อง ${rowsToImport.length} รายการหรือไม่?`
      );
      if (!ok) return;
    }

    setIsSubmitting(true);
    setSubmitProgress(10);
    setSubmitStatusText('กำลังจัดเตรียมข้อมูลและคำนวณคะแนนสะสม...');

    try {
      const nowIso = new Date().toISOString();
      const logsToSave: ConductLog[] = [];
      const studentFinalMap = new Map<string, Student>();

      // Apply deductions sequentially per student
      for (let i = 0; i < rowsToImport.length; i++) {
        const row = rowsToImport[i];
        const studentId = row.rawStudentId.toLowerCase();

        // Get base student or latest accumulated state
        let currentStudent = studentFinalMap.get(studentId) || studentMap.get(studentId);
        if (!currentStudent) continue;

        const scoreBefore = currentStudent.currentScore ?? 100;
        const bankedBefore = currentStudent.bankedPoints ?? 0;

        const deductionResult = calculateDeduction(currentStudent, row.pointsToDeduct);

        // Build log
        const logId = `conduct-batch-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
        const log: ConductLog = {
          id: logId,
          studentId: currentStudent.id,
          type: 'DEDUCT',
          points: row.pointsToDeduct,
          appliedToScore: deductionResult.scoreDeductionDelta,
          bankedPointsDelta: deductionResult.bankedPointsDelta,
          scoreBefore,
          scoreAfter: deductionResult.newCurrentScore,
          bankedBefore,
          bankedAfter: deductionResult.newBankedPoints,
          category: row.ruleCategory || 'วินัยทั่วไป',
          reason: row.reason || 'กระทำผิดระเบียบวินัย',
          violationDate: row.violationDate,
          notes: row.notes || (row.ruleCategory ? `ผิดระเบียบ: ${row.ruleCategory}` : undefined),
          recordedBy: recordedByName.trim() || 'ฝ่ายกิจการนักเรียน',
          recordedByName: recordedByName.trim() || 'ฝ่ายกิจการนักเรียน',
          recordedByRole: (currentUser?.role as any) || 'staff',
          recordedAt: nowIso,
          academicYear: targetAcademicYear,
          term: targetTerm
        };

        logsToSave.push(log);

        // Update student final accumulated state
        const updatedStudent: Student = {
          ...currentStudent,
          currentScore: deductionResult.newCurrentScore,
          bankedPoints: deductionResult.newBankedPoints,
          totalDeductionsCount: (currentStudent.totalDeductionsCount || 0) + 1,
          totalDeductedPoints: (currentStudent.totalDeductedPoints || 0) + row.pointsToDeduct,
          hasNeverBeenDeducted: false,
          updatedAt: nowIso
        };
        studentFinalMap.set(studentId, updatedStudent);

        if (i % 25 === 0 || i === rowsToImport.length - 1) {
          const pct = Math.round(10 + ((i + 1) / rowsToImport.length) * 40);
          setSubmitProgress(pct);
        }
      }

      setSubmitStatusText('กำลังบันทึกข้อมูลและอัปเดตคะแนนนักเรียนลงฐานข้อมูล...');
      setSubmitProgress(60);

      const finalStudentsList = Array.from(studentFinalMap.values());

      // Call parent handler (which commits batch to Firestore and updates React state)
      await onImportSuccess(logsToSave, finalStudentsList);

      setSubmitProgress(100);
      setSubmitStatusText('นำเข้าข้อมูลสำเร็จเรียบร้อย!');

      // Trigger celebration confetti
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });

      setCompletedSummary({
        totalLogs: logsToSave.length,
        totalStudents: finalStudentsList.length,
        totalPoints: rowsToImport.reduce((sum, r) => sum + r.pointsToDeduct, 0)
      });
      setImportCompleted(true);
    } catch (err: any) {
      console.error('Import error:', err);
      alert('เกิดข้อผิดพลาดในการนำเข้าข้อมูล: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Main Card Wrapper
  const contentWrapperClass = isPage
    ? 'w-full max-w-6xl mx-auto space-y-5 animate-in fade-in duration-200'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto';

  const modalInnerClass = isPage
    ? 'bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden'
    : 'bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-100 overflow-hidden my-4 sm:my-6 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col';

  return (
    <div className={contentWrapperClass}>
      <div className={modalInnerClass} onClick={e => e.stopPropagation()}>
        {/* ========================================================================= */}
        {/* 1. HEADER */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-rose-700 via-rose-800 to-red-800 p-4 sm:p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white/15 backdrop-blur-xs rounded-2xl border border-white/20 shadow-2xs">
              <FileSpreadsheet className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold">
                  นำเข้าข้อมูลการกระทำผิดของนักเรียน (Excel)
                </h1>
                <span className="text-[11px] font-bold bg-white/20 text-white px-2.5 py-0.5 rounded-md backdrop-blur-xs">
                  อ้างอิงรหัสนักเรียน
                </span>
              </div>
              <p className="text-xs sm:text-sm text-rose-100 mt-0.5">
                นำเข้ารายการกระทำผิด ตัดคะแนนความประพฤติ และอัปเดตประวัติวินัยนักเรียนพร้อมกัน
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 2. SUCCESS COMPLETION VIEW */}
        {/* ========================================================================= */}
        {importCompleted && completedSummary ? (
          <div className="p-6 sm:p-10 space-y-6 text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm border border-emerald-200">
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                นำเข้าข้อมูลการกระทำผิดสำเร็จ!
              </h2>
              <p className="text-sm text-slate-600">
                ระบบได้บันทึกประวัติการกระทำผิดและคำนวณหักคะแนนความประพฤตินักเรียนเรียบร้อยแล้ว
              </p>
            </div>

            {/* Metrics highlight */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-2xl text-left">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 block">
                  รายการที่นำเข้า
                </span>
                <span className="text-xl sm:text-2xl font-black text-rose-600">
                  {completedSummary.totalLogs}
                </span>
                <span className="text-xs text-slate-400 ml-1">รายการ</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 block">
                  นักเรียนที่ถูกหักคะแนน
                </span>
                <span className="text-xl sm:text-2xl font-black text-indigo-600">
                  {completedSummary.totalStudents}
                </span>
                <span className="text-xs text-slate-400 ml-1">คน</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 block">
                  คะแนนที่หักรวม
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-600">
                  -{completedSummary.totalPoints}
                </span>
                <span className="text-xs text-slate-400 ml-1">คะแนน</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer text-sm"
              >
                ดูข้อมูลที่แดชบอร์ด
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>นำเข้าข้อมูลชุดใหม่</span>
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* 3. WORKFLOW MAIN BODY */
          /* ========================================================================= */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Top Info Banner & Excel Template Downloader */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>โครงสร้างคอลัมน์ Excel ที่ต้องการค้นหาและนำเข้า:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {[
                    { label: 'รหัสนักเรียน', desc: 'รหัส 5 หลักเพื่อค้นหาตัวตน' },
                    { label: 'กระทำผิดเรื่อง', desc: 'รายละเอียดพฤติกรรม' },
                    { label: 'วันที่กระทำผิด', desc: 'เช่น 2026-09-10 หรือ 10/09/2569' },
                    { label: 'ผิดระเบียบข้อ', desc: 'เช่น ข้อ 4.1 วินัย' },
                    { label: 'หักคะแนน', desc: 'เช่น 5, 10, 15' }
                  ].map((col, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-white text-slate-700 border border-slate-300 px-2.5 py-1 rounded-lg font-medium shadow-2xs flex items-center gap-1.5"
                    >
                      <span className="font-bold text-rose-700">{col.label}</span>
                      <span className="text-[10px] text-slate-400">({col.desc})</span>
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="w-full md:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 text-rose-700 border border-rose-300 font-bold text-xs sm:text-sm rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)</span>
              </button>
            </div>

            {/* Academic Year & Recorded By Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>ปีการศึกษาที่บันทึก</span>
                </label>
                <input
                  type="number"
                  value={targetAcademicYear}
                  onChange={e => setTargetAcademicYear(parseInt(e.target.value) || currentAcademicYear)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>ภาคเรียน</span>
                </label>
                <select
                  value={targetTerm}
                  onChange={e => setTargetTerm(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  <option value={1}>ภาคเรียนที่ 1</option>
                  <option value={2}>ภาคเรียนที่ 2</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>ผู้บันทึกข้อมูล</span>
                </label>
                <input
                  type="text"
                  value={recordedByName}
                  onChange={e => setRecordedByName(e.target.value)}
                  placeholder="ชื่ออาจารย์ หรือฝ่ายงาน"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Import Mode Tabs: File Upload vs Copy-Paste */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setImportMode('FILE')}
                className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                  importMode === 'FILE'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>อัปโหลดไฟล์ Excel (.xlsx, .xls, .csv)</span>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('PASTE')}
                className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                  importMode === 'PASTE'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ClipboardPaste className="w-4 h-4" />
                <span>คัดลอกและวางข้อมูล (Copy & Paste)</span>
              </button>
            </div>

            {/* Error Message Toast */}
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs sm:text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{errorMsg}</div>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-rose-500 hover:text-rose-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* 3.1 Mode: FILE UPLOAD ZONE */}
            {importMode === 'FILE' && (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-300 hover:border-rose-500 bg-slate-50/70 hover:bg-rose-50/30 rounded-3xl p-6 sm:p-8 text-center transition-colors relative cursor-pointer"
              >
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-3 pointer-events-none">
                  <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                    <FileSpreadsheet className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-800">
                      {fileName ? (
                        <span className="text-rose-700 font-bold">{fileName}</span>
                      ) : (
                        'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่'
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      รองรับไฟล์ Excel (.xlsx, .xls) หรือ CSV ที่มีคอลัมน์รหัสนักเรียนและคะแนนที่หัก
                    </p>
                  </div>
                  {isParsing && (
                    <div className="flex items-center justify-center gap-2 text-rose-600 text-xs font-bold">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังอ่านและตรวจสอบข้อมูล...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3.2 Mode: PASTE TEXT ZONE */}
            {importMode === 'PASTE' && (
              <div className="space-y-3">
                <textarea
                  value={pasteContent}
                  onChange={e => setPasteContent(e.target.value)}
                  placeholder="วางข้อมูลที่คัดลอกจาก Excel ที่นี่ (ข้อมูลคั่นด้วย Tab หรือ Comma)...
ตัวอย่าง:
05501	มาสายเกิน 3 ครั้ง	2026-09-10	ข้อ 4.1 วินัย	5
05502	แต่งกายผิดระเบียบ	2026-09-10	ข้อ 5.2 เครื่องแบบ	5"
                  rows={5}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    * สามารถ Copy จากโปรแกรม Excel แล้วกด Ctrl+V (วาง) ได้โดยตรง
                  </span>
                  <button
                    type="button"
                    onClick={handleParsePaste}
                    disabled={!pasteContent.trim()}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    ประมวลผลข้อมูลที่วาง
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 4. PREVIEW & VALIDATION TABLE */}
            {/* ========================================================================= */}
            {parsedRows.length > 0 && (
              <div className="space-y-4 pt-2">
                {/* Summary Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      ข้อมูลในไฟล์ทั้งหมด
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-black text-slate-800">
                        {summaryMetrics.total}
                      </span>
                      <span className="text-xs text-slate-400">รายการ</span>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl shadow-2xs">
                    <span className="text-[11px] font-bold text-emerald-700 block">
                      พร้อมนำเข้าถูกต้อง
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-black text-emerald-700">
                        {summaryMetrics.valid}
                      </span>
                      <span className="text-xs text-emerald-600">รายการ</span>
                    </div>
                  </div>

                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl shadow-2xs">
                    <span className="text-[11px] font-bold text-indigo-700 block">
                      นักเรียนที่ได้รับผล
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-black text-indigo-700">
                        {summaryMetrics.uniqueStudentsCount}
                      </span>
                      <span className="text-xs text-indigo-600">คน</span>
                    </div>
                  </div>

                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-2xl shadow-2xs">
                    <span className="text-[11px] font-bold text-rose-700 block">
                      หักคะแนนรวมทั้งหมด
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-black text-rose-700">
                        -{summaryMetrics.totalPointsDeducted}
                      </span>
                      <span className="text-xs text-rose-600">คะแนน</span>
                    </div>
                  </div>
                </div>

                {/* Filter and Table Tools */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setFilterStatus('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        filterStatus === 'ALL'
                          ? 'bg-slate-800 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      ทั้งหมด ({summaryMetrics.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('VALID')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        filterStatus === 'VALID'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      พร้อมนำเข้า ({summaryMetrics.valid})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('ISSUES')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        filterStatus === 'ISSUES'
                          ? 'bg-rose-600 text-white'
                          : 'bg-white text-rose-700 hover:bg-rose-100 border border-rose-200'
                      }`}
                    >
                      มีปัญหา / ไม่พบรหัส ({summaryMetrics.issues})
                    </button>
                  </div>

                  {/* Search box */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="ค้นหารหัส, ชื่อ หรือเรื่อง..."
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase">
                          <th className="py-2.5 px-3 w-12 text-center">#</th>
                          <th className="py-2.5 px-3">รหัสนักเรียน</th>
                          <th className="py-2.5 px-3">นักเรียนในระบบ</th>
                          <th className="py-2.5 px-3">กระทำผิดเรื่อง</th>
                          <th className="py-2.5 px-3">ผิดระเบียบข้อ</th>
                          <th className="py-2.5 px-3">วันที่เกิดเหตุ</th>
                          <th className="py-2.5 px-3 text-center">หักคะแนน</th>
                          <th className="py-2.5 px-3 text-center">ผลต่อคะแนน</th>
                          <th className="py-2.5 px-3 text-center">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedRows.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-slate-400">
                              ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                            </td>
                          </tr>
                        ) : (
                          paginatedRows.map(row => {
                            const student = row.matchedStudent;
                            const gradeInfo = student
                              ? calculateStudentGrade(
                                  student.entryYear,
                                  student.entryLevel,
                                  targetAcademicYear
                                )
                              : null;

                            return (
                              <tr
                                key={row.rowIndex}
                                className={`hover:bg-slate-50/80 transition-colors ${
                                  row.status !== 'VALID' ? 'bg-rose-50/40' : ''
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                                  {row.rowIndex}
                                </td>

                                {/* Student ID */}
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                  {row.rawStudentId || <span className="text-rose-500">-</span>}
                                </td>

                                {/* Matched Student Info */}
                                <td className="py-2.5 px-3">
                                  {student ? (
                                    <div className="flex items-center gap-2">
                                      <StudentAvatar
                                        student={student}
                                        currentAcademicYear={targetAcademicYear}
                                        size="xs"
                                      />
                                      <div className="min-w-0">
                                        <div className="font-bold text-slate-900 truncate">
                                          {student.title}{student.firstName} {student.lastName}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono">
                                          {gradeInfo ? `${gradeInfo.grade}/${student.room}` : `ห้อง ${student.room}`}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-rose-600 font-medium text-[11px] flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                      <span>ไม่พบในฐานข้อมูล</span>
                                    </div>
                                  )}
                                </td>

                                {/* Reason */}
                                <td className="py-2.5 px-3 max-w-[200px]">
                                  <div className="font-medium text-slate-800 truncate" title={row.reason}>
                                    {row.reason}
                                  </div>
                                  {row.notes && (
                                    <div className="text-[10px] text-slate-400 truncate" title={row.notes}>
                                      หมายเหตุ: {row.notes}
                                    </div>
                                  )}
                                </td>

                                {/* Rule Category */}
                                <td className="py-2.5 px-3 text-slate-600 max-w-[150px] truncate" title={row.ruleCategory}>
                                  {row.ruleCategory}
                                </td>

                                {/* Violation Date */}
                                <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                                  {formatThaiDate(row.violationDate, 'short')}
                                </td>

                                {/* Points */}
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-600 whitespace-nowrap">
                                  -{row.pointsToDeduct}
                                </td>

                                {/* Projected Score Change */}
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  {student ? (
                                    <div className="flex items-center justify-center gap-1 font-mono text-[11px]">
                                      <span className="text-slate-500">{row.scoreBefore}</span>
                                      <ArrowRight className="w-3 h-3 text-slate-400" />
                                      <span className={`font-bold ${
                                        row.scoreAfter <= 50 ? 'text-rose-600 font-black' : 'text-slate-900'
                                      }`}>
                                        {row.scoreAfter}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 font-mono">-</span>
                                  )}
                                </td>

                                {/* Status */}
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  {row.status === 'VALID' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3" />
                                      พร้อมนำเข้า
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
                                      title={row.errorMessage}
                                    >
                                      <AlertCircle className="w-3 h-3" />
                                      {row.status === 'STUDENT_NOT_FOUND' ? 'ไม่พบรหัส' : 'ข้อมูลผิดพลาด'}
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

                  {/* Pagination */}
                  {filteredRows.length > pageSize && (
                    <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                      <Pagination
                        currentPage={currentPage}
                        totalCount={filteredRows.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  )}
                </div>

                {/* Bottom Options before commit */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={skipUnmatched}
                      onChange={e => setSkipUnmatched(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                    />
                    <span>ข้ามแถวที่ไม่พบรหัสนักเรียนโดยอัตโนมัติ (ไม่นำเข้าแถวที่มีข้อผิดพลาด)</span>
                  </label>

                  <div className="flex items-center gap-2 self-stretch sm:self-auto">
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      ยกเลิก / เริ่มใหม่
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={isSubmitting || summaryMetrics.valid === 0}
                      className="flex-1 sm:flex-none px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{submitStatusText || 'กำลังนำเข้าข้อมูล...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>ยืนยันนำเข้าข้อมูล ({summaryMetrics.valid} รายการ)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Progress bar during submission */}
                {isSubmitting && (
                  <div className="space-y-1.5 p-3 bg-rose-50 border border-rose-200 rounded-2xl">
                    <div className="flex justify-between text-xs font-bold text-rose-900">
                      <span>{submitStatusText}</span>
                      <span>{submitProgress}%</span>
                    </div>
                    <div className="w-full bg-rose-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${submitProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
