/**
 * AdminAnalyticsDashboard Component
 *
 * Platform-wide analytics dashboard for administrators
 * Shows platform metrics, growth trends, and geographic distribution
 */

import React, { useState, useEffect } from 'react';
import { Users, Droplet, Building2, TrendingUp } from 'lucide-react';
import { StatsCard } from './StatsCard';
import { LineChart } from './LineChart';
import { PieChart } from './PieChart';
import { BarChart } from './BarChart';
import { DateRangeFilter } from './DateRangeFilter';
import { ExportButton } from './ExportButton';
import {
  getPlatformStats,
  getUserGrowthTrend,
  getBloodTypeDistribution,
  getGeographicDistribution,
  type PlatformStats,
  type TrendData,
  type BloodTypeDistribution,
  type GeographicDistribution,
} from '../../services/analytics.service';

/**
 * AdminAnalyticsDashboard Component
 */
export const AdminAnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [growthData, setGrowthData] = useState<TrendData[]>([]);
  const [bloodTypeData, setBloodTypeData] = useState<BloodTypeDistribution[]>([]);
  const [geoData, setGeoData] = useState<GeographicDistribution[]>([]);
  const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });

  // Initialize date range (last year)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 1);
    setDateRange({ start, end });
  }, []);

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);

        // Load platform stats
        const platformStats = await getPlatformStats();
        setStats(platformStats);

        // Load user growth trend
        const growth = await getUserGrowthTrend({
          startDate: dateRange.start,
          endDate: dateRange.end,
        });
        setGrowthData(growth);

        // Load blood type distribution
        const bloodTypes = await getBloodTypeDistribution();
        setBloodTypeData(bloodTypes);

        // Load geographic distribution
        const geo = await getGeographicDistribution();
        setGeoData(geo.slice(0, 10)); // Top 10 locations
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [dateRange]);

  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange({ start, end });
  };

  // Prepare export data
  const exportData = stats
    ? [
        {
          metric: 'Total Users',
          value: stats.totalUsers,
        },
        {
          metric: 'Total Donors',
          value: stats.totalDonors,
        },
        {
          metric: 'Total BloodBanks',
          value: stats.totalHospitals,
        },
        {
          metric: 'Total NGOs',
          value: stats.totalNGOs,
        },
        {
          metric: 'Total Donations',
          value: stats.totalDonations,
        },
        {
          metric: 'Total Blood Requests',
          value: stats.totalBloodRequests,
        },
        {
          metric: 'Total Campaigns',
          value: stats.totalCampaigns,
        },
        {
          metric: 'Active Donors',
          value: stats.activeDonors,
        },
        {
          metric: 'Verified Users',
          value: stats.verifiedUsers,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor platform-wide metrics and growth
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename="platform-analytics"
          headers={['metric', 'value']}
        />
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter
        onRangeChange={handleDateRangeChange}
        defaultRange="year"
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          subtitle={`${stats?.verifiedUsers || 0} verified`}
          icon={Users}
          iconColor="text-blue-600"
          loading={loading}
        />

        <StatsCard
          title="Active Donors"
          value={stats?.activeDonors || 0}
          subtitle={`${stats?.totalDonors || 0} total donors`}
          icon={Droplet}
          iconColor="text-red-600"
          trend={
            stats && stats.activeDonors > 0
              ? {
                  value: Math.round((stats.activeDonors / stats.totalDonors) * 100),
                  isPositive: true,
                }
              : undefined
          }
          loading={loading}
        />

        <StatsCard
          title="BloodBanks"
          value={stats?.totalHospitals || 0}
          subtitle="Registered bloodbanks"
          icon={Building2}
          iconColor="text-green-600"
          loading={loading}
        />

        <StatsCard
          title="Total Donations"
          value={stats?.totalDonations || 0}
          subtitle="All time"
          icon={TrendingUp}
          iconColor="text-purple-600"
          loading={loading}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">Blood Requests</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.totalBloodRequests || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">Active Campaigns</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.totalCampaigns || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">NGOs</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.totalNGOs || 0}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Trend */}
        <LineChart
          data={growthData}
          title="User Growth Trend"
          color="#2563EB"
        />

        {/* Blood Type Distribution */}
        <PieChart
          data={bloodTypeData.map((d) => ({
            label: d.bloodType,
            value: d.count,
            color: d.color,
          }))}
          title="Blood Type Distribution"
        />
      </div>

      {/* Geographic Distribution */}
      {geoData.length > 0 && (
        <BarChart
          data={geoData.map((d) => ({
            label: d.location,
            value: d.totalUsers,
          }))}
          title="Top 10 Locations by Users"
          color="#16A34A"
          height={300}
          horizontal={true}
        />
      )}

      {/* Platform Summary */}
      {stats && (
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Platform Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.totalUsers}
              </p>
              <p className="text-xs text-gray-500">
                {((stats.verifiedUsers / stats.totalUsers) * 100).toFixed(1)}% verified
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Donor Engagement</p>
              <p className="text-2xl font-bold text-purple-600">
                {((stats.activeDonors / stats.totalDonors) * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">
                {stats.activeDonors} active of {stats.totalDonors}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Donations</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.totalDonations}
              </p>
              <p className="text-xs text-gray-500">all time donations</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Healthcare Network</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.totalHospitals + stats.totalNGOs}
              </p>
              <p className="text-xs text-gray-500">
                {stats.totalHospitals} bloodbanks, {stats.totalNGOs} NGOs
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Geographic Breakdown */}
      {geoData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Geographic Distribution Details
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-600">
                    Location
                  </th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-gray-600">
                    Total Users
                  </th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-gray-600">
                    Donors
                  </th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-gray-600">
                    BloodBanks
                  </th>
                </tr>
              </thead>
              <tbody>
                {geoData.map((location, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 px-4 text-sm text-gray-900">
                      {location.location}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-900 text-right">
                      {location.totalUsers}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-900 text-right">
                      {location.donors}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-900 text-right">
                      {location.hospitals}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnalyticsDashboard;
