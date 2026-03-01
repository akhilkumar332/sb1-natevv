import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, documentId, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { DonorSummary } from './useNgoData';
import {
  buildDonorQueryConstraints,
  filterDonorRows,
  mapDocToDonorSummary,
} from '../utils/donorDirectory';
import { readCacheWithTtl, writeCache } from '../utils/cacheLifecycle';

type DonorDirectoryScope = 'ngo' | 'bloodbank';
type Direction = 'initial' | 'next' | 'prev';

type DonorDirectoryCacheOptions = {
  pageCacheKeyPrefix?: string;
  mapCacheKey?: string;
  ttlMs?: number;
  enablePrefetch?: boolean;
};

type UseDonorDirectoryOptions = {
  scope: DonorDirectoryScope;
  page: string;
  pageSize?: number;
  mapFetchLimit?: number;
  lowBandwidthMode?: boolean;
  cache?: DonorDirectoryCacheOptions;
  onError: (error: unknown, kind: string, metadata?: Record<string, unknown>) => void;
  onPageLoadError?: (error: unknown) => void;
};

type PageCachePayload = {
  donors: SerializedDonor[];
  firstDocId: string | null;
  lastDocId: string | null;
  hasNextPage: boolean;
};

type MapCachePayload = {
  donors: SerializedDonor[];
};

type SerializedDonor = Omit<DonorSummary, 'lastDonation' | 'createdAt'> & {
  lastDonation?: string;
  createdAt?: string;
};

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const hydrateDonor = (donor: any): DonorSummary => ({
  ...donor,
  lastDonation: donor.lastDonation ? new Date(donor.lastDonation) : undefined,
  createdAt: donor.createdAt ? new Date(donor.createdAt) : undefined,
});

const sanitizeDonor = (donor: DonorSummary): SerializedDonor => ({
  ...donor,
  lastDonation: donor.lastDonation ? donor.lastDonation.toISOString() : undefined,
  createdAt: donor.createdAt ? donor.createdAt.toISOString() : undefined,
});

const waitForAuthResolution = async (timeoutMs = 5000): Promise<void> => {
  if (auth.currentUser) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    const unsubscribe = onAuthStateChanged(auth, () => {
      clearTimeout(timer);
      unsubscribe();
      finish();
    });
  });
};



