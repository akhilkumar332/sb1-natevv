type PortalRole = 'donor' | 'ngo' | 'bloodbank' | 'hospital' | 'admin' | 'superadmin';

const pendingPortalRoleStorageKey = 'bh_pending_portal_role';
const registrationIntentStorageKey = 'bh_registration_intent';
const pendingPortalRoleTtlMs = 4 * 60 * 60 * 1000;
const registrationIntentTtlMs = 45_000;

const parseRolePayload = (raw: string | null, ttlMs: number, storageKey: string): PortalRole | null => {
  if (typeof window === 'undefined' || !raw) return null;

  try {
    const parsed = JSON.parse(raw) as { role?: string; createdAt?: number };
    const role = parsed?.role;
    const createdAt = Number(parsed?.createdAt || 0);

    if (!role || !createdAt || Date.now() - createdAt > ttlMs) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }

    if (
      role === 'donor'
      || role === 'ngo'
      || role === 'bloodbank'
      || role === 'hospital'
      || role === 'admin'
      || role === 'superadmin'
    ) {
      return role;
    }
  } catch {
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // ignore storage errors
    }
  }

  return null;
};

const writeRolePayload = (storageKey: string, role: PortalRole) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      role,
      createdAt: Date.now(),
    }));
  } catch {
    // ignore storage errors
  }
};

const clearRolePayload = (storageKey: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // ignore storage errors
  }
};

export const markPendingPortalRole = (role: PortalRole) => {
  writeRolePayload(pendingPortalRoleStorageKey, role);
};

export const readPendingPortalRole = (): PortalRole | null =>
  parseRolePayload(
    typeof window === 'undefined' ? null : window.sessionStorage.getItem(pendingPortalRoleStorageKey),
    pendingPortalRoleTtlMs,
    pendingPortalRoleStorageKey,
  );

export const clearPendingPortalRole = () => {
  clearRolePayload(pendingPortalRoleStorageKey);
};

export const markRegistrationIntent = (role: PortalRole) => {
  writeRolePayload(registrationIntentStorageKey, role);
};

export const readRegistrationIntent = (): PortalRole | null =>
  parseRolePayload(
    typeof window === 'undefined' ? null : window.sessionStorage.getItem(registrationIntentStorageKey),
    registrationIntentTtlMs,
    registrationIntentStorageKey,
  );

export const clearRegistrationIntent = () => {
  clearRolePayload(registrationIntentStorageKey);
};
