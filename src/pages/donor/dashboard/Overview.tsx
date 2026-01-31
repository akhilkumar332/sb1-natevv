import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  Clock,
  Droplet,
  Heart,
  Share2,
  SlidersHorizontal,
  Users,
  Zap,
} from 'lucide-react';

const DonorOverview = () => {
  const navigate = useNavigate();
  const dashboard = useOutletContext<any>();

  const {
    user,
    isLoading,
    stats,
    eligibleToDonate,
    daysUntilEligible,
    donationHistory,
    emergencyRequests,
    availabilityActiveUntil,
    availableTodayLoading,
    availableTodayLabel,
    availableTodayHint,
    availabilityEnabled,
    normalizedLastDonation,
    formatDate,
    shareOptions,
    qrCodeDataUrl,
    shareCardLoading,
    setShareOptionsOpen,
    handleShareDonorCard,
    setQrPreviewOpen,
    handleEmergencyRequests,
    handleFindDonors,
    handleInviteFriends,
    handleAvailableToday,
  } = dashboard;

  const donationEntries = Array.isArray(donationHistory) ? donationHistory : [];
  const recentDonations = donationEntries
    .map((entry) => {
      const rawDate = entry?.date || entry?.donationDate;
      const resolvedDate =
        rawDate instanceof Date
          ? rawDate
          : typeof rawDate?.toDate === 'function'
            ? rawDate.toDate()
            : typeof rawDate?.seconds === 'number'
              ? new Date(rawDate.seconds * 1000)
              : rawDate
                ? new Date(rawDate)
                : null;
      return { ...entry, resolvedDate };
    })
    .filter((entry) => entry.resolvedDate && !Number.isNaN(entry.resolvedDate.getTime()))
    .sort((a, b) => b.resolvedDate.getTime() - a.resolvedDate.getTime())
    .slice(0, 1);

  return (
    <>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-600">Snapshot</p>
        <h2 className="text-xl font-bold text-gray-900">Your Snapshot</h2>
      </div>
      <div className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`stat-skeleton-${index}`}
                className="bg-white rounded-xl border border-red-100 p-4 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="h-3 w-24 rounded-full bg-gray-100 animate-pulse" />
                  <div className="h-6 w-16 rounded-full bg-gray-100 animate-pulse" />
                  <div className="h-3 w-20 rounded-full bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Donations</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.totalDonations || 0}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50">
                    <Droplet className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Your lifesaving journey</p>
              </div>
              <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Lives Saved</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.livesSaved || 0}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50">
                    <Heart className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Each donation saves 3 lives</p>
              </div>
              <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Next Eligible In</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {eligibleToDonate ? 0 : daysUntilEligible}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50">
                    <Clock className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {eligibleToDonate ? 'Ready to donate' : 'days remaining'}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Impact Score</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.impactScore || 0}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50">
                    <Award className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {stats?.rank ? `Rank #${stats.rank}` : 'Keep donating!'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-white via-red-50 to-white p-4 shadow-lg transition-transform duration-300 hover:-translate-y-1 animate-fadeIn min-h-[260px] sm:min-h-0">
          <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-red-100/70 blur-2xl"></div>
          <div className="absolute -bottom-16 -left-16 h-36 w-36 rounded-full bg-red-100/60 blur-2xl"></div>
          {isLoading ? (
            <div className="relative space-y-5">
              <div className="h-3 w-40 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-6 w-48 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-4 w-32 rounded-full bg-gray-100 animate-pulse" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
              </div>
              <div className="h-6 w-28 rounded-full bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <div className="relative space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-red-600">BloodHub Donor Card</p>
                  <h2 className="mt-1 text-xl font-bold text-gray-900">
                    {user?.displayName || 'Donor'}
                  </h2>
                  <p className="text-xs text-gray-500">{user?.city || 'Location not set'}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      availabilityEnabled ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {availabilityEnabled ? 'Available' : 'On Break'}
                  </span>
                  <span className="rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                    Verified Donor
                  </span>
                  <div className="rounded-2xl bg-red-600 px-3 py-2 text-lg font-bold text-white shadow-lg">
                    {user?.bloodType || '—'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {shareOptions.showBhId && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">BH ID</p>
                    <p className="font-semibold text-gray-900">{user?.bhId || 'Pending'}</p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Last Donation</p>
                  <p className="font-semibold text-gray-900">
                    {normalizedLastDonation ? formatDate(normalizedLastDonation) : 'Not recorded'}
                  </p>
                </div>
                {shareOptions.showPhone && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Phone</p>
                    <p className="text-xs font-semibold text-gray-900 break-all">
                      {user?.phoneNumber || 'Not set'}
                    </p>
                  </div>
                )}
                {shareOptions.showEmail && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Email</p>
                    <p className="text-xs font-semibold text-gray-900 break-all">
                      {user?.email || 'Not set'}
                    </p>
                  </div>
                )}
                {shareOptions.showQr && qrCodeDataUrl && (
                  <div className="flex items-center justify-between rounded-xl border border-red-100 bg-white/80 px-3 py-2 sm:col-span-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Share QR</p>
                      <p className="text-xs text-gray-600">Scan to open your donor profile link.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQrPreviewOpen(true)}
                      className="rounded-lg border border-red-100 bg-white p-1 transition-transform duration-300 hover:scale-105"
                      aria-label="Open QR preview"
                    >
                      <img src={qrCodeDataUrl} alt="BH ID QR" className="h-12 w-12 shrink-0" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-400">
                <span>BloodHub India</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShareOptionsOpen(true)}
                    className="flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 transition-all duration-300 hover:bg-red-50"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Customize
                  </button>
                  <button
                    type="button"
                    onClick={handleShareDonorCard}
                    disabled={shareCardLoading}
                    className="flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 transition-all duration-300 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Share2 className="h-3 w-3" />
                    {shareCardLoading ? 'Preparing' : 'Share Card'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-red-600">Eligibility Snapshot</p>
                <h2 className="text-lg font-bold text-gray-800">Donation Readiness</h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  eligibleToDonate ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {eligibleToDonate ? 'Eligible' : 'Cooling Down'}
              </span>
            </div>
            {isLoading ? (
              <div className="mt-4 space-y-3">
                <div className="h-4 w-40 rounded-full bg-gray-100 animate-pulse" />
                <div className="h-4 w-32 rounded-full bg-gray-100 animate-pulse" />
                <div className="h-4 w-28 rounded-full bg-gray-100 animate-pulse" />
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <span className="text-gray-600">Next eligible date</span>
                  <span className="font-semibold text-gray-900">
                    {normalizedLastDonation && daysUntilEligible > 0
                      ? formatDate(new Date(normalizedLastDonation.getTime() + 90 * 86400000))
                      : 'Anytime'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <span className="text-gray-600">Days remaining</span>
                  <span className="font-semibold text-gray-900">
                    {eligibleToDonate ? '0 days' : `${daysUntilEligible} days`}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <span className="text-gray-600">Last donation</span>
                  <span className="font-semibold text-gray-900">
                    {normalizedLastDonation ? formatDate(normalizedLastDonation) : 'Not recorded'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-red-600">Donation History</p>
                <h2 className="text-lg font-bold text-gray-800">Mini Timeline</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/donor/dashboard/journey')}
                className="text-xs font-semibold text-red-600 hover:text-red-700 transition"
              >
                View all history
              </button>
            </div>
            {isLoading ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`history-skeleton-${index}`} className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : recentDonations.length > 0 ? (
              <div className="mt-4 space-y-3">
                {recentDonations.map((entry) => (
                  <div
                    key={entry.id || entry.donationId || `${entry.resolvedDate?.getTime()}`}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{entry.bloodType || user?.bloodType || 'Donation'}</p>
                      <p className="text-xs text-gray-500">
                        {entry.location || entry.campName || entry.hospitalName || 'Donation record'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-gray-700">
                      {entry.resolvedDate ? formatDate(entry.resolvedDate) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                No donation history yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-10">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <Zap className="w-6 h-6 mr-2 text-red-600" />
            Quick Actions
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`action-skeleton-${index}`}
                  className="p-5 rounded-xl bg-gray-50 border border-gray-100"
                >
                  <div className="h-8 w-8 rounded-full bg-gray-100 animate-pulse mx-auto mb-3" />
                  <div className="h-3 w-20 rounded-full bg-gray-100 animate-pulse mx-auto" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                onClick={handleEmergencyRequests}
                className="p-5 bg-red-50 rounded-xl hover:bg-red-100 transition-all duration-300 hover:scale-[1.02] group"
              >
                <AlertCircle className="w-7 h-7 text-red-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-semibold text-gray-800">Emergency Requests</p>
                {emergencyRequests.length > 0 && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-red-200 text-red-700 text-xs rounded-full font-bold">
                    {emergencyRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleFindDonors}
                className="p-5 bg-red-50 rounded-xl hover:bg-red-100 transition-all duration-300 hover:scale-[1.02] group"
              >
                <Users className="w-7 h-7 text-red-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-semibold text-gray-800">Find Donors</p>
              </button>
              <button
                onClick={handleInviteFriends}
                className="p-5 bg-red-50 rounded-xl hover:bg-red-100 transition-all duration-300 hover:scale-[1.02] group"
              >
                <Share2 className="w-7 h-7 text-red-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-semibold text-gray-800">Invite Friends</p>
              </button>
              <button
                onClick={handleAvailableToday}
                disabled={availableTodayLoading}
                className={`p-5 rounded-xl transition-all duration-300 hover:scale-[1.02] group ${
                  availabilityActiveUntil ? 'bg-red-100' : 'bg-red-50 hover:bg-red-100'
                } ${availableTodayLoading ? 'opacity-70' : ''}`}
              >
                <Clock className="w-7 h-7 text-red-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-semibold text-gray-800">
                  {availableTodayLoading ? 'Updating...' : availableTodayLabel}
                </p>
                <p className="mt-1 text-[10px] text-gray-500">{availableTodayHint}</p>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DonorOverview;
