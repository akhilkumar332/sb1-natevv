import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { AlertTriangle, BarChart3, CheckCircle2, CircleDotDashed, MessageSquare, RotateCcw, Users } from 'lucide-react';
import { db } from '../../../firebase';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import {
  useAdminNpsActiveUserProfiles,
  useAdminNpsActiveUsers,
  useAdminNpsPromptOverrides,
  useAdminNpsResponses
} from '../../../hooks/admin/useAdminQueries';
import { adminQueryKeys } from '../../../constants/adminQueryKeys';
import { COLLECTIONS } from '../../../constants/firestore';
import {
  NPS_DETRACTOR_ESCALATION_SLA_MS,
  NPS_DETRACTOR_SLA_MS,
  NPS_DRIVER_TAGS,
  NPS_FOLLOW_UP_STATUS,
  NPS_MIN_SAMPLE_SIZE,
  computeNpsScore,
  getNpsCycleKey,
  getNpsSampleConfidence,
  normalizeNpsRole,
  type NpsDriverTag,
  type NpsFollowUpStatus,
  type NpsRole,
} from '../../../constants/nps';
import type { NpsPromptOverride, NpsResponse } from '../../../types/database.types';
import { toDateValue } from '../../../utils/dateValue';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { refetchQuery } from '../../../utils/queryRefetch';
import { useAuth } from '../../../contexts/AuthContext';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { notify } from '../../../services/notify.service';
import { captureHandledError } from '../../../services/errorLog.service';
import {
  updateAdminNpsFollowUpNotes,
  updateAdminNpsFollowUpStatus,
  updateAdminNpsTags,
} from '../../../services/offlineMutationOutbox.service';

type RoleFilter = 'all' | NpsRole;
type SegmentFilter = 'all' | 'promoter' | 'passive' | 'detractor';
type FollowUpFilter = 'all' | NpsFollowUpStatus;
type RangeFilter = '30d' | '90d' | '12m' | 'all';
type TriggerMode = 'single_user' | 'all_role';
type AuditStatusFilter = 'all' | 'enabled' | 'consumed';

const rangeDaysMap: Record<Exclude<RangeFilter, 'all'>, number> = {
  '30d': 30,
  '90d': 90,
  '12m': 365,
};

const formatPercent = (value: number): string => `${Math.max(0, Math.round(value * 10) / 10).toFixed(1)}%`;
const DRIVER_TAG_LIST: readonly NpsDriverTag[] = Object.values(NPS_DRIVER_TAGS);
const DRIVER_TAG_LABELS: Record<NpsDriverTag, string> = {
  support: 'Support',
  availability: 'Availability',
  app_ux: 'App UX',
  turnaround: 'Turnaround',
  trust: 'Trust',
  communication: 'Communication',
  operations: 'Operations',
};

