import React, { useState } from 'react';
import { AppUser, SystemSettings, MenuPermissionsMap, UserRole } from '../types';
import {
  isSuperAdmin,
  ALL_MENU_DEFINITIONS,
  getDefaultMenuPermissions,
  MenuItemDefinition
} from '../utils/menuPermissions';
import {
  ShieldCheck,
  Lock,
  Save,
  RotateCcw,
  Sparkles,
  School,
  LayoutDashboard,
  Search,
  Users,
  Award,
  AlertOctagon,
  GraduationCap,
  Upload,
  Camera,
  Calendar,
  Folder,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';

interface MenuPermissionsSettingsProps {
  currentUser: AppUser;
  systemSettings: SystemSettings;
  onSavePermissions: (updatedPermissions: MenuPermissionsMap) => Promise<void> | void;
  onClose?: () => void;
}

export const MenuPermissionsSettings: React.FC<MenuPermissionsSettingsProps> = ({
  currentUser,
  systemSettings,
  onSavePermissions,
  onClose
}) => {
  const isSuper = isSuperAdmin(currentUser);

  // Initialize permissions state from systemSettings or defaults
  const [permissions, setPermissions] = useState<MenuPermissionsMap>(() => {
    const defaults = getDefaultMenuPermissions();
    if (systemSettings?.menuPermissions) {
      return {
        ...defaults,
        ...systemSettings.menuPermissions
      };
    }
    return defaults;
  });

  const [activeCategory, setActiveCategory] = useState<'ALL' | 'CORE' | 'STUDENT_MGMT' | 'SETTINGS'>('ALL');
  const [simulatedRole, setSimulatedRole] = useState<UserRole | 'guest'>('teacher');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Check if current user is Super Admin
  if (!isSuper) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="bg-white border border-rose-200 rounded-3xl p-8 shadow-sm space-y-4">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">
            สงวนสิทธิ์เฉพาะผู้ดูแลหลักเท่านั้น
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            เมนูจัดการสิทธิ์เข้าถึงเมนูได้รับการคุ้มครองความปลอดภัยสูงสุด
            กำหนดให้เฉพาะ <strong>ผู้ดูแลหลัก (Super Admin)</strong> เท่านั้นเป็นผู้อนุญาตและตั้งค่าสิทธิ์
          </p>
          {onClose && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                กลับสู่หน้าหลัก
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Toggle role permission for a menu item
  const handleToggleRole = (menuKey: string, role: 'admin' | 'staff' | 'teacher' | 'student') => {
    // Prevent removing admin from super admin only menu
    const def = ALL_MENU_DEFINITIONS.find(m => m.key === menuKey);
    if (def?.isSuperAdminOnly && role === 'admin') {
      return;
    }

    setPermissions(prev => {
      const currentRule = prev[menuKey] || {
        allowedRoles: def ? [...def.defaultRoles] : ['admin'],
        allowGuest: def ? def.defaultAllowGuest : false,
        enabled: def ? def.defaultEnabled : true
      };

      const hasRole = currentRule.allowedRoles.includes(role);
      const newAllowedRoles = hasRole
        ? currentRule.allowedRoles.filter(r => r !== role)
        : [...currentRule.allowedRoles, role];

      return {
        ...prev,
        [menuKey]: {
          ...currentRule,
          allowedRoles: newAllowedRoles
        }
      };
    });
  };

  // Toggle guest access
  const handleToggleGuest = (menuKey: string) => {
    const def = ALL_MENU_DEFINITIONS.find(m => m.key === menuKey);
    if (def?.isSuperAdminOnly) return;

    setPermissions(prev => {
      const currentRule = prev[menuKey] || {
        allowedRoles: def ? [...def.defaultRoles] : ['admin'],
        allowGuest: def ? def.defaultAllowGuest : false,
        enabled: def ? def.defaultEnabled : true
      };

      return {
        ...prev,
        [menuKey]: {
          ...currentRule,
          allowGuest: !currentRule.allowGuest
        }
      };
    });
  };

  // Toggle menu enabled/disabled
  const handleToggleEnabled = (menuKey: string) => {
    const def = ALL_MENU_DEFINITIONS.find(m => m.key === menuKey);
    if (def?.isSuperAdminOnly) return; // Super admin menu cannot be globally disabled

    setPermissions(prev => {
      const currentRule = prev[menuKey] || {
        allowedRoles: def ? [...def.defaultRoles] : ['admin'],
        allowGuest: def ? def.defaultAllowGuest : false,
        enabled: def ? def.defaultEnabled : true
      };

      return {
        ...prev,
        [menuKey]: {
          ...currentRule,
          enabled: !currentRule.enabled
        }
      };
    });
  };

  // Reset to default permissions
  const handleResetToDefault = () => {
    if (window.confirm('คุณต้องการคืนค่าสิทธิ์การเข้าถึงเมนูเป็นค่าเริ่มต้นของระบบทั้งหมดใช่หรือไม่?')) {
      const defaults = getDefaultMenuPermissions();
      setPermissions(defaults);
      setSaveSuccess(false);
      setSaveError(null);
    }
  };

  // Quick preset: Strict security
  const handleApplyStrictPreset = () => {
    const next: MenuPermissionsMap = {};
    for (const item of ALL_MENU_DEFINITIONS) {
      if (item.key === 'HOME') {
        next[item.key] = { allowedRoles: ['admin', 'staff', 'teacher', 'student'], allowGuest: true, enabled: true };
      } else if (item.key === 'LOOKUP') {
        next[item.key] = { allowedRoles: ['admin', 'staff', 'teacher', 'student'], allowGuest: true, enabled: true };
      } else if (item.key === 'HONOUR') {
        next[item.key] = { allowedRoles: ['admin', 'staff', 'teacher'], allowGuest: false, enabled: true };
      } else if (item.category === 'SETTINGS') {
        next[item.key] = { allowedRoles: ['admin'], allowGuest: false, enabled: true };
      } else if (item.category === 'STUDENT_MGMT') {
        next[item.key] = { allowedRoles: ['admin', 'staff'], allowGuest: false, enabled: true };
      } else {
        next[item.key] = { allowedRoles: ['admin', 'staff'], allowGuest: false, enabled: true };
      }
    }
    setPermissions(next);
  };

  // Quick preset: Open access for teachers
  const handleApplyOpenTeacherPreset = () => {
    const next: MenuPermissionsMap = {};
    for (const item of ALL_MENU_DEFINITIONS) {
      if (item.category === 'CORE') {
        next[item.key] = { allowedRoles: ['admin', 'staff', 'teacher', 'student'], allowGuest: item.defaultAllowGuest, enabled: true };
      } else if (item.key === 'SETTINGS_BEHAVIORS' || item.key === 'SETTINGS_GRANTS') {
        next[item.key] = { allowedRoles: ['admin', 'staff', 'teacher'], allowGuest: false, enabled: true };
      } else if (item.category === 'SETTINGS') {
        next[item.key] = { allowedRoles: ['admin'], allowGuest: false, enabled: true };
      } else {
        next[item.key] = { allowedRoles: ['admin', 'staff'], allowGuest: false, enabled: true };
      }
    }
    setPermissions(next);
  };

  // Save changes
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      // Ensure SETTINGS_MENU_PERMISSIONS is always locked to admin
      const sanitized: MenuPermissionsMap = {
        ...permissions,
        SETTINGS_MENU_PERMISSIONS: {
          allowedRoles: ['admin'],
          allowGuest: false,
          enabled: true
        }
      };

      await onSavePermissions(sanitized);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์เมนู');
    } finally {
      setIsSaving(false);
    }
  };

  // Icon renderer helper
  const renderMenuIcon = (iconName: string) => {
    switch (iconName) {
      case 'School': return <School className="w-4 h-4" />;
      case 'LayoutDashboard': return <LayoutDashboard className="w-4 h-4" />;
      case 'Search': return <Search className="w-4 h-4" />;
      case 'Users': return <Users className="w-4 h-4" />;
      case 'Award': return <Award className="w-4 h-4" />;
      case 'AlertOctagon': return <AlertOctagon className="w-4 h-4" />;
      case 'GraduationCap': return <GraduationCap className="w-4 h-4" />;
      case 'Upload': return <Upload className="w-4 h-4" />;
      case 'Camera': return <Camera className="w-4 h-4" />;
      case 'Calendar': return <Calendar className="w-4 h-4" />;
      case 'Folder': return <Folder className="w-4 h-4" />;
      case 'UserCheck': return <UserCheck className="w-4 h-4" />;
      case 'Sparkles': return <Sparkles className="w-4 h-4" />;
      case 'ShieldCheck': return <ShieldCheck className="w-4 h-4" />;
      default: return <Folder className="w-4 h-4" />;
    }
  };

  const filteredMenus = ALL_MENU_DEFINITIONS.filter(m => {
    if (activeCategory === 'ALL') return true;
    return m.category === activeCategory;
  });

  // Calculate visible menus in simulation
  const visibleInSimulation = ALL_MENU_DEFINITIONS.filter(m => {
    if (m.isSuperAdminOnly) {
      return simulatedRole === 'admin';
    }
    const rule = permissions[m.key];
    if (rule && !rule.enabled) return false;
    if (simulatedRole === 'guest') {
      return rule ? rule.allowGuest : m.defaultAllowGuest;
    }
    const roles = rule ? rule.allowedRoles : m.defaultRoles;
    return roles.includes(simulatedRole);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors mr-1"
                  title="กลับ"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <span className="px-3 py-1 rounded-full text-xs font-black tracking-wide bg-purple-500/20 text-purple-300 border border-purple-400/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                ผู้ดูแลหลัก (Super Admin Only)
              </span>
              <span className="text-xs text-slate-400">
                ควบคุมสิทธิ์ความปลอดภัยระบบ
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              จัดการสิทธิ์เข้าถึงเมนู
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              กำหนดสิทธิ์การมองเห็นและสิทธิ์การเข้าใช้งานเมนูต่างๆ ในระบบ โดยให้ <strong>ผู้ดูแลหลักเป็นผู้อนุญาตเท่านั้น</strong> เพื่อควบคุมการเข้าถึงข้อมูลและฟังก์ชันการทำงานอย่างปลอดภัย
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-slate-200 font-bold rounded-xl transition-colors text-xs flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>คืนค่าเริ่มต้น</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition-all text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการกำหนดสิทธิ์'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold">บันทึกสิทธิ์การเข้าถึงเมนูสำเร็จแล้ว!</span>
            <p className="text-emerald-700 text-[11px] mt-0.5">
              การเปลี่ยนแปลงมีผลบังคับใช้ทันที บัญชีผู้ใช้งานในระบบจะมองเห็นเฉพาะเมนูที่ได้รับอนุญาตเท่านั้น
            </p>
          </div>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-bold">{saveError}</span>
        </div>
      )}

      {/* Quick Presets & Security Rules Notice */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Notice Card */}
        <div className="lg:col-span-2 bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="space-y-1 text-xs text-amber-900">
            <h4 className="font-bold text-sm">กฎการควบคุมสิทธิ์ตามข้อกำหนด:</h4>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800 text-[11px] leading-relaxed">
              <li>เมนู <strong>"จัดการสิทธิ์เข้าถึงเมนู"</strong> ถูกล็อกถาวรให้เฉพาะ <strong>ผู้ดูแลหลัก</strong> เท่านั้น ไม่สามารถมอบสิทธิ์ให้ผู้อื่นได้</li>
              <li>สิทธิ์ <strong>การแก้ไขรหัสผ่าน</strong> ถูกจำกัดให้เฉพาะ <strong>ผู้ดูแลหลัก</strong> และ <strong>เจ้าของบัญชี (User)</strong> เท่านั้น</li>
              <li>เมื่อปิดการใช้งานเมนู หรือไม่ได้เลือก Role ใด ผู้ใช้งานระดับนั้นจะไม่เห็นเมนูบน Sidebar และไม่สามารถเข้าชมได้</li>
            </ul>
          </div>
        </div>

        {/* Presets Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">ชุดค่าแนะนำ (Presets):</span>
            <Sparkles className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleApplyStrictPreset}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              🔒 โหมดความปลอดภัยสูง
            </button>
            <button
              type="button"
              onClick={handleApplyOpenTeacherPreset}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              👨‍🏫 ครูดูภาพรวมได้
            </button>
          </div>
          <span className="text-[10px] text-slate-400">คลิกเพื่อปรับใช้โครงสร้างสิทธิ์ที่เหมาะสมอย่างรวดเร็ว</span>
        </div>
      </div>

      {/* Role Simulation Preview Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              จำลองมุมมองสิทธิ์ (Role Simulator Preview)
            </h3>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 font-medium mr-1">เลือกดูบทบาท:</span>
            {[
              { role: 'admin' as const, label: '👑 ผู้ดูแลระบบ (Admin)' },
              { role: 'staff' as const, label: '🛡️ ฝ่ายปกครอง (Staff)' },
              { role: 'teacher' as const, label: '👨‍🏫 ครูผู้สอน (Teacher)' },
              { role: 'student' as const, label: '🎓 นักเรียน (Student)' },
              { role: 'guest' as const, label: '🌐 ทั่วไป (Guest)' }
            ].map(item => (
              <button
                key={item.role}
                type="button"
                onClick={() => setSimulatedRole(item.role)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  simulatedRole === item.role
                    ? 'bg-indigo-600 text-white shadow-xs scale-102'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Simulation Chips */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-500 font-medium shrink-0">
            เมนูที่บทบาทนี้มองเห็น ({visibleInSimulation.length}/{ALL_MENU_DEFINITIONS.length}):
          </span>
          {visibleInSimulation.map(item => (
            <span
              key={item.key}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold shadow-2xs text-[11px]"
            >
              {renderMenuIcon(item.iconName)}
              <span>{item.shortTitle}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { key: 'ALL' as const, label: 'ทุกหมวดหมู่', count: ALL_MENU_DEFINITIONS.length },
          { key: 'CORE' as const, label: '📌 เมนูหลัก', count: ALL_MENU_DEFINITIONS.filter(m => m.category === 'CORE').length },
          { key: 'STUDENT_MGMT' as const, label: '👥 จัดการนักเรียน', count: ALL_MENU_DEFINITIONS.filter(m => m.category === 'STUDENT_MGMT').length },
          { key: 'SETTINGS' as const, label: '⚙️ ตั้งค่าระบบ', count: ALL_MENU_DEFINITIONS.filter(m => m.category === 'SETTINGS').length }
        ].map(cat => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveCategory(cat.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeCategory === cat.key
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <span>{cat.label}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeCategory === cat.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
                <th className="py-3.5 px-4 sm:px-6 min-w-[240px]">เมนู / คำอธิบาย</th>
                <th className="py-3.5 px-3 text-center min-w-[90px]">หมวดหมู่</th>
                <th className="py-3.5 px-3 text-center min-w-[85px] bg-purple-50/50">👑 Admin</th>
                <th className="py-3.5 px-3 text-center min-w-[85px] bg-blue-50/50">🛡️ Staff</th>
                <th className="py-3.5 px-3 text-center min-w-[85px] bg-emerald-50/50">👨‍🏫 ครู</th>
                <th className="py-3.5 px-3 text-center min-w-[85px] bg-indigo-50/50">🎓 นักเรียน</th>
                <th className="py-3.5 px-3 text-center min-w-[85px] bg-amber-50/50">🌐 ทั่วไป</th>
                <th className="py-3.5 px-4 text-center min-w-[100px]">สถานะเปิดใช้</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMenus.map((item) => {
                const rule = permissions[item.key] || {
                  allowedRoles: [...item.defaultRoles],
                  allowGuest: item.defaultAllowGuest,
                  enabled: item.defaultEnabled
                };

                const isAdminAllowed = rule.allowedRoles.includes('admin');
                const isStaffAllowed = rule.allowedRoles.includes('staff');
                const isTeacherAllowed = rule.allowedRoles.includes('teacher');
                const isStudentAllowed = rule.allowedRoles.includes('student');
                const isGuestAllowed = rule.allowGuest;
                const isEnabled = rule.enabled;
                const isLockedSuperAdmin = item.isSuperAdminOnly;

                return (
                  <tr
                    key={item.key}
                    className={`hover:bg-slate-50/80 transition-colors ${!isEnabled ? 'opacity-50 bg-slate-50/50' : ''}`}
                  >
                    {/* Menu Title & Info */}
                    <td className="py-4 px-4 sm:px-6">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          item.category === 'CORE'
                            ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                            : item.category === 'STUDENT_MGMT'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-purple-50 text-purple-600 border border-purple-100'
                        }`}>
                          {renderMenuIcon(item.iconName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {item.title}
                            </span>
                            {isLockedSuperAdmin && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                👑 ผู้ดูแลหลักเท่านั้น
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-4 px-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        item.category === 'CORE'
                          ? 'bg-indigo-100 text-indigo-700'
                          : item.category === 'STUDENT_MGMT'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {item.categoryName}
                      </span>
                    </td>

                    {/* Role: Admin */}
                    <td className="py-4 px-3 text-center bg-purple-50/20">
                      {isLockedSuperAdmin ? (
                        <div className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-100 text-rose-700" title="ล็อกสิทธิ์เฉพาะผู้ดูแลหลัก">
                          <Lock className="w-4 h-4" />
                        </div>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isAdminAllowed}
                          onChange={() => handleToggleRole(item.key, 'admin')}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600"
                        />
                      )}
                    </td>

                    {/* Role: Staff */}
                    <td className="py-4 px-3 text-center bg-blue-50/20">
                      {isLockedSuperAdmin ? (
                        <span className="text-slate-300 font-bold">-</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isStaffAllowed}
                          onChange={() => handleToggleRole(item.key, 'staff')}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      )}
                    </td>

                    {/* Role: Teacher */}
                    <td className="py-4 px-3 text-center bg-emerald-50/20">
                      {isLockedSuperAdmin ? (
                        <span className="text-slate-300 font-bold">-</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isTeacherAllowed}
                          onChange={() => handleToggleRole(item.key, 'teacher')}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                        />
                      )}
                    </td>

                    {/* Role: Student */}
                    <td className="py-4 px-3 text-center bg-indigo-50/20">
                      {isLockedSuperAdmin ? (
                        <span className="text-slate-300 font-bold">-</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isStudentAllowed}
                          onChange={() => handleToggleRole(item.key, 'student')}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                        />
                      )}
                    </td>

                    {/* Role: Guest */}
                    <td className="py-4 px-3 text-center bg-amber-50/20">
                      {isLockedSuperAdmin ? (
                        <span className="text-slate-300 font-bold">-</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isGuestAllowed}
                          onChange={() => handleToggleGuest(item.key)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                        />
                      )}
                    </td>

                    {/* Enabled Toggle */}
                    <td className="py-4 px-4 text-center">
                      {isLockedSuperAdmin ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          เปิดตลอด
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(item.key)}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                            isEnabled
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {isEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info in table */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>
              สิทธิ์การเข้าถึงทั้งหมดจะได้รับการควบคุมและจัดเก็บบนระบบคลาวด์ เพื่อให้ผู้ใช้งานทุกคนได้รับสิทธิ์ที่ตรงกัน
            </span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการกำหนดสิทธิ์'}</span>
          </button>
        </div>
      </div>

    </div>
  );
};
