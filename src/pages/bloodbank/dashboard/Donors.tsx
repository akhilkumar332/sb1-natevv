import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Users, TrendingUp, ChevronRight, Search, MapPin } from 'lucide-react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import notify from '../../../services/notify.service';
import { donorCsvHeaders, donorCsvObjects } from '../../../utils/donorDirectory';
import { downloadCSV } from '../../../utils/export.utils';
import { LeafletMapUpdater } from '../../../components/shared/leaflet/LocationMapPrimitives';
import { DonorClusterLayer } from '../../../components/shared/leaflet/DonorClusterLayer';
import { EmptyStateCard } from '../../../components/shared/EmptyStateCard';
import { DonorPaginationFooter } from '../../../components/shared/DonorPaginationFooter';
import { useScopedErrorReporter } from '../../../hooks/useScopedErrorReporter';
import { useDonorDirectory } from '../../../hooks/useDonorDirectory';
import { runDedupedRequest } from '../../../utils/requestDedupe';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function BloodBankDonors() {
  const reportBloodBankDonorsError = useScopedErrorReporter({
    scope: 'bloodbank',
    metadata: { page: 'BloodBankDonors' },
  });

  const [donorCommunity, setDonorCommunity] = useState({
    totalDonors: 0,
    activeDonors: 0,
    newThisMonth: 0,
    retentionRate: 0,
  });

  const {
    bloodTypes,
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
  } = useDonorDirectory({
    scope: 'bloodbank',
    page: 'BloodBankDonors',
    cache: {
      ttlMs: 5 * 60 * 1000,
      enablePrefetch: false,
    },
    onError: reportBloodBankDonorsError,
    onPageLoadError: (error) => {
      notify.fromError(error, 'Unable to load donors right now.', { id: 'bloodbank-donors-page-load-error' });
    },
  });

  useEffect(() => {
    const fetchDonorCommunity = async () => {
      try {
        const summary = await runDedupedRequest('bloodbank:donors:community', async () => {
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
          return {
            totalDonors,
            activeDonors,
            newThisMonth,
            retentionRate: Math.round(retentionRate * 10) / 10,
          };
        }, 5 * 60 * 1000);

        setDonorCommunity(summary);
      } catch (error) {
        reportBloodBankDonorsError(error, 'bloodbank.donors.community.fetch');
      }
    };

    void fetchDonorCommunity();
  }, [reportBloodBankDonorsError]);

  const activeRate = donorCommunity.totalDonors > 0
    ? Math.round((donorCommunity.activeDonors / donorCommunity.totalDonors) * 100)
    : 0;
  const newRate = donorCommunity.totalDonors > 0
    ? Math.round((donorCommunity.newThisMonth / donorCommunity.totalDonors) * 100)
    : 0;

  const handleExportCSV = () => {
    downloadCSV(donorCsvObjects(filteredDonors), 'donors.csv', donorCsvHeaders);
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
          <EmptyStateCard className="text-center py-10 text-gray-500" description="Loading donors..." />
        ) : filteredDonors.length === 0 ? (
          <EmptyStateCard className="text-center py-10 text-gray-500" description="No donors found." />
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
          <DonorPaginationFooter
            currentPage={currentPage}
            loading={loadingDonors}
            hasNextPage={hasNextPage}
            onPrev={() => {
              void onPrevPage();
            }}
            onNext={() => {
              void onNextPage();
            }}
          />
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
            <LeafletMapUpdater center={mapCenter} />
            <DonorClusterLayer
              donors={mapFilteredDonors.filter(
                (donor) =>
                  donor.isAvailable === true &&
                  typeof donor.latitude === 'number' &&
                  typeof donor.longitude === 'number'
              )}
              singleFillColor="#facc15"
              clusterFillColor="#eab308"
            />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default BloodBankDonors;
