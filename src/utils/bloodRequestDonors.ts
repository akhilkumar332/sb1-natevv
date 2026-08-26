/**
 * `bloodRequests.respondedDonors` normalisation.
 *
 * The canonical stored shape is a list of donor UID strings. That is what
 * `database.types.ts` declares, what `optimisticUpdates` and `donor.service`
 * write, and -- critically -- what `firestore.rules` enforces, because
 * `isSelfAppendOnly('respondedDonors')` checks `request.auth.uid in
 * request.resource.data.respondedDonors`.
 *
 * The blood bank read paths were written against a richer object shape
 * (`{ donorId, donorName, respondedAt, status }`) that no writer ever produced.
 * Spreading a UID string through those mappers yields `{0:'a',1:'b',...}`, so
 * this helper accepts either shape and always returns the display object.
 */
export type RespondedDonor = {
  donorId: string;
  donorName: string;
  respondedAt?: Date;
  status: 'pending' | 'confirmed' | 'rejected';
};

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === 'function') {
    try {
      return maybeTimestamp.toDate();
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const isResponseStatus = (value: unknown): value is RespondedDonor['status'] =>
  value === 'pending' || value === 'confirmed' || value === 'rejected';

/**
 * Normalise one entry, which may be a bare UID string (canonical) or a legacy
 * response object. `respondedAt` is left undefined when unknown rather than
 * defaulted to "now", so the UI does not present a fabricated response time.
 */
export const normalizeRespondedDonor = (entry: unknown): RespondedDonor | null => {
  if (typeof entry === 'string') {
    const donorId = entry.trim();
    if (!donorId) return null;
    return { donorId, donorName: '', status: 'pending' };
  }

  if (!entry || typeof entry !== 'object') return null;

  const record = entry as Record<string, unknown>;
  const donorId = typeof record.donorId === 'string' ? record.donorId : '';
  if (!donorId) return null;

  return {
    donorId,
    donorName: typeof record.donorName === 'string' ? record.donorName : '',
    respondedAt: toDate(record.respondedAt),
    status: isResponseStatus(record.status) ? record.status : 'pending',
  };
};

export const normalizeRespondedDonors = (value: unknown): RespondedDonor[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeRespondedDonor)
    .filter((entry): entry is RespondedDonor => entry !== null);
};
