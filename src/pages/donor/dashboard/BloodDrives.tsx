import { Calendar, Check, MapPin, MapPinned, Target } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useRealtimeCampaigns } from '../../../hooks/useRealtimeCampaigns';
import { useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import toast from 'react-hot-toast';
import { registerDonorForCampaign } from '../../../services/ngo.service';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DonorBloodDrives = () => {
  const dashboard = useOutletContext<any>();
  const {
    user,
    formatDateTime,
  } = dashboard;
  const { campaigns, loading, error } = useRealtimeCampaigns({ limitCount: 50 });
  const [typeFilter, setTypeFilter] = useState<'all' | 'blood-drive' | 'awareness' | 'fundraising' | 'volunteer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'completed' | 'cancelled' | 'draft'>('all');
  const [cityFilter, setCityFilter] = useState<'all' | 'my-city'>('all');
  const [participatingId, setParticipatingId] = useState<string | null>(null);

  const getLocationLabel = (campaign: any) => {
    if (!campaign) return 'Location to be announced';
    const locationData = campaign.location || (campaign as any).locationDetails;
    if (typeof locationData === 'string') return locationData;
    if (locationData?.address) return locationData.address;
    if (locationData?.venue) return locationData.venue;
    const fallbackCity = (campaign as any).city || campaign.location?.city;
    const fallbackState = (campaign as any).state || campaign.location?.state;
    if (fallbackCity || fallbackState) {
      return [fallbackCity, fallbackState].filter(Boolean).join(', ');
    }
    if (locationData?.city || locationData?.state) {
      return [locationData.city, locationData.state].filter(Boolean).join(', ');
    }
    return 'Location to be announced';
  };

  const toDateValue = (value: any) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };

  const getEffectiveStatus = (campaign: any) => {
    const endDate = toDateValue(campaign?.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (endDate && endDate < today) {
      return 'completed';
    }
    return campaign?.status || 'active';
  };

  const sortedCampaigns = useMemo(() => {
    const list = [...(campaigns || [])]
      .filter((campaign) => Boolean(campaign?.ngoId))
      .sort((a, b) => {
        const aDate = toDateValue(a.startDate) || toDateValue(a.createdAt) || new Date(0);
        const bDate = toDateValue(b.startDate) || toDateValue(b.createdAt) || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });

    return list.filter((campaign) => {
      if (typeFilter !== 'all' && campaign.type !== typeFilter) return false;
      const effectiveStatus = getEffectiveStatus(campaign);
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false;
      if (cityFilter === 'my-city') {
        const campaignCity = campaign.location?.city || (campaign as any).city || (campaign as any).locationDetails?.city;
        if (!campaignCity || !user?.city) return false;
        if (campaignCity.toLowerCase() !== user.city.toLowerCase()) return false;
      }
      return true;
    });
  }, [campaigns, typeFilter, statusFilter, cityFilter, user?.city]);

  const getCoordinates = (campaign: any): [number, number] | null => {
    const locationData = campaign.location || (campaign as any).locationDetails || {};
    const lat = locationData.latitude ?? (campaign as any).latitude ?? campaign.location?.latitude ?? (campaign as any).locationDetails?.latitude;
    const lng = locationData.longitude ?? (campaign as any).longitude ?? campaign.location?.longitude ?? (campaign as any).locationDetails?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    return [lat, lng];
  };

  const getStatusClasses = (status?: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'upcoming':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'completed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-red-50 text-red-700 border-red-200';
    }
  };

  const isFundraisingDonate = (campaign: any) =>
    campaign?.type === 'fundraising' && campaign?.targetType === 'funds';

  const hasParticipated = (campaign: any) =>
    Array.isArray(campaign?.registeredDonors) && user?.uid
      ? campaign.registeredDonors.includes(user.uid)
      : false;

  const isParticipationClosed = (campaign: any) => {
    const effectiveStatus = getEffectiveStatus(campaign);
    return effectiveStatus === 'cancelled' || effectiveStatus === 'completed';
  };

  const handleParticipate = async (campaign: any) => {
    if (!user?.uid) {
      toast.error('Please log in to participate.');
      return;
    }
    if (isParticipationClosed(campaign)) {
      toast.error('Participation is closed for this campaign.');
      return;
    }
    if (hasParticipated(campaign)) {
      toast.success('You already participated.');
      return;
    }
    try {
      setParticipatingId(campaign.id);
      await registerDonorForCampaign(campaign.id, user.uid);
      toast.success('Participation confirmed.');
    } catch (error: any) {
      const message = error?.message || '';
      if (message.toLowerCase().includes('already registered')) {
        toast.success('You already participated.');
        return;
      }
      toast.error(message || 'Unable to participate. Please try again.');
    } finally {
      setParticipatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-red-600">Community</p>
        <h2 className="text-xl font-bold text-gray-900">Blood Drives</h2>
        <p className="text-sm text-gray-500 mt-1">Campaigns and blood drives created by NGOs.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <MapPinned className="w-5 h-5 mr-2 text-red-600" />
            NGO Campaigns
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600">
              <span className="text-gray-400">Type:</span>
              {(['all', 'blood-drive', 'awareness', 'fundraising', 'volunteer'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                    typeFilter === type ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {type === 'all' ? 'All' : type.replace('-', ' ')}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600">
              <span className="text-gray-400">Status:</span>
              {(['all', 'active', 'upcoming', 'completed', 'cancelled'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                    statusFilter === status ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {status === 'all' ? 'All' : status}
                </button>
              ))}
            </div>
            {user?.city && (
              <button
                onClick={() => setCityFilter(cityFilter === 'all' ? 'my-city' : 'all')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
                  cityFilter === 'my-city' ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cityFilter === 'my-city' ? `City: ${user.city}` : 'All cities'}
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`camp-skeleton-${index}`} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 text-center py-4">{error}</p>
        ) : (
          <>
            <div className="space-y-4">
              {sortedCampaigns.length > 0 ? (
                sortedCampaigns.map((campaign: any) => (
                  <div
                    key={campaign.id}
                    className="rounded-2xl border border-red-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 p-4 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)] lg:items-stretch">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] text-red-600 font-semibold uppercase tracking-[0.3em]">Campaign</p>
                            <h3 className="text-lg font-semibold text-gray-900 mt-1">
                              {campaign.title || 'NGO Campaign'}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              {campaign.ngoName ? `By ${campaign.ngoName}` : 'By NGO'}
                            </p>
                          </div>
                          {getEffectiveStatus(campaign) && (
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusClasses(getEffectiveStatus(campaign))} w-fit`}>
                              {getEffectiveStatus(campaign)}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                          <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1">
                            <Target className="w-3 h-3 text-red-500" />
                            {campaign.type || 'blood-drive'}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1">
                            <MapPin className="w-3 h-3 text-gray-500" />
                            {getLocationLabel(campaign)}
                          </span>
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs text-gray-600">
                          <div className="flex flex-wrap items-center gap-2">
                            <Calendar className="w-3 h-3 text-gray-500" />
                            <span className="font-semibold text-gray-700">Starts:</span>
                            <span>{formatDateTime(campaign.startDate)}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            <span className="font-semibold text-gray-700">Ends:</span>
                            <span>{formatDateTime(campaign.endDate)}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {isFundraisingDonate(campaign) ? (
                            <button
                              type="button"
                              disabled
                              className="rounded-full bg-red-100 px-4 py-2 text-xs font-semibold text-red-700"
                            >
                              Donate (Coming soon)
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleParticipate(campaign)}
                              disabled={hasParticipated(campaign) || participatingId === campaign.id || isParticipationClosed(campaign)}
                              title={isParticipationClosed(campaign) ? 'Participation closed for this campaign.' : undefined}
                              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                                hasParticipated(campaign)
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : isParticipationClosed(campaign)
                                    ? 'bg-gray-100 text-gray-500'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                              } ${participatingId === campaign.id ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                              {hasParticipated(campaign) ? (
                                <span className="inline-flex items-center gap-2">
                                  <Check className="w-3 h-3" />
                                  Participated
                                </span>
                              ) : isParticipationClosed(campaign)
                                ? 'Closed'
                                : participatingId === campaign.id
                                  ? 'Participating...'
                                  : 'Participate'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="h-64 w-full overflow-hidden rounded-xl border border-red-100 bg-red-50/60">
                        {getCoordinates(campaign) ? (
                          <MapContainer
                            key={`${campaign.id}-map`}
                            center={getCoordinates(campaign) as [number, number]}
                            zoom={12}
                            scrollWheelZoom={false}
                            className="h-full w-full"
                          >
                            <TileLayer
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              attribution="&copy; OpenStreetMap contributors"
                            />
                            <Marker position={getCoordinates(campaign) as [number, number]} />
                          </MapContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-gray-500">
                            Map location not available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No NGO campaigns available yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DonorBloodDrives;
