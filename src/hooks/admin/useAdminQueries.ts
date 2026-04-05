import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { adminQueryKeys, type AdminKpiRange, type AdminUserRoleFilter } from '../../constants/adminQueryKeys';
import { CMS_DEFAULTS, CMS_LIMITS, CMS_QUERY_LIMITS } from '../../constants/cms';
import { COLLECTIONS } from '../../constants/firestore';
import { ADMIN_QUERY_TIMINGS } from '../../constants/query';
import {
  NPS_FETCH_LIMIT,
  NPS_DRIVER_TAGS,
  NPS_FOLLOW_UP_STATUS,
  normalizeNpsRole,
  type NpsDriverTag,
  type NpsFollowUpStatus,
  type NpsRole,
} from '../../constants/nps';
import { getAdminCacheKey, readAdminCache, writeAdminCache } from '../../utils/adminCache';
import {
  getAllUsers,
  getEmergencyRequests,
  getInventoryAlerts,
  getPlatformStats,
  getRecentActivity,
  getVerificationRequests,
} from '../../services/admin.service';
import {
  getAdminUserDetail,
  getAdminUserKpis,
  getAdminUserReferrals,
  getAdminUserSecurity,
  getAdminUserTimeline,
  type AdminUserKpis,
  type AdminUserReferral,
  type AdminUserSecurity,
  type AdminUserTimelineItem,
} from '../../services/adminUserDetail.service';
import type {
  BloodInventory,
  BloodRequest,
  CmsBlogCategory,
  CmsBlogPost,
  CmsMedia,
  CmsNavMenu,
  CmsPage,
  CmsSettings,
  ContactSubmission,
  NpsPromptOverride,
  NpsResponse,
  TranslationOverrideDocument,
  User,
  VerificationRequest
} from '../../types/database.types';
import { toDateValue } from '../../utils/dateValue';
import type { OfflineSyncHealthActor, OfflineSyncHealthDeadLetterSample, OfflineSyncHealthRecord } from '../../utils/offlineSyncHealth';
import { getTranslationOverrideDocuments } from '../../services/translationOverrides.service';

type PlatformStatsResponse = Awaited<ReturnType<typeof getPlatformStats>>;
type AdminEntity = Record<string, any> & { id?: string };
type AdminRecentActivity = {
  donations: AdminEntity[];
  requests: AdminEntity[];
  campaigns: AdminEntity[];
};

export type AdminOverviewStats = {
  totalUsers: number;
  totalDonors: number;
  totalHospitals: number;
  totalNGOs: number;
  totalAdmins: number;
  activeUsers: number;
  inactiveUsers: number;
  pendingVerification: number;
  totalDonations: number;
  completedDonations: number;
  totalBloodUnits: number;
  activeRequests: number;
  fulfilledRequests: number;
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  pendingVerificationRequests: number;
  approvedVerificationRequests: number;
  rejectedVerificationRequests: number;
};

export type AdminSystemAlert = {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  source: string;
  timestamp: Date;
  resolved: boolean;
  action?: string;
};

export type AdminNpsActiveUsers = Record<NpsRole, number> & { all: number };
export type AdminNpsActiveUserProfile = {
  uid: string;
  role: NpsRole;
  lastLoginAt: Date | null;
};
export type AdminOfflineSyncHealthRecord = OfflineSyncHealthRecord;
export type AdminTranslationOverride = TranslationOverrideDocument;

const useCachedAdminQuery = <T,>(
  queryKey: readonly unknown[],
  ttlMs: number,
  dateFields: string[],
  queryFn: () => Promise<T>,
  options?: {
    staleTime?: number;
    gcTime?: number;
    refetchInterval?: number | false;
    refetchIntervalInBackground?: boolean;
    refetchOnMount?: boolean | 'always';
    refetchOnWindowFocus?: boolean;
    enabled?: boolean;
  },
) => {
  const cacheKey = getAdminCacheKey(queryKey);
  return useQuery({
    queryKey,
    queryFn: async () => {
      const data = await queryFn();
      writeAdminCache(cacheKey, data);
      return data;
    },
    initialData: () => readAdminCache<T>(cacheKey, ttlMs, dateFields),
    staleTime: options?.staleTime,
    gcTime: options?.gcTime,
    refetchInterval: options?.refetchInterval,
    refetchIntervalInBackground: options?.refetchIntervalInBackground,
    refetchOnMount: options?.refetchOnMount,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    enabled: options?.enabled,
  });
};

const fetchAdminUsers = async (role: AdminUserRoleFilter = 'all', limitCount: number = 800): Promise<User[]> => {
  if (role === 'donor') return getAllUsers('donor', undefined, limitCount);
  if (role === 'ngo') return getAllUsers('ngo', undefined, limitCount);
  if (role === 'bloodbank') {
    const [bloodbanks, hospitals] = await Promise.all([
      getAllUsers('bloodbank', undefined, limitCount),
      getAllUsers('hospital', undefined, limitCount),
    ]);
    return [...bloodbanks, ...hospitals];
  }
  return getAllUsers(undefined, undefined, limitCount);
};

const fetchCampaigns = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.CAMPAIGNS), orderBy('createdAt', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDateValue(data.createdAt),
      updatedAt: toDateValue(data.updatedAt),
      startDate: toDateValue(data.startDate),
      endDate: toDateValue(data.endDate),
    };
  });
};

const fetchVolunteers = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.VOLUNTEERS), orderBy('createdAt', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDateValue(data.createdAt),
      updatedAt: toDateValue(data.updatedAt),
      joinDate: toDateValue(data.joinDate),
    };
  });
};

const fetchPartnerships = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.PARTNERSHIPS), orderBy('createdAt', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDateValue(data.createdAt),
      updatedAt: toDateValue(data.updatedAt),
      since: toDateValue(data.since),
    };
  });
};

const fetchAppointments = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.APPOINTMENTS), orderBy('scheduledDate', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDateValue(data.createdAt),
      updatedAt: toDateValue(data.updatedAt),
      scheduledDate: toDateValue(data.scheduledDate),
      completedAt: toDateValue(data.completedAt),
    };
  });
};

