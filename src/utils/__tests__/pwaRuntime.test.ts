import {
  PWA_INSTALL_PROMPT_DISMISSAL_MS,
  isInstallPromptDismissed,
  isIosDevice,
  isIosInstallGuidanceEligible,
  isSafariBrowser,
  isStandaloneDisplayMode,
  readDismissedUntil,
} from '../pwaRuntime';

describe('pwaRuntime', () => {
  it('detects standalone mode from either browser signal', () => {
    expect(isStandaloneDisplayMode(true, false)).toBe(true);
    expect(isStandaloneDisplayMode(false, true)).toBe(true);
    expect(isStandaloneDisplayMode(false, false)).toBe(false);
  });

  it('detects iOS devices including iPad desktop mode', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0)).toBe(false);
  });

  it('detects Safari without matching Chromium-based browsers', () => {
    expect(isSafariBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe(true);
    expect(isSafariBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1')).toBe(false);
  });

  it('shows iOS install guidance only for eligible Safari sessions', () => {
    expect(isIosInstallGuidanceEligible({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
      isStandalone: false,
      canInstall: false,
    })).toBe(true);

    expect(isIosInstallGuidanceEligible({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
      maxTouchPoints: 0,
      isStandalone: false,
      canInstall: false,
    })).toBe(false);

    expect(isIosInstallGuidanceEligible({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
      isStandalone: false,
      canInstall: false,
    })).toBe(false);
  });

  it('parses dismissal timestamps safely', () => {
    expect(readDismissedUntil(String(Date.now() + PWA_INSTALL_PROMPT_DISMISSAL_MS))).not.toBeNull();
    expect(readDismissedUntil('not-a-number')).toBeNull();
    expect(readDismissedUntil('-1')).toBeNull();
  });

  it('detects active install prompt dismissals', () => {
    const now = Date.now();
    expect(isInstallPromptDismissed(String(now + PWA_INSTALL_PROMPT_DISMISSAL_MS), now)).toBe(true);
    expect(isInstallPromptDismissed(String(now - 1), now)).toBe(false);
    expect(isInstallPromptDismissed(null, now)).toBe(false);
  });
});
