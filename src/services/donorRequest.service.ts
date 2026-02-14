import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

export type DonationComponent = 'whole' | 'plasma' | 'platelets';

export type PendingDonorRequest = {
  targetDonorId: string;
  targetDonorBhId?: string;
  targetDonorName: string;
  targetDonorBloodType: string;
  targetLocation: string;
  donationType: DonationComponent;
  createdAt: number;
  returnTo?: string;
};

export type PendingDonorRequestTarget = {
  id: string;
  bhId?: string;
  name: string;
  bloodType: string;
  location: string;
};

export type PendingDonorRequestBatch = {
  targets: PendingDonorRequestTarget[];
  donationType: DonationComponent;
  message?: string;
  createdAt: number;
  returnTo?: string;
};

export type PendingDonorRequestPayload = PendingDonorRequest | PendingDonorRequestBatch;

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const SESSION_KEY_PREFIX = 'pendingDonorRequest:';
export const MAX_DONOR_REQUEST_BATCH_TARGETS = 200;
export const MAX_DONOR_REQUEST_MESSAGE_LENGTH = 280;

export type RequesterProfile = {
  uid: string;
  bhId?: string;
  displayName?: string | null;
  phoneNumber?: string | null;
  phoneNumberNormalized?: string | null;
  bloodType?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export const encodePendingDonorRequest = (payload: PendingDonorRequestPayload) => {
  const safePayload = {
    ...payload,
    createdAt: payload.createdAt || Date.now(),
  };
  const json = JSON.stringify(safePayload);
  return btoa(unescape(encodeURIComponent(json)));
};

export const decodePendingDonorRequest = (encoded: string): PendingDonorRequestPayload | null => {
  if (!encoded) return null;
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as PendingDonorRequestPayload;
    if (!parsed?.createdAt) return null;
    if (Array.isArray((parsed as PendingDonorRequestBatch).targets)) {
      const batch = parsed as PendingDonorRequestBatch;
      if (batch.targets.length === 0) return null;
      return {
        ...batch,
        donationType: (batch.donationType || 'whole') as DonationComponent,
      };
    }
    if ((parsed as PendingDonorRequest).targetDonorId) {
      return {
        ...(parsed as PendingDonorRequest),
        donationType: ((parsed as PendingDonorRequest).donationType || 'whole') as DonationComponent,
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const savePendingDonorRequestToSession = (payload: PendingDonorRequestPayload): string | null => {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const key = `pdr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const safePayload = {
      ...payload,
      createdAt: payload.createdAt || Date.now(),
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(`${SESSION_KEY_PREFIX}${key}`, JSON.stringify(safePayload));
    return key;
  } catch {
    return null;
  }
};

export const loadPendingDonorRequestFromSession = (key: string): PendingDonorRequestPayload | null => {
  if (typeof window === 'undefined' || !window.sessionStorage || !key) return null;
  try {
    const raw = window.sessionStorage.getItem(`${SESSION_KEY_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingDonorRequestPayload & { savedAt?: number };
    const createdAt = (parsed as PendingDonorRequestPayload).createdAt;
    if (!createdAt || Date.now() - createdAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(`${SESSION_KEY_PREFIX}${key}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearPendingDonorRequestFromSession = (key: string) => {
  if (typeof window === 'undefined' || !window.sessionStorage || !key) return;
  try {
    window.sessionStorage.removeItem(`${SESSION_KEY_PREFIX}${key}`);
  } catch {
    // ignore
  }
};

export const savePendingDonorRequestDoc = async (uid: string, payload: PendingDonorRequestPayload) => {
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + MAX_AGE_MS));
  const isBatch = Array.isArray((payload as PendingDonorRequestBatch).targets);
  await setDoc(
    doc(db, 'pendingDonorRequests', uid),
    {
      ...payload,
      mode: isBatch ? 'batch' : 'single',
      createdAt: serverTimestamp(),
      expiresAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const loadPendingDonorRequestDoc = async (uid: string): Promise<PendingDonorRequestPayload | null> => {
  const snapshot = await getDoc(doc(db, 'pendingDonorRequests', uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as any;
  const createdAt = data?.createdAt?.toDate ? data.createdAt.toDate() : null;
  const expiresAt = data?.expiresAt?.toDate ? data.expiresAt.toDate() : null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    await deleteDoc(doc(db, 'pendingDonorRequests', uid));
    return null;
  }
  if (Array.isArray(data.targets)) {
    return {
      targets: data.targets || [],
      donationType: (data.donationType || 'whole') as DonationComponent,
      message: data.message,
      createdAt: createdAt ? createdAt.getTime() : Date.now(),
      returnTo: data.returnTo,
    } as PendingDonorRequestBatch;
  }
  return {
    targetDonorId: data.targetDonorId,
    targetDonorBhId: data.targetDonorBhId,
    targetDonorName: data.targetDonorName,
    targetDonorBloodType: data.targetDonorBloodType,
    targetLocation: data.targetLocation,
    donationType: (data.donationType || 'whole') as DonationComponent,
    createdAt: createdAt ? createdAt.getTime() : Date.now(),
    returnTo: data.returnTo,
  };
};

export const clearPendingDonorRequestDoc = async (uid: string) => {
  await deleteDoc(doc(db, 'pendingDonorRequests', uid));
};

export const submitDonorRequest = async (requester: RequesterProfile, payload: PendingDonorRequest) => {
  if (requester.uid === payload.targetDonorId) {
    throw new Error('self_request');
  }
  return await addDoc(collection(db, 'donorRequests'), {
    requesterUid: requester.uid,
    requesterBhId: requester.bhId || '',
    requesterName: requester.displayName || 'Anonymous',
    requesterPhone: requester.phoneNumber || requester.phoneNumberNormalized || '',
    requesterBloodType: requester.bloodType || '',
    targetDonorUid: payload.targetDonorId,
    targetDonorName: payload.targetDonorName,
    targetDonorBhId: payload.targetDonorBhId || '',
    targetDonorBloodType: payload.targetDonorBloodType,
    donationType: payload.donationType,
    status: 'pending',
    requestedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    requesterLocation: {
      city: requester.city || '',
      latitude: requester.latitude ?? null,
      longitude: requester.longitude ?? null,
    },
    targetLocation: {
      city: payload.targetLocation,
    },
  });
};

export const submitDonorRequestBatch = async (
  requester: RequesterProfile,
  payload: PendingDonorRequestBatch
) => {
  if (!payload.targets?.length) {
    throw new Error('no_targets');
  }
  if (payload.targets.length > MAX_DONOR_REQUEST_BATCH_TARGETS) {
    throw new Error('too_many_targets');
  }

  const batchRef = doc(collection(db, 'donorRequestBatches'));
  const batchId = batchRef.id;

  const recentQuery = query(
    collection(db, 'donorRequests'),
    where('requesterUid', '==', requester.uid),
    orderBy('requestedAt', 'desc'),
    limit(60)
  );
  const recentMap = new Map<string, { requestedAt?: Date; status?: string }>();
  try {
    const recentSnapshot = await getDocs(recentQuery);
    recentSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const requestedAt = data.requestedAt?.toDate ? data.requestedAt.toDate() : undefined;
      if (data.targetDonorUid) {
        recentMap.set(data.targetDonorUid, { requestedAt, status: data.status });
      }
    });
  } catch (error) {
    console.warn('Failed to load recent donor requests for dedupe. Continuing without dedupe.', error);
  }

  const now = Date.now();
  const sendTargets: PendingDonorRequestTarget[] = [];
  const skippedTargets: PendingDonorRequestTarget[] = [];
  const normalizedMessage = typeof payload.message === 'string'
    ? payload.message.trim().slice(0, MAX_DONOR_REQUEST_MESSAGE_LENGTH)
    : '';

  payload.targets.forEach((target) => {
    if (target.id === requester.uid) {
      skippedTargets.push(target);
      return;
    }
    const recent = recentMap.get(target.id);
    if (recent?.requestedAt && now - recent.requestedAt.getTime() < DUPLICATE_WINDOW_MS) {
      skippedTargets.push(target);
      return;
    }
    if (recent?.status && recent.status === 'pending') {
      skippedTargets.push(target);
      return;
    }
    sendTargets.push(target);
  });

  await setDoc(batchRef, {
    requesterUid: requester.uid,
    requesterBhId: requester.bhId || '',
    requesterName: requester.displayName || 'Anonymous',
    requesterPhone: requester.phoneNumber || requester.phoneNumberNormalized || '',
    requesterBloodType: requester.bloodType || '',
    donationType: payload.donationType,
    message: normalizedMessage,
    targetCount: payload.targets.length,
    sentCount: 0,
    skippedCount: skippedTargets.length,
    deletedCount: 0,
    status: sendTargets.length > 0 ? 'sending' : 'skipped',
    targetDonorIds: payload.targets.map((target) => target.id),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (sendTargets.length > 0) {
    const batch = writeBatch(db);
    sendTargets.forEach((target) => {
      const requestRef = doc(collection(db, 'donorRequests'));
      batch.set(requestRef, {
        requesterUid: requester.uid,
        requesterBhId: requester.bhId || '',
        requesterName: requester.displayName || 'Anonymous',
        requesterPhone: requester.phoneNumber || requester.phoneNumberNormalized || '',
        requesterBloodType: requester.bloodType || '',
        targetDonorUid: target.id,
        targetDonorName: target.name,
        targetDonorBhId: target.bhId || '',
        targetDonorBloodType: target.bloodType,
        donationType: payload.donationType,
        message: normalizedMessage,
        status: 'pending',
        requestBatchId: batchId,
        requestedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        requesterLocation: {
          city: requester.city || '',
          latitude: requester.latitude ?? null,
          longitude: requester.longitude ?? null,
        },
        targetLocation: {
          city: target.location,
        },
      });
    });
    try {
      await batch.commit();
    } catch (error) {
      await setDoc(
        batchRef,
        {
          sentCount: 0,
          skippedCount: skippedTargets.length,
          status: 'failed',
          updatedAt: serverTimestamp(),
          skippedTargetIds: skippedTargets.map((target) => target.id),
        },
        { merge: true }
      );
      throw error;
    }
  }

  await setDoc(
    batchRef,
    {
      sentCount: sendTargets.length,
      skippedCount: skippedTargets.length,
      status: sendTargets.length > 0 ? 'sent' : 'skipped',
      updatedAt: serverTimestamp(),
      skippedTargetIds: skippedTargets.map((target) => target.id),
    },
    { merge: true }
  );

  return {
    batchId,
    sentCount: sendTargets.length,
    skippedCount: skippedTargets.length,
    skippedTargets,
  };
};
