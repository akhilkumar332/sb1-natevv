import { auth } from '../firebase';
import type { UserRole, UserStatus } from '../types/database.types';

export type ImpersonationResponse = {
  targetToken: string;
  resumeToken: string;
  impersonationId?: string;
  targetUser: {
    uid: string;
    role?: UserRole | null;
    email?: string | null;
    displayName?: string | null;
    status?: UserStatus | null;
  };
};

export type ImpersonationResumeResponse = {
  resumeToken: string;
  actorUid?: string | null;
};

export const requestImpersonation = async (
  targetUid: string,
  options?: { reason?: string; caseId?: string }
): Promise<ImpersonationResponse> => {
  if (!targetUid) {
    throw new Error('Target user is required.');
  }

  const idToken = await auth.currentUser?.getIdToken(true);
  if (!idToken) {
    throw new Error('Authentication token unavailable.');
  }

  const response = await fetch('/.netlify/functions/impersonate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      targetUid,
      ...(options?.reason ? { reason: options.reason } : {}),
      ...(options?.caseId ? { caseId: options.caseId } : {}),
    }),
  });

  if (!response.ok) {
    let message = response.status === 404
      ? 'Impersonation endpoint not found.'
      : 'Impersonation request failed.';
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
      if (payload?.message) message = payload.message;
    } catch {
      try {
        const text = await response.text();
        if (text) message = text;
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }

  return response.json();
};

export const requestImpersonationResume = async (
  options?: { impersonationId?: string }
): Promise<ImpersonationResumeResponse> => {
  const idToken = await auth.currentUser?.getIdToken(true);
  if (!idToken) {
    throw new Error('Authentication token unavailable.');
  }

  const response = await fetch('/.netlify/functions/impersonation-resume', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      ...(options?.impersonationId ? { impersonationId: options.impersonationId } : {}),
    }),
  });

  if (!response.ok) {
    let message = 'Resume token refresh failed.';
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
      if (payload?.message) message = payload.message;
    } catch {
      try {
        const text = await response.text();
        if (text) message = text;
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }

  return response.json();
};
