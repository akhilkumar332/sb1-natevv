import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Droplet, Users, Building2, ChevronDown, ArrowRight, Activity, Calendar, MapPin } from 'lucide-react';
import Slider from 'react-slick';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition border border-gray-100">
      <div className="mb-4 text-red-500">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
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
    <div className="max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
      {faqItems.map((item, index) => (
        <div key={index} className="mb-4 border-b border-gray-200 pb-4">
          <button
            className="flex justify-between items-center w-full text-left"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
          >
            <span className="font-semibold">{item.question}</span>
            <ChevronDown className={`transform transition-transform ${openIndex === index ? 'rotate-180' : ''}`} />
          </button>
          {openIndex === index && (
            <p className="mt-2 text-gray-600">{item.answer}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-md text-center">
      <div className="text-red-500 mb-4">{icon}</div>
      <div className="text-3xl font-bold mb-2">{value}</div>
      <div className="text-gray-600">{label}</div>
    </div>
  );
}

function TestimonialCard({ quote, author }: { quote: string; author: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <p className="text-gray-600 italic mb-4">"{quote}"</p>
      <p className="font-semibold">- {author}</p>
    </div>
  );
}

function Home() {
  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000, // 5 seconds pause
    fade: true,
    cssEase: 'linear',
    arrows: true,
    appendDots: (dots: any) => (
      <div style={{ position: 'absolute', bottom: '20px', width: '100%' }}>
        <ul style={{ margin: '0px' }}> {dots} </ul>
      </div>
    ),
    customPaging: () => (
      <div className="w-3 h-3 mx-1 rounded-full bg-white opacity-50 hover:opacity-100 transition duration-200" />
    ),
  };

  const sliderContent = [
    {
      image: "https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&q=80&w=2000",
      title: "Every Drop Counts",
      description: "Your blood donation can save up to three lives"
    },
    {
      image: "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&q=80&w=2000",
      title: "Be a Hero",
      description: "Regular blood donation makes a real difference in your community"
    },
    {
      image: "https://images.unsplash.com/photo-1536856136534-bb679c52a9aa?auto=format&fit=crop&q=80&w=2000",
      title: "Safe and Simple",
      description: "Modern blood donation is quick, safe, and comfortable"
    },
    {
      image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=2000",
      title: "Join Our Community",
      description: "Connect with others who share your commitment to saving lives"
    },
    {
      image: "https://images.unsplash.com/photo-1628348070889-cb656235b4eb?auto=format&fit=crop&q=80&w=2000",
      title: "Emergency Ready",
      description: "Help maintain a stable blood supply for emergency situations"
    }
  ];

  return (
    <div className="w-full">
      {/* Hero Section with Slider */}
      <section className="relative h-[600px]">
        <Slider {...sliderSettings}>
          {sliderContent.map((slide, index) => (
            <div key={index} className="relative h-[600px]">
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${slide.image})`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/50" />
              </div>
              <div className="relative h-full flex items-center">
                <div className="container mx-auto px-4">
                  <div className="max-w-3xl">
                    <h1 className="text-5xl md:text-6xl font-bold mb-6 text-white">
                      {slide.title}
                    </h1>
                    <p className="text-2xl mb-12 text-white">
                      {slide.description}
                    </p>
                    <div className="flex gap-4">
                      <Link 
                        to="/donor/register" 
                        className="bg-red-600 text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-red-700 transition" >
                        Become a Donor
                      </Link>
                      <Link 
                        to="/about" 
                        className="bg-white text-red-600 px-8 py-3 rounded-full text-lg font-semibold hover:bg-gray-100 transition"
                      >
                        Learn More
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Slider>
      </section>

      <section className="py-20 bg-gray-100">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 text-center">Our Impact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <StatCard icon={<Heart size={32} />} value="10,000+" label="Lives Saved" />
            <StatCard icon={<Users size={32} />} value="5,000+" label="Active Donors" />
            <StatCard icon={<Droplet size={32} />} value="15,000+" label="Blood Units Collected" />
            <StatCard icon={<Building2 size={32} />} value="100+" label="Partner Hospitals" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 text-center">What We Offer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Heart size={32} />}
              title="Blood Donation"
              description="Donate blood to help save lives in your community."
            />
            <FeatureCard
              icon={<Droplet size={32} />}
              title="Blood Testing"
              description="Get tested for blood type and other vital information."
            />
            <FeatureCard
              icon={<Users size={32} />}
              title="Community Support"
              description="Connect with others who share your commitment to saving lives."
            />
            <FeatureCard
              icon={<Building2 size={32} />}
              title="Blood Bank Management"
              description="Efficiently manage blood inventory and distribution."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-red-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Make a Difference?</h2>
          <p className="text-xl mb-8">Join our community of heroes and start saving lives today.</p>
          <Link 
            to="/donor/register" 
            className="bg-white text-red-600 px-8 py-3 rounded-full text-lg font-semibold hover:bg-gray-100 transition inline-flex items-center"
          >
            Become a Donor <ArrowRight className="ml-2" />
          </Link>
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 text-center">Upcoming Blood Drives</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-md">
              <Calendar className="text-red-500 mb-4" size={32} />
              <h3 className="text-xl font-semibold mb-2">Community Center Drive</h3>
              <p className="text-gray-600 mb-4">Join us for our monthly blood drive at the local community center.</p>
              <div className="flex items-center text-gray-500">
                <MapPin size={16} className="mr-2" />
                <span>123 Main St, Anytown, USA</span>
              </div>
              <div className="flex items-center text-gray-500 mt-2">
                <Calendar size={16} className="mr-2" />
                <span>May 15, 2023 | 9:00 AM - 5:00 PM</span>
              </div>
            </div>
            {/* Add more event cards here */}
          </div>
          <div className="text-center mt-12">
            <Link to="/events" className="text-red-600 font-semibold hover:text-red-700 transition inline-flex items-center">
              View All Events <ArrowRight className="ml-2" size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 text-center">What Our Donors Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <TestimonialCard 
              quote="Donating blood with LifeFlow was an incredibly rewarding experience. The staff was friendly, and I felt great knowing I was helping others."
              author="John D., Regular Donor"
            />
            <TestimonialCard 
              quote="As a recipient of blood donations, I can't express how grateful I am for services like LifeFlow. They truly save lives!"
              author="Sarah M., Blood Recipient"
            />
            <TestimonialCard 
              quote="The process was quick and easy. I'll definitely be coming back to donate regularly!"
              author="Mike R., First-time Donor"
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <FAQ />
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-r from-red-600 to-red-800 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Be a Hero Today</h2>
          <p className="text-xl mb-8">Your donation can make all the difference. Join us in our mission to save lives.</p>
          <div className="flex justify-center space- 4">
            <Link 
              to="/donor/register" 
              className="bg-white text-red-600 px-8 py-3 rounded-full text-lg font-semibold hover:bg-gray-100 transition inline-flex items-center"
            >
              Become a Donor <ArrowRight className="ml-2" />
            </Link>
            <Link 
              to="/about" 
              className="bg-white text-red-600 px-8 py-3 rounded-full text-lg font-semibold hover:bg-gray-100 transition inline-flex items-center"
            >
              Learn More <Activity className="ml-2" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;