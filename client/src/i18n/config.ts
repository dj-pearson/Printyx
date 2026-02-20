/**
 * i18n Configuration
 *
 * Initializes react-i18next with English as the default language.
 * Additional locales can be added by creating new JSON files in locales/
 * and importing them here.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';

const STORAGE_KEY = 'printyx-language';

// Get saved language or default to English
function getStoredLanguage(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  } catch {
    return 'en';
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already handles XSS
  },
  react: {
    useSuspense: false, // Avoid suspense for SSR compatibility
  },
});

/**
 * Save language preference to localStorage
 */
export function setLanguage(lang: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignore storage errors
  }
  i18n.changeLanguage(lang);
}

/**
 * Available languages for the language selector
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
] as const;

export default i18n;
