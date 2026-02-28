import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { notify } from 'services/notify.service';
import {
  Calendar,
  MapPin,
  Plus,
  Search,
  Target,
  X,
  Locate,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Timestamp } from 'firebase/firestore';
import type { NgoDashboardContext } from '../NgoDashboard';
import { createCampaign, updateCampaign, archiveCampaign, deleteCampaign } from '../../../services/ngo.service';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

function NgoCampaigns() {
  const { campaigns, getCampaignTypeIcon, getStatusColor, user } = useOutletContext<NgoDashboardContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusTab, setStatusTab] = useState<'active' | 'archived' | 'all'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [mapPosition, setMapPosition] = useState<[number, number]>([20.5937, 78.9629]);
  const [locating, setLocating] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      setMapPosition([lat, lng]);
    }
  }, [form.latitude, form.longitude]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    const create = searchParams.get('create');
    if (create === '1' && !isModalOpen) {
      openCreate();
      setSearchParams({});
    }
    if (editId && !isModalOpen) {
      const found = campaigns.some((campaign) => campaign.id === editId);
      if (found) {
        openEdit(editId);
        setSearchParams({});
      }
    }
  }, [searchParams, campaigns, isModalOpen, setSearchParams]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);


  const activeCampaignCount = useMemo(
    () => campaigns.filter((campaign) => campaign.status !== 'cancelled').length,
    [campaigns]
  );
  const archivedCampaignCount = useMemo(
    () => campaigns.filter((campaign) => campaign.status === 'cancelled').length,
    [campaigns]
  );

  const filteredCampaigns = useMemo(() => {
    let results = campaigns;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      results = results.filter((campaign) =>
        campaign.title.toLowerCase().includes(term) ||
        campaign.location.toLowerCase().includes(term)
      );
    }
    if (statusTab === 'archived') {
      results = results.filter((campaign) => campaign.status === 'cancelled');
    } else if (statusTab === 'active') {
      results = results.filter((campaign) => campaign.status !== 'cancelled');
    }
    return results;
  }, [campaigns, searchTerm, statusTab]);

  const openCreate = () => {
    setEditingCampaignId(null);
    setForm({ ...emptyForm });
    setMapPosition([20.5937, 78.9629]);
    setIsModalOpen(true);
  };

  const openEdit = (campaignId: string) => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    setEditingCampaignId(campaignId);
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
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingCampaignId(null);
    setForm({ ...emptyForm });
  };

  const handleMapChange = (pos: [number, number]) => {
    setMapPosition(pos);
    setForm((prev) => ({
      ...prev,
      latitude: pos[0].toFixed(6),
      longitude: pos[1].toFixed(6),
    }));
    reverseGeocode(pos);
  };

  const reverseGeocode = async (pos: [number, number]) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos[0]}&lon=${pos[1]}`
      );
      const data = await response.json();
      if (data?.display_name) {
        setForm((prev) => ({
          ...prev,
          address: data.display_name,
          city: data.address?.city || data.address?.town || data.address?.village || prev.city,
          state: data.address?.state || prev.state,
        }));
      }
    } catch (error) {
      notify.error('Could not fetch address for this location');
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      notify.error('Geolocation not supported in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos: [number, number] = [position.coords.latitude, position.coords.longitude];
        handleMapChange(pos);
        reverseGeocode(pos);
        setLocating(false);
      },
      () => {
        notify.error('Unable to fetch your location.');
        setLocating(false);
      }
    );
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

  const handleArchive = async (campaignId: string) => {
    try {
      await archiveCampaign(campaignId);
      notify.success('Campaign archived.');
    } catch (error: any) {
      notify.error(error?.message || 'Failed to archive campaign.');
    }
  };

  const handleDelete = async (campaignId: string) => {
    setDeletingId(campaignId);
    try {
      await deleteCampaign(campaignId);
      notify.success('Campaign deleted.');
      setDeleteCandidate(null);
    } catch (error: any) {
      notify.error(error?.message || 'Failed to delete campaign.');
    } finally {
      setDeletingId(null);
    }
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
        achieved: 0,
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
        createdBy: user.uid,
      };

      if (editingCampaignId) {
        const { achieved, createdBy, ...updatePayload } = payload;
        await updateCampaign(editingCampaignId, updatePayload);
        notify.success('Campaign updated successfully.');
      } else {
        await createCampaign(payload);
        notify.success('Campaign created successfully.');
      }
      closeModal();
    } catch (error: any) {
      notify.error(error?.message || 'Failed to save campaign.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">Campaigns</p>
            <h2 className="text-2xl font-bold text-gray-900">Manage your drives</h2>
            <p className="text-sm text-gray-500 mt-1">Track campaign goals, progress, and impact.</p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:from-red-700 hover:to-amber-700"
            onClick={openCreate}
          >
            <Plus className="w-5 h-5" />
            New Campaign
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search campaigns..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
          <span className="text-sm text-gray-500">{filteredCampaigns.length} campaigns</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[
            { id: 'active', label: `Active (${activeCampaignCount})` },
            { id: 'archived', label: `Archived (${archivedCampaignCount})` },
            { id: 'all', label: `All (${campaigns.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusTab(tab.id as 'active' | 'archived' | 'all')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold border ${
                statusTab === tab.id
                  ? 'bg-red-600 text-white border-red-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredCampaigns.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-10 text-center">
            <Target className="w-12 h-12 text-red-200 mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No campaigns yet</h3>
            <p className="text-gray-600">Create your first campaign to start mobilizing donors.</p>
            <button
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-5 py-3 text-sm font-semibold text-white"
              onClick={openCreate}
            >
              <Plus className="w-5 h-5" />
              Create Campaign
            </button>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => {
            const isCompleted = campaign.status === 'completed';
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
            return (
              <div key={campaign.id} className="bg-white rounded-2xl border border-red-100/60 shadow-xl p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
                      {getCampaignTypeIcon(campaign.type)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
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
                      <h3 className="text-lg font-semibold text-gray-900 mt-3">{campaign.title}</h3>
                      <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-500" />
                        {campaign.location}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-red-400" />
                        {formatDateRange(campaign.startDate, campaign.endDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-start lg:items-end gap-2">
                    <div className="text-xs text-gray-500">Target</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {campaign.target} {targetLabel}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Progress</span>
                    <span className="font-semibold text-gray-700">
                      {achievedValue} / {campaign.target} {targetLabel}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-red-600 to-amber-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>{progress.toFixed(1)}% completed</span>
                    <span>{campaign.city || 'City'}{campaign.state ? `, ${campaign.state}` : ''}</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Link
                    to={`/ngo/dashboard/campaigns/${campaign.id}`}
                    className="flex-1 rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 text-center"
                  >
                    View Details
                  </Link>
                  <button
                    className={`flex-1 rounded-xl border px-4 py-2 text-sm font-semibold ${
                      isCompleted
                        ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                        : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                    }`}
                    onClick={() => {
                      if (isCompleted) return;
                      openEdit(campaign.id);
                    }}
                    disabled={isCompleted}
                  >
                    Edit
                  </button>
                  {campaign.status === 'cancelled' ? (
                    <span className="flex-1 rounded-xl border border-gray-200 text-gray-400 px-4 py-2 text-sm font-semibold text-center">
                      Archived
                    </span>
                  ) : (
                    <button
                      className="flex-1 rounded-xl border border-gray-200 text-gray-600 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                      onClick={() => handleArchive(campaign.id)}
                    >
                      Archive
                    </button>
                  )}
                  <button
                    className={`flex-1 rounded-xl border px-4 py-2 text-sm font-semibold ${
                      isCompleted
                        ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                        : 'border-red-200 text-red-600 hover:bg-red-50'
                    }`}
                    onClick={() => {
                      if (isCompleted) return;
                      setDeleteCandidate(campaign.id);
                    }}
                    disabled={isCompleted}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-white">
              <h3 className="text-lg font-bold text-gray-900">
                {editingCampaignId ? 'Edit Campaign' : 'Create Campaign'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
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
                  onClick={closeModal}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Delete campaign?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently remove the campaign and its data.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => handleDelete(deleteCandidate!)}
                disabled={deletingId === deleteCandidate}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingId === deleteCandidate ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default NgoCampaigns;
