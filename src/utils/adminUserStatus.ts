import type { UserStatus } from '../types/database.types';

const VALID_STATUSES: UserStatus[] = ['active', 'inactive', 'suspended', 'pending_verification'];

export const normalizeUserStatus = (status?: string | null): UserStatus => {
  const normalized = String(status || '').trim().toLowerCase();
  if (VALID_STATUSES.includes(normalized as UserStatus)) {
    return normalized as UserStatus;
  }
  return 'active';
};

