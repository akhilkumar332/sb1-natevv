import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { notify } from 'services/notify.service';
import {
  MapPin,
  ArrowLeft,
  Archive,
  Trash2,
  Edit3,
  Target,
  Calendar,
  Locate,
  X,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Timestamp } from 'firebase/firestore';
import type { NgoDashboardContext } from '../NgoDashboard';
import { archiveCampaign, deleteCampaign, updateCampaign } from '../../../services/ngo.service';
import { getCurrentCoordinates, reverseGeocode } from '../../../utils/geolocation.utils';

const emptyForm = {
  title: '',
  description: '',
  type: 'blood-drive',
  status: 'draft',
  target: '',
  targetType: 'units',
  startDate: '',
  endDate: '',
  address: '',
  city: '',
  state: '',
  venue: '',
  latitude: '',
  longitude: '',
};

const parseLocalDate = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const typeLabels: Record<string, string> = {
  'blood-drive': 'Blood Drive',
  awareness: 'Awareness',
  fundraising: 'Fundraising',
  volunteer: 'Volunteer Drive',
};

const targetLabels: Record<string, string> = {
  units: 'Units',
  donors: 'Donors',
  funds: 'Funds',
  volunteers: 'Volunteers',
};

const formatDateRange = (start: Date, end: Date) => {
  const startText = start.toLocaleDateString();
  const endText = end.toLocaleDateString();
  return `${startText} • ${endText}`;
};

function toInputDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

