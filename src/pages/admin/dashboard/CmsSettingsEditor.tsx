import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';
import {
  CMS_DEFAULTS,
  CMS_FEATURE_FLAGS,
  CMS_FRONTEND_ACCESS_MODE,
  CMS_LIMITS,
  CMS_SEO_GUIDELINES,
  CMS_SETTINGS_DOC_ID,
} from '../../../constants/cms';
import { ROUTES } from '../../../constants/routes';
import { useAdminCmsSettings } from '../../../hooks/admin/useAdminQueries';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { notify } from '../../../services/notify.service';
import { useAuth } from '../../../contexts/AuthContext';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { toDateValue } from '../../../utils/dateValue';
import SeoSnippetPreview from '../../../components/cms/SeoSnippetPreview';
import {
  fromDateTimeLocalValue,
  normalizeFrontendAccess,
  toDateTimeLocalValue,
  type FrontendAccessSettings,
} from '../../../utils/frontendAccess';

type SocialLinksState = {
  facebook: string;
  instagram: string;
  x: string;
  linkedin: string;
  youtube: string;
};

const toSafeUrl = (value: string): string => value.trim();
const isAbsoluteHttpUrl = (value: string): boolean => /^https?:\/\/\S+$/i.test(value.trim());
const isMediaUrlOrPath = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized) return true;
  return normalized.startsWith('/') || isAbsoluteHttpUrl(normalized);
};

