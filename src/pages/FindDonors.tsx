import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, MapPin, Filter, Phone, Mail, AlertCircle, Clock, Heart, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Donor {
  id: string;
  name: string;
  bloodType: string;
  location: string;
  distance: number;
  lastDonation: string;
  phone: string;
  email: string;
  availability: 'Available' | 'Unavailable';
  gender: 'Male' | 'Female' | 'Other';
}

function FindDonors() {
  const location = useLocation();
  const navigate = useNavigate();

  const query = new URLSearchParams(location.search);

  const [searchTerm, setSearchTerm] = useState<string>(query.get('searchTerm') || '');
  const [selectedBloodType, setSelectedBloodType] = useState<string>(query.get('bloodType') || '');
  const [selectedDistance, setSelectedDistance] = useState<string>(query.get('distance') || '');
  const [selectedAvailability, setSelectedAvailability] = useState<string>(query.get('availability') || '');
  const [selectedGender, setSelectedGender] = useState<string>(query.get('gender') || '');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const updateURL = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('searchTerm', searchTerm);
    if (selectedBloodType) params.set('bloodType', selectedBloodType);
    if (selectedDistance) params.set('distance', selectedDistance);
    if (selectedAvailability) params.set('availability', selectedAvailability);
    if (selectedGender) params.set('gender', selectedGender);

    navigate({ search: params.toString() });
  };

  useEffect(() => {
    updateURL();
  }, [searchTerm, selectedBloodType, selectedDistance, selectedAvailability, selectedGender]);

  const donors: Donor[] = [
    {
      id: '1',
      name: 'Rajesh Kumar',
      bloodType: 'A+',
      location: 'Mumbai, Maharashtra',
      distance: 2.5,
      lastDonation: '2024-01-15',
      phone: '+91 98765 43210',
      email: 'rajesh.kumar@example.com',
      availability: 'Available',
      gender: 'Male',
    },
    {
      id: '2',
      name: 'Priya Sharma',
      bloodType: 'O-',
      location: 'Delhi, NCR',
      distance: 3.8,
      lastDonation: '2024-02-01',
      phone: '+91 98765 43211',
      email: 'priya.sharma@example.com',
      availability: 'Available',
      gender: 'Female',
    },
    {
      id: '3',
      name: 'Amit Patel',
      bloodType: 'B+',
      location: 'Bangalore, Karnataka',
      distance: 5.2,
      lastDonation: '2024-01-20',
      phone: '+91 98765 43212',
      email: 'amit.patel@example.com',
      availability: 'Unavailable',
      gender: 'Male',
    },
    {
      id: '4',
      name: 'Sneha Reddy',
      bloodType: 'AB+',
      location: 'Hyderabad, Telangana',
      distance: 4.1,
      lastDonation: '2024-01-10',
      phone: '+91 98765 43213',
      email: 'sneha.reddy@example.com',
      availability: 'Available',
      gender: 'Female',
    },
  ];

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const distances = ['5', '10', '15', '20', '25', '30'];
  const availabilityOptions = ['Available', 'Unavailable'];
  const genderOptions = ['Male', 'Female', 'Other'];

  const handleCallDonor = (donor: Donor) => {
    if (donor.availability === 'Available') {
      window.location.href = `tel:${donor.phone}`;
    } else {
      toast.error('This donor is currently unavailable');
    }
  };

  const handleMessageDonor = (donor: Donor) => {
    if (donor.availability === 'Available') {
      window.location.href = `mailto:${donor.email}`;
    } else {
      toast.error('This donor is currently unavailable');
    }
  };

  const filteredDonors = donors.filter(donor => {
    const matchesSearch = donor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         donor.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBloodType = !selectedBloodType || donor.bloodType === selectedBloodType;
    const matchesDistance = !selectedDistance || donor.distance <= parseInt(selectedDistance);
    const matchesAvailability = !selectedAvailability || donor.availability === selectedAvailability;
    const matchesGender = !selectedGender || donor.gender === selectedGender;

    return matchesSearch && matchesBloodType && matchesDistance &&
           matchesAvailability && matchesGender;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedBloodType('');
    setSelectedDistance('');
    setSelectedAvailability('');
    setSelectedGender('');
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-pink-50">
          <div className="absolute top-10 right-10 w-64 h-64 bg-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-6">
              <Heart className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-semibold">Find Donors</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold mb-6">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Connect with Life-Savers
              </span>
            </h1>

            <p className="text-xl text-gray-600 mb-8">
              Find blood donors near you and save lives. Our community of heroes is ready to help.
            </p>
          </div>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {/* Search Bar */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-600" />
                  <input
                    type="text"
                    placeholder="Search by location or donor name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center justify-center px-6 py-3 rounded-xl font-semibold transition-all ${
                    showFilters
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Filter className="h-5 w-5 mr-2" />
                  Filters
                  {showFilters && <X className="h-4 w-4 ml-2" />}
                </button>
              </div>

              {/* Filter Options */}
              {showFilters && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Blood Type Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Blood Type
                      </label>
                      <select
                        value={selectedBloodType}
                        onChange={(e) => setSelectedBloodType(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">All Blood Types</option>
                        {bloodTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    {/* Distance Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Distance (km)
                      </label>
                      <select
                        value={selectedDistance}
                        onChange={(e) => setSelectedDistance(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">Any Distance</option>
                        {distances.map(distance => (
                          <option key={distance} value={distance}>{distance} km</option>
                        ))}
                      </select>
                    </div>

                    {/* Availability Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Availability
                      </label>
                      <select
                        value={selectedAvailability}
                        onChange={(e) => setSelectedAvailability(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">Any Availability</option>
                        {availabilityOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>

                    {/* Gender Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Gender
                      </label>
                      <select
                        value={selectedGender}
                        onChange={(e) => setSelectedGender(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">Any Gender</option>
                        {genderOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={clearFilters}
                    className="text-red-600 hover:text-red-700 font-semibold text-sm"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>

            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600">
                Found <span className="font-bold text-red-600">{filteredDonors.length}</span> donors
              </p>
            </div>

            {/* Donors Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl p-6 animate-pulse border border-gray-100">
                    <div className="h-6 bg-gray-200 rounded mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded mb-4"></div>
                    <div className="flex gap-2">
                      <div className="h-10 w-full bg-gray-200 rounded-xl"></div>
                      <div className="h-10 w-full bg-gray-200 rounded-xl"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredDonors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDonors.map((donor) => (
                  <div
                    key={donor.id}
                    className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 relative overflow-hidden"
                  >
                    {/* Background Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-pink-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    {/* Content */}
                    <div className="relative z-10">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                            {donor.name[0]}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">{donor.name}</h3>
                            <p className="text-sm text-gray-500">{donor.gender}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="px-3 py-1 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-bold rounded-full shadow-md">
                            {donor.bloodType}
                          </span>
                          {donor.availability === 'Available' ? (
                            <span className="mt-2 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                              Available
                            </span>
                          ) : (
                            <span className="mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                              Unavailable
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-gray-600">
                          <MapPin className="w-4 h-4 mr-2 text-red-600" />
                          <span className="text-sm">{donor.location} ({donor.distance} km)</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Clock className="w-4 h-4 mr-2 text-red-600" />
                          <span className="text-sm">Last donation: {new Date(donor.lastDonation).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCallDonor(donor)}
                          disabled={donor.availability === 'Unavailable'}
                          className={`flex-1 flex items-center justify-center py-3 rounded-xl font-semibold transition-all ${
                            donor.availability === 'Available'
                              ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:shadow-lg transform hover:scale-105'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Call
                        </button>
                        <button
                          onClick={() => handleMessageDonor(donor)}
                          disabled={donor.availability === 'Unavailable'}
                          className={`flex-1 flex items-center justify-center py-3 rounded-xl font-semibold transition-all ${
                            donor.availability === 'Available'
                              ? 'bg-white text-red-600 border-2 border-red-600 hover:bg-red-50 transform hover:scale-105'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-gray-200'
                          }`}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No donors found</h3>
                <p className="text-gray-600 mb-6">Try adjusting your search criteria or filters</p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-red-600 via-red-700 to-red-800 mt-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h2 className="text-4xl font-bold mb-4">Want to Become a Donor?</h2>
            <p className="text-xl mb-8 opacity-90">Join our community of life-savers and make a difference</p>
            <button
              onClick={() => navigate('/donor/register')}
              className="px-8 py-4 bg-white text-red-600 rounded-full font-bold text-lg hover:shadow-2xl transform hover:scale-105 transition-all"
            >
              Register as a Donor
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default FindDonors;
