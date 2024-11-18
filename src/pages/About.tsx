import React, { useState, useEffect } from 'react';
import { Search, Droplet, Users, Award, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

// Define an interface for the donor object
interface Donor {
  id: number;
  name: string;
  bloodType: string;
  location: string;
}

const SkeletonLoader: React.FC = () => {
  return (
    <div className="animate-pulse mb-4">
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

function About() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true); // Add loading state

  // Simulate loading data
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulated search results
    const simulatedResults: Donor[] = [
      { id: 1, name: 'John Doe', bloodType: 'A+', location: 'New York' },
      { id: 2, name: 'Jane Smith', bloodType: 'O-', location: 'Los Angeles' },
      { id: 3, name: 'Bob Johnson', bloodType: 'B+', location: 'Chicago' },
    ];
    setSearchResults(simulatedResults);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">About LifeFlow</h1>

        <section className="bg-white shadow-md rounded-lg p-6 mb-8">
          {loading ? (
            <SkeletonLoader />
          ) : (
            <>
              <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
              <p className="text-gray-700 mb-4">
                At LifeFlow, our mission is to connect blood donors with those in need, saving lives one donation at a time. We believe that every individual has the power to make a difference, and through our platform, we aim to make the process of blood donation and receiving as seamless as possible.
              </p>
              <div className="flex items-center justify-center space-x-8 mt-6">
                <div className="text-center">
                  <Droplet className="h-12 w-12 text-red-500 mx-auto mb-2" />
                  <p className="font-semibold">10,000+</p>
                  <p className="text-sm text-gray-500">Donations</p>
                </div>
                <div className="text-center">
                  <Users className="h-12 w-12 text-red-500 mx-auto mb-2" />
                  <p className="font-semibold">5,000+</p>
                  <p className="text-sm text-gray-500">Registered Donors</p>
                </div>
                <div className="text-center">
                  <Award className="h-12 w-12 text-red-500 mx -auto mb-2" />
                  <p className="font-semibold">100+</p>
                  <p className="text-sm text-gray-500">Partner Hospitals</p>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="bg-white shadow-md rounded-lg p-6 mb-8">
          {loading ? (
            <SkeletonLoader />
          ) : (
            <>
              <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
              <ol className="list-decimal list-inside text-gray-700 space-y-2">
                <li>Register as a donor or recipient on our platform</li>
                <li>Complete your profile with necessary details</li>
                <li>Search for donors or wait to be matched with a recipient</li>
                <li>Coordinate the donation process through our secure messaging system</li>
                <li>Save lives and make a difference in your community</li>
              </ol>
            </>
          )}
        </section>

        <section className="bg-white shadow-md rounded-lg p-6 mb-8">
          {loading ? (
            <SkeletonLoader />
          ) : (
            <>
              <h2 className="text-2xl font-semibold mb-4">Live Donor Search</h2>
              <form onSubmit={handleSearch} className="mb-4">
                <div className="flex">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter blood type or location"
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="submit"
                    className="bg-red-500 text-white px-4 py-2 rounded-r-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                </div>
              </form>
              {searchResults.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Search Results:</h3>
                  <ul className="space-y-2">
                    {searchResults.map((donor: Donor) => (
                      <li key={donor.id} className="flex items-center justify-between bg-gray-100 p-3 rounded">
                        <div>
                          <p className="font-semibold">{donor.name}</p>
                          <p className="text-sm text-gray-600">Blood Type: {donor.bloodType}</p>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span>{donor.location}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        <section className="bg-white shadow-md rounded-lg p-6">
          {loading ? (
            <SkeletonLoader />
          ) : (
            <>
              <h2 className="text-2xl font-semibold mb-4">Join Our Community</h2>
              <p className="text-gray-700 mb-4">
                Whether you're looking to donate blood or in need of a donation, LifeFlow is here to help. Join our community today and be part of this life-saving initiative.
              </p>
              <div className="flex justify-center space-x-4">
                <Link
                  to="/donor/register"
                  className="bg-red-500 text-white px-6 py-2 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Register as Donor
                </Link>
                <Link
                  to="/request-blood"
                  className="bg-white text-red-500 border border-red-500 px-6 py-2 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Request Blood
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default About;