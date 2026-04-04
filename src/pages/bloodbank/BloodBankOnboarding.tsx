// src/pages/bloodbank/BloodBankOnboarding.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { applyReferralTrackingForUser, ensureReferralTrackingForExistingReferral } from '../../services/referral.service';
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
import { ROUTES } from '../../constants/routes';
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

const BLOODBANK_TYPES = [
  'Government',
  'Private',
  'Multi-Specialty',
  'Super-Specialty',
  'General',
  'Teaching Blood Bank',
  'Community Blood Bank',
  'Other',
];

interface OnboardingFormData {
  hospitalName: string;
  registrationNumber: string;
  hospitalType: string;
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
  numberOfBeds: string;
  hasBloodBank: boolean;
  hasEmergencyServices: boolean;
  description: string;
  privacyPolicyAgreed: boolean;
  termsOfServiceAgreed: boolean;
}

const bloodBankOnboardingValidationRules: Array<OnboardingValidationRule<OnboardingFormData>> = [
  { step: 0, required: ['hospitalName', 'registrationNumber', 'hospitalType', 'contactPersonName'], message: 'onboarding.bloodbankValidationInfo' },
  { step: 1, required: ['email', 'phone', 'dateOfBirth', 'address', 'city', 'state', 'postalCode', 'country'], message: 'onboarding.bloodbankValidationContact' },
  { step: 2, required: ['numberOfBeds', 'description'], message: 'onboarding.bloodbankValidationFacilities' },
  { step: 3, required: ['privacyPolicyAgreed', 'termsOfServiceAgreed'], message: 'onboarding.bloodbankValidationConsent' },
];

