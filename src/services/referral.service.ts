import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import {
  clearReferralTracking,
  getReferralReferrerUid,
  getReferralTracking,
  setReferralReferrerUid,
  setReferralTracking,
} from '../utils/referralTracking';
import { REFERRAL_RULES, computeReferralStatus, normalizeReferralDate } from '../utils/referralRules';

type ReferralApplyResult = {
  referrerUid: string;
  referrerBhId?: string;
};

type ResolveResult = {
  uid: string;
  bhId?: string;
};

type ReferralStatusUpdate = {
  status: 'registered' | 'onboarded' | 'eligible' | 'deleted';
  statusLabel: string;
  isEligible: boolean;
};

const buildReferralNotificationId = (
  referrerUid: string,
  referredUid: string,
  status: ReferralStatusUpdate['status']
) => `referral_${referrerUid}_${referredUid}_${status}`;

const resolveReferrerByBhId = async (bhId?: string | null): Promise<ResolveResult | null> => {
  if (!bhId) return null;
  const referrerSnapshot = await getDocs(query(
    collection(db, 'users'),
    where('bhId', '==', bhId),
    limit(1)
  ));
  if (referrerSnapshot.empty) {
    return null;
  }
  const referrerDoc = referrerSnapshot.docs[0];
  return {
    uid: referrerDoc.id,
    bhId: referrerDoc.data()?.bhId || bhId,
  };
};

export const resolveReferralContext = async (newUserUid: string): Promise<ReferralApplyResult | null> => {
  let referralBhId = getReferralTracking();
  let referralUid = getReferralReferrerUid();

  if (!referralBhId && !referralUid && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const bhIdParam = params.get('BHID') || params.get('bhid');
    const refParam = params.get('ref') || params.get('referrer');
    if (bhIdParam) {
      const trimmed = bhIdParam.trim();
      setReferralTracking(trimmed);
      referralBhId = trimmed;
    }
    if (refParam) {
      const trimmed = refParam.trim();
      setReferralReferrerUid(trimmed);
      referralUid = trimmed;
    }
  }

  if (!referralBhId && !referralUid) return null;

  let referrerUid: string | null = referralUid;
  let referrerBhId: string | undefined = referralBhId || undefined;

  if (referrerUid) {
    try {
      const referrerDoc = await getDoc(doc(db, 'users', referrerUid));
      if (referrerDoc.exists()) {
        const referrerData = referrerDoc.data();
        referrerBhId = referrerData?.bhId || referrerBhId;
      } else if (referrerBhId) {
        const bhIdFallback = await resolveReferrerByBhId(referrerBhId);
        if (bhIdFallback) {
          referrerUid = bhIdFallback.uid;
          referrerBhId = bhIdFallback.bhId;
        }
      }
    } catch (error) {
      console.warn('Failed to resolve referrer by UID, proceeding with UID fallback:', error);
    }
  } else if (referralBhId) {
    const bhIdLookup = await resolveReferrerByBhId(referralBhId);
    if (!bhIdLookup) {
      clearReferralTracking();
      return null;
    }
    referrerUid = bhIdLookup.uid;
    referrerBhId = bhIdLookup.bhId;
  }

  if (!referrerUid) {
    clearReferralTracking();
    return null;
  }

  if (referrerUid === newUserUid) {
    clearReferralTracking();
    return null;
  }

  return { referrerUid, referrerBhId };
};

