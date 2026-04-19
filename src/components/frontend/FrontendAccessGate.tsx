import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Droplets, Lock, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Loading from '../Loading';
import LanguageSwitcher from '../LanguageSwitcher';
import LogoMark from '../LogoMark';
import SeoHead from '../SeoHead';
import ThemeToggle from '../ThemeToggle';
import { CMS_DEFAULTS, CMS_FRONTEND_ACCESS, CMS_FRONTEND_ACCESS_MODE } from '../../constants/cms';
import { useLocation } from 'react-router-dom';
import { captureHandledError } from '../../services/errorLog.service';
import {
  getFrontendAccessStatus,
  unlockFrontendAccess,
} from '../../services/frontendAccess.service';
import { getPublicCmsSettings } from '../../services/cms.service';
import {
  getFrontendAccessCountdown,
  isAdminRoutePath,
  normalizeFrontendAccess,
  readCachedFrontendAccess,
  writeCachedFrontendAccess,
} from '../../utils/frontendAccess';

type FrontendAccessGateProps = {
  children: ReactNode;
};

type AccessShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  supportingText?: string | null;
  icon: ReactNode;
  children?: ReactNode;
};

function AccessShell({ eyebrow, title, description, supportingText, icon, children }: AccessShellProps) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.22),_transparent_35%),linear-gradient(135deg,_#fff7f7_0%,_#fff1f2_28%,_#ffffff_60%,_#fef2f2_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.18),_transparent_35%),linear-gradient(135deg,_#12090a_0%,_#1b0d10_30%,_#0f172a_75%,_#111827_100%)]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-16 top-16 h-56 w-56 rounded-full bg-red-300/35 blur-3xl dark:bg-red-700/20" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-rose-300/30 blur-3xl dark:bg-rose-700/15" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-orange-200/20 blur-3xl dark:bg-orange-700/10" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-start px-3 py-4 sm:items-center sm:px-6 sm:py-10 lg:px-8">
        <div className="w-full">
          <div className="mb-4 flex items-start justify-between gap-3 sm:mb-6 sm:flex-col sm:items-center">
            <div className="inline-flex max-w-full items-center rounded-full border border-white/70 bg-white/85 px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 sm:px-4">
              <div className="flex min-w-0 items-center space-x-2">
                <LogoMark className="h-8 w-8 sm:h-9 sm:w-9" title="BloodHub India" />
                <div className="min-w-0">
                  <span className="block truncate bg-gradient-to-r from-red-600 via-red-700 to-red-800 bg-clip-text text-xl font-extrabold text-transparent sm:text-2xl">
                    BloodHub
                  </span>
                  <p className="-mt-1 text-[10px] tracking-wider text-center text-gray-500 dark:text-slate-400">{t('brand.india')}</p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LanguageSwitcher menuAlign="left" />
              <ThemeToggle />
            </div>
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr_0.9fr]">
            <section className="rounded-[2rem] border border-red-100/80 bg-white/85 p-5 shadow-[0_30px_80px_rgba(127,29,29,0.12)] backdrop-blur-xl dark:border-red-900/30 dark:bg-slate-950/70 sm:p-8">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 sm:px-4 sm:text-xs sm:tracking-[0.16em]">
              <Droplets className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
            <div className="mt-4 flex flex-col gap-4 sm:mt-6 sm:flex-row sm:items-start">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-red-900 text-white shadow-lg shadow-red-900/20 sm:h-14 sm:w-14">
                {icon}
              </div>
              <div className="min-w-0">
                <h1 className="text-[2rem] font-black leading-tight tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl">{title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:mt-4 sm:text-base sm:leading-7">{description}</p>
                {supportingText ? (
                  <p className="mt-3 text-sm font-medium leading-6 text-red-700 dark:text-red-300">{supportingText}</p>
                ) : null}
              </div>
            </div>
            </section>

            <aside className="rounded-[2rem] border border-red-100/80 bg-white/90 p-4 shadow-[0_20px_60px_rgba(127,29,29,0.14)] backdrop-blur-xl dark:border-red-900/30 dark:bg-slate-950/80 sm:p-6">
              {children}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

const resolveTranslatableSetting = (
  value: string | null | undefined,
  fallbackValue: string,
  translatedFallback: string,
): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized === fallbackValue) {
    return translatedFallback;
  }
  return normalized;
};

const formatMaintenanceDateTime = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

function useCountdownNow(enabled: boolean) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    setNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, CMS_FRONTEND_ACCESS.countdownTickMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled]);

  return nowMs;
}

