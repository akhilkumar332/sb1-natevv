/**
 * DateRangeFilter Component
 *
 * Component for selecting date ranges for analytics
 */

import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

type DateRangeType = 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface DateRangeFilterProps {
  onRangeChange: (startDate: Date, endDate: Date) => void;
  defaultRange?: DateRangeType;
}

/**
 * DateRangeFilter Component
 */
export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  onRangeChange,
  defaultRange = 'month',
}) => {
  const [selectedRange, setSelectedRange] = useState<DateRangeType>(defaultRange);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const presetRanges: Array<{ label: string; value: DateRangeType }> = [
    { label: 'Last 7 Days', value: 'week' },
    { label: 'Last 30 Days', value: 'month' },
    { label: 'Last 90 Days', value: 'quarter' },
    { label: 'Last Year', value: 'year' },
    { label: 'Custom', value: 'custom' },
  ];

  const calculateDateRange = (range: DateRangeType): { start: Date; end: Date } => {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setDate(end.getDate() - 30);
        break;
      case 'quarter':
        start.setDate(end.getDate() - 90);
        break;
      case 'year':
        start.setFullYear(end.getFullYear() - 1);
        break;
      default:
        break;
    }

    return { start, end };
  };

  const handleRangeSelect = (range: DateRangeType) => {
    setSelectedRange(range);

    if (range !== 'custom') {
      const { start, end } = calculateDateRange(range);
      onRangeChange(start, end);
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onRangeChange(new Date(customStart), new Date(customEnd));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-gray-600" />
        <h3 className="text-sm font-medium text-gray-900">Date Range</h3>
      </div>

      {/* Preset Ranges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {presetRanges.map((range) => (
          <button
            key={range.value}
            onClick={() => handleRangeSelect(range.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedRange === range.value
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Custom Range Inputs */}
      {selectedRange === 'custom' && (
        <div className="space-y-3 pt-3 border-t border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Apply Custom Range
          </button>
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
