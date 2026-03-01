import { useEffect, useState } from 'react';
import {
  getOfflineMutationTelemetry,
  resetOfflineMutationTelemetry,
  subscribeOfflineMutationTelemetry,
  type OfflineMutationTelemetry,
} from '../services/offlineMutationOutbox.service';

export const useOfflineMutationTelemetry = () => {
  const [telemetry, setTelemetry] = useState<OfflineMutationTelemetry>(() => getOfflineMutationTelemetry());

  useEffect(() => {
    return subscribeOfflineMutationTelemetry((next) => {
      setTelemetry(next);
    });
  }, []);

  return {
    telemetry,
    resetTelemetry: resetOfflineMutationTelemetry,
  };
};

export default useOfflineMutationTelemetry;