const fetchDonations = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.DONATIONS), orderBy('donationDate', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDateValue(data.createdAt),
      updatedAt: toDateValue(data.updatedAt),
      donationDate: toDateValue(data.donationDate),
    };
  });
};

const fetchNotifications = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.NOTIFICATIONS), orderBy('createdAt', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDateValue(data.createdAt),
      updatedAt: toDateValue(data.updatedAt),
    };
  });
};

const fetchContactSubmissions = async (limitCount: number): Promise<ContactSubmission[]> => {
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.CONTACT_SUBMISSIONS),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      id: docSnap.id,
      name: typeof data.name === 'string' ? data.name : '',
      email: typeof data.email === 'string' ? data.email : '',
      phone: typeof data.phone === 'string' ? data.phone : undefined,
      subject: typeof data.subject === 'string' ? data.subject : 'general',
      message: typeof data.message === 'string' ? data.message : '',
      status: data.status === 'read' ? 'read' : 'unread',
      recaptchaScore: typeof data.recaptchaScore === 'number' ? data.recaptchaScore : null,
      recaptchaAction: typeof data.recaptchaAction === 'string' ? data.recaptchaAction : null,
      sourceIpHash: typeof data.sourceIpHash === 'string' ? data.sourceIpHash : null,
      userAgentHash: typeof data.userAgentHash === 'string' ? data.userAgentHash : null,
      readAt: (toDateValue(data.readAt) as any) || null,
      readBy: typeof data.readBy === 'string' ? data.readBy : null,
      createdAt: toDateValue(data.createdAt) as any,
      updatedAt: toDateValue(data.updatedAt) as any,
    } as ContactSubmission;
  });
};

const fetchTranslationOverrides = async (): Promise<TranslationOverrideDocument[]> => (
  getTranslationOverrideDocuments()
);

const fetchCmsPages = async (limitCount: number): Promise<CmsPage[]> => {
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.CMS_PAGES),
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  ));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      id: docSnap.id,
      slug: typeof data.slug === 'string' ? data.slug : '',
      title: typeof data.title === 'string' ? data.title : '',
      kind: typeof data.kind === 'string' ? data.kind : 'generic',
      status: typeof data.status === 'string' ? data.status : 'draft',
      contentJson: typeof data.contentJson === 'string' ? data.contentJson : null,
      slugAliases: Array.isArray(data.slugAliases) ? data.slugAliases.filter((item: unknown) => typeof item === 'string') : [],
      excerpt: typeof data.excerpt === 'string' ? data.excerpt : null,
      seoTitle: typeof data.seoTitle === 'string' ? data.seoTitle : null,
      seoDescription: typeof data.seoDescription === 'string' ? data.seoDescription : null,
      seoCanonicalUrl: typeof data.seoCanonicalUrl === 'string' ? data.seoCanonicalUrl : null,
      seoNoIndex: data.seoNoIndex === true,
      seoNoFollow: data.seoNoFollow === true,
      ogTitle: typeof data.ogTitle === 'string' ? data.ogTitle : null,
      ogDescription: typeof data.ogDescription === 'string' ? data.ogDescription : null,
      ogImageUrl: typeof data.ogImageUrl === 'string' ? data.ogImageUrl : null,
      twitterImageUrl: typeof data.twitterImageUrl === 'string' ? data.twitterImageUrl : null,
      workflowAssignee: typeof data.workflowAssignee === 'string' ? data.workflowAssignee : null,
      reviewStatus: data.reviewStatus === 'in_review'
        || data.reviewStatus === 'approved'
        || data.reviewStatus === 'changes_requested'
        ? data.reviewStatus
        : 'not_requested',
      reviewNotes: typeof data.reviewNotes === 'string' ? data.reviewNotes : null,
      scheduledPublishAt: (toDateValue(data.scheduledPublishAt) as any) || null,
      scheduledUnpublishAt: (toDateValue(data.scheduledUnpublishAt) as any) || null,
      version: Number.isFinite(data.version) ? Number(data.version) : 1,
      coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : null,
      publishedAt: (toDateValue(data.publishedAt) as any) || null,
      createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
      updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
      createdAt: toDateValue(data.createdAt) as any,
      updatedAt: toDateValue(data.updatedAt) as any,
    } as CmsPage;
  });
};

const fetchCmsBlogPosts = async (limitCount: number): Promise<CmsBlogPost[]> => {
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.CMS_BLOG_POSTS),
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  ));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      id: docSnap.id,
      slug: typeof data.slug === 'string' ? data.slug : '',
      title: typeof data.title === 'string' ? data.title : '',
      excerpt: typeof data.excerpt === 'string' ? data.excerpt : null,
      contentJson: typeof data.contentJson === 'string' ? data.contentJson : null,
      categorySlug: typeof data.categorySlug === 'string' ? data.categorySlug : null,
      tags: Array.isArray(data.tags) ? data.tags.filter((tag: unknown) => typeof tag === 'string') : [],
      slugAliases: Array.isArray(data.slugAliases) ? data.slugAliases.filter((item: unknown) => typeof item === 'string') : [],
      seriesSlug: typeof data.seriesSlug === 'string' ? data.seriesSlug : null,
      relatedPostSlugs: Array.isArray(data.relatedPostSlugs) ? data.relatedPostSlugs.filter((item: unknown) => typeof item === 'string') : [],
      featuredUntil: (toDateValue(data.featuredUntil) as any) || null,
      coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : null,
      status: typeof data.status === 'string' ? data.status : 'draft',
      featured: data.featured === true,
      seoTitle: typeof data.seoTitle === 'string' ? data.seoTitle : null,
      seoDescription: typeof data.seoDescription === 'string' ? data.seoDescription : null,
      seoCanonicalUrl: typeof data.seoCanonicalUrl === 'string' ? data.seoCanonicalUrl : null,
      seoNoIndex: data.seoNoIndex === true,
      seoNoFollow: data.seoNoFollow === true,
      ogTitle: typeof data.ogTitle === 'string' ? data.ogTitle : null,
      ogDescription: typeof data.ogDescription === 'string' ? data.ogDescription : null,
      ogImageUrl: typeof data.ogImageUrl === 'string' ? data.ogImageUrl : null,
      twitterImageUrl: typeof data.twitterImageUrl === 'string' ? data.twitterImageUrl : null,
      authorName: typeof data.authorName === 'string' ? data.authorName : null,
      workflowAssignee: typeof data.workflowAssignee === 'string' ? data.workflowAssignee : null,
      reviewStatus: data.reviewStatus === 'in_review'
        || data.reviewStatus === 'approved'
        || data.reviewStatus === 'changes_requested'
        ? data.reviewStatus
        : 'not_requested',
      reviewNotes: typeof data.reviewNotes === 'string' ? data.reviewNotes : null,
      scheduledPublishAt: (toDateValue(data.scheduledPublishAt) as any) || null,
      scheduledUnpublishAt: (toDateValue(data.scheduledUnpublishAt) as any) || null,
      version: Number.isFinite(data.version) ? Number(data.version) : 1,
      publishedAt: (toDateValue(data.publishedAt) as any) || null,
      createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
      updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
      createdAt: toDateValue(data.createdAt) as any,
      updatedAt: toDateValue(data.updatedAt) as any,
    } as CmsBlogPost;
  });
};

