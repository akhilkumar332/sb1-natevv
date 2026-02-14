import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, MapPin, Filter, AlertCircle, CheckCircle, Clock, Heart, X, Users, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, where, writeBatch } from 'firebase/firestore';
import { calculateDistance } from '../utils/geolocation';
import type { Coordinates } from '../types/database.types';
import { db } from '../firebase';
import {
  decodePendingDonorRequest,
  encodePendingDonorRequest,
  loadPendingDonorRequestDoc,
  savePendingDonorRequestDoc,
  clearPendingDonorRequestDoc,
  savePendingDonorRequestToSession,
  loadPendingDonorRequestFromSession,
  clearPendingDonorRequestFromSession,
  submitDonorRequestBatch,
  MAX_DONOR_REQUEST_BATCH_TARGETS,
  MAX_DONOR_REQUEST_MESSAGE_LENGTH,
  type DonationComponent,
  type PendingDonorRequest,
  type PendingDonorRequestBatch,
  type PendingDonorRequestPayload,
} from '../services/donorRequest.service';
import toast from 'react-hot-toast';

interface Donor {
  id: string;
  bhId?: string;
  name: string;
  bloodType: string;
  location: string;
  distance: number | null;
  lastDonation: Date | null;
  phone: string | null;
  email: string | null;
  availability: 'Available' | 'Unavailable';
  gender: 'Male' | 'Female' | 'Other' | string;
  donationTypes: DonationComponent[];
}

