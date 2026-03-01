import { describe, expect, it, vi, beforeEach } from 'vitest';
import { submitContactForm } from '../contact.service';

describe('contact.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits successfully when API returns ok', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);

    await expect(submitContactForm({
      name: 'Test User',
      email: 'test@example.com',
      phone: '9999999999',
      subject: 'general',
      message: 'Hello support',
    })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws API message when rate limited', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many submissions. Please wait and try again.' }),
    } as Response);

    await expect(submitContactForm({
      name: 'Rate Limited User',
      email: 'rate@example.com',
      phone: '',
      subject: 'general',
      message: 'Second message',
    })).rejects.toThrow('Too many submissions. Please wait and try again.');
  });
});
