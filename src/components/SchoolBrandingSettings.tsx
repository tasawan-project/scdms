import React, { useState, useRef } from 'react';
import { SystemSettings, AppUser } from '../types';
import {
  School,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Sparkles,
  Save,
  Calendar,
  Lock
} from 'lucide-react';

interface SchoolBrandingSettingsProps {
  systemSettings: SystemSettings;
  currentUser: AppUser;
  onClose?: () => void;
  onSaveSettings?: (settings: SystemSettings) => Promise<void> | void;
  onUpdateSettings?: (settings: SystemSettings) => Promise<void> | void;
}

export const SchoolBrandingSettings: React.FC<SchoolBrandingSettingsProps> = ({
  systemSettings,
  currentUser,
  onClose,
  onSaveSettings,
  onUpdateSettings
}) => {
  const [schoolNameTh, setSchoolNameTh] = useState(systemSettings.schoolNameTh || systemSettings.schoolName || '');
  const [schoolNameEn, setSchoolNameEn] = useState(systemSettings.schoolNameEn || '');
  const [appNameTh, setAppNameTh] = useState(systemSettings.appNameTh || '');
  const [appNameEn, setAppNameEn] = useState(systemSettings.appNameEn || '');
  const [logoUrl, setLogoUrl] = useState(systemSettings.logoUrl || '');
  const [academicYear, setAcademicYear] = useState(systemSettings.currentAcademicYear);
  const [currentTerm, setCurrentTerm] = useState(systemSettings.currentTerm);
  const [criticalThreshold, setCriticalThreshold] = useState(
    systemSettings.criticalScoreThreshold ?? systemSettings.criticalThreshold ?? 70
  );
  const [watchThreshold, setWatchThreshold] = useState(
    systemSettings.watchScoreThreshold ?? systemSettings.warningScoreThreshold ?? 30
  );
  const [cautionThreshold, setCautionThreshold] = useState(
    systemSettings.cautionScoreThreshold ?? 20
  );
  const [maxBankedPointsCap, setMaxBankedPointsCap] = useState(
    systemSettings.maxBankedPointsCap ?? 50
  );
  const [requireLoginBeforeAccess, setRequireLoginBeforeAccess] = useState(
    systemSettings.requireLoginBeforeAccess !== false
  );

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('ขนาดไฟล์รูปภาพต้องไม่เกิน 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLogoUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(false);

    try {
      const updated: SystemSettings = {
        ...systemSettings,
        schoolNameTh: schoolNameTh.trim(),
        schoolNameEn: schoolNameEn.trim(),
        appNameTh: appNameTh.trim(),
        appNameEn: appNameEn.trim(),
        schoolName: schoolNameTh.trim(),
        logoUrl: logoUrl.trim(),
        currentAcademicYear: Number(academicYear),
        currentTerm: Number(currentTerm),
        criticalScoreThreshold: Number(criticalThreshold),
        watchScoreThreshold: Number(watchThreshold),
        cautionScoreThreshold: Number(cautionThreshold),
        maxBankedPointsCap: Number(maxBankedPointsCap),
        warningScoreThreshold: Number(watchThreshold),
        requireLoginBeforeAccess: Boolean(requireLoginBeforeAccess)
      };

      const saveFn = onSaveSettings || onUpdateSettings;
      if (saveFn) await saveFn(updated);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header Breadcrumb Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 flex items-center gap-1">
                <School className="w-3.5 h-3.5 text-indigo-600" />
                การกำหนดค่าระบบ
              </span>
              <span className="text-xs text-slate-500 font-medium">ปีการศึกษา {academicYear}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              ข้อมูลโรงเรียนและระบบ
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              กำหนดชื่อโรงเรียน ตราสัญลักษณ์ ปีการศึกษา และเกณฑ์คะแนนความประพฤติ
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          ผู้ใช้งาน: <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.role === 'admin' ? '🛡️ ผู้ดูแลระบบ' : currentUser.role === 'staff' ? '👤 เจ้าหน้าที่' : 'ครู'})
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
        <form onSubmit={handleSaveBranding} className="space-y-6 w-full max-w-5xl">
          {settingsSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>บันทึกการตั้งค่าระบบเรียบร้อยแล้ว</span>
            </div>
          )}

          {/* Logo Section */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase">
              โลโก้โรงเรียน (อัปโหลดจากเครื่อง)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 p-2 flex items-center justify-center shadow-xs overflow-hidden flex-shrink-0">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-300" />
                )}
              </div>

              <div className="space-y-2 flex-1 text-center sm:text-left">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์ภาพจากเครื่อง</span>
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      ลบโลโก้
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  แนะนำ: ไฟล์ PNG หรือ JPG พื้นหลังโปร่งใสหรือสีขาว
                </p>
              </div>
            </div>
          </div>

          {/* School Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ชื่อโรงเรียน (ภาษาไทย)
              </label>
              <input
                type="text"
                value={schoolNameTh}
                onChange={e => setSchoolNameTh(e.target.value)}
                placeholder="เช่น โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย เชียงราย"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ชื่อโรงเรียน (ภาษาอังกฤษ)
              </label>
              <input
                type="text"
                value={schoolNameEn}
                onChange={e => setSchoolNameEn(e.target.value)}
                placeholder="e.g. Princess Chulabhorn Science High School Chiang Rai"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* App Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ชื่อระบบ/โปรแกรม (ภาษาไทย)
              </label>
              <input
                type="text"
                value={appNameTh}
                onChange={e => setAppNameTh(e.target.value)}
                placeholder="เช่น ระบบบันทึกคะแนนความประพฤตินักเรียน"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ชื่อระบบ/โปรแกรม (ภาษาอังกฤษ)
              </label>
              <input
                type="text"
                value={appNameEn}
                onChange={e => setAppNameEn(e.target.value)}
                placeholder="e.g. Student Conduct Scoring System"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Academic Year and Term */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>ปีการศึกษาปัจจุบัน (พ.ศ.)</span>
              </label>
              <input
                type="number"
                value={academicYear}
                onChange={e => setAcademicYear(parseInt(e.target.value) || 2568)}
                min="2560"
                max="2600"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ภาคเรียนปัจจุบัน
              </label>
              <select
                value={currentTerm}
                onChange={e => setCurrentTerm(parseInt(e.target.value) || 1)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value={1}>ภาคเรียนที่ 1</option>
                <option value={2}>ภาคเรียนที่ 2</option>
              </select>
            </div>
          </div>

          {/* Conduct Score Threshold Criteria Configuration */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span>เกณฑ์การประเมินสถานะความประพฤติ (คะแนนเต็ม 100 แต้ม)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                กำหนดเกณฑ์แต้มหักสะสมสำหรับแต่ละสถานะ และเพดานคะแนนสะสมสูงสุด (บวกแต้ม)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. วิกฤต (Critical) */}
              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                    <span>วิกฤต (หักแต้มสะสม)</span>
                  </label>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-md">
                    ขั้นต่ำ
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={criticalThreshold}
                    onChange={e => setCriticalThreshold(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs font-mono font-bold text-rose-900 focus:ring-2 focus:ring-rose-500 focus:outline-hidden text-center"
                  />
                </div>
                <p className="text-[10px] text-rose-700 leading-tight">
                  หักสะสมตั้งแต่ <strong>{criticalThreshold}</strong> แต้มขึ้นไป (คะแนนคงเหลือ ≤ {Math.max(0, 100 - (criticalThreshold < 50 ? criticalThreshold : 100 - criticalThreshold))})
                </p>
              </div>

              {/* 2. เฝ้าระวัง (Watch) */}
              <div className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-orange-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-600" />
                    <span>เฝ้าระวัง (หักแต้มสะสม)</span>
                  </label>
                  <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-md">
                    ขั้นต่ำ
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={watchThreshold}
                    onChange={e => setWatchThreshold(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-orange-300 rounded-xl text-xs font-mono font-bold text-orange-900 focus:ring-2 focus:ring-orange-500 focus:outline-hidden text-center"
                  />
                </div>
                <p className="text-[10px] text-orange-700 leading-tight">
                  หักสะสมถึง <strong>{watchThreshold}</strong> แต้ม (คะแนนคงเหลือ ≤ {Math.max(0, 100 - (watchThreshold < 50 ? watchThreshold : 100 - watchThreshold))})
                </p>
              </div>

              {/* 3. ตักเตือน (Caution) */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                    <span>ตักเตือน (หักแต้มสะสม)</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
                    ขั้นต่ำ
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={cautionThreshold}
                    onChange={e => setCautionThreshold(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold text-amber-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-center"
                  />
                </div>
                <p className="text-[10px] text-amber-700 leading-tight">
                  หักสะสมถึง <strong>{cautionThreshold}</strong> แต้ม (คะแนนคงเหลือ ≤ {Math.max(0, 100 - (cautionThreshold < 50 ? cautionThreshold : 100 - cautionThreshold))})
                </p>
              </div>

              {/* 4. ยอดเยี่ยม - คะแนนสะสมสูงสุด (Max Banked Points Cap) */}
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    <span>ยอดเยี่ยม (สะสมสูงสุด)</span>
                  </label>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-md">
                    เพดานแต้ม
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={maxBankedPointsCap}
                    onChange={e => setMaxBankedPointsCap(parseInt(e.target.value) || 0)}
                    placeholder="0 = ไม่จำกัด"
                    className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl text-xs font-mono font-bold text-purple-900 focus:ring-2 focus:ring-purple-500 focus:outline-hidden text-center"
                  />
                </div>
                <p className="text-[10px] text-purple-700 leading-tight">
                  {maxBankedPointsCap > 0
                    ? `เก็บคะแนนสะสมได้สูงสุด +${maxBankedPointsCap} แต้ม`
                    : 'ไม่จำกัดเพดานคะแนนสะสม (0 = ไม่จำกัด)'}
                </p>
              </div>
            </div>

            {/* Live Criteria Preview */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>ตัวอย่างการประเมินสถานะตามเกณฑ์ที่ตั้งไว้ (ทุกส่วนในระบบจะอ้างอิงจากตรงนี้):</span>
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-purple-50 border border-purple-200">
                  <div className="font-bold text-purple-700 text-[11px]">ยอดเยี่ยม</div>
                  <div className="text-[11px] text-slate-600 mt-0.5 font-medium">คะแนน 100 + แต้มบวก</div>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="font-bold text-emerald-700 text-[11px]">ปกติ</div>
                  <div className="text-[11px] text-slate-600 mt-0.5 font-medium">
                    {Math.max(0, 100 - cautionThreshold) + 1} - 100 แต้ม
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="font-bold text-amber-700 text-[11px]">ตักเตือน / เฝ้าระวัง</div>
                  <div className="text-[11px] text-slate-600 mt-0.5 font-medium">
                    {Math.max(0, 100 - criticalThreshold) + 1} - {Math.max(0, 100 - cautionThreshold)} แต้ม
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="font-bold text-rose-700 text-[11px]">วิกฤต</div>
                  <div className="text-[11px] text-slate-600 mt-0.5 font-medium">
                    ≤ {Math.max(0, 100 - criticalThreshold)} แต้ม
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Access Control and Security Setting */}
          <div className="p-5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      การควบคุมการเข้าถึงระบบ (Access Control & Login Policy)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                      ความปลอดภัย
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-xl">
                    <strong>ต้องเข้าสู่ระบบก่อนจึงสามารถเข้าใช้ระบบได้</strong> — เมื่อเปิดใช้งาน ผู้ใช้งานทุกคนต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ ครู/เจ้าหน้าที่ หรือตรวจสอบสิทธิ์นักเรียนก่อน จึงจะสามารถเข้าถึงและใช้งานระบบได้ และเซสชันการเข้าสู่ระบบจะสิ้นสุดลงทันทีเมื่อผู้ใช้ปิดหน้าต่างเบราว์เซอร์หรือกดออกจากระบบ (Session-based Authentication)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pl-13 sm:pl-0">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireLoginBeforeAccess}
                    onChange={e => setRequireLoginBeforeAccess(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                  {requireLoginBeforeAccess ? (
                    <span className="text-indigo-700">เปิดใช้งาน (ต้อง Login ก่อน)</span>
                  ) : (
                    <span className="text-slate-500">ปิดใช้งาน (เข้าดูสาธารณะได้)</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าระบบ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
