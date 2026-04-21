import { createRequire } from 'module';
import { handler as adminUserBiometricsHandler } from './http-handlers/admin-user-biometrics.mjs';
import { handler as frontendAccessHandler } from './http-handlers/frontend-access.mjs';
import { handler as webauthnAuthChallengeHandler } from './http-handlers/webauthn-auth-challenge.mjs';
import { handler as webauthnAuthVerifyHandler } from './http-handlers/webauthn-auth-verify.mjs';
import { handler as webauthnRegisterChallengeHandler } from './http-handlers/webauthn-register-challenge.mjs';
import { handler as webauthnRegisterVerifyHandler } from './http-handlers/webauthn-register-verify.mjs';

const require = createRequire(import.meta.url);

const { handler: contactSubmitHandler } = require('./http-handlers/contact-submit.cjs');
const { handler: errorLogHandler } = require('./http-handlers/error-log.cjs');
const { handler: errorLogRetentionHandler } = require('./http-handlers/error-log-retention.cjs');
const { handler: fcmBridgeHandler } = require('./http-handlers/fcm-bridge.cjs');
const { handler: impersonateHandler } = require('./http-handlers/impersonate.cjs');
const { handler: impersonationResumeHandler } = require('./http-handlers/impersonation-resume.cjs');

const getRawBody = (req) => {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (req.rawBody && typeof req.rawBody.toString === 'function') {
    return req.rawBody.toString('utf8');
  }
  if (typeof req.body === 'string') return req.body;
  if (req.body == null) return '';
  try {
    return JSON.stringify(req.body);
  } catch {
    return '';
  }
};

const normalizeHeaders = (headers = {}) => {
  const normalized = {};
  Object.entries(headers).forEach(([key, value]) => {
    normalized[key] = Array.isArray(value) ? value.join(', ') : value;
  });
  return normalized;
};

const toFunctionEvent = (req) => ({
  httpMethod: req.method,
  headers: normalizeHeaders(req.headers || {}),
  body: getRawBody(req),
  rawUrl: req.originalUrl || req.url || req.path || '',
  path: req.path || '',
  queryStringParameters: req.query || {},
  isBase64Encoded: false,
});

const applyFunctionResponse = (res, response) => {
  const statusCode = Number(response?.statusCode) || 200;
  const headers = response?.headers && typeof response.headers === 'object'
    ? response.headers
    : {};

  Object.entries(headers).forEach(([key, value]) => {
    if (value == null) return;
    res.setHeader(key, value);
  });

  if (statusCode === 204) {
    res.status(204).send('');
    return;
  }

  const body = response?.body;
  if (typeof body === 'undefined') {
    res.status(statusCode).send('');
    return;
  }

  res.status(statusCode).send(body);
};

export const wrapFunctionHandler = (handler) => async (req, res) => {
  const response = await handler(toFunctionEvent(req));
  applyFunctionResponse(res, response);
};

export const runScheduledFunctionHandler = async (handler) => {
  const response = await handler();
  if (response && Number(response.statusCode) >= 400) {
    const error = new Error(response?.body || 'Scheduled handler failed.');
    error.statusCode = response.statusCode;
    throw error;
  }
  return null;
};

export const functionHandlers = {
  contactSubmit: contactSubmitHandler,
  errorLog: errorLogHandler,
  errorLogRetention: errorLogRetentionHandler,
  fcmBridge: fcmBridgeHandler,
  frontendAccess: frontendAccessHandler,
  impersonate: impersonateHandler,
  impersonationResume: impersonationResumeHandler,
  adminUserBiometrics: adminUserBiometricsHandler,
  webauthnRegisterChallenge: webauthnRegisterChallengeHandler,
  webauthnRegisterVerify: webauthnRegisterVerifyHandler,
  webauthnAuthChallenge: webauthnAuthChallengeHandler,
  webauthnAuthVerify: webauthnAuthVerifyHandler,
};
