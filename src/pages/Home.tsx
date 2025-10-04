import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Droplet, Users, Building2, ChevronDown, ArrowRight, Activity, Calendar, MapPin, Shield, Award, Clock, Target, Zap, TrendingUp, Star, Gift, Bell, CheckCircle } from 'lucide-react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

function FeatureCard({ icon, title, description, gradient }: FeatureCardProps) {
  return (
    <div className="group relative p-8 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 border border-white/20 overflow-hidden">
      {/* Floating gradient background */}
      <div className={`absolute inset-0 ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>

      {/* Decorative gradient orb */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 ${gradient} rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500`}></div>

      {/* 3D Icon container with PhonePe-style depth */}
      <div className="relative mb-6">
        <div className={`inline-flex p-5 rounded-2xl ${gradient} shadow-2xl transform group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500`}
             style={{ boxShadow: '0 20px 40px rgba(220, 38, 38, 0.3)' }}>
          <div className="text-white transform group-hover:rotate-12 transition-transform duration-500"
               style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
            {icon}
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold mb-3 text-gray-900 group-hover:text-red-600 transition-colors duration-300">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>

      {/* Hover arrow indicator */}
      <div className="mt-4 flex items-center text-red-600 opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-2 transition-all duration-300">
        <span className="text-sm font-semibold mr-1">Learn more</span>
        <ArrowRight className="w-4 h-4" />
      </div>
    </div>
  );
}

