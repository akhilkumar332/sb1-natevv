import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  cmsSettings: null as Record<string, unknown> | null,
  logFunctionErrorMock: vi.fn(),
}));

const buildFirestore = () => ({
  collection(collectionName: string) {
    if (collectionName !== 'cmsSettings') {
      throw new Error(`Unsupported collection: ${collectionName}`);
    }
    return {
      doc(id: string) {
        return {
          async get() {
            if (id !== 'global' || !state.cmsSettings) {
              return {
                exists: false,
                data: () => null,
              };
            }
            return {
              exists: true,
              data: () => state.cmsSettings,
            };
          },
        };
      },
    };
  },
});

vi.mock('firebase-admin', () => {
  const firestore = buildFirestore();
  const adminMock = {
    apps: [],
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn((value) => value),
    },
    firestore: Object.assign(
      () => firestore,
      {
        FieldValue: {
          serverTimestamp: () => 'server-timestamp',
        },
      },
    ),
  };
  return {
    ...adminMock,
    default: adminMock,
  };
});

vi.mock('../http-handlers/error-log.cjs', () => ({
  logFunctionError: (...args: unknown[]) => state.logFunctionErrorMock(...args),
}));

const loadFrontendAccessHandler = async () => (
  await import('../http-handlers/' + 'frontend-access.mjs')
).handler as (event: any) => Promise<any>;

describe('frontend-access Firebase handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.cmsSettings = null;
    process.env.FRONTEND_GATE_PASSWORD = 'open-sesame';
    process.env.FRONTEND_GATE_SESSION_SECRET = 'very-secret-signing-key';
    process.env.FRONTEND_GATE_MAX_ATTEMPTS_PER_MINUTE = '2';
  });

  it('returns open mode when cms settings are missing', async () => {
    const handler = await loadFrontendAccessHandler();
    const response = await handler({
      httpMethod: 'GET',
      headers: {},
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: true,
      mode: 'open',
      unlocked: true,
    });
  });

  it('rejects unlock attempts when password protection is disabled', async () => {
    state.cmsSettings = {
      frontendAccess: {
        mode: 'open',
      },
    };

    const handler = await loadFrontendAccessHandler();
    const response = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ password: 'open-sesame' }),
    });

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toEqual({ error: 'Password protection is not enabled.' });
  });

  it('sets a signed cookie after a correct password submission', async () => {
    state.cmsSettings = {
      frontendAccess: {
        mode: 'password_protected',
        passwordSessionTtlMinutes: 60,
      },
    };

    const handler = await loadFrontendAccessHandler();
    const response = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ password: 'open-sesame' }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: true,
      unlocked: true,
      configured: true,
      ttlMinutes: 60,
    });
    expect(response.headers['Set-Cookie']).toContain('__session=');
    expect(response.headers['Set-Cookie']).toContain('HttpOnly');
    expect(response.headers['Set-Cookie']).not.toContain('Secure');
  });

  it('reports unlocked status when a valid cookie is presented', async () => {
    state.cmsSettings = {
      frontendAccess: {
        mode: 'password_protected',
        passwordSessionTtlMinutes: 60,
      },
    };

    const handler = await loadFrontendAccessHandler();
    const unlockResponse = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ password: 'open-sesame' }),
    });

    const response = await handler({
      httpMethod: 'GET',
      headers: {
        cookie: unlockResponse.headers['Set-Cookie'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: true,
      mode: 'password_protected',
      unlocked: true,
      configured: true,
    });
  });

  it('returns misconfigured status when the server secret is missing', async () => {
    state.cmsSettings = {
      frontendAccess: {
        mode: 'password_protected',
      },
    };
    delete process.env.FRONTEND_GATE_PASSWORD;

    const handler = await loadFrontendAccessHandler();
    const response = await handler({
      httpMethod: 'GET',
      headers: {},
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: true,
      mode: 'password_protected',
      unlocked: false,
      configured: false,
    });
  });

  it('rate limits repeated incorrect password attempts', async () => {
    state.cmsSettings = {
      frontendAccess: {
        mode: 'password_protected',
      },
    };

    const handler = await loadFrontendAccessHandler();
    const headers = {
      'x-forwarded-for': '1.2.3.4',
    };

    const first = await handler({
      httpMethod: 'POST',
      headers,
      body: JSON.stringify({ password: 'wrong-1' }),
    });
    const second = await handler({
      httpMethod: 'POST',
      headers,
      body: JSON.stringify({ password: 'wrong-2' }),
    });
    const third = await handler({
      httpMethod: 'POST',
      headers,
      body: JSON.stringify({ password: 'wrong-3' }),
    });

    expect(first.statusCode).toBe(401);
    expect(second.statusCode).toBe(401);
    expect(third.statusCode).toBe(429);
  });
});
