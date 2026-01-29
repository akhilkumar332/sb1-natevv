import { useOutletContext } from 'react-router-dom';
import { Users } from 'lucide-react';

const DonorReferrals = () => {
  const dashboard = useOutletContext<any>();

  const {
    referralLoading,
    referralUsersLoading,
    referralCount,
    referralMilestone,
    referralDetails,
    copyInviteLink,
    formatDate,
  } = dashboard;

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
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Referrals</p>
                  <p className="text-3xl font-bold text-gray-900">{referralCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Milestone</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {referralMilestone.next ? `${referralMilestone.next} donors` : referralMilestone.label}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-600">
                {referralMilestone.next
                  ? `${referralMilestone.remaining} more donor${referralMilestone.remaining === 1 ? '' : 's'} to reach the next milestone.`
                  : 'You are a Legend Referrer!'}
              </p>
              <button
                type="button"
                onClick={copyInviteLink}
                className="mt-4 w-full rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-all duration-300 hover:bg-red-50"
              >
                Copy Referral Link
              </button>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Referred Donors</h3>
              <p className="text-xs text-gray-500">{referralCount} total</p>
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
          ) : referralDetails.length > 0 ? (
            <div className="space-y-4">
              {referralDetails.map((referral: any) => {
                const referredUser = referral.user || {};
                const displayName = referredUser.displayName || referredUser.name || 'New Donor';
                const initials = displayName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part: string) => part[0]?.toUpperCase())
                  .join('') || 'D';
                const referredAtLabel = referral.referredAt ? formatDate(referral.referredAt) : 'Pending';
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
                                BH {referredUser.bhId}
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
                        {referral.status && (
                          <span className="mt-2 inline-block rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                            {referral.status}
                          </span>
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
              <p className="text-sm text-gray-600">No referrals yet. Share your link to invite donors.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DonorReferrals;
