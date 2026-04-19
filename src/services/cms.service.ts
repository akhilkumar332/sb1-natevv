import { Timestamp, collection, doc, getDoc, getDocs, limit, orderBy, query, where, type QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestore';
import { CMS_DEFAULTS, CMS_LIMITS, CMS_PAGE_KIND, CMS_QUERY_LIMITS, CMS_SETTINGS_DOC_ID, CMS_STATUS, getCmsMenuDocId, getCmsPostDocId, type CmsMenuLocation } from '../constants/cms';
import type { CmsBlogPost, CmsNavMenu, CmsPage, CmsSettings } from '../types/database.types';
import { toDateValue } from '../utils/dateValue';
import { normalizeLocalizedCmsMap } from '../utils/cmsLocalization';
import { normalizeFrontendAccess } from '../utils/frontendAccess';

const QUERY_TIMEOUT_MS = 12000;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number = QUERY_TIMEOUT_MS): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('Query timed out.');
        (error as Error & { code?: string }).code = 'deadline-exceeded';
        reject(error);
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const normalizeCmsStatus = (value: unknown): CmsBlogPost['status'] => (
  value === CMS_STATUS.published
  || value === CMS_STATUS.scheduled
  || value === CMS_STATUS.archived
    ? value
    : CMS_STATUS.draft
);

const normalizeCmsPageKind = (value: unknown): CmsPage['kind'] => (
  value === CMS_PAGE_KIND.homeSection
  || value === CMS_PAGE_KIND.aboutSection
  || value === CMS_PAGE_KIND.contactSection
    ? value
    : CMS_PAGE_KIND.generic
);

const mapCmsBlogPost = (id: string, data: Record<string, any>): CmsBlogPost => ({
  id,
  slug: typeof data.slug === 'string' ? data.slug : '',
  title: typeof data.title === 'string' ? data.title : '',
  titleByLocale: normalizeLocalizedCmsMap(data.titleByLocale) || null,
  excerpt: typeof data.excerpt === 'string' ? data.excerpt : null,
  excerptByLocale: normalizeLocalizedCmsMap(data.excerptByLocale) || null,
  contentJson: typeof data.contentJson === 'string' ? data.contentJson : null,
  contentJsonByLocale: normalizeLocalizedCmsMap(data.contentJsonByLocale) || null,
  categorySlug: typeof data.categorySlug === 'string' ? data.categorySlug : null,
  tags: Array.isArray(data.tags) ? data.tags.filter((item: unknown) => typeof item === 'string') : [],
  slugAliases: Array.isArray(data.slugAliases) ? data.slugAliases.filter((item: unknown) => typeof item === 'string') : [],
  seriesSlug: typeof data.seriesSlug === 'string' ? data.seriesSlug : null,
  relatedPostSlugs: Array.isArray(data.relatedPostSlugs) ? data.relatedPostSlugs.filter((item: unknown) => typeof item === 'string') : [],
  featuredUntil: (toDateValue(data.featuredUntil) as any) || null,
  coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : null,
  status: normalizeCmsStatus(data.status),
  featured: data.featured === true,
  seoTitle: typeof data.seoTitle === 'string' ? data.seoTitle : null,
  seoTitleByLocale: normalizeLocalizedCmsMap(data.seoTitleByLocale) || null,
  seoDescription: typeof data.seoDescription === 'string' ? data.seoDescription : null,
  seoDescriptionByLocale: normalizeLocalizedCmsMap(data.seoDescriptionByLocale) || null,
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
});

const toPublishedWindow = (entry: CmsBlogPost): boolean => {
  const publishedAt = toDateValue(entry.publishedAt);
  const unpublishAt = toDateValue(entry.scheduledUnpublishAt);
  return Boolean(
    publishedAt
    && publishedAt.getTime() <= Date.now()
    && (!unpublishAt || unpublishAt.getTime() > Date.now())
  );
};

export type CmsPublishedBlogPageCursor = string | null;
export type CmsPublishedBlogPage = {
  items: CmsBlogPost[];
  nextCursor: CmsPublishedBlogPageCursor;
};

