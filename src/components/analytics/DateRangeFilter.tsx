/**
 * DateRangeFilter Component
 *
 * Component for selecting date ranges for analytics
 */

import React, { useState } from 'react';
import { Calendar, Clock3 } from 'lucide-react';
import { THREE_HUNDRED_MS } from '../../constants/time';
import { ANALYTICS_LIMITS, ANALYTICS_RANGE_MS } from '../../constants/analytics';

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
  const [customError, setCustomError] = useState('');

  const presetRanges: Array<{ label: string; value: DateRangeType }> = [
    { label: 'Last 7 Days', value: 'week' },
    { label: 'Last 30 Days', value: 'month' },
    { label: 'Last 90 Days', value: 'quarter' },
    { label: 'Last Year', value: 'year' },
    { label: 'Custom', value: 'custom' },
  ];

  const selectedLabel = presetRanges.find((range) => range.value === selectedRange)?.label || 'Custom';

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
    setCustomError('');

    if (range !== 'custom') {
      const { start, end } = calculateDateRange(range);
      onRangeChange(start, end);
    }
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return;

    const start = new Date(customStart);
    const end = new Date(customEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setCustomError('Please select a valid date range.');
      return;
    }
    if (start > end) {
      setCustomError('Start date cannot be after end date.');
      return;
    }
    const maxWindowMs = ANALYTICS_RANGE_MS.maxCustomRange;
    if ((end.getTime() - start.getTime()) > maxWindowMs) {
      setCustomError(`Custom range cannot exceed ${ANALYTICS_LIMITS.maxCustomRangeYears} years.`);
      return;
    }
    setCustomError('');
    onRangeChange(start, end);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3 shadow-sm dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.92)_100%)]">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-lg bg-red-100 p-1.5 text-red-600 dark:bg-red-950/60 dark:text-red-300">
            <Calendar className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Date Range</h3>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Clock3 className="h-3 w-3" />
                {selectedLabel}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {presetRanges.map((range) => (
            <button
              key={range.value}
              type="button"
              onClick={() => handleRangeSelect(range.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedRange === range.value
                  ? 'border-red-600 bg-red-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {selectedRange === 'custom' && (
        <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 dark:border-slate-800 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Start Date
            </label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-red-950/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              End Date
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-red-950/50"
            />
          </div>

          <button
            type="button"
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-red-600 dark:hover:bg-red-500 dark:disabled:bg-slate-700"
          >
            Apply Range
          </button>
          {customError ? (
            <p className="text-xs text-rose-600 dark:text-rose-400 lg:col-span-3" style={{ transitionDuration: `${THREE_HUNDRED_MS}ms` }}>
              {customError}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
