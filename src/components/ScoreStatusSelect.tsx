import React, { useState, useRef, useEffect } from 'react';
import { ScoreFilterType, ScoreCategoryType } from '../types';
import {
  AlertOctagon,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Award,
  Crown,
  Layers,
  ChevronDown,
  Check
} from 'lucide-react';

interface ScoreStatusOption {
  value: ScoreFilterType;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
}

export const SCORE_STATUS_OPTIONS: ScoreStatusOption[] = [
  {
    value: 'ALL',
    label: 'ระดับคะแนน: ทุกระดับ',
    shortLabel: 'ทุกระดับ',
    description: 'แสดงนักเรียนทั้งหมดทุกกลุ่มคะแนน',
    icon: Layers,
    iconColor: 'text-slate-600',
    iconBg: 'bg-slate-100',
    activeBg: 'bg-slate-50',
    activeBorder: 'border-slate-300',
    activeText: 'text-slate-800',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    dotColor: 'bg-slate-400'
  },
  {
    value: 'CRITICAL',
    label: 'วิกฤต (หักเกิน 50 คะแนน)',
    shortLabel: 'วิกฤต (≤50)',
    description: 'หักเกิน 50 คะแนนขึ้นไป / คงเหลือ ≤ 50',
    icon: AlertOctagon,
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-100',
    activeBg: 'bg-rose-50',
    activeBorder: 'border-rose-300 ring-2 ring-rose-200/70',
    activeText: 'text-rose-900',
    badgeBg: 'bg-rose-600',
    badgeText: 'text-white',
    dotColor: 'bg-rose-500'
  },
  {
    value: 'WATCH',
    label: 'เฝ้าระวัง (หักเกิน 30 คะแนน)',
    shortLabel: 'เฝ้าระวัง (51-70)',
    description: 'หักเกิน 30 คะแนนขึ้นไป / คงเหลือ 51 - 70',
    icon: AlertTriangle,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-100',
    activeBg: 'bg-orange-50',
    activeBorder: 'border-orange-300 ring-2 ring-orange-200/70',
    activeText: 'text-orange-950',
    badgeBg: 'bg-orange-500',
    badgeText: 'text-white',
    dotColor: 'bg-orange-500'
  },
  {
    value: 'CAUTION',
    label: 'ตักเตือน (หักไม่เกิน 29 คะแนน)',
    shortLabel: 'ตักเตือน (71-99)',
    description: 'หักไม่เกิน 29 คะแนน / คงเหลือ 71 - 99',
    icon: AlertCircle,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
    activeBg: 'bg-amber-50',
    activeBorder: 'border-amber-300 ring-2 ring-amber-200/70',
    activeText: 'text-amber-950',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-white',
    dotColor: 'bg-amber-500'
  },
  {
    value: 'NORMAL',
    label: 'ปกติ (มีคะแนนเต็ม 100)',
    shortLabel: 'ปกติ (100 เต็ม)',
    description: 'คะแนนเต็ม 100 คะแนน ไม่มีประวัติถูกหัก',
    icon: ShieldCheck,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    activeBg: 'bg-emerald-50',
    activeBorder: 'border-emerald-300 ring-2 ring-emerald-200/70',
    activeText: 'text-emerald-950',
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    dotColor: 'bg-emerald-500'
  },
  {
    value: 'OUTSTANDING',
    label: 'ดีเด่น (มีคะแนนเกิน 100)',
    shortLabel: 'ดีเด่น (100+)',
    description: 'มีคะแนนเกิน 100 คะแนน (มีคะแนนสำรองความดี)',
    icon: Award,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    activeBg: 'bg-blue-50',
    activeBorder: 'border-blue-300 ring-2 ring-blue-200/70',
    activeText: 'text-blue-950',
    badgeBg: 'bg-blue-600',
    badgeText: 'text-white',
    dotColor: 'bg-blue-500'
  },
  {
    value: 'EXCELLENT',
    label: 'ยอดเยี่ยม (100+ ไม่เคยหัก 3 ปี)',
    shortLabel: 'ยอดเยี่ยม (3ปี)',
    description: 'เกิน 100 คะแนน และไม่เคยโดนหักในรอบ 3 ปี',
    icon: Crown,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
    activeBg: 'bg-purple-50',
    activeBorder: 'border-purple-300 ring-2 ring-purple-200/70',
    activeText: 'text-purple-950',
    badgeBg: 'bg-purple-600',
    badgeText: 'text-white',
    dotColor: 'bg-purple-500'
  }
];

interface ScoreStatusSelectProps {
  value: ScoreFilterType;
  onChange: (value: ScoreFilterType) => void;
  counts?: Partial<Record<ScoreFilterType, number>>;
  className?: string;
}

export const ScoreStatusSelect: React.FC<ScoreStatusSelectProps> = ({
  value,
  onChange,
  counts,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = SCORE_STATUS_OPTIONS.find(opt => opt.value === value) || SCORE_STATUS_OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: ScoreFilterType) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button with Dynamic Color and Icon */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-2xs ${
          value === 'ALL'
            ? 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700 focus:bg-white'
            : `${selectedOption.activeBg} ${selectedOption.activeBorder} ${selectedOption.activeText}`
        }`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <div className={`p-1 rounded-lg ${selectedOption.iconBg} ${selectedOption.iconColor} flex-shrink-0`}>
            <SelectedIcon className="w-3.5 h-3.5" />
          </div>
          <span className="truncate">{selectedOption.label}</span>
          {counts && counts[value] !== undefined && (
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ml-0.5 flex-shrink-0 ${
                value === 'ALL'
                  ? 'bg-slate-200 text-slate-700'
                  : `${selectedOption.badgeBg} ${selectedOption.badgeText}`
              }`}
            >
              {counts[value]}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-slate-600' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 space-y-1 min-w-[280px] max-h-[380px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
            <span>เลือกระดับคะแนนความประพฤติ</span>
            <span>6 เกณฑ์มาตรฐาน</span>
          </div>

          {SCORE_STATUS_OPTIONS.map(option => {
            const OptionIcon = option.icon;
            const isSelected = option.value === value;
            const count = counts ? counts[option.value] : undefined;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-all cursor-pointer group ${
                  isSelected
                    ? `${option.activeBg} border ${option.activeBorder}`
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                {/* Icon Box */}
                <div
                  className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 transition-colors ${
                    isSelected ? `${option.iconBg} ${option.iconColor}` : `${option.iconBg} ${option.iconColor} group-hover:scale-105`
                  }`}
                >
                  <OptionIcon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={`text-xs font-bold truncate ${
                        isSelected ? option.activeText : 'text-slate-800 group-hover:text-indigo-600'
                      }`}
                    >
                      {option.label}
                    </span>

                    {count !== undefined && (
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                          isSelected
                            ? `${option.badgeBg} ${option.badgeText}`
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                        }`}
                      >
                        {count} คน
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                    {option.description}
                  </p>
                </div>

                {/* Selected Checkmark */}
                {isSelected && (
                  <div className={`mt-1 flex-shrink-0 ${option.iconColor}`}>
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
