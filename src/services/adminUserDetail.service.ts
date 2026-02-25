import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../types/database.types';
import { DatabaseError, NotFoundError } from '../utils/errorHandler';
import { logAuditEvent } from './audit.service';

type JsonRecord = Record<string, any>;

export type AdminUserSecurity = {
  devices: Array<{
    deviceId: string;
    token?: string;
    updatedAt?: Date;
    info?: JsonRecord;
  }>;
  activeFcmTokens: string[];
  loginIps: Array<{
    ip: string;
    userAgent?: string;
    createdAt?: Date;
    source: 'impersonationEvents' | 'auditLogs';
  }>;
};

export type AdminUserKpis = {
  role: string;
  cards: Array<{ label: string; value: number; hint?: string }>;
  trend: Array<{ label: string; value: number }>;
  cohort?: {
    label: string;
    value: number;
  };
};

export type AdminUserReferral = {
  id: string;
  referredUid: string;
  referredRole: string;
  referredName: string;
  referredStatus?: string;
  referredAt?: Date;
  referralStatus?: string;
};

export type AdminUserTimelineItem = {
  id: string;
  kind: 'audit' | 'notification' | 'impersonation';
  title: string;
  description?: string;
  createdAt?: Date;
  metadata?: JsonRecord;
};

type ReferralTrackingEntry = {
  id: string;
  referredUid?: string;
  referredRole?: string;
  referredAt?: any;
  status?: string;
};

export type AdminKpiRange = '7d' | '30d' | '90d' | '12m';

const toDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  return undefined;
};

const sortByDateDesc = <T extends { createdAt?: Date }>(items: T[]) =>
  [...items].sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

const monthBuckets = (months = 6) => {
  const now = new Date();
  const items: Array<{ key: string; label: string; value: number }> = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    items.push({
      key,
      label: d.toLocaleString('en-US', { month: 'short' }),
      value: 0,
    });
  }
  return items;
};

const placeInMonthBuckets = (dates: Array<Date | undefined>, months = 6) => {
  const buckets = monthBuckets(months);
  const map = new Map(buckets.map((b) => [b.key, b]));
  dates.forEach((date) => {
    if (!date) return;
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    const bucket = map.get(key);
    if (bucket) bucket.value += 1;
  });
  return buckets.map(({ label, value }) => ({ label, value }));
};

const getRangeDays = (range: AdminKpiRange) => {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return 365;
};

const getCutoffDate = (range: AdminKpiRange) => {
  const date = new Date();
  date.setDate(date.getDate() - getRangeDays(range));
  return date;
};

const filterByRange = <T>(rows: T[], getDate: (row: T) => Date | undefined, range: AdminKpiRange) => {
  const cutoff = getCutoffDate(range).getTime();
  return rows.filter((row) => {
    const rowDate = getDate(row);
    return rowDate ? rowDate.getTime() >= cutoff : false;
  });
};

const safeOrderedQuery = async (q: ReturnType<typeof query>, fallbackQ: ReturnType<typeof query>) => {
  try {
    return await getDocs(q);
  } catch (error) {
    return getDocs(fallbackQ);
  }
};

export const getAdminUserDetail = async (uid: string): Promise<User> => {
  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    if (!snapshot.exists()) throw new NotFoundError('User not found');
    const data = snapshot.data() as JsonRecord;
    return {
      ...(data as User),
      id: snapshot.id,
      uid,
      createdAt: data.createdAt,
      lastLoginAt: data.lastLoginAt,
      dateOfBirth: data.dateOfBirth,
      lastDonation: data.lastDonation,
    };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    throw new DatabaseError('Failed to load user details');
  }
};

