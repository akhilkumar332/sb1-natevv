/**
 * BarChart Component
 *
 * Simple bar chart component for comparison visualization
 */

import React, { useState } from 'react';
import { CHART_PALETTE } from '../../constants/theme';

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  title?: string;
  color?: string;
  height?: number;
  horizontal?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  color = CHART_PALETTE.primary,
  height = 300,
  horizontal = false,
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

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const leader = data.reduce((best, item) => (item.value > best.value ? item : best), data[0]);
  const resolvedActiveIndex = activeIndex ?? 0;
  const activeItem = data[resolvedActiveIndex];

  if (horizontal) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        {title && <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">{title}</h3>}

        <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Leader</p>
            <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{leader.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{leader.value}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Total</p>
            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{total}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{data.length} bars</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Focused</p>
            <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{activeItem.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{activeItem.value}</p>
          </div>
        </div>

        <div className="space-y-4">
          {data.map((d, i) => {
            const percentage = (d.value / maxValue) * 100;
            const isActive = i === resolvedActiveIndex;

            return (
              <div
                key={i}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                className={`rounded-2xl px-2 py-2 transition-colors ${isActive ? 'bg-slate-50 dark:bg-slate-800/70' : ''}`}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate pr-2 text-sm font-medium text-slate-700 dark:text-slate-200">{d.label}</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{d.value}</span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      background: isActive
                        ? `linear-gradient(90deg, ${color}, #0f172a)`
                        : color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const width = 600;
  const padding = 60;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = Math.min(60, chartWidth / data.length - 10);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      {title && <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">{title}</h3>}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Leader</p>
          <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{leader.label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{leader.value}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Total</p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{total}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{data.length} bars</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Focused</p>
          <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{activeItem.label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{activeItem.value}</p>
        </div>
      </div>

      <div className="-mx-2 overflow-x-auto sm:mx-0 sm:overflow-visible">
        <div className="min-w-[560px] px-2 sm:min-w-0 sm:px-0">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding + chartHeight * (1 - ratio);
              return (
                <g key={ratio}>
                  <line
                    x1={padding}
                    y1={y}
                    x2={width - padding}
                    y2={y}
                    stroke={CHART_PALETTE.grid}
                    strokeWidth="1"
                  />
                  <text x={padding - 10} y={y + 4} textAnchor="end" fontSize="12" fill={CHART_PALETTE.axis}>
                    {Math.round(maxValue * ratio)}
                  </text>
                </g>
              );
            })}

            {data.map((d, i) => {
              const barHeight = (d.value / maxValue) * chartHeight;
              const x = padding + (i + 0.5) * (chartWidth / data.length) - barWidth / 2;
              const y = padding + chartHeight - barHeight;
              const isActive = i === resolvedActiveIndex;

              return (
                <g
                  key={i}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={color}
                    fillOpacity={isActive ? '1' : '0.82'}
                    rx="6"
                    className="transition-opacity"
                  />
                  {isActive ? (
                    <rect
                      x={x - 10}
                      y={Math.max(y - 44, 8)}
                      width="112"
                      height="36"
                      rx="10"
                      fill="#0f172a"
                      fillOpacity="0.92"
                    />
                  ) : null}
                  {isActive ? (
                    <>
                      <text
                        x={x + 8}
                        y={Math.max(y - 22, 24)}
                        fontSize="12"
                        fontWeight="700"
                        fill="#f8fafc"
                      >
                        {d.label.length > 12 ? `${d.label.slice(0, 12)}...` : d.label}
                      </text>
                      <text
                        x={x + 8}
                        y={Math.max(y - 9, 37)}
                        fontSize="12"
                        fill="#cbd5e1"
                      >
                        {d.value}
                      </text>
                    </>
                  ) : (
                    <text
                      x={x + barWidth / 2}
                      y={y - 5}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="bold"
                      fill={color}
                    >
                      {d.value}
                    </text>
                  )}
                  <text
                    x={x + barWidth / 2}
                    y={padding + chartHeight + 20}
                    textAnchor="middle"
                    fontSize="12"
                    fill={CHART_PALETTE.axis}
                  >
                    {d.label.length > 10 ? `${d.label.substring(0, 10)}...` : d.label}
                  </text>
                </g>
              );
            })}

            <line
              x1={padding}
              y1={padding + chartHeight}
              x2={width - padding}
              y2={padding + chartHeight}
              stroke={CHART_PALETTE.axis}
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default BarChart;
