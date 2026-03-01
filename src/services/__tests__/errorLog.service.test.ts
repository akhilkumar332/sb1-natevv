import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../constants/routes';

const { addDocMock, collectionMock, serverTimestampMock, authState } = vi.hoisted(() => ({
  addDocMock: vi.fn(async (..._args: unknown[]) => ({ id: 'log-1' })),
  collectionMock: vi.fn((..._args: unknown[]) => ({})),
  serverTimestampMock: vi.fn(() => ({ now: true })),
  authState: { currentUser: null as { uid: string } | null },
}));

vi.mock('firebase/firestore', () => ({
  addDoc: addDocMock,
  collection: collectionMock,
  serverTimestamp: () => serverTimestampMock(),
}));

vi.mock('../../firebase', () => ({
  db: {},
  auth: authState,
}));

import { captureError, flushQueuedErrorLogs } from '../errorLog.service';

describe('errorLog.service', () => {
  beforeEach(() => {
    addDocMock.mockClear();
    collectionMock.mockClear();
    serverTimestampMock.mockClear();
    authState.currentUser = null;
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('queues logs when user is unauthenticated', async () => {
    await captureError(new Error('unauth failure'));
    expect(addDocMock).not.toHaveBeenCalled();

    const queuedRaw = window.sessionStorage.getItem('bh_error_log_queue');
    expect(queuedRaw).toBeTruthy();
    const queue = JSON.parse(queuedRaw || '[]');
    expect(queue.length).toBe(1);
    expect(queue[0].message).toContain('unauth failure');
  });

  it('flushes queued logs after authentication', async () => {
    await captureError(new Error('queued before login'));
    authState.currentUser = { uid: 'user-1' };

    await flushQueuedErrorLogs();

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const queuedRaw = window.sessionStorage.getItem('bh_error_log_queue');
    const queue = JSON.parse(queuedRaw || '[]');
    expect(queue).toHaveLength(0);
  });

  it('dedupes repeated errors in a short window', async () => {
    authState.currentUser = { uid: 'user-2' };

    await captureError(new Error('dedupe me'));
    await captureError(new Error('dedupe me'));

    expect(addDocMock).toHaveBeenCalledTimes(1);
  });

  it('drops noisy console warning patterns', async () => {
    authState.currentUser = { uid: 'user-3' };

    await captureError(new Error('React Router Future Flag Warning: noisy warning'), {
      metadata: { kind: 'console.error' },
    });

    expect(addDocMock).toHaveBeenCalledTimes(0);
  });

  it('omits null optional fields from persisted payload', async () => {
    authState.currentUser = { uid: 'user-4' };

    await captureError('payload compaction check');

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const payload = (addDocMock.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
    expect(payload).not.toHaveProperty('code');
    expect(payload).toHaveProperty('route');
    expect(payload).not.toHaveProperty('stack');
    expect(payload).toHaveProperty('createdAt');
  });

  it('redacts sensitive route params before persistence', async () => {
    authState.currentUser = { uid: 'user-5' };

    await captureError(new Error('route redaction check'), {
      route: `${ROUTES.portal.donor.login}?pendingRequest=abc123&token=xyz987&page=1`,
    });

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const payload = (addDocMock.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
    const route = String(payload.route || '');
    expect(route).toContain('pendingRequest=%5BREDACTED%5D');
    expect(route).toContain('token=%5BREDACTED%5D');
    expect(route).toContain('page=1');
  });

  it('sanitizes undefined metadata values to avoid firestore write rejection', async () => {
    authState.currentUser = { uid: 'user-6' };

    await captureError(new Error('metadata sanitize check'), {
      metadata: {
        kind: 'unit.test',
        topUndefined: undefined,
        nested: {
          maybeUndefined: undefined,
          okay: 'yes',
        },
      },
    });

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const payload = (addDocMock.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
    const metadata = payload.metadata as Record<string, unknown>;
    expect(metadata).toBeTruthy();
    expect(metadata.topUndefined).toBeNull();
    expect((metadata.nested as Record<string, unknown>).maybeUndefined).toBeNull();
    expect((metadata.nested as Record<string, unknown>).okay).toBe('yes');
  });
});
