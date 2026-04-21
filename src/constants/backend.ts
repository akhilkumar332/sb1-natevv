export const SERVERLESS_ROUTE_PREFIX = '/functions';

export const SERVERLESS_ENDPOINTS = {
  contactSubmit: `${SERVERLESS_ROUTE_PREFIX}/contact-submit`,
  errorLog: `${SERVERLESS_ROUTE_PREFIX}/error-log`,
  fcmBridge: `${SERVERLESS_ROUTE_PREFIX}/fcm-bridge`,
  frontendAccess: `${SERVERLESS_ROUTE_PREFIX}/frontend-access`,
  impersonate: `${SERVERLESS_ROUTE_PREFIX}/impersonate`,
  impersonationResume: `${SERVERLESS_ROUTE_PREFIX}/impersonation-resume`,
  adminUserBiometrics: `${SERVERLESS_ROUTE_PREFIX}/admin-user-biometrics`,
  webauthnRegisterChallenge: `${SERVERLESS_ROUTE_PREFIX}/webauthn-register-challenge`,
  webauthnRegisterVerify: `${SERVERLESS_ROUTE_PREFIX}/webauthn-register-verify`,
  webauthnAuthChallenge: `${SERVERLESS_ROUTE_PREFIX}/webauthn-auth-challenge`,
  webauthnAuthVerify: `${SERVERLESS_ROUTE_PREFIX}/webauthn-auth-verify`,
} as const;

export const FIREBASE_FUNCTION_EXPORTS = {
  api: 'api',
  contactSubmit: 'contactSubmit',
  errorLog: 'errorLog',
  errorLogRetentionJob: 'errorLogRetentionJob',
  fcmBridge: 'fcmBridge',
  frontendAccess: 'frontendAccess',
  impersonate: 'impersonate',
  impersonationResume: 'impersonationResume',
  adminUserBiometrics: 'adminUserBiometrics',
  webauthnRegisterChallenge: 'webauthnRegisterChallenge',
  webauthnRegisterVerify: 'webauthnRegisterVerify',
  webauthnAuthChallenge: 'webauthnAuthChallenge',
  webauthnAuthVerify: 'webauthnAuthVerify',
} as const;