function MaintenanceScreen({
  title,
  message,
  eta,
  maintenanceEndsAt,
}: {
  title: string;
  message: string;
  eta?: string | null;
  maintenanceEndsAt?: string | null;
}) {
  const { t } = useTranslation();
  const nowMs = useCountdownNow(Boolean(maintenanceEndsAt));
  const countdown = getFrontendAccessCountdown(maintenanceEndsAt, nowMs);
  const formattedEndTime = formatMaintenanceDateTime(maintenanceEndsAt);
  return (
    <>
      <SeoHead
        title={t('frontendAccess.maintenance.seoTitle')}
        description={message}
        robots="noindex,nofollow"
      />
      <AccessShell
        eyebrow={t('frontendAccess.maintenance.eyebrow')}
        title={title}
        description={message}
        supportingText={
          formattedEndTime
            ? t('frontendAccess.maintenance.supportingEndsAt', { dateTime: formattedEndTime })
            : eta
              ? t('frontendAccess.maintenance.expectedUpdate', { eta })
              : t('frontendAccess.maintenance.supportingText')
        }
        icon={<ShieldAlert className="h-7 w-7" />}
      >
        <div className="space-y-3 sm:space-y-4">
          {countdown ? (
            <div className="rounded-2xl border border-red-200 bg-white/90 p-4 dark:border-red-900/40 dark:bg-slate-900 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-700 dark:text-red-300">{t('frontendAccess.maintenance.countdownTitle')}</p>
                  <p className="mt-1 break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {countdown.expired
                      ? t('frontendAccess.maintenance.countdownExpired')
                      : formattedEndTime
                        ? t('frontendAccess.maintenance.countdownEndsAt', { dateTime: formattedEndTime })
                        : t('frontendAccess.maintenance.countdownActive')}
                  </p>
                </div>
                {formattedEndTime ? (
                  <div className="max-w-full break-words rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 sm:max-w-[15rem]">
                    {formattedEndTime}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
                {[
                  { label: t('frontendAccess.maintenance.countdownDays'), value: countdown.days },
                  { label: t('frontendAccess.maintenance.countdownHours'), value: countdown.hours },
                  { label: t('frontendAccess.maintenance.countdownMinutes'), value: countdown.minutes },
                  { label: t('frontendAccess.maintenance.countdownSeconds'), value: countdown.seconds },
                ].map((entry) => (
                  <div key={entry.label} className="min-w-0 rounded-2xl border border-red-100 bg-red-50/70 px-2.5 py-3 text-center dark:border-red-900/30 dark:bg-red-950/20 sm:px-3 sm:py-4">
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-50">{`${entry.value}`.padStart(2, '0')}</p>
                    <p className="mt-1 break-words text-[10px] font-semibold uppercase tracking-[0.1em] text-red-700 dark:text-red-300 sm:text-[11px] sm:tracking-[0.12em]">{entry.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="rounded-2xl border border-red-100 bg-red-50/80 p-4 dark:border-red-900/40 dark:bg-red-950/20 sm:hidden">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-700 dark:text-red-300">{t('frontendAccess.maintenance.visitorInfoTitle')}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
              {t('frontendAccess.maintenance.visitorInfoBody')}
            </p>
          </div>
          <div className="hidden rounded-2xl border border-red-100 bg-red-50/80 p-5 dark:border-red-900/40 dark:bg-red-950/20 sm:block">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-700 dark:text-red-300">{t('frontendAccess.maintenance.visitorInfoTitle')}</p>
            <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
              {t('frontendAccess.maintenance.visitorInfoBody')}
            </p>
          </div>
          <div className="hidden rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:block">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('frontendAccess.maintenance.donorFirstTitle')}</p>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">
              {t('frontendAccess.maintenance.donorFirstBody')}
            </p>
          </div>
        </div>
      </AccessShell>
    </>
  );
}

function PasswordScreen({
  title,
  message,
  ttlMinutes,
  statusReady,
  configured,
  statusError,
  onUnlocked,
}: {
  title: string;
  message: string;
  ttlMinutes: number;
  statusReady: boolean;
  configured: boolean;
  statusError: boolean;
  onUnlocked: () => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!statusReady || !configured || statusError) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await unlockFrontendAccess(password.trim());
      if (result.ok && result.unlocked) {
        setPassword('');
        onUnlocked();
        return;
      }
      setErrorMessage(result.error || t('frontendAccess.password.errorIncorrect'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SeoHead
        title={t('frontendAccess.password.seoTitle')}
        description={message}
        robots="noindex,nofollow"
      />
      <AccessShell
        eyebrow={t('frontendAccess.password.eyebrow')}
        title={title}
        description={message}
        supportingText={
          !statusReady
            ? t('frontendAccess.password.statusChecking')
            : configured
              ? t('frontendAccess.password.statusReady', { ttlMinutes })
              : t('frontendAccess.password.statusPreparing')
        }
        icon={<Lock className="h-7 w-7" />}
      >
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 sm:space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">{t('frontendAccess.password.inputLabel')}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={!statusReady || !configured || statusError || submitting}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
                placeholder={t('frontendAccess.password.inputPlaceholder')}
              />
            </label>
            <button
              type="submit"
              disabled={!statusReady || !configured || statusError || submitting || !password.trim()}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? t('frontendAccess.password.submitVerifying') : t('frontendAccess.password.submitIdle')}
            </button>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {errorMessage}
            </div>
          ) : null}

          {statusError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              {t('frontendAccess.password.statusError')}
            </div>
          ) : null}

          {statusReady && !statusError && !configured ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {t('frontendAccess.password.notConfigured')}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            {t('frontendAccess.password.helperText')}
          </div>
        </form>
      </AccessShell>
    </>
  );
}

export default function FrontendAccessGate({ children }: FrontendAccessGateProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const queryClient = useQueryClient();
  const bypassGate = isAdminRoutePath(location.pathname);
  const cachedFrontendAccess = readCachedFrontendAccess();
  const settingsQuery = useQuery({
    queryKey: ['cms', 'public', 'settings', 'frontendAccessGate'],
    queryFn: getPublicCmsSettings,
    enabled: !bypassGate,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
    initialData: () => {
      const cachedSettings = queryClient.getQueryData<{ frontendAccess?: unknown }>(['cms', 'public', 'settings']);
      if (cachedSettings) return cachedSettings;
      if (!cachedFrontendAccess) return undefined;
      return { frontendAccess: cachedFrontendAccess };
    },
  });
  const frontendAccess = normalizeFrontendAccess(settingsQuery.data?.frontendAccess);

  const statusQuery = useQuery({
    queryKey: ['frontendAccess', 'status', frontendAccess.mode],
    queryFn: getFrontendAccessStatus,
    enabled: !bypassGate && frontendAccess.mode === CMS_FRONTEND_ACCESS_MODE.passwordProtected,
    retry: false,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (bypassGate || !settingsQuery.data?.frontendAccess) return;
    writeCachedFrontendAccess(settingsQuery.data.frontendAccess);
  }, [bypassGate, settingsQuery.data]);

  useEffect(() => {
    if (!settingsQuery.error || bypassGate) return;
    void captureHandledError(settingsQuery.error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'frontend_access.settings',
        path: location.pathname,
      },
    });
  }, [bypassGate, location.pathname, settingsQuery.error]);

  if (bypassGate) return <>{children}</>;

  if (settingsQuery.isLoading && !settingsQuery.data) {
    return <Loading />;
  }

  if (!settingsQuery.data && settingsQuery.error) {
    return <>{children}</>;
  }

  if (frontendAccess.mode === CMS_FRONTEND_ACCESS_MODE.open) {
    return <>{children}</>;
  }

  if (frontendAccess.mode === CMS_FRONTEND_ACCESS_MODE.maintenance) {
    return (
      <MaintenanceScreen
        title={resolveTranslatableSetting(
          frontendAccess.maintenanceTitle,
          CMS_DEFAULTS.frontendAccess.maintenanceTitle,
          t('frontendAccess.maintenance.defaultTitle'),
        )}
        message={resolveTranslatableSetting(
          frontendAccess.maintenanceMessage,
          CMS_DEFAULTS.frontendAccess.maintenanceMessage,
          t('frontendAccess.maintenance.defaultMessage'),
        )}
        eta={frontendAccess.maintenanceEta}
        maintenanceEndsAt={frontendAccess.maintenanceEndsAt}
      />
    );
  }

  if (statusQuery.data?.unlocked) {
    return <>{children}</>;
  }

  return (
    <PasswordScreen
      title={resolveTranslatableSetting(
        frontendAccess.passwordPromptTitle,
        CMS_DEFAULTS.frontendAccess.passwordPromptTitle,
        t('frontendAccess.password.defaultTitle'),
      )}
      message={resolveTranslatableSetting(
        frontendAccess.passwordPromptMessage,
        CMS_DEFAULTS.frontendAccess.passwordPromptMessage,
        t('frontendAccess.password.defaultMessage'),
      )}
      ttlMinutes={frontendAccess.passwordSessionTtlMinutes || CMS_DEFAULTS.frontendAccess.passwordSessionTtlMinutes}
      statusReady={statusQuery.isSuccess}
      configured={statusQuery.data?.configured === true}
      statusError={Boolean(statusQuery.error)}
      onUnlocked={() => {
        queryClient.setQueryData(['frontendAccess', 'status', frontendAccess.mode], {
          ok: true,
          mode: frontendAccess.mode,
          unlocked: true,
          configured: true,
          ttlMinutes: frontendAccess.passwordSessionTtlMinutes,
        });
      }}
    />
  );
}
