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
    collection(subcollectionName: string) {
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

describe('WebAuthn Netlify handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.users.clear();
    state.userCredentials.clear();
    state.challenges.clear();
    state.verifyIdTokenMock.mockResolvedValue({ uid: 'donor-1' });
    verifyAuthenticationResponseMock.mockReset();
    verifyRegistrationResponseMock.mockReset();
    process.env.FIREBASE_PROJECT_ID = 'project';
    process.env.FIREBASE_CLIENT_EMAIL = 'user@example.com';
    process.env.FIREBASE_PRIVATE_KEY = 'private-key';
    delete process.env.VITE_FIREBASE_PROJECT_ID;
    delete process.env.VITE_FIREBASE_CLIENT_EMAIL;
    delete process.env.VITE_FIREBASE_PRIVATE_KEY;
  });

  it('accepts VITE-prefixed admin credentials when FIREBASE-prefixed vars are absent', async () => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    process.env.VITE_FIREBASE_PROJECT_ID = 'project';
    process.env.VITE_FIREBASE_CLIENT_EMAIL = 'user@example.com';
    process.env.VITE_FIREBASE_PRIVATE_KEY = 'private-key';

    const { handler } = await import('../webauthn-auth-challenge.mjs');

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({}),
    });

    expect(response.statusCode).toBe(200);
  });

  it('creates unique auth challenge IDs for parallel attempts instead of overwriting a shared doc', async () => {
    const randomUuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID');
    randomUuidSpy
      .mockReturnValueOnce('challenge-a')
      .mockReturnValueOnce('challenge-b');

    state.users.set('donor-1', { uid: 'donor-1' });
    state.userCredentials.set('donor-1', new Map([
      ['cred-1', { credentialId: 'cred-1', transports: ['internal'] }],
    ]));

    const { handler } = await import('../webauthn-auth-challenge.mjs');

    const first = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ userId: 'donor-1', credentialId: 'cred-1' }),
    });
    const second = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ userId: 'donor-1', credentialId: 'cred-1' }),
    });

    expect(JSON.parse(first.body).challengeId).toBe('challenge-a');
    expect(JSON.parse(second.body).challengeId).toBe('challenge-b');
    expect(state.challenges.size).toBe(2);
  });

  it('uses the hinted user path for known-user auth challenges without needing collection-group lookup', async () => {
    state.users.set('donor-1', { uid: 'donor-1' });
    state.userCredentials.set('donor-1', new Map([
      ['cred-1', { credentialId: 'cred-1', transports: ['internal'] }],
    ]));

    const { handler } = await import('../webauthn-auth-challenge.mjs');

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
    randomUuidSpy.mockReturnValueOnce('challenge-usernameless');

    state.users.set('donor-1', { uid: 'donor-1' });
    state.userCredentials.set('donor-1', new Map([
      ['cred-1', { credentialId: 'cred-1', transports: ['internal'] }],
    ]));

    const { handler } = await import('../webauthn-auth-challenge.mjs');

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ userId: 'donor-1' }),
    });

    expect(response.statusCode).toBe(200);
    expect(state.challenges.get('challenge-usernameless')).toMatchObject({
      userId: null,
      credentialId: null,
    });
  });

  it('rejects registration challenge requests without an auth token', async () => {
    const { handler } = await import('../webauthn-register-challenge.mjs');

    const response = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ userId: 'donor-1' }),
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ error: 'Missing auth token' });
  });

  it('returns a 400 when auth verification is attempted with a missing challenge', async () => {
    const { handler } = await import('../webauthn-auth-verify.mjs');

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        challengeId: 'missing',
        credential: { id: 'cred-1' },
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'No pending challenge' });
  });

  it('consumes an auth challenge after a failed verification attempt', async () => {
    state.challenges.set('challenge-auth-fail', {
      type: 'authentication',
      userId: 'donor-1',
      challenge: 'challenge-value',
      rpId: 'bloodhub.in',
      origin: 'https://bloodhub.in',
      expiresAt: Date.now() + 60_000,
    });
    state.userCredentials.set('donor-1', new Map([
      ['cred-1', {
        credentialId: 'cred-1',
        publicKey: Buffer.from('public-key').toString('base64url'),
        counter: 1,
        transports: ['internal'],
      }],
    ]));
    verifyAuthenticationResponseMock.mockResolvedValueOnce({ verified: false });

    const { handler } = await import('../webauthn-auth-verify.mjs');

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        challengeId: 'challenge-auth-fail',
        credential: { id: 'cred-1' },
      }),
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ error: 'Authentication failed' });
    expect(state.challenges.has('challenge-auth-fail')).toBe(false);
  });

  it('returns a 400 instead of 500 when auth verification throws a WebAuthn validation error', async () => {
    state.challenges.set('challenge-1', {
      type: 'authentication',
      userId: 'donor-1',
      challenge: 'challenge-value',
      rpId: 'bloodhub.in',
      origin: 'https://bloodhub.in',
      expiresAt: Date.now() + 60_000,
    });
    state.userCredentials.set('donor-1', new Map([
      ['cred-1', {
        credentialId: 'cred-1',
        publicKey: Buffer.from('public-key').toString('base64url'),
        counter: 1,
        transports: ['internal'],
      }],
    ]));
    verifyAuthenticationResponseMock.mockRejectedValueOnce(new Error('Unexpected authentication response origin "https://evil.example"'));

    const { handler } = await import('../webauthn-auth-verify.mjs');

    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        challengeId: 'challenge-1',
        credential: { id: 'cred-1' },
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Authentication failed' });
    expect(state.challenges.has('challenge-1')).toBe(false);
  });

  it('consumes a registration challenge after a failed verification attempt', async () => {
    state.challenges.set('challenge-register-fail', {
      type: 'registration',
      userId: 'donor-1',
      challenge: 'registration-value',
      rpId: 'bloodhub.in',
      origin: 'https://bloodhub.in',
      expiresAt: Date.now() + 60_000,
    });
    verifyRegistrationResponseMock.mockResolvedValueOnce({
      verified: false,
      registrationInfo: null,
    });

    const { handler } = await import('../webauthn-register-verify.mjs');

    const response = await handler({
      httpMethod: 'POST',
      headers: {
        authorization: 'Bearer token-1',
        'user-agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        userId: 'donor-1',
        challengeId: 'challenge-register-fail',
        credential: { id: 'cred-1', response: {} },
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Verification failed' });
    expect(state.challenges.has('challenge-register-fail')).toBe(false);
  });
});
