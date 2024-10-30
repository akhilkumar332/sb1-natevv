import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Phone, Mail, MapPin } from 'lucide-react';

function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">About LifeFlow</h3>
            <p className="text-gray-600 mb-4">
              Connecting blood donors with those in need, making a difference one donation at a time.
            </p>
            <div className="flex items-center text-red-500">
              <Heart className="w-5 h-5 mr-2" />
              <span>Saving Lives Together</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/donor/register" className="text-gray-600 hover:text-red-500">
                  Become a Donor
                </Link>
              </li>
              <li>
                <Link to="/request-blood" className="text-gray-600 hover:text-red-500">
                  Request Blood
                </Link>
              </li>
              <li>
                <Link to="/donors" className="text-gray-600 hover:text-red-500">
                  Find Donors
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-600 hover:text-red-500">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-2">
              <li className="flex items-center text-gray-600">
                <Phone className="w-5 h-5 mr-2" />
                <span>+1 (555) 123-4567</span>
              </li>
              <li className="flex items-center text-gray-600">
                <Mail className="w-5 h-5 mr-2" />
                <span>contact@lifeflow.org</span>
              </li>
              <li className="flex items-center text-gray-600">
                <MapPin className="w-5 h-5 mr-2" />
                <span>123 Life Street, Health City</span>
              </li>
            </ul>
          </div>

          {/* Emergency */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Emergency</h3>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-red-700 font-semibold mb-2">24/7 Blood Support</p>
              <p className="text-red-600">Emergency: +1 (555) 999-8888</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-600 text-sm">
              © {new Date().getFullYear()} LifeFlow. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link to="/privacy" className="text-gray-600 hover:text-red-500 text-sm">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-gray-600 hover:text-red-500 text-sm">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;