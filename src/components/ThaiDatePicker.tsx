import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { THAI_MONTHS_FULL, THAI_MONTHS_SHORT, THAI_DAYS, formatThaiDate } from '../utils/thaiDate';

interface ThaiDatePickerProps {
  value: string; // YYYY-MM-DD (Gregorian ISO)
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  themeColor?: 'rose' | 'emerald' | 'indigo';
  className?: string;
}

export const ThaiDatePicker: React.FC<ThaiDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'เลือกวันที่',
  disabled = false,
  themeColor = 'indigo',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current selected date
  const parsedDate = React.useMemo(() => {
    if (!value) return null;
    const parts = value.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return { year: y, month: m, day: d };
      }
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
    }
    return null;
  }, [value]);

  // Calendar view navigation (Year and Month)
  const [viewYear, setViewYear] = useState<number>(() => {
    if (parsedDate) return parsedDate.year;
    return new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (parsedDate) return parsedDate.month;
    return new Date().getMonth();
  });

  // When value changes from outside, sync view
  useEffect(() => {
    if (parsedDate) {
      setViewYear(parsedDate.year);
      setViewMonth(parsedDate.month);
    }
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Ensure popover is visible within any scrollable modal container
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Helpers for navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Generate Year options in Buddhist Era (พ.ศ.)
  // Range from (currentYear - 10) to (currentYear + 5)
  const currentGregorianYear = new Date().getFullYear();
  const yearOptions = React.useMemo(() => {
    const list: { gregorian: number; buddhist: number }[] = [];
    for (let y = currentGregorianYear - 10; y <= currentGregorianYear + 6; y++) {
      list.push({ gregorian: y, buddhist: y + 543 });
    }
    return list;
  }, [currentGregorianYear]);

  // Calendar cells computation
  const calendarDays = React.useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: {
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      isoString: string;
    }[] = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = totalDaysInPrevMonth - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, month: m, year: y, isCurrentMonth: false, isoString: iso });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true, isoString: iso });
    }

    // Next month padding to fill remaining 42 cells (6 rows) or 35 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, month: m, year: y, isCurrentMonth: false, isoString: iso });
    }

    return days;
  }, [viewYear, viewMonth]);

  const todayIso = new Date().toISOString().split('T')[0];

  const handleSelectDate = (isoString: string) => {
    onChange(isoString);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    onChange(todayIso);
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setIsOpen(false);
  };

  const handleSelectYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const iso = d.toISOString().split('T')[0];
    onChange(iso);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setIsOpen(false);
  };

  // Theme styles
  const activeBgClass =
    themeColor === 'rose'
      ? 'bg-rose-600 text-white shadow-xs'
      : themeColor === 'emerald'
      ? 'bg-emerald-600 text-white shadow-xs'
      : 'bg-indigo-600 text-white shadow-xs';

  const activeFocusClass =
    themeColor === 'rose'
      ? 'focus:ring-rose-500'
      : themeColor === 'emerald'
      ? 'focus:ring-emerald-500'
      : 'focus:ring-indigo-500';

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Input Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full px-2.5 py-1.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 transition-all flex items-center justify-between gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 ${activeFocusClass} ${
          isOpen ? 'ring-2 ring-indigo-500 bg-white border-indigo-300' : ''
        }`}
        title="แตะเพื่อเปิดปฏิทินภาษาไทย"
      >
        <div className="flex items-center gap-1.5 truncate">
          <CalendarIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="truncate">
            {value ? formatThaiDate(value, 'medium') : placeholder}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-200/70 px-1.5 py-0.5 rounded">
          พ.ศ.
        </span>
      </button>

      {/* Calendar Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Controls: Month & Year Selector in Thai */}
          <div className="flex items-center justify-between gap-1 mb-2.5 pb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 flex-1 justify-center">
              {/* Thai Month Dropdown */}
              <select
                value={viewMonth}
                onChange={e => setViewMonth(parseInt(e.target.value, 10))}
                className="text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {THAI_MONTHS_FULL.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Thai Buddhist Year Dropdown */}
              <select
                value={viewYear}
                onChange={e => setViewYear(parseInt(e.target.value, 10))}
                className="text-xs font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-2 py-1 font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {yearOptions.map(opt => (
                  <option key={opt.gregorian} value={opt.gregorian}>
                    พ.ศ. {opt.buddhist}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="เดือนถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Thai Weekdays Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((dayName, idx) => (
              <span
                key={dayName}
                className={`text-[11px] font-bold py-1 ${
                  idx === 0 ? 'text-rose-600' : 'text-slate-600'
                }`}
              >
                {dayName}
              </span>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((d, index) => {
              const isSelected = value === d.isoString;
              const isToday = todayIso === d.isoString;

              return (
                <button
                  key={`${d.isoString}-${index}`}
                  type="button"
                  onClick={() => handleSelectDate(d.isoString)}
                  className={`h-8 w-full rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer relative ${
                    isSelected
                      ? activeBgClass
                      : d.isCurrentMonth
                      ? 'text-slate-800 hover:bg-slate-100'
                      : 'text-slate-300 hover:bg-slate-50'
                  } ${
                    isToday && !isSelected
                      ? 'border border-indigo-400 text-indigo-700 font-bold bg-indigo-50/40'
                      : ''
                  }`}
                  title={`${d.day} ${THAI_MONTHS_SHORT[d.month]} พ.ศ. ${d.year + 543}`}
                >
                  <span>{d.day}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 bg-indigo-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Selection Shortcuts & Date Display */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectToday}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={handleSelectYesterday}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                วานนี้
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-800 text-[11px] font-bold px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
