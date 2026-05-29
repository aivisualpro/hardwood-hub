import type { TranslationKey } from '~/composables/useLocale'

interface PageHeaderState {
  title: string
  titleKey?: TranslationKey
  description?: string
  descriptionKey?: TranslationKey
  icon?: string
  _explicit: boolean
}

interface SetHeaderOpts {
  title?: string
  titleKey?: TranslationKey
  description?: string
  descriptionKey?: TranslationKey
  icon?: string
}

export function usePageHeader() {
  const headerState = useState<PageHeaderState>('page-header', () => ({
    title: '',
    titleKey: undefined,
    description: '',
    descriptionKey: undefined,
    icon: '',
    _explicit: false,
  }))

  function setHeader(opts: SetHeaderOpts) {
    headerState.value.title = opts.title || ''
    headerState.value.titleKey = opts.titleKey
    headerState.value.description = opts.description || ''
    headerState.value.descriptionKey = opts.descriptionKey
    headerState.value.icon = opts.icon || ''
    headerState.value._explicit = true
  }

  function clearHeader() {
    headerState.value.title = ''
    headerState.value.titleKey = undefined
    headerState.value.description = ''
    headerState.value.descriptionKey = undefined
    headerState.value.icon = ''
    headerState.value._explicit = false
  }

  /** Reset the _explicit flag without clearing content (used before route change) */
  function markPending() {
    headerState.value._explicit = false
  }

  return {
    headerState: readonly(headerState),
    setHeader,
    clearHeader,
    markPending,
  }
}
