import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, documentId } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { REFERRAL_RULES, computeReferralStatus } from '../utils/referralRules';
import { ensureReferralNotificationsForReferrer } from '../services/referral.service';

type ReferralEntry = {
  id: string;
  referredUid: string;
  referredAt?: Date | null;
  status?: string;
  referrerBhId?: string;
  referredRole?: string;
};

type ReferralMilestone = {
  next: number | null;
  remaining: number;
  label: string;
};

type UseReferralsResult = {
  referralLoading: boolean;
  referralUsersLoading: boolean;
  referralCount: number;
  referralEntries: ReferralEntry[];
  referralDetails: any[];
  eligibleReferralCount: number;
  referralSummary: Record<string, number>;
  referralMilestone: ReferralMilestone;
  referralQrDataUrl: string | null;
  referralQrLoading: boolean;
  loadReferralQr: () => Promise<void>;
  copyInviteLink: () => Promise<void>;
  shareInviteLink: () => Promise<void>;
  openWhatsAppInvite: () => void;
};

const getReferralMilestone = (count: number): ReferralMilestone => {
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

export const useReferrals = (user: any): UseReferralsResult => {
  const [referralQrDataUrl, setReferralQrDataUrl] = useState<string | null>(null);
  const [referralQrLoading, setReferralQrLoading] = useState(false);
  const [referralCount, setReferralCount] = useState(0);
  const [referralLoading, setReferralLoading] = useState(true);
  const [referralEntries, setReferralEntries] = useState<ReferralEntry[]>([]);
  const [referralUsers, setReferralUsers] = useState<Record<string, any>>({});
  const [referralUsersLoading, setReferralUsersLoading] = useState(false);
  const [fallbackReferralLoading, setFallbackReferralLoading] = useState(false);
  const fallbackReferralAppliedRef = useRef(false);
  const referralNotificationSyncRef = useRef<Set<string>>(new Set());
  const referralStatusSyncRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fallbackReferralAppliedRef.current = false;
    referralNotificationSyncRef.current = new Set();
    referralStatusSyncRef.current = new Set();
    setReferralEntries([]);
    setReferralUsers({});
    setReferralCount(0);
    setReferralQrDataUrl(null);
  }, [user?.uid]);

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

  const copyInviteLink = async () => {
    const inviteLink = buildInviteLink();
    if (!inviteLink) {
      toast.error('Unable to generate referral link.');
      return;
    }
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
    if (!inviteLink) {
      toast.error('Unable to generate referral link.');
      return;
    }
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
    if (!inviteLink) {
      toast.error('Unable to generate referral link.');
      return;
    }
    const text = `Join BloodHub and save lives. Use my referral link to get started: ${inviteLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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
    if (!user?.uid) {
      setReferralEntries([]);
      setReferralUsers({});
      setReferralCount(0);
      setReferralLoading(false);
      setReferralUsersLoading(false);
      return;
    }
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
          referredRole: data?.referredRole,
        } as ReferralEntry;
      }).filter(entry => Boolean(entry.referredUid));
      nextEntries.sort((a, b) => (b.referredAt?.getTime() || 0) - (a.referredAt?.getTime() || 0));
      setReferralEntries(nextEntries);
      setReferralCount(nextEntries.length);
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
            referredRole: data?.role,
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
  }, [user?.uid, referralLoading, referralEntries.length, user?.bhId]);

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

  const referralDetails = useMemo(() => referralEntries.map((entry) => {
    const referredUser = referralUsers[entry.referredUid];
    const resolvedRole = entry.referredRole || referredUser?.role;
    const computed = computeReferralStatus({
      referredAt: entry.referredAt,
      referredUser,
      entryStatus: entry.status,
      rules: REFERRAL_RULES,
    });
    return {
      ...entry,
      user: referredUser,
      referredRole: resolvedRole,
      referralAgeDays: computed.ageDays,
      remainingDays: computed.remainingDays,
      isEligible: computed.isEligible,
      isDeleted: computed.isDeleted,
      statusLabel: computed.statusLabel,
      referralStatus: computed.status,
      sortDate: computed.baseDate,
    };
  }), [referralEntries, referralUsers]);

  const eligibleReferralCount = useMemo(() => referralDetails.filter(entry => entry.isEligible).length, [referralDetails]);
  const referralSummary = useMemo(() => {
    const summary = referralDetails.reduce((acc: Record<string, number>, entry: any) => {
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
    summary.notEligible = Math.max(0, summary.total - summary.eligible - summary.deleted);
    return summary;
  }, [referralDetails]);

  const referralMilestone = useMemo(() => getReferralMilestone(eligibleReferralCount), [eligibleReferralCount]);
  const referralUsersLoadingCombined = referralUsersLoading || fallbackReferralLoading;

  useEffect(() => {
    if (!user?.uid) return;
    if (referralLoading || referralUsersLoadingCombined) return;
    if (referralDetails.length === 0) return;

    const candidates = referralDetails.filter(entry =>
      (entry.referralStatus === 'onboarded' || entry.referralStatus === 'eligible')
      && !String(entry.id || '').startsWith('fallback_')
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

  useEffect(() => {
    if (!user?.uid) return;
    if (referralLoading || referralUsersLoadingCombined) return;
    if (referralDetails.length === 0) return;

    const pending = referralDetails.filter((entry) => {
      if (String(entry.id || '').startsWith('fallback_')) return false;
      if (!entry.referredUid) return false;
      if (!entry.user) return false;
      if (!entry.referralStatus) return false;
      if (entry.referralStatus === entry.status) return false;
      const key = `${entry.id}_${entry.referralStatus}`;
      return !referralStatusSyncRef.current.has(key);
    });

    if (pending.length === 0) return;

    let isActive = true;
    (async () => {
      await Promise.allSettled(pending.map((entry) => {
        const referralRef = doc(db, 'ReferralTracking', entry.id);
        return updateDoc(referralRef, {
          status: entry.referralStatus,
          updatedAt: serverTimestamp(),
        });
      }));
      if (!isActive) return;
      pending.forEach((entry) => {
        const key = `${entry.id}_${entry.referralStatus}`;
        referralStatusSyncRef.current.add(key);
      });
    })();

    return () => {
      isActive = false;
    };
  }, [user?.uid, referralDetails, referralLoading, referralUsersLoadingCombined]);

  return {
    referralLoading,
    referralUsersLoading: referralUsersLoadingCombined,
    referralCount,
    referralEntries,
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
  };
};
