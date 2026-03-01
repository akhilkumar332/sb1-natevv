/**
 * BarChart Component
 *
 * Simple bar chart component for comparison visualization
 */

import React from 'react';
import { CHART_PALETTE } from '../../constants/theme';

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  title?: string;
  color?: string;
  height?: number;
  horizontal?: boolean;
}

/**
 * BarChart Component
 */
export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  color = CHART_PALETTE.primary,
  height = 300,
  horizontal = false,
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

  if (horizontal) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}

        <div className="space-y-4">
          {data.map((d, i) => {
            const percentage = (d.value / maxValue) * 100;

            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{d.label}</span>
                  <span className="text-sm text-gray-600">{d.value}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: color,
                    }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Vertical bar chart
  const width = 600;
  const padding = 60;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = Math.min(60, chartWidth / data.length - 10);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Y-axis grid lines */}
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

        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * chartHeight;
          const x = padding + (i + 0.5) * (chartWidth / data.length) - barWidth / 2;
          const y = padding + chartHeight - barHeight;

          return (
            <g key={i}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                rx="4"
                className="hover:opacity-80 transition-opacity cursor-pointer"
              />

              {/* Value label */}
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

              {/* X-axis label */}
              <text
                x={x + barWidth / 2}
                y={padding + chartHeight + 20}
                textAnchor="middle"
                fontSize="12"
                fill={CHART_PALETTE.axis}
              >
                {d.label.length > 10 ? d.label.substring(0, 10) + '...' : d.label}
              </text>
            </g>
          );
        })}

        {/* X-axis */}
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
  );
};

export default BarChart;
