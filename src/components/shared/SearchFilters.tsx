/**
 * SearchFilters Component
 *
 * Reusable filter panel for search functionality
 */

import React, { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'range' | 'toggle';
  options?: FilterOption[];
  min?: number;
  max?: number;
  defaultValue?: any;
}

interface SearchFiltersProps {
  filters: FilterConfig[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onClear: () => void;
  onApply?: () => void;
  collapsible?: boolean;
}

/**
 * SearchFilters component
 */
export const SearchFilters: React.FC<SearchFiltersProps> = ({
  filters,
  values,
  onChange,
  onClear,
  onApply,
  collapsible = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(!collapsible);

  const activeFilterCount = Object.values(values).filter(
    v => v !== undefined && v !== '' && v !== null
  ).length;

  const renderFilter = (filter: FilterConfig) => {
    switch (filter.type) {
      case 'select':
        return (
          <select
            value={values[filter.key] || ''}
            onChange={e => onChange(filter.key, e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">All</option>
            {filter.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {filter.options?.map(option => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={values[filter.key]?.includes(option.value) || false}
                  onChange={e => {
                    const current = values[filter.key] || [];
                    const newValue = e.target.checked
                      ? [...current, option.value]
                      : current.filter((v: string) => v !== option.value);
                    onChange(filter.key, newValue.length > 0 ? newValue : undefined);
                  }}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'range':
        return (
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder={`Min ${filter.min || ''}`}
                value={values[`${filter.key}Min`] || ''}
                onChange={e =>
                  onChange(`${filter.key}Min`, e.target.value ? Number(e.target.value) : undefined)
                }
                min={filter.min}
                max={filter.max}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <span className="text-gray-500">-</span>
              <input
                type="number"
                placeholder={`Max ${filter.max || ''}`}
                value={values[`${filter.key}Max`] || ''}
                onChange={e =>
                  onChange(`${filter.key}Max`, e.target.value ? Number(e.target.value) : undefined)
                }
                min={filter.min}
                max={filter.max}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        );

      case 'toggle':
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onChange(filter.key, values[filter.key] === true ? undefined : true)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                values[filter.key] ? 'bg-red-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  values[filter.key] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">
              {values[filter.key] ? 'Yes' : 'No'}
            </span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={onClear}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}

          {collapsible && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {isExpanded && (
        <div className="space-y-4">
          {filters.map(filter => (
            <div key={filter.key}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {filter.label}
              </label>
              {renderFilter(filter)}
            </div>
          ))}

          {/* Apply Button */}
          {onApply && (
            <button
              onClick={onApply}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
            >
              Apply Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchFilters;
