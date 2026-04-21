import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  users: new Map<string, Record<string, unknown>>(),
  userCredentials: new Map<string, Map<string, Record<string, unknown>>>(),
  auditLogs: [] as Array<Record<string, unknown>>,
  verifyIdTokenMock: vi.fn(),
}));

const makeDocSnapshot = (exists: boolean, data: Record<string, unknown> | null, ref: any) => ({
  exists,
  data: () => data,
  ref,
});

const makeCollectionSnapshot = (docs: any[]) => ({
  docs,
  empty: docs.length === 0,
  size: docs.length,
});

const buildFirestore = () => ({
  collection(collectionName: string) {
    if (collectionName === 'auditLogs') {
      return {
        async add(data: Record<string, unknown>) {
          state.auditLogs.push(data);
          return { id: `audit-${state.auditLogs.length}` };
        },
      };
    }

    return {
      doc(id: string) {
        return {
          async get() {
            if (collectionName === 'users') {
              const data = state.users.get(id) || null;
              return makeDocSnapshot(Boolean(data), data, this);
            }
            return makeDocSnapshot(false, null, this);
          },
          collection(subcollectionName: string) {
            if (collectionName !== 'users' || subcollectionName !== 'webauthnCredentials') {
              throw new Error(`Unsupported nested collection ${collectionName}/${subcollectionName}`);
            }
            const userId = id;
            return {
              async get() {
                const docs = Array.from(state.userCredentials.get(userId)?.entries() || []).map(([credentialId, data]) => ({
                  id: credentialId,
                  data: () => data,
                }));
                return makeCollectionSnapshot(docs);
              },
              doc(credentialId: string) {
                return {
                  async get() {
                    const data = state.userCredentials.get(userId)?.get(credentialId) || null;
                    return makeDocSnapshot(Boolean(data), data, this);
                  },
                  async delete() {
                    state.userCredentials.get(userId)?.delete(credentialId);
                  },
                };
              },
            };
          },
        };
      },
    };
  },
});

vi.mock('firebase-admin', () => {
  const firestore = buildFirestore();
  return {
    default: {
      apps: [],
      initializeApp: vi.fn(),
      credential: {
        cert: vi.fn((value) => value),
      },
      auth: () => ({
        verifyIdToken: state.verifyIdTokenMock,
      }),
      firestore: Object.assign(
        () => firestore,
        {
          FieldValue: {
            serverTimestamp: () => 'server-timestamp',
          },
        },
      ),
    },
  };
});

const loadAdminUserBiometricsHandler = async () => (
  await import('../http-handlers/' + 'admin-user-biometrics.mjs')
).handler as (event: any) => Promise<any>;

describe('admin-user-biometrics Firebase handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.users.clear();
    state.userCredentials.clear();
    state.auditLogs.length = 0;
    state.verifyIdTokenMock.mockResolvedValue({ uid: 'admin-1' });
  });

  it('rejects non-admin callers', async () => {
    state.users.set('admin-1', { uid: 'admin-1', role: 'donor' });

    const handler = await loadAdminUserBiometricsHandler();
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token-1' },
      body: JSON.stringify({ uid: 'donor-1', action: 'list' }),
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: 'Forbidden' });
  });

  it('lists biometric credentials without exposing raw public keys', async () => {
    state.users.set('admin-1', { uid: 'admin-1', role: 'admin' });
    state.users.set('donor-1', { uid: 'donor-1', role: 'donor' });
    state.userCredentials.set('donor-1', new Map([
      ['cred-1', {
        credentialId: 'cred-1',
        publicKey: 'secret-public-key',
        deviceType: 'platform',
        backedUp: true,
        transports: ['internal'],
        counter: 7,
        createdAt: { toMillis: () => 1_710_000_000_000 },
        lastUsedAt: { toMillis: () => 1_710_100_000_000 },
        userAgent: 'Mozilla/5.0 (Macintosh)',
      }],
    ]));

    const handler = await loadAdminUserBiometricsHandler();
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token-1' },
      body: JSON.stringify({ uid: 'donor-1', action: 'list' }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      uid: 'donor-1',
      role: 'donor',
      credentials: [{
        credentialId: 'cred-1',
        deviceType: 'platform',
        backedUp: true,
        transports: ['internal'],
        counter: 7,
        createdAtMs: 1_710_000_000_000,
        lastUsedAtMs: 1_710_100_000_000,
        userAgent: 'Mozilla/5.0 (Macintosh)',
      }],
    });
  });

  it('rejects biometrics access for non-donor target users', async () => {
    state.users.set('admin-1', { uid: 'admin-1', role: 'admin' });
    state.users.set('ngo-1', { uid: 'ngo-1', role: 'ngo' });

    const handler = await loadAdminUserBiometricsHandler();
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token-1' },
      body: JSON.stringify({ uid: 'ngo-1', action: 'list' }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Biometrics are only available for donor users' });
  });

  it('removes a biometric credential and writes an audit log', async () => {
    state.users.set('admin-1', { uid: 'admin-1', role: 'superadmin' });
    state.users.set('donor-1', { uid: 'donor-1', role: 'donor' });
    state.userCredentials.set('donor-1', new Map([
      ['cred-1', {
        credentialId: 'cred-1',
        deviceType: 'platform',
        backedUp: false,
        transports: ['internal'],
      }],
    ]));

    const handler = await loadAdminUserBiometricsHandler();
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token-1' },
      body: JSON.stringify({
        uid: 'donor-1',
        action: 'remove',
        credentialId: 'cred-1',
        reason: 'Support reset',
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ success: true, removedCredentialId: 'cred-1' });
    expect(state.userCredentials.get('donor-1')?.has('cred-1')).toBe(false);
    expect(state.auditLogs).toHaveLength(1);
    expect(state.auditLogs[0]).toMatchObject({
      actorUid: 'admin-1',
      actorRole: 'superadmin',
      action: 'admin_remove_biometric_credential',
      targetUid: 'donor-1',
      metadata: expect.objectContaining({
        credentialId: 'cred-1',
        reason: 'Support reset',
      }),
    });
  });
});
