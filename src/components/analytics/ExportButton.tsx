/**
 * ExportButton Component
 *
 * Component for exporting analytics data
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { downloadCSV, downloadJSON, downloadExcel } from '../../utils/export.utils';

interface ExportButtonProps {
  data: any[];
  filename: string;
  headers?: string[];
}

/**
 * ExportButton Component
 */
export const ExportButton: React.FC<ExportButtonProps> = ({
  data,
  filename,
  headers,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);


  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        left: Math.max(12, rect.right - 208),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const handleExport = (format: 'csv' | 'json' | 'excel') => {
    switch (format) {
      case 'csv':
        downloadCSV(data, filename, headers);
        break;
      case 'json':
        downloadJSON(data, filename);
        break;
      case 'excel':
        downloadExcel(data, filename, headers);
        break;
    }
    setIsOpen(false);
  };

  return (
    <div className="relative z-20">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {isOpen && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <div
                className="fixed z-[70] w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                style={{ top: menuPosition.top, left: menuPosition.left }}
              >
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <FileText className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  <span className="text-sm text-slate-700 dark:text-slate-200">Export as CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExport('excel')}
                  className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <FileSpreadsheet className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  <span className="text-sm text-slate-700 dark:text-slate-200">Export as Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExport('json')}
                  className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <FileText className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  <span className="text-sm text-slate-700 dark:text-slate-200">Export as JSON</span>
                </button>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
};

export default ExportButton;
