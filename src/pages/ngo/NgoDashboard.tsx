import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNgoData } from '../../hooks/useNgoData';
import {
  Heart,
  Users,
  Calendar,
  TrendingUp,
  Award,
  UserPlus,
  MapPin,
  Phone,
  Mail,
  Globe,
  Target,
  DollarSign,
  Megaphone,
  Handshake,
  BarChart3,
  ChevronRight,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

function NgoDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'campaigns' | 'volunteers' | 'partnerships' | 'donors'>('campaigns');

  // Fetch real NGO data from Firestore
  const {
    campaigns,
    volunteers,
    partnerships,
    donorCommunity,
    stats,
    loading,
    error,
    refreshData,
  } = useNgoData(user?.uid || '');

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading NGO dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={refreshData}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-5 h-5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'upcoming':
        return 'text-blue-600 bg-blue-100';
      case 'completed':
        return 'text-gray-600 bg-gray-100';
      case 'pending':
        return 'text-orange-600 bg-orange-100';
      case 'draft':
        return 'text-yellow-600 bg-yellow-100';
      case 'inactive':
        return 'text-gray-500 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getCampaignTypeIcon = (type: string) => {
    switch (type) {
      case 'blood-drive':
        return <Heart className="w-4 h-4" />;
      case 'awareness':
        return <Megaphone className="w-4 h-4" />;
      case 'fundraising':
        return <DollarSign className="w-4 h-4" />;
      case 'volunteer':
        return <UserPlus className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getPartnershipIcon = (type: string) => {
    switch (type) {
      case 'hospital':
        return <Heart className="w-5 h-5" />;
      case 'corporate':
        return <Globe className="w-5 h-5" />;
      case 'community':
        return <Users className="w-5 h-5" />;
      default:
        return <Handshake className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Welcome back, <span className="text-purple-600">{user?.displayName || 'NGO Admin'}</span>! 👋
              </h1>
              <p className="text-gray-600">Manage your campaigns, volunteers, and partnerships</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={refreshData}
                className="bg-white text-purple-600 px-4 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 border border-purple-200"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh
              </button>
              <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2">
                <Plus className="w-5 h-5" />
                New Campaign
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-sm text-green-600 font-semibold">+12% this month</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.totalCampaigns}</h3>
            <p className="text-gray-600 text-sm mt-1">Total Campaigns</p>
            <p className="text-purple-600 text-sm font-semibold mt-2">{stats.activeCampaigns} Active</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-pink-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-pink-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-pink-600" />
              </div>
              <span className="text-sm text-green-600 font-semibold">+8% this month</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.totalVolunteers}</h3>
            <p className="text-gray-600 text-sm mt-1">Total Volunteers</p>
            <p className="text-pink-600 text-sm font-semibold mt-2">{stats.activeVolunteers} Active</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-rose-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-rose-100 p-3 rounded-lg">
                <Heart className="w-6 h-6 text-rose-600" />
              </div>
              <span className="text-sm text-green-600 font-semibold">+18% this quarter</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.bloodUnitsCollected}</h3>
            <p className="text-gray-600 text-sm mt-1">Blood Units Collected</p>
            <p className="text-rose-600 text-sm font-semibold mt-2">{stats.peopleImpacted} Lives Saved</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-indigo-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-indigo-600" />
              </div>
              <span className="text-sm text-green-600 font-semibold">+25% this year</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">₹{(stats.fundsRaised / 1000).toFixed(0)}K</h3>
            <p className="text-gray-600 text-sm mt-1">Funds Raised</p>
            <p className="text-indigo-600 text-sm font-semibold mt-2">{stats.totalPartnerships} Partners</p>
          </div>
        </div>

        {/* Donor Community Overview */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 mb-8 text-white shadow-xl">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Donor Community
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Total Donors</p>
              <p className="text-3xl font-bold">{donorCommunity.totalDonors.toLocaleString()}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Active Donors</p>
              <p className="text-3xl font-bold">{donorCommunity.activeDonors.toLocaleString()}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">New This Month</p>
              <p className="text-3xl font-bold">{donorCommunity.newThisMonth}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 text-sm mb-1">Retention Rate</p>
              <p className="text-3xl font-bold">{donorCommunity.retentionRate}%</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === 'campaigns'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Target className="w-5 h-5 inline-block mr-2" />
            Campaigns
          </button>
          <button
            onClick={() => setActiveTab('volunteers')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === 'volunteers'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <UserPlus className="w-5 h-5 inline-block mr-2" />
            Volunteers
          </button>
          <button
            onClick={() => setActiveTab('partnerships')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === 'partnerships'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Handshake className="w-5 h-5 inline-block mr-2" />
            Partnerships
          </button>
          <button
            onClick={() => setActiveTab('donors')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === 'donors'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart3 className="w-5 h-5 inline-block mr-2" />
            Analytics
          </button>
        </div>

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Active Campaigns</h2>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search campaigns..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {campaigns.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Campaigns Yet</h3>
                  <p className="text-gray-600 mb-6">Start creating campaigns to make an impact!</p>
                  <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all inline-flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Create First Campaign
                  </button>
                </div>
              ) : (
                campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        {getCampaignTypeIcon(campaign.type)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{campaign.title}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {campaign.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {campaign.startDate.toLocaleDateString()} - {campaign.endDate.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(campaign.status)}`}>
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-semibold text-gray-900">
                        {campaign.achieved} / {campaign.target} {campaign.type === 'blood-drive' ? 'units' : campaign.type === 'fundraising' ? '₹' : 'people'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full transition-all"
                        style={{ width: `${(campaign.achieved / campaign.target) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {((campaign.achieved / campaign.target) * 100).toFixed(1)}% completed
                    </p>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-semibold">
                      View Details
                    </button>
                    <button className="flex-1 border border-purple-600 text-purple-600 py-2 px-4 rounded-lg hover:bg-purple-50 transition-colors font-semibold">
                      Edit Campaign
                    </button>
                  </div>
                </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Volunteers Tab */}
        {activeTab === 'volunteers' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Volunteer Team</h2>
              <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-semibold flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Add Volunteer
              </button>
            </div>

            {volunteers.length === 0 ? (
              <div className="text-center py-12">
                <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Volunteers Yet</h3>
                <p className="text-gray-600 mb-6">Build your volunteer team to support your campaigns!</p>
                <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all inline-flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Add First Volunteer
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-gray-600 font-semibold">Name</th>
                      <th className="text-left py-3 px-4 text-gray-600 font-semibold">Role</th>
                      <th className="text-left py-3 px-4 text-gray-600 font-semibold">Join Date</th>
                      <th className="text-left py-3 px-4 text-gray-600 font-semibold">Hours Contributed</th>
                      <th className="text-left py-3 px-4 text-gray-600 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 text-gray-600 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volunteers.map((volunteer) => (
                    <tr key={volunteer.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {volunteer.name.charAt(0)}
                          </div>
                          <span className="font-semibold text-gray-900">{volunteer.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-600">{volunteer.role}</td>
                      <td className="py-4 px-4 text-gray-600">{volunteer.joinDate.toLocaleDateString()}</td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-purple-600">{volunteer.hoursContributed} hrs</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(volunteer.status)}`}>
                          {volunteer.status.charAt(0).toUpperCase() + volunteer.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <button className="text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1">
                          View
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Partnerships Tab */}
        {activeTab === 'partnerships' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Partner Organizations</h2>
              <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Partner
              </button>
            </div>

            {partnerships.length === 0 ? (
              <div className="text-center py-12">
                <Handshake className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Partnerships Yet</h3>
                <p className="text-gray-600 mb-6">Connect with hospitals, corporates, and communities!</p>
                <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all inline-flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add First Partner
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {partnerships.map((partner) => (
                <div
                  key={partner.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                        {getPartnershipIcon(partner.type)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{partner.organization}</h3>
                        <p className="text-sm text-gray-600 capitalize">{partner.type}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(partner.status)}`}>
                      {partner.status}
                    </span>
                  </div>

                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Partner Since</span>
                      <span className="font-semibold text-gray-900">{partner.since.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Donations</span>
                      <span className="font-semibold text-purple-600">{partner.donations} units</span>
                    </div>
                  </div>

                  <button className="w-full mt-4 border border-purple-600 text-purple-600 py-2 px-4 rounded-lg hover:bg-purple-50 transition-colors font-semibold flex items-center justify-center gap-2">
                    View Details
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'donors' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Campaign Performance</h2>
              <div className="h-64 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 mx-auto mb-2" />
                  <p>Campaign analytics chart will be displayed here</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Donor Demographics</h3>
                <div className="h-48 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Users className="w-12 h-12 mx-auto mb-2" />
                    <p>Demographics chart</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Impact Over Time</h3>
                <div className="h-48 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2" />
                    <p>Impact timeline chart</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Panel - Always Visible */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all">
              <Megaphone className="w-6 h-6 text-purple-600" />
              <span className="text-sm font-semibold text-gray-900">Create Campaign</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-pink-50 hover:border-pink-300 transition-all">
              <Users className="w-6 h-6 text-pink-600" />
              <span className="text-sm font-semibold text-gray-900">Manage Donors</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-rose-50 hover:border-rose-300 transition-all">
              <Calendar className="w-6 h-6 text-rose-600" />
              <span className="text-sm font-semibold text-gray-900">Schedule Event</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-all">
              <Award className="w-6 h-6 text-indigo-600" />
              <span className="text-sm font-semibold text-gray-900">View Reports</span>
            </button>
          </div>
        </div>

        {/* Contact Information */}
        <div className="mt-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
          <h2 className="text-xl font-bold mb-4">NGO Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5" />
              <div>
                <p className="text-white/80 text-sm">Phone</p>
                <p className="font-semibold">+91 98765 43210</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5" />
              <div>
                <p className="text-white/80 text-sm">Email</p>
                <p className="font-semibold">info@bloodhubngo.org</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5" />
              <div>
                <p className="text-white/80 text-sm">Location</p>
                <p className="font-semibold">Mumbai, Maharashtra</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NgoDashboard;
