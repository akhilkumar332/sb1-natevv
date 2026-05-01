import {
  Timestamp,
  doc,
  serverTimestamp,
  type FieldValue,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestore';
import type { PwaRuntimeState } from './pwaRuntime.service';
import { getDeviceId, getDeviceInfo } from '../utils/device';
import { getAnalyticsRuntimeContext } from '../utils/analyticsRuntimeContext';
import { getAnalyticsSurface } from '../utils/analyticsSurface';
import { captureHandledError } from './errorLog.service';
import type { User } from '../types/database.types';
import { runOnlineTransaction } from '../utils/onlineOnlyTransaction';

type TelemetryWriteReason =
  | 'app_start'
  | 'visibility_resume'
  | 'runtime_change'
  | 'version_change';

type VersionMetadata = {
  appVersion: string;
  buildTime: string;
  gitCommit: string;
  deployId: string;
};

const VERSION_URL = '/version.json';
const PWA_FIRST_SEEN_PREFIX = 'bh_pwa_first_seen_at:';
const MAX_PATH_LENGTH = 180;
const TELEMETRY_WRITE_TTL_MS: Record<TelemetryWriteReason, number> = {
  app_start: 12 * 60 * 60 * 1000,
  runtime_change: 12 * 60 * 60 * 1000,
  version_change: 60 * 60 * 1000,
  visibility_resume: 15 * 60 * 1000,
};

let cachedVersionMetadata: VersionMetadata | null = null;
let cachedVersionMetadataAt = 0;
const lastWriteState: Partial<Record<TelemetryWriteReason, {
  signature: string;
  at: number;
}>> = {};

const sanitizePath = (pathname: string): string => pathname.slice(0, MAX_PATH_LENGTH);

const getManifestVariant = (manifestHref: string | null): string => {
  if (!manifestHref) return 'unknown';
  if (manifestHref.includes('manifest-ngo')) return 'ngo';
  if (manifestHref.includes('manifest-bloodbank')) return 'bloodbank';
  if (manifestHref.includes('manifest-donor')) return 'donor';
  return 'default';
};

const buildDiagnosticDocId = (uid: string, deviceId: string): string => (
  `${uid}__${deviceId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
);

const getFirstSeenAt = (uid: string, deviceId: string): Timestamp => {
  const storageKey = `${PWA_FIRST_SEEN_PREFIX}${uid}:${deviceId}`;
  const now = Date.now();
  if (typeof window === 'undefined') {
    return Timestamp.fromMillis(now);
  }
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      const parsed = Number(existing);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Timestamp.fromMillis(parsed);
      }
    }
    window.localStorage.setItem(storageKey, String(now));
  } catch {
    // ignore storage restrictions
  }
  return Timestamp.fromMillis(now);
};

const readVersionMetadata = async (): Promise<VersionMetadata> => {
  const now = Date.now();
  if (cachedVersionMetadata && now - cachedVersionMetadataAt < 60_000) {
    return cachedVersionMetadata;
  }
  const response = await fetch(`${VERSION_URL}?ts=${now}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load version metadata (${response.status})`);
  }
  const data = await response.json() as {
    appVersion?: string;
    buildTime?: string;
    gitCommit?: string;
    deployId?: string;
  };
  cachedVersionMetadata = {
    appVersion: typeof data.appVersion === 'string' ? data.appVersion : '0.0.0',
    buildTime: typeof data.buildTime === 'string' ? data.buildTime : '',
    gitCommit: typeof data.gitCommit === 'string' ? data.gitCommit : '',
    deployId: typeof data.deployId === 'string' ? data.deployId : 'unknown',
  };
  cachedVersionMetadataAt = now;
  return cachedVersionMetadata;
};

const buildSignature = (input: {
  uid: string;
  role: string;
  pathname: string;
  language: string;
  reason: TelemetryWriteReason;
  runtime: PwaRuntimeState;
  version: VersionMetadata;
}) => {
  const deviceInfo = getDeviceInfo();
  const runtimeContext = getAnalyticsRuntimeContext(deviceInfo);
  return JSON.stringify({
    uid: input.uid,
    role: input.role,
    surface: getAnalyticsSurface(input.pathname),
    language: input.language,
    reason: input.reason,
    buildTime: input.version.buildTime,
    deployId: input.version.deployId,
    installed: input.runtime.installed,
    standalone: input.runtime.installed,
    swRegistered: input.runtime.registered,
    swControlling: input.runtime.controlled,
    notificationPermission: input.runtime.notificationPermission,
    manifestVariant: getManifestVariant(input.runtime.manifestHref),
    runtimeContext,
  });
};

export const persistPwaRuntimeTelemetry = async (input: {
  user: Pick<User, 'uid' | 'role'>;
  pathname: string;
  language: string;
  reason: TelemetryWriteReason;
  runtime: PwaRuntimeState;
}): Promise<void> => {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return;
  }

  const deviceId = getDeviceId();
  if (!deviceId) {
    return;
  }

  try {
    const version = await readVersionMetadata();
    const signature = buildSignature({
      uid: input.user.uid,
      role: input.user.role,
      pathname: input.pathname,
      language: input.language,
      reason: input.reason,
      runtime: input.runtime,
      version,
    });
    const now = Date.now();
    const previousWrite = lastWriteState[input.reason];
    const ttlMs = TELEMETRY_WRITE_TTL_MS[input.reason];
    if (previousWrite && signature === previousWrite.signature && now - previousWrite.at < ttlMs) {
      return;
    }

    const deviceInfo = getDeviceInfo();
    const runtimeContext = getAnalyticsRuntimeContext(deviceInfo);
    const docId = buildDiagnosticDocId(input.user.uid, deviceId);
    const firstSeenAt = getFirstSeenAt(input.user.uid, deviceId);
    const payload: Record<string, string | boolean | Timestamp | FieldValue | null> = {
      deviceKey: docId,
      uid: input.user.uid,
      role: input.user.role,
      surface: getAnalyticsSurface(input.pathname),
      appVersion: version.appVersion,
      buildTime: version.buildTime,
      gitCommit: version.gitCommit,
      deployId: version.deployId,
      installed: input.runtime.installed,
      standalone: input.runtime.installed,
      serviceWorkerSupported: input.runtime.supported,
      serviceWorkerRegistered: input.runtime.registered,
      serviceWorkerControlling: input.runtime.controlled,
      notificationPermission: input.runtime.notificationPermission,
      manifestVariant: getManifestVariant(input.runtime.manifestHref),
      deviceCategory: runtimeContext.device_category,
      osFamily: runtimeContext.os_family,
      browserFamily: runtimeContext.browser_family,
      memoryTier: runtimeContext.memory_tier,
      networkEffectiveType: runtimeContext.network_effective_type,
      connectionType: runtimeContext.connection_type,
      saveData: runtimeContext.save_data,
      touchCapable: runtimeContext.touch_capable,
      language: input.language || 'en',
      lastPath: sanitizePath(input.pathname),
      firstSeenAt,
      lastSeenAt: serverTimestamp(),
      updatedFrom: input.reason,
      updatedAt: serverTimestamp(),
    };

    const diagnosticRef = doc(db, COLLECTIONS.PWA_RUNTIME_DIAGNOSTICS, docId);
    await runOnlineTransaction(async (transaction) => {
      transaction.set(diagnosticRef, payload, { merge: true });
      return true;
    }, 'PWA fleet telemetry requires an internet connection.');
    lastWriteState[input.reason] = {
      signature,
      at: now,
    };
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'pwa_telemetry.write',
        reason: input.reason,
      },
    });
  }
};
