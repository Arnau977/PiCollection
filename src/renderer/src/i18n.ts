import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './assets/locales'
import LanguageDetector from 'i18next-browser-languagedetector'

export const NAME_SPACE = {
  COMMON: 'common'
}

export const LANGUAGES = {
  ENGLISH: 'en',
  SPANISH: 'es'
}

export const getLanguage = (): string => i18n.language || window.localStorage.i18nextLng

await i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: true,
    resources,
    fallbackLng: [LANGUAGES.ENGLISH, LANGUAGES.SPANISH],
    ns: [NAME_SPACE.COMMON],
    defaultNS: NAME_SPACE.COMMON,
    fallbackNS: NAME_SPACE.COMMON,
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
