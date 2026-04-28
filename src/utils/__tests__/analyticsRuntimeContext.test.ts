import {
  getAnalyticsBrowserFamily,
  getAnalyticsDeviceCategory,
  getAnalyticsDeviceModelFamily,
  getAnalyticsMemoryTier,
  getAnalyticsOsFamily,
  getAnalyticsRuntimeContext,
} from '../analyticsRuntimeContext';

describe('analyticsRuntimeContext', () => {
  it('classifies common mobile Apple devices', () => {
    const deviceInfo = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      touch: true,
      memoryGB: 4,
    };

    expect(getAnalyticsDeviceCategory(deviceInfo)).toBe('mobile');
    expect(getAnalyticsDeviceModelFamily(deviceInfo)).toBe('iphone');
    expect(getAnalyticsOsFamily(deviceInfo)).toBe('ios');
    expect(getAnalyticsBrowserFamily(deviceInfo)).toBe('safari');
    expect(getAnalyticsMemoryTier(deviceInfo)).toBe('low');
  });

  it('classifies common desktop Chrome clients', () => {
    const deviceInfo = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      touch: false,
      memoryGB: 16,
    };

    expect(getAnalyticsDeviceCategory(deviceInfo)).toBe('desktop');
    expect(getAnalyticsDeviceModelFamily(deviceInfo)).toBe('mac');
    expect(getAnalyticsOsFamily(deviceInfo)).toBe('macos');
    expect(getAnalyticsBrowserFamily(deviceInfo)).toBe('chrome');
    expect(getAnalyticsMemoryTier(deviceInfo)).toBe('high');
  });

  it('returns low-cardinality defaults when data is missing', () => {
    const context = getAnalyticsRuntimeContext(null);

    expect(context.device_category).toBeDefined();
    expect(context.browser_family).toBeDefined();
    expect(context.memory_tier).toBeDefined();
  });
});
