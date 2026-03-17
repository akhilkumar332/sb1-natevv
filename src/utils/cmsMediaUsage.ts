import { collection, documentId, getDocs, limit, orderBy, query, startAfter, type QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestore';

const HTTP_URL_REGEX = /^https?:\/\/\S+$/i;
const RELATIVE_PATH_REGEX = /^\/\S+$/;
const TEXT_URL_REGEX = /https?:\/\/[^\s"'<>)]+|\/[a-z0-9/_\-.]+/gi;
const MAX_WALK_DEPTH = 8;
const SCAN_BATCH_SIZE = 250;

export const normalizeMediaUrlKey = (value: string | null | undefined): string => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/')) {
    return raw.replace(/\/+$/, '') || '/';
  }
  return raw.replace(/\/+$/, '');
};

const isMediaLikeString = (value: string): boolean => (
  HTTP_URL_REGEX.test(value) || RELATIVE_PATH_REGEX.test(value)
);

const walkForUrls = (value: unknown, output: Set<string>, depth: number): void => {
  if (depth > MAX_WALK_DEPTH || value == null) return;

  if (typeof value === 'string') {
    if (isMediaLikeString(value)) {
      const normalized = normalizeMediaUrlKey(value);
      if (normalized) output.add(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => walkForUrls(entry, output, depth + 1));
    return;
  }

  if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((entry) => walkForUrls(entry, output, depth + 1));
  }
};

const extractUrlsFromRawText = (raw: string, output: Set<string>): void => {
  const matches = raw.match(TEXT_URL_REGEX) || [];
  matches.forEach((match) => {
    const normalized = normalizeMediaUrlKey(match);
    if (normalized) output.add(normalized);
  });
};

export const extractMediaUrlReferences = (contentJson: string | null | undefined): Set<string> => {
  const output = new Set<string>();
  const raw = typeof contentJson === 'string' ? contentJson.trim() : '';
  if (!raw) return output;

  try {
    const parsed = JSON.parse(raw) as unknown;
    walkForUrls(parsed, output, 0);
    if (!output.size) {
      extractUrlsFromRawText(raw, output);
    }
    return output;
  } catch {
    extractUrlsFromRawText(raw, output);
    return output;
  }
};

const countUsageInEntry = (entry: Record<string, unknown>, normalizedUrlKey: string): number => {
  const refs = new Set<string>();
  const bump = (candidate?: string | null) => {
    const normalized = normalizeMediaUrlKey(candidate);
    if (normalized) refs.add(normalized);
  };

  bump(typeof entry.coverImageUrl === 'string' ? entry.coverImageUrl : null);
  bump(typeof entry.ogImageUrl === 'string' ? entry.ogImageUrl : null);
  bump(typeof entry.twitterImageUrl === 'string' ? entry.twitterImageUrl : null);

  if (typeof entry.contentJson === 'string') {
    extractMediaUrlReferences(entry.contentJson).forEach((ref) => refs.add(ref));
  }

  return refs.has(normalizedUrlKey) ? 1 : 0;
};

const scanCmsCollection = async (
  collectionName: string,
  onEntry: (entry: Record<string, unknown>) => void,
): Promise<void> => {
  let lastDocId: string | null = null;

  while (true) {
    const constraints: QueryConstraint[] = [orderBy(documentId()), limit(SCAN_BATCH_SIZE)];
    if (lastDocId) {
      constraints.splice(1, 0, startAfter(lastDocId));
    }

    const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
    if (snapshot.empty) break;

    snapshot.docs.forEach((docSnap) => {
      onEntry(docSnap.data() as Record<string, unknown>);
    });

    lastDocId = snapshot.docs[snapshot.docs.length - 1]?.id || null;
    if (!lastDocId || snapshot.docs.length < SCAN_BATCH_SIZE) break;
  }
};

export const findCmsMediaUsageCount = async (url: string): Promise<number> => {
  const normalizedUrlKey = normalizeMediaUrlKey(url);
  if (!normalizedUrlKey) return 0;

  let usageCount = 0;
  await scanCmsCollection(COLLECTIONS.CMS_PAGES, (entry) => {
    usageCount += countUsageInEntry(entry, normalizedUrlKey);
  });
  await scanCmsCollection(COLLECTIONS.CMS_BLOG_POSTS, (entry) => {
    usageCount += countUsageInEntry(entry, normalizedUrlKey);
  });
  return usageCount;
};

export const cmsMediaUrlExists = async (url: string): Promise<boolean> => {
  const normalizedUrlKey = normalizeMediaUrlKey(url);
  if (!normalizedUrlKey) return false;

  let found = false;
  await scanCmsCollection(COLLECTIONS.CMS_MEDIA, (entry) => {
    if (found) return;
    if (normalizeMediaUrlKey(typeof entry.url === 'string' ? entry.url : null) === normalizedUrlKey) {
      found = true;
    }
  });
  return found;
};