export const useDonorDirectory = (options: UseDonorDirectoryOptions) => {
  const lowBandwidthMode = Boolean(options.lowBandwidthMode);
  const pageSize = options.pageSize ?? (lowBandwidthMode ? 6 : 10);
  const mapFetchLimit = options.mapFetchLimit ?? (lowBandwidthMode ? 80 : 200);
  const enablePrefetch = Boolean(options.cache?.enablePrefetch) && !lowBandwidthMode;
  const cacheTtlMs = options.cache?.ttlMs ?? 5 * 60 * 1000;
  const [searchTerm, setSearchTerm] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [donors, setDonors] = useState<DonorSummary[]>([]);
  const [mapDonors, setMapDonors] = useState<DonorSummary[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingDonors, setLoadingDonors] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [firstDocId, setFirstDocId] = useState<string | null>(null);
  const [lastDocId, setLastDocId] = useState<string | null>(null);
  const [authReadyKey, setAuthReadyKey] = useState<string>(() => auth.currentUser?.uid || '');

  const isMountedRef = useRef(true);
  const donorFetchIdRef = useRef(0);
  const firstDocIdRef = useRef<string | null>(null);
  const lastDocIdRef = useRef<string | null>(null);
  const onPageLoadErrorRef = useRef<UseDonorDirectoryOptions['onPageLoadError']>(options.onPageLoadError);
  const shouldEnrichContacts = options.scope === 'ngo' || options.scope === 'bloodbank';

  const pageCacheKey = useMemo(() => {
    if (!options.cache?.pageCacheKeyPrefix) return null;
    return `${options.cache.pageCacheKeyPrefix}_${bloodTypeFilter}_${availabilityFilter}_${cityFilter}_lb${lowBandwidthMode ? 1 : 0}`;
  }, [options.cache?.pageCacheKeyPrefix, bloodTypeFilter, availabilityFilter, cityFilter, lowBandwidthMode]);

  const mapCacheKey = options.cache?.mapCacheKey
    ? `${options.cache.mapCacheKey}_lb${lowBandwidthMode ? 1 : 0}`
    : null;

  const reportError = useCallback(
    (error: unknown, kind: string, metadata?: Record<string, unknown>) => {
      options.onError(error, kind, metadata);
    },
    [options.onError]
  );

  useEffect(() => {
    firstDocIdRef.current = firstDocId;
  }, [firstDocId]);

  useEffect(() => {
    lastDocIdRef.current = lastDocId;
  }, [lastDocId]);

  useEffect(() => {
    onPageLoadErrorRef.current = options.onPageLoadError;
  }, [options.onPageLoadError]);

  const enrichDonorContacts = useCallback(async (rows: DonorSummary[]): Promise<DonorSummary[]> => {
    if (!shouldEnrichContacts || rows.length === 0) return rows;
    try {
      if (!auth.currentUser) {
        await waitForAuthResolution();
      }
      const donorIds = Array.from(new Set(rows.map((donor) => donor.id).filter(Boolean)));
      const contactMap = new Map<string, { email?: string; phone?: string }>();
      // Primary path: batched query reads from users by explicit donor IDs.
      // This mirrors prior "query users collection" behavior while keeping page source publicDonors.
      for (let i = 0; i < donorIds.length; i += 30) {
        const chunk = donorIds.slice(i, i + 30);
        try {
          const snap = await getDocs(
            query(collection(db, 'users'), where(documentId(), 'in', chunk))
          );
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data() as any;
            contactMap.set(docSnap.id, {
              email: data?.email,
              phone: data?.phoneNumber || data?.phone,
            });
          });
        } catch {
          // Fall back to per-doc reads for this chunk.
        }
      }

      // Fallback path: per-doc reads for any IDs still unresolved.
      if (contactMap.size < donorIds.length) {
        // Retry unresolved IDs a few times because Firestore channels can be flaky
        // right after login/session restore on some networks.
        let unresolved = donorIds.filter((id) => !contactMap.has(id));
        for (let attempt = 0; attempt < 3 && unresolved.length > 0; attempt += 1) {
          const detailResults = await Promise.allSettled(
            unresolved.map((id) => getDoc(doc(db, 'users', id)))
          );
          detailResults.forEach((result, index) => {
            if (result.status !== 'fulfilled' || !result.value.exists()) return;
            const id = unresolved[index];
            try {
              const docSnap = result.value;
              const data = docSnap.data() as any;
              contactMap.set(id, {
                email: data?.email,
                phone: data?.phoneNumber || data?.phone,
              });
            } catch {
              // Ignore malformed profile rows and keep public donor data.
            }
          });
          unresolved = donorIds.filter((id) => !contactMap.has(id));
          if (unresolved.length > 0 && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          }
        }
      }

      return rows.map((donor) => {
        const contact = contactMap.get(donor.id);
        if (!contact) return donor;
        return {
          ...donor,
          email: contact.email || donor.email,
          phone: contact.phone || donor.phone,
        };
      });
    } catch (error) {
      const code = String((error as any)?.code || '').toLowerCase();
      if (code !== 'permission-denied' && code !== 'unauthenticated') {
        reportError(error, `${options.scope}.donors.contacts.fetch`);
      }
      return rows;
    }
  }, [options.scope, reportError, shouldEnrichContacts]);

  const cityOptions = useMemo(() => {
    const set = new Set(donors.map((donor) => donor.city).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [donors]);

  const filteredDonors = useMemo(() => filterDonorRows(donors, searchTerm), [donors, searchTerm]);
  const mapFilteredDonors = useMemo(
    () => filterDonorRows(mapDonors, searchTerm, bloodTypeFilter, availabilityFilter, cityFilter),
    [mapDonors, searchTerm, bloodTypeFilter, availabilityFilter, cityFilter]
  );

  const mapCenter = useMemo<[number, number]>(() => {
    const first = mapFilteredDonors.find(
      (donor) => typeof donor.latitude === 'number' && typeof donor.longitude === 'number'
    );
    return first ? [first.latitude as number, first.longitude as number] : [20.5937, 78.9629];
  }, [mapFilteredDonors]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setAuthReadyKey(firebaseUser?.uid || '');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setFirstDocId(null);
    setLastDocId(null);
    setHasNextPage(false);
  }, [bloodTypeFilter, availabilityFilter, cityFilter]);

  const fetchDonorPage = useCallback(
    async (direction: Direction = 'initial', runtimeOptions?: { silent?: boolean; bypassCache?: boolean }) => {
      const fetchId = ++donorFetchIdRef.current;
      if (!runtimeOptions?.silent) {
        setLoadingDonors(true);
      }

      const shouldUseCache = direction === 'initial' && !runtimeOptions?.bypassCache && Boolean(pageCacheKey);
      if (shouldUseCache && pageCacheKey) {
        const cached = readCacheWithTtl<PageCachePayload, {
          donors: DonorSummary[];
          firstDocId: string | null;
          lastDocId: string | null;
          hasNextPage: boolean;
        }>({
          storage: 'session',
          key: pageCacheKey,
          ttlMs: cacheTtlMs,
          kindPrefix: `${options.scope}.donors.cache.page`,
          onError: reportError,
          hydrate: (payload) => ({
            donors: Array.isArray(payload?.donors) ? payload.donors.map(hydrateDonor) : [],
            firstDocId: payload?.firstDocId || null,
            lastDocId: payload?.lastDocId || null,
            hasNextPage: Boolean(payload?.hasNextPage),
          }),
        });
        if (cached && isMountedRef.current) {
          setDonors(cached.donors);
          setFirstDocId(cached.firstDocId);
          setLastDocId(cached.lastDocId);
          setHasNextPage(cached.hasNextPage);
          setLoadingDonors(false);
          if (shouldEnrichContacts && cached.donors.length > 0) {
            void enrichDonorContacts(cached.donors).then((enriched) => {
              if (!isMountedRef.current || fetchId !== donorFetchIdRef.current) return;
              setDonors(enriched);
            });
          }
          return;
        }
      }

      try {
        const constraints = buildDonorQueryConstraints({
          bloodTypeFilter,
          availabilityFilter,
          cityFilter,
          direction,
          pageSize,
          firstCursor: firstDocIdRef.current,
          lastCursor: lastDocIdRef.current,
        });
        const snapshot = await getDocs(query(collection(db, 'publicDonors'), ...constraints));
        let docs = snapshot.docs;
        const hasExtra = docs.length > pageSize;
        if (hasExtra) {
          docs = direction === 'prev' ? docs.slice(docs.length - pageSize) : docs.slice(0, pageSize);
        }
        const donorList = await enrichDonorContacts(docs.map(mapDocToDonorSummary));
        if (!isMountedRef.current || fetchId !== donorFetchIdRef.current) return;
        setDonors(donorList);
        setFirstDocId(docs[0]?.id || null);
        setLastDocId(docs[docs.length - 1]?.id || null);
        const effectiveHasNext = direction === 'prev' ? true : hasExtra;
        setHasNextPage(effectiveHasNext);

        if (direction === 'initial' && pageCacheKey) {
          writeCache<PageCachePayload>({
            storage: 'session',
            key: pageCacheKey,
            data: {
              donors: donorList.map(sanitizeDonor),
              firstDocId: docs[0]?.id || null,
              lastDocId: docs[docs.length - 1]?.id || null,
              hasNextPage: effectiveHasNext,
            },
            kindPrefix: `${options.scope}.donors.cache.page`,
            onError: reportError,
          });
        }
      } catch (error) {
        reportError(error, `${options.scope}.donors.page.fetch`, {
          direction,
          silent: Boolean(runtimeOptions?.silent),
          bloodTypeFilter,
          availabilityFilter,
          cityFilter,
        });
        if (!runtimeOptions?.silent) {
          onPageLoadErrorRef.current?.(error);
        }
        if (isMountedRef.current && fetchId === donorFetchIdRef.current) {
          setDonors([]);
          setHasNextPage(false);
        }
      } finally {
        if (!runtimeOptions?.silent && isMountedRef.current && fetchId === donorFetchIdRef.current) {
          setLoadingDonors(false);
        }
      }
    },
    [
      availabilityFilter,
      bloodTypeFilter,
      cacheTtlMs,
      cityFilter,
      options.scope,
      pageCacheKey,
      pageSize,
      reportError,
      enrichDonorContacts,
      shouldEnrichContacts,
    ]
  );

  const fetchMapDonors = useCallback(
    async (runtimeOptions?: { bypassCache?: boolean }) => {
      if (mapCacheKey && !runtimeOptions?.bypassCache) {
        const cached = readCacheWithTtl<MapCachePayload, DonorSummary[]>({
          storage: 'session',
          key: mapCacheKey,
          ttlMs: cacheTtlMs,
          kindPrefix: `${options.scope}.donors.cache.map`,
          onError: reportError,
          hydrate: (payload) => Array.isArray(payload?.donors) ? payload.donors.map(hydrateDonor) : [],
        });
        if (cached && isMountedRef.current) {
          setMapDonors(cached);
          return;
        }
      }

      try {
        const publicSnap = await getDocs(
          query(collection(db, 'publicDonors'), orderBy(documentId()), limit(mapFetchLimit))
        );
        const publicRows = publicSnap.docs
          .map(mapDocToDonorSummary)
          .filter((donor) => typeof donor.latitude === 'number' && typeof donor.longitude === 'number');
        if (!isMountedRef.current) return;
        setMapDonors(publicRows);
        if (mapCacheKey) {
          writeCache<MapCachePayload>({
            storage: 'session',
            key: mapCacheKey,
            data: {
              donors: publicRows.map(sanitizeDonor),
            },
            kindPrefix: `${options.scope}.donors.cache.map`,
            onError: reportError,
          });
        }
      } catch (error) {
        reportError(error, `${options.scope}.donors.map.fetch`);
        if (isMountedRef.current) {
          setMapDonors([]);
        }
      }
    },
    [cacheTtlMs, mapCacheKey, mapFetchLimit, options.scope, reportError]
  );

  useEffect(() => {
    void fetchDonorPage('initial');
  }, [fetchDonorPage, pageCacheKey, authReadyKey]);

  useEffect(() => {
    if (!pageCacheKey || !enablePrefetch) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const prefetchKey = `${options.scope}_donors_prefetch_${pageCacheKey}`;
    const lastPrefetch = window.sessionStorage.getItem(prefetchKey);
    if (lastPrefetch && Date.now() - Number(lastPrefetch) < cacheTtlMs) {
      return;
    }
    const task = () => {
      void fetchDonorPage('initial', { silent: true, bypassCache: true })
        .finally(() => {
          try {
            window.sessionStorage.setItem(prefetchKey, Date.now().toString());
          } catch (error) {
            reportError(error, `${options.scope}.donors.prefetch.cache.write`);
          }
        });
    };
    const idle = typeof globalThis !== 'undefined' ? (globalThis as any).requestIdleCallback : null;
    if (typeof idle === 'function') {
      const id = idle(task);
      return () => {
        const cancel = (globalThis as any).cancelIdleCallback;
        if (typeof cancel === 'function') cancel(id);
      };
    }
    const timer = setTimeout(task, 1200);
    return () => clearTimeout(timer);
  }, [cacheTtlMs, enablePrefetch, fetchDonorPage, options.scope, pageCacheKey, reportError]);

  useEffect(() => {
    let isActive = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const run = async () => {
      await fetchMapDonors();
      if (!isActive) return;
    };
    void run();

    if (mapCacheKey && enablePrefetch && typeof window !== 'undefined' && window.sessionStorage) {
      const prefetchKey = `${options.scope}_donors_map_prefetch`;
      const lastPrefetch = window.sessionStorage.getItem(prefetchKey);
      if (!lastPrefetch || Date.now() - Number(lastPrefetch) >= cacheTtlMs) {
        const task = () => {
          void fetchMapDonors({ bypassCache: true })
            .finally(() => {
              try {
                window.sessionStorage.setItem(prefetchKey, Date.now().toString());
              } catch (error) {
                reportError(error, `${options.scope}.donors.map.prefetch.cache.write`);
              }
            });
        };
        const idle = typeof globalThis !== 'undefined' ? (globalThis as any).requestIdleCallback : null;
        if (typeof idle === 'function') {
          idleId = idle(task);
        } else {
          timerId = setTimeout(task, 1200);
        }
      }
    }

    return () => {
      isActive = false;
      if (timerId) {
        clearTimeout(timerId);
      }
      if (idleId !== null) {
        const cancel = (globalThis as any).cancelIdleCallback;
        if (typeof cancel === 'function') {
          cancel(idleId);
        }
      }
    };
  }, [cacheTtlMs, enablePrefetch, fetchMapDonors, mapCacheKey, options.scope, reportError]);

  const onPrevPage = useCallback(async () => {
    if (currentPage === 1 || loadingDonors) return;
    await fetchDonorPage('prev');
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, [currentPage, fetchDonorPage, loadingDonors]);

  const onNextPage = useCallback(async () => {
    if (!hasNextPage || loadingDonors) return;
    await fetchDonorPage('next');
    setCurrentPage((prev) => prev + 1);
  }, [fetchDonorPage, hasNextPage, loadingDonors]);

  return {
    bloodTypes: BLOOD_TYPES,
    cityOptions,
    searchTerm,
    setSearchTerm,
    bloodTypeFilter,
    setBloodTypeFilter,
    availabilityFilter,
    setAvailabilityFilter,
    cityFilter,
    setCityFilter,
    filteredDonors,
    mapFilteredDonors,
    mapCenter,
    currentPage,
    loadingDonors,
    hasNextPage,
    onPrevPage,
    onNextPage,
  };
};

export default useDonorDirectory;