const fetchCmsBlogCategories = async (limitCount: number): Promise<CmsBlogCategory[]> => {
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.CMS_BLOG_CATEGORIES),
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  ));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      id: docSnap.id,
      slug: typeof data.slug === 'string' ? data.slug : '',
      name: typeof data.name === 'string' ? data.name : '',
      description: typeof data.description === 'string' ? data.description : null,
      colorHex: typeof data.colorHex === 'string' ? data.colorHex : null,
      status: typeof data.status === 'string' ? data.status : 'draft',
      createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
      updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
      createdAt: toDateValue(data.createdAt) as any,
      updatedAt: toDateValue(data.updatedAt) as any,
    } as CmsBlogCategory;
  });
};

const fetchCmsNavMenus = async (limitCount: number): Promise<CmsNavMenu[]> => {
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.CMS_NAV_MENUS),
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  ));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      id: docSnap.id,
      location: typeof data.location === 'string' ? data.location : 'header',
      status: typeof data.status === 'string' ? data.status : 'published',
      items: Array.isArray(data.items) ? data.items : [],
      updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
      createdAt: toDateValue(data.createdAt) as any,
      updatedAt: toDateValue(data.updatedAt) as any,
    } as CmsNavMenu;
  });
};

const fetchCmsMedia = async (limitCount: number): Promise<CmsMedia[]> => {
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.CMS_MEDIA),
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  ));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      id: docSnap.id,
      name: typeof data.name === 'string' ? data.name : '',
      url: typeof data.url === 'string' ? data.url : '',
      mimeType: typeof data.mimeType === 'string' ? data.mimeType : null,
      sizeBytes: Number.isFinite(data.sizeBytes) ? Number(data.sizeBytes) : null,
      altText: typeof data.altText === 'string' ? data.altText : null,
      tags: Array.isArray(data.tags) ? data.tags.filter((tag: unknown) => typeof tag === 'string') : [],
      status: typeof data.status === 'string' ? data.status : 'draft',
      createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
      updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
      createdAt: toDateValue(data.createdAt) as any,
      updatedAt: toDateValue(data.updatedAt) as any,
    } as CmsMedia;
  });
};

const fetchCmsSettings = async (): Promise<CmsSettings | null> => {
  const snapshot = await getDoc(doc(db, COLLECTIONS.CMS_SETTINGS, 'global'));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, any>;
  return {
    id: snapshot.id,
    siteTitle: typeof data.siteTitle === 'string' ? data.siteTitle : '',
    siteTagline: typeof data.siteTagline === 'string' ? data.siteTagline : null,
    defaultSeoTitle: typeof data.defaultSeoTitle === 'string' ? data.defaultSeoTitle : null,
    defaultSeoDescription: typeof data.defaultSeoDescription === 'string' ? data.defaultSeoDescription : null,
    canonicalBaseUrl: typeof data.canonicalBaseUrl === 'string' ? data.canonicalBaseUrl : CMS_DEFAULTS.canonicalBaseUrl,
    defaultOgImageUrl: typeof data.defaultOgImageUrl === 'string' ? data.defaultOgImageUrl : CMS_DEFAULTS.defaultOgImageUrl,
    twitterHandle: typeof data.twitterHandle === 'string' ? data.twitterHandle : CMS_DEFAULTS.twitterHandle,
    robotsPolicy: data.robotsPolicy === 'noindex_nofollow' ? 'noindex_nofollow' : CMS_DEFAULTS.robotsPolicy,
    blogPostsPerPage: Number.isFinite(data.blogPostsPerPage)
      ? Math.min(CMS_LIMITS.blogPostsPageSizeMax, Math.max(CMS_LIMITS.blogPostsPageSizeMin, Number(data.blogPostsPerPage)))
      : CMS_DEFAULTS.blogPostsPerPage,
    showFeaturedOnBlog: data.showFeaturedOnBlog !== false,
    showBlogInFooter: data.showBlogInFooter !== false,
    requireApprovalBeforePublish: data.requireApprovalBeforePublish === true,
    supportEmail: typeof data.supportEmail === 'string' ? data.supportEmail : null,
    supportPhone: typeof data.supportPhone === 'string' ? data.supportPhone : null,
    officeCity: typeof data.officeCity === 'string' ? data.officeCity : null,
    socialLinks: data.socialLinks && typeof data.socialLinks === 'object' ? data.socialLinks : {},
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    createdAt: toDateValue(data.createdAt) as any,
    updatedAt: toDateValue(data.updatedAt) as any,
  } as CmsSettings;
};

const fetchAuditLogs = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy('createdAt', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDateValue(data.createdAt),
      updatedAt: toDateValue(data.updatedAt),
    };
  });
};

