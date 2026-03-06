import { FIFTEEN_MINUTES_MS } from './time';
import { ROUTES } from './routes';

export const CMS_STATUS = {
  draft: 'draft',
  scheduled: 'scheduled',
  published: 'published',
  archived: 'archived',
} as const;

export type CmsStatus = (typeof CMS_STATUS)[keyof typeof CMS_STATUS];

export const CMS_PAGE_KIND = {
  generic: 'generic',
  homeSection: 'home_section',
  aboutSection: 'about_section',
  contactSection: 'contact_section',
} as const;

export type CmsPageKind = (typeof CMS_PAGE_KIND)[keyof typeof CMS_PAGE_KIND];

export const CMS_MENU_LOCATION = {
  header: 'header',
  footerResources: 'footer_resources',
  footerLegal: 'footer_legal',
} as const;

export type CmsMenuLocation = (typeof CMS_MENU_LOCATION)[keyof typeof CMS_MENU_LOCATION];

export const CMS_LIMITS = {
  title: 140,
  slug: 120,
  excerpt: 320,
  seoTitle: 70,
  seoDescription: 180,
  contentJson: 20000,
  tagsPerPost: 20,
  menuItemsPerMenu: 50,
  blogPostsPageSizeMin: 3,
  blogPostsPageSizeMax: 24,
  canonicalUrl: 300,
  twitterHandle: 30,
} as const;

export const CMS_DEFAULTS = {
  siteTitle: 'BloodHub India',
  siteTagline: 'Donate blood, save lives.',
  defaultSeoTitle: 'BloodHub India',
  defaultSeoDescription: 'Blood donation platform connecting donors, NGOs and blood banks.',
  canonicalBaseUrl: 'https://bloodhubindia.com',
  defaultOgImageUrl: '',
  twitterHandle: '',
  robotsPolicy: 'index_follow',
  blogPostsPerPage: 9,
  showFeaturedOnBlog: true,
  showBlogInFooter: true,
  supportEmail: 'contact@bloodhub.in',
  supportPhone: '+91 1800-123-456',
  officeCity: 'Mumbai, Maharashtra',
} as const;

export const CMS_FRONTEND_PAGE_PRESETS = [
  { key: 'home', label: 'Home Page', slug: 'home', path: ROUTES.home, kind: CMS_PAGE_KIND.homeSection },
  { key: 'find-donors', label: 'Find Donors', slug: 'find-donors', path: ROUTES.donors, kind: CMS_PAGE_KIND.generic },
  { key: 'request-blood', label: 'Request Blood', slug: 'request-blood', path: ROUTES.requestBlood, kind: CMS_PAGE_KIND.generic },
  { key: 'about', label: 'About', slug: 'about', path: ROUTES.about, kind: CMS_PAGE_KIND.aboutSection },
  { key: 'contact', label: 'Contact', slug: 'contact', path: ROUTES.contact, kind: CMS_PAGE_KIND.contactSection },
] as const;

export const CMS_QUERY_LIMITS = {
  adminList: 1000,
  publicBlogList: 48,
  publicPages: 200,
} as const;

export const CMS_CACHE = {
  staleTime: FIFTEEN_MINUTES_MS,
  gcTime: 30 * FIFTEEN_MINUTES_MS,
  ttl: FIFTEEN_MINUTES_MS,
} as const;

export const CMS_FEATURE_FLAGS = {
  simplifiedEditorMode: true,
} as const;

export const isValidCmsSlug = (slug: string): boolean => (
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= CMS_LIMITS.slug
);

export const toCmsSlug = (value: string): string => (
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CMS_LIMITS.slug)
);

export const getCmsPostDocId = (slug: string): string => `post_${slug}`;
export const getCmsPageDocId = (slug: string): string => `page_${slug}`;
export const getCmsCategoryDocId = (slug: string): string => `category_${slug}`;
export const getCmsMenuDocId = (location: CmsMenuLocation): string => `menu_${location}`;
export const CMS_SETTINGS_DOC_ID = 'global';

export const CMS_FRONTEND_PAGE_SCHEMA_VERSION = 1 as const;
export const CMS_FRONTEND_PAGE_SLUGS = [
  'home',
  'find-donors',
  'request-blood',
  'about',
  'contact',
] as const;
export type CmsFrontendPageSlug = (typeof CMS_FRONTEND_PAGE_SLUGS)[number];

export const isCmsFrontendPageSlug = (value: string): value is CmsFrontendPageSlug => (
  (CMS_FRONTEND_PAGE_SLUGS as readonly string[]).includes(value)
);
