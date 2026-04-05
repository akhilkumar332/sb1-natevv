import { bundledLocaleDictionaries, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../locales';
import type { CmsBlogPost, CmsPage, TranslationOverrideMap } from '../types/database.types';

export type TranslationLeafRow = {
  key: string;
  namespace: string;
  english: string;
  values: Record<SupportedLanguage, string>;
};

export type TranslationLanguageSummary = {
  language: SupportedLanguage;
  translatedCount: number;
  totalCount: number;
  missingCount: number;
  sameAsEnglishCount: number;
  completionPercent: number;
};

export type TranslationNamespaceSummary = {
  namespace: string;
  translatedCount: number;
  totalCount: number;
  missingCount: number;
  sameAsEnglishCount: number;
  completionPercent: number;
};

export type CmsLocaleCoverageSummary = {
  surface: 'frontendPages' | 'blogPosts';
  language: SupportedLanguage;
  localizedFieldCount: number;
  totalFieldCount: number;
  completionPercent: number;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const normalizeString = (value: unknown): string => (
  typeof value === 'string' ? value : ''
);

export const flattenTranslationObject = (
  input: unknown,
  prefix = '',
): Record<string, string> => {
  if (!isPlainObject(input)) return {};
  return Object.entries(input).reduce<Record<string, string>>((acc, [key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      acc[nextKey] = value;
      return acc;
    }
    if (Array.isArray(value)) {
      return acc;
    }
    if (isPlainObject(value)) {
      Object.assign(acc, flattenTranslationObject(value, nextKey));
    }
    return acc;
  }, {});
};

export const unflattenTranslationObject = (flatMap: Record<string, string>): TranslationOverrideMap => {
  const root: Record<string, unknown> = {};
  Object.entries(flatMap).forEach(([key, value]) => {
    const segments = key.split('.').filter(Boolean);
    if (!segments.length) return;
    let cursor: Record<string, unknown> = root;
    segments.forEach((segment, index) => {
      if (index === segments.length - 1) {
        cursor[segment] = value;
        return;
      }
      if (!isPlainObject(cursor[segment])) {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    });
  });
  return root as TranslationOverrideMap;
};

export const getTranslationNamespace = (key: string): string => key.split('.')[0] || 'misc';

export const buildTranslationLeafRows = (
  overridesByLanguage?: Partial<Record<SupportedLanguage, TranslationOverrideMap>>,
): TranslationLeafRow[] => {
  const bundledFlatByLanguage = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [language, flattenTranslationObject(bundledLocaleDictionaries[language])]),
  ) as Record<SupportedLanguage, Record<string, string>>;

  const overrideFlatByLanguage = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [
      language,
      flattenTranslationObject(overridesByLanguage?.[language] || {}),
    ]),
  ) as Record<SupportedLanguage, Record<string, string>>;

  const allKeys = new Set<string>();
  SUPPORTED_LANGUAGES.forEach((language) => {
    Object.keys(bundledFlatByLanguage[language]).forEach((key) => allKeys.add(key));
    Object.keys(overrideFlatByLanguage[language]).forEach((key) => allKeys.add(key));
  });

  return Array.from(allKeys)
    .sort((a, b) => a.localeCompare(b))
    .map<TranslationLeafRow>((key) => {
      const values = Object.fromEntries(
        SUPPORTED_LANGUAGES.map((language) => {
          const override = overrideFlatByLanguage[language][key];
          const bundled = bundledFlatByLanguage[language][key];
          return [language, normalizeString(override || bundled || '')];
        }),
      ) as Record<SupportedLanguage, string>;

      return {
        key,
        namespace: getTranslationNamespace(key),
        english: values[DEFAULT_LANGUAGE],
        values,
      };
    });
};

const toCompletionPercent = (numerator: number, denominator: number) => (
  denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0
);

