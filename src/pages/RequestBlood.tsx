import React, { useState, useEffect } from 'react';
import { Droplet, AlertCircle, User, Calendar, Phone, Mail, Hospital, FileText, Heart, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';

// Define the interface for blood request form data
interface BloodRequestFormData {
  patientName: string;
  patientAge: string;
  bloodType: string;
  unitsNeeded: string;
  urgency: string;
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
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-gray-200 rounded-xl"></div>
      <div className="h-12 bg-gray-200 rounded-xl"></div>
      <div className="h-12 bg-gray-200 rounded-xl"></div>
      <div className="h-24 bg-gray-200 rounded-xl"></div>
    </div>
  );
};

function RequestBlood() {
  const [formData, setFormData] = useState<BloodRequestFormData>({
    patientName: '',
    patientAge: '',
    bloodType: '',
    unitsNeeded: '',
    urgency: 'normal',
    hospital: '',
    requiredDate: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    reason: '',
  });
  const [errors, setErrors] = useState<Partial<BloodRequestFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const urgencyLevels = [
    { value: 'critical', label: 'Critical', color: 'from-red-700 to-red-900', icon: '🚨' },
    { value: 'urgent', label: 'Urgent', color: 'from-orange-600 to-red-600', icon: '⚠️' },
    { value: 'normal', label: 'Normal', color: 'from-yellow-500 to-orange-500', icon: '📋' }
  ];

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
    if (errors[name as keyof BloodRequestFormData]) {
      setErrors(prevErrors => ({ ...prevErrors, [name]: undefined }));
    }
  };

  const handleBloodTypeSelect = (bloodType: string) => {
    setFormData(prev => ({ ...prev, bloodType }));
    if (errors.bloodType) {
      setErrors(prev => ({ ...prev, bloodType: undefined }));
    }
  };

  const handleUrgencySelect = (urgency: string) => {
    setFormData(prev => ({ ...prev, urgency }));
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
      newErrors.hospital = 'BloodBank name is required';
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
        console.log('Form submitted:', formData);
        setFormData({
          patientName: '',
          patientAge: '',
          bloodType: '',
          unitsNeeded: '',
          urgency: 'normal',
          hospital: '',
          requiredDate: '',
          contactName: '',
          contactPhone: '',
          contactEmail: '',
          reason: '',
        });
        toast.success('Blood request submitted successfully! We will connect you with donors soon.');
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
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-red-50">
          <div className="absolute top-10 right-10 w-96 h-96 bg-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-red-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-6">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-semibold">Emergency Blood Request</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold mb-6">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Request Blood
              </span>
              <br />
              <span className="text-gray-900">Save a Life Today</span>
            </h1>

            <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
              Fill out the form below and we'll connect you with available donors in your area. Every second counts!
            </p>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {loading ? (
              <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
                <SkeletonLoader />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Patient Information Card */}
                <div className="bg-white rounded-3xl shadow-xl p-8 border-2 border-red-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-red-50 to-transparent rounded-full -mr-32 -mt-32"></div>

                  <div className="relative z-10">
                    <div className="flex items-center mb-6">
                      <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center mr-4">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900">Patient Information</h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Patient Name *</label>
                        <input
                          type="text"
                          name="patientName"
                          value={formData.patientName}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                            errors.patientName ? 'border-red-500' : 'border-gray-200 focus:border-red-500'
                          }`}
                          placeholder="John Doe"
                        />
                        {errors.patientName && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.patientName}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Patient Age *</label>
                        <input
                          type="number"
                          name="patientAge"
                          value={formData.patientAge}
                          onChange={handleChange}
                          min="1"
                          max="150"
                          className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                            errors.patientAge ? 'border-red-500' : 'border-gray-200 focus:border-red-500'
                          }`}
                          placeholder="25"
                        />
                        {errors.patientAge && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.patientAge}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Blood Type Selection Card */}
                <div className="bg-white rounded-3xl shadow-xl p-8 border-2 border-red-100">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center mr-4">
                      <Droplet className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Blood Type Needed *</h2>
                  </div>

                  <div className="grid grid-cols-4 md:grid-cols-8 gap-3 mb-4">
                    {bloodTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleBloodTypeSelect(type)}
                        className={`py-4 px-2 rounded-xl font-bold text-lg transition-all transform hover:scale-105 ${
                          formData.bloodType === type
                            ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {errors.bloodType && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.bloodType}</p>}
                </div>

                {/* Urgency Level Card */}
                <div className="bg-white rounded-3xl shadow-xl p-8 border-2 border-red-100">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center mr-4">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Urgency Level</h2>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    {urgencyLevels.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => handleUrgencySelect(level.value)}
                        className={`p-6 rounded-2xl transition-all transform hover:scale-105 ${
                          formData.urgency === level.value
                            ? `bg-gradient-to-r ${level.color} text-white shadow-xl`
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <div className="text-3xl mb-2">{level.icon}</div>
                        <div className="font-bold text-lg">{level.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Request Details Card */}
                <div className="bg-white rounded-3xl shadow-xl p-8 border-2 border-red-100">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center mr-4">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Request Details</h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Units Needed *</label>
                      <input
                        type="number"
                        name="unitsNeeded"
                        value={formData.unitsNeeded}
                        onChange={handleChange}
                        min="1"
                        max="100"
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                          errors.unitsNeeded ? 'border-red-500' : 'border-gray-200 focus:border-red-500'
                        }`}
                        placeholder="2"
                      />
                      {errors.unitsNeeded && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.unitsNeeded}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Required By Date *</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="date"
                          name="requiredDate"
                          value={formData.requiredDate}
                          onChange={handleChange}
                          className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                            errors.requiredDate ? 'border-red-500' : 'border-gray-200 focus:border-red-500'
                          }`}
                        />
                      </div>
                      {errors.requiredDate && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.requiredDate}</p>}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">BloodBank Name *</label>
                      <div className="relative">
                        <Hospital className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          name="hospital"
                          value={formData.hospital}
                          onChange={handleChange}
                          className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                            errors.hospital ? 'border-red-500' : 'border-gray-200 focus:border-red-500'
                          }`}
                          placeholder="AIIMS Delhi"
                        />
                      </div>
                      {errors.hospital && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.hospital}</p>}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Reason for Blood Request *</label>
                      <textarea
                        name="reason"
                        value={formData.reason}
                        onChange={handleChange}
                        rows={4}
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-colors resize-none ${
                          errors.reason ? 'border-red-500' : 'border-gray-200 focus:border-red-500'
                        }`}
                        placeholder="Please describe the medical situation..."
                      />
                      {errors.reason && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.reason}</p>}
                    </div>
                  </div>
                </div>

                {/* Contact Information Card */}
                <div className="bg-white rounded-3xl shadow-xl p-8 border-2 border-red-100">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center mr-4">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Contact Information</h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Person Name *</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          name="contactName"
                          value={formData.contactName}
                          onChange={handleChange}
                          className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                            errors.contactName ? 'border-red-500' : 'border-gray-200 focus:border-red-500'
                          }`}
                          placeholder="Jane Smith"
                        />
                      </div>
                      {errors.contactName && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.contactName}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Phone *</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="tel"
                          name="contactPhone"
                          value={formData.contactPhone}
                          onChange={handleChange}
                          className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                            errors.contactPhone ? 'border-red-500' : 'border-gray-200 focus:border-red-500'
                          }`}
                          placeholder="+91 98765 43210"
                        />
                      </div>
                      {errors.contactPhone && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.contactPhone}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Email *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          name="contactEmail"
                          value={formData.contactEmail}
                          onChange={handleChange}
                          className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                            errors.contactEmail ? 'border-red-500' : 'border-gray-200 focus:border-red-500'
                          }`}
                          placeholder="contact@example.com"
                        />
                      </div>
                      {errors.contactEmail && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{errors.contactEmail}</p>}
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-center">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-12 py-5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full text-xl font-bold hover:shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <Heart className="w-6 h-6" />
                        <span>Submit Blood Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Important Notice */}
            <div className="mt-12 bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 border-2 border-red-100">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">What Happens Next?</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-red-600 rounded-full mr-3"></span>
                      We'll verify your request within 15 minutes
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-red-600 rounded-full mr-3"></span>
                      Available donors will be notified immediately
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-red-600 rounded-full mr-3"></span>
                      You'll receive donor contact details via email and SMS
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-red-600 rounded-full mr-3"></span>
                      Our team is available 24/7 for support
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-700 to-red-800"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Need Help Finding Donors?</h2>
            <p className="text-xl mb-10 opacity-90">
              Browse our verified donor database to find compatible donors in your area
            </p>
            <Link
              to="/donors"
              className="inline-flex items-center px-10 py-5 bg-white text-red-600 rounded-full text-xl font-bold hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              <Droplet className="w-6 h-6 mr-2" />
              Find Donors Near You
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default RequestBlood;
