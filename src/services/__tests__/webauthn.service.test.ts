import { beforeEach, describe, expect, it, vi } from 'vitest';

const startAuthenticationMock = vi.fn();
const getDocsMock = vi.fn();
const getDocsFromServerMock = vi.fn();
const collectionMock = vi.fn(() => 'credentials-collection');

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(),
  startAuthentication: startAuthenticationMock,
  browserSupportsWebAuthn: vi.fn(() => true),
  browserSupportsWebAuthnAutofill: vi.fn(() => Promise.resolve(true)),
  platformAuthenticatorIsAvailable: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../firebase', () => ({
  auth: {
    currentUser: null,
  },
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: collectionMock,
  getDocs: getDocsMock,
  getDocsFromServer: getDocsFromServerMock,
  doc: vi.fn(),
  deleteDoc: vi.fn(),
}));

describe('webauthn.service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    startAuthenticationMock.mockResolvedValue({ id: 'cred-1' });
    getDocsFromServerMock.mockResolvedValue({ docs: [] });
    getDocsMock.mockResolvedValue({ docs: [] });
  });

  it('fetches a fresh auth challenge after a successful conditional authentication consumes the cached one', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          challengeId: 'challenge-1',
          options: { challenge: 'challenge-1-options' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          customToken: 'token-1',
          userId: 'donor-1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          challengeId: 'challenge-2',
          options: { challenge: 'challenge-2-options' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          customToken: 'token-2',
          userId: 'donor-1',
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { authenticateWithBiometric } = await import('../webauthn.service');

    await authenticateWithBiometric(null, 'conditional');
    await authenticateWithBiometric(null, 'conditional');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/.netlify/functions/webauthn-auth-challenge',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/.netlify/functions/webauthn-auth-challenge',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(startAuthenticationMock).toHaveBeenCalledTimes(2);
  });

  it('prefers a server credential read before falling back to the default Firestore read path', async () => {
    getDocsFromServerMock.mockResolvedValue({
      docs: [{
        data: () => ({
          credentialId: 'cred-1',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15',
          deviceType: 'platform',
          backedUp: true,
        }),
      }],
    });

    const { fetchCredentials } = await import('../webauthn.service');
    const credentials = await fetchCredentials('donor-1');

    expect(collectionMock).toHaveBeenCalled();
    expect(getDocsFromServerMock).toHaveBeenCalledTimes(1);
    expect(getDocsMock).not.toHaveBeenCalled();
    expect(credentials[0]).toMatchObject({
      credentialId: 'cred-1',
      deviceType: 'platform',
      backedUp: true,
    });
  });

  it('falls back to the default Firestore read when the server-only credential read fails', async () => {
    getDocsFromServerMock.mockRejectedValue(new Error('unavailable'));
    getDocsMock.mockResolvedValue({
      docs: [{
        data: () => ({
          credentialId: 'cred-2',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
          deviceType: 'platform',
          backedUp: false,
        }),
      }],
    });

    const { fetchCredentials } = await import('../webauthn.service');
    const credentials = await fetchCredentials('donor-1');

    expect(getDocsFromServerMock).toHaveBeenCalledTimes(1);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(credentials[0]).toMatchObject({
      credentialId: 'cred-2',
      deviceType: 'platform',
      backedUp: false,
    });
  });
});
