import React, { useEffect, useState } from 'react';
import { Search, Shield } from 'lucide-react';
import { searchUsersForImpersonation, searchUsersForImpersonationFast } from '../../services/admin.service';
import type { ImpersonationUser } from '../../services/admin.service';
import { ONE_MINUTE_MS, THREE_FIFTY_MS } from '../../constants/time';

type PortalRole = 'donor' | 'ngo' | 'bloodbank' | 'admin';

interface SuperAdminPortalModalProps {
  isOpen: boolean;
  currentPortal: PortalRole;
  onSelect: (role: PortalRole) => void;
  onImpersonate?: (user: ImpersonationUser, reason?: string) => void;
  impersonationUser?: {
    displayName?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  impersonationLoading?: boolean;
}

const portalLabels: Record<PortalRole, string> = {
  donor: 'Donor',
  ngo: 'NGO',
  bloodbank: 'Blood Bank',
  admin: 'Admin',
};

const portalOrder: PortalRole[] = ['donor', 'ngo', 'bloodbank', 'admin'];
const restrictedStatuses = new Set(['suspended', 'pending_verification']);

const getStatusLabel = (status?: string | null) => {
  if (!status) return 'Active';
  if (status === 'pending_verification') return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const getStatusStyle = (status?: string | null) => {
  if (status === 'suspended') return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-100 dark:text-red-700 dark:border-red-200';
  if (status === 'pending_verification') return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-100 dark:text-amber-800 dark:border-amber-200';
  if (status === 'inactive') return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-100 dark:text-gray-700 dark:border-gray-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-100 dark:text-emerald-700 dark:border-emerald-200';
};

const SuperAdminPortalModal: React.FC<SuperAdminPortalModalProps> = ({
  isOpen,
  currentPortal,
  onSelect,
  onImpersonate,
  impersonationUser,
  impersonationLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ImpersonationUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pendingImpersonation, setPendingImpersonation] = useState<ImpersonationUser | null>(null);
  const [recentImpersonations, setRecentImpersonations] = useState<ImpersonationUser[]>([]);
  const [impersonationReason, setImpersonationReason] = useState('');
  const [showRecentDrawer, setShowRecentDrawer] = useState(false);
  const [recentPage, setRecentPage] = useState(1);
  const otherPortals = portalOrder.filter((role) => role !== currentPortal);
  const cacheRef = React.useRef(new Map<string, { results: ImpersonationUser[]; at: number }>());
  const fastCacheRef = React.useRef(new Map<string, { results: ImpersonationUser[]; at: number }>());
  const inflightRef = React.useRef(new Map<string, Promise<ImpersonationUser[]>>());
  const inflightFastRef = React.useRef(new Map<string, Promise<ImpersonationUser[]>>());
  const recentStorageKey = 'bh_impersonation_recent';
  const hasFastResultsRef = React.useRef(false);

  const matchesQuery = React.useCallback((user: ImpersonationUser, query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    const name = user.displayName?.toLowerCase() ?? '';
    const email = user.email?.toLowerCase() ?? '';
    const bhId = user.bhId?.toLowerCase() ?? '';
    return name.includes(normalized) || email.includes(normalized) || bhId.includes(normalized);
  }, []);

  const RECENT_MAX_ITEMS = 50;
  const RECENT_PAGE_SIZE = 10;

  const readRecent = React.useCallback(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(recentStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ImpersonationUser[];
      return Array.isArray(parsed) ? parsed.slice(0, RECENT_MAX_ITEMS) : [];
    } catch {
      return [];
    }
  }, []);

  const writeRecent = React.useCallback((next: ImpersonationUser[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(recentStorageKey, JSON.stringify(next.slice(0, RECENT_MAX_ITEMS)));
    } catch {
      // ignore
    }
  }, []);

  const pushRecent = React.useCallback((user: ImpersonationUser) => {
    setRecentImpersonations((prev) => {
      const next = [user, ...prev.filter((item) => item.uid !== user.uid)].slice(0, RECENT_MAX_ITEMS);
      writeRecent(next);
      return next;
    });
  }, [writeRecent]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      setPendingImpersonation(null);
      setImpersonationReason('');
      setShowRecentDrawer(false);
      setRecentPage(1);
      return;
    }
    setRecentImpersonations(readRecent());

    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      hasFastResultsRef.current = false;
      return;
    }

