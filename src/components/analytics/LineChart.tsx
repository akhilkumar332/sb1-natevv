/**
 * LineChart Component
 *
 * Simple line chart component for trend visualization
 */

import React, { useState } from 'react';
import { CHART_PALETTE } from '../../constants/theme';

interface LineChartProps {
  data: Array<{ date?: string; label?: string; value: number }>;
  title?: string;
  color?: string;
  height?: number;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  color = CHART_PALETTE.primary,
  height = 200,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const formatAxisLabel = (value: string) => {
    const normalized = value.trim();
    if (normalized.includes('-') && normalized.length >= 7) {
      return normalized.slice(2, 7);
    }
    return normalized.length > 8 ? `${normalized.slice(0, 8)}...` : normalized;
  };

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
  const minValue = Math.min(...data.map((d) => d.value), 0);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const average = total / data.length;
  const peak = data.reduce((best, item) => (item.value > best.value ? item : best), data[0]);

  const width = 600;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - (d.value / maxValue) * chartHeight;
    const displayLabel = d.label || d.date || `Point ${i + 1}`;
    return { x, y, value: d.value, date: displayLabel };
  });

  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
  const areaData = `${pathData} L ${points[points.length - 1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`;

  const resolvedActiveIndex = activeIndex ?? points.length - 1;
  const activePoint = points[resolvedActiveIndex];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      {title && <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">{title}</h3>}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Peak</p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{peak.value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{peak.label || peak.date}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Average</p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{average.toFixed(1)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{data.length} points</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Range</p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{minValue} - {maxValue}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Visible scale</p>
        </div>
      </div>

      <div className="-mx-2 overflow-x-auto sm:mx-0 sm:overflow-visible">
        <div className="min-w-[520px] px-2 sm:min-w-0 sm:px-0">
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

            <path d={areaData} fill={color} fillOpacity="0.1" />
            <path d={pathData} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {activePoint ? (
              <g>
                <line
                  x1={activePoint.x}
                  y1={padding}
                  x2={activePoint.x}
                  y2={padding + chartHeight}
                  stroke={color}
                  strokeDasharray="4 4"
                  strokeOpacity="0.4"
                />
                <rect
                  x={Math.min(activePoint.x + 10, width - 138)}
                  y={Math.max(activePoint.y - 46, 12)}
                  width="128"
                  height="40"
                  rx="10"
                  fill="#0f172a"
                  fillOpacity="0.92"
                />
                <text
                  x={Math.min(activePoint.x + 20, width - 128)}
                  y={Math.max(activePoint.y - 24, 28)}
                  fontSize="12"
                  fontWeight="700"
                  fill="#f8fafc"
                >
                  {activePoint.date}
                </text>
                <text
                  x={Math.min(activePoint.x + 20, width - 128)}
                  y={Math.max(activePoint.y - 10, 42)}
                  fontSize="12"
                  fill="#cbd5e1"
                >
                  Value: {activePoint.value}
                </text>
              </g>
            ) : null}

            {points.map((p, i) => {
              const isActive = i === resolvedActiveIndex;
              return (
                <g
                  key={i}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <circle cx={p.x} cy={p.y} r={isActive ? '7' : '6'} fill={color} fillOpacity={isActive ? '0.18' : '0.12'} />
                  <circle cx={p.x} cy={p.y} r={isActive ? '4.5' : '3.5'} fill={color} />
                </g>
              );
            })}

            {points.map((p, i) => {
              if (i % Math.ceil(points.length / 6) === 0 || i === points.length - 1) {
                return (
                  <text
                    key={i}
                    x={p.x}
                    y={height - 10}
                    textAnchor="middle"
                    fontSize="12"
                    fill={CHART_PALETTE.axis}
                  >
                    {formatAxisLabel(p.date)}
                  </text>
                );
              }
              return null;
            })}
          </svg>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }}></div>
          <span>Trend</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Hover points to inspect period values.</p>
      </div>
    </div>
  );
};

export default LineChart;
