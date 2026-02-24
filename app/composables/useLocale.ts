import en from '~/locales/en'
import es from '~/locales/es'
import fr from '~/locales/fr'
import ar from '~/locales/ar'
import he from '~/locales/he'

export type LocaleCode = 'en' | 'es' | 'fr' | 'ar' | 'he'
export type TranslationKey = keyof typeof en

const messages: Record<LocaleCode, Record<string, string>> = { en, es, fr, ar, he }

const currentLocale = ref<LocaleCode>('en')

export function useLocale() {
  function setLocale(locale: LocaleCode) {
    currentLocale.value = locale
  }

  function t(key: TranslationKey): string {
    const locale = currentLocale.value
    return messages[locale]?.[key] ?? messages.en[key] ?? key
  }

  return {
    locale: computed(() => currentLocale.value),
    setLocale,
    t,
  }
}
