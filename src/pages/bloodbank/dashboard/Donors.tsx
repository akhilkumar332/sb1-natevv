import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Users, TrendingUp, ChevronRight, Search, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Popup, useMap, useMapEvents, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { collection, documentId, endBefore, getDocs, limit, limitToLast, orderBy, query, startAfter, where, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';

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

type DonorSummary = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  bloodType?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  isAvailable?: boolean;
  lastDonation?: Date;
  totalDonations?: number;
  createdAt?: Date;
};

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
              fillColor: isSingle ? '#facc15' : '#eab308',
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

function BloodBankDonors() {
  const [searchTerm, setSearchTerm] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [donors, setDonors] = useState<DonorSummary[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingDonors, setLoadingDonors] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [firstDoc, setFirstDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [mapDonors, setMapDonors] = useState<DonorSummary[]>([]);
  const [donorCommunity, setDonorCommunity] = useState({
    totalDonors: 0,
    activeDonors: 0,
    newThisMonth: 0,
    retentionRate: 0,
  });
  const pageSize = 10;

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
    setCurrentPage(1);
    setFirstDoc(null);
    setLastDoc(null);
    setHasNextPage(false);
  }, [bloodTypeFilter, availabilityFilter, cityFilter]);

  const fetchDonorCommunity = async () => {
    try {
      const donorsRef = collection(db, 'users');
      const donorsQuery = query(donorsRef, where('role', '==', 'donor'));
      const allDonorsSnap = await getDocs(donorsQuery);

      const eligibleDonors = allDonorsSnap.docs
        .map((doc) => doc.data())
        .filter((data: any) => data && data.status !== 'deleted' && data.onboardingCompleted !== false)
        .filter((data: any) => !data.status || data.status === 'active');

      const totalDonors = eligibleDonors.length;

      const publicSnap = await getDocs(collection(db, 'publicDonors'));
      const activeDonors = publicSnap.docs
        .map((doc) => doc.data())
        .filter((data: any) => data && data.status !== 'deleted' && data.onboardingCompleted !== false)
        .filter((data: any) => data.isAvailable === true).length;

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const newThisMonth = eligibleDonors.filter((data: any) => {
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : null;
        return createdAt && createdAt >= oneMonthAgo;
      }).length;

      const retentionRate = totalDonors > 0 ? (activeDonors / totalDonors) * 100 : 0;

      setDonorCommunity({
        totalDonors,
        activeDonors,
        newThisMonth,
        retentionRate: Math.round(retentionRate * 10) / 10,
      });
    } catch (error) {
      console.error('Error fetching donor community:', error);
    }
  };

  const fetchDonorPage = async (direction: 'initial' | 'next' | 'prev' = 'initial') => {
    setLoadingDonors(true);
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

      if (direction === 'next' && lastDoc) {
        constraints.push(startAfter(lastDoc));
        constraints.push(limit(pageSize + 1));
      } else if (direction === 'prev' && firstDoc) {
        constraints.push(endBefore(firstDoc));
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
      setDonors(donorList);
      setFirstDoc(docs[0] || null);
      setLastDoc(docs[docs.length - 1] || null);
      if (direction === 'prev') {
        setHasNextPage(true);
      } else {
        setHasNextPage(hasExtra);
      }
    } catch (error) {
      console.error('Error loading donors:', error);
      setDonors([]);
      setHasNextPage(false);
    } finally {
      setLoadingDonors(false);
    }
  };

  useEffect(() => {
    fetchDonorPage('initial');
    fetchDonorCommunity();
  }, [bloodTypeFilter, availabilityFilter, cityFilter]);

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

    const fetchMapDonors = async () => {
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
      } catch (error) {
        console.warn('Failed to load public donors for map', error);
        if (isActive) {
          setMapDonors([]);
        }
      } finally {
        // no-op
      }
    };

    fetchMapDonors();
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
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-yellow-100">
          <p className="text-xs text-gray-500">Active donors</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{donorCommunity.activeDonors.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100">
          <p className="text-xs text-gray-500">New this month</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{donorCommunity.newThisMonth}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-yellow-100">
          <p className="text-xs text-gray-500">Retention rate</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{donorCommunity.retentionRate}%</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Engagement signals</h3>
            <TrendingUp className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Active donor rate</span>
                <span className="font-semibold text-gray-900">{activeRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-red-600 to-yellow-500"
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
                  className="h-3 rounded-full bg-gradient-to-r from-yellow-500 to-red-600"
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
                  className="h-3 rounded-full bg-gradient-to-r from-red-600 to-yellow-500"
                  style={{ width: `${donorCommunity.retentionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-yellow-500 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <h3 className="text-lg font-bold">Activate more donors</h3>
          </div>
          <p className="text-sm text-white/80 mt-3">
            Launch new requests or appointments to engage available donors.
          </p>
          <div className="mt-5 space-y-3">
            <Link
              to="/bloodbank/dashboard/requests"
              className="flex items-center justify-between rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold"
            >
              Create blood request
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              to="/bloodbank/dashboard/appointments"
              className="flex items-center justify-between rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold"
            >
              Schedule appointments
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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <div>
            <label className="text-xs font-semibold text-gray-500">Blood type</label>
            <select
              value={bloodTypeFilter}
              onChange={(e) => setBloodTypeFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
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
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
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
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
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
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-600 to-yellow-500 text-white flex items-center justify-center font-semibold">
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
          <MapPin className="w-5 h-5 text-yellow-500" />
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

export default BloodBankDonors;
