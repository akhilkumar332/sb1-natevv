import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { BarChart3, CheckCircle2, CircleDotDashed, MessageSquare, Users } from 'lucide-react';
import { db } from '../../../firebase';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { useAdminNpsActiveUsers, useAdminNpsResponses } from '../../../hooks/admin/useAdminQueries';
import { COLLECTIONS } from '../../../constants/firestore';
import {
  NPS_DETRACTOR_SLA_MS,
  NPS_FOLLOW_UP_STATUS,
  computeNpsScore,
  type NpsFollowUpStatus,
  type NpsRole,
} from '../../../constants/nps';
import type { NpsResponse } from '../../../types/database.types';
import { toDateValue } from '../../../utils/dateValue';
import { runWithFeedback } from '../../../utils/runWithFeedback';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { refetchQuery } from '../../../utils/queryRefetch';
import { useAuth } from '../../../contexts/AuthContext';
import { getServerTimestamp } from '../../../utils/firestore.utils';

type RoleFilter = 'all' | NpsRole;
type SegmentFilter = 'all' | 'promoter' | 'passive' | 'detractor';
type FollowUpFilter = 'all' | NpsFollowUpStatus;
type RangeFilter = '30d' | '90d' | '12m' | 'all';

const rangeDaysMap: Record<Exclude<RangeFilter, 'all'>, number> = {
  '30d': 30,
  '90d': 90,
  '12m': 365,
};

const formatPercent = (value: number): string => `${Math.max(0, Math.round(value * 10) / 10).toFixed(1)}%`;

const toMonthKey = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const toMonthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

function NpsAdminPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all');
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('90d');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});

  const responsesQuery = useAdminNpsResponses();
  const activeUsersQuery = useAdminNpsActiveUsers();

  const loading = responsesQuery.isLoading || activeUsersQuery.isLoading;
  const error = responsesQuery.error || activeUsersQuery.error;

  const rows = useMemo<NpsResponse[]>(() => {
    const source = responsesQuery.data || [];
    return source.map((row) => ({
      ...row,
      createdAt: toDateValue(row.createdAt) as any,
      updatedAt: toDateValue(row.updatedAt) as any,
      followedUpAt: toDateValue(row.followedUpAt) as any,
    }));
  }, [responsesQuery.data]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const term = searchTerm.trim().toLowerCase();
    const fromMs = rangeFilter === 'all' ? null : now - rangeDaysMap[rangeFilter] * 86400000;

    return rows.filter((row) => {
      const createdAt = toDateValue(row.createdAt);
      if (!createdAt) return false;
      if (fromMs && createdAt.getTime() < fromMs) return false;
      if (roleFilter !== 'all' && row.userRole !== roleFilter) return false;
      if (segmentFilter !== 'all' && row.segment !== segmentFilter) return false;
      const status = row.followUpStatus || NPS_FOLLOW_UP_STATUS.open;
      if (followUpFilter !== 'all' && status !== followUpFilter) return false;
      if (!term) return true;
      const haystack = [
        row.userId,
        row.userRole,
        row.segment,
        row.cycleKey,
        row.comment || '',
        row.followUpNotes || '',
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, searchTerm, rangeFilter, roleFilter, segmentFilter, followUpFilter]);

  const summary = useMemo(() => {
    const now = Date.now();
    const promoters = filtered.filter((entry) => entry.segment === 'promoter').length;
    const passives = filtered.filter((entry) => entry.segment === 'passive').length;
    const detractors = filtered.filter((entry) => entry.segment === 'detractor').length;
    const total = filtered.length;
    const nps = computeNpsScore(promoters, detractors, total);

    const activeCounts = activeUsersQuery.data || { donor: 0, ngo: 0, bloodbank: 0, all: 0 };
    const uniqueRespondersOverall = new Set(filtered.map((entry) => entry.userId)).size;
    const responseRateOverall = activeCounts.all > 0
      ? (uniqueRespondersOverall / activeCounts.all) * 100
      : 0;

    const roleRates: Record<NpsRole, number> = {
      donor: 0,
      ngo: 0,
      bloodbank: 0,
    };

    (['donor', 'ngo', 'bloodbank'] as const).forEach((role) => {
      const roleUnique = new Set(
        filtered
          .filter((entry) => entry.userRole === role)
          .map((entry) => entry.userId)
      ).size;
      roleRates[role] = activeCounts[role] > 0 ? (roleUnique / activeCounts[role]) * 100 : 0;
    });

    const detractorSlaBreaches = filtered.filter((entry) => {
      if (entry.segment !== 'detractor') return false;
      const status = entry.followUpStatus || NPS_FOLLOW_UP_STATUS.open;
      if (status === NPS_FOLLOW_UP_STATUS.closed) return false;
      const createdAt = toDateValue(entry.createdAt);
      if (!createdAt) return false;
      return now - createdAt.getTime() > NPS_DETRACTOR_SLA_MS;
    }).length;

    return {
      total,
      promoters,
      passives,
      detractors,
      nps,
      responseRateOverall,
      roleRates,
      detractorSlaBreaches,
    };
  }, [filtered, activeUsersQuery.data]);

  const monthlyTrend = useMemo(() => {
    const buckets = new Map<string, NpsResponse[]>();
    filtered.forEach((entry) => {
      const createdAt = toDateValue(entry.createdAt);
      if (!createdAt) return;
      const key = toMonthKey(createdAt);
      const list = buckets.get(key) || [];
      list.push(entry);
      buckets.set(key, list);
    });

    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, list]) => {
        const promoters = list.filter((entry) => entry.segment === 'promoter').length;
        const detractors = list.filter((entry) => entry.segment === 'detractor').length;
        return {
          key,
          label: toMonthLabel(key),
          total: list.length,
          nps: computeNpsScore(promoters, detractors, list.length),
        };
      })
      .slice(-12);
  }, [filtered]);

  const detractorQueue = useMemo(() => (
    filtered
      .filter((entry) => entry.segment === 'detractor')
      .sort((a, b) => {
        const aTime = toDateValue(a.createdAt)?.getTime() || 0;
        const bTime = toDateValue(b.createdAt)?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 8)
  ), [filtered]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);
  const hasNextPage = page * pageSize < filtered.length;

  useEffect(() => {
    setPage(1);
  }, [searchTerm, roleFilter, segmentFilter, followUpFilter, rangeFilter, pageSize]);

  useEffect(() => {
    setNotesDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      filtered.forEach((entry) => {
        if (!entry.id) return;
        if (next[entry.id] === undefined) {
          next[entry.id] = entry.followUpNotes || '';
          changed = true;
        }
      });
      const activeIds = new Set(filtered.map((entry) => entry.id).filter(Boolean) as string[]);
      Object.keys(next).forEach((id) => {
        if (!activeIds.has(id)) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [filtered]);

  const updateFollowUpStatus = async (row: NpsResponse, nextStatus: NpsFollowUpStatus) => {
    if (!row.id) return;
    setUpdatingId(row.id);
    try {
      await runWithFeedback({
        action: () => updateDoc(doc(db, COLLECTIONS.NPS_RESPONSES, row.id as string), {
          followUpStatus: nextStatus,
          followedUpBy: user?.uid || null,
          followedUpAt: nextStatus === NPS_FOLLOW_UP_STATUS.open ? deleteField() : getServerTimestamp(),
          updatedAt: getServerTimestamp(),
        }),
        successMessage: `Follow-up marked as ${nextStatus.replace('_', ' ')}.`,
        errorMessage: 'Failed to update follow-up status.',
        capture: { scope: 'admin', metadata: { kind: 'admin.nps.followup.update', status: nextStatus } },
        invalidate: () => invalidateAdminRecipe(queryClient, 'npsUpdated'),
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const saveFollowUpNotes = async (row: NpsResponse) => {
    if (!row.id) return;
    const raw = notesDrafts[row.id] ?? row.followUpNotes ?? '';
    const nextNotes = raw.trim();
    const existing = (row.followUpNotes || '').trim();
    if (nextNotes === existing) return;

    setSavingNotesId(row.id);
    try {
      await runWithFeedback({
        action: () => updateDoc(doc(db, COLLECTIONS.NPS_RESPONSES, row.id as string), {
          followUpNotes: nextNotes ? nextNotes : deleteField(),
          followedUpBy: user?.uid || null,
          updatedAt: getServerTimestamp(),
        }),
        successMessage: nextNotes ? 'Follow-up notes saved.' : 'Follow-up notes cleared.',
        errorMessage: 'Failed to save follow-up notes.',
        capture: { scope: 'admin', metadata: { kind: 'admin.nps.followup.notes.update' } },
        invalidate: () => invalidateAdminRecipe(queryClient, 'npsUpdated'),
      });
    } finally {
      setSavingNotesId(null);
    }
  };

  const refreshAll = async () => {
    await Promise.all([refetchQuery(responsesQuery), refetchQuery(activeUsersQuery)]);
  };

  const maxTrendNps = Math.max(1, ...monthlyTrend.map((entry) => Math.abs(entry.nps)));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">NPS Score</h2>
            <p className="text-sm text-gray-600">Quarterly Net Promoter Score across donor, NGO, and bloodbank users.</p>
          </div>
          <AdminRefreshButton onClick={() => void refreshAll()} isRefreshing={responsesQuery.isFetching || activeUsersQuery.isFetching} label="Refresh NPS" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-red-600">NPS</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{summary.nps}</p>
          <p className="text-xs text-gray-500">Sample n={summary.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Promoters</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{summary.promoters}</p>
          <p className="text-xs text-gray-500">9-10 scores</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Passives</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{summary.passives}</p>
          <p className="text-xs text-gray-500">7-8 scores</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-700">Detractors</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{summary.detractors}</p>
          <p className="text-xs text-gray-500">0-6 scores</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-red-600">SLA</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{summary.detractorSlaBreaches}</p>
          <p className="text-xs text-gray-500">Detractors open {'>'} 7d</p>
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search by user, comment, cycle"
        leftContent={(
          <>
            <select
              value={rangeFilter}
              onChange={(event) => setRangeFilter(event.target.value as RangeFilter)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="30d">Last 30d</option>
              <option value="90d">Last 90d</option>
              <option value="12m">Last 12m</option>
              <option value="all">All time</option>
            </select>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All roles</option>
              <option value="donor">Donor</option>
              <option value="ngo">NGO</option>
              <option value="bloodbank">Bloodbank</option>
            </select>
            <select
              value={segmentFilter}
              onChange={(event) => setSegmentFilter(event.target.value as SegmentFilter)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All segments</option>
              <option value="promoter">Promoter</option>
              <option value="passive">Passive</option>
              <option value="detractor">Detractor</option>
            </select>
            <select
              value={followUpFilter}
              onChange={(event) => setFollowUpFilter(event.target.value as FollowUpFilter)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All follow-up</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="closed">Closed</option>
            </select>
          </>
        )}
        rightContent={(
          <div className="text-xs text-gray-600">
            <p>Response rate: {formatPercent(summary.responseRateOverall)}</p>
            <p>D: {formatPercent(summary.roleRates.donor)} | N: {formatPercent(summary.roleRates.ngo)} | B: {formatPercent(summary.roleRates.bloodbank)}</p>
          </div>
        )}
      />

      <AdminRefreshingBanner show={loading} message="Refreshing NPS data..." />
      <AdminErrorCard message={error instanceof Error ? error.message : null} onRetry={() => void refreshAll()} />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <BarChart3 className="h-4 w-4 text-red-600" />
            NPS Trend (last 12 months in selected range)
          </div>
          {monthlyTrend.length === 0 ? (
            <p className="text-sm text-gray-500">No trend data for selected filters.</p>
          ) : (
            <div className="space-y-2">
              {monthlyTrend.map((point) => {
                const width = `${Math.max(4, (Math.abs(point.nps) / maxTrendNps) * 100)}%`;
                const positive = point.nps >= 0;
                return (
                  <div key={point.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{point.label}</span>
                      <span className="font-semibold">NPS {point.nps} · n={point.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className={`h-2 rounded-full ${positive ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <MessageSquare className="h-4 w-4 text-red-600" />
            Detractor Queue
          </div>
          <div className="space-y-2">
            {detractorQueue.length === 0 ? (
              <p className="text-sm text-gray-500">No detractor responses in this range.</p>
            ) : (
              detractorQueue.map((entry) => {
                const createdAt = toDateValue(entry.createdAt);
                const overdue = createdAt ? (Date.now() - createdAt.getTime() > NPS_DETRACTOR_SLA_MS) : false;
                const status = entry.followUpStatus || NPS_FOLLOW_UP_STATUS.open;
                return (
                  <div key={entry.id} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-800">{entry.userRole} · score {entry.score}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${overdue ? 'bg-rose-200 text-rose-800' : 'bg-gray-200 text-gray-700'}`}>
                        {overdue ? 'SLA breach' : status.replace('_', ' ')}
                      </span>
                    </div>
                    {entry.comment ? <p className="mt-1 line-clamp-2 text-xs text-gray-700">{entry.comment}</p> : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {paged.length === 0 ? (
        <AdminEmptyStateCard message="No NPS responses found for selected filters." />
      ) : (
        <div className="space-y-3">
          <div className="space-y-3 lg:hidden">
            {paged.map((entry) => {
              const createdAt = toDateValue(entry.createdAt);
              const status = entry.followUpStatus || NPS_FOLLOW_UP_STATUS.open;
              return (
                <article key={entry.id} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{entry.userRole} · score {entry.score}</p>
                      <p className="text-xs text-gray-500">{entry.userId}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{entry.segment}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Cycle {entry.cycleKey} · {createdAt ? createdAt.toLocaleString() : 'N/A'}</p>
                  {entry.comment ? (
                    <p className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-2 text-xs text-gray-700 whitespace-pre-wrap">{entry.comment}</p>
                  ) : null}
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Follow-up Notes</p>
                    <textarea
                      value={entry.id ? (notesDrafts[entry.id] ?? '') : ''}
                      onChange={(event) => {
                        if (!entry.id) return;
                        setNotesDrafts((prev) => ({ ...prev, [entry.id as string]: event.target.value }));
                      }}
                      rows={2}
                      placeholder="Add follow-up notes..."
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                    />
                    <div className="mt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void saveFollowUpNotes(entry)}
                        disabled={!entry.id || savingNotesId === entry.id || updatingId === entry.id}
                        className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {savingNotesId === entry.id ? 'Saving...' : 'Save note'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => void updateFollowUpStatus(entry, NPS_FOLLOW_UP_STATUS.open)}
                      disabled={updatingId === entry.id || status === NPS_FOLLOW_UP_STATUS.open}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateFollowUpStatus(entry, NPS_FOLLOW_UP_STATUS.inProgress)}
                      disabled={updatingId === entry.id || status === NPS_FOLLOW_UP_STATUS.inProgress}
                      className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 disabled:opacity-50"
                    >
                      In progress
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateFollowUpStatus(entry, NPS_FOLLOW_UP_STATUS.closed)}
                      disabled={updatingId === entry.id || status === NPS_FOLLOW_UP_STATUS.closed}
                      className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                    >
                      Closed
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
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Segment</th>
                    <th className="px-4 py-3">Cycle</th>
                    <th className="px-4 py-3">Comment</th>
                    <th className="px-4 py-3">Follow-up Notes</th>
                    <th className="px-4 py-3">Follow-up</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((entry) => {
                    const createdAt = toDateValue(entry.createdAt);
                    const status = entry.followUpStatus || NPS_FOLLOW_UP_STATUS.open;
                    return (
                      <tr key={entry.id} className="hover:bg-red-50/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{entry.userRole}</p>
                          <p className="text-xs text-gray-500">{entry.userId}</p>
                          <p className="text-xs text-gray-500">{createdAt ? createdAt.toLocaleDateString() : 'N/A'}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{entry.score}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            entry.segment === 'promoter'
                              ? 'bg-emerald-100 text-emerald-700'
                              : entry.segment === 'passive'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-rose-100 text-rose-700'
                          }`}
                          >
                            {entry.segment}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{entry.cycleKey}</td>
                        <td className="max-w-xs px-4 py-3 text-gray-700">
                          <p className="line-clamp-2">{entry.comment || '-'}</p>
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          <textarea
                            value={entry.id ? (notesDrafts[entry.id] ?? '') : ''}
                            onChange={(event) => {
                              if (!entry.id) return;
                              setNotesDrafts((prev) => ({ ...prev, [entry.id as string]: event.target.value }));
                            }}
                            rows={2}
                            placeholder="Add follow-up notes..."
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                          />
                          <div className="mt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => void saveFollowUpNotes(entry)}
                              disabled={!entry.id || savingNotesId === entry.id || updatingId === entry.id}
                              className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {savingNotesId === entry.id ? 'Saving...' : 'Save note'}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{status.replace('_', ' ')}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => void updateFollowUpStatus(entry, NPS_FOLLOW_UP_STATUS.open)}
                              disabled={updatingId === entry.id || status === NPS_FOLLOW_UP_STATUS.open}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
                              title="Mark open"
                            >
                              <CircleDotDashed className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void updateFollowUpStatus(entry, NPS_FOLLOW_UP_STATUS.inProgress)}
                              disabled={updatingId === entry.id || status === NPS_FOLLOW_UP_STATUS.inProgress}
                              className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 disabled:opacity-50"
                              title="Mark in progress"
                            >
                              <Users className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void updateFollowUpStatus(entry, NPS_FOLLOW_UP_STATUS.closed)}
                              disabled={updatingId === entry.id || status === NPS_FOLLOW_UP_STATUS.closed}
                              className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                              title="Mark closed"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
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
        </div>
      )}

      <AdminPagination
        page={page}
        pageSize={pageSize}
        itemCount={paged.length}
        hasNextPage={hasNextPage}
        loading={loading}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}

export default NpsAdminPage;
