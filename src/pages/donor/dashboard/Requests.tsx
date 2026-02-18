import { useOutletContext } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Droplet, Loader2, MapPin, MessageCircle, PhoneCall } from 'lucide-react';

const DonorRequests = () => {
  const dashboard = useOutletContext<any>();

  const {
    isLoading,
    emergencyRequests,
    responding,
    incomingDonorRequests,
    outgoingDonorRequests,
    incomingRequestsLoading,
    outgoingRequestsLoading,
    donorRequestBatches,
    donorRequestBatchesLoading,
    donorRequestActionId,
    handleRespondToRequest,
    handleDonorRequestDecision,
    handleViewAllRequests,
    formatDate,
    formatTime,
  } = dashboard;

  const [now, setNow] = useState(() => Date.now());
  const [outreachFilter, setOutreachFilter] = useState<'all' | 'pending' | 'accepted' | 'expired'>('all');

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  const getDonationLabel = (type?: string) => {
    if (!type) return 'Donation';
    if (type === 'whole') return 'Whole Blood';
    if (type === 'plasma') return 'Plasma';
    if (type === 'platelets') return 'Platelets';
    return type;
  };
  const getStatusBadge = (status?: string) => {
    if (status === 'accepted') return 'bg-emerald-100 text-emerald-700';
    if (status === 'rejected') return 'bg-rose-100 text-rose-700';
    if (status === 'expired') return 'bg-gray-100 text-gray-600';
    if (status === 'cancelled') return 'bg-gray-100 text-gray-600';
    return 'bg-amber-100 text-amber-700';
  };
  const getBatchStatusBadge = (status?: string) => {
    if (status === 'sent') return 'bg-emerald-100 text-emerald-700';
    if (status === 'sending') return 'bg-amber-100 text-amber-700';
    if (status === 'cancelled') return 'bg-rose-100 text-rose-700';
    if (status === 'failed') return 'bg-rose-100 text-rose-700';
    return 'bg-gray-100 text-gray-600';
  };
  const contactWindowMs = 24 * 60 * 60 * 1000;
  const getContactWindow = (respondedAt?: any) => {
    if (!respondedAt) return null;
    const respondedDate = respondedAt instanceof Date ? respondedAt : new Date(respondedAt);
    if (Number.isNaN(respondedDate.getTime())) return null;
    const expiresAt = new Date(respondedDate.getTime() + contactWindowMs);
    const remainingMs = expiresAt.getTime() - now;
    return {
      expiresAt,
      remainingMs,
      active: remainingMs > 0,
    };
  };
  const formatContactCountdown = (remainingMs: number) => {
    if (remainingMs <= 0) return 'Expired';
    const minutes = Math.ceil(remainingMs / (60 * 1000));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.ceil(minutes / 60);
    return `${hours}h`;
  };
  const getTelHref = (phone?: string) => {
    if (!phone) return null;
    const trimmed = phone.trim();
    if (!trimmed) return null;
    return `tel:${trimmed.replace(/\s+/g, '')}`;
  };
  const getWhatsAppHref = (phone?: string) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    return `https://wa.me/${digits}`;
  };

  const renderContactCapsule = (options: { label: string; phone?: string; respondedAt?: any; accent?: 'emerald' | 'red' }) => {
    const { label, phone, respondedAt, accent = 'emerald' } = options;
    const contactWindow = getContactWindow(respondedAt);
    if (!contactWindow?.active) return null;
    const telHref = getTelHref(phone);
    const whatsappHref = getWhatsAppHref(phone);
    const accentBg = accent === 'red' ? 'bg-red-50/80 border-red-200' : 'bg-emerald-50/80 border-emerald-200';
    const accentText = accent === 'red' ? 'text-red-600' : 'text-emerald-600';
    const countdown = formatContactCountdown(contactWindow.remainingMs);

    return (
      <div className={`mt-3 rounded-xl border ${accentBg} p-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.2em] ${accentText}`}>Contact window</p>
            <p className="text-sm font-semibold text-gray-800">{label}</p>
            <p className="text-xs text-gray-500 mt-1">
              {phone ? phone : 'Phone not available'} · Expires in {countdown}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={telHref || '#'}
              onClick={(event) => {
                if (!telHref) event.preventDefault();
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold border ${
                telHref ? 'border-gray-200 text-gray-700 hover:bg-white' : 'border-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Call
            </a>
            <a
              href={whatsappHref || '#'}
              target={whatsappHref ? '_blank' : undefined}
              rel={whatsappHref ? 'noreferrer' : undefined}
              onClick={(event) => {
                if (!whatsappHref) event.preventDefault();
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold border ${
                whatsappHref ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  };

  const pendingDonorRequests = (incomingDonorRequests || []).filter((request: any) => request.status === 'pending');
  const acceptedIncomingRequests = (incomingDonorRequests || []).filter((request: any) => request.status === 'accepted');
  const activeIncomingConnections = acceptedIncomingRequests.filter((request: any) => getContactWindow(request.respondedAt)?.active);

  const outreachTotals = useMemo(() => {
    const counts = { all: 0, pending: 0, accepted: 0, expired: 0 };
    (outgoingDonorRequests || []).forEach((request: any) => {
      const status = request?.status || 'pending';
      counts.all += 1;
      if (status === 'accepted') counts.accepted += 1;
      else if (status === 'expired') counts.expired += 1;
      else counts.pending += 1;
    });
    return counts;
  }, [outgoingDonorRequests]);
  const filteredOutgoing = (outgoingDonorRequests || []).filter((request: any) => {
    const status = request?.status || 'pending';
    if (outreachFilter === 'all') return true;
    if (outreachFilter === 'accepted') return status === 'accepted';
    if (outreachFilter === 'expired') return status === 'expired';
    return status === 'pending';
  });

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-600">Direct Requests</p>
                <h2 className="text-xl font-bold text-gray-900">Donor-to-donor requests</h2>
                <p className="text-sm text-gray-500 mt-1">Respond to donors who requested you directly.</p>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                {pendingDonorRequests.length} Pending
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {incomingRequestsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={`incoming-skeleton-${index}`} className="p-5 border border-gray-100 rounded-2xl bg-gray-50 animate-pulse h-24" />
                  ))}
                </div>
              ) : pendingDonorRequests.length > 0 ? (
                pendingDonorRequests.map((request: any) => (
                  <div key={request.id} className="p-5 border border-amber-100 rounded-2xl bg-amber-50/40">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-800">
                            {request.requesterName || 'Anonymous Donor'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {request.requesterBhId ? `BH ID: ${request.requesterBhId}` : 'BH ID unavailable'}
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white text-amber-700 border border-amber-200 w-fit">
                          {getDonationLabel(request.donationType)}
                        </span>
                      </div>
                      <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                        <p className="flex items-center gap-2">
                          <Droplet className="w-4 h-4 text-red-500" />
                          {request.requesterBloodType || 'Blood type'} request
                        </p>
                        <p className="flex items-center gap-2 text-xs text-gray-500 sm:justify-end">
                          <MapPin className="w-4 h-4" />
                          {request.requesterLocation?.city || request.targetLocation?.city || 'Location shared on request'}
                        </p>
                        <p className="text-xs text-gray-500 sm:col-span-2">
                          Requested {formatTime(request.requestedAt)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <button
                          onClick={() => handleDonorRequestDecision(request.id, 'accepted')}
                          disabled={donorRequestActionId === request.id}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {donorRequestActionId === request.id ? 'Working...' : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleDonorRequestDecision(request.id, 'rejected')}
                          disabled={donorRequestActionId === request.id}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {donorRequestActionId === request.id ? 'Working...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-2xl py-8 text-center">
                  No donor requests right now.
                </div>
              )}
            </div>

            {activeIncomingConnections.length > 0 && (
              <div className="mt-8 border-t border-gray-100 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Accepted connections</p>
                    <h3 className="text-lg font-bold text-gray-900">Connect with requesters</h3>
                    <p className="text-sm text-gray-500 mt-1">Contact details stay visible for 24 hours after acceptance.</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                    {activeIncomingConnections.length} Active
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {activeIncomingConnections.map((request: any) => (
                    <div key={request.id} className="p-5 border border-emerald-100 rounded-2xl bg-emerald-50/40">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{request.requesterName || 'Donor requester'}</p>
                          <p className="text-xs text-gray-500">
                            {request.requesterBhId ? `BH ID: ${request.requesterBhId}` : 'BH ID unavailable'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Requested {formatTime(request.requestedAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white text-emerald-700 border border-emerald-200 w-fit">
                            Accepted
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            Notification sent
                          </span>
                        </div>
                      </div>
                      {renderContactCapsule({
                        label: request.requesterName || 'Requester',
                        phone: request.requesterPhone,
                        respondedAt: request.respondedAt,
                        accent: 'emerald',
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-red-600">Urgent Nearby</p>
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
                  Emergency requests
                </h2>
                <p className="text-sm text-gray-500 mt-1">Nearby blood banks requesting blood now.</p>
              </div>
              <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-sm font-semibold">
                {emergencyRequests.length} Active
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`request-skeleton-${index}`}
                    className="p-5 border border-gray-100 rounded-2xl bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-xl bg-gray-100 animate-pulse w-12 h-12" />
                        <div className="space-y-2">
                          <div className="h-4 w-48 rounded-full bg-gray-100 animate-pulse" />
                          <div className="h-3 w-40 rounded-full bg-gray-100 animate-pulse" />
                          <div className="h-3 w-24 rounded-full bg-gray-100 animate-pulse" />
                        </div>
                      </div>
                      <div className="h-8 w-20 rounded-xl bg-gray-100 animate-pulse" />
                    </div>
                  </div>
                ))
              ) : emergencyRequests.length > 0 ? (
                emergencyRequests.map((request: any) => (
                  <div
                    key={request.id}
                    className={`p-5 border rounded-2xl transition-all duration-300 ${
                      request.urgency === 'critical'
                        ? 'border-red-300 bg-red-50 hover:bg-red-100'
                        : request.urgency === 'high'
                        ? 'border-red-200 bg-red-50/70 hover:bg-red-100/80'
                        : 'border-red-100 bg-white hover:bg-red-50'
                    }`}
                  >
                    <div className="flex h-full flex-col gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${
                          request.urgency === 'critical' ? 'bg-red-600' :
                          request.urgency === 'high' ? 'bg-red-500' : 'bg-red-400'
                        }`}>
                          <Droplet className="w-6 h-6 text-white" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-bold text-gray-800">
                            Urgent: {request.bloodType} • {request.units} Units needed
                          </h3>
                          <p className="text-sm text-gray-600 flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {request.hospitalName}, {request.city}
                            {request.distance && ` · ${request.distance.toFixed(1)} km away`}
                          </p>
                          <p className="text-xs text-gray-500">
                            Posted {formatTime(request.requestedAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRespondToRequest(request.id)}
                        disabled={responding}
                        className="w-full sm:w-auto sm:self-end px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      >
                        {responding ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <span>Respond</span>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 sm:col-span-2">
                  <CheckCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-gray-600">No emergency requests matching your blood type at the moment.</p>
                </div>
              )}
            </div>

            {emergencyRequests.length > 0 && (
              <button
                onClick={handleViewAllRequests}
                className="w-full mt-6 py-3 text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all duration-300"
              >
                View All Requests →
              </button>
            )}
          </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-red-600">Batch Outreach</p>
              <h3 className="text-xl font-bold text-gray-900">Bulk requests</h3>
            </div>
            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold">
              {donorRequestBatches?.length || 0} Total
            </span>
          </div>
          {donorRequestBatchesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={`batch-skeleton-${index}`} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : donorRequestBatches?.length ? (
            <div className="space-y-4">
              {donorRequestBatches.map((batch: any) => (
                <div key={batch.id} className="p-5 rounded-2xl border border-gray-100 bg-gray-50/40">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {getDonationLabel(batch.donationType)} · {batch.targetCount} donors
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Sent {batch.sentCount || 0} • Skipped {batch.skippedCount || 0}
                        {batch.deletedCount ? ` • Deleted ${batch.deletedCount}` : ''}
                      </p>
                      {batch.message ? (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{batch.message}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getBatchStatusBadge(batch.status)}`}>
                        {(batch.status || 'sent').charAt(0).toUpperCase() + (batch.status || 'sent').slice(1)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(batch.createdAt)} • {formatTime(batch.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-6">
              No batch requests sent yet.
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-red-600">Your Outreach</p>
              <h3 className="text-xl font-bold text-gray-900">Requests you sent</h3>
            </div>
            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold">
              {outgoingDonorRequests?.length || 0} Total
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {(['all', 'pending', 'accepted', 'expired'] as const).map((filter) => {
              const isActive = outreachFilter === filter;
              const label = filter.charAt(0).toUpperCase() + filter.slice(1);
              const count = outreachTotals[filter];
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setOutreachFilter(filter)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${
                    isActive
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {label} {typeof count === 'number' ? `(${count})` : ''}
                </button>
              );
            })}
          </div>
          {outgoingRequestsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`outgoing-skeleton-${index}`} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : filteredOutgoing?.length ? (
            <div className="space-y-4">
              {filteredOutgoing.map((request: any) => (
                <div key={request.id} className="p-5 rounded-2xl border border-gray-100 bg-gray-50/40">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {request.targetDonorName || 'Target donor'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {request.targetDonorBhId ? `BH ID: ${request.targetDonorBhId}` : 'BH ID unavailable'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {getDonationLabel(request.donationType)} • {request.targetLocation?.city || 'Location shared'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(request.status)}`}>
                        {(request.status || 'pending').charAt(0).toUpperCase() + (request.status || 'pending').slice(1)}
                      </span>
                      {request.status === 'accepted' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Notification sent
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {formatDate(request.requestedAt)} • {formatTime(request.requestedAt)}
                      </span>
                    </div>
                  </div>
                  {request.status === 'accepted' && renderContactCapsule({
                    label: request.targetDonorName || 'Accepting donor',
                    phone: request.targetDonorPhone,
                    respondedAt: request.respondedAt,
                    accent: 'red',
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-6">
              No requests in this filter yet.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DonorRequests;
