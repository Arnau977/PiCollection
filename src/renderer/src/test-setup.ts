import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './assets/locales'

afterEach(() => {
  cleanup()
})

// Fixed to English so test assertions on rendered text are deterministic
// regardless of the machine's OS locale (production uses language detection).
await i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common'],
  defaultNS: 'common',
  interpolation: { escapeValue: false }
})

if (typeof window !== 'undefined') {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      /* eslint-disable @typescript-eslint/no-empty-function */
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      /* eslint-enable @typescript-eslint/no-empty-function */
    } as unknown as typeof ResizeObserver
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = (): void => {}
  }
  if (!window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false
      }) as unknown as MediaQueryList
  }
}
