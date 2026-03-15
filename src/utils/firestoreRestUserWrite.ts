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

const buildRestError = async (response: Response) => {
  let detail = '';
  try {
    const data = await response.json();
    detail = data?.error?.message || '';
  } catch {
    // ignore JSON parsing failures
  }
  const error = new Error(detail || `Firestore REST request failed with HTTP ${response.status}`);
  const normalizedDetail = detail.toLowerCase();
  if (normalizedDetail.includes('permission')) {
    (error as any).code = 'permission-denied';
  } else if (normalizedDetail.includes('already exists')) {
    (error as any).code = 'already-exists';
  } else if (response.status === 404) {
    (error as any).code = 'not-found';
  } else {
    (error as any).code = `http-${response.status}`;
  }
  (error as any).httpStatus = response.status;
  (error as any).detail = detail;
  return error;
};

const buildFirestoreFields = (patch: Record<string, FirestorePrimitive | undefined>) => {
  const filteredEntries = Object.entries(patch).filter(([, value]) => typeof value !== 'undefined');
  const fields = filteredEntries.reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[key] = encodeFirestoreValue(value as FirestorePrimitive);
    return acc;
  }, {});
  return { fields, filteredEntries };
};

export const createUserDocumentViaRest = async ({
  idToken,
  userId,
  document,
}: {
  idToken: string;
  userId: string;
  document: Record<string, FirestorePrimitive | undefined>;
}) => {
  const projectId = app.options.projectId;
  if (!projectId) {
    throw new Error('Missing Firebase projectId for Firestore REST fallback.');
  }

  const { fields, filteredEntries } = buildFirestoreFields(document);
  if (filteredEntries.length === 0) return;
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${COLLECTIONS.USERS}?documentId=${encodeURIComponent(userId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    },
  );

  if (!response.ok) {
    throw await buildRestError(response);
  }
};

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

  const { fields, filteredEntries } = buildFirestoreFields(patch);
  if (filteredEntries.length === 0) return;

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
    throw await buildRestError(response);
  }
};
