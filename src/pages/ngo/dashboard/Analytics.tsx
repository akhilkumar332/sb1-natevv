import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { BarChart } from '../../../components/analytics/BarChart';
import { LineChart } from '../../../components/analytics/LineChart';
import { PieChart } from '../../../components/analytics/PieChart';
import type { NgoDashboardContext } from '../NgoDashboard';

function NgoAnalytics() {
  const { campaigns, volunteers, stats, donorCommunity } = useOutletContext<NgoDashboardContext>();

  const campaignStatusData = useMemo(() => {
    const statuses = ['active', 'upcoming', 'completed', 'draft', 'cancelled'];
    return statuses
      .map((status) => ({
        label: status.charAt(0).toUpperCase() + status.slice(1),
        value: campaigns.filter((campaign) => campaign.status === status).length,
      }))
      .filter((item) => item.value > 0);
  }, [campaigns]);

  const campaignTypeData = useMemo(() => {
    const types = [
      { key: 'blood-drive', label: 'Blood Drives' },
      { key: 'awareness', label: 'Awareness' },
      { key: 'fundraising', label: 'Fundraising' },
      { key: 'volunteer', label: 'Volunteer' },
    ];
    return types
      .map((type) => ({
        label: type.label,
        value: campaigns.filter((campaign) => campaign.type === type.key).length,
      }))
      .filter((item) => item.value > 0);
  }, [campaigns]);

  const impactTrendData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }).map((_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return month;
    });

    return months.map((month) => {
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      const value = campaigns
        .filter((campaign) => campaign.startDate >= month && campaign.startDate < nextMonth)
        .reduce((sum, campaign) => {
          const registeredCount = Array.isArray(campaign.registeredDonors)
            ? campaign.registeredDonors.length
            : typeof campaign.registeredDonors === 'number'
              ? campaign.registeredDonors
              : 0;
          const achievedValue = Math.max(campaign.achieved || 0, registeredCount);
          return sum + achievedValue;
        }, 0);
      return {
        label: month.toLocaleString('default', { month: 'short' }),
        value,
      };
    });
  }, [campaigns]);

  const volunteerHoursData = useMemo(() => {
    return [...volunteers]
      .sort((a, b) => b.hoursContributed - a.hoursContributed)
      .slice(0, 5)
      .map((volunteer) => ({
        label: volunteer.name,
        value: volunteer.hoursContributed,
      }));
  }, [volunteers]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">Analytics</p>
            <h2 className="text-2xl font-bold text-gray-900">Performance overview</h2>
            <p className="text-sm text-gray-500 mt-1">Measure campaign outcomes and community impact.</p>
          </div>
          <BarChart3 className="w-8 h-8 text-red-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100">
          <p className="text-xs text-gray-500">Total campaigns</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalCampaigns}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-amber-100">
          <p className="text-xs text-gray-500">Blood units collected</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.bloodUnitsCollected}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100">
          <p className="text-xs text-gray-500">Funds raised</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">₹{stats.fundsRaised.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-amber-100">
          <p className="text-xs text-gray-500">Active donors</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{donorCommunity.activeDonors}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LineChart
          title="Impact trend (units collected)"
          data={impactTrendData}
          color="#DC2626"
          height={240}
        />
        <PieChart
          title="Campaign mix"
          data={campaignTypeData}
          size={220}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BarChart
          title="Campaign status"
          data={campaignStatusData}
          color="#F59E0B"
          height={260}
        />
        <BarChart
          title="Top volunteer hours"
          data={volunteerHoursData}
          color="#DC2626"
          horizontal
          height={220}
        />
      </div>
    </div>
  );
}

export default NgoAnalytics;