export const applyReferralTrackingForUser = async (newUserUid: string): Promise<ReferralApplyResult | null> => {
  try {
    const resolved = await resolveReferralContext(newUserUid);
    if (!resolved) return null;
    const { referrerUid, referrerBhId } = resolved;

    const referralDocId = `${referrerUid}_${newUserUid}`;
    const referralRef = doc(db, 'ReferralTracking', referralDocId);
    const referralExisting = await getDoc(referralRef);
    const userRef = doc(db, 'users', newUserUid);

    if (referralExisting.exists()) {
      await setDoc(
        userRef,
        {
          referredByUid: referrerUid,
          referredByBhId: referrerBhId,
          referralCapturedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await sendReferralNotification(referrerUid, 'registered', newUserUid, undefined);
      clearReferralTracking();
      return { referrerUid, referrerBhId };
    }

    const [referralResult, userResult] = await Promise.allSettled([
      setDoc(referralRef, {
        referrerUid,
        referredUid: newUserUid,
        referrerBhId: referrerBhId,
        referredAt: serverTimestamp(),
        status: 'registered',
        createdAt: serverTimestamp(),
      }),
      setDoc(
        userRef,
        {
          referredByUid: referrerUid,
          referredByBhId: referrerBhId,
          referralCapturedAt: serverTimestamp(),
        },
        { merge: true }
      ),
    ]);

    if (referralResult.status === 'rejected') {
      console.warn('Failed to write referral tracking doc:', referralResult.reason);
    }
    if (userResult.status === 'rejected') {
      console.warn('Failed to update referred-by fields:', userResult.reason);
    }

    if (referralResult.status === 'fulfilled' || userResult.status === 'fulfilled') {
      await sendReferralNotification(referrerUid, 'registered', newUserUid, undefined);
      clearReferralTracking();
      return { referrerUid, referrerBhId };
    }
  } catch (error) {
    console.warn('Failed to apply referral tracking:', error);
  }

  return null;
};

const buildNotificationContent = (
  status: ReferralStatusUpdate['status'],
  referredUser?: any
) => {
  const name = referredUser?.displayName || referredUser?.name || 'A donor';
  if (status === 'registered') {
    return {
      title: 'New referral registered',
      message: `${name} just signed up using your referral link.`,
    };
  }
  if (status === 'onboarded') {
    return {
      title: 'Referral completed onboarding',
      message: `${name} finished onboarding. You're one step closer to your milestone.`,
    };
  }
  if (status === 'eligible') {
    return {
      title: 'Referral is now eligible',
      message: `${name} has crossed the eligibility window and now counts towards your milestones.`,
    };
  }
  return {
    title: 'Referral update',
    message: `${name} has an update on their referral status.`,
  };
};

const sendReferralNotification = async (
  referrerUid: string,
  status: ReferralStatusUpdate['status'],
  referredUid: string,
  referredUser?: any,
  createdByUid?: string
): Promise<boolean> => {
  try {
    const notificationId = buildReferralNotificationId(referrerUid, referredUid, status);
    const notificationRef = doc(db, 'notifications', notificationId);
    const existing = await getDoc(notificationRef);
    if (existing.exists()) {
      return true;
    }
    const content = buildNotificationContent(status, referredUser);
    const referralId = `${referrerUid}_${referredUid}`;
    await setDoc(notificationRef, {
      userId: referrerUid,
      userRole: 'donor',
      type: 'referral',
      title: content.title,
      message: content.message,
      read: false,
      priority: 'medium',
      relatedId: referredUid,
      relatedType: 'referral',
      referralId,
      referrerUid,
      referredUid,
      createdBy: createdByUid || referredUid,
      actionUrl: '/donor/dashboard/referrals',
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.warn('Failed to create referral notification:', error);
  }
  return false;
};

export const ensureReferralTrackingForExistingReferral = async (user: any): Promise<void> => {
  const referrerUid = user?.referredByUid;
  if (!referrerUid || !user?.uid) return;

  const referralDocId = `${referrerUid}_${user.uid}`;
  const referralRef = doc(db, 'ReferralTracking', referralDocId);
  const referralSnap = await getDoc(referralRef);

  if (!referralSnap.exists()) {
    await setDoc(referralRef, {
      referrerUid,
      referredUid: user.uid,
      referrerBhId: user.referredByBhId,
      referredAt: serverTimestamp(),
      status: 'registered',
      createdAt: serverTimestamp(),
    });
    await sendReferralNotification(referrerUid, 'registered', user.uid, user, user.uid);
  }

  const referralData = referralSnap.exists() ? referralSnap.data() : null;
  const referredAt = normalizeReferralDate(referralData?.referredAt) || normalizeReferralDate(user?.createdAt);
  const currentStatus = (referralData?.status || 'registered') as ReferralStatusUpdate['status'];
  const computed = computeReferralStatus({
    referredAt,
    referredUser: user,
    entryStatus: currentStatus,
    rules: REFERRAL_RULES,
  });

  if (computed.status !== currentStatus) {
    await setDoc(
      referralRef,
      {
        status: computed.status,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    if (computed.status === 'onboarded' || computed.status === 'eligible') {
      await sendReferralNotification(referrerUid, computed.status, user.uid, user, user.uid);
    }
  }
};

export const ensureReferralNotificationsForReferrer = async (
  referrerUid: string,
  referrals: Array<{ referredUid: string; referralStatus?: string; user?: any }>
): Promise<void> => {
  if (!referrerUid || referrals.length === 0) return;
  const notifyStatuses: ReferralStatusUpdate['status'][] = ['onboarded', 'eligible'];
  await Promise.all(referrals.map(async (entry) => {
    const status = (entry.referralStatus || 'registered') as ReferralStatusUpdate['status'];
    if (!notifyStatuses.includes(status)) return;
    await sendReferralNotification(referrerUid, status, entry.referredUid, entry.user, referrerUid);
  }));
};
