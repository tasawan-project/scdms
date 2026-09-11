import React from 'react';
import { AppUser, AppView, StudentAccessGrant, SystemSettings } from '../types';
import { canUserAccessMenu, isSuperAdmin } from '../utils/menuPermissions';
import {
  School,
  ListChecks,
  Shield,
  Database,
  Key,
  ShieldCheck
} from 'lucide-react';

interface SettingsTabBarProps {
  currentView: AppView;
  currentUser: AppUser | null;
  studentGrant?: StudentAccessGrant | null;
  systemSettings?: SystemSettings;
  onChangeView: (view: AppView) => void;
}

interface SettingsTabItem {
  view: AppView;
  label: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SETTINGS_TABS: SettingsTabItem[] = [
  {
    view: 'SETTINGS_BRANDING',
    label: 'ข้อมูลโรงเรียน & ระบบ',
    icon: School
  },
  {
    view: 'SETTINGS_BEHAVIORS',
    label: 'เกณฑ์พฤติกรรม',
    icon: ListChecks
  },
  {
    view: 'SETTINGS_USERS',
    label: 'จัดการผู้ใช้งาน',
    badge: 'Admin',
    icon: Shield
  },
  {
    view: 'SETTINGS_DATABASE',
    label: 'ฐานข้อมูล & สำรอง',
    badge: 'Cloud',
    icon: Database
  },
  {
    view: 'SETTINGS_GRANTS',
    label: 'ประวัติสิทธิ์นักเรียน',
    icon: Key
  },
  {
    view: 'SETTINGS_MENU_PERMISSIONS',
    label: 'สิทธิ์เข้าถึงเมนู',
    badge: '👑 Super Admin',
    icon: ShieldCheck
  }
];

export const SettingsTabBar: React.FC<SettingsTabBarProps> = ({
  currentView,
  currentUser,
  studentGrant,
  systemSettings,
  onChangeView
}) => {
  // Filter tabs by dynamic permission
  const allowedTabs = SETTINGS_TABS.filter(tab =>
    canUserAccessMenu(tab.view, currentUser, studentGrant, systemSettings?.menuPermissions)
  );

  // If only 1 tab is accessible, no need to show the switcher
  if (allowedTabs.length <= 1) {
    return null;
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-1.5 mb-5 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1.5 min-w-max">
        {allowedTabs.map(tab => {
          const Icon = tab.icon;
          const isActive =
            currentView === tab.view ||
            (tab.view === 'SETTINGS_BRANDING' && currentView === 'SETTINGS');

          return (
            <button
              key={tab.view}
              type="button"
              onClick={() => onChangeView(tab.view)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    isActive
                      ? 'bg-indigo-700 text-white'
                      : tab.badge.includes('Super')
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