const fetchNpsResponses = async (limitCount: number): Promise<NpsResponse[]> => {
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.NPS_RESPONSES),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    const role = normalizeNpsRole(data.userRole) || 'donor';
    const followUpStatus: NpsFollowUpStatus = data.followUpStatus === NPS_FOLLOW_UP_STATUS.inProgress
      ? NPS_FOLLOW_UP_STATUS.inProgress
      : data.followUpStatus === NPS_FOLLOW_UP_STATUS.closed
        ? NPS_FOLLOW_UP_STATUS.closed
        : NPS_FOLLOW_UP_STATUS.open;
    const tags = Array.isArray(data.tags)
      ? data.tags.filter((item: unknown): item is NpsDriverTag => (
        typeof item === 'string' && Object.values(NPS_DRIVER_TAGS).includes(item as NpsDriverTag)
      ))
      : [];
    return {
      id: docSnap.id,
      userId: typeof data.userId === 'string' ? data.userId : '',
      userRole: role,
      score: Number.isFinite(data.score) ? Number(data.score) : 0,
      segment: data.segment === 'promoter' || data.segment === 'passive' ? data.segment : 'detractor',
      comment: typeof data.comment === 'string' ? data.comment : null,
      tags,
      cycleKey: typeof data.cycleKey === 'string' ? data.cycleKey : '',
      questionVersion: typeof data.questionVersion === 'string' ? data.questionVersion : 'v1',
      source: data.source === 'settings_feedback' ? 'settings_feedback' : 'dashboard_prompt',
      followUpStatus,
      followedUpBy: typeof data.followedUpBy === 'string' ? data.followedUpBy : null,
      followUpNotes: typeof data.followUpNotes === 'string' ? data.followUpNotes : null,
      followedUpAt: (toDateValue(data.followedUpAt) as any) || null,
      createdAt: toDateValue(data.createdAt) as any,
      updatedAt: toDateValue(data.updatedAt) as any,
    } as NpsResponse;
  });
};

const fetchNpsActiveUsers = async (): Promise<AdminNpsActiveUsers> => {
  const limitCount = 6000;
  const [donors, ngos, bloodbanks, hospitals] = await Promise.all([
    getAllUsers('donor', 'active', limitCount),
    getAllUsers('ngo', 'active', limitCount),
    getAllUsers('bloodbank', 'active', limitCount),
    getAllUsers('hospital', 'active', limitCount),
  ]);
  const bloodbankCount = bloodbanks.length + hospitals.length;
  const all = donors.length + ngos.length + bloodbankCount;
  return {
    donor: donors.length,
    ngo: ngos.length,
    bloodbank: bloodbankCount,
    all,
  };
};

const fetchNpsPromptOverrides = async (limitCount: number): Promise<NpsPromptOverride[]> => {
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.NPS_PROMPT_OVERRIDES),
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  ));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      id: docSnap.id,
      userId: typeof data.userId === 'string' ? data.userId : '',
      cycleKey: typeof data.cycleKey === 'string' ? data.cycleKey : '',
      enabled: data.enabled === true,
      triggeredBy: typeof data.triggeredBy === 'string' ? data.triggeredBy : null,
      createdAt: (toDateValue(data.createdAt) as any) || null,
      lastTriggeredAt: (toDateValue(data.lastTriggeredAt) as any) || null,
      updatedAt: (toDateValue(data.updatedAt) as any) || null,
    } as NpsPromptOverride;
  });
};

const fetchNpsActiveUserProfiles = async (): Promise<AdminNpsActiveUserProfile[]> => {
  const limitCount = 6000;
  const [donors, ngos, bloodbanks, hospitals] = await Promise.all([
    getAllUsers('donor', 'active', limitCount),
    getAllUsers('ngo', 'active', limitCount),
    getAllUsers('bloodbank', 'active', limitCount),
    getAllUsers('hospital', 'active', limitCount),
  ]);

  const mapUser = (user: User, role: NpsRole): AdminNpsActiveUserProfile => ({
    uid: user.uid || user.id || '',
    role,
    lastLoginAt: toDateValue(user.lastLoginAt) || null,
  });

  return [
    ...donors.map((user) => mapUser(user, 'donor')),
    ...ngos.map((user) => mapUser(user, 'ngo')),
    ...bloodbanks.map((user) => mapUser(user, 'bloodbank')),
    ...hospitals.map((user) => mapUser(user, 'bloodbank')),
  ].filter((entry) => Boolean(entry.uid));
};

const fetchErrorLogs = async (limitCount: number): Promise<AdminEntity[]> => {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.ERROR_LOGS), orderBy('createdAt', 'desc'), limit(limitCount)));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    return {
      ...data,
      id: docSnap.id,
      createdAt: toDateValue(data.createdAt),
      updatedAt: toDateValue(data.updatedAt),
    };
  });
};

const mapOfflineSyncHealthActor = (data: Record<string, any>): OfflineSyncHealthActor => ({
  uid: typeof data.uid === 'string' ? data.uid : '',
  displayName: typeof data.displayName === 'string'
    ? data.displayName
    : typeof data.name === 'string'
      ? data.name
      : typeof data.organizationName === 'string'
        ? data.organizationName
        : typeof data.hospitalName === 'string'
          ? data.hospitalName
          : typeof data.bloodBankName === 'string'
            ? data.bloodBankName
            : 'Unknown user',
  role: typeof data.role === 'string' ? data.role : null,
  status: typeof data.status === 'string' ? data.status : null,
});

const fetchOfflineSyncHealthActors = async (uids: string[]): Promise<Map<string, OfflineSyncHealthActor>> => {
  const normalized = Array.from(new Set(uids.filter((uid) => typeof uid === 'string' && uid.trim().length > 0)));
  const actors = new Map<string, OfflineSyncHealthActor>();
  const chunkSize = 10;

  for (let index = 0; index < normalized.length; index += chunkSize) {
    const chunk = normalized.slice(index, index + chunkSize);
    if (!chunk.length) continue;
    const snapshot = await getDocs(query(collection(db, COLLECTIONS.USERS), where('uid', 'in', chunk)));
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      const actor = mapOfflineSyncHealthActor(data);
      if (actor.uid) {
        actors.set(actor.uid, actor);
      }
    });
  }

  return actors;
};

