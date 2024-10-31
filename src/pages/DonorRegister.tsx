import React, { useState } from 'react';
import { Mail, User, Phone, MapPin, Calendar, Droplet, Heart } from 'lucide-react';

function DonorRegister() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    bloodType: '',
    lastDonation: '',
    weight: '',
    gender: '',
    medicalConditions: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  const handleGmailRegister = () => {
    // Implement Gmail registration logic here
    console.log('Register with Gmail clicked');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center">
          <Heart className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-6 text-3xl font-extrabold text-gray-900">Become a Lifesaver</h1>
          <p className="mt-2 text-sm text-gray-600">Join our community of blood donors and help save lives</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-white p-8 rounded-xl shadow-sm">
          {/* Personal Information Section */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  />
                  <User className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
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

              {/* Phone Number */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  />
                  <Phone className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
                  Date of Birth
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
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

            {/* Address */}
            <div className="mt-4">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
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
          </div>

          {/* Medical Information Section */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Medical Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Blood Type */}
              <div>
                <label htmlFor="bloodType" className="block text-sm font-medium text-gray-700">
                  Blood Type
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <select
                    id="bloodType"
                    name="bloodType"
                    value={formData.bloodType}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  >
                    <option value="">Select Blood Type</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                  <Droplet className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div> </div>

              {/* Last Donation */}
              <div>
                <label htmlFor="lastDonation" className="block text-sm font-medium text-gray-700">
                  Last Donation Date
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="date"
                    id="lastDonation"
                    name="lastDonation"
                    value={formData.lastDonation}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  />
                  <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              {/* Weight */}
              <div>
                <label htmlFor="weight" className="block text-sm font-medium text-gray-700">
                  Weight (kg)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    id="weight"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>
              </div>

              {/* Medical Conditions */}
              <div className="col-span-1 md:col-span-2">
                <label htmlFor="medicalConditions" className="block text-sm font-medium text-gray-700">
                  Medical Conditions
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <textarea
                    id="medicalConditions"
                    name="medicalConditions"
                    value={formData.medicalConditions}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Please list any medical conditions, allergies, or medications"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Register Button */}
          <div className="flex flex-col space-y-4">
            <button
              type="button"
              onClick={handleGmailRegister}
              className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
            >
              <img
                className="h-5 w-5 mr-2"
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google logo"
              />
              <span>Register with Gmail</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DonorRegister;