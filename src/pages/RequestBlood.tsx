import React, { useState } from 'react';
import { Mail, User, Phone, MapPin, Calendar, Droplet, AlertCircle } from 'lucide-react';

function RequestBlood() {
  const [formData, setFormData] = useState({
    patientName: '',
    patientAge: '',
    bloodType: '',
    unitsNeeded: '',
    hospital: '',
    requiredDate: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    reason: '',
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
    // Here you would typically send the data to your backend
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <Droplet className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-3 text-3xl font-extrabold text-gray-900">Request Blood</h1>
          <p className="mt-2 text-sm text-gray-600">Fill out this form to request blood for a patient in need</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Patient Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="patientName" className="block text-sm font-medium text-gray-700">Patient Name</label>
                <input
                  type="text"
                  id="patientName"
                  name="patientName"
                  value={formData.patientName}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="patientAge" className="block text-sm font-medium text-gray-700">Patient Age</label>
                <input
                  type="number"
                  id="patientAge"
                  name="patientAge"
                  value={formData.patientAge}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Blood Request Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bloodType" className="block text-sm font-medium text-gray-700">Blood Type Needed</label>
                <select
                  id="bloodType"
                  name="bloodType"
                  value={formData.bloodType}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
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
              </div>
              <div>
                <label htmlFor="unitsNeeded" className="block text-sm font-medium text-gray-700">Units Needed</label>
                <input
                  type="number"
                  id="unitsNeeded"
                  name="unitsNeeded"
                  value={formData.unitsNeeded}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="hospital" className="block text-sm font-medium text-gray-700">Hospital Name</label>
                <input
                  type="text"
                  id="hospital"
                  name="hospital"
                  value={formData.hospital}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="requiredDate" className="block text-sm font-medium text-gray-700">Required By Date</label>
                <input
                  type="date"
                  id="requiredDate"
                  name="requiredDate"
                  value={formData.requiredDate}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contactName" className="block text-sm font-medium text-gray-700">Contact Person Name</label>
                <input
                  type="text"
                  id="contactName"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700">Contact Phone</label>
                <input
                  type="tel"
                  id="contactPhone"
                  name="contactPhone"
                  value={formData.contactPhone}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
                  required
                /> </div>
              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700">Contact Email</label>
                <input
                  type="email"
                  id="contactEmail"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700">Reason for Blood Request</label>
            <textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
              required
            />
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Request Blood
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-2 text-sm text-gray-600">Please ensure all fields are filled accurately to ensure a successful blood request.</p>
        </div>
      </div>
    </div>
  );
}

export default RequestBlood;