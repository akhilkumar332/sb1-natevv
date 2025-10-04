/**
 * NearbySearch Component
 *
 * Component for searching nearby items with location and radius
 */

import React, { useState } from 'react';
import { MapPin, Sliders } from 'lucide-react';
import { Coordinates } from '../../types/database.types';
import { LocationPicker } from './LocationPicker';
import { PaginatedResults } from './PaginatedResults';
import { useNearbySearch, useCurrentLocation } from '../../hooks/useGeolocation';
import { formatDistance } from '../../utils/geolocation';

interface NearbySearchProps<T> {
  searchFn: (location: Coordinates, radiusKm: number) => Promise<(T & { distance?: number })[]>;
  renderItem: (item: T & { distance?: number }, index: number) => React.ReactNode;
  title?: string;
  emptyMessage?: string;
  defaultRadius?: number;
  radiusOptions?: number[];
  showMap?: boolean;
  gridLayout?: boolean;
}

/**
 * NearbySearch Component
 */
export function NearbySearch<T>({
  searchFn,
  renderItem,
  title = 'Nearby Search',
  emptyMessage = 'No results found nearby',
  defaultRadius = 10,
  radiusOptions = [5, 10, 20, 50, 100],
  gridLayout = false,
}: NearbySearchProps<T>) {
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [selectedRadius, setSelectedRadius] = useState(defaultRadius);
  const [showFilters, setShowFilters] = useState(true);

  // Get current location
  const { location: currentLocation } = useCurrentLocation({
    watch: false,
  });

  // Use nearby search hook
  const { results, loading, error, search, setRadius } = useNearbySearch({
    searchFn,
    location: selectedLocation || currentLocation,
    radiusKm: selectedRadius,
    autoSearch: false,
  });

  // Handle location change
  const handleLocationChange = (location: Coordinates) => {
    setSelectedLocation(location);
  };

  // Handle radius change
  const handleRadiusChange = (radius: number) => {
    setSelectedRadius(radius);
    setRadius(radius);
  };

  // Handle search
  const handleSearch = () => {
    search();
  };

  const activeLocation = selectedLocation || currentLocation;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
        >
          <Sliders className="w-4 h-4" />
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          {/* Location Picker */}
          <LocationPicker
            value={selectedLocation || undefined}
            onChange={handleLocationChange}
            label="Search Location"
            showCurrentLocation={true}
            showCityPicker={true}
          />

          {/* Radius Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Radius: {selectedRadius} km
            </label>
            <div className="flex gap-2 flex-wrap">
              {radiusOptions.map((radius) => (
                <button
                  key={radius}
                  onClick={() => handleRadiusChange(radius)}
                  className={`px-4 py-2 rounded transition-colors ${
                    selectedRadius === radius
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {radius} km
                </button>
              ))}
            </div>

            {/* Custom Radius Input */}
            <div className="mt-2">
              <input
                type="number"
                min="1"
                max="500"
                value={selectedRadius}
                onChange={(e) => handleRadiusChange(parseInt(e.target.value) || defaultRadius)}
                className="w-32 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Custom"
              />
              <span className="ml-2 text-sm text-gray-500">km (custom)</span>
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={!activeLocation || loading}
            className="w-full px-6 py-3 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Searching...' : 'Search Nearby'}
          </button>

          {/* Active Location Display */}
          {activeLocation && (
            <div className="flex items-center gap-2 text-sm text-gray-600 p-3 bg-gray-50 rounded">
              <MapPin className="w-4 h-4 text-red-600" />
              <span>
                Searching within {selectedRadius} km of{' '}
                {selectedLocation ? 'selected location' : 'your current location'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {/* Results Count */}
      {!loading && results.length > 0 && (
        <div className="text-sm text-gray-600">
          Found {results.length} result{results.length !== 1 ? 's' : ''} within {selectedRadius} km
        </div>
      )}

      {/* Results */}
      <PaginatedResults
        results={results}
        loading={loading}
        hasMore={false}
        onLoadMore={() => {}}
        renderItem={(item, index) => (
          <div className="relative">
            {renderItem(item, index)}
            {item.distance !== undefined && (
              <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded shadow text-xs font-medium text-gray-700">
                {formatDistance(item.distance)}
              </div>
            )}
          </div>
        )}
        emptyMessage={
          activeLocation
            ? emptyMessage
            : 'Please select a location or allow location access to search nearby'
        }
        gridLayout={gridLayout}
      />
    </div>
  );
}

export default NearbySearch;
