import React from 'react';
import { StandardConductBehavior, AppUser } from '../types';
import { StandardBehaviorManager } from './StandardBehaviorManager';
import { ListChecks } from 'lucide-react';

interface StandardBehaviorsSettingsProps {
  standardBehaviors: StandardConductBehavior[];
  currentUser: AppUser;
  onClose?: () => void;
  onSaveStandardBehavior: (behavior: StandardConductBehavior) => Promise<void>;
  onDeleteStandardBehavior: (id: string) => Promise<void>;
  onBatchSaveStandardBehaviors?: (behaviors: StandardConductBehavior[]) => Promise<number>;
}

export const StandardBehaviorsSettings: React.FC<StandardBehaviorsSettingsProps> = ({
  standardBehaviors,
  currentUser,
  onClose,
  onSaveStandardBehavior,
  onDeleteStandardBehavior,
  onBatchSaveStandardBehaviors
}) => {
  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header Breadcrumb Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 flex items-center gap-1">
                <ListChecks className="w-3.5 h-3.5 text-indigo-600" />
                การกำหนดค่าระบบ
              </span>
              <span className="text-xs text-slate-500 font-medium">ทั้งหมด {standardBehaviors.length} หัวข้อ</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              หัวข้อพฤติกรรมมาตรฐาน
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              จัดการหัวข้อและเกณฑ์คะแนนพฤติกรรมมาตรฐานในฐานข้อมูล สำหรับใช้เป็นตัวเลือกด่วน
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          ผู้ใช้งาน: <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.role === 'admin' ? '🛡️ ผู้ดูแลระบบ' : currentUser.role === 'staff' ? '👤 เจ้าหน้าที่' : 'ครู'})
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
        <StandardBehaviorManager
          behaviors={standardBehaviors}
          onSaveBehavior={onSaveStandardBehavior}
          onDeleteBehavior={onDeleteStandardBehavior}
          onBatchSaveBehaviors={onBatchSaveStandardBehaviors}
        />
      </div>
    </div>
  );
};
