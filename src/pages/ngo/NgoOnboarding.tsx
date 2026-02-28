// src/pages/ngo/NgoOnboarding.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { notify } from 'services/notify.service';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Building2,
  MapPin,
  FileText,
  CheckCircle,
  ChevronRight,
  Check,
  Locate,
  Loader
} from 'lucide-react';
import { countries, getStatesByCountry, getCitiesByState } from '../../data/locations';
import { applyReferralTrackingForUser, ensureReferralTrackingForExistingReferral } from '../../services/referral.service';
import { validateOnboardingStep, type OnboardingValidationRule } from '../../utils/onboardingValidation';
import { LeafletClickMarker, LeafletMapUpdater } from '../../components/shared/leaflet/LocationMapPrimitives';
import { useAddressAutocomplete } from '../../hooks/useAddressAutocomplete';
import { useLocationResolver } from '../../hooks/useLocationResolver';
import { useScopedErrorReporter } from '../../hooks/useScopedErrorReporter';
import {
  notifyInvalidLocationSuggestion,
  notifyInvalidMapLocation,
  notifyLocationDetected,
  notifyMapAddressUpdated,
} from '../../utils/locationFeedback';
import { isValidCoordinatePair } from '../../utils/locationSelection';
import { buildGeocodeLocationPatch, buildSuggestionLocationUpdate } from '../../utils/locationController';
import { resolveOnboardingSubmitErrorMessage } from '../../utils/onboardingFeedback';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const NGO_TYPES = ['Health & Medical', 'Social Welfare', 'Educational', 'Community Development', 'Environmental', 'Women Empowerment', 'Child Welfare', 'Other'];

interface OnboardingFormData {
  organizationName: string;
  registrationNumber: string;
  ngoType: string;
  contactPersonName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  website: string;
  yearEstablished: string;
  description: string;
  privacyPolicyAgreed: boolean;
  termsOfServiceAgreed: boolean;
}

const ngoOnboardingValidationRules: Array<OnboardingValidationRule<OnboardingFormData>> = [
  { step: 0, required: ['organizationName', 'registrationNumber', 'ngoType', 'contactPersonName'], message: 'Please fill in all required organization information' },
  { step: 1, required: ['email', 'phone', 'dateOfBirth', 'address', 'city', 'state', 'postalCode', 'country'], message: 'Please fill in all required contact information' },
  { step: 2, required: ['yearEstablished', 'description'], message: 'Please fill in year established and description' },
  { step: 3, required: ['privacyPolicyAgreed', 'termsOfServiceAgreed'], message: 'Please agree to terms and privacy policy' },
];

const steps = [
  { icon: Building2, title: 'Organization', subtitle: 'Basic details', color: 'blue' },
  { icon: MapPin, title: 'Contact', subtitle: 'Location details', color: 'indigo' },
  { icon: FileText, title: 'Additional', subtitle: 'More info', color: 'purple' },
  { icon: CheckCircle, title: 'Consent', subtitle: 'Agreement', color: 'blue' },
];