const encodeBlogCursor = (entry: CmsBlogPost | null): CmsPublishedBlogPageCursor => {
  if (!entry) return null;
  const ts = toDateValue(entry.publishedAt)?.getTime();
  if (!ts || !entry.id) return null;
  return `${ts}:${entry.id}`;
};

const decodeBlogCursor = (cursor: CmsPublishedBlogPageCursor): { ts: number; id: string } | null => {
  if (!cursor) return null;
  const [tsRaw, id] = cursor.split(':');
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || !id) return null;
  return { ts, id };
};

const sortPublishedPostsForCursor = (items: CmsBlogPost[]): CmsBlogPost[] => (
  [...items].sort((a, b) => {
    const aTs = toDateValue(a.publishedAt)?.getTime() ?? 0;
    const bTs = toDateValue(b.publishedAt)?.getTime() ?? 0;
    if (aTs !== bTs) return bTs - aTs;
    return (b.id || '').localeCompare(a.id || '');
  })
);

const mapCmsPage = (id: string, data: Record<string, any>): CmsPage => ({
  id,
  slug: typeof data.slug === 'string' ? data.slug : '',
  title: typeof data.title === 'string' ? data.title : '',
  titleByLocale: normalizeLocalizedCmsMap(data.titleByLocale) || null,
  kind: normalizeCmsPageKind(data.kind),
  status: normalizeCmsStatus(data.status),
  contentJson: typeof data.contentJson === 'string' ? data.contentJson : null,
  contentJsonByLocale: normalizeLocalizedCmsMap(data.contentJsonByLocale) || null,
  excerpt: typeof data.excerpt === 'string' ? data.excerpt : null,
  excerptByLocale: normalizeLocalizedCmsMap(data.excerptByLocale) || null,
  seoTitle: typeof data.seoTitle === 'string' ? data.seoTitle : null,
  seoTitleByLocale: normalizeLocalizedCmsMap(data.seoTitleByLocale) || null,
  seoDescription: typeof data.seoDescription === 'string' ? data.seoDescription : null,
  seoDescriptionByLocale: normalizeLocalizedCmsMap(data.seoDescriptionByLocale) || null,
  seoCanonicalUrl: typeof data.seoCanonicalUrl === 'string' ? data.seoCanonicalUrl : null,
  seoNoIndex: data.seoNoIndex === true,
  seoNoFollow: data.seoNoFollow === true,
  ogTitle: typeof data.ogTitle === 'string' ? data.ogTitle : null,
  ogDescription: typeof data.ogDescription === 'string' ? data.ogDescription : null,
  ogImageUrl: typeof data.ogImageUrl === 'string' ? data.ogImageUrl : null,
  twitterImageUrl: typeof data.twitterImageUrl === 'string' ? data.twitterImageUrl : null,
  coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : null,
  slugAliases: Array.isArray(data.slugAliases) ? data.slugAliases.filter((item: unknown) => typeof item === 'string') : [],
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
});

