import { describe, expect, it, vi } from 'vitest';
import { resolveOnboardingSubmitErrorMessage } from '../onboardingFeedback';

describe('resolveOnboardingSubmitErrorMessage', () => {
  it('returns offline message when browser is offline', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);

    expect(resolveOnboardingSubmitErrorMessage(new Error('Missing or insufficient permissions.'), 'donor'))
      .toBe('Internet connection lost while saving your profile. Please reconnect and try again.');
  });

  it('returns donor permission guidance for real permission errors', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);

    expect(resolveOnboardingSubmitErrorMessage(new Error('Missing or insufficient permissions.'), 'donor'))
      .toBe('Permission denied while saving your donor profile. If this persists after reconnecting, the failing Firestore rule still needs adjustment.');
  });

  it('returns offline message for transport failures', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);

    expect(resolveOnboardingSubmitErrorMessage(new Error('client is offline'), 'donor'))
      .toBe('Internet connection lost while saving your profile. Please reconnect and try again.');
  });
});
