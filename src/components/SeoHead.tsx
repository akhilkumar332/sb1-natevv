import { useEffect } from 'react';

type SeoHeadProps = {
  title: string;
  description?: string | null;
  type?: 'website' | 'article';
  siteName?: string | null;
  locale?: string | null;
  canonicalPath?: string;
  canonicalBaseUrl?: string | null;
  canonicalUrl?: string | null;
  ogImageUrl?: string | null;
  twitterImageUrl?: string | null;
  twitterHandle?: string | null;
  publishedTime?: string | null;
  modifiedTime?: string | null;
  authorName?: string | null;
  robots?: 'index,follow' | 'noindex,nofollow';
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>> | null;
};

const DEFAULT_DESCRIPTION = 'Blood donation platform connecting donors, NGOs and blood banks.';

const upsertMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
  const head = document.head;
  let node = head.querySelector(selector) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attr, key);
    head.appendChild(node);
  }
  node.setAttribute('content', content);
};

const removeMeta = (selector: string) => {
  const node = document.head.querySelector(selector);
  if (node) node.remove();
};

const toSafeAbsoluteUrl = (value?: string | null): string | null => {
  const raw = (value || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const upsertScript = (id: string, payload: Record<string, unknown> | null) => {
  const head = document.head;
  const selector = `script[data-seo-jsonld="${id}"]`;
  const existing = head.querySelector(selector);
  if (!payload) {
    if (existing) existing.remove();
    return;
  }
  const script = (existing as HTMLScriptElement) || document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-seo-jsonld', id);
  script.text = JSON.stringify(payload);
  if (!existing) head.appendChild(script);
};

const removeMetaIfExists = (selector: string) => {
  const node = document.head.querySelector(selector);
  if (node) node.remove();
};

export default function SeoHead({
  title,
  description,
  type = 'website',
  siteName,
  locale,
  canonicalPath,
  canonicalBaseUrl,
  canonicalUrl,
  ogImageUrl,
  twitterImageUrl,
  twitterHandle,
  publishedTime,
  modifiedTime,
  authorName,
  robots = 'index,follow',
  structuredData = null,
}: SeoHeadProps) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const previousTitle = document.title;
    const descriptionValue = (description || DEFAULT_DESCRIPTION).trim();
    const explicitCanonical = toSafeAbsoluteUrl(canonicalUrl);
    const canonicalBase = toSafeAbsoluteUrl(canonicalBaseUrl);
    const resolvedCanonicalPath = canonicalPath
      ? (canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`)
      : window.location.pathname;
    const resolvedCanonicalUrl = explicitCanonical
      || `${canonicalBase || window.location.origin}${resolvedCanonicalPath}`;
    const resolvedOgImage = toSafeAbsoluteUrl(ogImageUrl);
    const resolvedTwitterImage = toSafeAbsoluteUrl(twitterImageUrl) || resolvedOgImage;

    document.title = title;
    upsertMeta('meta[name="description"]', 'name', 'description', descriptionValue);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', descriptionValue);
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', type);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', resolvedCanonicalUrl);
    if (siteName?.trim()) {
      upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', siteName.trim());
    } else {
      removeMetaIfExists('meta[property="og:site_name"]');
    }
    if (locale?.trim()) {
      upsertMeta('meta[property="og:locale"]', 'property', 'og:locale', locale.trim());
    } else {
      removeMetaIfExists('meta[property="og:locale"]');
    }
    if (resolvedOgImage) {
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', resolvedOgImage);
    } else {
      removeMeta('meta[property="og:image"]');
    }
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', descriptionValue);
    if (twitterHandle?.trim()) {
      const normalized = twitterHandle.trim().replace(/^@+/, '');
      upsertMeta('meta[name="twitter:site"]', 'name', 'twitter:site', `@${normalized}`);
      upsertMeta('meta[name="twitter:creator"]', 'name', 'twitter:creator', `@${normalized}`);
    } else {
      removeMetaIfExists('meta[name="twitter:site"]');
      removeMetaIfExists('meta[name="twitter:creator"]');
    }
    if (resolvedTwitterImage) {
      upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', resolvedTwitterImage);
    } else {
      removeMeta('meta[name="twitter:image"]');
    }
    upsertMeta('meta[name="robots"]', 'name', 'robots', robots);
    if (type === 'article') {
      if (publishedTime) {
        upsertMeta('meta[property="article:published_time"]', 'property', 'article:published_time', publishedTime);
      }
      if (modifiedTime) {
        upsertMeta('meta[property="article:modified_time"]', 'property', 'article:modified_time', modifiedTime);
      }
      if (authorName?.trim()) {
        upsertMeta('meta[property="article:author"]', 'property', 'article:author', authorName.trim());
      }
    } else {
      removeMetaIfExists('meta[property="article:published_time"]');
      removeMetaIfExists('meta[property="article:modified_time"]');
      removeMetaIfExists('meta[property="article:author"]');
    }

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', resolvedCanonicalUrl);

    const payloads = Array.isArray(structuredData) ? structuredData : (structuredData ? [structuredData] : []);
    const selector = 'script[data-seo-jsonld^="primary"]';
    document.head.querySelectorAll(selector).forEach((node) => node.remove());
    payloads.forEach((payload, index) => {
      upsertScript(`primary-${index}`, payload);
    });

    return () => {
      document.title = previousTitle;
    };
  }, [
    authorName,
    canonicalBaseUrl,
    canonicalPath,
    canonicalUrl,
    description,
    locale,
    modifiedTime,
    ogImageUrl,
    publishedTime,
    robots,
    siteName,
    structuredData,
    title,
    twitterHandle,
    twitterImageUrl,
    type,
  ]);

  return null;
}
