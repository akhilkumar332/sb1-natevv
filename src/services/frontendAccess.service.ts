import { captureHandledError } from './errorLog.service';

export type FrontendAccessStatusResponse = {
  ok: boolean;
  mode?: 'open' | 'maintenance' | 'password_protected';
  unlocked?: boolean;
  configured?: boolean;
  ttlMinutes?: number;
};

type UnlockResponse = FrontendAccessStatusResponse & {
  error?: string;
};

const FRONTEND_ACCESS_ENDPOINT = '/.netlify/functions/frontend-access';

const parseJson = async <T>(response: Response): Promise<T | null> => {
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
};

export const getFrontendAccessStatus = async (): Promise<FrontendAccessStatusResponse> => {
  try {
    const response = await fetch(FRONTEND_ACCESS_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
    });
    const body = await parseJson<FrontendAccessStatusResponse>(response);
    if (!response.ok || !body) {
      const error = new Error(`Frontend access status failed with ${response.status}`);
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'unknown',
        metadata: {
          kind: 'frontend_access.status',
          status: response.status,
        },
      });
      throw error;
    }
    return body;
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'frontend_access.status',
        status: 'network_or_unknown',
      },
    });
    throw error instanceof Error ? error : new Error('Frontend access status request failed.');
  }
};

export const unlockFrontendAccess = async (password: string): Promise<UnlockResponse> => {
  try {
    const response = await fetch(FRONTEND_ACCESS_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    const body = await parseJson<UnlockResponse>(response);
    if (response.ok && body) return body;
    if (response.status >= 500) {
      const error = new Error(`Frontend access unlock failed with ${response.status}`);
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'unknown',
        metadata: {
          kind: 'frontend_access.unlock',
          status: response.status,
        },
      });
    }
    return body || { ok: false, error: 'Unable to verify access right now.' };
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'frontend_access.unlock',
        status: 'network_or_unknown',
      },
    });
    return {
      ok: false,
      error: 'Frontend access verification is unavailable right now.',
    };
  }
};

export const clearFrontendAccessSession = async (): Promise<void> => {
  try {
    const response = await fetch(FRONTEND_ACCESS_ENDPOINT, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (response.ok) return;
    const error = new Error(`Frontend access session clear failed with ${response.status}`);
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'frontend_access.clear',
        status: response.status,
      },
    });
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        kind: 'frontend_access.clear',
        status: 'network_or_unknown',
      },
    });
  }
};
