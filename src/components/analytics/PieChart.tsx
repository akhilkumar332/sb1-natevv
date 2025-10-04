/**
 * PieChart Component
 *
 * Simple pie chart component for distribution visualization
 */

import React from 'react';

interface PieChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  title?: string;
  size?: number;
}

const COLORS = [
  '#DC2626', // red-600
  '#EA580C', // orange-600
  '#D97706', // amber-600
  '#16A34A', // green-600
  '#0891B2', // cyan-600
  '#2563EB', // blue-600
  '#7C3AED', // violet-600
  '#DB2777', // pink-600
];

/**
 * PieChart Component
 */
export const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  size = 200,
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

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const center = size / 2;
  const radius = size / 2 - 10;

  // Calculate pie slices
  let currentAngle = -90; // Start from top

  const slices = data.map((d, i) => {
    const percentage = (d.value / total) * 100;
    const angle = (d.value / total) * 360;

    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;

    currentAngle = endAngle;

    // Calculate path
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

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
    };
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}

      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Pie Chart */}
        <div className="flex-shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {slices.map((slice, i) => (
              <g key={i}>
                <path
                  d={slice.path}
                  fill={slice.color}
                  stroke="white"
                  strokeWidth="2"
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                />
              </g>
            ))}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {slices.map((slice, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: slice.color }}
                ></div>
                <span className="text-sm text-gray-700 truncate">{slice.label}</span>
              </div>
              <div className="text-sm font-medium text-gray-900 flex-shrink-0">
                {slice.value} ({slice.percentage}%)
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PieChart;
