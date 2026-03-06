import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CMS_CACHE, CMS_QUERY_LIMITS, toCmsSlug, type CmsMenuLocation } from '../constants/cms';
import type { CmsBlogPost, CmsNavMenu, CmsPage, CmsSettings } from '../types/database.types';
import {
  getPublicCmsMenuByLocation,
  getPublicCmsSettings,
  getPublishedBlogPostBySlug,
  getPublishedBlogPosts,
  getPublishedCmsPageBySlug,
} from '../services/cms.service';

const cmsPublicQueryKeys = {
  settings: ['cms', 'public', 'settings'] as const,
  blogPosts: (limitCount: number) => ['cms', 'public', 'blogPosts', { limitCount }] as const,
  blogPostBySlug: (slug: string) => ['cms', 'public', 'blogPostBySlug', slug] as const,
  pageBySlug: (slug: string) => ['cms', 'public', 'pageBySlug', slug] as const,
  menuByLocation: (location: CmsMenuLocation) => ['cms', 'public', 'menuByLocation', location] as const,
};

const BLOG_CACHE_KEY = 'cms_public_blog_posts_v1';

const readCachedBlogPosts = (): CmsBlogPost[] | undefined => {
  if (typeof window === 'undefined' || !window.sessionStorage) return undefined;
  try {
    const raw = window.sessionStorage.getItem(BLOG_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { savedAt?: number; data?: CmsBlogPost[] };
    if (!parsed?.savedAt || !Array.isArray(parsed.data) || Date.now() - parsed.savedAt > CMS_CACHE.ttl) return undefined;
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
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(BLOG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: posts }));
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
  const query = useQuery<CmsBlogPost[]>({
    queryKey: cmsPublicQueryKeys.blogPosts(limitCount),
    queryFn: () => getPublishedBlogPosts(limitCount),
    initialData: () => readCachedBlogPosts(),
    staleTime: 0,
    gcTime: CMS_CACHE.gcTime,
    enabled,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (!query.data?.length) return;
    writeCachedBlogPosts(query.data);
  }, [query.data]);

  return query;
};

export const usePublishedBlogPostBySlug = (slug: string) => useQuery<CmsBlogPost | null>({
  queryKey: cmsPublicQueryKeys.blogPostBySlug(toCmsSlug(slug)),
  queryFn: () => getPublishedBlogPostBySlug(toCmsSlug(slug)),
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
});
