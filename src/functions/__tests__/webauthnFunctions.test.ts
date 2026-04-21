import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyAuthenticationResponseMock = vi.fn();
const verifyRegistrationResponseMock = vi.fn();

const state = vi.hoisted(() => ({
  users: new Map<string, Record<string, unknown>>(),
  userCredentials: new Map<string, Map<string, Record<string, unknown>>>(),
  challenges: new Map<string, Record<string, unknown>>(),
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

const buildFirestore = () => {
  const topLevelDoc = (collectionName: string, id: string) => ({
    async get() {
      if (collectionName === 'users') {
        const data = state.users.get(id) || null;
        return makeDocSnapshot(Boolean(data), data, this);
      }
      if (collectionName === 'webauthnChallenges') {
        const data = state.challenges.get(id) || null;
        return makeDocSnapshot(Boolean(data), data, this);
      }
      return makeDocSnapshot(false, null, this);
    },
    async set(data: Record<string, unknown>) {
      if (collectionName === 'webauthnChallenges') {
        state.challenges.set(id, data);
      } else if (collectionName === 'users') {
        state.users.set(id, data);
      }
    },
    async delete() {
      if (collectionName === 'webauthnChallenges') {
        state.challenges.delete(id);
      }
    },
    collection(_subcollectionName: string) {
      if (collectionName !== 'users') {
        throw new Error(`Unsupported nested collection for ${collectionName}`);
      }
      const userId = id;
      return {
        async get() {
          const credentials = Array.from(state.userCredentials.get(userId)?.values() || []);
          return makeCollectionSnapshot(credentials.map((entry) => ({
            data: () => entry,
          })));
        },
        doc(docId: string) {
          return {
            async get() {
              const data = state.userCredentials.get(userId)?.get(docId) || null;
              return makeDocSnapshot(Boolean(data), data, this);
            },
            async set(data: Record<string, unknown>) {
              const credentials = state.userCredentials.get(userId) || new Map();
              credentials.set(docId, data);
              state.userCredentials.set(userId, credentials);
            },
            async update(data: Record<string, unknown>) {
              const credentials = state.userCredentials.get(userId) || new Map();
              credentials.set(docId, {
                ...(credentials.get(docId) || {}),
                ...data,
              });
              state.userCredentials.set(userId, credentials);
            },
            async delete() {
              state.userCredentials.get(userId)?.delete(docId);
            },
            get ref() {
              return this;
            },
          };
        },
      };
    },
    get ref() {
      return this;
    },
  });

  return {
    collection(collectionName: string) {
      return {
        doc(id: string) {
          return topLevelDoc(collectionName, id);
        },
      };
    },
    collectionGroup(collectionName: string) {
      if (collectionName !== 'webauthnCredentials') {
        throw new Error(`Unsupported collectionGroup ${collectionName}`);
      }
      return {
        where(_field: string, _operator: string, value: string) {
          const matches: any[] = [];
          for (const [userId, credentials] of state.userCredentials.entries()) {
            for (const [credentialId, data] of credentials.entries()) {
              if (credentialId === value) {
                matches.push({
                  data: () => data,
                  ref: {
                    parent: {
                      parent: {
                        id: userId,
                      },
                    },
                  },
                });
              }
            }
          }
          return {
            limit(count: number) {
              return {
                async get() {
                  return makeCollectionSnapshot(matches.slice(0, count));
                },
              };
            },
          };
        },
      };
    },
  };
};

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
        createCustomToken: vi.fn(async (uid: string) => `token-${uid}`),
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

vi.mock('@simplewebauthn/server', () => ({
  generateAuthenticationOptions: vi.fn(async () => ({ challenge: 'challenge-value' })),
  generateRegistrationOptions: vi.fn(async () => ({ challenge: 'registration-value' })),
  verifyAuthenticationResponse: verifyAuthenticationResponseMock,
  verifyRegistrationResponse: verifyRegistrationResponseMock,
}));

const loadAuthChallengeHandler = async () => (
  await import('../http-handlers/' + 'webauthn-auth-challenge.mjs')
).handler as (event: any) => Promise<any>;

const loadRegisterChallengeHandler = async () => (
  await import('../http-handlers/' + 'webauthn-register-challenge.mjs')
).handler as (event: any) => Promise<any>;

const loadAuthVerifyHandler = async () => (
  await import('../http-handlers/' + 'webauthn-auth-verify.mjs')
).handler as (event: any) => Promise<any>;

const loadRegisterVerifyHandler = async () => (
  await import('../http-handlers/' + 'webauthn-register-verify.mjs')
).handler as (event: any) => Promise<any>;

describe('WebAuthn Firebase handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.users.clear();
    state.userCredentials.clear();
    state.challenges.clear();
    state.verifyIdTokenMock.mockResolvedValue({ uid: 'donor-1' });
    verifyAuthenticationResponseMock.mockReset();
    verifyRegistrationResponseMock.mockReset();
  });

  it('initializes using the default Firebase admin app without manual credentials', async () => {
    const handler = await loadAuthChallengeHandler();

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({}),
    });

    expect(response.statusCode).toBe(200);
  });

  it('creates unique auth challenge IDs for parallel attempts instead of overwriting a shared doc', async () => {
    const randomUuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID');
    randomUuidSpy
      .mockReturnValueOnce('11111111-1111-1111-1111-111111111111')
      .mockReturnValueOnce('22222222-2222-2222-2222-222222222222');

    state.users.set('donor-1', { uid: 'donor-1' });
    state.userCredentials.set('donor-1', new Map([
      ['cred-1', { credentialId: 'cred-1', transports: ['internal'] }],
    ]));

    const handler = await loadAuthChallengeHandler();

    const first = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ userId: 'donor-1', credentialId: 'cred-1' }),
    });
    const second = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ userId: 'donor-1', credentialId: 'cred-1' }),
    });

    expect(JSON.parse(first.body).challengeId).toBe('11111111-1111-1111-1111-111111111111');
    expect(JSON.parse(second.body).challengeId).toBe('22222222-2222-2222-2222-222222222222');
    expect(state.challenges.size).toBe(2);
  });

  it('uses the hinted user path for known-user auth challenges without needing collection-group lookup', async () => {
    state.users.set('donor-1', { uid: 'donor-1' });
    state.userCredentials.set('donor-1', new Map([
      ['cred-1', { credentialId: 'cred-1', transports: ['internal'] }],
    ]));

    const handler = await loadAuthChallengeHandler();

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ userId: 'donor-1', credentialId: 'cred-1' }),
    });

    expect(response.statusCode).toBe(200);
    expect(Array.from(state.challenges.values())[0]).toMatchObject({
      userId: 'donor-1',
      credentialId: 'cred-1',
    });
  });

  it('does not bind an unauthenticated auth challenge to a caller-supplied userId without a known credential hint', async () => {
    const randomUuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID');
    randomUuidSpy.mockReturnValueOnce('33333333-3333-3333-3333-333333333333');

    state.users.set('donor-1', { uid: 'donor-1' });
    state.userCredentials.set('donor-1', new Map([
      ['cred-1', { credentialId: 'cred-1', transports: ['internal'] }],
    ]));

    const handler = await loadAuthChallengeHandler();

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ userId: 'donor-1' }),
    });

    expect(response.statusCode).toBe(200);
    expect(state.challenges.get('33333333-3333-3333-3333-333333333333')).toMatchObject({
      userId: null,
      credentialId: null,
    });
  });

  it('creates registration challenges for authenticated users', async () => {
    state.users.set('donor-1', { uid: 'donor-1', displayName: 'Donor One' });

    const handler = await loadRegisterChallengeHandler();
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token-1' },
      body: JSON.stringify({ userId: 'donor-1' }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      challengeId: expect.any(String),
      options: expect.objectContaining({
        challenge: 'registration-value',
      }),
    });
  });

  it('rejects registration challenges for users that do not exist', async () => {
    const handler = await loadRegisterChallengeHandler();
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token-1' },
      body: JSON.stringify({ userId: 'donor-1' }),
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'User not found' });
  });

  it('verifies authentication responses and returns a custom token', async () => {
    const webauthnServer = await import('@simplewebauthn/server');
    vi.mocked(webauthnServer.verifyAuthenticationResponse).mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 42 },
    } as never);

    state.users.set('donor-1', { uid: 'donor-1' });
    state.userCredentials.set('donor-1', new Map([
      ['cred-1', {
        credentialId: 'cred-1',
        publicKey: Buffer.from(new Uint8Array([1, 2, 3])).toString('base64url'),
        transports: ['internal'],
        counter: 1,
      }],
    ]));

    const handler = await loadAuthVerifyHandler();
    const challengeId = 'challenge-verify-auth';
    state.challenges.set(challengeId, {
      type: 'authentication',
      challenge: 'challenge-value',
      rpId: 'bloodhub.in',
      origin: 'https://bloodhub.in',
      userId: 'donor-1',
      credentialId: 'cred-1',
      expiresAt: Date.now() + 5_000,
    });

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        challengeId,
        credential: { id: 'cred-1', rawId: 'cred-1' },
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      userId: 'donor-1',
      customToken: 'token-donor-1',
    });
  });

  it('returns a client error for mismatched challenge state during auth verification', async () => {
    const webauthnServer = await import('@simplewebauthn/server');
    vi.mocked(webauthnServer.verifyAuthenticationResponse).mockRejectedValue(new Error('Challenge mismatch'));
    state.userCredentials.set('donor-1', new Map([
      ['cred-1', {
        credentialId: 'cred-1',
        publicKey: Buffer.from(new Uint8Array([1, 2, 3])).toString('base64url'),
        transports: ['internal'],
        counter: 1,
      }],
    ]));

    const handler = await loadAuthVerifyHandler();
    state.challenges.set('challenge-mismatch', {
      type: 'authentication',
      challenge: 'challenge-value',
      rpId: 'bloodhub.in',
      origin: 'https://bloodhub.in',
      userId: 'donor-1',
      credentialId: 'cred-1',
      expiresAt: Date.now() + 5_000,
    });

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        challengeId: 'challenge-mismatch',
        credential: { id: 'cred-1', rawId: 'cred-1' },
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Authentication failed' });
  });

  it('returns not found when auth verification challenge IDs are stale', async () => {
    const handler = await loadAuthVerifyHandler();
    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        challengeId: 'missing-challenge',
        credential: { id: 'cred-1', rawId: 'cred-1' },
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'No pending challenge' });
  });

  it('returns a client error when auth verification has no stored credential', async () => {
    const handler = await loadAuthVerifyHandler();
    state.challenges.set('challenge-missing-cred', {
      type: 'authentication',
      challenge: 'challenge-value',
      rpId: 'bloodhub.in',
      origin: 'https://bloodhub.in',
      credentialId: 'cred-1',
      expiresAt: Date.now() + 5_000,
    });

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        challengeId: 'challenge-missing-cred',
        credential: { id: 'cred-1', rawId: 'cred-1' },
      }),
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'Credential not found' });
  });

  it('verifies registration responses and stores the credential', async () => {
    const webauthnServer = await import('@simplewebauthn/server');
    vi.mocked(webauthnServer.verifyRegistrationResponse).mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'cred-registered',
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 9,
          transports: ['internal'],
        },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
      },
    } as never);

    const handler = await loadRegisterVerifyHandler();
    state.users.set('donor-1', { uid: 'donor-1' });
    state.challenges.set('register-verify', {
      type: 'registration',
      challenge: 'registration-value',
      rpId: 'bloodhub.in',
      origin: 'https://bloodhub.in',
      userId: 'donor-1',
      expiresAt: Date.now() + 5_000,
    });

    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer token-1', 'user-agent': 'Mozilla/5.0' },
      body: JSON.stringify({
        userId: 'donor-1',
        challengeId: 'register-verify',
        credential: {
          id: 'cred-registered',
          rawId: 'cred-registered',
          response: {
            transports: ['internal'],
          },
        },
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ success: true, credentialId: 'cred-registered' });
    expect(state.userCredentials.get('donor-1')?.get('cred-registered')).toMatchObject({
      credentialId: 'cred-registered',
      counter: 9,
    });
  });
});
