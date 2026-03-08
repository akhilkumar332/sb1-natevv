import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  flushOfflineMutations,
  refreshOfflineMutationHealthSnapshot,
  subscribePendingOfflineMutationState,
  type PendingOfflineMutationSummary,
} from '../services/offlineMutationOutbox.service';

type PendingOfflineMutationsState = {
  count: number;
  items: PendingOfflineMutationSummary[];
};

export const usePendingOfflineMutations = () => {
  const [state, setState] = useState<PendingOfflineMutationsState>({
    count: 0,
    items: [],
  });
  const [syncing, setSyncing] = useState(false);
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    return subscribePendingOfflineMutationState((next) => {
      setState(next);
    });
  }, []);

  const syncNow = useCallback(async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncing(true);
    try {
      await flushOfflineMutations();
      await refreshOfflineMutationHealthSnapshot();
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  }, []);

  return useMemo(() => ({
    pendingCount: state.count,
    pendingItems: state.items,
    syncing,
    syncNow,
  }), [state.count, state.items, syncing, syncNow]);
};

export default usePendingOfflineMutations;