const toMonthKey = (date: Date): string => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const toMonthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const getConfidenceStyles = (confidence: 'low' | 'medium' | 'high'): string => {
  if (confidence === 'high') return 'bg-emerald-100 text-emerald-700';
  if (confidence === 'medium') return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
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
  const [savingTagsId, setSavingTagsId] = useState<string | null>(null);
  const [triggeringUserId, setTriggeringUserId] = useState('');
  const [triggerMode, setTriggerMode] = useState<TriggerMode>('single_user');
  const [triggerRole, setTriggerRole] = useState<NpsRole>('donor');
  const [triggering, setTriggering] = useState(false);
  const [auditCycleFilter, setAuditCycleFilter] = useState<string>('all');
  const [auditStatusFilter, setAuditStatusFilter] = useState<AuditStatusFilter>('all');
  const [auditActorFilter, setAuditActorFilter] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [tagDrafts, setTagDrafts] = useState<Record<string, NpsDriverTag[]>>({});

  const responsesQuery = useAdminNpsResponses();
  const activeUsersQuery = useAdminNpsActiveUsers();
  const activeProfilesQuery = useAdminNpsActiveUserProfiles();
  const promptOverridesQuery = useAdminNpsPromptOverrides();

  const loading = responsesQuery.isLoading || activeUsersQuery.isLoading || activeProfilesQuery.isLoading || promptOverridesQuery.isLoading;
  const error = responsesQuery.error || activeUsersQuery.error || activeProfilesQuery.error || promptOverridesQuery.error;

  const rows = useMemo<NpsResponse[]>(() => {
    const source = responsesQuery.data || [];
    return source.map((row) => ({
      ...row,
      createdAt: toDateValue(row.createdAt) as any,
      updatedAt: toDateValue(row.updatedAt) as any,
      followedUpAt: toDateValue(row.followedUpAt) as any,
    }));
  }, [responsesQuery.data]);

  const promptOverrides = useMemo<NpsPromptOverride[]>(() => {
    const source = promptOverridesQuery.data || [];
    return source
      .map((entry) => ({
        ...entry,
        createdAt: toDateValue(entry.createdAt) as any,
        lastTriggeredAt: toDateValue(entry.lastTriggeredAt) as any,
        updatedAt: toDateValue(entry.updatedAt) as any,
      }))
      .sort((a, b) => (toDateValue(b.updatedAt)?.getTime() || 0) - (toDateValue(a.updatedAt)?.getTime() || 0));
  }, [promptOverridesQuery.data]);

  const auditCycleOptions = useMemo(() => {
    return Array.from(new Set(promptOverrides.map((entry) => entry.cycleKey).filter(Boolean))).sort((a, b) => (a < b ? 1 : -1));
  }, [promptOverrides]);

  const filteredPromptOverrides = useMemo(() => {
    const actorTerm = auditActorFilter.trim().toLowerCase();
    return promptOverrides.filter((entry) => {
      if (auditCycleFilter !== 'all' && entry.cycleKey !== auditCycleFilter) return false;
      if (auditStatusFilter === 'enabled' && !entry.enabled) return false;
      if (auditStatusFilter === 'consumed' && entry.enabled) return false;
      if (actorTerm && !(entry.triggeredBy || '').toLowerCase().includes(actorTerm)) return false;
      return true;
    });
  }, [promptOverrides, auditCycleFilter, auditStatusFilter, auditActorFilter]);

  const pagedAuditOverrides = useMemo(() => {
    const start = (auditPage - 1) * auditPageSize;
    return filteredPromptOverrides.slice(start, start + auditPageSize);
  }, [filteredPromptOverrides, auditPage, auditPageSize]);
  const hasNextAuditPage = auditPage * auditPageSize < filteredPromptOverrides.length;

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
    const fromMs = rangeFilter === 'all' ? null : now - rangeDaysMap[rangeFilter] * 86400000;
    const promoters = filtered.filter((entry) => entry.segment === 'promoter').length;
    const passives = filtered.filter((entry) => entry.segment === 'passive').length;
    const detractors = filtered.filter((entry) => entry.segment === 'detractor').length;
    const total = filtered.length;
    const nps = computeNpsScore(promoters, detractors, total);
    const sampleConfidence = getNpsSampleConfidence(total);
    const lowSample = total < NPS_MIN_SAMPLE_SIZE;

    const activeCounts = activeUsersQuery.data || { donor: 0, ngo: 0, bloodbank: 0, all: 0 };
    const activeProfiles = activeProfilesQuery.data || [];

    const eligibleProfiles = fromMs
      ? activeProfiles.filter((entry) => {
        if (!entry.lastLoginAt) return false;
        return entry.lastLoginAt.getTime() >= fromMs;
      })
      : activeProfiles;

    const eligibleCounts: Record<NpsRole, number> = {
      donor: 0,
      ngo: 0,
      bloodbank: 0,
    };
    eligibleProfiles.forEach((entry) => {
      eligibleCounts[entry.role] += 1;
    });
    const eligibleAll = eligibleCounts.donor + eligibleCounts.ngo + eligibleCounts.bloodbank;

    const uniqueRespondersOverall = new Set(filtered.map((entry) => entry.userId)).size;
    const responseRateOverall = eligibleAll > 0
      ? (uniqueRespondersOverall / eligibleAll) * 100
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
      roleRates[role] = eligibleCounts[role] > 0 ? (roleUnique / eligibleCounts[role]) * 100 : 0;
    });

    const detractorSlaBreaches7d = filtered.filter((entry) => {
      if (entry.segment !== 'detractor') return false;
      const status = entry.followUpStatus || NPS_FOLLOW_UP_STATUS.open;
      if (status === NPS_FOLLOW_UP_STATUS.closed) return false;
      const createdAt = toDateValue(entry.createdAt);
      if (!createdAt) return false;
      return now - createdAt.getTime() > NPS_DETRACTOR_SLA_MS;
    }).length;
    const detractorSlaBreaches14d = filtered.filter((entry) => {
      if (entry.segment !== 'detractor') return false;
      const status = entry.followUpStatus || NPS_FOLLOW_UP_STATUS.open;
      if (status === NPS_FOLLOW_UP_STATUS.closed) return false;
      const createdAt = toDateValue(entry.createdAt);
      if (!createdAt) return false;
      return now - createdAt.getTime() > NPS_DETRACTOR_ESCALATION_SLA_MS;
    }).length;

    return {
      total,
      promoters,
      passives,
      detractors,
      nps,
      sampleConfidence,
      lowSample,
      responseRateOverall,
      roleRates,
      detractorSlaBreaches7d,
      detractorSlaBreaches14d,
      eligibleAll,
      activeCountsAll: activeCounts.all,
    };
  }, [filtered, activeUsersQuery.data, activeProfilesQuery.data, rangeFilter]);

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
        const total = list.length;
        return {
          key,
          label: toMonthLabel(key),
          total,
          nps: computeNpsScore(promoters, detractors, total),
          confidence: getNpsSampleConfidence(total),
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
    setAuditPage(1);
  }, [auditCycleFilter, auditStatusFilter, auditActorFilter, auditPageSize, filteredPromptOverrides.length]);

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

  useEffect(() => {
    setTagDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      filtered.forEach((entry) => {
        if (!entry.id) return;
        if (next[entry.id] === undefined) {
          next[entry.id] = (entry.tags || []).filter((tag): tag is NpsDriverTag => DRIVER_TAG_LIST.includes(tag as NpsDriverTag));
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

  const patchResponseInCache = (rowId: string, patch: Partial<NpsResponse>) => {
    const previous = queryClient.getQueriesData<NpsResponse[]>({ queryKey: adminQueryKeys.npsResponsesRoot });
    queryClient.setQueriesData<NpsResponse[]>({ queryKey: adminQueryKeys.npsResponsesRoot }, (current) => {
      if (!Array.isArray(current)) return current;
      return current.map((entry) => (entry.id === rowId ? { ...entry, ...patch } : entry));
    });
    return previous;
  };

  const restoreResponsesCache = (previous: Array<[readonly unknown[], NpsResponse[] | undefined]>) => {
    previous.forEach(([queryKey, data]) => {
      queryClient.setQueryData(queryKey, data);
    });
  };

  const syncNpsViews = async () => {
    await invalidateAdminRecipe(queryClient, 'npsUpdated');
    await Promise.all([
      refetchQuery(responsesQuery),
      refetchQuery(activeUsersQuery),
      refetchQuery(activeProfilesQuery),
      refetchQuery(promptOverridesQuery),
    ]);
  };

  const updateFollowUpStatus = async (row: NpsResponse, nextStatus: NpsFollowUpStatus) => {
    if (!row.id) return;
    setUpdatingId(row.id);
    const optimisticPatch: Partial<NpsResponse> = {
      followUpStatus: nextStatus,
      followedUpBy: user?.uid || null,
      followedUpAt: nextStatus === NPS_FOLLOW_UP_STATUS.open ? null : (new Date() as any),
      updatedAt: new Date() as any,
    };
    const previous = patchResponseInCache(row.id, optimisticPatch);
    try {
      const result = await updateAdminNpsFollowUpStatus({
        responseId: row.id,
        status: nextStatus,
        followedUpBy: user?.uid || null,
      });
      notify.success(
        result.queued
          ? `Follow-up queued (${nextStatus.replace('_', ' ')}).`
          : `Follow-up marked as ${nextStatus.replace('_', ' ')}.`,
      );
      await syncNpsViews();
    } catch (error) {
      restoreResponsesCache(previous);
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'admin',
        metadata: { kind: 'admin.nps.followup.update', status: nextStatus, rowId: row.id },
      });
      notify.error('Failed to update follow-up status.');
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
    const previous = patchResponseInCache(row.id, {
      followUpNotes: nextNotes || null,
      followedUpBy: user?.uid || null,
      updatedAt: new Date() as any,
    });
    try {
      const result = await updateAdminNpsFollowUpNotes({
        responseId: row.id,
        notes: nextNotes || null,
        followedUpBy: user?.uid || null,
      });
      notify.success(
        result.queued
          ? (nextNotes ? 'Follow-up notes queued.' : 'Follow-up note clear queued.')
          : (nextNotes ? 'Follow-up notes saved.' : 'Follow-up notes cleared.'),
      );
      await syncNpsViews();
    } catch (error) {
      restoreResponsesCache(previous);
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'admin',
        metadata: { kind: 'admin.nps.followup.notes.update', rowId: row.id },
      });
      notify.error('Failed to save follow-up notes.');
    } finally {
      setSavingNotesId(null);
    }
  };

  const toggleDraftTag = (rowId: string, tag: NpsDriverTag) => {
    setTagDrafts((prev) => {
      const current = prev[rowId] || [];
      const exists = current.includes(tag);
      const next = exists ? current.filter((entry) => entry !== tag) : [...current, tag];
      return { ...prev, [rowId]: next };
    });
  };

  const saveTags = async (row: NpsResponse) => {
    if (!row.id) return;
    const nextTags = (tagDrafts[row.id] || []).filter((tag): tag is NpsDriverTag => DRIVER_TAG_LIST.includes(tag));
    const existing = (row.tags || []).filter((tag): tag is NpsDriverTag => DRIVER_TAG_LIST.includes(tag as NpsDriverTag));
    if (JSON.stringify(nextTags.slice().sort()) === JSON.stringify(existing.slice().sort())) return;
    setSavingTagsId(row.id);
    const previous = patchResponseInCache(row.id, {
      tags: nextTags,
      updatedAt: new Date() as any,
    });
    try {
      const result = await updateAdminNpsTags({
        responseId: row.id,
        tags: nextTags,
      });
      notify.success(result.queued ? 'Driver tags update queued.' : 'Driver tags saved.');
      await syncNpsViews();
    } catch (error) {
      restoreResponsesCache(previous);
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'admin',
        metadata: { kind: 'admin.nps.tags.update', rowId: row.id },
      });
      notify.error('Failed to save driver tags.');
    } finally {
      setSavingTagsId(null);
    }
  };

  const upsertPromptOverride = async (targetUserId: string, cycleKey: string, actorUid: string | null) => {
    const ref = doc(db, COLLECTIONS.NPS_PROMPT_OVERRIDES, `${targetUserId}_${cycleKey}`);
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      await updateDoc(ref, {
        enabled: true,
        triggeredBy: actorUid,
        lastTriggeredAt: getServerTimestamp(),
        updatedAt: getServerTimestamp(),
      });
      return;
    }
    await setDoc(ref, {
      userId: targetUserId,
      cycleKey,
      enabled: true,
      triggeredBy: actorUid,
      createdAt: getServerTimestamp(),
      lastTriggeredAt: getServerTimestamp(),
      updatedAt: getServerTimestamp(),
    });
  };

  const resolveSingleUserTriggerTarget = async (rawUserId: string): Promise<string | null> => {
    const uid = rawUserId.trim();
    if (!uid) {
      notify.error('Enter a valid user uid to trigger feedback prompt.');
      return null;
    }
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const userSnapshot = await getDoc(userRef);
    if (!userSnapshot.exists()) {
      notify.error('User not found. Please enter a valid uid.');
      return null;
    }
    const userData = userSnapshot.data() as Record<string, any>;
    const role = normalizeNpsRole(userData?.role);
    if (!role) {
      notify.error('Feedback can be triggered only for donor, NGO, or bloodbank users.');
      return null;
    }
    return uid;
  };

  const triggerPromptForScope = async () => {
    const cycleKey = getNpsCycleKey();
    const actorUid = user?.uid || null;
    setTriggering(true);
    try {
      if (triggerMode === 'single_user') {
        const normalizedUserId = await resolveSingleUserTriggerTarget(triggeringUserId);
        if (!normalizedUserId) return;
        await upsertPromptOverride(normalizedUserId, cycleKey, actorUid);
        notify.success(`Feedback prompt will reappear for ${normalizedUserId} in ${cycleKey}.`);
        setTriggeringUserId('');
        await syncNpsViews();
        return;
      }

      const targetUids = Array.from(new Set(
        (activeProfilesQuery.data || [])
          .filter((entry) => entry.role === triggerRole)
          .map((entry) => entry.uid)
          .filter(Boolean)
      ));
      const cycleRespondedUserIds = new Set(
        (responsesQuery.data || [])
          .filter((entry) => entry.cycleKey === cycleKey)
          .map((entry) => entry.userId)
          .filter(Boolean)
      );
      const pendingTargetUids = targetUids.filter((uid) => !cycleRespondedUserIds.has(uid));
      if (targetUids.length === 0) {
        notify.info(`No active ${triggerRole} users found to re-trigger.`);
        return;
      }
      if (pendingTargetUids.length === 0) {
        notify.info(`All active ${triggerRole} users already submitted feedback in ${cycleKey}.`);
        return;
      }

      const chunkSize = 40;
      for (let index = 0; index < pendingTargetUids.length; index += chunkSize) {
        const chunk = pendingTargetUids.slice(index, index + chunkSize);
        await Promise.all(chunk.map((uid) => upsertPromptOverride(uid, cycleKey, actorUid)));
      }

      notify.success(`Feedback prompt re-triggered for ${pendingTargetUids.length} ${triggerRole} users in ${cycleKey}.`);
      await syncNpsViews();
    } catch (error) {
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'admin',
        metadata: { kind: 'admin.nps.prompt_override.create', triggerMode, triggerRole, cycleKey },
      });
      notify.error('Failed to trigger feedback prompt.');
    } finally {
      setTriggering(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([
      refetchQuery(responsesQuery),
      refetchQuery(activeUsersQuery),
      refetchQuery(activeProfilesQuery),
      refetchQuery(promptOverridesQuery),
    ]);
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
          <AdminRefreshButton
            onClick={() => void refreshAll()}
            isRefreshing={
              responsesQuery.isFetching
              || activeUsersQuery.isFetching
              || activeProfilesQuery.isFetching
              || promptOverridesQuery.isFetching
            }
            label="Refresh NPS"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-red-600">NPS</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{summary.nps}</p>
          <p className="text-xs text-gray-500">Sample n={summary.total} {summary.lowSample ? `(min ${NPS_MIN_SAMPLE_SIZE})` : ''}</p>
          <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${getConfidenceStyles(summary.sampleConfidence)}`}>
            {summary.sampleConfidence} confidence
          </span>
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
          <p className="text-xs uppercase tracking-[0.2em] text-red-600">SLA {'>'}7d</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{summary.detractorSlaBreaches7d}</p>
          <p className="text-xs text-gray-500">Open detractors</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-700">Escalation {'>'}14d</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{summary.detractorSlaBreaches14d}</p>
          <p className="text-xs text-gray-500">Critical open detractors</p>
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
            <p>Eligible users in window: {summary.eligibleAll} (all active: {summary.activeCountsAll})</p>
            <p>D: {formatPercent(summary.roleRates.donor)} | N: {formatPercent(summary.roleRates.ngo)} | B: {formatPercent(summary.roleRates.bloodbank)}</p>
          </div>
        )}
      />

      <AdminRefreshingBanner show={loading} message="Refreshing NPS data..." />
      <AdminErrorCard message={error instanceof Error ? error.message : null} onRetry={() => void refreshAll()} />
      {summary.lowSample ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Low sample size: results are directional until n reaches {NPS_MIN_SAMPLE_SIZE}.</span>
          </div>
        </div>
      ) : null}

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
                    <div className="flex justify-end">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getConfidenceStyles(point.confidence)}`}>
                        {point.confidence} confidence
                      </span>
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
                const ageMs = createdAt ? Date.now() - createdAt.getTime() : 0;
                const overdue = ageMs > NPS_DETRACTOR_SLA_MS;
                const escalated = ageMs > NPS_DETRACTOR_ESCALATION_SLA_MS;
                const status = entry.followUpStatus || NPS_FOLLOW_UP_STATUS.open;
                return (
                  <div key={entry.id} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-800">{entry.userRole} · score {entry.score}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        escalated
                          ? 'bg-rose-300 text-rose-900'
                          : overdue
                            ? 'bg-rose-200 text-rose-800'
                            : 'bg-gray-200 text-gray-700'
                      }`}
                      >
                        {escalated ? 'Escalated >14d' : overdue ? 'SLA breach >7d' : status.replace('_', ' ')}
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
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Driver Tags</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {DRIVER_TAG_LIST.map((tag) => {
                        const selected = entry.id ? (tagDrafts[entry.id] || []).includes(tag) : false;
                        return (
                          <button
                            key={`${entry.id}-tag-${tag}`}
                            type="button"
                            onClick={() => entry.id && toggleDraftTag(entry.id, tag)}
                            className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
                              selected
                                ? 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-300 bg-white text-gray-600'
                            }`}
                          >
                            {DRIVER_TAG_LABELS[tag]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void saveTags(entry)}
                        disabled={!entry.id || savingTagsId === entry.id || updatingId === entry.id}
                        className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {savingTagsId === entry.id ? 'Saving...' : 'Save tags'}
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
                    <th className="px-4 py-3">Drivers</th>
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
                          <div className="flex flex-wrap gap-1">
                            {DRIVER_TAG_LIST.map((tag) => {
                              const selected = entry.id ? (tagDrafts[entry.id] || []).includes(tag) : false;
                              return (
                                <button
                                  key={`${entry.id}-desktop-tag-${tag}`}
                                  type="button"
                                  onClick={() => entry.id && toggleDraftTag(entry.id, tag)}
                                  className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
                                    selected
                                      ? 'border-red-500 bg-red-50 text-red-700'
                                      : 'border-gray-300 bg-white text-gray-600'
                                  }`}
                                >
                                  {DRIVER_TAG_LABELS[tag]}
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => void saveTags(entry)}
                              disabled={!entry.id || savingTagsId === entry.id || updatingId === entry.id}
                              className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {savingTagsId === entry.id ? 'Saving...' : 'Save tags'}
                            </button>
                          </div>
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

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-red-600">Manual Trigger</p>
            <p className="text-sm text-gray-600">Re-show Feedback prompt for one user or all users in a role, in the current quarter.</p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-4 lg:w-auto">
            <select
              value={triggerMode}
              onChange={(event) => setTriggerMode(event.target.value as TriggerMode)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="single_user">Single user</option>
              <option value="all_role">All in role</option>
            </select>
            <input
              type="text"
              value={triggeringUserId}
              onChange={(event) => setTriggeringUserId(event.target.value)}
              placeholder="User UID"
              disabled={triggerMode !== 'single_user'}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
            <select
              value={triggerRole}
              onChange={(event) => setTriggerRole(event.target.value as NpsRole)}
              disabled={triggerMode !== 'all_role'}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="donor">All Donors</option>
              <option value="ngo">All NGOs</option>
              <option value="bloodbank">All Bloodbanks</option>
            </select>
            <button
              type="button"
              onClick={() => void triggerPromptForScope()}
              disabled={triggering}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              {triggering ? 'Triggering...' : (triggerMode === 'single_user' ? `Re-trigger User (${getNpsCycleKey()})` : `Re-trigger Role (${getNpsCycleKey()})`)}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">Manual Trigger Audit</p>
          <p className="text-xs text-gray-500">
            Showing {(filteredPromptOverrides.length === 0) ? 0 : ((auditPage - 1) * auditPageSize + 1)}
            -
            {Math.min(auditPage * auditPageSize, filteredPromptOverrides.length)} of {filteredPromptOverrides.length}
          </p>
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <select
            value={auditCycleFilter}
            onChange={(event) => setAuditCycleFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700"
          >
            <option value="all">All cycles</option>
            {auditCycleOptions.map((cycle) => (
              <option key={`audit-cycle-${cycle}`} value={cycle}>{cycle}</option>
            ))}
          </select>
          <select
            value={auditStatusFilter}
            onChange={(event) => setAuditStatusFilter(event.target.value as AuditStatusFilter)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700"
          >
            <option value="all">All statuses</option>
            <option value="enabled">Enabled</option>
            <option value="consumed">Consumed/Disabled</option>
          </select>
          <input
            type="text"
            value={auditActorFilter}
            onChange={(event) => setAuditActorFilter(event.target.value)}
            placeholder="Filter by triggered by"
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
          />
        </div>
        {filteredPromptOverrides.length === 0 ? (
          <p className="text-sm text-gray-500">No manual trigger records yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-red-50 text-left uppercase tracking-[0.12em] text-red-800">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Cycle</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Triggered By</th>
                    <th className="px-3 py-2">Triggered At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedAuditOverrides.map((entry) => {
                    const triggeredAt = toDateValue(entry.lastTriggeredAt) || toDateValue(entry.updatedAt);
                    return (
                      <tr key={entry.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{entry.userId || '-'}</td>
                        <td className="px-3 py-2 text-gray-700">{entry.cycleKey || '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${entry.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                            {entry.enabled ? 'Enabled' : 'Consumed/Disabled'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{entry.triggeredBy || '-'}</td>
                        <td className="px-3 py-2 text-gray-700">{triggeredAt ? triggeredAt.toLocaleString() : 'N/A'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <AdminPagination
                page={auditPage}
                pageSize={auditPageSize}
                pageSizeOptions={[10, 20, 50]}
                itemCount={pagedAuditOverrides.length}
                hasNextPage={hasNextAuditPage}
                loading={promptOverridesQuery.isLoading}
                onPageChange={setAuditPage}
                onPageSizeChange={setAuditPageSize}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default NpsAdminPage;
