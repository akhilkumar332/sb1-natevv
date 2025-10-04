/**
 * HospitalAnalyticsDashboard Component
 *
 * Comprehensive analytics dashboard for hospitals
 * Shows inventory, requests, and consumption patterns
 */

import React, { useState, useEffect } from 'react';
import { Package, CheckCircle, Clock, TrendingDown } from 'lucide-react';
import { StatsCard } from './StatsCard';
import { LineChart } from './LineChart';
import { PieChart } from './PieChart';
import { BarChart } from './BarChart';
import { DateRangeFilter } from './DateRangeFilter';
import { ExportButton } from './ExportButton';
import {
  getHospitalStats,
  getBloodRequestTrend,
  getInventoryDistribution,
  type HospitalStats,
  type TrendData,
  type BloodTypeDistribution,
} from '../../services/analytics.service';

interface HospitalAnalyticsDashboardProps {
  hospitalId: string;
}

/**
 * HospitalAnalyticsDashboard Component
 */
export const HospitalAnalyticsDashboard: React.FC<HospitalAnalyticsDashboardProps> = ({
  hospitalId,
}) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<HospitalStats | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [inventoryData, setInventoryData] = useState<BloodTypeDistribution[]>([]);
  const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });

  // Initialize date range (last 30 days)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    setDateRange({ start, end });
  }, []);

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);

        // Load hospital stats
        const hospitalStats = await getHospitalStats(hospitalId);
        setStats(hospitalStats);

        // Load blood request trend
        const trend = await getBloodRequestTrend(hospitalId, {
          startDate: dateRange.start,
          endDate: dateRange.end,
        });
        setTrendData(trend);

        // Load inventory distribution
        const inventory = await getInventoryDistribution(hospitalId);
        setInventoryData(inventory);
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    if (hospitalId) {
      loadAnalytics();
    }
  }, [hospitalId, dateRange]);

  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange({ start, end });
  };

  // Prepare export data
  const exportData = stats
    ? [
        {
          metric: 'Total Requests',
          value: stats.totalRequests,
        },
        {
          metric: 'Fulfilled Requests',
          value: stats.fulfilledRequests,
        },
        {
          metric: 'Fulfillment Rate',
          value: `${stats.fulfillmentRate.toFixed(1)}%`,
        },
        {
          metric: 'Total Units Received',
          value: stats.totalUnitsReceived,
        },
        {
          metric: 'Average Response Time (hours)',
          value: stats.averageResponseTime.toFixed(1),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hospital Analytics</h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor blood requests and inventory
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename={`hospital-analytics-${hospitalId}`}
          headers={['metric', 'value']}
        />
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter
        onRangeChange={handleDateRangeChange}
        defaultRange="month"
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Requests"
          value={stats?.totalRequests || 0}
          subtitle="All time"
          icon={Package}
          iconColor="text-blue-600"
          loading={loading}
        />

        <StatsCard
          title="Fulfilled Requests"
          value={stats?.fulfilledRequests || 0}
          subtitle={`${stats?.fulfillmentRate.toFixed(1) || 0}% fulfillment`}
          icon={CheckCircle}
          iconColor="text-green-600"
          trend={
            stats && stats.fulfillmentRate > 80
              ? { value: stats.fulfillmentRate, isPositive: true }
              : stats && stats.fulfillmentRate < 60
              ? { value: stats.fulfillmentRate, isPositive: false }
              : undefined
          }
          loading={loading}
        />

        <StatsCard
          title="Units Received"
          value={stats?.totalUnitsReceived || 0}
          subtitle="Total units"
          icon={TrendingDown}
          iconColor="text-purple-600"
          loading={loading}
        />

        <StatsCard
          title="Avg Response Time"
          value={`${stats?.averageResponseTime.toFixed(1) || 0}h`}
          subtitle="Average hours"
          icon={Clock}
          iconColor="text-orange-600"
          trend={
            stats && stats.averageResponseTime < 12
              ? { value: stats.averageResponseTime, isPositive: true }
              : stats && stats.averageResponseTime > 24
              ? { value: stats.averageResponseTime, isPositive: false }
              : undefined
          }
          loading={loading}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blood Request Trend */}
        <LineChart
          data={trendData}
          title="Blood Request Trend"
          color="#2563EB"
        />

        {/* Inventory Distribution */}
        <PieChart
          data={inventoryData.map((d) => ({
            label: d.bloodType,
            value: d.count,
            color: d.color,
          }))}
          title="Inventory Distribution by Blood Type"
        />
      </div>

      {/* Inventory Breakdown */}
      {inventoryData.length > 0 && (
        <BarChart
          data={inventoryData.map((d) => ({
            label: d.bloodType,
            value: d.count,
          }))}
          title="Inventory by Blood Type"
          color="#2563EB"
          height={250}
          horizontal={true}
        />
      )}

      {/* Performance Summary */}
      {stats && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Performance Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Fulfillment Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.fulfillmentRate.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">
                {stats.fulfilledRequests} of {stats.totalRequests} fulfilled
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Average Response</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.averageResponseTime.toFixed(1)}h
              </p>
              <p className="text-xs text-gray-500">hours to fulfill</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Units</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.totalUnitsReceived}
              </p>
              <p className="text-xs text-gray-500">units received</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalAnalyticsDashboard;
