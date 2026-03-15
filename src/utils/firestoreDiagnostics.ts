import { auth } from '../firebase';
import { captureHandledError } from '../services/errorLog.service';

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
