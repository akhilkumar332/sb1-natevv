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
