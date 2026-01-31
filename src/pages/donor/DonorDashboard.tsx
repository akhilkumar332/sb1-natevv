// src/pages/donor/DonorDashboard.tsx
import { useEffect, useRef, useState } from 'react';
import {
  User as LucideUser,
  MapPin,
  Calendar,
  Droplet,
  Clock,
  Users,
  Bell,
  Share2,
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
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BhIdBanner from '../../components/BhIdBanner';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp, Timestamp, query, where, onSnapshot, documentId } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { normalizePhoneNumber, isValidPhoneNumber } from '../../utils/phone';
import { REFERRAL_RULES, computeReferralStatus } from '../../utils/referralRules';
import { ensureReferralNotificationsForReferrer } from '../../services/referral.service';
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

type ReferralEntry = {
  id: string;
  referredUid: string;
  referredAt?: Date | null;
  status?: string;
  referrerBhId?: string;
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

  // State for modals and UI
  const [showNotifications, setShowNotifications] = useState(false);
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
  const [shareOptions, setShareOptions] = useState<ShareOptions>(() => {
    if (typeof window === 'undefined') {
      return {
        showPhone: true,
        showEmail: true,
        showBhId: true,
        showQr: true,
      };
    }
    try {
      const raw = localStorage.getItem('donorCardShareOptions');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          showPhone: true,
          showEmail: true,
          showBhId: true,
          showQr: true,
          ...parsed,
        };
      }
    } catch (error) {
      console.warn('Failed to load donor card share options', error);
    }
    return {
      showPhone: true,
      showEmail: true,
      showBhId: true,
      showQr: true,
    };
  });
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [referralQrDataUrl, setReferralQrDataUrl] = useState<string | null>(null);
  const [referralQrLoading, setReferralQrLoading] = useState(false);
  const [editingDonationId, setEditingDonationId] = useState<string | null>(null);
  const [editingDonationData, setEditingDonationData] = useState({
    location: '',
    units: 1,
    notes: '',
  });
  const [donationEditSaving, setDonationEditSaving] = useState(false);
  const [referralCount, setReferralCount] = useState(0);
  const [referralLoading, setReferralLoading] = useState(true);
  const [referralEntries, setReferralEntries] = useState<ReferralEntry[]>([]);
  const [referralUsers, setReferralUsers] = useState<Record<string, any>>({});
  const [referralUsersLoading, setReferralUsersLoading] = useState(false);
  const [fallbackReferralLoading, setFallbackReferralLoading] = useState(false);
  const fallbackReferralAppliedRef = useRef(false);
  const referralNotificationSyncRef = useRef<Set<string>>(new Set());
  const [eligibilityChecklist, setEligibilityChecklist] = useState({
    hydrated: false,
    weightOk: false,
    hemoglobinOk: false,
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

  // Use custom hook to fetch all donor data
  const {
    donationHistory,
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

  const formatTime = (date: Date) => {
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

  const generateDonationEntryId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `manual-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
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
    if (!user?.availableUntil || !user?.isAvailable) return;
    const expiry = user.availableUntil instanceof Date
      ? user.availableUntil
      : new Date(user.availableUntil);
    if (Number.isNaN(expiry.getTime())) return;
    if (expiry.getTime() <= Date.now()) {
      updateUserProfile({
        isAvailable: false,
        availableUntil: null,
        notificationPreferences: {
          emergencyAlerts: false,
        },
      }).catch(error => {
        console.warn('Failed to auto-disable availability:', error);
      });
    }
  }, [user?.availableUntil, user?.isAvailable, updateUserProfile]);

  useEffect(() => {
    if (!user?.uid) return;
    setReferralLoading(true);
    const referralQuery = query(
      collection(db, 'ReferralTracking'),
      where('referrerUid', '==', user.uid)
    );
    const unsubscribe = onSnapshot(referralQuery, (snapshot) => {
      const nextEntries = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data() as any;
        const referredAt = data?.referredAt?.toDate
          ? data.referredAt.toDate()
          : typeof data?.referredAt?.seconds === 'number'
            ? new Date(data.referredAt.seconds * 1000)
            : null;
        return {
          id: docSnapshot.id,
          referredUid: data?.referredUid,
          referredAt,
          status: data?.status,
          referrerBhId: data?.referrerBhId,
        } as ReferralEntry;
      }).filter(entry => Boolean(entry.referredUid));
      nextEntries.sort((a, b) => (b.referredAt?.getTime() || 0) - (a.referredAt?.getTime() || 0));
      setReferralEntries(nextEntries);
      setReferralCount(snapshot.size);
      setReferralLoading(false);
    }, (error) => {
      console.warn('Failed to load referrals:', error);
      setReferralLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    if (referralLoading) return;
    if (referralEntries.length > 0) return;
    if (fallbackReferralAppliedRef.current) return;
    let isActive = true;
    setFallbackReferralLoading(true);
    const fetchFallbackReferrals = async () => {
      try {
        const fallbackQuery = query(
          collection(db, 'users'),
          where('referredByUid', '==', user.uid)
        );
        const snapshot = await getDocs(fallbackQuery);
        if (!isActive) return;
        if (snapshot.empty) {
          return;
        }
        const fallbackEntries = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as any;
          const createdAt = data?.createdAt?.toDate
            ? data.createdAt.toDate()
            : typeof data?.createdAt?.seconds === 'number'
              ? new Date(data.createdAt.seconds * 1000)
              : null;
          return {
            id: `fallback_${docSnapshot.id}`,
            referredUid: docSnapshot.id,
            referredAt: createdAt,
            status: data?.onboardingCompleted ? 'onboarded' : 'registered',
            referrerBhId: user.bhId,
          } as ReferralEntry;
        }).filter(entry => Boolean(entry.referredUid));
        if (fallbackEntries.length > 0) {
          fallbackEntries.sort((a, b) => (b.referredAt?.getTime() || 0) - (a.referredAt?.getTime() || 0));
          setReferralEntries(fallbackEntries);
          setReferralCount(fallbackEntries.length);
        }
      } catch (error) {
        console.warn('Failed to load referral fallback data:', error);
      } finally {
        if (isActive) {
          fallbackReferralAppliedRef.current = true;
          setFallbackReferralLoading(false);
        }
      }
    };
    fetchFallbackReferrals();
    return () => {
      isActive = false;
    };
  }, [user?.uid, referralLoading, referralEntries.length]);

  useEffect(() => {
    if (referralEntries.length === 0) {
      setReferralUsers({});
      setReferralUsersLoading(false);
      return;
    }
    let isActive = true;
    const fetchReferralUsers = async () => {
      setReferralUsersLoading(true);
      try {
        const uniqueIds = Array.from(new Set(referralEntries.map(entry => entry.referredUid).filter(Boolean)));
        const chunkSize = 10;
        const chunks: string[][] = [];
        for (let i = 0; i < uniqueIds.length; i += chunkSize) {
          chunks.push(uniqueIds.slice(i, i + chunkSize));
        }
        const results = await Promise.all(chunks.map(async (chunk) => {
          const usersQuery = query(collection(db, 'users'), where(documentId(), 'in', chunk));
          const usersSnapshot = await getDocs(usersQuery);
          const map: Record<string, any> = {};
          usersSnapshot.forEach((userDoc) => {
            map[userDoc.id] = userDoc.data();
          });
          return map;
        }));
        if (!isActive) return;
        const merged = results.reduce((acc, current) => ({ ...acc, ...current }), {} as Record<string, any>);
        setReferralUsers(merged);
      } catch (error) {
        console.warn('Failed to load referred users:', error);
      } finally {
        if (isActive) {
          setReferralUsersLoading(false);
        }
      }
    };
    fetchReferralUsers();
    return () => {
      isActive = false;
    };
  }, [referralEntries]);

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
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('donorCardShareOptions', JSON.stringify(shareOptions));
    } catch (error) {
      console.warn('Failed to save donor card share options', error);
    }
  }, [shareOptions]);

  const providerIds = auth.currentUser?.providerData?.map(provider => provider.providerId) || [];
  const isPhoneLinked = providerIds.includes('phone');
  const isGoogleLinked = providerIds.includes('google.com');
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

  const getReferralMilestone = (count: number) => {
    const milestones = [1, 3, 5, 10, 25];
    const next = milestones.find(milestone => count < milestone);
    if (!next) {
      return { next: null, remaining: 0, label: 'Legend Referrer' };
    }
    return {
      next,
      remaining: next - count,
      label: `Next milestone at ${next}`,
    };
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

  // Handler functions for all interactive elements
  const handleBookDonation = () => {
    toast.success('Redirecting to appointment booking...');
    navigate('/request-blood'); // Navigate to blood request page
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

  const copyInviteLink = async () => {
    const inviteLink = buildInviteLink();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
        toast.success('Invite link copied to clipboard!');
        return;
      }
      throw new Error('Clipboard not available');
    } catch (error) {
      console.warn('Clipboard copy failed:', error);
      toast.error('Unable to copy link. Please try again.');
    }
  };

  const shareInviteLink = async () => {
    const inviteLink = buildInviteLink();
    const message = 'Join BloodHub and save lives. Use my referral link to get started.';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'BloodHub Referral',
          text: message,
          url: inviteLink,
        });
        return;
      } catch (error) {
        console.warn('Share canceled or failed:', error);
      }
    }
    await copyInviteLink();
  };

  const openWhatsAppInvite = () => {
    const inviteLink = buildInviteLink();
    const text = `Join BloodHub and save lives. Use my referral link to get started: ${inviteLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const buildInviteLink = () => {
    const baseUrl = window.location.origin;
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

  const loadReferralQr = async () => {
    if (referralQrLoading || referralQrDataUrl) return;
    setReferralQrLoading(true);
    try {
      const inviteLink = buildInviteLink();
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteLink)}`;
      const response = await fetch(qrUrl);
      if (!response.ok) {
        throw new Error('Failed to generate referral QR code.');
      }
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read QR data.'));
        reader.readAsDataURL(blob);
      });
      setReferralQrDataUrl(dataUrl);
    } catch (error) {
      console.warn('Referral QR generation failed', error);
      toast.error('Unable to generate QR code.');
    } finally {
      setReferralQrLoading(false);
    }
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

  const handleDownloadCertificate = (certificateUrl: string) => {
    if (certificateUrl) {
      window.open(certificateUrl, '_blank');
      toast.success('Opening certificate...');
    } else {
      toast.error('Certificate not available');
    }
  };

  const handleStartDonationEdit = (donation: any) => {
    setEditingDonationId(donation.id);
    setEditingDonationData({
      location: donation.location || '',
      units: donation.units || 1,
      notes: donation.notes || '',
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
        return {
          ...entry,
          location: editingDonationData.location,
          units: unitsValue,
          notes: editingDonationData.notes,
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

  const handleViewAllBadges = () => {
    setShowAllBadges(true);
  };

  const handleViewAllCamps = () => {
    setShowAllCamps(true);
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
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
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setAvailabilityEnabled(true);
      setEmergencyAlertsEnabled(true);
      await updateUserProfile({
        isAvailable: true,
        availableUntil: expiresAt,
        notificationPreferences: {
          emergencyAlerts: true,
        },
      });
      toast.success('You are available for the next 24 hours.');
    } catch (error: any) {
      console.error('Available today update error:', error);
      toast.error(error?.message || 'Failed to update availability.');
    } finally {
      setAvailableTodayLoading(false);
    }
  };

  const handleChecklistToggle = async (key: 'hydrated' | 'weightOk' | 'hemoglobinOk') => {
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

  const handleOpenFeedback = (donationId: string) => {
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
        const historyRef = doc(db, 'DonationHistory', user.uid);
        const historySnapshot = await getDoc(historyRef);
        if (historySnapshot.exists()) {
          const existingDonations = Array.isArray(historySnapshot.data().donations)
            ? historySnapshot.data().donations
            : [];
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
  const eligibleToDonate = daysSinceDonation === null ? true : daysSinceDonation > 90;
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
  const availableTodayLabel = availabilityActiveUntil ? 'Extend 24h' : 'I\'m Available Today';
  const availableTodayHint = availabilityExpiryLabel
    ? `Active until ${availabilityExpiryLabel}`
    : 'Auto-off after 24h';
  const checklistCompleted = Object.values(eligibilityChecklist).filter(Boolean).length;
  const checklistUpdatedAt = user?.eligibilityChecklist?.updatedAt
    ? user.eligibilityChecklist.updatedAt instanceof Date
      ? user.eligibilityChecklist.updatedAt
      : new Date(user.eligibilityChecklist.updatedAt as any)
    : null;
  const referralDetails = referralEntries.map((entry) => {
    const referredUser = referralUsers[entry.referredUid];
    const computed = computeReferralStatus({
      referredAt: entry.referredAt,
      referredUser,
      entryStatus: entry.status,
      rules: REFERRAL_RULES,
    });
    return {
      ...entry,
      user: referredUser,
      referralAgeDays: computed.ageDays,
      remainingDays: computed.remainingDays,
      isEligible: computed.isEligible,
      isDeleted: computed.isDeleted,
      statusLabel: computed.statusLabel,
      referralStatus: computed.status,
      sortDate: computed.baseDate,
    };
  });
  const eligibleReferralCount = referralDetails.filter(entry => entry.isEligible).length;
  const referralSummary = referralDetails.reduce((acc: Record<string, number>, entry: any) => {
    const status = entry.referralStatus || 'registered';
    acc.total += 1;
    if (status === 'eligible') acc.eligible += 1;
    if (status === 'onboarded') acc.onboarded += 1;
    if (status === 'registered') acc.registered += 1;
    if (status === 'deleted') acc.deleted += 1;
    return acc;
  }, {
    total: 0,
    eligible: 0,
    onboarded: 0,
    registered: 0,
    deleted: 0,
  });
  referralSummary.notEligible = Math.max(
    0,
    referralSummary.total - referralSummary.eligible - referralSummary.deleted
  );
  const referralMilestone = getReferralMilestone(eligibleReferralCount);
  const referralUsersLoadingCombined = referralUsersLoading || fallbackReferralLoading;

  useEffect(() => {
    if (!user?.uid) return;
    if (referralLoading || referralUsersLoadingCombined) return;
    if (referralDetails.length === 0) return;

    const candidates = referralDetails.filter(entry =>
      entry.referralStatus === 'onboarded' || entry.referralStatus === 'eligible'
    );
    const pending = candidates.filter(entry => {
      const key = `${entry.referredUid}_${entry.referralStatus}`;
      return !referralNotificationSyncRef.current.has(key);
    });
    if (pending.length === 0) return;

    let isActive = true;
    (async () => {
      await ensureReferralNotificationsForReferrer(user.uid, pending);
      if (!isActive) return;
      pending.forEach(entry => {
        const key = `${entry.referredUid}_${entry.referralStatus}`;
        referralNotificationSyncRef.current.add(key);
      });
    })();

    return () => {
      isActive = false;
    };
  }, [user?.uid, referralDetails, referralLoading, referralUsersLoadingCombined]);

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
  const bestBadgeByCategory = (category: string) => {
    const earned = computedBadges.filter((badge: any) => badge.category === category && badge.earned);
    if (earned.length === 0) return null;
    return earned.sort((a: any, b: any) => (a.requirement || 0) - (b.requirement || 0)).pop() || null;
  };
  const bestDonationBadge = bestBadgeByCategory('donation');
  const bestStreakBadge = bestBadgeByCategory('streak');
  const bestEmergencyBadge = bestBadgeByCategory('emergency');
  const rareHeroBadge = computedBadges.find((badge: any) => badge.id === 'rare_hero' && badge.earned) || null;
  const menuItems = [
    { id: 'overview', label: 'Overview', to: 'overview', icon: Activity },
    { id: 'readiness', label: 'Readiness', to: 'readiness', icon: CheckCircle },
    { id: 'requests', label: 'Requests', to: 'requests', icon: AlertCircle },
    { id: 'journey', label: 'Journey', to: 'journey', icon: Trophy },
    { id: 'referrals', label: 'Referrals', to: 'referrals', icon: Users },
    { id: 'account', label: 'Account', to: 'account', icon: LucideUser },
  ] as const;
  const dashboardContext = {
    user,
    isLoading,
    donationHistory,
    emergencyRequests,
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
    checklistCompleted,
    checklistUpdatedAt,
    referralCount,
    referralLoading,
    referralUsersLoading: referralUsersLoadingCombined,
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
    handleChecklistToggle,
    handleViewAllRequests,
    handleRespondToRequest,
    handleViewAllBadges,
    handleViewAllCamps,
    handleBookDonation,
    handleLearnMore,
    handleStartDonationEdit,
    handleDonationEditSave,
    handleCancelDonationEdit,
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
            onClick={refreshData}
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
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white shadow-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="w-16 h-16 rounded-full border-4 border-white shadow-lg object-cover"
                  onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?background=fff&color=dc2626&name=${encodeURIComponent(user?.displayName || 'Donor')}`;
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white flex items-center justify-center">
                  <LucideUser className="w-8 h-8" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">Welcome back, {user?.displayName?.split(' ')[0] || 'Donor'}!</h1>
                {(bestDonationBadge || bestStreakBadge || bestEmergencyBadge || rareHeroBadge) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {bestDonationBadge && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                        <span className="text-base">{bestDonationBadge.icon}</span>
                        <span>{bestDonationBadge.name}</span>
                      </span>
                    )}
                    {bestStreakBadge && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                        <span className="text-base">{bestStreakBadge.icon}</span>
                        <span>{bestStreakBadge.name}</span>
                      </span>
                    )}
                    {bestEmergencyBadge && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                        <span className="text-base">{bestEmergencyBadge.icon}</span>
                        <span>{bestEmergencyBadge.name}</span>
                      </span>
                    )}
                    {rareHeroBadge && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                        <span className="text-base">{rareHeroBadge.icon}</span>
                        <span>{rareHeroBadge.name}</span>
                      </span>
                    )}
                  </div>
                )}
                {donationCount === 0 && (
                  <p className="text-white/80 flex items-center">
                    <span className="text-2xl mr-2">{donorLevel.icon}</span>
                    {donorLevel.level}
                  </p>
                )}
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={refreshData}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300"
                title="Refresh data"
              >
                <RefreshCw className="w-6 h-6" />
              </button>
              <button
                onClick={handleNotificationClick}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300 relative"
              >
                <Bell className="w-6 h-6" />
                {emergencyRequests.length > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-red-200 rounded-full text-xs flex items-center justify-center text-red-800 font-bold">
                    {emergencyRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleInviteFriends}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300"
              >
                <Share2 className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-6">
        <BhIdBanner />
      </div>

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
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm"
            >
              <Menu className="h-4 w-4 text-red-600" />
              Menu
            </button>
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

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <Bell className="w-6 h-6 mr-2 text-red-600" />
                Notifications
              </h2>
              <button
                onClick={() => setShowNotifications(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {emergencyRequests.length > 0 ? (
                <div className="space-y-3">
                  {emergencyRequests.slice(0, 5).map((request) => (
                    <div key={request.id} className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                      <p className="font-semibold text-gray-800 text-sm">
                        Emergency: {request.bloodType} needed
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {request.hospitalName} - {request.units} units
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(request.requestedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-gray-600">No new notifications</p>
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
