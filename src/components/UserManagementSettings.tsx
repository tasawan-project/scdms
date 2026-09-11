import React, { useState, useMemo } from 'react';
import { AppUser } from '../types';
import { AdminPasswordConfirmModal } from './AdminPasswordConfirmModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import {
  isSuperAdmin,
  canEditUserPassword,
  getUserRoleLevel,
  getRoleLevelByRoleName,
  getRoleDisplayInfo,
  canManageTargetUser,
  canDeleteTargetUser,
  getAllowedAssignableRoles
} from '../utils/menuPermissions';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Lock,
  Key,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  UserCheck,
  UserX,
  X,
  Sparkles
} from 'lucide-react';

interface UserManagementSettingsProps {
  users: AppUser[];
  currentUser: AppUser;
  onClose?: () => void;
  onSaveUser: (user: AppUser) => Promise<void> | void;
  onDeleteUser?: (userId: string) => Promise<void> | void;
  onNavigateToMenuPermissions?: () => void;
}

export const UserManagementSettings: React.FC<UserManagementSettingsProps> = ({
  users,
  currentUser,
  onClose,
  onSaveUser,
  onDeleteUser,
  onNavigateToMenuPermissions
}) => {
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'teacher' | 'staff' | 'admin'>('teacher');
  const [newDepartment, setNewDepartment] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'ALL' | 'MANAGEABLE' | 'RESTRICTED' | 'SELF'>('ALL');
  const [showHierarchyGuide, setShowHierarchyGuide] = useState(false);
  const [userOperationMsg, setUserOperationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set());
  const [selectedUserForPasswordChange, setSelectedUserForPasswordChange] = useState<AppUser | null>(null);

  // Current user's hierarchy info
  const currentUserLevel = getUserRoleLevel(currentUser);
  const currentRoleInfo = getRoleDisplayInfo(currentUser);
  const allowedAssignableRoles = useMemo(() => getAllowedAssignableRoles(currentUser), [currentUser]);

  // Admin Password Confirmation Modal
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    targetName?: string;
    dangerLevel?: 'danger' | 'warning';
    confirmButtonText?: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  // Calculate user counts for badges
  const manageableUsersCount = useMemo(() => {
    return users.filter(u => canManageTargetUser(currentUser, u)).length;
  }, [users, currentUser]);

  const restrictedUsersCount = useMemo(() => {
    return users.filter(u => {
      const isSelf = u.id === currentUser.id || u.username?.toLowerCase() === currentUser.username?.toLowerCase();
      return !isSelf && !canManageTargetUser(currentUser, u);
    }).length;
  }, [users, currentUser]);

  const filteredUsers = useMemo(() => {
    let list = users;

    // Filter by tab
    if (activeFilterTab === 'MANAGEABLE') {
      list = list.filter(u => canManageTargetUser(currentUser, u));
    } else if (activeFilterTab === 'RESTRICTED') {
      list = list.filter(u => {
        const isSelf = u.id === currentUser.id || u.username?.toLowerCase() === currentUser.username?.toLowerCase();
        return !isSelf && !canManageTargetUser(currentUser, u);
      });
    } else if (activeFilterTab === 'SELF') {
      list = list.filter(u => u.id === currentUser.id || u.username?.toLowerCase() === currentUser.username?.toLowerCase());
    }

    // Filter by search query
    if (!userSearchQuery.trim()) return list;
    const q = userSearchQuery.toLowerCase().trim();
    return list.filter(
      u =>
        u.username.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.department && u.department.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, activeFilterTab, userSearchQuery, currentUser]);

  const toggleUserExpand = (userId: string) => {
    setExpandedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleToggleExpandAllUsers = () => {
    if (expandedUserIds.size === filteredUsers.length) {
      setExpandedUserIds(new Set());
    } else {
      setExpandedUserIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleOpenAddUser = () => {
    if (allowedAssignableRoles.length === 0) {
      setUserOperationMsg({
        type: 'error',
        text: 'ระดับสิทธิ์ของคุณไม่มีสิทธิ์ต่ำกว่าที่อนุญาตให้สร้างบัญชีผู้ใช้ใหม่ได้'
      });
      return;
    }
    setEditingUser(null);
    setNewUsername('');
    setNewPassword('');
    setNewName('');
    setNewRole(allowedAssignableRoles[0].role);
    setNewDepartment('');
    setShowAddUserModal(true);
    setUserOperationMsg(null);
  };

  const handleOpenEditUser = (user: AppUser) => {
    const isSelf = user.id === currentUser.id || user.username?.toLowerCase() === currentUser.username?.toLowerCase();
    const canManage = canManageTargetUser(currentUser, user);

    if (!isSelf && !canManage) {
      setUserOperationMsg({
        type: 'error',
        text: `คุณไม่สามารถแก้ไขข้อมูลของ "${user.name}" ได้ เนื่องจากผู้ใช้นี้มีระดับสิทธิ์เท่ากันหรือสูงกว่าคุณ`
      });
      return;
    }

    setEditingUser(user);
    setNewUsername(user.username);
    setNewPassword(user.password || '');
    setNewName(user.name);
    setNewRole(user.role as any);
    setNewDepartment(user.department || '');
    setShowAddUserModal(true);
    setUserOperationMsg(null);
  };

  const handleSaveUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserOperationMsg(null);

    const cleanUsername = newUsername.trim().toLowerCase();
    if (!cleanUsername) {
      setUserOperationMsg({ type: 'error', text: 'กรุณาระบุชื่อผู้ใช้งาน (Username)' });
      return;
    }

    if (!editingUser && users.some(u => u.username.toLowerCase() === cleanUsername)) {
      setUserOperationMsg({ type: 'error', text: `ชื่อผู้ใช้งาน "${cleanUsername}" มีอยู่ในระบบแล้ว` });
      return;
    }

    const isSelf = editingUser ? (currentUser.id === editingUser.id || currentUser.username?.toLowerCase() === editingUser.username?.toLowerCase()) : false;

    // ตรวจสอบเงื่อนไขบทบาท (Role Hierarchy Check)
    let finalRole = newRole;
    let finalIsSuperAdmin = false;

    if (editingUser) {
      if (isSelf) {
        // บัญชีตนเอง: ล็อกระดับสิทธิ์เดิมไว้เสมอ ป้องกันการยกระดับสิทธิ์ตนเอง
        finalRole = editingUser.role as any;
        finalIsSuperAdmin = !!editingUser.isSuperAdmin;
      } else {
        // แก้ไขผู้อื่น: ต้องมีสิทธิ์จัดการ (currentUserLevel > targetUserLevel)
        if (!canManageTargetUser(currentUser, editingUser)) {
          setUserOperationMsg({
            type: 'error',
            text: 'คุณไม่ได้รับอนุญาตให้แก้ไขผู้ใช้ที่มีระดับสิทธิ์เท่ากันหรือสูงกว่าคุณ'
          });
          return;
        }

        // บทบาทใหม่ที่กำหนด ต้องมีระดับต่ำกว่า currentUserLevel อย่างเคร่งครัด
        const newRoleLevel = getRoleLevelByRoleName(finalRole, false);
        if (currentUserLevel <= newRoleLevel) {
          setUserOperationMsg({
            type: 'error',
            text: `คุณมีสิทธิ์ระดับ ${currentUserLevel} ไม่สามารถกำหนดระดับสิทธิ์ที่เท่ากันหรือสูงกว่า (${newRoleLevel}) ให้ผู้อื่นได้`
          });
          return;
        }
        finalIsSuperAdmin = false;
      }
    } else {
      // สร้างผู้ใช้ใหม่: ต้องกำหนดบทบาทที่มีระดับต่ำกว่า currentUserLevel เท่านั้น
      const newRoleLevel = getRoleLevelByRoleName(finalRole, false);
      if (currentUserLevel <= newRoleLevel) {
        setUserOperationMsg({
          type: 'error',
          text: `คุณสามารถสร้างผู้ใช้งานได้เฉพาะระดับสิทธิ์ที่ต่ำกว่าคุณเท่านั้น`
        });
        return;
      }
      finalIsSuperAdmin = false;
    }

    // สิทธิ์การแก้ไขรหัสผ่าน
    const canEditPassword = !editingUser || canEditUserPassword(currentUser, editingUser);
    if (editingUser && newPassword.trim() !== (editingUser.password || '').trim() && !canEditPassword) {
      setUserOperationMsg({
        type: 'error',
        text: 'สิทธิ์การแก้ไขรหัสผ่านให้เฉพาะตนเอง หรือผู้มีระดับสิทธิ์สูงกว่าเท่านั้น'
      });
      return;
    }

    const finalPassword = canEditPassword && newPassword.trim()
      ? newPassword.trim()
      : (editingUser?.password || '');

    const userObj: AppUser = {
      id: editingUser ? editingUser.id : cleanUsername,
      username: cleanUsername,
      password: finalPassword,
      name: newName.trim(),
      role: finalRole,
      department: newDepartment.trim() || undefined,
      isActive: true,
      isSuperAdmin: finalIsSuperAdmin,
      createdAt: editingUser ? editingUser.createdAt : new Date().toISOString()
    };

    try {
      await onSaveUser(userObj);
      setUserOperationMsg({
        type: 'success',
        text: editingUser ? `บันทึกการแก้ไขข้อมูล "${userObj.name}" เรียบร้อยแล้ว` : `เพิ่มผู้ใช้งานใหม่ "${userObj.name}" สำเร็จ`
      });
      setShowAddUserModal(false);
      setEditingUser(null);
      setNewUsername('');
      setNewPassword('');
      setNewName('');
      setNewDepartment('');
    } catch (err: any) {
      setUserOperationMsg({ type: 'error', text: err?.message || 'เกิดข้อผิดพลาดในการบันทึกผู้ใช้' });
    }
  };

  const handleDeleteUserClick = (user: AppUser) => {
    if (user.id === 'admin' || user.username?.toLowerCase() === 'admin') {
      setUserOperationMsg({
        type: 'error',
        text: 'ไม่สามารถลบบัญชีผู้ดูแลระบบหลัก (admin) ได้ เนื่องจากเป็นบัญชีความปลอดภัยหลักของระบบ'
      });
      return;
    }

    if (user.id === currentUser.id || user.username?.toLowerCase() === currentUser.username?.toLowerCase()) {
      setUserOperationMsg({
        type: 'error',
        text: 'ไม่สามารถลบบัญชีของตนเองได้'
      });
      return;
    }

    if (!canDeleteTargetUser(currentUser, user)) {
      setUserOperationMsg({
        type: 'error',
        text: `คุณไม่มีสิทธิ์ลบบัญชี "${user.name}" (สามารถลบได้เฉพาะผู้ที่มีระดับสิทธิ์ต่ำกว่าคุณเท่านั้น)`
      });
      return;
    }

    const targetInfo = getRoleDisplayInfo(user);

    setConfirmAction({
      isOpen: true,
      title: 'ยืนยันการลบบัญชีผู้ใช้งาน',
      description: `คุณกำลังจะลบบัญชีผู้ใช้ "${user.name}" (@${user.username}) ซึ่งมีระดับสิทธิ์ต่ำกว่าคุณ ออกจากระบบอย่างถาวร`,
      targetName: `บัญชีผู้ใช้: ${user.name} (@${user.username}) - ${targetInfo.title} (${targetInfo.levelName})`,
      dangerLevel: 'danger',
      confirmButtonText: 'ยืนยันลบผู้ใช้งาน',
      onConfirm: async () => {
        try {
          if (onDeleteUser) {
            await onDeleteUser(user.id);
            setUserOperationMsg({ type: 'success', text: `ลบบัญชีผู้ใช้ "${user.name}" เรียบร้อยแล้ว` });
          }
        } catch (err: any) {
          setUserOperationMsg({ type: 'error', text: err?.message || 'ลบผู้ใช้ไม่สำเร็จ' });
        }
      }
    });
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header & Privilege Hierarchy Status Card */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl shrink-0 shadow-2xs border border-indigo-100">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  การกำหนดค่าผู้ใช้งาน
                </span>
                <span className="text-xs text-slate-500 font-medium">ทั้งหมด {users.length} บัญชี</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                จัดการผู้ใช้งานระบบ
              </h1>
              <p className="text-xs text-slate-500">
                กำหนดสิทธิ์ตามลำดับขั้น: <strong>ผู้ใช้สามารถจัดการสิทธิ์ได้เฉพาะผู้ที่มีสิทธิ์ต่ำกว่าตนเองเท่านั้น</strong>
              </p>
            </div>
          </div>

          {/* Current User Role Identity Pill */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="text-right">
              <div className="text-[11px] text-slate-400 font-bold uppercase">สิทธิ์การใช้งานของคุณ</div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 justify-end">
                <span>{currentUser.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${currentRoleInfo.badgeClass}`}>
                  {currentRoleInfo.icon} {currentRoleInfo.shortTitle} ({currentRoleInfo.levelName})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Hierarchy Explanation Banner */}
        <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-slate-50 border border-indigo-100/80 rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-indigo-600 text-white rounded-lg shrink-0 mt-0.5">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-indigo-950">
                  เงื่อนไขความปลอดภัย: จัดการสิทธิ์ได้เฉพาะผู้ที่มีสิทธิ์ต่ำกว่า
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  คุณอยู่ใน <strong>{currentRoleInfo.title} ({currentRoleInfo.levelName})</strong> — สามารถเพิ่ม แก้ไข กำหนดสิทธิ์ และลบผู้ใช้ได้เฉพาะบัญชีที่อยู่ในระดับต่ำกว่าคุณ (
                  {allowedAssignableRoles.length > 0 ? (
                    <span className="text-indigo-700 font-bold">
                      {allowedAssignableRoles.map(r => r.label.split('(')[0].trim()).join(', ')}
                    </span>
                  ) : (
                    <span className="text-amber-700 font-bold">ไม่มีระดับสิทธิ์ต่ำกว่าให้จัดการ</span>
                  )}
                  ) ส่วนผู้ใช้ที่มีระดับสิทธิ์เท่ากันหรือสูงกว่าจะถูกล็อกไว้เพื่อความปลอดภัย
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHierarchyGuide(!showHierarchyGuide)}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-center shadow-2xs"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showHierarchyGuide ? 'ซ่อนแผนผังสิทธิ์' : 'ดูแผนผัง 4 ระดับสิทธิ์'}</span>
              {showHierarchyGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Expandable 4-tier hierarchy diagram */}
          {showHierarchyGuide && (
            <div className="mt-4 pt-4 border-t border-indigo-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-200">
              {/* Level 4: Super Admin */}
              <div className={`p-3 rounded-xl border transition-all ${
                currentUserLevel === 4
                  ? 'bg-purple-100/80 border-purple-400 ring-2 ring-purple-400/40 shadow-xs'
                  : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-black uppercase text-purple-900 flex items-center gap-1">
                    👑 ระดับ 4 (สูงสุด)
                  </span>
                  {currentUserLevel === 4 && (
                    <span className="text-[10px] bg-purple-600 text-white font-bold px-1.5 py-0.2 rounded-full">คุณ</span>
                  )}
                </div>
                <div className="font-bold text-xs text-slate-900">ผู้ดูแลระบบสูงสุด (Super Admin)</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  จัดการได้: <strong>Admin, Staff, Teacher</strong> (สร้าง/แก้/ลบได้ทุกบัญชี)
                </p>
              </div>

              {/* Level 3: Admin */}
              <div className={`p-3 rounded-xl border transition-all ${
                currentUserLevel === 3
                  ? 'bg-rose-100/80 border-rose-400 ring-2 ring-rose-400/40 shadow-xs'
                  : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-black uppercase text-rose-900 flex items-center gap-1">
                    🛡️ ระดับ 3
                  </span>
                  {currentUserLevel === 3 && (
                    <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded-full">คุณ</span>
                  )}
                </div>
                <div className="font-bold text-xs text-slate-900">ผู้ดูแลระบบ (Admin)</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  จัดการได้: <strong>Staff, Teacher</strong> (ไม่สามารถจัดการ Admin หรือ Super Admin)
                </p>
              </div>

              {/* Level 2: Staff */}
              <div className={`p-3 rounded-xl border transition-all ${
                currentUserLevel === 2
                  ? 'bg-amber-100/80 border-amber-400 ring-2 ring-amber-400/40 shadow-xs'
                  : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-black uppercase text-amber-900 flex items-center gap-1">
                    💼 ระดับ 2
                  </span>
                  {currentUserLevel === 2 && (
                    <span className="text-[10px] bg-amber-600 text-white font-bold px-1.5 py-0.2 rounded-full">คุณ</span>
                  )}
                </div>
                <div className="font-bold text-xs text-slate-900">เจ้าหน้าที่ (Staff)</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  จัดการได้: <strong>Teacher</strong> (ไม่สามารถจัดการ Staff, Admin, Super Admin)
                </p>
              </div>

              {/* Level 1: Teacher */}
              <div className={`p-3 rounded-xl border transition-all ${
                currentUserLevel === 1
                  ? 'bg-indigo-100/80 border-indigo-400 ring-2 ring-indigo-400/40 shadow-xs'
                  : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-black uppercase text-indigo-900 flex items-center gap-1">
                    👨‍🏫 ระดับ 1
                  </span>
                  {currentUserLevel === 1 && (
                    <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.2 rounded-full">คุณ</span>
                  )}
                </div>
                <div className="font-bold text-xs text-slate-900">ครูผู้สอน / ครูที่ปรึกษา</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  ไม่มีสิทธิ์ต่ำกว่าให้จัดการ (สามารถดูข้อมูลและเปลี่ยนรหัสผ่านของตนเองได้)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
        {/* Navigation Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
          <button
            type="button"
            onClick={() => setActiveFilterTab('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilterTab === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            ผู้ใช้ทั้งหมด ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilterTab('MANAGEABLE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilterTab === 'MANAGEABLE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>สิทธิ์ต่ำกว่าที่คุณจัดการได้ ({manageableUsersCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilterTab('RESTRICTED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilterTab === 'RESTRICTED'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>สิทธิ์เท่ากันหรือสูงกว่า ({restrictedUsersCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilterTab('SELF')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilterTab === 'SELF'
                ? 'bg-indigo-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            บัญชีของฉัน
          </button>
        </div>

        {/* Controls Bar: Search + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={userSearchQuery}
              onChange={e => setUserSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อผู้ใช้, ชื่อ-นามสกุล, หรือสังกัด..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {filteredUsers.length > 0 && (
              <button
                type="button"
                onClick={handleToggleExpandAllUsers}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="ขยาย/ยุบรายละเอียดทั้งหมด"
              >
                <ChevronsUpDown className="w-4 h-4" />
                <span>{expandedUserIds.size === filteredUsers.length ? 'ยุบทั้งหมด' : 'ขยายทั้งหมด'}</span>
              </button>
            )}

            {isSuperAdmin(currentUser) && onNavigateToMenuPermissions && (
              <button
                type="button"
                onClick={onNavigateToMenuPermissions}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                title="กำหนดว่าบทบาทใด (ครู/เจ้าหน้าที่/นักเรียน) สามารถเข้าถึงเมนูใดได้บ้าง"
              >
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>จัดการสิทธิ์เมนู</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenAddUser}
              disabled={allowedAssignableRoles.length === 0}
              className={`px-4 py-2 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                allowedAssignableRoles.length > 0
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
              }`}
              title={
                allowedAssignableRoles.length > 0
                  ? `เพิ่มผู้ใช้ใหม่ (สิทธิ์ที่สามารถกำหนดได้: ${allowedAssignableRoles.map(r => r.role).join(', ')})`
                  : 'สิทธิ์ของคุณไม่มีสิทธิ์ที่ต่ำกว่าให้สร้างบัญชีผู้ใช้ใหม่'
              }
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มผู้ใช้งานใหม่</span>
            </button>
          </div>
        </div>

        {/* Operation Alert Notification */}
        {userOperationMsg && (
          <div
            className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 ${
              userOperationMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {userOperationMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{userOperationMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setUserOperationMsg(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Users Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-4">ชื่อผู้ใช้ (Username)</th>
                <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                <th className="py-3 px-4">ระดับสิทธิ์ (Role & Level)</th>
                <th className="py-3 px-4">สถานะสิทธิ์การจัดการ</th>
                <th className="py-3 px-4">กลุ่มสาระ/ฝ่าย</th>
                <th className="py-3 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <UserX className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <div>ไม่พบรายชื่อผู้ใช้งานตามเงื่อนไขที่เลือก</div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const isExpanded = expandedUserIds.has(u.id);
                  const isSelf = u.id === currentUser.id || u.username?.toLowerCase() === currentUser.username?.toLowerCase();
                  const canManage = canManageTargetUser(currentUser, u);
                  const canDelete = canDeleteTargetUser(currentUser, u);
                  const canChangePassword = canEditUserPassword(currentUser, u);
                  const targetRoleInfo = getRoleDisplayInfo(u);

                  return (
                    <React.Fragment key={u.id}>
                      <tr
                        onClick={() => toggleUserExpand(u.id)}
                        className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-indigo-50/20' : ''
                        } ${isSelf ? 'bg-amber-50/30' : ''}`}
                      >
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleUserExpand(u.id);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-200/70 text-slate-500 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{u.username}</span>
                            {u.username === 'admin' && (
                              <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-200 px-1.5 py-0.2 rounded font-sans font-bold">
                                หลัก
                              </span>
                            )}
                            {isSelf && (
                              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded font-sans font-bold">
                                ตัวคุณ
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-medium text-slate-800">
                          {u.name}
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${targetRoleInfo.badgeClass}`}>
                            <span>{targetRoleInfo.icon}</span>
                            <span>{targetRoleInfo.shortTitle} ({targetRoleInfo.levelName})</span>
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {isSelf ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <span>👤</span> บัญชีของคุณ (แก้ไขตนเองได้)
                            </span>
                          ) : canManage ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> สิทธิ์ต่ำกว่า (จัดการได้)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              <Lock className="w-3 h-3 text-slate-400" /> สิทธิ์เท่ากัน/สูงกว่า (ดูอย่างเดียว)
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          {u.department || '-'}
                        </td>

                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {/* ปุ่มแก้ไข/รีเซ็ตรหัสผ่าน */}
                          <button
                            type="button"
                            onClick={() => setSelectedUserForPasswordChange(u)}
                            disabled={!canChangePassword}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              canChangePassword
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-slate-300 cursor-not-allowed opacity-40'
                            }`}
                            title={
                              canChangePassword
                                ? (isSelf
                                    ? 'เปลี่ยนรหัสผ่านของคุณ'
                                    : `รีเซ็ตรหัสผ่านสำหรับ ${u.name} (มีสิทธิ์ต่ำกว่า)`)
                                : 'ไม่อนุญาต: สามารถจัดการรหัสผ่านได้เฉพาะผู้ที่มีสิทธิ์ต่ำกว่า หรือบัญชีตนเองเท่านั้น'
                            }
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          {/* ปุ่มแก้ไขข้อมูล */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditUser(u)}
                            disabled={!isSelf && !canManage}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isSelf || canManage
                                ? 'text-indigo-600 hover:bg-indigo-50'
                                : 'text-slate-300 cursor-not-allowed opacity-40'
                            }`}
                            title={
                              isSelf
                                ? 'แก้ไขข้อมูลบัญชีของคุณ'
                                : canManage
                                ? `แก้ไขข้อมูลและสิทธิ์ (${u.name})`
                                : 'ไม่อนุญาต: คุณสามารถแก้ไขข้อมูลได้เฉพาะผู้ที่มีระดับสิทธิ์ต่ำกว่าเท่านั้น'
                            }
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* ปุ่มลบผู้ใช้งาน */}
                          <button
                            type="button"
                            onClick={() => handleDeleteUserClick(u)}
                            disabled={!canDelete}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              canDelete
                                ? 'text-rose-600 hover:bg-rose-50'
                                : 'text-slate-300 cursor-not-allowed opacity-30'
                            }`}
                            title={
                              u.id === 'admin' || u.username === 'admin'
                                ? 'บัญชีผู้ดูแลหลัก ห้ามลบ'
                                : isSelf
                                ? 'ไม่สามารถลบบัญชีของตนเองได้'
                                : canDelete
                                ? `ลบผู้ใช้งาน ${u.name}`
                                : 'ไม่อนุญาต: ลบได้เฉพาะผู้ที่มีระดับสิทธิ์ต่ำกว่าคุณเท่านั้น'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                      {/* Accordion Detail Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-100">
                          <td colSpan={7} className="p-4 sm:p-5">
                            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-100">
                                    {u.username.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                      <span>{u.name}</span>
                                      <span className="font-mono text-slate-400 font-normal">(@{u.username})</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                      <span>ระดับสิทธิ์: {targetRoleInfo.title}</span>
                                      <span className="text-slate-300">•</span>
                                      <span>ID: {u.id}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  {canChangePassword && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedUserForPasswordChange(u)}
                                      className="px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-amber-200"
                                    >
                                      <Key className="w-3.5 h-3.5 text-amber-600" />
                                      <span>{isSelf ? 'เปลี่ยนรหัสผ่านของฉัน' : 'รีเซ็ตรหัสผ่าน'}</span>
                                    </button>
                                  )}

                                  {(isSelf || canManage) && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditUser(u)}
                                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer border border-indigo-200/60"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                      <span>แก้ไขข้อมูล</span>
                                    </button>
                                  )}

                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUserClick(u)}
                                      className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer border border-rose-200/60"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>ลบผู้ใช้</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                                  <span className="text-slate-400 font-bold text-[10px] uppercase">ระดับสิทธิ์และหน้าที่</span>
                                  <p className="font-bold text-slate-800 flex items-center gap-1">
                                    <span>{targetRoleInfo.icon}</span>
                                    <span>{targetRoleInfo.title}</span>
                                  </p>
                                  <p className="text-[11px] text-slate-500 leading-relaxed">
                                    {targetRoleInfo.description}
                                  </p>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                                  <span className="text-slate-400 font-bold text-[10px] uppercase">สังกัด / กลุ่มสาระการเรียนรู้</span>
                                  <p className="font-bold text-slate-800">{u.department || 'ไม่ระบุ'}</p>
                                  <span className="text-[11px] text-slate-500">
                                    ใช้จำแนกสังกัดในการบันทึกคะแนนและรายงานผล
                                  </span>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                                  <span className="text-slate-400 font-bold text-[10px] uppercase">ความสัมพันธ์ทางสิทธิ์กับคุณ</span>
                                  <div className="pt-0.5">
                                    {isSelf ? (
                                      <p className="text-amber-800 font-bold flex items-center gap-1 text-xs">
                                        👤 บัญชีของคุณเอง
                                      </p>
                                    ) : canManage ? (
                                      <p className="text-emerald-700 font-bold flex items-center gap-1 text-xs">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> สิทธิ์ต่ำกว่า (คุณมีสิทธิ์จัดการได้)
                                      </p>
                                    ) : (
                                      <p className="text-slate-600 font-bold flex items-center gap-1 text-xs">
                                        <Lock className="w-3.5 h-3.5 text-slate-400" /> สิทธิ์เท่ากัน/สูงกว่า (ได้รับการป้องกัน)
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-500">
                                    {isSelf
                                      ? 'สามารถแก้ไขข้อมูลส่วนตัวและรหัสผ่านได้'
                                      : canManage
                                      ? `คุณ (ระดับ ${currentUserLevel}) > บัญชีนี้ (ระดับ ${targetRoleInfo.level})`
                                      : `คุณ (ระดับ ${currentUserLevel}) ≤ บัญชีนี้ (ระดับ ${targetRoleInfo.level}) จึงไม่ได้รับอนุญาตให้จัดการ`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Sub-Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="bg-indigo-900 text-white p-4.5 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">
                  {editingUser
                    ? (editingUser.id === currentUser.id ? 'แก้ไขข้อมูลส่วนตัวของคุณ' : `แก้ไขข้อมูลผู้ใช้: ${editingUser.name}`)
                    : 'เพิ่มผู้ใช้งานระบบใหม่ (สิทธิ์ต่ำกว่าคุณ)'}
                </h4>
                <p className="text-[11px] text-indigo-200">
                  {editingUser && editingUser.id === currentUser.id
                    ? 'คุณสามารถแก้ไขข้อมูลส่วนตัวได้ (ระดับสิทธิ์จะถูกคงไว้)'
                    : `คุณมีสิทธิ์ระดับ ${currentUserLevel} สามารถจัดการได้เฉพาะผู้มีสิทธิ์ต่ำกว่า`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-indigo-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  ชื่อผู้ใช้งาน (Username)
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingUser && (editingUser.username === 'admin' || editingUser.id === 'admin')}
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="เช่น teacher02, staff_somsak"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden disabled:opacity-60"
                />
              </div>

              {/* Password field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    รหัสผ่าน (Password)
                  </label>
                  {editingUser && (
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
                      <Key className="w-3 h-3 text-indigo-500" />
                      {editingUser.id === currentUser.id ? 'สิทธิ์ตนเอง' : 'สิทธิ์ผู้บังคับบัญชา'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required={!editingUser}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={editingUser ? "เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน" : "กำหนดรหัสผ่าน (อย่างน้อย 4 ตัวอักษร)"}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  ชื่อ-นามสกุล
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="เช่น ครูสมพร สอนดี"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                />
              </div>

              {/* Role select field: STRICTLY filtered to lower roles */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    บทบาทและระดับสิทธิ์ (Role Hierarchy)
                  </label>
                  {editingUser && editingUser.id === currentUser.id && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      🔒 คงสิทธิ์เดิม
                    </span>
                  )}
                </div>

                {editingUser && editingUser.id === currentUser.id ? (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span>{currentRoleInfo.icon}</span>
                      <span>{currentRoleInfo.title} ({currentRoleInfo.levelName})</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      คุณไม่สามารถเปลี่ยนระดับสิทธิ์ของตนเองได้ เพื่อป้องกันการยกระดับสิทธิ์โดยมิชอบ
                    </p>
                  </div>
                ) : (
                  <>
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value as any)}
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                    >
                      {allowedAssignableRoles.map(opt => (
                        <option key={opt.role} value={opt.role}>
                          {opt.icon} {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-indigo-700 font-medium mt-1">
                      ℹ️ คุณมีสิทธิ์ระดับ {currentUserLevel} สามารถกำหนดบทบาทได้เฉพาะระดับที่ต่ำกว่าคุณ: {allowedAssignableRoles.map(r => r.role).join(', ')}
                    </p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  กลุ่มสาระฯ / ฝ่ายงาน (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                  placeholder="เช่น ฝ่ายกิจการนักเรียน, กลุ่มสาระฯ ภาษาไทย"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="py-2 px-3 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {editingUser ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Password Confirm Modal */}
      <AdminPasswordConfirmModal
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        description={confirmAction.description}
        targetName={confirmAction.targetName}
        dangerLevel={confirmAction.dangerLevel}
        confirmButtonText={confirmAction.confirmButtonText}
        currentUser={currentUser}
        users={users}
        onClose={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmAction.onConfirm}
      />

      {/* Change Password Modal */}
      {selectedUserForPasswordChange && (
        <ChangePasswordModal
          isOpen={!!selectedUserForPasswordChange}
          onClose={() => setSelectedUserForPasswordChange(null)}
          currentUser={currentUser}
          targetUser={selectedUserForPasswordChange}
          onSavePassword={async (targetUserId, newPassword) => {
            const target = users.find(u => u.id === targetUserId);
            if (target) {
              await onSaveUser({
                ...target,
                password: newPassword
              });
              setUserOperationMsg({
                type: 'success',
                text: `เปลี่ยนรหัสผ่านสำหรับ "${target.name}" เรียบร้อยแล้ว`
              });
            }
          }}
        />
      )}
    </div>
  );
};
