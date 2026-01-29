import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import {
  clearReferralTracking,
  getReferralReferrerUid,
  getReferralTracking,
  setReferralReferrerUid,
  setReferralTracking,
} from '../utils/referralTracking';

type ReferralApplyResult = {
  referrerUid: string;
  referrerBhId?: string;
};

type ResolveResult = {
  uid: string;
  bhId?: string;
};

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

export const applyReferralTrackingForUser = async (newUserUid: string): Promise<ReferralApplyResult | null> => {
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

  try {
    let referrerUid: string | null = referralUid;
    let referrerBhId: string | undefined = referralBhId || undefined;

    if (referrerUid) {
      const referrerDoc = await getDoc(doc(db, 'users', referrerUid));
      if (referrerDoc.exists()) {
        const referrerData = referrerDoc.data();
        referrerBhId = referrerData?.bhId || referrerBhId;
      } else {
        const bhIdFallback = await resolveReferrerByBhId(referrerBhId || referrerUid);
        if (bhIdFallback) {
          referrerUid = bhIdFallback.uid;
          referrerBhId = bhIdFallback.bhId;
        } else {
          clearReferralTracking();
          return null;
        }
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
        },
        { merge: true }
      );
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
      clearReferralTracking();
      return { referrerUid, referrerBhId };
    }
  } catch (error) {
    console.warn('Failed to apply referral tracking:', error);
  }

  return null;
};
