import { useState, useEffect } from 'react';
import { Search, MapPin, Filter, Droplet, Phone, Mail, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

// Define an interface for the donor object
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

const SkeletonLoader: React.FC = () => {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-300 rounded mb-4"></div>
      <div className="h-4 bg-gray-300 rounded mb-2"></div>
      <div className="h-4 bg-gray-300 rounded mb-2"></div>
      <div className="h-12 bg-gray-300 rounded mb-4"></div>
      <div className="flex space-x-4">
        <div className="h-12 w-12 bg-gray-300 rounded"></div>
        <div className="h-12 w-12 bg-gray-300 rounded"></div>
        <div className="h-12 w-12 bg-gray-300 rounded"></div>
      </div>
    </div>
  );
};

function FindDonors() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBloodType, setSelectedBloodType] = useState<string>('');
  const [selectedDistance, setSelectedDistance] = useState<string>('');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [lastDonationDate, setLastDonationDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true); // Add loading state

  // Simulate loading data
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Mock data - replace with actual API call
  const donors: Donor[] = [
    {
      id: '1',
      name: 'John Doe',
      bloodType: 'A+',
      location: 'New York, NY',
      distance: 2.5,
      lastDonation: '2024-01-15',
      phone: '+1 (555) 123-4567',
      email: 'john.doe@example.com',
      availability: 'Available',
      gender: 'Male',
    },
    {
      id: '2',
      name: 'Jane Smith',
      bloodType: 'O-',
      location: 'Los Angeles, CA',
      distance: 3.8,
      lastDonation: '2024-02-01',
      phone: '+1 (555) 987-6543',
      email: 'jane.smith@example.com',
      availability: 'Available',
      gender: 'Female',
    },
    {
      id: '3',
      name: 'Mike Johnson',
      bloodType: 'B+',
      location: 'Chicago, IL',
      distance: 5.2,
      lastDonation: '2024-01-20',
      phone: '+1 (555) 456-7890',
      email: 'mike.johnson@example.com',
      availability: 'Unavailable',
      gender: 'Male',
    },
    // Add more mock donors as needed
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
    const matchesLastDonation = !lastDonationDate || new Date(donor.lastDonation) >= new Date(lastDonationDate);
    
    return matchesSearch && matchesBloodType && matchesDistance && 
           matchesAvailability && matchesGender && matchesLastDonation;
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Blood Donors</h1>
          <p className="text-gray-600">Connect with nearby blood donors and save lives</p>
        </div>

        {/* Search and Filter Section */}
        {loading ? (
          <SkeletonLoader /> // Show skeleton loader while loading
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by location or donor name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Filter className="h-5 w-5 mr-2" />
                Filters
              </button>
            </div>

            {/* Filter Options */}
            {showFilters && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Blood Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Blood Type
                  </label>
                  <select
                    value={selectedBloodType}
                    onChange={(e) => setSelectedBloodType(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">All Blood Types</option>
                    {bloodTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Distance Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                      Distance (km)
                  </label>
                  <select
                      value={selectedDistance}
                      onChange={(e) => setSelectedDistance(e.target.value)}
                      className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                  >
                      <option value="">Any Distance</option>
                      {distances.map(distance => (
                      <option key={distance} value={distance}>{distance} km</option>
                      ))}
                  </select>
                </div>
                
                {/* Availability Filter */}
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                    Availability
                  </label>
                  <select
                    value={selectedAvailability}
                    onChange={(e) => setSelectedAvailability(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">Any Availability</ option>
                    {availabilityOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                {/* Gender Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={selectedGender}
                    onChange={(e) => setSelectedGender(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">Any Gender</option>
                    {genderOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                {/* Last Donation Date Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Donation After
                  </label>
                  <input
                    type="date"
                    value={lastDonationDate}
                    onChange={(e) => setLastDonationDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Section */}
        {loading ? (
          <SkeletonLoader /> // Show skeleton loader while loading
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDonors.length > 0 ? (
              filteredDonors.map(donor => (
                <div key={donor.id} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{donor.name}</h3>
                      <div className="flex items-center text-gray-600 mt-1">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span className="text-sm">{donor.location} ({donor.distance} km)</span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Droplet className="h-5 w-5 text-red-500 mr-1" />
                      <span className="font-semibold text-red-500">{donor.bloodType}</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Last Donation</p>
                        <p className="font-medium">{new Date(donor.lastDonation).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          donor.availability === 'Available' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {donor.availability}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => handleCallDonor(donor)}
                      className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call Donor
                    </button>
                    <button
                      onClick={() => handleMessageDonor(donor)}
                      className="w-full flex items-center justify-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-600 hover:text-red-500"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Message
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto h-16 w-16 text-red-500" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">No Donors Found</h2>
                <p className="text-gray-600">Try adjusting your search filters or searching for a different location.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FindDonors;