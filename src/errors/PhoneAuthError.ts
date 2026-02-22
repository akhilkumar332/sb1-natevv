export type PhoneAuthErrorCode =
  | 'not_registered'
  | 'multiple_accounts'
  | 'role_mismatch'
  | 'link_required'
  | 'superadmin_google_only';

export class PhoneAuthError extends Error {
  code: PhoneAuthErrorCode;

  constructor(message: string, code: PhoneAuthErrorCode) {
    super(message);
    this.code = code;
    this.name = 'PhoneAuthError';
  }
}
