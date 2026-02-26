import { useState } from 'react';
import { Heart, Droplet, Users, Award, Target, Shield, Zap, Globe, ArrowRight, Activity, TrendingUp, Star, Gift, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

function About() {
  const values = [
    {
      icon: <Heart size={32} />,
      title: "Compassion",
      description: "Every donation is an act of care and compassion for others."
    },
    {
      icon: <Shield size={32} />,
      title: "Trust & Safety",
      description: "We strive to protect safety and privacy for donors and recipients."
    },
    {
      icon: <Zap size={32} />,
      title: "Speed & Efficiency",
      description: "We aim for responsive support when time matters most."
    },
    {
      icon: <Globe size={32} />,
      title: "Accessibility",
      description: "Working to make blood donation more accessible across India."
    }
  ];

  const milestones = [
    { year: "2020", event: "BloodHub Launched", description: "Started with a vision to strengthen blood donation across India" },
    { year: "2021", event: "Growing Donor Community", description: "Built early momentum with dedicated donors and supporters" },
    { year: "2022", event: "Expanding Partnerships", description: "Collaborating with blood banks and organizations nationwide" },
    { year: "2023", event: "Lives Touched", description: "Continuing to grow our impact one donation at a time" }
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

  const faqItems = [
    {
      question: "Who can donate blood?",
      answer: "Most healthy adults can donate blood, but eligibility depends on local guidelines and a quick screening."
    },
    {
      question: "How often can I donate blood?",
      answer: "Donation frequency varies by donation type and local guidelines. Many centers allow whole blood donations about every 8 weeks."
    },
    {
      question: "Is blood donation safe?",
      answer: "Blood donation is generally safe at accredited centers. Single-use equipment and trained staff are standard."
    },
    {
      question: "How long does a blood donation take?",
      answer: "The full visit typically takes around an hour, while the donation itself is much shorter."
    },
  ];

  const testimonials = [
    {
      quote: "BloodHub made my first blood donation experience seamless and rewarding. The app is incredibly user-friendly, and I love tracking my impact!",
      author: "Priya Sharma",
      role: "Regular Donor"
    },
    {
      quote: "I received a critical blood request notification and was able to help save a life within hours. This platform is truly life-changing.",
      author: "Rahul Mehta",
      role: "Emergency Responder"
    },
    {
      quote: "As a blood bank administrator, BloodHub has revolutionized how we manage blood requests. The response time is incredible!",
      author: "Dr. Anjali Verma",
      role: "Medical Director"
    }
  ];

  const benefits = [
    {
      icon: <Heart size={32} />,
      title: "Supports Healthy Habits",
      description: "Donating can be a reminder to stay mindful of your health and wellbeing.",
      gradient: "bg-gradient-to-r from-red-500 to-pink-500"
    },
    {
      icon: <Activity size={32} />,
      title: "Basic Health Check",
      description: "Many donation centers provide quick checks like hemoglobin and blood pressure.",
      gradient: "bg-gradient-to-r from-red-600 to-red-700"
    },
    {
      icon: <Zap size={32} />,
      title: "Natural Replenishment",
      description: "Your body naturally replaces donated blood over time.",
      gradient: "bg-gradient-to-r from-red-700 to-red-800"
    },
    {
      icon: <TrendingUp size={32} />,
      title: "Light Energy Use",
      description: "The replenishment process uses some energy as your body recovers.",
      gradient: "bg-gradient-to-r from-pink-600 to-red-600"
    },
    {
      icon: <Shield size={32} />,
      title: "Wellness Awareness",
      description: "Staying aware of your iron levels and overall health can be a positive step.",
      gradient: "bg-gradient-to-r from-red-600 to-red-700"
    },
    {
      icon: <Star size={32} />,
      title: "Emotional Well-being",
      description: "Many donors describe a sense of purpose and gratitude after giving.",
      gradient: "bg-gradient-to-r from-red-700 to-red-800"
    }
  ];

  const rewardTiers = [
    { icon: <Star size={40} />, title: "Bronze Donor", donations: "1-5", color: "from-orange-600 to-orange-700" },
    { icon: <Star size={40} />, title: "Silver Donor", donations: "6-15", color: "from-gray-400 to-gray-500" },
    { icon: <Star size={40} />, title: "Gold Donor", donations: "16-30", color: "from-yellow-500 to-yellow-600" },
    { icon: <Star size={40} />, title: "Platinum Hero", donations: "30+", color: "from-purple-600 to-purple-700" }
  ];

  const rewardPerks = [
    { icon: <Award size={24} />, title: "Digital Certificates", desc: "Download and share your impact" },
    { icon: <Gift size={24} />, title: "Partner Perks", desc: "Occasional offers as available" },
    { icon: <Heart size={24} />, title: "Impact Tracking", desc: "Follow your donation journey" }
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="w-full public-app-page public-app-about">
      {/* Hero Section - PhonePe-inspired */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-pink-50">
          {/* Animated gradient orbs - PhonePe style */}
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-red-400 to-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-red-500 to-red-600 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-gradient-to-r from-pink-500 to-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

          {/* Floating decorative elements */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-red-200/30 rounded-2xl rotate-12 animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-16 h-16 bg-pink-200/30 rounded-full animate-pulse animation-delay-2000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-8">
              <Heart className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-semibold">About Us</span>
            </div>

            <h1 className="text-6xl font-extrabold mb-6">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Supporting Communities Through
              </span>
              <br />
              <span className="text-gray-900">Blood Donation</span>
            </h1>

            <p className="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
              BloodHub is a growing blood donation platform, connecting donors with those in need through thoughtful technology and compassion.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Mission - PhonePe-inspired glassmorphism */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
              <div className="relative bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/50 overflow-hidden transition-all duration-500">
                {/* Decorative orb */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>

                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl flex items-center justify-center mb-6 shadow-2xl transform group-hover:scale-110 group-hover:-translate-y-2 group-hover:rotate-12 transition-all duration-500"
                       style={{ boxShadow: '0 20px 40px rgba(220, 38, 38, 0.3)' }}>
                    <Target className="w-8 h-8 text-white" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }} />
                  </div>
                  <h2 className="text-3xl font-bold mb-4 text-gray-900 group-hover:text-red-600 transition-colors duration-300">Our Mission</h2>
                  <p className="text-gray-700 leading-relaxed text-lg">
                    To build a seamless ecosystem where people in need of blood can find donors as quickly and safely as possible.
                  </p>
                </div>
              </div>
            </div>

            {/* Vision - PhonePe-inspired glassmorphism */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
              <div className="relative bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/50 overflow-hidden transition-all duration-500">
                {/* Decorative orb */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-r from-red-600 to-pink-600 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>

                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-r from-red-700 to-red-800 rounded-2xl flex items-center justify-center mb-6 shadow-2xl transform group-hover:scale-110 group-hover:-translate-y-2 group-hover:rotate-12 transition-all duration-500"
                       style={{ boxShadow: '0 20px 40px rgba(220, 38, 38, 0.3)' }}>
                    <Droplet className="w-8 h-8 text-white" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }} />
                  </div>
                  <h2 className="text-3xl font-bold mb-4 text-gray-900 group-hover:text-red-600 transition-colors duration-300">Our Vision</h2>
                  <p className="text-gray-700 leading-relaxed text-lg">
                    A future where blood is easier to access, and more people feel empowered to become life-saving heroes.
                  </p>
                </div>
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
            <h2 className="text-5xl font-bold text-white mb-4">Our Impact So Far</h2>
            <p className="text-xl text-white/90">A growing community making a difference across India</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { icon: <Heart size={40} />, value: "Growing", label: "Lives Touched" },
              { icon: <Users size={40} />, value: "Thousands", label: "Active Donors" },
              { icon: <Droplet size={40} />, value: "Rising", label: "Units Shared" },
              { icon: <Award size={40} />, value: "Nationwide", label: "BloodBank Partners" }
            ].map((stat, index) => (
              <div key={index} className="text-center text-white group">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-lg rounded-2xl mb-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}>
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
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
                <div className="relative bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 border border-white/50 overflow-hidden">
                  {/* Decorative orb */}
                  <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-500"></div>

                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center mb-6 shadow-2xl transform group-hover:scale-110 group-hover:-translate-y-1 group-hover:rotate-6 transition-all duration-500"
                         style={{ boxShadow: '0 15px 30px rgba(220, 38, 38, 0.3)' }}>
                      <div className="text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>{value.icon}</div>
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-gray-900 group-hover:text-red-600 transition-colors duration-300">{value.title}</h3>
                    <p className="text-gray-700 leading-relaxed">{value.description}</p>
                  </div>
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
            <p className="text-xl text-gray-600">Milestones along the way</p>
          </div>

          <div className="max-w-4xl mx-auto">
            {milestones.map((milestone, index) => (
              <div key={index} className="group relative pl-8 pb-12 border-l-2 border-red-200 last:border-0 last:pb-0">
                {/* Enhanced timeline dot with glow */}
                <div className="absolute left-0 top-0 transform -translate-x-[9px]">
                  <div className="absolute inset-0 w-4 h-4 bg-red-600 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative w-4 h-4 bg-gradient-to-r from-red-600 to-red-700 rounded-full shadow-lg transform group-hover:scale-150 transition-all duration-500"></div>
                </div>

                <div className="relative bg-white/90 backdrop-blur-xl p-6 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-500 border border-white/50 overflow-hidden">
                  {/* Decorative orb */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-500"></div>

                  <div className="relative z-10">
                    <div className="text-red-600 font-bold text-xl mb-2 group-hover:text-red-700 transition-colors duration-300">{milestone.year}</div>
                    <h3 className="text-2xl font-bold mb-2 text-gray-900 group-hover:text-red-600 transition-colors duration-300">{milestone.event}</h3>
                    <p className="text-gray-700 leading-relaxed">{milestone.description}</p>
                  </div>
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
            <p className="text-xl text-gray-600">Dedicated professionals supporting donors and recipients</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {teamMembers.map((member, index) => (
              <div key={index} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
                <div className="relative bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 border border-white/50 text-center overflow-hidden">
                  {/* Decorative orb */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-500"></div>

                  <div className="relative z-10">
                    {/* Avatar with glow effect */}
                    <div className="relative inline-block mb-6">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-800 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
                      <div className="relative w-24 h-24 bg-gradient-to-br from-red-600 via-red-700 to-red-800 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-2xl transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500"
                           style={{ boxShadow: '0 20px 40px rgba(220, 38, 38, 0.3)' }}>
                        {member.name[0]}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold mb-2 text-gray-900 group-hover:text-red-600 transition-colors duration-300">{member.name}</h3>
                    <p className="text-red-600 font-semibold mb-3">{member.role}</p>
                    <p className="text-gray-700 text-sm">{member.expertise}</p>
                  </div>
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
            <p className="text-xl text-gray-600">Simple steps to get started</p>
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Register", description: "Create your profile in a few minutes" },
              { step: "2", title: "Verify", description: "Complete a quick verification step" },
              { step: "3", title: "Connect", description: "Get matched with nearby requests when possible" },
              { step: "4", title: "Donate", description: "Donate at partner blood banks and centers" }
            ].map((item, index) => (
              <div key={index} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
                <div className="relative bg-white/90 backdrop-blur-xl p-8 rounded-2xl border border-white/50 hover:border-red-200 transition-all duration-500 shadow-lg hover:shadow-2xl overflow-hidden">
                  {/* Decorative orb */}
                  <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-500"></div>

                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg transform group-hover:scale-110 group-hover:-translate-y-1 group-hover:rotate-12 transition-all duration-500"
                         style={{ boxShadow: '0 10px 20px rgba(220, 38, 38, 0.3)' }}>
                      {item.step}
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-gray-900 group-hover:text-red-600 transition-colors duration-300">{item.title}</h3>
                    <p className="text-gray-700">{item.description}</p>
                  </div>

                  {index < 3 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-red-400 to-pink-400 opacity-50"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits of Blood Donation */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-red-50 to-pink-50">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-pink-400 to-red-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-red-500 to-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-6">
              <Heart className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-semibold">Wellness Notes</span>
            </div>
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Why People Choose to Donate
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">Donating can feel meaningful and can include simple wellness checks.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="group relative">
                <div className={`absolute inset-0 ${benefit.gradient} rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500`}></div>
                <div className="relative bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 border border-white/50 overflow-hidden">
                  <div className={`absolute -top-10 -right-10 w-32 h-32 ${benefit.gradient} rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-500`}></div>

                  <div className="relative z-10">
                    <div className={`inline-flex p-4 rounded-2xl ${benefit.gradient} shadow-2xl mb-6 transform group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500`}
                         style={{ boxShadow: '0 20px 40px rgba(220, 38, 38, 0.3)' }}>
                      <div className="text-white" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
                        {benefit.icon}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-gray-900 group-hover:text-red-600 transition-colors duration-300">{benefit.title}</h3>
                    <p className="text-gray-700 leading-relaxed">{benefit.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Donor Rewards */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-pink-50">
          <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-gradient-to-r from-red-400 to-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-6">
              <Gift className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-semibold">Recognition & Gratitude</span>
            </div>
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Celebrate Your Impact
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">We aim to recognize donors with milestones, badges, and gratitude</p>
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-4 gap-6">
            {rewardTiers.map((tier, i) => (
              <div key={i} className="group relative">
                <div className={`absolute inset-0 bg-gradient-to-r ${tier.color} rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500`}></div>
                <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-500 border border-white/50 text-center overflow-hidden">
                  <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-r ${tier.color} rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-500`}></div>

                  <div className="relative z-10">
                    <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-r ${tier.color} shadow-2xl mb-4 transform group-hover:scale-110 group-hover:-translate-y-2 group-hover:rotate-12 transition-all duration-500`}
                         style={{ boxShadow: '0 15px 30px rgba(220, 38, 38, 0.3)' }}>
                      <div className="text-white" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
                        {tier.icon}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-gray-900">{tier.title}</h3>
                    <p className="text-sm text-gray-600">{tier.donations} donations</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
            {rewardPerks.map((perk, i) => (
              <div key={i} className="group relative bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 border border-white/50">
                <div className="flex items-start">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-red-600 to-red-700 mr-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <div className="text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                      {perk.icon}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">{perk.title}</h4>
                    <p className="text-sm text-gray-600">{perk.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Stories from Our Community</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Personal perspectives from donors and partners</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <div key={testimonial.author} className="group relative bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 border border-white/50 overflow-hidden">
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-500"></div>

                <div className="relative">
                  <div className="absolute -top-2 -left-2 text-6xl text-red-100 font-serif">"</div>

                  <div className="flex items-center mb-6 relative z-10">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-800 rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>

                      <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center text-white font-bold text-xl shadow-xl transform group-hover:scale-110 transition-transform duration-500">
                        {testimonial.author[0]}
                      </div>
                    </div>

                    <div className="ml-4">
                      <p className="font-bold text-gray-900 text-lg">{testimonial.author}</p>
                      <p className="text-sm text-red-600 font-medium">{testimonial.role}</p>
                    </div>
                  </div>

                  <p className="text-gray-700 leading-relaxed relative z-10 text-lg">"{testimonial.quote}"</p>

                  <div className="flex gap-1 mt-4">
                    {[...Array(5)].map((_, i) => (
                      <Heart key={`${testimonial.author}-${i}`} className="w-4 h-4 fill-red-500 text-red-500" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-5xl font-bold mb-12 text-center bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqItems.map((item, index) => (
                <div key={item.question} className="group relative bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-2xl overflow-hidden border border-white/50 transition-all duration-500">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-500"></div>

                  <button
                    className="flex justify-between items-center w-full text-left p-6 hover:bg-white/50 transition-all duration-300 relative z-10"
                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  >
                    <span className="font-bold text-lg text-gray-900 group-hover:text-red-600 transition-colors duration-300">{item.question}</span>
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-red-600 to-red-700 shadow-lg transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                      <ChevronDown className={`transform transition-all duration-500 text-white ${openIndex === index ? 'rotate-180' : ''}`}
                                   style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                    </div>
                  </button>
                  {openIndex === index && (
                    <div className="px-6 pb-6 relative z-10 animate-fadeIn">
                      <div className="pt-2 border-t border-red-100">
                        <p className="text-gray-700 leading-relaxed text-base">{item.answer}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - PhonePe-inspired premium */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-700 to-red-800">
          {/* Floating gradient orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-red-800 to-pink-600 rounded-full mix-blend-overlay filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-pink-600 to-red-700 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <h2 className="text-5xl md:text-6xl font-bold mb-6 transform hover:scale-105 transition-transform duration-300">Join Our Supportive Community</h2>
            <p className="text-xl md:text-2xl mb-12 opacity-90 leading-relaxed">
              Whether you want to donate blood or request help, we're here to support you
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link
                to="/donor/register"
                className="group/btn relative px-10 py-5 bg-white text-red-600 rounded-full text-xl font-bold hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1 transition-all duration-500 inline-flex items-center justify-center overflow-hidden"
                style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-gray-50 to-white opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"></div>
                <Droplet className="w-6 h-6 mr-2 relative z-10" />
                <span className="relative z-10">Become a Donor</span>
                <ArrowRight className="ml-2 relative z-10 group-hover/btn:translate-x-1 transition-transform duration-300" />
              </Link>
              <Link
                to="/request-blood"
                className="group/btn px-10 py-5 bg-white/10 backdrop-blur-xl text-white border-2 border-white rounded-full text-xl font-bold hover:bg-white hover:text-red-600 hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1 transition-all duration-500 inline-flex items-center justify-center"
              >
                <Heart className="w-6 h-6 mr-2" />
                Request Blood
                <ArrowRight className="ml-2 group-hover/btn:translate-x-1 transition-transform duration-300" />
              </Link>
            </div>

            {/* Stats with glassmorphism */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-500 transform hover:scale-105">
                <div className="text-4xl font-bold mb-2">Always</div>
                <div className="text-lg opacity-90">Emergency Support</div>
              </div>
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-500 transform hover:scale-105">
                <div className="text-4xl font-bold mb-2">Quick</div>
                <div className="text-lg opacity-90">Response Goal</div>
              </div>
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-500 transform hover:scale-105">
                <div className="text-4xl font-bold mb-2">Trusted</div>
                <div className="text-lg opacity-90">BloodBank Network</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default About;
