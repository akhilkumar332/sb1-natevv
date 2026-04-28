import type { DeviceInfo } from './device';

export type AnalyticsRuntimeContext = {
  device_category: string;
  device_model_family: string;
  os_family: string;
  browser_family: string;
  memory_tier: string;
  network_effective_type: string;
  connection_type: string;
  save_data: boolean;
  touch_capable: boolean;
};

const getNavigatorConnection = () => {
  if (typeof navigator === 'undefined') return null;
  return (
    (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        type?: string;
        saveData?: boolean;
      };
      mozConnection?: {
        effectiveType?: string;
        type?: string;
        saveData?: boolean;
      };
      webkitConnection?: {
        effectiveType?: string;
        type?: string;
        saveData?: boolean;
      };
    }).connection
    || (navigator as any).mozConnection
    || (navigator as any).webkitConnection
    || null
  );
};

const getUserAgent = (deviceInfo?: DeviceInfo | null): string => {
  return String(
    deviceInfo?.userAgent
    || (typeof navigator !== 'undefined' ? navigator.userAgent : '')
    || '',
  );
};

export const getAnalyticsDeviceCategory = (deviceInfo?: DeviceInfo | null): string => {
  const ua = getUserAgent(deviceInfo);
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android/i.test(ua)) return 'mobile';
  return 'desktop';
};

export const getAnalyticsDeviceModelFamily = (deviceInfo?: DeviceInfo | null): string => {
  const ua = getUserAgent(deviceInfo);
  if (/iphone/i.test(ua)) return 'iphone';
  if (/ipad/i.test(ua)) return 'ipad';
  if (/pixel/i.test(ua)) return 'pixel_android';
  if (/samsung|sm-/i.test(ua)) return 'samsung_android';
  if (/oneplus/i.test(ua)) return 'oneplus_android';
  if (/redmi|xiaomi/i.test(ua)) return 'xiaomi_android';
  if (/android/i.test(ua)) return 'android_device';
  if (/windows/i.test(ua)) return 'windows_desktop';
  if (/macintosh|mac os x/i.test(ua)) return 'mac';
  if (/linux/i.test(ua)) return 'linux_desktop';
  return 'unknown';
};

export const getAnalyticsOsFamily = (deviceInfo?: DeviceInfo | null): string => {
  const ua = getUserAgent(deviceInfo);
  const platform = String(deviceInfo?.platform || '');
  if (/iphone|ipad|ios/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/windows/i.test(ua) || /win/i.test(platform)) return 'windows';
  if (/macintosh|mac os x/i.test(ua) || /mac/i.test(platform)) return 'macos';
  if (/linux/i.test(ua) || /linux/i.test(platform)) return 'linux';
  return 'unknown';
};

export const getAnalyticsBrowserFamily = (deviceInfo?: DeviceInfo | null): string => {
  const ua = getUserAgent(deviceInfo);
  if (/edg\//i.test(ua)) return 'edge';
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'opera';
  if (/firefox\//i.test(ua)) return 'firefox';
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua) && !/opr\//i.test(ua)) return 'chrome';
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return 'safari';
  return 'unknown';
};

export const getAnalyticsMemoryTier = (deviceInfo?: DeviceInfo | null): string => {
  const memoryGB = Number(deviceInfo?.memoryGB || 0);
  if (!Number.isFinite(memoryGB) || memoryGB <= 0) return 'unknown';
  if (memoryGB <= 4) return 'low';
  if (memoryGB <= 8) return 'medium';
  return 'high';
};

export const getAnalyticsRuntimeContext = (deviceInfo?: DeviceInfo | null): AnalyticsRuntimeContext => {
  const connection = getNavigatorConnection();
  return {
    device_category: getAnalyticsDeviceCategory(deviceInfo),
    device_model_family: getAnalyticsDeviceModelFamily(deviceInfo),
    os_family: getAnalyticsOsFamily(deviceInfo),
    browser_family: getAnalyticsBrowserFamily(deviceInfo),
    memory_tier: getAnalyticsMemoryTier(deviceInfo),
    network_effective_type: String(connection?.effectiveType || 'unknown'),
    connection_type: String(connection?.type || 'unknown'),
    save_data: connection?.saveData === true,
    touch_capable: deviceInfo?.touch === true,
  };
};
