// src/pages/auth/DonorRegister.tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, User, MapPin, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

interface RegisterFormData {
  fullName: string;
  email: string;
  phoneNumber: string;
  bloodType: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  lastDonation?: string;
  medicalConditions: string;
  agreement: boolean;
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export function DonorRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<RegisterFormData>({
    fullName: '',
    email: '',
    phoneNumber: '',
    bloodType: '',
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    lastDonation: '',
    medicalConditions: '',
    agreement: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handlePhoneChange = (value: string | undefined) => {
    setFormData(prev => ({
      ...prev,
      phoneNumber: value || ''
    }));
  };

  const validateForm = (): boolean => {
    // Name validation
    if (formData.fullName.length < 3) {
      toast.error('Please enter a valid full name');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return false;
    }

    // Phone validation
    if (!formData.phoneNumber || formData.phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number');
      return false;
    }

    // Blood type validation
    if (!BLOOD_TYPES.includes(formData.bloodType)) {
      toast.error('Please select a valid blood type');
      return false;
    }

    // Date of birth validation
    const dob = new Date(formData.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    if (age < 18 || age > 65) {
      toast.error('You must be between 18 and 65 years old to register');
      return false;
    }

    // Address validation
    if (!formData.address || !formData.city || !formData.state || !formData.pincode) {
      toast.error('Please fill in all address fields');
      return false;
    }

    // Agreement validation
    if (!formData.agreement) {
      toast.error('Please agree to the terms and conditions');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      // Here you would typically:
      // 1. Create user account
      // 2. Store additional donor information in Firestore
      // 3. Send verification SMS/email
      
      // For now, we'll just simulate the registration process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Registration successful! Please verify your phone number.');
      navigate('/donor/verify-phone', { state: { phoneNumber: formData.phoneNumber } });
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Register as a Blood Donor</h2>
          <p className="mt-2 text-gray-600">Join our community of life-savers</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg px-8 pt-6 pb-8 mb-4">
          {/* Personal Information */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <div className="mt-1 relative">
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  />
                  <User className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="mt-1 relative">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  />
                  <Mail className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <PhoneInput
                  international
                  defaultCountry="IN"
                  value={formData.phoneNumber}
                  onChange={handlePhoneChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label htmlFor="bloodType" className="block text-sm font-medium text-gray-700">
                  Blood Type
                </label>
                <div className="mt-1 relative">
                  <select
                    id="bloodType"
                    name="bloodType"
                    value={formData.bloodType}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  >
                    <option value="" disabled>Select your blood type</option>
                    {BLOOD_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
                  Date of Birth
                </label>
                <div className="mt-1 relative">
                  <input
                    type="date"
                    id="dateOfBirth"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  />
                  <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Address Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <div className="mt-1 relative">
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  />
                  <MapPin className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <div className="mt-1 relative">
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                  State
                </label>
                <div className="mt-1 relative">
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pincode" className="block text-sm font-medium text-gray-700">
                  Pincode
                </label>
                <div className="mt-1 relative">
                  <input
                    type="text"
                    id="pincode"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Medical Information */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Medical Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lastDonation" className="block text-sm font-medium text-gray-700">
                  Last Donation Date (if applicable)
                </label>
                <div className="mt-1 relative">
                  <input
                    type="date"
                    id="lastDonation"
                    name="lastDonation"
                    value={formData.lastDonation}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="medicalConditions" className="block text-sm font-medium text-gray-700">
                  Medical Conditions
                </label>
                <div className="mt-1 relative">
                  <textarea
                    id="medicalConditions"
                    name="medicalConditions"
                    value={formData.medicalConditions}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Agreement */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="agreement"
                checked={formData.agreement}
                onChange={handleChange}
                className="mr-2"
                required
              />
              I agree to the terms and conditions
            </label>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <Link to="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">
            Already have an account? Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default DonorRegister;