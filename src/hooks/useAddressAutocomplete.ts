import { useCallback, useEffect, useRef, useState } from 'react';
import { captureHandledError } from '../services/errorLog.service';

export type AddressSuggestion = {
  place_id?: string | number;
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, any>;
};

type UseAddressAutocompleteOptions = {
  debounceMs?: number;
  limit?: number;
  scope?: 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';
  page?: string;
};

export const useAddressAutocomplete = (options?: UseAddressAutocompleteOptions) => {
  const debounceMs = options?.debounceMs ?? 400;
  const limit = options?.limit ?? 5;
  const scope = options?.scope ?? 'unknown';
  const page = options?.page ?? 'unknown';

  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const clearSuggestions = useCallback(() => {
    requestIdRef.current += 1;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setSuggestions([]);
    setShowSuggestions(false);
    setNoResults(false);
  }, []);

  const searchSuggestions = useCallback(
    (query: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (!query.trim()) {
        clearSuggestions();
        return;
      }

      const requestId = ++requestIdRef.current;
      timeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1`
          );
          if (!response.ok) {
            throw new Error(`Address lookup failed with status ${response.status}`);
          }

          const data = await response.json();
          const nextSuggestions = Array.isArray(data) ? data : [];
          if (requestId !== requestIdRef.current) return;

          setSuggestions(nextSuggestions);
          setShowSuggestions(true);
          setNoResults(nextSuggestions.length === 0);
        } catch (error) {
          if (requestId !== requestIdRef.current) return;
          setSuggestions([]);
          setShowSuggestions(true);
          setNoResults(true);
          void captureHandledError(error, {
            source: 'frontend',
            scope,
            metadata: {
              page,
              kind: 'address.autocomplete.lookup',
            },
          });
        }
      }, debounceMs);
    },
    [clearSuggestions, debounceMs, limit, page, scope]
  );

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    suggestions,
    showSuggestions,
    noResults,
    setShowSuggestions,
    searchSuggestions,
    clearSuggestions,
  };
};
