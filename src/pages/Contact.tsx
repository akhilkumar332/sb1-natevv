import React, { useState, useEffect } from 'react';
import { Search, MapPin, Phone, Mail } from 'lucide-react';

// Define an interface for the donor object
interface Donor {
  id: number;
  name: string;
  bloodType: string;
  location: string;
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

function Contact() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true); // Add loading state

  // Simulate loading data
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false); // Stop loading after 1 second
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulated search results
    const simulatedResults: Donor[] = [
      { id: 1, name: 'Alice Johnson', bloodType: 'A+', location: 'New York' },
      { id: 2, name: 'Michael Smith', bloodType: 'O-', location: 'San Francisco' },
      { id: 3, name: 'Emma Brown', bloodType: 'B+', location: 'Chicago' },
    ];
    setSearchResults(simulatedResults);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">Contact Us</h1>

        {loading ? (
          <SkeletonLoader /> // Show skeleton loader while loading
        ) : (
          <>
            <section className="bg-white shadow-md rounded-lg p-6 mb-8">
              <h2 className="text-2xl font-semibold mb-4">Get in Touch</h2>
              <p className="text-gray-700 mb-4">
                We’d love to hear from you! Whether you have questions, feedback, or need assistance, feel free to reach out.
              </p>
              <div className="flex flex-col space-y-4">
                <div className="flex items-center">
                  <Phone className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-gray-700">+1 (555) 123-4567</span>
                </div>
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-gray-700">contact@lifeflow.org</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-gray-700">123 Life Street, Health City</span>
                </div>
              </div>
            </section>

            <section className="bg-white shadow-md rounded-lg p-6 mb-8">
              <h2 className="text-2xl font-semibold mb-4">Live Donor Search</h2>
              <form onSubmit={handleSearch} className="mb-4">
                <div className="flex">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter blood type or location"
                    className ="flex-grow px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-red-500"
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
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default Contact;