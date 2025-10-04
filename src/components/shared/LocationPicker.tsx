/**
 * LocationPicker Component
 *
 * Component for selecting location (coordinates or city)
 */

import React, { useState } from 'react';
import { MapPin, Navigation, Loader, Search } from 'lucide-react';
import { Coordinates } from '../../types/database.types';
import { getCurrentLocation, CITY_COORDINATES } from '../../utils/geolocation';

interface LocationPickerProps {
  value?: Coordinates;
  onChange: (location: Coordinates, address?: string) => void;
  label?: string;
  placeholder?: string;
  showCurrentLocation?: boolean;
  showCityPicker?: boolean;
  disabled?: boolean;
}

/**
 * LocationPicker Component
 */
export const LocationPicker: React.FC<LocationPickerProps> = ({
  value,
  onChange,
  label = 'Location',
  placeholder = 'Select or enter location',
  showCurrentLocation = true,
  showCityPicker = true,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Filter cities based on search
  const filteredCities = Object.keys(CITY_COORDINATES).filter(city =>
    city.toLowerCase().includes(searchText.toLowerCase())
  );

  // Get current location from browser
  const handleGetCurrentLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      const location = await getCurrentLocation();
      onChange(location, 'Current Location');
      setSelectedCity(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get location');
    } finally {
      setLoading(false);
    }
  };

  // Select a city from dropdown
  const handleCitySelect = (city: string) => {
    const coordinates = CITY_COORDINATES[city];
    if (coordinates) {
      onChange(coordinates, city);
      setSelectedCity(city);
      setSearchText(city);
      setShowSuggestions(false);
    }
  };

  // Clear selection
  const handleClear = () => {
    setSearchText('');
    setSelectedCity(null);
    setError(null);
  };

  return (
    <div className="space-y-2">
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      {/* Current Location Button */}
      {showCurrentLocation && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={disabled || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
            Use Current Location
          </button>
        </div>
      )}

      {/* City Search/Picker */}
      {showCityPicker && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* City Suggestions Dropdown */}
          {showSuggestions && filteredCities.length > 0 && searchText && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredCities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => handleCitySelect(city)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{city}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Location Display */}
      {value && (
        <div className="p-3 bg-gray-50 rounded border border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-red-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-gray-900">
                  {selectedCity || 'Selected Location'}
                </div>
                <div className="text-gray-500">
                  {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-600 flex items-center gap-1">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Manual Coordinates Input */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
          Enter coordinates manually
        </summary>
        <div className="mt-2 space-y-2">
          <input
            type="number"
            step="0.000001"
            placeholder="Latitude (e.g., 19.076)"
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent"
            onChange={(e) => {
              const lat = parseFloat(e.target.value);
              if (!isNaN(lat) && value?.longitude) {
                onChange({ latitude: lat, longitude: value.longitude });
              }
            }}
          />
          <input
            type="number"
            step="0.000001"
            placeholder="Longitude (e.g., 72.8777)"
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent"
            onChange={(e) => {
              const lon = parseFloat(e.target.value);
              if (!isNaN(lon) && value?.latitude) {
                onChange({ latitude: value.latitude, longitude: lon });
              }
            }}
          />
        </div>
      </details>
    </div>
  );
};

export default LocationPicker;
