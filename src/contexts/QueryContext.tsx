/**
 * React Query Context
 *
 * Provides caching and state management for async data
 */

import React from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { captureHandledError } from '../services/errorLog.service';
import { QUERY_DEFAULTS } from '../constants/query';

// Create a client
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      void captureHandledError(error, {
        source: 'frontend',
        metadata: {
          kind: 'react_query.query',
          queryKey: query.queryKey,
        },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      void captureHandledError(error, {
        source: 'frontend',
        metadata: {
          kind: 'react_query.mutation',
          mutationKey: mutation.options.mutationKey || null,
        },
      });
    },
  }),
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes
      staleTime: QUERY_DEFAULTS.staleTime,
      // Keep cached data for 10 minutes
      gcTime: QUERY_DEFAULTS.gcTime,
      // Retry failed requests 1 time
      retry: QUERY_DEFAULTS.retry,
      // Refetch on window focus in development only
      refetchOnWindowFocus: import.meta.env.DEV,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry failed mutations 1 time
      retry: QUERY_DEFAULTS.retry,
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * Query Provider Component
 */
export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export { queryClient };
export default QueryProvider;
