import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import { CMS_DEFAULTS } from '../../../constants/cms';
import { useAdminCmsSettings } from '../../../hooks/admin/useAdminQueries';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { refetchQuery } from '../../../utils/queryRefetch';

export default function CmsSettingsPage() {
  const settingsQuery = useAdminCmsSettings();
  const settings = settingsQuery.data;
  const frontendAccess = settings?.frontendAccess || CMS_DEFAULTS.frontendAccess;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">CMS Settings</h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">Manage global frontend settings in a dedicated editor page.</p>
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
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Site Title</p>
            <p className="font-semibold text-gray-900 dark:text-slate-100">{settings?.siteTitle || CMS_DEFAULTS.siteTitle}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Tagline</p>
            <p className="text-gray-800 dark:text-slate-200">{settings?.siteTagline || CMS_DEFAULTS.siteTagline}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Blog Posts Per Page</p>
            <p className="text-gray-800 dark:text-slate-200">{settings?.blogPostsPerPage || CMS_DEFAULTS.blogPostsPerPage}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Support Contact</p>
            <p className="text-gray-800 dark:text-slate-200">{settings?.supportEmail || CMS_DEFAULTS.supportEmail}</p>
            <p className="text-gray-800 dark:text-slate-200">{settings?.supportPhone || CMS_DEFAULTS.supportPhone}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">Frontend Access</p>
            <p className="font-semibold text-gray-900 dark:text-slate-100">
              {frontendAccess.mode.replace('_', ' ')}
            </p>
            <p className="text-gray-800 dark:text-slate-200">
              {frontendAccess.mode === 'maintenance'
                ? (frontendAccess.maintenanceTitle || CMS_DEFAULTS.frontendAccess.maintenanceTitle)
                : frontendAccess.mode === 'password_protected'
                  ? (frontendAccess.passwordPromptTitle || CMS_DEFAULTS.frontendAccess.passwordPromptTitle)
                  : 'Public frontend is open.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
