import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, MapPin, Filter, AlertCircle, Clock, Heart, Send, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { calculateDistance } from '../utils/geolocation';
import type { Coordinates } from '../types/database.types';
import { db } from '../firebase';
import {
  decodePendingDonorRequest,
  encodePendingDonorRequest,
  loadPendingDonorRequestDoc,
  savePendingDonorRequestDoc,
  clearPendingDonorRequestDoc,
  submitDonorRequest,
  type DonationComponent,
  type PendingDonorRequest,
} from '../services/donorRequest.service';
import toast from 'react-hot-toast';

interface Donor {
  id: string;
  bhId?: string;
  name: string;
  bloodType: string;
  location: string;
  distance: number | null;
  lastDonation: Date | null;
  phone: string | null;
  email: string | null;
  availability: 'Available' | 'Unavailable';
  gender: 'Male' | 'Female' | 'Other' | string;
  donationTypes: DonationComponent[];
}

function FindDonors() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const urlParams = new URLSearchParams(location.search);

  const [searchTerm, setSearchTerm] = useState<string>(urlParams.get('searchTerm') || '');
  const [selectedBloodType, setSelectedBloodType] = useState<string>(urlParams.get('bloodType') || '');
  const [selectedDistance, setSelectedDistance] = useState<string>(urlParams.get('distance') || '');
  const [selectedAvailability, setSelectedAvailability] = useState<string>(urlParams.get('availability') || '');
  const [selectedGender, setSelectedGender] = useState<string>(urlParams.get('gender') || '');
  const [selectedDonationType, setSelectedDonationType] = useState<string>(urlParams.get('donationType') || '');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [donorError, setDonorError] = useState<string | null>(null);
  const [baseDonors, setBaseDonors] = useState<Donor[]>([]);
  const [viewerLocation, setViewerLocation] = useState<Coordinates | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationRequesting, setLocationRequesting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [requestSubmittingId, setRequestSubmittingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const cacheTTL = 60000;
  const donorCacheRef = useRef<Map<string, { timestamp: number; donors: Donor[] }>>(new Map());

  const requestLocation = () => {
    if (!navigator?.geolocation) {
      setLocationEnabled(false);
      setLocationError('Location services are not supported in this browser.');
      return;
    }
    setLocationRequesting(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setViewerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationEnabled(true);
        setLocationRequesting(false);
      },
      (error) => {
        setLocationEnabled(false);
        setLocationRequesting(false);
        if (error.code === 1) {
          setLocationError('Location access is blocked. Please enable location to find donors.');
        } else if (error.code === 2) {
          setLocationError('Unable to determine your location. Please try again.');
        } else if (error.code === 3) {
          setLocationError('Location request timed out. Please try again.');
        } else {
          setLocationError('Enable location to use Find Donors.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const updateURL = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('searchTerm', searchTerm);
    if (selectedBloodType) params.set('bloodType', selectedBloodType);
    if (selectedDistance) params.set('distance', selectedDistance);
    if (selectedAvailability) params.set('availability', selectedAvailability);
    if (selectedGender) params.set('gender', selectedGender);
    if (selectedDonationType) params.set('donationType', selectedDonationType);

    navigate({ search: params.toString() });
  };

  useEffect(() => {
    updateURL();
  }, [searchTerm, selectedBloodType, selectedDistance, selectedAvailability, selectedGender, selectedDonationType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedBloodType,
    selectedDistance,
    selectedAvailability,
    selectedGender,
    selectedDonationType,
    viewerLocation?.latitude,
    viewerLocation?.longitude,
  ]);

  useEffect(() => {
    let isActive = true;
    const loadDonors = async () => {
      if (!locationEnabled) {
        setLoading(false);
        setBaseDonors([]);
        return;
      }
      setLoading(true);
      setDonorError(null);
      try {
        const cacheKey = viewerLocation
          ? `${viewerLocation.latitude.toFixed(4)}:${viewerLocation.longitude.toFixed(4)}`
          : 'none';
        const cached = donorCacheRef.current.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cacheTTL) {
          setBaseDonors(cached.donors);
          setLoading(false);
          return;
        }

        const batchSize = 200;
        const fetchCollection = async (collectionName: string, roleFilter?: boolean) => {
          const docs: any[] = [];
          let lastDoc: any = null;
          let keepGoing = true;

          while (keepGoing) {
            const constraints: any[] = [orderBy('__name__'), limit(batchSize)];
            if (roleFilter) {
              constraints.unshift(where('role', '==', 'donor'));
            }
            if (lastDoc) {
              constraints.push(startAfter(lastDoc));
            }
            const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
            snapshot.docs.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));
            lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            keepGoing = snapshot.size === batchSize;
          }

          return docs;
        };

        let rawResults: any[] = [];
        try {
          rawResults = await fetchCollection('publicDonors');
        } catch (publicError) {
          if (!user) {
            throw publicError;
          }
          rawResults = await fetchCollection('users', true);
        }

        if (!isActive) return;

        const mappedDonors = rawResults
          .filter((donor: any) => donor && (donor.uid || donor.id))
          .filter((donor: any) => donor.status !== 'deleted' && donor.onboardingCompleted !== false)
          .filter((donor: any) => !donor.status || donor.status === 'active')
          .map((donor: any) => {
            const donationTypesFromProfile = Array.isArray(donor.donationTypes)
              ? donor.donationTypes.filter(Boolean)
              : donor.donationType
                ? [donor.donationType].filter(Boolean)
                : ['whole'];
            const donorCoords = typeof donor.latitude === 'number' && typeof donor.longitude === 'number'
              ? { latitude: donor.latitude, longitude: donor.longitude }
              : null;
            const distance = viewerLocation && donorCoords
              ? calculateDistance(viewerLocation, donorCoords)
              : null;
            const locationParts = [donor.city, donor.state].filter(Boolean).join(', ');
            const availableUntil = donor.availableUntil?.toDate
              ? donor.availableUntil.toDate()
              : donor.availableUntil
                ? new Date(donor.availableUntil)
                : null;
            const breakActive = Boolean(
              availableUntil && !Number.isNaN(availableUntil.getTime()) && availableUntil.getTime() > Date.now()
            );
            const isAvailable = donor.isAvailable !== false && !breakActive;
            const lastDonationDate = donor.lastDonation?.toDate
              ? donor.lastDonation.toDate()
              : donor.lastDonation
                ? new Date(donor.lastDonation)
                : null;
            return {
              id: donor.uid || donor.id,
              bhId: donor.bhId,
              name: donor.displayName || donor.name || 'Anonymous Donor',
              bloodType: donor.bloodType || 'Unknown',
              location: locationParts || donor.address || 'Location unavailable',
              distance,
              lastDonation: lastDonationDate && !Number.isNaN(lastDonationDate.getTime()) ? lastDonationDate : null,
              phone: donor.phoneNumber || donor.phone || null,
              email: donor.email || null,
              availability: isAvailable ? 'Available' : 'Unavailable',
              gender: donor.gender || 'Not specified',
              donationTypes: donationTypesFromProfile.length > 0 ? donationTypesFromProfile : ['whole'],
            } as Donor;
          });

        donorCacheRef.current.set(cacheKey, {
          timestamp: Date.now(),
          donors: mappedDonors,
        });
        setBaseDonors(mappedDonors);
      } catch (error) {
        console.error('Failed to load donors:', error);
        setBaseDonors([]);
        setDonorError('Unable to load donors right now.');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadDonors();

    return () => {
      isActive = false;
    };
  }, [user, viewerLocation, locationEnabled]);

  useEffect(() => {
    if (!locationEnabled) {
      setBaseDonors([]);
      setCurrentPage(1);
    }
  }, [locationEnabled]);

  const filteredDonors = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const maxDistance = selectedDistance ? parseInt(selectedDistance, 10) : null;
    const selectedDonation = selectedDonationType as DonationComponent | '';
    return baseDonors
      .filter((donor) => (user?.uid ? donor.id !== user.uid : true))
      .filter((donor) => (!selectedBloodType ? true : donor.bloodType === selectedBloodType))
      .filter((donor) => {
        if (!normalizedSearch) return true;
        return donor.name.toLowerCase().includes(normalizedSearch) ||
          donor.location.toLowerCase().includes(normalizedSearch);
      })
      .filter((donor) => (!selectedAvailability ? true : donor.availability === selectedAvailability))
      .filter((donor) => (!selectedGender ? true : donor.gender === selectedGender))
      .filter((donor) => (!selectedDonation ? true : donor.donationTypes.includes(selectedDonation)))
      .filter((donor) => {
        if (!maxDistance) return true;
        if (typeof donor.distance !== 'number') return false;
        return donor.distance <= maxDistance;
      })
      .slice()
      .sort((a, b) => {
        const aDistance = typeof a.distance === 'number' ? a.distance : Number.POSITIVE_INFINITY;
        const bDistance = typeof b.distance === 'number' ? b.distance : Number.POSITIVE_INFINITY;
        return aDistance - bDistance;
      });
  }, [
    baseDonors,
    searchTerm,
    selectedBloodType,
    selectedAvailability,
    selectedGender,
    selectedDonationType,
    selectedDistance,
    user?.uid,
  ]);

  useEffect(() => {
    if (!user || user.role !== 'donor' || !user.onboardingCompleted) return;
    if (requestSubmittingId) return;
    const params = new URLSearchParams(location.search);
    const encoded = params.get('pendingRequest');
    const pendingFromUrl = encoded ? decodePendingDonorRequest(encoded) : null;

    const submitPending = async () => {
      if (pendingFromUrl) {
        await savePendingDonorRequestDoc(user.uid, pendingFromUrl);
        const nextParams = new URLSearchParams(location.search);
        nextParams.delete('pendingRequest');
        navigate({ pathname: location.pathname, search: nextParams.toString() }, { replace: true });
      }
      const pending = await loadPendingDonorRequestDoc(user.uid);
      if (!pending) return;
      setRequestSubmittingId(pending.targetDonorId);
      await submitDonorRequest(user, pending);
      await clearPendingDonorRequestDoc(user.uid);
      toast.success('Request submitted successfully.');
    };

    submitPending()
      .catch((error) => {
        console.error('Failed to submit pending donor request:', error);
        toast.error('Failed to submit your request.');
      })
      .finally(() => {
        setRequestSubmittingId(null);
      });
  }, [user, requestSubmittingId, location.search, navigate]);

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const donationTypes: { label: string; value: DonationComponent }[] = [
    { label: 'Whole Blood', value: 'whole' },
    { label: 'Plasma', value: 'plasma' },
    { label: 'Platelets', value: 'platelets' },
  ];
  const distances = ['5', '10', '15', '20', '25', '30'];
  const availabilityOptions = ['Available', 'Unavailable'];
  const genderOptions = ['Male', 'Female', 'Other'];

  const handleRequestDonor = (donor: Donor) => {
    if (donor.availability !== 'Available') {
      toast.error('This donor is currently unavailable');
      return;
    }
    if (user?.uid && donor.id === user.uid) {
      toast.error('You cannot request yourself.');
      return;
    }
    const donationType = (selectedDonationType || donor.donationTypes[0] || 'whole') as DonationComponent;
    const pendingPayload: PendingDonorRequest = {
      targetDonorId: donor.id,
      targetDonorBhId: donor.bhId,
      targetDonorName: donor.name,
      targetDonorBloodType: donor.bloodType,
      targetLocation: donor.location,
      donationType,
      createdAt: Date.now(),
      returnTo: `${location.pathname}${location.search}`,
    };

    if (!user || user.role !== 'donor') {
      toast.error('Please login as a donor to send a request.');
      const encoded = encodePendingDonorRequest(pendingPayload);
      navigate(`/donor/login?pendingRequest=${encodeURIComponent(encoded)}`);
      return;
    }

    if (!user.onboardingCompleted) {
      const encoded = encodePendingDonorRequest(pendingPayload);
      navigate(`/donor/onboarding?pendingRequest=${encodeURIComponent(encoded)}`);
      return;
    }

    setRequestSubmittingId(donor.id);
    submitDonorRequest(user, pendingPayload)
      .then(() => {
        toast.success('Request submitted successfully.');
      })
      .catch((error) => {
        console.error('Failed to submit donor request:', error);
        toast.error('Failed to submit your request.');
      })
      .finally(() => {
        setRequestSubmittingId(null);
      });
  };

  const totalPages = Math.max(1, Math.ceil(filteredDonors.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageDonors = filteredDonors.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedBloodType('');
    setSelectedDistance('');
    setSelectedAvailability('');
    setSelectedGender('');
    setSelectedDonationType('');
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-pink-50">
          <div className="absolute top-10 right-10 w-64 h-64 bg-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-6">
              <Heart className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-semibold">Find Donors</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold mb-6">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Connect with Life-Savers
              </span>
            </h1>

            <p className="text-xl text-gray-600 mb-8">
              Find blood donors near you and save lives. Our community of heroes is ready to help.
            </p>
          </div>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {/* Search Bar */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-600" />
                  <input
                    type="text"
                    placeholder="Search by location or donor name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center justify-center px-6 py-3 rounded-xl font-semibold transition-all ${
                    showFilters
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Filter className="h-5 w-5 mr-2" />
                  Filters
                  {showFilters && <X className="h-4 w-4 ml-2" />}
                </button>
              </div>

              {/* Filter Options */}
              {showFilters && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                    {/* Blood Type Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Blood Type
                      </label>
                      <select
                        value={selectedBloodType}
                        onChange={(e) => setSelectedBloodType(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">All Blood Types</option>
                        {bloodTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    {/* Distance Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Distance (km)
                      </label>
                      <select
                        value={selectedDistance}
                        onChange={(e) => setSelectedDistance(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">Any Distance</option>
                        {distances.map(distance => (
                          <option key={distance} value={distance}>{distance} km</option>
                        ))}
                      </select>
                    </div>

                    {/* Availability Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Availability
                      </label>
                      <select
                        value={selectedAvailability}
                        onChange={(e) => setSelectedAvailability(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">Any Availability</option>
                        {availabilityOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>

                    {/* Gender Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Gender
                      </label>
                      <select
                        value={selectedGender}
                        onChange={(e) => setSelectedGender(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">Any Gender</option>
                        {genderOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>

                    {/* Donation Type Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Donation Type
                      </label>
                      <select
                        value={selectedDonationType}
                        onChange={(e) => setSelectedDonationType(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">All Types</option>
                        {donationTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={clearFilters}
                    className="text-red-600 hover:text-red-700 font-semibold text-sm"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>

            {!locationEnabled && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-amber-900">Enable location to use Find Donors</p>
                  <p className="text-amber-700">
                    We need your location to show nearby donors and accurate distances.
                  </p>
                  {locationError && <p className="mt-1 text-amber-700">{locationError}</p>}
                </div>
                <button
                  onClick={requestLocation}
                  disabled={locationRequesting}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {locationRequesting ? 'Requesting...' : 'Enable Location'}
                </button>
              </div>
            )}

            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600">
                Showing <span className="font-bold text-red-600">{pageDonors.length}</span> of{' '}
                <span className="font-bold text-red-600">{filteredDonors.length}</span> donors
              </p>
              <p className="text-sm text-gray-500">
                Page {safePage} of {totalPages}
              </p>
            </div>
            {donorError && !loading && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {donorError}
              </div>
            )}

            {/* Donors Grid */}
            {!locationEnabled ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-10 h-10 text-amber-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Location required</h3>
                <p className="text-gray-600 mb-6">Enable location services to see nearby donors.</p>
                <button
                  onClick={requestLocation}
                  disabled={locationRequesting}
                  className="px-6 py-3 bg-amber-600 text-white rounded-full font-semibold hover:bg-amber-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {locationRequesting ? 'Requesting...' : 'Enable Location'}
                </button>
              </div>
            ) : loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl p-6 animate-pulse border border-gray-100">
                    <div className="h-6 bg-gray-200 rounded mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded mb-4"></div>
                    <div className="flex gap-2">
                      <div className="h-10 w-full bg-gray-200 rounded-xl"></div>
                      <div className="h-10 w-full bg-gray-200 rounded-xl"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredDonors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pageDonors.map((donor) => (
                  <div
                    key={donor.id}
                    className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 relative overflow-hidden"
                  >
                    {/* Background Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-pink-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    {/* Content */}
                    <div className="relative z-10">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                            {(donor.name?.trim()?.[0] || '?')}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">{donor.name}</h3>
                            <p className="text-sm text-gray-500">{donor.gender}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="px-3 py-1 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-bold rounded-full shadow-md">
                            {donor.bloodType}
                          </span>
                          {donor.availability === 'Available' ? (
                            <span className="mt-2 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                              Available
                            </span>
                          ) : (
                            <span className="mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                              Unavailable
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-start text-gray-600">
                          <MapPin className="w-4 h-4 mr-2 text-red-600 mt-0.5" />
                          <div className="text-sm leading-5">
                            <p>{donor.location}</p>
                            <p className="text-xs text-gray-500">
                              {typeof donor.distance === 'number'
                                ? `${donor.distance.toFixed(1)} km away`
                                : 'Distance unavailable'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Clock className="w-4 h-4 mr-2 text-red-600" />
                          <span className="text-sm">
                            Last donation: {donor.lastDonation ? donor.lastDonation.toLocaleDateString() : 'Not yet'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {donor.donationTypes.map((type) => (
                            <span
                              key={`${donor.id}-${type}`}
                              className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-600"
                            >
                              {donationTypes.find((item) => item.value === type)?.label || type}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex">
                        <button
                          onClick={() => handleRequestDonor(donor)}
                          disabled={donor.availability === 'Unavailable' || requestSubmittingId === donor.id}
                          className={`flex-1 flex items-center justify-center py-3 rounded-xl font-semibold transition-all ${
                            donor.availability === 'Available'
                              ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:shadow-lg transform hover:scale-105'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {requestSubmittingId === donor.id ? 'Requesting...' : 'Request'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No donors found</h3>
                <p className="text-gray-600 mb-6">Try adjusting your search criteria or filters</p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
                >
                  Clear Filters
                </button>
              </div>
            )}
            {!loading && totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                  className="px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }).map((_, index) => {
                  const page = index + 1;
                  const isActive = page === safePage;
                  return (
                    <button
                      key={`page-${page}`}
                      onClick={() => setCurrentPage(page)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold ${
                        isActive
                          ? 'bg-red-600 text-white'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage >= totalPages}
                  className="px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-red-600 via-red-700 to-red-800 mt-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h2 className="text-4xl font-bold mb-4">Want to Become a Donor?</h2>
            <p className="text-xl mb-8 opacity-90">Join our community of life-savers and make a difference</p>
            <button
              onClick={() => navigate('/donor/register')}
              className="px-8 py-4 bg-white text-red-600 rounded-full font-bold text-lg hover:shadow-2xl transform hover:scale-105 transition-all"
            >
              Register as a Donor
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default FindDonors;