export const buildTranslationLanguageSummaries = (
  rows: TranslationLeafRow[],
): TranslationLanguageSummary[] => {
  const totalCount = rows.length;
  return SUPPORTED_LANGUAGES.map((language) => {
    if (language === DEFAULT_LANGUAGE) {
      return {
        language,
        translatedCount: totalCount,
        totalCount,
        missingCount: 0,
        sameAsEnglishCount: 0,
        completionPercent: 100,
      };
    }
    const missingCount = rows.filter((row) => !row.values[language].trim()).length;
    const sameAsEnglishCount = rows.filter((row) => {
      const localized = row.values[language].trim();
      const english = row.english.trim();
      return localized.length > 0 && localized === english;
    }).length;
    const translatedCount = totalCount - missingCount - sameAsEnglishCount;
    return {
      language,
      translatedCount,
      totalCount,
      missingCount,
      sameAsEnglishCount,
      completionPercent: toCompletionPercent(translatedCount, totalCount),
    };
  });
};

export const buildTranslationNamespaceSummary = (
  rows: TranslationLeafRow[],
  language: SupportedLanguage,
): TranslationNamespaceSummary[] => {
  const summaryByNamespace = rows.reduce<Map<string, TranslationNamespaceSummary>>((acc, row) => {
    const current = acc.get(row.namespace) || {
      namespace: row.namespace,
      translatedCount: 0,
      totalCount: 0,
      missingCount: 0,
      sameAsEnglishCount: 0,
      completionPercent: 0,
    };
    current.totalCount += 1;
    const localized = row.values[language].trim();
    const english = row.english.trim();
    if (!localized) current.missingCount += 1;
    else if (language !== DEFAULT_LANGUAGE && localized === english) current.sameAsEnglishCount += 1;
    else current.translatedCount += 1;
    acc.set(row.namespace, current);
    return acc;
  }, new Map());

  return Array.from(summaryByNamespace.values())
    .map((entry) => ({
      ...entry,
      completionPercent: toCompletionPercent(entry.translatedCount, entry.totalCount),
    }))
    .sort((a, b) => a.namespace.localeCompare(b.namespace));
};

const CMS_LOCALIZED_FIELD_ACCESSORS = [
  (entry: CmsPage | CmsBlogPost) => entry.titleByLocale || null,
  (entry: CmsPage | CmsBlogPost) => entry.excerptByLocale || null,
  (entry: CmsPage | CmsBlogPost) => entry.contentJsonByLocale || null,
  (entry: CmsPage | CmsBlogPost) => entry.seoTitleByLocale || null,
  (entry: CmsPage | CmsBlogPost) => entry.seoDescriptionByLocale || null,
] as const;

const countCmsLocalizedFields = (
  entries: Array<CmsPage | CmsBlogPost>,
  language: SupportedLanguage,
) => {
  return entries.reduce((acc, entry) => {
    CMS_LOCALIZED_FIELD_ACCESSORS.forEach((pickLocalizedMap) => {
      const localizedMap = pickLocalizedMap(entry);
      const localizedValue = localizedMap?.[language];
      if (typeof localizedValue === 'string' && localizedValue.trim()) {
        acc.localizedFieldCount += 1;
      }
      acc.totalFieldCount += 1;
    });
    return acc;
  }, { localizedFieldCount: 0, totalFieldCount: 0 });
};

export const buildCmsLocaleCoverageSummaries = (
  pages: CmsPage[],
  posts: CmsBlogPost[],
): CmsLocaleCoverageSummary[] => {
  const frontendPageEntries = pages.filter((entry) => (
    ['home', 'find-donors', 'request-blood', 'about', 'contact'].includes(entry.slug)
  ));

  return SUPPORTED_LANGUAGES
    .filter((language) => language !== DEFAULT_LANGUAGE)
    .flatMap<CmsLocaleCoverageSummary>((language) => {
      const frontendPageCounts = countCmsLocalizedFields(frontendPageEntries, language);
      const blogCounts = countCmsLocalizedFields(posts, language);
      return [
        {
          surface: 'frontendPages',
          language,
          localizedFieldCount: frontendPageCounts.localizedFieldCount,
          totalFieldCount: frontendPageCounts.totalFieldCount,
          completionPercent: toCompletionPercent(frontendPageCounts.localizedFieldCount, frontendPageCounts.totalFieldCount),
        },
        {
          surface: 'blogPosts',
          language,
          localizedFieldCount: blogCounts.localizedFieldCount,
          totalFieldCount: blogCounts.totalFieldCount,
          completionPercent: toCompletionPercent(blogCounts.localizedFieldCount, blogCounts.totalFieldCount),
        },
      ];
    });
};

