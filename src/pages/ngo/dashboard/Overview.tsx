import { Link, useOutletContext } from 'react-router-dom';
import {
  Calendar,
  ChevronRight,
  Handshake,
  Heart,
  MapPin,
  Plus,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { NgoDashboardContext } from '../NgoDashboard';
import { getCampaignTargetLabel, getCampaignTypeLabel } from '../../../utils/campaignLabels';

const formatDateRange = (start: Date, end: Date) => {
  const startText = start.toLocaleDateString();
  const endText = end.toLocaleDateString();
  return `${startText} • ${endText}`;
};

function NgoOverview() {
  const {
    stats,
    campaigns,
    partnerships,
    volunteers,
    donorCommunity,
    getStatusColor,
    getCampaignTypeIcon,
    referralCount,
    eligibleReferralCount,
    referralSummary,
  } = useOutletContext<NgoDashboardContext>();

  const spotlightCampaigns = campaigns.slice(0, 3);
  const activePartners = partnerships.filter((partner) => partner.status === 'active').length;
  const activeVolunteers = volunteers.filter((volunteer) => volunteer.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100 dark:bg-slate-700 dark:border-red-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
              <Target className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-xs font-semibold text-emerald-600">Active {stats.activeCampaigns}</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.totalCampaigns}</h3>
          <p className="text-sm text-gray-500 mt-1">Total Campaigns</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-amber-100 dark:bg-slate-700 dark:border-amber-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-xs font-semibold text-emerald-600">Active {activeVolunteers}</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.totalVolunteers}</h3>
          <p className="text-sm text-gray-500 mt-1">Volunteers</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100 dark:bg-slate-700 dark:border-red-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
              <Handshake className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-xs font-semibold text-emerald-600">Active {activePartners}</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.totalPartnerships}</h3>
          <p className="text-sm text-gray-500 mt-1">Partnerships</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-amber-100 dark:bg-slate-700 dark:border-amber-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
              <Heart className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-xs font-semibold text-emerald-600">Lives {stats.peopleImpacted}</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.bloodUnitsCollected}</h3>
          <p className="text-sm text-gray-500 mt-1">Blood Units Collected</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="bg-white rounded-2xl shadow-xl p-6 dark:bg-slate-700">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-red-600">Campaign Focus</p>
              <h2 className="text-2xl font-bold text-gray-900">Active campaigns</h2>
            </div>
            <Link
              to="/ngo/dashboard/campaigns"
              className="text-sm font-semibold text-red-600 hover:text-red-700 flex items-center gap-2"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {spotlightCampaigns.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Target className="w-12 h-12 text-red-200 mx-auto mb-3" />
              <p>No campaigns yet. Launch your first drive.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {spotlightCampaigns.map((campaign) => {
                const registeredCount = Array.isArray(campaign.registeredDonors)
                  ? campaign.registeredDonors.length
                  : typeof campaign.registeredDonors === 'number'
                    ? campaign.registeredDonors
                    : 0;
                const achievedValue = Math.max(campaign.achieved || 0, registeredCount);
                const progress = campaign.target > 0 ? Math.min((achievedValue / campaign.target) * 100, 100) : 0;
                const typeLabel = getCampaignTypeLabel(campaign.type);
                const targetLabel = getCampaignTargetLabel(campaign.targetType || 'units');
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
                  <div key={campaign.id} className="rounded-2xl border border-red-100/60 bg-white shadow-sm p-5 dark:bg-slate-700 dark:border-red-200">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
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
                          <h3 className="text-base font-semibold text-gray-900 mt-2">{campaign.title}</h3>
                          <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-amber-500" />
                            {campaign.location}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-red-400" />
                            {formatDateRange(campaign.startDate, campaign.endDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-1">
                        <div className="text-xs text-gray-500">Target</div>
                        <div className="text-base font-semibold text-gray-900">
                          {campaign.target} {targetLabel}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
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
                        <span>
                          {campaign.city || 'City'}
                          {campaign.state ? `, ${campaign.state}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-red-600 to-amber-500 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Donor Community</p>
                <h2 className="text-2xl font-bold">Engagement snapshot</h2>
              </div>
              <Heart className="w-6 h-6" />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-white/15 rounded-xl p-4">
                <p className="text-xs text-white/70">Total donors</p>
                <p className="text-2xl font-bold">{donorCommunity.totalDonors.toLocaleString()}</p>
              </div>
              <div className="bg-white/15 rounded-xl p-4">
                <p className="text-xs text-white/70">Active donors</p>
                <p className="text-2xl font-bold">{donorCommunity.activeDonors.toLocaleString()}</p>
              </div>
              <div className="bg-white/15 rounded-xl p-4">
                <p className="text-xs text-white/70">New this month</p>
                <p className="text-2xl font-bold">{donorCommunity.newThisMonth}</p>
              </div>
              <div className="bg-white/15 rounded-xl p-4">
                <p className="text-xs text-white/70">Retention</p>
                <p className="text-2xl font-bold">{donorCommunity.retentionRate}%</p>
              </div>
            </div>
            <Link
              to="/ngo/dashboard/donors"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/90"
            >
              View donor details
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border border-amber-100 dark:bg-slate-700 dark:border-amber-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-600">Referrals</p>
                <h3 className="text-lg font-bold text-gray-900">Referral snapshot</h3>
              </div>
              <Users className="w-5 h-5 text-amber-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
                <p className="text-xs text-gray-500">Registered</p>
                <p className="text-xl font-bold text-gray-900">{referralSummary?.registered || 0}</p>
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3">
                <p className="text-xs text-gray-500">Eligible</p>
                <p className="text-xl font-bold text-gray-900">{eligibleReferralCount}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>{referralCount} total referrals</span>
              <Link to="/ngo/dashboard/referrals" className="inline-flex items-center gap-1 font-semibold text-amber-600 hover:text-amber-700">
                View details
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="bg-white rounded-2xl shadow-xl p-6 dark:bg-slate-700">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-600">Momentum</p>
              <h2 className="text-2xl font-bold text-gray-900">Impact highlights</h2>
            </div>
            <TrendingUp className="w-6 h-6 text-amber-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-amber-100 rounded-2xl p-4">
              <p className="text-xs text-gray-500">Funds raised</p>
              <p className="text-2xl font-bold text-gray-900">₹{stats.fundsRaised.toLocaleString()}</p>
              <p className="text-xs text-amber-600 mt-1">Driven by fundraising campaigns</p>
            </div>
            <div className="border border-red-100 rounded-2xl p-4">
              <p className="text-xs text-gray-500">Lives impacted</p>
              <p className="text-2xl font-bold text-gray-900">{stats.peopleImpacted.toLocaleString()}</p>
              <p className="text-xs text-red-600 mt-1">Based on units collected</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Quick actions</h3>
            <Plus className="w-5 h-5 text-red-500" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Link
              to="/ngo/dashboard/campaigns"
              className="flex items-center justify-between rounded-xl border border-red-100 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-red-50"
            >
              Create campaign
              <ChevronRight className="w-4 h-4 text-red-500" />
            </Link>
            <Link
              to="/ngo/dashboard/volunteers"
              className="flex items-center justify-between rounded-xl border border-amber-100 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-amber-50"
            >
              Add volunteers
              <ChevronRight className="w-4 h-4 text-amber-500" />
            </Link>
            <Link
              to="/ngo/dashboard/partnerships"
              className="flex items-center justify-between rounded-xl border border-red-100 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-red-50"
            >
              Manage partners
              <ChevronRight className="w-4 h-4 text-red-500" />
            </Link>
            <Link
              to="/ngo/dashboard/analytics"
              className="flex items-center justify-between rounded-xl border border-amber-100 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-amber-50"
            >
              Review analytics
              <ChevronRight className="w-4 h-4 text-amber-500" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NgoOverview;
