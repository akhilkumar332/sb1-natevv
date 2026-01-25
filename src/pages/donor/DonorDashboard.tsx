// src/pages/donor/DonorDashboard.tsx
import { useEffect, useState } from 'react';
import {
  User as LucideUser,
  MapPin,
  Calendar,
  Droplet,
  Phone,
  Heart,
  Award,
  Clock,
  Users,
  Bell,
  Share2,
  Zap,
  Activity,
  AlertCircle,
  CheckCircle,
  MapPinned,
  BookOpen,
  Trophy,
  Download,
  RefreshCw,
  Loader2,
  X,
  Chrome,
  Edit3,
  SlidersHorizontal,
  Save,
  XCircle,
  MessageCircle,
  Star
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDonorData } from '../../hooks/useDonorData';
import { useBloodRequest } from '../../hooks/useBloodRequest';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BhIdBanner from '../../components/BhIdBanner';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { collection, doc, getDoc, setDoc, serverTimestamp, Timestamp, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { normalizePhoneNumber, isValidPhoneNumber } from '../../utils/phone';
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

  // State for modals and UI
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [showAllCamps, setShowAllCamps] = useState(false);
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
  const [editingDonationId, setEditingDonationId] = useState<string | null>(null);
  const [editingDonationData, setEditingDonationData] = useState({
    location: '',
    units: 1,
    notes: '',
  });
  const [donationEditSaving, setDonationEditSaving] = useState(false);
  const [referralCount, setReferralCount] = useState(0);
  const [referralLoading, setReferralLoading] = useState(true);
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
    if (donations < 3) return { level: 'Rookie Donor', color: 'blue', icon: '🎯' };
    if (donations < 10) return { level: 'Regular Donor', color: 'green', icon: '⭐' };
    if (donations < 25) return { level: 'Super Donor', color: 'purple', icon: '🚀' };
    if (donations < 50) return { level: 'Hero Donor', color: 'orange', icon: '🦸' };
    if (donations < 100) return { level: 'Legend Donor', color: 'red', icon: '👑' };
    return { level: 'Champion Donor', color: 'yellow', icon: '🏆' };
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
    copyInviteLink();
  };

  const copyInviteLink = () => {
    const inviteLink = buildInviteLink();
    navigator.clipboard.writeText(inviteLink);
    toast.success('Invite link copied to clipboard!');
  };

  const buildInviteLink = () => {
    const baseUrl = window.location.origin;
    const bhId = user?.bhId?.trim();
    if (!bhId) {
      return baseUrl;
    }
    return `${baseUrl}/?BHID=${encodeURIComponent(bhId)}`;
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
          createdAt: serverTimestamp(),
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
          updatedAt: serverTimestamp(),
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
              updatedAt: serverTimestamp(),
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

  const donorLevel = getDonationLevel(stats?.totalDonations || 0);
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
  const referralMilestone = getReferralMilestone(referralCount);
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
                <p className="text-white/80 flex items-center">
                  <span className="text-2xl mr-2">{donorLevel.icon}</span>
                  {donorLevel.level}
                </p>
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
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-600">Snapshot</p>
          <h2 className="text-xl font-bold text-gray-900">Your Snapshot</h2>
        </div>
        {/* Top Highlights */}
        <div className="mb-6">
          {/* Stats Strip */}
          <div className="grid grid-cols-2 gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`stat-skeleton-${index}`}
                  className="bg-white rounded-xl border border-red-100 p-4 shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="h-3 w-24 rounded-full bg-gray-100 animate-pulse" />
                    <div className="h-6 w-16 rounded-full bg-gray-100 animate-pulse" />
                    <div className="h-3 w-20 rounded-full bg-gray-100 animate-pulse" />
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Donations</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.totalDonations || 0}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50">
                    <Droplet className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Your lifesaving journey</p>
              </div>
              <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Lives Saved</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.livesSaved || 0}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50">
                    <Heart className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Each donation saves 3 lives</p>
              </div>
              <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Next Eligible In</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {eligibleToDonate ? 0 : daysUntilEligible}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50">
                    <Clock className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {eligibleToDonate ? 'Ready to donate' : 'days remaining'}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Impact Score</p>
                    <p className="text-2xl font-bold text-gray-900">{stats?.impactScore || 0}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50">
                    <Award className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {stats?.rank ? `Rank #${stats.rank}` : 'Keep donating!'}
                </p>
              </div>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 mb-6 lg:grid-cols-2">
          {/* Profile Completeness */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Profile Strength</h2>
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-4 w-32 rounded-full bg-gray-100 animate-pulse" />
                <div className="h-2 w-full rounded-full bg-gray-100 animate-pulse" />
                <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Completion</span>
                  <span className="font-semibold text-gray-900">{profileCompletionPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-red-600 transition-all duration-300"
                    style={{ width: `${profileCompletionPercent}%` }}
                  />
                </div>
                {missingProfileFields.length > 0 ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                    <p className="text-xs font-semibold text-red-700">Missing details</p>
                    <p className="text-xs text-red-700/80">
                      {missingProfileFields.slice(0, 3).join(', ')}
                      {missingProfileFields.length > 3 ? '...' : ''}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                    <p className="text-xs font-semibold text-red-700">All set</p>
                    <p className="text-xs text-red-700/80">Your donor profile is complete.</p>
                  </div>
                )}
                {missingProfileFields.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/donor/onboarding')}
                    className="w-full py-2 px-4 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all duration-300"
                  >
                    Complete Profile
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Momentum */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Momentum</h2>
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Current Streak</p>
                    <p className="text-sm text-gray-600">Keep the rhythm going</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.streak || 0} days</p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-red-600">Next Milestone</p>
                  <p className="text-sm font-semibold text-gray-900">{nextMilestone.label}</p>
                  <p className="text-xs text-gray-600">
                    {nextMilestone.remaining === 0
                      ? 'You reached this milestone.'
                      : `${nextMilestone.remaining} more donation${nextMilestone.remaining === 1 ? '' : 's'} to hit ${nextMilestone.target}.`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Eligibility & Actions */}
        <div className="mb-10">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">Eligibility & Actions</p>
            <h2 className="text-xl font-bold text-gray-900">Your readiness and quick actions</h2>
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <Zap className="w-6 h-6 mr-2 text-red-600" />
                Quick Actions
              </h2>
              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`action-skeleton-${index}`}
                      className="p-5 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      <div className="h-8 w-8 rounded-full bg-gray-100 animate-pulse mx-auto mb-3" />
                      <div className="h-3 w-20 rounded-full bg-gray-100 animate-pulse mx-auto" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <button
                    onClick={handleEmergencyRequests}
                    className="p-5 bg-red-50 rounded-xl hover:bg-red-100 transition-all duration-300 hover:scale-[1.02] group"
                  >
                    <AlertCircle className="w-7 h-7 text-red-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-semibold text-gray-800">Emergency Requests</p>
                    {emergencyRequests.length > 0 && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-red-200 text-red-700 text-xs rounded-full font-bold">
                        {emergencyRequests.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleFindDonors}
                    className="p-5 bg-red-50 rounded-xl hover:bg-red-100 transition-all duration-300 hover:scale-[1.02] group"
                  >
                    <Users className="w-7 h-7 text-red-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-semibold text-gray-800">Find Donors</p>
                  </button>
                  <button
                    onClick={handleInviteFriends}
                    className="p-5 bg-red-50 rounded-xl hover:bg-red-100 transition-all duration-300 hover:scale-[1.02] group"
                  >
                    <Share2 className="w-7 h-7 text-red-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-semibold text-gray-800">Invite Friends</p>
                  </button>
                  <button
                    onClick={handleAvailableToday}
                    disabled={availableTodayLoading}
                    className={`p-5 rounded-xl transition-all duration-300 hover:scale-[1.02] group ${
                      availabilityActiveUntil ? 'bg-red-100' : 'bg-red-50 hover:bg-red-100'
                    } ${availableTodayLoading ? 'opacity-70' : ''}`}
                  >
                    <Clock className="w-7 h-7 text-red-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-semibold text-gray-800">
                      {availableTodayLoading ? 'Updating...' : availableTodayLabel}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-500">{availableTodayHint}</p>
                  </button>
                </div>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-3 items-start">
              <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
                {isLoading ? (
                  <div className="space-y-4">
                    <div className="h-4 w-32 rounded-full bg-gray-100 animate-pulse" />
                    <div className="h-6 w-64 rounded-full bg-gray-100 animate-pulse" />
                    <div className="h-4 w-72 rounded-full bg-gray-100 animate-pulse" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                      <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                      <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                      <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-3 rounded-2xl bg-red-600">
                          {eligibleToDonate ? (
                            <CheckCircle className="w-6 h-6 text-white" />
                          ) : (
                            <Clock className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-red-600">Eligibility</p>
                          <h3 className="text-lg font-bold text-gray-900">
                            {eligibleToDonate ? 'You\'re Eligible to Donate!' : 'Not Eligible to Donate'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {lastDonationDate
                              ? eligibleToDonate
                                ? 'You can donate now. Thank you for staying ready!'
                                : nextEligibleDate
                                  ? `Next eligible on ${formatDate(nextEligibleDate)}`
                                  : 'Record your last donation date to track eligibility.'
                              : 'Record your last donation date to track eligibility.'}
                          </p>
                          {!eligibleToDonate && (
                            <p className="text-xs text-gray-500 mt-1">Minimum recovery window is 90 days.</p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-red-600">Next Eligible In</p>
                        <p className="text-2xl font-bold text-red-700">
                          {eligibleToDonate ? 0 : daysUntilEligible}
                        </p>
                        <p className="text-[11px] text-red-600/80">
                          {eligibleToDonate ? 'days' : 'days remaining'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Last Donation Date</label>
                        <input
                          type="date"
                          value={lastDonationInput}
                          onChange={(event) => setLastDonationInput(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                        />
                      </div>
                      <div className="flex flex-col items-center gap-2 sm:items-end">
                        <button
                          type="button"
                          onClick={handleSaveLastDonation}
                          disabled={lastDonationSaving}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
                        >
                          {lastDonationSaving ? 'Saving...' : 'Save'}
                        </button>
                        {lastDonationSaved && (
                          <span className="text-[11px] font-semibold text-red-600">Saved</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Last Donation</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {normalizedLastDonation ? formatDate(normalizedLastDonation) : 'Not set'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Recovery Window</p>
                        <p className="text-sm font-semibold text-gray-800">90 days</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">Eligible On</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {nextEligibleDate ? formatDate(nextEligibleDate) : 'Now'}
                        </p>
                      </div>
                    </div>
                  </>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Eligibility Checklist</h2>
                  <p className="text-xs text-gray-500">Quick self-check before donating.</p>
                </div>
                <span className="text-xs font-semibold text-red-600">{checklistCompleted}/3 ready</span>
              </div>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => handleChecklistToggle('hydrated')}
                  disabled={checklistSaving}
                  className="w-full flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition-all duration-300 hover:bg-gray-100"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Hydrated</p>
                    <p className="text-xs text-gray-500">Had enough water in the last 24 hours.</p>
                  </div>
                  <CheckCircle className={`w-5 h-5 ${eligibilityChecklist.hydrated ? 'text-red-600' : 'text-gray-300'}`} />
                </button>
                <button
                  type="button"
                  onClick={() => handleChecklistToggle('weightOk')}
                  disabled={checklistSaving}
                  className="w-full flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition-all duration-300 hover:bg-gray-100"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Weight Check</p>
                    <p className="text-xs text-gray-500">Above 50 kg and feeling well.</p>
                  </div>
                  <CheckCircle className={`w-5 h-5 ${eligibilityChecklist.weightOk ? 'text-red-600' : 'text-gray-300'}`} />
                </button>
                <button
                  type="button"
                  onClick={() => handleChecklistToggle('hemoglobinOk')}
                  disabled={checklistSaving}
                  className="w-full flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition-all duration-300 hover:bg-gray-100"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Hemoglobin Ready</p>
                    <p className="text-xs text-gray-500">Hemoglobin above required level.</p>
                  </div>
                  <CheckCircle className={`w-5 h-5 ${eligibilityChecklist.hemoglobinOk ? 'text-red-600' : 'text-gray-300'}`} />
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-gray-500">
                <span>
                  {checklistUpdatedAt ? `Updated ${formatDateTime(checklistUpdatedAt)}` : 'Not updated yet'}
                </span>
                {checklistSaving && <span className="text-red-600">Saving...</span>}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Referral Impact</h2>
                  <p className="text-xs text-gray-500">Track donors who joined through you.</p>
                </div>
                <div className="p-2 rounded-lg bg-red-50">
                  <Users className="w-5 h-5 text-red-600" />
                </div>
              </div>
              {referralLoading ? (
                <div className="mt-4 space-y-3">
                  <div className="h-4 w-24 rounded-full bg-gray-100 animate-pulse" />
                  <div className="h-8 w-16 rounded-full bg-gray-100 animate-pulse" />
                  <div className="h-3 w-40 rounded-full bg-gray-100 animate-pulse" />
                  <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Referrals</p>
                      <p className="text-3xl font-bold text-gray-900">{referralCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Milestone</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {referralMilestone.next ? `${referralMilestone.next} donors` : referralMilestone.label}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-600">
                    {referralMilestone.next
                      ? `${referralMilestone.remaining} more donor${referralMilestone.remaining === 1 ? '' : 's'} to reach the next milestone.`
                      : 'You are a Legend Referrer!'}
                  </p>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="mt-4 w-full rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-all duration-300 hover:bg-red-50"
                  >
                    Copy Referral Link
                  </button>
                </>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* Urgent Nearby */}
        <div className="mb-10">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">Urgent Nearby</p>
            <h2 className="text-xl font-bold text-gray-900">Emergency requests</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <AlertCircle className="w-6 h-6 mr-2 text-red-500" />
                Nearby Emergency Requests
              </h2>
              <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-semibold">
                {emergencyRequests.length} Active
              </span>
            </div>
            <div className="space-y-4">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`request-skeleton-${index}`}
                    className="p-4 border-2 border-gray-100 rounded-xl bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-xl bg-gray-100 animate-pulse w-12 h-12" />
                        <div className="space-y-2">
                          <div className="h-4 w-48 rounded-full bg-gray-100 animate-pulse" />
                          <div className="h-3 w-40 rounded-full bg-gray-100 animate-pulse" />
                          <div className="h-3 w-24 rounded-full bg-gray-100 animate-pulse" />
                        </div>
                      </div>
                      <div className="h-8 w-20 rounded-xl bg-gray-100 animate-pulse" />
                    </div>
                  </div>
                ))
              ) : emergencyRequests.length > 0 ? (
                emergencyRequests.map((request) => (
                  <div
                    key={request.id}
                    className={`p-4 border-2 rounded-xl transition-all duration-300 cursor-pointer ${
                      request.urgency === 'critical'
                        ? 'border-red-300 bg-red-50 hover:bg-red-100'
                        : request.urgency === 'high'
                        ? 'border-red-200 bg-red-50/70 hover:bg-red-100/80'
                        : 'border-red-100 bg-white hover:bg-red-50'
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
                            Urgent: {request.bloodType} - {request.units} Units needed
                          </h3>
                          <p className="text-sm text-gray-600 flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {request.hospitalName}, {request.city}
                            {request.distance && ` - ${request.distance.toFixed(1)} km away`}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Posted {formatTime(request.requestedAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRespondToRequest(request.id)}
                        disabled={responding}
                        className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {responding ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <span>Respond</span>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-gray-600">No emergency requests matching your blood type at the moment.</p>
                </div>
              )}
            </div>
            {emergencyRequests.length > 0 && (
              <button
                onClick={handleViewAllRequests}
                className="w-full mt-4 py-3 text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all duration-300"
              >
                View All Requests →
              </button>
            )}
          </div>
        </div>

        {/* Your Journey */}
        <div className="mb-10">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">Your Journey</p>
            <h2 className="text-xl font-bold text-gray-900">Donations and achievements</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <Activity className="w-6 h-6 mr-2 text-red-600" />
                Donation History
              </h2>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`donation-skeleton-${index}`}
                      className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 rounded-xl bg-gray-100 animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-40 rounded-full bg-gray-100 animate-pulse" />
                          <div className="h-3 w-32 rounded-full bg-gray-100 animate-pulse" />
                          <div className="h-3 w-24 rounded-full bg-gray-100 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : donationHistory.length > 0 ? (
                <div className="space-y-4">
                  {donationHistory.map((donation) => {
                    const isSelfReported = donation.source === 'manual';
                    const feedbackEntry = donationFeedbackMap[donation.id];
                    const isFeedbackOpen = feedbackOpenId === donation.id;
                    const displayCertificateUrl = donation.certificateUrl || feedbackEntry?.certificateUrl;
                    const hasFeedback = Boolean(
                      feedbackEntry?.rating || feedbackEntry?.notes || feedbackEntry?.certificateUrl
                    );
                    return (
                      <div
                        key={donation.id}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-4 transition-all duration-300 hover:bg-gray-100"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start space-x-4">
                            <div className="p-3 bg-red-100 rounded-xl">
                              <Droplet className="w-6 h-6 text-red-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-gray-800">
                                  {donation.bloodBank || 'Donation'}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-white border border-red-200 text-red-600">
                                  {isSelfReported ? 'Self Reported' : 'Verified'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{donation.location || 'Location not set'}</p>
                              <p className="text-xs text-gray-500">
                                {formatDate(donation.date)} • {donation.units} unit{donation.units === 1 ? '' : 's'}
                              </p>
                              {donation.notes && (
                                <p className="text-xs text-gray-500 mt-1">{donation.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartDonationEdit(donation)}
                              className="p-2 hover:bg-white rounded-lg transition-all duration-300"
                              title="Edit donation"
                            >
                              <Edit3 className="w-4 h-4 text-gray-600" />
                            </button>
                            {displayCertificateUrl && (
                              <button
                                onClick={() => handleDownloadCertificate(displayCertificateUrl || '')}
                                className="p-2 hover:bg-white rounded-lg transition-all duration-300"
                                title="Download certificate"
                              >
                                <Download className="w-5 h-5 text-gray-600" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenFeedback(donation.id)}
                              className="p-2 hover:bg-white rounded-lg transition-all duration-300"
                              title={hasFeedback ? 'Edit feedback' : 'Add feedback'}
                            >
                              <MessageCircle className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                        {editingDonationId === donation.id && (
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-2">
                              <label className="text-xs font-semibold text-gray-600">Location</label>
                              <input
                                type="text"
                                value={editingDonationData.location}
                                onChange={(event) => setEditingDonationData((prev) => ({
                                  ...prev,
                                  location: event.target.value,
                                }))}
                                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600">Units</label>
                              <input
                                type="number"
                                min="1"
                                value={editingDonationData.units}
                                onChange={(event) => setEditingDonationData((prev) => ({
                                  ...prev,
                                  units: Number(event.target.value),
                                }))}
                                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className="text-xs font-semibold text-gray-600">Notes</label>
                              <textarea
                                value={editingDonationData.notes}
                                onChange={(event) => setEditingDonationData((prev) => ({
                                  ...prev,
                                  notes: event.target.value,
                                }))}
                                rows={2}
                                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                              />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 sm:col-span-3">
                              <button
                                type="button"
                                onClick={handleDonationEditSave}
                                disabled={donationEditSaving}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
                              >
                                <Save className="w-4 h-4" />
                                {donationEditSaving ? 'Saving...' : 'Save Changes'}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelDonationEdit}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all duration-300"
                              >
                                <XCircle className="w-4 h-4" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {!isFeedbackOpen && hasFeedback && (
                          <div className="mt-4 rounded-xl border border-red-100 bg-white/80 px-4 py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-gray-500">Feedback</p>
                                <div className="mt-1 flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((value) => (
                                    <Star
                                      key={`feedback-star-${donation.id}-${value}`}
                                      className={`h-4 w-4 ${
                                        (feedbackEntry?.rating || 0) >= value
                                          ? 'text-yellow-400 fill-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                                {feedbackEntry?.notes && (
                                  <p className="text-xs text-gray-600 mt-1">{feedbackEntry.notes}</p>
                                )}
                              </div>
                              {displayCertificateUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleDownloadCertificate(displayCertificateUrl || '')}
                                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-all duration-300"
                                >
                                  <Download className="h-3 w-3" />
                                  Certificate
                                </button>
                              )}
                            </div>
                            {feedbackEntry?.updatedAt && (
                              <p className="mt-2 text-[11px] text-gray-500">
                                Updated {formatDateTime(feedbackEntry.updatedAt)}
                              </p>
                            )}
                          </div>
                        )}
                        {isFeedbackOpen && (
                          <div className="mt-4 rounded-xl border border-red-100 bg-white px-4 py-4">
                            <p className="text-[11px] uppercase tracking-wide text-red-600">Post-donation feedback</p>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-800">Rating</span>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <button
                                    key={`rating-${donation.id}-${value}`}
                                    type="button"
                                    onClick={() => setFeedbackForm((prev) => ({ ...prev, rating: value }))}
                                    className="rounded-full p-1"
                                  >
                                    <Star
                                      className={`h-5 w-5 ${
                                        feedbackForm.rating >= value
                                          ? 'text-yellow-400 fill-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="mt-3">
                              <label className="text-xs font-semibold text-gray-600">Notes</label>
                              <textarea
                                value={feedbackForm.notes}
                                onChange={(event) => setFeedbackForm((prev) => ({
                                  ...prev,
                                  notes: event.target.value,
                                }))}
                                rows={3}
                                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                                placeholder="Share your experience"
                              />
                            </div>
                            <div className="mt-3">
                              <label className="text-xs font-semibold text-gray-600">Certificate URL</label>
                              <input
                                type="url"
                                value={feedbackForm.certificateUrl}
                                onChange={(event) => setFeedbackForm((prev) => ({
                                  ...prev,
                                  certificateUrl: event.target.value,
                                }))}
                                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                                placeholder="https://"
                              />
                            </div>
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                              <button
                                type="button"
                                onClick={() => handleSaveFeedback(donation.id)}
                                disabled={feedbackSaving}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
                              >
                                <MessageCircle className="h-4 w-4" />
                                {feedbackSaving ? 'Saving...' : 'Save Feedback'}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelFeedback}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all duration-300"
                              >
                                <XCircle className="h-4 w-4" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <Activity className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Donations Yet</h3>
                  <p className="text-gray-600 mb-4">Start your journey as a lifesaver today!</p>
                  <button
                    onClick={handleBookDonation}
                    className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-300"
                  >
                    Book Your First Donation
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <Trophy className="w-5 h-5 mr-2 text-red-600" />
                Achievements
              </h2>
              {isLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={`badge-skeleton-${index}`} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {badges.map((badge) => (
                      <div
                        key={badge.id}
                        className={`p-4 rounded-xl text-center transition-all duration-300 ${
                          badge.earned
                            ? 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 hover:scale-110'
                            : 'bg-gray-50 opacity-50'
                        }`}
                        title={badge.description}
                      >
                        <div className="text-3xl mb-2">{badge.icon}</div>
                        <p className="text-xs font-semibold text-gray-700">{badge.name}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleViewAllBadges}
                    className="w-full mt-4 py-2 text-sm text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all duration-300"
                  >
                    View All Badges →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Community & Account */}
        <div className="mb-10">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">Community & Account</p>
            <h2 className="text-xl font-bold text-gray-900">Stay connected and manage your profile</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <MapPinned className="w-5 h-5 mr-2 text-red-600" />
                  Nearby Blood Camps
                </h2>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={`camp-skeleton-${index}`} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {bloodCamps.length > 0 ? (
                        bloodCamps.map((camp) => (
                          <div key={camp.id} className="p-3 bg-red-50 rounded-xl border-2 border-red-200 hover:bg-red-100 transition-all duration-300 cursor-pointer">
                            <h3 className="font-semibold text-gray-800 text-sm mb-1">{camp.name}</h3>
                            <p className="text-xs text-gray-600 flex items-center mb-1">
                              <MapPin className="w-3 h-3 mr-1" />
                              {camp.location}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(camp.date)}, {camp.startTime} - {camp.endTime}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No upcoming blood camps in your area</p>
                      )}
                    </div>
                    {bloodCamps.length > 0 && (
                      <button
                        onClick={handleViewAllCamps}
                        className="w-full mt-4 py-2 text-sm text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all duration-300"
                      >
                        View All Camps →
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-red-100">
                <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                  <BookOpen className="w-5 h-5 mr-2 text-red-600" />
                  Today's Health Tip
                </h2>
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="h-4 w-full rounded-full bg-gray-100 animate-pulse" />
                    <div className="h-4 w-3/4 rounded-full bg-gray-100 animate-pulse" />
                    <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-700 mb-4">
                      💧 Drink plenty of water before and after donation to help your body replenish fluids quickly. Aim for 8-10 glasses of water daily!
                    </p>
                    <button
                      onClick={handleLearnMore}
                      className="w-full py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-all duration-300"
                    >
                      Learn More
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-white via-red-50 to-white p-6 shadow-xl transition-transform duration-300 hover:-translate-y-1 animate-fadeIn">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-100/70 rounded-full blur-2xl"></div>
                <div className="absolute -bottom-24 -left-24 w-44 h-44 bg-red-100/60 rounded-full blur-2xl"></div>
                {isLoading ? (
                  <div className="relative space-y-5">
                    <div className="h-3 w-40 rounded-full bg-gray-100 animate-pulse" />
                    <div className="h-6 w-48 rounded-full bg-gray-100 animate-pulse" />
                    <div className="h-4 w-32 rounded-full bg-gray-100 animate-pulse" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                      <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                      <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                      <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                    </div>
                    <div className="h-6 w-28 rounded-full bg-gray-100 animate-pulse" />
                  </div>
                ) : (
                  <div className="relative space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.25em] text-red-600">BloodHub Donor Card</p>
                        <h2 className="mt-2 text-2xl font-bold text-gray-900">
                          {user?.displayName || 'Donor'}
                        </h2>
                        <p className="text-sm text-gray-500">{user?.city || 'Location not set'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          availabilityEnabled
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {availabilityEnabled ? 'Available' : 'On Break'}
                        </span>
                        <span className="rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                          Verified Donor
                        </span>
                        <div className="rounded-2xl bg-red-600 px-4 py-3 text-white text-xl font-bold shadow-lg">
                          {user?.bloodType || '—'}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {shareOptions.showBhId && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">BH ID</p>
                          <p className="font-semibold text-gray-900">{user?.bhId || 'Pending'}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Last Donation</p>
                        <p className="font-semibold text-gray-900">
                          {normalizedLastDonation ? formatDate(normalizedLastDonation) : 'Not recorded'}
                        </p>
                      </div>
                      {shareOptions.showPhone && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">Phone</p>
                          <p className="font-semibold text-gray-900 text-xs break-all">
                            {user?.phoneNumber || 'Not set'}
                          </p>
                        </div>
                      )}
                      {shareOptions.showEmail && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">Email</p>
                          <p className="font-semibold text-gray-900 text-xs break-all">
                            {user?.email || 'Not set'}
                          </p>
                        </div>
                      )}
                      {shareOptions.showQr && qrCodeDataUrl && (
                        <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-red-100 bg-white/80 px-4 py-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-gray-500">Share QR</p>
                            <p className="text-xs text-gray-600">Scan to open your donor profile link.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setQrPreviewOpen(true)}
                            className="rounded-lg border border-red-100 bg-white p-1 transition-transform duration-300 hover:scale-105"
                            aria-label="Open QR preview"
                          >
                            <img
                              src={qrCodeDataUrl}
                              alt="BH ID QR"
                              className="h-16 w-16 shrink-0"
                            />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-400">
                      <span>BloodHub India</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShareOptionsOpen(true)}
                          className="flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 transition-all duration-300 hover:bg-red-50"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          Customize
                        </button>
                        <button
                          type="button"
                          onClick={handleShareDonorCard}
                          disabled={shareCardLoading}
                          className="flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 transition-all duration-300 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Share2 className="w-3 h-3" />
                          {shareCardLoading ? 'Preparing' : 'Share Card'}
                        </button>
                      </div>
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
            </div>
          </div>
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
                {badges.map((badge) => (
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
