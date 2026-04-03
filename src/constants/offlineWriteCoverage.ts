import {
  GENERATED_OFFLINE_WRITE_INVENTORY,
  type GeneratedOfflineWriteInventoryRow,
} from '../generated/offlineWriteInventory';

export type OfflineWriteMode = 'queue_safe' | 'online_only' | 'persistence_backed';
export type OfflineWriteTrust = 'verified' | 'heuristic' | 'unknown';

export type OfflineWriteCoverageEntry = {
  id: string;
  module: string;
  area: string;
  mode: OfflineWriteMode;
  trust: OfflineWriteTrust;
  notes?: string;
  path?: string;
  line?: number;
  collectionKey?: string;
  method?: string;
};

export const OFFLINE_WRITE_CALLSITE_BASELINE_TOTAL = 181;

const SENSITIVE_PATH_HINTS = [
  '/services/notification.service.ts',
  '/services/fcmNotification.service.ts',
  '/services/audit.service.ts',
  '/pages/bloodbank/dashboard/Inventory.tsx',
];

const ONLINE_ONLY_COLLECTION_HINTS = new Set([
  'INVENTORY_TRANSFERS',
  'INVENTORY_RESERVATIONS',
  'BLOOD_INVENTORY',
  'AUDIT_LOGS',
]);

const resolveTrust = (row: GeneratedOfflineWriteInventoryRow): OfflineWriteTrust => {
  if (row.collectionKey === 'UNKNOWN') return 'unknown';
  if (row.mode === 'queue_safe' || row.mode === 'online_only') return 'verified';
  if (SENSITIVE_PATH_HINTS.some((hint) => row.path.endsWith(hint))) return 'heuristic';
  if (ONLINE_ONLY_COLLECTION_HINTS.has(row.collectionKey)) return 'heuristic';
  if (row.method === 'addDoc' || row.method === 'setDoc' || row.method === 'updateDoc') return 'heuristic';
  return 'heuristic';
};

const resolveMode = (row: GeneratedOfflineWriteInventoryRow): OfflineWriteMode => {
  if (row.mode === 'online_only') return 'online_only';

  if (row.collectionKey === 'UNKNOWN') {
    return 'persistence_backed';
  }

  if (row.mode === 'queue_safe') return 'queue_safe';

  if (SENSITIVE_PATH_HINTS.some((hint) => row.path.endsWith(hint))) {
    return 'online_only';
  }

  if (ONLINE_ONLY_COLLECTION_HINTS.has(row.collectionKey)) {
    return 'online_only';
  }

  // Firestore non-transactional writes are queue-capable with offline persistence enabled.
  if (row.method === 'addDoc' || row.method === 'setDoc' || row.method === 'updateDoc') {
    return 'queue_safe';
  }

  return 'persistence_backed';
};

export const OFFLINE_WRITE_COVERAGE_CATALOG: OfflineWriteCoverageEntry[] = GENERATED_OFFLINE_WRITE_INVENTORY.map((row) => ({
  id: row.id,
  module: row.module,
  area: row.area,
  mode: resolveMode(row),
  trust: resolveTrust(row),
  path: row.path,
  line: row.line,
  collectionKey: row.collectionKey,
  method: row.method,
}));

export const getOfflineWriteCoverageSummary = () => {
  const detectedTotal = OFFLINE_WRITE_COVERAGE_CATALOG.length;
  const total = Math.max(OFFLINE_WRITE_CALLSITE_BASELINE_TOTAL, detectedTotal);
  const queueSafe = OFFLINE_WRITE_COVERAGE_CATALOG.filter((entry) => entry.mode === 'queue_safe').length;
  const onlineOnly = OFFLINE_WRITE_COVERAGE_CATALOG.filter((entry) => entry.mode === 'online_only').length;
  const persistenceBacked = OFFLINE_WRITE_COVERAGE_CATALOG.filter((entry) => entry.mode === 'persistence_backed').length;
  const unknownCollection = OFFLINE_WRITE_COVERAGE_CATALOG.filter((entry) => entry.collectionKey === 'UNKNOWN').length;
  const verified = OFFLINE_WRITE_COVERAGE_CATALOG.filter((entry) => entry.trust === 'verified').length;
  const heuristic = OFFLINE_WRITE_COVERAGE_CATALOG.filter((entry) => entry.trust === 'heuristic').length;
  const unknown = OFFLINE_WRITE_COVERAGE_CATALOG.filter((entry) => entry.trust === 'unknown').length;
  const queueCoveragePercent = total > 0 ? (queueSafe / total) * 100 : 0;
  const catalogedCoveragePercent = total > 0 ? (detectedTotal / total) * 100 : 0;

  return {
    total,
    cataloged: detectedTotal,
    unmapped: Math.max(0, total - detectedTotal),
    queueSafe,
    onlineOnly,
    persistenceBacked,
    unknownCollection,
    verified,
    heuristic,
    unknown,
    queueCoveragePercent,
    catalogedCoveragePercent,
  };
};

export const getOfflineWriteExpansionTargets = (limit: number = 8) => {
  return OFFLINE_WRITE_COVERAGE_CATALOG
    .filter((entry) => entry.mode !== 'queue_safe')
    .filter((entry) => !entry.id.startsWith('UNKNOWN.'))
    .sort((a, b) => {
      const trustOrder = { unknown: 0, heuristic: 1, verified: 2 } as const;
      const trustDelta = trustOrder[a.trust] - trustOrder[b.trust];
      if (trustDelta !== 0) return trustDelta;
      const aUnknown = a.collectionKey === 'UNKNOWN' ? 0 : 1;
      const bUnknown = b.collectionKey === 'UNKNOWN' ? 0 : 1;
      if (aUnknown !== bUnknown) return aUnknown - bUnknown;
      return a.module < b.module ? -1 : a.module > b.module ? 1 : 0;
    })
    .slice(0, Math.max(1, limit));
};
