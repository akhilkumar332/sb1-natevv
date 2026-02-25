import { useEffect, useMemo, useState } from 'react';
import { Eye, ShieldCheck, UserCheck, UserMinus, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '../../../types/database.types';
import { timestampToDate } from '../../../utils/firestore.utils';
import { useAuth } from '../../../contexts/AuthContext';
import {
  deleteUserAccount,
  updateUserStatus,
  verifyUserAccount,
} from '../../../services/admin.service';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import { useAdminUsers } from '../../../hooks/admin/useAdminQueries';
import { adminQueryKeys } from '../../../constants/adminQueryKeys';

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

const toDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  return timestampToDate(value as any);
};

export function AdminUsersPage({
  roleFilter = 'all',
  title = 'User Management',
  description = 'Manage users across all portal roles.',
}: AdminUsersPageProps) {
  const { user: authUser, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

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
        displayName: entry.displayName || entry.organizationName || entry.hospitalName || entry.bloodBankName || 'User',
        email: entry.email || '-',
        role: normalizeRole(entry.role),
        status: entry.status || 'active',
        verified: Boolean(entry.verified),
        city: entry.city,
        bhId: entry.bhId,
        createdAt: toDate(entry.createdAt),
        lastLoginAt: toDate(entry.lastLoginAt),
      }))
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }, [usersQuery.data]);

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

  const guardedAction = (target: UserRow) => {
    if (!authUser?.uid) {
      toast.error('Admin session not found.');
      return false;
    }
    if (target.uid === authUser.uid) {
      toast.error('You cannot modify your own account here.');
      return false;
    }
    if (target.role === 'superadmin' && !isSuperAdmin) {
      toast.error('Only superadmin can modify superadmin accounts.');
      return false;
    }
    return true;
  };

  const handleStatusChange = async (target: UserRow, nextStatus: 'active' | 'inactive' | 'suspended' | 'pending_verification') => {
    if (!guardedAction(target)) return;
    if (!authUser?.uid) return;
    setProcessingUid(target.uid);
    try {
      await updateUserStatus(target.uid, nextStatus, authUser.uid);
      toast.success(`Updated status to ${nextStatus}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.usersRoot }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.overviewRoot }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.platformStatsRoot }),
      ]);
    } catch (updateError: any) {
      toast.error(updateError?.message || 'Failed to update status.');
    } finally {
      setProcessingUid(null);
    }
  };

  const handleVerify = async (target: UserRow) => {
    if (!guardedAction(target)) return;
    if (!authUser?.uid) return;
    setProcessingUid(target.uid);
    try {
      await verifyUserAccount(target.uid, authUser.uid);
      toast.success('User verified');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.usersRoot }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.verificationRoot }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.overviewRoot }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.platformStatsRoot }),
      ]);
    } catch (verifyError: any) {
      toast.error(verifyError?.message || 'Failed to verify user.');
    } finally {
      setProcessingUid(null);
    }
  };

  const handleDeactivate = async (target: UserRow) => {
    if (!guardedAction(target)) return;
    if (!authUser?.uid) return;
    setProcessingUid(target.uid);
    try {
      await deleteUserAccount(target.uid, authUser.uid);
      toast.success('User deactivated');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.usersRoot }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.overviewRoot }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.platformStatsRoot }),
      ]);
    } catch (deleteError: any) {
      toast.error(deleteError?.message || 'Failed to deactivate user.');
    } finally {
      setProcessingUid(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => void usersQuery.refetch()}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Refresh
          </button>
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search by name, email, uid, city, or BH ID"
        leftContent={
          <>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="pending_verification">Pending verification</option>
            </select>
          </>
        }
        rightContent={<span className="text-xs font-semibold text-gray-500">{filteredUsers.length} users</span>}
      />

      {loading && (
        <div className="rounded-xl border border-red-100 bg-white px-4 py-2 text-xs font-semibold text-gray-600 shadow-sm">
          Refreshing users...
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">{error}</div>
      )}

      {pagedUsers.length === 0 ? (
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-500 shadow-sm">
          No users found for current filters.
        </div>
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {pagedUsers.map((entry) => {
              const busy = processingUid === entry.uid;
              return (
                <article key={`mobile-${entry.uid}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{entry.displayName}</p>
                      <p className="text-xs text-gray-500">{entry.email}</p>
                      <p className="text-xs text-gray-400">UID: {entry.uid}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(entry)}
                      className="rounded-md p-2 text-red-700 hover:bg-red-100"
                      title="View"
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
                      {entry.status}
                    </span>
                    <span className={`rounded-full px-2 py-1 font-semibold text-center ${entry.verified ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                      {entry.verified ? 'Verified' : 'Unverified'}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700 text-center">
                      {entry.city || 'No city'}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-gray-500 space-y-1">
                    <p>Created: {entry.createdAt ? entry.createdAt.toLocaleDateString() : 'N/A'}</p>
                    <p>Last Login: {entry.lastLoginAt ? entry.lastLoginAt.toLocaleDateString() : 'Never'}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {!entry.verified && (
                      <button
                        type="button"
                        onClick={() => handleVerify(entry)}
                        disabled={busy}
                        className="inline-flex items-center justify-center rounded-md border border-emerald-200 px-2 py-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        title="Verify"
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStatusChange(entry, 'active')}
                      disabled={busy}
                      className="inline-flex items-center justify-center rounded-md border border-emerald-200 px-2 py-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      title="Set active"
                    >
                      <UserCheck className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(entry, 'suspended')}
                      disabled={busy}
                      className="inline-flex items-center justify-center rounded-md border border-amber-200 px-2 py-2 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      title="Suspend"
                    >
                      <UserX className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeactivate(entry)}
                      disabled={busy}
                      className="inline-flex items-center justify-center rounded-md border border-red-200 px-2 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      title="Deactivate"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
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
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Verification</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Last Login</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedUsers.map((entry) => {
                    const busy = processingUid === entry.uid;
                    return (
                      <tr key={entry.uid} className="hover:bg-red-50/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{entry.displayName}</p>
                          <p className="text-xs text-gray-500">{entry.email}</p>
                          <p className="text-xs text-gray-400">UID: {entry.uid}</p>
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
                          }`}>{entry.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.verified ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                            {entry.verified ? 'Verified' : 'Unverified'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{entry.createdAt ? entry.createdAt.toLocaleDateString() : 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-600">{entry.lastLoginAt ? entry.lastLoginAt.toLocaleDateString() : 'Never'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedUser(entry)}
                              className="rounded-md p-2 text-red-700 hover:bg-red-100"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {!entry.verified && (
                              <button
                                type="button"
                                onClick={() => handleVerify(entry)}
                                disabled={busy}
                                className="rounded-md p-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                title="Verify"
                              >
                                <ShieldCheck className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(entry, 'active')}
                              disabled={busy}
                              className="rounded-md p-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                              title="Set active"
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(entry, 'suspended')}
                              disabled={busy}
                              className="rounded-md p-2 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                              title="Suspend"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivate(entry)}
                              disabled={busy}
                              className="rounded-md p-2 text-red-700 hover:bg-red-100 disabled:opacity-50"
                              title="Deactivate"
                            >
                              <UserMinus className="h-4 w-4" />
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

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900">User Details</h3>
            <div className="mt-4 space-y-2 text-sm text-gray-700">
              <p><span className="font-semibold">Name:</span> {selectedUser.displayName}</p>
              <p><span className="font-semibold">Email:</span> {selectedUser.email}</p>
              <p><span className="font-semibold">UID:</span> {selectedUser.uid}</p>
              <p><span className="font-semibold">Role:</span> {selectedUser.role}</p>
              <p><span className="font-semibold">Status:</span> {selectedUser.status}</p>
              <p><span className="font-semibold">Verified:</span> {selectedUser.verified ? 'Yes' : 'No'}</p>
              <p><span className="font-semibold">City:</span> {selectedUser.city || 'N/A'}</p>
              <p><span className="font-semibold">BH ID:</span> {selectedUser.bhId || 'N/A'}</p>
              <p><span className="font-semibold">Created:</span> {selectedUser.createdAt ? selectedUser.createdAt.toLocaleString() : 'N/A'}</p>
              <p><span className="font-semibold">Last Login:</span> {selectedUser.lastLoginAt ? selectedUser.lastLoginAt.toLocaleString() : 'Never'}</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersPage() {
  return <AdminUsersPage />;
}

export default UsersPage;