export function BloodBankOnboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, updateUserProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormData>({
    hospitalName: '',
    registrationNumber: '',
    hospitalType: '',
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
    numberOfBeds: '',
    hasBloodBank: false,
    hasEmergencyServices: false,
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
    scope: 'bloodbank',
    metadata: { page: 'BloodBankOnboarding' },
  });
  const {
    suggestions: addressSuggestions,
    showSuggestions: showAddressSuggestions,
    searchSuggestions,
    clearSuggestions,
  } = useAddressAutocomplete({
    scope: 'bloodbank',
    page: 'BloodBankOnboarding',
  });
  const { resolveCurrentLocation, resolveFromCoordinates } = useLocationResolver('bloodbank');
  const bloodBankTypeLabels: Record<string, string> = {
    Government: t('onboarding.bloodbankTypes.government'),
    Private: t('onboarding.bloodbankTypes.private'),
    'Multi-Specialty': t('onboarding.bloodbankTypes.multiSpecialty'),
    'Super-Specialty': t('onboarding.bloodbankTypes.superSpecialty'),
    General: t('onboarding.bloodbankTypes.general'),
    'Teaching Blood Bank': t('onboarding.bloodbankTypes.teaching'),
    'Community Blood Bank': t('onboarding.bloodbankTypes.community'),
    Other: t('onboarding.bloodbankTypes.other'),
  };

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
        reportOnboardingError(error, 'bloodbank.onboarding.detect_location');
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
        errorMessage: t('onboarding.couldNotFetchAddress'),
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
      reportOnboardingError(error, 'bloodbank.onboarding.map_reverse_geocode');
    }
  };

  const validateStep = () => {
    return validateOnboardingStep({
      step: currentStep,
      data: formData,
      rules: bloodBankOnboardingValidationRules,
      onError: (message) => notify.error(t(message)),
    });
  };

  const steps = [
    { icon: Building2, title: t('onboarding.bloodbank'), subtitle: t('onboarding.basicInfo'), color: 'yellow' },
    { icon: MapPin, title: t('onboarding.contact'), subtitle: t('onboarding.locationDetails'), color: 'yellow' },
    { icon: FileText, title: t('onboarding.facilities'), subtitle: t('onboarding.servicesInfo'), color: 'red' },
    { icon: CheckCircle, title: t('onboarding.consent'), subtitle: t('onboarding.agreement'), color: 'yellow' },
  ] as const;

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

    const parsedDob = formData.dateOfBirth ? new Date(formData.dateOfBirth) : null;
    if (parsedDob && Number.isNaN(parsedDob.getTime())) {
      notify.error(t('onboarding.validDateOfBirthRequired'));
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        ...formData,
        bloodBankName: formData.hospitalName,
        bloodBankType: formData.hospitalType,
        hospitalName: formData.hospitalName,
        hospitalType: formData.hospitalType,
        dateOfBirth: parsedDob ?? undefined,
        onboardingCompleted: true,
      };
      await updateUserProfile(payload);
      if (user?.uid) {
        try {
          await applyReferralTrackingForUser(user.uid);
        } catch (referralError) {
          reportOnboardingError(referralError, 'bloodbank.onboarding.referral_tracking');
        }
        try {
          await ensureReferralTrackingForExistingReferral({
            ...user,
            onboardingCompleted: true,
            role: user.role || 'bloodbank',
          });
        } catch (referralError) {
          reportOnboardingError(referralError, 'bloodbank.onboarding.referral_sync');
        }
      }
      notify.success(t('onboarding.bloodbankCompleted'));
      navigate(ROUTES.portal.bloodbank.dashboard.root);
    } catch (error) {
      reportOnboardingError(error, 'bloodbank.onboarding.submit');
      notify.error(resolveOnboardingSubmitErrorMessage(error, 'bloodbank'));
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
                {t('onboarding.bloodbankName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="hospitalName"
                value={formData.hospitalName}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder={t('onboarding.bloodbankNamePlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('onboarding.registrationNumber')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="registrationNumber"
                value={formData.registrationNumber}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder={t('onboarding.bloodbankRegistrationPlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('onboarding.bloodbankType')} <span className="text-red-500">*</span>
              </label>
              <select
                name="hospitalType"
                value={formData.hospitalType}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                required
              >
                <option value="">{t('onboarding.selectBloodbankType')}</option>
                {BLOODBANK_TYPES.map((type) => (
                  <option key={type} value={type}>{bloodBankTypeLabels[type] || type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('onboarding.contactPersonName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="contactPersonName"
                value={formData.contactPersonName}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder={t('onboarding.contactPersonPlaceholder')}
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
                  {t('onboarding.email')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  placeholder={t('onboarding.bloodbankEmailPlaceholder')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('onboarding.phoneNumber')} <span className="text-red-500">*</span>
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
                  {t('onboarding.dateOfBirth')} <span className="text-red-500">*</span>
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('onboarding.country')} <span className="text-red-500">*</span>
                </label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="">{t('onboarding.selectCountry')}</option>
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
                    {t('onboarding.address')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={locationLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                >
                    {locationLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        {t('onboarding.detecting')}
                      </>
                    ) : (
                      <>
                        <Locate className="w-4 h-4" />
                        {t('onboarding.useCurrentLocation')}
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
                      popupText={t('onboarding.selectedLocation')}
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
                    placeholder={t('onboarding.addressPlaceholder')}
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
                            <MapPin className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-1" />
                            <div className="text-sm text-gray-700">{suggestion.display_name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-1">{t('onboarding.searchAddressHint')}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('onboarding.state')} <span className="text-red-500">*</span>
                </label>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  required
                  disabled={!formData.country}
                >
                  <option value="">{t('onboarding.selectState')}</option>
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
                    {t('onboarding.city')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    required
                    disabled={!formData.state}
                  >
                    <option value="">{t('onboarding.selectCity')}</option>
                    {availableCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('onboarding.pincode')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    placeholder={t('onboarding.pincodePlaceholder')}
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
                {t('onboarding.website')}
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder={t('onboarding.websitePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('onboarding.numberOfBeds')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="numberOfBeds"
                value={formData.numberOfBeds}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder={t('onboarding.numberOfBedsPlaceholder')}
                min="1"
                required
              />
            </div>

            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="hasBloodBank"
                  checked={formData.hasBloodBank}
                  onChange={handleChange}
                  className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="text-sm font-semibold text-gray-700">
                  {t('onboarding.bloodBankAvailable')}
                </span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="hasEmergencyServices"
                  checked={formData.hasEmergencyServices}
                  onChange={handleChange}
                  className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="text-sm font-semibold text-gray-700">
                  {t('onboarding.emergencyServicesAvailable')}
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('onboarding.description')} <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                placeholder={t('onboarding.bloodbankDescriptionPlaceholder')}
                required
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-100">
              <h3 className="font-bold text-gray-900 mb-4">{t('onboarding.reviewInformation')}</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">{t('onboarding.reviewBloodbank')}</span> {formData.hospitalName}</p>
                <p><span className="font-semibold">{t('onboarding.reviewType')}</span> {bloodBankTypeLabels[formData.hospitalType] || formData.hospitalType}</p>
                <p><span className="font-semibold">{t('onboarding.reviewContactPerson')}</span> {formData.contactPersonName}</p>
                <p><span className="font-semibold">{t('onboarding.reviewEmail')}</span> {formData.email}</p>
                <p><span className="font-semibold">{t('onboarding.reviewLocation')}</span> {formData.city}, {formData.state}</p>
                <p><span className="font-semibold">{t('onboarding.reviewBeds')}</span> {formData.numberOfBeds}</p>
                <p><span className="font-semibold">{t('onboarding.reviewBloodBankAvailability')}</span> {formData.hasBloodBank ? t('common.yes') : t('common.no')}</p>
                <p><span className="font-semibold">{t('onboarding.reviewEmergencyServices')}</span> {formData.hasEmergencyServices ? t('common.yes') : t('common.no')}</p>
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
                  {t('onboarding.termsAgreement')}
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
                  {t('onboarding.privacyAgreement')}
                </span>
              </label>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-yellow-50 py-12 px-4">
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
                        ? 'bg-yellow-500 text-white'
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
                      completedSteps.includes(index) ? 'bg-yellow-500' : 'bg-gray-200'
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
                  {t('common.back')}
                </button>
              )}

              {currentStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="ml-auto px-6 py-3 bg-gradient-to-r from-red-600 to-yellow-500 text-white rounded-xl font-semibold hover:from-red-700 hover:to-yellow-600 transition-colors flex items-center space-x-2"
                >
                  <span>{t('common.next')}</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="ml-auto px-6 py-3 bg-gradient-to-r from-red-600 to-yellow-500 text-white rounded-xl font-semibold hover:from-red-700 hover:to-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{t('common.completing')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('common.completeOnboarding')}</span>
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

export default BloodBankOnboarding;
