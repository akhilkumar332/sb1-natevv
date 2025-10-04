import { Link } from 'react-router-dom';
import { Heart, Phone, Mail, MapPin, Droplet, Facebook, Twitter, Instagram, Linkedin, AlertCircle } from 'lucide-react';

function Footer() {
  return (
    <footer className="bg-gradient-to-br from-gray-50 to-white border-t border-gray-100">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* About Section */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative">
                <Droplet className="w-8 h-8 text-red-600" />
                <Heart className="w-3 h-3 text-red-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
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

            {/* Social Media */}
            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-900 mb-3">Follow Us</p>
              <div className="flex space-x-3">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 rounded-full flex items-center justify-center transition-all transform hover:scale-110"
                >
                  <Facebook className="w-5 h-5 text-red-600" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 rounded-full flex items-center justify-center transition-all transform hover:scale-110"
                >
                  <Twitter className="w-5 h-5 text-red-600" />
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 rounded-full flex items-center justify-center transition-all transform hover:scale-110"
                >
                  <Instagram className="w-5 h-5 text-red-600" />
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 rounded-full flex items-center justify-center transition-all transform hover:scale-110"
                >
                  <Linkedin className="w-5 h-5 text-red-600" />
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

            {/* Emergency Box */}
            <div className="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-xl border-2 border-red-100">
              <div className="flex items-center mb-2">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                <p className="text-red-700 font-bold">24/7 Emergency</p>
              </div>
              <a
                href="tel:+911800999888"
                className="text-red-600 font-bold text-lg hover:text-red-700 transition-colors"
              >
                +91 1800-999-888
              </a>
              <p className="text-xs text-gray-600 mt-1">Available round the clock</p>
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