export const getAdminUserSecurity = async (uid: string): Promise<AdminUserSecurity> => {
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    const userData = userSnap.exists() ? (userSnap.data() as JsonRecord) : {};
    const fcmDeviceTokens = (userData.fcmDeviceTokens || {}) as JsonRecord;
    const fcmDeviceDetails = (userData.fcmDeviceDetails || {}) as JsonRecord;
    const devices = Object.keys({ ...fcmDeviceTokens, ...fcmDeviceDetails }).map((deviceId) => {
      const details = fcmDeviceDetails[deviceId] || {};
      return {
        deviceId,
        token: fcmDeviceTokens[deviceId] || details.token,
        updatedAt: toDate(details.updatedAt),
        info: details.info || {},
      };
    });

    const impersonationQ = query(
      collection(db, 'impersonationEvents'),
      where('targetUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const impersonationFallbackQ = query(
      collection(db, 'impersonationEvents'),
      where('targetUid', '==', uid),
      limit(100),
    );
    const impersonationSnap = await safeOrderedQuery(impersonationQ, impersonationFallbackQ);
    const impersonationRows = impersonationSnap.docs
      .map((row) => row.data() as JsonRecord)
      .filter((entry) => entry.ip)
      .map((entry) => ({
        ip: String(entry.ip),
        userAgent: entry.userAgent ? String(entry.userAgent) : undefined,
        createdAt: toDate(entry.createdAt),
        source: 'impersonationEvents' as const,
      }));

    const auditQ = query(
      collection(db, 'auditLogs'),
      where('targetUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const auditFallbackQ = query(
      collection(db, 'auditLogs'),
      where('targetUid', '==', uid),
      limit(100),
    );
    const auditSnap = await safeOrderedQuery(auditQ, auditFallbackQ);
    const auditRows = auditSnap.docs
      .map((row) => row.data() as JsonRecord)
      .filter((entry) => entry.metadata?.ip || entry.ip)
      .map((entry) => ({
        ip: String(entry.metadata?.ip || entry.ip),
        userAgent: entry.metadata?.userAgent || entry.userAgent,
        createdAt: toDate(entry.createdAt),
        source: 'auditLogs' as const,
      }));

    const mergedIps = sortByDateDesc([...impersonationRows, ...auditRows]).slice(0, 50);

    return {
      devices,
      activeFcmTokens: Array.isArray(userData.fcmTokens) ? userData.fcmTokens : [],
      loginIps: mergedIps,
    };
  } catch (error) {
    throw new DatabaseError('Failed to load user security data');
  }
};

export const getAdminUserKpis = async (
  uid: string,
  roleHint?: string,
  range: AdminKpiRange = '90d',
): Promise<AdminUserKpis> => {
  try {
    const user = await getAdminUserDetail(uid);
    const role = roleHint || user.role || 'donor';

    if (role === 'donor') {
      const donationsSnap = await getDocs(query(collection(db, 'donations'), where('donorId', '==', uid), limit(1000)));
      const requestsSentSnap = await getDocs(query(collection(db, 'donorRequests'), where('requesterUid', '==', uid), limit(1000)));
      const requestsReceivedSnap = await getDocs(query(collection(db, 'donorRequests'), where('targetDonorUid', '==', uid), limit(1000)));
      const donations = donationsSnap.docs.map((d) => d.data() as JsonRecord);
      const completed = donations.filter((d) => d.status === 'completed');
      const completedInRange = filterByRange(completed, (d) => toDate(d.donationDate || d.createdAt), range);
      const trend = placeInMonthBuckets(completedInRange.map((d) => toDate(d.donationDate || d.createdAt)));
      const cohortValue = Number(user.totalDonations || 0);
      return {
        role,
        cards: [
          { label: 'Total Donations', value: donations.length },
          { label: `Completed (${range})`, value: completedInRange.length },
          { label: 'Units Donated', value: completed.reduce((sum, d) => sum + Number(d.units || 0), 0) },
          { label: 'Requests Sent', value: requestsSentSnap.size },
          { label: 'Requests Received', value: requestsReceivedSnap.size },
        ],
        trend,
        cohort: { label: 'Profile Donation Count', value: cohortValue },
      };
    }

    if (role === 'ngo') {
      const campaignsSnap = await getDocs(query(collection(db, 'campaigns'), where('ngoId', '==', uid), limit(1000)));
      const volunteersSnap = await getDocs(query(collection(db, 'volunteers'), where('ngoId', '==', uid), limit(1000)));
      const partnershipsSnap = await getDocs(query(collection(db, 'partnerships'), where('ngoId', '==', uid), limit(1000)));
      const campaigns = campaignsSnap.docs.map((d) => d.data() as JsonRecord);
      const campaignsInRange = filterByRange(campaigns, (c) => toDate(c.createdAt || c.startDate), range);
      const trend = placeInMonthBuckets(campaignsInRange.map((c) => toDate(c.createdAt || c.startDate)));
      return {
        role,
        cards: [
          { label: 'Total Campaigns', value: campaigns.length },
          { label: `Campaigns (${range})`, value: campaignsInRange.length },
          { label: 'Active Campaigns', value: campaigns.filter((c) => c.status === 'active').length },
          { label: 'Volunteers', value: volunteersSnap.size },
          { label: 'Partnerships', value: partnershipsSnap.size },
        ],
        trend,
        cohort: { label: 'Range Activity', value: campaignsInRange.length },
      };
    }

    if (role === 'bloodbank' || role === 'hospital') {
      const requestsSnap = await getDocs(query(collection(db, 'bloodRequests'), where('requesterId', '==', uid), limit(1000)));
      const inventorySnap = await getDocs(query(collection(db, 'bloodInventory'), where('hospitalId', '==', uid), limit(1000)));
      const appointmentsSnap = await getDocs(query(collection(db, 'appointments'), where('hospitalId', '==', uid), limit(1000)));
      const requests = requestsSnap.docs.map((d) => d.data() as JsonRecord);
      const requestsInRange = filterByRange(requests, (r) => toDate(r.requestedAt || r.createdAt), range);
      const trend = placeInMonthBuckets(requestsInRange.map((r) => toDate(r.requestedAt || r.createdAt)));
      return {
        role,
        cards: [
          { label: 'Blood Requests', value: requests.length },
          { label: `Requests (${range})`, value: requestsInRange.length },
          { label: 'Fulfilled Requests', value: requests.filter((r) => r.status === 'fulfilled').length },
          { label: 'Inventory Records', value: inventorySnap.size },
          { label: 'Appointments', value: appointmentsSnap.size },
        ],
        trend,
        cohort: { label: 'Range Activity', value: requestsInRange.length },
      };
    }

    const auditSnap = await getDocs(query(collection(db, 'auditLogs'), where('actorUid', '==', uid), limit(1000)));
    const audits = auditSnap.docs.map((d) => d.data() as JsonRecord);
    return {
      role,
      cards: [
        { label: 'Audit Events', value: audits.length },
      ],
      trend: placeInMonthBuckets(filterByRange(audits, (a) => toDate(a.createdAt), range).map((a) => toDate(a.createdAt))),
      cohort: { label: 'Total Events', value: audits.length },
    };
  } catch (error) {
    throw new DatabaseError('Failed to load user KPI data');
  }
};

export const getAdminUserReferrals = async (
  uid: string,
  filters?: { role?: string; status?: string; search?: string },
): Promise<AdminUserReferral[]> => {
  try {
    const referralSnap = await getDocs(
      query(collection(db, 'ReferralTracking'), where('referrerUid', '==', uid), limit(500)),
    );
    const referrals: ReferralTrackingEntry[] = referralSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as JsonRecord),
    }));

    const referredUids = Array.from(new Set(referrals.map((r) => String(r.referredUid || '')).filter(Boolean)));
    const usersById = new Map<string, JsonRecord>();
    const chunkSize = 10;
    for (let i = 0; i < referredUids.length; i += chunkSize) {
      const chunk = referredUids.slice(i, i + chunkSize);
      const userSnap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)));
      userSnap.docs.forEach((d) => usersById.set(d.id, d.data() as JsonRecord));
    }

    const enriched = referrals.map((entry) => {
      const refUser = usersById.get(String(entry.referredUid || '')) || {};
      const referredName = refUser.displayName
        || refUser.organizationName
        || refUser.bloodBankName
        || refUser.hospitalName
        || 'User';
      const referredAt = toDate(entry.referredAt || refUser.createdAt);
      return {
        id: entry.id,
        referredUid: String(entry.referredUid || ''),
        referredRole: String(entry.referredRole || refUser.role || 'unknown'),
        referredName,
        referredStatus: refUser.status,
        referredAt,
        referralStatus: entry.status ? String(entry.status) : undefined,
        createdAt: referredAt,
      };
    });

    const term = filters?.search?.trim().toLowerCase() || '';
    const filtered = enriched.filter((entry) => {
      if (filters?.role && filters.role !== 'all' && entry.referredRole !== filters.role) return false;
      if (filters?.status && filters.status !== 'all' && (entry.referredStatus || entry.referralStatus) !== filters.status) return false;
      if (!term) return true;
      return `${entry.referredName} ${entry.referredUid} ${entry.referredRole}`.toLowerCase().includes(term);
    });

    return sortByDateDesc(filtered).map((entry) => ({
      id: entry.id,
      referredUid: entry.referredUid,
      referredRole: entry.referredRole,
      referredName: entry.referredName,
      referredStatus: entry.referredStatus,
      referredAt: entry.referredAt,
      referralStatus: entry.referralStatus,
    }));
  } catch (error) {
    throw new DatabaseError('Failed to load referral data');
  }
};

