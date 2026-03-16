/**
 * PieChart Component
 *
 * Simple pie chart component for distribution visualization
 */

import React, { useState } from 'react';
import { CHART_PALETTE } from '../../constants/theme';

interface PieChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  title?: string;
  size?: number;
}

const COLORS = CHART_PALETTE.sequence;

export const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  size = 200,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        {title && <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">{title}</h3>}
        <div className="flex h-48 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          No data available
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const center = size / 2;
  const radius = size / 2 - 14;
  let currentAngle = -90;

  const slices = data.map((d, i) => {
    const percentage = (d.value / total) * 100;
    const angle = (d.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const midRad = ((startAngle + endAngle) / 2) * (Math.PI / 180);

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;

    const pathData = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    return {
      path: pathData,
      color: d.color || COLORS[i % COLORS.length],
      label: d.label,
      value: d.value,
      percentage: percentage.toFixed(1),
      midX: center + (radius * 0.72) * Math.cos(midRad),
      midY: center + (radius * 0.72) * Math.sin(midRad),
    };
  });

  const resolvedActiveIndex = activeIndex ?? 0;
  const activeSlice = slices[resolvedActiveIndex];
  const activeSliceCenterLabel = activeSlice.label.length > 12 ? `${activeSlice.label.slice(0, 10)}..` : activeSlice.label;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      {title && <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">{title}</h3>}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Total</p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{total}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">All slices combined</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Focus</p>
          <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{activeSlice.label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{activeSlice.value} items</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Share</p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{activeSlice.percentage}%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Focused slice</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="mx-auto flex-shrink-0">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="h-[180px] w-[180px] sm:h-[200px] sm:w-[200px]"
          >
            <circle cx={center} cy={center} r={radius * 0.48} fill="currentColor" className="text-white dark:text-slate-900" />
            {slices.map((slice, i) => {
              const isActive = i === resolvedActiveIndex;
              return (
                <g
                  key={i}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <path
                    d={slice.path}
                    fill={slice.color}
                    stroke="white"
                    strokeWidth={isActive ? '3' : '2'}
                    fillOpacity={isActive ? '1' : '0.84'}
                    className="cursor-pointer transition-all duration-200"
                  />
                  {isActive ? (
                    <circle cx={slice.midX} cy={slice.midY} r="3.5" fill="#fff" />
                  ) : null}
                </g>
              );
            })}
            <text
              x={center}
              y={center - 4}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="currentColor"
              className="text-slate-900 dark:text-slate-100"
            >
              {activeSliceCenterLabel}
            </text>
            <text
              x={center}
              y={center + 14}
              textAnchor="middle"
              fontSize="12"
              fill="currentColor"
              className="text-slate-500 dark:text-slate-400"
            >
              {activeSlice.percentage}% share
            </text>
          </svg>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {slices.map((slice, i) => {
            const isActive = i === resolvedActiveIndex;
            return (
              <button
                key={i}
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(i)}
                className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                  isActive ? 'border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/70 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div
                    className="h-3 w-3 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate text-sm text-slate-700 dark:text-slate-200">{slice.label}</span>
                </div>
                <div className="flex-shrink-0 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {slice.percentage}%
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PieChart;
