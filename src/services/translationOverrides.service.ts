import { collection, doc, getDoc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestore';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../locales';
import type { TranslationOverrideDocument, TranslationOverrideMap } from '../types/database.types';
import { getServerTimestamp } from '../utils/firestore.utils';

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const normalizeTranslationOverrideMap = (input: unknown): TranslationOverrideMap => {
  if (!isPlainObject(input)) return {};
  return Object.entries(input).reduce<TranslationOverrideMap>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = value;
      return acc;
    }
    if (isPlainObject(value)) {
      const nested = normalizeTranslationOverrideMap(value);
      if (Object.keys(nested).length > 0) {
        acc[key] = nested;
      }
    }
    return acc;
  }, {});
};

export const getTranslationOverrideDocuments = async (): Promise<TranslationOverrideDocument[]> => {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.TRANSLATION_OVERRIDES), orderBy('language', 'asc')));
  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const language = typeof data.language === 'string' ? data.language : docSnap.id;
      if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) return null;
      return {
        id: docSnap.id,
        language,
        translations: normalizeTranslationOverrideMap(data.translations),
        createdAt: (data.createdAt as any) || undefined,
        updatedAt: (data.updatedAt as any) || undefined,
        updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
      } as TranslationOverrideDocument;
    })
    .filter((entry): entry is TranslationOverrideDocument => Boolean(entry));
};

export const getTranslationOverrideBundles = async (): Promise<Partial<Record<SupportedLanguage, TranslationOverrideMap>>> => {
  const docs = await getTranslationOverrideDocuments();
  return docs.reduce<Partial<Record<SupportedLanguage, TranslationOverrideMap>>>((acc, entry) => {
    if (SUPPORTED_LANGUAGES.includes(entry.language as SupportedLanguage)) {
      acc[entry.language as SupportedLanguage] = entry.translations;
    }
    return acc;
  }, {});
};

export const saveTranslationOverrideBundle = async (
  language: SupportedLanguage,
  translations: TranslationOverrideMap,
  updatedBy?: string | null,
) => {
  const ref = doc(db, COLLECTIONS.TRANSLATION_OVERRIDES, language);
  const snapshot = await getDoc(ref);
  await setDoc(ref, {
    language,
    translations,
    updatedBy: updatedBy || null,
    updatedAt: getServerTimestamp(),
    ...(!snapshot.exists() ? { createdAt: getServerTimestamp() } : {}),
  }, { merge: true });
};
