import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Droplet, Users, Building2, ChevronDown, ArrowRight, Activity, Calendar, MapPin, Shield, Award, Clock, Target } from 'lucide-react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

function FeatureCard({ icon, title, description, gradient }: FeatureCardProps) {
  return (
    <div className="group relative p-8 bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 overflow-hidden">
      <div className={`absolute inset-0 ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
      <div className={`mb-6 inline-flex p-4 rounded-xl ${gradient} bg-opacity-10`}>
        <div className="text-red-600">{icon}</div>
      </div>
      <h3 className="text-xl font-bold mb-3 text-gray-900">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
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
      <h2 className="text-4xl font-bold mb-12 text-center bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">Frequently Asked Questions</h2>
      <div className="space-y-4">
        {faqItems.map((item, index) => (
          <div key={index} className="bg-white rounded-xl shadow-md overflow-hidden">
            <button
              className="flex justify-between items-center w-full text-left p-6 hover:bg-gray-50 transition"
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            >
              <span className="font-semibold text-lg text-gray-900">{item.question}</span>
              <ChevronDown className={`transform transition-transform text-red-600 ${openIndex === index ? 'rotate-180' : ''}`} />
            </button>
            {openIndex === index && (
              <div className="px-6 pb-6">
                <p className="text-gray-600 leading-relaxed">{item.answer}</p>
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
      <div className={`absolute inset-0 ${gradient} rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity`}></div>
      <div className="relative bg-white p-8 rounded-2xl shadow-xl text-center transform group-hover:scale-105 transition-transform duration-300">
        <div className={`inline-flex p-4 rounded-xl ${gradient} bg-opacity-10 mb-4`}>
          <div className="text-red-600">{icon}</div>
        </div>
        <div className="text-4xl font-bold mb-2 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">{value}</div>
        <div className="text-gray-600 font-medium">{label}</div>
      </div>
    </div>
  );
}

function TestimonialCard({ quote, author, role }: { quote: string; author: string; role: string }) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
      <div className="flex items-center mb-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-xl">
          {author[0]}
        </div>
        <div className="ml-4">
          <p className="font-bold text-gray-900">{author}</p>
          <p className="text-sm text-gray-500">{role}</p>
        </div>
      </div>
      <p className="text-gray-600 italic leading-relaxed">"{quote}"</p>
    </div>
  );
}

function Home() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="w-full overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-red-50">
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          <div className="absolute top-20 right-20 w-72 h-72 bg-red-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-red-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className={`max-w-4xl mx-auto text-center transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-8">
              <Droplet className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-semibold">India's Leading Blood Donation Platform</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-extrabold mb-6">
              <span className="bg-gradient-to-r from-red-600 via-red-700 to-red-900 bg-clip-text text-transparent">
                Every Drop Counts,
              </span>
              <br />
              <span className="text-gray-900">Every Life Matters</span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Join thousands of heroes saving lives through blood donation. Your contribution can make the difference between life and death.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/donor/register"
                className="group relative px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full text-lg font-semibold hover:shadow-2xl transform hover:scale-105 transition-all duration-300 inline-flex items-center justify-center"
              >
                <Droplet className="w-5 h-5 mr-2" />
                Become a Donor
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/request-blood"
                className="px-8 py-4 bg-white text-red-600 rounded-full text-lg font-semibold hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-2 border-red-600 inline-flex items-center justify-center"
              >
                <Heart className="w-5 h-5 mr-2" />
                Request Blood
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-gray-600">
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

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-r from-gray-50 to-red-50">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-3xl shadow-xl p-12 max-w-4xl mx-auto text-center border-2 border-red-100">
            <Heart className="w-16 h-16 text-red-600 mx-auto mb-6" />
            <h3 className="text-3xl font-bold mb-4 text-gray-900">Every Second Counts</h3>
            <p className="text-xl text-gray-600 mb-8">Someone needs blood every 2 seconds. Be the reason someone survives.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/donor/register"
                className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full text-lg font-semibold hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              >
                Register as Donor
              </Link>
              <Link
                to="/request-blood"
                className="px-8 py-4 bg-white text-red-600 rounded-full text-lg font-semibold border-2 border-red-600 hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              >
                Request Blood Now
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