export const getPublicCmsSettings = async (): Promise<CmsSettings> => {
  const ref = doc(db, COLLECTIONS.CMS_SETTINGS, CMS_SETTINGS_DOC_ID);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return {
      id: CMS_SETTINGS_DOC_ID,
      siteTitle: CMS_DEFAULTS.siteTitle,
      siteTagline: CMS_DEFAULTS.siteTagline,
      defaultSeoTitle: CMS_DEFAULTS.defaultSeoTitle,
      defaultSeoDescription: CMS_DEFAULTS.defaultSeoDescription,
      canonicalBaseUrl: CMS_DEFAULTS.canonicalBaseUrl,
      defaultOgImageUrl: CMS_DEFAULTS.defaultOgImageUrl,
      twitterHandle: CMS_DEFAULTS.twitterHandle,
      robotsPolicy: CMS_DEFAULTS.robotsPolicy,
      blogPostsPerPage: CMS_DEFAULTS.blogPostsPerPage,
      showFeaturedOnBlog: CMS_DEFAULTS.showFeaturedOnBlog,
      showBlogInFooter: CMS_DEFAULTS.showBlogInFooter,
      requireApprovalBeforePublish: CMS_DEFAULTS.requireApprovalBeforePublish,
      supportEmail: CMS_DEFAULTS.supportEmail,
      supportPhone: CMS_DEFAULTS.supportPhone,
      officeCity: CMS_DEFAULTS.officeCity,
      socialLinks: {},
      frontendAccess: normalizeFrontendAccess(null),
      updatedBy: '',
      createdAt: (new Date() as any),
      updatedAt: (new Date() as any),
    };
  }
  const data = snapshot.data() as Record<string, any>;
  return {
    id: snapshot.id,
    siteTitle: typeof data.siteTitle === 'string' && data.siteTitle.trim() ? data.siteTitle : CMS_DEFAULTS.siteTitle,
    siteTagline: typeof data.siteTagline === 'string' ? data.siteTagline : CMS_DEFAULTS.siteTagline,
    defaultSeoTitle: typeof data.defaultSeoTitle === 'string' ? data.defaultSeoTitle : CMS_DEFAULTS.defaultSeoTitle,
    defaultSeoDescription: typeof data.defaultSeoDescription === 'string' ? data.defaultSeoDescription : CMS_DEFAULTS.defaultSeoDescription,
    canonicalBaseUrl: typeof data.canonicalBaseUrl === 'string' && data.canonicalBaseUrl.trim()
      ? data.canonicalBaseUrl.trim().replace(/\/+$/, '')
      : CMS_DEFAULTS.canonicalBaseUrl,
    defaultOgImageUrl: typeof data.defaultOgImageUrl === 'string' ? data.defaultOgImageUrl : CMS_DEFAULTS.defaultOgImageUrl,
    twitterHandle: typeof data.twitterHandle === 'string' ? data.twitterHandle : CMS_DEFAULTS.twitterHandle,
    robotsPolicy: data.robotsPolicy === 'noindex_nofollow' ? 'noindex_nofollow' : CMS_DEFAULTS.robotsPolicy,
    blogPostsPerPage: Number.isFinite(data.blogPostsPerPage)
      ? Math.min(CMS_LIMITS.blogPostsPageSizeMax, Math.max(CMS_LIMITS.blogPostsPageSizeMin, Number(data.blogPostsPerPage)))
      : CMS_DEFAULTS.blogPostsPerPage,
    showFeaturedOnBlog: data.showFeaturedOnBlog !== false,
    showBlogInFooter: data.showBlogInFooter !== false,
    requireApprovalBeforePublish: data.requireApprovalBeforePublish === true,
    supportEmail: typeof data.supportEmail === 'string' ? data.supportEmail : CMS_DEFAULTS.supportEmail,
    supportPhone: typeof data.supportPhone === 'string' ? data.supportPhone : CMS_DEFAULTS.supportPhone,
    officeCity: typeof data.officeCity === 'string' ? data.officeCity : CMS_DEFAULTS.officeCity,
    socialLinks: data.socialLinks && typeof data.socialLinks === 'object' ? data.socialLinks : {},
    frontendAccess: normalizeFrontendAccess(data.frontendAccess),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    createdAt: (toDateValue(data.createdAt) as any) || (new Date() as any),
    updatedAt: (toDateValue(data.updatedAt) as any) || (new Date() as any),
  };
};

