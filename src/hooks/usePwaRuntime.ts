import { useSyncExternalStore } from 'react';
import {
  getPwaRuntimeState,
  subscribePwaRuntime,
  type PwaRuntimeState,
} from '../services/pwaRuntime.service';

export const usePwaRuntime = (): PwaRuntimeState => useSyncExternalStore(
  subscribePwaRuntime,
  getPwaRuntimeState,
  getPwaRuntimeState,
);