const fetchOfflineSyncHealthRecords = async (
  windowMs: number,
  limitCount: number,
): Promise<AdminOfflineSyncHealthRecord[]> => {
  const cutoff = Date.now() - Math.max(0, windowMs);
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.OFFLINE_SYNC_HEALTH_RECORDS),
    where('bucketStart', '>=', cutoff),
    orderBy('bucketStart', 'desc'),
    limit(limitCount),
  ));

  const rawRecords = snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    const deadLetterSamples = Array.isArray(data.deadLetterSamples) ? data.deadLetterSamples : [];
    return {
      id: docSnap.id,
      uid: typeof data.uid === 'string' ? data.uid : '',
      actor: null,
      bucketStart: typeof data.bucketStart === 'number' ? data.bucketStart : 0,
      updatedAt: toDateValue(data.updatedAt) || null,
      lastEnqueueAt: toDateValue(data.lastEnqueueAt) || null,
      lastFlushAt: toDateValue(data.lastFlushAt) || null,
      lastFailureAt: toDateValue(data.lastFailureAt) || null,
      lastFailureMessage: typeof data.lastFailureMessage === 'string' ? data.lastFailureMessage : null,
      pendingCount: typeof data.pendingCount === 'number' ? data.pendingCount : 0,
      pendingByType: typeof data.pendingByType === 'object' && data.pendingByType !== null ? data.pendingByType as Record<string, number> : {},
      deadLetterCount: typeof data.deadLetterCount === 'number' ? data.deadLetterCount : 0,
      deadLetterSamples: deadLetterSamples.map((sample): OfflineSyncHealthDeadLetterSample => ({
        type: typeof sample?.type === 'string' ? sample.type : 'unknown',
        feature: typeof sample?.feature === 'string' ? sample.feature : null,
        reason: typeof sample?.reason === 'string' ? sample.reason : 'unknown',
        failureClass: typeof sample?.failureClass === 'string' ? sample.failureClass : 'unknown',
        failureCode: typeof sample?.failureCode === 'string' ? sample.failureCode : null,
        attempts: typeof sample?.attempts === 'number' ? sample.attempts : 0,
        failedAt: toDateValue(sample?.failedAt) || null,
      })),
      enqueued: typeof data.enqueued === 'number' ? data.enqueued : 0,
      flushRuns: typeof data.flushRuns === 'number' ? data.flushRuns : 0,
      flushedProcessed: typeof data.flushedProcessed === 'number' ? data.flushedProcessed : 0,
      flushedSucceeded: typeof data.flushedSucceeded === 'number' ? data.flushedSucceeded : 0,
      flushedFailed: typeof data.flushedFailed === 'number' ? data.flushedFailed : 0,
    } satisfies AdminOfflineSyncHealthRecord;
  }).filter((record) => record.uid);

  const actors = await fetchOfflineSyncHealthActors(rawRecords.map((record) => record.uid));
  return rawRecords.map((record) => ({
    ...record,
    actor: actors.get(record.uid) || null,
  }));
};

export const useAdminUsers = (role: AdminUserRoleFilter = 'all', limitCount: number = 800) =>
  useCachedAdminQuery<User[]>(
    adminQueryKeys.users(role, limitCount),
    ADMIN_QUERY_TIMINGS.users.ttl,
    ['createdAt', 'updatedAt', 'lastLoginAt', 'lastDonation', 'dateOfBirth'],
    () => fetchAdminUsers(role, limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.users.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.users.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.users.refetchInterval,
    },
  );

export const useAdminOverviewUsers = (limitCount: number = 100) =>
  useCachedAdminQuery<User[]>(
    adminQueryKeys.overviewUsers(limitCount),
    ADMIN_QUERY_TIMINGS.users.ttl,
    ['createdAt', 'updatedAt', 'lastLoginAt', 'lastDonation', 'dateOfBirth'],
    () => fetchAdminUsers('all', limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.users.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.users.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.users.refetchInterval,
    },
  );