export const getPublishedBlogPosts = async (limitCount: number = CMS_QUERY_LIMITS.publicBlogList): Promise<CmsBlogPost[]> => {
  const now = Timestamp.now();
  const readFromPrimaryPosts = async (): Promise<CmsBlogPost[]> => {
    const snapshot = await withTimeout(getDocs(query(
      collection(db, COLLECTIONS.CMS_BLOG_POSTS),
      where('status', '==', 'published'),
      where('publishedAt', '<=', now),
      orderBy('publishedAt', 'desc'),
      limit(limitCount)
    )));
    return snapshot.docs
      .map((docSnap) => mapCmsBlogPost(docSnap.id, docSnap.data() as Record<string, any>))
      .filter((entry) => {
        const unpublishAt = toDateValue(entry.scheduledUnpublishAt);
        return !unpublishAt || unpublishAt.getTime() > Date.now();
      });
  };

  const readPrimaryFallback = async (): Promise<CmsBlogPost[]> => {
    const fallbackSnapshot = await withTimeout(getDocs(query(
      collection(db, COLLECTIONS.CMS_BLOG_POSTS),
      where('status', '==', 'published'),
      limit(limitCount)
    )));

    return fallbackSnapshot.docs
      .map((docSnap) => mapCmsBlogPost(docSnap.id, docSnap.data() as Record<string, any>))
      .filter(toPublishedWindow)
      .sort((a, b) => {
        const aTs = toDateValue(a.publishedAt)?.getTime() ?? 0;
        const bTs = toDateValue(b.publishedAt)?.getTime() ?? 0;
        return bTs - aTs;
      })
      .slice(0, limitCount);
  };

  try {
    const summarySnapshot = await withTimeout(getDocs(query(
      collection(db, COLLECTIONS.CMS_BLOG_POST_SUMMARIES),
      where('status', '==', 'published'),
      where('publishedAt', '<=', now),
      orderBy('publishedAt', 'desc'),
      limit(limitCount)
    )));
    const summaryRows = summarySnapshot.docs
      .map((docSnap) => mapCmsBlogPost(docSnap.id, docSnap.data() as Record<string, any>))
      .filter((entry) => {
        const unpublishAt = toDateValue(entry.scheduledUnpublishAt);
        return !unpublishAt || unpublishAt.getTime() > Date.now();
      });
    if (summaryRows.length === 0) return await readFromPrimaryPosts();
    if (summaryRows.length >= limitCount) return summaryRows;

    // Top up from primary posts when summaries are partially synced.
    const primaryRows = await readFromPrimaryPosts();
    const byId = new Map<string, CmsBlogPost>();
    summaryRows.forEach((row) => {
      if (row.id) byId.set(row.id, row);
    });
    primaryRows.forEach((row) => {
      if (row.id && !byId.has(row.id)) byId.set(row.id, row);
    });
    return Array.from(byId.values())
      .sort((a, b) => {
        const aTs = toDateValue(a.publishedAt)?.getTime() ?? 0;
        const bTs = toDateValue(b.publishedAt)?.getTime() ?? 0;
        return bTs - aTs;
      })
      .slice(0, limitCount);
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
    const canFallback = code.includes('failed-precondition') || code.includes('invalid-argument') || code.includes('deadline-exceeded');
    if (!canFallback) {
      try {
        return await readFromPrimaryPosts();
      } catch {
        throw error;
      }
    }
    return await readPrimaryFallback();
  }
};

