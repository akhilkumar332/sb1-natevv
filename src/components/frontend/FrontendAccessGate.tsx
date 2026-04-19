import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Droplets, Lock, ShieldAlert } from 'lucide-react';
import Loading from '../Loading';
import LogoMark from '../LogoMark';
import SeoHead from '../SeoHead';
import { CMS_DEFAULTS, CMS_FRONTEND_ACCESS_MODE } from '../../constants/cms';
import { useLocation } from 'react-router-dom';
import { captureHandledError } from '../../services/errorLog.service';
import {
  getFrontendAccessStatus,
  unlockFrontendAccess,
} from '../../services/frontendAccess.service';
import { getPublicCmsSettings } from '../../services/cms.service';
import {
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
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.22),_transparent_35%),linear-gradient(135deg,_#fff7f7_0%,_#fff1f2_28%,_#ffffff_60%,_#fef2f2_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.18),_transparent_35%),linear-gradient(135deg,_#12090a_0%,_#1b0d10_30%,_#0f172a_75%,_#111827_100%)]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-16 top-16 h-56 w-56 rounded-full bg-red-300/35 blur-3xl dark:bg-red-700/20" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-rose-300/30 blur-3xl dark:bg-rose-700/15" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-orange-200/20 blur-3xl dark:bg-orange-700/10" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.2fr_0.9fr]">
          <section className="rounded-[2rem] border border-red-100/80 bg-white/85 p-8 shadow-[0_30px_80px_rgba(127,29,29,0.12)] backdrop-blur-xl dark:border-red-900/30 dark:bg-slate-950/70">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/85 px-4 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
              <LogoMark className="h-10 w-10" title="BloodHub India" />
              <div>
                <p className="text-sm font-black tracking-[0.16em] text-slate-900 dark:text-slate-50">BLOODHUB INDIA</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Donate blood, save lives.</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              <Droplets className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
            <div className="mt-6 flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-red-900 text-white shadow-lg shadow-red-900/20">
                {icon}
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl">{title}</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">{description}</p>
                {supportingText ? (
                  <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">{supportingText}</p>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="rounded-[2rem] border border-red-100/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(127,29,29,0.14)] backdrop-blur-xl dark:border-red-900/30 dark:bg-slate-950/80">
            {children}
          </aside>
        </div>
      </div>
    </div>
  );
}

function MaintenanceScreen({
  title,
  message,
  eta,
}: {
  title: string;
  message: string;
  eta?: string | null;
}) {
  return (
    <>
      <SeoHead
        title="Scheduled Maintenance | BloodHub India"
        description={message}
        robots="noindex,nofollow"
      />
      <AccessShell
        eyebrow="Scheduled Maintenance"
        title={title}
        description={message}
        supportingText={eta ? `Expected update: ${eta}` : 'We will reopen the frontend as soon as the scheduled work is complete.'}
        icon={<ShieldAlert className="h-7 w-7" />}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-100 bg-red-50/80 p-5 dark:border-red-900/40 dark:bg-red-950/20">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-700 dark:text-red-300">What visitors should know</p>
            <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
              The site is temporarily paused for scheduled improvements. We are working to restore access as quickly as possible.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Donor-first rollout</p>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">
              We use this window to ship safer workflows, improve reliability, and protect donation journeys before reopening access.
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
      setErrorMessage(result.error || 'Incorrect password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SeoHead
        title="Security Gate | BloodHub India"
        description={message}
        robots="noindex,nofollow"
      />
      <AccessShell
        eyebrow="Security Gate"
        title={title}
        description={message}
        supportingText={
          !statusReady
            ? 'Checking access availability...'
            : configured
              ? `Access sessions last up to ${ttlMinutes} minutes.`
              : 'Protected access is being prepared. Please try again shortly.'
        }
        icon={<Lock className="h-7 w-7" />}
      >
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">Access password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={!statusReady || !configured || statusError || submitting}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
                placeholder="Enter password"
              />
            </label>
            <button
              type="submit"
              disabled={!statusReady || !configured || statusError || submitting || !password.trim()}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Verifying access...' : 'Open BloodHub frontend'}
            </button>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {errorMessage}
            </div>
          ) : null}

          {statusError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              We could not verify access right now. Please wait a moment and try again.
            </div>
          ) : null}

          {statusReady && !statusError && !configured ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              This protected page is not fully available right now. Please try again shortly.
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Enter the access password to continue.
          </div>
        </form>
      </AccessShell>
    </>
  );
}

export default function FrontendAccessGate({ children }: FrontendAccessGateProps) {
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
        title={frontendAccess.maintenanceTitle || CMS_DEFAULTS.frontendAccess.maintenanceTitle}
        message={frontendAccess.maintenanceMessage || CMS_DEFAULTS.frontendAccess.maintenanceMessage}
        eta={frontendAccess.maintenanceEta}
      />
    );
  }

  if (statusQuery.data?.unlocked) {
    return <>{children}</>;
  }

  return (
    <PasswordScreen
      title={frontendAccess.passwordPromptTitle || CMS_DEFAULTS.frontendAccess.passwordPromptTitle}
      message={frontendAccess.passwordPromptMessage || CMS_DEFAULTS.frontendAccess.passwordPromptMessage}
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
