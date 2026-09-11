import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  showSummary?: boolean;
  className?: string;
  itemLabel?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  showSummary = true,
  className = '',
  itemLabel = 'รายการ'
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // If total items is 0 or less than or equal to pageSize and totalPages <= 1,
  // we can still show a minimal summary or hide pagination controls if <= 20
  if (totalItems <= pageSize && totalPages <= 1) {
    return (
      <div className={`flex items-center justify-between py-3 px-4 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500 rounded-b-2xl ${className}`}>
        <span>
          แสดงทั้งหมด <strong className="text-slate-800 font-mono">{totalItems}</strong> {itemLabel}
        </span>
        <span className="text-[11px] text-slate-400">หน้า 1 จาก 1</span>
      </div>
    );
  }

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        start = 2;
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
        end = totalPages - 1;
      }

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 py-3.5 px-4 bg-slate-50 border-t border-slate-200 text-xs rounded-b-2xl ${className}`}
    >
      {/* Summary Info */}
      {showSummary && (
        <div className="flex items-center gap-2 text-slate-600">
          <span>
            แสดง <strong className="font-mono text-slate-900">{startItem} - {endItem}</strong> จากทั้งหมด{' '}
            <strong className="font-mono text-indigo-700">{totalItems}</strong> {itemLabel}
          </span>
          {onPageSizeChange && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
              <span className="text-[11px] text-slate-400">แสดงหน้าละ:</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex items-center gap-1 select-none">
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            currentPage === 1
              ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 shadow-2xs'
          }`}
          title="หน้าแรก"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            currentPage === 1
              ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 shadow-2xs'
          }`}
          title="หน้าก่อนหน้า"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((page, idx) => {
            if (page === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 py-1 text-xs text-slate-400 font-bold"
                >
                  ...
                </span>
              );
            }

            const pageNum = Number(page);
            const isActive = pageNum === currentPage;

            return (
              <button
                key={`page-${pageNum}`}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 shadow-2xs'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            currentPage === totalPages
              ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 shadow-2xs'
          }`}
          title="หน้าถัดไป"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            currentPage === totalPages
              ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 shadow-2xs'
          }`}
          title="หน้าสุดท้าย"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