export function NgoOnboarding() {
  const navigate = useNavigate();
  const { user, updateUserProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormData>({
    organizationName: '',
    registrationNumber: '',
    ngoType: '',
    contactPersonName: user?.displayName || '',
    dateOfBirth: '',
    email: user?.email || '',
    phone: user?.phoneNumber || '+91',
    address: '',
    latitude: 20.5937,
    longitude: 78.9629,
    city: '',
    state: '',
    postalCode: '',
    country: 'IN',
    website: '',
    yearEstablished: '',
    description: '',
    privacyPolicyAgreed: false,
    termsOfServiceAgreed: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapPosition, setMapPosition] = useState<[number, number]>([20.5937, 78.9629]);
  const isMountedRef = useRef(true);
  const [availableStates, setAvailableStates] = useState(getStatesByCountry('IN'));
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const reportOnboardingError = useScopedErrorReporter({
    scope: 'ngo',
    metadata: { page: 'NgoOnboarding' },
  });
  const {
    suggestions: addressSuggestions,
    showSuggestions: showAddressSuggestions,
    searchSuggestions,
    clearSuggestions,
  } = useAddressAutocomplete({
    scope: 'ngo',
    page: 'NgoOnboarding',
  });
  const { resolveCurrentLocation, resolveFromCoordinates } = useLocationResolver('ngo');

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        contactPersonName: user.displayName || prev.contactPersonName,
        email: user.email || prev.email,
        phone: user.phoneNumber || prev.phone,
      }));
    }
  }, [user]);

  useEffect(() => {
    const states = getStatesByCountry(formData.country);
    setAvailableStates(states);
    setFormData(prev => ({ ...prev, state: '', city: '' }));
    setAvailableCities([]);
  }, [formData.country]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (formData.state) {
      const cities = getCitiesByState(formData.country, formData.state);
      setAvailableCities(cities);
      setFormData(prev => ({ ...prev, city: '' }));
    }
  }, [formData.state, formData.country]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, address: value }));
    searchSuggestions(value);
  };

  const handleAddressSelect = (suggestion: any) => {
    const update = buildSuggestionLocationUpdate({
      suggestion,
      availableStates,
      countryCode: formData.country,
      current: formData,
      coordinateMode: 'number',
      includePostalCode: true,
    });
    if (!update) {
      notifyInvalidLocationSuggestion();
      return;
    }
    setFormData(prev => ({ ...prev, ...update.patch }));
    setMapPosition(update.coords);
    clearSuggestions();
  };

  const getCurrentLocation = () => {
    void (async () => {
      try {
        setLocationLoading(true);
        const result = await resolveCurrentLocation();
        if (!result) {
          return;
        }
        if (!isMountedRef.current) return;

        const [latitude, longitude] = result.coords;
        setMapPosition([latitude, longitude]);
        setFormData(prev => ({ ...prev, latitude, longitude }));

        const patch = buildGeocodeLocationPatch({
          geocode: result.geocode,
          availableStates,
          countryCode: formData.country,
          current: formData,
          includePostalCode: true,
        });
        if (patch) {
          setFormData(prev => ({ ...prev, ...patch }));
          notifyLocationDetected();
        }
      } catch (error) {
        reportOnboardingError(error, 'ngo.onboarding.detect_location');
      } finally {
        if (isMountedRef.current) {
          setLocationLoading(false);
        }
      }
    })();
  };

  const handleMapPositionChange = async (newPosition: [number, number]) => {
    if (!isValidCoordinatePair(newPosition)) {
      notifyInvalidMapLocation();
      return;
    }
    setMapPosition(newPosition);
    setFormData(prev => ({
      ...prev,
      latitude: newPosition[0],
      longitude: newPosition[1]
    }));

    try {
      const result = await resolveFromCoordinates(newPosition, {
        errorMessage: 'Could not fetch address for this location',
      });
      if (!isMountedRef.current) return;

      const patch = buildGeocodeLocationPatch({
        geocode: result.geocode,
        availableStates,
        countryCode: formData.country,
        current: formData,
        includePostalCode: true,
      });
      if (patch) {
        setFormData(prev => ({ ...prev, ...patch }));
        notifyMapAddressUpdated();
      }
    } catch (error) {
      reportOnboardingError(error, 'ngo.onboarding.map_reverse_geocode');
    }
  };

  const validateStep = () => {
    return validateOnboardingStep({
      step: currentStep,
      data: formData,
      rules: ngoOnboardingValidationRules,
      onError: (message) => notify.error(message),
    });
  };

  const handleNext = () => {
    if (validateStep()) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps([...completedSteps, currentStep]);
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;

    setIsLoading(true);
    try {
      await updateUserProfile({
        ...formData,
        dateOfBirth: new Date(formData.dateOfBirth),
        onboardingCompleted: true
      });
      if (user?.uid) {
        await applyReferralTrackingForUser(user.uid);
        await ensureReferralTrackingForExistingReferral({
          ...user,
          onboardingCompleted: true,
          role: user.role || 'ngo',
        });
      }
      notify.success('NGO profile completed successfully!');
      navigate('/ngo/dashboard');
    } catch (error) {
      reportOnboardingError(error, 'ngo.onboarding.submit');
      notify.error(resolveOnboardingSubmitErrorMessage(error, 'ngo'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Organization Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="organizationName"
                value={formData.organizationName}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                placeholder="Enter organization name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Registration Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="registrationNumber"
                value={formData.registrationNumber}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                placeholder="NGO registration number"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                NGO Type <span className="text-red-500">*</span>
              </label>
              <select
                name="ngoType"
                value={formData.ngoType}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                required
              >
                <option value="">Select NGO type</option>
                {NGO_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Contact Person Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="contactPersonName"
                value={formData.contactPersonName}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                placeholder="Primary contact person"
                required
              />
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  placeholder="organization@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <PhoneInput
                  international
                  defaultCountry="IN"
                  value={formData.phone}
                  onChange={(value) => setFormData(prev => ({ ...prev, phone: value || '' }))}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 transition-all phone-input-custom"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Country <span className="text-red-500">*</span>
                </label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="">Select Country</option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={locationLoading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                  >
                    {locationLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Detecting...
                      </>
                    ) : (
                      <>
                        <Locate className="w-4 h-4" />
                        Use Current Location
                      </>
                    )}
                  </button>
                </div>

                {/* Map */}
                <div className="mb-3 rounded-xl overflow-hidden border border-gray-200" style={{ height: '300px' }}>
                  <MapContainer
                    center={mapPosition}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LeafletClickMarker
                      position={mapPosition}
                      onPositionChange={handleMapPositionChange}
                      popupText="Your selected location"
                    />
                    <LeafletMapUpdater center={mapPosition} zoom={13} />
                  </MapContainer>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleAddressChange}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    placeholder="Start typing your address..."
                    required
                    autoComplete="off"
                  />

                  {/* Address Suggestions Dropdown */}
                  {showAddressSuggestions && addressSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {addressSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          onClick={() => handleAddressSelect(suggestion)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="flex items-start space-x-2">
                            <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0 mt-1" />
                            <div className="text-sm text-gray-700">{suggestion.display_name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-1">Type to search or click on the map to set your location</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  State <span className="text-red-500">*</span>
                </label>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  required
                  disabled={!formData.country}
                >
                  <option value="">Select State</option>
                  {availableStates.map((state) => (
                    <option key={state.name} value={state.name}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    required
                    disabled={!formData.state}
                  >
                    <option value="">Select City</option>
                    {availableCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    placeholder="XXXXXX"
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Website
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                placeholder="https://www.example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Year Established <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="yearEstablished"
                value={formData.yearEstablished}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                placeholder="YYYY"
                min="1900"
                max={new Date().getFullYear()}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                placeholder="Brief description of your organization and its mission..."
                required
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
              <h3 className="font-bold text-gray-900 mb-4">Review Your Information</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Organization:</span> {formData.organizationName}</p>
                <p><span className="font-semibold">Type:</span> {formData.ngoType}</p>
                <p><span className="font-semibold">Contact Person:</span> {formData.contactPersonName}</p>
                <p><span className="font-semibold">Email:</span> {formData.email}</p>
                <p><span className="font-semibold">Location:</span> {formData.city}, {formData.state}</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="termsOfServiceAgreed"
                  checked={formData.termsOfServiceAgreed}
                  onChange={handleChange}
                  className="mt-1 w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  required
                />
                <span className="text-sm text-gray-700">
                  I agree to the <a href="#" className="text-red-600 hover:text-red-700 font-semibold">Terms of Service</a>
                </span>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="privacyPolicyAgreed"
                  checked={formData.privacyPolicyAgreed}
                  onChange={handleChange}
                  className="mt-1 w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  required
                />
                <span className="text-sm text-gray-700">
                  I agree to the <a href="#" className="text-red-600 hover:text-red-700 font-semibold">Privacy Policy</a>
                </span>
              </label>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Stepper */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      completedSteps.includes(index)
                        ? 'bg-green-500 text-white'
                        : index === currentStep
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {completedSteps.includes(index) ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <step.icon className="w-6 h-6" />
                    )}
                  </div>
                  <div className="text-center mt-2">
                    <div className="text-xs font-semibold text-gray-900">{step.title}</div>
                    <div className="text-xs text-gray-500">{step.subtitle}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 flex-1 mx-4 transition-all ${
                      completedSteps.includes(index) ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl shadow-lg p-8">
            {renderStepContent()}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
              )}
              
              {currentStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="ml-auto px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="ml-auto px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Completing...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Onboarding</span>
                      <CheckCircle className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NgoOnboarding;