    let isActive = true;
    hasFastResultsRef.current = false;
    const normalized = trimmed.toLowerCase();
    const now = Date.now();
    const cache = cacheRef.current;
    const cached = cache.get(normalized);
    if (cached && now - cached.at < ONE_MINUTE_MS) {
      setSearchResults(cached.results);
    } else {
      let bestPrefix: { key: string; entry: { results: ImpersonationUser[]; at: number } } | null = null;
      for (const [key, entry] of cache.entries()) {
        if (normalized.startsWith(key) && now - entry.at < ONE_MINUTE_MS) {
          if (!bestPrefix || key.length > bestPrefix.key.length) {
            bestPrefix = { key, entry };
          }
        }
      }
      if (bestPrefix) {
        setSearchResults(bestPrefix.entry.results.filter((user) => matchesQuery(user, normalized)));
      }
    }
    const handle = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      const isExact = trimmed.includes('@') || trimmed.toUpperCase().startsWith('BH');
      try {
        if (!isExact) {
          const fastCache = fastCacheRef.current.get(normalized);
          if (fastCache && now - fastCache.at < ONE_MINUTE_MS) {
            if (isActive) {
              setSearchResults(fastCache.results);
            }
          } else {
            const fastInflight = inflightFastRef.current.get(normalized);
            const fastPromise = fastInflight ?? searchUsersForImpersonationFast(trimmed);
            if (!fastInflight) {
              inflightFastRef.current.set(normalized, fastPromise);
            }
            fastPromise
              .then((fastResults) => {
                inflightFastRef.current.delete(normalized);
                fastCacheRef.current.set(normalized, { results: fastResults, at: Date.now() });
                if (isActive && fastResults.length > 0) {
                  hasFastResultsRef.current = true;
                  setSearchResults(fastResults);
                }
              })
              .catch(() => {
                inflightFastRef.current.delete(normalized);
              });
          }
        }

        const inflight = inflightRef.current.get(normalized);
        const promise = inflight ?? searchUsersForImpersonation(trimmed);
        if (!inflight) {
          inflightRef.current.set(normalized, promise);
        }
        const results = await promise;
        inflightRef.current.delete(normalized);
        if (isActive) {
          if (results.length > 0 || !hasFastResultsRef.current) {
            setSearchResults(results);
          }
          cacheRef.current.set(normalized, { results, at: Date.now() });
        }
      } catch (error) {
        inflightRef.current.delete(normalized);
        if (isActive) {
          setSearchError('Search failed. Please try again.');
          setSearchResults([]);
        }
      } finally {
        if (isActive) {
          setSearchLoading(false);
        }
      }
    }, THREE_FIFTY_MS);

    return () => {
      isActive = false;
      window.clearTimeout(handle);
    };
  }, [isOpen, searchTerm, matchesQuery, readRecent]);

  const handleImpersonateClick = (user: ImpersonationUser) => {
    if (!onImpersonate) return;
    if (restrictedStatuses.has(user.status || '')) return;
    setPendingImpersonation(user);
  };

  const confirmImpersonation = () => {
    if (!pendingImpersonation || !onImpersonate || impersonationLoading) return;
    pushRecent(pendingImpersonation);
    const reason = impersonationReason.trim();
    onImpersonate(pendingImpersonation, reason ? reason : undefined);
    setPendingImpersonation(null);
    setImpersonationReason('');
    setShowRecentDrawer(false);
    setRecentPage(1);
  };

  const cancelImpersonation = () => {
    setPendingImpersonation(null);
  };

  const recentPreview = recentImpersonations.slice(0, 3);
  const totalRecentPages = Math.max(1, Math.ceil(recentImpersonations.length / RECENT_PAGE_SIZE));
  const clampedRecentPage = Math.min(recentPage, totalRecentPages);
  const recentStartIndex = (clampedRecentPage - 1) * RECENT_PAGE_SIZE;
  const recentPageItems = recentImpersonations.slice(
    recentStartIndex,
    recentStartIndex + RECENT_PAGE_SIZE
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm px-3 py-4 sm:px-4 sm:py-6">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-red-100 bg-white shadow-2xl dark:border-red-200 dark:bg-[#0b1220]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-t-3xl bg-gradient-to-r from-red-600 via-red-700 to-red-800 px-5 sm:px-8 py-5 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">SuperAdmin Console</p>
              <h3 className="text-xl font-semibold">Session Control</h3>
              <p className="text-xs text-white/70">Switch portals or impersonate users with full access.</p>
            </div>
          </div>
          {impersonationUser && (
            <div className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/90">
              Impersonation Active
            </div>
          )}
        </div>
        <div className="px-5 sm:px-8 py-6 space-y-6">
          {impersonationUser && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-200 dark:bg-amber-50 dark:text-amber-900">
              Acting as{' '}
              <span className="font-semibold">
                {impersonationUser.displayName || impersonationUser.email || 'User'}
              </span>
              {impersonationUser.role ? ` (${impersonationUser.role})` : ''}. Session expires after 30 minutes.
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5 dark:border-gray-200 dark:bg-[#101826]/80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">Portal Access</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-600">Select a portal for this session.</p>
                </div>
                <span className="rounded-full border border-red-100 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-red-600 dark:border-red-200 dark:bg-[#0a0f1a] dark:text-red-600">
                  Current: {portalLabels[currentPortal]}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => onSelect(currentPortal)}
                  className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-red-700"
                >
                  Continue to {portalLabels[currentPortal]}
                </button>
                {otherPortals.map((role) => (
                  <button
                    key={role}
                    onClick={() => onSelect(role)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-all duration-300 hover:border-red-200 hover:bg-red-50 dark:border-gray-200 dark:bg-[#0a0f1a] dark:text-gray-700 dark:hover:border-red-200 dark:hover:bg-red-50"
                  >
                    Go to {portalLabels[role]}
                  </button>
                ))}
              </div>
            </div>

            {onImpersonate && (
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-200 dark:bg-[#0f1726]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">Impersonation</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-600">
                      Full access, 30-minute session limit.
                    </p>
                  </div>
                  <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-red-600 dark:border-red-200 dark:bg-red-50 dark:text-red-600">
                    Full Access
                  </span>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-700">
                    Search by name, email, or BH ID
                  </label>
                  <div className="relative mt-2">
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Type at least 2 characters"
                      disabled={impersonationLoading}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 transition-all focus:border-red-300 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-300 dark:bg-[#0a0f1a] dark:text-gray-700 dark:focus:border-red-200 dark:disabled:bg-gray-100 dark:disabled:text-gray-500"
                    />
                    <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-700">
                    Reason (optional)
                  </label>
                  <textarea
                    value={impersonationReason}
                    onChange={(event) => setImpersonationReason(event.target.value)}
                    placeholder="Add context for audit logs"
                    disabled={impersonationLoading}
                    rows={2}
                    className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 transition-all focus:border-red-300 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-300 dark:bg-[#0a0f1a] dark:text-gray-700 dark:focus:border-red-200 dark:disabled:bg-gray-100 dark:disabled:text-gray-500"
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {impersonationLoading && (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <span className="h-3 w-3 animate-spin rounded-full border border-amber-400 border-t-transparent" />
                      Switching user…
                    </div>
                  )}
                  {!impersonationLoading && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-600">
                      Suspended or pending verification accounts cannot be impersonated.
                    </p>
                  )}
                  {!impersonationLoading && searchTerm.trim().length < 2 && recentImpersonations.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          Recent impersonations
                        </p>
                        {recentImpersonations.length > 3 && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowRecentDrawer(true);
                              setRecentPage(1);
                            }}
                            className="text-[10px] font-semibold uppercase tracking-widest text-red-600 hover:text-red-700 dark:text-red-600 dark:hover:text-red-700"
                          >
                            View all
                          </button>
                        )}
                      </div>
                      {recentPreview.map((user) => (
                        <button
                          key={`recent-${user.uid}`}
                          onClick={() => handleImpersonateClick(user)}
                          disabled={restrictedStatuses.has(user.status || '')}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm transition-all hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-300 dark:bg-[#0a0f1a] dark:hover:border-red-200 dark:hover:bg-red-50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-900">
                                {user.displayName || user.email || 'User'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-600">
                                {user.email || 'No email'}
                                {user.bhId ? ` · ${user.bhId}` : ''}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 text-right">
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-600">
                                {user.role}
                              </span>
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${getStatusStyle(user.status)}`}>
                                {getStatusLabel(user.status)}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                  {searchLoading && (
                    <p className="text-xs text-gray-500 dark:text-gray-600">Searching…</p>
                  )}
                  {!searchLoading && searchError && (
                    <p className="text-xs text-red-600 dark:text-red-600">{searchError}</p>
                  )}
                  {!impersonationLoading && !searchLoading && !searchError && searchTerm.trim().length >= 2 && searchResults.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-600">No users found.</p>
                  )}
                  {searchResults.map((user) => (
                    <button
                      key={user.uid}
                      onClick={() => handleImpersonateClick(user)}
                      disabled={impersonationLoading || restrictedStatuses.has(user.status || '')}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm transition-all hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-300 dark:bg-[#0a0f1a] dark:hover:border-red-200 dark:hover:bg-red-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-900">
                            {user.displayName || user.email || 'User'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-600">
                            {user.email || 'No email'}
                            {user.bhId ? ` · ${user.bhId}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-right">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-600">
                            {user.role}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${getStatusStyle(user.status)}`}>
                            {getStatusLabel(user.status)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingImpersonation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-300 dark:bg-[#0b1220]">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-900">Confirm Impersonation</h4>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-600">
              You are about to impersonate{' '}
              <span className="font-semibold">
                {pendingImpersonation.displayName || pendingImpersonation.email || 'User'}
              </span>
              {pendingImpersonation.role ? ` (${pendingImpersonation.role})` : ''}.
            </p>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-800">
              This will switch your session to the selected user until you stop impersonation.
            </p>
            {impersonationReason.trim() && (
              <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-200 dark:bg-gray-100 dark:text-gray-600">
                <span className="font-semibold text-gray-700 dark:text-gray-700">Reason:</span>{' '}
                {impersonationReason.trim()}
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button
                onClick={confirmImpersonation}
                disabled={impersonationLoading}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Yes, impersonate
              </button>
              <button
                onClick={cancelImpersonation}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-300 dark:text-gray-700 dark:hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecentDrawer && (
        <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center bg-black/50 px-4 py-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl max-h-[75vh] overflow-y-auto dark:border-gray-300 dark:bg-[#0b1220]">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-200">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Recent impersonations</p>
                <p className="text-sm text-gray-600 dark:text-gray-600">
                  Showing {recentStartIndex + 1}-{Math.min(recentStartIndex + RECENT_PAGE_SIZE, recentImpersonations.length)} of {recentImpersonations.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecentDrawer(false)}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-300 dark:text-gray-700 dark:hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-2">
              {recentPageItems.map((user) => (
                <button
                  key={`drawer-${user.uid}`}
                  onClick={() => handleImpersonateClick(user)}
                  disabled={restrictedStatuses.has(user.status || '')}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm transition-all hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-300 dark:bg-[#0a0f1a] dark:hover:border-red-200 dark:hover:bg-red-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-900">
                        {user.displayName || user.email || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-600">
                        {user.email || 'No email'}
                        {user.bhId ? ` · ${user.bhId}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-600">
                        {user.role}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${getStatusStyle(user.status)}`}>
                        {getStatusLabel(user.status)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {recentImpersonations.length > RECENT_PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 dark:border-gray-200">
                <button
                  type="button"
                  onClick={() => setRecentPage((prev) => Math.max(1, prev - 1))}
                  disabled={clampedRecentPage === 1}
                  className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-300 dark:text-gray-700 dark:hover:bg-gray-100"
                >
                  Previous
                </button>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-700">
                  Page {clampedRecentPage} of {totalRecentPages}
                </span>
                <button
                  type="button"
                  onClick={() => setRecentPage((prev) => Math.min(totalRecentPages, prev + 1))}
                  disabled={clampedRecentPage === totalRecentPages}
                  className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-300 dark:text-gray-700 dark:hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPortalModal;
