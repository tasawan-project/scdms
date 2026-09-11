import React, { useState, useMemo, useEffect } from 'react';
import { Student, SystemSettings } from '../types';
import { calculateStudentGrade, getScoreCategory } from '../utils/conductLogic';
import { StudentAvatar } from './StudentAvatar';
import { Pagination } from './Pagination';
import {
  Award,
  Crown,
  X,
  ShieldCheck,
  Download,
  Layers,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface HonourRollModalProps {
  students: Student[];
  currentAcademicYear: number;
  isPage?: boolean;
  systemSettings?: SystemSettings;
  onClose: () => void;
  onSelectStudent: (studentId: string) => void;
}

export const HonourRollModal: React.FC<HonourRollModalProps> = ({
  students,
  currentAcademicYear,
  isPage = false,
  systemSettings,
  onClose,
  onSelectStudent
}) => {
  const [activeLevelTab, setActiveLevelTab] = useState<'ALL' | 'JUNIOR' | 'SENIOR'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'EXCELLENT' | 'OUTSTANDING'>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeLevelTab, categoryFilter, pageSize]);

  // Filter students who have score > 100
  const honourStudents = useMemo(() => {
    return students
      .filter(s => s.status !== 'GRADUATED')
      .map(s => {
        const cat = getScoreCategory(s, systemSettings);
        const gradeInfo = calculateStudentGrade(s.entryYear, s.entryLevel, currentAcademicYear);
        return { student: s, category: cat, gradeInfo };
      })
      .filter(item => item.category.type === 'EXCELLENT' || item.category.type === 'OUTSTANDING');
  }, [students, currentAcademicYear, systemSettings]);

  // Group by level and category
  const filteredHonourList = useMemo(() => {
    return honourStudents.filter(item => {
      if (activeLevelTab !== 'ALL' && item.gradeInfo.level !== activeLevelTab) {
        return false;
      }
      if (categoryFilter !== 'ALL' && item.category.type !== categoryFilter) {
        return false;
      }
      return true;
    }).sort((a, b) => {
      // Sort Excellent first, then by banked points descending
      if (a.category.type !== b.category.type) {
        return a.category.type === 'EXCELLENT' ? -1 : 1;
      }
      return (b.student.bankedPoints ?? 0) - (a.student.bankedPoints ?? 0) || a.student.id.localeCompare(b.student.id);
    });
  }, [honourStudents, activeLevelTab, categoryFilter]);

  const excellentCount = useMemo(() => honourStudents.filter(i => i.category.type === 'EXCELLENT').length, [honourStudents]);
  const outstandingCount = useMemo(() => honourStudents.filter(i => i.category.type === 'OUTSTANDING').length, [honourStudents]);

  // Paginated subset
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHonourList.slice(start, start + pageSize);
  }, [filteredHonourList, currentPage, pageSize]);

  const exportToExcel = () => {
    const data = filteredHonourList.map((item, idx) => {
      const { student: s, category: cat, gradeInfo: g } = item;
      return {
        'ลำดับ': idx + 1,
        'เกียรติยศ': cat.label,
        'รหัสนักเรียน': s.id,
        'ชื่อ-นามสกุล': `${s.title}${s.firstName} ${s.lastName}`,
        'ระดับ': g.level === 'JUNIOR' ? 'มัธยมตอนต้น' : 'มัธยมตอนปลาย',
        'ชั้น/ห้อง': `${g.grade}/${s.room}`,
        'ปีที่เข้าศึกษา': s.entryYear,
        'คะแนนความประพฤติ': s.currentScore,
        'คะแนนสะสมความดีสำรอง': s.bankedPoints || 0,
        'ประวัติการโดนหัก': s.totalDeductionsCount ? `เคยโดนหัก ${s.totalDeductionsCount} ครั้ง` : 'ไม่เคยโดนหัก'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ทำเนียบเกียรติยศ');
    XLSX.writeFile(workbook, `ทำเนียบนักเรียนคะแนนยอดเยี่ยมและดีเด่น_ปี${currentAcademicYear}.xlsx`);
  };

  const renderStudentCards = (items: typeof filteredHonourList) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
          <p className="text-xs text-slate-400">ยังไม่มีรายชื่อนักเรียนในกลุ่มนี้</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(({ student, category, gradeInfo }) => {
          const isExcellent = category.type === 'EXCELLENT';
          return (
            <div
              key={student.id}
              onClick={() => onSelectStudent(student.id)}
              className={`p-4 sm:p-5 rounded-3xl border transition-all flex items-center gap-3.5 cursor-pointer group ${
                isExcellent
                  ? 'bg-purple-50/50 border-purple-200 hover:border-purple-400 hover:bg-purple-50/80 shadow-2xs hover:shadow-md'
                  : 'bg-blue-50/50 border-blue-200 hover:border-blue-400 hover:bg-blue-50/80 shadow-2xs hover:shadow-md'
              }`}
            >
              <StudentAvatar
                student={student}
                currentAcademicYear={currentAcademicYear}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {student.id}
                  </span>
                  <span className="font-bold text-xs text-indigo-700">
                    {gradeInfo.grade}/{student.room}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs ${
                      isExcellent
                        ? 'bg-purple-600 text-white'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {isExcellent ? (
                      <>
                        <Crown className="w-3 h-3" />
                        <span>ยอดเยี่ยม</span>
                      </>
                    ) : (
                      <>
                        <Award className="w-3 h-3" />
                        <span>ดีเด่น</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="font-bold text-slate-900 text-sm truncate mt-1 group-hover:text-indigo-600 transition-colors">
                  {student.title}{student.firstName} {student.lastName}
                </div>

                <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>100 แต้ม</span>
                  {(student.bankedPoints ?? 0) > 0 && (
                    <span
                      className={`font-bold ${
                        isExcellent ? 'text-purple-700' : 'text-blue-700'
                      }`}
                    >
                      (+{student.bankedPoints} สำรอง)
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 mt-0.5 truncate flex items-center gap-1">
                  {isExcellent ? (
                    <span className="text-purple-700 font-medium flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> ไม่เคยโดนหักคะแนน 3 ปี
                    </span>
                  ) : (
                    <span className="text-blue-700 font-medium">
                      สะสมความดี +{student.bankedPoints} แต้ม
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // If rendered as Full Page
  if (isPage) {
    return (
      <div className="space-y-6 w-full pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-purple-600" />
                  ทำเนียบเกียรติยศนักเรียน
                </span>
                <span className="text-xs text-slate-500 font-medium">ปีการศึกษา {currentAcademicYear}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                ทำเนียบลำดับนักเรียนคะแนนความประพฤติยอดเยี่ยมและดีเด่น (100+)
              </h1>
            </div>
          </div>

          <button
            onClick={exportToExcel}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก Excel ({filteredHonourList.length} คน)</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white p-3 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Level Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setActiveLevelTab('ALL')}
              className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeLevelTab === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทุกระดับ ({honourStudents.length})
            </button>
            <button
              onClick={() => setActiveLevelTab('JUNIOR')}
              className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeLevelTab === 'JUNIOR' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              มัธยมตอนต้น ({honourStudents.filter(i => i.gradeInfo.level === 'JUNIOR').length})
            </button>
            <button
              onClick={() => setActiveLevelTab('SENIOR')}
              className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeLevelTab === 'SENIOR' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              มัธยมตอนปลาย ({honourStudents.filter(i => i.gradeInfo.level === 'SENIOR').length})
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                categoryFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>ทั้งหมด ({honourStudents.length})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('EXCELLENT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                categoryFilter === 'EXCELLENT' ? 'bg-purple-600 text-white shadow-xs' : 'text-purple-700 hover:bg-purple-50'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>ยอดเยี่ยม ({excellentCount})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('OUTSTANDING')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                categoryFilter === 'OUTSTANDING' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>ดีเด่น ({outstandingCount})</span>
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <span>
                  {activeLevelTab === 'ALL'
                    ? 'นักเรียนคะแนนความประพฤติยอดเยี่ยมและดีเด่นทั้งหมด'
                    : activeLevelTab === 'JUNIOR'
                    ? 'มัธยมศึกษาตอนต้น (ม.1, ม.2, ม.3)'
                    : 'มัธยมศึกษาตอนปลาย (ม.4, ม.5, ม.6)'}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">
                  {filteredHonourList.length} คน
                </span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {categoryFilter === 'ALL'
                  ? 'แสดงทั้งกลุ่มยอดเยี่ยม (🟣 100+ ไม่เคยถูกหัก 3 ปี) และกลุ่มดีเด่น (🔵 100+ มีคะแนนสำรอง)'
                  : categoryFilter === 'EXCELLENT'
                  ? 'กลุ่มยอดเยี่ยม 🟣: คะแนนเกิน 100 คะแนน และไม่เคยมีประวัติถูกหักคะแนนเลยตลอด 3 ปี'
                  : 'กลุ่มดีเด่น 🔵: นักเรียนที่มีคะแนนเกิน 100 คะแนน (มีคะแนนสำรองความดีสะสม)'}
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-slate-100 text-slate-700">
              {activeLevelTab === 'ALL' ? 'ม.1 - ม.6' : activeLevelTab === 'JUNIOR' ? 'ม.ต้น' : 'ม.ปลาย'}
            </span>
          </div>

          {renderStudentCards(paginatedList)}

          {/* Pagination */}
          {filteredHonourList.length > 20 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredHonourList.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="คน"
              className="mt-6"
            />
          )}
        </div>
      </div>
    );
  }

  // Modal Fallback
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-400/20 text-purple-300 rounded-2xl backdrop-blur-xs">
              <Crown className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-purple-500 text-white font-bold rounded-lg text-xs tracking-wider flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  เกียรติบัตร & ทำเนียบเกียรติยศ
                </span>
                <span className="text-xs text-slate-300">ปีการศึกษา {currentAcademicYear}</span>
              </div>
              <h2 className="text-xl font-bold mt-1">
                ทำเนียบลำดับนักเรียนคะแนนความประพฤติยอดเยี่ยมและดีเด่น (100+)
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top filter tabs & Export actions */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-2xl flex-wrap">
            <button
              onClick={() => setActiveLevelTab('ALL')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeLevelTab === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({honourStudents.length})
            </button>
            <button
              onClick={() => setActiveLevelTab('JUNIOR')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeLevelTab === 'JUNIOR' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ม.ต้น ({honourStudents.filter(i => i.gradeInfo.level === 'JUNIOR').length})
            </button>
            <button
              onClick={() => setActiveLevelTab('SENIOR')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeLevelTab === 'SENIOR' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ม.ปลาย ({honourStudents.filter(i => i.gradeInfo.level === 'SENIOR').length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter(categoryFilter === 'EXCELLENT' ? 'ALL' : 'EXCELLENT')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                categoryFilter === 'EXCELLENT' ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>ยอดเยี่ยม ({excellentCount})</span>
            </button>
            <button
              onClick={() => setCategoryFilter(categoryFilter === 'OUTSTANDING' ? 'ALL' : 'OUTSTANDING')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                categoryFilter === 'OUTSTANDING' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>ดีเด่น ({outstandingCount})</span>
            </button>
            <button
              onClick={exportToExcel}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6">
          {renderStudentCards(paginatedList)}
        </div>

        {/* Footer with Pagination */}
        <div className="bg-slate-50 border-t border-slate-200">
          {filteredHonourList.length > 20 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredHonourList.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="คน"
              className="border-b border-slate-200"
            />
          )}
          <div className="p-4 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              พบ {filteredHonourList.length} คน (จากทั้งหมด {honourStudents.length} คนในทำเนียบ)
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
