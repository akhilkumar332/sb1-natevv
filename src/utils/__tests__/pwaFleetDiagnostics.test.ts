import { Timestamp } from 'firebase/firestore';
import { summarizePwaFleetDiagnostics } from '../pwaFleetDiagnostics';
import type { PwaRuntimeDiagnosticRecord } from '../../types/database.types';
import { ROUTES } from '../../constants/routes';

const record = (overrides: Partial<PwaRuntimeDiagnosticRecord>): PwaRuntimeDiagnosticRecord => ({
  deviceKey: 'device-1',
  uid: 'user-1',
  role: 'donor',
  surface: 'donor',
  appVersion: '0.1.0',
  buildTime: '2026-05-01T13:05:28.451Z',
  gitCommit: 'abc123',
  deployId: 'gha-1',
  installed: false,
  standalone: false,
  serviceWorkerSupported: true,
  serviceWorkerRegistered: true,
  serviceWorkerControlling: true,
  notificationPermission: 'granted',
  manifestVariant: 'donor',
  deviceCategory: 'mobile',
  osFamily: 'ios',
  browserFamily: 'safari',
  memoryTier: 'medium',
  networkEffectiveType: '4g',
  connectionType: 'cellular',
  saveData: false,
  touchCapable: true,
  language: 'en',
  lastPath: ROUTES.portal.donor.dashboard.root,
  firstSeenAt: Timestamp.fromMillis(1),
  lastSeenAt: Timestamp.fromMillis(2),
  updatedFrom: 'runtime_change',
  ...overrides,
});

describe('summarizePwaFleetDiagnostics', () => {
  it('computes adoption, build, and permission summaries', () => {
    const summary = summarizePwaFleetDiagnostics([
      record({ deviceKey: 'a', installed: true, standalone: true, notificationPermission: 'granted', surface: 'donor' }),
      record({ deviceKey: 'b', uid: 'user-2', role: 'ngo', surface: 'ngo', deviceCategory: 'desktop', browserFamily: 'chrome', buildTime: 'older', notificationPermission: 'denied' }),
      record({ deviceKey: 'c', uid: 'user-3', role: 'admin', surface: 'admin', notificationPermission: 'default' }),
      record({ deviceKey: 'd', uid: 'user-4', role: 'bloodbank', surface: 'bloodbank', notificationPermission: 'unsupported' }),
    ], '2026-05-01T13:05:28.451Z');

    expect(summary.totalDevices).toBe(4);
    expect(summary.installedDevices).toBe(1);
    expect(summary.standaloneDevices).toBe(1);
    expect(summary.installedFootprintDevices).toBe(1);
    expect(summary.latestBuildDevices).toBe(3);
    expect(summary.staleBuildDevices).toBe(1);
    expect(summary.notificationGranted).toBe(1);
    expect(summary.notificationDenied).toBe(1);
    expect(summary.notificationDefault).toBe(1);
    expect(summary.notificationUnsupported).toBe(1);
    expect(summary.bySurface).toMatchObject({
      donor: 1,
      ngo: 1,
      admin: 1,
      bloodbank: 1,
    });
    expect(summary.byDeviceCategory).toMatchObject({
      mobile: 3,
      desktop: 1,
    });
    expect(summary.byBrowserFamily).toMatchObject({
      safari: 3,
      chrome: 1,
    });
  });
});
