export type PwaRuntimeState = {
  supported: boolean;
  registered: boolean;
  registrationScope: string | null;
  updateAvailable: boolean;
  offlineReady: boolean;
  waitingWorker: boolean;
  controlled: boolean;
  installPromptAvailable: boolean;
  installed: boolean;
  iosInstallGuidance: boolean;
  installPromptDismissedUntil: number | null;
  notificationPermission: NotificationPermission | 'unsupported';
  registrationError: string | null;
  manifestHref: string | null;
  currentBuildTime: string | null;
  nextBuildTime: string | null;
};

type PwaRuntimeListener = () => void;

const listeners = new Set<PwaRuntimeListener>();

let currentRegistration: ServiceWorkerRegistration | null = null;
let state: PwaRuntimeState = {
  supported: typeof window !== 'undefined' && 'serviceWorker' in navigator,
  registered: false,
  registrationScope: null,
  updateAvailable: false,
  offlineReady: false,
  waitingWorker: false,
  controlled: typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker?.controller),
  installPromptAvailable: false,
  installed: false,
  iosInstallGuidance: false,
  installPromptDismissedUntil: null,
  notificationPermission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  registrationError: null,
  manifestHref: typeof document === 'undefined'
    ? null
    : document.querySelector<HTMLLinkElement>('link#pwa-manifest, link[rel="manifest"]')?.href || null,
  currentBuildTime: null,
  nextBuildTime: null,
};

const emit = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

const patchState = (partial: Partial<PwaRuntimeState>) => {
  state = { ...state, ...partial };
  emit();
};

export const getPwaRuntimeState = (): PwaRuntimeState => state;

export const subscribePwaRuntime = (listener: PwaRuntimeListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setPwaManifestHref = (manifestHref: string | null): void => {
  patchState({ manifestHref });
};

export const setPwaServiceWorkerRegistration = (registration: ServiceWorkerRegistration | null): void => {
  currentRegistration = registration;
  patchState({
    registered: Boolean(registration),
    registrationScope: registration?.scope || null,
    waitingWorker: Boolean(registration?.waiting),
    controlled: typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker?.controller),
    registrationError: null,
  });
};

export const setPwaServiceWorkerUpdateAvailable = (updateAvailable: boolean): void => {
  patchState({
    updateAvailable,
    waitingWorker: updateAvailable || Boolean(currentRegistration?.waiting),
  });
};

export const setPwaOfflineReady = (offlineReady: boolean): void => {
  patchState({ offlineReady });
};

export const setPwaRegistrationError = (errorMessage: string | null): void => {
  patchState({ registrationError: errorMessage });
};

export const setPwaInstallState = (partial: Pick<PwaRuntimeState, 'installPromptAvailable' | 'installed' | 'iosInstallGuidance' | 'installPromptDismissedUntil'>): void => {
  patchState(partial);
};

export const setPwaNotificationPermission = (
  notificationPermission: PwaRuntimeState['notificationPermission'],
): void => {
  patchState({ notificationPermission });
};

export const setPwaBuildState = (partial: Pick<PwaRuntimeState, 'currentBuildTime' | 'nextBuildTime' | 'updateAvailable'>): void => {
  patchState(partial);
};

export const markPwaControllerChanged = (): void => {
  patchState({
    controlled: true,
    waitingWorker: false,
    updateAvailable: false,
    nextBuildTime: null,
  });
};

export const applyPwaServiceWorkerUpdate = async (): Promise<boolean> => {
  const waitingWorker = currentRegistration?.waiting;
  if (!waitingWorker) {
    return false;
  }
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  return true;
};
