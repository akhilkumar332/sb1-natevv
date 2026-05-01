import type { PwaRuntimeDiagnosticRecord } from '../types/database.types';

export type PwaFleetOverviewSummary = {
  totalDevices: number;
  installedDevices: number;
  standaloneDevices: number;
  latestBuildDevices: number;
  staleBuildDevices: number;
  notificationGranted: number;
  notificationDenied: number;
  notificationDefault: number;
  notificationUnsupported: number;
  bySurface: Record<string, number>;
  byDeviceCategory: Record<string, number>;
  byBrowserFamily: Record<string, number>;
};

const increment = (bucket: Record<string, number>, key: string) => {
  const normalized = key || 'unknown';
  bucket[normalized] = (bucket[normalized] || 0) + 1;
};

export const summarizePwaFleetDiagnostics = (
  records: PwaRuntimeDiagnosticRecord[],
  latestBuildTime?: string | null,
): PwaFleetOverviewSummary => records.reduce<PwaFleetOverviewSummary>((summary, record) => {
  summary.totalDevices += 1;
  if (record.installed) summary.installedDevices += 1;
  if (record.standalone) summary.standaloneDevices += 1;
  if (latestBuildTime && record.buildTime === latestBuildTime) {
    summary.latestBuildDevices += 1;
  } else if (latestBuildTime) {
    summary.staleBuildDevices += 1;
  }

  if (record.notificationPermission === 'granted') summary.notificationGranted += 1;
  else if (record.notificationPermission === 'denied') summary.notificationDenied += 1;
  else if (record.notificationPermission === 'default') summary.notificationDefault += 1;
  else summary.notificationUnsupported += 1;

  increment(summary.bySurface, record.surface);
  increment(summary.byDeviceCategory, record.deviceCategory);
  increment(summary.byBrowserFamily, record.browserFamily);
  return summary;
}, {
  totalDevices: 0,
  installedDevices: 0,
  standaloneDevices: 0,
  latestBuildDevices: 0,
  staleBuildDevices: 0,
  notificationGranted: 0,
  notificationDenied: 0,
  notificationDefault: 0,
  notificationUnsupported: 0,
  bySurface: {},
  byDeviceCategory: {},
  byBrowserFamily: {},
});
