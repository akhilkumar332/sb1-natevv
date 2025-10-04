/**
 * RadiusFilter Component
 *
 * Component for selecting search radius with visual feedback
 */

import React from 'react';
import { Circle } from 'lucide-react';

interface RadiusFilterProps {
  value: number;
  onChange: (radius: number) => void;
  options?: number[];
  min?: number;
  max?: number;
  showCustomInput?: boolean;
  label?: string;
  unit?: 'km' | 'miles';
}

/**
 * RadiusFilter Component
 */
export const RadiusFilter: React.FC<RadiusFilterProps> = ({
  value,
  onChange,
  options = [5, 10, 20, 50, 100],
  min = 1,
  max = 500,
  showCustomInput = true,
  label = 'Search Radius',
  unit = 'km',
}) => {
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value));
  };

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value);
    if (!isNaN(newValue) && newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-3">
      {/* Label with current value */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-semibold text-red-600">
          {value} {unit}
        </span>
      </div>

      {/* Quick Select Buttons */}
      <div className="flex gap-2 flex-wrap">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`px-4 py-2 rounded-lg transition-all ${
              value === option
                ? 'bg-red-600 text-white shadow-md transform scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {option} {unit}
          </button>
        ))}
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <input
          type="range"
          min={min}
          max={max}
          step="5"
          value={value}
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{min} {unit}</span>
          <span>{max} {unit}</span>
        </div>
      </div>

      {/* Custom Input */}
      {showCustomInput && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={handleCustomInput}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <span className="text-sm text-gray-600">{unit} (custom)</span>
        </div>
      )}

      {/* Visual Indicator */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        <Circle className="w-4 h-4 text-red-600" />
        <span className="text-sm text-gray-600">
          Searching within a {value} {unit} radius
        </span>
      </div>
    </div>
  );
};

export default RadiusFilter;
