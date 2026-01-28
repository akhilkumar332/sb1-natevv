import { useNavigate, useOutletContext } from 'react-router-dom';
import { AlertCircle, Award, Clock, Droplet, Heart, Share2, Users, Zap } from 'lucide-react';

const DonorOverview = () => {
  const navigate = useNavigate();
  const dashboard = useOutletContext<any>();

  const {
    isLoading,
    stats,
    eligibleToDonate,
    daysUntilEligible,
    profileCompletionPercent,
    missingProfileFields,
    nextMilestone,
    emergencyRequests,
    availabilityActiveUntil,
    availableTodayLoading,
    availableTodayLabel,
    availableTodayHint,
    handleEmergencyRequests,
    handleFindDonors,
    handleInviteFriends,
    handleAvailableToday,
  } = dashboard;

  return (
    <>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-600">Snapshot</p>
        <h2 className="text-xl font-bold text-gray-900">Your Snapshot</h2>
      </div>
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-4">
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

      <div className="grid gap-6 mb-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Profile Strength</h2>
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-4 w-32 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-2 w-full rounded-full bg-gray-100 animate-pulse" />
              <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Completion</span>
                <span className="font-semibold text-gray-900">{profileCompletionPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-red-600 transition-all duration-300"
                  style={{ width: `${profileCompletionPercent}%` }}
                />
              </div>
              {missingProfileFields.length > 0 ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                  <p className="text-xs font-semibold text-red-700">Missing details</p>
                  <p className="text-xs text-red-700/80">
                    {missingProfileFields.slice(0, 3).join(', ')}
                    {missingProfileFields.length > 3 ? '...' : ''}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                  <p className="text-xs font-semibold text-red-700">All set</p>
                  <p className="text-xs text-red-700/80">Your donor profile is complete.</p>
                </div>
              )}
              {missingProfileFields.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/donor/onboarding')}
                  className="w-full py-2 px-4 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all duration-300"
                >
                  Complete Profile
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Momentum</h2>
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Current Streak</p>
                  <p className="text-sm text-gray-600">Keep the rhythm going</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats?.streak || 0} days</p>
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wide text-red-600">Next Milestone</p>
                <p className="text-sm font-semibold text-gray-900">{nextMilestone.label}</p>
                <p className="text-xs text-gray-600">
                  {nextMilestone.remaining === 0
                    ? 'You reached this milestone.'
                    : `${nextMilestone.remaining} more donation${nextMilestone.remaining === 1 ? '' : 's'} to hit ${nextMilestone.target}.`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-10">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <Zap className="w-6 h-6 mr-2 text-red-600" />
            Quick Actions
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
