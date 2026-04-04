import en from './en';
import hi from './hi';
import te from './te';
import ta from './ta';
import kn from './kn';
import ml from './ml';

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'te', 'ta', 'kn', 'ml'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
export const LANGUAGE_STORAGE_KEY = 'bh_language';

export const localeResources = {
  en: { translation: en },
  hi: { translation: hi },
  te: { translation: te },
  ta: { translation: ta },
  kn: { translation: kn },
  ml: { translation: ml },
} as const;

export const isSupportedLanguage = (value: string | null | undefined): value is SupportedLanguage =>
  Boolean(value && SUPPORTED_LANGUAGES.includes(value as SupportedLanguage));

export const getLanguageNativeLabel = (language: SupportedLanguage): string => ({
  en: en.language.english,
  hi: en.language.hindi,
  te: en.language.telugu,
  ta: en.language.tamil,
  kn: en.language.kannada,
  ml: en.language.malayalam,
}[language]);
