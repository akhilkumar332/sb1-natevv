import { describe, expect, it } from 'vitest';
import { FIREBASE_FUNCTION_EXPORTS, SERVERLESS_ENDPOINTS, SERVERLESS_ROUTE_PREFIX } from '../backend';

describe('backend constants', () => {
  it('keeps serverless endpoints under the Firebase functions public prefix', () => {
    expect(SERVERLESS_ROUTE_PREFIX).toBe('/functions');
    Object.values(SERVERLESS_ENDPOINTS).forEach((value) => {
      expect(value.startsWith(SERVERLESS_ROUTE_PREFIX)).toBe(true);
    });
  });

  it('defines Firebase function export names for migrated endpoints', () => {
    expect(FIREBASE_FUNCTION_EXPORTS.contactSubmit).toBe('contactSubmit');
    expect(FIREBASE_FUNCTION_EXPORTS.frontendAccess).toBe('frontendAccess');
    expect(FIREBASE_FUNCTION_EXPORTS.webauthnAuthVerify).toBe('webauthnAuthVerify');
    expect(FIREBASE_FUNCTION_EXPORTS.errorLogRetentionJob).toBe('errorLogRetentionJob');
  });
});