function FAQ() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  const faqItems = [
    {
      question: "Who can donate blood?",
      answer: "Most healthy adults aged 18-65 can donate blood. Some criteria include weighing at least 110 pounds and being in good general health."
    },
    {
      question: "How often can I donate blood?",
      answer: "Whole blood donors can give blood every 56 days. Plasma donors can donate more frequently, typically every 28 days."
    },
    {
      question: "Is blood donation safe?",
      answer: "Yes, blood donation is very safe. New, sterile equipment is used for each donor, and the process is conducted by trained professionals."
    },
    {
      question: "How long does a blood donation take?",
      answer: "The entire process takes about an hour, with the actual blood donation taking only about 8-10 minutes."
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-5xl font-bold mb-12 text-center bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Frequently Asked Questions</h2>
      <div className="space-y-4">
        {faqItems.map((item, index) => (
          <div key={index} className="group relative bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-2xl overflow-hidden border border-white/50 transition-all duration-500">
            {/* Subtle gradient orb */}
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
  );
}

function StatCard({ icon, value, label, gradient }: { icon: React.ReactNode; value: string; label: string; gradient: string }) {
  return (
    <div className="relative group">
      {/* Glowing gradient background - PhonePe style */}
      <div className={`absolute inset-0 ${gradient} rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500`}></div>

      {/* Glassmorphic card */}
      <div className="relative bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl text-center transform group-hover:scale-105 group-hover:-translate-y-2 transition-all duration-500 border border-white/50">
        {/* Floating orb decoration */}
        <div className={`absolute -top-6 -right-6 w-24 h-24 ${gradient} rounded-full blur-2xl opacity-30`}></div>

        {/* 3D Icon with depth */}
        <div className="relative mb-4">
          <div className={`inline-flex p-5 rounded-2xl ${gradient} shadow-2xl transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500`}
               style={{ boxShadow: '0 25px 50px rgba(220, 38, 38, 0.4)' }}>
            <div className="text-white" style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.4))' }}>{icon}</div>
          </div>
        </div>

        {/* Animated counter */}
        <div className="text-5xl font-extrabold mb-2 bg-gradient-to-br from-red-600 via-red-700 to-red-900 bg-clip-text text-transparent transform group-hover:scale-110 transition-transform duration-300">
          {value}
        </div>
        <div className="text-gray-700 font-semibold text-lg">{label}</div>

        {/* Subtle bottom accent */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-b-3xl`}></div>
      </div>
    </div>
  );
}

function TestimonialCard({ quote, author, role }: { quote: string; author: string; role: string }) {
  return (
    <div className="group relative bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 border border-white/50 overflow-hidden">
      {/* Subtle gradient orb */}
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-500"></div>

      <div className="relative">
        {/* Quote mark decoration */}
        <div className="absolute -top-2 -left-2 text-6xl text-red-100 font-serif">"</div>

        <div className="flex items-center mb-6 relative z-10">
          <div className="relative">
            {/* Glowing ring around avatar */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-800 rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>

            <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center text-white font-bold text-xl shadow-xl transform group-hover:scale-110 transition-transform duration-500">
              {author[0]}
            </div>
          </div>

          <div className="ml-4">
            <p className="font-bold text-gray-900 text-lg">{author}</p>
            <p className="text-sm text-red-600 font-medium">{role}</p>
          </div>
        </div>

        <p className="text-gray-700 leading-relaxed relative z-10 text-lg">"{quote}"</p>

        {/* 5-star rating */}
        <div className="flex gap-1 mt-4">
          {[...Array(5)].map((_, i) => (
            <Heart key={i} className="w-4 h-4 fill-red-500 text-red-500" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const heroSlides = [
    {
      badge: { icon: <Droplet className="w-5 h-5 text-red-600 mr-2" />, text: "India's Leading Blood Donation Platform" },
      title: { gradient: "Every Drop Counts,", normal: "Every Life Matters" },
      description: "Join thousands of heroes saving lives through blood donation. Your contribution can make the difference between life and death.",
      primaryBtn: { to: "/donor/register", icon: <Droplet className="w-5 h-5 mr-2" />, text: "Become a Donor" },
      secondaryBtn: { to: "/request-blood", icon: <Heart className="w-5 h-5 mr-2" />, text: "Request Blood" }
    },
    {
      badge: { icon: <Bell className="w-5 h-5 text-red-600 mr-2 animate-pulse" />, text: "Emergency Blood Needed" },
      title: { gradient: "Someone Needs You", normal: "Right Now" },
      description: "Every 2 seconds, someone in India needs blood. Your donation today could be the miracle someone is waiting for.",
      primaryBtn: { to: "/donors", icon: <MapPin className="w-5 h-5 mr-2" />, text: "Find Emergency Requests" },
      secondaryBtn: { to: "/donor/register", icon: <Droplet className="w-5 h-5 mr-2" />, text: "Register to Help" }
    },
    {
      badge: { icon: <Gift className="w-5 h-5 text-red-600 mr-2" />, text: "Rewards & Recognition" },
      title: { gradient: "Donate Blood,", normal: "Earn Rewards" },
      description: "Get recognized with badges, certificates, and exclusive benefits. Track your impact and see the lives you've saved.",
      primaryBtn: { to: "/donor/register", icon: <Star className="w-5 h-5 mr-2" />, text: "Join Rewards Program" },
      secondaryBtn: { to: "/about", icon: <Award className="w-5 h-5 mr-2" />, text: "Learn More" }
    },
    {
      badge: { icon: <Users className="w-5 h-5 text-red-600 mr-2" />, text: "Community Impact" },
      title: { gradient: "100,000+ Lives", normal: "Saved Together" },
      description: "Be part of India's largest blood donation community. Together, we're making blood scarcity a thing of the past.",
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
    <div className="w-full overflow-hidden">
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
              <span className="font-medium">100% Safe & Secure</span>
            </div>
            <div className="flex items-center">
              <Award className="w-5 h-5 mr-2 text-blue-600" />
              <span className="font-medium">WHO Certified</span>
            </div>
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-600" />
              <span className="font-medium">50,000+ Active Donors</span>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Stats Section */}
      <section className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Our Impact</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Making a real difference in communities across India</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <StatCard
              icon={<Heart size={32} />}
              value="100,000+"
              label="Lives Saved"
              gradient="bg-gradient-to-r from-red-500 to-pink-500"
            />
            <StatCard
              icon={<Users size={32} />}
              value="50,000+"
              label="Active Donors"
              gradient="bg-gradient-to-r from-red-600 to-red-700"
            />
            <StatCard
              icon={<Droplet size={32} />}
              value="250,000+"
              label="Blood Units Collected"
              gradient="bg-gradient-to-r from-red-700 to-red-800"
            />
            <StatCard
              icon={<Building2 size={32} />}
              value="500+"
              label="Partner Hospitals"
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
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Why Choose BloodHub?</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Experience the most advanced blood donation platform in India</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Target size={32} />}
              title="Smart Matching"
              description="AI-powered donor matching ensures the right blood type reaches those in need instantly."
              gradient="bg-gradient-to-r from-red-500 to-pink-500"
            />
            <FeatureCard
              icon={<Clock size={32} />}
              title="Real-time Updates"
              description="Get instant notifications for emergency blood requests in your area."
              gradient="bg-gradient-to-r from-red-600 to-red-700"
            />
            <FeatureCard
              icon={<Shield size={32} />}
              title="100% Safe"
              description="Verified hospitals and blood banks ensure complete safety and transparency."
              gradient="bg-gradient-to-r from-red-700 to-red-800"
            />
            <FeatureCard
              icon={<Award size={32} />}
              title="Earn Rewards"
              description="Get recognized with badges, certificates, and exclusive donor benefits."
              gradient="bg-gradient-to-r from-red-800 to-red-900"
            />
            <FeatureCard
              icon={<Activity size={32} />}
              title="Track Impact"
              description="Monitor your donation history and see the lives you've helped save."
              gradient="bg-gradient-to-r from-pink-600 to-red-600"
            />
            <FeatureCard
              icon={<Users size={32} />}
              title="Community Driven"
              description="Join a passionate community of donors committed to saving lives."
              gradient="bg-gradient-to-r from-red-600 to-red-700"
            />
            <FeatureCard
              icon={<Calendar size={32} />}
              title="Blood Camps"
              description="Participate in organized blood donation camps near your location."
              gradient="bg-gradient-to-r from-red-700 to-red-800"
            />
            <FeatureCard
              icon={<MapPin size={32} />}
              title="Find Nearby"
              description="Locate blood banks and donation centers with our interactive map."
              gradient="bg-gradient-to-r from-red-800 to-red-900"
            />
          </div>
        </div>
      </section>

      {/* Benefits of Blood Donation - PhonePe-style slide */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-red-50 to-pink-50">
          {/* Animated gradient orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-pink-400 to-red-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-red-500 to-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-6">
              <Heart className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-semibold">Health Benefits</span>
            </div>
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Benefits of Donating Blood
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">Giving blood doesn't just save lives—it's good for you too!</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: <Heart size={32} />,
                title: "Reduces Heart Disease Risk",
                description: "Regular blood donation helps reduce iron levels, lowering the risk of heart attacks and cardiovascular diseases.",
                gradient: "bg-gradient-to-r from-red-500 to-pink-500"
              },
              {
                icon: <Activity size={32} />,
                title: "Free Health Screening",
                description: "Get a mini health checkup with every donation including blood pressure, hemoglobin, and blood type testing.",
                gradient: "bg-gradient-to-r from-red-600 to-red-700"
              },
              {
                icon: <Zap size={32} />,
                title: "Stimulates Blood Production",
                description: "Your body replenishes the donated blood, stimulating the production of new, healthy blood cells.",
                gradient: "bg-gradient-to-r from-red-700 to-red-800"
              },
              {
                icon: <TrendingUp size={32} />,
                title: "Burns Calories",
                description: "Donating one pint of blood can burn approximately 650 calories, supporting your fitness goals.",
                gradient: "bg-gradient-to-r from-pink-600 to-red-600"
              },
              {
                icon: <Shield size={32} />,
                title: "Cancer Risk Reduction",
                description: "Studies show regular blood donation may reduce the risk of certain cancers by maintaining healthy iron levels.",
                gradient: "bg-gradient-to-r from-red-600 to-red-700"
              },
              {
                icon: <Star size={32} />,
                title: "Emotional Well-being",
                description: "Experience the joy and satisfaction of knowing you've saved up to three lives with each donation.",
                gradient: "bg-gradient-to-r from-red-700 to-red-800"
              }
            ].map((benefit, index) => (
              <div key={index} className="group relative">
                <div className={`absolute inset-0 ${benefit.gradient} rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500`}></div>
                <div className="relative bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 border border-white/50 overflow-hidden">
                  {/* Decorative orb */}
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

      {/* Emergency Response - PhonePe-style slide */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Content */}
              <div>
                <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-6">
                  <Bell className="w-5 h-5 text-red-600 mr-2 animate-pulse" />
                  <span className="text-red-600 font-semibold">Emergency Ready</span>
                </div>
                <h2 className="text-5xl font-bold mb-6">
                  <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                    Lightning-Fast Emergency Response
                  </span>
                </h2>
                <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                  Every second counts in an emergency. Our AI-powered platform instantly connects you with the nearest verified donors, ensuring help arrives when you need it most.
                </p>

                <div className="space-y-4">
                  {[
                    { icon: <Clock size={24} />, title: "Instant Alerts", desc: "Real-time notifications to nearby donors" },
                    { icon: <MapPin size={24} />, title: "Location-Based Matching", desc: "Find donors within 5km radius" },
                    { icon: <Zap size={24} />, title: "Quick Verification", desc: "Pre-verified donors for faster response" }
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
                  Request Blood Now
                  <ArrowRight className="ml-2" />
                </Link>
              </div>

              {/* Visual Stats */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-3xl blur-3xl opacity-20"></div>
                <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50">
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { value: "< 10min", label: "Avg Response", icon: <Clock size={32} /> },
                      { value: "5km", label: "Search Radius", icon: <MapPin size={32} /> },
                      { value: "24/7", label: "Always Active", icon: <Bell size={32} /> },
                      { value: "100%", label: "Success Rate", icon: <CheckCircle size={32} /> }
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

      {/* Donor Rewards - PhonePe-style slide */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-pink-50">
          <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-gradient-to-r from-red-400 to-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-6">
              <Gift className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-semibold">Rewards & Recognition</span>
            </div>
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Get Rewarded for Saving Lives
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">Earn badges, certificates, and exclusive benefits with every donation</p>
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-4 gap-6">
            {[
              { icon: <Star size={40} />, title: "Bronze Donor", donations: "1-5", color: "from-orange-600 to-orange-700" },
              { icon: <Star size={40} />, title: "Silver Donor", donations: "6-15", color: "from-gray-400 to-gray-500" },
              { icon: <Star size={40} />, title: "Gold Donor", donations: "16-30", color: "from-yellow-500 to-yellow-600" },
              { icon: <Star size={40} />, title: "Platinum Hero", donations: "30+", color: "from-purple-600 to-purple-700" }
            ].map((tier, i) => (
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
            {[
              { icon: <Award size={24} />, title: "Digital Certificates", desc: "Download and share your impact" },
              { icon: <Gift size={24} />, title: "Partner Discounts", desc: "Exclusive offers from 100+ brands" },
              { icon: <Heart size={24} />, title: "Impact Tracking", desc: "See the lives you've saved" }
            ].map((perk, i) => (
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

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-700 to-red-800">
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">Ready to Save Lives?</h2>
            <p className="text-xl md:text-2xl mb-12 opacity-90">Join our community of heroes and start making a difference today.</p>
            <Link
              to="/donor/register"
              className="inline-flex items-center px-10 py-5 bg-white text-red-600 rounded-full text-xl font-bold hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              <Droplet className="w-6 h-6 mr-3" />
              Become a Donor Now
              <ArrowRight className="ml-3" />
            </Link>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="text-4xl font-bold mb-2">24/7</div>
                <div className="text-lg opacity-90">Emergency Support</div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="text-4xl font-bold mb-2">&lt; 10min</div>
                <div className="text-lg opacity-90">Average Response Time</div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="text-4xl font-bold mb-2">100%</div>
                <div className="text-lg opacity-90">Verified Hospitals</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Stories from Our Heroes</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Real experiences from real donors making a real impact</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard
              quote="BloodHub made my first blood donation experience seamless and rewarding. The app is incredibly user-friendly, and I love tracking my impact!"
              author="Priya Sharma"
              role="Regular Donor"
            />
            <TestimonialCard
              quote="I received a critical blood request notification and was able to help save a life within hours. This platform is truly life-changing."
              author="Rahul Mehta"
              role="Emergency Responder"
            />
            <TestimonialCard
              quote="As a hospital administrator, BloodHub has revolutionized how we manage blood requests. The response time is incredible!"
              author="Dr. Anjali Verma"
              role="Medical Director"
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <FAQ />
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

            <h3 className="relative text-4xl font-bold mb-4 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Every Second Counts</h3>
            <p className="relative text-xl text-gray-700 mb-10 leading-relaxed max-w-2xl mx-auto">Someone needs blood every 2 seconds. Be the reason someone survives.</p>

            <div className="relative flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/donor/register"
                className="group/btn relative px-10 py-5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full text-lg font-bold hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1 transition-all duration-500 inline-flex items-center justify-center overflow-hidden"
                style={{ boxShadow: '0 10px 30px rgba(220, 38, 38, 0.3)' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-700 to-red-800 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"></div>
                <Droplet className="w-5 h-5 mr-2 relative z-10" />
                <span className="relative z-10">Register as Donor</span>
                <ArrowRight className="ml-2 relative z-10 group-hover/btn:translate-x-1 transition-transform duration-300" />
              </Link>
              <Link
                to="/request-blood"
                className="group/btn px-10 py-5 bg-white/80 backdrop-blur-xl text-red-600 rounded-full text-lg font-bold border-2 border-red-600 hover:bg-red-600 hover:text-white hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1 transition-all duration-500 inline-flex items-center justify-center"
              >
                <Heart className="w-5 h-5 mr-2" />
                Request Blood Now
                <ArrowRight className="ml-2 group-hover/btn:translate-x-1 transition-transform duration-300" />
              </Link>
            </div>

            {/* Trust indicators with glassmorphism */}
            <div className="relative mt-12 pt-8 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-red-50 to-pink-50 backdrop-blur-xl p-4 rounded-xl border border-red-100">
                <div className="flex items-center justify-center mb-2">
                  <Shield className="w-6 h-6 text-red-600 mr-2" />
                  <span className="font-bold text-gray-900">100% Secure</span>
                </div>
                <p className="text-sm text-gray-600">Your data is protected</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-pink-50 backdrop-blur-xl p-4 rounded-xl border border-red-100">
                <div className="flex items-center justify-center mb-2">
                  <Award className="w-6 h-6 text-red-600 mr-2" />
                  <span className="font-bold text-gray-900">WHO Certified</span>
                </div>
                <p className="text-sm text-gray-600">Globally recognized standards</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-pink-50 backdrop-blur-xl p-4 rounded-xl border border-red-100">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="w-6 h-6 text-red-600 mr-2" />
                  <span className="font-bold text-gray-900">24/7 Support</span>
                </div>
                <p className="text-sm text-gray-600">Always here to help</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
