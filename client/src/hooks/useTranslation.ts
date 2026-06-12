import { useTranslation as useI18nextTranslation } from 'react-i18next';
import { changeLanguage, LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from '@/i18n/config';
import type { SupportedLanguage } from '@/i18n/config';

/**
 * Convenience wrapper around react-i18next's useTranslation.
 * Exposes t/i18n plus the app-level changeLanguage helper that persists the
 * choice to localStorage, so callers don't need to import from two modules.
 */
export function useTranslation() {
  const { t, i18n, ready } = useI18nextTranslation();
  return {
    t,
    i18n,
    ready,
    language: i18n.language,
    changeLanguage,
  };
}

export { changeLanguage, LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES };
export type { SupportedLanguage };
