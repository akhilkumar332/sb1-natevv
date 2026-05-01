const IOS_USER_AGENT_PATTERN = /iphone|ipad|ipod/i;
const SAFARI_USER_AGENT_PATTERN = /^((?!chrome|android|crios|fxios|edgios).)*safari/i;

export const PWA_INSTALL_PROMPT_DISMISSAL_KEY = 'bh_pwa_install_prompt_dismissed_until';
export const PWA_INSTALL_PROMPT_DISMISSAL_MS = 3 * 24 * 60 * 60 * 1000;

export const isStandaloneDisplayMode = (
  matchesStandalone: boolean,
  iosStandalone: boolean,
): boolean => matchesStandalone || iosStandalone;

export const isIosDevice = (userAgent: string, platform: string, maxTouchPoints: number): boolean => (
  IOS_USER_AGENT_PATTERN.test(userAgent)
  || (platform === 'MacIntel' && maxTouchPoints > 1)
);

export const isSafariBrowser = (userAgent: string): boolean => SAFARI_USER_AGENT_PATTERN.test(userAgent);

export const isIosInstallGuidanceEligible = (input: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  isStandalone: boolean;
  canInstall: boolean;
}): boolean => (
  !input.isStandalone
  && !input.canInstall
  && isIosDevice(input.userAgent, input.platform, input.maxTouchPoints)
  && isSafariBrowser(input.userAgent)
);

export const readDismissedUntil = (
  storageValue: string | null | undefined,
): number | null => {
  if (!storageValue) return null;
  const parsed = Number(storageValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export const isInstallPromptDismissed = (
  storageValue: string | null | undefined,
  now: number,
): boolean => {
  const dismissedUntil = readDismissedUntil(storageValue);
  return dismissedUntil !== null && dismissedUntil > now;
};
