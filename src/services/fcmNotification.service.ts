import { addDoc, collection, doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { NotificationType } from '../types/database.types';
import { COLLECTIONS } from '../constants/firestore';
import { ROUTES } from '../constants/routes';

type FcmPayload = {
  messageId?: string;
  notification?: {
    title?: string;
    body?: string;
  };
  data?: Record<string, any>;
};

const VALID_TYPES: NotificationType[] = [
  'emergency_request',
  'donor_request',
  'appointment_reminder',
  'campaign_invite',
  'donation_confirmation',
  'verification_status',
  'achievement',
  'referral',
  'general',
];

const VALID_PRIORITIES = new Set(['high', 'medium', 'low', 'urgent', 'normal']);

const normalizePriority = (value?: string) => {
  const normalized = typeof value === 'string'
    ? value.toLowerCase()
    : value != null
      ? String(value).toLowerCase()
      : undefined;
  if (!normalized || !VALID_PRIORITIES.has(normalized)) return 'low';
  if (normalized === 'urgent') return 'high';
  if (normalized === 'normal') return 'medium';
  return normalized as 'high' | 'medium' | 'low';
};

const normalizeType = (value?: string) => {
  if (!value) return 'general';
  const normalized = (typeof value === 'string' ? value.toLowerCase() : String(value).toLowerCase()) as NotificationType;
  return VALID_TYPES.includes(normalized) ? normalized : 'general';
};

const resolveDefaultActionUrl = (role?: string) => {
  switch (role) {
    case 'ngo':
      return `${ROUTES.portal.ngo.dashboard.root}?panel=notifications`;
    case 'bloodbank':
      return `${ROUTES.portal.bloodbank.dashboard.root}?panel=notifications`;
    case 'donor':
    default:
      return `${ROUTES.portal.donor.dashboard.root}?panel=notifications`;
  }
};

const buildDocId = (userId: string, payload: FcmPayload, fallbackId?: string) => {
  const rawId = payload.messageId || payload.data?.messageId || fallbackId;
  if (!rawId) return null;
  return `fcm_${userId}_${rawId}`;
};

export const saveFcmNotification = async (
  userId: string,
  userRole: string,
  payload: FcmPayload,
  fallbackId?: string
) => {
  const title = payload.notification?.title || payload.data?.title || 'Notification';
  const message = payload.notification?.body || payload.data?.body || '';
  const roleHint = (payload.data?.userRole || payload.data?.role || userRole) as string | undefined;
  const actionUrl = payload.data?.route
    || payload.data?.url
    || payload.data?.link
    || payload.data?.click_action
    || resolveDefaultActionUrl(roleHint);

  const docData = {
    userId,
    userRole,
    type: normalizeType(payload.data?.type),
    title,
    message,
    read: false,
    priority: normalizePriority(payload.data?.priority),
    actionUrl,
    createdAt: Timestamp.now(),
    createdAtServer: serverTimestamp(),
  };

  const docId = buildDocId(userId, payload, fallbackId);

  if (docId) {
    await setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, docId), docData, { merge: true });
    return docId;
  }

  const docRef = await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), docData);
  return docRef.id;
};
