import React from 'react';
import { Heart, Droplet, Users, Hospital } from 'lucide-react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center justify-center text-white">
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&q=80&w=2000")',
          }}
        >
          <div className="absolute inset-0 bg-red-900/70" />
        </div>
        
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Save Lives Through Blood Donation
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto">
            Your donation can save up to three lives. Join our community of heroes today.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/donor/register"
              className="bg-white text-red-600 px-8 py-3 rounded-full font-semibold hover:bg-red-50 transition"
            >
              Become a Donor
            </Link>
            <Link
              to="/request-blood"
              className="bg-red-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-red-700 transition"
            >
              Request Blood
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Heart className="w-12 h-12 text-red-500" />}
              title="Become a Donor"
              description="Register as a blood donor and help save lives in your community"
            />
            <FeatureCard
              icon={<Droplet className="w-12 h-12 text-red-500" />}
              title="Request Blood"
              description="Submit a blood request for patients in need"
            />
            <FeatureCard
              icon={<Users className="w-12 h-12 text-red-500" />}
              title="Find Donors"
              description="Search our database of registered blood donors"
            />
            <FeatureCard
              icon={<Hospital className="w-12 h-12 text-red-500" />}
              title="Hospital Network"
              description="Connect with our network of partner hospitals"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition border border-gray-100">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

export default Home;