import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, isSupportedLanguage, LANGUAGE_STORAGE_KEY, localeResources } from './locales';

const syncDocumentLanguage = (language: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
};

const resolveInitialLanguage = () => {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(stored)) return stored;
  } catch {
    // ignore storage errors
  }

  const browserLanguage = window.navigator.language?.split('-')[0] || '';
  return isSupportedLanguage(browserLanguage) ? browserLanguage : DEFAULT_LANGUAGE;
};

i18n
  .use(initReactI18next)
  .init({
    resources: localeResources,
    lng: resolveInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: Object.keys(localeResources),
    react: {
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
    },
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });

i18n.on('languageChanged', (language) => {
  syncDocumentLanguage(language);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore storage errors
    }
  }
});

syncDocumentLanguage(i18n.resolvedLanguage || i18n.language || DEFAULT_LANGUAGE);

export default i18n;
