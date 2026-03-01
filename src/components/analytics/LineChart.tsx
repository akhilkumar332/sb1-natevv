/**
 * LineChart Component
 *
 * Simple line chart component for trend visualization
 */

import React from 'react';
import { CHART_PALETTE } from '../../constants/theme';

interface LineChartProps {
  data: Array<{ date?: string; label?: string; value: number }>;
  title?: string;
  color?: string;
  height?: number;
}

/**
 * LineChart Component (Simple SVG implementation)
 * For production, consider using Chart.js or Recharts
 */
export const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  color = CHART_PALETTE.primary,
  height = 200,
}) => {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}
        <div className="flex items-center justify-center h-48 text-gray-500">
          No data available
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const width = 600;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Calculate points
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - (d.value / maxValue) * chartHeight;
    const displayLabel = d.label || d.date || `Point ${i + 1}`;
    return { x, y, value: d.value, date: displayLabel };
  });

  // Create path
  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Create area path
  const areaData = `${pathData} L ${points[points.length - 1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Grid lines */}
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

        {/* Area */}
        <path d={areaData} fill={color} fillOpacity="0.1" />

        {/* Line */}
        <path d={pathData} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill={color} />
            <circle cx={p.x} cy={p.y} r="6" fill={color} fillOpacity="0.3" />
          </g>
        ))}

        {/* X-axis labels */}
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
                {p.date.substring(5)}
              </text>
            );
          }
          return null;
        })}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
          <span>Trend</span>
        </div>
      </div>
    </div>
  );
};

export default LineChart;
