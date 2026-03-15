import app from '../firebase';
import { COLLECTIONS } from '../constants/firestore';

type FirestorePrimitive =
  | string
  | number
  | boolean
  | null
  | Date
  | FirestorePrimitive[]
  | { [key: string]: FirestorePrimitive | undefined };

const encodeFirestoreValue = (value: FirestorePrimitive): Record<string, unknown> => {
  if (value === null) {
    return { nullValue: null };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => encodeFirestoreValue(entry)),
      },
    };
  }

  switch (typeof value) {
    case 'string':
      return { stringValue: value };
    case 'boolean':
      return { booleanValue: value };
    case 'number':
      return Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    case 'object': {
      const fields = Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
        if (typeof entry === 'undefined') return acc;
        acc[key] = encodeFirestoreValue(entry);
        return acc;
      }, {});
      return { mapValue: { fields } };
    }
    default:
      throw new Error(`Unsupported Firestore REST value type: ${typeof value}`);
  }
};

const buildUpdateMask = (fieldPaths: string[]) =>
  fieldPaths.map((fieldPath) => `updateMask.fieldPaths=${encodeURIComponent(fieldPath)}`).join('&');

export const patchUserDocumentViaRest = async ({
  idToken,
  userId,
  patch,
}: {
  idToken: string;
  userId: string;
  patch: Record<string, FirestorePrimitive | undefined>;
}) => {
  const projectId = app.options.projectId;
  if (!projectId) {
    throw new Error('Missing Firebase projectId for Firestore REST fallback.');
  }

  const filteredEntries = Object.entries(patch).filter(([, value]) => typeof value !== 'undefined');
  if (filteredEntries.length === 0) return;

  const fields = filteredEntries.reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[key] = encodeFirestoreValue(value as FirestorePrimitive);
    return acc;
  }, {});

  const query = buildUpdateMask(filteredEntries.map(([key]) => key));
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${COLLECTIONS.USERS}/${userId}?${query}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    },
  );

  if (!response.ok) {
    let detail = '';
    try {
      const data = await response.json();
      detail = data?.error?.message || '';
    } catch {
      // ignore JSON parsing failures
    }
    const error = new Error(detail || `Firestore REST patch failed with HTTP ${response.status}`);
    (error as any).code = detail.toLowerCase().includes('permission') ? 'permission-denied' : `http-${response.status}`;
    throw error;
  }
};
