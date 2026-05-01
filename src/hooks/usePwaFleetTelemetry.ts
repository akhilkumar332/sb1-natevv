import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePwaRuntime } from './usePwaRuntime';
import { persistPwaRuntimeTelemetry } from '../services/pwaTelemetry.service';

export const usePwaFleetTelemetry = (): void => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const runtime = usePwaRuntime();
  const lastKnownPath = `${location.pathname}${location.search}${location.hash}`;
  const runtimeSignature = useMemo(() => JSON.stringify({
    installed: runtime.installed,
    registered: runtime.registered,
    controlled: runtime.controlled,
    notificationPermission: runtime.notificationPermission,
    currentBuildTime: runtime.currentBuildTime,
    manifestHref: runtime.manifestHref,
  }), [
    runtime.controlled,
    runtime.currentBuildTime,
    runtime.installed,
    runtime.manifestHref,
    runtime.notificationPermission,
    runtime.registered,
  ]);
  const appStartKeyRef = useRef<string | null>(null);
  const runtimeSignatureRef = useRef<string | null>(null);
  const buildTimeRef = useRef<string | null>(null);
  const telemetryUser = user?.uid && user.role
    ? { uid: user.uid, role: user.role }
    : null;

  useEffect(() => {
    if (!telemetryUser) return;
    const nextAppStartKey = `${telemetryUser.uid}:${runtime.currentBuildTime || 'unknown'}`;
    if (appStartKeyRef.current === nextAppStartKey) return;
    appStartKeyRef.current = nextAppStartKey;
    runtimeSignatureRef.current = runtimeSignature;
    buildTimeRef.current = runtime.currentBuildTime;
    void persistPwaRuntimeTelemetry({
      user: telemetryUser,
      pathname: lastKnownPath,
      language: i18n.resolvedLanguage || 'en',
      reason: 'app_start',
      runtime,
    });
  }, [i18n.resolvedLanguage, lastKnownPath, runtime, runtimeSignature, telemetryUser]);

  useEffect(() => {
    if (!telemetryUser) return;
    if (runtimeSignatureRef.current === runtimeSignature) return;
    const previousBuildTime = buildTimeRef.current;
    const reason = previousBuildTime && previousBuildTime !== runtime.currentBuildTime
      ? 'version_change'
      : 'runtime_change';
    runtimeSignatureRef.current = runtimeSignature;
    buildTimeRef.current = runtime.currentBuildTime;
    void persistPwaRuntimeTelemetry({
      user: telemetryUser,
      pathname: lastKnownPath,
      language: i18n.resolvedLanguage || 'en',
      reason,
      runtime,
    });
  }, [i18n.resolvedLanguage, lastKnownPath, runtime, runtimeSignature, telemetryUser]);

  useEffect(() => {
    if (!telemetryUser) return undefined;
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void persistPwaRuntimeTelemetry({
        user: telemetryUser,
        pathname: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        language: i18n.resolvedLanguage || 'en',
        reason: 'visibility_resume',
        runtime,
      });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [i18n.resolvedLanguage, runtime, telemetryUser]);
};
