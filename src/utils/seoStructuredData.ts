export type JsonLd = Record<string, unknown>;

type BaseInput = {
  baseUrl: string;
  path?: string;
};

const normalizeBase = (baseUrl: string): string => {
  const normalized = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!normalized) {
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin.replace(/\/+$/, '');
    return '';
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Unsupported protocol');
    return parsed.origin.replace(/\/+$/, '');
  } catch {
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin.replace(/\/+$/, '');
    return '';
  }
};

const toAbsoluteUrl = ({ baseUrl, path = '' }: BaseInput): string => {
  const base = normalizeBase(baseUrl);
  const safePath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${safePath}`;
};

export const buildOrganizationSchema = (input: {
  baseUrl: string;
  siteName: string;
  logoUrl?: string | null;
  sameAs?: string[];
}): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: input.siteName,
  url: normalizeBase(input.baseUrl),
  ...(input.logoUrl ? { logo: input.logoUrl } : {}),
  ...(input.sameAs && input.sameAs.length ? { sameAs: input.sameAs } : {}),
});

export const buildWebSiteSchema = (input: {
  baseUrl: string;
  siteName: string;
  description?: string;
}): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: input.siteName,
  url: normalizeBase(input.baseUrl),
  ...(input.description ? { description: input.description } : {}),
});

export const buildBreadcrumbSchema = (input: {
  baseUrl: string;
  items: Array<{ name: string; path: string }>;
}): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: input.items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: toAbsoluteUrl({ baseUrl: input.baseUrl, path: item.path }),
  })),
});

export const buildBlogSchema = (input: {
  baseUrl: string;
  siteName: string;
  description: string;
  path: string;
}): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: `${input.siteName} Blog`,
  description: input.description,
  url: toAbsoluteUrl({ baseUrl: input.baseUrl, path: input.path }),
});

export const buildWebPageSchema = (input: {
  baseUrl: string;
  path: string;
  name: string;
  description?: string;
}): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: input.name,
  url: toAbsoluteUrl({ baseUrl: input.baseUrl, path: input.path }),
  ...(input.description ? { description: input.description } : {}),
});

export const buildArticleSchema = (input: {
  baseUrl: string;
  path: string;
  headline: string;
  description: string;
  imageUrl?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  authorName?: string | null;
  publisherName?: string;
}): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  mainEntityOfPage: toAbsoluteUrl({ baseUrl: input.baseUrl, path: input.path }),
  headline: input.headline,
  description: input.description,
  ...(input.imageUrl ? { image: [input.imageUrl] } : {}),
  ...(input.datePublished ? { datePublished: input.datePublished } : {}),
  ...(input.dateModified ? { dateModified: input.dateModified } : {}),
  author: {
    '@type': 'Person',
    name: input.authorName || 'BloodHub Editorial Team',
  },
  ...(input.publisherName
    ? {
      publisher: {
        '@type': 'Organization',
        name: input.publisherName,
      },
    }
    : {}),
});
