import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
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

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type RequesterProfile = {
  uid: string;
  bhId?: string;
  displayName?: string | null;
  phoneNumber?: string | null;
  bloodType?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export const encodePendingDonorRequest = (payload: PendingDonorRequest) => {
  const safePayload = { ...payload, createdAt: payload.createdAt || Date.now() };
  const json = JSON.stringify(safePayload);
  return btoa(unescape(encodeURIComponent(json)));
};

export const decodePendingDonorRequest = (encoded: string): PendingDonorRequest | null => {
  if (!encoded) return null;
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as PendingDonorRequest;
    if (!parsed?.targetDonorId || !parsed?.createdAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const savePendingDonorRequestDoc = async (uid: string, payload: PendingDonorRequest) => {
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + MAX_AGE_MS));
  await setDoc(
    doc(db, 'pendingDonorRequests', uid),
    {
      ...payload,
      createdAt: serverTimestamp(),
      expiresAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const loadPendingDonorRequestDoc = async (uid: string): Promise<PendingDonorRequest | null> => {
  const snapshot = await getDoc(doc(db, 'pendingDonorRequests', uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as any;
  const createdAt = data?.createdAt?.toDate ? data.createdAt.toDate() : null;
  const expiresAt = data?.expiresAt?.toDate ? data.expiresAt.toDate() : null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    await deleteDoc(doc(db, 'pendingDonorRequests', uid));
    return null;
  }
  return {
    targetDonorId: data.targetDonorId,
    targetDonorBhId: data.targetDonorBhId,
    targetDonorName: data.targetDonorName,
    targetDonorBloodType: data.targetDonorBloodType,
    targetLocation: data.targetLocation,
    donationType: data.donationType,
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
    requesterPhone: requester.phoneNumber || '',
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
