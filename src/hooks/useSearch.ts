/**
 * useSearch Hook
 *
 * Reusable hook for implementing search functionality with filters and pagination
 */

import { useState, useCallback } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';

interface UseSearchOptions<T, C> {
  searchFn: (criteria: C, pagination: any) => Promise<{
    results: T[];
    hasMore: boolean;
    lastDoc?: DocumentSnapshot;
    totalCount: number;
  }>;
  initialCriteria?: C;
  limitCount?: number;
}

interface UseSearchResult<T, C> {
  results: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  criteria: C;
  currentPage: number;
  setCriteria: (criteria: C) => void;
  updateCriteria: (updates: Partial<C>) => void;
  search: () => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
}

/**
 * Generic search hook with filtering and pagination
 */
export function useSearch<T, C extends Record<string, any>>({
  searchFn,
  initialCriteria = {} as C,
  limitCount = 20,
}: UseSearchOptions<T, C>): UseSearchResult<T, C> {
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | undefined>();
  const [criteria, setCriteriaState] = useState<C>(initialCriteria);
  const [currentPage, setCurrentPage] = useState(1);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await searchFn(criteria, {
        limitCount,
        lastDoc: undefined,
      });

      setResults(result.results);
      setHasMore(result.hasMore);
      setLastDoc(result.lastDoc);
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [criteria, searchFn, limitCount]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await searchFn(criteria, {
        limitCount,
        lastDoc,
      });

      setResults(prev => [...prev, ...result.results]);
      setHasMore(result.hasMore);
      setLastDoc(result.lastDoc);
      setCurrentPage(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, criteria, searchFn, limitCount, lastDoc]);

  const setCriteria = useCallback((newCriteria: C) => {
    setCriteriaState(newCriteria);
  }, []);

  const updateCriteria = useCallback((updates: Partial<C>) => {
    setCriteriaState(prev => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setResults([]);
    setCriteriaState(initialCriteria);
    setHasMore(false);
    setLastDoc(undefined);
    setCurrentPage(1);
    setError(null);
  }, [initialCriteria]);

  return {
    results,
    loading,
    error,
    hasMore,
    criteria,
    currentPage,
    setCriteria,
    updateCriteria,
    search,
    loadMore,
    reset,
  };
}

export default useSearch;
