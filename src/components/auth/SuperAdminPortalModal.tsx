import React, { useEffect, useState } from 'react';
import { Search, Shield } from 'lucide-react';
import { searchUsersForImpersonation } from '../../services/admin.service';
import type { ImpersonationUser } from '../../services/admin.service';

type PortalRole = 'donor' | 'ngo' | 'bloodbank' | 'admin';

interface SuperAdminPortalModalProps {
  isOpen: boolean;
  currentPortal: PortalRole;
  onSelect: (role: PortalRole) => void;
  onImpersonate?: (user: ImpersonationUser) => void;
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
  const otherPortals = portalOrder.filter((role) => role !== currentPortal);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      setPendingImpersonation(null);
      return;
    }

    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    let isActive = true;
    const handle = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const results = await searchUsersForImpersonation(trimmed);
        if (isActive) {
          setSearchResults(results);
        }
      } catch (error) {
        if (isActive) {
          setSearchError('Search failed. Please try again.');
          setSearchResults([]);
        }
      } finally {
        if (isActive) {
          setSearchLoading(false);
        }
      }
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(handle);
    };
  }, [isOpen, searchTerm]);

  const handleImpersonateClick = (user: ImpersonationUser) => {
    if (!onImpersonate) return;
    setPendingImpersonation(user);
  };

  const confirmImpersonation = () => {
    if (!pendingImpersonation || !onImpersonate || impersonationLoading) return;
    onImpersonate(pendingImpersonation);
    setPendingImpersonation(null);
  };

  const cancelImpersonation = () => {
    setPendingImpersonation(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">SuperAdmin</p>
              <h3 className="text-lg font-semibold">Choose Your Portal</h3>
            </div>
          </div>
          {impersonationUser && (
            <div className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/90">
              Impersonation Active
            </div>
          )}
        </div>
        <div className="px-6 py-6">
          {impersonationUser && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Acting as{' '}
              <span className="font-semibold">
                {impersonationUser.displayName || impersonationUser.email || 'User'}
              </span>
              {impersonationUser.role ? ` (${impersonationUser.role})` : ''}.
            </div>
          )}
          <p className="text-sm text-gray-700">
            Select the portal you want to access for this session.
          </p>
          <div className="mt-5 grid gap-3">
            <button
              onClick={() => onSelect(currentPortal)}
              className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-red-700"
            >
              Continue to {portalLabels[currentPortal]} Portal
            </button>
            {otherPortals.map((role) => (
              <button
                key={role}
                onClick={() => onSelect(role)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-all duration-300 hover:border-red-200 hover:bg-red-50"
              >
                Go to {portalLabels[role]} Dashboard
              </button>
            ))}
          </div>

          {onImpersonate && (
            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">
                Impersonate User
              </p>
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-600">
                  Search by name, email, or BH ID
                </label>
                <div className="relative mt-2">
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Type at least 2 characters"
                    disabled={impersonationLoading}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 transition-all focus:border-red-300 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {impersonationLoading && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <span className="h-3 w-3 animate-spin rounded-full border border-amber-400 border-t-transparent" />
                    Switching user…
                  </div>
                )}
                {searchLoading && (
                  <p className="text-xs text-gray-500">Searching…</p>
                )}
                {!searchLoading && searchError && (
                  <p className="text-xs text-red-600">{searchError}</p>
                )}
                {!impersonationLoading && !searchLoading && !searchError && searchTerm.trim().length >= 2 && searchResults.length === 0 && (
                  <p className="text-xs text-gray-500">No users found.</p>
                )}
                {searchResults.map((user) => (
                  <button
                    key={user.uid}
                    onClick={() => handleImpersonateClick(user)}
                    disabled={impersonationLoading}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm transition-all hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {user.displayName || user.email || 'User'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {user.email || 'No email'}
                          {user.bhId ? ` · ${user.bhId}` : ''}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                        {user.role}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {pendingImpersonation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h4 className="text-lg font-semibold text-gray-900">Confirm Impersonation</h4>
            <p className="mt-2 text-sm text-gray-600">
              You are about to impersonate{' '}
              <span className="font-semibold">
                {pendingImpersonation.displayName || pendingImpersonation.email || 'User'}
              </span>
              {pendingImpersonation.role ? ` (${pendingImpersonation.role})` : ''}.
            </p>
            <p className="mt-2 text-xs text-amber-700">
              This will switch your session to the selected user until you stop impersonation.
            </p>
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
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPortalModal;
