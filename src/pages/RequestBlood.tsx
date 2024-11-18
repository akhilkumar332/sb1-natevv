import React, { useState, useEffect } from 'react';
import { Droplet, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Define the interface for blood request form data
interface BloodRequestFormData {
  patientName: string;
  patientAge: string;
  bloodType: string;
  unitsNeeded: string;
  hospital: string;
  requiredDate: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  reason: string;
}

// Skeleton Loader Component
const SkeletonLoader: React.FC = () => {
  return (
    <div className="animate-pulse mb-4">
      <div className="h-8 bg-gray-300 rounded mb-4"></div>
      <div className="h-8 bg-gray-300 rounded mb-4"></div>
      <div className="h-8 bg-gray-300 rounded mb-4"></div>
      <div className="h-8 bg-gray-300 rounded mb-4"></div>
      <div className="h-8 bg-gray-300 rounded mb-4"></div>
      <div className="h-8 bg-gray-300 rounded mb-4"></div>
      <div className="h-8 bg-gray-300 rounded mb-4"></div>
    </div>
  );
};

function RequestBlood() {
  const [formData, setFormData] = useState<BloodRequestFormData>({
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
  const [errors, setErrors] = useState<Partial<BloodRequestFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true); // Add loading state

  // Simulate loading data
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
    // Clear the error for this field when the user starts typing
    if (errors[name as keyof BloodRequestFormData]) {
      setErrors(prevErrors => ({ ...prevErrors, [name]: undefined }));
    }
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    return phoneRegex.test(phone);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateDate = (date: string) => {
    const selectedDate = new Date(date);
    const today = new Date();
    return selectedDate >= today;
  };

  const validateForm = () => {
    const newErrors: Partial<BloodRequestFormData> = {};
    
    if (!formData.patientName.trim()) {
      newErrors.patientName = 'Patient name is required';
    }
    
    if (!formData.patientAge || parseInt(formData.patientAge) <= 0 || parseInt(formData.patientAge) > 150) {
      newErrors.patientAge = 'Valid age between 1 and 150 is required';
    }

    if (!formData.bloodType) {
      newErrors.bloodType = 'Blood type is required';
    }

    if (!formData.unitsNeeded || parseInt(formData.unitsNeeded) <= 0 || parseInt(formData.unitsNeeded) > 100) {
      newErrors.unitsNeeded = 'Valid number of units between 1 and 100 is required';
    }

    if (!formData.hospital.trim()) {
      newErrors.hospital = 'Hospital name is required';
    }

    if (!formData.requiredDate || !validateDate(formData.requiredDate)) {
      newErrors.requiredDate = 'Valid future date is required';
    }

    if (!formData.contactName.trim()) {
      newErrors.contactName = 'Contact name is required';
    }

    if (!formData.contactPhone || !validatePhone(formData.contactPhone)) {
      newErrors.contactPhone = 'Valid phone number is required';
    }

    if (!formData.contactEmail || !validateEmail(formData.contactEmail)) {
      newErrors.contactEmail = 'Valid email is required';
    }

    if (!formData.reason.trim()) {
      newErrors.reason = 'Reason for blood request is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (validateForm()) {
      try {
        // Add your API call here
        console.log('Form submitted:', formData);
        // Reset form after successful submission
        setFormData({
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
        toast.success('Blood request submitted successfully!');
      } catch (error) {
        toast.error('Failed to submit blood request. Please try again.');
        console.error('Submission error:', error);
      }
    } else {
      toast.error('Please correct the errors in the form.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <Droplet className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-3 text-3xl font-extrabold text-gray-900">Request Blood</h1>
          <p className="mt-2 text-sm text-gray-600">Fill out this form to request blood for a patient in need</p>
        </div>

        {loading ? (
          <SkeletonLoader /> // Show skeleton loader while loading
        ) : (
          <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Patient Information</h2>
              {loading ? (
                <SkeletonLoader />
              ) : (
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
                    {errors.patientName && <p className="mt-1 text-sm text-red-600">{errors.patientName}</p>}
                  </div>
                  <div>
                    <label htmlFor="patientAge" className="block text-sm font-medium text-gray-700">Patient Age</label>
                    <input
                      type="number"
                      id="patientAge"
                      name="patientAge"
                      value={formData.patientAge}
                      onChange={handleChange}
                      min="1"
                      max="150"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
                      required
                    />
                    {errors.patientAge && <p className="mt-1 text-sm text-red-600">{errors.patientAge}</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Blood Request Details</h2>
              {loading ? (
                <SkeletonLoader />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="bloodType" className="block text-sm font-medium text-gray-700">Blood Type Needed</label>
                    <select
                      id="bloodType"
                      name="bloodType"
                      value={formData.bloodType}
                      onChange={handleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px ```tsx
                      -3 focus:outline-none focus:ring-red-500 focus:border-red-500"
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
                    {errors.bloodType && <p className="mt-1 text-sm text-red-600">{errors.bloodType}</p>}
                  </div>
                  <div>
                    <label htmlFor="unitsNeeded" className="block text-sm font-medium text-gray-700">Units Needed</label>
                    <input
                      type="number"
                      id="unitsNeeded"
                      name="unitsNeeded"
                      value={formData.unitsNeeded}
                      onChange={handleChange}
                      min="1"
                      max="100"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
                      required
                    />
                    {errors.unitsNeeded && <p className="mt-1 text-sm text-red-600">{errors.unitsNeeded}</p>}
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
                    {errors.hospital && <p className="mt-1 text-sm text-red-600">{errors.hospital}</p>}
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
                    {errors.requiredDate && <p className="mt-1 text-sm text-red-600">{errors.requiredDate}</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Contact Information</h2>
              {loading ? (
                <SkeletonLoader />
              ) : (
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
                    {errors.contactName && <p className="mt-1 text-sm text-red-600">{errors.contactName}</p>}
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
                    />
                    {errors.contactPhone && <p className="mt-1 text-sm text-red-600">{errors.contactPhone}</p>}
                  </div>
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
                    {errors.contactEmail && <p className="mt-1 text-sm text-red-600">{errors.contactEmail}</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="mb-6">
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700">Reason for Blood Request</label>
              {loading ? (
                <SkeletonLoader />
              ) : (
                <textarea
                  id="reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
                  required
                />
              )}
              {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason}</p>}
            </div>

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Request Blood'}
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-4">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-2 text-sm text-gray-600">Please ensure all fields are filled accurately to ensure a successful blood request.</p>
        </div>
      </div>
    </div>
  );
}

export default RequestBlood;