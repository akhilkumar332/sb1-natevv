// src/pages/hospital/HospitalDashboard.tsx
import {
  User as LucideUser,
  Droplet,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  MapPin,
  Phone,
  Mail,
  Activity,
  Package,
  RefreshCw,
  Plus,
  Send,
  Search,
  BarChart3,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useHospitalData } from '../../hooks/useHospitalData';
import BhIdBanner from '../../components/BhIdBanner';

function HospitalDashboard() {
  const { user } = useAuth();

  // Fetch real hospital data from Firestore
  const {
    inventory,
    bloodRequests,
    appointments,
    stats,
    loading,
    error,
    refreshData,
  } = useHospitalData(user?.uid || '');

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading hospital dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
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

  // Filter active requests and today's appointments
  const activeRequests = bloodRequests.filter(r => r.status === 'active' || r.status === 'partially_fulfilled');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayAppointments = appointments.filter(appt => {
    const apptDate = new Date(appt.scheduledDate);
    return apptDate >= today && apptDate < tomorrow && (appt.status === 'scheduled' || appt.status === 'confirmed');
  });

  const getStatusBorder = (status: string) => {
    switch (status) {
      case 'critical': return 'border-red-300 bg-red-50';
      case 'low': return 'border-orange-300 bg-orange-50';
      case 'adequate': return 'border-green-300 bg-green-50';
      case 'surplus': return 'border-blue-300 bg-blue-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white flex items-center justify-center">
                <Activity className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{user?.displayName || 'Hospital'} Blood Bank</h1>
                <p className="text-white/80 flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {user?.city || 'Location'}
                </p>
                {user?.bhId && (
                  <p className="text-white/80 text-sm mt-1">BH ID: {user.bhId}</p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={refreshData}
                className="px-4 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl flex items-center space-x-2 backdrop-blur-sm border border-white/30"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Refresh</span>
              </button>
              <button className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition-all duration-300 shadow-lg hover:shadow-xl flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5" />
                <span>Create Emergency Request</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-6">
        <BhIdBanner />
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Critical Alerts */}
        {(stats.criticalTypes > 0 || stats.lowTypes > 0) && (
          <div className="mb-8 p-6 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-red-500 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800 mb-2">Blood Inventory Alert</h3>
                <p className="text-gray-700">
                  {stats.criticalTypes > 0 && (
                    <span className="font-semibold text-red-600">
                      {stats.criticalTypes} blood type{stats.criticalTypes > 1 ? 's' : ''} at critical level.{' '}
                    </span>
                  )}
                  {stats.lowTypes > 0 && (
                    <span className="font-semibold text-orange-600">
                      {stats.lowTypes} blood type{stats.lowTypes > 1 ? 's' : ''} running low.{' '}
                    </span>
                  )}
                  Consider creating emergency requests to donors.
                </p>
              </div>
              <button className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-300 font-semibold">
                Broadcast Request
              </button>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Blood Units */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Package className="w-8 h-8" />
              </div>
              <TrendingUp className="w-6 h-6 text-white/60" />
            </div>
            <h3 className="text-white/80 text-sm font-medium mb-1">Total Blood Units</h3>
            <p className="text-4xl font-bold mb-2">{stats.totalInventory}</p>
            <p className="text-white/70 text-xs">Across all blood types</p>
          </div>

          {/* Critical Stock */}
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <AlertCircle className="w-8 h-8" />
              </div>
              <AlertTriangle className="w-6 h-6 text-white/60" />
            </div>
            <h3 className="text-white/80 text-sm font-medium mb-1">Critical Stock</h3>
            <p className="text-4xl font-bold mb-2">{stats.criticalTypes + stats.lowTypes}</p>
            <p className="text-white/70 text-xs">Blood types need restocking</p>
          </div>

          {/* Expiring Soon */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Clock className="w-8 h-8" />
              </div>
              <RefreshCw className="w-6 h-6 text-white/60" />
            </div>
            <h3 className="text-white/80 text-sm font-medium mb-1">Expiring in 7 Days</h3>
            <p className="text-4xl font-bold mb-2">{stats.expiringIn7Days}</p>
            <p className="text-white/70 text-xs">Units require urgent use</p>
          </div>

          {/* Active Requests */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Send className="w-8 h-8" />
              </div>
              <Activity className="w-6 h-6 text-white/60" />
            </div>
            <h3 className="text-white/80 text-sm font-medium mb-1">Active Requests</h3>
            <p className="text-4xl font-bold mb-2">{stats.activeRequests}</p>
            <p className="text-white/70 text-xs">Emergency blood requests</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Inventory */}
          <div className="lg:col-span-2 space-y-8">
            {/* Blood Inventory */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <Droplet className="w-6 h-6 mr-2 text-blue-500" />
                  Blood Inventory
                </h2>
                <div className="flex space-x-2">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 font-semibold flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Add Stock</span>
                  </button>
                  <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-300">
                    <RefreshCw className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {inventory.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Inventory Data</h3>
                    <p className="text-gray-600">Blood inventory will appear here once initialized.</p>
                  </div>
                ) : (
                  inventory.map((item) => {
                    // Calculate expiring units in 7 days
                    const now = new Date();
                    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    const expiringIn7Days = item.batches
                      .filter(batch => batch.status === 'available' && batch.expiryDate <= sevenDaysFromNow)
                      .reduce((sum, batch) => sum + batch.units, 0);

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border-2 ${getStatusBorder(item.status)} hover:shadow-lg transition-all duration-300`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl font-bold text-gray-800">{item.bloodType}</span>
                          <div className={`w-3 h-3 rounded-full ${
                            item.status === 'critical' ? 'bg-red-500 animate-pulse' :
                            item.status === 'low' ? 'bg-orange-500' :
                            item.status === 'adequate' ? 'bg-green-500' :
                            'bg-blue-500'
                          }`}></div>
                        </div>
                        <p className="text-3xl font-bold text-gray-800 mb-2">{item.units}</p>
                        <p className="text-xs text-gray-600 mb-1">Units Available</p>
                        {expiringIn7Days > 0 && (
                          <p className="text-xs text-orange-600 font-semibold">
                            {expiringIn7Days} expiring soon
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Emergency Requests */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <AlertTriangle className="w-6 h-6 mr-2 text-red-500" />
                  Emergency Requests
                </h2>
                <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-semibold">
                  {activeRequests.length} Active
                </span>
              </div>

              <div className="space-y-4">
                {activeRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Requests</h3>
                    <p className="text-gray-600">Emergency blood requests will appear here.</p>
                  </div>
                ) : (
                  activeRequests.map((request) => (
                  <div
                    key={request.id}
                    className={`p-4 rounded-xl border-2 ${
                      request.urgency === 'critical'
                        ? 'border-red-300 bg-red-50'
                        : request.urgency === 'high'
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-yellow-300 bg-yellow-50'
                    } hover:shadow-lg transition-all duration-300`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`p-2 rounded-lg ${
                            request.urgency === 'critical' ? 'bg-red-500' :
                            request.urgency === 'high' ? 'bg-orange-500' :
                            'bg-yellow-500'
                          }`}>
                            <Droplet className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-800">
                              {request.bloodType} - {request.units} Units
                            </h3>
                            <p className="text-sm text-gray-600">
                              {request.department} • {request.patientName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-600">
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {request.requestedAt.toLocaleTimeString()}
                          </span>
                          {request.respondedDonors && request.respondedDonors.length > 0 && (
                            <span className="flex items-center text-green-600 font-semibold">
                              <Users className="w-3 h-3 mr-1" />
                              {request.respondedDonors.length} donors responded
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <button className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-all duration-300 font-semibold">
                          <CheckCircle className="w-4 h-4 inline mr-1" />
                          Fulfill
                        </button>
                        <button className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-all duration-300 font-semibold">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                  ))
                )}
              </div>

              <button className="w-full mt-4 py-3 text-blue-600 font-semibold hover:bg-blue-50 rounded-xl transition-all duration-300">
                View All Requests →
              </button>
            </div>

            {/* Appointments */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <Calendar className="w-6 h-6 mr-2 text-purple-500" />
                  Upcoming Appointments
                </h2>
                <button className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all duration-300 font-semibold flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Schedule</span>
                </button>
              </div>

              <div className="space-y-3">
                {todayAppointments.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Appointments Today</h3>
                    <p className="text-gray-600">Scheduled appointments will appear here.</p>
                  </div>
                ) : (
                  todayAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-300 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-purple-100 rounded-xl">
                          <LucideUser className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{appointment.donorName}</h3>
                          <p className="text-sm text-gray-600">
                            {appointment.bloodType} • {appointment.scheduledDate.toLocaleString()}
                          </p>
                          {appointment.donorPhone && (
                            <p className="text-xs text-gray-500 flex items-center mt-1">
                              <Phone className="w-3 h-3 mr-1" />
                              {appointment.donorPhone}
                            </p>
                          )}
                        </div>
                      </div>
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-300 font-semibold text-sm">
                        Confirm
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-8">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button className="w-full p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl hover:from-red-100 hover:to-red-200 transition-all duration-300 text-left flex items-center space-x-3 group">
                  <div className="p-2 bg-red-500 rounded-lg group-hover:scale-110 transition-transform">
                    <Send className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Emergency Request</p>
                    <p className="text-xs text-gray-600">Broadcast to donors</p>
                  </div>
                </button>

                <button className="w-full p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-300 text-left flex items-center space-x-3 group">
                  <div className="p-2 bg-blue-500 rounded-lg group-hover:scale-110 transition-transform">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Add Blood Stock</p>
                    <p className="text-xs text-gray-600">Update inventory</p>
                  </div>
                </button>

                <button className="w-full p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-300 text-left flex items-center space-x-3 group">
                  <div className="p-2 bg-purple-500 rounded-lg group-hover:scale-110 transition-transform">
                    <Search className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Search Donors</p>
                    <p className="text-xs text-gray-600">Find by blood type</p>
                  </div>
                </button>

                <button className="w-full p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-300 text-left flex items-center space-x-3 group">
                  <div className="p-2 bg-green-500 rounded-lg group-hover:scale-110 transition-transform">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Schedule Camp</p>
                    <p className="text-xs text-gray-600">Organize donation drive</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Today's Stats */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
                Today's Activity
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Donations Today</span>
                  <span className="font-bold text-gray-800 text-lg">{stats.todayDonations}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="font-bold text-gray-800 text-lg">{stats.totalDonationsThisMonth}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Appointments Today</span>
                  <span className="font-bold text-gray-800 text-lg">{stats.todayAppointments}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Units This Month</span>
                  <span className="font-bold text-green-600 text-lg">{stats.totalUnitsThisMonth}</span>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl shadow-xl p-6 border-2 border-blue-200">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Blood Bank Info</h2>
              <div className="space-y-3">
                <p className="text-sm text-gray-700 flex items-center">
                  <Phone className="w-4 h-4 mr-2 text-blue-600" />
                  {user?.phoneNumber || '+91 XXXXX XXXXX'}
                </p>
                <p className="text-sm text-gray-700 flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-blue-600" />
                  {user?.email || 'hospital@example.com'}
                </p>
                <p className="text-sm text-gray-700 flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-blue-600" />
                  {user?.address || user?.city || 'Hospital Address'}
                </p>
              </div>
              <button className="w-full mt-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all duration-300">
                Update Information
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HospitalDashboard;
