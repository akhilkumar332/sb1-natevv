import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CMS_CACHE, CMS_QUERY_LIMITS, CMS_RUNTIME, toCmsSlug, type CmsMenuLocation } from '../constants/cms';
import type { CmsBlogPost, CmsNavMenu, CmsPage, CmsSettings } from '../types/database.types';
import {
  getPublicCmsMenuByLocation,
  getPublicCmsSettings,
  getPublishedBlogPostsPage,
  getPublishedBlogPostBySlug,
  getPublishedBlogPosts,
  getPublishedCmsPageBySlug,
  type CmsPublishedBlogPageCursor,
  type CmsPublishedBlogPage,
} from '../services/cms.service';

const cmsPublicQueryKeys = {
  settings: ['cms', 'public', 'settings'] as const,
  blogPosts: (limitCount: number) => ['cms', 'public', 'blogPosts', { limitCount }] as const,
  blogPostBySlug: (slug: string) => ['cms', 'public', 'blogPostBySlug', slug] as const,
  blogPostsPage: (pageSize: number, cursor: string | null) => ['cms', 'public', 'blogPostsPage', { pageSize, cursor }] as const,
  pageBySlug: (slug: string) => ['cms', 'public', 'pageBySlug', slug] as const,
  menuByLocation: (location: CmsMenuLocation) => ['cms', 'public', 'menuByLocation', location] as const,
};

const BLOG_CACHE_KEY = 'cms_public_blog_posts_v1';
const BLOG_CACHE_SCHEMA_VERSION = 2;

type BlogCacheEnvelope = {
  schemaVersion: number;
  savedAt: number;
  data: CmsBlogPost[];
};

const readCachedBlogPosts = (): CmsBlogPost[] | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage?.getItem(BLOG_CACHE_KEY) || window.sessionStorage?.getItem(BLOG_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as BlogCacheEnvelope;
    if (parsed?.schemaVersion !== BLOG_CACHE_SCHEMA_VERSION || !parsed?.savedAt || !Array.isArray(parsed.data) || Date.now() - parsed.savedAt > CMS_CACHE.ttl) return undefined;
    return parsed.data.map((entry) => ({
      ...entry,
      publishedAt: entry.publishedAt ? new Date(entry.publishedAt as unknown as string) as any : null,
      createdAt: entry.createdAt ? new Date(entry.createdAt as unknown as string) as any : null,
      updatedAt: entry.updatedAt ? new Date(entry.updatedAt as unknown as string) as any : null,
    }));
  } catch {
    return undefined;
  }
};

const writeCachedBlogPosts = (posts: CmsBlogPost[]): void => {
  if (typeof window === 'undefined') return;
  try {
    const payload: BlogCacheEnvelope = {
      schemaVersion: BLOG_CACHE_SCHEMA_VERSION,
      savedAt: Date.now(),
      data: posts,
    };
    const serialized = JSON.stringify(payload);
    window.sessionStorage?.setItem(BLOG_CACHE_KEY, serialized);
    window.localStorage?.setItem(BLOG_CACHE_KEY, serialized);
  } catch {
    // Keep public blog rendering resilient if cache writes fail.
  }
};

export const usePublicCmsSettings = () => useQuery<CmsSettings>({
  queryKey: cmsPublicQueryKeys.settings,
  queryFn: getPublicCmsSettings,
  staleTime: CMS_CACHE.staleTime,
  gcTime: CMS_CACHE.gcTime,
});

