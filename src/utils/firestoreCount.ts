import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebase';

const isCountUnavailable = (error: unknown) => {
  const message = String((error as any)?.message || '').toLowerCase();
  const code = String((error as any)?.code || '');
  return (
    code === 'unimplemented'
    || code === 'failed-precondition'
    || message.includes('requires an index')
    || message.includes('aggregation')
  );
};

export const countCollection = async (
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<number> => {
  const q = query(collection(db, collectionName), ...constraints);
  try {
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count || 0;
  } catch (error) {
    if (!isCountUnavailable(error)) throw error;
    const fallback = await getDocs(q);
    return fallback.size;
  }
};
