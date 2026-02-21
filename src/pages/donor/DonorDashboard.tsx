// src/pages/donor/DonorDashboard.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  User as LucideUser,
  MapPin,
  Calendar,
  Droplet,
  Clock,
  Users,
  Activity,
  AlertCircle,
  CheckCircle,
  MapPinned,
  Trophy,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDonorData } from '../../hooks/useDonorData';
import { useBloodRequest } from '../../hooks/useBloodRequest';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { addDoc, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp, Timestamp, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { normalizePhoneNumber, isValidPhoneNumber } from '../../utils/phone';
import { useReferrals } from '../../hooks/useReferrals';
import {
  clearPendingDonorRequestDoc,
  decodePendingDonorRequest,
  loadPendingDonorRequestDoc,
  loadPendingDonorRequestFromSession,
  savePendingDonorRequestDoc,
  clearPendingDonorRequestFromSession,
  primeRecentDonorRequestCache,
  submitDonorRequestBatch,
  type DonationComponent,
  type PendingDonorRequest,
  type PendingDonorRequestBatch,
  type PendingDonorRequestPayload,
} from '../../services/donorRequest.service';
import type { ConfirmationResult } from 'firebase/auth';

type ShareOptions = {
  showPhone: boolean;
  showEmail: boolean;
  showBhId: boolean;
  showQr: boolean;
};

type DonationFeedback = {
  donationId: string;
  rating?: number;
  notes?: string;
  certificateUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

function DonorDashboard() {
  const {
    user,
    updateUserProfile,
    linkGoogleProvider,
    startPhoneLink,
    confirmPhoneLink,
    unlinkGoogleProvider,
    unlinkPhoneProvider
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State for modals and UI
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [showAllCamps, setShowAllCamps] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [linkPhoneNumber, setLinkPhoneNumber] = useState('');
  const [linkOtp, setLinkOtp] = useState('');
  const [linkConfirmation, setLinkConfirmation] = useState<ConfirmationResult | null>(null);
  const [linkPhoneLoading, setLinkPhoneLoading] = useState(false);
  const [linkGoogleLoading, setLinkGoogleLoading] = useState(false);
  const [unlinkPhoneLoading, setUnlinkPhoneLoading] = useState(false);
  const [unlinkGoogleLoading, setUnlinkGoogleLoading] = useState(false);
  const [lastDonationInput, setLastDonationInput] = useState('');
  const [lastDonationSaving, setLastDonationSaving] = useState(false);
  const [lastDonationSaved, setLastDonationSaved] = useState(false);
  const [shareCardLoading, setShareCardLoading] = useState(false);
  const [emergencyAlertsEnabled, setEmergencyAlertsEnabled] = useState(true);
  const [emergencyAlertsSaving, setEmergencyAlertsSaving] = useState(false);
  const [availabilityEnabled, setAvailabilityEnabled] = useState(true);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availableTodayLoading, setAvailableTodayLoading] = useState(false);
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [shareOptionsOpen, setShareOptionsOpen] = useState(false);
  const [shareOptions, setShareOptions] = useState<ShareOptions>({
    showPhone: true,
    showEmail: true,
    showBhId: true,
    showQr: true,
  });
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [incomingDonorRequests, setIncomingDonorRequests] = useState<any[]>([]);
  const [outgoingDonorRequests, setOutgoingDonorRequests] = useState<any[]>([]);
  const [donorRequestBatches, setDonorRequestBatches] = useState<any[]>([]);
  const [incomingRequestsLoading, setIncomingRequestsLoading] = useState(true);
  const [outgoingRequestsLoading, setOutgoingRequestsLoading] = useState(true);
  const [donorRequestBatchesLoading, setDonorRequestBatchesLoading] = useState(true);
  const [donorRequestActionId, setDonorRequestActionId] = useState<string | null>(null);
  const [donorRequestDeleteId, setDonorRequestDeleteId] = useState<string | null>(null);
  const [editingDonationId, setEditingDonationId] = useState<string | null>(null);
  const [editingDonationData, setEditingDonationData] = useState({
    location: '',
    units: 1,
    notes: '',
    donationType: 'whole' as 'whole' | 'platelets' | 'plasma',
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [donationEditSaving, setDonationEditSaving] = useState(false);
  const [donationDeleteId, setDonationDeleteId] = useState<string | null>(null);
  const donationTypeBackfillRef = useRef(false);
  const locationBackfillRef = useRef(false);
  const pendingRequestProcessedRef = useRef<string | null>(null);
  const [eligibilityChecklist, setEligibilityChecklist] = useState({
    hydrated: false,
    weightOk: false,
    hemoglobinOk: false,
    rested: false,
    ateMeal: false,
  });
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [feedbackOpenId, setFeedbackOpenId] = useState<string | null>(null);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    rating: 0,
    notes: '',
    certificateUrl: '',
  });
  const [donationFeedbackMap, setDonationFeedbackMap] = useState<Record<string, DonationFeedback>>({});
  const requestCacheKey = useMemo(() => (user?.uid ? `donor_requests_cache_${user.uid}` : ''), [user?.uid]);
  const requestCacheTTL = 5 * 60 * 1000;
  const requestCooldownMs = 24 * 60 * 60 * 1000;
  const incomingRequestsRef = useRef<any[]>([]);
  const outgoingRequestsRef = useRef<any[]>([]);
  const requestBatchesRef = useRef<any[]>([]);
  const outgoingExpiryRef = useRef<Set<string>>(new Set());
  const incomingExpiryRef = useRef<Set<string>>(new Set());
  const outgoingAcceptedExpiryRef = useRef<Set<string>>(new Set());
  const incomingAcceptedExpiryRef = useRef<Set<string>>(new Set());

  // Use custom hook to fetch all donor data
  const {
    donationHistory,
    firstDonationDate,
    emergencyRequests,
    bloodCamps,
    stats,
    badges,
    loading,
    error,
    refreshData,
  } = useDonorData(
    user?.uid || '',
    user?.bloodType,
    user?.city
  );

  const {
    referralLoading,
    referralUsersLoading,
    referralCount,
    referralDetails,
    eligibleReferralCount,
    referralSummary,
    referralMilestone,
    referralQrDataUrl,
    referralQrLoading,
    loadReferralQr,
    copyInviteLink,
    shareInviteLink,
    openWhatsAppInvite,
  } = useReferrals(user);

  const { respondToRequest, responding } = useBloodRequest();

  const formatDate = (date?: Date | string) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  };

  const formatDateTime = (date?: Date | string) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  };

  const formatTime = (date?: Date | null) => {
    if (!date) return 'N/A';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    return `${days} days ago`;
  };

  const formatDateInput = (dateValue?: Date | string) => {
    if (!dateValue) return '';
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDateInput = (value: string) => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const normalizeToMidnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const readEntryDate = (entry: any) => {
    const value = entry?.date || entry?.donationDate;
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    return null;
  };

  const inferDonationTypeFromEntry = (entry: any) => {
    const rawType = entry?.donationType
      || entry?.type
      || entry?.component
      || entry?.componentType
      || entry?.donationComponent;
    const rawTypeString = typeof rawType === 'string' ? rawType.toLowerCase() : '';
    const quantityString = typeof entry?.quantity === 'string' ? entry.quantity.toLowerCase() : '';
    const combined = `${rawTypeString} ${quantityString}`;
    if (combined.includes('platelet')) return 'platelets';
    if (combined.includes('plasma')) return 'plasma';
    if (combined.includes('whole') || combined.includes('blood') || quantityString.includes('ml')) return 'whole';
    return null;
  };

  const generateDonationEntryId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `manual-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const geocodeLocation = async (location: string) => {
    const trimmed = location.trim();
    if (!trimmed) return null;
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1&addressdetails=1`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const result = data[0];
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
    return { latitude, longitude };
  };

  const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return char;
    }
  });

  const buildDonorCardSvg = (qrOverride?: string | null) => {
    const name = escapeXml(user?.displayName || 'BloodHub Donor');
    const bloodType = escapeXml(user?.bloodType || '--');
    const bhId = escapeXml(user?.bhId || 'Pending');
    const city = escapeXml(user?.city || 'Location not set');
    const phone = escapeXml(user?.phoneNumber || 'Not set');
    const email = escapeXml(user?.email || 'Not set');
    const lastDonationLabel = normalizedLastDonation ? formatDate(normalizedLastDonation) : 'Not recorded';
    const lastDonation = escapeXml(lastDonationLabel);
    const showBhId = shareOptions.showBhId;
    const showPhone = shareOptions.showPhone;
    const showEmail = shareOptions.showEmail;
    const resolvedQr = qrOverride ?? qrCodeDataUrl;
    const showQr = shareOptions.showQr && resolvedQr;
    const qrData = showQr && resolvedQr ? escapeXml(resolvedQr) : '';
    const availabilityLabel = availabilityEnabled ? 'Available' : 'On Break';
    const availabilityFill = availabilityEnabled ? '#dc2626' : '#e5e7eb';
    const availabilityText = availabilityEnabled ? '#ffffff' : '#374151';

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff5f5"/>
            <stop offset="50%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#fee2e2"/>
          </linearGradient>
          <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#dc2626"/>
            <stop offset="100%" stop-color="#b91c1c"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="700" rx="40" fill="url(#bg)"/>
        <rect x="36" y="36" width="1128" height="628" rx="32" fill="#ffffff" stroke="#fecaca" stroke-width="2"/>
        <circle cx="1080" cy="120" r="120" fill="#fee2e2"/>
        <circle cx="160" cy="620" r="140" fill="#fee2e2"/>
        <rect x="860" y="80" width="180" height="44" rx="22" fill="${availabilityFill}"/>
        <text x="950" y="110" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="${availabilityText}">${availabilityLabel}</text>
        <text x="96" y="140" font-family="Georgia, serif" font-size="28" letter-spacing="6" fill="#dc2626">BLOODHUB DONOR CARD</text>
        <text x="96" y="210" font-family="Georgia, serif" font-size="60" font-weight="700" fill="#111827">${name}</text>
        <text x="96" y="260" font-family="Arial, sans-serif" font-size="26" fill="#6b7280">${city}</text>
        <rect x="860" y="180" width="240" height="160" rx="24" fill="url(#badge)"/>
        <text x="980" y="285" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff">${bloodType}</text>
        ${showBhId ? `<text x="96" y="350" font-family="Arial, sans-serif" font-size="22" letter-spacing="4" fill="#9ca3af">BH ID</text>
        <text x="96" y="390" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#111827">${bhId}</text>` : ''}
        <text x="96" y="445" font-family="Arial, sans-serif" font-size="20" letter-spacing="3" fill="#9ca3af">LAST DONATION</text>
        <text x="96" y="482" font-family="Arial, sans-serif" font-size="28" font-weight="600" fill="#111827">${lastDonation}</text>
        ${showPhone ? `<text x="96" y="536" font-family="Arial, sans-serif" font-size="20" letter-spacing="3" fill="#9ca3af">PHONE</text>
        <text x="96" y="572" font-family="Arial, sans-serif" font-size="26" font-weight="600" fill="#111827">${phone}</text>` : ''}
        ${showEmail ? `<text x="96" y="624" font-family="Arial, sans-serif" font-size="20" letter-spacing="3" fill="#9ca3af">EMAIL</text>
        <text x="96" y="660" font-family="Arial, sans-serif" font-size="24" font-weight="600" fill="#111827">${email}</text>` : ''}
        ${showQr ? `<rect x="900" y="420" width="160" height="160" rx="16" fill="#ffffff" stroke="#fecaca" stroke-width="2"/>
        <image href="${qrData}" x="914" y="434" width="132" height="132" />` : ''}
        <text x="940" y="610" font-family="Arial, sans-serif" font-size="20" letter-spacing="4" fill="#9ca3af">BLOODHUB INDIA</text>
      </svg>
    `;
  };

  useEffect(() => {
    if (user?.phoneNumber && !linkPhoneNumber) {
      setLinkPhoneNumber(user.phoneNumber);
    }
  }, [user?.phoneNumber, linkPhoneNumber]);

  useEffect(() => {
    if (!user?.lastDonation) {
      setLastDonationInput('');
      return;
    }
    const formatted = formatDateInput(user.lastDonation);
    setLastDonationInput(formatted);
  }, [user?.lastDonation]);

  useEffect(() => {
    if (user?.notificationPreferences?.emergencyAlerts === undefined) {
      setEmergencyAlertsEnabled(true);
      return;
    }
    setEmergencyAlertsEnabled(Boolean(user.notificationPreferences.emergencyAlerts));
  }, [user?.notificationPreferences?.emergencyAlerts]);

  useEffect(() => {
    if (!user?.eligibilityChecklist) return;
    setEligibilityChecklist({
      hydrated: Boolean(user.eligibilityChecklist.hydrated),
      weightOk: Boolean(user.eligibilityChecklist.weightOk),
      hemoglobinOk: Boolean(user.eligibilityChecklist.hemoglobinOk),
      rested: Boolean(user.eligibilityChecklist.rested),
      ateMeal: Boolean(user.eligibilityChecklist.ateMeal),
    });
  }, [user?.eligibilityChecklist]);

  useEffect(() => {
    if (user?.isAvailable === undefined) {
      setAvailabilityEnabled(true);
      return;
    }
    setAvailabilityEnabled(Boolean(user.isAvailable));
  }, [user?.isAvailable]);

  useEffect(() => {
    if (!user?.availableUntil) return;
    const expiry = user.availableUntil instanceof Date
      ? user.availableUntil
      : new Date(user.availableUntil);
    if (Number.isNaN(expiry.getTime())) return;
    if (expiry.getTime() <= Date.now()) {
      if (user?.isAvailable) {
        updateUserProfile({
          isAvailable: false,
          availableUntil: null,
          notificationPreferences: {
            emergencyAlerts: false,
          },
        }).catch(error => {
          console.warn('Failed to auto-disable availability:', error);
        });
      } else {
        updateUserProfile({
          isAvailable: true,
          availableUntil: null,
          notificationPreferences: {
            emergencyAlerts: true,
          },
        }).catch(error => {
          console.warn('Failed to auto-enable availability:', error);
        });
      }
    }
  }, [user?.availableUntil, user?.isAvailable, updateUserProfile]);

  useEffect(() => {
    if (!user?.uid) return;
    const feedbackQuery = query(
      collection(db, 'DonationFeedback'),
      where('donorId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(feedbackQuery, (snapshot) => {
      const nextMap: Record<string, DonationFeedback> = {};
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const donationId = data.donationId || docSnapshot.id;
        if (!donationId) return;
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : undefined;
        const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : undefined;
        nextMap[donationId] = {
          donationId,
          rating: data.rating,
          notes: data.notes,
          certificateUrl: data.certificateUrl,
          createdAt,
          updatedAt,
        };
      });
      setDonationFeedbackMap(nextMap);
    }, (error) => {
      console.warn('Failed to load donation feedback:', error);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || donationTypeBackfillRef.current) return;
    donationTypeBackfillRef.current = true;

    const backfillDonationTypes = async () => {
      try {
        const historyRef = doc(db, 'DonationHistory', user.uid);
        const historySnapshot = await getDoc(historyRef);
        if (!historySnapshot.exists()) return;
        const existingDonations = Array.isArray(historySnapshot.data().donations)
          ? historySnapshot.data().donations
          : [];
        let hasChanges = false;
        const updatedDonations = existingDonations.map((entry: any) => {
          const entryId = entry?.id || entry?.legacyId || generateDonationEntryId();
          const needsId = !entry?.id;
          const needsType = !entry?.donationType;
          const inferred = needsType ? inferDonationTypeFromEntry(entry) : entry?.donationType;
          const resolvedType = inferred || entry?.donationType;
          const quantity = entry?.quantity || (
            resolvedType
              ? resolvedType === 'platelets'
                ? 'Platelets'
                : resolvedType === 'plasma'
                  ? 'Plasma'
                  : '450ml'
              : undefined
          );

          const nextEntry: any = { ...entry, id: entryId };
          if (resolvedType) {
            nextEntry.donationType = resolvedType;
          }
          if (quantity) {
            nextEntry.quantity = quantity;
          }

          const entryChanged = needsId
            || (needsType && Boolean(resolvedType))
            || (!entry?.quantity && Boolean(quantity));
          if (entryChanged) {
            hasChanges = true;
          }
          return entryChanged ? nextEntry : entry;
        });
        if (!hasChanges) return;
        await setDoc(
          historyRef,
          {
            donations: updatedDonations,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        console.warn('Donation type backfill failed:', error);
      }
    };

    void backfillDonationTypes();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || locationBackfillRef.current) return;
    const storageKey = `bh_geo_backfill_v1_${user.uid}`;
    if (typeof window !== 'undefined' && window.localStorage.getItem(storageKey) === 'done') {
      locationBackfillRef.current = true;
      return;
    }
    locationBackfillRef.current = true;

    const backfillLocations = async () => {
      try {
        const historyRef = doc(db, 'DonationHistory', user.uid);
        const historySnapshot = await getDoc(historyRef);
        if (!historySnapshot.exists()) return;
        const existingDonations = Array.isArray(historySnapshot.data().donations)
          ? historySnapshot.data().donations
          : [];

        const candidates = existingDonations
          .map((entry: any, index: number) => ({
            entry,
            index,
            location: typeof entry?.location === 'string' ? entry.location : '',
          }))
          .filter((item: { entry: any; index: number; location: string }) => {
            const hasCoords = typeof item.entry?.latitude === 'number' && typeof item.entry?.longitude === 'number';
            return !hasCoords && item.location.trim().length > 3;
          })
          .slice(0, 10);

        if (candidates.length === 0) {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(storageKey, 'done');
          }
          return;
        }

        const updatedDonations = [...existingDonations];
        let updatedCount = 0;
        for (const candidate of candidates) {
          const coords = await geocodeLocation(candidate.location);
          if (coords) {
            updatedDonations[candidate.index] = {
              ...candidate.entry,
              latitude: coords.latitude,
              longitude: coords.longitude,
            };
            updatedCount += 1;
          }
          await sleep(700);
        }

        if (updatedCount > 0) {
          await setDoc(
            historyRef,
            {
              donations: updatedDonations,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, 'done');
        }
      } catch (error) {
        console.warn('Donation location backfill failed:', error);
      }
    };

    void backfillLocations();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setIncomingDonorRequests([]);
      setOutgoingDonorRequests([]);
      setIncomingRequestsLoading(false);
      setOutgoingRequestsLoading(false);
      setDonorRequestBatches([]);
      setDonorRequestBatchesLoading(false);
      return;
    }

    if (requestCacheKey && typeof window !== 'undefined') {
      const sanitizeRequestCache = (cached: any) => {
        let hadPII = false;
        const stripRequestPII = (item: any) => {
          if (!item || typeof item !== 'object') return item;
          const {
            requesterPhone,
            requesterEmail,
            targetDonorPhone,
            targetDonorEmail,
            contactPhone,
            contactEmail,
            ...rest
          } = item;
          if (
            requesterPhone
            || requesterEmail
            || targetDonorPhone
            || targetDonorEmail
            || contactPhone
            || contactEmail
          ) {
            hadPII = true;
          }
          return rest;
        };
        const stripBatchPII = (item: any) => {
          if (!item || typeof item !== 'object') return item;
          const {
            requesterPhone,
            requesterEmail,
            contactPhone,
            contactEmail,
            ...rest
          } = item;
          if (requesterPhone || requesterEmail || contactPhone || contactEmail) {
            hadPII = true;
          }
          return rest;
        };
        const sanitizedIncoming = Array.isArray(cached?.incoming)
          ? cached.incoming.map(stripRequestPII)
          : [];
        const sanitizedOutgoing = Array.isArray(cached?.outgoing)
          ? cached.outgoing.map(stripRequestPII)
          : [];
        const sanitizedBatches = Array.isArray(cached?.batches)
          ? cached.batches.map(stripBatchPII)
          : [];
        return {
          hadPII,
          sanitized: {
            timestamp: cached?.timestamp || Date.now(),
            incoming: sanitizedIncoming,
            outgoing: sanitizedOutgoing,
            batches: sanitizedBatches,
          },
        };
      };

      if (window.localStorage && window.sessionStorage) {
        const legacyRaw = window.localStorage.getItem(requestCacheKey);
        if (legacyRaw) {
          try {
            const legacyCache = JSON.parse(legacyRaw);
            const { sanitized } = sanitizeRequestCache(legacyCache);
            let shouldWrite = true;
            const existingRaw = window.sessionStorage.getItem(requestCacheKey);
            if (existingRaw) {
              try {
                const existing = JSON.parse(existingRaw);
                if (existing?.timestamp && existing.timestamp > sanitized.timestamp) {
                  shouldWrite = false;
                }
              } catch {
                // ignore
              }
            }
            if (shouldWrite) {
              window.sessionStorage.setItem(requestCacheKey, JSON.stringify(sanitized));
            }
          } catch (error) {
            console.warn('Failed to sanitize legacy donor request cache', error);
          }
          window.localStorage.removeItem(requestCacheKey);
        }
      }

      if (window.sessionStorage) {
        const cachedRaw = window.sessionStorage.getItem(requestCacheKey);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw);
            const { hadPII, sanitized } = sanitizeRequestCache(cached);
            const cacheIsFresh = sanitized.timestamp && Date.now() - sanitized.timestamp < requestCacheTTL;
            if (cacheIsFresh) {
              const hydrateRequest = (item: any) => ({
                ...item,
                requestedAt: item.requestedAt ? new Date(item.requestedAt) : undefined,
                respondedAt: item.respondedAt ? new Date(item.respondedAt) : undefined,
                connectionExpiresAt: item.connectionExpiresAt ? new Date(item.connectionExpiresAt) : undefined,
              });
              const hydrateBatch = (item: any) => ({
                ...item,
                createdAt: item.createdAt ? new Date(item.createdAt) : item.createdAt,
              });
              const incomingItems = sanitized.incoming.map(hydrateRequest);
              const outgoingItems = sanitized.outgoing.map(hydrateRequest);
              const batchItems = sanitized.batches.map(hydrateBatch);
              if (incomingItems.length > 0) {
                incomingRequestsRef.current = incomingItems;
                setIncomingDonorRequests(incomingItems);
                setIncomingRequestsLoading(false);
              }
              if (outgoingItems.length > 0) {
                outgoingRequestsRef.current = outgoingItems;
                setOutgoingDonorRequests(outgoingItems);
                setOutgoingRequestsLoading(false);
              }
              if (batchItems.length > 0) {
                requestBatchesRef.current = batchItems;
                setDonorRequestBatches(batchItems);
                setDonorRequestBatchesLoading(false);
              }
            }
            if (hadPII) {
              try {
                window.sessionStorage.setItem(requestCacheKey, JSON.stringify(sanitized));
              } catch (error) {
                console.warn('Failed to purge donor request cache PII', error);
              }
            }
          } catch (error) {
            console.warn('Failed to hydrate donor request cache', error);
          }
        }
      }
    }

    const incomingQuery = query(
      collection(db, 'donorRequests'),
      where('targetDonorUid', '==', user.uid)
    );
    const outgoingQuery = query(
      collection(db, 'donorRequests'),
      where('requesterUid', '==', user.uid)
    );
    const batchesQuery = query(
      collection(db, 'donorRequestBatches'),
      where('requesterUid', '==', user.uid)
    );

    const mapRequest = (docSnapshot: any) => {
      const data = docSnapshot.data();
      const requestedAt = data.requestedAt?.toDate ? data.requestedAt.toDate() : undefined;
      const respondedAt = data.respondedAt?.toDate ? data.respondedAt.toDate() : undefined;
      const connectionExpiresAt = data.connectionExpiresAt?.toDate ? data.connectionExpiresAt.toDate() : data.connectionExpiresAt;
      return {
        id: docSnapshot.id,
        ...data,
        requestedAt,
        respondedAt,
        connectionExpiresAt,
      };
    };

    const resolveConnectionExpiry = (item: any) => {
      if (!item) return null;
      const rawExpiry = item.connectionExpiresAt;
      if (rawExpiry instanceof Date) return rawExpiry;
      if (rawExpiry) {
        const parsed = new Date(rawExpiry);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      const respondedAt = item.respondedAt instanceof Date ? item.respondedAt : (item.respondedAt ? new Date(item.respondedAt) : null);
      if (respondedAt && !Number.isNaN(respondedAt.getTime())) {
        return new Date(respondedAt.getTime() + requestCooldownMs);
      }
      return null;
    };

    const expireStaleRequests = (items: any[], refGuard: React.MutableRefObject<Set<string>>) => {
      const now = Date.now();
      items.forEach((item) => {
        if (!item || item.status !== 'pending' || !item.requestedAt) return;
        const requestedAt = item.requestedAt instanceof Date ? item.requestedAt : new Date(item.requestedAt);
        if (Number.isNaN(requestedAt.getTime())) return;
        if (now - requestedAt.getTime() < requestCooldownMs) return;
        if (refGuard.current.has(item.id)) return;
        refGuard.current.add(item.id);
        updateDoc(doc(db, 'donorRequests', item.id), {
          status: 'expired',
          expiredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((error) => {
          refGuard.current.delete(item.id);
          console.warn('Failed to expire donor request', error);
        });
      });
    };

    const expireLapsedConnections = (items: any[], refGuard: React.MutableRefObject<Set<string>>) => {
      const now = Date.now();
      items.forEach((item) => {
        if (!item || item.status !== 'accepted') return;
        const expiresAt = resolveConnectionExpiry(item);
        if (!expiresAt || Number.isNaN(expiresAt.getTime())) return;
        if (now < expiresAt.getTime()) return;
        if (refGuard.current.has(item.id)) return;
        refGuard.current.add(item.id);
        updateDoc(doc(db, 'donorRequests', item.id), {
          status: 'expired',
          expiredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((error) => {
          refGuard.current.delete(item.id);
          console.warn('Failed to expire accepted donor request', error);
        });
      });
    };

    const persistCache = (incoming: any[], outgoing: any[], batches: any[]) => {
      if (!requestCacheKey || typeof window === 'undefined' || !window.sessionStorage) return;
      const stripRequestPII = (item: any) => {
        if (!item || typeof item !== 'object') return item;
        const {
          requesterPhone,
          requesterEmail,
          targetDonorPhone,
          targetDonorEmail,
          contactPhone,
          contactEmail,
          ...rest
        } = item;
        return rest;
      };
      const stripBatchPII = (item: any) => {
        if (!item || typeof item !== 'object') return item;
        const {
          requesterPhone,
          requesterEmail,
          contactPhone,
          contactEmail,
          ...rest
        } = item;
        return rest;
      };
      const serializeRequest = (item: any) => {
        const sanitized = stripRequestPII(item);
        return {
          ...sanitized,
          requestedAt: item.requestedAt instanceof Date ? item.requestedAt.toISOString() : item.requestedAt,
          respondedAt: item.respondedAt instanceof Date ? item.respondedAt.toISOString() : item.respondedAt,
          connectionExpiresAt: item.connectionExpiresAt instanceof Date ? item.connectionExpiresAt.toISOString() : item.connectionExpiresAt,
        };
      };
      const serializeBatch = (item: any) => {
        const sanitized = stripBatchPII(item);
        return {
          ...sanitized,
          createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
        };
      };
      const payload = {
        timestamp: Date.now(),
        incoming: incoming.slice(0, 10).map(serializeRequest),
        outgoing: outgoing.slice(0, 10).map(serializeRequest),
        batches: batches.slice(0, 10).map(serializeBatch),
      };
      try {
        window.sessionStorage.setItem(requestCacheKey, JSON.stringify(payload));
      } catch (error) {
        console.warn('Failed to write donor request cache', error);
      }
    };

    setIncomingRequestsLoading(true);
    const unsubscribeIncoming = onSnapshot(incomingQuery, (snapshot) => {
      const items = snapshot.docs.map(mapRequest)
        .sort((a: any, b: any) => {
          const aTime = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
          const bTime = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
          return bTime - aTime;
        });
      expireStaleRequests(items, incomingExpiryRef);
      expireLapsedConnections(items, incomingAcceptedExpiryRef);
      incomingRequestsRef.current = items;
      setIncomingDonorRequests(items);
      setIncomingRequestsLoading(false);
      persistCache(
        incomingRequestsRef.current,
        outgoingRequestsRef.current,
        requestBatchesRef.current
      );
    }, (error) => {
      console.warn('Failed to load incoming donor requests:', error);
      setIncomingRequestsLoading(false);
    });

    setOutgoingRequestsLoading(true);
    const unsubscribeOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
      const items = snapshot.docs.map(mapRequest)
        .sort((a: any, b: any) => {
          const aTime = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
          const bTime = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
          return bTime - aTime;
        });
      expireStaleRequests(items, outgoingExpiryRef);
      expireLapsedConnections(items, outgoingAcceptedExpiryRef);
      outgoingRequestsRef.current = items;
      setOutgoingDonorRequests(items);
      setOutgoingRequestsLoading(false);
      persistCache(
        incomingRequestsRef.current,
        outgoingRequestsRef.current,
        requestBatchesRef.current
      );
    }, (error) => {
      console.warn('Failed to load outgoing donor requests:', error);
      setOutgoingRequestsLoading(false);
    });

    setDonorRequestBatchesLoading(true);
    const unsubscribeBatches = onSnapshot(batchesQuery, (snapshot) => {
      const items = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        };
      })
        .sort((a: any, b: any) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 10);
      requestBatchesRef.current = items;
      setDonorRequestBatches(items);
      setDonorRequestBatchesLoading(false);
      persistCache(
        incomingRequestsRef.current,
        outgoingRequestsRef.current,
        requestBatchesRef.current
      );
    }, (error) => {
      console.warn('Failed to load donor request batches:', error);
      setDonorRequestBatchesLoading(false);
    });

    return () => {
      unsubscribeIncoming();
      unsubscribeOutgoing();
      unsubscribeBatches();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const task = () => {
      void primeRecentDonorRequestCache(user.uid);
    };
    const idle = typeof globalThis !== 'undefined' ? (globalThis as any).requestIdleCallback : null;
    if (typeof idle === 'function') {
      const id = idle(task);
      return () => {
        const cancel = (globalThis as any).cancelIdleCallback;
        if (typeof cancel === 'function') {
          cancel(id);
        }
      };
    }
    const timer = setTimeout(task, 1200);
    return () => clearTimeout(timer);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const prefetchKey = `donor_dashboard_prefetch_${user.uid}`;
    const lastPrefetch = window.sessionStorage.getItem(prefetchKey);
    if (lastPrefetch && Date.now() - Number(lastPrefetch) < 5 * 60 * 1000) {
      return;
    }
    const task = () => {
      refreshData({ silent: true })
        .catch((error) => {
          console.warn('Donor dashboard prefetch failed', error);
        })
        .finally(() => {
          window.sessionStorage.setItem(prefetchKey, Date.now().toString());
        });
    };
    const idle = typeof globalThis !== 'undefined' ? (globalThis as any).requestIdleCallback : null;
    if (typeof idle === 'function') {
      const id = idle(task);
      return () => {
        const cancel = (globalThis as any).cancelIdleCallback;
        if (typeof cancel === 'function') {
          cancel(id);
        }
      };
    }
    const timer = setTimeout(task, 1200);
    return () => clearTimeout(timer);
  }, [user?.uid, refreshData]);

  useEffect(() => {
    if (!user?.uid || user.role !== 'donor' || !user.onboardingCompleted) return;
    const params = new URLSearchParams(location.search);
    const encoded = params.get('pendingRequest');
    const pendingKey = params.get('pendingRequestKey');
    const pendingFromSession = pendingKey ? loadPendingDonorRequestFromSession(pendingKey) : null;
    const pendingFromUrl = encoded ? decodePendingDonorRequest(encoded) : null;
    const pendingFromSearch = pendingFromSession || pendingFromUrl;
    const pendingKeyFromUrl = pendingFromSearch
      ? Array.isArray((pendingFromSearch as PendingDonorRequestBatch).targets)
        ? `batch:${pendingFromSearch.createdAt}:${(pendingFromSearch as PendingDonorRequestBatch).targets.length}`
        : `single:${(pendingFromSearch as PendingDonorRequest).targetDonorId}:${pendingFromSearch.createdAt}`
      : null;

    const submitPending = async () => {
      if (pendingFromSearch) {
        const rawReturnTo = pendingFromSearch.returnTo || '';
        const isSafePath = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//');
        const isDashboardPath = isSafePath && rawReturnTo.startsWith('/donor/dashboard');
        const targetReturnTo = isDashboardPath ? rawReturnTo : '/donor/dashboard/requests';
        try {
          await savePendingDonorRequestDoc(user.uid, pendingFromSearch as PendingDonorRequestPayload);
        } catch (error) {
          console.warn('Failed to persist pending donor request. Clearing payload.', error);
        }
        if (pendingKey) {
          clearPendingDonorRequestFromSession(pendingKey);
        }
        params.delete('pendingRequest');
        params.delete('pendingRequestKey');
        const nextSearch = params.toString();
        const fallbackPath = nextSearch ? `${location.pathname}?${nextSearch}` : location.pathname;
        const destination = nextSearch
          ? `${targetReturnTo}${targetReturnTo.includes('?') ? '&' : '?'}${nextSearch}`
          : targetReturnTo || fallbackPath;
        navigate(destination, { replace: true });
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
      if (pendingRequestProcessedRef.current === pendingBatchKey || pendingRequestProcessedRef.current === pendingKeyFromUrl) {
        return;
      }

      const filteredTargets = payload.targets.filter((target) => target.id !== user.uid);
      if (filteredTargets.length === 0) {
        const selfKey = `self:${payload.createdAt}`;
        if (pendingRequestProcessedRef.current !== selfKey) {
          pendingRequestProcessedRef.current = selfKey;
          toast.error('You cannot request yourself.', { id: 'self-request' });
        }
        await clearPendingDonorRequestDoc(user.uid);
        return;
      }

      pendingRequestProcessedRef.current = pendingBatchKey;
      try {
        await submitDonorRequestBatch(user, {
          ...payload,
          targets: filteredTargets,
        });
        await clearPendingDonorRequestDoc(user.uid);
        toast.success('Your donor request has been submitted.');
      } catch (error) {
        console.error('Pending donor request submission failed:', error);
        await clearPendingDonorRequestDoc(user.uid).catch(() => null);
        pendingRequestProcessedRef.current = pendingBatchKey;
        toast.error('Failed to submit your donor request.');
      }
    };

    submitPending()
      .catch((error) => {
        console.error('Pending donor request submission failed:', error);
        toast.error('Failed to submit your donor request.');
        pendingRequestProcessedRef.current = null;
      });
  }, [user?.uid, user?.role, user?.onboardingCompleted, location.search, navigate, location.pathname]);

  const shareOptionsSyncRef = useRef<string | null>(null);
  const shareOptionsLoadedRef = useRef(false);

  useEffect(() => {
    if (!user?.uid) return;
    const nextOptions = {
      showPhone: true,
      showEmail: true,
      showBhId: true,
      showQr: true,
      ...(user.donorCardShareOptions || {}),
    };
    const serialized = JSON.stringify(nextOptions);
    if (serialized !== shareOptionsSyncRef.current) {
      shareOptionsSyncRef.current = serialized;
      setShareOptions(nextOptions);
    }
    shareOptionsLoadedRef.current = true;
  }, [user?.uid, user?.donorCardShareOptions]);

  useEffect(() => {
    if (!user?.uid || !shareOptionsLoadedRef.current) return;
    const serialized = JSON.stringify(shareOptions);
    if (serialized === shareOptionsSyncRef.current) return;
    shareOptionsSyncRef.current = serialized;
    updateUserProfile({ donorCardShareOptions: shareOptions }).catch((error) => {
      console.warn('Failed to save donor card share options', error);
    });
  }, [shareOptions, user?.uid, updateUserProfile]);

  const providerIds = auth.currentUser?.providerData?.map(provider => provider.providerId) || [];
  const PHONE_PROVIDER_ID = 'phone';
  const GOOGLE_PROVIDER_ID = 'google.com';
  const isPhoneLinked = providerIds.some((id) => id === PHONE_PROVIDER_ID);
  const isGoogleLinked = providerIds.some((id) => id === GOOGLE_PROVIDER_ID);
  const canUnlinkPhone = isPhoneLinked && isGoogleLinked;
  const canUnlinkGoogle = isGoogleLinked && isPhoneLinked;

  const handleGoogleLink = async () => {
    if (isGoogleLinked) return;
    try {
      setLinkGoogleLoading(true);
      await linkGoogleProvider();
      toast.success('Google account linked successfully!');
    } catch (error: any) {
      console.error('Google link error:', error);
      toast.error(error?.message || 'Failed to link Google account.');
    } finally {
      setLinkGoogleLoading(false);
    }
  };

  const handleGoogleUnlink = async () => {
    if (!canUnlinkGoogle) {
      toast.error('At least one login method must remain linked.');
      return;
    }
    if (!window.confirm('Unlink Google login from your account?')) {
      return;
    }
    try {
      setUnlinkGoogleLoading(true);
      await unlinkGoogleProvider();
      toast.success('Google login unlinked.');
    } catch (error: any) {
      console.error('Google unlink error:', error);
      toast.error(error?.message || 'Failed to unlink Google login.');
    } finally {
      setUnlinkGoogleLoading(false);
    }
  };

  const handlePhoneLinkStart = async () => {
    const normalized = normalizePhoneNumber(linkPhoneNumber);
    if (!isValidPhoneNumber(normalized)) {
      toast.error('Please enter a valid phone number.');
      return;
    }

    try {
      setLinkPhoneLoading(true);
      const confirmation = await startPhoneLink(normalized);
      setLinkConfirmation(confirmation);
      toast.success('OTP sent successfully!');
    } catch (error: any) {
      console.error('Phone link error:', error);
      toast.error(error?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLinkPhoneLoading(false);
    }
  };

  const handlePhoneLinkConfirm = async () => {
    if (!linkConfirmation) {
      toast.error('Please request an OTP before verifying.');
      return;
    }

    const sanitizedOtp = linkOtp.replace(/\D/g, '').trim();
    if (!sanitizedOtp) {
      toast.error('Please enter the OTP.');
      return;
    }
    if (sanitizedOtp.length !== 6) {
      toast.error('Invalid OTP length. Please enter the 6-digit code.');
      return;
    }

    try {
      setLinkPhoneLoading(true);
      await confirmPhoneLink(linkConfirmation, sanitizedOtp);
      setLinkConfirmation(null);
      setLinkOtp('');
      toast.success('Phone number linked successfully!');
    } catch (error: any) {
      console.error('Phone link confirm error:', error);
      toast.error(error?.message || 'Failed to link phone number.');
    } finally {
      setLinkPhoneLoading(false);
    }
  };

  const handlePhoneLinkResend = async () => {
    await handlePhoneLinkStart();
  };

  const handlePhoneUnlink = async () => {
    if (!canUnlinkPhone) {
      toast.error('At least one login method must remain linked.');
      return;
    }
    if (!window.confirm('Unlink phone login from your account?')) {
      return;
    }
    try {
      setUnlinkPhoneLoading(true);
      await unlinkPhoneProvider();
      toast.success('Phone login unlinked.');
    } catch (error: any) {
      console.error('Phone unlink error:', error);
      toast.error(error?.message || 'Failed to unlink phone login.');
    } finally {
      setUnlinkPhoneLoading(false);
    }
  };

  const getDonationLevel = (donations: number = 0) => {
    if (donations === 0) return { level: 'New Donor', color: 'gray', icon: '🌱' };
    if (donations < 5) return { level: 'First Timer', color: 'blue', icon: '🎯' };
    if (donations < 10) return { level: 'Regular Donor', color: 'green', icon: '⭐' };
    if (donations < 25) return { level: 'Super Donor', color: 'purple', icon: '🚀' };
    if (donations < 50) return { level: 'Hero Donor', color: 'orange', icon: '🦸' };
    if (donations < 100) return { level: 'Legend Donor', color: 'red', icon: '👑' };
    return { level: 'Century Club', color: 'yellow', icon: '💯' };
  };

  const getNextMilestone = (donations: number = 0) => {
    const milestones = [
      { count: 1, label: 'First Donation' },
      { count: 3, label: 'Rookie Donor' },
      { count: 10, label: 'Regular Donor' },
      { count: 25, label: 'Super Donor' },
      { count: 50, label: 'Hero Donor' },
      { count: 100, label: 'Legend Donor' },
    ];
    const nextMilestone = milestones.find(milestone => donations < milestone.count);
    if (!nextMilestone) {
      return { label: 'Champion Donor', remaining: 0, target: donations };
    }
    return {
      label: nextMilestone.label,
      remaining: nextMilestone.count - donations,
      target: nextMilestone.count,
    };
  };


  const handleRespondToRequest = async (requestId: string) => {
    if (!user) {
      toast.error('Please log in to respond');
      return;
    }

    const success = await respondToRequest({
      requestId,
      donorId: user.uid,
      donorName: user.displayName || 'Anonymous Donor',
      donorPhone: user.phoneNumber || undefined,
      donorEmail: user.email || undefined,
    });

    if (success) {
      refreshData();
    }
  };

  const handleDonorRequestDecision = async (requestId: string, decision: 'accepted' | 'rejected') => {
    if (!user?.uid) {
      toast.error('Please log in to respond.');
      return;
    }
    if (donorRequestActionId) {
      return;
    }
    setDonorRequestActionId(requestId);
    const requestRef = doc(db, 'donorRequests', requestId);
    let requestData: any;
    try {
      const requestSnap = await getDoc(requestRef);
      if (!requestSnap.exists()) {
        toast.error('Request not found.');
        return;
      }
      requestData = requestSnap.data() as any;
      if (requestData.targetDonorUid !== user.uid) {
        toast.error('You are not allowed to update this request.');
        return;
      }
      if (requestData.status !== 'pending') {
        toast.error('This request has already been handled.');
        return;
      }

      const updatePayload: Record<string, any> = {
        status: decision,
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (decision === 'accepted') {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const donorPhone = user.phoneNumber || user.phoneNumberNormalized;
        if (donorPhone) {
          updatePayload.targetDonorPhone = donorPhone;
        }
        updatePayload.connectionExpiresAt = Timestamp.fromDate(expiresAt);
        updatePayload.connectionKey = [requestData.requesterUid, requestData.targetDonorUid].sort().join('_');
      }
      await updateDoc(requestRef, updatePayload);
    } catch (error) {
      console.error('Failed to update donor request:', error);
      toast.error('Unable to update request. Please try again.');
      return;
    } finally {
      setDonorRequestActionId(null);
    }

    const requesterNotification = addDoc(collection(db, 'notifications'), {
      userId: requestData.requesterUid,
      userRole: 'donor',
      type: 'donor_request',
      title: decision === 'accepted' ? 'Donor request accepted' : 'Donor request declined',
      message: `${requestData.targetDonorName || 'A donor'} has ${decision} your donor request.`,
      read: false,
      priority: 'high',
      relatedId: requestId,
      relatedType: 'donor_request',
      actionUrl: '/donor/dashboard/requests',
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });

    const selfNotification = addDoc(collection(db, 'notifications'), {
      userId: user.uid,
      userRole: 'donor',
      type: 'donor_request',
      title: decision === 'accepted' ? 'You accepted a donor request' : 'You declined a donor request',
      message: `You ${decision} a request from ${requestData.requesterName || 'a donor'}.`,
      read: false,
      priority: 'low',
      relatedId: requestId,
      relatedType: 'donor_request',
      actionUrl: '/donor/dashboard/requests',
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });

    const results = await Promise.allSettled([requesterNotification, selfNotification]);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const label = index === 0 ? 'requester' : 'self';
        console.warn(`Failed to send ${label} notification for donor request`, result.reason);
      }
    });
  };

  const handleDeleteDonorRequest = async (requestId: string) => {
    if (!user?.uid) {
      toast.error('Please log in to delete.');
      return;
    }
    if (donorRequestActionId || donorRequestDeleteId) {
      return;
    }
    try {
      setDonorRequestDeleteId(requestId);
      const requestRef = doc(db, 'donorRequests', requestId);
      const requestSnap = await getDoc(requestRef);
      if (!requestSnap.exists()) {
        toast.error('Request not found.');
        return;
      }
      const requestData = requestSnap.data() as any;
      const isParticipant = requestData.requesterUid === user.uid || requestData.targetDonorUid === user.uid;
      if (!isParticipant) {
        toast.error('You are not allowed to delete this request.');
        return;
      }
      const batchId = requestData.requestBatchId as string | undefined;
      if (batchId) {
        const batchRef = doc(db, 'donorRequestBatches', batchId);
        await runTransaction(db, async (transaction) => {
          const batchSnap = await transaction.get(batchRef);
          if (!batchSnap.exists()) return;
          const batchData = batchSnap.data() as any;
          const sentCount = typeof batchData.sentCount === 'number' ? batchData.sentCount : 0;
          const deletedCount = typeof batchData.deletedCount === 'number' ? batchData.deletedCount : 0;
          const nextSent = Math.max(0, sentCount - 1);
          const nextStatus = nextSent === 0 ? 'cancelled' : batchData.status;
          transaction.update(batchRef, {
            sentCount: nextSent,
            deletedCount: deletedCount + 1,
            status: nextStatus,
            updatedAt: serverTimestamp(),
          });
        });
      }
      await deleteDoc(requestRef);
      toast.success('Request deleted.');
    } catch (error) {
      console.error('Failed to delete donor request:', error);
      toast.error('Unable to delete request. Please try again.');
    } finally {
      setDonorRequestDeleteId(null);
    }
  };

  // Handler functions for all interactive elements
  const handleBookDonation = () => {
    navigate('/donor/dashboard/requests');
  };

  const handleEmergencyRequests = () => {
    setShowAllRequests(true);
  };

  const handleFindDonors = () => {
    navigate('/donors');
  };

  const handleInviteFriends = async () => {
    await copyInviteLink();
  };

  const buildInviteLink = () => {
    if (typeof window === 'undefined') {
      return '';
    }
    const baseUrl = window.location.origin;
    if (!baseUrl) return '';
    const bhId = user?.bhId?.trim();
    const referrerUid = user?.uid;
    const params = new URLSearchParams();
    if (bhId) {
      params.set('BHID', bhId);
    }
    if (referrerUid) {
      params.set('ref', referrerUid);
    }
    const queryString = params.toString();
    return queryString ? `${baseUrl}/?${queryString}` : baseUrl;
  };

  const createQrCodeDataUrl = async () => {
    const bhId = user?.bhId?.trim();
    if (!bhId) {
      return null;
    }
    const inviteLink = buildInviteLink();
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(inviteLink)}`;
    const response = await fetch(qrUrl);
    if (!response.ok) {
      throw new Error('Failed to generate QR code.');
    }
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read QR data.'));
      reader.readAsDataURL(blob);
    });
  };

  useEffect(() => {
    let active = true;
    if (!shareOptions.showQr) {
      setQrCodeDataUrl(null);
      return () => {
        active = false;
      };
    }
    createQrCodeDataUrl()
      .then((dataUrl) => {
        if (active) {
          setQrCodeDataUrl(dataUrl);
        }
      })
      .catch((error) => {
        console.warn('QR code generation failed', error);
        if (active) {
          setQrCodeDataUrl(null);
        }
      });
    return () => {
      active = false;
    };
  }, [shareOptions.showQr, user?.bhId]);

  const handleSaveLastDonation = async () => {
    const parsedDate = parseDateInput(lastDonationInput);
    if (!parsedDate) {
      toast.error('Please select a valid date.');
      return;
    }

    try {
      setLastDonationSaving(true);
      if (!user?.uid) {
        throw new Error('User not available.');
      }

      const historyRef = doc(db, 'DonationHistory', user.uid);
      const historySnapshot = await getDoc(historyRef);
      const existingDonations = historySnapshot.exists() && Array.isArray(historySnapshot.data().donations)
        ? historySnapshot.data().donations
        : [];
      const normalizedInputDate = normalizeToMidnight(parsedDate);
      const hasSameDate = existingDonations.some((entry: any) => {
        const entryDate = readEntryDate(entry);
        if (!entryDate) return false;
        const normalizedEntry = normalizeToMidnight(entryDate);
        return normalizedEntry.getTime() === normalizedInputDate.getTime();
      });

      const nextDonations = [...existingDonations];
      if (!hasSameDate) {
        nextDonations.push({
          id: generateDonationEntryId(),
          date: Timestamp.fromDate(parsedDate),
          location: user.city || '',
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
          const dateA = readEntryDate(a)?.getTime() || 0;
          const dateB = readEntryDate(b)?.getTime() || 0;
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

      await updateUserProfile({ lastDonation: parsedDate });
      setLastDonationSaved(true);
      setTimeout(() => setLastDonationSaved(false), 2500);
      toast.success('Last donation date saved.');
    } catch (error: any) {
      console.error('Last donation update error:', error);
      toast.error(error?.message || 'Failed to save last donation date.');
    } finally {
      setLastDonationSaving(false);
    }
  };

  const handleLogDonation = async (payload: {
    date: Date;
    location?: string;
    units?: number;
    notes?: string;
    bloodBank?: string;
    donationType?: 'whole' | 'platelets' | 'plasma';
    latitude?: number | null;
    longitude?: number | null;
  }) => {
    if (!user?.uid) {
      throw new Error('User not available.');
    }
    const donationDate = payload.date;
    if (!(donationDate instanceof Date) || Number.isNaN(donationDate.getTime())) {
      throw new Error('Invalid donation date.');
    }
    const historyRef = doc(db, 'DonationHistory', user.uid);
    const historySnapshot = await getDoc(historyRef);
    const existingDonations = historySnapshot.exists() && Array.isArray(historySnapshot.data().donations)
      ? historySnapshot.data().donations
      : [];

    const resolvedLocation = payload.location || user.city || '';
    const resolvedBloodBank = payload.bloodBank || 'Self Reported';
    const unitsValue = payload.units && payload.units > 0 ? payload.units : 1;
    const donationType = payload.donationType || 'whole';
    const quantityLabel = donationType === 'platelets'
      ? 'Platelets'
      : donationType === 'plasma'
        ? 'Plasma'
        : '450ml';

    const nextDonations = [
      ...existingDonations,
      {
        id: generateDonationEntryId(),
        date: Timestamp.fromDate(donationDate),
        location: resolvedLocation,
        latitude: typeof payload.latitude === 'number' ? payload.latitude : null,
        longitude: typeof payload.longitude === 'number' ? payload.longitude : null,
        bloodBank: resolvedBloodBank,
        hospitalId: '',
        hospitalName: resolvedBloodBank,
        quantity: quantityLabel,
        donationType,
        status: 'completed',
        units: unitsValue,
        source: 'manual',
        notes: payload.notes || '',
        createdAt: Timestamp.now(),
      },
    ];

    const sortedDonations = nextDonations
      .sort((a: any, b: any) => {
        const dateA = readEntryDate(a)?.getTime() || 0;
        const dateB = readEntryDate(b)?.getTime() || 0;
        return dateB - dateA;
      })
      .slice(0, 20);

    const latestDonationDate = sortedDonations.length > 0 ? readEntryDate(sortedDonations[0]) : null;

    await setDoc(
      historyRef,
      {
        userId: user.uid,
        lastDonationDate: latestDonationDate ? Timestamp.fromDate(latestDonationDate) : null,
        donations: sortedDonations,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (latestDonationDate) {
      await updateUserProfile({ lastDonation: latestDonationDate });
    }
    toast.success('Donation logged successfully.');
  };

  const handleDownloadCertificate = (certificateUrl: string) => {
    if (certificateUrl) {
      window.open(certificateUrl, '_blank');
      toast.success('Opening certificate...');
    } else {
      toast.error('Certificate not available');
    }
  };

  const handleStartDonationEdit = (donation: any) => {
    setFeedbackOpenId(null);
    setEditingDonationId(donation.id);
    const donationType = donation.donationType || inferDonationTypeFromEntry(donation) || 'whole';
    const latitude = typeof donation?.latitude === 'number' ? donation.latitude : null;
    const longitude = typeof donation?.longitude === 'number' ? donation.longitude : null;
    setEditingDonationData({
      location: donation.location || '',
      units: donation.units || 1,
      notes: donation.notes || '',
      donationType,
      latitude,
      longitude,
    });
  };

  const handleCancelDonationEdit = () => {
    setEditingDonationId(null);
  };

  const handleDonationEditSave = async () => {
    if (!editingDonationId || !user?.uid) return;
    const unitsValue = Number(editingDonationData.units);
    if (!Number.isFinite(unitsValue) || unitsValue <= 0) {
      toast.error('Please enter valid units.');
      return;
    }

    try {
      setDonationEditSaving(true);
      const donationType = editingDonationData.donationType || 'whole';
      const quantityLabel = donationType === 'platelets'
        ? 'Platelets'
        : donationType === 'plasma'
          ? 'Plasma'
          : '450ml';
      const historyRef = doc(db, 'DonationHistory', user.uid);
      const historySnapshot = await getDoc(historyRef);
      if (!historySnapshot.exists()) {
        throw new Error('Donation history not found.');
      }

      const existingDonations = Array.isArray(historySnapshot.data().donations)
        ? historySnapshot.data().donations
        : [];
      const updatedDonations = existingDonations.map((entry: any, index: number) => {
        const entryId = entry?.id || entry?.legacyId || `donation-${index}`;
        if (entryId !== editingDonationId) return entry;
        const latitude = typeof editingDonationData.latitude === 'number'
          ? editingDonationData.latitude
          : null;
        const longitude = typeof editingDonationData.longitude === 'number'
          ? editingDonationData.longitude
          : null;
        return {
          ...entry,
          location: editingDonationData.location,
          latitude,
          longitude,
          units: unitsValue,
          notes: editingDonationData.notes,
          donationType,
          quantity: quantityLabel,
          updatedAt: Timestamp.now(),
        };
      });

      await setDoc(
        historyRef,
        {
          donations: updatedDonations,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast.success('Donation updated.');
      setEditingDonationId(null);
    } catch (error: any) {
      console.error('Donation update error:', error);
      toast.error(error?.message || 'Failed to update donation.');
    } finally {
      setDonationEditSaving(false);
    }
  };

  const handleUndoDonationDelete = async (entry: any) => {
    if (!user?.uid || !entry) return;
    try {
      const historyRef = doc(db, 'DonationHistory', user.uid);
      const historySnapshot = await getDoc(historyRef);
      if (!historySnapshot.exists()) {
        throw new Error('Donation history not found.');
      }
      const existingDonations = Array.isArray(historySnapshot.data().donations)
        ? historySnapshot.data().donations
        : [];
      const entryId = entry?.id || entry?.legacyId;
      const alreadyExists = existingDonations.some((item: any, index: number) => {
        const currentId = item?.id || item?.legacyId || `donation-${index}`;
        return entryId ? currentId === entryId : item === entry;
      });
      if (alreadyExists) {
        toast.success('Donation already restored.');
        return;
      }
      const nextDonations = [...existingDonations, entry];
      const sortedDonations = nextDonations
        .sort((a: any, b: any) => {
          const dateA = readEntryDate(a)?.getTime() || 0;
          const dateB = readEntryDate(b)?.getTime() || 0;
          return dateB - dateA;
        })
        .slice(0, 20);
      const latestDonationDate = sortedDonations.length > 0 ? readEntryDate(sortedDonations[0]) : null;

      await setDoc(
        historyRef,
        {
          donations: sortedDonations,
          lastDonationDate: latestDonationDate ? Timestamp.fromDate(latestDonationDate) : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await updateUserProfile({ lastDonation: latestDonationDate || null });
      toast.success('Donation restored.');
    } catch (error: any) {
      console.error('Donation restore error:', error);
      toast.error(error?.message || 'Failed to restore donation.');
    }
  };

  const handleDeleteDonation = async (donationId: string, options?: { skipConfirm?: boolean }) => {
    if (!user?.uid) return;
    if (!options?.skipConfirm) {
      const confirmed = window.confirm('Delete this donation? You can undo for a short time.');
      if (!confirmed) return;
    }
    try {
      setDonationDeleteId(donationId);
      const historyRef = doc(db, 'DonationHistory', user.uid);
      const historySnapshot = await getDoc(historyRef);
      if (!historySnapshot.exists()) {
        throw new Error('Donation history not found.');
      }
      const existingDonations = Array.isArray(historySnapshot.data().donations)
        ? historySnapshot.data().donations
        : [];
      let removedEntry: any | null = null;
      const filteredDonations = existingDonations.filter((entry: any, index: number) => {
        const entryId = entry?.id || entry?.legacyId || `donation-${index}`;
        if (entryId === donationId) {
          removedEntry = entry;
          return false;
        }
        return entryId !== donationId;
      });
      if (!removedEntry) {
        throw new Error('Donation not found.');
      }
      const sortedDonations = filteredDonations
        .sort((a: any, b: any) => {
          const dateA = readEntryDate(a)?.getTime() || 0;
          const dateB = readEntryDate(b)?.getTime() || 0;
          return dateB - dateA;
        })
        .slice(0, 20);
      const latestDonationDate = sortedDonations.length > 0 ? readEntryDate(sortedDonations[0]) : null;

      await setDoc(
        historyRef,
        {
          donations: sortedDonations,
          lastDonationDate: latestDonationDate ? Timestamp.fromDate(latestDonationDate) : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await updateUserProfile({ lastDonation: latestDonationDate || null });
      toast.custom((toastInstance) => (
        <div className="rounded-xl border border-red-100 bg-white px-4 py-3 shadow-lg flex items-center gap-3">
          <span className="text-sm text-gray-700">Donation deleted.</span>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(toastInstance.id);
              void handleUndoDonationDelete(removedEntry);
            }}
            className="text-sm font-semibold text-red-600 hover:text-red-700"
          >
            Undo
          </button>
        </div>
      ), { duration: 5000 });
    } catch (error: any) {
      console.error('Donation delete error:', error);
      toast.error(error?.message || 'Failed to delete donation.');
    } finally {
      setDonationDeleteId(null);
    }
  };

  const handleViewAllBadges = () => {
    setShowAllBadges(true);
  };

  const handleViewAllCamps = () => {
    setShowAllCamps(true);
  };

  const handleViewAllRequests = () => {
    setShowAllRequests(true);
  };

  const handleLearnMore = () => {
    toast('Health tips and guidelines', { icon: 'ℹ️' });
    // Could open a modal or navigate to a help page
  };

  const handleShareDonorCard = async () => {
    try {
      setShareCardLoading(true);
      let qrOverride = qrCodeDataUrl;
      if (shareOptions.showQr && !qrOverride) {
        try {
          qrOverride = await createQrCodeDataUrl();
          setQrCodeDataUrl(qrOverride);
        } catch (qrError) {
          console.warn('QR code not available for share card', qrError);
        }
      }
      const svgMarkup = buildDonorCardSvg(qrOverride);
      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const img = new Image();

      const blobFromSvg = await new Promise<Blob>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 1200;
          canvas.height = 700;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported.'));
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to create image.'));
              return;
            }
            resolve(blob);
          }, 'image/png');
        };

        img.onerror = () => reject(new Error('Failed to render donor card.'));
        img.src = svgUrl;
      });

      URL.revokeObjectURL(svgUrl);
      const fileName = `bloodhub-donor-card-${user?.bhId || 'donor'}.png`;
      const file = new File([blobFromSvg], fileName, { type: 'image/png' });

      const canShareFiles = typeof (navigator as any).canShare === 'function'
        && (navigator as any).canShare({ files: [file] });
      if (navigator.share && canShareFiles) {
        await navigator.share({
          title: 'BloodHub Donor Card',
          text: 'My BloodHub donor card',
          files: [file],
        });
        toast.success('Donor card shared!');
        return;
      }

      const downloadUrl = URL.createObjectURL(blobFromSvg);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      toast.success('Donor card downloaded.');
    } catch (error: any) {
      console.error('Donor card share error:', error);
      toast.error(error?.message || 'Unable to share donor card.');
    } finally {
      setShareCardLoading(false);
    }
  };

  const handleEmergencyAlertsToggle = async () => {
    if (!availabilityEnabled) {
      toast.error('Set your availability to enable emergency alerts.');
      return;
    }
    const nextValue = !emergencyAlertsEnabled;
    setEmergencyAlertsEnabled(nextValue);
    try {
      setEmergencyAlertsSaving(true);
      await updateUserProfile({
        notificationPreferences: {
          emergencyAlerts: nextValue,
        },
      });
      toast.success(nextValue ? 'Emergency alerts enabled.' : 'Emergency alerts paused.');
    } catch (error: any) {
      console.error('Emergency alerts update error:', error);
      setEmergencyAlertsEnabled(!nextValue);
      toast.error(error?.message || 'Failed to update alert preference.');
    } finally {
      setEmergencyAlertsSaving(false);
    }
  };

  const handleAvailabilityToggle = async () => {
    const previousAvailability = availabilityEnabled;
    const previousAlerts = emergencyAlertsEnabled;
    const nextValue = !availabilityEnabled;
    const nextAlertsValue = nextValue ? true : false;
    setAvailabilityEnabled(nextValue);
    setEmergencyAlertsEnabled(nextAlertsValue);
    try {
      setAvailabilitySaving(true);
      await updateUserProfile({
        isAvailable: nextValue,
        availableUntil: null,
        notificationPreferences: {
          emergencyAlerts: nextAlertsValue,
        },
      });
      if (user?.uid) {
        await setDoc(
          doc(db, 'publicDonors', user.uid),
          {
            isAvailable: nextValue,
            availableUntil: null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      toast.success(nextValue ? 'You are now available for requests.' : 'You are on break.');
    } catch (error: any) {
      console.error('Availability update error:', error);
      setAvailabilityEnabled(previousAvailability);
      setEmergencyAlertsEnabled(previousAlerts);
      toast.error(error?.message || 'Failed to update availability.');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const handleAvailableToday = async () => {
    if (!user?.uid) return;
    try {
      setAvailableTodayLoading(true);
      const expiry = user?.availableUntil
        ? user.availableUntil instanceof Date
          ? user.availableUntil
          : new Date(user.availableUntil as any)
        : null;
      const breakActive = !availabilityEnabled
        && expiry
        && !Number.isNaN(expiry.getTime())
        && expiry.getTime() > Date.now();

      if (breakActive) {
        setAvailabilityEnabled(true);
        setEmergencyAlertsEnabled(true);
        await updateUserProfile({
          isAvailable: true,
          availableUntil: null,
          notificationPreferences: {
            emergencyAlerts: true,
          },
        });
        await setDoc(
          doc(db, 'publicDonors', user.uid),
          {
            isAvailable: true,
            availableUntil: null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        toast.success('You are now available.');
      } else {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        setAvailabilityEnabled(false);
        setEmergencyAlertsEnabled(false);
        await updateUserProfile({
          isAvailable: false,
          availableUntil: expiresAt,
          notificationPreferences: {
            emergencyAlerts: false,
          },
        });
        await setDoc(
          doc(db, 'publicDonors', user.uid),
          {
            isAvailable: false,
            availableUntil: expiresAt,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        toast.success('You are on break for the next 24 hours.');
      }
    } catch (error: any) {
      console.error('Available today update error:', error);
      toast.error(error?.message || 'Failed to update break status.');
    } finally {
      setAvailableTodayLoading(false);
    }
  };

  const handleChecklistToggle = async (key: 'hydrated' | 'weightOk' | 'hemoglobinOk' | 'rested' | 'ateMeal') => {
    const nextChecklist = {
      ...eligibilityChecklist,
      [key]: !eligibilityChecklist[key],
    };
    setEligibilityChecklist(nextChecklist);
    try {
      setChecklistSaving(true);
      await updateUserProfile({
        eligibilityChecklist: {
          ...nextChecklist,
          updatedAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Checklist update error:', error);
      toast.error(error?.message || 'Failed to update checklist.');
    } finally {
      setChecklistSaving(false);
    }
  };

  const handleChecklistReset = async () => {
    const resetChecklist = {
      hydrated: false,
      weightOk: false,
      hemoglobinOk: false,
      rested: false,
      ateMeal: false,
    };
    setEligibilityChecklist(resetChecklist);
    try {
      setChecklistSaving(true);
      await updateUserProfile({
        eligibilityChecklist: {
          ...resetChecklist,
          updatedAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Checklist reset error:', error);
      toast.error(error?.message || 'Failed to reset checklist.');
    } finally {
      setChecklistSaving(false);
    }
  };

  const handleOpenFeedback = (donationId: string) => {
    setEditingDonationId(null);
    const existing = donationFeedbackMap[donationId];
    setFeedbackForm({
      rating: existing?.rating || 0,
      notes: existing?.notes || '',
      certificateUrl: existing?.certificateUrl || '',
    });
    setFeedbackOpenId(donationId);
  };

  const handleCancelFeedback = () => {
    setFeedbackOpenId(null);
  };

  const handleSaveFeedback = async (donationId: string) => {
    if (!user?.uid) return;
    if (!feedbackForm.rating) {
      toast.error('Please add a rating.');
      return;
    }
    try {
      setFeedbackSaving(true);
      const historyRef = doc(db, 'DonationHistory', user.uid);
      const historySnapshot = await getDoc(historyRef);
      if (!historySnapshot.exists()) {
        throw new Error('Donation history not found.');
      }
      const existingDonations = Array.isArray(historySnapshot.data().donations)
        ? historySnapshot.data().donations
        : [];
      const donationExists = existingDonations.some((entry: any, index: number) => {
        const entryId = entry?.id || entry?.legacyId || `donation-${index}`;
        return entryId === donationId;
      });
      if (!donationExists) {
        throw new Error('Donation no longer exists.');
      }
      const feedbackRef = doc(db, 'DonationFeedback', `${user.uid}_${donationId}`);
      const existing = donationFeedbackMap[donationId];
      await setDoc(
        feedbackRef,
        {
          donorId: user.uid,
          donationId,
          rating: feedbackForm.rating,
          notes: feedbackForm.notes,
          certificateUrl: feedbackForm.certificateUrl,
          createdAt: existing?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (feedbackForm.certificateUrl) {
        const updatedDonations = existingDonations.map((entry: any, index: number) => {
          const entryId = entry?.id || entry?.legacyId || `donation-${index}`;
          if (entryId !== donationId) return entry;
          return {
            ...entry,
            certificateUrl: feedbackForm.certificateUrl,
            updatedAt: Timestamp.now(),
          };
        });
        await setDoc(
          historyRef,
          {
            donations: updatedDonations,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      toast.success('Feedback saved.');
      setFeedbackOpenId(null);
    } catch (error: any) {
      console.error('Feedback save error:', error);
      toast.error(error?.message || 'Failed to save feedback.');
    } finally {
      setFeedbackSaving(false);
    }
  };

  const toggleShareOption = (key: 'showPhone' | 'showEmail' | 'showBhId' | 'showQr') => {
    setShareOptions((prev: ShareOptions) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const donationCount = Array.isArray(donationHistory) ? donationHistory.length : 0;
  const donationsForLevel = Math.max(stats?.totalDonations || 0, donationCount);
  const donorLevel = getDonationLevel(donationsForLevel);
  const nextMilestone = getNextMilestone(stats?.totalDonations || 0);
  const lastDonationDate = parseDateInput(lastDonationInput)
    || (user?.lastDonation ? new Date(user.lastDonation) : null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalizedLastDonation = lastDonationDate
    ? new Date(lastDonationDate.getFullYear(), lastDonationDate.getMonth(), lastDonationDate.getDate())
    : null;
  const daysSinceDonation = normalizedLastDonation
    ? Math.max(0, Math.floor((today.getTime() - normalizedLastDonation.getTime()) / 86400000))
    : null;
  const eligibleToDonate = daysSinceDonation === null ? true : daysSinceDonation >= 90;
  const daysUntilEligible = daysSinceDonation === null ? 0 : Math.max(0, 90 - daysSinceDonation);
  const nextEligibleDate = normalizedLastDonation
    ? new Date(normalizedLastDonation.getTime() + 90 * 86400000)
    : null;
  const availabilityExpiry = user?.availableUntil
    ? user.availableUntil instanceof Date
      ? user.availableUntil
      : new Date(user.availableUntil as any)
    : null;
  const availabilityExpiryValid = availabilityExpiry && !Number.isNaN(availabilityExpiry.getTime());
  const availabilityActiveUntil = Boolean(availabilityExpiryValid && availabilityExpiry!.getTime() > Date.now());
  const availabilityExpiryLabel = availabilityActiveUntil ? formatDateTime(availabilityExpiry as Date) : null;
  const isBreakActive = availabilityActiveUntil && !availabilityEnabled;
  const availableTodayLabel = isBreakActive ? 'Resume now' : 'Pause 24h';
  const availableTodayHint = isBreakActive
    ? `Paused until ${availabilityExpiryLabel}`
    : availabilityExpiryLabel && availabilityEnabled
      ? `Active until ${availabilityExpiryLabel}`
      : 'Auto-resume after 24h';
  const requiredChecklistCompleted = ['hydrated', 'weightOk', 'hemoglobinOk']
    .filter((key) => eligibilityChecklist[key as keyof typeof eligibilityChecklist])
    .length;
  const checklistUpdatedAt = user?.eligibilityChecklist?.updatedAt
    ? user.eligibilityChecklist.updatedAt instanceof Date
      ? user.eligibilityChecklist.updatedAt
      : new Date(user.eligibilityChecklist.updatedAt as any)
    : null;
  const profileFields = [
    { label: 'Name', value: user?.displayName },
    { label: 'Blood type', value: user?.bloodType },
    { label: 'City', value: user?.city },
    { label: 'Phone', value: user?.phoneNumber },
    { label: 'Email', value: user?.email },
    { label: 'Date of birth', value: user?.dateOfBirth },
  ];
  const completedProfileFields = profileFields.filter(field => Boolean(field.value)).length;
  const profileCompletionPercent = Math.round((completedProfileFields / profileFields.length) * 100);
  const missingProfileFields = profileFields.filter(field => !field.value).map(field => field.label);
  const isLoading = loading;
  const streakCount = typeof stats?.streak === 'number' && stats.streak > 0
    ? stats.streak
    : donationCount;
  const emergencyResponses = typeof stats?.emergencyResponses === 'number'
    ? stats.emergencyResponses
    : 0;
  const rareBloodTypes = ['AB-', 'B-', 'O-'];
  const isRareBlood = rareBloodTypes.includes(user?.bloodType || '');
  const computedBadges = badges.map((badge: any) => {
    const requirement = badge.requirement || 0;
    if (badge.category === 'donation') {
      const progress = Math.min(donationCount, requirement);
      return { ...badge, earned: donationCount >= requirement, progress };
    }
    if (badge.category === 'streak') {
      const progress = Math.min(streakCount, requirement);
      return { ...badge, earned: streakCount >= requirement, progress };
    }
    if (badge.category === 'emergency') {
      const progress = Math.min(emergencyResponses, requirement);
      return { ...badge, earned: emergencyResponses >= requirement, progress };
    }
    if (badge.category === 'special' && badge.id === 'rare_hero') {
      return { ...badge, earned: isRareBlood, progress: isRareBlood ? 1 : 0 };
    }
    return badge;
  });
  const menuItems = [
    { id: 'overview', label: 'Overview', to: 'overview', icon: Activity },
    { id: 'readiness', label: 'Readiness', to: 'readiness', icon: CheckCircle },
    { id: 'requests', label: 'Requests', to: 'requests', icon: AlertCircle },
    { id: 'blood-drives', label: 'Blood Drives', to: 'blood-drives', icon: MapPinned },
    { id: 'journey', label: 'Journey', to: 'journey', icon: Trophy },
    { id: 'referrals', label: 'Referrals', to: 'referrals', icon: Users },
    { id: 'account', label: 'Account', to: 'account', icon: LucideUser },
  ] as const;
  const dashboardContext = {
    user,
    isLoading,
    donationHistory,
    firstDonationDate,
    emergencyRequests,
    incomingDonorRequests,
    outgoingDonorRequests,
    donorRequestBatches,
    incomingRequestsLoading,
    outgoingRequestsLoading,
    donorRequestBatchesLoading,
    donorRequestActionId,
    donorRequestDeleteId,
    bloodCamps,
    stats,
    badges: computedBadges,
    loading,
    error,
    refreshData,
    responding,
    formatDate,
    formatDateTime,
    formatTime,
    eligibleToDonate,
    daysUntilEligible,
    profileCompletionPercent,
    missingProfileFields,
    lastDonationDate,
    nextEligibleDate,
    normalizedLastDonation,
    lastDonationInput,
    setLastDonationInput,
    lastDonationSaving,
    lastDonationSaved,
    availabilityExpiryLabel,
    availabilityActiveUntil,
    availableTodayLabel,
    availableTodayHint,
    availableTodayLoading,
    availabilityEnabled,
    availabilitySaving,
    emergencyAlertsEnabled,
    emergencyAlertsSaving,
    eligibilityChecklist,
    checklistSaving,
    checklistCompleted: requiredChecklistCompleted,
    checklistUpdatedAt,
    referralCount,
    referralLoading,
    referralUsersLoading,
    referralMilestone,
    referralDetails,
    eligibleReferralCount,
    referralSummary,
    donorLevel,
    nextMilestone,
    shareOptions,
    shareCardLoading,
    qrCodeDataUrl,
    shareOptionsOpen,
    setShareOptionsOpen,
    setQrPreviewOpen,
    isPhoneLinked,
    canUnlinkPhone,
    unlinkPhoneLoading,
    linkPhoneNumber,
    setLinkPhoneNumber,
    linkOtp,
    setLinkOtp,
    linkConfirmation,
    linkPhoneLoading,
    isGoogleLinked,
    canUnlinkGoogle,
    unlinkGoogleLoading,
    linkGoogleLoading,
    editingDonationId,
    editingDonationData,
    setEditingDonationData,
    donationEditSaving,
    donationDeleteId,
    feedbackOpenId,
    feedbackForm,
    setFeedbackForm,
    feedbackSaving,
    donationFeedbackMap,
    handleEmergencyRequests,
    handleFindDonors,
    handleInviteFriends,
    handleAvailableToday,
    handleSaveLastDonation,
    handleLogDonation,
    handleChecklistToggle,
    handleChecklistReset,
    handleViewAllRequests,
    handleRespondToRequest,
    handleDonorRequestDecision,
    handleDeleteDonorRequest,
    handleViewAllBadges,
    handleViewAllCamps,
    handleBookDonation,
    handleLearnMore,
    handleStartDonationEdit,
    handleDonationEditSave,
    handleCancelDonationEdit,
    handleDeleteDonation,
    handleOpenFeedback,
    handleSaveFeedback,
    handleCancelFeedback,
    handleDownloadCertificate,
    handleShareDonorCard,
    handleAvailabilityToggle,
    handleEmergencyAlertsToggle,
    handlePhoneLinkStart,
    handlePhoneLinkConfirm,
    handlePhoneLinkResend,
    handlePhoneUnlink,
    handleGoogleLink,
    handleGoogleUnlink,
    copyInviteLink,
    shareInviteLink,
    openWhatsAppInvite,
    referralQrDataUrl,
    referralQrLoading,
    loadReferralQr,
  } as const;

  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-800 text-lg font-semibold mb-2">Error Loading Dashboard</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => refreshData()}
            className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-300 flex items-center space-x-2 mx-auto"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-100">
      <div className="container mx-auto px-4 py-8">
        <div className="lg:flex lg:gap-6">
          <aside className="hidden lg:block lg:w-64">
            <div className="sticky top-6 space-y-2 rounded-2xl border border-red-100 bg-white p-4 shadow-lg">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    className={({ isActive }) => (
                      `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${isActive ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md' : 'text-gray-600 hover:bg-red-50'}`
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </aside>
          <div className="lg:hidden mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm"
              >
                <Menu className="h-4 w-4 text-red-600" />
                Menu
              </button>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-red-600">Dashboard</span>
          </div>
          <main className="min-w-0 flex-1">
            <Outlet context={dashboardContext} />
          </main>
        </div>
      </div>
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu overlay"
        />
        <div
          className={`absolute left-0 top-0 h-full w-72 bg-white p-4 shadow-2xl transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Donor Menu</p>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-full p-2 hover:bg-gray-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={`mobile-${item.id}`}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => (
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${isActive ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md' : 'text-gray-600 hover:bg-red-50'}`
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
      {/* Modals */}
      {/* View All Emergency Requests Modal */}
      {showAllRequests && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">All Emergency Requests</h2>
              <button
                onClick={() => setShowAllRequests(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {emergencyRequests.map((request) => (
                <div
                  key={request.id}
                  className={`p-4 border-2 rounded-xl ${
                    request.urgency === 'critical'
                      ? 'border-red-300 bg-red-50'
                      : request.urgency === 'high'
                      ? 'border-red-200 bg-red-50/70'
                      : 'border-red-100 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-xl ${
                        request.urgency === 'critical' ? 'bg-red-600' :
                        request.urgency === 'high' ? 'bg-red-500' : 'bg-red-400'
                      }`}>
                        <Droplet className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 mb-1">
                          {request.bloodType} - {request.units} Units needed
                        </h3>
                        <p className="text-sm text-gray-600 flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {request.hospitalName}, {request.city}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Posted {formatTime(request.requestedAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        handleRespondToRequest(request.id);
                        setShowAllRequests(false);
                      }}
                      disabled={responding}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-semibold disabled:opacity-50"
                    >
                      Respond
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View All Badges Modal */}
      {showAllBadges && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <Trophy className="w-6 h-6 mr-2 text-red-600" />
                All Achievements
              </h2>
              <button
                onClick={() => setShowAllBadges(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {computedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`p-6 rounded-xl text-center transition-all ${
                      badge.earned
                        ? 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200'
                        : 'bg-gray-50 opacity-50 border-2 border-gray-200'
                    }`}
                  >
                    <div className="text-4xl mb-3">{badge.icon}</div>
                    <p className="text-sm font-bold text-gray-800 mb-1">{badge.name}</p>
                    <p className="text-xs text-gray-600">{badge.description}</p>
                    {badge.earned && (
                      <p className="text-xs text-red-600 mt-2">
                        ✓ Earned
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View All Camps Modal */}
      {showAllCamps && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <MapPinned className="w-6 h-6 mr-2 text-red-600" />
                All Nearby Blood Camps
              </h2>
              <button
                onClick={() => setShowAllCamps(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {bloodCamps.length > 0 ? (
                bloodCamps.map((camp) => (
                  <div key={camp.id} className="p-4 bg-red-50 rounded-xl border-2 border-red-200">
                    <h3 className="font-bold text-gray-800 text-lg mb-2">{camp.name}</h3>
                    <p className="text-sm text-gray-600 flex items-center mb-2">
                      <MapPin className="w-4 h-4 mr-1" />
                      {camp.location}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center mb-2">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(camp.date)}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {camp.startTime} - {camp.endTime}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <MapPinned className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No upcoming blood camps in your area</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Share Options Drawer */}
      {shareOptionsOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
          <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Donor Card Share Options</h3>
                <p className="text-xs text-gray-500">Choose what shows on your card.</p>
              </div>
              <button
                type="button"
                onClick={() => setShareOptionsOpen(false)}
                className="rounded-full p-2 hover:bg-gray-100 transition-all"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              {[
                { key: 'showBhId', label: 'Show BH ID' },
                { key: 'showPhone', label: 'Show phone number' },
                { key: 'showEmail', label: 'Show email address' },
                { key: 'showQr', label: 'Show QR code link' },
              ].map((option) => {
                const enabled = shareOptions[option.key as keyof typeof shareOptions];
                return (
                  <div key={option.key} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <span className="text-sm font-semibold text-gray-800">{option.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleShareOption(option.key as 'showPhone' | 'showEmail' | 'showBhId' | 'showQr')}
                      role="switch"
                      aria-checked={enabled}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${
                        enabled ? 'bg-red-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          enabled ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setShareOptionsOpen(false)}
                className="w-full rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-300"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Preview Modal */}
      {qrPreviewOpen && qrCodeDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setQrPreviewOpen(false)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => setQrPreviewOpen(false)}
              className="absolute right-3 top-3 rounded-full p-2 hover:bg-gray-100 transition-all"
              aria-label="Close QR preview"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">BloodHub Donor QR</p>
            <h3 className="mt-2 text-lg font-bold text-gray-900">Scan to open your profile</h3>
            <div className="mt-6 flex justify-center">
              <img
                src={qrCodeDataUrl}
                alt="QR code preview"
                className="h-56 w-56 rounded-xl border border-red-100 bg-white p-3"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DonorDashboard;