function FindDonors() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, updateUserProfile } = useAuth();

  const urlParams = new URLSearchParams(location.search);

  const [searchTerm, setSearchTerm] = useState<string>(urlParams.get('searchTerm') || '');
  const [selectedBloodType, setSelectedBloodType] = useState<string>(urlParams.get('bloodType') || '');
  const [selectedDistance, setSelectedDistance] = useState<string>(urlParams.get('distance') || '');
  const [selectedAvailability, setSelectedAvailability] = useState<string>(urlParams.get('availability') || '');
  const [selectedGender, setSelectedGender] = useState<string>(urlParams.get('gender') || '');
  const [selectedDonationType, setSelectedDonationType] = useState<string>(urlParams.get('donationType') || '');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [donorError, setDonorError] = useState<string | null>(null);
  const [baseDonors, setBaseDonors] = useState<Donor[]>([]);
  const [viewerLocation, setViewerLocation] = useState<Coordinates | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationRequesting, setLocationRequesting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [trayDonors, setTrayDonors] = useState<Donor[]>([]);
  const [showRequestStudio, setShowRequestStudio] = useState(false);
  const [requestDonationType, setRequestDonationType] = useState<DonationComponent>('whole');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestResult, setRequestResult] = useState<{ sent: number; skipped: number } | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [sendSliderValue, setSendSliderValue] = useState(0);
  const [sliderDragging, setSliderDragging] = useState(false);
  const [useFilteredRecipients, setUseFilteredRecipients] = useState(false);
  const [undoingBatchId, setUndoingBatchId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const cacheTTL = 120000;
  const [rawDonorsVersion, setRawDonorsVersion] = useState(0);
  const rawDonorsRef = useRef<any[] | null>(null);
  const rawDonorSourceRef = useRef<'publicDonors' | 'users' | null>(null);
  const rawDonorLastDocRef = useRef<any | null>(null);
  const rawDonorHasMoreRef = useRef(false);
  const rawDonorsLoadedAtRef = useRef(0);
  const prefetchInFlightRef = useRef(false);
  const selfRequestToastRef = useRef<string | null>(null);
  const pendingRequestProcessedRef = useRef<string | null>(null);
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const sliderValueRef = useRef(0);

  const requestLocation = () => {
    if (!navigator?.geolocation) {
      setLocationEnabled(false);
      setLocationError('Location services are not supported in this browser.');
      return;
    }
    setLocationRequesting(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setViewerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationEnabled(true);
        setLocationRequesting(false);
      },
      (error) => {
        setLocationEnabled(false);
        setLocationRequesting(false);
        if (error.code === 1) {
          setLocationError('Location access is blocked. Please enable location to find donors.');
        } else if (error.code === 2) {
          setLocationError('Unable to determine your location. Please try again.');
        } else if (error.code === 3) {
          setLocationError('Location request timed out. Please try again.');
        } else {
          setLocationError('Enable location to use Find Donors.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const updateURL = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('searchTerm', searchTerm);
    if (selectedBloodType) params.set('bloodType', selectedBloodType);
    if (selectedDistance) params.set('distance', selectedDistance);
    if (selectedAvailability) params.set('availability', selectedAvailability);
    if (selectedGender) params.set('gender', selectedGender);
    if (selectedDonationType) params.set('donationType', selectedDonationType);

    navigate({ search: params.toString() });
  };

  useEffect(() => {
    updateURL();
  }, [searchTerm, selectedBloodType, selectedDistance, selectedAvailability, selectedGender, selectedDonationType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedBloodType,
    selectedDistance,
    selectedAvailability,
    selectedGender,
    selectedDonationType,
    viewerLocation?.latitude,
    viewerLocation?.longitude,
  ]);

  const mapDonorRows = (rows: any[], location: Coordinates | null) => rows
    .filter((donor: any) => donor && (donor.uid || donor.id))
    .filter((donor: any) => donor.status !== 'deleted' && donor.onboardingCompleted !== false)
    .filter((donor: any) => !donor.status || donor.status === 'active')
    .map((donor: any) => {
      const donationTypesFromProfile = Array.isArray(donor.donationTypes)
        ? donor.donationTypes.filter(Boolean)
        : donor.donationType
          ? [donor.donationType].filter(Boolean)
          : ['whole'];
      const donorCoords = typeof donor.latitude === 'number' && typeof donor.longitude === 'number'
        ? { latitude: donor.latitude, longitude: donor.longitude }
        : null;
      const distance = location && donorCoords
        ? calculateDistance(location, donorCoords)
        : null;
      const locationParts = [donor.city, donor.state].filter(Boolean).join(', ');
      const availableUntil = donor.availableUntil?.toDate
        ? donor.availableUntil.toDate()
        : donor.availableUntil
          ? new Date(donor.availableUntil)
          : null;
      const breakActive = Boolean(
        availableUntil && !Number.isNaN(availableUntil.getTime()) && availableUntil.getTime() > Date.now()
      );
      const isAvailable = donor.isAvailable !== false && !breakActive;
      const lastDonationDate = donor.lastDonation?.toDate
        ? donor.lastDonation.toDate()
        : donor.lastDonation
          ? new Date(donor.lastDonation)
          : null;
      return {
        id: donor.uid || donor.id,
        bhId: donor.bhId,
        name: donor.displayName || donor.name || 'Anonymous Donor',
        bloodType: donor.bloodType || 'Unknown',
        location: locationParts || donor.address || 'Location unavailable',
        distance,
        lastDonation: lastDonationDate && !Number.isNaN(lastDonationDate.getTime()) ? lastDonationDate : null,
        phone: donor.phoneNumber || donor.phone || null,
        email: donor.email || null,
        availability: isAvailable ? 'Available' : 'Unavailable',
        gender: donor.gender || 'Not specified',
        donationTypes: donationTypesFromProfile.length > 0 ? donationTypesFromProfile : ['whole'],
      } as Donor;
    });

  const readCachedDonors = (source: 'publicDonors' | 'users') => {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    try {
      const raw = window.sessionStorage.getItem(`donorCache:${source}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { timestamp: number; rows: any[] };
      if (!parsed?.timestamp || !Array.isArray(parsed.rows)) return null;
      if (Date.now() - parsed.timestamp > cacheTTL) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const writeCachedDonors = (source: 'publicDonors' | 'users', rows: any[]) => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const sanitized = rows.map((donor) => ({
        id: donor.id,
        uid: donor.uid,
        bhId: donor.bhId,
        displayName: donor.displayName,
        name: donor.name,
        bloodType: donor.bloodType,
        city: donor.city,
        state: donor.state,
        latitude: donor.latitude,
        longitude: donor.longitude,
        lastDonation: donor.lastDonation,
        donationTypes: donor.donationTypes,
        donationType: donor.donationType,
        gender: donor.gender,
        isAvailable: donor.isAvailable,
        availableUntil: donor.availableUntil,
        status: donor.status,
        onboardingCompleted: donor.onboardingCompleted,
        address: donor.address,
      }));
      window.sessionStorage.setItem(
        `donorCache:${source}`,
        JSON.stringify({ timestamp: Date.now(), rows: sanitized })
      );
    } catch {
      // ignore
    }
  };

  const setRawDonors = (
    rows: any[],
    source: 'publicDonors' | 'users',
    lastDoc: any | null,
    hasMore: boolean
  ) => {
    rawDonorsRef.current = rows;
    rawDonorSourceRef.current = source;
    rawDonorLastDocRef.current = lastDoc;
    rawDonorHasMoreRef.current = hasMore;
    rawDonorsLoadedAtRef.current = Date.now();
    setRawDonorsVersion((prev) => prev + 1);
  };

  const appendRawDonors = (rows: any[], lastDoc: any | null, hasMore: boolean) => {
    const existing = rawDonorsRef.current || [];
    rawDonorsRef.current = [...existing, ...rows];
    rawDonorLastDocRef.current = lastDoc;
    rawDonorHasMoreRef.current = hasMore;
    rawDonorsLoadedAtRef.current = Date.now();
    setRawDonorsVersion((prev) => prev + 1);
  };

  const fetchCollectionBatch = async (
    collectionName: string,
    roleFilter: boolean,
    lastDoc: any | null
  ) => {
    const batchSize = 200;
    const constraints: any[] = [orderBy('__name__'), limit(batchSize)];
    if (roleFilter) {
      constraints.unshift(where('role', '==', 'donor'));
    }
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
    const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    const nextLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    return { rows, lastDoc: nextLastDoc, hasMore: snapshot.size === batchSize };
  };

  const prefetchDonors = async () => {
    if (prefetchInFlightRef.current) return;
    if (rawDonorsRef.current && Date.now() - rawDonorsLoadedAtRef.current < cacheTTL) {
      return;
    }
    prefetchInFlightRef.current = true;
    setLoading(true);
    setDonorError(null);

    const cachedPublic = readCachedDonors('publicDonors');
    if (cachedPublic?.rows?.length) {
      setRawDonors(cachedPublic.rows, 'publicDonors', null, false);
      setLoading(false);
    }

    try {
      let source: 'publicDonors' | 'users' = 'publicDonors';
      let roleFilter = false;
      let result;
      try {
        result = await fetchCollectionBatch('publicDonors', false, null);
      } catch (publicError) {
        if (user) {
          source = 'users';
          roleFilter = true;
          result = await fetchCollectionBatch('users', true, null);
        } else {
          throw publicError;
        }
      }
      if (result && result.rows.length === 0 && user) {
        source = 'users';
        roleFilter = true;
        result = await fetchCollectionBatch('users', true, null);
      }
      if (result.rows.length === 0 && !user) {
        setBaseDonors([]);
        setLoading(false);
        prefetchInFlightRef.current = false;
        return;
      }

      setRawDonors(result.rows, source, result.lastDoc, result.hasMore);
      writeCachedDonors(source, result.rows);

      if (result.hasMore) {
        const fetchMore = async () => {
          while (rawDonorHasMoreRef.current) {
            const next = await fetchCollectionBatch(source, roleFilter, rawDonorLastDocRef.current);
            if (!next.rows.length) {
              rawDonorHasMoreRef.current = false;
              break;
            }
            appendRawDonors(next.rows, next.lastDoc, next.hasMore);
            writeCachedDonors(source, rawDonorsRef.current || []);
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        };
        void fetchMore();
      }
    } catch (error) {
      console.error('Failed to load donors:', error);
      if (!rawDonorsRef.current || rawDonorsRef.current.length === 0) {
        setBaseDonors([]);
        setDonorError('Unable to load donors right now.');
      }
    } finally {
      setLoading(false);
      prefetchInFlightRef.current = false;
    }
  };

  useEffect(() => {
    void prefetchDonors();
  }, [user?.uid]);

  useEffect(() => {
    if (!rawDonorsRef.current) return;
    const mapped = mapDonorRows(rawDonorsRef.current, viewerLocation);
    setBaseDonors(mapped);
  }, [rawDonorsVersion, viewerLocation]);

  useEffect(() => {
    if (!locationEnabled) {
      setCurrentPage(1);
    }
  }, [locationEnabled]);

  const filteredDonors = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const maxDistance = selectedDistance ? parseInt(selectedDistance, 10) : null;
    const selectedDonation = selectedDonationType as DonationComponent | '';
    return baseDonors
      .filter((donor) => (user?.uid ? donor.id !== user.uid : true))
      .filter((donor) => (!selectedBloodType ? true : donor.bloodType === selectedBloodType))
      .filter((donor) => {
        if (!normalizedSearch) return true;
        return donor.name.toLowerCase().includes(normalizedSearch) ||
          donor.location.toLowerCase().includes(normalizedSearch);
      })
      .filter((donor) => (!selectedAvailability ? true : donor.availability === selectedAvailability))
      .filter((donor) => (!selectedGender ? true : donor.gender === selectedGender))
      .filter((donor) => (!selectedDonation ? true : donor.donationTypes.includes(selectedDonation)))
      .filter((donor) => {
        if (!maxDistance) return true;
        if (typeof donor.distance !== 'number') return false;
        return donor.distance <= maxDistance;
      })
      .slice()
      .sort((a, b) => {
        const aDistance = typeof a.distance === 'number' ? a.distance : Number.POSITIVE_INFINITY;
        const bDistance = typeof b.distance === 'number' ? b.distance : Number.POSITIVE_INFINITY;
        return aDistance - bDistance;
      });
  }, [
    baseDonors,
    searchTerm,
    selectedBloodType,
    selectedAvailability,
    selectedGender,
    selectedDonationType,
    selectedDistance,
    user?.uid,
  ]);

  const filteredAvailableCount = useMemo(() => {
    return filteredDonors
      .filter((donor) => donor.availability === 'Available')
      .filter((donor) => (user?.uid ? donor.id !== user.uid : true)).length;
  }, [filteredDonors, user?.uid]);

  const filteredRecipients = useMemo(() => {
    return filteredDonors
      .filter((donor) => donor.availability === 'Available')
      .filter((donor) => (user?.uid ? donor.id !== user.uid : true))
      .slice(0, MAX_DONOR_REQUEST_BATCH_TARGETS);
  }, [filteredDonors, user?.uid]);

  useEffect(() => {
    if (!user || user.role !== 'donor' || !user.onboardingCompleted) return;
    if (requestSubmitting) return;
    const params = new URLSearchParams(location.search);
    const encoded = params.get('pendingRequest');
    const pendingKey = params.get('pendingRequestKey');
    const pendingFromSession = pendingKey ? loadPendingDonorRequestFromSession(pendingKey) : null;
    const pendingFromUrl = encoded ? decodePendingDonorRequest(encoded) : null;
    const pendingFromSearch = pendingFromSession || pendingFromUrl;
    const pendingKeyFromSearch = pendingFromSearch
      ? Array.isArray((pendingFromSearch as PendingDonorRequestBatch).targets)
        ? `batch:${pendingFromSearch.createdAt}:${(pendingFromSearch as PendingDonorRequestBatch).targets.length}`
        : `single:${(pendingFromSearch as PendingDonorRequest).targetDonorId}:${pendingFromSearch.createdAt}`
      : null;

    const submitPending = async () => {
      if (pendingFromSearch) {
        await savePendingDonorRequestDoc(user.uid, pendingFromSearch);
        if (pendingKey) {
          clearPendingDonorRequestFromSession(pendingKey);
        }
        const nextParams = new URLSearchParams(location.search);
        nextParams.delete('pendingRequest');
        nextParams.delete('pendingRequestKey');
        navigate({ pathname: location.pathname, search: nextParams.toString() }, { replace: true });
      }
      const pending = await loadPendingDonorRequestDoc(user.uid);
      if (!pending) return;

      const payload = Array.isArray((pending as PendingDonorRequestBatch).targets)
        ? (pending as PendingDonorRequestBatch)
        : ({
          targets: [{
            id: (pending as PendingDonorRequest).targetDonorId,
            bhId: (pending as PendingDonorRequest).targetDonorBhId,
            name: (pending as PendingDonorRequest).targetDonorName,
            bloodType: (pending as PendingDonorRequest).targetDonorBloodType,
            location: (pending as PendingDonorRequest).targetLocation,
          }],
          donationType: ((pending as PendingDonorRequest).donationType || 'whole') as DonationComponent,
          createdAt: (pending as PendingDonorRequest).createdAt,
          returnTo: (pending as PendingDonorRequest).returnTo,
        } as PendingDonorRequestBatch);

      const pendingBatchKey = `batch:${payload.createdAt}:${payload.targets.length}`;
      if (pendingRequestProcessedRef.current === pendingBatchKey || pendingRequestProcessedRef.current === pendingKeyFromSearch) {
        return;
      }

      const filteredTargets = payload.targets.filter((target) => target.id !== user.uid);
      if (filteredTargets.length === 0) {
        const selfKey = `self:${payload.createdAt}`;
        if (selfRequestToastRef.current !== selfKey) {
          selfRequestToastRef.current = selfKey;
          toast.error('You cannot request yourself.', { id: 'self-request' });
        }
        await clearPendingDonorRequestDoc(user.uid);
        return;
      }

      pendingRequestProcessedRef.current = pendingBatchKey;
      setRequestSubmitting(true);
      try {
        const result = await submitDonorRequestBatch(user, {
          ...payload,
          targets: filteredTargets,
        });
        await clearPendingDonorRequestDoc(user.uid);
        pendingRequestProcessedRef.current = pendingBatchKey;
        setRequestResult({ sent: result.sentCount, skipped: result.skippedCount });
        toast.success('Request submitted successfully.');
      } catch (error) {
        console.error('Failed to submit pending donor request:', error);
        toast.error('Failed to submit your request.');
        pendingRequestProcessedRef.current = null;
      } finally {
        setRequestSubmitting(false);
      }
    };

    submitPending().catch((error) => {
      console.error('Pending donor request submission failed:', error);
    });
  }, [user, requestSubmitting, location.search, navigate]);

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const donationTypes: { label: string; value: DonationComponent }[] = [
    { label: 'Whole Blood', value: 'whole' },
    { label: 'Plasma', value: 'plasma' },
    { label: 'Platelets', value: 'platelets' },
  ];
  const distances = ['5', '10', '15', '20', '25', '30'];
  const availabilityOptions = ['Available', 'Unavailable'];
  const genderOptions = ['Male', 'Female', 'Other'];

  const trayIds = useMemo(() => new Set(trayDonors.map((donor) => donor.id)), [trayDonors]);
  const trayCount = trayDonors.length;
  const trayPreview = trayDonors.slice(-2);
  const studioRecipients = useFilteredRecipients ? filteredRecipients : trayDonors;
  const studioCount = studioRecipients.length;

  const addToTray = (donor: Donor) => {
    setTrayDonors((prev) => {
      if (user?.uid && donor.id === user.uid) {
        toast.error('You cannot request yourself.');
        return prev;
      }
      if (prev.find((item) => item.id === donor.id)) {
        return prev;
      }
      if (prev.length >= MAX_DONOR_REQUEST_BATCH_TARGETS) {
        toast.error(`You can select up to ${MAX_DONOR_REQUEST_BATCH_TARGETS} donors at once.`);
        return prev;
      }
      return [...prev, donor];
    });
  };

  const removeFromTray = (donorId: string) => {
    setTrayDonors((prev) => prev.filter((donor) => donor.id !== donorId));
  };

  const toggleTray = (donor: Donor) => {
    if (trayIds.has(donor.id)) {
      removeFromTray(donor.id);
    } else {
      addToTray(donor);
    }
  };

  const clearTray = () => {
    setTrayDonors([]);
  };

  const openRequestStudio = () => {
    if (trayDonors.length === 0 && filteredRecipients.length > 0) {
      setUseFilteredRecipients(true);
    } else if (trayDonors.length > 0) {
      setUseFilteredRecipients(false);
    }
    const donorsForDefaults = trayDonors.length > 0 ? trayDonors : filteredDonors;
    const template = user?.donorRequestTemplate;
    const fallbackType = (template?.donationType || selectedDonationType || donorsForDefaults[0]?.donationTypes[0] || 'whole') as DonationComponent;
    setRequestDonationType(fallbackType);
    setRequestMessage(template?.message || '');
    setRequestResult(null);
    setSendSliderValue(0);
    setShowRequestStudio(true);
  };

  useEffect(() => {
    if (showRequestStudio && !useFilteredRecipients && trayCount === 0) {
      setShowRequestStudio(false);
    }
  }, [showRequestStudio, trayCount, useFilteredRecipients]);

  const handleSendSliderRelease = () => {
    if (requestSubmitting) return;
    if (sliderValueRef.current >= 95) {
      void handleSendRequests(studioRecipients);
    } else {
      setSendSliderValue(0);
    }
  };

  const updateSliderValue = (clientX: number) => {
    if (!sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const clamped = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const value = Math.round((clamped / rect.width) * 100);
    sliderValueRef.current = value;
    setSendSliderValue(value);
  };

  const startSliderDrag = (clientX: number) => {
    if (requestSubmitting || studioCount === 0) return;
    updateSliderValue(clientX);
    setSliderDragging(true);
  };

  useEffect(() => {
    if (!sliderDragging) return;
    const handleMove = (event: PointerEvent) => updateSliderValue(event.clientX);
    const handleUp = () => {
      setSliderDragging(false);
      handleSendSliderRelease();
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [sliderDragging]);

  useEffect(() => {
    sliderValueRef.current = sendSliderValue;
  }, [sendSliderValue]);

  useEffect(() => {
    if (!showRequestStudio || sliderDragging) return;
    setSendSliderValue(0);
  }, [showRequestStudio, sliderDragging]);

  const handleSendRequests = async (recipients: Donor[]) => {
    if (recipients.length === 0) {
      toast.error('Add at least one donor to send a request.');
      return;
    }
    let safeRecipients = recipients;
    if (user?.uid) {
      const filtered = recipients.filter((donor) => donor.id !== user.uid);
      if (filtered.length !== recipients.length) {
        toast.error('You cannot request yourself.');
      }
      safeRecipients = filtered;
    }
    if (safeRecipients.length === 0) {
      toast.error('Select at least one other donor.');
      return;
    }
    if (safeRecipients.length > MAX_DONOR_REQUEST_BATCH_TARGETS) {
      toast.error(`Select up to ${MAX_DONOR_REQUEST_BATCH_TARGETS} donors at once.`);
      return;
    }

    const trimmedMessage = requestMessage.trim();
    const safeMessage = trimmedMessage.length > MAX_DONOR_REQUEST_MESSAGE_LENGTH
      ? trimmedMessage.slice(0, MAX_DONOR_REQUEST_MESSAGE_LENGTH)
      : trimmedMessage;

    const payload: PendingDonorRequestBatch = {
      targets: safeRecipients.map((donor) => ({
        id: donor.id,
        bhId: donor.bhId,
        name: donor.name,
        bloodType: donor.bloodType,
        location: donor.location,
      })),
      donationType: requestDonationType,
      message: safeMessage,
      createdAt: Date.now(),
      returnTo: '/donors',
    };

    if (!user || user.role !== 'donor') {
      toast.error('Please login as a donor to send a request.');
      const pendingKey = savePendingDonorRequestToSession(payload as PendingDonorRequestPayload);
      if (pendingKey) {
        navigate(`/donor/login?pendingRequestKey=${encodeURIComponent(pendingKey)}`);
      } else {
        const encoded = encodePendingDonorRequest(payload as PendingDonorRequestPayload);
        navigate(`/donor/login?pendingRequest=${encodeURIComponent(encoded)}`);
      }
      return;
    }

    if (!user.onboardingCompleted) {
      const pendingKey = savePendingDonorRequestToSession(payload as PendingDonorRequestPayload);
      if (pendingKey) {
        navigate(`/donor/onboarding?pendingRequestKey=${encodeURIComponent(pendingKey)}`);
      } else {
        const encoded = encodePendingDonorRequest(payload as PendingDonorRequestPayload);
        navigate(`/donor/onboarding?pendingRequest=${encodeURIComponent(encoded)}`);
      }
      return;
    }

    setRequestSubmitting(true);
    try {
      const result = await submitDonorRequestBatch(user, payload);
      setRequestResult({ sent: result.sentCount, skipped: result.skippedCount });
      showUndoToast(result.batchId, result.sentCount);
      toast.success('Requests sent successfully.');
      if (!useFilteredRecipients) {
        clearTray();
      }
      setUseFilteredRecipients(false);
      setShowRequestStudio(false);
    } catch (error) {
      console.error('Failed to submit donor request batch:', error);
      toast.error('Failed to send requests.');
    } finally {
      setRequestSubmitting(false);
      setSendSliderValue(0);
    }
  };

  const handleSaveTemplate = async () => {
    if (!user?.uid) {
      toast.error('Please login to save a template.');
      return;
    }
    setTemplateSaving(true);
    try {
      await updateUserProfile({
        donorRequestTemplate: {
          donationType: requestDonationType,
          message: requestMessage.trim(),
        },
      });
      toast.success('Default request template saved.');
    } catch (error) {
      console.error('Failed to save donor request template:', error);
      toast.error('Failed to save template.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const undoBatchRequests = async (batchId: string) => {
    if (!user?.uid) {
      toast.error('Please login to undo.');
      return;
    }
    if (undoingBatchId) return;
    try {
      setUndoingBatchId(batchId);
      const requestsQuery = query(
        collection(db, 'donorRequests'),
        where('requestBatchId', '==', batchId)
      );
      const snapshot = await getDocs(requestsQuery);
      if (snapshot.empty) {
        toast.error('No requests found to undo.');
        return;
      }
      const deleteBatch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        deleteBatch.delete(docSnap.ref);
      });
      await deleteBatch.commit();

      const deletedCount = snapshot.size;
      const batchRef = doc(db, 'donorRequestBatches', batchId);
      await runTransaction(db, async (transaction) => {
        const batchSnap = await transaction.get(batchRef);
        if (!batchSnap.exists()) return;
        const batchData = batchSnap.data() as any;
        const sentCount = typeof batchData.sentCount === 'number' ? batchData.sentCount : 0;
        const deletedCountExisting = typeof batchData.deletedCount === 'number' ? batchData.deletedCount : 0;
        transaction.update(batchRef, {
          sentCount: Math.max(0, sentCount - deletedCount),
          deletedCount: deletedCountExisting + deletedCount,
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
      });
      toast.success('Request batch undone.');
    } catch (error) {
      console.error('Failed to undo donor request batch:', error);
      toast.error('Unable to undo requests. Please try again.');
    } finally {
      setUndoingBatchId(null);
    }
  };

  const showUndoToast = (batchId: string, sentCount: number) => {
    toast((t) => (
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Sent to {sentCount} donors</p>
          <p className="text-xs text-gray-500">Undo within 30 seconds</p>
        </div>
        <button
          onClick={() => {
            toast.dismiss(t.id);
            void undoBatchRequests(batchId);
          }}
          className="ml-auto rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          Undo
        </button>
      </div>
    ), { duration: 30000 });
  };

  const totalPages = Math.max(1, Math.ceil(filteredDonors.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageDonors = filteredDonors.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedBloodType('');
    setSelectedDistance('');
    setSelectedAvailability('');
    setSelectedGender('');
    setSelectedDonationType('');
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-pink-50">
          <div className="absolute top-10 right-10 w-64 h-64 bg-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-6">
              <Heart className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-semibold">Find Donors</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold mb-6">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Connect with Life-Savers
              </span>
            </h1>

            <p className="text-xl text-gray-600 mb-8">
              Find blood donors near you and save lives. Our community of heroes is ready to help.
            </p>
          </div>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {/* Search Bar */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-600" />
                  <input
                    type="text"
                    placeholder="Search by location or donor name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center justify-center px-6 py-3 rounded-xl font-semibold transition-all ${
                    showFilters
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Filter className="h-5 w-5 mr-2" />
                  Filters
                  {showFilters && <X className="h-4 w-4 ml-2" />}
                </button>
              </div>

              {/* Filter Options */}
              {showFilters && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                    {/* Blood Type Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Blood Type
                      </label>
                      <select
                        value={selectedBloodType}
                        onChange={(e) => setSelectedBloodType(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">All Blood Types</option>
                        {bloodTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    {/* Distance Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Distance (km)
                      </label>
                      <select
                        value={selectedDistance}
                        onChange={(e) => setSelectedDistance(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">Any Distance</option>
                        {distances.map(distance => (
                          <option key={distance} value={distance}>{distance} km</option>
                        ))}
                      </select>
                    </div>

                    {/* Availability Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Availability
                      </label>
                      <select
                        value={selectedAvailability}
                        onChange={(e) => setSelectedAvailability(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">Any Availability</option>
                        {availabilityOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>

                    {/* Gender Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Gender
                      </label>
                      <select
                        value={selectedGender}
                        onChange={(e) => setSelectedGender(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">Any Gender</option>
                        {genderOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>

                    {/* Donation Type Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Donation Type
                      </label>
                      <select
                        value={selectedDonationType}
                        onChange={(e) => setSelectedDonationType(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                      >
                        <option value="">All Types</option>
                        {donationTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={clearFilters}
                    className="text-red-600 hover:text-red-700 font-semibold text-sm"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>

            {!locationEnabled && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-amber-900">Enable location to use Find Donors</p>
                  <p className="text-amber-700">
                    We need your location to show nearby donors and accurate distances.
                  </p>
                  {locationError && <p className="mt-1 text-amber-700">{locationError}</p>}
                </div>
                <button
                  onClick={requestLocation}
                  disabled={locationRequesting}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {locationRequesting ? 'Requesting...' : 'Enable Location'}
                </button>
              </div>
            )}

            {/* Results Header */}
            <div className="flex flex-col items-start justify-between gap-3 mb-6 sm:flex-row sm:items-center">
              <p className="text-gray-600">
                Showing <span className="font-bold text-red-600">{pageDonors.length}</span> of{' '}
                <span className="font-bold text-red-600">{filteredDonors.length}</span> donors
              </p>
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500">
                  Page {safePage} of {totalPages}
                </p>
                <button
                  type="button"
                  onClick={openRequestStudio}
                  className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-4 py-2 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-50"
                >
                  Request Studio
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            {donorError && !loading && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {donorError}
              </div>
            )}

            {/* Donors Grid */}
            {!locationEnabled ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-10 h-10 text-amber-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Location required</h3>
                <p className="text-gray-600 mb-6">Enable location services to see nearby donors.</p>
                <button
                  onClick={requestLocation}
                  disabled={locationRequesting}
                  className="px-6 py-3 bg-amber-600 text-white rounded-full font-semibold hover:bg-amber-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {locationRequesting ? 'Requesting...' : 'Enable Location'}
                </button>
              </div>
            ) : loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 animate-pulse border border-gray-100">
                    <div className="h-6 bg-gray-200 rounded mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded mb-4"></div>
                    <div className="flex gap-2">
                      <div className="h-10 w-full bg-gray-200 rounded-xl"></div>
                      <div className="h-10 w-full bg-gray-200 rounded-xl"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredDonors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {pageDonors.map((donor) => (
                  <div
                    key={donor.id}
                    className="group bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 relative overflow-hidden"
                  >
                    {/* Background Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-pink-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    {/* Content */}
                    <div className="relative z-10">
                      {/* Mobile list layout */}
                      <div className="sm:hidden space-y-3">
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center text-white font-bold shadow">
                              {(donor.name?.trim()?.[0] || '?')}
                            </div>
                            <span className="px-2.5 py-1 bg-gradient-to-r from-red-600 to-red-700 text-white text-[10px] font-bold rounded-full shadow">
                              {donor.bloodType}
                            </span>
                            {donor.availability === 'Available' ? (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-full">
                                Available
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded-full">
                                Unavailable
                              </span>
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-bold text-gray-900 text-base">{donor.name}</h3>
                                <p className="text-xs text-gray-500">{donor.gender}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleTray(donor)}
                                disabled={donor.availability === 'Unavailable'}
                                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                                  trayIds.has(donor.id)
                                    ? 'border-red-200 bg-red-50 text-red-600'
                                    : 'border-gray-200 text-gray-400'
                                } ${donor.availability === 'Unavailable' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                                aria-label="Select donor"
                              >
                                <CheckCircle className={`w-4 h-4 ${trayIds.has(donor.id) ? 'text-red-600' : 'text-gray-400'}`} />
                              </button>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-start text-gray-600">
                                <MapPin className="w-4 h-4 mr-2 text-red-600 mt-0.5" />
                                <div className="text-xs leading-5">
                                  <p>{donor.location}</p>
                                  <p className="text-[10px] text-gray-500">
                                    {typeof donor.distance === 'number'
                                      ? `${donor.distance.toFixed(1)} km away`
                                      : 'Distance unavailable'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center text-gray-600">
                                <Clock className="w-4 h-4 mr-2 text-red-600" />
                                <span className="text-xs">
                                  Last donation: {donor.lastDonation ? donor.lastDonation.toLocaleDateString() : 'Not yet'}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {donor.donationTypes.map((type) => (
                                  <span
                                    key={`mobile-${donor.id}-${type}`}
                                    className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold text-red-600"
                                  >
                                    {donationTypes.find((item) => item.value === type)?.label || type}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleTray(donor)}
                          disabled={donor.availability === 'Unavailable'}
                          className={`w-full flex items-center justify-center py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            donor.availability === 'Available'
                              ? trayIds.has(donor.id)
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:shadow-lg transform hover:scale-[1.02]'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {trayIds.has(donor.id) ? 'In Tray' : 'Add to Tray'}
                        </button>
                      </div>

                      {/* Desktop card layout */}
                      <div className="hidden sm:block">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center text-white font-bold shadow">
                            {(donor.name?.trim()?.[0] || '?')}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-base">{donor.name}</h3>
                            <p className="text-xs text-gray-500">{donor.gender}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleTray(donor)}
                            disabled={donor.availability === 'Unavailable'}
                            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                              trayIds.has(donor.id)
                                ? 'border-red-200 bg-red-50 text-red-600'
                                : 'border-gray-200 text-gray-400'
                            } ${donor.availability === 'Unavailable' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            aria-label="Select donor"
                          >
                            <CheckCircle className={`w-4 h-4 ${trayIds.has(donor.id) ? 'text-red-600' : 'text-gray-400'}`} />
                          </button>
                          <span className="px-2.5 py-1 bg-gradient-to-r from-red-600 to-red-700 text-white text-xs font-bold rounded-full shadow">
                            {donor.bloodType}
                          </span>
                          {donor.availability === 'Available' ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-full">
                              Available
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded-full">
                              Unavailable
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 mb-3">
                        <div className="flex items-start text-gray-600">
                          <MapPin className="w-4 h-4 mr-2 text-red-600 mt-0.5" />
                          <div className="text-xs leading-5">
                            <p>{donor.location}</p>
                            <p className="text-[10px] text-gray-500">
                              {typeof donor.distance === 'number'
                                ? `${donor.distance.toFixed(1)} km away`
                                : 'Distance unavailable'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Clock className="w-4 h-4 mr-2 text-red-600" />
                          <span className="text-xs">
                            Last donation: {donor.lastDonation ? donor.lastDonation.toLocaleDateString() : 'Not yet'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {donor.donationTypes.map((type) => (
                            <span
                              key={`${donor.id}-${type}`}
                              className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold text-red-600"
                            >
                              {donationTypes.find((item) => item.value === type)?.label || type}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => toggleTray(donor)}
                          disabled={donor.availability === 'Unavailable'}
                          className={`flex-1 flex items-center justify-center py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            donor.availability === 'Available'
                              ? trayIds.has(donor.id)
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:shadow-lg transform hover:scale-105'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {trayIds.has(donor.id) ? 'In Tray' : 'Add to Tray'}
                        </button>
                      </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No donors found</h3>
                <p className="text-gray-600 mb-6">Try adjusting your search criteria or filters</p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
                >
                  Clear Filters
                </button>
              </div>
            )}
            {!loading && totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                  className="px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }).map((_, index) => {
                  const page = index + 1;
                  const isActive = page === safePage;
                  return (
                    <button
                      key={`page-${page}`}
                      onClick={() => setCurrentPage(page)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold ${
                        isActive
                          ? 'bg-red-600 text-white'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage >= totalPages}
                  className="px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
            {trayCount > 0 && (
              <button
                type="button"
                onClick={openRequestStudio}
                className="fixed bottom-6 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-between rounded-full border border-red-100 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur sm:left-auto sm:right-6 sm:translate-x-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 items-center gap-2 rounded-full bg-red-50 px-3 text-sm font-semibold text-red-700">
                    <Users className="h-4 w-4" />
                    {trayCount} queued
                  </div>
                  <div className="flex -space-x-2">
                    {trayPreview.map((donor) => (
                      <span
                        key={`tray-${donor.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white bg-red-100 text-xs font-semibold text-red-700"
                      >
                        {(donor.name?.trim()?.[0] || '?').toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-red-600" />
              </button>
            )}
          </div>
        </div>
      </section>

      {showRequestStudio && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-red-600">Request studio</p>
                <h3 className="text-lg font-bold text-gray-900">{studioCount} recipients</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestStudio(false)}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Send to filtered donors</p>
                    <p className="text-xs text-gray-500">Use your current filters to build a batch.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseFilteredRecipients((prev) => !prev)}
                    className={`h-9 w-16 rounded-full p-1 transition ${
                      useFilteredRecipients ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`block h-7 w-7 rounded-full bg-white shadow transition ${
                        useFilteredRecipients ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {useFilteredRecipients
                    ? `${filteredAvailableCount} available donors match your filters${filteredAvailableCount > MAX_DONOR_REQUEST_BATCH_TARGETS ? ` (showing first ${MAX_DONOR_REQUEST_BATCH_TARGETS})` : ''}.`
                    : 'Using your tray selection.'}
                </p>
              </div>

              {!useFilteredRecipients && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Tray recipients</label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {trayDonors.map((donor) => (
                      <span key={`tray-${donor.id}`} className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                        {donor.name} · {donor.bloodType}
                        <button
                          type="button"
                          onClick={() => removeFromTray(donor.id)}
                          className="rounded-full p-0.5 text-red-600 hover:bg-red-100"
                          aria-label="Remove donor"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {trayDonors.length === 0 && (
                      <p className="text-xs text-gray-500">No donors in tray yet.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Donation type</label>
                  <select
                    value={requestDonationType}
                    onChange={(e) => setRequestDonationType(e.target.value as DonationComponent)}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    {donationTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Optional note</label>
                  <input
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Add a short message"
                    maxLength={MAX_DONOR_REQUEST_MESSAGE_LENGTH}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-500">Use the same request template every time.</p>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={templateSaving}
                  className="rounded-xl border border-red-100 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {templateSaving ? 'Saving...' : 'Save as default'}
                </button>
              </div>

              {requestResult && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Sent to {requestResult.sent} donors. Skipped {requestResult.skipped} (recent requests).
                </div>
              )}

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">Ready to send</p>
                <p className="text-xs text-gray-500 mt-1">
                  Will attempt to send to {studioCount} donors. Some may be skipped if they were recently requested.
                </p>
                <div className="mt-4">
                  <div
                    ref={sliderTrackRef}
                    onPointerDown={(event) => startSliderDrag(event.clientX)}
                    className={`relative h-12 rounded-full border border-red-100 bg-white px-4 ${
                      requestSubmitting || studioCount === 0 ? 'opacity-60' : 'cursor-pointer'
                    }`}
                  >
                    <div className="absolute inset-y-0 left-0 rounded-full bg-red-50" style={{ width: `${sendSliderValue}%` }} />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs font-semibold text-red-600">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600">→</span>
                      <span className="hidden sm:inline">Slide to send</span>
                    </div>
                    {!requestSubmitting && studioCount > 0 && sendSliderValue < 95 && (
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-red-400 animate-pulse">
                        ⇢ ⇢ ⇢
                      </div>
                    )}
                    <div
                      role="slider"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={sendSliderValue}
                      tabIndex={0}
                      onPointerDown={(event) => startSliderDrag(event.clientX)}
                      onKeyDown={(event) => {
                        if (requestSubmitting || studioCount === 0) return;
                        if (event.key === 'ArrowRight') {
                          setSendSliderValue((prev) => Math.min(100, prev + 5));
                        }
                        if (event.key === 'ArrowLeft') {
                          setSendSliderValue((prev) => Math.max(0, prev - 5));
                        }
                        if (event.key === 'Enter') {
                          handleSendSliderRelease();
                        }
                      }}
                      className="absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform"
                      style={{ left: `${sendSliderValue}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <span className="text-sm">➤</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                    <span>{requestSubmitting ? 'Sending...' : 'Release at end to send'}</span>
                    <span>{sendSliderValue >= 95 ? 'Ready to send' : 'Keep sliding →'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between">
              <button
                type="button"
                onClick={clearTray}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                disabled={trayCount === 0}
              >
                Clear tray
              </button>
              <button
                type="button"
                onClick={() => setShowRequestStudio(false)}
                className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 text-sm font-semibold text-white shadow-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-red-600 via-red-700 to-red-800 mt-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h2 className="text-4xl font-bold mb-4">Want to Become a Donor?</h2>
            <p className="text-xl mb-8 opacity-90">Join our community of life-savers and make a difference</p>
            <button
              onClick={() => navigate('/donor/register')}
              className="px-8 py-4 bg-white text-red-600 rounded-full font-bold text-lg hover:shadow-2xl transform hover:scale-105 transition-all"
            >
              Register as a Donor
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default FindDonors;
