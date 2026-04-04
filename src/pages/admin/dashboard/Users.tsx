import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../../types/database.types';
import { toDateValue } from '../../../utils/dateValue';
import { normalizeUserStatus } from '../../../utils/adminUserStatus';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { useAdminUsers } from '../../../hooks/admin/useAdminQueries';
import { refetchQuery } from '../../../utils/queryRefetch';

type RoleFilter = 'all' | 'donor' | 'ngo' | 'bloodbank';
type StatusFilter = 'all' | 'active' | 'inactive' | 'suspended' | 'pending_verification';

type AdminUsersPageProps = {
  roleFilter?: RoleFilter;
  title?: string;
  description?: string;
};

type UserRow = {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  verified: boolean;
  city?: string;
  bhId?: string;
  createdAt?: Date;
  lastLoginAt?: Date;
};

const normalizeRole = (role?: string | null) => {
  if (!role) return 'donor';
  return role === 'hospital' ? 'bloodbank' : role;
};

export function AdminUsersPage({
  roleFilter = 'all',
  title,
  description,
}: AdminUsersPageProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const pageTitle = title || t('admin.userManagementTitle');
  const pageDescription = description || t('admin.userManagementDescription');
  const getStatusLabel = (status: string) => {
    if (status === 'active') return t('admin.activeStatus');
    if (status === 'inactive') return t('admin.inactiveStatus');
    if (status === 'suspended') return t('admin.suspendedStatus');
    if (status === 'pending_verification') return t('admin.pendingVerificationStatus');
    return status;
  };
  const usersQuery = useAdminUsers(roleFilter);
  const loading = usersQuery.isLoading;
  const error = usersQuery.error instanceof Error ? usersQuery.error.message : null;

  const users = useMemo<UserRow[]>(() => {
    const rawUsers: User[] = usersQuery.data || [];
    const deduped = new Map<string, User>();
    rawUsers.forEach((entry) => {
      const key = entry.uid || entry.id;
      if (!key) return;
      if (!deduped.has(key)) {
        deduped.set(key, entry);
      }
    });

    return Array.from(deduped.values())
      .map((entry) => ({
        id: entry.id || entry.uid,
        uid: entry.uid,
        displayName: entry.displayName || entry.organizationName || entry.hospitalName || entry.bloodBankName || t('common.userFallback'),
        email: entry.email || '-',
        role: normalizeRole(entry.role),
        status: normalizeUserStatus(entry.status),
        verified: Boolean(entry.verified),
        city: entry.city,
        bhId: entry.bhId,
        createdAt: toDateValue(entry.createdAt),
        lastLoginAt: toDateValue(entry.lastLoginAt),
      }))
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }, [usersQuery.data, t]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, roleFilter, pageSize]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((entry) => {
      if (roleFilter !== 'all') {
        if (roleFilter === 'bloodbank') {
          if (!['bloodbank', 'hospital'].includes(entry.role)) return false;
        } else if (entry.role !== roleFilter) {
          return false;
        }
      }

      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!term) return true;

      const haystack = [
        entry.displayName,
        entry.email,
        entry.uid,
        entry.role,
        entry.status,
        entry.city,
        entry.bhId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  const hasNextPage = page * pageSize < filteredUsers.length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{pageTitle}</h2>
            <p className="text-sm text-gray-600">{pageDescription}</p>
          </div>
          <AdminRefreshButton
            onClick={() => refetchQuery(usersQuery)}
            isRefreshing={usersQuery.isFetching}
            label={t('admin.refreshUsers')}
          />
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder={t('admin.searchUsersPlaceholder')}
        leftContent={
          <>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">{t('admin.allStatuses')}</option>
              <option value="active">{t('admin.activeStatus')}</option>
              <option value="inactive">{t('admin.inactiveStatus')}</option>
              <option value="suspended">{t('admin.suspendedStatus')}</option>
              <option value="pending_verification">{t('admin.pendingVerificationStatus')}</option>
            </select>
          </>
        }
        rightContent={<span className="text-xs font-semibold text-gray-500">{t('admin.usersCount', { count: filteredUsers.length })}</span>}
      />

      <AdminRefreshingBanner show={loading} message={t('admin.refreshingUsers')} />
      <AdminErrorCard message={error} onRetry={() => refetchQuery(usersQuery)} />

      {pagedUsers.length === 0 ? (
        <AdminEmptyStateCard message={t('admin.noUsersFoundForFilters')} />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {pagedUsers.map((entry) => {
              return (
                <article key={`mobile-${entry.uid}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{entry.displayName}</p>
                      <p className="text-xs text-gray-500">{entry.email}</p>
                      <p className="text-xs text-gray-400">{t('admin.uidLabel', { uid: entry.uid })}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(entry.uid)}
                      className="rounded-md p-2 text-red-700 hover:bg-red-100"
                      title={t('common.view')}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700 capitalize text-center">{entry.role}</span>
                    <span className={`rounded-full px-2 py-1 font-semibold capitalize text-center ${
                      entry.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : entry.status === 'suspended'
                          ? 'bg-red-100 text-red-700'
                          : entry.status === 'pending_verification'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-700'
                    }`}>
                      {getStatusLabel(entry.status)}
                    </span>
                    <span className={`rounded-full px-2 py-1 font-semibold text-center ${entry.verified ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                      {entry.verified ? t('admin.verified') : t('admin.unverified')}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700 text-center">
                      {entry.city || t('admin.noCity')}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-gray-500 space-y-1">
                    <p>{t('common.created')}: {entry.createdAt ? entry.createdAt.toLocaleDateString(i18n.language) : t('admin.notAvailable')}</p>
                    <p>{t('common.lastLogin')}: {entry.lastLoginAt ? entry.lastLoginAt.toLocaleDateString(i18n.language) : t('common.never')}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
                  <tr>
                    <th className="px-4 py-3">{t('admin.userColumn')}</th>
                    <th className="px-4 py-3">{t('admin.roleLabel')}</th>
                    <th className="px-4 py-3">{t('cms.statusColumn')}</th>
                    <th className="px-4 py-3">{t('admin.verificationColumn')}</th>
                    <th className="px-4 py-3">{t('common.created')}</th>
                    <th className="px-4 py-3">{t('common.lastLogin')}</th>
                    <th className="px-4 py-3 text-right">{t('cms.actionsColumn')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedUsers.map((entry) => {
                    return (
                      <tr key={entry.uid} className="hover:bg-red-50/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{entry.displayName}</p>
                          <p className="text-xs text-gray-500">{entry.email}</p>
                          <p className="text-xs text-gray-400">{t('admin.uidLabel', { uid: entry.uid })}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 capitalize">{entry.role}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${
                            entry.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : entry.status === 'suspended'
                                ? 'bg-red-100 text-red-700'
                                : entry.status === 'pending_verification'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-gray-100 text-gray-700'
                          }`}>{getStatusLabel(entry.status)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.verified ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                            {entry.verified ? t('admin.verified') : t('admin.unverified')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{entry.createdAt ? entry.createdAt.toLocaleDateString(i18n.language) : t('admin.notAvailable')}</td>
                        <td className="px-4 py-3 text-gray-600">{entry.lastLoginAt ? entry.lastLoginAt.toLocaleDateString(i18n.language) : t('common.never')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(entry.uid)}
                              className="rounded-md p-2 text-red-700 hover:bg-red-100"
                              title={t('common.view')}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <AdminPagination
        page={page}
        pageSize={pageSize}
        itemCount={pagedUsers.length}
        hasNextPage={hasNextPage}
        loading={loading}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}

function UsersPage() {
  return <AdminUsersPage />;
}

export default UsersPage;
