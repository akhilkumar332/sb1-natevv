import { describe, expect, it } from 'vitest';
import { matchUserToUid } from '../AuthContext';

describe('AuthContext helpers', () => {
  it('returns null for a user object that does not match the expected uid', () => {
    expect(matchUserToUid({
      uid: 'user-a',
      email: 'a@example.com',
      displayName: 'User A',
    }, 'user-b')).toBeNull();
  });

  it('returns the candidate when the uid matches', () => {
    const candidate = {
      uid: 'user-a',
      email: 'a@example.com',
      displayName: 'User A',
    };

    expect(matchUserToUid(candidate, 'user-a')).toBe(candidate);
  });
});
