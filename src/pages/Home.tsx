import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Droplet, Users, Building2, ArrowRight, MapPin, Shield, Award, Clock, Zap, TrendingUp, Star, Gift, Bell, CheckCircle } from 'lucide-react';

function StatCard({ icon, value, label, gradient }: { icon: React.ReactNode; value: string; label: string; gradient: string }) {
  return (
    <div className="relative group">
      {/* Glowing gradient background - PhonePe style */}
      <div className={`absolute inset-0 ${gradient} rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500`}></div>

      {/* Glassmorphic card */}
      <div className="relative flex h-full min-h-[220px] flex-col items-center justify-between bg-white/90 backdrop-blur-xl p-7 rounded-3xl shadow-2xl text-center transform group-hover:scale-105 group-hover:-translate-y-2 transition-all duration-500 border border-white/50">
        {/* Floating orb decoration */}
        <div className={`absolute -top-6 -right-6 w-24 h-24 ${gradient} rounded-full blur-2xl opacity-30`}></div>

        {/* 3D Icon with depth */}
        <div className="relative mb-3">
          <div className={`inline-flex p-4 rounded-2xl ${gradient} shadow-2xl transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500`}
               style={{ boxShadow: '0 25px 50px rgba(220, 38, 38, 0.4)' }}>
            <div className="text-white" style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.4))' }}>{icon}</div>
          </div>
        </div>

        {/* Animated counter */}
        <div className="mb-2 flex min-h-[3rem] items-center justify-center text-4xl font-extrabold bg-gradient-to-br from-red-600 via-red-700 to-red-900 bg-clip-text text-transparent transform group-hover:scale-110 transition-transform duration-300">
          {value}
        </div>
        <div className="flex min-h-[2.5rem] items-center justify-center text-gray-700 font-semibold text-base">{label}</div>

        {/* Subtle bottom accent */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-b-3xl`}></div>
      </div>
    </div>
  );
}

function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const heroSlides = [
    {
      badge: { icon: <Droplet className="w-5 h-5 text-red-600 mr-2" />, text: "A growing blood donation community in India" },
      title: { gradient: "Every Drop Counts,", normal: "Every Life Matters" },
      description: "Join a growing community of donors and supporters. Your contribution can help when it matters most.",
      primaryBtn: { to: "/donor/register", icon: <Droplet className="w-5 h-5 mr-2" />, text: "Become a Donor" },
      secondaryBtn: { to: "/request-blood", icon: <Heart className="w-5 h-5 mr-2" />, text: "Request Blood" }
    },
    {
      badge: { icon: <Bell className="w-5 h-5 text-red-600 mr-2 animate-pulse" />, text: "When Blood Is Needed" },
      title: { gradient: "Someone Needs Help,", normal: "Right Now" },
      description: "In urgent moments, quick connections can make a real difference.",
      primaryBtn: { to: "/donors", icon: <MapPin className="w-5 h-5 mr-2" />, text: "Find Nearby Requests" },
      secondaryBtn: { to: "/donor/register", icon: <Droplet className="w-5 h-5 mr-2" />, text: "Register to Help" }
    },
    {
      badge: { icon: <Gift className="w-5 h-5 text-red-600 mr-2" />, text: "Recognition & Gratitude" },
      title: { gradient: "Donate Blood,", normal: "Be Recognized" },
      description: "We aim to celebrate donors with community recognition and meaningful milestones.",
      primaryBtn: { to: "/donor/register", icon: <Star className="w-5 h-5 mr-2" />, text: "Explore Recognition" },
      secondaryBtn: { to: "/about", icon: <Award className="w-5 h-5 mr-2" />, text: "Learn More" }
    },
    {
      badge: { icon: <Users className="w-5 h-5 text-red-600 mr-2" />, text: "Community Impact" },
      title: { gradient: "Lives Changed,", normal: "Together" },
      description: "Be part of a growing community working to make blood access more reliable.",
      primaryBtn: { to: "/donor/register", icon: <Heart className="w-5 h-5 mr-2" />, text: "Join Our Community" },
      secondaryBtn: { to: "/about", icon: <TrendingUp className="w-5 h-5 mr-2" />, text: "View Impact" }
    }
  ];

  useEffect(() => {
    // Auto-play slider
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [heroSlides.length]);

  return (
    <div className="w-full overflow-hidden public-app-page public-app-home">
      {/* Hero Section - PhonePe-inspired Slider */}
      <section className="relative min-h-[95vh] flex items-center overflow-hidden">
        {/* Sophisticated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-pink-50">
          {/* Animated gradient orbs - PhonePe style */}
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-red-400 to-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-red-500 to-red-600 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-gradient-to-r from-pink-500 to-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

          {/* Subtle grid pattern */}
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]"></div>

          {/* Floating decorative elements */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-red-200/30 rounded-2xl rotate-12 animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-16 h-16 bg-pink-200/30 rounded-full animate-pulse animation-delay-2000"></div>
        </div>

        {/* Slider Container */}
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto mb-32">
            {heroSlides.map((slide, index) => (
              <div
                key={index}
                className={`text-center transition-all duration-700 ${
                  currentSlide === index
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 absolute inset-0 translate-y-10 pointer-events-none'
                }`}
              >
                <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-8">
                  {slide.badge.icon}
                  <span className="text-red-600 font-semibold">{slide.badge.text}</span>
                </div>

                <h1 className="text-6xl md:text-7xl font-extrabold mb-6">
                  <span className="bg-gradient-to-r from-red-600 via-red-700 to-red-900 bg-clip-text text-transparent">
                    {slide.title.gradient}
                  </span>
                  <br />
                  <span className="text-gray-900">{slide.title.normal}</span>
                </h1>

                <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
                  {slide.description}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                  <Link
                    to={slide.primaryBtn.to}
                    className="group relative px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full text-lg font-semibold hover:shadow-2xl transform hover:scale-105 transition-all duration-300 inline-flex items-center justify-center"
                  >
                    {slide.primaryBtn.icon}
                    {slide.primaryBtn.text}
                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    to={slide.secondaryBtn.to}
                    className="px-8 py-4 bg-white text-red-600 rounded-full text-lg font-semibold hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-2 border-red-600 inline-flex items-center justify-center"
                  >
                    {slide.secondaryBtn.icon}
                    {slide.secondaryBtn.text}
                  </Link>
                </div>
              </div>
            ))}

            {/* Slider Navigation Dots - Below content */}
            <div className="flex gap-3 justify-center mt-8">
              {heroSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`transition-all duration-500 rounded-full ${
                    currentSlide === index
                      ? 'w-12 h-3 bg-gradient-to-r from-red-600 to-red-700'
                      : 'w-3 h-3 bg-red-300 hover:bg-red-400'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Trust Indicators - Below dots */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-gray-600 pb-8">
            <div className="flex items-center">
              <Shield className="w-5 h-5 mr-2 text-green-600" />
              <span className="font-medium">Safety-first approach</span>
            </div>
            <div className="flex items-center">
              <Award className="w-5 h-5 mr-2 text-blue-600" />
              <span className="font-medium">Standards-focused</span>
            </div>
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-600" />
              <span className="font-medium">Growing donor community</span>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Stats Section */}
      <section className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Our Growing Impact</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Making a difference together, one donor at a time</p>
          </div>

          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:gap-6 md:gap-8">
            <StatCard
              icon={<Heart size={32} />}
              value="Growing"
              label="Lives Touched"
              gradient="bg-gradient-to-r from-red-500 to-pink-500"
            />
            <StatCard
              icon={<Users size={32} />}
              value="Thousands"
              label="Active Donors"
              gradient="bg-gradient-to-r from-red-600 to-red-700"
            />
            <StatCard
              icon={<Droplet size={32} />}
              value="Rising"
              label="Units Shared"
              gradient="bg-gradient-to-r from-red-700 to-red-800"
            />
            <StatCard
              icon={<Building2 size={32} />}
              value="Across India"
              label="BloodBank Partners"
              gradient="bg-gradient-to-r from-red-800 to-red-900"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Why People Choose BloodHub</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">A quick look at what makes the experience reliable and helpful.</p>
          </div>

          <div className="relative mx-auto max-w-5xl">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-gray-50 to-transparent lg:hidden" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-gray-50 to-transparent lg:hidden" />
            <div className="pointer-events-none absolute right-2 top-2 z-20 rounded-full border border-red-100 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-red-600 shadow-sm lg:hidden">
              Swipe →
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory sm:gap-6 md:gap-7 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
              {[
                {
                  icon: <Zap className="w-6 h-6 text-white" />,
                  title: 'Smarter Matching',
                  description: 'Connect the right donors to the right requests faster.',
                },
                {
                  icon: <Shield className="w-6 h-6 text-white" />,
                  title: 'Safety Focus',
                  description: 'Verification-aware workflows to promote trust and clarity.',
                },
                {
                  icon: <TrendingUp className="w-6 h-6 text-white" />,
                  title: 'Track Impact',
                  description: 'See your donation journey and community contribution over time.',
                },
              ].map((item) => (
                <div key={item.title} className="group relative min-h-[250px] min-w-[260px] flex-shrink-0 snap-start overflow-hidden rounded-2xl border border-white/50 bg-white/90 p-8 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:min-w-[300px] md:min-w-[340px] lg:min-w-0 lg:flex-shrink">
                  <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-gradient-to-r from-red-500 to-pink-500 opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20" />
                  <div className="relative z-10">
                    <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-r from-red-600 to-red-700 shadow-lg">
                      {item.icon}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{item.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-gray-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/about#why-choose-bloodhub"
              className="inline-flex items-center rounded-full border-2 border-red-600 px-6 py-3 font-semibold text-red-600 transition-all duration-300 hover:bg-red-600 hover:text-white"
            >
              Learn why people choose BloodHub
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Emergency Response - PhonePe-style slide */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Content */}
              <div>
                <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-6">
                  <Bell className="w-5 h-5 text-red-600 mr-2 animate-pulse" />
                  <span className="text-red-600 font-semibold">Emergency Support</span>
                </div>
                <h2 className="text-5xl font-bold mb-6">
                  <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                    Responsive Emergency Support
                  </span>
                </h2>
                <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                  In emergencies, time matters. We work to connect requests with nearby donors quickly and safely.
                </p>

                <div className="space-y-4">
                  {[
                    { icon: <Clock size={24} />, title: "Timely Alerts", desc: "Notifications when a request is nearby" },
                    { icon: <MapPin size={24} />, title: "Nearby Matching", desc: "Prioritize closer donors when possible" },
                    { icon: <Zap size={24} />, title: "Verified Profiles", desc: "Helpful checks to build trust" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-start group">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-red-600 to-red-700 mr-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                        <div className="text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                          {item.icon}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-1">{item.title}</h4>
                        <p className="text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  to="/request-blood"
                  className="inline-flex items-center mt-8 px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full text-lg font-bold hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
                >
                  <Bell className="w-5 h-5 mr-2" />
                  Request Blood
                  <ArrowRight className="ml-2" />
                </Link>
              </div>

              {/* Visual Stats */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-3xl blur-3xl opacity-20"></div>
                <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50">
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { value: "Fast", label: "Response Goal", icon: <Clock size={32} /> },
                      { value: "Nearby", label: "Local Focus", icon: <MapPin size={32} /> },
                      { value: "Always On", label: "Availability", icon: <Bell size={32} /> },
                      { value: "Trusted", label: "Community Care", icon: <CheckCircle size={32} /> }
                    ].map((stat, i) => (
                      <div key={i} className="group relative bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-2xl text-center hover:shadow-xl transition-all duration-500">
                        <div className="inline-flex p-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 mb-4 shadow-lg transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
                          <div className="text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                            {stat.icon}
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                        <div className="text-sm text-gray-600">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-700 to-red-800">
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">Ready to Make a Difference?</h2>
            <p className="text-xl md:text-2xl mb-12 opacity-90">Join a growing community of donors and supporters.</p>
            <Link
              to="/donor/register"
              className="inline-flex items-center px-10 py-5 bg-white text-red-600 rounded-full text-xl font-bold hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              <Droplet className="w-6 h-6 mr-3" />
              Become a Donor
              <ArrowRight className="ml-3" />
            </Link>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="text-4xl font-bold mb-2">Always</div>
                <div className="text-lg opacity-90">Emergency Support</div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="text-4xl font-bold mb-2">Quick</div>
                <div className="text-lg opacity-90">Response Goal</div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="text-4xl font-bold mb-2">Trusted</div>
                <div className="text-lg opacity-90">BloodBank Network</div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Final CTA - PhonePe-inspired premium */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-pink-50">
          {/* Floating gradient orbs */}
          <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-gradient-to-r from-red-400 to-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-pink-500 to-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-2000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="group relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl hover:shadow-[0_30px_60px_rgba(220,38,38,0.2)] p-12 max-w-4xl mx-auto text-center border border-white/50 overflow-hidden transition-all duration-500">
            {/* Decorative gradient orb */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-500"></div>

            {/* 3D Heart Icon with PhonePe-style depth */}
            <div className="relative mb-8 inline-block">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-800 rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-red-600 via-red-700 to-red-800 rounded-2xl flex items-center justify-center shadow-2xl transform group-hover:scale-110 group-hover:-translate-y-2 group-hover:rotate-12 transition-all duration-500 mx-auto"
                   style={{ boxShadow: '0 20px 40px rgba(220, 38, 38, 0.4)' }}>
                <Heart className="w-10 h-10 text-white" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
              </div>
            </div>

            <h3 className="relative text-4xl font-bold mb-4 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Every Moment Counts</h3>
            <p className="relative text-xl text-gray-700 mb-10 leading-relaxed max-w-2xl mx-auto">Someone, somewhere, needs blood every day. Be part of the response.</p>

            <div className="relative flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/donor/register"
                className="group/btn relative px-10 py-5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full text-lg font-bold hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1 transition-all duration-500 inline-flex items-center justify-center overflow-hidden"
                style={{ boxShadow: '0 10px 30px rgba(220, 38, 38, 0.3)' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-700 to-red-800 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"></div>
                <Droplet className="w-5 h-5 mr-2 relative z-10" />
                <span className="relative z-10">Become a Donor</span>
                <ArrowRight className="ml-2 relative z-10 group-hover/btn:translate-x-1 transition-transform duration-300" />
              </Link>
              <Link
                to="/request-blood"
                className="group/btn px-10 py-5 bg-white/80 backdrop-blur-xl text-red-600 rounded-full text-lg font-bold border-2 border-red-600 hover:bg-red-600 hover:text-white hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1 transition-all duration-500 inline-flex items-center justify-center"
              >
                <Heart className="w-5 h-5 mr-2" />
                Request Blood
                <ArrowRight className="ml-2 group-hover/btn:translate-x-1 transition-transform duration-300" />
              </Link>
            </div>

            {/* Trust indicators with glassmorphism */}
            <div className="relative mt-12 pt-8 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-red-50 to-pink-50 backdrop-blur-xl p-4 rounded-xl border border-red-100">
                <div className="flex items-center justify-center mb-2">
                  <Shield className="w-6 h-6 text-red-600 mr-2" />
                  <span className="font-bold text-gray-900">Security-minded</span>
                </div>
                <p className="text-sm text-gray-600">We take data protection seriously</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-pink-50 backdrop-blur-xl p-4 rounded-xl border border-red-100">
                <div className="flex items-center justify-center mb-2">
                  <Award className="w-6 h-6 text-red-600 mr-2" />
                  <span className="font-bold text-gray-900">Standards-aligned</span>
                </div>
                <p className="text-sm text-gray-600">Built with best practices in mind</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-pink-50 backdrop-blur-xl p-4 rounded-xl border border-red-100">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="w-6 h-6 text-red-600 mr-2" />
                  <span className="font-bold text-gray-900">Here to Help</span>
                </div>
                <p className="text-sm text-gray-600">Support when you need it</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