const lengthClass = (length: number, max: number, warningAt: number) => {
  if (length > max) return 'text-red-700';
  if (length >= warningAt) return 'text-amber-700';
  return 'text-emerald-700';
};

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">{title}</h3>
        {description ? <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function CmsSettingsEditorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const settingsQuery = useAdminCmsSettings();

  const [siteTitle, setSiteTitle] = useState<string>(CMS_DEFAULTS.siteTitle);
  const [siteTagline, setSiteTagline] = useState<string>(CMS_DEFAULTS.siteTagline);
  const [defaultSeoTitle, setDefaultSeoTitle] = useState<string>(CMS_DEFAULTS.defaultSeoTitle);
  const [defaultSeoDescription, setDefaultSeoDescription] = useState<string>(CMS_DEFAULTS.defaultSeoDescription);
  const [canonicalBaseUrl, setCanonicalBaseUrl] = useState<string>(CMS_DEFAULTS.canonicalBaseUrl);
  const [defaultOgImageUrl, setDefaultOgImageUrl] = useState<string>(CMS_DEFAULTS.defaultOgImageUrl);
  const [twitterHandle, setTwitterHandle] = useState<string>(CMS_DEFAULTS.twitterHandle);
  const [robotsPolicy, setRobotsPolicy] = useState<'index_follow' | 'noindex_nofollow'>(CMS_DEFAULTS.robotsPolicy);
  const [blogPostsPerPage, setBlogPostsPerPage] = useState<number>(CMS_DEFAULTS.blogPostsPerPage);
  const [showFeaturedOnBlog, setShowFeaturedOnBlog] = useState<boolean>(CMS_DEFAULTS.showFeaturedOnBlog);
  const [showBlogInFooter, setShowBlogInFooter] = useState<boolean>(CMS_DEFAULTS.showBlogInFooter);
  const [requireApprovalBeforePublish, setRequireApprovalBeforePublish] = useState<boolean>(CMS_DEFAULTS.requireApprovalBeforePublish);
  const [supportEmail, setSupportEmail] = useState<string>(CMS_DEFAULTS.supportEmail);
  const [supportPhone, setSupportPhone] = useState<string>(CMS_DEFAULTS.supportPhone);
  const [officeCity, setOfficeCity] = useState<string>(CMS_DEFAULTS.officeCity);
  const [socialLinks, setSocialLinks] = useState<SocialLinksState>({
    facebook: '',
    instagram: '',
    x: '',
    linkedin: '',
    youtube: '',
  });
  const [frontendAccessMode, setFrontendAccessMode] = useState<FrontendAccessSettings['mode']>(CMS_DEFAULTS.frontendAccess.mode);
  const [maintenanceTitle, setMaintenanceTitle] = useState<string>(CMS_DEFAULTS.frontendAccess.maintenanceTitle);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>(CMS_DEFAULTS.frontendAccess.maintenanceMessage);
  const [maintenanceEta, setMaintenanceEta] = useState<string>(CMS_DEFAULTS.frontendAccess.maintenanceEta);
  const [maintenanceEndsAt, setMaintenanceEndsAt] = useState<string>('');
  const [passwordPromptTitle, setPasswordPromptTitle] = useState<string>(CMS_DEFAULTS.frontendAccess.passwordPromptTitle);
  const [passwordPromptMessage, setPasswordPromptMessage] = useState<string>(CMS_DEFAULTS.frontendAccess.passwordPromptMessage);
  const [passwordSessionTtlMinutes, setPasswordSessionTtlMinutes] = useState<number>(CMS_DEFAULTS.frontendAccess.passwordSessionTtlMinutes);
  const [showAdvancedSeo, setShowAdvancedSeo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hydratedRevisionKey, setHydratedRevisionKey] = useState<string | null>(null);

  const titleLen = siteTitle.trim().length;
  const seoTitleLen = defaultSeoTitle.trim().length;
  const seoDescLen = defaultSeoDescription.trim().length;
  const previewUrl = `${canonicalBaseUrl.trim().replace(/\/+$/, '') || CMS_DEFAULTS.canonicalBaseUrl}/blog`;

  const cleanSocialLinks = useMemo(() => {
    const entries = Object.entries(socialLinks)
      .map(([key, value]) => [key, toSafeUrl(value)] as const)
      .filter(([_, value]) => !value || /^https?:\/\//i.test(value));
    return Object.fromEntries(entries) as Record<string, string>;
  }, [socialLinks]);

  useEffect(() => {
    const next = settingsQuery.data;
    if (!next) return;
    const updatedAt = toDateValue(next.updatedAt);
    const revisionKey = `${next.id}:${updatedAt?.getTime() ?? 'no-updated-at'}`;
    if (isDirty) return;
    if (hydratedRevisionKey === revisionKey) return;

    setSiteTitle(next.siteTitle || CMS_DEFAULTS.siteTitle);
    setSiteTagline(next.siteTagline || CMS_DEFAULTS.siteTagline);
    setDefaultSeoTitle(next.defaultSeoTitle || CMS_DEFAULTS.defaultSeoTitle);
    setDefaultSeoDescription(next.defaultSeoDescription || CMS_DEFAULTS.defaultSeoDescription);
    setCanonicalBaseUrl(next.canonicalBaseUrl || CMS_DEFAULTS.canonicalBaseUrl);
    setDefaultOgImageUrl(next.defaultOgImageUrl || CMS_DEFAULTS.defaultOgImageUrl);
    setTwitterHandle(next.twitterHandle || CMS_DEFAULTS.twitterHandle);
    setRobotsPolicy(next.robotsPolicy === 'noindex_nofollow' ? 'noindex_nofollow' : CMS_DEFAULTS.robotsPolicy);
    setBlogPostsPerPage(next.blogPostsPerPage || CMS_DEFAULTS.blogPostsPerPage);
    setShowFeaturedOnBlog(next.showFeaturedOnBlog ?? CMS_DEFAULTS.showFeaturedOnBlog);
    setShowBlogInFooter(next.showBlogInFooter ?? CMS_DEFAULTS.showBlogInFooter);
    setRequireApprovalBeforePublish(next.requireApprovalBeforePublish === true);
    setSupportEmail(next.supportEmail || CMS_DEFAULTS.supportEmail);
    setSupportPhone(next.supportPhone || CMS_DEFAULTS.supportPhone);
    setOfficeCity(next.officeCity || CMS_DEFAULTS.officeCity);
    const nextFrontendAccess = normalizeFrontendAccess(next.frontendAccess);
    setFrontendAccessMode(nextFrontendAccess.mode);
    setMaintenanceTitle(nextFrontendAccess.maintenanceTitle || CMS_DEFAULTS.frontendAccess.maintenanceTitle);
    setMaintenanceMessage(nextFrontendAccess.maintenanceMessage || CMS_DEFAULTS.frontendAccess.maintenanceMessage);
    setMaintenanceEta(nextFrontendAccess.maintenanceEta || CMS_DEFAULTS.frontendAccess.maintenanceEta);
    setMaintenanceEndsAt(toDateTimeLocalValue(nextFrontendAccess.maintenanceEndsAt));
    setPasswordPromptTitle(nextFrontendAccess.passwordPromptTitle || CMS_DEFAULTS.frontendAccess.passwordPromptTitle);
    setPasswordPromptMessage(nextFrontendAccess.passwordPromptMessage || CMS_DEFAULTS.frontendAccess.passwordPromptMessage);
    setPasswordSessionTtlMinutes(nextFrontendAccess.passwordSessionTtlMinutes || CMS_DEFAULTS.frontendAccess.passwordSessionTtlMinutes);

    const nextSocial = next.socialLinks && typeof next.socialLinks === 'object' ? next.socialLinks as Record<string, unknown> : {};
    setSocialLinks({
      facebook: typeof nextSocial.facebook === 'string' ? nextSocial.facebook : '',
      instagram: typeof nextSocial.instagram === 'string' ? nextSocial.instagram : '',
      x: typeof nextSocial.x === 'string' ? nextSocial.x : '',
      linkedin: typeof nextSocial.linkedin === 'string' ? nextSocial.linkedin : '',
      youtube: typeof nextSocial.youtube === 'string' ? nextSocial.youtube : '',
    });

    setHydratedRevisionKey(revisionKey);
  }, [settingsQuery.data, hydratedRevisionKey, isDirty]);

  const saveSettings = async () => {
    const hasInvalidSocialInput = Object.values(socialLinks).some((value) => {
      const normalized = toSafeUrl(value);
      return Boolean(normalized) && !/^https?:\/\//i.test(normalized);
    });
    if (hasInvalidSocialInput) {
      notify.error('Social links must be valid URLs starting with http:// or https://');
      return;
    }
    if (canonicalBaseUrl.trim() && !isAbsoluteHttpUrl(canonicalBaseUrl)) {
      notify.error('Preferred domain must start with http:// or https://');
      return;
    }
    if (!isMediaUrlOrPath(defaultOgImageUrl)) {
      notify.error('Default social image must be an absolute URL or start with /.');
      return;
    }
    if (frontendAccessMode === CMS_FRONTEND_ACCESS_MODE.passwordProtected && passwordSessionTtlMinutes < 5) {
      notify.error('Password session duration must be at least 5 minutes.');
      return;
    }

    setSaving(true);
    try {
      const now = getServerTimestamp();
      const ref = doc(db, COLLECTIONS.CMS_SETTINGS, CMS_SETTINGS_DOC_ID);
      const existing = await getDoc(ref);
      const createdAt = existing.exists() ? (existing.data()?.createdAt || now) : now;

      await setDoc(ref, {
        siteTitle: siteTitle.trim().slice(0, CMS_LIMITS.title) || CMS_DEFAULTS.siteTitle,
        siteTagline: siteTagline.trim().slice(0, CMS_LIMITS.excerpt) || null,
        defaultSeoTitle: defaultSeoTitle.trim().slice(0, CMS_LIMITS.seoTitle) || siteTitle.trim().slice(0, CMS_LIMITS.seoTitle) || null,
        defaultSeoDescription: defaultSeoDescription.trim().slice(0, CMS_LIMITS.seoDescription) || siteTagline.trim().slice(0, CMS_LIMITS.seoDescription) || null,
        canonicalBaseUrl: canonicalBaseUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
        defaultOgImageUrl: defaultOgImageUrl.trim().slice(0, CMS_LIMITS.canonicalUrl) || null,
        twitterHandle: twitterHandle.trim().replace(/^@+/, '').slice(0, CMS_LIMITS.twitterHandle) || null,
        robotsPolicy,
        blogPostsPerPage: Math.min(CMS_LIMITS.blogPostsPageSizeMax, Math.max(CMS_LIMITS.blogPostsPageSizeMin, blogPostsPerPage)),
        showFeaturedOnBlog,
        showBlogInFooter,
        requireApprovalBeforePublish,
        supportEmail: supportEmail.trim() || null,
        supportPhone: supportPhone.trim() || null,
        officeCity: officeCity.trim() || null,
        socialLinks: cleanSocialLinks,
        frontendAccess: {
          mode: frontendAccessMode,
          maintenanceTitle: maintenanceTitle.trim().slice(0, CMS_LIMITS.frontendAccessTitle) || CMS_DEFAULTS.frontendAccess.maintenanceTitle,
          maintenanceMessage: maintenanceMessage.trim().slice(0, CMS_LIMITS.frontendAccessMessage) || CMS_DEFAULTS.frontendAccess.maintenanceMessage,
          maintenanceEta: maintenanceEta.trim().slice(0, CMS_LIMITS.frontendAccessEta) || null,
          maintenanceEndsAt: fromDateTimeLocalValue(maintenanceEndsAt),
          passwordPromptTitle: passwordPromptTitle.trim().slice(0, CMS_LIMITS.frontendAccessTitle) || CMS_DEFAULTS.frontendAccess.passwordPromptTitle,
          passwordPromptMessage: passwordPromptMessage.trim().slice(0, CMS_LIMITS.frontendAccessMessage) || CMS_DEFAULTS.frontendAccess.passwordPromptMessage,
          passwordSessionTtlMinutes: Math.min(24 * 7, Math.max(5, Math.floor(passwordSessionTtlMinutes || CMS_DEFAULTS.frontendAccess.passwordSessionTtlMinutes))),
        },
        updatedBy: user?.uid || 'admin',
        createdAt,
        updatedAt: now,
      }, { merge: true });

      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      await queryClient.invalidateQueries({ queryKey: ['cms', 'public', 'settings'] });
      await queryClient.invalidateQueries({ queryKey: ['cms', 'public', 'settings', 'frontendAccessGate'] });
      await queryClient.invalidateQueries({ queryKey: ['frontendAccess', 'status'] });
      setIsDirty(false);
      setHydratedRevisionKey(null);
      notify.success('Settings saved.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">CMS Settings</h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">Global controls for site identity, public access, support details, and blog behavior.</p>
          </div>
          <Link
            to={ROUTES.portal.admin.dashboard.cmsSettings}
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back to Settings
          </Link>
        </div>
      </div>

      <div className="grid gap-4">
        <SettingsSection title="Site Identity" description="Primary site name, tagline, and search result text shown across the public frontend.">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Site Name</span>
              <input value={siteTitle} onChange={(event) => { setSiteTitle(event.target.value); setIsDirty(true); }} placeholder="BloodHub India" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
              <span className={`mt-1 block text-[11px] ${lengthClass(titleLen, CMS_LIMITS.title, 110)}`}>{titleLen}/{CMS_LIMITS.title}</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Tagline</span>
              <input value={siteTagline} onChange={(event) => { setSiteTagline(event.target.value); setIsDirty(true); }} placeholder="Donate blood, save lives." className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Search Result Title</span>
              <input value={defaultSeoTitle} onChange={(event) => { setDefaultSeoTitle(event.target.value); setIsDirty(true); }} placeholder="Shown in Google results" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
              <span className={`mt-1 block text-[11px] ${lengthClass(seoTitleLen, CMS_LIMITS.seoTitle, 55)}`}>{seoTitleLen}/{CMS_LIMITS.seoTitle}</span>
              <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">Recommended {CMS_SEO_GUIDELINES.titleMin}-{CMS_SEO_GUIDELINES.titleMax} characters.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Search Result Description</span>
              <input value={defaultSeoDescription} onChange={(event) => { setDefaultSeoDescription(event.target.value); setIsDirty(true); }} placeholder="Short summary shown in search" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
              <span className={`mt-1 block text-[11px] ${lengthClass(seoDescLen, CMS_LIMITS.seoDescription, 145)}`}>{seoDescLen}/{CMS_LIMITS.seoDescription}</span>
              <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">Recommended {CMS_SEO_GUIDELINES.descriptionMin}-{CMS_SEO_GUIDELINES.descriptionMax} characters.</span>
            </label>
            <div className="md:col-span-2">
              <SeoSnippetPreview
                title={defaultSeoTitle || siteTitle || CMS_DEFAULTS.defaultSeoTitle}
                description={defaultSeoDescription || siteTagline || CMS_DEFAULTS.defaultSeoDescription}
                url={previewUrl}
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Frontend Access Control" description="Control public site availability and keep the gate content aligned with server-backed access and the Translation Control Center.">
          <div className="grid gap-4">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 via-rose-50 to-white p-4 dark:border-red-900/40 dark:bg-slate-950/70">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-700 dark:text-red-300">Mode Selection</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Frontend Mode</span>
                    <select
                      value={frontendAccessMode}
                      onChange={(event) => { setFrontendAccessMode(event.target.value as FrontendAccessSettings['mode']); setIsDirty(true); }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value={CMS_FRONTEND_ACCESS_MODE.open}>Open</option>
                      <option value={CMS_FRONTEND_ACCESS_MODE.maintenance}>Scheduled maintenance</option>
                      <option value={CMS_FRONTEND_ACCESS_MODE.passwordProtected}>Password protected</option>
                    </select>
                  </label>
                  <div className="rounded-xl border border-red-200 bg-white px-3 py-3 text-sm dark:border-red-900/50 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Current Selection</p>
                    <p className="mt-1 font-semibold capitalize text-gray-900 dark:text-slate-100">{frontendAccessMode.replace('_', ' ')}</p>
                    <p className="mt-2 text-xs text-gray-600 dark:text-slate-300">
                      `open` shows the site normally. `maintenance` gates the public site. `password protected` requires the configured server-side password.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                <p className="font-semibold">Operational readiness</p>
                <p className="mt-2 text-xs leading-relaxed">
                  Admin routes remain available in gated modes. Password mode requires `FRONTEND_GATE_PASSWORD` and `FRONTEND_GATE_SESSION_SECRET` on Netlify.
                </p>
                <p className="mt-3 text-xs leading-relaxed">
                  Default gate copy comes from the `frontendAccess.*` translation namespace. Custom CMS text overrides the translated default.
                </p>
              </div>
            </div>

            {frontendAccessMode === CMS_FRONTEND_ACCESS_MODE.maintenance ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Maintenance Schedule</p>
                  <div className="mt-3 grid gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Structured End Time</span>
                      <input
                        type="datetime-local"
                        value={maintenanceEndsAt}
                        onChange={(event) => { setMaintenanceEndsAt(event.target.value); setIsDirty(true); }}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">Used for the live countdown on the maintenance page. Maintenance mode still stays active until you switch back to `open`.</span>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Fallback ETA Text</span>
                      <input value={maintenanceEta} onChange={(event) => { setMaintenanceEta(event.target.value); setIsDirty(true); }} placeholder="Expected back by 7:30 PM IST" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Maintenance Copy</p>
                  <div className="mt-3 grid gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Maintenance Title</span>
                      <input value={maintenanceTitle} onChange={(event) => { setMaintenanceTitle(event.target.value); setIsDirty(true); }} placeholder={CMS_DEFAULTS.frontendAccess.maintenanceTitle} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Maintenance Message</span>
                      <textarea value={maintenanceMessage} onChange={(event) => { setMaintenanceMessage(event.target.value); setIsDirty(true); }} rows={4} placeholder={CMS_DEFAULTS.frontendAccess.maintenanceMessage} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
                    </label>
                  </div>
                </div>
              </div>
            ) : null}

            {frontendAccessMode === CMS_FRONTEND_ACCESS_MODE.passwordProtected ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Password Session</p>
                  <div className="mt-3 grid gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Password Session TTL</span>
                      <input
                        type="number"
                        min={5}
                        max={10080}
                        value={passwordSessionTtlMinutes}
                        onChange={(event) => { setPasswordSessionTtlMinutes(Number(event.target.value || CMS_DEFAULTS.frontendAccess.passwordSessionTtlMinutes)); setIsDirty(true); }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      />
                      <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">Controls how long a successful visitor unlock session stays valid.</span>
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Password Page Copy</p>
                  <div className="mt-3 grid gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Password Prompt Title</span>
                      <input value={passwordPromptTitle} onChange={(event) => { setPasswordPromptTitle(event.target.value); setIsDirty(true); }} placeholder={CMS_DEFAULTS.frontendAccess.passwordPromptTitle} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Password Prompt Message</span>
                      <textarea value={passwordPromptMessage} onChange={(event) => { setPasswordPromptMessage(event.target.value); setIsDirty(true); }} rows={4} placeholder={CMS_DEFAULTS.frontendAccess.passwordPromptMessage} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
                    </label>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
              <p className="font-semibold">Translation alignment</p>
              <p className="mt-2 text-xs leading-relaxed">
                The maintenance and password pages read their fallback UI text from the same bundled locale dictionaries used by the Translation Control Center. If you keep a field blank or leave it equal to the default constant, visitors see the translated fallback for their selected language.
              </p>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Publishing And Support" description="Blog controls and public support details used across the CMS and public frontend.">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Blog Posts Per Page</span>
              <input type="number" value={blogPostsPerPage} min={3} max={24} onChange={(event) => { setBlogPostsPerPage(Number(event.target.value || CMS_DEFAULTS.blogPostsPerPage)); setIsDirty(true); }} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </label>
            <div className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Publishing Options</p>
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showFeaturedOnBlog} onChange={(event) => { setShowFeaturedOnBlog(event.target.checked); setIsDirty(true); }} />Show featured posts</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showBlogInFooter} onChange={(event) => { setShowBlogInFooter(event.target.checked); setIsDirty(true); }} />Show blog in footer</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={requireApprovalBeforePublish} onChange={(event) => { setRequireApprovalBeforePublish(event.target.checked); setIsDirty(true); }} />Require review approval before publish</label>
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Support Email</span>
              <input value={supportEmail} onChange={(event) => { setSupportEmail(event.target.value); setIsDirty(true); }} placeholder="support@domain.com" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Support Phone</span>
              <input value={supportPhone} onChange={(event) => { setSupportPhone(event.target.value); setIsDirty(true); }} placeholder="+91 ..." className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-slate-400">Office City</span>
              <input value={officeCity} onChange={(event) => { setOfficeCity(event.target.value); setIsDirty(true); }} placeholder="Mumbai, Maharashtra" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
            </label>
          </div>
        </SettingsSection>

        <SettingsSection title="Social Links" description="Public social profiles shown across the marketing site and footer.">
          <div className="grid gap-2 md:grid-cols-2">
            <input value={socialLinks.facebook} onChange={(event) => { setSocialLinks((prev) => ({ ...prev, facebook: event.target.value })); setIsDirty(true); }} placeholder="Facebook URL" className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
            <input value={socialLinks.instagram} onChange={(event) => { setSocialLinks((prev) => ({ ...prev, instagram: event.target.value })); setIsDirty(true); }} placeholder="Instagram URL" className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
            <input value={socialLinks.x} onChange={(event) => { setSocialLinks((prev) => ({ ...prev, x: event.target.value })); setIsDirty(true); }} placeholder="X URL" className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
            <input value={socialLinks.linkedin} onChange={(event) => { setSocialLinks((prev) => ({ ...prev, linkedin: event.target.value })); setIsDirty(true); }} placeholder="LinkedIn URL" className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
            <input value={socialLinks.youtube} onChange={(event) => { setSocialLinks((prev) => ({ ...prev, youtube: event.target.value })); setIsDirty(true); }} placeholder="YouTube URL" className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 md:col-span-2" />
          </div>
        </SettingsSection>

        <SettingsSection title="Advanced SEO" description="Optional domain, robots, and social graph defaults used by public pages and generated SEO artifacts.">
          {CMS_FEATURE_FLAGS.simplifiedEditorMode ? (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setShowAdvancedSeo((prev) => !prev)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {showAdvancedSeo ? 'Hide Advanced SEO' : 'Show Advanced SEO (Optional)'}
              </button>
            </div>
          ) : null}

          {(!CMS_FEATURE_FLAGS.simplifiedEditorMode || showAdvancedSeo) ? (
            <div className="grid gap-2 md:grid-cols-2">
              <input value={canonicalBaseUrl} onChange={(event) => { setCanonicalBaseUrl(event.target.value); setIsDirty(true); }} placeholder="Preferred Domain (https://example.com)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
              <input value={defaultOgImageUrl} onChange={(event) => { setDefaultOgImageUrl(event.target.value); setIsDirty(true); }} placeholder="Default Social Share Image URL" className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
              <input value={twitterHandle} onChange={(event) => { setTwitterHandle(event.target.value); setIsDirty(true); }} placeholder="Twitter handle (without @)" className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
              <select value={robotsPolicy} onChange={(event) => { setRobotsPolicy(event.target.value as 'index_follow' | 'noindex_nofollow'); setIsDirty(true); }} className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                <option value="index_follow">Allow search indexing</option>
                <option value="noindex_nofollow">Do not index site</option>
              </select>
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-slate-300">Advanced SEO controls are collapsed in simplified editor mode.</p>
          )}
        </SettingsSection>

        <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex gap-2">
          <button type="button" onClick={() => void saveSettings()} disabled={saving} className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:border-red-500 dark:bg-red-500 dark:hover:bg-red-400">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.portal.admin.dashboard.cmsSettings)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
