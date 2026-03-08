import { useEffect, useState } from 'react';
import {
  getOfflineMutationDeadLetters,
  resetOfflineMutationDeadLetters,
  subscribeOfflineMutationDeadLetters,
  type OfflineMutationDeadLetterEntry,
} from '../services/offlineMutationOutbox.service';

export const useOfflineMutationDeadLetters = () => {
  const [entries, setEntries] = useState<OfflineMutationDeadLetterEntry[]>(() => getOfflineMutationDeadLetters());

  useEffect(() => {
    return subscribeOfflineMutationDeadLetters((next) => {
      setEntries(next);
    });
  }, []);

  return {
    entries,
    resetDeadLetters: resetOfflineMutationDeadLetters,
  };
};

export default useOfflineMutationDeadLetters;

