import React, { useState } from 'react';
import { AppUser } from '../types';
import { isSuperAdmin, canEditUserPassword } from '../utils/menuPermissions';
import { Lock, Key, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, X, ShieldAlert } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  targetUser?: AppUser | null;
  onSavePassword: (targetUserId: string, newPassword: string) => Promise<void> | void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetUser,
  onSavePassword
}) => {
  const activeTarget = targetUser || currentUser;
  const isSelf = currentUser.id === activeTarget.id || currentUser.username.toLowerCase() === activeTarget.username.toLowerCase();
  const isSuper = isSuperAdmin(currentUser);
  const isAllowed = canEditUserPassword(currentUser, activeTarget);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate permission
    if (!isAllowed) {
      setErrorMsg('สิทธิ์การแก้ไขรหัสผ่านให้เฉพาะผู้ดูแลหลัก กับเจ้าของ user เท่านั้น');
      return;
    }

    // If changing own password, verify current password if existing in object
    if (isSelf && activeTarget.password) {
      if (currentPassword !== activeTarget.password) {
        setErrorMsg('รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        return;
      }
    }

    if (!newPassword || newPassword.trim().length < 4) {
      setErrorMsg('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSavePassword(activeTarget.id, newPassword.trim());
      setSuccessMsg(`เปลี่ยนรหัสผ่านสำหรับ ${activeTarget.name} สำเร็จเรียบร้อยแล้ว`);
      setTimeout(() => {
        handleClose();
      }, 1400);
    } catch (err: any) {
      setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการบันทึกรหัสผ่าน กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight text-white flex items-center gap-2">
                {isSelf ? 'เปลี่ยนรหัสผ่านของฉัน' : 'รีเซ็ตรหัสผ่านผู้ใช้งาน'}
              </h3>
              <p className="text-xs text-slate-300">
                {isSelf ? `บัญชี: @${activeTarget.username} (${activeTarget.name})` : `ผู้ใช้เป้าหมาย: ${activeTarget.name} (@${activeTarget.username})`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Rules Banner */}
        <div className="px-6 pt-4">
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800">
            <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">นโยบายความปลอดภัยระบบ:</span>
              <p className="text-[11px] text-amber-700 mt-0.5">
                สิทธิ์การแก้ไขรหัสผ่านอนุญาตให้เฉพาะ <strong>ผู้ดูแลหลัก (Super Admin)</strong> กับ <strong>เจ้าของบัญชี (User)</strong> เท่านั้น
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {!isAllowed ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">ไม่ได้รับอนุญาตให้แก้ไขรหัสผ่าน</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                คุณไม่มีสิทธิ์แก้ไขรหัสผ่านของบัญชีนี้ สิทธิ์การแก้ไขรหัสผ่านให้เฉพาะผู้ดูแลหลัก กับเจ้าของ user เท่านั้น
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span className="font-bold">{successMsg}</span>
                </div>
              )}

              {/* Status Badge */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-500 font-medium">สิทธิ์การแก้ไขของคุณ:</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                  isSuper ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {isSuper ? '👑 ผู้ดูแลหลัก (Super Admin)' : '👤 เจ้าของบัญชีผู้ใช้'}
                </span>
              </div>

              {/* Current Password (only required when changing own password) */}
              {isSelf && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    รหัสผ่านเดิม (ปัจจุบัน) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านปัจจุบันของคุณ"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  รหัสผ่านใหม่ <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="ตั้งรหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ยืนยันรหัสผ่านใหม่อีกครั้ง <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้งเพื่อยืนยัน"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
