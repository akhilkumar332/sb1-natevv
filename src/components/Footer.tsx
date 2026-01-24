import { Link } from 'react-router-dom';
import { Heart, Phone, Mail, MapPin, Facebook, Twitter, Instagram, Linkedin, AlertCircle } from 'lucide-react';
import LogoMark from './LogoMark';

function Footer() {
  return (
    <footer className="relative bg-gradient-to-br from-gray-50 to-white border-t border-gray-200 overflow-hidden">
      {/* Decorative gradient orbs - PhonePe style */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-to-r from-red-400 to-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-gradient-to-r from-pink-500 to-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 pointer-events-none"></div>

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* About Section */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <LogoMark className="w-8 h-8" />
              <div>
                <h3 className="text-xl font-extrabold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                  BloodHub
                </h3>
                <p className="text-[10px] text-gray-500 -mt-1 tracking-wider">INDIA</p>
              </div>
            </div>
            <p className="text-gray-600 mb-4 leading-relaxed text-sm">
              India's most advanced blood donation platform, connecting donors with those in need through cutting-edge technology and unwavering compassion.
            </p>
            <div className="flex items-center text-red-600 font-semibold">
              <Heart className="w-5 h-5 mr-2 animate-pulse" />
              <span>Saving Lives Together</span>
            </div>

            {/* Social Media - PhonePe-inspired */}
            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-900 mb-3">Follow Us</p>
              <div className="flex space-x-3">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative w-10 h-10 bg-white/80 backdrop-blur-xl hover:bg-white rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 shadow-md hover:shadow-lg border border-red-100"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                  <Facebook className="w-5 h-5 text-red-600 relative z-10" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative w-10 h-10 bg-white/80 backdrop-blur-xl hover:bg-white rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 shadow-md hover:shadow-lg border border-red-100"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                  <Twitter className="w-5 h-5 text-red-600 relative z-10" />
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative w-10 h-10 bg-white/80 backdrop-blur-xl hover:bg-white rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 shadow-md hover:shadow-lg border border-red-100"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                  <Instagram className="w-5 h-5 text-red-600 relative z-10" />
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative w-10 h-10 bg-white/80 backdrop-blur-xl hover:bg-white rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 shadow-md hover:shadow-lg border border-red-100"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                  <Linkedin className="w-5 h-5 text-red-600 relative z-10" />
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/donor/register"
                  className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                >
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Become a Donor
                </Link>
              </li>
              <li>
                <Link
                  to="/request-blood"
                  className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                >
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Request Blood
                </Link>
              </li>
              <li>
                <Link
                  to="/donors"
                  className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                >
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Find Donors
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                >
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                >
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Resources</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/donor/login"
                  className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                >
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Donor Portal
                </Link>
              </li>
              <li>
                <Link
                  to="/hospital/login"
                  className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                >
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Hospital Portal
                </Link>
              </li>
              <li>
                <Link
                  to="/ngo/login"
                  className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                >
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  NGO Portal
                </Link>
              </li>
              <li>
                <Link
                  to="/faq"
                  className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                >
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  to="/blog"
                  className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                >
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Emergency */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Get in Touch</h3>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start text-gray-600 group">
                <Phone className="w-5 h-5 mr-3 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">General Inquiries</p>
                  <a href="tel:+911800123456" className="hover:text-red-600 transition-colors">
                    +91 1800-123-456
                  </a>
                </div>
              </li>
              <li className="flex items-start text-gray-600 group">
                <Mail className="w-5 h-5 mr-3 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Email Us</p>
                  <a href="mailto:contact@bloodhub.in" className="hover:text-red-600 transition-colors">
                    contact@bloodhub.in
                  </a>
                </div>
              </li>
              <li className="flex items-start text-gray-600">
                <MapPin className="w-5 h-5 mr-3 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Head Office</p>
                  <p className="text-sm">New Delhi, India</p>
                </div>
              </li>
            </ul>

            {/* Emergency Box - PhonePe-inspired glassmorphism */}
            <div className="group relative bg-white/80 backdrop-blur-xl p-4 rounded-xl border border-red-200 hover:shadow-xl transition-all duration-500 overflow-hidden">
              {/* Decorative orb */}
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>

              <div className="relative z-10">
                <div className="flex items-center mb-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-r from-red-600 to-red-700 mr-2 shadow-md transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <AlertCircle className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                  </div>
                  <p className="text-red-700 font-bold">24/7 Emergency</p>
                </div>
                <a
                  href="tel:+911800999888"
                  className="text-red-600 font-bold text-lg hover:text-red-700 transition-colors block"
                >
                  +91 1800-999-888
                </a>
                <p className="text-xs text-gray-600 mt-1">Available round the clock</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4">
              <p className="text-gray-600 text-sm">
                © {new Date().getFullYear()} BloodHub India. All rights reserved.
              </p>
              <div className="flex items-center text-xs text-gray-500">
                <Heart className="w-3 h-3 text-red-600 mr-1" />
                <span>Made with love for humanity</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              <Link
                to="/privacy"
                className="text-gray-600 hover:text-red-600 text-sm transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-gray-600 hover:text-red-600 text-sm transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                to="/disclaimer"
                className="text-gray-600 hover:text-red-600 text-sm transition-colors"
              >
                Disclaimer
              </Link>
              <Link
                to="/sitemap"
                className="text-gray-600 hover:text-red-600 text-sm transition-colors"
              >
                Sitemap
              </Link>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-center text-xs text-gray-500 leading-relaxed">
              BloodHub is committed to connecting blood donors with those in need across India.
              We facilitate voluntary blood donation and do not store or sell blood.
              All donations are made directly at registered hospitals and blood banks.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
