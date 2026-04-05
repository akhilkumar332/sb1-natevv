import type { CmsBlogPost } from '../types/database.types';

type CmsBlogPostLike = {
  slug: string;
  title: string;
  titleByLocale?: Record<string, string> | null;
  status: CmsBlogPost['status'];
  excerpt?: string | null;
  excerptByLocale?: Record<string, string> | null;
  contentJsonByLocale?: Record<string, string> | null;
  categorySlug?: string | null;
  tags?: string[];
  coverImageUrl?: string | null;
  slugAliases?: string[];
  seriesSlug?: string | null;
  relatedPostSlugs?: string[];
  featuredUntil?: unknown;
  featured?: boolean;
  seoTitle?: string | null;
  seoTitleByLocale?: Record<string, string> | null;
  seoDescription?: string | null;
  seoDescriptionByLocale?: Record<string, string> | null;
  seoCanonicalUrl?: string | null;
  seoNoIndex?: boolean;
  seoNoFollow?: boolean;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  twitterImageUrl?: string | null;
  authorName?: string | null;
  workflowAssignee?: string | null;
  reviewStatus?: 'not_requested' | 'in_review' | 'approved' | 'changes_requested';
  reviewNotes?: string | null;
  scheduledPublishAt?: unknown;
  scheduledUnpublishAt?: unknown;
  version?: number;
  publishedAt?: unknown;
  createdBy: string;
  updatedBy: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export const toCmsBlogSummaryPayload = (post: CmsBlogPostLike) => ({
  slug: post.slug,
  title: post.title,
  titleByLocale: post.titleByLocale ?? null,
  excerpt: post.excerpt ?? null,
  excerptByLocale: post.excerptByLocale ?? null,
  contentJsonByLocale: post.contentJsonByLocale ?? null,
  categorySlug: post.categorySlug ?? null,
  tags: post.tags || [],
  coverImageUrl: post.coverImageUrl ?? null,
  slugAliases: post.slugAliases || [],
  seriesSlug: post.seriesSlug ?? null,
  relatedPostSlugs: post.relatedPostSlugs || [],
  featuredUntil: post.featuredUntil ?? null,
  status: post.status,
  featured: post.featured === true,
  seoTitle: post.seoTitle ?? null,
  seoTitleByLocale: post.seoTitleByLocale ?? null,
  seoDescription: post.seoDescription ?? null,
  seoDescriptionByLocale: post.seoDescriptionByLocale ?? null,
  seoCanonicalUrl: post.seoCanonicalUrl ?? null,
  seoNoIndex: post.seoNoIndex === true,
  seoNoFollow: post.seoNoFollow === true,
  ogTitle: post.ogTitle ?? null,
  ogDescription: post.ogDescription ?? null,
  ogImageUrl: post.ogImageUrl ?? null,
  twitterImageUrl: post.twitterImageUrl ?? null,
  authorName: post.authorName ?? null,
  workflowAssignee: post.workflowAssignee ?? null,
  reviewStatus: post.reviewStatus || 'not_requested',
  reviewNotes: post.reviewNotes ?? null,
  scheduledPublishAt: post.scheduledPublishAt ?? null,
  scheduledUnpublishAt: post.scheduledUnpublishAt ?? null,
  version: post.version || 1,
  publishedAt: post.publishedAt ?? null,
  createdBy: post.createdBy,
  updatedBy: post.updatedBy,
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
});
