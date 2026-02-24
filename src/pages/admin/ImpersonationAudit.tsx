import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  UserCheck,
  UserX,
  UserCog,
  FileText,
} from 'lucide-react';
import {
  collection,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { timestampToDate } from '../../utils/firestore.utils';
import { useAuth } from '../../contexts/AuthContext';

export type ImpersonationEvent = {
  id: string;
  actorUid: string;
  actorRole?: string | null;
  targetUid?: string | null;
  action: string;
  status?: string | null;
  reason?: string | null;
  caseId?: string | null;
  metadata?: Record<string, any> | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt?: Date | null;
};

const ACTION_LABELS: Record<string, string> = {
  impersonation_start: 'Start',
  impersonation_stop: 'Stop',
  impersonation_denied: 'Denied',
  impersonation_error: 'Error',
};

const ACTION_ICONS: Record<string, JSX.Element> = {
  impersonation_start: <UserCheck className="h-4 w-4 text-emerald-600" />,
  impersonation_stop: <UserCog className="h-4 w-4 text-amber-600" />,
  impersonation_denied: <UserX className="h-4 w-4 text-red-600" />,
  impersonation_error: <AlertCircle className="h-4 w-4 text-red-600" />,
};

const STATUS_BADGE: Record<string, string> = {
  started: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  stopped: 'bg-amber-100 text-amber-800 border-amber-200',
  denied: 'bg-red-100 text-red-700 border-red-200',
  error: 'bg-red-100 text-red-700 border-red-200',
};

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

const mapEventDoc = (docSnap: QueryDocumentSnapshot<DocumentData>): ImpersonationEvent => {
  const data = docSnap.data() as Record<string, any>;
  return {
    id: docSnap.id,
    actorUid: data.actorUid || '',
    actorRole: data.actorRole || null,
    targetUid: data.targetUid || null,
    action: data.action || 'unknown',
    status: data.status || null,
    reason: data.reason || null,
    caseId: data.caseId || null,
    metadata: data.metadata || null,
    ip: data.ip || null,
    userAgent: data.userAgent || null,
    createdAt: timestampToDate(data.createdAt) || null,
  } as ImpersonationEvent;
};

const ImpersonationAudit = () => {
  const { isSuperAdmin } = useAuth();
  const [events, setEvents] = useState<ImpersonationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [pageCursors, setPageCursors] = useState<Record<number, QueryDocumentSnapshot<DocumentData> | null>>({
    1: null,
  });

  const fetchEvents = useCallback(async (
    page: number,
    cursor: QueryDocumentSnapshot<DocumentData> | null,
    options?: { reset?: boolean }
  ) => {
    if (!isSuperAdmin) {
      setEvents([]);
      setCurrentPage(1);
      setHasNextPage(false);
      setError(null);
      setLoading(false);
      return;
    }
    const shouldReset = options?.reset === true;
    setLoading(true);
    setError(null);
    try {
      const baseQuery = cursor
        ? query(
            collection(db, 'impersonationEvents'),
            orderBy('createdAt', 'desc'),
            startAfter(cursor),
            limit(pageSize + 1)
          )
        : query(
            collection(db, 'impersonationEvents'),
            orderBy('createdAt', 'desc'),
            limit(pageSize + 1)
          );

      const snapshot = await getDocs(baseQuery);
      const docs = snapshot.docs;
      const moreAvailable = docs.length > pageSize;
      const pageDocs = moreAvailable ? docs.slice(0, pageSize) : docs;

      setEvents(pageDocs.map(mapEventDoc));
      setCurrentPage(page);
      setHasNextPage(moreAvailable);

      const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
      setPageCursors((prev) => {
        const next: Record<number, QueryDocumentSnapshot<DocumentData> | null> = shouldReset
          ? { 1: null }
          : { ...prev };
        next[page] = cursor;
        if (moreAvailable && lastDoc) {
          next[page + 1] = lastDoc;
        } else {
          delete next[page + 1];
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to load impersonation events', err);
      setError('Unable to load impersonation events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, pageSize]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setEvents([]);
      setCurrentPage(1);
      setHasNextPage(false);
      setPageCursors({ 1: null });
      setLoading(false);
      return;
    }
    setCurrentPage(1);
    setHasNextPage(false);
    setPageCursors({ 1: null });
    void fetchEvents(1, null, { reset: true });
  }, [fetchEvents, isSuperAdmin, pageSize]);

  const refreshCurrentPage = () => {
    const cursor = pageCursors[currentPage] ?? null;
    void fetchEvents(currentPage, cursor);
  };

  const handlePrevPage = () => {
    if (currentPage <= 1) return;
    const previousPage = currentPage - 1;
    const cursor = pageCursors[previousPage] ?? null;
    void fetchEvents(previousPage, cursor);
  };

  const handleNextPage = () => {
    if (!hasNextPage) return;
    const nextPage = currentPage + 1;
    if (!(nextPage in pageCursors)) return;
    const cursor = pageCursors[nextPage] ?? null;
    void fetchEvents(nextPage, cursor);
  };

  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return events.filter((event) => {
      if (actionFilter !== 'all' && event.action !== actionFilter) return false;
      if (!term) return true;
      const haystack = [
        event.actorUid,
        event.targetUid,
        event.action,
        event.status,
        event.reason,
        event.caseId,
        event.metadata?.targetEmail,
        event.metadata?.targetRole,
        event.metadata?.message,
        event.ip,
        event.userAgent,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(' ');
      return haystack.includes(term);
    });
  }, [actionFilter, events, searchTerm]);

  const canGoPrev = currentPage > 1;
  const canGoNext = hasNextPage && (currentPage + 1 in pageCursors);

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <Shield className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Restricted Access</h2>
          <p className="text-gray-600">This view is available to superadmins only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Impersonation Audit</h1>
            <p className="text-gray-600">Review impersonation events across the platform.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={refreshCurrentPage}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-all font-semibold flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-6 mb-6">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.6fr_0.5fr]">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">Search</label>
              <div className="relative mt-2">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by uid, email, action, ip, or reason"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 focus:border-red-400 focus:outline-none"
                />
                <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">Action</label>
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-red-400 focus:outline-none"
              >
                <option value="all">All actions</option>
                <option value="impersonation_start">Start</option>
                <option value="impersonation_stop">Stop</option>
                <option value="impersonation_denied">Denied</option>
                <option value="impersonation_error">Error</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">Page size</label>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-red-400 focus:outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-red-100">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <FileText className="w-5 h-5" />
              {filteredEvents.length} events on page {currentPage}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={loading || !canGoPrev}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-gray-500">Page {currentPage}</span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={loading || !canGoNext}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <Clock className="w-8 h-8 text-red-600 animate-spin mx-auto mb-3" />
              Loading impersonation events...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">{error}</div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {events.length === 0 ? 'No impersonation events found.' : 'No events on this page match current filters.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredEvents.map((event) => (
                <div key={event.id} className="px-6 py-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{ACTION_ICONS[event.action] || <Shield className="h-4 w-4 text-gray-400" />}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {ACTION_LABELS[event.action] || event.action}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${STATUS_BADGE[event.status || ''] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
                        >
                          {event.status || 'unknown'}
                        </span>
                        {event.reason && (
                          <span className="text-xs text-gray-500">Reason: {event.reason}</span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-gray-600 space-y-1">
                        <div>Actor: <span className="font-semibold text-gray-800">{event.actorUid}</span> {event.actorRole ? `(${event.actorRole})` : ''}</div>
                        {event.targetUid && (
                          <div>Target: <span className="font-semibold text-gray-800">{event.targetUid}</span></div>
                        )}
                        {event.metadata?.targetEmail && (
                          <div>Target Email: <span className="font-semibold text-gray-800">{event.metadata.targetEmail}</span></div>
                        )}
                        {event.metadata?.targetRole && (
                          <div>Target Role: <span className="font-semibold text-gray-800">{event.metadata.targetRole}</span></div>
                        )}
                        {event.metadata?.message && (
                          <div>Error: <span className="font-semibold text-gray-800">{event.metadata.message}</span></div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 md:text-right">
                    <div className="font-semibold text-gray-700">
                      {event.createdAt ? event.createdAt.toLocaleString() : 'Unknown time'}
                    </div>
                    {event.ip && <div>IP: {event.ip}</div>}
                    {event.userAgent && <div className="max-w-xs break-words">{event.userAgent}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImpersonationAudit;
