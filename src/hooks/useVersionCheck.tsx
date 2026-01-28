import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const VERSION_URL = '/version.json';
const POLL_INTERVAL_MS = 60_000;
const VERSION_STORAGE_KEY = 'bh_app_version';

type VersionPayload = {
  version?: string;
  commit?: string;
};

const clearCaches = async () => {
  if (!('caches' in window)) {
    return;
  }
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
};

const unregisterServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
};

const clearCookies = () => {
  const cookies = document.cookie.split(';');
  const host = window.location.hostname;
  const baseHost = host.startsWith('www.') ? host.slice(4) : host;

  cookies.forEach((cookie) => {
    const name = cookie.split('=')[0]?.trim();
    if (!name) {
      return;
    }
    const base = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = base;
    document.cookie = `${base}; domain=${host}`;
    document.cookie = `${base}; domain=.${host}`;
    if (baseHost !== host) {
      document.cookie = `${base}; domain=${baseHost}`;
      document.cookie = `${base}; domain=.${baseHost}`;
    }
  });
};

export const useVersionCheck = () => {
  const currentVersionRef = useRef<string | null>(null);
  const isRefreshingRef = useRef(false);
  const notifiedVersionRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const handleRefresh = async (nextVersion?: string) => {
      if (isRefreshingRef.current) {
        return;
      }
      isRefreshingRef.current = true;

      try {
        await Promise.all([clearCaches(), unregisterServiceWorkers()]);
      } catch (error) {
        console.warn('Failed to clear caches or service workers:', error);
      }

      clearCookies();
      if (nextVersion) {
        localStorage.setItem(VERSION_STORAGE_KEY, nextVersion);
      }
      window.location.reload();
    };

    const showUpdateToast = (nextVersion: string) => {
      const toastId = 'version-update';
      toast.custom(
        (t) => (
          <div className={`pointer-events-auto w-full max-w-sm rounded-xl border border-amber-200 bg-amber-50 shadow-xl ${t.visible ? 'animate-fadeIn' : ''}`}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-900">New version available</p>
                  <p className="text-sm text-amber-800 mt-1">Refresh to load the latest updates.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRefresh(nextVersion)}
                  className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        ),
        {
          id: toastId,
          duration: Infinity
        }
      );
    };

    const fetchVersion = async (source: 'initial' | 'poll' | 'visibility' = 'poll') => {
      try {
        const response = await fetch(VERSION_URL, { cache: 'no-store' });
        if (!response.ok) {
          return;
        }
        const data: VersionPayload = await response.json();
        const nextVersion = typeof data?.version === 'string' ? data.version : null;
        if (!nextVersion || !isMounted) {
          return;
        }

        if (!currentVersionRef.current) {
          currentVersionRef.current = nextVersion;
          const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
          if (storedVersion && storedVersion !== nextVersion) {
            await handleRefresh(nextVersion);
            return;
          }
          if (!storedVersion) {
            localStorage.setItem(VERSION_STORAGE_KEY, nextVersion);
          }
          return;
        }

        if (nextVersion !== currentVersionRef.current) {
          if (source === 'initial') {
            await handleRefresh(nextVersion);
            return;
          }
          if (notifiedVersionRef.current !== nextVersion) {
            notifiedVersionRef.current = nextVersion;
            showUpdateToast(nextVersion);
          }
        }
      } catch (error) {
        console.warn('Failed to fetch version metadata:', error);
      }
    };

    fetchVersion('initial');
    const intervalId = window.setInterval(() => fetchVersion('poll'), POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchVersion('visibility');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
};