function LocationMarker({
  position,
  onChange,
}: {
  position: [number, number];
  onChange: (pos: [number, number]) => void;
}) {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      onChange([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position ? <Marker position={position} /> : null;
}

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function NgoCampaignDetail() {
  const { campaignId } = useParams();
  const { campaigns, getStatusColor, user, getParticipantDonors } = useOutletContext<NgoDashboardContext>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [mapPosition, setMapPosition] = useState<[number, number]>([20.5937, 78.9629]);
  const [locating, setLocating] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [participantDonors, setParticipantDonors] = useState<any[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');

  const notifyNgoCampaignDetailError = (
    error: unknown,
    fallbackMessage: string,
    toastId: string,
    kind: string
  ) => notify.fromError(
    error,
    fallbackMessage,
    { id: toastId },
    {
      source: 'frontend',
      scope: 'ngo',
      metadata: { page: 'NgoCampaignDetail', kind },
    }
  );

  const campaign = useMemo(
    () => campaigns.find((item) => item.id === campaignId),
    [campaigns, campaignId]
  );

  const participantIds = useMemo(() => {
    if (!campaign) return [];
    return Array.isArray(campaign.registeredDonors) ? campaign.registeredDonors : [];
  }, [campaign]);

  const participantCount = useMemo(() => {
    if (!campaign) return 0;
    if (Array.isArray(campaign.registeredDonors)) return campaign.registeredDonors.length;
    if (typeof campaign.registeredDonors === 'number') return campaign.registeredDonors;
    return 0;
  }, [campaign]);

  useEffect(() => {
    let isActive = true;
    if (!campaign || participantIds.length === 0) {
      setParticipantDonors([]);
      return () => {
        isActive = false;
      };
    }
    setParticipantsLoading(true);
    getParticipantDonors(participantIds)
      .then((donors) => {
        if (!isActive) return;
        setParticipantDonors(donors);
      })
      .catch(() => {
        if (!isActive) return;
        setParticipantDonors([]);
      })
      .finally(() => {
        if (!isActive) return;
        setParticipantsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [campaign?.id, participantIds.join('|')]);

  const filteredParticipants = useMemo(() => {
    if (!participantSearch.trim()) return participantDonors;
    const term = participantSearch.toLowerCase();
    return participantDonors.filter((donor) =>
      donor.name?.toLowerCase().includes(term)
      || donor.city?.toLowerCase().includes(term)
      || donor.bloodType?.toLowerCase().includes(term)
    );
  }, [participantDonors, participantSearch]);

  useEffect(() => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      setMapPosition([lat, lng]);
    }
  }, [form.latitude, form.longitude]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  if (!campaign) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-bold text-gray-900">Campaign not found</h2>
        <p className="text-gray-500 mt-2">Return to the campaigns list.</p>
        <Link
          to="/ngo/dashboard/campaigns"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to campaigns
        </Link>
      </div>
    );
  }

  const registeredCount = Array.isArray(campaign.registeredDonors)
    ? campaign.registeredDonors.length
    : typeof campaign.registeredDonors === 'number'
      ? campaign.registeredDonors
      : 0;
  const achievedValue = Math.max(campaign.achieved || 0, registeredCount);
  const progress = campaign.target > 0 ? Math.min((achievedValue / campaign.target) * 100, 100) : 0;
  const typeLabel = typeLabels[campaign.type] || 'Campaign';
  const targetLabel = targetLabels[campaign.targetType || 'units'] || 'Units';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilStart = Math.ceil((campaign.startDate.getTime() - today.getTime()) / 86400000);
  const daysToEnd = Math.ceil((campaign.endDate.getTime() - today.getTime()) / 86400000);
  const scheduleLabel = daysUntilStart > 0
    ? `Starts in ${daysUntilStart}d`
    : daysToEnd > 0
      ? `${daysToEnd}d left`
      : 'Ended';
  const latitude = campaign.locationDetails?.latitude;
  const longitude = campaign.locationDetails?.longitude;
  const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number';

  const handleArchive = async () => {
    try {
      await archiveCampaign(campaign.id);
      notify.success('Campaign archived.');
    } catch (error: unknown) {
      notifyNgoCampaignDetailError(
        error,
        'Failed to archive campaign.',
        'ngo-campaign-detail-archive-error',
        'ngo.campaignDetail.archive'
      );
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCampaign(campaign.id);
      notify.success('Campaign deleted.');
    } catch (error: unknown) {
      notifyNgoCampaignDetailError(
        error,
        'Failed to delete campaign.',
        'ngo-campaign-detail-delete-error',
        'ngo.campaignDetail.delete'
      );
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const openEdit = () => {
    setForm({
      title: campaign.title,
      description: campaign.description || '',
      type: campaign.type,
      status: campaign.status,
      target: String(campaign.target || ''),
      targetType: campaign.targetType || 'units',
      startDate: campaign.startDate ? toInputDate(campaign.startDate) : '',
      endDate: campaign.endDate ? toInputDate(campaign.endDate) : '',
      address: campaign.locationDetails?.address || campaign.location || '',
      city: campaign.locationDetails?.city || campaign.city || '',
      state: campaign.locationDetails?.state || campaign.state || '',
      venue: campaign.locationDetails?.venue || '',
      latitude: campaign.locationDetails?.latitude ? String(campaign.locationDetails.latitude) : '',
      longitude: campaign.locationDetails?.longitude ? String(campaign.locationDetails.longitude) : '',
    });
    if (campaign.locationDetails?.latitude && campaign.locationDetails?.longitude) {
      setMapPosition([campaign.locationDetails.latitude, campaign.locationDetails.longitude]);
    } else {
      setMapPosition([20.5937, 78.9629]);
    }
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setIsEditOpen(false);
    setForm({ ...emptyForm });
    setShowSuggestions(false);
    setAddressSuggestions([]);
    setNoResults(false);
  };

  const handleMapChange = (pos: [number, number]) => {
    setMapPosition(pos);
    setForm((prev) => ({
      ...prev,
      latitude: pos[0].toFixed(6),
      longitude: pos[1].toFixed(6),
    }));
    void syncAddressFromCoordinates(pos);
  };

  const syncAddressFromCoordinates = async (pos: [number, number]) => {
    const data = await reverseGeocode(pos[0], pos[1], {
      scope: 'ngo',
      errorMessage: 'Could not fetch address for this location',
    });
    if (data?.display_name) {
      setForm((prev) => ({
        ...prev,
        address: data.display_name || prev.address,
        city: data.address?.city || data.address?.town || data.address?.village || prev.city,
        state: data.address?.state || prev.state,
      }));
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    const pos = await getCurrentCoordinates({
      scope: 'ngo',
      positionErrorMessage: 'Unable to fetch your location.',
      unsupportedErrorMessage: 'Geolocation not supported in this browser.',
    });
    if (!pos) {
      setLocating(false);
      return;
    }
    handleMapChange(pos);
    setLocating(false);
  };

  const handleAddressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, address: value }));
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (!value.trim()) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setNoResults(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=1`
        );
        const data = await response.json();
        setAddressSuggestions(data);
        setShowSuggestions(true);
        setNoResults(data.length === 0);
      } catch (error) {
        setAddressSuggestions([]);
        setShowSuggestions(true);
        setNoResults(true);
      }
    }, 400);
  };

  const handleAddressSelect = (suggestion: any) => {
    const lat = parseFloat(suggestion.lat);
    const lon = parseFloat(suggestion.lon);
    setForm((prev) => ({
      ...prev,
      address: suggestion.display_name,
      city: suggestion.address?.city || suggestion.address?.town || suggestion.address?.village || prev.city,
      state: suggestion.address?.state || prev.state,
      latitude: lat.toFixed(6),
      longitude: lon.toFixed(6),
    }));
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      setMapPosition([lat, lon]);
    }
    setShowSuggestions(false);
    setAddressSuggestions([]);
    setNoResults(false);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      notify.error('You must be logged in to manage campaigns.');
      return;
    }

    if (!form.title || !form.startDate || !form.endDate || !form.city || !form.state) {
      notify.error('Please fill out the required fields.');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = parseLocalDate(form.startDate);
    const endDate = parseLocalDate(form.endDate);

    if (!startDate || !endDate) {
      notify.error('Please enter valid dates.');
      return;
    }

    if (startDate < today) {
      notify.error('Start date cannot be in the past.');
      return;
    }
    if (endDate < today) {
      notify.error('End date cannot be in the past.');
      return;
    }
    if (endDate <= startDate) {
      notify.error('End date must be after start date.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ngoId: user.uid,
        ngoName: user.organizationName || user.displayName || 'NGO',
        title: form.title,
        description: form.description,
        type: form.type as any,
        status: form.status as any,
        target: Number(form.target || 0),
        targetType: form.targetType as any,
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        location: {
          address: form.address,
          city: form.city,
          state: form.state,
          venue: form.venue,
          latitude: form.latitude ? Number(form.latitude) : undefined,
          longitude: form.longitude ? Number(form.longitude) : undefined,
        },
      };

      await updateCampaign(campaign.id, payload);
      notify.success('Campaign updated successfully.');
      closeEdit();
    } catch (error: unknown) {
      notifyNgoCampaignDetailError(
        error,
        'Failed to update campaign.',
        'ngo-campaign-detail-update-error',
        'ngo.campaignDetail.update'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              to="/ngo/dashboard/campaigns"
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to campaigns
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                {typeLabel}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(campaign.status)}`}>
                {campaign.status}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 text-gray-500">
                {scheduleLabel}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mt-3">{campaign.title}</h2>
            <p className="text-sm text-gray-500 mt-2">{campaign.description || 'No description provided.'}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                <MapPin className="w-4 h-4 text-amber-500" />
                {campaign.location}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                <Calendar className="w-4 h-4 text-red-400" />
                {formatDateRange(campaign.startDate, campaign.endDate)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                <Target className="w-4 h-4 text-red-500" />
                {campaign.target} {targetLabel}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {campaign.status === 'cancelled' ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-400">
                <Archive className="w-4 h-4" />
                Archived
              </span>
            ) : (
              <button
                type="button"
                onClick={handleArchive}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                <Archive className="w-4 h-4" />
                Archive
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (campaign.status === 'completed') return;
                setDeleteOpen(true);
              }}
              disabled={campaign.status === 'completed'}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
                campaign.status === 'completed'
                  ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                  : 'border-red-200 text-red-600 hover:bg-red-50'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              type="button"
              onClick={() => {
                if (campaign.status === 'completed') return;
                openEdit();
              }}
              disabled={campaign.status === 'completed'}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                campaign.status === 'completed'
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              Edit Campaign
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Progress</h3>
            <Target className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Target</span>
            <span className="font-semibold text-gray-700">
              {achievedValue} / {campaign.target} {targetLabel}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-red-600 to-amber-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">{progress.toFixed(1)}% completed</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-500">Start date</p>
              <p className="text-sm font-semibold text-gray-900">{campaign.startDate.toLocaleDateString()}</p>
            </div>
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-500">End date</p>
              <p className="text-sm font-semibold text-gray-900">{campaign.endDate.toLocaleDateString()}</p>
            </div>
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-500">Location</p>
              <p className="text-sm font-semibold text-gray-900">{campaign.location}</p>
            </div>
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-500">City/State</p>
              <p className="text-sm font-semibold text-gray-900">
                {campaign.city || '-'}{campaign.state ? `, ${campaign.state}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MapPin className="w-5 h-5 text-amber-500" />
            Campaign map
          </div>
          <div className="mt-4 h-64 w-full overflow-hidden rounded-xl border border-gray-200">
            <MapContainer
              center={hasCoordinates ? [latitude as number, longitude as number] : [20.5937, 78.9629]}
              zoom={hasCoordinates ? 12 : 4}
              scrollWheelZoom={false}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {hasCoordinates && <Marker position={[latitude as number, longitude as number]} />}
            </MapContainer>
          </div>
          {!hasCoordinates && (
            <p className="text-xs text-gray-500 mt-3">No map coordinates saved for this campaign.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">Participated donors</p>
            <h3 className="text-lg font-bold text-gray-900">Donor list</h3>
            <p className="text-sm text-gray-500 mt-1">
              {participantCount} donors participated in this campaign.
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <input
              value={participantSearch}
              onChange={(event) => setParticipantSearch(event.target.value)}
              placeholder="Search donors..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4">
          {participantsLoading ? (
            <div className="text-sm text-gray-500 py-6">Loading participants...</div>
          ) : filteredParticipants.length === 0 ? (
            <div className="text-sm text-gray-500 py-6">
              {participantCount === 0
                ? 'No donors have participated yet.'
                : participantIds.length === 0
                  ? 'Participants recorded, but donor list is unavailable.'
                  : 'No matching donors found.'}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredParticipants.map((donor) => (
                <div key={donor.id} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-red-600 to-amber-500 text-white flex items-center justify-center font-semibold">
                      {donor.name?.charAt(0) || 'D'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{donor.name || 'Donor'}</p>
                      <p className="text-xs text-gray-500">
                        {donor.bloodType || 'Blood type'} • {donor.city || 'City'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-white">
              <h3 className="text-lg font-bold text-gray-900">Edit Campaign</h3>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto min-h-0 flex-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Title *</label>
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Type</label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="blood-drive">Blood Drive</option>
                    <option value="awareness">Awareness</option>
                    <option value="fundraising">Fundraising</option>
                    <option value="volunteer">Volunteer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Target *</label>
                  <input
                    name="target"
                    type="number"
                    min="0"
                    value={form.target}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Target type</label>
                  <select
                    name="targetType"
                    value={form.targetType}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="units">Units</option>
                    <option value="donors">Donors</option>
                    <option value="funds">Funds</option>
                    <option value="volunteers">Volunteers</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Status</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="draft">Draft</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Start date *</label>
                  <input
                    name="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">End date *</label>
                  <input
                    name="endDate"
                    type="date"
                    value={form.endDate}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Address</label>
                  <div className="relative">
                    <input
                      name="address"
                      value={form.address}
                      onChange={handleAddressChange}
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="Search for an address"
                      autoComplete="off"
                    />
                    {showSuggestions && (
                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
                        {addressSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.place_id}
                            type="button"
                            onClick={() => handleAddressSelect(suggestion)}
                            className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-red-50"
                          >
                            {suggestion.display_name}
                          </button>
                        ))}
                        {noResults && (
                          <div className="px-3 py-2 text-xs text-gray-500">No results found.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Venue</label>
                  <input
                    name="venue"
                    value={form.venue}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">City *</label>
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">State *</label>
                  <input
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Location on map</label>
                <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 h-56">
                  <MapContainer center={mapPosition} zoom={12} scrollWheelZoom={false} className="h-full w-full">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapUpdater center={mapPosition} />
                    <LocationMarker position={mapPosition} onChange={handleMapChange} />
                  </MapContainer>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Locate className="h-3 w-3" />
                    {locating ? 'Locating...' : 'Use current location'}
                  </button>
                  <span>Click the map to set the pin.</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Delete campaign?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently remove the campaign and its data.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NgoCampaignDetail;
