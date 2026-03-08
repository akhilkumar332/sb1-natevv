import { COLLECTIONS } from './firestore';
import { OFFLINE_MUTATION_TYPES, type OfflineMutationType } from './offline';

type QueuePolicyResult = {
  allowed: boolean;
  code?: 'direct_write_only' | 'blocked';
  message?: string;
};

const DIRECT_WRITE_ONLY_COLLECTIONS = new Set<string>([
  COLLECTIONS.AUDIT_LOGS,
  COLLECTIONS.BLOOD_INVENTORY,
  COLLECTIONS.INVENTORY_TRANSFERS,
  COLLECTIONS.INVENTORY_RESERVATIONS,
]);

const BLOCKED_COLLECTIONS = new Set<string>([
  COLLECTIONS.AUDIT_LOGS,
]);

const MAX_PATCH_PAYLOAD_BYTES = 24 * 1024;
const MAX_PATCH_FIELD_COUNT = 80;

export const estimateSerializedBytes = (value: unknown): number => {
  try {
    return JSON.stringify(value).length * 2;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

export const validateQueueableMutation = (
  type: OfflineMutationType,
  payload: unknown,
): QueuePolicyResult => {
  const queueSafeSet = new Set<string>(Object.values(OFFLINE_MUTATION_TYPES));
  if (!queueSafeSet.has(type)) {
    return {
      allowed: false,
      code: 'blocked',
      message: `Unsupported offline mutation type: ${type}`,
    };
  }

  if (type !== OFFLINE_MUTATION_TYPES.firestoreDocPatch) {
    return { allowed: true };
  }

  const patchPayload = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : null;
  const collection = typeof patchPayload?.collection === 'string' ? patchPayload.collection : '';
  const patch = (patchPayload?.patch && typeof patchPayload.patch === 'object')
    ? patchPayload.patch as Record<string, unknown>
    : {};
  const deleteFields = Array.isArray(patchPayload?.deleteFields) ? patchPayload?.deleteFields : [];
  const serverTimestampFields = Array.isArray(patchPayload?.serverTimestampFields) ? patchPayload?.serverTimestampFields : [];
  const fieldCount = Object.keys(patch).length + deleteFields.length + serverTimestampFields.length;

  if (!collection) {
    return {
      allowed: false,
      code: 'blocked',
      message: 'Offline doc patch is missing collection.',
    };
  }
  if (BLOCKED_COLLECTIONS.has(collection)) {
    return {
      allowed: false,
      code: 'blocked',
      message: `Offline patch is blocked for collection "${collection}".`,
    };
  }
  if (DIRECT_WRITE_ONLY_COLLECTIONS.has(collection)) {
    return {
      allowed: false,
      code: 'direct_write_only',
      message: `Collection "${collection}" is direct-write only.`,
    };
  }
  if (fieldCount > MAX_PATCH_FIELD_COUNT) {
    return {
      allowed: false,
      code: 'blocked',
      message: `Offline patch exceeds field count limit (${fieldCount}/${MAX_PATCH_FIELD_COUNT}).`,
    };
  }
  const payloadBytes = estimateSerializedBytes({
    patch,
    deleteFields,
    serverTimestampFields,
  });
  if (payloadBytes > MAX_PATCH_PAYLOAD_BYTES) {
    return {
      allowed: false,
      code: 'blocked',
      message: `Offline patch payload too large (${payloadBytes} bytes).`,
    };
  }

  return { allowed: true };
};
