import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import { CMS_DEFAULTS } from '../../../constants/cms';
import { useAdminCmsSettings } from '../../../hooks/admin/useAdminQueries';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { refetchQuery } from '../../../utils/queryRefetch';
import { toDateValue } from '../../../utils/dateValue';
import { normalizeFrontendAccess } from '../../../utils/frontendAccess';

const displayValue = (value: string | null | undefined, fallback = 'Not set'): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
};

const displayBoolean = (value: boolean): string => value ? 'Enabled' : 'Disabled';
const displayDateTime = (value: string | null | undefined): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return 'Not set';
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString();
};

export default function CmsSettingsPage() {
  const settingsQuery = useAdminCmsSettings();
  const settings = settingsQuery.data;
  const frontendAccess = normalizeFrontendAccess(settings?.frontendAccess);
  const updatedAt = toDateValue(settings?.updatedAt);
  const socialLinks = settings?.socialLinks && typeof settings.socialLinks === 'object'
    ? settings.socialLinks
    : {};
  const socialEntries = Object.entries({
    Facebook: displayValue(typeof socialLinks.facebook === 'string' ? socialLinks.facebook : ''),
    Instagram: displayValue(typeof socialLinks.instagram === 'string' ? socialLinks.instagram : ''),
    X: displayValue(typeof socialLinks.x === 'string' ? socialLinks.x : ''),
    LinkedIn: displayValue(typeof socialLinks.linkedin === 'string' ? socialLinks.linkedin : ''),
    YouTube: displayValue(typeof socialLinks.youtube === 'string' ? socialLinks.youtube : ''),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">CMS Settings</h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">Saved global frontend settings, SEO defaults, support details, and public access configuration.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.portal.admin.dashboard.cmsSettingsEditor}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Edit Settings
            </Link>
            <AdminRefreshButton onClick={() => refetchQuery(settingsQuery)} isRefreshing={settingsQuery.isFetching} label="Refresh settings" />
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Site Title</p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-slate-100">{displayValue(settings?.siteTitle, CMS_DEFAULTS.siteTitle)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Frontend Access Mode</p>
            <p className="mt-1 font-semibold capitalize text-gray-900 dark:text-slate-100">{frontendAccess.mode.replace('_', ' ')}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Last Updated</p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-slate-100">{updatedAt ? updatedAt.toLocaleString() : 'Unknown'}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Identity And SEO</h3>
          <div className="mt-4 grid gap-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Tagline</p>
              <p className="text-gray-800 dark:text-slate-200">{displayValue(settings?.siteTagline, CMS_DEFAULTS.siteTagline)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Search Result Title</p>
              <p className="text-gray-800 dark:text-slate-200">{displayValue(settings?.defaultSeoTitle, CMS_DEFAULTS.defaultSeoTitle)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Search Result Description</p>
              <p className="text-gray-800 dark:text-slate-200">{displayValue(settings?.defaultSeoDescription, CMS_DEFAULTS.defaultSeoDescription)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Preferred Domain</p>
              <p className="break-all text-gray-800 dark:text-slate-200">{displayValue(settings?.canonicalBaseUrl, CMS_DEFAULTS.canonicalBaseUrl)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Default Social Image</p>
              <p className="break-all text-gray-800 dark:text-slate-200">{displayValue(settings?.defaultOgImageUrl)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">X Handle</p>
                <p className="text-gray-800 dark:text-slate-200">{displayValue(settings?.twitterHandle)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Robots Policy</p>
                <p className="text-gray-800 dark:text-slate-200">{displayValue(settings?.robotsPolicy, CMS_DEFAULTS.robotsPolicy)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Publishing And Support</h3>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Blog Posts Per Page</p>
                <p className="text-gray-800 dark:text-slate-200">{settings?.blogPostsPerPage || CMS_DEFAULTS.blogPostsPerPage}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Featured Posts</p>
                <p className="text-gray-800 dark:text-slate-200">{displayBoolean(settings?.showFeaturedOnBlog ?? CMS_DEFAULTS.showFeaturedOnBlog)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Blog In Footer</p>
                <p className="text-gray-800 dark:text-slate-200">{displayBoolean(settings?.showBlogInFooter ?? CMS_DEFAULTS.showBlogInFooter)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Approval Before Publish</p>
                <p className="text-gray-800 dark:text-slate-200">{displayBoolean(settings?.requireApprovalBeforePublish ?? CMS_DEFAULTS.requireApprovalBeforePublish)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Support Email</p>
              <p className="text-gray-800 dark:text-slate-200">{displayValue(settings?.supportEmail, CMS_DEFAULTS.supportEmail)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Support Phone</p>
              <p className="text-gray-800 dark:text-slate-200">{displayValue(settings?.supportPhone, CMS_DEFAULTS.supportPhone)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Office City</p>
              <p className="text-gray-800 dark:text-slate-200">{displayValue(settings?.officeCity, CMS_DEFAULTS.officeCity)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Frontend Access</h3>
          <div className="mt-4 grid gap-4 text-sm">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Mode And Operational State</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Mode</p>
                  <p className="font-semibold capitalize text-gray-900 dark:text-slate-100">{frontendAccess.mode.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Password Session TTL</p>
                  <p className="text-gray-800 dark:text-slate-200">{frontendAccess.passwordSessionTtlMinutes || CMS_DEFAULTS.frontendAccess.passwordSessionTtlMinutes} minutes</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Maintenance Schedule</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Structured End Time</p>
                  <p className="text-gray-800 dark:text-slate-200">{displayDateTime(frontendAccess.maintenanceEndsAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Fallback ETA Text</p>
                  <p className="text-gray-800 dark:text-slate-200">{displayValue(frontendAccess.maintenanceEta)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Maintenance Page Copy</p>
              <div className="mt-3 grid gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Maintenance Title</p>
                  <p className="text-gray-800 dark:text-slate-200">{displayValue(frontendAccess.maintenanceTitle, CMS_DEFAULTS.frontendAccess.maintenanceTitle)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Maintenance Message</p>
                  <p className="text-gray-800 dark:text-slate-200">{displayValue(frontendAccess.maintenanceMessage, CMS_DEFAULTS.frontendAccess.maintenanceMessage)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Password Page Copy</p>
              <div className="mt-3 grid gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Password Prompt Title</p>
                  <p className="text-gray-800 dark:text-slate-200">{displayValue(frontendAccess.passwordPromptTitle, CMS_DEFAULTS.frontendAccess.passwordPromptTitle)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Password Prompt Message</p>
                  <p className="text-gray-800 dark:text-slate-200">{displayValue(frontendAccess.passwordPromptMessage, CMS_DEFAULTS.frontendAccess.passwordPromptMessage)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Translation Fallback Behavior</p>
              <p className="mt-2 text-gray-800 dark:text-slate-200">
                Frontend access defaults are aligned with the Translation Control Center through the bundled `frontendAccess.*` locale namespace. Custom CMS copy overrides the translated default, while blank/default values continue to use translated fallback text.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Social Links</h3>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {socialEntries.map(([label, value]) => (
              <div key={label}>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">{label}</p>
                <p className="break-all text-gray-800 dark:text-slate-200">{value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
