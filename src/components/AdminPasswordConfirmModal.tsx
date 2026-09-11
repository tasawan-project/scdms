import React, { useState } from 'react';
import { AppUser } from '../types';
import { DEFAULT_ADMIN_USER } from '../firebase';
import {
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  X,
  CheckCircle2,
  KeyRound,
  Loader2,
  Trash2
} from 'lucide-react';

interface AdminPasswordConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  targetName?: string;
  dangerLevel?: 'danger' | 'warning';
  confirmButtonText?: string;
  users?: AppUser[];
  currentUser?: AppUser | null;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export const AdminPasswordConfirmModal: React.FC<AdminPasswordConfirmModalProps> = ({
  isOpen,
  title,
  description,
  targetName,
  dangerLevel = 'danger',
  confirmButtonText = 'ยืนยันการลบข้อมูล',
  users = [],
  currentUser = null,
  onConfirm,
  onClose
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!password.trim()) {
      setErrorMsg('กรุณากรอกรหัสผ่านเพื่อยืนยัน');
      return;
    }

    // Collect valid passwords
    const validPasswords = new Set<string>();
    
    // 1. Default admin password
    if (DEFAULT_ADMIN_USER.password) {
      validPasswords.add(DEFAULT_ADMIN_USER.password);
    }

    // 2. Current user's password (regardless of role - staff/teacher/admin who has menu access)
    if (currentUser && currentUser.password) {
      validPasswords.add(currentUser.password);
    }

    // 3. Matched user from users collection
    if (currentUser && users.length > 0) {
      const match = users.find(u => u.id === currentUser.id || u.username?.toLowerCase() === currentUser.username?.toLowerCase());
      if (match && match.password) {
        validPasswords.add(match.password);
      }
    }

    // 4. Any admin user in users collection
    users
      .filter(u => u.role === 'admin' && u.password)
      .forEach(u => validPasswords.add(u.password!));

    // 5. Check local admin pass if stored
    try {
      const localAdminPass = localStorage.getItem('pcccr_admin_pass');
      if (localAdminPass) validPasswords.add(localAdminPass);
    } catch {
      // Ignore storage errors
    }

    const isMatch = validPasswords.has(password.trim());

    if (!isMatch) {
      setErrorMsg('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm();
      setPassword('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการดำเนินการ');
    } finally {
      setIsProcessing(false);
    }
  };

  const isDanger = dangerLevel === 'danger';

  return (
    <div className="fixed inset-0 z-70 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div
          className={`p-5 sm:p-6 text-white flex items-start justify-between ${
            isDanger ? 'bg-rose-600' : 'bg-amber-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 shadow-inner">
              {isDanger ? (
                <ShieldAlert className="w-6 h-6 text-white" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">{title}</h3>
              <p className="text-xs text-white/90 mt-0.5 font-medium">
                {currentUser 
                  ? `ระบบความปลอดภัย: ยืนยันโดย ${currentUser.name} (${currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : currentUser.role === 'staff' ? 'เจ้าหน้าที่' : 'ครู'})`
                  : 'ระบบความปลอดภัย: ต้องใช้รหัสผ่านยืนยันการดำเนินการ'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div className="space-y-2">
            {targetName && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                  รายการที่จะดำเนินการ:
                </span>
                <span className="text-xs font-bold text-slate-800 font-mono break-all">
                  {targetName}
                </span>
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed">
              {description}
            </p>
          </div>

          {/* Password Input Box */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {currentUser 
                  ? `กรอกรหัสผ่านของคุณ (${currentUser.name}) หรือรหัสผ่านผู้ดูแลระบบ` 
                  : 'กรอกรหัสผ่านเพื่อยืนยัน'}
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder={currentUser ? `กรอกรหัสผ่านของคุณ (@${currentUser.username})` : 'กรอกรหัสผ่านเพื่อยืนยัน'}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              {currentUser 
                ? `* สามารถใช้รหัสผ่านของบัญชีคุณ (@${currentUser.username}) หรือรหัสผ่านผู้ดูแลระบบ (Admin) เพื่อยืนยันความถูกต้อง`
                : '* ต้องใช้รหัสผ่านเพื่อยืนยันการดำเนินการ'}
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold animate-in fade-in">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isProcessing || !password.trim()}
              className={`px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isDanger
                  ? 'bg-rose-600 hover:bg-rose-700 active:scale-98'
                  : 'bg-amber-600 hover:bg-amber-700 active:scale-98'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังดำเนินการ...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>{confirmButtonText}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
