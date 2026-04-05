import i18n from '../i18n';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../locales';
import type { TranslationOverrideMap } from '../types/database.types';
import { captureHandledError } from './errorLog.service';
import { getTranslationOverrideBundles } from './translationOverrides.service';

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const applyTranslationOverrideBundles = (
  bundles: Partial<Record<SupportedLanguage, TranslationOverrideMap>>,
) => {
  SUPPORTED_LANGUAGES.forEach((language) => {
    const translations = bundles[language];
    if (!isPlainObject(translations) || Object.keys(translations).length === 0) return;
    i18n.addResourceBundle(language, 'translation', translations, true, true);
  });
};

export const loadTranslationOverridesIntoI18n = async () => {
  try {
    const bundles = await getTranslationOverrideBundles();
    applyTranslationOverrideBundles(bundles);
    return bundles;
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'unknown',
      metadata: { component: 'translationRuntime', kind: 'override_load_failed' },
    });
    return null;
  }
};
