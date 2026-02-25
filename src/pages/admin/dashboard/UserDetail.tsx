import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import {
  deleteUserAccount,
  updateUserStatus,
  verifyUserAccount,
} from '../../../services/admin.service';
import { adminQueryKeys, type AdminKpiRange } from '../../../constants/adminQueryKeys';
import {
  useAdminUserDetail,
  useAdminUserKpis,
  useAdminUserReferrals,
  useAdminUserSecurity,
  useAdminUserTimeline,
} from '../../../hooks/admin/useAdminQueries';
import { monitoringService } from '../../../services/monitoring.service';
import { revokeAllUserFcmTokens, revokeUserFcmToken } from '../../../services/adminUserDetail.service';
import type { UserStatus } from '../../../types/database.types';
import ActionReasonModal from '../../../components/admin/ActionReasonModal';
import UserDetailQuickActions from '../../../components/admin/UserDetailQuickActions';
import UserDetailSummaryStrip from '../../../components/admin/UserDetailSummaryStrip';
import SecurityEventsFilter from '../../../components/admin/SecurityEventsFilter';
import UserKpiRangeSelector from '../../../components/admin/UserKpiRangeSelector';
import UserKpiCards from '../../../components/admin/UserKpiCards';
import UserKpiTrend from '../../../components/admin/UserKpiTrend';
import UserReferralFilters from '../../../components/admin/UserReferralFilters';
import UserReferralGraph from '../../../components/admin/UserReferralGraph';
import UserReferralTable from '../../../components/admin/UserReferralTable';
import UserDetailTabSkeleton from '../../../components/admin/UserDetailTabSkeleton';

type DetailTab = 'profile' | 'security' | 'kpis' | 'referrals' | 'timeline';
type PendingActionType = 'verify' | 'active' | 'suspended' | 'inactive' | 'revokeToken' | 'revokeAllTokens';
type PendingAction = { type: PendingActionType; token?: string } | null;

const PAGE_SIZE = 10;

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'kpis', label: 'KPI & Graphs' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'timeline', label: 'Timeline' },
];

const formatDateTime = (value: any) => {
  if (!value) return 'N/A';
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toLocaleString();
  return 'N/A';
};

const formatRole = (role?: string | null) => {
  if (!role) return 'unknown';
  return role === 'hospital' ? 'bloodbank' : role;
};

const actionConfig: Record<PendingActionType, { title: string; label: string; description: string }> = {
  verify: {
    title: 'Confirm Verify User',
    label: 'Verify User',
    description: 'This will mark the user as verified and activate the account.',
  },
  active: {
    title: 'Confirm Set Active',
    label: 'Set Active',
    description: 'This will set account status to active.',
  },
  suspended: {
    title: 'Confirm Suspend User',
    label: 'Suspend',
    description: 'This will suspend the account immediately.',
  },
  inactive: {
    title: 'Confirm Deactivate User',
    label: 'Deactivate',
    description: 'This will deactivate the account (status set to inactive).',
  },
  revokeToken: {
    title: 'Confirm Token Revoke',
    label: 'Revoke Token',
    description: 'This will revoke the selected FCM token and remove it from active sessions.',
  },
  revokeAllTokens: {
    title: 'Confirm Revoke All Tokens',
    label: 'Revoke All Tokens',
    description: 'This will revoke all active FCM tokens for this user.',
  },
};

function UserDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const safeUid = uid || '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authUser, isSuperAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const activeTab: DetailTab = tabs.some((tab) => tab.id === tabParam)
    ? (tabParam as DetailTab)
    : 'profile';
  const [kpiRange, setKpiRange] = useState<AdminKpiRange>('90d');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [executingAction, setExecutingAction] = useState(false);

  const [ipFilterKind, setIpFilterKind] = useState<'all' | 'impersonationEvents' | 'auditLogs'>('all');
  const [ipSearch, setIpSearch] = useState('');
  const [ipPage, setIpPage] = useState(1);

  const [referralRoleFilter, setReferralRoleFilter] = useState('all');
  const [referralStatusFilter, setReferralStatusFilter] = useState('all');
  const [referralSearch, setReferralSearch] = useState('');
  const [referralPage, setReferralPage] = useState(1);

  const [timelineKindFilter, setTimelineKindFilter] = useState<'all' | 'audit' | 'notification' | 'impersonation'>('all');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelinePage, setTimelinePage] = useState(1);

  const userQuery = useAdminUserDetail(safeUid);
  const securityQuery = useAdminUserSecurity(safeUid);
  const kpiQuery = useAdminUserKpis(safeUid, userQuery.data?.role, kpiRange);
  const referralsQuery = useAdminUserReferrals(safeUid, {
    role: referralRoleFilter,
    status: referralStatusFilter,
    search: referralSearch,
  });
  const timelineQuery = useAdminUserTimeline(safeUid, {
    kind: timelineKindFilter,
    search: timelineSearch,
  });

  const invalidRoute = !uid;
  const user = userQuery.data;
  const role = formatRole(user?.role);

  const setActiveTab = (tab: DetailTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    monitoringService.trackPerformance({
      name: `admin_userdetail_tab_${activeTab}`,
      value: Date.now(),
      unit: 'count',
    } as any);
  }, [activeTab]);

  useEffect(() => {
    if (!tabParam || tabs.some((tab) => tab.id === tabParam)) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'profile');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, tabParam]);

  const canModify = useMemo(() => {
    if (!authUser?.uid || !user?.uid) return false;
    if (authUser.uid === user.uid) return false;
    if (user.role === 'superadmin' && !isSuperAdmin) return false;
    return true;
  }, [authUser?.uid, isSuperAdmin, user?.role, user?.uid]);

  const filteredIps = useMemo(() => {
    const term = ipSearch.trim().toLowerCase();
    return (securityQuery.data?.loginIps || []).filter((entry) => {
      if (ipFilterKind !== 'all' && entry.source !== ipFilterKind) return false;
      if (!term) return true;
      return `${entry.ip} ${entry.userAgent || ''}`.toLowerCase().includes(term);
    });
  }, [ipFilterKind, ipSearch, securityQuery.data?.loginIps]);

  const ipTotalPages = Math.max(1, Math.ceil(filteredIps.length / PAGE_SIZE));
  const pagedIps = filteredIps.slice((ipPage - 1) * PAGE_SIZE, ipPage * PAGE_SIZE);

  const timelineEntries = timelineQuery.data || [];
  const timelineTotalPages = Math.max(1, Math.ceil(timelineEntries.length / PAGE_SIZE));
  const pagedTimeline = timelineEntries.slice((timelinePage - 1) * PAGE_SIZE, timelinePage * PAGE_SIZE);

  const referrals = referralsQuery.data || [];
  const referralTotalPages = Math.max(1, Math.ceil(referrals.length / PAGE_SIZE));
  const pagedReferrals = referrals.slice((referralPage - 1) * PAGE_SIZE, referralPage * PAGE_SIZE);

  useEffect(() => {
    setIpPage(1);
  }, [safeUid, filteredIps.length]);

  useEffect(() => {
    setTimelinePage(1);
  }, [safeUid, timelineEntries.length]);

  useEffect(() => {
    setReferralPage(1);
  }, [safeUid, referrals.length]);

  const refreshAll = () => {
    void userQuery.refetch();
    void securityQuery.refetch();
    void kpiQuery.refetch();
    void referralsQuery.refetch();
    void timelineQuery.refetch();
  };

  const confirmAction = async (reason: string) => {
    if (!pendingAction || !authUser?.uid || !user?.uid) return;
    const start = performance.now();
    setExecutingAction(true);
    try {
      if (pendingAction.type === 'verify') {
        await verifyUserAccount(user.uid, authUser.uid, reason);
      } else if (pendingAction.type === 'inactive') {
        await deleteUserAccount(user.uid, authUser.uid, reason);
      } else if (pendingAction.type === 'active' || pendingAction.type === 'suspended') {
        const nextStatus: UserStatus = pendingAction.type;
        await updateUserStatus(user.uid, nextStatus, authUser.uid, reason);
      } else if (pendingAction.type === 'revokeToken') {
        if (!pendingAction.token) throw new Error('Missing token');
        await revokeUserFcmToken(user.uid, pendingAction.token, authUser.uid, reason);
      } else if (pendingAction.type === 'revokeAllTokens') {
        await revokeAllUserFcmTokens(user.uid, authUser.uid, reason);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.usersRoot }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.userDetailRoot }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.verificationRoot }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.overviewRoot }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.platformStatsRoot }),
      ]);

      monitoringService.trackPerformance({
        name: `admin_user_action_${pendingAction.type}`,
        value: performance.now() - start,
        unit: 'ms',
      } as any);

      toast.success(`${actionConfig[pendingAction.type].label} completed`);
      setPendingAction(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to perform action');
    } finally {
      setExecutingAction(false);
    }
  };

  const loadingBanner = userQuery.isLoading || userQuery.isFetching;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh All
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {invalidRoute
                ? 'Invalid user detail route'
                : user?.displayName || user?.organizationName || user?.hospitalName || user?.bloodBankName || 'Loading user...'}
            </h2>
            <p className="text-sm text-gray-600">UID: {uid || 'N/A'}</p>
          </div>
          <div className="text-sm text-gray-600 sm:text-right">
            <p>Email: {user?.email || 'N/A'}</p>
            <p>Role: <span className="font-semibold capitalize">{role}</span></p>
            <p>Status: <span className="font-semibold capitalize">{user?.status || 'unknown'}</span></p>
          </div>
        </div>
      </div>

      <UserDetailSummaryStrip
        status={user?.status}
        verified={user?.verified}
        lastLoginLabel={formatDateTime(user?.lastLoginAt)}
        timelineCount={timelineEntries.length}
        referralCount={referrals.length}
      />

      <UserDetailQuickActions
        canModify={canModify}
        verified={Boolean(user?.verified)}
        onAction={(action) => setPendingAction({ type: action })}
      />

      {invalidRoute && (
        <div className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700">
          Missing user id in route. Open this page from a user list with the View button.
        </div>
      )}

      {loadingBanner && (
        <div className="rounded-xl border border-red-100 bg-white px-4 py-2 text-xs font-semibold text-gray-600 shadow-sm">
          Updating user data in background...
        </div>
      )}
      {userQuery.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {userQuery.error instanceof Error ? userQuery.error.message : 'Failed to load user details'}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-red-100 bg-white p-2 shadow-sm">
        <div className="flex min-w-max items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-red-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'profile' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Identity</h3>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              <p><span className="font-semibold">Name:</span> {user?.displayName || 'N/A'}</p>
              <p><span className="font-semibold">Email:</span> {user?.email || 'N/A'}</p>
              <p><span className="font-semibold">Phone:</span> {user?.phoneNumber || 'N/A'}</p>
              <p><span className="font-semibold">BH ID:</span> {user?.bhId || 'N/A'}</p>
              <p><span className="font-semibold">Verified:</span> {user?.verified ? 'Yes' : 'No'}</p>
              <p><span className="font-semibold">Created At:</span> {formatDateTime(user?.createdAt)}</p>
              <p><span className="font-semibold">Last Login:</span> {formatDateTime(user?.lastLoginAt)}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Profile Details</h3>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              <p><span className="font-semibold">Role:</span> {role}</p>
              <p><span className="font-semibold">Status:</span> {user?.status || 'N/A'}</p>
              <p><span className="font-semibold">Blood Type:</span> {user?.bloodType || 'N/A'}</p>
              <p><span className="font-semibold">Organization:</span> {user?.organizationName || user?.bloodBankName || user?.hospitalName || 'N/A'}</p>
              <p><span className="font-semibold">City:</span> {user?.city || 'N/A'}</p>
              <p><span className="font-semibold">State:</span> {user?.state || 'N/A'}</p>
              <p><span className="font-semibold">Country:</span> {user?.country || 'N/A'}</p>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Active FCM Tokens</h3>
            {(securityQuery.data?.activeFcmTokens || []).length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No active tokens.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {(securityQuery.data?.activeFcmTokens || []).map((token) => (
                  <div key={token} className="rounded-lg border border-gray-100 p-2 text-xs text-gray-600">
                    <p className="break-all">{token}</p>
                    <button
                      type="button"
                      disabled={!canModify}
                      onClick={() => setPendingAction({ type: 'revokeToken', token })}
                      className="mt-2 rounded-md border border-red-200 px-2 py-1 font-semibold text-red-700 disabled:opacity-60"
                    >
                      Revoke Token
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={!canModify}
                  onClick={() => setPendingAction({ type: 'revokeAllTokens' })}
                  className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                >
                  Revoke All Tokens
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Logged IP Addresses</h3>
              {securityQuery.isFetching && <span className="text-xs text-gray-500">Refreshing...</span>}
            </div>
            <SecurityEventsFilter
              kind={ipFilterKind}
              search={ipSearch}
              onKindChange={setIpFilterKind}
              onSearchChange={setIpSearch}
            />
            {filteredIps.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No IP events found.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {pagedIps.map((entry, index) => (
                    <div key={`${entry.ip}-${(ipPage - 1) * PAGE_SIZE + index}`} className="rounded-lg border border-gray-100 p-2 text-xs text-gray-700">
                      <p>IP: <span className="font-semibold">{entry.ip}</span></p>
                      <p>Source: {entry.source}</p>
                      <p>User Agent: {entry.userAgent || 'N/A'}</p>
                      <p>Time: {formatDateTime(entry.createdAt)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIpPage((prev) => Math.max(1, prev - 1))}
                    disabled={ipPage <= 1}
                    className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-gray-500">Page {ipPage} of {ipTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setIpPage((prev) => Math.min(ipTotalPages, prev + 1))}
                    disabled={ipPage >= ipTotalPages}
                    className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {activeTab === 'kpis' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900">KPI Cards</h3>
              <UserKpiRangeSelector value={kpiRange} onChange={setKpiRange} />
            </div>
            <div className="mt-4">
              {kpiQuery.isLoading && !kpiQuery.data ? <UserDetailTabSkeleton /> : <UserKpiCards kpis={kpiQuery.data} />}
            </div>
          </section>

          <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Recent Trend</h3>
            <div className="mt-4">
              {kpiQuery.isLoading && !kpiQuery.data ? <UserDetailTabSkeleton /> : <UserKpiTrend kpis={kpiQuery.data} />}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'referrals' && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Referred Users</h3>
              {referralsQuery.isFetching && <span className="text-xs text-gray-500">Refreshing...</span>}
            </div>
            <UserReferralFilters
              role={referralRoleFilter}
              status={referralStatusFilter}
              search={referralSearch}
              onRoleChange={setReferralRoleFilter}
              onStatusChange={setReferralStatusFilter}
              onSearchChange={setReferralSearch}
            />
            {referralsQuery.isLoading && !referralsQuery.data ? (
              <UserDetailTabSkeleton />
            ) : (
              <>
                <UserReferralTable rows={pagedReferrals} formatDateTime={formatDateTime} formatRole={formatRole} />
                {referrals.length > PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReferralPage((prev) => Math.max(1, prev - 1))}
                      disabled={referralPage <= 1}
                      className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-gray-500">Page {referralPage} of {referralTotalPages}</span>
                    <button
                      type="button"
                      onClick={() => setReferralPage((prev) => Math.min(referralTotalPages, prev + 1))}
                      disabled={referralPage >= referralTotalPages}
                      className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          <UserReferralGraph rows={referrals} />
        </section>
      )}

      {activeTab === 'timeline' && (
        <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">User Timeline</h3>
            {timelineQuery.isFetching && <span className="text-xs text-gray-500">Refreshing...</span>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              value={timelineKindFilter}
              onChange={(event) => setTimelineKindFilter(event.target.value as any)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700"
            >
              <option value="all">All Events</option>
              <option value="audit">Audit</option>
              <option value="notification">Notification</option>
              <option value="impersonation">Impersonation</option>
            </select>
            <input
              type="text"
              value={timelineSearch}
              onChange={(event) => setTimelineSearch(event.target.value)}
              placeholder="Search title/description"
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700"
            />
          </div>
          {timelineQuery.isLoading && !timelineQuery.data ? (
            <div className="mt-4"><UserDetailTabSkeleton /></div>
          ) : timelineEntries.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No timeline events found.</p>
          ) : (
            <>
              <div className="mt-4 space-y-3">
                {pagedTimeline.map((entry) => (
                  <article key={`${entry.kind}-${entry.id}`} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-gray-900">{entry.title}</p>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 capitalize">{entry.kind}</span>
                    </div>
                    {entry.description && <p className="mt-1 text-sm text-gray-600">{entry.description}</p>}
                    <p className="mt-1 text-xs text-gray-500">{formatDateTime(entry.createdAt)}</p>
                  </article>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTimelinePage((prev) => Math.max(1, prev - 1))}
                  disabled={timelinePage <= 1}
                  className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">Page {timelinePage} of {timelineTotalPages}</span>
                <button
                  type="button"
                  onClick={() => setTimelinePage((prev) => Math.min(timelineTotalPages, prev + 1))}
                  disabled={timelinePage >= timelineTotalPages}
                  className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {pendingAction && (
        <ActionReasonModal
          title={actionConfig[pendingAction.type].title}
          description={actionConfig[pendingAction.type].description}
          confirmLabel={actionConfig[pendingAction.type].label}
          loading={executingAction}
          onCancel={() => setPendingAction(null)}
          onConfirm={(reason) => void confirmAction(reason)}
        />
      )}
    </div>
  );
}

export default UserDetailPage;
