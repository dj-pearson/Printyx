import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';

export const LANGUAGE_STORAGE_KEY = 'printyx_language';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Resolve the initial language: persisted choice first, then browser language,
 * falling back to English. localStorage access is wrapped because it throws in
 * some privacy modes.
 */
function getInitialLanguage(): SupportedLanguage {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && isSupportedLanguage(stored)) return stored;
  } catch {
    // localStorage unavailable - fall through to browser language
  }

  if (typeof navigator !== 'undefined' && navigator.language) {
    const browserLang = navigator.language.split('-')[0];
    if (isSupportedLanguage(browserLang)) return browserLang;
  }

  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    // es is a partial placeholder locale; missing keys fall back to English.
    es: { translation: es },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    // React already escapes rendered strings
    escapeValue: false,
  },
  returnNull: false,
});

/**
 * Switch the active language and persist the choice for the next session.
 * Unsupported codes (e.g. locales without a resource bundle yet) still switch,
 * rendering English via fallbackLng until translations are added.
 */
export function changeLanguage(language: string): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // localStorage unavailable - language still changes for this session
  }
  void i18n.changeLanguage(language);
}

export default i18n;
