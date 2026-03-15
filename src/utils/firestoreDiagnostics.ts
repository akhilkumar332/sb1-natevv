import { auth } from '../firebase';
import { captureHandledError } from '../services/errorLog.service';
import { readPendingPortalRole, readRegistrationIntent } from './registrationIntent';

type FirestoreTraceScope = 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';
type FirestoreTraceOperation = 'getDoc' | 'setDoc' | 'updateDoc' | 'query' | 'listen';

type FirestoreTraceContext = {
  scope: FirestoreTraceScope;
  kind: string;
  operation: FirestoreTraceOperation;
  collection: string;
  docId?: string | null;
  blocking?: boolean;
  phase?: string;
  portalRole?: string | null;
  metadata?: Record<string, unknown>;
};

export const isFirestorePermissionDeniedError = (error: unknown): boolean => {
  const anyError = error as { code?: string; message?: string };
  const code = String(anyError?.code || '').toLowerCase();
  const message = String(anyError?.message || '').toLowerCase();
  return code.includes('permission-denied') || message.includes('insufficient permissions');
};

export const captureFirestoreOperationError = async (
  error: unknown,
  context: FirestoreTraceContext,
): Promise<void> => {
  await captureHandledError(error, {
    source: 'frontend',
    scope: context.scope,
    metadata: {
      kind: context.kind,
      firestoreOperation: context.operation,
      firestoreCollection: context.collection,
      firestoreDocId: context.docId || null,
      firestoreBlocking: context.blocking === true,
      firestorePhase: context.phase || null,
      firestorePortalRole: context.portalRole || null,
      firestorePermissionDenied: isFirestorePermissionDeniedError(error),
      online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
      authUid: auth.currentUser?.uid || null,
      ...(context.metadata || {}),
    },
  });
};

const summarizePayloadValue = (value: unknown): unknown => {
  if (value === null || typeof value === 'undefined') return value ?? null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (typeof value === 'object') {
    const maybeTimestamp = value as { seconds?: unknown; nanoseconds?: unknown };
    if (typeof maybeTimestamp.seconds === 'number') {
      return `[timestamp:${maybeTimestamp.seconds}]`;
    }
    return '[object]';
  }
  if (typeof value === 'string') {
    if (value.length > 120) return `${value.slice(0, 120)}...[truncated]`;
    return value;
  }
  return value;
};

export const buildUserWriteDiagnosticMetadata = async ({
  userId,
  payload,
  payloadLabel,
}: {
  userId: string;
  payload: Record<string, unknown>;
  payloadLabel: string;
}): Promise<Record<string, unknown>> => {
  let tokenClaims: Record<string, unknown> | null = null;
  let tokenError: string | null = null;

  try {
    const tokenResult = auth.currentUser ? await auth.currentUser.getIdTokenResult() : null;
    if (tokenResult) {
      tokenClaims = {
        authTime: tokenResult.authTime || null,
        issuedAtTime: tokenResult.issuedAtTime || null,
        expirationTime: tokenResult.expirationTime || null,
        signInProvider: typeof tokenResult.signInProvider === 'string'
          ? tokenResult.signInProvider
          : (tokenResult.claims?.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider || null,
        email: typeof tokenResult.claims?.email === 'string' ? tokenResult.claims.email : null,
        emailVerified: tokenResult.claims?.email_verified === true,
        subject: typeof tokenResult.claims?.sub === 'string' ? tokenResult.claims.sub : null,
        userId: typeof tokenResult.claims?.user_id === 'string' ? tokenResult.claims.user_id : null,
      };
    }
  } catch (error) {
    tokenError = String((error as { message?: string })?.message || error);
  }

  const payloadKeys = Object.keys(payload).sort();
  const payloadSummary = payloadKeys.reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = summarizePayloadValue(payload[key]);
    return acc;
  }, {});

  const currentUser = auth.currentUser;
  return {
    firestoreDiagnosticLabel: payloadLabel,
    firestoreDiagnosticUserId: userId,
    firestoreDiagnosticPayloadKeys: payloadKeys,
    firestoreDiagnosticPayloadSummary: payloadSummary,
    firestoreDiagnosticAuth: {
      currentUid: currentUser?.uid || null,
      currentEmail: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified === true,
      isAnonymous: currentUser?.isAnonymous === true,
      providerIds: currentUser?.providerData?.map((provider) => provider.providerId).filter(Boolean) || [],
      pendingPortalRole: readPendingPortalRole(),
      registrationIntent: readRegistrationIntent(),
    },
    firestoreDiagnosticTokenClaims: tokenClaims,
    firestoreDiagnosticTokenError: tokenError,
  };
};
