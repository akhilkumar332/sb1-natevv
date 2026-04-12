import { beforeEach, describe, expect, it, vi } from 'vitest';

const startAuthenticationMock = vi.fn();

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(),
  startAuthentication: startAuthenticationMock,
  browserSupportsWebAuthn: vi.fn(() => true),
  browserSupportsWebAuthnAutofill: vi.fn(() => Promise.resolve(true)),
  platformAuthenticatorIsAvailable: vi.fn(() => Promise.resolve(true)),
}));

describe('webauthn.service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    startAuthenticationMock.mockResolvedValue({ id: 'cred-1' });
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
});