export const getPublishedBlogPostsPage = async (options?: {
  pageSize?: number;
  cursor?: CmsPublishedBlogPageCursor;
}): Promise<CmsPublishedBlogPage> => {
  const pageSize = Math.max(3, Math.min(24, Number(options?.pageSize || 9)));
  const decoded = decodeBlogCursor(options?.cursor || null);
  const now = Timestamp.now();
  const readBucketRows = async (
    collectionName: string,
    queryConstraints: QueryConstraint[],
    limitCount: number,
  ): Promise<CmsBlogPost[]> => {
    const snapshot = await withTimeout(getDocs(query(
      collection(db, collectionName),
      ...queryConstraints,
      limit(limitCount)
    )));
    return snapshot.docs
      .map((docSnap) => mapCmsBlogPost(docSnap.id, docSnap.data() as Record<string, any>))
      .filter(toPublishedWindow);
  };

  const readRows = async (collectionName: string): Promise<CmsBlogPost[]> => {
    if (!decoded) {
      return readBucketRows(collectionName, [
        where('status', '==', CMS_STATUS.published),
        where('publishedAt', '<=', now),
        orderBy('publishedAt', 'desc'),
      ], pageSize + 1);
    }

    const cursorTimestamp = Timestamp.fromMillis(decoded.ts);
    const exactTimestampRows = sortPublishedPostsForCursor(await readBucketRows(collectionName, [
      where('status', '==', CMS_STATUS.published),
      where('publishedAt', '==', cursorTimestamp),
      orderBy('publishedAt', 'desc'),
    ], Math.max(pageSize * 4, 48)));

    const exactCursorIndex = exactTimestampRows.findIndex((entry) => entry.id === decoded.id);
    const trailingSameTimestampRows = exactCursorIndex >= 0
      ? exactTimestampRows.slice(exactCursorIndex + 1, exactCursorIndex + 1 + pageSize)
      : [];

    if (trailingSameTimestampRows.length >= pageSize) {
      return trailingSameTimestampRows;
    }

    const olderRows = await readBucketRows(collectionName, [
      where('status', '==', CMS_STATUS.published),
      where('publishedAt', '<', cursorTimestamp),
      orderBy('publishedAt', 'desc'),
    ], pageSize - trailingSameTimestampRows.length + 1);

    return [...trailingSameTimestampRows, ...olderRows];
  };

  try {
    const rows = await readRows(COLLECTIONS.CMS_BLOG_POST_SUMMARIES);
    const sliced = rows.slice(0, pageSize);
    return {
      items: sliced,
      nextCursor: rows.length > pageSize ? encodeBlogCursor(sliced[sliced.length - 1] || null) : null,
    };
  } catch {
    const rows = await readRows(COLLECTIONS.CMS_BLOG_POSTS);
    const sliced = rows.slice(0, pageSize);
    return {
      items: sliced,
      nextCursor: rows.length > pageSize ? encodeBlogCursor(sliced[sliced.length - 1] || null) : null,
    };
  }
};

export const getPublishedBlogPostBySlug = async (slug: string): Promise<CmsBlogPost | null> => {
  const now = Timestamp.now();
  const isLive = (entry: CmsBlogPost | null): entry is CmsBlogPost => {
    if (!entry) return false;
    const publishedAt = toDateValue(entry.publishedAt);
    const unpublishAt = toDateValue(entry.scheduledUnpublishAt);
    return entry.status === CMS_STATUS.published
      && Boolean(publishedAt && publishedAt.getTime() <= Date.now())
      && (!unpublishAt || unpublishAt.getTime() > Date.now());
  };
  const queryOne = async (collectionName: string, constraints: QueryConstraint[]): Promise<CmsBlogPost | null> => {
    try {
      const snapshot = await withTimeout(getDocs(query(collection(db, collectionName), ...constraints)));
      const first = snapshot.docs[0];
      if (!first) return null;
      const mapped = mapCmsBlogPost(first.id, first.data() as Record<string, any>);
      return isLive(mapped) ? mapped : null;
    } catch {
      return null;
    }
  };
  const queryManyCandidate = async (collectionName: string, constraints: QueryConstraint[]): Promise<CmsBlogPost | null> => {
    try {
      const snapshot = await withTimeout(getDocs(query(collection(db, collectionName), ...constraints)));
      const candidate = snapshot.docs
        .map((docSnap) => mapCmsBlogPost(docSnap.id, docSnap.data() as Record<string, any>))
        .find((entry) => isLive(entry));
      return candidate || null;
    } catch {
      return null;
    }
  };
  const getByDocId = async (collectionName: string, docId: string): Promise<CmsBlogPost | null> => {
    try {
      const snapshot = await withTimeout(getDoc(doc(db, collectionName, docId)));
      if (!snapshot.exists()) return null;
      const mapped = mapCmsBlogPost(snapshot.id, snapshot.data() as Record<string, any>);
      return isLive(mapped) ? mapped : null;
    } catch {
      return null;
    }
  };

  const collectionsInOrder = [COLLECTIONS.CMS_BLOG_POSTS, COLLECTIONS.CMS_BLOG_POST_SUMMARIES];
  for (const collectionName of collectionsInOrder) {
    const directIndexed = await queryOne(collectionName, [
      where('slug', '==', slug),
      where('status', '==', CMS_STATUS.published),
      where('publishedAt', '<=', now),
      limit(1),
    ]);
    if (directIndexed) return directIndexed;

    const directFallback = await queryOne(collectionName, [
      where('slug', '==', slug),
      where('status', '==', CMS_STATUS.published),
      limit(1),
    ]);
    if (directFallback) return directFallback;

    const byDocId = await getByDocId(collectionName, getCmsPostDocId(slug));
    if (byDocId) return byDocId;

    const aliasIndexed = await queryOne(collectionName, [
      where('slugAliases', 'array-contains', slug),
      where('status', '==', CMS_STATUS.published),
      where('publishedAt', '<=', now),
      limit(1),
    ]);
    if (aliasIndexed) return aliasIndexed;

    const aliasFallback = await queryOne(collectionName, [
      where('slugAliases', 'array-contains', slug),
      where('status', '==', CMS_STATUS.published),
      limit(1),
    ]);
    if (aliasFallback) return aliasFallback;

    const aliasSafe = await queryManyCandidate(collectionName, [
      where('slugAliases', 'array-contains', slug),
      limit(3),
    ]);
    if (aliasSafe) return aliasSafe;
  }

  return null;
};

