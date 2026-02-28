import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Bell, Droplet, Shield, Users } from 'lucide-react';
import { useAdminOverviewData } from '../../../hooks/admin/useAdminQueries';
import { AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';

function AdminOverviewPage() {
  const {
    users,
    verificationRequests,
    emergencyRequests,
    systemAlerts,
    stats,
    recentActivity,
    loading,
    error,
    refreshData,
  } = useAdminOverviewData();

  return (
    <div className="space-y-6">
      <AdminRefreshingBanner show={loading} message="Refreshing overview data..." />
      <AdminErrorCard message={error} onRetry={refreshData} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Users className="h-6 w-6 text-red-600" />
            <span className="text-xs font-semibold text-red-700">All roles</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
          <p className="text-sm text-gray-500">Total Users</p>
        </div>

        <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Droplet className="h-6 w-6 text-red-600" />
            <span className="text-xs font-semibold text-red-700">Live</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-gray-900">{stats.totalBloodUnits}</p>
          <p className="text-sm text-gray-500">Blood Units Collected</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">Attention</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-gray-900">{verificationRequests.filter((v) => v.status === 'pending').length}</p>
          <p className="text-sm text-gray-500">Pending Verifications</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Activity className="h-6 w-6 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">Active</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-gray-900">{emergencyRequests.length}</p>
          <p className="text-sm text-gray-500">Emergency Requests</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Recent Platform Activity</h2>
            <Link to="/admin/dashboard/analytics-reports" className="text-sm font-semibold text-red-700 hover:text-red-800">
              View analytics
            </Link>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Donations</p>
              <div className="mt-2 space-y-2">
                {recentActivity.donations.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <span className="font-semibold">{entry.donorName}</span> donated {entry.units} units ({entry.bloodType})
                  </div>
                ))}
                {recentActivity.donations.length === 0 && <p className="text-sm text-gray-500">No recent donations.</p>}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Requests</p>
              <div className="mt-2 space-y-2">
                {recentActivity.requests.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <span className="font-semibold">{entry.hospitalName}</span> requested {entry.units} units ({entry.bloodType})
                  </div>
                ))}
                {recentActivity.requests.length === 0 && <p className="text-sm text-gray-500">No recent requests.</p>}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Campaigns</p>
              <div className="mt-2 space-y-2">
                {recentActivity.campaigns.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <span className="font-semibold">{entry.title}</span> by {entry.organizer || 'Unknown'}
                  </div>
                ))}
                {recentActivity.campaigns.length === 0 && <p className="text-sm text-gray-500">No recent campaigns.</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-bold text-gray-900">System Alerts</h3>
            </div>
            <div className="space-y-2">
              {systemAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {alert.message}
                </div>
              ))}
              {systemAlerts.length === 0 && <p className="text-sm text-gray-500">No active system alerts.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-bold text-gray-900">Role Split</h3>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <p className="flex items-center justify-between"><span>Donors</span><span className="font-semibold">{stats.totalDonors}</span></p>
              <p className="flex items-center justify-between"><span>BloodBanks</span><span className="font-semibold">{stats.totalHospitals}</span></p>
              <p className="flex items-center justify-between"><span>NGOs</span><span className="font-semibold">{stats.totalNGOs}</span></p>
              <p className="flex items-center justify-between"><span>Admins</span><span className="font-semibold">{users.filter((u) => u.role === 'admin' || u.role === 'superadmin').length}</span></p>
            </div>
          </div>

          <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
            <div className="mt-3 grid gap-2">
              <Link to="/admin/dashboard/verification" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Review Verification Queue</Link>
              <Link to="/admin/dashboard/emergency-requests" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Review Emergency Requests</Link>
              <Link to="/admin/dashboard/users" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">Manage Users</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminOverviewPage;
