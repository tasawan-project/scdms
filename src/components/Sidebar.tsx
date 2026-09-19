import React, { useState } from 'react';
import { AppUser, StudentAccessGrant, SystemSettings, AppView, Student } from '../types';
import { canUserAccessMenu, isSuperAdmin } from '../utils/menuPermissions';
import {
  LayoutDashboard,
  Search,
  UserCheck,
  Award,
  Users,
  Upload,
  Camera,
  RefreshCw,
  School,
  ListChecks,
  Shield,
  Database,
  History,
  ChevronDown,
  ChevronRight,
  LogOut,
  AlertOctagon,
  X,
  GraduationCap,
  Key,
  ShieldCheck,
  FileSpreadsheet,
  Settings,
  Printer,
  User,
  CheckCircle2,
  PlusCircle,
  MinusCircle,
  ClipboardCheck,
  Activity
} from 'lucide-react';

interface SidebarProps {
  currentUser: AppUser | null;
  studentGrant: StudentAccessGrant | null;
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  systemSettings: SystemSettings;
  studentsCount: number;
  standardBehaviorsCount: number;
  accessGrantsCount: number;
  criticalCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  onOpenChangePassword?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  studentGrant,
  currentView,
  onChangeView,
  systemSettings,
  studentsCount,
  standardBehaviorsCount,
  accessGrantsCount,
  criticalCount,
  mobileOpen,
  onCloseMobile,
  onLogout,
  onOpenChangePassword
}) => {
  // Collapsible sub-menus: default to open as per standard admin dashboards
  const [reportsOpen, setReportsOpen] = useState<boolean>(true);
  const [studentMgmtOpen, setStudentMgmtOpen] = useState<boolean>(true);
  const [settingsMgmtOpen, setSettingsMgmtOpen] = useState<boolean>(true);

  const schoolNameDisplay =
    systemSettings?.schoolNameTh || systemSettings?.schoolName || 'โรงเรียนจุฬาภรณราชวิทยาลัย ชลบุรี';
  const appNameDisplay = systemSettings?.appNameTh || 'ระบบคะแนนความประพฤติ';
  const currentAcademicYear = systemSettings?.currentAcademicYear || 2567;
  const currentTerm = systemSettings?.currentTerm || 1;

  const isStudent = !currentUser && !!studentGrant;
  const userRole = currentUser?.role || (isStudent ? 'student' : 'guest');
  const isAdmin = currentUser?.role === 'admin';

  // Helper to check dynamic menu permission
  const canAccess = (view: AppView) =>
    canUserAccessMenu(view, currentUser, studentGrant, systemSettings?.menuPermissions);

  // Check if groups have any visible child items
  const hasStudentMgmtAccess =
    canAccess('STUDENT_LIST') ||
    canAccess('IMPORT') ||
    canAccess('IMPORT_CONDUCT') ||
    canAccess('PHOTOS') ||
    canAccess('YEAR_CYCLE');

  const hasSettingsMgmtAccess =
    canAccess('SETTINGS_BRANDING') ||
    canAccess('SETTINGS_BEHAVIORS') ||
    canAccess('SETTINGS_USERS') ||
    canAccess('SETTINGS_DATABASE') ||
    canAccess('SETTINGS_GRANTS') ||
    canAccess('SETTINGS_USAGE_STATS') ||
    canAccess('SETTINGS_MENU_PERMISSIONS');

  // Helper to handle navigation click (closes mobile drawer automatically)
  const handleNav = (view: AppView) => {
    onChangeView(view);
    onCloseMobile();
  };

  // Determine if a student sub-view is active
  const isStudentSubActive = (v: AppView) => currentView === v;

  // Determine if a settings sub-view is active
  const isSettingsSubActive = (v: AppView) => currentView === v;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 select-none">
      {/* 1. BRANDING & SCHOOL HEADER */}
      <div className="p-4 border-b border-slate-100 bg-white">
        <div className="flex items-center justify-between gap-2">
          <div
            onClick={() => handleNav(userRole !== 'student' ? 'DASHBOARD' : 'LOOKUP')}
            className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
          >
            {systemSettings?.logoUrl ? (
              <img
                src={systemSettings.logoUrl}
                alt="School Logo"
                className="w-10 h-10 object-contain rounded-xl border border-slate-200 p-0.5 bg-white shadow-2xs group-hover:scale-105 transition-transform shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl flex items-center justify-center text-white shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                <School className="w-5 h-5" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <h1 className="font-black text-sm text-slate-900 tracking-tight truncate group-hover:text-indigo-600 transition-colors">
                {appNameDisplay}
              </h1>
              <span className="text-[11px] text-slate-500 font-medium truncate">
                {schoolNameDisplay}
              </span>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            aria-label="ปิดเมนู"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Academic Year Badge */}
        <div className="mt-3 flex items-center justify-between px-2.5 py-1.5 bg-indigo-50/70 border border-indigo-100/80 rounded-xl text-xs">
          <span className="text-indigo-900 font-bold text-[11px]">
            ปีการศึกษา {currentAcademicYear}
          </span>
          <span className="bg-indigo-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-2xs">
            ภาคเรียนที่ {currentTerm}
          </span>
        </div>
      </div>

      {/* 2. NAVIGATION MENU LIST */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 text-sm" aria-label="เมนูหลักด้านซ้าย">
        {/* Item 0: หน้าแรก (Home Portal) */}
        {canAccess('HOME') && (
          <button
            type="button"
            onClick={() => handleNav('HOME')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-left ${
              currentView === 'HOME'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <School className="w-4 h-4 shrink-0" />
              <span>หน้าแรก</span>
            </div>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                currentView === 'HOME' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              พอร์ทัล
            </span>
          </button>
        )}

        {/* Item 1: ภาพรวมคะแนน */}
        {canAccess('DASHBOARD') && (
          <button
            type="button"
            onClick={() => handleNav('DASHBOARD')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-left ${
              currentView === 'DASHBOARD'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>ภาพรวมคะแนน</span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                currentView === 'DASHBOARD' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              สถิติ
            </span>
          </button>
        )}

        {/* Item: ตรวจสอบคะแนน */}
        {canAccess('CHECK_SCORE') && (
          <button
            type="button"
            id="sidebar-nav-check-score"
            onClick={() => handleNav('CHECK_SCORE')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-left ${
              currentView === 'CHECK_SCORE'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              <span>ตรวจสอบคะแนน</span>
            </div>
            {systemSettings?.allowAllStudentsScoreCheck ? (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  currentView === 'CHECK_SCORE' ? 'bg-indigo-700 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                เปิดตรวจ
              </span>
            ) : (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                  currentView === 'CHECK_SCORE' ? 'bg-indigo-700 text-slate-200' : 'bg-slate-100 text-slate-500'
                }`}
              >
                ตรวจสิทธิ์
              </span>
            )}
          </button>
        )}

        {/* Item 2: ค้นหานักเรียน */}
        {canAccess('LOOKUP') && (
          <button
            type="button"
            onClick={() => handleNav('LOOKUP')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-left ${
              currentView === 'LOOKUP'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 shrink-0" />
              <span>ค้นหานักเรียน</span>
            </div>
            {userRole === 'student' && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                ข้อมูลตนเอง
              </span>
            )}
          </button>
        )}

        {/* Item 3: ครูที่ปรึกษา */}
        {canAccess('ADVISORS') && (
          <button
            type="button"
            onClick={() => handleNav('ADVISORS')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-left ${
              currentView === 'ADVISORS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>ครูที่ปรึกษา</span>
            </div>
          </button>
        )}

        {/* Item 4: ทำเนียบ 100+ */}
        {canAccess('HONOUR') && (
          <button
            type="button"
            onClick={() => handleNav('HONOUR')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-left ${
              currentView === 'HONOUR'
                ? 'bg-violet-700 text-white shadow-sm'
                : 'text-violet-900 hover:bg-violet-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Award className={`w-4 h-4 shrink-0 ${currentView === 'HONOUR' ? 'text-amber-300' : 'text-amber-500'}`} />
              <span>ทำเนียบ 100+</span>
            </div>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                currentView === 'HONOUR' ? 'bg-violet-800 text-amber-300' : 'bg-amber-100 text-amber-800'
              }`}
            >
              100+
            </span>
          </button>
        )}

        {/* ========================================================================= */}
        {/* GROUP 0: รายงานคะแนนความประพฤติ (SUB-MENU) */}
        {/* ========================================================================= */}
        {canAccess('REPORTS') && (
          <div className="pt-1">
            {/* Header / Toggle Button */}
            <button
              type="button"
              id="sidebar-nav-reports-toggle"
              onClick={() => setReportsOpen(prev => !prev)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                currentView === 'REPORTS' ||
                currentView === 'REPORT_INDIVIDUAL' ||
                currentView === 'REPORT_GRADE_LEVEL' ||
                currentView === 'REPORT_FULL_100' ||
                currentView === 'REPORT_HONOUR_100' ||
                currentView === 'REPORT_POINTS_ADDED' ||
                currentView === 'REPORT_POINTS_DEDUCTED'
                  ? 'bg-indigo-50/90 text-indigo-950 border border-indigo-200/80 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Printer className={`w-4 h-4 shrink-0 ${
                  currentView.startsWith('REPORT') || currentView === 'REPORTS' ? 'text-indigo-600' : 'text-slate-500'
                }`} />
                <span className="font-bold text-xs normal-case">รายงานคะแนนความประพฤติ</span>
              </div>
              <div className="flex items-center gap-1.5">
                {reportsOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>
            </button>

            {/* Sub-items */}
            {reportsOpen && (
              <div className="pl-2 pr-1 space-y-1 mt-1.5 border-l-2 border-indigo-100 ml-3">
                {/* รายงานรายบุคคล */}
                <button
                  type="button"
                  id="sidebar-report-individual"
                  onClick={() => handleNav('REPORT_INDIVIDUAL')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                    currentView === 'REPORT_INDIVIDUAL' || currentView === 'REPORTS'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <User className={`w-3.5 h-3.5 shrink-0 ${
                      currentView === 'REPORT_INDIVIDUAL' || currentView === 'REPORTS' ? 'text-white' : 'text-indigo-500'
                    }`} />
                    <span className="truncate">รายงานรายบุคคล</span>
                  </div>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                    currentView === 'REPORT_INDIVIDUAL' || currentView === 'REPORTS' ? 'bg-indigo-700 text-white' : 'text-slate-400'
                  }`}>
                    ค้นหา
                  </span>
                </button>

                {/* รายงานแบบระดับชั้น */}
                <button
                  type="button"
                  id="sidebar-report-grade-level"
                  onClick={() => handleNav('REPORT_GRADE_LEVEL')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                    currentView === 'REPORT_GRADE_LEVEL'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Users className={`w-3.5 h-3.5 shrink-0 ${
                      currentView === 'REPORT_GRADE_LEVEL' ? 'text-white' : 'text-indigo-500'
                    }`} />
                    <span className="truncate">รายงานแบบระดับชั้น</span>
                  </div>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                    currentView === 'REPORT_GRADE_LEVEL' ? 'bg-indigo-700 text-white' : 'text-slate-400'
                  }`}>
                    ม.1-6
                  </span>
                </button>

                {/* นักเรียนครบ 100 คะแนน */}
                <button
                  type="button"
                  id="sidebar-report-full-100"
                  onClick={() => handleNav('REPORT_FULL_100')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                    currentView === 'REPORT_FULL_100'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${
                      currentView === 'REPORT_FULL_100' ? 'text-white' : 'text-emerald-500'
                    }`} />
                    <span className="truncate">นักเรียนครบ 100 คะแนน</span>
                  </div>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                    currentView === 'REPORT_FULL_100' ? 'bg-emerald-700 text-white' : 'text-emerald-600'
                  }`}>
                    100
                  </span>
                </button>

                {/* นักเรียนดีเด่น 100+ */}
                <button
                  type="button"
                  id="sidebar-report-honour-100"
                  onClick={() => handleNav('REPORT_HONOUR_100')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                    currentView === 'REPORT_HONOUR_100'
                      ? 'bg-violet-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Award className={`w-3.5 h-3.5 shrink-0 ${
                      currentView === 'REPORT_HONOUR_100' ? 'text-white' : 'text-amber-500'
                    }`} />
                    <span className="truncate">นักเรียนดีเด่น 100+</span>
                  </div>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                    currentView === 'REPORT_HONOUR_100' ? 'bg-violet-800 text-amber-300' : 'text-amber-600'
                  }`}>
                    100+
                  </span>
                </button>

                {/* รายงานการเพิ่มคะแนน */}
                <button
                  type="button"
                  id="sidebar-report-points-added"
                  onClick={() => handleNav('REPORT_POINTS_ADDED')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                    currentView === 'REPORT_POINTS_ADDED'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <PlusCircle className={`w-3.5 h-3.5 shrink-0 ${
                      currentView === 'REPORT_POINTS_ADDED' ? 'text-white' : 'text-teal-500'
                    }`} />
                    <span className="truncate">รายงานการเพิ่มคะแนน</span>
                  </div>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                    currentView === 'REPORT_POINTS_ADDED' ? 'bg-teal-700 text-white' : 'text-teal-600'
                  }`}>
                    +แต้ม
                  </span>
                </button>

                {/* รายงานการหักคะแนน */}
                <button
                  type="button"
                  id="sidebar-report-points-deducted"
                  onClick={() => handleNav('REPORT_POINTS_DEDUCTED')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                    currentView === 'REPORT_POINTS_DEDUCTED'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MinusCircle className={`w-3.5 h-3.5 shrink-0 ${
                      currentView === 'REPORT_POINTS_DEDUCTED' ? 'text-white' : 'text-rose-500'
                    }`} />
                    <span className="truncate">รายงานการหักคะแนน</span>
                  </div>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                    currentView === 'REPORT_POINTS_DEDUCTED' ? 'bg-rose-700 text-white' : 'text-rose-600'
                  }`}>
                    -แต้ม
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* GROUP 1: จัดการนักเรียน (SUB-MENU) */}
        {/* ========================================================================= */}
        {hasStudentMgmtAccess && (
          <div className="pt-2">
            {/* Header / Toggle Button */}
            <button
              type="button"
              onClick={() => setStudentMgmtOpen(prev => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-black text-slate-500 uppercase tracking-wider hover:text-slate-800 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>จัดการนักเรียน</span>
              </div>
              {studentMgmtOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {/* Sub-items */}
            {studentMgmtOpen && (
              <div className="pl-2 pr-1 space-y-1 mt-1 border-l-2 border-slate-100 ml-3">
                {/* 1.1 จัดการรายชื่อนักเรียน */}
                {canAccess('STUDENT_LIST') && (
                  <button
                    type="button"
                    onClick={() => handleNav('STUDENT_LIST')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                      isStudentSubActive('STUDENT_LIST')
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      <span className="truncate">จัดการรายชื่อนักเรียน</span>
                    </div>
                    {studentsCount > 0 && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 ${
                          isStudentSubActive('STUDENT_LIST')
                            ? 'bg-indigo-700 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {studentsCount}
                      </span>
                    )}
                  </button>
                )}

                {/* 1.2 นำเข้านักเรียน CSV */}
                {canAccess('IMPORT') && (
                  <button
                    type="button"
                    onClick={() => handleNav('IMPORT')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                      isStudentSubActive('IMPORT')
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">นำเข้านักเรียน CSV</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded shrink-0 ${
                        isStudentSubActive('IMPORT')
                          ? 'bg-indigo-700 text-white'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      CSV
                    </span>
                  </button>
                )}

                {/* 1.2.1 นำเข้าการกระทำผิด (Excel) */}
                {canAccess('IMPORT_CONDUCT') && (
                  <button
                    type="button"
                    onClick={() => handleNav('IMPORT_CONDUCT')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                      isStudentSubActive('IMPORT_CONDUCT')
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${
                        isStudentSubActive('IMPORT_CONDUCT') ? 'text-white' : 'text-rose-600'
                      }`} />
                      <span className="truncate">นำเข้าการกระทำผิด</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded shrink-0 ${
                        isStudentSubActive('IMPORT_CONDUCT')
                          ? 'bg-rose-700 text-white'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      XLSX
                    </span>
                  </button>
                )}

                {/* 1.3 นำเข้ารูปนักเรียน */}
                {canAccess('PHOTOS') && (
                  <button
                    type="button"
                    onClick={() => handleNav('PHOTOS')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                      isStudentSubActive('PHOTOS')
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Camera className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">นำเข้ารูปนักเรียน</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded shrink-0 ${
                        isStudentSubActive('PHOTOS')
                          ? 'bg-indigo-700 text-white'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      .JPG
                    </span>
                  </button>
                )}

                {/* 1.4 จัดการรอบ 3 ปี */}
                {canAccess('YEAR_CYCLE') && (
                  <button
                    type="button"
                    onClick={() => handleNav('YEAR_CYCLE')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                      isStudentSubActive('YEAR_CYCLE')
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">จัดการรอบ 3 ปี</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                        isStudentSubActive('YEAR_CYCLE')
                          ? 'bg-indigo-700 text-white'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      ม.3/ม.6
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* GROUP 2: ตั้งค่าระบบ (SUB-MENU) */}
        {/* ========================================================================= */}
        {hasSettingsMgmtAccess && (
          <div className="pt-2">
            {/* Header / Toggle Button */}
            <button
              type="button"
              onClick={() => setSettingsMgmtOpen(prev => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-black text-slate-500 uppercase tracking-wider hover:text-slate-800 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>ตั้งค่าระบบ</span>
              </div>
              {settingsMgmtOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {/* Sub-items */}
            {settingsMgmtOpen && (
              <div className="pl-2 pr-1 space-y-1 mt-1 border-l-2 border-slate-100 ml-3">
                {/* 2.1 ข้อมูลโรงเรียนและระบบ */}
                {canAccess('SETTINGS_BRANDING') && (
                  <button
                    type="button"
                    onClick={() => handleNav('SETTINGS_BRANDING')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                      isSettingsSubActive('SETTINGS_BRANDING') || currentView === 'SETTINGS'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <School className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">ข้อมูลโรงเรียนและระบบ</span>
                    </div>
                  </button>
                )}

                {/* 2.2 หัวข้อพฤติกรรมมาตราฐาน */}
                {canAccess('SETTINGS_BEHAVIORS') && (
                  <button
                    type="button"
                    onClick={() => handleNav('SETTINGS_BEHAVIORS')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                      isSettingsSubActive('SETTINGS_BEHAVIORS')
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <ListChecks className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">หัวข้อพฤติกรรมมาตราฐาน</span>
                    </div>
                    {standardBehaviorsCount > 0 && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 ${
                          isSettingsSubActive('SETTINGS_BEHAVIORS')
                            ? 'bg-indigo-700 text-white'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {standardBehaviorsCount}
                      </span>
                    )}
                  </button>
                )}

                {/* 2.3 จัดการผู้ใช้งานระบบ */}
                {canAccess('SETTINGS_USERS') && (
                  <button
                    type="button"
                    onClick={() => handleNav('SETTINGS_USERS')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                      isSettingsSubActive('SETTINGS_USERS')
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Shield className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">จัดการผู้ใช้งานระบบ</span>
                    </div>
                    {isAdmin && (
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded shrink-0 ${
                          isSettingsSubActive('SETTINGS_USERS')
                            ? 'bg-indigo-700 text-white'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        Admin
                      </span>
                    )}
                  </button>
                )}

                {/* 2.4 ฐานข้อมูล & สำรอง */}
                {canAccess('SETTINGS_DATABASE') && (
                  <button
                    type="button"
                    onClick={() => handleNav('SETTINGS_DATABASE')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                      isSettingsSubActive('SETTINGS_DATABASE')
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Database className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">ฐานข้อมูล & สำรอง</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                        isSettingsSubActive('SETTINGS_DATABASE')
                          ? 'bg-indigo-700 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      Cloud
                    </span>
                  </button>
                )}

                {/* 2.5 ประวัติสิทธิ์นักเรียน */}
                {canAccess('SETTINGS_GRANTS') && (
                  <button
                    type="button"
                    onClick={() => handleNav('SETTINGS_GRANTS')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                      isSettingsSubActive('SETTINGS_GRANTS')
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <History className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">ประวัติสิทธิ์นักเรียน</span>
                    </div>
                    {accessGrantsCount > 0 && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 ${
                          isSettingsSubActive('SETTINGS_GRANTS')
                            ? 'bg-indigo-700 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {accessGrantsCount}
                      </span>
                    )}
                  </button>
                )}

                {/* 2.6 สถิติการใช้งาน & จำลองโควต้า */}
                {canAccess('SETTINGS_USAGE_STATS') && (
                  <button
                    type="button"
                    onClick={() => handleNav('SETTINGS_USAGE_STATS')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                      isSettingsSubActive('SETTINGS_USAGE_STATS')
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Activity className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">สถิติการใช้งาน & โควต้า</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                        isSettingsSubActive('SETTINGS_USAGE_STATS')
                          ? 'bg-indigo-700 text-white'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      Quota Sim
                    </span>
                  </button>
                )}

                {/* 2.7 จัดการสิทธิ์เข้าถึงเมนู (เฉพาะผู้ดูแลหลักเท่านั้น) */}
                {canAccess('SETTINGS_MENU_PERMISSIONS') && (
                  <button
                    type="button"
                    onClick={() => handleNav('SETTINGS_MENU_PERMISSIONS')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left ${
                      isSettingsSubActive('SETTINGS_MENU_PERMISSIONS')
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'text-purple-900 bg-purple-50/70 hover:bg-purple-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="truncate">จัดการสิทธิ์เข้าถึงเมนู</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                        isSettingsSubActive('SETTINGS_MENU_PERMISSIONS')
                          ? 'bg-purple-900 text-white'
                          : 'bg-purple-200 text-purple-800'
                      }`}
                    >
                      👑 ผู้ดูแลหลัก
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* CRITICAL ALERT PILL (If any students <= 50) */}
        {criticalCount > 0 && canAccess('CRITICAL_ALERT') && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleNav('CRITICAL_ALERT')}
              className={`w-full p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                currentView === 'CRITICAL_ALERT'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100 animate-pulse'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600" />
                <span>กลุ่มวิกฤต (≤ 50 คะแนน)</span>
              </div>
              <span
                className={`text-xs font-black font-mono px-2 py-0.5 rounded-md ${
                  currentView === 'CRITICAL_ALERT' ? 'bg-rose-800 text-white' : 'bg-rose-200 text-rose-900'
                }`}
              >
                {criticalCount}
              </span>
            </button>
          </div>
        )}
      </nav>

      {/* 3. USER PROFILE & LOGOUT FOOTER */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                currentUser?.role === 'admin'
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : currentUser?.role === 'staff'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : currentUser?.role === 'teacher'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {currentUser ? currentUser.name.charAt(0) : <GraduationCap className="w-4 h-4" />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-slate-800 truncate">
                {currentUser ? currentUser.name : studentGrant ? studentGrant.studentName : 'ผู้เยี่ยมชม'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium truncate">
                {isSuperAdmin(currentUser)
                  ? '👑 ผู้ดูแลหลัก (Super Admin)'
                  : currentUser?.role === 'admin'
                  ? 'ผู้ดูแลระบบ (Admin)'
                  : currentUser?.role === 'staff'
                  ? 'ฝ่ายปกครอง (Staff)'
                  : currentUser?.role === 'teacher'
                  ? 'ครูผู้สอน (Teacher)'
                  : studentGrant
                  ? `นักเรียน (รหัส ${studentGrant.studentId})`
                  : 'ไม่ได้เข้าสู่ระบบ'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {currentUser && onOpenChangePassword && (
              <button
                type="button"
                onClick={onOpenChangePassword}
                title="เปลี่ยนรหัสผ่านของฉัน"
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                aria-label="เปลี่ยนรหัสผ่านของฉัน"
              >
                <Key className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              title="ออกจากระบบ"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              aria-label="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Left Sidebar */}
      <aside
        id="desktop-left-sidebar"
        className="hidden lg:block w-64 xl:w-72 h-screen sticky top-0 shrink-0 z-30 shadow-xs"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Modal slide-in from left) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer panel */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
