import type { TranslationKey } from '~/composables/useLocale'

interface PageHeaderState {
  title: string
  titleKey?: TranslationKey
  description?: string
  descriptionKey?: TranslationKey
  icon?: string
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
  }))

  function setHeader(opts: SetHeaderOpts) {
    headerState.value.title = opts.title || ''
    headerState.value.titleKey = opts.titleKey
    headerState.value.description = opts.description || ''
    headerState.value.descriptionKey = opts.descriptionKey
    headerState.value.icon = opts.icon || ''
  }

  function clearHeader() {
    headerState.value.title = ''
    headerState.value.titleKey = undefined
    headerState.value.description = ''
    headerState.value.descriptionKey = undefined
    headerState.value.icon = ''
  }

  return {
    headerState: readonly(headerState),
    setHeader,
    clearHeader,
  }
}
