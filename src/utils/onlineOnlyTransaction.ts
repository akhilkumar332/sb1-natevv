import { runTransaction, type Transaction } from 'firebase/firestore';
import { db } from '../firebase';

export class OnlineRequiredError extends Error {
  code: string;

  constructor(message: string = 'This action requires an internet connection.') {
    super(message);
    this.name = 'OnlineRequiredError';
    this.code = 'offline/online-required';
  }
}

export const isOnlineRequiredError = (error: unknown): error is OnlineRequiredError => {
  return error instanceof OnlineRequiredError || (error as { code?: string })?.code === 'offline/online-required';
};

const isOfflineError = (error: unknown): boolean => {
  const anyError = error as { code?: string; message?: string };
  const code = String(anyError?.code || '').toLowerCase();
  const message = String(anyError?.message || '').toLowerCase();
  return (
    code === 'unavailable'
    || code === 'failed-precondition'
    || code === 'deadline-exceeded'
    || message.includes('offline')
    || message.includes('network')
  );
};

export const runOnlineTransaction = async <T>(
  updateFunction: (transaction: Transaction) => Promise<T>,
  message?: string,
): Promise<T> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new OnlineRequiredError(message);
  }

  try {
    return await runTransaction(db, updateFunction);
  } catch (error) {
    if (isOfflineError(error) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      throw new OnlineRequiredError(message);
    }
    throw error;
  }
};
