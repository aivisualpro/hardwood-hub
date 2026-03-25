/**
 * CRM Composable — fetches and manages CRM submission data from API
 */

export interface CrmSubmission {
  _id: string
  gfEntryId: string
  gfFormId: number
  formName: string
  type: 'appointment' | 'fast-quote' | 'flooring-estimate' | 'subscriber' | 'conditional-logic' | 'other'
  name: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  message: string
  fields: Record<string, any>
  status: 'new' | 'contacted' | 'in-progress' | 'completed' | 'archived'
  starred: boolean
  notes: string
  dateSubmitted: string
  dateUpdated?: string
  sourceUrl: string
  ip: string
  createdAt: string
  updatedAt: string
}

export interface CrmStats {
  totalCount: number
  byType: Record<string, number>
  byStatus: Record<string, number>
  last30Days: Record<string, number>
  recentSubmissions: CrmSubmission[]
}

export function useCrmSubmissions(initialType?: string) {
  const items = ref<CrmSubmission[]>([])
  const isLoading = ref(false)
  const isSyncing = ref(false)
  const stats = ref<CrmStats | null>(null)
  const searchQuery = ref('')
  const statusFilter = ref('all')
  const typeFilter = ref(initialType || 'all')
  const currentPage = ref(1)
  const totalPages = ref(1)
  const totalItems = ref(0)

  async function fetchSubmissions(page = 1) {
    isLoading.value = true
    try {
      const params = new URLSearchParams()
      if (typeFilter.value && typeFilter.value !== 'all')
        params.set('type', typeFilter.value)
      if (statusFilter.value && statusFilter.value !== 'all')
        params.set('status', statusFilter.value)
      if (searchQuery.value)
        params.set('search', searchQuery.value)
      params.set('page', String(page))
      params.set('limit', '50')

      const res = await $fetch<any>(`/api/crm/submissions?${params.toString()}`)
      items.value = res.data || []
      currentPage.value = res.pagination?.page || 1
      totalPages.value = res.pagination?.totalPages || 1
      totalItems.value = res.pagination?.total || 0
    }
    catch (err) {
      console.error('[CRM] Failed to fetch submissions:', err)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchStats() {
    try {
      const res = await $fetch<any>('/api/crm/stats')
      stats.value = res.data || null
    }
    catch (err) {
      console.error('[CRM] Failed to fetch stats:', err)
    }
  }

  async function syncFromGravityForms() {
    isSyncing.value = true
    try {
      const res = await $fetch<any>('/api/crm/sync', { method: 'POST' })
      // After sync, refetch the current view
      await Promise.all([fetchSubmissions(currentPage.value), fetchStats()])
      return res
    }
    catch (err) {
      console.error('[CRM] Sync failed:', err)
      throw err
    }
    finally {
      isSyncing.value = false
    }
  }

  async function updateSubmission(id: string, data: Partial<CrmSubmission>) {
    try {
      const res = await $fetch<any>(`/api/crm/submissions/${id}`, {
        method: 'PATCH',
        body: data,
      })
      // Update local state
      const idx = items.value.findIndex(i => i._id === id)
      if (idx !== -1 && res.data) {
        items.value[idx] = res.data
      }
      return res.data
    }
    catch (err) {
      console.error('[CRM] Failed to update:', err)
      throw err
    }
  }

  async function toggleStar(id: string) {
    const item = items.value.find(i => i._id === id)
    if (item) {
      await updateSubmission(id, { starred: !item.starred })
    }
  }

  // Watch search/filter changes and refetch
  watchDebounced([searchQuery, statusFilter, typeFilter], () => {
    currentPage.value = 1
    fetchSubmissions(1)
  }, { debounce: 300 })

  return {
    items,
    isLoading,
    isSyncing,
    stats,
    searchQuery,
    statusFilter,
    typeFilter,
    currentPage,
    totalPages,
    totalItems,
    fetchSubmissions,
    fetchStats,
    syncFromGravityForms,
    updateSubmission,
    toggleStar,
  }
}
