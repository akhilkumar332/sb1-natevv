import { notify } from 'services/notify.service';

export const requireValue = (
  condition: boolean,
  message: string,
  options?: { id?: string }
) => {
  if (condition) return true;
  notify.error(message, options);
  return false;
};

export const notifyAuthFailure = (message: string, options?: { id?: string }) => {
  notify.error(message, options);
};

export const donorRequestMessages = {
  selfRequest: 'You cannot request yourself.',
} as const;

export const authValidationMessages = {
  keepOneLoginMethod: 'At least one login method must remain linked.',
  mobileAlreadyRegistered: 'Mobile Number already registered',
} as const;

export const notifySelfRequestBlocked = (options?: { id?: string }) => {
  notify.error(donorRequestMessages.selfRequest, options);
};

export const notifyKeepOneLoginMethod = () => {
  notify.error(authValidationMessages.keepOneLoginMethod);
};

export const notifyMobileAlreadyRegistered = () => {
  notify.error(authValidationMessages.mobileAlreadyRegistered);
};
