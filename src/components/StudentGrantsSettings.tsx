import React, { useState, useMemo } from 'react';
import { StudentAccessGrant, AppUser } from '../types';
import {
  UserCheck,
  Search,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Trash2
} from 'lucide-react';

interface StudentGrantsSettingsProps {
  accessGrants: StudentAccessGrant[];
  currentUser: AppUser;
  onClose?: () => void;
  onRevokeGrant?: (grantId: string) => Promise<void> | void;
}

export const StudentGrantsSettings: React.FC<StudentGrantsSettingsProps> = ({
  accessGrants,
  currentUser,
  onClose,
  onRevokeGrant
}) => {
  const [grantSearchQuery, setGrantSearchQuery] = useState('');
  const [expandedGrantIds, setExpandedGrantIds] = useState<Set<string>>(new Set());

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'staff' || currentUser.role === 'teacher';

  const filteredGrants = useMemo(() => {
    if (!grantSearchQuery.trim()) return accessGrants;
    const q = grantSearchQuery.toLowerCase().trim();
    return accessGrants.filter(
      g =>
        g.studentName.toLowerCase().includes(q) ||
        g.studentId.includes(q) ||
        g.grantedByUserName.toLowerCase().includes(q)
    );
  }, [accessGrants, grantSearchQuery]);

  const toggleGrantExpand = (grantId: string) => {
    setExpandedGrantIds(prev => {
      const next = new Set(prev);
      if (next.has(grantId)) next.delete(grantId);
      else next.add(grantId);
      return next;
    });
  };

  const toggleAllGrants = () => {
    if (expandedGrantIds.size === filteredGrants.length) {
      setExpandedGrantIds(new Set());
    } else {
      setExpandedGrantIds(new Set(filteredGrants.map(g => g.id)));
    }
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header Breadcrumb Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-900 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                การกำหนดค่าระบบ
              </span>
              <span className="text-xs text-slate-500 font-medium">ทั้งหมด {accessGrants.length} รายการ</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              ประวัติสิทธิ์นักเรียน
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              ตรวจสอบประวัติการขอและอนุมัติสิทธิ์เข้าถึงข้อมูลนักเรียน
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          ผู้ใช้งาน: <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.role === 'admin' ? '🛡️ ผู้ดูแลระบบ' : currentUser.role === 'staff' ? '👤 เจ้าหน้าที่' : 'ครู'})
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={grantSearchQuery}
              onChange={e => setGrantSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อนักเรียน, รหัส หรือครูผู้อนุญาต..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {filteredGrants.length > 0 && (
              <button
                type="button"
                onClick={toggleAllGrants}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title={expandedGrantIds.size === filteredGrants.length ? 'ยุบแถวทั้งหมด' : 'ขยายแถวทั้งหมด'}
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
                <span>{expandedGrantIds.size === filteredGrants.length ? 'ยุบทั้งหมด' : 'ขยายทั้งหมด'}</span>
              </button>
            )}
            <div className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-2 rounded-xl">
              ทั้งหมด {accessGrants.length} รายการ
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">รหัสนักเรียน</th>
                <th className="py-3 px-3">ชื่อนักเรียน</th>
                <th className="py-3 px-3">ผู้อนุญาต</th>
                <th className="py-3 px-3">เวลาที่เริ่ม</th>
                <th className="py-3 px-3">หมดเวลา</th>
                <th className="py-3 px-3 text-center">สถานะ</th>
                {isAdmin && <th className="py-3 px-3 text-center">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredGrants.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="py-8 text-center text-slate-400">
                    ยังไม่มีประวัติการอนุญาตให้นักเรียนดู
                  </td>
                </tr>
              ) : (
                filteredGrants.map(g => {
                  const isExpanded = expandedGrantIds.has(g.id);
                  const isCurrentlyActive = g.isActive !== false && new Date(g.expiresAt) > new Date();

                  return (
                    <React.Fragment key={g.id}>
                      <tr
                        onClick={() => toggleGrantExpand(g.id)}
                        className={`hover:bg-indigo-50/40 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGrantExpand(g.id);
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
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{g.studentId}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{g.studentName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{g.grantedByUserName}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {new Date(g.grantedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {new Date(g.expiresAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isCurrentlyActive ? (
                            <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ใช้งานได้
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-rose-100 text-rose-800 border border-rose-200">
                              หมดอายุ/ยกเลิก
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                            {g.isActive !== false && (
                              <button
                                type="button"
                                onClick={() => onRevokeGrant && onRevokeGrant(g.id)}
                                className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                              >
                                ยกเลิกสิทธิ์
                              </button>
                            )}
                          </td>
                        )}
                      </tr>

                      {/* Accordion Detail Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-100">
                          <td colSpan={isAdmin ? 8 : 7} className="p-4 sm:p-5">
                            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                                    <KeyRound className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-800">รหัสใบอนุญาตชั่วคราว:</span>{' '}
                                    <span className="font-mono text-indigo-700 font-bold">{g.id}</span>
                                  </div>
                                </div>
                                {isAdmin && g.isActive !== false && (
                                  <button
                                    type="button"
                                    onClick={() => onRevokeGrant && onRevokeGrant(g.id)}
                                    className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs flex items-center gap-1 w-fit cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>ยกเลิกสิทธิ์การเข้าถึงนี้ทันที</span>
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                                  <span className="text-slate-400 font-bold text-[10px] uppercase">เหตุผล / บันทึกการอนุญาต</span>
                                  <p className="font-medium text-slate-800">{g.reason || 'ไม่ได้ระบุเหตุผล'}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                                  <span className="text-slate-400 font-bold text-[10px] uppercase">ผู้อนุญาต (Authorized By)</span>
                                  <p className="font-bold text-slate-800">{g.grantedByUserName}</p>
                                  <p className="text-[11px] text-slate-500 font-mono">User ID: {g.grantedByUserId || '-'}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                                  <span className="text-slate-400 font-bold text-[10px] uppercase">ช่วงเวลาที่อนุญาต</span>
                                  <p className="text-[11px] font-mono text-slate-700">
                                    เริ่ม: {new Date(g.grantedAt).toLocaleString('th-TH')}
                                  </p>
                                  <p className="text-[11px] font-mono text-slate-700">
                                    สิ้นสุด: {new Date(g.expiresAt).toLocaleString('th-TH')}
                                  </p>
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
    </div>
  );
};
