/**
 * PaginatedResults Component
 *
 * Reusable component for displaying paginated search results
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Loader } from 'lucide-react';

interface PaginatedResultsProps<T> {
  results: T[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onPrevious?: () => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  loadingMessage?: string;
  currentPage?: number;
  itemsPerPage?: number;
  gridLayout?: boolean;
}

/**
 * PaginatedResults component
 */
export function PaginatedResults<T>({
  results,
  loading,
  hasMore,
  onLoadMore,
  onPrevious,
  renderItem,
  emptyMessage = 'No results found',
  loadingMessage = 'Loading results...',
  currentPage = 1,
  gridLayout = false,
}: PaginatedResultsProps<T>) {
  // Loading state
  if (loading && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader className="w-8 h-8 text-red-600 animate-spin mb-3" />
        <p className="text-gray-600">{loadingMessage}</p>
      </div>
    );
  }

  // Empty state
  if (!loading && results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results */}
      <div
        className={
          gridLayout
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-4'
        }
      >
        {results.map((item, index) => (
          <div key={index}>{renderItem(item, index)}</div>
        ))}
      </div>

      {/* Loading more indicator */}
      {loading && results.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader className="w-6 h-6 text-red-600 animate-spin" />
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && (hasMore || (onPrevious && currentPage > 1)) && (
        <div className="flex items-center justify-between py-4 border-t">
          {/* Results Info */}
          <div className="text-sm text-gray-600">
            Showing {results.length} results
            {currentPage > 1 && ` (Page ${currentPage})`}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-2">
            {onPrevious && currentPage > 1 && (
              <button
                onClick={onPrevious}
                className="flex items-center gap-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}

            {hasMore && (
              <button
                onClick={onLoadMore}
                className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Load More
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* No more results message */}
      {!loading && !hasMore && results.length > 0 && (
        <div className="text-center py-4 text-sm text-gray-500 border-t">
          No more results to load
        </div>
      )}
    </div>
  );
}

export default PaginatedResults;
