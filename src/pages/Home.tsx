import React from 'react';
import { Heart, Droplet, Users, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition border border-gray-100">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

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
          <p className=" text-2xl mb-12">
            Join the movement to make a difference in the lives of those in need.
          </p>
          <Link to="/donor/register" className="btn btn-lg btn-red">
            Become a Donor
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-6">What We Offer</h2>
          <div className="flex flex-wrap justify-center mb-4">
            <FeatureCard
              icon={<Heart size={24} />}
              title="Blood Donation"
              description="Donate blood to help save lives."
            />
            <FeatureCard
              icon={<Droplet size={24} />}
              title="Blood Testing"
              description="Get your blood tested for free."
            />
            <FeatureCard
              icon={<Users size={24} />}
              title="Community Support"
              description="Join a community of like-minded individuals."
            />
            <FeatureCard
              icon={<Building2 size={24} />}
              title="Partnerships"
              description="Partner with us to make a difference."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;