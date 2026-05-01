import { useCallback, useEffect, useRef, useState } from 'react';
import { FIREBASE_ANALYTICS_EVENTS } from '../constants/analytics';
import { monitoringService } from '../services/monitoring.service';
import { setPwaInstallState } from '../services/pwaRuntime.service';
import {
  PWA_INSTALL_PROMPT_DISMISSAL_KEY,
  PWA_INSTALL_PROMPT_DISMISSAL_MS,
  isInstallPromptDismissed,
  isIosInstallGuidanceEligible,
  isStandaloneDisplayMode,
  readDismissedUntil,
} from '../utils/pwaRuntime';

type InstallPromptOutcome = 'accepted' | 'dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallPromptOutcome; platform: string }>;
};

export const usePwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIosInstallGuidanceVisible, setIsIosInstallGuidanceVisible] = useState(false);
  const [isPromptDismissed, setIsPromptDismissed] = useState(false);
  const lastShownModeRef = useRef<'browser_prompt' | 'ios_guidance' | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkInstalled = () => {
      const matchesStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
      const isIosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      const installed = isStandaloneDisplayMode(matchesStandalone, isIosStandalone);
      setIsInstalled(installed);
      return installed;
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsIosInstallGuidanceVisible(false);
      setPwaInstallState({
        installPromptAvailable: false,
        installed: true,
        iosInstallGuidance: false,
        installPromptDismissedUntil: null,
      });
      monitoringService.trackEvent(FIREBASE_ANALYTICS_EVENTS.pwaInstalled, {
        source: 'browser',
      });
    };

    const syncInstallPromptState = (promptEvent: BeforeInstallPromptEvent | null, installed = checkInstalled()) => {
      let dismissedUntil: number | null = null;
      try {
        dismissedUntil = readDismissedUntil(window.localStorage.getItem(PWA_INSTALL_PROMPT_DISMISSAL_KEY));
      } catch {
        dismissedUntil = null;
      }
      const promptDismissed = isInstallPromptDismissed(
        dismissedUntil ? String(dismissedUntil) : null,
        Date.now(),
      );
      const canInstall = Boolean(promptEvent) && !installed && !promptDismissed;
      setIsPromptDismissed(promptDismissed);
      const iosInstallGuidance = isIosInstallGuidanceEligible({
        userAgent: window.navigator.userAgent,
        platform: window.navigator.platform,
        maxTouchPoints: window.navigator.maxTouchPoints || 0,
        isStandalone: installed,
        canInstall,
      }) && !promptDismissed;
      setIsIosInstallGuidanceVisible(iosInstallGuidance);
      setPwaInstallState({
        installPromptAvailable: canInstall,
        installed,
        iosInstallGuidance,
        installPromptDismissedUntil: dismissedUntil,
      });
      return { canInstall, iosInstallGuidance };
    };

    const initialInstalled = checkInstalled();
    syncInstallPromptState(null, initialInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let dismissedUntil: number | null = null;
    try {
      dismissedUntil = readDismissedUntil(window.localStorage.getItem(PWA_INSTALL_PROMPT_DISMISSAL_KEY));
    } catch {
      dismissedUntil = null;
    }
    const promptDismissed = isInstallPromptDismissed(
      dismissedUntil ? String(dismissedUntil) : null,
      Date.now(),
    );
    const canInstall = Boolean(deferredPrompt) && !isInstalled && !promptDismissed;
    setIsPromptDismissed(promptDismissed);
    const iosInstallGuidance = isIosInstallGuidanceEligible({
      userAgent: window.navigator.userAgent,
      platform: window.navigator.platform,
      maxTouchPoints: window.navigator.maxTouchPoints || 0,
      isStandalone: isInstalled,
      canInstall,
    }) && !promptDismissed;
    setIsIosInstallGuidanceVisible(iosInstallGuidance);
    setPwaInstallState({
      installPromptAvailable: canInstall,
      installed: isInstalled,
      iosInstallGuidance,
      installPromptDismissedUntil: dismissedUntil,
    });
    const nextMode = canInstall ? 'browser_prompt' : iosInstallGuidance ? 'ios_guidance' : null;
    if (nextMode && lastShownModeRef.current !== nextMode) {
      lastShownModeRef.current = nextMode;
      monitoringService.trackEvent(FIREBASE_ANALYTICS_EVENTS.pwaInstallPromptShown, {
        mode: nextMode,
      });
    } else if (!nextMode) {
      lastShownModeRef.current = null;
    }
  }, [deferredPrompt, isInstalled]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'dismissed';
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        monitoringService.trackEvent(FIREBASE_ANALYTICS_EVENTS.pwaInstallPromptAccepted, {
          platform: choice.platform || 'unknown',
        });
      } else {
        monitoringService.trackEvent(FIREBASE_ANALYTICS_EVENTS.pwaInstallPromptDismissed, {
          platform: choice.platform || 'unknown',
        });
      }
      setDeferredPrompt(null);
      return choice.outcome;
    } catch {
      setDeferredPrompt(null);
      return 'dismissed';
    }
  }, [deferredPrompt]);

  const dismissInstallPrompt = useCallback(() => {
    if (typeof window === 'undefined') return;
    const dismissedUntil = Date.now() + PWA_INSTALL_PROMPT_DISMISSAL_MS;
    try {
      window.localStorage.setItem(PWA_INSTALL_PROMPT_DISMISSAL_KEY, String(dismissedUntil));
    } catch {
      // ignore storage restrictions
    }
    setDeferredPrompt(null);
    setIsIosInstallGuidanceVisible(false);
    setIsPromptDismissed(true);
    setPwaInstallState({
      installPromptAvailable: false,
      installed: isInstalled,
      iosInstallGuidance: false,
      installPromptDismissedUntil: dismissedUntil,
    });
    monitoringService.trackEvent(FIREBASE_ANALYTICS_EVENTS.pwaInstallPromptDismissed, {
      mode: deferredPrompt ? 'browser_prompt' : 'ios_guidance',
    });
  }, [deferredPrompt, isInstalled]);

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled && !isPromptDismissed,
    promptInstall,
    isInstalled,
    isIosInstallGuidanceVisible,
    dismissInstallPrompt,
  };
};
