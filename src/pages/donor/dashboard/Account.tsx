import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Chrome, Phone, Trash2, MapPin, Locate, Loader } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { deleteUser } from 'firebase/auth';
import { notify } from 'services/notify.service';
import { auth, db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { normalizePhoneNumber, isValidPhoneNumber } from '../../../utils/phone';
import { isValidEmail } from '../../../utils/validation';
import { countries, getStatesByCountry, getCitiesByState } from '../../../data/locations';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { getCurrentCoordinates, reverseGeocode } from '../../../utils/geolocation.utils';
import { authMessages } from '../../../constants/messages';
import { captureHandledError } from '../../../services/errorLog.service';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationMarker({
  position,
  setPosition,
}: {
  position: [number, number];
  setPosition: (pos: [number, number]) => void;
}) {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position ? (
    <Marker position={position}>
      <Popup>Your selected location</Popup>
    </Marker>
  ) : null;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

const DonorAccount = () => {
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const navigate = useNavigate();
  const {
    logout,
    updateUserProfile,
    updateEmailAddress,
    startPhoneUpdate,
    confirmPhoneUpdate,
  } = useAuth();
  const dashboard = useOutletContext<any>();
  const [isEditingBasicInfo, setIsEditingBasicInfo] = useState(false);
  const [basicInfoSaving, setBasicInfoSaving] = useState(false);
  const [basicInfoForm, setBasicInfoForm] = useState({
    displayName: '',
    gender: '',
    dateOfBirth: '',
    bloodType: '',
    address: '',
    latitude: 20.5937,
    longitude: 78.9629,
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });
  const [basicInfoErrors, setBasicInfoErrors] = useState<Record<string, string>>({});
  const [mapPosition, setMapPosition] = useState<[number, number]>([20.5937, 78.9629]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [availableStates, setAvailableStates] = useState(getStatesByCountry('IN'));
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneUpdateNumber, setPhoneUpdateNumber] = useState('');
  const [phoneUpdateOtp, setPhoneUpdateOtp] = useState('');
  const [phoneUpdateConfirmation, setPhoneUpdateConfirmation] = useState<any>(null);
  const [phoneUpdateLoading, setPhoneUpdateLoading] = useState(false);
  const [phoneUpdateError, setPhoneUpdateError] = useState('');
  const [phoneUpdateLockedNumber, setPhoneUpdateLockedNumber] = useState('');
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const reportDonorAccountError = (error: unknown, kind: string) => {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'donor',
      metadata: { kind, page: 'DonorAccount' },
    });
  };

  const {
    isLoading,
    user,
    availabilityEnabled,
    availabilitySaving,
    availabilityExpiryLabel,
    emergencyAlertsEnabled,
    emergencyAlertsSaving,
    handleAvailabilityToggle,
    handleEmergencyAlertsToggle,
    formatDate,
    isPhoneLinked,
    canUnlinkPhone,
    unlinkPhoneLoading,
    handlePhoneUnlink,
    linkPhoneNumber,
    setLinkPhoneNumber,
    linkPhoneLoading,
    handlePhoneLinkStart,
    linkConfirmation,
    linkOtp,
    setLinkOtp,
    handlePhoneLinkConfirm,
    handlePhoneLinkResend,
    isGoogleLinked,
    canUnlinkGoogle,
    unlinkGoogleLoading,
    handleGoogleUnlink,
    linkGoogleLoading,
    handleGoogleLink,
  } = dashboard;

  const {
    permission: pushPermission,
    loading: pushLoading,
    requestPermission,
    unsubscribe,
  } = usePushNotifications();

  const emailTarget = user?.email?.trim().toLowerCase() || '';
  const phoneTarget = user?.phoneNumber ? normalizePhoneNumber(user.phoneNumber) || user.phoneNumber : '';
  const inputValue = deleteConfirmInput.trim();
  const inputEmail = inputValue.toLowerCase();
  const inputPhone = normalizePhoneNumber(inputValue) || inputValue;
  const matchesEmail = Boolean(emailTarget && inputEmail === emailTarget);
  const matchesPhone = Boolean(phoneTarget && inputPhone === phoneTarget);
  const canConfirmDelete = matchesEmail || matchesPhone;

  useEffect(() => {
    if (!user) return;
    setPushEnabled(user.notificationPreferences?.push !== false);
  }, [user?.notificationPreferences?.push, user]);

  const handlePushToggle = async () => {
    if (!user?.uid) return;
    const wantsEnable = !pushEnabled;
    setPushMessage(null);
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushMessage('Push notifications are not supported in this browser.');
      return;
    }
    if (wantsEnable) {
      await requestPermission();
      if (Notification.permission === 'granted') {
        setPushEnabled(true);
        await updateDoc(doc(db, 'users', user.uid), {
          notificationPreferences: {
            ...(user.notificationPreferences || {}),
            push: true,
          },
          updatedAt: serverTimestamp(),
        });
      } else {
        setPushEnabled(false);
        await updateDoc(doc(db, 'users', user.uid), {
          notificationPreferences: {
            ...(user.notificationPreferences || {}),
            push: false,
          },
          updatedAt: serverTimestamp(),
        });
        setPushMessage('Notifications are blocked. Enable them in your browser settings.');
      }
    } else {
      await unsubscribe();
      setPushEnabled(false);
      await updateDoc(doc(db, 'users', user.uid), {
        notificationPreferences: {
          ...(user.notificationPreferences || {}),
          push: false,
        },
        updatedAt: serverTimestamp(),
      });
    }
  };

  const profileSnapshot = isEditingBasicInfo
    ? basicInfoForm
    : {
        displayName: user?.displayName || '',
        gender: user?.gender || '',
        dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : '',
        bloodType: user?.bloodType || '',
        address: user?.address || '',
        city: user?.city || '',
        state: user?.state || '',
        postalCode: user?.postalCode || '',
        country: user?.country || '',
      };
  const profileCompletionFields = [
    profileSnapshot.displayName,
    profileSnapshot.gender,
    profileSnapshot.dateOfBirth,
    profileSnapshot.bloodType,
    profileSnapshot.address,
    profileSnapshot.city,
    profileSnapshot.state,
    profileSnapshot.postalCode,
    profileSnapshot.country,
  ];
  const profileCompletionCount = profileCompletionFields.filter(Boolean).length;
  const profileCompletionPercent = Math.round((profileCompletionCount / profileCompletionFields.length) * 100);

  useEffect(() => {
    if (!user || isEditingBasicInfo) return;
    const dobValue = user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : '';
    const countryMatch = countries.find(country =>
      country.code === user?.country || country.name === user?.country
    );
    const resolvedCountry = countryMatch?.code || 'IN';
    setBasicInfoForm({
      displayName: user?.displayName || '',
      gender: user?.gender || '',
      dateOfBirth: dobValue,
      bloodType: user?.bloodType || '',
      address: user?.address || '',
      latitude: typeof (user as any)?.latitude === 'number' ? (user as any).latitude : 20.5937,
      longitude: typeof (user as any)?.longitude === 'number' ? (user as any).longitude : 78.9629,
      city: user?.city || '',
      state: user?.state || '',
      postalCode: user?.postalCode || '',
      country: resolvedCountry,
    });
    const lat = typeof (user as any)?.latitude === 'number' ? (user as any).latitude : 20.5937;
    const lng = typeof (user as any)?.longitude === 'number' ? (user as any).longitude : 78.9629;
    setMapPosition([lat, lng]);
  }, [user, isEditingBasicInfo]);

  useEffect(() => {
    if (!user || isEditingEmail) return;
    setEmailInput(user?.email || '');
    setEmailError('');
  }, [user, isEditingEmail]);

  useEffect(() => {
    if (!user || isEditingPhone) return;
    setPhoneUpdateNumber(user?.phoneNumber || '');
    setPhoneUpdateOtp('');
    setPhoneUpdateConfirmation(null);
    setPhoneUpdateError('');
    setPhoneUpdateLockedNumber('');
  }, [user, isEditingPhone]);

  useEffect(() => {
    const countryCode = basicInfoForm.country || 'IN';
    const states = getStatesByCountry(countryCode);
    setAvailableStates(states);
    if (!states.find(state => state.name === basicInfoForm.state)) {
      setBasicInfoForm(prev => ({ ...prev, state: '', city: '' }));
      setAvailableCities([]);
    }
  }, [basicInfoForm.country]);

  useEffect(() => {
    if (basicInfoForm.state) {
      const cities = getCitiesByState(basicInfoForm.country || 'IN', basicInfoForm.state);
      setAvailableCities(cities);
      if (!cities.includes(basicInfoForm.city)) {
        setBasicInfoForm(prev => ({ ...prev, city: '' }));
      }
    } else {
      setAvailableCities([]);
    }
  }, [basicInfoForm.state, basicInfoForm.country, basicInfoForm.city]);

  const handleBasicInfoChange = (field: string, value: string) => {
    setBasicInfoForm((prev) => ({ ...prev, [field]: value }));
    if (basicInfoErrors[field]) {
      setBasicInfoErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleAddressChange = (value: string) => {
    setBasicInfoForm(prev => ({ ...prev, address: value }));
    if (basicInfoErrors.address) {
      setBasicInfoErrors(prev => {
        const next = { ...prev };
        delete next.address;
        return next;
      });
    }

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!value.trim()) {
      setShowAddressSuggestions(false);
      setAddressSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=1`
        );
        const data = await response.json();
        setAddressSuggestions(data);
        setShowAddressSuggestions(data.length > 0);
      } catch (error) {
        reportDonorAccountError(error, 'donor.account.address.search');
      }
    }, 500);

    setSearchTimeout(timeout);
  };

  const handleAddressSelect = (suggestion: any) => {
    const lat = parseFloat(suggestion.lat);
    const lon = parseFloat(suggestion.lon);
    setBasicInfoForm(prev => ({
      ...prev,
      address: suggestion.display_name,
      latitude: lat,
      longitude: lon,
    }));
    setMapPosition([lat, lon]);
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);

    if (suggestion.address) {
      const addr = suggestion.address;
      if (addr.state) {
        const matchedState = availableStates.find(s =>
          s.name.toLowerCase() === addr.state.toLowerCase()
        );
        if (matchedState) {
          setBasicInfoForm(prev => ({ ...prev, state: matchedState.name }));
          if (basicInfoErrors.state) {
            setBasicInfoErrors(prev => {
              const next = { ...prev };
              delete next.state;
              return next;
            });
          }
          const stateCities = getCitiesByState(basicInfoForm.country || 'IN', matchedState.name);
          const matchedCity = stateCities.find(c =>
            c.toLowerCase() === (addr.city || addr.town || addr.village || '').toLowerCase()
          );
          if (matchedCity) {
            setBasicInfoForm(prev => ({ ...prev, city: matchedCity }));
            if (basicInfoErrors.city) {
              setBasicInfoErrors(prev => {
                const next = { ...prev };
                delete next.city;
                return next;
              });
            }
          }
        }
      }

      if (addr.postcode) {
        setBasicInfoForm(prev => ({ ...prev, postalCode: addr.postcode }));
        if (basicInfoErrors.postalCode) {
          setBasicInfoErrors(prev => {
            const next = { ...prev };
            delete next.postalCode;
            return next;
          });
        }
      }
    }
  };

  const getCurrentLocation = () => {
    void (async () => {
      setLocationLoading(true);
      const coords = await getCurrentCoordinates({ scope: 'donor' });
      if (!coords) {
        setLocationLoading(false);
        return;
      }

      const [latitude, longitude] = coords;
      setMapPosition([latitude, longitude]);
      setBasicInfoForm(prev => ({ ...prev, latitude, longitude }));

      const data = await reverseGeocode(latitude, longitude, { scope: 'donor' });
      if (data && data.address) {
        const address = data.address;
        setBasicInfoForm(prev => ({
          ...prev,
          address: data.display_name || prev.address,
          postalCode: address.postcode || prev.postalCode,
        }));
        if (basicInfoErrors.address || basicInfoErrors.postalCode) {
          setBasicInfoErrors(prev => {
            const next = { ...prev };
            delete next.address;
            delete next.postalCode;
            return next;
          });
        }

        if (address.state) {
          const matchedState = availableStates.find(s =>
            s.name.toLowerCase() === String(address.state).toLowerCase()
          );
          if (matchedState) {
            setBasicInfoForm(prev => ({ ...prev, state: matchedState.name }));
            if (basicInfoErrors.state) {
              setBasicInfoErrors(prev => {
                const next = { ...prev };
                delete next.state;
                return next;
              });
            }
            const stateCities = getCitiesByState(basicInfoForm.country || 'IN', matchedState.name);
            const matchedCity = stateCities.find(c =>
              c.toLowerCase() === String(address.city || address.town || address.village || '').toLowerCase()
            );
            if (matchedCity) {
              setBasicInfoForm(prev => ({ ...prev, city: matchedCity }));
              if (basicInfoErrors.city) {
                setBasicInfoErrors(prev => {
                  const next = { ...prev };
                  delete next.city;
                  return next;
                });
              }
            }
          }
        }

        notify.success('Location detected successfully!');
      }

      setLocationLoading(false);
    })();
  };

  const handleMapPositionChange = async (newPosition: [number, number]) => {
    setMapPosition(newPosition);
    setBasicInfoForm(prev => ({
      ...prev,
      latitude: newPosition[0],
      longitude: newPosition[1]
    }));

    const data = await reverseGeocode(newPosition[0], newPosition[1], {
      errorMessage: 'Could not fetch address for this location',
      scope: 'donor',
    });

    if (data && data.address) {
      const address = data.address;
      setBasicInfoForm(prev => ({
        ...prev,
        address: data.display_name || prev.address,
        postalCode: address.postcode || prev.postalCode,
      }));
      if (basicInfoErrors.address || basicInfoErrors.postalCode) {
        setBasicInfoErrors(prev => {
          const next = { ...prev };
          delete next.address;
          delete next.postalCode;
          return next;
        });
      }

      if (address.state) {
        const matchedState = availableStates.find(s =>
          s.name.toLowerCase() === String(address.state).toLowerCase()
        );
        if (matchedState) {
          setBasicInfoForm(prev => ({ ...prev, state: matchedState.name }));
          if (basicInfoErrors.state) {
            setBasicInfoErrors(prev => {
              const next = { ...prev };
              delete next.state;
              return next;
            });
          }
          const stateCities = getCitiesByState(basicInfoForm.country || 'IN', matchedState.name);
          const matchedCity = stateCities.find(c =>
            c.toLowerCase() === String(address.city || address.town || address.village || '').toLowerCase()
          );
          if (matchedCity) {
            setBasicInfoForm(prev => ({ ...prev, city: matchedCity }));
            if (basicInfoErrors.city) {
              setBasicInfoErrors(prev => {
                const next = { ...prev };
                delete next.city;
                return next;
              });
            }
          }
        }
      }
    }
  };

  const validateBasicInfo = () => {
    const errors: Record<string, string> = {};
    if (!basicInfoForm.displayName.trim()) errors.displayName = 'Required';
    if (!basicInfoForm.gender) errors.gender = 'Required';
    if (!basicInfoForm.dateOfBirth) {
      errors.dateOfBirth = 'Required';
    } else {
      const dob = new Date(`${basicInfoForm.dateOfBirth}T00:00:00`);
      if (Number.isNaN(dob.getTime())) {
        errors.dateOfBirth = 'Invalid date';
      } else if (dob > new Date()) {
        errors.dateOfBirth = 'Date cannot be in the future';
      }
    }
    if (!basicInfoForm.bloodType) errors.bloodType = 'Required';
    if (!basicInfoForm.address.trim()) errors.address = 'Required';
    if (!basicInfoForm.city.trim()) errors.city = 'Required';
    if (!basicInfoForm.state.trim()) errors.state = 'Required';
    if (!basicInfoForm.postalCode.trim()) {
      errors.postalCode = 'Required';
    } else if (!/^\d{4,10}$/.test(basicInfoForm.postalCode.trim())) {
      errors.postalCode = 'Invalid postal code';
    }
    if (!basicInfoForm.country.trim()) errors.country = 'Required';
    setBasicInfoErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBasicInfoCancel = () => {
    setBasicInfoErrors({});
    setIsEditingBasicInfo(false);
  };

  const handleBasicInfoSave = async () => {
    try {
      if (!validateBasicInfo()) {
        notify.error('Please fix the highlighted fields.');
        return;
      }
      setBasicInfoSaving(true);
      const countryMatch = countries.find(country => country.code === basicInfoForm.country);
      const payload: Record<string, any> = {
        displayName: basicInfoForm.displayName.trim(),
        gender: basicInfoForm.gender || undefined,
        bloodType: basicInfoForm.bloodType || undefined,
        address: basicInfoForm.address.trim(),
        latitude: basicInfoForm.latitude,
        longitude: basicInfoForm.longitude,
        city: basicInfoForm.city.trim(),
        state: basicInfoForm.state.trim(),
        postalCode: basicInfoForm.postalCode.trim(),
        country: countryMatch?.name || basicInfoForm.country.trim(),
      };
      if (basicInfoForm.dateOfBirth) {
        payload.dateOfBirth = new Date(`${basicInfoForm.dateOfBirth}T00:00:00`);
      } else {
        payload.dateOfBirth = undefined;
      }
      await updateUserProfile(payload);
      notify.success('Profile updated successfully.');
      setIsEditingBasicInfo(false);
    } catch (error: any) {
      reportDonorAccountError(error, 'donor.account.basic_info.update');
      notify.fromError(error, 'Failed to update profile.', { id: 'donor-account-basic-info-save-error' });
    } finally {
      setBasicInfoSaving(false);
    }
  };

  const handleEmailSave = async () => {
    const nextEmail = emailInput.trim().toLowerCase();
    if (!nextEmail) {
      notify.error('Email is required.');
      setEmailError('Required');
      return;
    }
    if (!isValidEmail(nextEmail)) {
      notify.error('Please enter a valid email address.');
      setEmailError('Invalid email');
      return;
    }
    setEmailError('');
    if (nextEmail === (user?.email || '').toLowerCase()) {
      setIsEditingEmail(false);
      return;
    }
    try {
      setEmailSaving(true);
      await updateEmailAddress(nextEmail);
      notify.success('Email updated. Please verify via the email sent.');
      setIsEditingEmail(false);
    } catch (error: any) {
      reportDonorAccountError(error, 'donor.account.email.update');
      if (error?.code === 'auth/requires-recent-login') {
        notify.error(authMessages.relogin.updateEmail);
      } else {
        notify.fromError(error, 'Failed to update email.', { id: 'donor-account-email-update-error' });
      }
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePhoneUpdateStart = async () => {
    const normalized = normalizePhoneNumber(phoneUpdateNumber);
    if (!isValidPhoneNumber(normalized)) {
      notify.error('Please enter a valid phone number.');
      setPhoneUpdateError('Invalid phone number');
      return;
    }
    setPhoneUpdateError('');
    try {
      setPhoneUpdateLoading(true);
      const confirmation = await startPhoneUpdate(normalized);
      setPhoneUpdateConfirmation(confirmation);
      setPhoneUpdateLockedNumber(normalized);
      notify.success('OTP sent successfully!');
    } catch (error: any) {
      reportDonorAccountError(error, 'donor.account.phone.update_start');
      notify.fromError(error, 'Failed to send OTP.', { id: 'donor-account-phone-update-start-error' });
    } finally {
      setPhoneUpdateLoading(false);
    }
  };

  const handlePhoneUpdateConfirm = async () => {
    if (!phoneUpdateConfirmation) {
      notify.error('Please request an OTP before verifying.');
      return;
    }
    const sanitizedOtp = phoneUpdateOtp.replace(/\D/g, '').trim();
    if (!sanitizedOtp) {
      notify.error('Please enter the OTP.');
      setPhoneUpdateError('OTP required');
      return;
    }
    if (sanitizedOtp.length !== 6) {
      notify.error('Invalid OTP length. Please enter the 6-digit code.');
      setPhoneUpdateError('Invalid OTP');
      return;
    }
    setPhoneUpdateError('');
    try {
      setPhoneUpdateLoading(true);
      const normalized = phoneUpdateLockedNumber || normalizePhoneNumber(phoneUpdateNumber);
      await confirmPhoneUpdate(phoneUpdateConfirmation, sanitizedOtp, normalized);
      setPhoneUpdateConfirmation(null);
      setPhoneUpdateOtp('');
      setPhoneUpdateLockedNumber('');
      setIsEditingPhone(false);
      notify.success('Phone number updated successfully!');
    } catch (error: any) {
      reportDonorAccountError(error, 'donor.account.phone.update_confirm');
      if (error?.code === 'auth/requires-recent-login') {
        notify.error(authMessages.relogin.updatePhone);
      } else {
        notify.fromError(error, 'Failed to update phone number.', { id: 'donor-account-phone-update-confirm-error' });
      }
    } finally {
      setPhoneUpdateLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!canConfirmDelete) {
      notify.error('Please enter your registered email or phone number.');
      return;
    }
    if (!auth.currentUser) {
      notify.error('No active session found. Please log in again.');
      return;
    }
    setDeleteLoading(true);
    try {
      const currentUserId = auth.currentUser.uid;
      await updateDoc(doc(db, 'users', currentUserId), {
        status: 'deleted',
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await deleteUser(auth.currentUser);
      await logout(navigate, { redirectTo: '/donor/login', showToast: false });
      notify.success('Account deleted successfully.');
    } catch (error: any) {
      reportDonorAccountError(error, 'donor.account.delete');
      if (error?.code === 'auth/requires-recent-login') {
        notify.error(authMessages.relogin.deleteAccount);
      } else {
        notify.fromError(error, 'Failed to delete account. Please try again.', { id: 'donor-account-delete-error' });
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-red-600">Account</p>
        <h2 className="text-xl font-bold text-gray-900">Manage profile and sharing</h2>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Basic Info</h2>
              <p className="text-xs text-gray-500">Keep your donor profile up to date.</p>
            </div>
            <div className="flex items-center gap-2">
              {isEditingBasicInfo ? (
                <>
                  <button
                    type="button"
                    onClick={handleBasicInfoCancel}
                    disabled={basicInfoSaving}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBasicInfoSave}
                    disabled={basicInfoSaving}
                    className="rounded-full border border-red-200 bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {basicInfoSaving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingBasicInfo(true)}
                  className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-gray-500">
              <span>Profile completion</span>
              <span>{profileCompletionPercent}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-red-500 transition-all"
                style={{ width: `${profileCompletionPercent}%` }}
              />
            </div>
            {profileCompletionPercent < 100 && (
              <p className="mt-2 text-xs text-gray-500">
                Missing: {profileCompletionFields
                  .map((value, index) => value ? null : index)
                  .filter((index) => index !== null)
                  .map((index) => {
                    const labels = [
                      'Full name',
                      'Gender',
                      'Date of birth',
                      'Blood type',
                      'Address',
                      'City',
                      'State',
                      'Postal code',
                      'Country',
                    ];
                    return labels[index as number];
                  })
                  .join(', ')}
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="mt-4 space-y-3">
              <div className="h-4 w-40 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-4 w-32 rounded-full bg-gray-100 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Full name</p>
                {isEditingBasicInfo ? (
                  <input
                    type="text"
                    value={basicInfoForm.displayName}
                    onChange={(event) => handleBasicInfoChange('displayName', event.target.value)}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
                      basicInfoErrors.displayName ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-red-500'
                    }`}
                  />
                ) : (
                  <p className="font-semibold text-gray-900">{user?.displayName || '—'}</p>
                )}
                {basicInfoErrors.displayName && (
                  <p className="mt-1 text-xs text-red-500">{basicInfoErrors.displayName}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Gender</p>
                {isEditingBasicInfo ? (
                  <select
                    value={basicInfoForm.gender}
                    onChange={(event) => handleBasicInfoChange('gender', event.target.value)}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
                      basicInfoErrors.gender ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-red-500'
                    }`}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                ) : (
                  <p className="font-semibold text-gray-900">{user?.gender || '—'}</p>
                )}
                {basicInfoErrors.gender && (
                  <p className="mt-1 text-xs text-red-500">{basicInfoErrors.gender}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Date of birth</p>
                {isEditingBasicInfo ? (
                  <input
                    type="date"
                    value={basicInfoForm.dateOfBirth}
                    onChange={(event) => handleBasicInfoChange('dateOfBirth', event.target.value)}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
                      basicInfoErrors.dateOfBirth ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-red-500'
                    }`}
                  />
                ) : (
                  <p className="font-semibold text-gray-900">{user?.dateOfBirth ? formatDate(user.dateOfBirth) : '—'}</p>
                )}
                {basicInfoErrors.dateOfBirth && (
                  <p className="mt-1 text-xs text-red-500">{basicInfoErrors.dateOfBirth}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Blood type</p>
                {isEditingBasicInfo ? (
                  <select
                    value={basicInfoForm.bloodType}
                    onChange={(event) => handleBasicInfoChange('bloodType', event.target.value)}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
                      basicInfoErrors.bloodType ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-red-500'
                    }`}
                  >
                    <option value="">Select</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                ) : (
                  <p className="font-semibold text-gray-900">{user?.bloodType || '—'}</p>
                )}
                {basicInfoErrors.bloodType && (
                  <p className="mt-1 text-xs text-red-500">{basicInfoErrors.bloodType}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Address</p>
                {isEditingBasicInfo ? (
                  <div className="mt-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Pick from map or search</span>
                      <button
                        type="button"
                        onClick={getCurrentLocation}
                        disabled={locationLoading}
                        className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        {locationLoading ? (
                          <>
                            <Loader className="h-3 w-3 animate-spin" />
                            Detecting...
                          </>
                        ) : (
                          <>
                            <Locate className="h-3 w-3" />
                            Use Current Location
                          </>
                        )}
                      </button>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '220px' }}>
                      <MapContainer
                        center={mapPosition}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <LocationMarker position={mapPosition} setPosition={handleMapPositionChange} />
                        <MapUpdater center={mapPosition} />
                      </MapContainer>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={basicInfoForm.address}
                        onChange={(event) => handleAddressChange(event.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
                          basicInfoErrors.address ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-red-500'
                        }`}
                        placeholder="Start typing your address..."
                        autoComplete="off"
                      />
                      {showAddressSuggestions && addressSuggestions.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                          {addressSuggestions.map((suggestion, index) => (
                            <button
                              key={`${suggestion.place_id}-${index}`}
                              type="button"
                              onClick={() => handleAddressSelect(suggestion)}
                              className="flex w-full items-start gap-2 border-b border-gray-100 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <MapPin className="mt-1 h-4 w-4 text-red-500" />
                              <span>{suggestion.display_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="font-semibold text-gray-900">{user?.address || '—'}</p>
                )}
                {basicInfoErrors.address && (
                  <p className="mt-1 text-xs text-red-500">{basicInfoErrors.address}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">City</p>
                {isEditingBasicInfo ? (
                  <select
                    value={basicInfoForm.city}
                    onChange={(event) => handleBasicInfoChange('city', event.target.value)}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
                      basicInfoErrors.city ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-red-500'
                    }`}
                    disabled={!basicInfoForm.state}
                  >
                    <option value="">Select City</option>
                    {availableCities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                ) : (
                  <p className="font-semibold text-gray-900">{user?.city || '—'}</p>
                )}
                {basicInfoErrors.city && (
                  <p className="mt-1 text-xs text-red-500">{basicInfoErrors.city}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">State</p>
                {isEditingBasicInfo ? (
                  <select
                    value={basicInfoForm.state}
                    onChange={(event) => handleBasicInfoChange('state', event.target.value)}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
                      basicInfoErrors.state ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-red-500'
                    }`}
                    disabled={!basicInfoForm.country}
                  >
                    <option value="">Select State</option>
                    {availableStates.map((state) => (
                      <option key={state.name} value={state.name}>{state.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="font-semibold text-gray-900">{user?.state || '—'}</p>
                )}
                {basicInfoErrors.state && (
                  <p className="mt-1 text-xs text-red-500">{basicInfoErrors.state}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Postal code</p>
                {isEditingBasicInfo ? (
                  <input
                    type="text"
                    value={basicInfoForm.postalCode}
                    onChange={(event) => handleBasicInfoChange('postalCode', event.target.value)}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
                      basicInfoErrors.postalCode ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-red-500'
                    }`}
                  />
                ) : (
                  <p className="font-semibold text-gray-900">{user?.postalCode || '—'}</p>
                )}
                {basicInfoErrors.postalCode && (
                  <p className="mt-1 text-xs text-red-500">{basicInfoErrors.postalCode}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Country</p>
                {isEditingBasicInfo ? (
                  <select
                    value={basicInfoForm.country}
                    onChange={(event) => handleBasicInfoChange('country', event.target.value)}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
                      basicInfoErrors.country ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-red-500'
                    }`}
                  >
                    <option value="">Select Country</option>
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="font-semibold text-gray-900">{user?.country || '—'}</p>
                )}
                {basicInfoErrors.country && (
                  <p className="mt-1 text-xs text-red-500">{basicInfoErrors.country}</p>
                )}
              </div>
              <div className="sm:col-span-2 text-[11px] uppercase tracking-wide text-gray-400">
                Email and phone updates are available in Contact Info.
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Notification Preferences</h2>
              <p className="text-xs text-gray-500">Manage alerts and availability.</p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Push Notifications</p>
                <p className="text-xs text-gray-500">Receive push alerts in your browser.</p>
                {pushPermission === 'denied' && !pushMessage && (
                  <p className="text-xs text-red-600 mt-1">
                    Notifications are blocked. Enable them in your browser settings.
                  </p>
                )}
                {pushMessage && (
                  <p className="text-xs text-red-600 mt-1">{pushMessage}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handlePushToggle}
                disabled={pushLoading}
                role="switch"
                aria-checked={pushEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${
                  pushEnabled ? 'bg-red-600' : 'bg-gray-300'
                } ${pushLoading ? 'opacity-60' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    pushEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Availability</p>
                <p className="text-xs text-gray-500">Control emergency notifications.</p>
              </div>
              <button
                type="button"
                onClick={handleAvailabilityToggle}
                disabled={availabilitySaving}
                role="switch"
                aria-checked={availabilityEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${
                  availabilityEnabled ? 'bg-red-600' : 'bg-gray-300'
                } ${availabilitySaving ? 'opacity-60' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    availabilityEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {availabilityExpiryLabel && availabilityEnabled && (
              <p className="text-[11px] text-gray-500">
                Available until {availabilityExpiryLabel}
              </p>
            )}

            <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Emergency Alerts</p>
                <p className="text-xs text-gray-500">Get notified about urgent requests.</p>
              </div>
              <button
                type="button"
                onClick={handleEmergencyAlertsToggle}
                disabled={emergencyAlertsSaving || !availabilityEnabled}
                role="switch"
                aria-checked={emergencyAlertsEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${
                  emergencyAlertsEnabled ? 'bg-red-600' : 'bg-gray-300'
                } ${emergencyAlertsSaving || !availabilityEnabled ? 'opacity-60' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    emergencyAlertsEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Contact Info</h2>
              <p className="text-xs text-gray-500">Update email or phone with verification.</p>
            </div>
          </div>
          {isLoading ? (
            <div className="mt-4 space-y-3">
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Email</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{user?.email || 'Not set'}</p>
                      {user?.email && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          user.emailVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {user.emailVerified ? 'Verified' : 'Unverified'}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isEditingEmail ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingEmail(true)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingEmail(false)}
                        disabled={emailSaving}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleEmailSave}
                        disabled={emailSaving}
                        className="rounded-full border border-red-200 bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {emailSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
                {isEditingEmail && (
                  <div className="mt-3">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(event) => {
                        setEmailInput(event.target.value);
                        if (emailError) setEmailError('');
                      }}
                      className={`w-full rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none ${
                        emailError ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-red-500'
                      }`}
                      placeholder="your@email.com"
                    />
                    {emailError && (
                      <p className="mt-2 text-xs text-red-500">{emailError}</p>
                    )}
                    <p className="mt-2 text-xs text-gray-500">
                      We will send a verification link to your new email.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Phone</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{user?.phoneNumber || 'Not set'}</p>
                      {user?.phoneNumber && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                  {!isEditingPhone ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingPhone(true)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingPhone(false)}
                        disabled={phoneUpdateLoading}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                {isEditingPhone && (
                  <div className="mt-3 space-y-3">
                    <PhoneInput
                      international
                      defaultCountry="IN"
                      countryCallingCodeEditable={false}
                      value={phoneUpdateNumber}
                      onChange={(value) => {
                        setPhoneUpdateNumber(value || '');
                        if (phoneUpdateError) setPhoneUpdateError('');
                      }}
                      disabled={Boolean(phoneUpdateConfirmation)}
                      className="block w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors text-sm"
                    />
                    {phoneUpdateError && (
                      <p className="text-xs text-red-500">{phoneUpdateError}</p>
                    )}
                    {!phoneUpdateConfirmation ? (
                      <button
                        type="button"
                        onClick={handlePhoneUpdateStart}
                        disabled={phoneUpdateLoading}
                        className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {phoneUpdateLoading ? 'Sending OTP...' : 'Send OTP'}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={phoneUpdateOtp}
                          onChange={(event) => setPhoneUpdateOtp(event.target.value)}
                          maxLength={6}
                          placeholder="Enter OTP"
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none text-center text-sm font-semibold tracking-widest"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPhoneUpdateConfirmation(null);
                            setPhoneUpdateOtp('');
                            setPhoneUpdateError('');
                            setPhoneUpdateLockedNumber('');
                          }}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          Change phone number
                        </button>
                        <button
                          type="button"
                          onClick={handlePhoneUpdateConfirm}
                          disabled={phoneUpdateLoading}
                          className="w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                          {phoneUpdateLoading ? 'Verifying...' : 'Verify & Update'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Linked Accounts</h2>
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center">
                  <Phone className="w-4 h-4 mr-2 text-red-600" />
                  Phone
                </span>
                <span className={`text-xs font-semibold ${isPhoneLinked ? 'text-red-600' : 'text-gray-400'}`}>
                  {isPhoneLinked ? 'Linked' : 'Not linked'}
                </span>
              </div>
              {isPhoneLinked && (
                <button
                  type="button"
                  onClick={handlePhoneUnlink}
                  disabled={!canUnlinkPhone || unlinkPhoneLoading}
                  className="w-full py-2 px-4 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all duration-300 disabled:opacity-50"
                >
                  {unlinkPhoneLoading ? 'Unlinking...' : 'Unlink Phone'}
                </button>
              )}
              {!isPhoneLinked && (
                <div className="space-y-3">
                  <PhoneInput
                    international
                    defaultCountry="IN"
                    countryCallingCodeEditable={false}
                    value={linkPhoneNumber}
                    onChange={(value) => setLinkPhoneNumber(value || '')}
                    className="block w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors text-sm"
                  />
                  <button
                    type="button"
                    onClick={handlePhoneLinkStart}
                    disabled={linkPhoneLoading}
                    className="w-full py-2 px-4 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
                  >
                    {linkPhoneLoading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                  {linkConfirmation && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={linkOtp}
                        onChange={(e) => setLinkOtp(e.target.value)}
                        maxLength={6}
                        placeholder="Enter OTP"
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors text-center text-sm font-semibold tracking-widest"
                      />
                      <button
                        type="button"
                        onClick={handlePhoneLinkConfirm}
                        disabled={linkPhoneLoading}
                        className="w-full py-2 px-4 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-all duration-300 disabled:opacity-50"
                      >
                        {linkPhoneLoading ? 'Verifying...' : 'Verify & Link'}
                      </button>
                      <button
                        type="button"
                        onClick={handlePhoneLinkResend}
                        disabled={linkPhoneLoading}
                        className="w-full py-2 px-4 text-sm text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all duration-300 disabled:opacity-50"
                      >
                        Resend OTP
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center">
                  <Chrome className="w-4 h-4 mr-2 text-red-600" />
                  Google
                </span>
                <span className={`text-xs font-semibold ${isGoogleLinked ? 'text-red-600' : 'text-gray-400'}`}>
                  {isGoogleLinked ? 'Linked' : 'Not linked'}
                </span>
              </div>
              {isGoogleLinked && (
                <button
                  type="button"
                  onClick={handleGoogleUnlink}
                  disabled={!canUnlinkGoogle || unlinkGoogleLoading}
                  className="w-full py-2 px-4 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all duration-300 disabled:opacity-50"
                >
                  {unlinkGoogleLoading ? 'Unlinking...' : 'Unlink Google'}
                </button>
              )}
              {!isGoogleLinked && (
                <button
                  type="button"
                  onClick={handleGoogleLink}
                  disabled={linkGoogleLoading}
                  className="w-full py-2 px-4 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
                >
                  {linkGoogleLoading ? 'Linking...' : 'Link Google'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-6 shadow-sm dark:border-red-200 dark:bg-[#101826]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-red-700 dark:text-red-700">Delete Account</h3>
              <p className="text-xs text-red-700/80 dark:text-red-600">This action is permanent and cannot be undone.</p>
            </div>
            <div className="rounded-full bg-red-50 p-2 dark:bg-[#0a0f1a]">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <p className="text-xs text-red-700/80 dark:text-red-600">
              Type your registered email or phone number to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(event) => setDeleteConfirmInput(event.target.value)}
              placeholder="Email or phone number"
              className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 dark:border-red-200 dark:bg-[#0a0f1a] dark:text-gray-700"
            />
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={!canConfirmDelete || deleteLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleteLoading ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DonorAccount;
