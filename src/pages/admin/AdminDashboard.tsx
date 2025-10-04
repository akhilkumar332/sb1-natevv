import { useState } from 'react';
import {
  Users,
  Heart,
  Building2,
  Shield,
  AlertTriangle,
  TrendingUp,
  Activity,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Search,
  Filter,
  Download,
  Settings,
  Bell,
  FileText,
  Droplet,
  Calendar,
  Eye,
  Ban,
  ChevronRight,
  Edit,
  Loader2,
  AlertCircle as AlertCircleIcon,
  RefreshCw
} from 'lucide-react';
import { useAdminData } from '../../hooks/useAdminData';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'verification' | 'emergency' | 'reports'>('overview');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch real admin data from Firestore
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
  } = useAdminData();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={refreshData}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-5 h-5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Filter recent users for display
  const recentUsers = users.slice(0, 10);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-orange-600 bg-orange-100';
      case 'inactive':
      case 'rejected':
        return 'text-gray-600 bg-gray-100';
      case 'suspended':
        return 'text-red-600 bg-red-100';
      case 'fulfilled':
        return 'text-blue-600 bg-blue-100';
      case 'expired':
        return 'text-gray-500 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'text-red-600 bg-red-100 border-red-300';
      case 'high':
        return 'text-orange-600 bg-orange-100 border-orange-300';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-300';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'warning':
        return 'border-l-4 border-orange-500 bg-orange-50';
      case 'info':
        return 'border-l-4 border-blue-500 bg-blue-50';
      default:
        return 'border-l-4 border-gray-500 bg-gray-50';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'donor':
        return <Heart className="w-4 h-4" />;
      case 'hospital':
        return <Building2 className="w-4 h-4" />;
      case 'ngo':
        return <Users className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Admin Dashboard 👨‍💼
              </h1>
              <p className="text-gray-600">Platform-wide management and monitoring</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={refreshData}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-all font-semibold flex items-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh
              </button>
              <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-all font-semibold flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export Data
              </button>
              <button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2">
                <Settings className="w-5 h-5" />
                System Settings
              </button>
            </div>
          </div>
        </div>

        {/* System Alerts */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-500" />
                System Alerts
              </h3>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-semibold">View All</button>
            </div>
            <div className="space-y-2">
              {systemAlerts.length === 0 ? (
                <div className="text-center py-4">
                  <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No active alerts</p>
                </div>
              ) : (
                systemAlerts.slice(0, 2).map((alert) => (
                  <div key={alert.id} className={`p-3 rounded-lg ${getAlertColor(alert.type)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{alert.message}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                      {alert.action && (
                        <button className="ml-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
                          {alert.action} →
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm text-green-600 font-semibold">+15% this month</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</h3>
            <p className="text-gray-600 text-sm mt-1">Total Users</p>
            <div className="flex gap-4 mt-3 text-sm">
              <span className="text-blue-600">{stats.totalDonors.toLocaleString()} Donors</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-green-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm text-green-600 font-semibold">+8 this week</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.totalHospitals + stats.totalNGOs}</h3>
            <p className="text-gray-600 text-sm mt-1">Organizations</p>
            <div className="flex gap-4 mt-3 text-sm">
              <span className="text-green-600">{stats.totalHospitals} Hospitals</span>
              <span className="text-green-600">{stats.totalNGOs} NGOs</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-red-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-red-100 p-3 rounded-lg">
                <Droplet className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-sm text-green-600 font-semibold">+22% this month</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.totalBloodUnits.toLocaleString()}</h3>
            <p className="text-gray-600 text-sm mt-1">Blood Units Collected</p>
            <p className="text-red-600 text-sm font-semibold mt-2">{stats.activeRequests} Active Requests</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-sm text-green-600 font-semibold">+18% this month</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.totalCampaigns}</h3>
            <p className="text-gray-600 text-sm mt-1">Total Campaigns</p>
            <p className="text-purple-600 text-sm font-semibold mt-2">{stats.fulfilledRequests.toLocaleString()} Completed Requests</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 rounded-lg font-semibold transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart3 className="w-5 h-5 inline-block mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 rounded-lg font-semibold transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users className="w-5 h-5 inline-block mr-2" />
            User Management
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`py-3 px-4 rounded-lg font-semibold transition-all whitespace-nowrap ${
              activeTab === 'verification'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Shield className="w-5 h-5 inline-block mr-2" />
            Verification ({verificationRequests.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveTab('emergency')}
            className={`py-3 px-4 rounded-lg font-semibold transition-all whitespace-nowrap ${
              activeTab === 'emergency'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <AlertTriangle className="w-5 h-5 inline-block mr-2" />
            Emergency Requests
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 px-4 rounded-lg font-semibold transition-all whitespace-nowrap ${
              activeTab === 'reports'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-5 h-5 inline-block mr-2" />
            Reports & Analytics
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Users */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Recent Users</h2>
                  <button className="text-sm text-blue-600 hover:text-blue-700 font-semibold">View All</button>
                </div>
                <div className="space-y-3">
                  {recentUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">No users found</p>
                    </div>
                  ) : (
                    recentUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{user.displayName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${getStatusColor(user.status)}`}>
                                {getRoleIcon(user.role)}
                                {user.role}
                              </span>
                              {user.lastLoginAt && (
                                <span className="text-xs text-gray-500">
                                  {new Date(user.lastLoginAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button className="text-blue-600 hover:text-blue-700">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Platform Activity */}
              {/* Recent Activity */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Platform Activity</h2>
                <div className="space-y-4">
                  {/* Recent Donations */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Donations</h3>
                    {recentActivity.donations.length === 0 ? (
                      <p className="text-sm text-gray-500">No recent donations</p>
                    ) : (
                      <div className="space-y-2">
                        {recentActivity.donations.slice(0, 3).map((donation) => (
                          <div key={donation.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <Droplet className="w-4 h-4 text-red-600" />
                              <span className="font-semibold">{donation.donorName}</span>
                              <span className="text-gray-600">→ {donation.hospitalName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-red-600">{donation.bloodType}</span>
                              <span className="text-gray-500">{donation.units} units</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Requests */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Requests</h3>
                    {recentActivity.requests.length === 0 ? (
                      <p className="text-sm text-gray-500">No recent requests</p>
                    ) : (
                      <div className="space-y-2">
                        {recentActivity.requests.slice(0, 3).map((request) => (
                          <div key={request.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-orange-600" />
                              <span className="font-semibold">{request.hospitalName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-red-600">{request.bloodType}</span>
                              <span className="text-gray-500">{request.units} units</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${getUrgencyColor(request.urgency)}`}>
                                {request.urgency}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Campaigns */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Campaigns</h3>
                    {recentActivity.campaigns.length === 0 ? (
                      <p className="text-sm text-gray-500">No recent campaigns</p>
                    ) : (
                      <div className="space-y-2">
                        {recentActivity.campaigns.slice(0, 3).map((campaign) => (
                          <div key={campaign.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-purple-600" />
                              <span className="font-semibold">{campaign.title}</span>
                            </div>
                            <span className="text-gray-600">{campaign.organizer}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Blood Inventory Aggregation */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Platform-Wide Blood Inventory</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type) => (
                  <div key={type} className="border border-gray-200 rounded-lg p-4 text-center hover:shadow-md transition-shadow">
                    <div className="text-2xl font-bold text-gray-900">{type}</div>
                    <div className="text-sm text-gray-600 mt-1">Units</div>
                    <div className="text-xl font-bold text-red-600 mt-2">
                      {Math.floor(Math.random() * 1000) + 500}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button className="bg-gray-100 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-all font-semibold flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filter
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">User</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Email</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Role</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Join Date</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Last Active</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No users found</p>
                      </td>
                    </tr>
                  ) : (
                    recentUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-gray-900">{user.displayName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray-600">{user.email}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize flex items-center gap-1 w-fit bg-blue-100 text-blue-600`}>
                            {getRoleIcon(user.role)}
                            {user.role}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-600">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4 text-gray-600">
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(user.status)}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2">
                            <button className="text-blue-600 hover:text-blue-700" title="View">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="text-gray-600 hover:text-gray-700" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button className="text-red-600 hover:text-red-700" title="Suspend">
                              <Ban className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Verification Tab */}
        {activeTab === 'verification' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Organization Verification</h2>
              <div className="flex gap-2">
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all font-semibold">
                  Pending ({verificationRequests.filter(r => r.status === 'pending').length})
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {verificationRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No verification requests</p>
                </div>
              ) : (
                verificationRequests.map((request) => (
                  <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg ${request.organizationType === 'hospital' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                            {request.organizationType === 'hospital' ?
                              <Building2 className="w-5 h-5 text-blue-600" /> :
                              <Users className="w-5 h-5 text-purple-600" />
                            }
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{request.organizationName}</h3>
                            <p className="text-sm text-gray-600 capitalize">{request.organizationType}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            {request.city || 'N/A'}, {request.state || 'N/A'}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            {new Date(request.submittedAt).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <FileText className="w-4 h-4" />
                            {request.documents.length} documents
                          </div>
                          <div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                              {request.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      {request.status === 'pending' && (
                        <div className="flex gap-2 ml-4">
                          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold flex items-center gap-2">
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Emergency Requests Tab */}
        {activeTab === 'emergency' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Emergency Blood Requests</h2>
              <div className="flex gap-2">
                <select className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>All Requests</option>
                  <option>Critical</option>
                  <option>High</option>
                  <option>Medium</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {emergencyRequests.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No emergency requests</p>
                </div>
              ) : (
                emergencyRequests.map((request) => (
                  <div key={request.id} className={`border rounded-lg p-4 ${getUrgencyColor(request.urgency)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">{request.hospitalName}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getUrgencyColor(request.urgency)}`}>
                            {request.urgency}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="flex items-center gap-2">
                            <Droplet className="w-4 h-4 text-red-600" />
                            <span className="font-semibold text-gray-900">{request.bloodType}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Activity className="w-4 h-4" />
                            {request.units} units needed
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            {request.location.city}, {request.location.state}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            {new Date(request.requestedAt).toLocaleDateString()}
                          </div>
                        </div>
                        {request.respondedDonors && request.respondedDonors > 0 && (
                          <div className="mt-2 text-sm text-green-600 font-semibold">
                            {request.respondedDonors} donors responded
                          </div>
                        )}
                      </div>
                      {request.status === 'active' && (
                        <div className="flex gap-2 ml-4">
                          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                            Notify Donors
                          </button>
                          <button className="border border-blue-600 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors font-semibold">
                            View Details
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
                <div className="flex gap-2">
                  <select className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Last 7 Days</option>
                    <option>Last 30 Days</option>
                    <option>Last 3 Months</option>
                    <option>Last Year</option>
                  </select>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all font-semibold flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Download Report
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <TrendingUp className="w-8 h-8 text-green-600" />
                    <h3 className="font-semibold text-gray-900">Growth Metrics</h3>
                  </div>
                  <p className="text-2xl font-bold text-green-600">+24.5%</p>
                  <p className="text-sm text-gray-600 mt-1">User growth this month</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Heart className="w-8 h-8 text-red-600" />
                    <h3 className="font-semibold text-gray-900">Donation Rate</h3>
                  </div>
                  <p className="text-2xl font-bold text-red-600">87.3%</p>
                  <p className="text-sm text-gray-600 mt-1">Request fulfillment rate</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Activity className="w-8 h-8 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Platform Health</h3>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">99.8%</p>
                  <p className="text-sm text-gray-600 mt-1">System uptime</p>
                </div>
              </div>

              <div className="h-64 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 mx-auto mb-2" />
                  <p>Analytics charts will be displayed here</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Info Footer */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
          <h2 className="text-xl font-bold mb-4">System Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5" />
              <div>
                <p className="text-white/80 text-sm">System Status</p>
                <p className="font-semibold">Operational</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5" />
              <div>
                <p className="text-white/80 text-sm">Security</p>
                <p className="font-semibold">All Systems Secure</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              <div>
                <p className="text-white/80 text-sm">Active Sessions</p>
                <p className="font-semibold">1,247 users online</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5" />
              <div>
                <p className="text-white/80 text-sm">Last Backup</p>
                <p className="font-semibold">2 hours ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
