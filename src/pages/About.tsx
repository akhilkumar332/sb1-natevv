import { Heart, Droplet, Users, Award, Target, Shield, Zap, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

function About() {
  const values = [
    {
      icon: <Heart size={32} />,
      title: "Compassion",
      description: "Every donation is an act of love and compassion towards humanity."
    },
    {
      icon: <Shield size={32} />,
      title: "Trust & Safety",
      description: "We ensure complete safety and privacy for all our donors and recipients."
    },
    {
      icon: <Zap size={32} />,
      title: "Speed & Efficiency",
      description: "Quick response times can make the difference between life and death."
    },
    {
      icon: <Globe size={32} />,
      title: "Accessibility",
      description: "Making blood donation accessible to everyone, everywhere in India."
    }
  ];

  const milestones = [
    { year: "2020", event: "BloodHub Founded", description: "Started with a vision to revolutionize blood donation in India" },
    { year: "2021", event: "10,000 Donors", description: "Crossed our first major milestone with active donor community" },
    { year: "2022", event: "500+ Hospitals", description: "Partnered with hospitals across 20+ states" },
    { year: "2023", event: "100,000 Lives Saved", description: "Reached a life-changing milestone in our mission" }
  ];

  const teamMembers = [
    {
      name: "Dr. Rajesh Kumar",
      role: "Chief Medical Advisor",
      expertise: "30+ years in transfusion medicine"
    },
    {
      name: "Priya Deshmukh",
      role: "Technology Lead",
      expertise: "Healthcare technology innovation"
    },
    {
      name: "Amit Patel",
      role: "Operations Director",
      expertise: "Blood bank management expert"
    }
  ];

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-red-50">
          <div className="absolute top-10 right-10 w-96 h-96 bg-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-red-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-8">
              <Heart className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-semibold">About Us</span>
            </div>

            <h1 className="text-6xl font-extrabold mb-6">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Transforming Lives Through
              </span>
              <br />
              <span className="text-gray-900">Blood Donation</span>
            </h1>

            <p className="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              BloodHub is India's most advanced blood donation platform, connecting donors with those in need through cutting-edge technology and unwavering compassion.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Mission */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative bg-white p-10 rounded-3xl shadow-xl border-2 border-red-100">
                <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl flex items-center justify-center mb-6">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4 text-gray-900">Our Mission</h2>
                <p className="text-gray-600 leading-relaxed text-lg">
                  To create a seamless ecosystem where every person in need of blood can find a donor within minutes, making blood scarcity a thing of the past.
                </p>
              </div>
            </div>

            {/* Vision */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative bg-white p-10 rounded-3xl shadow-xl border-2 border-red-100">
                <div className="w-16 h-16 bg-gradient-to-r from-red-700 to-red-800 rounded-2xl flex items-center justify-center mb-6">
                  <Droplet className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4 text-gray-900">Our Vision</h2>
                <p className="text-gray-600 leading-relaxed text-lg">
                  A future where no life is lost due to blood unavailability, and every citizen is empowered to become a life-saving hero.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Stats */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-700 to-red-800"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-white mb-4">Our Impact in Numbers</h2>
            <p className="text-xl text-white/90">Making a measurable difference across India</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { icon: <Heart size={40} />, value: "100,000+", label: "Lives Saved" },
              { icon: <Users size={40} />, value: "50,000+", label: "Active Donors" },
              { icon: <Droplet size={40} />, value: "250,000+", label: "Blood Units" },
              { icon: <Award size={40} />, value: "500+", label: "Partner Hospitals" }
            ].map((stat, index) => (
              <div key={index} className="text-center text-white">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-lg rounded-2xl mb-4">
                  {stat.icon}
                </div>
                <div className="text-4xl font-bold mb-2">{stat.value}</div>
                <div className="text-lg text-white/90">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Our Core Values
              </span>
            </h2>
            <p className="text-xl text-gray-600">The principles that guide everything we do</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {values.map((value, index) => (
              <div key={index} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl opacity-0 group-hover:opacity-5 transition-opacity"></div>
                <div className="relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                  <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <div className="text-white">{value.icon}</div>
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-gray-900">{value.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{value.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Journey Timeline */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Our Journey
              </span>
            </h2>
            <p className="text-xl text-gray-600">Milestones that shaped our mission</p>
          </div>

          <div className="max-w-4xl mx-auto">
            {milestones.map((milestone, index) => (
              <div key={index} className="relative pl-8 pb-12 border-l-2 border-red-200 last:border-0 last:pb-0">
                <div className="absolute left-0 top-0 w-4 h-4 bg-red-600 rounded-full transform -translate-x-[9px]"></div>
                <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                  <div className="text-red-600 font-bold text-xl mb-2">{milestone.year}</div>
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">{milestone.event}</h3>
                  <p className="text-gray-600">{milestone.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership Team */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Meet Our Team
              </span>
            </h2>
            <p className="text-xl text-gray-600">Dedicated professionals committed to saving lives</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {teamMembers.map((member, index) => (
              <div key={index} className="group">
                <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100 text-center">
                  <div className="w-24 h-24 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6">
                    {member.name[0]}
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900">{member.name}</h3>
                  <p className="text-red-600 font-semibold mb-3">{member.role}</p>
                  <p className="text-gray-600 text-sm">{member.expertise}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                How BloodHub Works
              </span>
            </h2>
            <p className="text-xl text-gray-600">Simple steps to save lives</p>
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Register", description: "Create your profile in under 2 minutes" },
              { step: "2", title: "Verify", description: "Complete quick health verification" },
              { step: "3", title: "Connect", description: "Get matched with nearby requests" },
              { step: "4", title: "Donate", description: "Save lives at partner hospitals" }
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-gradient-to-br from-red-50 to-white p-8 rounded-2xl border-2 border-red-100 hover:border-red-300 transition-colors">
                  <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center text-white text-2xl font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                  {index < 3 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-red-300"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-700 to-red-800"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <h2 className="text-5xl font-bold mb-6">Join Our Life-Saving Community</h2>
            <p className="text-xl mb-12 opacity-90">
              Whether you want to donate blood or need assistance, we're here 24/7
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/donor/register"
                className="px-10 py-5 bg-white text-red-600 rounded-full text-xl font-bold hover:shadow-2xl transform hover:scale-105 transition-all duration-300 inline-flex items-center justify-center"
              >
                <Droplet className="w-6 h-6 mr-2" />
                Become a Donor
              </Link>
              <Link
                to="/request-blood"
                className="px-10 py-5 bg-transparent text-white border-2 border-white rounded-full text-xl font-bold hover:bg-white hover:text-red-600 transform hover:scale-105 transition-all duration-300 inline-flex items-center justify-center"
              >
                <Heart className="w-6 h-6 mr-2" />
                Request Blood
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default About;
