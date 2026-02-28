// src/pages/donor/DonorOnboarding.tsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { notify } from 'services/notify.service';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Timestamp, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  User,
  MapPin,
  Droplet,
  Briefcase,
  Heart,
  CheckCircle,
  ChevronRight,
  Award,
  Sparkles,
  Check,
  Locate,
  Loader
} from 'lucide-react';
import { countries, getStatesByCountry, getCitiesByState } from '../../data/locations';
import { db } from '../../firebase';
import { applyReferralTrackingForUser, ensureReferralTrackingForExistingReferral } from '../../services/referral.service';
import { captureHandledError } from '../../services/errorLog.service';
import { validateOnboardingStep, type OnboardingValidationRule } from '../../utils/onboardingValidation';
import { LeafletClickMarker, LeafletMapUpdater } from '../../components/shared/leaflet/LocationMapPrimitives';
import { useAddressAutocomplete } from '../../hooks/useAddressAutocomplete';
import { mapNominatimAddress } from '../../utils/addressMapping';
import { useLocationResolver } from '../../hooks/useLocationResolver';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const normalizeToMidnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const readDonationEntryDate = (entry: any) => {
  const value = entry?.date || entry?.donationDate;
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  return null;
};

interface OnboardingFormData {
  name: string;
  gender: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  latitude: number;
  longitude: number;
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

const donorOnboardingValidationRules: Array<OnboardingValidationRule<OnboardingFormData>> = [
  { step: 0, required: ['name', 'gender', 'dateOfBirth'], message: 'Please fill in all required personal information' },
  { step: 1, required: ['email', 'phone', 'address', 'country', 'state', 'city', 'postalCode'], message: 'Please fill in all required contact information' },
  { step: 2, required: ['bloodType'], message: 'Please select your blood type' },
  { step: 3, required: ['occupation', 'preferredLanguage', 'howHeardAboutUs'], message: 'Please fill in additional information' },
  { step: 4, required: ['privacyPolicyAgreed', 'termsOfServiceAgreed'], message: 'Please agree to privacy policy and terms of service' },
];

const steps = [
  { icon: User, title: 'Personal', subtitle: 'Basic info', color: 'blue' },
  { icon: MapPin, title: 'Contact', subtitle: 'Location details', color: 'indigo' },
  { icon: Droplet, title: 'Medical', subtitle: 'Health info', color: 'purple' },
  { icon: Briefcase, title: 'Profile', subtitle: 'About you', color: 'pink' },
  { icon: CheckCircle, title: 'Consent', subtitle: 'Agreement', color: 'red' },
];

export function DonorOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUserProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormData>({
    name: user?.displayName || '',
    gender: '',
    email: user?.email || '',
    phone: user?.phoneNumber || '+91',
    dateOfBirth: '',
    address: '',
    latitude: 20.5937,
    longitude: 78.9629,
    city: '',
    state: '',
    postalCode: '',
    country: 'IN',
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
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapPosition, setMapPosition] = useState<[number, number]>([20.5937, 78.9629]);
  const [availableStates, setAvailableStates] = useState(getStatesByCountry('IN'));
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const reportOnboardingError = (error: unknown, kind: string) => {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'donor',
      metadata: { kind, page: 'DonorOnboarding' },
    });
  };
  const {
    suggestions: addressSuggestions,
    showSuggestions: showAddressSuggestions,
    searchSuggestions,
    clearSuggestions,
  } = useAddressAutocomplete({
    scope: 'donor',
    page: 'DonorOnboarding',
  });
  const { resolveCurrentLocation, resolveFromCoordinates } = useLocationResolver('donor');

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

  // Update states when country changes
  useEffect(() => {
    const states = getStatesByCountry(formData.country);
    setAvailableStates(states);
    setFormData(prev => ({ ...prev, state: '', city: '' }));
    setAvailableCities([]);
  }, [formData.country]);

  // Update cities when state changes
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
    setFormData(prev => ({
      ...prev,
      address: suggestion.display_name,
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon)
    }));
    setMapPosition([parseFloat(suggestion.lat), parseFloat(suggestion.lon)]);
    clearSuggestions();

    // Try to extract and match state/city from address
    if (suggestion.address) {
      const mapped = mapNominatimAddress({
        address: suggestion.address,
        availableStates,
        countryCode: formData.country,
      });
      if (mapped.state) {
        setFormData(prev => ({ ...prev, state: mapped.state }));
      }
      if (mapped.city) {
        setFormData(prev => ({ ...prev, city: mapped.city }));
      }
      if (mapped.postalCode) {
        setFormData(prev => ({ ...prev, postalCode: mapped.postalCode }));
      }
    }
  };

  const getCurrentLocation = () => {
    void (async () => {
      try {
        setLocationLoading(true);
        const result = await resolveCurrentLocation();
        if (!result) {
          return;
        }

        const [latitude, longitude] = result.coords;
        setMapPosition([latitude, longitude]);
        setFormData(prev => ({ ...prev, latitude, longitude }));

        const data = result.geocode;
        if (data && data.address) {
          const address = data.address;
          const mapped = mapNominatimAddress({
            address,
            availableStates,
            countryCode: formData.country,
          });
          setFormData(prev => ({
            ...prev,
            address: data.display_name || '',
            postalCode: mapped.postalCode || prev.postalCode,
            state: mapped.state || prev.state,
            city: mapped.city || prev.city,
          }));

          notify.success('Location detected successfully!');
        }
      } catch (error) {
        reportOnboardingError(error, 'donor.onboarding.detect_location');
      } finally {
        setLocationLoading(false);
      }
    })();
  };

  const handleMapPositionChange = async (newPosition: [number, number]) => {
    setMapPosition(newPosition);
    setFormData(prev => ({
      ...prev,
      latitude: newPosition[0],
      longitude: newPosition[1]
    }));

    const result = await resolveFromCoordinates(newPosition, {
      errorMessage: 'Could not fetch address for this location',
    });
    const data = result.geocode;

    if (data && data.address) {
      const address = data.address;
      const mapped = mapNominatimAddress({
        address,
        availableStates,
        countryCode: formData.country,
      });
      setFormData(prev => ({
        ...prev,
        address: data.display_name || '',
        postalCode: mapped.postalCode || prev.postalCode,
        state: mapped.state || prev.state,
        city: mapped.city || prev.city,
      }));

      notify.success('Address updated from map location');
    }
  };

  const validateStep = () => {
    return validateOnboardingStep({
      step: currentStep,
      data: formData,
      rules: donorOnboardingValidationRules,
      onError: (message) => notify.error(message),
    });
  };

  const nextStep = () => {
    if (validateStep()) {
      setCompletedSteps([...completedSteps, currentStep]);
      setCurrentStep(Math.min(currentStep + 1, steps.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setCurrentStep(Math.max(currentStep - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (validateStep()) {
      setIsLoading(true);
      try {
        const selectedCountry = countries.find(c => c.code === formData.country);

        const profileData: any = {
          displayName: formData.name,
          gender: formData.gender as 'Male' | 'Female' | 'Other',
          email: formData.email,
          phoneNumber: formData.phone,
          dateOfBirth: new Date(formData.dateOfBirth),
          address: formData.address,
          latitude: formData.latitude,
          longitude: formData.longitude,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: selectedCountry?.name || formData.country,
          bloodType: formData.bloodType,
          medicalConditions: formData.medicalConditions,
          occupation: formData.occupation,
          preferredLanguage: formData.preferredLanguage,
          howHeardAboutUs: formData.howHeardAboutUs,
          interestedInVolunteering: formData.interestedInVolunteering,
          onboardingCompleted: true
        };

        if (formData.lastDonation) {
          profileData.lastDonation = new Date(formData.lastDonation);
        }

        await updateUserProfile(profileData);

        if (formData.lastDonation && user?.uid) {
          const parsedDate = new Date(formData.lastDonation);
          if (!Number.isNaN(parsedDate.getTime())) {
            const historyRef = doc(db, 'DonationHistory', user.uid);
            const historySnapshot = await getDoc(historyRef);
            const existingDonations = historySnapshot.exists() && Array.isArray(historySnapshot.data().donations)
              ? historySnapshot.data().donations
              : [];
            const normalizedInputDate = normalizeToMidnight(parsedDate);
            const hasSameDate = existingDonations.some((entry: any) => {
              const entryDate = readDonationEntryDate(entry);
              if (!entryDate) return false;
              return normalizeToMidnight(entryDate).getTime() === normalizedInputDate.getTime();
            });
            const nextDonations = [...existingDonations];
            if (!hasSameDate) {
              nextDonations.push({
                id: `onboarding-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                date: Timestamp.fromDate(parsedDate),
                location: formData.city || '',
                bloodBank: 'Self Reported',
                hospitalId: '',
                hospitalName: 'Self Reported',
                quantity: '450ml',
                status: 'completed',
                units: 1,
                source: 'manual',
                notes: '',
                createdAt: Timestamp.now(),
              });
            }
            const sortedDonations = nextDonations
              .sort((a: any, b: any) => {
                const dateA = readDonationEntryDate(a)?.getTime() || 0;
                const dateB = readDonationEntryDate(b)?.getTime() || 0;
                return dateB - dateA;
              })
              .slice(0, 20);
            await setDoc(
              historyRef,
              {
                userId: user.uid,
                lastDonationDate: Timestamp.fromDate(parsedDate),
                donations: sortedDonations,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        }

        if (user?.uid) {
          await applyReferralTrackingForUser(user.uid);
          await ensureReferralTrackingForExistingReferral({
            ...user,
            onboardingCompleted: true,
          });
        }

        setShowConfetti(true);
        notify.success('Welcome to the BloodHub family! 🎉');

        setTimeout(() => {
          const params = new URLSearchParams(location.search);
          const rawReturnTo = params.get('returnTo') || '';
          const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '';
          params.delete('returnTo');
          const nextSearch = params.toString();
          const destination = returnTo || '/donor/dashboard';
          const target = nextSearch
            ? `${destination}${destination.includes('?') ? '&' : '?'}${nextSearch}`
            : destination;
          navigate(target);
        }, 2000);
      } catch (error: any) {
        reportOnboardingError(error, 'donor.onboarding.submit');
        notify.error(error?.message || 'Failed to complete onboarding. Please try again.');
        setIsLoading(false);
      }
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['Male', 'Female', 'Other'].map((gender) => (
                    <button
                      key={gender}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, gender }))}
                      className={`px-4 py-3 rounded-xl font-medium transition-all ${
                        formData.gender === gender
                          ? 'bg-red-600 text-white shadow-lg scale-105'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
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
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  required
                />
              </div>
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
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="your@email.com"
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
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 transition-all phone-input-custom"
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
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
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
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
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
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
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
                            <MapPin className="w-4 h-4 text-red-500 flex-shrink-0 mt-1" />
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
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
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
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
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
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
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
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Blood Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {BLOOD_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, bloodType: type }))}
                      className={`px-4 py-4 rounded-xl font-bold text-lg transition-all ${
                        formData.bloodType === type
                          ? 'bg-red-600 text-white shadow-lg scale-110'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 hover:scale-105'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Last Donation Date <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="date"
                  name="lastDonation"
                  value={formData.lastDonation}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Medical Conditions <span className="text-gray-400">(Optional)</span>
                </label>
                <textarea
                  name="medicalConditions"
                  value={formData.medicalConditions}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                  placeholder="Let us know if you have any medical conditions we should be aware of..."
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Occupation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="What do you do?"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Preferred Language <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="preferredLanguage"
                  value={formData.preferredLanguage}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder="English, Hindi, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  How did you hear about us? <span className="text-red-500">*</span>
                </label>
                <select
                  name="howHeardAboutUs"
                  value={formData.howHeardAboutUs}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="">Select an option</option>
                  <option value="social_media">Social Media</option>
                  <option value="friend">Friend/Family</option>
                  <option value="search">Search Engine</option>
                  <option value="advertisement">Advertisement</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-xl p-4 hover:bg-red-100 transition-all">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    name="interestedInVolunteering"
                    checked={formData.interestedInVolunteering}
                    onChange={handleChange}
                    className="w-5 h-5 mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <div className="ml-3">
                    <div className="flex items-center">
                      <Heart className="w-4 h-4 text-red-600 mr-2" />
                      <span className="font-semibold text-gray-900">Interested in Volunteering?</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Join our community of volunteers and make a bigger impact!</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:bg-gray-100 transition-all">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    name="privacyPolicyAgreed"
                    checked={formData.privacyPolicyAgreed}
                    onChange={handleChange}
                    className="w-5 h-5 mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    required
                  />
                  <div className="ml-3">
                    <span className="font-semibold text-gray-900">I agree to the Privacy Policy</span>
                    <p className="text-sm text-gray-600 mt-1">
                      We respect your privacy and will never share your personal information without your consent.
                    </p>
                  </div>
                </label>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:bg-gray-100 transition-all">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    name="termsOfServiceAgreed"
                    checked={formData.termsOfServiceAgreed}
                    onChange={handleChange}
                    className="w-5 h-5 mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    required
                  />
                  <div className="ml-3">
                    <span className="font-semibold text-gray-900">I agree to the Terms of Service</span>
                    <p className="text-sm text-gray-600 mt-1">
                      By agreeing, you confirm that you meet the eligibility criteria for blood donation.
                    </p>
                  </div>
                </label>
              </div>

              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-6 mt-6">
                <div className="flex items-center mb-3">
                  <Sparkles className="w-6 h-6 text-red-600 mr-2" />
                  <h3 className="text-lg font-bold text-gray-900">You're about to become a hero!</h3>
                </div>
                <p className="text-gray-700 text-sm">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 bg-red-500 rounded-full animate-confetti"
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

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-2 mb-4">
              <Droplet className="w-8 h-8 text-red-600" />
              <h1 className="text-2xl font-bold text-gray-900">Complete Your Profile</h1>
            </div>
            <p className="text-gray-600">Just a few steps to get you started as a life-saver</p>
          </div>

          {/* Modern Stepper - Horizontal */}
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isCompleted = completedSteps.includes(index);
                  const isCurrent = index === currentStep;
                  const isPast = index < currentStep;

                  return (
                    <React.Fragment key={index}>
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 mb-2 ${
                            isCompleted
                              ? 'bg-green-500 text-white'
                              : isCurrent
                              ? 'bg-red-600 text-white shadow-lg'
                              : isPast
                              ? 'bg-gray-300 text-gray-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="w-6 h-6" />
                          ) : (
                            <StepIcon className="w-6 h-6" />
                          )}
                        </div>
                        <div className="text-center hidden md:block">
                          <div className={`text-sm font-semibold ${isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>
                            {step.title}
                          </div>
                          <div className="text-xs text-gray-400">{step.subtitle}</div>
                        </div>
                      </div>
                      {index < steps.length - 1 && (
                        <div className="flex-1 max-w-[100px] h-1 mx-2 rounded-full transition-all duration-300" style={{
                          backgroundColor: isPast || isCompleted ? '#10b981' : '#e5e7eb'
                        }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-6">
            {/* Step Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-2">
                {React.createElement(steps[currentStep].icon, { className: "w-6 h-6 text-red-600" })}
                <h2 className="text-2xl font-bold text-gray-900">{steps[currentStep].title}</h2>
              </div>
              <p className="text-gray-600">{steps[currentStep].subtitle}</p>
            </div>

            {/* Step Content */}
            {renderStep()}

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
              {currentStep > 0 && (
                <button
                  onClick={prevStep}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
                >
                  Previous
                </button>
              )}

              {currentStep < steps.length - 1 ? (
                <button
                  onClick={nextStep}
                  className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center group"
                >
                  Continue
                  <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
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
          <div className="text-center">
            <p className="text-gray-500 text-sm italic">
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

        /* Custom phone input styling */
        .phone-input-custom .PhoneInputInput {
          border: none;
          outline: none;
          font-size: 1rem;
        }

        .phone-input-custom {
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
        }

        .phone-input-custom:focus-within {
          border-color: #ef4444;
          ring: 2px;
          ring-color: #ef4444;
        }
      `}</style>
    </div>
  );
}

export default DonorOnboarding;
