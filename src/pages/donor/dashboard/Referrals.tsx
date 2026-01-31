import { useOutletContext } from 'react-router-dom';
import { useState } from 'react';
import { Share2, QrCode } from 'lucide-react';
import { Users } from 'lucide-react';

const DonorReferrals = () => {
  const dashboard = useOutletContext<any>();

  const {
    referralLoading,
    referralUsersLoading,
    referralCount,
    referralMilestone,
    referralDetails,
    eligibleReferralCount,
    referralSummary,
    copyInviteLink,
    shareInviteLink,
    openWhatsAppInvite,
    referralQrDataUrl,
    referralQrLoading,
    loadReferralQr,
    formatDate,
  } = dashboard;

  const [filter, setFilter] = useState<'all' | 'eligible' | 'not_eligible' | 'deleted'>('all');
  const [showQr, setShowQr] = useState(false);
  const sortedReferrals = [...referralDetails].sort((a: any, b: any) => {
    const dateA = a.sortDate ? new Date(a.sortDate).getTime() : 0;
    const dateB = b.sortDate ? new Date(b.sortDate).getTime() : 0;
    return dateB - dateA;
  });
  const filteredReferrals = sortedReferrals.filter((referral: any) => {
    if (filter === 'eligible') return referral.isEligible;
    if (filter === 'deleted') return referral.referralStatus === 'deleted' || referral.isDeleted;
    if (filter === 'not_eligible') return !referral.isEligible && referral.referralStatus !== 'deleted';
    return true;
  });

  return (
    <>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-red-600">Referrals</p>
        <h2 className="text-xl font-bold text-gray-900">Your referral impact</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Referral Impact</h2>
              <p className="text-xs text-gray-500">Track donors who joined through you.</p>
            </div>
            <div className="p-2 rounded-lg bg-red-50">
              <Users className="w-5 h-5 text-red-600" />
            </div>
          </div>
          {referralLoading ? (
            <div className="mt-4 space-y-3">
              <div className="h-4 w-24 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-8 w-16 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-3 w-40 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Eligible Referrals</p>
                  <p className="text-3xl font-bold text-gray-900">{eligibleReferralCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Milestone</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {referralMilestone.next ? `${referralMilestone.next} donors` : referralMilestone.label}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">{referralCount} total referrals. Eligibility unlocks after 7 days.</p>
              <p className="mt-3 text-xs text-gray-600">
                {referralMilestone.next
                  ? `${referralMilestone.remaining} more donor${referralMilestone.remaining === 1 ? '' : 's'} to reach the next milestone.`
                  : 'You are a Legend Referrer!'}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Registered</p>
                  <p className="text-sm font-semibold text-gray-800">{referralSummary?.registered || 0}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Onboarded</p>
                  <p className="text-sm font-semibold text-gray-800">{referralSummary?.onboarded || 0}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Eligible</p>
                  <p className="text-sm font-semibold text-gray-800">{referralSummary?.eligible || 0}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Not Eligible</p>
                  <p className="text-sm font-semibold text-gray-800">{referralSummary?.notEligible || 0}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="w-full rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-all duration-300 hover:bg-red-50"
                >
                  Copy Referral Link
                </button>
                <button
                  type="button"
                  onClick={openWhatsAppInvite}
                  className="w-full rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-600 transition-all duration-300 hover:bg-green-50"
                >
                  Share on WhatsApp
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={shareInviteLink}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50"
                >
                  <Share2 className="h-4 w-4" />
                  Share Link
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const next = !showQr;
                    setShowQr(next);
                    if (next) {
                      await loadReferralQr();
                    }
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50"
                >
                  <QrCode className="h-4 w-4" />
                  {showQr ? 'Hide QR' : 'Show QR'}
                </button>
              </div>
              {showQr && (
                <div className="mt-4 flex items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  {referralQrLoading ? (
                    <div className="h-24 w-24 animate-pulse rounded-xl bg-gray-200" />
                  ) : referralQrDataUrl ? (
                    <img
                      src={referralQrDataUrl}
                      alt="Referral QR Code"
                      className="h-32 w-32 rounded-xl bg-white p-2"
                    />
                  ) : (
                    <p className="text-xs text-gray-500">QR not available</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Referred Donors</h3>
              <p className="text-xs text-gray-500">{referralCount} total</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              {[
                { id: 'all', label: 'All' },
                { id: 'eligible', label: 'Eligible' },
                { id: 'not_eligible', label: 'Not Eligible' },
                { id: 'deleted', label: 'Deleted' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id as typeof filter)}
                  className={`rounded-full border px-3 py-1 transition-all ${
                    filter === item.id
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {(referralLoading || referralUsersLoading) && (
              <span className="text-xs text-gray-500">Loading details...</span>
            )}
          </div>
          {referralLoading || referralUsersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`referral-skeleton-${index}`} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : filteredReferrals.length > 0 ? (
            <div className="space-y-4">
              {filteredReferrals.map((referral: any) => {
                const referredUser = referral.user || {};
                const displayName = referredUser.displayName || referredUser.name || 'New Donor';
                const initials = displayName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part: string) => part[0]?.toUpperCase())
                  .join('') || 'D';
                const referredAtLabel = referral.referredAt ? formatDate(referral.referredAt) : 'Pending';
                const statusLabel = referral.statusLabel || 'Registered';
                const notEligible = !referral.isEligible && referral.referralStatus !== 'deleted';
                const daysRemaining = typeof referral.remainingDays === 'number'
                  ? referral.remainingDays
                  : null;
                return (
                  <div key={referral.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-semibold">
                          {initials}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-800">{displayName}</p>
                            {referredUser.bhId && (
                              <span className="rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                                {referredUser.bhId}
                              </span>
                            )}
                            {referredUser.bloodType && (
                              <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                                {referredUser.bloodType}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Referred</p>
                        <p className="text-xs font-semibold text-gray-700">{referredAtLabel}</p>
                        {statusLabel && (
                          <span className="mt-2 inline-block rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                            {statusLabel}
                          </span>
                        )}
                        {notEligible && (
                          <div className="mt-2 text-[10px] uppercase tracking-wide text-gray-500">
                            Not eligible{typeof daysRemaining === 'number' && daysRemaining > 0 ? ` (${daysRemaining}d)` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                {filter === 'all'
                  ? 'No referrals yet. Share your link to invite donors.'
                  : 'No referrals match this filter.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DonorReferrals;
