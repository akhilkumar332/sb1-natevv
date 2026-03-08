type CmsOperationKind = 'page_save' | 'post_save' | 'schedule_transition';

type CmsOperationFailure = {
  at: number;
  kind: CmsOperationKind;
  message: string;
};

type CmsDiagnosticsState = {
  failures: CmsOperationFailure[];
};

const STORAGE_KEY = 'bh_cms_diagnostics_v1';
const MAX_FAILURES = 100;

const safeWindow = () => (typeof window !== 'undefined' ? window : null);

const emptyState = (): CmsDiagnosticsState => ({ failures: [] });

const loadState = (): CmsDiagnosticsState => {
  const w = safeWindow();
  if (!w) return emptyState();
  try {
    const raw = w.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<CmsDiagnosticsState>;
    const failures = Array.isArray(parsed.failures)
      ? parsed.failures
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry: any) => ({
          at: Number.isFinite(entry.at) ? Number(entry.at) : Date.now(),
          kind: (entry.kind === 'page_save' || entry.kind === 'post_save' || entry.kind === 'schedule_transition')
            ? entry.kind
            : 'page_save',
          message: typeof entry.message === 'string' ? entry.message.slice(0, 240) : 'unknown_error',
        }))
        .slice(0, MAX_FAILURES)
      : [];
    return { failures };
  } catch {
    return emptyState();
  }
};

const saveState = (state: CmsDiagnosticsState): void => {
  const w = safeWindow();
  if (!w) return;
  try {
    w.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
};

let state = loadState();

export const recordCmsOperationFailure = (kind: CmsOperationKind, message: string): void => {
  state = {
    failures: [
      {
        at: Date.now(),
        kind,
        message: String(message || 'unknown_error').slice(0, 240),
      },
      ...state.failures,
    ].slice(0, MAX_FAILURES),
  };
  saveState(state);
};

export const getCmsDiagnosticsSummary = (): {
  totalFailures: number;
  recent24hFailures: number;
  lastFailureAt: number | null;
  byKind: Record<CmsOperationKind, number>;
} => {
  const now = Date.now();
  const cutoff = now - (24 * 60 * 60 * 1000);
  const byKind: Record<CmsOperationKind, number> = {
    page_save: 0,
    post_save: 0,
    schedule_transition: 0,
  };
  state.failures.forEach((entry) => {
    byKind[entry.kind] += 1;
  });
  return {
    totalFailures: state.failures.length,
    recent24hFailures: state.failures.filter((entry) => entry.at >= cutoff).length,
    lastFailureAt: state.failures[0]?.at ?? null,
    byKind,
  };
};

export const resetCmsDiagnostics = (): void => {
  state = emptyState();
  saveState(state);
};
