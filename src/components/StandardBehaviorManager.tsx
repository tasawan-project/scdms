import React, { useState, useMemo } from 'react';
import {
  ListChecks,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  PlusCircle,
  Database,
  RotateCcw,
  Sparkles,
  Save,
  X,
  Layers,
  Filter
} from 'lucide-react';
import { StandardConductBehavior, ConductType } from '../types';
import { INITIAL_STANDARD_BEHAVIORS } from '../data/standardBehaviorsData';

interface StandardBehaviorManagerProps {
  behaviors: StandardConductBehavior[];
  onSaveBehavior: (behavior: StandardConductBehavior) => Promise<void>;
  onDeleteBehavior: (id: string) => Promise<void>;
  onBatchSaveBehaviors?: (behaviors: StandardConductBehavior[]) => Promise<number>;
  onSelectBehavior?: (behavior: StandardConductBehavior) => void;
  isSelectMode?: boolean;
}

export const StandardBehaviorManager: React.FC<StandardBehaviorManagerProps> = ({
  behaviors,
  onSaveBehavior,
  onDeleteBehavior,
  onBatchSaveBehaviors,
  onSelectBehavior,
  isSelectMode = false
}) => {
  const [filterType, setFilterType] = useState<'ALL' | ConductType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  
  // Modal / Form state for Add or Edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ConductType>('DEDUCT');
  const [points, setPoints] = useState<number>(5);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Deletion confirm modal state
  const [deletingBehavior, setDeletingBehavior] = useState<StandardConductBehavior | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Re-seed confirmation
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Feedback notification
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    behaviors.forEach(b => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  }, [behaviors]);

  // Filtered behaviors
  const filteredBehaviors = useMemo(() => {
    const seen = new Set<string>();
    return behaviors.filter(b => {
      if (!b || !b.id || seen.has(b.id)) return false;
      seen.add(b.id);
      if (filterType !== 'ALL' && b.type !== filterType) return false;
      if (selectedCategory !== 'ALL' && b.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (b.title || '').toLowerCase().includes(q);
        const matchCat = (b.category || '').toLowerCase().includes(q);
        const matchDesc = (b.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCat && !matchDesc) return false;
      }
      return true;
    });
  }, [behaviors, filterType, selectedCategory, searchQuery]);

  const openAddModal = (presetType?: ConductType) => {
    setEditingId(null);
    setTitle('');
    setType(presetType || (filterType !== 'ALL' ? filterType : 'DEDUCT'));
    setPoints(presetType === 'ADD' ? 10 : 5);
    setCategory(presetType === 'ADD' ? 'จิตอาสา' : 'การเข้าเรียนและวินัย');
    setDescription('');
    setIsFormOpen(true);
  };

  const openEditModal = (b: StandardConductBehavior) => {
    setEditingId(b.id);
    setTitle(b.title);
    setType(b.type);
    setPoints(b.points);
    setCategory(b.category);
    setDescription(b.description || '');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('กรุณากรอกชื่อหรือหัวข้อพฤติกรรม');
      return;
    }
    if (points <= 0) {
      alert('จำนวนคะแนนต้องมากกว่า 0');
      return;
    }
    if (!category.trim()) {
      alert('กรุณาระบุหมวดหมู่พฤติกรรม');
      return;
    }

    setIsSaving(true);
    try {
      const id = editingId || `bhv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newBehavior: StandardConductBehavior = {
        id,
        title: title.trim(),
        type,
        points: Number(points),
        category: category.trim(),
        description: description.trim(),
        isActive: true,
        createdAt: editingId ? undefined : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSaveBehavior(newBehavior);
      setIsFormOpen(false);
      showNotification(editingId ? 'แก้ไขพฤติกรรมมาตรฐานสำเร็จ' : 'เพิ่มพฤติกรรมมาตรฐานใหม่ลงฐานข้อมูลสำเร็จ');

      if (isSelectMode && onSelectBehavior) {
        onSelectBehavior(newBehavior);
      }
    } catch (err: any) {
      console.error('Error saving behavior:', err);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBehavior) return;
    setIsDeleting(true);
    try {
      await onDeleteBehavior(deletingBehavior.id);
      showNotification(`ลบ "${deletingBehavior.title}" ออกจากฐานข้อมูลเรียบร้อยแล้ว`);
      setDeletingBehavior(null);
    } catch (err: any) {
      console.error('Error deleting behavior:', err);
      alert('เกิดข้อผิดพลาดในการลบ: ' + (err.message || ''));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!onBatchSaveBehaviors) return;
    setIsSeeding(true);
    try {
      const count = await onBatchSaveBehaviors(INITIAL_STANDARD_BEHAVIORS);
      showNotification(`นำเข้าชุดเกณฑ์มาตรฐานของโรงเรียนเข้าสู่ฐานข้อมูลเรียบร้อยแล้ว (${count} รายการ)`);
      setShowSeedConfirm(false);
    } catch (err: any) {
      console.error('Error restoring default behaviors:', err);
      alert('เกิดข้อผิดพลาดในการนำเข้าข้อมูล: ' + (err.message || ''));
    } finally {
      setIsSeeding(false);
    }
  };

  const deductCount = behaviors.filter(b => b.type === 'DEDUCT').length;
  const addCount = behaviors.filter(b => b.type === 'ADD').length;

  return (
    <div className="space-y-6">
      {/* Alert Notification Toast */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2.5 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                <Database className="w-5 h-5 text-indigo-300" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">หัวข้อหรือพฤติกรรมมาตรฐาน (ในฐานข้อมูล)</h2>
            </div>
            <p className="text-sm text-slate-300 max-w-xl">
              จัดการเกณฑ์คะแนนพฤติกรรมมาตรฐานที่บันทึกในฐานข้อมูล Firestore สำหรับใช้เป็นตัวเลือกด่วนในการตัด/เพิ่มคะแนนนักเรียน
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onBatchSaveBehaviors && behaviors.length < 5 && (
              <button
                type="button"
                onClick={() => setShowSeedConfirm(true)}
                className="px-3.5 py-2 text-xs font-semibold text-indigo-200 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="นำเข้าชุดเกณฑ์มาตรฐานของโรงเรียน 17 รายการเข้าสู่ฐานข้อมูล"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>นำเข้าชุดเกณฑ์มาตรฐานของโรงเรียน</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openAddModal()}
              className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มพฤติกรรมมาตรฐานใหม่</span>
            </button>
          </div>
        </div>

        {/* Quick count chips */}
        <div className="flex flex-wrap gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
            <span className="text-slate-400">ทั้งหมดในฐานข้อมูล:</span>
            <span className="font-bold text-white font-mono">{behaviors.length} รายการ</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 flex items-center gap-2">
            <MinusCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>เกณฑ์หักคะแนน:</span>
            <span className="font-bold font-mono">{deductCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 flex items-center gap-2">
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>เกณฑ์เพิ่มคะแนน:</span>
            <span className="font-bold font-mono">{addCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-indigo-300" />
            <span>หมวดหมู่:</span>
            <span className="font-bold font-mono">{categories.length} หมวด</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Type selector buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ทั้งหมด ({behaviors.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('DEDUCT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              filterType === 'DEDUCT'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <MinusCircle className="w-3.5 h-3.5" />
            <span>หักคะแนน ({deductCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('ADD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              filterType === 'ADD'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>เพิ่มคะแนน ({addCount})</span>
          </button>
        </div>

        {/* Category & Search inputs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 md:max-w-xl">
          {categories.length > 0 && (
            <div className="relative sm:w-48">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="ALL">ทุกหมวดหมู่ ({categories.length})</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อพฤติกรรม, หมวดหมู่, หรือรายละเอียด..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Behaviors Grid List */}
      {filteredBehaviors.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <ListChecks className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            {behaviors.length === 0 ? 'ยังไม่มีข้อมูลพฤติกรรมมาตรฐานในฐานข้อมูล' : 'ไม่พบรายการที่ตรงกับเงื่อนไข'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            {behaviors.length === 0
              ? 'ระบบยังไม่มีหัวข้อพฤติกรรมมาตรฐานใน Firestore คุณสามารถกดเพิ่มพฤติกรรมใหม่ หรือกดนำเข้าชุดเกณฑ์มาตรฐานของโรงเรียนได้ทันที'
              : 'ลองปรับเปลี่ยนคำค้นหา หรือเลือกตัวกรองหมวดหมู่อื่น'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => openAddModal()}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างพฤติกรรมมาตรฐานใหม่</span>
            </button>
            {onBatchSaveBehaviors && behaviors.length === 0 && (
              <button
                type="button"
                onClick={() => setShowSeedConfirm(true)}
                className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>นำเข้าชุดเกณฑ์มาตรฐานเริ่มต้น (17 รายการ)</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredBehaviors.map(b => {
            const isDeduct = b.type === 'DEDUCT';
            return (
              <div
                key={b.id}
                className={`bg-white rounded-2xl border transition-all duration-150 p-4 flex flex-col justify-between group hover:shadow-md ${
                  isDeduct
                    ? 'border-slate-200 hover:border-rose-300'
                    : 'border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div>
                  {/* Top tags row */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        isDeduct
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isDeduct ? <MinusCircle className="w-3 h-3" /> : <PlusCircle className="w-3 h-3" />}
                      <span>{isDeduct ? 'หักคะแนน' : 'เพิ่มคะแนน'}</span>
                    </span>

                    <span
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                        isDeduct ? 'bg-rose-100/70 text-rose-800' : 'bg-emerald-100/70 text-emerald-800'
                      }`}
                    >
                      {isDeduct ? `-${b.points}` : `+${b.points}`} คะแนน
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="font-bold text-slate-900 text-sm mb-1 leading-snug group-hover:text-indigo-600 transition-colors">
                    {b.title}
                  </h4>

                  {/* Category */}
                  <div className="text-[11px] font-medium text-slate-500 mb-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    <span>หมวด: {b.category}</span>
                  </div>

                  {/* Description */}
                  {b.description && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-3 leading-relaxed mb-3">
                      {b.description}
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                  {isSelectMode && onSelectBehavior ? (
                    <button
                      type="button"
                      onClick={() => onSelectBehavior(b)}
                      className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
                    >
                      เลือกรายการนี้
                    </button>
                  ) : (
                    <div className="text-[10px] text-slate-400">
                      ID: <span className="font-mono">{b.id.slice(0, 12)}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(b)}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="แก้ไขข้อมูลพฤติกรรมนี้"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingBehavior(b)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="ลบพฤติกรรมนี้ออกจากฐานข้อมูล"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-5 text-white flex items-center justify-between ${
              type === 'DEDUCT'
                ? 'bg-gradient-to-r from-rose-600 to-red-600'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  {type === 'DEDUCT' ? <MinusCircle className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {editingId ? 'แก้ไขพฤติกรรมมาตรฐาน' : 'เพิ่มพฤติกรรมมาตรฐานใหม่'}
                  </h3>
                  <p className="text-xs text-white/80">
                    บันทึกลงฐานข้อมูล Firestore เพื่อให้แสดงในตัวเลือกด่วน
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ประเภทการกระทำ:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('DEDUCT')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      type === 'DEDUCT'
                        ? 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <MinusCircle className="w-4 h-4 text-rose-600" />
                    <span>หักคะแนนความประพฤติ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('ADD')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      type === 'ADD'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4 text-emerald-600" />
                    <span>เพิ่มคะแนนความประพฤติ</span>
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  หัวข้อ / ชื่อพฤติกรรมมาตรฐาน <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={type === 'DEDUCT' ? 'เช่น มาสายเกิน 15 นาที, แต่งกายผิดระเบียบ' : 'เช่น จิตอาสาบำเพ็ญประโยชน์, สร้างชื่อเสียงให้โรงเรียน'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  required
                />
              </div>

              {/* Points & Category row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    จำนวนคะแนนที่{type === 'DEDUCT' ? 'หัก' : 'เพิ่ม'} <span className="text-rose-500">*</span>:
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={points}
                      onChange={e => setPoints(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      required
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      คะแนน
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    หมวดหมู่พฤติกรรม <span className="text-rose-500">*</span>:
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="เช่น การเข้าเรียน, วินัย, จิตอาสา"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    required
                  />
                  {/* Category suggestion pills */}
                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 max-h-16 overflow-y-auto">
                      {categories.slice(0, 6).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCategory(c)}
                          className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  รายละเอียดพฤติกรรม / เกณฑ์การพิจารณา: <span className="text-slate-400 font-normal font-sans">(ถ้าไม่ได้กรอกให้ปล่อยว่างไว้)</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="ระบุรายละเอียดเพิ่มเติมเกี่ยวกับพฤติกรรมนี้ หรือถ้าไม่ได้กรอกให้ปล่อยว่างไว้..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    type === 'DEDUCT'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'กำลังบันทึกลงฐานข้อมูล...' : 'บันทึกข้อมูลพฤติกรรม'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBehavior && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-1">
              ยืนยันการลบพฤติกรรมมาตรฐาน
            </h3>
            <p className="text-xs text-slate-600 text-center mb-4">
              คุณต้องการลบรายการ <strong className="text-rose-600">"{deletingBehavior.title}"</strong> ออกจากฐานข้อมูลหรือไม่?
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeletingBehavior(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบรายการ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seed Confirm Modal */}
      {showSeedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-1">
              นำเข้าชุดเกณฑ์มาตรฐานของโรงเรียน
            </h3>
            <p className="text-xs text-slate-600 text-center mb-4 leading-relaxed">
              ระบบจะบันทึกชุดเกณฑ์มาตรฐานเบื้องต้น 17 รายการ (หักคะแนน 9 รายการ, เพิ่มคะแนน 8 รายการ) ลงในฐานข้อมูล Firestore เพื่อให้สามารถเลือกใช้งานได้ทันที
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSeedConfirm(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleRestoreDefaults}
                disabled={isSeeding}
                className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
              >
                {isSeeding ? 'กำลังนำเข้า...' : 'ยืนยันการนำเข้า'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
