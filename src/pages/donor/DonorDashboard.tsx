// src/pages/donor/DonorDashboard.tsx
import { useState } from 'react';
import {
  User as LucideUser,
  MapPin,
  Calendar,
  Droplet,
  Phone,
  Mail,
  Heart,
  Award,
  TrendingUp,
  Clock,
  Users,
  Bell,
  Share2,
  Star,
  Zap,
  Activity,
  AlertCircle,
  CheckCircle,
  MapPinned,
  BookOpen,
  Trophy,
  Download,
  RefreshCw,
  Loader2,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDonorData } from '../../hooks/useDonorData';
import { useBloodRequest } from '../../hooks/useBloodRequest';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BhIdBanner from '../../components/BhIdBanner';

function DonorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State for modals and UI
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [showAllCamps, setShowAllCamps] = useState(false);

  // Use custom hook to fetch all donor data
  const {
    donationHistory,
    emergencyRequests,
    bloodCamps,
    stats,
    badges,
    loading,
    error,
    refreshData,
  } = useDonorData(
    user?.uid || '',
    user?.bloodType,
    user?.city
  );

  const { respondToRequest, responding } = useBloodRequest();

  const formatDate = (date?: Date | string) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    return `${days} days ago`;
  };

  const calculateAge = (dateOfBirth?: string | Date) => {
    if (!dateOfBirth) return 'N/A';
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const getDonationLevel = (donations: number = 0) => {
    if (donations === 0) return { level: 'New Donor', color: 'gray', icon: '🌱' };
    if (donations < 3) return { level: 'Rookie Donor', color: 'blue', icon: '🎯' };
    if (donations < 10) return { level: 'Regular Donor', color: 'green', icon: '⭐' };
    if (donations < 25) return { level: 'Super Donor', color: 'purple', icon: '🚀' };
    if (donations < 50) return { level: 'Hero Donor', color: 'orange', icon: '🦸' };
    if (donations < 100) return { level: 'Legend Donor', color: 'red', icon: '👑' };
    return { level: 'Champion Donor', color: 'yellow', icon: '🏆' };
  };

  const handleRespondToRequest = async (requestId: string) => {
    if (!user) {
      toast.error('Please log in to respond');
      return;
    }

    const success = await respondToRequest({
      requestId,
      donorId: user.uid,
      donorName: user.displayName || 'Anonymous Donor',
      donorPhone: user.phoneNumber || undefined,
      donorEmail: user.email || undefined,
    });

    if (success) {
      refreshData();
    }
  };

  // Handler functions for all interactive elements
  const handleBookDonation = () => {
    toast.success('Redirecting to appointment booking...');
    navigate('/request-blood'); // Navigate to blood request page
  };

  const handleEmergencyRequests = () => {
    setShowAllRequests(true);
  };

  const handleFindDonors = () => {
    toast.success('Redirecting to donor search...');
    navigate('/find-donors');
  };

  const handleInviteFriends = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join BloodHub India',
          text: 'Join me in saving lives! Download BloodHub India and become a blood donor.',
          url: window.location.origin,
        });
        toast.success('Thanks for sharing!');
      } catch (err) {
        // User cancelled or error occurred
        if ((err as Error).name !== 'AbortError') {
          copyInviteLink();
        }
      }
    } else {
      copyInviteLink();
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    toast.success('Invite link copied to clipboard!');
  };

  const handleDownloadCertificate = (certificateUrl: string) => {
    if (certificateUrl) {
      window.open(certificateUrl, '_blank');
      toast.success('Opening certificate...');
    } else {
      toast.error('Certificate not available');
    }
  };

  const handleViewAllBadges = () => {
    setShowAllBadges(true);
  };

  const handleViewAllCamps = () => {
    setShowAllCamps(true);
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
  };

  const handleViewAllRequests = () => {
    setShowAllRequests(true);
  };

  const handleLearnMore = () => {
    toast('Health tips and guidelines', { icon: 'ℹ️' });
    // Could open a modal or navigate to a help page
  };

  const donorLevel = getDonationLevel(stats?.totalDonations || 0);
  const eligibility = {
    eligible: (stats?.daysUntilEligible || 0) <= 0,
    daysUntil: stats?.daysUntilEligible || 0,
    message: stats?.nextEligibleDate
      ? `Eligible on ${formatDate(stats.nextEligibleDate)}`
      : 'Eligible to donate now!'
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-800 text-lg font-semibold mb-2">Error Loading Dashboard</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={refreshData}
            className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-300 flex items-center space-x-2 mx-auto"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="w-16 h-16 rounded-full border-4 border-white shadow-lg object-cover"
                  onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?background=fff&color=dc2626&name=${encodeURIComponent(user?.displayName || 'Donor')}`;
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white flex items-center justify-center">
                  <LucideUser className="w-8 h-8" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">Welcome back, {user?.displayName?.split(' ')[0] || 'Donor'}!</h1>
                <p className="text-white/80 flex items-center">
                  <span className="text-2xl mr-2">{donorLevel.icon}</span>
                  {donorLevel.level}
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={refreshData}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300"
                title="Refresh data"
              >
                <RefreshCw className="w-6 h-6" />
              </button>
              <button
                onClick={handleNotificationClick}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300 relative"
              >
                <Bell className="w-6 h-6" />
                {emergencyRequests.length > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-yellow-400 rounded-full text-xs flex items-center justify-center text-gray-900 font-bold">
                    {emergencyRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleInviteFriends}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300"
              >
                <Share2 className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-6">
        <BhIdBanner />
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Donations */}
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl group-hover:bg-white/30 transition-all duration-300">
                <Droplet className="w-8 h-8" />
              </div>
              <TrendingUp className="w-6 h-6 text-white/60" />
            </div>
            <h3 className="text-white/80 text-sm font-medium mb-1">Total Donations</h3>
            <p className="text-4xl font-bold mb-2">{stats?.totalDonations || 0}</p>
            <p className="text-white/70 text-xs">Your lifesaving journey</p>
          </div>

          {/* Lives Saved */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl group-hover:bg-white/30 transition-all duration-300">
                <Heart className="w-8 h-8" />
              </div>
              <Zap className="w-6 h-6 text-white/60" />
            </div>
            <h3 className="text-white/80 text-sm font-medium mb-1">Lives Saved</h3>
            <p className="text-4xl font-bold mb-2">{stats?.livesSaved || 0}</p>
            <p className="text-white/70 text-xs">Each donation saves 3 lives!</p>
          </div>

          {/* Next Eligible */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl group-hover:bg-white/30 transition-all duration-300">
                <Clock className="w-8 h-8" />
              </div>
              <Calendar className="w-6 h-6 text-white/60" />
            </div>
            <h3 className="text-white/80 text-sm font-medium mb-1">Next Eligible In</h3>
            <p className="text-4xl font-bold mb-2">{eligibility.eligible ? '0' : eligibility.daysUntil}</p>
            <p className="text-white/70 text-xs">{eligibility.eligible ? 'Ready to donate!' : 'days remaining'}</p>
          </div>

          {/* Impact Score */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl group-hover:bg-white/30 transition-all duration-300">
                <Award className="w-8 h-8" />
              </div>
              <Star className="w-6 h-6 text-white/60" />
            </div>
            <h3 className="text-white/80 text-sm font-medium mb-1">Impact Score</h3>
            <p className="text-4xl font-bold mb-2">{stats?.impactScore || 0}</p>
            <p className="text-white/70 text-xs">
              {stats?.rank ? `Rank #${stats.rank}` : 'Keep donating!'}
            </p>
          </div>
        </div>

        {/* Eligibility Status Card */}
        <div className={`mb-8 rounded-2xl p-8 shadow-xl ${
          eligibility.eligible
            ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200'
            : 'bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-4 rounded-2xl ${
                eligibility.eligible ? 'bg-green-500' : 'bg-yellow-500'
              }`}>
                {eligibility.eligible ? (
                  <CheckCircle className="w-10 h-10 text-white" />
                ) : (
                  <Clock className="w-10 h-10 text-white" />
                )}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-1">
                  {eligibility.eligible ? 'You\'re Eligible to Donate!' : 'Not Eligible Yet'}
                </h3>
                <p className="text-gray-600">{eligibility.message}</p>
                {!eligibility.eligible && (
                  <p className="text-sm text-gray-500 mt-1">
                    Your body needs 90 days to replenish blood cells completely
                  </p>
                )}
              </div>
            </div>
            {eligibility.eligible && (
              <button
                onClick={handleBookDonation}
                className="px-8 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold rounded-2xl hover:from-red-700 hover:to-orange-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 flex items-center space-x-2"
              >
                <Calendar className="w-5 h-5" />
                <span>Book Donation</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <Zap className="w-6 h-6 mr-2 text-orange-500" />
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={handleBookDonation}
                  className="p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-xl hover:from-red-100 hover:to-red-200 transition-all duration-300 hover:scale-105 group"
                >
                  <Calendar className="w-8 h-8 text-red-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-semibold text-gray-800">Book Donation</p>
                </button>
                <button
                  onClick={handleEmergencyRequests}
                  className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl hover:from-orange-100 hover:to-orange-200 transition-all duration-300 hover:scale-105 group"
                >
                  <AlertCircle className="w-8 h-8 text-orange-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-semibold text-gray-800">Emergency Requests</p>
                  {emergencyRequests.length > 0 && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-orange-200 text-orange-800 text-xs rounded-full font-bold">
                      {emergencyRequests.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleFindDonors}
                  className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-300 hover:scale-105 group"
                >
                  <Users className="w-8 h-8 text-purple-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-semibold text-gray-800">Find Donors</p>
                </button>
                <button
                  onClick={handleInviteFriends}
                  className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-300 hover:scale-105 group"
                >
                  <Share2 className="w-8 h-8 text-blue-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-semibold text-gray-800">Invite Friends</p>
                </button>
              </div>
            </div>

            {/* Emergency Requests */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <AlertCircle className="w-6 h-6 mr-2 text-red-500" />
                  Nearby Emergency Requests
                </h2>
                <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-semibold">
                  {emergencyRequests.length} Active
                </span>
              </div>
              <div className="space-y-4">
                {emergencyRequests.length > 0 ? (
                  emergencyRequests.map((request) => (
                    <div
                      key={request.id}
                      className={`p-4 border-2 rounded-xl transition-all duration-300 cursor-pointer ${
                        request.urgency === 'critical'
                          ? 'border-red-300 bg-red-50 hover:bg-red-100'
                          : request.urgency === 'high'
                          ? 'border-orange-300 bg-orange-50 hover:bg-orange-100'
                          : 'border-yellow-300 bg-yellow-50 hover:bg-yellow-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-xl ${
                            request.urgency === 'critical' ? 'bg-red-500' :
                            request.urgency === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                          }`}>
                            <Droplet className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-800 mb-1">
                              Urgent: {request.bloodType} - {request.units} Units needed
                            </h3>
                            <p className="text-sm text-gray-600 flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {request.hospitalName}, {request.city}
                              {request.distance && ` - ${request.distance.toFixed(1)} km away`}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Posted {formatTime(request.requestedAt)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRespondToRequest(request.id)}
                          disabled={responding}
                          className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          {responding ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <span>Respond</span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="text-gray-600">No emergency requests matching your blood type at the moment.</p>
                  </div>
                )}
              </div>
              {emergencyRequests.length > 0 && (
                <button
                  onClick={handleViewAllRequests}
                  className="w-full mt-4 py-3 text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all duration-300"
                >
                  View All Requests →
                </button>
              )}
            </div>

            {/* Donation History */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <Activity className="w-6 h-6 mr-2 text-blue-500" />
                Donation History
              </h2>
              {donationHistory.length > 0 ? (
                <div className="space-y-4">
                  {donationHistory.map((donation) => (
                    <div key={donation.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-300">
                      <div className="p-3 bg-blue-100 rounded-xl">
                        <Droplet className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">{donation.bloodBank}</h3>
                        <p className="text-sm text-gray-600">{donation.location}</p>
                        <p className="text-xs text-gray-500">{formatDate(donation.date)} • {donation.quantity}</p>
                      </div>
                      {donation.certificateUrl && (
                        <button
                          onClick={() => handleDownloadCertificate(donation.certificateUrl || '')}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-all duration-300"
                          title="Download certificate"
                        >
                          <Download className="w-5 h-5 text-gray-600" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <Activity className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Donations Yet</h3>
                  <p className="text-gray-600 mb-4">Start your journey as a lifesaver today!</p>
                  <button
                    onClick={handleBookDonation}
                    className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl font-semibold hover:from-red-700 hover:to-orange-700 transition-all duration-300"
                  >
                    Book Your First Donation
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-8">
            {/* Profile Card */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Profile Info</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600 flex items-center">
                    <Droplet className="w-4 h-4 mr-2 text-red-500" />
                    Blood Type
                  </span>
                  <span className="font-semibold text-red-600 text-lg">{user?.bloodType || 'Not Set'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                    Age
                  </span>
                  <span className="font-semibold text-gray-800">{calculateAge(user?.dateOfBirth)} years</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600 flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-green-500" />
                    Location
                  </span>
                  <span className="font-semibold text-gray-800">{user?.city || 'Not Set'}</span>
                </div>
                {user?.bhId && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600 flex items-center">
                      <Award className="w-4 h-4 mr-2 text-indigo-500" />
                      BH ID
                    </span>
                    <span className="font-semibold text-gray-800">{user.bhId}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600 flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-purple-500" />
                    Phone
                  </span>
                  <span className="font-semibold text-gray-800 text-xs">{user?.phoneNumber || 'Not Set'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600 flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-orange-500" />
                    Email
                  </span>
                  <span className="font-semibold text-gray-800 text-xs">{user?.email || 'Not Set'}</span>
                </div>
              </div>
            </div>

            {/* Achievements */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                Achievements
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-xl text-center transition-all duration-300 ${
                      badge.earned
                        ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-300 hover:scale-110'
                        : 'bg-gray-50 opacity-50'
                    }`}
                    title={badge.description}
                  >
                    <div className="text-3xl mb-2">{badge.icon}</div>
                    <p className="text-xs font-semibold text-gray-700">{badge.name}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={handleViewAllBadges}
                className="w-full mt-4 py-2 text-sm text-blue-600 font-semibold hover:bg-blue-50 rounded-xl transition-all duration-300"
              >
                View All Badges →
              </button>
            </div>

            {/* Nearby Blood Camps */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <MapPinned className="w-5 h-5 mr-2 text-green-500" />
                Nearby Blood Camps
              </h2>
              <div className="space-y-3">
                {bloodCamps.length > 0 ? (
                  bloodCamps.map((camp) => (
                    <div key={camp.id} className="p-3 bg-green-50 rounded-xl border-2 border-green-200 hover:bg-green-100 transition-all duration-300 cursor-pointer">
                      <h3 className="font-semibold text-gray-800 text-sm mb-1">{camp.name}</h3>
                      <p className="text-xs text-gray-600 flex items-center mb-1">
                        <MapPin className="w-3 h-3 mr-1" />
                        {camp.location}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(camp.date)}, {camp.startTime} - {camp.endTime}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No upcoming blood camps in your area</p>
                )}
              </div>
              {bloodCamps.length > 0 && (
                <button
                  onClick={handleViewAllCamps}
                  className="w-full mt-4 py-2 text-sm text-green-600 font-semibold hover:bg-green-50 rounded-xl transition-all duration-300"
                >
                  View All Camps →
                </button>
              )}
            </div>

            {/* Health Tips */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl shadow-xl p-6 border-2 border-purple-200">
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                <BookOpen className="w-5 h-5 mr-2 text-purple-600" />
                Today's Health Tip
              </h2>
              <p className="text-sm text-gray-700 mb-4">
                💧 Drink plenty of water before and after donation to help your body replenish fluids quickly. Aim for 8-10 glasses of water daily!
              </p>
              <button
                onClick={handleLearnMore}
                className="w-full py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-all duration-300"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {/* View All Emergency Requests Modal */}
      {showAllRequests && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">All Emergency Requests</h2>
              <button
                onClick={() => setShowAllRequests(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {emergencyRequests.map((request) => (
                <div
                  key={request.id}
                  className={`p-4 border-2 rounded-xl ${
                    request.urgency === 'critical'
                      ? 'border-red-300 bg-red-50'
                      : request.urgency === 'high'
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-yellow-300 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-xl ${
                        request.urgency === 'critical' ? 'bg-red-500' :
                        request.urgency === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                      }`}>
                        <Droplet className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 mb-1">
                          {request.bloodType} - {request.units} Units needed
                        </h3>
                        <p className="text-sm text-gray-600 flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {request.hospitalName}, {request.city}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Posted {formatTime(request.requestedAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        handleRespondToRequest(request.id);
                        setShowAllRequests(false);
                      }}
                      disabled={responding}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-semibold disabled:opacity-50"
                    >
                      Respond
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View All Badges Modal */}
      {showAllBadges && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <Trophy className="w-6 h-6 mr-2 text-yellow-500" />
                All Achievements
              </h2>
              <button
                onClick={() => setShowAllBadges(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`p-6 rounded-xl text-center transition-all ${
                      badge.earned
                        ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-300'
                        : 'bg-gray-50 opacity-50 border-2 border-gray-200'
                    }`}
                  >
                    <div className="text-4xl mb-3">{badge.icon}</div>
                    <p className="text-sm font-bold text-gray-800 mb-1">{badge.name}</p>
                    <p className="text-xs text-gray-600">{badge.description}</p>
                    {badge.earned && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ Earned
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View All Camps Modal */}
      {showAllCamps && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <MapPinned className="w-6 h-6 mr-2 text-green-500" />
                All Nearby Blood Camps
              </h2>
              <button
                onClick={() => setShowAllCamps(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {bloodCamps.length > 0 ? (
                bloodCamps.map((camp) => (
                  <div key={camp.id} className="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                    <h3 className="font-bold text-gray-800 text-lg mb-2">{camp.name}</h3>
                    <p className="text-sm text-gray-600 flex items-center mb-2">
                      <MapPin className="w-4 h-4 mr-1" />
                      {camp.location}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center mb-2">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(camp.date)}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {camp.startTime} - {camp.endTime}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <MapPinned className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No upcoming blood camps in your area</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <Bell className="w-6 h-6 mr-2 text-orange-500" />
                Notifications
              </h2>
              <button
                onClick={() => setShowNotifications(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {emergencyRequests.length > 0 ? (
                <div className="space-y-3">
                  {emergencyRequests.slice(0, 5).map((request) => (
                    <div key={request.id} className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                      <p className="font-semibold text-gray-800 text-sm">
                        Emergency: {request.bloodType} needed
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {request.hospitalName} - {request.units} units
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(request.requestedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-600">No new notifications</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DonorDashboard;
