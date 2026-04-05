import { notify } from 'services/notify.service';
import { authMessages } from '../constants/messages';
import { authFlowMessages } from './authInputValidation';

type AppRole = 'donor' | 'ngo' | 'bloodbank' | 'admin';

const roleMismatchByRole: Record<AppRole, { message: string; id: string }> = {
  donor: { message: authMessages.roleMismatch.donor, id: 'role-mismatch-donor' },
  ngo: { message: authMessages.roleMismatch.ngo, id: 'role-mismatch-ngo' },
  bloodbank: { message: authMessages.roleMismatch.bloodbank, id: 'role-mismatch-bloodbank' },
  admin: { message: authMessages.roleMismatch.admin, id: 'role-mismatch-admin' },
};

export const notifyRoleMismatch = (role: AppRole) => {
  const config = roleMismatchByRole[role];
  notify.error(config.message, { id: config.id });
};

export const notifyGoogleSignInFailure = (error?: unknown) => {
  const rawMessage = error instanceof Error ? error.message.trim() : '';
  const message = rawMessage && !rawMessage.startsWith('Firebase: Error')
    ? rawMessage
    : authFlowMessages.googleSignInFailed;
  notify.error(message);
};
