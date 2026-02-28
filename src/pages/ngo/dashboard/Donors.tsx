import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Heart, Users, TrendingUp, ChevronRight, Search, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Popup, useMap, useMapEvents, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { NgoDashboardContext } from '../NgoDashboard';
import { collection, documentId, endBefore, getDocs, limit, limitToLast, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import type { DonorSummary } from '../../../hooks/useNgoData';
import { captureHandledError } from '../../../services/errorLog.service';
import notify from '../../../services/notify.service';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

type DonorMapPoint = DonorSummary & { id: string };

type DonorCluster = {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  donors: DonorMapPoint[];
};

const getGridSize = (zoom: number) => {
  if (zoom >= 10) return 0.08;
  if (zoom >= 8) return 0.2;
  if (zoom >= 6) return 0.5;
  if (zoom >= 4) return 1;
  return 2;
};

const buildClusters = (donors: DonorMapPoint[], zoom: number): DonorCluster[] => {
  const gridSize = getGridSize(zoom);
  const buckets = new Map<string, DonorCluster>();

  donors.forEach((donor) => {
    const lat = donor.latitude as number;
    const lng = donor.longitude as number;
    const key = `${Math.round(lat / gridSize)}:${Math.round(lng / gridSize)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.donors.push(donor);
      existing.latitude = (existing.latitude * (existing.count - 1) + lat) / existing.count;
      existing.longitude = (existing.longitude * (existing.count - 1) + lng) / existing.count;
    } else {
      buckets.set(key, {
        id: key,
        latitude: lat,
        longitude: lng,
        count: 1,
        donors: [donor],
      });
    }
  });

  return Array.from(buckets.values());
};

function DonorMapLayer({ donors }: { donors: DonorMapPoint[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(() => map.getBounds());

  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
      setBounds(map.getBounds());
    },
    moveend: () => {
      setBounds(map.getBounds());
    },
  });

  useEffect(() => {
    setZoom(map.getZoom());
    setBounds(map.getBounds());
  }, [map]);

  const visibleDonors = useMemo(() => {
    if (!bounds) return donors;
    return donors.filter((donor) =>
      typeof donor.latitude === 'number'
        && typeof donor.longitude === 'number'
        && bounds.contains([donor.latitude, donor.longitude])
    );
  }, [donors, bounds]);

  const clusters = useMemo(() => buildClusters(visibleDonors, zoom), [visibleDonors, zoom]);

  return (
    <>
      {clusters.map((cluster) => {
        const isSingle = cluster.count === 1;
        const radius = isSingle ? 6 : Math.min(28, 8 + cluster.count * 1.2);
        return (
          <CircleMarker
            key={cluster.id}
            center={[cluster.latitude, cluster.longitude]}
            radius={radius}
            pathOptions={{
              color: isSingle ? '#f43f5e' : '#be123c',
              weight: 1,
              fillColor: isSingle ? '#f97316' : '#f59e0b',
              fillOpacity: 0.85,
            }}
          >
            <Popup>
              {isSingle ? (
                <>
                  <div className="text-sm font-semibold text-gray-900">{cluster.donors[0].name}</div>
                  <div className="text-xs text-gray-600">
                    {cluster.donors[0].bloodType || 'Blood type'} • {cluster.donors[0].city || 'City'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-gray-900">{cluster.count} donors</div>
                  <div className="text-xs text-gray-600">Zoom in to see individuals</div>
                </>
              )}
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

function NgoDonors() {
  const { donorCommunity } = useOutletContext<NgoDashboardContext>();
  const [searchTerm, setSearchTerm] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [donors, setDonors] = useState<DonorSummary[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingDonors, setLoadingDonors] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [firstDocId, setFirstDocId] = useState<string | null>(null);
  const [lastDocId, setLastDocId] = useState<string | null>(null);
  const [mapDonors, setMapDonors] = useState<DonorSummary[]>([]);
  const pageSize = 10;
  const donorsCacheTTL = 5 * 60 * 1000;
  const donorsCacheKey = useMemo(
    () => `ngo_donors_cache_${bloodTypeFilter}_${availabilityFilter}_${cityFilter}`,
    [bloodTypeFilter, availabilityFilter, cityFilter]
  );
  const mapCacheKey = 'ngo_donors_map_cache';
  const mapCacheTTL = 5 * 60 * 1000;
  const isMountedRef = useRef(true);
  const donorFetchIdRef = useRef(0);

  const activeRate = donorCommunity.totalDonors > 0
    ? Math.round((donorCommunity.activeDonors / donorCommunity.totalDonors) * 100)
    : 0;
  const newRate = donorCommunity.totalDonors > 0
    ? Math.round((donorCommunity.newThisMonth / donorCommunity.totalDonors) * 100)
    : 0;

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const cityOptions = useMemo(() => {
    const set = new Set(donors.map((donor) => donor.city).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [donors]);

  const filteredDonors = useMemo(() => {
    if (!searchTerm.trim()) return donors;
    const term = searchTerm.toLowerCase();
    return donors.filter((donor) =>
      donor.name.toLowerCase().includes(term) ||
      donor.email?.toLowerCase().includes(term) ||
      donor.city?.toLowerCase().includes(term) ||
      donor.bloodType?.toLowerCase().includes(term)
    );
  }, [donors, searchTerm]);

  const mapFilteredDonors = useMemo(() => {
    let results = mapDonors;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      results = results.filter((donor) =>
        donor.name.toLowerCase().includes(term) ||
        donor.email?.toLowerCase().includes(term) ||
        donor.city?.toLowerCase().includes(term) ||
        donor.bloodType?.toLowerCase().includes(term)
      );
    }
    if (bloodTypeFilter !== 'all') {
      results = results.filter((donor) => donor.bloodType === bloodTypeFilter);
    }
    if (availabilityFilter !== 'all') {
      const shouldBeAvailable = availabilityFilter === 'available';
      results = results.filter((donor) => Boolean(donor.isAvailable) === shouldBeAvailable);
    }
    if (cityFilter !== 'all') {
      results = results.filter((donor) => donor.city === cityFilter);
    }
    return results;
  }, [mapDonors, searchTerm, bloodTypeFilter, availabilityFilter, cityFilter]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setFirstDocId(null);
    setLastDocId(null);
    setHasNextPage(false);
  }, [bloodTypeFilter, availabilityFilter, cityFilter]);

  const sanitizeDonor = (donor: DonorSummary) => ({
    ...donor,
    email: undefined,
    phone: undefined,
  });

  const hydrateDonor = (donor: any): DonorSummary => ({
    ...donor,
    lastDonation: donor.lastDonation ? new Date(donor.lastDonation) : undefined,
    createdAt: donor.createdAt ? new Date(donor.createdAt) : undefined,
  });

  const reportNgoDonorsError = (error: unknown, kind: string, metadata?: Record<string, unknown>) => {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'ngo',
      metadata: {
        page: 'NgoDonors',
        kind,
        ...(metadata || {}),
      },
    });
  };

  const loadDonorCache = () => {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(donorsCacheKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.timestamp || Date.now() - parsed.timestamp > donorsCacheTTL) return null;
      return {
        donors: Array.isArray(parsed.donors) ? parsed.donors.map(hydrateDonor) : [],
        firstDocId: parsed.firstDocId || null,
        lastDocId: parsed.lastDocId || null,
        hasNextPage: Boolean(parsed.hasNextPage),
      };
    } catch (error) {
      console.warn('Failed to parse NGO donors cache', error);
      return null;
    }
  };

  const persistDonorCache = (payload: {
    donors: DonorSummary[];
    firstDocId: string | null;
    lastDocId: string | null;
    hasNextPage: boolean;
  }) => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      window.sessionStorage.setItem(
        donorsCacheKey,
        JSON.stringify({
          timestamp: Date.now(),
          donors: payload.donors.map(sanitizeDonor),
          firstDocId: payload.firstDocId,
          lastDocId: payload.lastDocId,
          hasNextPage: payload.hasNextPage,
        })
      );
    } catch (error) {
      console.warn('Failed to write NGO donors cache', error);
    }
  };

  const fetchDonorPage = async (
    direction: 'initial' | 'next' | 'prev' = 'initial',
    options?: { silent?: boolean; bypassCache?: boolean }
  ) => {
    const fetchId = ++donorFetchIdRef.current;
    if (!options?.silent) {
      setLoadingDonors(true);
    }
    const shouldUseCache = direction === 'initial' && !options?.bypassCache;
    if (shouldUseCache) {
      const cached = loadDonorCache();
      if (cached) {
        if (isMountedRef.current) {
          setDonors(cached.donors);
          setFirstDocId(cached.firstDocId);
          setLastDocId(cached.lastDocId);
          setHasNextPage(cached.hasNextPage);
          setLoadingDonors(false);
        }
        return;
      }
    }
    try {
      const constraints: any[] = [
        where('role', '==', 'donor'),
      ];
      if (bloodTypeFilter !== 'all') {
        constraints.push(where('bloodType', '==', bloodTypeFilter));
      }
      if (availabilityFilter !== 'all') {
        constraints.push(where('isAvailable', '==', availabilityFilter === 'available'));
      }
      if (cityFilter !== 'all') {
        constraints.push(where('city', '==', cityFilter));
      }
      constraints.push(orderBy(documentId()));

      if (direction === 'next' && lastDocId) {
        constraints.push(startAfter(lastDocId));
        constraints.push(limit(pageSize + 1));
      } else if (direction === 'prev' && firstDocId) {
        constraints.push(endBefore(firstDocId));
        constraints.push(limitToLast(pageSize + 1));
      } else {
        constraints.push(limit(pageSize + 1));
      }

      const q = query(collection(db, 'users'), ...constraints);
      const snapshot = await getDocs(q);
      let docs = snapshot.docs;
      const hasExtra = docs.length > pageSize;
      if (hasExtra) {
        docs = direction === 'prev' ? docs.slice(docs.length - pageSize) : docs.slice(0, pageSize);
      }
      const donorList: DonorSummary[] = docs.map((doc) => {
        const data = doc.data();
        const latitude = typeof data.latitude === 'number'
          ? data.latitude
          : typeof data.location?.latitude === 'number'
            ? data.location.latitude
            : undefined;
        const longitude = typeof data.longitude === 'number'
          ? data.longitude
          : typeof data.location?.longitude === 'number'
            ? data.location.longitude
            : undefined;
        return {
          id: doc.id,
          name: data.displayName || data.name || 'Donor',
          email: data.email,
          phone: data.phoneNumber,
          bloodType: data.bloodType,
          city: data.city,
          state: data.state,
          latitude,
          longitude,
          isAvailable: data.isAvailable,
          lastDonation: data.lastDonation?.toDate(),
          totalDonations: data.totalDonations,
          createdAt: data.createdAt?.toDate(),
        };
      });
      if (!isMountedRef.current || fetchId !== donorFetchIdRef.current) return;
      setDonors(donorList);
      setFirstDocId(docs[0]?.id || null);
      setLastDocId(docs[docs.length - 1]?.id || null);
      const effectiveHasNext = direction === 'prev' ? true : hasExtra;
      setHasNextPage(effectiveHasNext);
      if (direction === 'initial') {
        persistDonorCache({
          donors: donorList,
          firstDocId: docs[0]?.id || null,
          lastDocId: docs[docs.length - 1]?.id || null,
          hasNextPage: effectiveHasNext,
        });
      }
    } catch (error) {
      reportNgoDonorsError(error, 'ngo.donors.page.fetch', {
        direction,
        silent: Boolean(options?.silent),
        bloodTypeFilter,
        availabilityFilter,
        cityFilter,
      });
      if (!options?.silent) {
        notify.fromError(error, 'Unable to load donors right now.', { id: 'ngo-donors-page-load-error' });
      }
      if (isMountedRef.current && fetchId === donorFetchIdRef.current) {
        setDonors([]);
        setHasNextPage(false);
      }
    } finally {
      if (!options?.silent && isMountedRef.current && fetchId === donorFetchIdRef.current) {
        setLoadingDonors(false);
      }
    }
  };

  useEffect(() => {
    fetchDonorPage('initial');
  }, [bloodTypeFilter, availabilityFilter, cityFilter, donorsCacheKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const prefetchKey = `ngo_donors_prefetch_${donorsCacheKey}`;
    const lastPrefetch = window.sessionStorage.getItem(prefetchKey);
    if (lastPrefetch && Date.now() - Number(lastPrefetch) < donorsCacheTTL) {
      return;
    }
    const task = () => {
      fetchDonorPage('initial', { silent: true, bypassCache: true })
        .catch((error) => {
          console.warn('NGO donors prefetch failed', error);
        })
        .finally(() => {
          window.sessionStorage.setItem(prefetchKey, Date.now().toString());
        });
    };
    const idle = typeof globalThis !== 'undefined' ? (globalThis as any).requestIdleCallback : null;
    if (typeof idle === 'function') {
      const id = idle(task);
      return () => {
        const cancel = (globalThis as any).cancelIdleCallback;
        if (typeof cancel === 'function') {
          cancel(id);
        }
      };
    }
    const timer = setTimeout(task, 1200);
    return () => clearTimeout(timer);
  }, [donorsCacheKey]);

  useEffect(() => {
    let isActive = true;
    const parseLat = (data: any) => (
      typeof data?.latitude === 'number'
        ? data.latitude
        : typeof data?.location?.latitude === 'number'
          ? data.location.latitude
          : undefined
    );
    const parseLon = (data: any) => (
      typeof data?.longitude === 'number'
        ? data.longitude
        : typeof data?.location?.longitude === 'number'
          ? data.location.longitude
          : undefined
    );

    const mapDoc = (doc: any): DonorSummary => {
      const data = doc.data ? doc.data() : doc;
      const latitude = parseLat(data);
      const longitude = parseLon(data);
      return {
        id: doc.id || data.uid || data.id || data.email || `${Math.random()}`,
        name: data.displayName || data.name || 'Donor',
        email: data.email,
        phone: data.phoneNumber || data.phone,
        bloodType: data.bloodType,
        city: data.city,
        state: data.state,
        latitude,
        longitude,
        isAvailable: data.isAvailable,
        lastDonation: data.lastDonation?.toDate ? data.lastDonation.toDate() : data.lastDonation ? new Date(data.lastDonation) : undefined,
        totalDonations: data.totalDonations,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : undefined,
      };
    };

    const hydrateMapDonor = (donor: any): DonorSummary => ({
      ...donor,
      lastDonation: donor.lastDonation ? new Date(donor.lastDonation) : undefined,
      createdAt: donor.createdAt ? new Date(donor.createdAt) : undefined,
    });

    const sanitizeMapDonor = (donor: DonorSummary) => ({
      ...donor,
      email: undefined,
      phone: undefined,
    });

    const loadMapCache = () => {
      if (typeof window === 'undefined' || !window.sessionStorage) return null;
      const raw = window.sessionStorage.getItem(mapCacheKey);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed?.timestamp || Date.now() - parsed.timestamp > mapCacheTTL) return null;
        return Array.isArray(parsed.donors) ? parsed.donors.map(hydrateMapDonor) : [];
      } catch (error) {
        console.warn('Failed to parse NGO donor map cache', error);
        return null;
      }
    };

    const persistMapCache = (payload: DonorSummary[]) => {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      try {
        window.sessionStorage.setItem(
          mapCacheKey,
          JSON.stringify({
            timestamp: Date.now(),
            donors: payload.map(sanitizeMapDonor),
          })
        );
      } catch (error) {
        console.warn('Failed to write NGO donor map cache', error);
      }
    };

    const fetchMapDonors = async (options?: { silent?: boolean; bypassCache?: boolean }) => {
      if (!options?.bypassCache) {
        const cached = loadMapCache();
        if (cached && isActive) {
          setMapDonors(cached);
          if (options?.silent) {
            return;
          }
        }
      }
      try {
        const publicSnap = await getDocs(
          query(collection(db, 'publicDonors'), orderBy(documentId()), limit(200))
        );
        const publicRows = publicSnap.docs
          .map(mapDoc)
          .filter((donor) => typeof donor.latitude === 'number' && typeof donor.longitude === 'number');
        if (isActive) {
          setMapDonors(publicRows);
        }
        persistMapCache(publicRows);
      } catch (error) {
        reportNgoDonorsError(error, 'ngo.donors.map.fetch');
        if (isActive) {
          setMapDonors([]);
        }
      } finally {
        // no-op
      }
    };

    fetchMapDonors();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const prefetchKey = 'ngo_donors_map_prefetch';
      const lastPrefetch = window.sessionStorage.getItem(prefetchKey);
      if (!lastPrefetch || Date.now() - Number(lastPrefetch) >= mapCacheTTL) {
        const task = () => {
          fetchMapDonors({ silent: true, bypassCache: true })
            .catch((error) => {
              console.warn('NGO donor map prefetch failed', error);
            })
            .finally(() => {
              window.sessionStorage.setItem(prefetchKey, Date.now().toString());
            });
        };
        const idle = typeof globalThis !== 'undefined' ? (globalThis as any).requestIdleCallback : null;
        if (typeof idle === 'function') {
          idle(task);
        } else {
          setTimeout(task, 1200);
        }
      }
    }
    return () => {
      isActive = false;
    };
  }, []);

  const mapCenter = useMemo<[number, number]>(() => {
    const first = mapFilteredDonors.find(
      (donor) => typeof donor.latitude === 'number' && typeof donor.longitude === 'number'
    );
    return first ? [first.latitude as number, first.longitude as number] : [20.5937, 78.9629];
  }, [mapFilteredDonors]);

  const handleExportCSV = () => {
    const headers = [
      'Name',
      'Email',
      'Phone',
      'Blood Type',
      'City',
      'State',
      'Available',
      'Last Donation',
      'Total Donations',
    ];
    const rows = filteredDonors.map((donor) => [
      donor.name,
      donor.email || '',
      donor.phone || '',
      donor.bloodType || '',
      donor.city || '',
      donor.state || '',
      donor.isAvailable ? 'Yes' : 'No',
      donor.lastDonation ? donor.lastDonation.toLocaleDateString() : '',
      donor.totalDonations || '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((item) => `"${String(item).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'donors.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">Donors</p>
            <h2 className="text-2xl font-bold text-gray-900">Donor community</h2>
            <p className="text-sm text-gray-500 mt-1">Monitor engagement and retention.</p>
          </div>
          <Heart className="w-8 h-8 text-red-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100">
          <p className="text-xs text-gray-500">Total donors</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{donorCommunity.totalDonors.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-amber-100">
          <p className="text-xs text-gray-500">Active donors</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{donorCommunity.activeDonors.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100">
          <p className="text-xs text-gray-500">New this month</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{donorCommunity.newThisMonth}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-amber-100">
          <p className="text-xs text-gray-500">Retention rate</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{donorCommunity.retentionRate}%</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Engagement signals</h3>
            <TrendingUp className="w-5 h-5 text-amber-500" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Active donor rate</span>
                <span className="font-semibold text-gray-900">{activeRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-red-600 to-amber-500"
                  style={{ width: `${activeRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>New donor share</span>
                <span className="font-semibold text-gray-900">{newRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-amber-500 to-red-600"
                  style={{ width: `${newRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Retention</span>
                <span className="font-semibold text-gray-900">{donorCommunity.retentionRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-red-600 to-amber-500"
                  style={{ width: `${donorCommunity.retentionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-amber-500 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <h3 className="text-lg font-bold">Activate more donors</h3>
          </div>
          <p className="text-sm text-white/80 mt-3">
            Launch engagement campaigns or invite new volunteers to reach more donors.
          </p>
          <div className="mt-5 space-y-3">
            <Link
              to="/ngo/dashboard/campaigns"
              className="flex items-center justify-between rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold"
            >
              Create outreach campaign
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              to="/ngo/dashboard/volunteers"
              className="flex items-center justify-between rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold"
            >
              Invite volunteers
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Donor list</h3>
          <div className="relative w-full md:max-w-sm">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search donors..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <div>
            <label className="text-xs font-semibold text-gray-500">Blood type</label>
            <select
              value={bloodTypeFilter}
              onChange={(e) => setBloodTypeFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="all">All types</option>
              {bloodTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Availability</label>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">City</label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="all">All cities</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-xs text-gray-500">Showing {filteredDonors.length} donors on this page</p>
          <button
            type="button"
            onClick={handleExportCSV}
            className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Export CSV
          </button>
        </div>

        {loadingDonors ? (
          <div className="text-center py-10 text-gray-500">Loading donors...</div>
        ) : filteredDonors.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No donors found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-3 px-4 font-semibold">Donor</th>
                  <th className="py-3 px-4 font-semibold">Blood type</th>
                  <th className="py-3 px-4 font-semibold">Location</th>
                  <th className="py-3 px-4 font-semibold">Availability</th>
                  <th className="py-3 px-4 font-semibold">Last donation</th>
                </tr>
              </thead>
              <tbody>
                {filteredDonors.map((donor) => (
                  <tr key={donor.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-600 to-amber-500 text-white flex items-center justify-center font-semibold">
                          {donor.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{donor.name}</p>
                          <p className="text-xs text-gray-500">{donor.email || 'Email unavailable'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm font-semibold text-red-600">
                      {donor.bloodType || 'N/A'}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">
                      {donor.city || 'Unknown'}{donor.state ? `, ${donor.state}` : ''}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        donor.isAvailable ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {donor.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">
                      {donor.lastDonation ? donor.lastDonation.toLocaleDateString() : 'Not recorded'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filteredDonors.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
            <span>
              Page {currentPage}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (currentPage === 1 || loadingDonors) return;
                  await fetchDonorPage('prev');
                  setCurrentPage((prev) => Math.max(1, prev - 1));
                }}
                disabled={currentPage === 1 || loadingDonors}
                className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!hasNextPage || loadingDonors) return;
                  await fetchDonorPage('next');
                  setCurrentPage((prev) => prev + 1);
                }}
                disabled={!hasNextPage || loadingDonors}
                className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Donor map</h3>
            <p className="text-sm text-gray-500">Locations from donor profiles with coordinates.</p>
          </div>
          <MapPin className="w-5 h-5 text-amber-500" />
        </div>
        <div className="h-80 w-full overflow-hidden rounded-xl border border-gray-200">
            <MapContainer
              center={mapCenter}
              zoom={5}
              scrollWheelZoom={false}
              className="h-full w-full"
            >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapUpdater center={mapCenter} />
            <DonorMapLayer
              donors={mapFilteredDonors.filter(
                (donor) =>
                  donor.isAvailable === true &&
                  typeof donor.latitude === 'number' &&
                  typeof donor.longitude === 'number'
              )}
            />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default NgoDonors;