export const getPublishedCmsPageBySlug = async (slug: string): Promise<CmsPage | null> => {
  const now = Timestamp.now();
  try {
    const snapshot = await withTimeout(getDocs(query(
      collection(db, COLLECTIONS.CMS_PAGES),
      where('slug', '==', slug),
      where('status', '==', 'published'),
      where('publishedAt', '<=', now),
      limit(1)
    )));

    const first = snapshot.docs[0];
    if (first) {
      const mapped = mapCmsPage(first.id, first.data() as Record<string, any>);
      const unpublishAt = toDateValue(mapped.scheduledUnpublishAt);
      if (!unpublishAt || unpublishAt.getTime() > Date.now()) return mapped;
    }

    const aliasSnapshot = await withTimeout(getDocs(query(
      collection(db, COLLECTIONS.CMS_PAGES),
      where('slugAliases', 'array-contains', slug),
      where('status', '==', 'published'),
      where('publishedAt', '<=', now),
      limit(1)
    )));
    const aliasFirst = aliasSnapshot.docs[0];
    if (!aliasFirst) return null;
    const aliasMapped = mapCmsPage(aliasFirst.id, aliasFirst.data() as Record<string, any>);
    const aliasUnpublishAt = toDateValue(aliasMapped.scheduledUnpublishAt);
    if (aliasUnpublishAt && aliasUnpublishAt.getTime() <= Date.now()) return null;
    return aliasMapped;
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
    const canFallback = code.includes('failed-precondition') || code.includes('invalid-argument') || code.includes('deadline-exceeded');
    if (!canFallback) throw error;

    const fallbackSnapshot = await withTimeout(getDocs(query(
      collection(db, COLLECTIONS.CMS_PAGES),
      where('slug', '==', slug),
      where('status', '==', 'published'),
      limit(1)
    )));
    const first = fallbackSnapshot.docs[0];
    if (first) {
      const mapped = mapCmsPage(first.id, first.data() as Record<string, any>);
      const publishedAt = toDateValue(mapped.publishedAt);
      const unpublishAt = toDateValue(mapped.scheduledUnpublishAt);
      if (publishedAt && publishedAt.getTime() <= Date.now() && (!unpublishAt || unpublishAt.getTime() > Date.now())) return mapped;
    }

    try {
      const aliasFallbackSnapshot = await withTimeout(getDocs(query(
        collection(db, COLLECTIONS.CMS_PAGES),
        where('slugAliases', 'array-contains', slug),
        where('status', '==', 'published'),
        limit(1)
      )));
      const aliasFirst = aliasFallbackSnapshot.docs[0];
      if (!aliasFirst) return null;
      const aliasMapped = mapCmsPage(aliasFirst.id, aliasFirst.data() as Record<string, any>);
      const aliasPublishedAt = toDateValue(aliasMapped.publishedAt);
      const aliasUnpublishAt = toDateValue(aliasMapped.scheduledUnpublishAt);
      if (!aliasPublishedAt || aliasPublishedAt.getTime() > Date.now()) return null;
      if (aliasUnpublishAt && aliasUnpublishAt.getTime() <= Date.now()) return null;
      return aliasMapped;
    } catch {
      // Runtime-safe alias fallback for missing composite indexes.
      const aliasFallbackSnapshot = await withTimeout(getDocs(query(
        collection(db, COLLECTIONS.CMS_PAGES),
        where('slugAliases', 'array-contains', slug),
        limit(3)
      )));
      const candidate = aliasFallbackSnapshot.docs
        .map((docSnap) => mapCmsPage(docSnap.id, docSnap.data() as Record<string, any>))
        .find((entry) => {
          const publishedAt = toDateValue(entry.publishedAt);
          const unpublishAt = toDateValue(entry.scheduledUnpublishAt);
          return entry.status === CMS_STATUS.published
            && Boolean(publishedAt && publishedAt.getTime() <= Date.now())
            && (!unpublishAt || unpublishAt.getTime() > Date.now());
        });
      return candidate || null;
    }
  }
};