export const usePublishedBlogPosts = (
  limitCount: number = CMS_QUERY_LIMITS.publicBlogList,
  enabled: boolean = true
) => {
  const queryClient = useQueryClient();
  const query = useQuery<CmsBlogPost[]>({
    queryKey: cmsPublicQueryKeys.blogPosts(limitCount),
    queryFn: () => getPublishedBlogPosts(limitCount),
    initialData: () => readCachedBlogPosts(),
    staleTime: CMS_CACHE.staleTime,
    gcTime: CMS_CACHE.gcTime,
    enabled,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (!query.data?.length) return;
    writeCachedBlogPosts(query.data);

    // These rows come from `cmsBlogPostSummaries`, which deliberately omits
    // `contentJson`. Seeding them into the per-slug detail cache gives the
    // article view an instant header/cover paint, but they must be marked stale
    // or React Query serves the bodyless summary for the whole staleTime window
    // and never calls getPublishedBlogPostBySlug -- which is the only thing that
    // reads the full document. That is what made every article render the
    // "content coming soon" placeholder.
    const seed = (key: readonly unknown[], entry: CmsBlogPost) => {
      const existing = queryClient.getQueryData<CmsBlogPost | null>(key);
      // Never downgrade a full post that has already been fetched.
      if (existing?.contentJson) return;
      queryClient.setQueryData<CmsBlogPost | null>(
        key,
        entry,
        entry.contentJson ? undefined : { updatedAt: 0 },
      );
    };

    query.data.forEach((entry) => {
      if (!entry.slug) return;
      seed(cmsPublicQueryKeys.blogPostBySlug(entry.slug), entry);
      (entry.slugAliases || []).forEach((alias) => {
        if (!alias) return;
        seed(cmsPublicQueryKeys.blogPostBySlug(alias), entry);
      });
    });
  }, [query.data, queryClient]);

  useEffect(() => {
    if (!enabled || !query.data?.length) return;
    if (Date.now() - query.dataUpdatedAt < CMS_RUNTIME.blogCacheBackgroundRefreshMs) return;
    void query.refetch();
  }, [enabled, query.data, query.dataUpdatedAt, query.refetch]);

  return query;
};

export const usePublishedBlogPostsPage = (
  pageSize: number = 9,
  cursor: CmsPublishedBlogPageCursor = null,
  enabled: boolean = true,
) => useQuery<CmsPublishedBlogPage>({
  queryKey: cmsPublicQueryKeys.blogPostsPage(pageSize, cursor),
  queryFn: () => getPublishedBlogPostsPage({ pageSize, cursor }),
  enabled,
  staleTime: CMS_CACHE.staleTime,
  gcTime: CMS_CACHE.gcTime,
  retry: 1,
});

const readCachedBlogPostBySlug = (slug: string): CmsBlogPost | null => {
  const normalizedSlug = toCmsSlug(slug);
  if (!normalizedSlug) return null;
  const cached = readCachedBlogPosts();
  if (!cached?.length) return null;
  return cached.find((entry) => (
    entry.slug === normalizedSlug
    || (Array.isArray(entry.slugAliases) && entry.slugAliases.includes(normalizedSlug))
  )) || null;
};

export const usePublishedBlogPostBySlug = (slug: string) => useQuery<CmsBlogPost | null>({
  queryKey: cmsPublicQueryKeys.blogPostBySlug(toCmsSlug(slug)),
  queryFn: () => getPublishedBlogPostBySlug(toCmsSlug(slug)),
  initialData: () => readCachedBlogPostBySlug(slug),
  // The localStorage blog cache stores list rows, which are summaries without
  // `contentJson`. Treating one as fresh would suppress the fetch of the full
  // document and render an empty article body, so age it out immediately.
  // A cached entry that does carry content keeps normal freshness.
  initialDataUpdatedAt: () => (readCachedBlogPostBySlug(slug)?.contentJson ? Date.now() : 0),
  enabled: Boolean(toCmsSlug(slug)),
  staleTime: CMS_CACHE.staleTime,
  gcTime: CMS_CACHE.gcTime,
});

export const usePublishedCmsPageBySlug = (slug: string) => useQuery<CmsPage | null>({
  queryKey: cmsPublicQueryKeys.pageBySlug(toCmsSlug(slug)),
  queryFn: () => getPublishedCmsPageBySlug(toCmsSlug(slug)),
  enabled: Boolean(toCmsSlug(slug)),
  staleTime: CMS_CACHE.staleTime,
  gcTime: CMS_CACHE.gcTime,
});

export const usePublicCmsMenu = (location: CmsMenuLocation) => useQuery<CmsNavMenu | null>({
  queryKey: cmsPublicQueryKeys.menuByLocation(location),
  queryFn: () => getPublicCmsMenuByLocation(location),
  staleTime: CMS_CACHE.staleTime,
  gcTime: CMS_CACHE.gcTime,
  retry: false,
});
