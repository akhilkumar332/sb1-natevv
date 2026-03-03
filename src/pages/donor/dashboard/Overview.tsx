import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  Clock,
  Droplet,
  Heart,
  PhoneCall,
  Share2,
  SlidersHorizontal,
  Users,
  Zap,
} from 'lucide-react';
import { ROUTES } from '../../../constants/routes';
import { ONE_DAY_MS } from '../../../constants/time';

const DonorOverview = () => {
  const [historyFilter, setHistoryFilter] = useState<'month' | 'year'>('month');
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const navigate = useNavigate();
  const dashboard = useOutletContext<any>();

  const {
    user,
    isLoading,
    stats,
    eligibleToDonate,
    daysUntilEligible,
    nextEligibleDate,
    donationHistory,
    emergencyRequests,
    availabilityActiveUntil,
    availableTodayLoading,
    availableTodayLabel,
    availableTodayHint,
    availabilityEnabled,
    normalizedLastDonation,
    incomingDonorRequests,
    outgoingDonorRequests,
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

  const totalDonationsLive = Math.max(stats?.totalDonations || 0, donationHistory?.length || 0);
  const livesSavedLive = stats?.livesSaved ?? totalDonationsLive * 3;
  const impactScoreLive = stats?.impactScore && stats.impactScore > 0
    ? stats.impactScore
    : totalDonationsLive * 100;
  const nextEligibleLabel = nextEligibleDate ? formatDate(nextEligibleDate) : 'Anytime';
  const eligibilityDetail = eligibleToDonate
    ? (nextEligibleDate ? `Eligible since ${nextEligibleLabel}` : 'Eligible anytime')
    : `Next eligible on ${nextEligibleLabel}`;

  const contactWindowMs = ONE_DAY_MS;
  const isContactActive = (respondedAt?: any) => {
    if (!respondedAt) return false;
    const respondedDate = respondedAt instanceof Date ? respondedAt : new Date(respondedAt);
    if (Number.isNaN(respondedDate.getTime())) return false;
    return respondedDate.getTime() + contactWindowMs > Date.now();
  };
  const activeConnectionsCount = [...(incomingDonorRequests || []), ...(outgoingDonorRequests || [])]
    .filter((request: any) => request.status === 'accepted' && isContactActive(request.respondedAt)).length;

  const donationEntries = Array.isArray(donationHistory) ? donationHistory : [];
  const resolvedDonationDates = donationEntries
    .map((entry) => {
      const rawDate = entry?.date || entry?.donationDate;
      if (rawDate instanceof Date) return rawDate;
      if (typeof rawDate?.toDate === 'function') return rawDate.toDate();
      if (typeof rawDate?.seconds === 'number') return new Date(rawDate.seconds * 1000);
      return rawDate ? new Date(rawDate) : null;
    })
    .filter((date): date is Date => Boolean(date) && !Number.isNaN(date!.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const firstDonationDate = resolvedDonationDates[0] || null;
  const firstDonationYear = firstDonationDate ? firstDonationDate.getFullYear() : currentYear;
  const firstDonationMonth = firstDonationDate ? firstDonationDate.getMonth() : currentMonth;

  useEffect(() => {
    if (selectedYear < firstDonationYear) {
      setSelectedYear(firstDonationYear);
      return;
    }
    if (selectedYear > currentYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, firstDonationYear, selectedYear]);

  useEffect(() => {
    const minMonth = selectedYear === firstDonationYear ? firstDonationMonth : 0;
    const maxMonth = selectedYear === currentYear ? currentMonth : 11;
    if (selectedMonth < minMonth) {
      setSelectedMonth(minMonth);
      return;
    }
    if (selectedMonth > maxMonth) {
      setSelectedMonth(maxMonth);
    }
  }, [currentMonth, currentYear, firstDonationMonth, firstDonationYear, selectedMonth, selectedYear]);

  const availableYears = Array.from({ length: currentYear - firstDonationYear + 1 }, (_, index) => firstDonationYear + index);
  const availableMonths = (() => {
    const minMonth = selectedYear === firstDonationYear ? firstDonationMonth : 0;
    const maxMonth = selectedYear === currentYear ? currentMonth : 11;
    const options = [];
    for (let month = minMonth; month <= maxMonth; month += 1) {
      options.push({
        value: month,
        label: new Date(selectedYear, month, 1).toLocaleString('en-US', { month: 'short' }),
      });
    }
    return options;
  })();

  const historySeries = (() => {
    if (resolvedDonationDates.length === 0) {
      return { label: '', series: [] as { key: string; label: string; count: number; showLabel: boolean }[] };
    }
    if (historyFilter === 'year') {
      const months = Array.from({ length: 12 }).map((_, index) => ({
        key: `${selectedYear}-${index}`,
        label: new Date(selectedYear, index, 1).toLocaleString('en-US', { month: 'short' }),
        count: 0,
        showLabel: true,
      }));
      const bucketMap = new Map(months.map((bucket) => [bucket.key, bucket]));
      resolvedDonationDates.forEach((date) => {
        if (date.getFullYear() !== selectedYear) return;
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const bucket = bucketMap.get(key);
        if (bucket) bucket.count += 1;
      });
      return {
        label: `${selectedYear}`,
        series: months,
      };
    }

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }).map((_, index) => ({
      key: `${selectedYear}-${selectedMonth}-${index + 1}`,
      label: `${index + 1}`,
      count: 0,
      showLabel: index === 0 || (index + 1) % 5 === 0 || index === daysInMonth - 1,
    }));
    const bucketMap = new Map(days.map((bucket) => [bucket.key, bucket]));
    resolvedDonationDates.forEach((date) => {
      if (date.getFullYear() !== selectedYear || date.getMonth() !== selectedMonth) return;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const bucket = bucketMap.get(key);
      if (bucket) bucket.count += 1;
    });
    const monthLabel = new Date(selectedYear, selectedMonth, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return {
      label: monthLabel,
      series: days,
    };
  })();
  const maxDonationMonth = Math.max(1, ...historySeries.series.map((bucket) => bucket.count));
  const filterDonationCount = historySeries.series.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-600">Snapshot</p>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-900">Your Snapshot</h2>
      </div>
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
          <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md dark:bg-slate-700 dark:border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Donations</p>
                <p className="text-2xl font-bold text-gray-900">{totalDonationsLive}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-50">
                <Droplet className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {isLoading ? 'Updating...' : 'Your lifesaving journey'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md dark:bg-slate-700 dark:border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Lives Saved</p>
                <p className="text-2xl font-bold text-gray-900">{livesSavedLive}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-50">
                <Heart className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Each donation saves 3 lives</p>
          </div>
          <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md dark:bg-slate-700 dark:border-red-200">
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
              {eligibleToDonate
                ? eligibilityDetail
                : `${eligibilityDetail} · ${daysUntilEligible} days remaining`}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md dark:bg-slate-700 dark:border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Impact Score</p>
                <p className="text-2xl font-bold text-gray-900">{impactScoreLive}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-50">
                <Award className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {stats?.rank ? `Rank #${stats.rank}` : isLoading ? 'Updating...' : 'Keep donating!'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md dark:bg-slate-700 dark:border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Active Connections</p>
                <p className="text-2xl font-bold text-gray-900">{activeConnectionsCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50">
                <PhoneCall className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(ROUTES.portal.donor.dashboard.requests)}
              className="mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              View connections →
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <div className="relative flex flex-col overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-white via-red-50 to-white p-4 shadow-lg transition-transform duration-300 hover:-translate-y-1 animate-fadeIn lg:h-full dark:border-red-200 dark:from-[#0b1220] dark:via-[#101826] dark:to-[#0b1220]">
          <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-red-100/70 blur-2xl dark:bg-red-100/30"></div>
          <div className="absolute -bottom-16 -left-16 h-36 w-36 rounded-full bg-red-100/60 blur-2xl dark:bg-red-100/25"></div>
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
            <div className="relative flex h-full flex-col">
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-red-600">BloodHub Donor Card</p>
                    <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-900">
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
                    <span className="rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:border-red-200 dark:bg-slate-700 dark:text-red-600">
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
                    <div className="flex items-center justify-between rounded-xl border border-red-100 bg-white/80 px-3 py-2 sm:col-span-2 dark:border-red-200 dark:bg-[#0f1726]/90">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-500">Share QR</p>
                        <p className="text-xs text-gray-600 dark:text-gray-600">Scan to open your donor profile link.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQrPreviewOpen(true)}
                        className="rounded-lg border border-red-100 bg-white p-1 transition-transform duration-300 hover:scale-105 dark:border-red-200 dark:bg-[#0a0f1a]"
                        aria-label="Open QR preview"
                      >
                        <img src={qrCodeDataUrl} alt="BH ID QR" className="h-12 w-12 shrink-0" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-400">
                <span>BloodHub India</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShareOptionsOpen(true)}
                    className="flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 transition-all duration-300 hover:bg-red-50 dark:border-red-200 dark:bg-[#0a0f1a] dark:text-red-600 dark:hover:bg-red-50"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Customize
                  </button>
                  <button
                    type="button"
                    onClick={handleShareDonorCard}
                    disabled={shareCardLoading}
                    className="flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 transition-all duration-300 hover:bg-red-50 disabled:opacity-50 dark:border-red-200 dark:bg-[#0a0f1a] dark:text-red-600 dark:hover:bg-red-50"
                  >
                    <Share2 className="h-3 w-3" />
                    {shareCardLoading ? 'Preparing' : 'Share Card'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid h-full gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6 lg:h-full flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-red-600">Donation History</p>
                <h2 className="text-lg font-bold text-gray-800">Mini Timeline</h2>
              </div>
              <div className="flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto">
                <div className="flex shrink-0 items-center gap-1 rounded-full border border-gray-100 bg-gray-50 p-1 text-[11px] font-semibold text-gray-600">
                  {(['month', 'year'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setHistoryFilter(filter)}
                      className={`rounded-full px-2 py-0.5 transition ${
                        historyFilter === filter ? 'bg-red-600 text-white' : 'text-gray-600 hover:text-red-600'
                      }`}
                    >
                      {filter === 'month' ? 'Month' : 'Year'}
                    </button>
                  ))}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(Number(event.target.value))}
                    className="w-[72px] rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700 focus:border-red-500 focus:outline-none"
                    disabled={availableYears.length <= 1}
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  {historyFilter === 'month' && (
                    <select
                      value={selectedMonth}
                      onChange={(event) => setSelectedMonth(Number(event.target.value))}
                      className="w-[72px] rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700 focus:border-red-500 focus:outline-none"
                      disabled={availableMonths.length <= 1}
                    >
                      {availableMonths.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.portal.donor.dashboard.journey)}
                  className="shrink-0 text-[11px] font-semibold text-red-600 hover:text-red-700 transition"
                >
                  View all history
                </button>
              </div>
            </div>
            {isLoading ? (
              <div className="mt-4 flex-1 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`history-skeleton-${index}`} className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : resolvedDonationDates.length === 0 ? (
              <div className="mt-4 flex-1 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                No donation history yet.
              </div>
            ) : filterDonationCount > 0 && historySeries.series.length > 0 ? (
              <div className="mt-4 flex flex-1 flex-col rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">{historySeries.label}</p>
                <div className="mt-4 flex-1">
                  <div
                    className="relative grid h-full items-center gap-2"
                    style={{ gridTemplateColumns: `repeat(${historySeries.series.length}, minmax(0, 1fr))` }}
                  >
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gray-200" />
                    {historySeries.series.map((bucket) => {
                      const normalized = maxDonationMonth > 0 ? bucket.count / maxDonationMonth : 0;
                      const dotSize = bucket.count > 0 ? 8 + Math.round(normalized * 10) : 6;
                      return (
                        <div key={bucket.key} className="flex flex-col items-center gap-2">
                          <div className="h-5">
                            {bucket.count > 0 && (
                              <span className="text-[10px] font-semibold text-red-600">
                                {bucket.count}
                              </span>
                            )}
                          </div>
                          <div
                            className={`rounded-full ${bucket.count > 0 ? 'bg-red-500' : 'bg-gray-300'}`}
                            style={{ width: `${dotSize}px`, height: `${dotSize}px` }}
                            title={`${bucket.count} donation${bucket.count === 1 ? '' : 's'}`}
                          />
                          <span className={`text-[10px] text-gray-500 ${bucket.showLabel ? '' : 'opacity-0'}`}>
                            {bucket.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  {filterDonationCount} donation{filterDonationCount === 1 ? '' : 's'} in view
                </p>
              </div>
            ) : (
              <div className="mt-4 flex-1 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                No donations in the selected period.
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
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
