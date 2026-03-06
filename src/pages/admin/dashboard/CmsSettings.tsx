import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import { CMS_DEFAULTS } from '../../../constants/cms';
import { useAdminCmsSettings } from '../../../hooks/admin/useAdminQueries';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { refetchQuery } from '../../../utils/queryRefetch';

export default function CmsSettingsPage() {
  const settingsQuery = useAdminCmsSettings();
  const settings = settingsQuery.data;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">CMS Settings</h2>
            <p className="text-sm text-gray-600">Manage global frontend settings in a dedicated editor page.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.portal.admin.dashboard.cmsSettingsEditor}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Edit Settings
            </Link>
            <AdminRefreshButton onClick={() => refetchQuery(settingsQuery)} isRefreshing={settingsQuery.isFetching} label="Refresh settings" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Site Title</p>
            <p className="font-semibold text-gray-900">{settings?.siteTitle || CMS_DEFAULTS.siteTitle}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Tagline</p>
            <p className="text-gray-800">{settings?.siteTagline || CMS_DEFAULTS.siteTagline}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Blog Posts Per Page</p>
            <p className="text-gray-800">{settings?.blogPostsPerPage || CMS_DEFAULTS.blogPostsPerPage}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Support Contact</p>
            <p className="text-gray-800">{settings?.supportEmail || CMS_DEFAULTS.supportEmail}</p>
            <p className="text-gray-800">{settings?.supportPhone || CMS_DEFAULTS.supportPhone}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
