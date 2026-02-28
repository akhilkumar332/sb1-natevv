import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { notify } from 'services/notify.service';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Activity,
  Droplet,
  Download,
  Edit3,
  Flame,
  Locate,
  MessageCircle,
  Star,
  Trash2,
  Trophy,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { captureHandledError } from '../../../services/errorLog.service';
import { LeafletClickMarker, LeafletMapUpdater } from '../../../components/shared/leaflet/LocationMapPrimitives';
import { useLocationResolver } from '../../../hooks/useLocationResolver';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type MapPosition = [number, number];

function LocationPicker({
  value,
  onChange,
  onManualInput,
  position,
  onPositionChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onManualInput?: (value: string) => void;
  position: MapPosition;
  onPositionChange: (pos: MapPosition) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const { resolveCurrentLocation, resolveFromCoordinates } = useLocationResolver('donor');

  const handleAddressChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    onChange(inputValue);
    onManualInput?.(inputValue);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!inputValue.trim()) {
      setShowSuggestions(false);
      setSuggestions([]);
      setNoResults(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(inputValue)}&limit=5&addressdetails=1`
        );
        const data = await response.json();
        if (!mountedRef.current || requestId !== searchRequestIdRef.current) return;
        setSuggestions(data);
        setNoResults(data.length === 0);
        setShowSuggestions(true);
      } catch (error) {
        void captureHandledError(error, {
          source: 'frontend',
          scope: 'donor',
          metadata: { page: 'DonorJourney', kind: 'donor.journey.locationSearch.lookup' },
        });
        if (!mountedRef.current || requestId !== searchRequestIdRef.current) return;
        setSuggestions([]);
        setNoResults(true);
        setShowSuggestions(true);
      }
    }, 400);
  };

  const handleSuggestionSelect = (suggestion: any) => {
    const lat = parseFloat(suggestion.lat);
    const lon = parseFloat(suggestion.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      notify.error('Invalid location selected.');
      return;
    }
    const nextPosition: MapPosition = [lat, lon];
    onChange(suggestion.display_name);
    onPositionChange(nextPosition);
    setShowSuggestions(false);
    setSuggestions([]);
    setNoResults(false);
  };

  const handleUseCurrentLocation = () => {
    void (async () => {
      setIsLocating(true);
      try {
        const result = await resolveCurrentLocation();
        if (!result?.coords) return;
        if (!mountedRef.current) return;
        onPositionChange(result.coords);
        const data = result.geocode;
        if (!mountedRef.current) return;
        if (data?.display_name) {
          onChange(data.display_name);
        }
      } catch (error) {
        void captureHandledError(error, {
          source: 'frontend',
          scope: 'donor',
          metadata: { page: 'DonorJourney', kind: 'donor.journey.location.current' },
        });
      } finally {
        if (mountedRef.current) {
          setIsLocating(false);
        }
      }
    })();
  };

  const handleMapPositionChange = async (pos: MapPosition) => {
    if (!Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) {
      notify.error('Invalid map location selected.');
      return;
    }
    onPositionChange(pos);
    try {
      const result = await resolveFromCoordinates(pos, {
        errorMessage: 'Could not fetch address for this location',
      });
      const data = result.geocode;
      if (!mountedRef.current) return;
      if (data?.display_name) {
        onChange(data.display_name);
      }
    } catch (error) {
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'donor',
        metadata: { page: 'DonorJourney', kind: 'donor.journey.location.mapPick' },
      });
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="h-48 w-full overflow-hidden rounded-xl border border-gray-200">
        <MapContainer center={position} zoom={13} scrollWheelZoom={false} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LeafletMapUpdater center={position} zoom={13} />
          <LeafletClickMarker
            position={position}
            onPositionChange={handleMapPositionChange}
            popupText="Selected location"
          />
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-all duration-300 disabled:opacity-60"
        >
          <Locate className="h-3 w-3" />
          {isLocating ? 'Locating...' : 'Use current location'}
        </button>
        <span>Click on the map to refine the pin.</span>
      </div>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleAddressChange}
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
          placeholder={placeholder || 'Search for a location'}
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 mt-2 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {suggestions.map((suggestion) => (
              <button
                key={`${suggestion.place_id}`}
                type="button"
                onClick={() => handleSuggestionSelect(suggestion)}
                className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-red-50"
              >
                {suggestion.display_name}
              </button>
            ))}
          </div>
        )}
        {showSuggestions && suggestions.length === 0 && noResults && (
          <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-lg">
            No results found. Try a different search.
          </div>
        )}
      </div>
    </div>
  );
}

const DonorJourney = () => {
  const dashboard = useOutletContext<any>();
  const [donationFilter, setDonationFilter] = useState<'all' | 'completed' | 'scheduled' | 'cancelled'>('all');
  const [badgeCategory, setBadgeCategory] = useState<'donation' | 'streak' | 'emergency' | 'special'>('donation');

  const {
    user,
    isLoading,
    donationHistory,
    firstDonationDate,
    donationFeedbackMap,
    feedbackOpenId,
    editingDonationId,
    editingDonationData,
    setEditingDonationData,
    donationEditSaving,
    donationDeleteId,
    handleStartDonationEdit,
    handleDonationEditSave,
    handleCancelDonationEdit,
    handleDeleteDonation,
    handleOpenFeedback,
    handleDownloadCertificate,
    formatDate,
    formatDateTime,
    feedbackForm,
    setFeedbackForm,
    feedbackSaving,
    handleSaveFeedback,
    handleCancelFeedback,
    handleBookDonation,
    badges,
    handleViewAllBadges,
    stats,
    handleLogDonation,
  } = dashboard;

  const defaultPosition = useMemo<MapPosition>(() => {
    const lat = typeof user?.latitude === 'number' ? user.latitude : 20.5937;
    const lng = typeof user?.longitude === 'number' ? user.longitude : 78.9629;
    return [lat, lng];
  }, [user?.latitude, user?.longitude]);

  const [deleteCandidate, setDeleteCandidate] = useState<any | null>(null);
  const [logDonationMapPosition, setLogDonationMapPosition] = useState<MapPosition>(defaultPosition);
  const [logDonationCoords, setLogDonationCoords] = useState<MapPosition | null>(defaultPosition);
  const [editDonationMapPosition, setEditDonationMapPosition] = useState<MapPosition>(defaultPosition);

  const filteredDonations = useMemo(() => {
    if (donationFilter === 'all') return donationHistory;
    return donationHistory.filter((donation: any) => donation.status === donationFilter);
  }, [donationHistory, donationFilter]);

  const latestCompletedDonation = useMemo(() => {
    return donationHistory.find((donation: any) => donation.status === 'completed') || donationHistory[0] || null;
  }, [donationHistory]);

  const totalUnits = useMemo(() => {
    return donationHistory.reduce((sum: number, donation: any) => sum + (Number(donation.units) || 0), 0);
  }, [donationHistory]);

  const livesSaved = typeof stats?.livesSaved === 'number' ? stats.livesSaved : donationHistory.length * 3;
  const fallbackOldestDonationDate = useMemo(() => {
    if (!donationHistory.length) return null;
    return donationHistory.reduce((oldest: Date, donation: any) => {
      const currentDate = donation?.date instanceof Date ? donation.date : new Date(donation.date);
      if (!oldest) return currentDate;
      return currentDate < oldest ? currentDate : oldest;
    }, donationHistory[0].date);
  }, [donationHistory]);

  const oldestDonationDate = firstDonationDate || fallbackOldestDonationDate;

  const filteredBadges = useMemo(() => {
    return badges.filter((badge: any) => badge.category === badgeCategory);
  }, [badges, badgeCategory]);

  const recentEarnedBadges = useMemo(() => {
    const earned = badges.filter((badge: any) => badge.earned);
    if (earned.length === 0) return [];
    return [...earned]
      .sort((a: any, b: any) => {
        const aTime = a.earnedDate ? new Date(a.earnedDate).getTime() : 0;
        const bTime = b.earnedDate ? new Date(b.earnedDate).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
        return (b.requirement || 0) - (a.requirement || 0);
      })
      .slice(0, 3);
  }, [badges]);

  const [logDonationOpen, setLogDonationOpen] = useState(false);
  const [logDonationSaving, setLogDonationSaving] = useState(false);
  const [logDonationForm, setLogDonationForm] = useState({
    date: '',
    location: '',
    bloodBank: '',
    units: 1,
    donationType: 'whole',
    notes: '',
  });

  const reportDonorJourneyError = (error: unknown, kind: string, metadata?: Record<string, unknown>) => {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'donor',
      metadata: {
        page: 'DonorJourney',
        kind,
        ...(metadata || {}),
      },
    });
  };

  const openLogDonation = () => {
    setDeleteCandidate(null);
    handleCancelDonationEdit();
    handleCancelFeedback();
    setLogDonationForm({
      date: '',
      location: user?.city || '',
      bloodBank: '',
      units: 1,
      donationType: 'whole',
      notes: '',
    });
    setLogDonationMapPosition(defaultPosition);
    setLogDonationCoords(defaultPosition);
    setLogDonationOpen(true);
  };

  const closeLogDonation = () => {
    if (logDonationSaving) return;
    setLogDonationOpen(false);
  };

  const handleLogPositionChange = (pos: MapPosition) => {
    setLogDonationMapPosition(pos);
    setLogDonationCoords(pos);
  };

  const handleEditPositionChange = (pos: MapPosition) => {
    setEditDonationMapPosition(pos);
    setEditingDonationData((prev: any) => ({
      ...prev,
      latitude: pos[0],
      longitude: pos[1],
    }));
  };

  const clearLogCoordinates = () => {
    setLogDonationCoords(null);
  };

  const clearEditCoordinates = () => {
    setEditingDonationData((prev: any) => ({
      ...prev,
      latitude: null,
      longitude: null,
    }));
  };

  useEffect(() => {
    if (!editingDonationId) return;
    const latitude = typeof editingDonationData?.latitude === 'number' ? editingDonationData.latitude : null;
    const longitude = typeof editingDonationData?.longitude === 'number' ? editingDonationData.longitude : null;
    if (latitude !== null && longitude !== null) {
      setEditDonationMapPosition([latitude, longitude]);
      return;
    }
    if (!editingDonationData?.location) {
      setEditDonationMapPosition(defaultPosition);
      return;
    }
    let active = true;
    const lookup = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(editingDonationData.location)}&limit=1&addressdetails=1`
        );
        const data = await response.json();
        if (!active || !data?.length) return;
        const result = data[0];
        const nextPosition: MapPosition = [parseFloat(result.lat), parseFloat(result.lon)];
        setEditDonationMapPosition(nextPosition);
        setEditingDonationData((prev: any) => ({
          ...prev,
          latitude: nextPosition[0],
          longitude: nextPosition[1],
        }));
      } catch (error) {
        reportDonorJourneyError(error, 'donor.journey.editLocation.lookup');
      }
    };
    void lookup();
    return () => {
      active = false;
    };
  }, [editingDonationId, defaultPosition]);

  const handleLogDonationSubmit = async () => {
    if (!logDonationForm.date) {
      notify.error('Please select a donation date.');
      return;
    }
    const parsedDate = new Date(logDonationForm.date);
    if (Number.isNaN(parsedDate.getTime())) {
      notify.error('Please select a valid date.');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsedDate.getTime() > today.getTime()) {
      notify.error('Donation date cannot be in the future.');
      return;
    }
    if (!logDonationForm.donationType) {
      notify.error('Please select a donation type.');
      return;
    }
    if (!logDonationForm.units || logDonationForm.units < 1) {
      notify.error('Please enter a valid units value.');
      return;
    }
    try {
      setLogDonationSaving(true);
      const coords = logDonationCoords;
      await handleLogDonation({
        date: parsedDate,
        location: logDonationForm.location,
        bloodBank: logDonationForm.bloodBank,
        units: logDonationForm.units,
        donationType: logDonationForm.donationType,
        notes: logDonationForm.notes,
        latitude: coords ? coords[0] : null,
        longitude: coords ? coords[1] : null,
      });
      setLogDonationOpen(false);
    } catch (error: unknown) {
      notify.fromError(
        error,
        'Failed to log donation.',
        { id: 'donor-journey-log-donation-error' },
        {
          source: 'frontend',
          scope: 'donor',
          metadata: { page: 'DonorJourney', kind: 'donor.journey.logDonation' },
        }
      );
    } finally {
      setLogDonationSaving(false);
    }
  };

  return (
    <>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-600">Your Journey</p>
        <h2 className="text-xl font-bold text-gray-900">Donations and achievements</h2>
      </div>
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-stretch">
          <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col lg:h-[560px] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <Activity className="w-6 h-6 mr-2 text-red-600" />
                Donation History
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'completed', label: 'Completed' },
                  { key: 'scheduled', label: 'Scheduled' },
                  { key: 'cancelled', label: 'Cancelled' },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setDonationFilter(filter.key as typeof donationFilter)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                      donationFilter === filter.key
                        ? 'bg-red-600 text-white'
                        : 'border border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            {latestCompletedDonation ? (
              <div className="mb-6 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3 dark:border-red-200 dark:bg-[#101826]">
                <p className="text-[10px] uppercase tracking-wide text-red-600">Last donation summary</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-gray-900">{latestCompletedDonation.bloodBank || 'Donation'}</p>
                    <p className="text-xs text-gray-600">{latestCompletedDonation.location || 'Location not set'}</p>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-600">
                    <p>{formatDate(latestCompletedDonation.date)}</p>
                    <p>
                      {latestCompletedDonation.units} unit{latestCompletedDonation.units === 1 ? '' : 's'} •{' '}
                      {latestCompletedDonation.status || 'completed'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
                No completed donations yet.
              </div>
            )}
            <div className="flex-1 overflow-y-auto pr-2">
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`donation-skeleton-${index}`}
                      className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 rounded-xl bg-gray-100 animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-40 rounded-full bg-gray-100 animate-pulse" />
                          <div className="h-3 w-32 rounded-full bg-gray-100 animate-pulse" />
                          <div className="h-3 w-24 rounded-full bg-gray-100 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredDonations.length > 0 ? (
                <div className="space-y-4">
                  {filteredDonations.map((donation: any) => {
                    const isSelfReported = donation.source === 'manual';
                    const feedbackEntry = donationFeedbackMap[donation.id];
                    const isFeedbackOpen = feedbackOpenId === donation.id;
                    const displayCertificateUrl = donation.certificateUrl || feedbackEntry?.certificateUrl;
                    const hasFeedback = Boolean(
                      feedbackEntry?.rating || feedbackEntry?.notes || feedbackEntry?.certificateUrl
                    );
                    return (
                      <div
                        key={donation.id}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-4 transition-all duration-300 hover:bg-gray-100"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start space-x-4">
                            <div className="p-3 bg-red-100 rounded-xl">
                              <Droplet className="w-6 h-6 text-red-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-gray-800">
                                  {donation.bloodBank || 'Donation'}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-white border border-red-200 text-red-600">
                                  {isSelfReported ? 'Self Reported' : 'Verified'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{donation.location || 'Location not set'}</p>
                              <p className="text-xs text-gray-500">
                                {formatDate(donation.date)} •{' '}
                                {donation.donationType
                                  ? `${donation.donationType === 'whole'
                                    ? 'Whole Blood'
                                    : donation.donationType === 'platelets'
                                      ? 'Platelets'
                                      : 'Plasma'}`
                                  : donation.quantity || 'Donation'} •{' '}
                                {donation.units} unit{donation.units === 1 ? '' : 's'}
                              </p>
                              {donation.notes && (
                                <p className="text-xs text-gray-500 mt-1">{donation.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteCandidate(null);
                                handleCancelFeedback();
                                handleStartDonationEdit(donation);
                              }}
                              className="p-2 hover:bg-white rounded-lg transition-all duration-300"
                              title="Edit donation"
                            >
                              <Edit3 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleCancelDonationEdit();
                                handleCancelFeedback();
                                setDeleteCandidate(donation);
                              }}
                              disabled={donationDeleteId === donation.id}
                              className="p-2 hover:bg-white rounded-lg transition-all duration-300 disabled:opacity-60"
                              title="Delete donation"
                            >
                              <Trash2 className="w-4 h-4 text-gray-600" />
                            </button>
                            {displayCertificateUrl && (
                              <button
                                onClick={() => handleDownloadCertificate(displayCertificateUrl || '')}
                                className="p-2 hover:bg-white rounded-lg transition-all duration-300"
                                title="Download certificate"
                              >
                                <Download className="w-5 h-5 text-gray-600" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteCandidate(null);
                                handleCancelDonationEdit();
                                handleOpenFeedback(donation.id);
                              }}
                              className="p-2 hover:bg-white rounded-lg transition-all duration-300"
                              title={hasFeedback ? 'Edit feedback' : 'Add feedback'}
                            >
                              <MessageCircle className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                        {!isFeedbackOpen && hasFeedback && (
                          <div className="mt-4 rounded-xl border border-red-100 bg-white/80 px-4 py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-gray-500">Feedback</p>
                                <div className="mt-1 flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((value) => (
                                    <Star
                                      key={`feedback-star-${donation.id}-${value}`}
                                      className={`h-4 w-4 ${
                                        (feedbackEntry?.rating || 0) >= value
                                          ? 'text-yellow-400 fill-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                                {feedbackEntry?.notes && (
                                  <p className="text-xs text-gray-600 mt-1">{feedbackEntry.notes}</p>
                                )}
                              </div>
                              {displayCertificateUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleDownloadCertificate(displayCertificateUrl || '')}
                                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-all duration-300"
                                >
                                  <Download className="h-3 w-3" />
                                  Certificate
                                </button>
                              )}
                            </div>
                            {feedbackEntry?.updatedAt && (
                              <p className="mt-2 text-[11px] text-gray-500">
                                Updated {formatDateTime(feedbackEntry.updatedAt)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : donationHistory.length > 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <Activity className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No donations in this filter</h3>
                  <p className="text-gray-600 mb-4">Try a different filter to view your history.</p>
                  <button
                    type="button"
                    onClick={() => setDonationFilter('all')}
                    className="px-5 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all duration-300"
                  >
                    Show All Donations
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <Activity className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Donations Yet</h3>
                  <p className="text-gray-600 mb-4">Start your journey as a lifesaver today!</p>
                  <button
                    onClick={handleBookDonation}
                    className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-300"
                  >
                    Book Your First Donation
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col lg:h-[560px] overflow-hidden">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-red-600" />
              Achievements
            </h2>
            {isLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`badge-skeleton-${index}`} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2">
                {recentEarnedBadges.length > 0 && (
                  <div className="mb-4 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3 dark:border-red-200 dark:bg-[#101826]">
                    <p className="text-[10px] uppercase tracking-wide text-red-600">Recently earned</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recentEarnedBadges.map((badge: any) => (
                        <span
                          key={`recent-${badge.id}`}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-800 dark:bg-[#0a0f1a] dark:text-gray-700"
                        >
                          <span>{badge.icon}</span>
                          {badge.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {(['donation', 'streak', 'emergency', 'special'] as const).map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setBadgeCategory(category)}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                        badgeCategory === category
                          ? 'bg-red-600 text-white'
                          : 'border border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {filteredBadges.length > 0 ? (
                    filteredBadges.map((badge: any) => {
                      const requirement = badge.requirement || 0;
                      const progress = badge.progress || 0;
                      const progressPct = requirement ? Math.min(100, (progress / requirement) * 100) : 0;
                      return (
                        <div
                          key={badge.id}
                          className={`p-4 rounded-xl transition-all duration-300 ${
                            badge.earned
                              ? 'bg-gradient-to-br from-red-50 to-red-100 border border-red-200'
                              : 'bg-gray-50 border border-gray-100'
                          }`}
                          title={badge.description}
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-2xl">{badge.icon}</div>
                            <div>
                              <p className="text-xs font-semibold text-gray-800">{badge.name}</p>
                              <p className="text-[10px] text-gray-500">{badge.description}</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[10px] text-gray-500">
                              <span>{badge.earned ? 'Unlocked' : 'Progress'}</span>
                              {requirement > 0 && (
                                <span>{Math.min(progress, requirement)}/{requirement}</span>
                              )}
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-white">
                              <div
                                className="h-1.5 rounded-full bg-red-500"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500">
                      No badges in this category yet.
                    </div>
                  )}
                </div>
                <button
                  onClick={handleViewAllBadges}
                  className="w-full mt-4 py-2 text-sm text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all duration-300"
                >
                  View All Badges →
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 items-stretch">
          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 h-full min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Flame className="w-5 h-5 mr-2 text-red-600" />
              Donation Streak
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Current streak</p>
                <p className="text-lg font-semibold text-gray-900">{stats?.streak || 0} donations</p>
              </div>
              <p className="text-xs text-gray-500">Keep the momentum going</p>
            </div>
            <div className="mt-4 space-y-2 text-xs text-gray-500">
              {donationHistory.slice(0, 3).map((donation: any) => (
                <div key={`streak-${donation.id}`} className="flex items-center justify-between">
                  <span className="truncate">{donation.bloodBank || 'Donation'}</span>
                  <span>{formatDate(donation.date)}</span>
                </div>
              ))}
              {donationHistory.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-center">
                  No donations yet. Start your streak with your first donation.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 h-full min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-red-600" />
              Impact Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Lives Saved</p>
                <p className="text-lg font-semibold text-gray-900">{livesSaved}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Units</p>
                <p className="text-lg font-semibold text-gray-900">{totalUnits}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Since {oldestDonationDate ? formatDate(oldestDonationDate) : 'joining'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 h-full min-w-0 flex flex-col col-span-2 lg:col-span-1">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-4">Actions</h2>
            <div className="grid gap-3 mt-auto">
              <button
                type="button"
                onClick={handleBookDonation}
                className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-300"
              >
                Make a Donation
              </button>
              <button
                type="button"
                onClick={openLogDonation}
                className="w-full rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-all duration-300"
              >
                Log a Donation
              </button>
            </div>
          </div>
        </div>
      </div>

      {logDonationOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeLogDonation}
          role="presentation"
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-red-600">Self Reported</p>
                <h3 className="mt-1 text-lg font-bold text-gray-900">Log a Donation</h3>
                <p className="text-xs text-gray-500">Add a completed donation to your history.</p>
              </div>
              <button
                type="button"
                onClick={closeLogDonation}
                className="rounded-full p-2 hover:bg-gray-100 transition-all"
                aria-label="Close log donation"
              >
                <XCircle className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-gray-600">Donation date</label>
                <input
                  type="date"
                  value={logDonationForm.date}
                  onChange={(event) => setLogDonationForm((prev) => ({ ...prev, date: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Units</label>
                <input
                  type="number"
                  min="1"
                  value={logDonationForm.units}
                  onChange={(event) => setLogDonationForm((prev) => ({
                    ...prev,
                    units: Number(event.target.value),
                  }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600">Donation type</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { value: 'whole', label: 'Whole Blood' },
                    { value: 'platelets', label: 'Platelets' },
                    { value: 'plasma', label: 'Plasma' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setLogDonationForm((prev) => ({ ...prev, donationType: type.value }))}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                        logDonationForm.donationType === type.value
                          ? 'bg-red-600 text-white'
                          : 'border border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600">Location</label>
                <LocationPicker
                  value={logDonationForm.location}
                  onChange={(value) => setLogDonationForm((prev) => ({ ...prev, location: value }))}
                  onManualInput={clearLogCoordinates}
                  position={logDonationMapPosition}
                  onPositionChange={handleLogPositionChange}
                  placeholder="City or donation location"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600">Donation center (optional)</label>
                <input
                  type="text"
                  value={logDonationForm.bloodBank}
                  onChange={(event) => setLogDonationForm((prev) => ({ ...prev, bloodBank: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                  placeholder="BloodBank name"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600">Notes (optional)</label>
                <textarea
                  rows={3}
                  value={logDonationForm.notes}
                  onChange={(event) => setLogDonationForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                  placeholder="Any notes about this donation"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleLogDonationSubmit}
                disabled={logDonationSaving}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
              >
                {logDonationSaving ? 'Saving...' : 'Save Donation'}
              </button>
              <button
                type="button"
                onClick={closeLogDonation}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editingDonationId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleCancelDonationEdit}
          role="presentation"
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-red-600">Donation</p>
                <h3 className="mt-1 text-lg font-bold text-gray-900">Edit Donation</h3>
                <p className="text-xs text-gray-500">Update the details for this donation.</p>
              </div>
              <button
                type="button"
                onClick={handleCancelDonationEdit}
                className="rounded-full p-2 hover:bg-gray-100 transition-all"
                aria-label="Close edit donation"
              >
                <XCircle className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600">Location</label>
                <LocationPicker
                  value={editingDonationData.location}
                  onChange={(value) => setEditingDonationData((prev: any) => ({
                    ...prev,
                    location: value,
                  }))}
                  onManualInput={clearEditCoordinates}
                  position={editDonationMapPosition}
                  onPositionChange={handleEditPositionChange}
                  placeholder="City or donation location"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Units</label>
                <input
                  type="number"
                  min="1"
                  value={editingDonationData.units}
                  onChange={(event) => setEditingDonationData((prev: any) => ({
                    ...prev,
                    units: Number(event.target.value),
                  }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Donation Type</label>
                <select
                  value={editingDonationData.donationType}
                  onChange={(event) => setEditingDonationData((prev: any) => ({
                    ...prev,
                    donationType: event.target.value,
                  }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                >
                  <option value="whole">Whole Blood</option>
                  <option value="platelets">Platelets</option>
                  <option value="plasma">Plasma</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600">Notes</label>
                <textarea
                  value={editingDonationData.notes}
                  onChange={(event) => setEditingDonationData((prev: any) => ({
                    ...prev,
                    notes: event.target.value,
                  }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleDonationEditSave}
                disabled={donationEditSaving}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
              >
                {donationEditSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handleCancelDonationEdit}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {feedbackOpenId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleCancelFeedback}
          role="presentation"
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-red-600">Feedback</p>
                <h3 className="mt-1 text-lg font-bold text-gray-900">Post-donation Feedback</h3>
                <p className="text-xs text-gray-500">Share how the donation went.</p>
              </div>
              <button
                type="button"
                onClick={handleCancelFeedback}
                className="rounded-full p-2 hover:bg-gray-100 transition-all"
                aria-label="Close feedback"
              >
                <XCircle className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">Rating</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={`rating-modal-${value}`}
                      type="button"
                      onClick={() => setFeedbackForm((prev: any) => ({ ...prev, rating: value }))}
                      className="rounded-full p-1"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          feedbackForm.rating >= value
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Notes</label>
                <textarea
                  value={feedbackForm.notes}
                  onChange={(event) => setFeedbackForm((prev: any) => ({
                    ...prev,
                    notes: event.target.value,
                  }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                  placeholder="Share your experience"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Certificate URL</label>
                <input
                  type="url"
                  value={feedbackForm.certificateUrl}
                  onChange={(event) => setFeedbackForm((prev: any) => ({
                    ...prev,
                    certificateUrl: event.target.value,
                  }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                  placeholder="https://"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => handleSaveFeedback(feedbackOpenId)}
                disabled={feedbackSaving}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
              >
                {feedbackSaving ? 'Saving...' : 'Save Feedback'}
              </button>
              <button
                type="button"
                onClick={handleCancelFeedback}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDeleteCandidate(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-bold text-gray-900">Delete Donation?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will remove the donation from your history. You can undo for a short time.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  handleDeleteDonation(deleteCandidate.id, { skipConfirm: true });
                  setDeleteCandidate(null);
                }}
                disabled={donationDeleteId === deleteCandidate.id}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
              >
                {donationDeleteId === deleteCandidate.id ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DonorJourney;