export const getAdminUserTimeline = async (
  uid: string,
  filters?: { kind?: string; search?: string },
): Promise<AdminUserTimelineItem[]> => {
  try {
    const [auditSnap, notificationSnap, impersonationSnap] = await Promise.all([
      getDocs(query(collection(db, 'auditLogs'), where('targetUid', '==', uid), limit(100))),
      getDocs(query(collection(db, 'notifications'), where('userId', '==', uid), limit(100))),
      getDocs(query(collection(db, 'impersonationEvents'), where('targetUid', '==', uid), limit(100))),
    ]);

    const audits = auditSnap.docs.map((d) => {
      const row = d.data() as JsonRecord;
      return {
        id: d.id,
        kind: 'audit' as const,
        title: row.action || 'Audit event',
        description: row.metadata?.reason || row.metadata?.status || undefined,
        createdAt: toDate(row.createdAt),
        metadata: row.metadata,
      };
    });
    const notifications = notificationSnap.docs.map((d) => {
      const row = d.data() as JsonRecord;
      return {
        id: d.id,
        kind: 'notification' as const,
        title: row.title || 'Notification',
        description: row.message || '',
        createdAt: toDate(row.createdAt),
        metadata: row,
      };
    });
    const impersonations = impersonationSnap.docs.map((d) => {
      const row = d.data() as JsonRecord;
      return {
        id: d.id,
        kind: 'impersonation' as const,
        title: row.action || 'Impersonation event',
        description: row.reason || row.status || '',
        createdAt: toDate(row.createdAt),
        metadata: row,
      };
    });

    const term = filters?.search?.trim().toLowerCase() || '';
    const merged = [...audits, ...notifications, ...impersonations].filter((entry) => {
      if (filters?.kind && filters.kind !== 'all' && entry.kind !== filters.kind) return false;
      if (!term) return true;
      return `${entry.title} ${entry.description || ''}`.toLowerCase().includes(term);
    });
    return sortByDateDesc(merged);
  } catch (error) {
    throw new DatabaseError('Failed to load timeline data');
  }
};

