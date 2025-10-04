// src/pages/donor/DonorOnboarding.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  User,
  MapPin,
  Droplet,
  Briefcase,
  Heart,
  CheckCircle,
  ChevronRight,
  Award,
  Sparkles
} from 'lucide-react';

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

const steps = [
  { icon: User, title: 'Personal Info', color: 'from-blue-500 to-indigo-600' },
  { icon: MapPin, title: 'Location', color: 'from-indigo-500 to-purple-600' },
  { icon: Droplet, title: 'Medical Info', color: 'from-purple-500 to-pink-600' },
  { icon: Briefcase, title: 'About You', color: 'from-pink-500 to-red-600' },
  { icon: CheckCircle, title: 'Consent', color: 'from-red-500 to-orange-600' },
];

export function DonorOnboarding() {
  const navigate = useNavigate();
  const { user, updateUserProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormData>({
    name: user?.displayName || '',
    gender: '',
    email: user?.email || '',
    phone: user?.phoneNumber || '',
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
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

  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
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
      case 0:
        if (!formData.name || !formData.gender || !formData.dateOfBirth) {
          toast.error('Please fill in all required personal information');
          return false;
        }
        break;
      case 1:
        if (!formData.email || !formData.phone || !formData.address || !formData.city || !formData.state || !formData.postalCode) {
          toast.error('Please fill in all required contact information');
          return false;
        }
        break;
      case 2:
        if (!formData.bloodType) {
          toast.error('Please select your blood type');
          return false;
        }
        break;
      case 3:
        if (!formData.occupation || !formData.preferredLanguage || !formData.howHeardAboutUs) {
          toast.error('Please fill in additional information');
          return false;
        }
        break;
      case 4:
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
      setIsAnimating(true);
      setCompletedSteps([...completedSteps, currentStep]);
      setTimeout(() => {
        setCurrentStep(Math.min(currentStep + 1, steps.length - 1));
        setIsAnimating(false);
      }, 300);
    }
  };

  const prevStep = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(Math.max(currentStep - 1, 0));
      setIsAnimating(false);
    }, 300);
  };

  const handleSubmit = async () => {
    if (validateStep()) {
      setIsLoading(true);
      try {
        // Prepare data object, excluding undefined values
        const profileData: any = {
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
          medicalConditions: formData.medicalConditions,
          occupation: formData.occupation,
          preferredLanguage: formData.preferredLanguage,
          howHeardAboutUs: formData.howHeardAboutUs,
          interestedInVolunteering: formData.interestedInVolunteering,
          onboardingCompleted: true
        };

        // Only add lastDonation if it has a value
        if (formData.lastDonation) {
          profileData.lastDonation = new Date(formData.lastDonation);
        }

        await updateUserProfile(profileData);

        setShowConfetti(true);
        toast.success('Welcome to the BloodHub family! 🎉');

        setTimeout(() => {
          navigate('/donor/dashboard');
        }, 2000);
      } catch (error: any) {
        console.error('Onboarding submission error:', error);
        toast.error(error?.message || 'Failed to complete onboarding. Please try again.');
        setIsLoading(false);
      }
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4 animate-bounce">
                <User className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Let's get to know you!</h2>
              <p className="text-blue-200">Tell us a bit about yourself</p>
            </div>

            <div className="space-y-5">
              <div className="group">
                <label className="block text-sm font-semibold text-white mb-2">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-white mb-2">Gender</label>
                <div className="grid grid-cols-3 gap-3">
                  {['Male', 'Female', 'Other'].map((gender) => (
                    <button
                      key={gender}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, gender }))}
                      className={`px-4 py-4 rounded-2xl font-semibold transition-all duration-300 ${
                        formData.gender === gender
                          ? 'bg-white text-indigo-600 scale-105 shadow-2xl'
                          : 'bg-white/10 text-white border-2 border-white/20 hover:bg-white/20'
                      }`}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-white mb-2">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-4 animate-bounce">
                <MapPin className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Where can we find you?</h2>
              <p className="text-purple-200">Your contact information helps us connect</p>
            </div>

            <div className="space-y-5">
              <div className="group">
                <label className="block text-sm font-semibold text-white mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-white mb-2">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                  placeholder="+91 XXXXX XXXXX"
                  required
                />
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-white mb-2">Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                  placeholder="Street address"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="group">
                  <label className="block text-sm font-semibold text-white mb-2">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                    placeholder="City"
                    required
                  />
                </div>

                <div className="group">
                  <label className="block text-sm font-semibold text-white mb-2">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                    placeholder="State"
                    required
                  />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-white mb-2">Pincode</label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                  placeholder="XXXXXX"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mb-4 animate-bounce">
                <Droplet className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Your Life-Saving Power!</h2>
              <p className="text-pink-200">Medical details help us serve you better</p>
            </div>

            <div className="space-y-5">
              <div className="group">
                <label className="block text-sm font-semibold text-white mb-3">Blood Type</label>
                <div className="grid grid-cols-4 gap-3">
                  {BLOOD_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, bloodType: type }))}
                      className={`px-4 py-5 rounded-2xl font-bold text-lg transition-all duration-300 ${
                        formData.bloodType === type
                          ? 'bg-white text-pink-600 scale-110 shadow-2xl'
                          : 'bg-white/10 text-white border-2 border-white/20 hover:bg-white/20 hover:scale-105'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-white mb-2">Last Donation Date (Optional)</label>
                <input
                  type="date"
                  name="lastDonation"
                  value={formData.lastDonation}
                  onChange={handleChange}
                  className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                />
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-white mb-2">Medical Conditions (Optional)</label>
                <textarea
                  name="medicalConditions"
                  value={formData.medicalConditions}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                  placeholder="Let us know if you have any medical conditions we should be aware of..."
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-500 to-red-600 rounded-full mb-4 animate-bounce">
                <Briefcase className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Tell us more about you!</h2>
              <p className="text-red-200">Help us understand you better</p>
            </div>

            <div className="space-y-5">
              <div className="group">
                <label className="block text-sm font-semibold text-white mb-2">Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleChange}
                  className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                  placeholder="What do you do?"
                  required
                />
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-white mb-2">Preferred Language</label>
                <input
                  type="text"
                  name="preferredLanguage"
                  value={formData.preferredLanguage}
                  onChange={handleChange}
                  className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white placeholder-white/50 focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                  placeholder="English, Hindi, etc."
                  required
                />
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-white mb-2">How did you hear about us?</label>
                <select
                  name="howHeardAboutUs"
                  value={formData.howHeardAboutUs}
                  onChange={handleChange}
                  className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl text-white focus:border-white/50 focus:outline-none transition-all duration-300 focus:scale-[1.02]"
                  required
                >
                  <option value="" className="text-gray-900">Select an option</option>
                  <option value="social_media" className="text-gray-900">Social Media</option>
                  <option value="friend" className="text-gray-900">Friend/Family</option>
                  <option value="search" className="text-gray-900">Search Engine</option>
                  <option value="advertisement" className="text-gray-900">Advertisement</option>
                  <option value="other" className="text-gray-900">Other</option>
                </select>
              </div>

              <div className="group bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all duration-300">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="interestedInVolunteering"
                    checked={formData.interestedInVolunteering}
                    onChange={handleChange}
                    className="w-6 h-6 rounded-lg border-2 border-white/50 bg-white/10 text-pink-600 focus:ring-2 focus:ring-white/50 transition-all duration-300"
                  />
                  <div className="ml-4">
                    <div className="flex items-center">
                      <Heart className="w-5 h-5 text-white mr-2" />
                      <span className="text-lg font-semibold text-white">Interested in Volunteering?</span>
                    </div>
                    <p className="text-sm text-white/70 mt-1">Join our community of volunteers and make a bigger impact!</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-orange-600 rounded-full mb-4 animate-bounce">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Almost there!</h2>
              <p className="text-orange-200">Just need your consent to continue</p>
            </div>

            <div className="space-y-5">
              <div className="group bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all duration-300">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    name="privacyPolicyAgreed"
                    checked={formData.privacyPolicyAgreed}
                    onChange={handleChange}
                    className="w-6 h-6 mt-1 rounded-lg border-2 border-white/50 bg-white/10 text-orange-600 focus:ring-2 focus:ring-white/50 transition-all duration-300"
                    required
                  />
                  <div className="ml-4">
                    <span className="text-lg font-semibold text-white">I agree to the Privacy Policy</span>
                    <p className="text-sm text-white/70 mt-1">
                      We respect your privacy and will never share your personal information without your consent.
                    </p>
                  </div>
                </label>
              </div>

              <div className="group bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all duration-300">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    name="termsOfServiceAgreed"
                    checked={formData.termsOfServiceAgreed}
                    onChange={handleChange}
                    className="w-6 h-6 mt-1 rounded-lg border-2 border-white/50 bg-white/10 text-orange-600 focus:ring-2 focus:ring-white/50 transition-all duration-300"
                    required
                  />
                  <div className="ml-4">
                    <span className="text-lg font-semibold text-white">I agree to the Terms of Service</span>
                    <p className="text-sm text-white/70 mt-1">
                      By agreeing, you confirm that you meet the eligibility criteria for blood donation.
                    </p>
                  </div>
                </label>
              </div>

              <div className="bg-gradient-to-r from-yellow-400/20 to-orange-400/20 border-2 border-yellow-400/30 rounded-2xl p-6 mt-6">
                <div className="flex items-center mb-3">
                  <Sparkles className="w-6 h-6 text-yellow-300 mr-2" />
                  <h3 className="text-xl font-bold text-white">You're about to become a hero!</h3>
                </div>
                <p className="text-white/80 text-sm">
                  Every donation can save up to 3 lives. Thank you for taking this step to make a difference.
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${steps[currentStep].color} relative overflow-hidden`}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 bg-yellow-400 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Progress Steps */}
      <div className="absolute top-0 left-0 right-0 z-10 pt-8 px-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = completedSteps.includes(index);
              const isCurrent = index === currentStep;

              return (
                <div key={index} className="flex items-center flex-1">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isCompleted
                          ? 'bg-white text-green-600 scale-110'
                          : isCurrent
                          ? 'bg-white text-indigo-600 scale-125 shadow-2xl'
                          : 'bg-white/20 text-white/50'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <StepIcon className="w-6 h-6" />
                      )}
                    </div>
                    <span className={`text-xs mt-2 font-semibold ${isCurrent ? 'text-white' : 'text-white/60'}`}>
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 rounded-full transition-all duration-500 ${
                      isCompleted ? 'bg-white' : 'bg-white/20'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-24">
        <div className={`w-full max-w-2xl transition-all duration-500 ${
          isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}>
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 md:p-12">
            {renderStep()}

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-8">
              {currentStep > 0 && (
                <button
                  onClick={prevStep}
                  className="flex-1 px-6 py-4 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-2xl transition-all duration-300 backdrop-blur-sm border-2 border-white/30 hover:scale-105"
                >
                  Previous
                </button>
              )}

              {currentStep < steps.length - 1 ? (
                <button
                  onClick={nextStep}
                  className="flex-1 px-6 py-4 bg-white text-indigo-600 font-bold rounded-2xl transition-all duration-300 hover:scale-105 shadow-xl hover:shadow-2xl flex items-center justify-center group"
                >
                  Continue
                  <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 px-6 py-4 bg-white text-indigo-600 font-bold rounded-2xl transition-all duration-300 hover:scale-105 shadow-xl hover:shadow-2xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5"
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
                      Completing...
                    </>
                  ) : (
                    <>
                      Complete Onboarding
                      <Award className="ml-2 w-5 h-5 group-hover:rotate-12 transition-transform" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Motivational Quote */}
          <div className="text-center mt-6">
            <p className="text-white/80 text-sm italic">
              "The gift of blood is the gift of life. Thank you for being a hero."
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
      `}</style>
    </div>
  );
}

export default DonorOnboarding;
