/**
 * SearchBar Component
 *
 * Advanced search bar with autocomplete and quick filters
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader } from 'lucide-react';

interface SearchSuggestion {
  label: string;
  value: string;
  category?: string;
}

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  onClear?: () => void;
  suggestions?: SearchSuggestion[];
  loading?: boolean;
  showSuggestions?: boolean;
  debounceMs?: number;
  minChars?: number;
}

/**
 * SearchBar component with autocomplete
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search...',
  value,
  onChange,
  onSearch,
  onClear,
  suggestions = [],
  loading = false,
  showSuggestions = true,
  debounceMs = 300,
  minChars = 2,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    if (value.length >= minChars) {
      const timer = setTimeout(() => {
        onSearch(value);
      }, debounceMs);

      return () => clearTimeout(timer);
    }
  }, [value, minChars, debounceMs, onSearch]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else {
          onSearch(value);
          setIsFocused(false);
        }
        break;

      case 'Escape':
        setIsFocused(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    onChange(suggestion.value);
    onSearch(suggestion.value);
    setIsFocused(false);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    onChange('');
    if (onClear) {
      onClear();
    }
    inputRef.current?.focus();
  };

  const showDropdown =
    showSuggestions &&
    isFocused &&
    value.length >= minChars &&
    suggestions.length > 0;

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="w-5 h-5 text-gray-400" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {loading ? (
            <Loader className="w-5 h-5 text-gray-400 animate-spin" />
          ) : value ? (
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`px-4 py-3 cursor-pointer transition-colors ${
                index === selectedIndex
                  ? 'bg-red-50 text-red-900'
                  : 'hover:bg-gray-50'
              } ${index > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-900">{suggestion.label}</span>
                {suggestion.category && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {suggestion.category}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