export const revokeUserFcmToken = async (
  uid: string,
  token: string,
  adminUid: string,
  reason: string,
) => {
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) throw new NotFoundError('User not found');
    const data = userSnap.data() as JsonRecord;
    const fcmDeviceTokens = { ...(data.fcmDeviceTokens || {}) } as Record<string, string>;
    const fcmDeviceDetails = { ...(data.fcmDeviceDetails || {}) } as Record<string, JsonRecord>;
    const nextTokens = Array.isArray(data.fcmTokens)
      ? data.fcmTokens.filter((entry: string) => entry !== token)
      : [];

    Object.keys(fcmDeviceTokens).forEach((deviceId) => {
      if (fcmDeviceTokens[deviceId] === token) {
        delete fcmDeviceTokens[deviceId];
        delete fcmDeviceDetails[deviceId];
      }
    });

    await updateDoc(doc(db, 'users', uid), {
      fcmTokens: nextTokens,
      fcmDeviceTokens,
      fcmDeviceDetails,
      updatedAt: serverTimestamp(),
    });

    await logAuditEvent({
      actorUid: adminUid,
      actorRole: 'admin',
      action: 'admin_revoke_fcm_token',
      targetUid: uid,
      metadata: { tokenTail: token.slice(-8), reason },
    });
  } catch (error) {
    throw new DatabaseError('Failed to revoke FCM token');
  }
};

export const revokeAllUserFcmTokens = async (uid: string, adminUid: string, reason: string) => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      fcmTokens: [],
      fcmDeviceTokens: {},
      fcmDeviceDetails: {},
      updatedAt: serverTimestamp(),
    });

    await logAuditEvent({
      actorUid: adminUid,
      actorRole: 'admin',
      action: 'admin_revoke_all_fcm_tokens',
      targetUid: uid,
      metadata: { reason },
    });
  } catch (error) {
    throw new DatabaseError('Failed to revoke all FCM tokens');
  }
};
