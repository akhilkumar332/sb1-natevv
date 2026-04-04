import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, isSupportedLanguage, LANGUAGE_STORAGE_KEY, localeResources } from './locales';

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
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });

i18n.on('languageChanged', (language) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore storage errors
    }
  }
});

export default i18n;
