/**
 * useTranslation Hook
 *
 * Convenience wrapper around react-i18next's useTranslation.
 * Provides the translation function and current language.
 */

import { useTranslation as useI18nTranslation } from 'react-i18next';
import { setLanguage, SUPPORTED_LANGUAGES } from '@/i18n/config';

export function useTranslation(namespace?: string) {
  const { t, i18n } = useI18nTranslation(namespace);

  return {
    t,
    i18n,
    currentLanguage: i18n.language,
    setLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}