export const useAdminVerificationRequests = (limitCount: number = 500) =>
  useCachedAdminQuery<VerificationRequest[]>(
    adminQueryKeys.verificationRequests(limitCount),
    ADMIN_QUERY_TIMINGS.verification.ttl,
    ['submittedAt', 'updatedAt', 'reviewedAt', 'createdAt'],
    () => getVerificationRequests(undefined, limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.verification.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.verification.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.verification.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminEmergencyRequests = () =>
  useCachedAdminQuery<BloodRequest[]>(
    adminQueryKeys.emergencyRequests(),
    ADMIN_QUERY_TIMINGS.emergency.ttl,
    ['requestedAt', 'neededBy', 'expiresAt', 'fulfilledAt', 'createdAt', 'updatedAt'],
    () => getEmergencyRequests(),
    {
      staleTime: ADMIN_QUERY_TIMINGS.emergency.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.emergency.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.emergency.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminInventoryAlerts = () =>
  useCachedAdminQuery<BloodInventory[]>(
    adminQueryKeys.inventoryAlerts(),
    ADMIN_QUERY_TIMINGS.inventory.ttl,
    ['lastRestocked', 'updatedAt', 'createdAt'],
    () => getInventoryAlerts(),
    {
      staleTime: ADMIN_QUERY_TIMINGS.inventory.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.inventory.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.inventory.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminRecentActivity = (limitCount: number = 5) =>
  useCachedAdminQuery<AdminRecentActivity>(
    adminQueryKeys.recentActivity(limitCount),
    ADMIN_QUERY_TIMINGS.recentActivity.ttl,
    ['donationDate', 'requestedAt', 'startDate', 'createdAt', 'updatedAt'],
    async () => {
      const raw = await getRecentActivity(limitCount);
      return {
        donations: (raw.donations || []).map((entry) => ({
          ...entry,
          donationDate: toDateValue(entry.donationDate) || toDateValue(entry.createdAt),
        })),
        requests: (raw.requests || []).map((entry: any) => ({
          ...entry,
          requestedAt: toDateValue(entry.requestedAt) || toDateValue(entry.createdAt),
          hospitalName: entry.hospitalName || entry.requesterName || '',
        })),
        campaigns: (raw.campaigns || []).map((entry: any) => ({
          ...entry,
          startDate: toDateValue(entry.startDate) || toDateValue(entry.createdAt),
          organizer: entry.organizer || entry.organizerName || entry.ngoName || '',
        })),
      };
    },
    {
      staleTime: ADMIN_QUERY_TIMINGS.recentActivity.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.recentActivity.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.recentActivity.refetchInterval,
    },
  );

export const useAdminPlatformStats = () =>
  useCachedAdminQuery<PlatformStatsResponse>(
    adminQueryKeys.platformStats(),
    ADMIN_QUERY_TIMINGS.platform.ttl,
    [],
    () => getPlatformStats(),
    {
      staleTime: ADMIN_QUERY_TIMINGS.platform.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.platform.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.platform.refetchInterval,
    },
  );

export const useAdminCampaigns = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.campaigns(limitCount),
    ADMIN_QUERY_TIMINGS.entitiesLarge.ttl,
    ['startDate', 'endDate', 'createdAt', 'updatedAt'],
    () => fetchCampaigns(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.entitiesLarge.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.entitiesLarge.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.entitiesLarge.refetchInterval,
    },
  );

export const useAdminVolunteers = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.volunteers(limitCount),
    ADMIN_QUERY_TIMINGS.entitiesLarge.ttl,
    ['joinDate', 'createdAt', 'updatedAt'],
    () => fetchVolunteers(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.entitiesLarge.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.entitiesLarge.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.entitiesLarge.refetchInterval,
    },
  );

export const useAdminPartnerships = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.partnerships(limitCount),
    ADMIN_QUERY_TIMINGS.entitiesLarge.ttl,
    ['since', 'createdAt', 'updatedAt'],
    () => fetchPartnerships(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.entitiesLarge.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.entitiesLarge.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.entitiesLarge.refetchInterval,
    },
  );

export const useAdminAppointments = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.appointments(limitCount),
    ADMIN_QUERY_TIMINGS.entitiesMedium.ttl,
    ['scheduledDate', 'completedAt', 'createdAt', 'updatedAt'],
    () => fetchAppointments(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.entitiesMedium.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.entitiesMedium.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.entitiesMedium.refetchInterval,
    },
  );

export const useAdminDonations = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.donations(limitCount),
    ADMIN_QUERY_TIMINGS.entitiesMedium.ttl,
    ['donationDate', 'createdAt', 'updatedAt'],
    () => fetchDonations(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.entitiesMedium.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.entitiesMedium.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.entitiesMedium.refetchInterval,
    },
  );

export const useAdminNotifications = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.notifications(limitCount),
    ADMIN_QUERY_TIMINGS.notifications.ttl,
    ['createdAt', 'updatedAt'],
    () => fetchNotifications(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.notifications.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.notifications.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.notifications.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminContactSubmissions = (limitCount: number = 1000) =>
  useCachedAdminQuery<ContactSubmission[]>(
    adminQueryKeys.contactSubmissions(limitCount),
    ADMIN_QUERY_TIMINGS.contactSubmissions.ttl,
    ['createdAt', 'updatedAt', 'readAt'],
    () => fetchContactSubmissions(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.contactSubmissions.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.contactSubmissions.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.contactSubmissions.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminCmsPages = (limitCount: number = CMS_QUERY_LIMITS.adminList) =>
  useCachedAdminQuery<CmsPage[]>(
    adminQueryKeys.cmsPages(limitCount),
    ADMIN_QUERY_TIMINGS.cms.ttl,
    ['createdAt', 'updatedAt', 'publishedAt'],
    () => fetchCmsPages(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.cms.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.cms.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.cms.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminCmsBlogPosts = (limitCount: number = CMS_QUERY_LIMITS.adminList) =>
  useCachedAdminQuery<CmsBlogPost[]>(
    adminQueryKeys.cmsBlogPosts(limitCount),
    ADMIN_QUERY_TIMINGS.cms.ttl,
    ['createdAt', 'updatedAt', 'publishedAt'],
    () => fetchCmsBlogPosts(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.cms.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.cms.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.cms.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminCmsBlogCategories = (limitCount: number = CMS_QUERY_LIMITS.adminList) =>
  useCachedAdminQuery<CmsBlogCategory[]>(
    adminQueryKeys.cmsBlogCategories(limitCount),
    ADMIN_QUERY_TIMINGS.cms.ttl,
    ['createdAt', 'updatedAt'],
    () => fetchCmsBlogCategories(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.cms.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.cms.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.cms.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminCmsNavMenus = (limitCount: number = 100) =>
  useCachedAdminQuery<CmsNavMenu[]>(
    adminQueryKeys.cmsNavMenus(limitCount),
    ADMIN_QUERY_TIMINGS.cms.ttl,
    ['createdAt', 'updatedAt'],
    () => fetchCmsNavMenus(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.cms.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.cms.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.cms.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminCmsMedia = (limitCount: number = CMS_QUERY_LIMITS.adminList) =>
  useCachedAdminQuery<CmsMedia[]>(
    adminQueryKeys.cmsMedia(limitCount),
    ADMIN_QUERY_TIMINGS.cms.ttl,
    ['createdAt', 'updatedAt'],
    () => fetchCmsMedia(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.cms.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.cms.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.cms.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminCmsSettings = () =>
  useCachedAdminQuery<CmsSettings | null>(
    adminQueryKeys.cmsSettings(),
    ADMIN_QUERY_TIMINGS.cms.ttl,
    ['createdAt', 'updatedAt'],
    fetchCmsSettings,
    {
      staleTime: ADMIN_QUERY_TIMINGS.cms.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.cms.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.cms.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminTranslationOverrides = () =>
  useCachedAdminQuery<TranslationOverrideDocument[]>(
    adminQueryKeys.translationOverrides(),
    ADMIN_QUERY_TIMINGS.cms.ttl,
    ['createdAt', 'updatedAt'],
    fetchTranslationOverrides,
    {
      staleTime: ADMIN_QUERY_TIMINGS.cms.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.cms.gcTime,
      refetchInterval: false,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminNpsResponses = (limitCount: number = NPS_FETCH_LIMIT) =>
  useCachedAdminQuery<NpsResponse[]>(
    adminQueryKeys.npsResponses(limitCount),
    ADMIN_QUERY_TIMINGS.nps.ttl,
    ['createdAt', 'updatedAt', 'followedUpAt'],
    () => fetchNpsResponses(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.nps.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.nps.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.nps.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminNpsActiveUsers = () =>
  useCachedAdminQuery<AdminNpsActiveUsers>(
    adminQueryKeys.npsActiveUsers(),
    ADMIN_QUERY_TIMINGS.nps.ttl,
    [],
    fetchNpsActiveUsers,
    {
      staleTime: ADMIN_QUERY_TIMINGS.nps.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.nps.gcTime,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: false,
    },
  );

export const useAdminNpsActiveUserProfiles = () =>
  useCachedAdminQuery<AdminNpsActiveUserProfile[]>(
    adminQueryKeys.npsActiveUserProfiles(),
    ADMIN_QUERY_TIMINGS.nps.ttl,
    ['lastLoginAt'],
    fetchNpsActiveUserProfiles,
    {
      staleTime: ADMIN_QUERY_TIMINGS.nps.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.nps.gcTime,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: false,
    },
  );

export const useAdminNpsPromptOverrides = (limitCount: number = 500) =>
  useCachedAdminQuery<NpsPromptOverride[]>(
    adminQueryKeys.npsPromptOverrides(limitCount),
    ADMIN_QUERY_TIMINGS.nps.ttl,
    ['createdAt', 'lastTriggeredAt', 'updatedAt'],
    () => fetchNpsPromptOverrides(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.nps.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.nps.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.nps.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminAuditLogs = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.auditLogs(limitCount),
    ADMIN_QUERY_TIMINGS.notifications.ttl,
    ['createdAt', 'updatedAt'],
    () => fetchAuditLogs(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.notifications.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.notifications.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.notifications.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminErrorLogs = (limitCount: number = 1000) =>
  useCachedAdminQuery<AdminEntity[]>(
    adminQueryKeys.errorLogs(limitCount),
    ADMIN_QUERY_TIMINGS.notifications.ttl,
    ['createdAt', 'updatedAt'],
    () => fetchErrorLogs(limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.notifications.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.notifications.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.notifications.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminOfflineSyncHealth = (windowMs: number, limitCount: number = 500) =>
  useCachedAdminQuery<AdminOfflineSyncHealthRecord[]>(
    adminQueryKeys.offlineSyncHealth(windowMs, limitCount),
    ADMIN_QUERY_TIMINGS.offlineSyncHealth.ttl,
    ['updatedAt', 'lastEnqueueAt', 'lastFlushAt', 'lastFailureAt', 'failedAt'],
    () => fetchOfflineSyncHealthRecords(windowMs, limitCount),
    {
      staleTime: ADMIN_QUERY_TIMINGS.offlineSyncHealth.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.offlineSyncHealth.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.offlineSyncHealth.refetchInterval,
      refetchIntervalInBackground: false,
    },
  );

export const useAdminUserDetail = (uid: string, options?: { enabled?: boolean }) =>
  useCachedAdminQuery<User>(
    adminQueryKeys.userDetail(uid),
    0,
    ['createdAt', 'updatedAt', 'lastLoginAt', 'lastDonation', 'dateOfBirth'],
    () => getAdminUserDetail(uid),
    {
      staleTime: ADMIN_QUERY_TIMINGS.userDetail.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.userDetail.gcTime,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      enabled: options?.enabled ?? Boolean(uid),
    },
  );

export const useAdminUserSecurity = (uid: string, options?: { enabled?: boolean }) =>
  useCachedAdminQuery<AdminUserSecurity>(
    adminQueryKeys.userSecurity(uid),
    0,
    ['updatedAt', 'createdAt'],
    () => getAdminUserSecurity(uid),
    {
      staleTime: ADMIN_QUERY_TIMINGS.userSecurity.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.userSecurity.gcTime,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      enabled: options?.enabled ?? Boolean(uid),
    },
  );

export const useAdminUserKpis = (
  uid: string,
  roleHint?: string,
  range: AdminKpiRange = '90d',
  options?: { enabled?: boolean },
) =>
  useCachedAdminQuery<AdminUserKpis>(
    adminQueryKeys.userKpis(uid, range),
    ADMIN_QUERY_TIMINGS.userKpis.staleTime,
    [],
    () => getAdminUserKpis(uid, roleHint, range),
    {
      staleTime: ADMIN_QUERY_TIMINGS.userKpis.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.userKpis.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.userKpis.refetchInterval,
      refetchIntervalInBackground: false,
      enabled: options?.enabled ?? Boolean(uid),
    },
  );

export const useAdminUserReferrals = (
  uid: string,
  filters?: { role?: string; status?: string; search?: string },
  options?: { enabled?: boolean },
) =>
  useCachedAdminQuery<AdminUserReferral[]>(
    adminQueryKeys.userReferrals(uid, filters),
    ADMIN_QUERY_TIMINGS.userKpis.staleTime,
    ['referredAt', 'createdAt'],
    () => getAdminUserReferrals(uid, filters),
    {
      staleTime: ADMIN_QUERY_TIMINGS.userKpis.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.userKpis.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.userKpis.refetchInterval,
      refetchIntervalInBackground: false,
      enabled: options?.enabled ?? Boolean(uid),
    },
  );

export const useAdminUserTimeline = (
  uid: string,
  filters?: { kind?: string; search?: string },
  options?: { enabled?: boolean },
) =>
  useCachedAdminQuery<AdminUserTimelineItem[]>(
    adminQueryKeys.userTimeline(uid, filters),
    ADMIN_QUERY_TIMINGS.userRefsTimeline.staleTime,
    ['createdAt'],
    () => getAdminUserTimeline(uid, filters),
    {
      staleTime: ADMIN_QUERY_TIMINGS.userRefsTimeline.staleTime,
      gcTime: ADMIN_QUERY_TIMINGS.userRefsTimeline.gcTime,
      refetchInterval: ADMIN_QUERY_TIMINGS.userRefsTimeline.refetchInterval,
      refetchIntervalInBackground: false,
      enabled: options?.enabled ?? Boolean(uid),
    },
  );

export const useAdminOverviewData = () => {
  const verificationQuery = useAdminVerificationRequests(500);
  const emergencyQuery = useAdminEmergencyRequests();
  const inventoryQuery = useAdminInventoryAlerts();
  const recentActivityQuery = useAdminRecentActivity(5);
  const platformStatsQuery = useAdminPlatformStats();

  const verificationRequests = verificationQuery.data || [];
  const emergencyRequests = emergencyQuery.data || [];
  const inventoryAlerts = inventoryQuery.data || [];
  const recentActivity = recentActivityQuery.data || { donations: [], requests: [], campaigns: [] };

  const stats = useMemo<AdminOverviewStats>(() => {
    const platform = platformStatsQuery.data;
    if (!platform) {
      return {
        totalUsers: 0,
        totalDonors: 0,
        totalHospitals: 0,
        totalNGOs: 0,
        totalAdmins: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        pendingVerification: 0,
        totalDonations: 0,
        completedDonations: 0,
        totalBloodUnits: 0,
        activeRequests: 0,
        fulfilledRequests: 0,
        totalCampaigns: 0,
        activeCampaigns: 0,
        completedCampaigns: 0,
        pendingVerificationRequests: verificationRequests.filter((v) => v.status === 'pending').length,
        approvedVerificationRequests: verificationRequests.filter((v) => v.status === 'approved').length,
        rejectedVerificationRequests: verificationRequests.filter((v) => v.status === 'rejected').length,
      };
    }

    return {
      totalUsers: platform.users.total,
      totalDonors: platform.users.byRole.donors,
      totalHospitals: platform.users.byRole.hospitals,
      totalNGOs: platform.users.byRole.ngos,
      totalAdmins: platform.users.byRole.admins,
      activeUsers: platform.users.byStatus.active,
      inactiveUsers: platform.users.byStatus.inactive,
      pendingVerification: platform.users.byStatus.pendingVerification,
      totalDonations: platform.donations.total,
      completedDonations: platform.donations.completed,
      totalBloodUnits: platform.donations.totalUnits,
      activeRequests: platform.requests.byStatus.active,
      fulfilledRequests: platform.requests.byStatus.fulfilled,
      totalCampaigns: platform.campaigns.total,
      activeCampaigns: platform.campaigns.byStatus.active,
      completedCampaigns: platform.campaigns.byStatus.completed,
      pendingVerificationRequests: platform.verifications.byStatus.pending,
      approvedVerificationRequests: platform.verifications.byStatus.approved,
      rejectedVerificationRequests: platform.verifications.byStatus.rejected,
    };
  }, [platformStatsQuery.data, verificationRequests]);

  const systemAlerts = useMemo<AdminSystemAlert[]>(() => {
    const alerts: AdminSystemAlert[] = inventoryAlerts.slice(0, 20).map((item) => {
      const isCritical = item.status === 'critical';
      return {
        id: item.id || `${item.hospitalId}-${item.bloodType}`,
        type: isCritical ? 'critical' : 'warning',
        message: `${isCritical ? 'Critical' : 'Low'} blood shortage for ${item.bloodType} - Only ${item.units || 0} units available`,
        source: `Inventory Alert - BloodBank ID: ${item.hospitalId}`,
        timestamp: toDateValue(item.updatedAt) || new Date(),
        resolved: false,
        action: 'View Inventory',
      };
    });

    const pendingVerificationCount = verificationRequests.filter((entry) => entry.status === 'pending').length;
    if (pendingVerificationCount > 5) {
      alerts.unshift({
        id: 'verify-alert',
        type: 'warning',
        message: `${pendingVerificationCount} verification requests pending review`,
        source: 'Verification System',
        timestamp: new Date(),
        resolved: false,
        action: 'Review Requests',
      });
    }

    return alerts;
  }, [inventoryAlerts, verificationRequests]);

  const loading = [
    verificationQuery,
    emergencyQuery,
    inventoryQuery,
    recentActivityQuery,
    platformStatsQuery,
  ].some((entry) => entry.isLoading);

  const partialErrors = [
    ['verification requests', verificationQuery.error],
    ['emergency requests', emergencyQuery.error],
    ['inventory alerts', inventoryQuery.error],
    ['recent activity', recentActivityQuery.error],
    ['platform stats', platformStatsQuery.error],
  ]
    .flatMap(([label, value]) => (value instanceof Error ? [`Failed to fetch ${label}: ${value.message}`] : []));

  const hasAnyData = Boolean(platformStatsQuery.data)
    || verificationRequests.length > 0
    || emergencyRequests.length > 0
    || inventoryAlerts.length > 0
    || recentActivity.donations.length > 0
    || recentActivity.requests.length > 0
    || recentActivity.campaigns.length > 0;

  const error = !hasAnyData && partialErrors.length > 0
    ? partialErrors[0]
    : null;

  const refreshData = async () => {
    await Promise.all([
      verificationQuery.refetch(),
      emergencyQuery.refetch(),
      inventoryQuery.refetch(),
      recentActivityQuery.refetch(),
      platformStatsQuery.refetch(),
    ]);
  };

  return {
    verificationRequests,
    emergencyRequests,
    systemAlerts,
    stats,
    recentActivity,
    loading,
    error,
    partialErrors,
    refreshData,
  };
};
