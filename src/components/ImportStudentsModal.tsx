import React, { useState, useMemo, useEffect } from 'react';
import { Student, EntryLevel, LevelCode } from '../types';
import { calculateStudentGrade, resolveStudentLevelAndYear } from '../utils/conductLogic';
import * as XLSX from 'xlsx';
import { Pagination } from './Pagination';
import {
  X,
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  ClipboardPaste,
  HelpCircle,
  Users,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Sparkles,
  ShieldCheck,
  Tag,
  Layers,
  CalendarCheck
} from 'lucide-react';

interface ImportStudentsModalProps {
  currentAcademicYear: number;
  isPage?: boolean;
  onClose: () => void;
  onImportSuccess: (importedStudents: Student[]) => Promise<void>;
}

export const ImportStudentsModal: React.FC<ImportStudentsModalProps> = ({
  currentAcademicYear,
  isPage = false,
  onClose,
  onImportSuccess
}) => {
  const [importMode, setImportMode] = useState<'FILE' | 'PASTE'>('FILE');
  const [defaultEntryLevel, setDefaultEntryLevel] = useState<EntryLevel>('ม.1');
  const [pasteContent, setPasteContent] = useState('');
  const [parsedStudents, setParsedStudents] = useState<Student[]>([]);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Reset page when parsedStudents changes
  useEffect(() => {
    setCurrentPage(1);
  }, [parsedStudents.length, pageSize]);

  const paginatedParsedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return parsedStudents.slice(start, start + pageSize);
  }, [parsedStudents, currentPage, pageSize]);

  const toggleExpand = (idx: number) => {
    setExpandedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (expandedIndices.size === parsedStudents.length) {
      setExpandedIndices(new Set());
    } else {
      setExpandedIndices(new Set(parsedStudents.map((_, i) => i)));
    }
  };

  // Parse raw array of objects into structured Student items based on the 8 fields:
  // เลขที่, รหัสนักเรียน, คำนำหน้า, ชื่อ, สกุล, ระดับ (M/P/F), ปีที่เข้าศึกษา, ห้อง
  const processRawData = (rows: any[]) => {
    try {
      const results: Student[] = [];
      const nowIso = new Date().toISOString();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // 1. รหัสนักเรียน (Required)
        const id = String(row['รหัสนักเรียน'] || row['รหัสประจำตัว'] || row['studentId'] || row['id'] || row['รหัส'] || '').trim();
        if (!id) continue;

        // 2. เลขที่
        const rawNumber = String(row['เลขที่'] || row['number'] || row['no'] || row['ลำดับ'] || '').trim();
        const number = rawNumber ? parseInt(rawNumber) : undefined;

        // 3. คำนำหน้า
        let title = String(row['คำนำหน้า'] || row['title'] || '').trim();

        // 4. ชื่อ
        let firstName = String(row['ชื่อ'] || row['firstName'] || row['name'] || '').trim();

        // 5. สกุล
        let lastName = String(row['สกุล'] || row['นามสกุล'] || row['lastName'] || row['surname'] || '').trim();

        // If name came in combined column "ชื่อ-นามสกุล" or "ชื่อ" contains full name
        const combinedName = String(row['ชื่อ-นามสกุล'] || row['ชื่อ นามสกุล'] || row['fullName'] || '').trim();
        if (combinedName && (!firstName || !lastName)) {
          const parts = combinedName.split(/\s+/);
          if (parts[0].startsWith('เด็กชาย') || parts[0].startsWith('ด.ช.')) {
            title = 'เด็กชาย';
            firstName = parts[0].replace(/^(เด็กชาย|ด\.ช\.)/, '');
            lastName = parts.slice(1).join(' ');
          } else if (parts[0].startsWith('เด็กหญิง') || parts[0].startsWith('ด.ญ.')) {
            title = 'เด็กหญิง';
            firstName = parts[0].replace(/^(เด็กหญิง|ด\.ญ\.)/, '');
            lastName = parts.slice(1).join(' ');
          } else if (parts[0].startsWith('นาย')) {
            title = 'นาย';
            firstName = parts[0].replace(/^นาย/, '');
            lastName = parts.slice(1).join(' ');
          } else if (parts[0].startsWith('นางสาว') || parts[0].startsWith('น.ส.')) {
            title = 'นางสาว';
            firstName = parts[0].replace(/^(นางสาว|น\.ส\.)/, '');
            lastName = parts.slice(1).join(' ');
          } else {
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
          }
        }

        // 6. ระดับ (Level: M / P / F / ม.1 - ม.6)
        const rawLevel = String(
          row['ระดับ'] ||
          row['ระดับชั้น'] ||
          row['ระดับการศึกษา'] ||
          row['กลุ่มระดับ'] ||
          row['level'] ||
          row['Level'] ||
          row['LEVEL'] ||
          row['levelCode'] ||
          row['ระดับที่เข้า'] ||
          row['entryLevel'] ||
          ''
        ).trim();

        // 7. ปีที่เข้าศึกษา
        const rawEntryYear = row['ปีที่เข้าศึกษา'] || row['ปีเข้า'] || row['ปีการศึกษา'] || row['ปีการศึกษาที่เข้า'] || row['entryYear'] || '';

        // 8. ห้อง
        const rawRoom = String(row['ห้อง'] || row['room'] || row['ห้องเรียน'] || '1').trim();
        const roomMatch = rawRoom.match(/\d+/);
        const room = roomMatch ? parseInt(roomMatch[0]) : 1;

        // Process Level Code and Entry Year using centralized logic:
        // มัธยมศึกษาตอนต้น: ม.1 = M (2569), ม.2 = M (2568), ม.3 = M (2567)
        // มัธยมศึกษาตอนปลาย: ม.4 = P (2569), ม.5 = P (2568), ม.6 = P (2567)
        const resolved = resolveStudentLevelAndYear(
          rawLevel,
          rawEntryYear,
          currentAcademicYear,
          rawRoom,
          defaultEntryLevel
        );

        const levelCode: LevelCode = resolved.levelCode;
        const entryLevel: EntryLevel = resolved.entryLevel;
        const entryYear = resolved.entryYear;

        if (!title) {
          title = entryLevel === 'ม.1' ? 'เด็กชาย' : 'นาย';
        }

        const rawPhoto = String(
          row['ลิงก์รูปภาพ'] ||
          row['รูปภาพ'] ||
          row['photoUrl'] ||
          row['photo'] ||
          row['รูปถ่าย'] ||
          row['drivePhoto'] ||
          ''
        ).trim();

        results.push({
          id,
          number: !isNaN(Number(number)) ? number : undefined,
          title,
          firstName: firstName || 'นักเรียน',
          lastName: lastName || 'ใจดี',
          entryYear,
          entryLevel,
          levelCode,
          room,
          photoUrl: rawPhoto || undefined,
          currentScore: 100, // Standard base score = 100
          bankedPoints: 0,
          totalDeductionsCount: 0,
          totalDeductedPoints: 0,
          totalAddedPoints: 0,
          hasNeverBeenDeducted: true,
          status: 'ACTIVE',
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }

      if (results.length === 0) {
        setErrorMsg('ไม่พบข้อมูลนักเรียนที่ถูกต้อง กรุณาตรวจสอบหัวคอลัมน์และข้อมูลตามรูปแบบที่กำหนด');
      } else {
        setParsedStudents(results);
        setErrorMsg(null);
      }
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาดในการอ่านข้อมูล: ' + err.message);
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processRawData(data);
      } catch (err: any) {
        setErrorMsg('อ่านไฟล์ไม่สำเร็จ: ' + err.message);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Handle paste from clipboard (tab-separated or comma-separated)
  const handlePasteSubmit = () => {
    if (!pasteContent.trim()) {
      setErrorMsg('กรุณาวางข้อมูลก่อน');
      return;
    }

    try {
      const lines = pasteContent.trim().split('\n');
      if (lines.length < 1) {
        setErrorMsg('ไม่พบข้อมูลสำหรับประมวลผล');
        return;
      }

      // Check delimiter (Tab or Comma)
      const firstLine = lines[0];
      const delimiter = firstLine.includes('\t') ? '\t' : ',';

      const firstCols = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
      
      // Check if first row is a header row
      const isHeaderRow = firstCols.some(c => 
        ['เลขที่', 'รหัสนักเรียน', 'คำนำหน้า', 'ชื่อ', 'สกุล', 'นามสกุล', 'ระดับ', 'ระดับชั้น', 'level', 'ปีที่เข้าศึกษา', 'ห้อง'].includes(c)
      );

      const rows: any[] = [];

      if (isHeaderRow) {
        const headers = firstCols;
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
          const obj: any = {};
          headers.forEach((h, index) => {
            obj[h] = cols[index] || '';
          });
          rows.push(obj);
        }
      } else {
        // Assume positional matching:
        // Case 1 (8 columns): [0] เลขที่, [1] รหัสนักเรียน, [2] คำนำหน้า, [3] ชื่อ, [4] สกุล, [5] ระดับ, [6] ปีที่เข้าศึกษา, [7] ห้อง
        // Case 2 (7 columns): [0] เลขที่, [1] รหัสนักเรียน, [2] คำนำหน้า, [3] ชื่อ, [4] สกุล, [5] ปีที่เข้าศึกษา, [6] ห้อง
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
          
          if (cols.length >= 7) {
            const col5 = cols[5] || '';
            const isYearInCol5 = !isNaN(Number(col5)) && Number(col5) >= 2500;

            if (cols.length >= 8 || !isYearInCol5) {
              rows.push({
                'เลขที่': cols[0] || '',
                'รหัสนักเรียน': cols[1] || '',
                'คำนำหน้า': cols[2] || '',
                'ชื่อ': cols[3] || '',
                'สกุล': cols[4] || '',
                'ระดับ': cols[5] || '',
                'ปีที่เข้าศึกษา': cols[6] || '',
                'ห้อง': cols[7] || ''
              });
            } else {
              // 7 columns without ระดับ
              rows.push({
                'เลขที่': cols[0] || '',
                'รหัสนักเรียน': cols[1] || '',
                'คำนำหน้า': cols[2] || '',
                'ชื่อ': cols[3] || '',
                'สกุล': cols[4] || '',
                'ปีที่เข้าศึกษา': cols[5] || '',
                'ห้อง': cols[6] || ''
              });
            }
          } else if (cols.length >= 5) {
            rows.push({
              'เลขที่': cols[0] || '',
              'รหัสนักเรียน': cols[1] || '',
              'คำนำหน้า': cols[2] || '',
              'ชื่อ': cols[3] || '',
              'สกุล': cols[4] || ''
            });
          }
        }
      }

      processRawData(rows);
    } catch (err: any) {
      setErrorMsg('แปลงข้อมูลวางไม่สำเร็จ: ' + err.message);
    }
  };

  // Download sample excel template with 8 columns:
  // เลขที่, รหัสนักเรียน, คำนำหน้า, ชื่อ, สกุล, ระดับ (M/P), ปีที่เข้าศึกษา, ห้อง
  const downloadSampleTemplate = () => {
    const sampleData = [
      {
        'เลขที่': 1,
        'รหัสนักเรียน': '05501',
        'คำนำหน้า': 'เด็กชาย',
        'ชื่อ': 'กิตติภพ',
        'สกุล': 'รัตนวิชัย',
        'ระดับ': 'M',
        'ปีที่เข้าศึกษา': currentAcademicYear, // ม.1
        'ห้อง': 1
      },
      {
        'เลขที่': 2,
        'รหัสนักเรียน': '05502',
        'คำนำหน้า': 'เด็กหญิง',
        'ชื่อ': 'ชนัญชิดา',
        'สกุล': 'สุวรรณโชติ',
        'ระดับ': 'M',
        'ปีที่เข้าศึกษา': currentAcademicYear - 1, // ม.2
        'ห้อง': 1
      },
      {
        'เลขที่': 3,
        'รหัสนักเรียน': '05503',
        'คำนำหน้า': 'เด็กชาย',
        'ชื่อ': 'พัชรดนัย',
        'สกุล': 'เจริญพานิช',
        'ระดับ': 'M',
        'ปีที่เข้าศึกษา': currentAcademicYear - 2, // ม.3
        'ห้อง': 2
      },
      {
        'เลขที่': 1,
        'รหัสนักเรียน': '05504',
        'คำนำหน้า': 'นาย',
        'ชื่อ': 'ธีรภัทร',
        'สกุล': 'สถิตพงษ์',
        'ระดับ': 'P',
        'ปีที่เข้าศึกษา': currentAcademicYear, // ม.4
        'ห้อง': 1
      },
      {
        'เลขที่': 2,
        'รหัสนักเรียน': '05505',
        'คำนำหน้า': 'นางสาว',
        'ชื่อ': 'พิชญาภา',
        'สกุล': 'มงคลทรัพย์',
        'ระดับ': 'P',
        'ปีที่เข้าศึกษา': currentAcademicYear - 1, // ม.5
        'ห้อง': 1
      },
      {
        'เลขที่': 3,
        'รหัสนักเรียน': '05506',
        'คำนำหน้า': 'นาย',
        'ชื่อ': 'อัครเดช',
        'สกุล': 'สุขสมบูรณ์',
        'ระดับ': 'P',
        'ปีที่เข้าศึกษา': currentAcademicYear - 2, // ม.6
        'ห้อง': 2
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายชื่อนักเรียน');
    XLSX.writeFile(wb, 'ตัวอย่างไฟล์นำเข้านักเรียน.xlsx');
  };

  // Commit import
  const handleCommit = async () => {
    if (parsedStudents.length === 0) return;
    setIsProcessing(true);
    try {
      await onImportSuccess(parsedStudents);
      onClose();
    } catch (err: any) {
      setErrorMsg('บันทึกข้อมูลเข้าฐานข้อมูลไม่สำเร็จ: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const contentBody = (
    <div className="space-y-6">
      {/* Format Specification Banner */}
      <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-3">
        <div className="flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-xs text-indigo-950 flex-1">
            <div className="font-bold text-indigo-900 flex items-center justify-between flex-wrap gap-2">
              <span>รูปแบบโครงสร้างข้อมูล 8 คอลัมน์ที่รองรับ:</span>
              <span className="text-[11px] font-semibold text-indigo-600 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200 shadow-2xs">
                ปีการศึกษาปัจจุบัน: {currentAcademicYear}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 font-mono text-[11px] font-bold">
              <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-200 text-indigo-800">1. เลขที่</span>
              <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-200 text-indigo-800">2. รหัสนักเรียน</span>
              <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-200 text-indigo-800">3. คำนำหน้า</span>
              <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-200 text-indigo-800">4. ชื่อ</span>
              <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-200 text-indigo-800">5. สกุล</span>
              <span className="px-2 py-0.5 bg-indigo-600 rounded-md border border-indigo-700 text-white shadow-2xs">6. ระดับ (M / P)</span>
              <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-200 text-indigo-800">7. ปีที่เข้าศึกษา</span>
              <span className="px-2 py-0.5 bg-white rounded-md border border-indigo-200 text-indigo-800">8. ห้อง</span>
            </div>

            {/* Level Explanation Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 bg-blue-50/90 rounded-xl border border-blue-200 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-black text-xs">M</span>
                  <span className="font-bold text-blue-950 text-xs">ระดับมัธยมศึกษาตอนต้น</span>
                </div>
                <div className="text-[11px] text-blue-800 font-medium space-y-0.5 pt-0.5 pl-1">
                  <div>• <strong>ม.1</strong> = M, เข้าปี <strong>{currentAcademicYear}</strong></div>
                  <div>• <strong>ม.2</strong> = M, เข้าปี <strong>{currentAcademicYear - 1}</strong></div>
                  <div>• <strong>ม.3</strong> = M, เข้าปี <strong>{currentAcademicYear - 2}</strong></div>
                </div>
              </div>

              <div className="p-3 bg-purple-50/90 rounded-xl border border-purple-200 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-purple-600 text-white rounded-md font-mono font-black text-xs">P</span>
                  <span className="font-bold text-purple-950 text-xs">ระดับมัธยมศึกษาตอนปลาย</span>
                </div>
                <div className="text-[11px] text-purple-800 font-medium space-y-0.5 pt-0.5 pl-1">
                  <div>• <strong>ม.4</strong> = P, เข้าปี <strong>{currentAcademicYear}</strong></div>
                  <div>• <strong>ม.5</strong> = P, เข้าปี <strong>{currentAcademicYear - 1}</strong></div>
                  <div>• <strong>ม.6</strong> = P, เข้าปี <strong>{currentAcademicYear - 2}</strong></div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 pt-0.5">
              * ข้อมูลนักเรียนที่นำเข้าจะได้รับคะแนนความประพฤติตั้งต้น <strong>100 คะแนนเต็ม</strong> โดยอัตโนมัติ (หากระบุระดับชั้น เช่น 'ม.1'-'ม.3' หรือ 'ม.4'-'ม.6' ในไฟล์ ระบบจะคำนวณรหัสระดับ M หรือ P และปีที่เข้าศึกษาให้อัตโนมัติ)
            </div>
          </div>
        </div>
      </div>

      {/* Entry Level Setting & Download Template */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-4 h-4 text-slate-600 flex-shrink-0" />
          <div>
            <label className="block text-xs font-bold text-slate-800">
              ระดับชั้นตั้งต้นกรณีในไฟล์ไม่ระบุ (Fallback Entry Level):
            </label>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  setDefaultEntryLevel('ม.1');
                  if (parsedStudents.length > 0) {
                    setParsedStudents(prev => prev.map(s => ({ ...s, entryLevel: 'ม.1', levelCode: 'M' })));
                  }
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  defaultEntryLevel === 'ม.1'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                M - มัธยมศึกษาตอนต้น (ม.1)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDefaultEntryLevel('ม.4');
                  if (parsedStudents.length > 0) {
                    setParsedStudents(prev => prev.map(s => ({ ...s, entryLevel: 'ม.4', levelCode: 'P' })));
                  }
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  defaultEntryLevel === 'ม.4'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                P - มัธยมศึกษาตอนปลาย (ม.4)
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={downloadSampleTemplate}
          className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap self-stretch sm:self-auto justify-center"
        >
          <Download className="w-3.5 h-3.5 text-indigo-600" />
          <span>ดาวน์โหลดไฟล์ตัวอย่าง 8 คอลัมน์ (.xlsx)</span>
        </button>
      </div>

      {/* Mode Switch */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => {
            setImportMode('FILE');
            setErrorMsg(null);
          }}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            importMode === 'FILE' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1.5" />
          อัปโหลดไฟล์ Excel / CSV
        </button>
        <button
          type="button"
          onClick={() => {
            setImportMode('PASTE');
            setErrorMsg(null);
          }}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            importMode === 'PASTE' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardPaste className="w-3.5 h-3.5 inline mr-1.5" />
          วางตารางข้อความ (Paste)
        </button>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Mode 1: File Upload */}
      {importMode === 'FILE' && (
        <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/60 rounded-3xl p-10 text-center transition-colors">
          <input
            type="file"
            id="file-upload-input"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label
            htmlFor="file-upload-input"
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            <div className="p-4 bg-indigo-100 text-indigo-600 rounded-3xl mb-3 shadow-xs">
              <FileSpreadsheet className="w-10 h-10" />
            </div>
            <span className="font-bold text-slate-800 text-base sm:text-lg">
              คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
            </span>
            <span className="text-xs text-slate-500 mt-1 max-w-lg">
              รองรับไฟล์ Excel (.xlsx, .xls) หรือ CSV (คอลัมน์: เลขที่, รหัสนักเรียน, คำนำหน้า, ชื่อ, สกุล, <strong>ระดับ (M/P)</strong>, ปีที่เข้าศึกษา, ห้อง)
            </span>
          </label>
        </div>
      )}

      {/* Mode 2: Paste from Clipboard */}
      {importMode === 'PASTE' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-600 font-medium">
            คัดลอกจาก Excel หรือ Google Sheets แล้ววางลงในกล่องด้านล่าง (ตามลำดับ: เลขที่, รหัสนักเรียน, คำนำหน้า, ชื่อ, สกุล, <strong>ระดับ (M/P)</strong>, ปีที่เข้าศึกษา, ห้อง):
          </div>
          <textarea
            rows={8}
            value={pasteContent}
            onChange={e => setPasteContent(e.target.value)}
            placeholder={`เลขที่\tรหัสนักเรียน\tคำนำหน้า\tชื่อ\tสกุล\tระดับ\tปีที่เข้าศึกษา\tห้อง
1\t05501\tเด็กชาย\tกิตติภพ\tรัตนวิชัย\tM\t${currentAcademicYear}\t1
2\t05502\tเด็กหญิง\tชนัญชิดา\tสุวรรณโชติ\tM\t${currentAcademicYear - 1}\t1
1\t05504\tนาย\tธีรภัทร\tสถิตพงษ์\tP\t${currentAcademicYear}\t1`}
            className="w-full p-4 font-mono text-xs bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
          <button
            type="button"
            onClick={handlePasteSubmit}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            ประมวลผลข้อความที่วาง
          </button>
        </div>
      )}

      {/* Preview Table if Parsed */}
      {parsedStudents.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              พร้อมนำเข้า {parsedStudents.length} รายการ (คะแนนตั้งต้น 100 คะแนนเต็ม)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAll}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                title={expandedIndices.size === parsedStudents.length ? 'ยุบแถวทั้งหมด' : 'ขยายแถวทั้งหมด'}
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
                <span>{expandedIndices.size === parsedStudents.length ? 'ยุบทั้งหมด' : 'ขยายทั้งหมด'}</span>
              </button>
              <button
                type="button"
                onClick={() => setParsedStudents([])}
                className="text-xs text-rose-600 hover:underline cursor-pointer font-bold px-2 py-1"
              >
                ล้างข้อมูลที่อ่าน
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200 text-xs shadow-2xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold z-10">
                <tr>
                  <th className="p-2.5 w-9 text-center">#</th>
                  <th className="p-2.5 text-center">เลขที่</th>
                  <th className="p-2.5">รหัสนักเรียน</th>
                  <th className="p-2.5">คำนำหน้า</th>
                  <th className="p-2.5">ชื่อ - สกุล</th>
                  <th className="p-2.5 text-center">ระดับ (M/P)</th>
                  <th className="p-2.5 text-center">ชั้นประมวลผล</th>
                  <th className="p-2.5 text-center">ปีที่เข้า</th>
                  <th className="p-2.5 text-center">ห้อง</th>
                  <th className="p-2.5 text-right">คะแนนตั้งต้น</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedParsedStudents.map((s, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx;
                  const isExpanded = expandedIndices.has(globalIdx);
                  const isJunior = s.levelCode === 'M' || s.entryLevel === 'ม.1';
                  const gradeCalc = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);

                  return (
                    <React.Fragment key={s.id || globalIdx}>
                      <tr
                        onClick={() => toggleExpand(globalIdx)}
                        className={`hover:bg-indigo-50/40 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(globalIdx);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-200/70 text-slate-500 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="p-2.5 font-mono font-bold text-center text-slate-700">{s.number ?? '-'}</td>
                        <td className="p-2.5 font-mono font-bold text-indigo-900">{s.id}</td>
                        <td className="p-2.5 text-slate-600">{s.title}</td>
                        <td className="p-2.5 font-medium text-slate-900">{s.firstName} {s.lastName}</td>
                        <td className="p-2.5 text-center">
                          {isJunior ? (
                            <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1 shadow-2xs">
                              <span className="font-mono font-black">M</span> (ม.ต้น)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1 shadow-2xs">
                              <span className="font-mono font-black">P</span> (ม.ปลาย)
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            isJunior ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'
                          }`}>
                            {gradeCalc.grade}/{s.room}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600">{s.entryYear}</td>
                        <td className="p-2.5 text-center font-bold text-slate-800">{s.room}</td>
                        <td className="p-2.5 font-mono font-bold text-emerald-600 text-right">100</td>
                      </tr>

                      {/* Accordion Detail Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          <td colSpan={10} className="p-3 sm:p-4">
                            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                    {s.number ? `#${s.number}` : 'N/A'}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900">
                                      {s.title}{s.firstName} {s.lastName}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-mono">
                                      รหัสประจำตัว: {s.id} | ห้อง: {s.room}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] rounded-lg flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    คะแนนประพฤติตั้งต้น: 100 แต้ม
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                                <div className="p-2.5 bg-slate-50 rounded-xl space-y-0.5">
                                  <span className="text-slate-400 font-bold text-[10px] uppercase">รหัสระดับ (Level)</span>
                                  <p className="font-bold">
                                    {isJunior ? (
                                      <span className="text-blue-700 font-mono">M (มัธยมศึกษาตอนต้น)</span>
                                    ) : (
                                      <span className="text-purple-700 font-mono">P (มัธยมศึกษาตอนปลาย)</span>
                                    )}
                                  </p>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded-xl space-y-0.5">
                                  <span className="text-slate-400 font-bold text-[10px] uppercase">ชั้นปัจจุบันที่คำนวณ</span>
                                  <p className="font-bold text-indigo-700">{gradeCalc.grade}/{s.room}</p>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded-xl space-y-0.5">
                                  <span className="text-slate-400 font-bold text-[10px] uppercase">ปีการศึกษาที่เข้า</span>
                                  <p className="font-mono font-bold text-slate-800">{s.entryYear}</p>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded-xl space-y-0.5">
                                  <span className="text-slate-400 font-bold text-[10px] uppercase">ระดับชั้นที่เข้าศึกษา</span>
                                  <p className="font-bold text-slate-800">{s.entryLevel}</p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination when parsed students > 20 */}
          {parsedStudents.length > 20 && (
            <Pagination
              currentPage={currentPage}
              totalItems={parsedStudents.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="คน"
              className="pt-2"
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={handleCommit}
          disabled={parsedStudents.length === 0 || isProcessing}
          className={`px-6 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
            parsedStudents.length === 0 || isProcessing
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {isProcessing ? (
            <span>กำลังบันทึกลงฐานข้อมูล...</span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>ยืนยันนำเข้า {parsedStudents.length} คน</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  if (isPage) {
    return (
      <div className="w-full space-y-6 pb-12">
        {/* Header Breadcrumb Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  นำเข้ารายชื่อนักเรียน
                </span>
                <span className="text-xs text-slate-500 font-medium">ปีการศึกษา {currentAcademicYear}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                นำเข้านักเรียน CSV / Excel
              </h1>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
          {contentBody}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">นำเข้ารายชื่อนักเรียน (CSV / Excel)</h2>
              <p className="text-xs text-slate-500">
                เพิ่มข้อมูลนักเรียนใหม่แบบกลุ่ม พร้อมระบบจัดระดับ ม.ต้น (M) และ ม.ปลาย (P) อัตโนมัติ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1">{contentBody}</div>
      </div>
    </div>
  );
};
