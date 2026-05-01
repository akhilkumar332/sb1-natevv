import { useEffect, useRef } from 'react';
import { notify } from '../services/notify.service';
import { monitoringService } from '../services/monitoring.service';
import { FIREBASE_ANALYTICS_EVENTS } from '../constants/analytics';
import {
  applyPwaServiceWorkerUpdate,
  setPwaManifestHref,
  setPwaNotificationPermission,
} from '../services/pwaRuntime.service';
import { usePwaRuntime } from './usePwaRuntime';

const OFFLINE_READY_TOAST_ID = 'pwa-offline-ready';
const UPDATE_READY_TOAST_ID = 'pwa-update-ready';

export const usePwaLifecycle = (): void => {
  const runtime = usePwaRuntime();
  const standaloneTrackedRef = useRef(false);
  const offlineReadyTrackedRef = useRef(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const manifestHref = document.querySelector<HTMLLinkElement>('link#pwa-manifest, link[rel="manifest"]')?.href || null;
    setPwaManifestHref(manifestHref);
  }, []);

  useEffect(() => {
    setPwaNotificationPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  }, []);

  useEffect(() => {
    if (!runtime.installed || standaloneTrackedRef.current) return;
    standaloneTrackedRef.current = true;
    monitoringService.trackEvent(FIREBASE_ANALYTICS_EVENTS.pwaStandaloneLaunch, {
      surface: 'runtime',
    });
  }, [runtime.installed]);

  useEffect(() => {
    if (!runtime.offlineReady || offlineReadyTrackedRef.current) return;
    offlineReadyTrackedRef.current = true;
    notify.success('Offline support is ready for this device.', { id: OFFLINE_READY_TOAST_ID });
    monitoringService.trackEvent(FIREBASE_ANALYTICS_EVENTS.pwaOfflineReady, {
      registration_scope: runtime.registrationScope || 'unknown',
    });
  }, [runtime.offlineReady, runtime.registrationScope]);

  useEffect(() => {
    if (!runtime.waitingWorker || runtime.nextBuildTime) {
      notify.dismiss(UPDATE_READY_TOAST_ID);
      return;
    }

    notify.custom(
      () => (
        <div className="pointer-events-auto w-full max-w-sm rounded-xl border border-blue-200 bg-white shadow-xl dark:border-blue-500/30 dark:bg-[#0b1220]">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">App update ready</p>
                <p className="mt-1 text-sm text-blue-800 dark:text-slate-300">
                  A new offline bundle is ready. Refresh to activate the latest cached version.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const handleControllerChange = () => {
                    window.location.reload();
                  };
                  navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
                  const applied = await applyPwaServiceWorkerUpdate();
                  if (!applied) {
                    window.location.reload();
                  }
                }}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      ),
      { id: UPDATE_READY_TOAST_ID, duration: Infinity },
    );
  }, [runtime.nextBuildTime, runtime.waitingWorker]);
};
