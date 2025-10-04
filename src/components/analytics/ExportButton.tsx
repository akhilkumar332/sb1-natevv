/**
 * ExportButton Component
 *
 * Component for exporting analytics data
 */

import React, { useState } from 'react';
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
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <button
              onClick={() => handleExport('csv')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <FileText className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">Export as CSV</span>
            </button>

            <button
              onClick={() => handleExport('excel')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
            >
              <FileSpreadsheet className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">Export as Excel</span>
            </button>

            <button
              onClick={() => handleExport('json')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
            >
              <FileText className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">Export as JSON</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ExportButton;
