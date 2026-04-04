import { APP_ROUTE_PREFIXES_WITH_LEGACY, LEGACY_ROUTE_PREFIXES, PORTAL_PATH_PREFIXES } from '../constants/routes';
import { PWA_THEME_COLORS } from '../constants/theme';
import type { TFunction } from 'i18next';

type PwaBrand = {
  manifest: string;
  themeColor: string;
  titleKey: string;
  icon: string;
};

const PWA_BRANDS: Record<string, PwaBrand> = {
  donor: {
    manifest: '/manifest-donor.json',
    themeColor: PWA_THEME_COLORS.donor,
    titleKey: 'pwa.donorTitle',
    icon: '/icons/apple-touch-icon.png',
  },
  ngo: {
    manifest: '/manifest-ngo.json',
    themeColor: PWA_THEME_COLORS.ngo,
    titleKey: 'pwa.ngoTitle',
    icon: '/icons/apple-touch-icon.png',
  },
  bloodbank: {
    manifest: '/manifest-bloodbank.json',
    themeColor: PWA_THEME_COLORS.bloodbank,
    titleKey: 'pwa.bloodbankTitle',
    icon: '/icons/apple-touch-icon.png',
  },
  default: {
    manifest: '/manifest-donor.json',
    themeColor: PWA_THEME_COLORS.default,
    titleKey: 'pwa.defaultTitle',
    icon: '/icons/apple-touch-icon.png',
  },
};

const resolveBrandKey = (pathname: string) => {
  if (pathname.startsWith(PORTAL_PATH_PREFIXES.ngo)) return 'ngo';
  if (pathname.startsWith(PORTAL_PATH_PREFIXES.bloodbank)) return 'bloodbank';
  if (pathname.startsWith(LEGACY_ROUTE_PREFIXES.hospital)) return 'bloodbank';
  if (pathname.startsWith(PORTAL_PATH_PREFIXES.donor)) return 'donor';
  if (!APP_ROUTE_PREFIXES_WITH_LEGACY.some((prefix) => pathname.startsWith(prefix))) return 'default';
  return 'default';
};

const ensureMeta = (name: string, content: string) => {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const ensureLink = (rel: string, href: string, id?: string) => {
  let selector = `link[rel="${rel}"]`;
  if (id) {
    selector = `link#${id}`;
  }
  let el = document.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (id) el.id = id;
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

export const applyPwaBranding = (pathname: string, t: TFunction) => {
  const brandKey = resolveBrandKey(pathname);
  const brand = PWA_BRANDS[brandKey] || PWA_BRANDS.default;
  const title = t(brand.titleKey);

  ensureLink('manifest', brand.manifest, 'pwa-manifest');
  ensureMeta('theme-color', brand.themeColor);
  ensureMeta('apple-mobile-web-app-title', title);
  ensureLink('apple-touch-icon', brand.icon, 'pwa-apple-touch-icon');
};