const normalizeMenuItems = (value: unknown): CmsNavMenu['items'] => {
  if (!Array.isArray(value)) return [];

  const hasUnsafeScheme = (path: string): boolean => /^(javascript|data|vbscript):/i.test(path);
  const isExternalPath = (path: string): boolean => /^(https?:\/\/|mailto:|tel:)/i.test(path);
  const isValidInternalPath = (path: string): boolean => /^\/[^\s]*$/.test(path);

  return value
    .filter((item) => Boolean(item && typeof item === 'object'))
    .map((item: any) => ({
      id: typeof item.id === 'string' ? item.id : '',
      label: typeof item.label === 'string' ? item.label : '',
      path: typeof item.path === 'string' ? item.path.trim() : '',
      external: item.external === true,
      order: Number.isFinite(item.order) ? Number(item.order) : 0,
      enabled: item.enabled !== false,
    }))
    .map((item) => ({
      ...item,
      external: item.external || isExternalPath(item.path),
    }))
    .filter((item) => {
      if (!item.id || !item.label || !item.path || !item.enabled) return false;
      if (hasUnsafeScheme(item.path)) return false;
      return item.external ? isExternalPath(item.path) : isValidInternalPath(item.path);
    })
    .sort((a, b) => a.order - b.order);
};

export const getPublicCmsMenuByLocation = async (location: CmsMenuLocation): Promise<CmsNavMenu | null> => {
  const fallbackRead = async (): Promise<CmsNavMenu | null> => {
    const fallbackSnap = await getDocs(query(
      collection(db, COLLECTIONS.CMS_NAV_MENUS),
      where('location', '==', location),
      where('status', '==', CMS_STATUS.published),
      limit(1)
    ));
    const first = fallbackSnap.docs[0];
    if (!first) return null;
    const data = first.data() as Record<string, any>;
    return {
      id: first.id,
      location,
      status: CMS_STATUS.published,
      items: normalizeMenuItems(data.items),
      updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
      createdAt: toDateValue(data.createdAt) as any,
      updatedAt: toDateValue(data.updatedAt) as any,
    };
  };

  try {
    const canonicalRef = doc(db, COLLECTIONS.CMS_NAV_MENUS, getCmsMenuDocId(location));
    const canonicalSnap = await getDoc(canonicalRef);

    if (canonicalSnap.exists()) {
      const data = canonicalSnap.data() as Record<string, any>;
      if (!data.status || data.status === CMS_STATUS.published) {
        return {
          id: canonicalSnap.id,
          location,
          status: normalizeCmsStatus(data.status),
          items: normalizeMenuItems(data.items),
          updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
          createdAt: toDateValue(data.createdAt) as any,
          updatedAt: toDateValue(data.updatedAt) as any,
        };
      }
      return null;
    }

    return await fallbackRead();
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
    if (code.includes('permission-denied') || code.includes('unauthenticated')) {
      try {
        return await fallbackRead();
      } catch {
        return null;
      }
    }
    throw error;
  }
};
