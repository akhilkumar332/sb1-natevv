// src/pages/auth/NgoOnboarding.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { User, Calendar, MapPin, Droplet, Briefcase, Globe, Heart } from 'lucide-react';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface OnboardingFormData {
  name: string;
  gender: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  bloodType?: string;
  lastDonation?: string;
  medicalConditions: string;
  occupation?: string;
  preferredLanguage: string;
  howHeardAboutUs: string;
  interestedInVolunteering: boolean;
  privacyPolicyAgreed: boolean;
  termsOfServiceAgreed: boolean;
}

export function NgoOnboarding() {
  const navigate = useNavigate();
  const { user, updateUserProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormData>({
    name: user?.displayName || 'Guest',
    gender: '',
    email: user?.email || '',
    phone: user?.phoneNumber || '',
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India', // Default to India
    bloodType: '',
    lastDonation: '',
    medicalConditions: '',
    occupation: '',
    preferredLanguage: '',
    howHeardAboutUs: '',
    interestedInVolunteering: false,
    privacyPolicyAgreed: false,
    termsOfServiceAgreed: false,
  });

  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);


  useEffect(() => {
    // Pre-fill data based on login method
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.displayName || prev.name,
        email: user.email || prev.email,
        phone: user.phoneNumber || prev.phone,
      }));
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const validateStep = () => {
    switch (currentStep) {
      case 0: // Personal Info
        if (!formData.name || !formData.gender || !formData.dateOfBirth) {
          toast.error('Please fill in all required personal information');
          return false;
        }
        break;
      case 1: // Contact Info
        if (!formData.email || !formData.phone || !formData.address || !formData.city || !formData.state || !formData.postalCode ) {
          toast.error('Please fill in all required contact information');
          return false;
        }
        break;
      case 2: // Medical Info
        if (!formData.bloodType) {
          toast.error('Please select your blood type');
          return false;
        }
        break;
      case 3: // Additional Info
        if (!formData.occupation || !formData.preferredLanguage) {
          toast.error('Please fill in additional information');
          return false;
        }
        break;
      case 4: // Consent
        if (!formData.privacyPolicyAgreed || !formData.termsOfServiceAgreed) {
          toast.error('Please agree to privacy policy and terms of service');
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      const newStep = Math.min(currentStep + 1, 5); // Increase max step to 5
      setCurrentStep(newStep);
      setProgress((newStep / 5) * 100); // Update progress calculation
    }
  };

  const prevStep = () => {
    const newStep = Math.max(currentStep - 1, 0);
    setCurrentStep(newStep);
    setProgress((newStep / 5) * 100);
  };

  const handleSubmit = async () => {
    if (validateStep()) {
        setIsLoading(true);
      try {
        await updateUserProfile({
          displayName: formData.name,
          gender: formData.gender as 'Male' | 'Female' | 'Other',
          email: formData.email,
          phoneNumber: formData.phone,
          dateOfBirth: new Date(formData.dateOfBirth),
          address: formData.address,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country,
          bloodType: formData.bloodType,
          lastDonation: formData.lastDonation ? new Date(formData.lastDonation) : undefined,
          medicalConditions: formData.medicalConditions,
          occupation: formData.occupation,
          preferredLanguage: formData.preferredLanguage,
          howHeardAboutUs: formData.howHeardAboutUs,
          interestedInVolunteering: formData.interestedInVolunteering,
          onboardingCompleted: true
        });
        toast.success('Onboarding completed successfully!');
        navigate('/ngo/dashboard');
      } catch (error) {
        toast.error('Failed to complete onboarding');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderReviewStep = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Review Your Information</h2>
      <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-96">
        <h3 className="text-lg font-semibold mb-2">Personal Information</h3>
        <div className="grid grid-cols-2 gap-2">
          <p><strong>Name:</strong> {formData.name}</p>
          <p><strong>Gender:</strong> {formData.gender}</p>
          <p><strong>Date of Birth:</strong> {formData.dateOfBirth}</p>
        </div>

        <h3 className="text-lg font-semibold mt-4 mb-2">Contact Information</h3>
        <div className="grid grid-cols-2 gap-2">
          <p><strong>Email:</strong> {formData.email}</p>
          <p><strong>Phone:</strong> {formData.phone}</p>
          <p><strong>Address:</strong> {formData.address}</p>
          <p><strong>City:</strong> {formData.city}</p>
          <p><strong>State:</strong> {formData.state}</p>
          <p><strong>PostalCode:</strong> {formData.postalCode}</p>
        </div>

        <h3 className="text-lg font-semibold mt-4 mb-2">Medical Information</h3>
        <div className="grid grid-cols-2 gap-2">
          <p><strong>Blood Type:</strong> {formData.bloodType || 'Not specified'}</p>
          <p><strong>Last Donation:</strong> {formData.lastDonation || 'Not specified'}</p>
          <p><strong>Medical Conditions:</strong> {formData.medicalConditions || 'None'}</p>
        </div>

        <h3 className="text-lg font-semibold mt-4 mb-2">Additional Information</h3>
        <div className="grid grid-cols-2 gap-2">
          <p><strong>Occupation:</strong> {formData.occupation}</p>
          <p><strong>Language:</strong> {formData.preferredLanguage}</p>
          <p><strong>Heard About Us:</strong> {formData.howHeardAboutUs}</p>
          <p><strong>Volunteering Interest:</strong> {formData.interestedInVolunteering ? 'Yes' : 'No'}</p>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    console.log('Current Step:', currentStep); 
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center">
              <User className="mr-2 text-indigo-500" /> 
              Personal Information
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <div className="mt-1 relative">
                <input
                  type="text"
                  name="name" value={formData.name}
                  onChange={handleChange}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center">
              <MapPin className="mr-2 text-indigo-500" /> 
              Contact Information
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Pincode</label>
              <input
                type="text"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center">
              <Droplet className="mr-2 text-indigo-500" /> 
              Medical Information
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">Blood Type</label>
              <select
                name="bloodType"
                value={formData.bloodType}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              >
                <option value="" disabled>Select Blood Type</option>
                {BLOOD_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Donation Date</label>
              <input
                type="date"
                name="lastDonation"
                value={formData.lastDonation}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Medical Conditions</label>
              <textarea
                name="medicalConditions"
                value={formData.medicalConditions}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center">
              <Briefcase className="mr-2 text-indigo-500" /> 
              Additional Information
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 flex items-center">
                <Globe className="mr-2 text-indigo-500" />
               Occupation
              </label>
              <input
                type ="text"
                name="occupation"
                value={formData.occupation}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 flex items-center">
                <Globe className="mr-2 text-indigo-500" />
                Preferred Language
              </label>
              <input
                type="text"
                name="preferredLanguage"
                value={formData.preferredLanguage}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 flex items-center">
                <Globe className="mr-2 text-indigo-500" />
                How did you hear about us?
              </label>
              <input
                type="text"
                name="howHeardAboutUs"
                value={formData.howHeardAboutUs}
                onChange={handleChange}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700 flex items-center">
                <Heart className="mr-2 text-indigo-500" />
                Interested in Volunteering?
              </label>
              <input
                type="checkbox"
                name="interestedInVolunteering"
                checked={formData.interestedInVolunteering}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Consent</h2>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="privacyPolicyAgreed"
                  checked={formData.privacyPolicyAgreed}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  required
                />
                <span className="ml-2">I agree to the Privacy Policy</span>
              </label>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="termsOfServiceAgreed"
                  checked={formData.termsOfServiceAgreed}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  required
                />
                <span className="ml-2">I agree to the Terms of Service</span>
              </label>
            </div>
          </div>
        );
      case 5: // New review step
        return renderReviewStep();
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold flex items-center">
        <Calendar className="mr-2 text-indigo-500" />
        Ngo Onboarding
      </h1>
      <div className="mt-4">
        <div className="relative">
          <div className="absolute top-0 left-0 h-1 bg-indigo-500" style={{ width: `${progress}%` }} />
          <div className="h-1 bg-gray-200" />
        </div>
      </div>
      {renderStep()}
      <div className="mt-6 flex justify-between">
        <button 
          onClick={prevStep} 
          disabled={currentStep === 0} 
          className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
        >
          Back
        </button>
        {currentStep < 4 ? (
          <button 
            onClick={nextStep} 
            className="bg-indigo-600 text-white px-4 py-2 rounded"
          >
            Next
          </button>
        ) : currentStep === 4 ? (
          <button 
            onClick={nextStep} 
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Review
          </button>
        ) : (
          <button 
            onClick={handleSubmit} 
            disabled={isLoading}
            className="bg-green-600 text-white px-4 py-2 rounded flex items-center"
          >
            {isLoading ? (
              <>
                <svg 
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  ></circle>
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
export default NgoOnboarding;