/**
 * ProgressBar Component
 *
 * Displays a progress bar with percentage and optional labels
 */

import React from 'react';

interface ProgressBarProps {
  current: number;
  target: number;
  label?: string;
  color?: 'red' | 'blue' | 'green' | 'yellow' | 'purple';
  showPercentage?: boolean;
  showValues?: boolean;
  height?: 'sm' | 'md' | 'lg';
}

/**
 * ProgressBar component
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  target,
  label,
  color = 'red',
  showPercentage = true,
  showValues = true,
  height = 'md',
}) => {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  const colorClasses = {
    red: 'bg-red-600',
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    purple: 'bg-purple-600',
  };

  const heightClasses = {
    sm: 'h-2',
    md: 'h-4',
    lg: 'h-6',
  };

  return (
    <div className="w-full">
      {/* Label and Values */}
      {(label || showValues || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-700">{label}</span>
          )}
          <div className="flex items-center gap-2">
            {showValues && (
              <span className="text-sm text-gray-600">
                {current.toLocaleString()} / {target.toLocaleString()}
              </span>
            )}
            {showPercentage && (
              <span className="text-sm font-semibold text-gray-900">
                {Math.round(percentage)}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${heightClasses[height]}`}>
        <div
          className={`${colorClasses[color]} ${heightClasses[height]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
