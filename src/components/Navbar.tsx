import React, { useState, useEffect } from 'react';
import { UserRole, SystemSettings, AppUser, StudentAccessGrant, AppView } from '../types';
import { canUserAccessMenu, isSuperAdmin } from '../utils/menuPermissions';
import {
  ShieldCheck,
  Award,
  Users,
  Search,
  Calendar,
  Folder,
  Upload,
  UserCheck,
  GraduationCap,
  Bell,
  AlertOctagon,
  Sparkles,
  Settings,
  LogOut,
  School,
  Lock,
  User,
  Menu,
  X,
  ChevronRight,
  Shield,
  HelpCircle,
  LogIn,
  Camera,
  Key
} from 'lucide-react';

interface NavbarProps {
  currentUser: AppUser | null;
  studentGrant: StudentAccessGrant | null;
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  systemSettings: SystemSettings;
  criticalCount: number;
  warningCount: number;
  onOpenHonourModal?: () => void;
  onOpenImportModal?: () => void;
  onOpenYearModal?: () => void;
  onOpenSettingsModal?: () => void;
  onLogout: () => void;
  onOpenLoginModal?: () => void;
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
  onOpenChangePassword?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  studentGrant,
  currentView,
  onChangeView,
  systemSettings,
  criticalCount,
  warningCount,
  onOpenHonourModal,
  onOpenImportModal,
  onOpenYearModal,
  onOpenSettingsModal,
  onLogout,
  onOpenLoginModal,
  onToggleMobileSidebar,
  isMobileSidebarOpen,
  onOpenChangePassword
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Close mobile drawer when view changes or on window resize
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentView]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const schoolNameDisplay = systemSettings?.schoolNameTh || systemSettings?.schoolName || 'โรงเรียนตัวอย่างวิทยา';
  const appNameDisplay = systemSettings?.appNameTh || 'ระบบบริหารจัดการคะแนนความประพฤตินักเรียน';
  const currentAcademicYear = systemSettings?.currentAcademicYear || 2567;
  const currentTerm = systemSettings?.currentTerm || 1;

  const isStudent = !currentUser && !!studentGrant;
  const isAuthenticated = !!currentUser || !!studentGrant;
  const userRole = currentUser?.role || (isStudent ? 'student' : 'guest');

  const getViewTitle = (view: AppView) => {
    switch (view) {
      case 'HOME': return 'หน้าแรก (พอร์ทัล)';
      case 'DASHBOARD': return 'ภาพรวมคะแนน';
      case 'STUDENT_LIST': return 'จัดการนักเรียน: จัดการรายชื่อนักเรียน';
      case 'LOOKUP': return 'ค้นหานักเรียน';
      case 'ADVISORS': return 'ครูที่ปรึกษา';
      case 'HONOUR': return 'ทำเนียบ 100+';
      case 'IMPORT': return 'จัดการนักเรียน: นำเข้านักเรียน CSV';
      case 'IMPORT_CONDUCT': return 'จัดการนักเรียน: นำเข้าการกระทำผิด (Excel)';
      case 'PHOTOS': return 'จัดการนักเรียน: นำเข้ารูปนักเรียน';
      case 'YEAR_CYCLE': return 'จัดการนักเรียน: จัดการรอบ 3 ปี';
      case 'SETTINGS_BRANDING':
      case 'SETTINGS': return 'ตั้งค่าระบบ: ข้อมูลโรงเรียนและระบบ';
      case 'SETTINGS_BEHAVIORS': return 'ตั้งค่าระบบ: หัวข้อพฤติกรรมมาตราฐาน';
      case 'SETTINGS_USERS': return 'ตั้งค่าระบบ: จัดการผู้ใช้งานระบบ';
      case 'SETTINGS_DATABASE': return 'ตั้งค่าระบบ: ฐานข้อมูล & สำรอง';
      case 'SETTINGS_GRANTS': return 'ตั้งค่าระบบ: ประวัติสิทธิ์นักเรียน';
      case 'SETTINGS_MENU_PERMISSIONS': return 'ตั้งค่าระบบ: จัดการสิทธิ์เข้าถึงเมนู';
      case 'CRITICAL_ALERT': return 'แจ้งเตือน: นักเรียนกลุ่มวิกฤต (≤ 50 คะแนน)';
      default: return 'ระบบคะแนนความประพฤติ';
    }
  };

  const canAccess = (view: AppView) =>
    canUserAccessMenu(view, currentUser, studentGrant, systemSettings?.menuPermissions);

  return (
    <>
      <header id="main-app-header" className={`${isAuthenticated ? 'lg:hidden' : ''} sticky top-0 z-40 bg-white/98 backdrop-blur-md border-b border-slate-200 shadow-xs transition-all`}>
        
        {/* ========================================================================= */}
        {/* ROW 1: PROGRAM TITLE, SCHOOL BRANDING & USER LOGIN PROFILE */}
        {/* ========================================================================= */}
        <div id="header-top-row" className="bg-white">
          <div className="w-full px-3 sm:px-6 py-2 sm:py-2.5">
            <div className="flex items-center justify-between gap-3 sm:gap-6">
              
              {/* 1.1 Left: App Title, Logo & School Info (or Breadcrumb on Desktop) */}
              <div
                id="header-brand"
                className="flex items-center gap-2.5 sm:gap-3.5 flex-1 min-w-0 cursor-pointer select-none group"
                onClick={() => {
                  if (userRole === 'admin' || userRole === 'staff' || userRole === 'teacher') onChangeView('DASHBOARD');
                  else if (userRole === 'student') onChangeView('LOOKUP');
                  else onChangeView('HOME');
                }}
              >
                {/* Logo visible on mobile/tablet; on desktop also acts as quick reset */}
                {systemSettings?.logoUrl ? (
                  <img
                    src={systemSettings.logoUrl}
                    alt="School Logo"
                    className="w-10 h-10 sm:w-11 sm:h-11 object-contain rounded-xl border border-slate-200 p-0.5 bg-white shadow-2xs group-hover:scale-105 transition-transform flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl flex items-center justify-center text-white shadow-2xs group-hover:scale-105 transition-transform flex-shrink-0">
                    <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                )}

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="font-black text-sm sm:text-base md:text-lg text-slate-900 tracking-tight truncate group-hover:text-indigo-600 transition-colors">
                      {appNameDisplay}
                    </h1>
                    {/* Active View Badge on Desktop */}
                    <span className="hidden xl:inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {getViewTitle(currentView)}
                    </span>
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-slate-700 truncate max-w-[150px] sm:max-w-[260px]">
                      {schoolNameDisplay}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="whitespace-nowrap text-slate-500 font-medium">
                      ปีการศึกษา {currentAcademicYear} ภาคเรียนที่ {currentTerm}
                    </span>
                  </div>
                </div>
              </div>

              {/* 1.2 Right: User Login Menu / Profile Card (Desktop Only) & Mobile Menu Toggle */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Desktop User Profile / Login Box (Hidden on Mobile & Tablet) */}
                <div className="hidden lg:flex items-center gap-2">
                  {isAuthenticated ? (
                    <div id="nav-user-profile-row" className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 p-1 sm:p-1.5 rounded-xl border border-slate-200 shadow-2xs transition-colors">
                      <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 flex items-center gap-2 text-xs">
                        {currentUser ? (
                          <>
                            <div
                              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                currentUser.role === 'admin'
                                  ? 'bg-purple-600 ring-2 ring-purple-200'
                                  : currentUser.role === 'staff'
                                  ? 'bg-blue-600 ring-2 ring-blue-200'
                                  : 'bg-emerald-600 ring-2 ring-emerald-200'
                              }`}
                            />
                            <div className="flex flex-col text-left">
                              <span className="font-bold text-slate-800 leading-tight truncate max-w-[90px] sm:max-w-[150px]">
                                {currentUser.name}
                              </span>
                              <span className="text-[10px] text-slate-500 leading-tight font-medium">
                                {isSuperAdmin(currentUser)
                                  ? '👑 ผู้ดูแลหลัก'
                                  : currentUser.role === 'admin'
                                  ? 'ผู้ดูแลระบบ (Admin)'
                                  : currentUser.role === 'staff'
                                  ? 'ฝ่ายปกครอง (Staff)'
                                  : 'ครูผู้สอน (Teacher)'}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <GraduationCap className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <div className="flex flex-col text-left">
                              <span className="font-bold text-slate-800 leading-tight truncate max-w-[90px] sm:max-w-[150px]">
                                {studentGrant ? studentGrant.studentName : 'นักเรียน'}
                              </span>
                              <span className="text-[10px] text-emerald-600 leading-tight font-semibold">
                                นักเรียน (ได้รับอนุญาต)
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {currentUser && onOpenChangePassword && (
                        <button
                          type="button"
                          onClick={onOpenChangePassword}
                          title="เปลี่ยนรหัสผ่านของฉัน"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                          aria-label="เปลี่ยนรหัสผ่านของฉัน"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        id="nav-btn-logout"
                        onClick={onLogout}
                        title="ออกจากระบบ"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                        aria-label="ออกจากระบบ"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onChangeView('HOME')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                          currentView === 'HOME'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <School className="w-4 h-4 text-indigo-600" />
                        <span>หน้าแรก</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onChangeView('LOOKUP')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                          currentView === 'LOOKUP'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <Search className="w-4 h-4 text-slate-500" />
                        <span>ค้นหาคะแนน</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onChangeView('HONOUR')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                          currentView === 'HONOUR'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <Award className="w-4 h-4 text-amber-500" />
                        <span>ทำเนียบ 100+</span>
                      </button>

                      <button
                        id="nav-btn-login"
                        onClick={onOpenLoginModal}
                        className="ml-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>เข้าสู่ระบบ</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile / Tablet Menu Button (Triggers Left Sidebar Drawer) */}
                <button
                  id="nav-mobile-toggle-btn"
                  onClick={() => {
                    if (onToggleMobileSidebar) {
                      onToggleMobileSidebar();
                    } else {
                      setMobileMenuOpen(!mobileMenuOpen);
                    }
                  }}
                  className="lg:hidden px-3 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200 flex items-center gap-1.5"
                  aria-label="เปิดเมนูด้านซ้าย"
                >
                  {isMobileSidebarOpen || mobileMenuOpen ? (
                    <X className="w-5 h-5 text-rose-600" />
                  ) : (
                    <Menu className="w-5 h-5 text-indigo-600" />
                  )}
                  <span className="text-xs font-bold text-slate-800">
                    {isMobileSidebarOpen || mobileMenuOpen ? 'ปิด' : 'เมนู'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2 hidden on desktop because left sidebar menu is now active */}
        <div className="hidden">
          {isAuthenticated && (
            <div id="header-navigation-row">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 sm:py-2">
              <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
                
                {/* 2.1 Left: Primary View Switcher Tabs */}
                <nav id="header-nav-tabs" className="flex items-center gap-1.5 flex-shrink-0" aria-label="เมนูหลัก">
                  {userRole !== 'student' && (
                    <button
                      id="nav-tab-dashboard"
                      onClick={() => onChangeView('DASHBOARD')}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        currentView === 'DASHBOARD'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>ภาพรวมคะแนน (Dashboard)</span>
                    </button>
                  )}

                  <button
                    id="nav-tab-lookup"
                    onClick={() => onChangeView('LOOKUP')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      currentView === 'LOOKUP' || userRole === 'student'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                  >
                    <Search className="w-4 h-4" />
                    <span>{userRole === 'student' ? 'ผลคะแนนความประพฤติของฉัน' : 'ค้นหาและตรวจสอบนักเรียน'}</span>
                  </button>

                  {userRole !== 'student' && (
                    <button
                      id="nav-tab-advisors"
                      onClick={() => onChangeView('ADVISORS')}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        currentView === 'ADVISORS'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
                      }`}
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>ครูที่ปรึกษาประจำชั้น</span>
                    </button>
                  )}
                </nav>

                {/* 2.2 Right: Staff / Teacher / Admin Quick Tools */}
                {userRole !== 'student' && (
                  <div id="header-tools-toolbar" className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Honour Roll Button */}
                    <button
                      id="nav-btn-honour"
                      onClick={() => onChangeView('HONOUR')}
                      title="ทำเนียบคะแนนดีเด่น (100+ ไม่เคยโดนหัก)"
                      className={`px-3 py-1.5 sm:py-2 rounded-xl transition-colors cursor-pointer border flex items-center gap-1.5 text-xs font-bold shadow-2xs ${
                        currentView === 'HONOUR'
                          ? 'bg-violet-700 text-white border-violet-800 shadow-xs'
                          : 'text-violet-800 bg-violet-50 hover:bg-violet-100 border-violet-200'
                      }`}
                    >
                      <Award className={`w-4 h-4 ${currentView === 'HONOUR' ? 'text-amber-300' : 'text-amber-500'}`} />
                      <span>ทำเนียบ 100+</span>
                    </button>

                    {/* Critical Students Alert Pill */}
                    {criticalCount > 0 && (
                      <button
                        id="nav-badge-critical"
                        onClick={() => onChangeView('CRITICAL_ALERT')}
                        className={`px-2.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5 ${
                          currentView === 'CRITICAL_ALERT'
                            ? 'bg-rose-600 text-white border border-rose-700 shadow-xs'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                        }`}
                        title={`มีนักเรียน ${criticalCount} คน คะแนน ≤ 50`}
                      >
                        <AlertOctagon className="w-4 h-4" />
                        <span>วิกฤต: {criticalCount}</span>
                      </button>
                    )}

                    {/* System Settings Button */}
                    <button
                      id="nav-btn-settings"
                      onClick={() => onChangeView('SETTINGS')}
                      title="ตั้งค่าระบบและจัดการฐานข้อมูล"
                      className={`px-3 py-1.5 sm:py-2 rounded-xl transition-colors cursor-pointer border flex items-center gap-1.5 text-xs font-bold shadow-2xs ${
                        currentView === 'SETTINGS'
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'text-slate-700 bg-white hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      <span>ตั้งค่าระบบ</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </header>

        {/* 4. Mobile Drawer Overlay & Dropdown Menu */}
        {mobileMenuOpen && (
          <div
            id="mobile-drawer-backdrop"
            className="fixed inset-0 top-16 z-50 bg-slate-950/60 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              id="mobile-drawer-content"
              className="bg-white border-b border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* User Info or Login Card in Mobile Drawer */}
              {isAuthenticated ? (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                      {currentUser ? currentUser.name.charAt(0) : <GraduationCap className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        {currentUser ? currentUser.name : studentGrant?.studentName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {currentUser?.role === 'admin'
                          ? 'ผู้ดูแลระบบ (Admin)'
                          : currentUser?.role === 'staff'
                          ? 'เจ้าหน้าที่ฝ่ายปกครอง'
                          : currentUser?.role === 'teacher'
                          ? 'ครูผู้สอน'
                          : `นักเรียน (รหัส ${studentGrant?.studentId})`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    ออกระบบ
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                    <LogIn className="w-4 h-4 text-indigo-600" />
                    <span>เข้าสู่ระบบเพื่อใช้งาน</span>
                  </div>
                  <p className="text-xs text-indigo-800/80">
                    สำหรับครูผู้สอน เจ้าหน้าที่ฝ่ายปกครอง ผู้ดูแลระบบ และนักเรียน
                  </p>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (onOpenLoginModal) onOpenLoginModal();
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>เข้าสู่ระบบ</span>
                  </button>
                </div>
              )}

              {/* View Navigation Items */}
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
                  เมนูหลัก
                </p>

                {canAccess('HOME') && (
                  <button
                    type="button"
                    onClick={() => {
                      onChangeView('HOME');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between transition-colors ${
                      currentView === 'HOME'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <School className="w-4 h-4" />
                      <span>หน้าแรก (พอร์ทัลโรงเรียน)</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-70" />
                  </button>
                )}

                {canAccess('DASHBOARD') && (
                  <button
                    onClick={() => {
                      onChangeView('DASHBOARD');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between transition-colors ${
                      currentView === 'DASHBOARD'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4" />
                      <span>ภาพรวมคะแนนความประพฤติ (Dashboard)</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-70" />
                  </button>
                )}

                {canAccess('LOOKUP') && (
                  <button
                    onClick={() => {
                      onChangeView('LOOKUP');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between transition-colors ${
                      currentView === 'LOOKUP'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Search className="w-4 h-4" />
                      <span>{userRole === 'student' ? 'ผลคะแนนความประพฤติของฉัน' : 'ค้นหารหัสและตรวจสอบนักเรียน'}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-70" />
                  </button>
                )}

                {canAccess('ADVISORS') && (
                  <button
                    onClick={() => {
                      onChangeView('ADVISORS');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between transition-colors ${
                      currentView === 'ADVISORS'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="w-4 h-4" />
                      <span>ครูที่ปรึกษาประจำชั้น</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-70" />
                  </button>
                )}
              </div>

              {/* Quick Tools (Staff / Teacher / Admin) */}
              {isAuthenticated && (
                <div className="space-y-1 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
                    เครื่องมือฝ่ายปกครอง & ตั้งค่า
                  </p>

                  {canAccess('HONOUR') && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onChangeView('HONOUR');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-colors text-left ${
                        currentView === 'HONOUR'
                          ? 'bg-violet-700 text-white font-bold'
                          : 'text-slate-700 hover:bg-violet-50 hover:text-violet-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Award className={`w-4 h-4 ${currentView === 'HONOUR' ? 'text-amber-300' : 'text-amber-500'}`} />
                        <span>ทำเนียบคะแนนดีเด่น (100+ ไม่เคยโดนหัก)</span>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
                        100+
                      </span>
                    </button>
                  )}

                  {(canAccess('SETTINGS_BRANDING') ||
                    canAccess('SETTINGS_BEHAVIORS') ||
                    canAccess('SETTINGS_USERS') ||
                    canAccess('SETTINGS_DATABASE') ||
                    canAccess('SETTINGS_GRANTS')) && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onChangeView('SETTINGS');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-colors text-left ${
                        currentView.startsWith('SETTINGS') && currentView !== 'SETTINGS_MENU_PERMISSIONS'
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Settings className="w-4 h-4" />
                        <span>ตั้งค่าระบบและจัดการข้อมูล</span>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    </button>
                  )}

                  {canAccess('SETTINGS_MENU_PERMISSIONS') && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onChangeView('SETTINGS_MENU_PERMISSIONS');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-colors text-left ${
                        currentView === 'SETTINGS_MENU_PERMISSIONS'
                          ? 'bg-purple-700 text-white font-bold'
                          : 'text-purple-900 bg-purple-50 hover:bg-purple-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-purple-600" />
                        <span>จัดการสิทธิ์เข้าถึงเมนู (👑 ผู้ดูแลหลัก)</span>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-200 text-purple-800 rounded">
                        Admin
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Status Alert Pills in Mobile Drawer */}
              {criticalCount > 0 && canAccess('CRITICAL_ALERT') && (
                <div
                  onClick={() => {
                    onChangeView('CRITICAL_ALERT');
                    setMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                    currentView === 'CRITICAL_ALERT'
                      ? 'bg-rose-600 text-white border border-rose-700'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <AlertOctagon className="w-4 h-4" />
                    <span>นักเรียนกลุ่มวิกฤต (≤ 50 คะแนน)</span>
                  </div>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                    currentView === 'CRITICAL_ALERT' ? 'bg-rose-800 text-white' : 'bg-rose-200 text-rose-900'
                  }`}>
                    {criticalCount} คน
                  </span>
                </div>
              )}

              {/* Footer info in Mobile Drawer */}
              <div className="pt-3 border-t border-slate-100 text-center text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-600">{schoolNameDisplay}</p>
                <p>ปีการศึกษา {currentAcademicYear} ภาคเรียนที่ {currentTerm}</p>
              </div>
            </div>
          </div>
        )}

      {/* 5. Mobile & Tablet Bottom Navigation Bar (Optimized for Mobile and Tablet Touch Devices) */}
      <nav
        id="mobile-bottom-navbar"
        aria-label="แถบเมนูด้านล่างสำหรับมือถือและแท็ปเล็ต"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 sm:px-4 py-1.5 sm:py-2 lg:hidden shadow-lg"
      >
        <div className="max-w-md sm:max-w-2xl mx-auto flex items-center justify-around w-full">
          {isAuthenticated ? (
            <>
              {canAccess('DASHBOARD') && (
                <button
                  id="mobile-nav-dashboard"
                  onClick={() => {
                    onChangeView('DASHBOARD');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-2 sm:px-4 rounded-xl transition-all cursor-pointer relative ${
                    currentView === 'DASHBOARD'
                      ? 'text-indigo-600 font-bold bg-indigo-50/90'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-5 h-5 sm:w-5 sm:h-5" />
                  <span className="text-[10px] sm:text-xs mt-0.5 whitespace-nowrap">ภาพรวม</span>
                  {currentView === 'DASHBOARD' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5" />
                  )}
                </button>
              )}

              {canAccess('LOOKUP') && (
                <button
                  id="mobile-nav-lookup"
                  onClick={() => {
                    onChangeView('LOOKUP');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-2 sm:px-4 rounded-xl transition-all cursor-pointer relative ${
                    currentView === 'LOOKUP'
                      ? 'text-indigo-600 font-bold bg-indigo-50/90'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Search className="w-5 h-5 sm:w-5 sm:h-5" />
                  <span className="text-[10px] sm:text-xs mt-0.5 whitespace-nowrap">{userRole === 'student' ? 'คะแนนฉัน' : 'ค้นหา'}</span>
                  {currentView === 'LOOKUP' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5" />
                  )}
                </button>
              )}

              {canAccess('HONOUR') && (
                <button
                  id="mobile-nav-honour"
                  onClick={() => {
                    onChangeView('HONOUR');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-2 sm:px-4 rounded-xl transition-all cursor-pointer relative ${
                    currentView === 'HONOUR'
                      ? 'text-violet-700 font-bold bg-violet-50/90'
                      : 'text-slate-500 hover:text-violet-700'
                  }`}
                >
                  <Award className={`w-5 h-5 sm:w-5 sm:h-5 ${currentView === 'HONOUR' ? 'text-amber-500 fill-amber-400' : 'text-amber-500'}`} />
                  <span className="text-[10px] sm:text-xs mt-0.5 whitespace-nowrap">ทำเนียบ 100+</span>
                  {currentView === 'HONOUR' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-600 mt-0.5" />
                  )}
                </button>
              )}

              {(canAccess('SETTINGS_BRANDING') ||
                canAccess('SETTINGS_BEHAVIORS') ||
                canAccess('SETTINGS_USERS') ||
                canAccess('SETTINGS_DATABASE') ||
                canAccess('SETTINGS_GRANTS') ||
                canAccess('SETTINGS_MENU_PERMISSIONS')) && (
                <button
                  id="mobile-nav-settings"
                  onClick={() => {
                    onChangeView('SETTINGS');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-2 sm:px-4 rounded-xl transition-all cursor-pointer relative ${
                    currentView.startsWith('SETTINGS')
                      ? 'text-indigo-600 font-bold bg-indigo-50/90'
                      : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  <Settings className="w-5 h-5 sm:w-5 sm:h-5" />
                  <span className="text-[10px] sm:text-xs mt-0.5 whitespace-nowrap">ตั้งค่า</span>
                  {currentView.startsWith('SETTINGS') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5" />
                  )}
                </button>
              )}

              <button
                id="mobile-nav-menu"
                onClick={() => {
                  if (onToggleMobileSidebar) {
                    onToggleMobileSidebar();
                  } else {
                    setMobileMenuOpen(!mobileMenuOpen);
                  }
                }}
                className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-2 sm:px-4 rounded-xl transition-all cursor-pointer relative ${
                  isMobileSidebarOpen || mobileMenuOpen
                    ? 'text-indigo-600 font-bold bg-indigo-50/90'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {isMobileSidebarOpen || mobileMenuOpen ? <X className="w-5 h-5 sm:w-5 sm:h-5 text-rose-600" /> : <Menu className="w-5 h-5 sm:w-5 sm:h-5" />}
                <span className="text-[10px] sm:text-xs mt-0.5 whitespace-nowrap">{isMobileSidebarOpen || mobileMenuOpen ? 'ปิดเมนู' : 'เมนู'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                id="mobile-guest-home"
                onClick={() => {
                  onChangeView('HOME');
                  setMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-3 rounded-xl transition-all cursor-pointer relative ${
                  currentView === 'HOME'
                    ? 'text-indigo-600 font-bold bg-indigo-50/90'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <School className="w-5 h-5 sm:w-5 sm:h-5" />
                <span className="text-[10px] sm:text-xs mt-0.5 whitespace-nowrap">หน้าแรก</span>
                {currentView === 'HOME' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5" />
                )}
              </button>

              <button
                type="button"
                id="mobile-guest-lookup"
                onClick={() => {
                  onChangeView('LOOKUP');
                  setMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-3 rounded-xl transition-all cursor-pointer relative ${
                  currentView === 'LOOKUP'
                    ? 'text-indigo-600 font-bold bg-indigo-50/90'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Search className="w-5 h-5 sm:w-5 sm:h-5" />
                <span className="text-[10px] sm:text-xs mt-0.5 whitespace-nowrap">ค้นหา</span>
                {currentView === 'LOOKUP' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5" />
                )}
              </button>

              <button
                type="button"
                id="mobile-guest-honour"
                onClick={() => {
                  onChangeView('HONOUR');
                  setMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-3 rounded-xl transition-all cursor-pointer relative ${
                  currentView === 'HONOUR'
                    ? 'text-violet-700 font-bold bg-violet-50/90'
                    : 'text-slate-500 hover:text-violet-700'
                }`}
              >
                <Award className="w-5 h-5 sm:w-5 sm:h-5 text-amber-500" />
                <span className="text-[10px] sm:text-xs mt-0.5 whitespace-nowrap">ทำเนียบ</span>
                {currentView === 'HONOUR' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-600 mt-0.5" />
                )}
              </button>

              <button
                type="button"
                id="mobile-guest-login"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenLoginModal) onOpenLoginModal();
                }}
                className="flex flex-col items-center justify-center py-1 sm:py-1.5 px-3 rounded-xl transition-all cursor-pointer relative text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <LogIn className="w-5 h-5 sm:w-5 sm:h-5" />
                <span className="text-[10px] sm:text-xs mt-0.5 whitespace-nowrap">เข้าสู่ระบบ</span>
              </button>
            </>
          )}
        </div>
      </nav>
    </>
  );
};

