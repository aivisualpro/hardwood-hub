<script setup lang="ts">
import { toast } from 'vue-sonner'

const { canCreate, canUpdate, canDelete } = usePermissions('/crm/pipeline')

const { setHeader } = usePageHeader()
setHeader({
  title: 'Pipeline',
  icon: 'i-lucide-kanban',
  description: 'Manage all projects and leads',
})

const customers = ref<any[]>([])
const showCreateModal = ref(false)

// ─── Multi-Select ────────────────────────────────────────
const selectedIds = ref<Set<string>>(new Set())
const showBulkDeleteConfirm = ref(false)
const isBulkDeleting = ref(false)

function toggleSelect(id: string) {
  const s = new Set(selectedIds.value)
  if (s.has(id))
    s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

const isAllSelected = computed(() => {
  if (!filteredCustomers.value.length)
    return false
  return filteredCustomers.value.every(c => selectedIds.value.has(c._id))
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = new Set()
  }
  else {
    selectedIds.value = new Set(filteredCustomers.value.map(c => c._id))
  }
}

async function bulkDeleteSelected() {
  isBulkDeleting.value = true
  const ids = [...selectedIds.value]
  let deleted = 0
  try {
    await Promise.all(ids.map(async (id) => {
      try {
        await $fetch(`/api/pipeline/${id}`, { method: 'DELETE' })
        deleted++
      }
      catch { /* skip failed */ }
    }))
    customers.value = customers.value.filter(c => !selectedIds.value.has(c._id))
    selectedIds.value = new Set()
    toast.success(`Deleted ${deleted} customer${deleted !== 1 ? 's' : ''}`)
    fetchCounts() // refresh chevron counts
  }
  catch {
    toast.error('Failed to delete some customers')
  }
  finally {
    isBulkDeleting.value = false
    showBulkDeleteConfirm.value = false
  }
}

const isQuickEditMode = ref(false)
const activeDropdown = ref<string | null>(null)

function toggleAssignee(customer: any, field: string, email: string) {
  let arr = getAssignedToArray(customer[field])
  if (arr.includes(email)) {
    arr = arr.filter(e => e !== email)
  }
  else {
    arr.push(email)
  }
  const val = arr.join(',')
  customer[field] = val

  $fetch(`/api/pipeline/${customer._id}`, {
    method: 'PUT',
    body: { [field]: val },
  }).catch(() => toast.error('Failed to save assignment'))
}

function removeAssignee(customer: any, field: string, email: string) {
  let arr = getAssignedToArray(customer[field])
  arr = arr.filter(e => e !== email)
  const val = arr.join(',')
  customer[field] = val

  $fetch(`/api/pipeline/${customer._id}`, {
    method: 'PUT',
    body: { [field]: val },
  }).catch(() => toast.error('Failed to remove assignment'))
}

async function handleQuickUpdate(customer: any, field: string, event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  let val: any = target.value

  if (target.type === 'number') {
    val = val === '' ? null : Number(val)
  }
  if (target.type === 'date' && !val)
    val = null

  // Update optimistic local state immediately (spreadsheet feel)
  customer[field] = val

  try {
    const res = await $fetch<any>(`/api/pipeline/${customer._id}`, {
      method: 'PUT',
      body: { [field]: val },
    })
    if (!res.success)
      throw new Error('API failed')
  }
  catch (err) {
    toast.error(`Failed to save ${field}`)
  }
}

const stageSearch = ref('')
const stageSearchInput = ref<HTMLInputElement | null>(null)

// ─── Dropdown-based Status Resolution ───────────────────
interface StatusOption { _id: string, label: string, value: string, color: string, icon: string, order: number }
const statusOptions = ref<StatusOption[]>([])
const statusMap = computed(() => {
  const map = new Map<string, StatusOption>()
  for (const opt of statusOptions.value) {
    map.set(String(opt._id), opt)
  }
  return map
})

async function fetchStatusDropdown() {
  try {
    const res = await $fetch<any>('/api/dropdowns?name=Customer Status')
    if (res?.data) {
      const d = res.data
      if (Array.isArray(d)) {
        const match = d.find((dd: any) => dd.name === 'Customer Status')
        if (match?.options)
          statusOptions.value = match.options
      }
      else if (d.options) {
        statusOptions.value = d.options
      }
    }
  }
  catch (e) {
    console.warn('Failed to load status dropdown', e)
  }
}

function resolveStatus(customer: any): StatusOption | null {
  const id = customer?.status
  if (!id)
    return null
  return statusMap.value.get(String(id)) || null
}

function getStatusName(customer: any): string {
  return resolveStatus(customer)?.label || customer?.stage || ''
}

watch(activeDropdown, (val) => {
  if (val && val.endsWith('stage')) {
    stageSearch.value = ''
    setTimeout(() => {
      stageSearchInput.value && stageSearchInput.value.focus()
    }, 50)
  }
})

const filteredStageOptions = computed(() => {
  const all = statusOptions.value.map(o => ({ id: String(o._id), label: o.label, color: o.color, icon: o.icon }))
  if (!stageSearch.value)
    return all
  const sub = stageSearch.value.toLowerCase()
  return all.filter(s => s.label.toLowerCase().includes(sub))
})

async function handleStageSelect(customer: any, optionId: string) {
  if (!optionId)
    return
  customer.status = optionId
  activeDropdown.value = null

  try {
    const res = await $fetch<any>(`/api/pipeline/${customer._id}`, {
      method: 'PUT',
      body: { status: optionId },
    })
    if (res.success) {
      toast.success('Status updated')
      fetchCounts() // refresh chevron counts
    }
    else {
      toast.error('Failed to update status')
    }
  }
  catch (err) {
    toast.error('Error updating status')
  }
}

function getStageClasses(customer: any) {
  const opt = resolveStatus(customer)
  if (!opt || !opt.color)
    return 'bg-muted text-muted-foreground border-border'
  return ''
}

function getStageStyle(customer: any) {
  const opt = resolveStatus(customer)
  if (!opt || !opt.color)
    return {}
  return {
    backgroundColor: `${opt.color}25`,
    color: opt.color,
    borderColor: `${opt.color}50`,
  }
}

// ─── Drag & Drop Status Change ──────────────────────────
const dragCustomer = ref<any>(null)
const dragOverStageId = ref<string | null>(null)

function onRowDragStart(e: DragEvent, customer: any) {
  dragCustomer.value = customer
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', customer._id)
    // Create a small custom drag image
    const ghost = document.createElement('div')
    ghost.textContent = customer.name || 'Customer'
    ghost.style.cssText = 'position:fixed;top:-999px;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;color:#fff;background:hsl(var(--primary));box-shadow:0 4px 20px rgba(0,0,0,0.3);white-space:nowrap;'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }
}

function onRowDragEnd() {
  dragCustomer.value = null
  dragOverStageId.value = null
}

function onStageDragOver(e: DragEvent, stageId: string) {
  e.preventDefault()
  if (e.dataTransfer)
    e.dataTransfer.dropEffect = 'move'
  dragOverStageId.value = stageId
}

function onStageDragLeave() {
  dragOverStageId.value = null
}

async function onStageDrop(e: DragEvent, stageId: string) {
  e.preventDefault()
  dragOverStageId.value = null
  const customer = dragCustomer.value
  dragCustomer.value = null
  if (!customer || stageId === 'all' || stageId === 'uncategorized')
    return
  if (String(customer.status) === stageId)
    return // already in this stage

  // Optimistic update
  customer.status = stageId
  const resolved = statusMap.value.get(stageId)
  const label = resolved?.label || 'status'

  try {
    await $fetch<any>(`/api/pipeline/${customer._id}`, {
      method: 'PUT',
      body: { status: stageId },
    })
    toast.success(`Moved to "${label}"`)
    fetchCounts() // refresh chevron counts
  }
  catch {
    toast.error('Failed to update status')
  }
}

// ─── Client-only data fetch (server: false avoids SSR cookie context loss) ──
// Search & filter state (declared here so fetchCustomers can read them)
const route = useRoute()
const router = useRouter()
const searchQuery = ref((route.query.search as string) || '')
const selectedStageFilter = ref<string>((route.query.status as string) || 'all')

// Pagination / infinite scroll state
const pipelinePage = ref(1)
const pipelineTotalPages = ref(1)
const pipelineTotal = ref(0)
const PIPELINE_LIMIT = 50
const isLoadingMore = ref(false)
const scrollSentinel = ref<HTMLElement | null>(null)

// Aggregate counts from DB (for stage chevrons)
const aggregateCounts = ref<Record<string, number>>({})
const aggregateTotal = ref(0)

async function fetchCounts() {
  try {
    const params = new URLSearchParams()
    if (searchQuery.value?.trim())
      params.set('search', searchQuery.value.trim())
    const res = await $fetch<any>(`/api/pipeline/counts?${params.toString()}`)
    if (res?.success) {
      aggregateCounts.value = res.data.counts || {}
      aggregateTotal.value = res.data.total || 0
    }
  }
  catch { /* silent */ }
}

async function fetchCustomers(targetPage = 1, append = false) {
  if (append) {
    isLoadingMore.value = true
  }
  try {
    const params = new URLSearchParams({
      page: String(targetPage),
      limit: String(PIPELINE_LIMIT),
    })
    if (searchQuery.value?.trim())
      params.set('search', searchQuery.value.trim())
    // Send stage filter to server so pagination applies within the filtered set
    if (selectedStageFilter.value && selectedStageFilter.value !== 'all' && selectedStageFilter.value !== 'uncategorized')
      params.set('status', selectedStageFilter.value)

    const res = await $fetch<any>(`/api/pipeline?${params.toString()}`)
    if (res?.success) {
      if (append) {
        // Deduplicate — avoid adding records already in the list
        const existingIds = new Set(customers.value.map((c: any) => c._id))
        const newRecords = (res.data || []).filter((c: any) => !existingIds.has(c._id))
        customers.value = [...customers.value, ...newRecords]
      }
      else {
        customers.value = res.data || []
      }
      pipelinePage.value = res.pagination?.page || 1
      pipelineTotalPages.value = res.pagination?.totalPages || 1
      pipelineTotal.value = res.pagination?.total || 0
    }
  }
  catch {
    toast.error('Failed to load pipeline')
  }
  finally {
    isLoadingMore.value = false
  }
}

async function loadMore() {
  if (isLoadingMore.value || pipelinePage.value >= pipelineTotalPages.value) return
  await fetchCustomers(pipelinePage.value + 1, true)
}

// IntersectionObserver for infinite scroll
let scrollObserver: IntersectionObserver | null = null

onMounted(() => {
  nextTick(() => {
    if (!scrollSentinel.value) return
    scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '200px' },
    )
    scrollObserver.observe(scrollSentinel.value)
  })
})

onBeforeUnmount(() => {
  scrollObserver?.disconnect()
})

// Watch for sentinel ref becoming available (after loading completes)
watch(scrollSentinel, (el) => {
  scrollObserver?.disconnect()
  if (el) {
    scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '200px' },
    )
    scrollObserver.observe(el)
  }
})

const { pending: loadingData } = useAsyncData('pipeline-page', async () => {
  const [, , statusRes, empRes] = await Promise.all([
    fetchCustomers(1),
    fetchCounts(),
    $fetch<any>('/api/dropdowns?name=Customer Status'),
    $fetch<any>('/api/employees'),
  ])
  // Handle both response shapes: single dropdown object or array of all dropdowns
  if (statusRes?.data) {
    const d = statusRes.data
    if (Array.isArray(d)) {
      // Full list returned (e.g. from SWR cache) — find the matching dropdown
      const match = d.find((dd: any) => dd.name === 'Customer Status')
      if (match?.options)
        statusOptions.value = match.options
    }
    else if (d.options) {
      statusOptions.value = d.options
    }
  }
  if (empRes?.success)
    employeesList.value = empRes.data || []
  return true
}, { server: false, lazy: true })

// Debounce search — re-fetch page 1 + refresh counts
let pipelineSearchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (pipelineSearchTimer)
    clearTimeout(pipelineSearchTimer)
  pipelineSearchTimer = setTimeout(() => {
    // Sync search to URL
    const query: Record<string, string> = {}
    if (searchQuery.value.trim()) query.search = searchQuery.value.trim()
    if (selectedStageFilter.value !== 'all') query.status = selectedStageFilter.value
    router.replace({ query })
    fetchCustomers(1)
    fetchCounts()
  }, 300)
})

function onCustomerCreated(customer: any) {
  fetchCustomers(1)
  fetchCounts()
}

const employeesList = ref<any[]>([])

async function fetchEmployees() {
  try {
    const res = await $fetch<any>('/api/employees')
    if (res?.success) {
      employeesList.value = res.data || []
    }
  }
  catch (error) {
    console.error('Failed to load employees', error)
  }
}

function resolveAssignedTo(assignedTo: string | undefined | null) {
  if (!assignedTo)
    return null
  const emp = employeesList.value.find(e => e.email === assignedTo || e.employee === assignedTo || e._id === assignedTo)
  if (emp)
    return { name: emp.employee, image: emp.profileImage }
  return { name: assignedTo, image: null }
}

function getAssignedToArray(assignedTo: any): string[] {
  if (!assignedTo)
    return []
  if (Array.isArray(assignedTo))
    return assignedTo.filter(Boolean)
  if (typeof assignedTo === 'string')
    return assignedTo.split(/[,;]/).map(s => s.trim()).filter(Boolean)
  return []
}

function getAssignedToNames(assignedTo: any): string {
  const arr = getAssignedToArray(assignedTo)
  if (!arr.length)
    return ''
  return arr.map(a => resolveAssignedTo(a)?.name).filter(Boolean).join(', ')
}

function formatCurrency(val: any) {
  if (val === null || val === undefined || val === '')
    return ''
  const num = Number(val)
  if (isNaN(num))
    return val
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

function formatShortDate(dateString: string) {
  if (!dateString)
    return ''
  const d = new Date(dateString)
  if (isNaN(d.getTime()))
    return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}


const filteredCustomers = computed(() => {
  // Text search is now server-side (sent via fetchCustomers).
  // Client only handles tab-based stage filtering.
  let list = customers.value

  // Filter by selected tab stage
  if (selectedStageFilter.value !== 'all') {
    if (selectedStageFilter.value === 'uncategorized') {
      const knownIds = new Set(STAGES.value.map(s => s.id))
      list = list.filter(c => !c.status || !knownIds.has(String(c.status)))
    }
    else {
      list = list.filter(c => c.status && String(c.status) === selectedStageFilter.value)
    }
  }

  return list.sort((a, b) => {
    const nameA = (a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unknown').toLowerCase()
    const nameB = (b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || 'Unknown').toLowerCase()
    return nameA.localeCompare(nameB)
  })
})

// Dynamic STAGES from dropdown (replaces hardcoded array)
const STAGES = computed(() => {
  return statusOptions.value.map(opt => ({
    id: String(opt._id),
    label: opt.value || opt.label,
    color: opt.color || '#737373',
    icon: opt.icon || '',
  }))
})

// Helper to normalize stages
function normalizeStage(stageStr: string): string {
  if (!stageStr)
    return ''
  return stageStr.trim().toLowerCase()
}

// Pipeline groupings for pipeline header counts (uses DB aggregate counts)
const pipelineGroups = computed(() => {
  const stages = STAGES.value
  const counts = aggregateCounts.value

  // Compute uncategorized count: total - sum of all known stage counts
  const knownIds = new Set(stages.map(s => s.id))
  let knownSum = 0
  for (const [id, c] of Object.entries(counts)) {
    if (knownIds.has(id)) knownSum += c
  }
  const uncategorizedCount = (counts.uncategorized || 0) + (aggregateTotal.value - knownSum - (counts.uncategorized || 0))

  return [
    { stage: { id: 'all', label: 'All', color: '' }, count: aggregateTotal.value },
    ...stages.map(s => ({ stage: s, count: counts[s.id] || 0 })),
    { stage: { id: 'uncategorized', label: 'Uncategorized', color: '#737373' }, count: uncategorizedCount },
  ].filter(g => g.stage.id === 'all' || g.count > 0)
})

// Table grouping (applies both search AND tab filters)
const tableGroupedCustomers = computed(() => {
  const stages = STAGES.value
  const groups: Record<string, any[]> = {}
  stages.forEach(s => groups[s.id] = [])
  groups.uncategorized = []

  filteredCustomers.value.forEach((c) => {
    const statusId = c.status ? String(c.status) : null
    if (!statusId) {
      groups.uncategorized!.push(c)
      return
    }
    if (groups[statusId]) {
      groups[statusId]!.push(c)
    }
    else {
      groups.uncategorized!.push(c)
    }
  })

  return [...stages.map(s => ({ stage: s, items: groups[s.id] || [] })), { stage: { id: 'uncategorized', label: 'Uncategorized', color: '#737373' }, items: groups.uncategorized! },
  ].filter(g => g.items.length > 0)
})

const expandedStages = ref<Record<string, boolean>>({})

watchEffect(() => {
  STAGES.value.forEach((s) => {
    if (expandedStages.value[s.id] === undefined) {
      expandedStages.value[s.id] = true
    }
  })
  if (expandedStages.value.uncategorized === undefined) {
    expandedStages.value.uncategorized = true
  }
})

function getChevronClipPath(isFirst: boolean) {
  if (isFirst) {
    return 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
  }
  return 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)'
}

function selectFilter(id: string) {
  selectedStageFilter.value = id
  if (id !== 'all') {
    expandedStages.value[id] = true
  }
  // Sync URL — preserve search param
  const query: Record<string, string> = {}
  if (searchQuery.value.trim()) query.search = searchQuery.value.trim()
  if (id !== 'all') query.status = id
  navigateTo({ path: '/crm/pipeline', query }, { replace: true })
  // Re-fetch from page 1 with server-side status filter
  fetchCustomers(1)
}

// Sync filter from URL on back/forward navigation
watch(() => route.query.status, (val) => {
  selectedStageFilter.value = (val as string) || 'all'
})

// Sync search from URL on back/forward navigation
watch(() => route.query.search, (val) => {
  const v = (val as string) || ''
  if (v !== searchQuery.value) searchQuery.value = v
})
</script>

<template>
  <div class="h-[calc(100dvh-var(--content-offset))] flex flex-col space-y-4 -mb-4 sm:-mb-6">
    <ClientOnly>
      <Teleport defer to="#header-toolbar">
        <div class="flex items-center gap-2 sm:gap-3 w-full max-w-xl pr-2">
          <div class="relative flex-1">
            <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by customer, project, email, phone..."
              class="w-full h-8 sm:h-9 pl-8 sm:pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            >
          </div>
          <!-- Bulk Delete (shown when items selected) -->
          <button
            v-if="selectedIds.size > 0 && canDelete()"
            class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-destructive/10 text-destructive text-xs sm:text-sm font-bold hover:bg-destructive/20 transition-all shrink-0 border border-destructive/30"
            @click="showBulkDeleteConfirm = true"
          >
            <Icon name="i-lucide-trash-2" class="size-3.5" />
            <span class="hidden sm:inline">Delete</span>
            <span class="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-destructive/20 tabular-nums">{{ selectedIds.size }}</span>
          </button>
          <button
            v-if="canCreate()"
            class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shrink-0 shadow-lg shadow-primary/20"
            @click="showCreateModal = true"
          >
            <Icon name="i-lucide-plus" class="size-3.5" />
            <span class="hidden sm:inline">New</span>
          </button>
          <button
            class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 border border-border"
            :class="isQuickEditMode ? 'bg-primary/20 text-primary border-primary/30' : 'bg-background hover:bg-muted text-muted-foreground'"
            @click="isQuickEditMode = !isQuickEditMode"
          >
            <Icon :name="isQuickEditMode ? 'i-lucide-check' : 'i-lucide-edit-3'" class="size-3.5" />
            <span class="hidden sm:inline">{{ isQuickEditMode ? 'Done' : 'Quick Edit' }}</span>
          </button>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- Loading State -->
    <div v-if="loadingData" class="flex-1 flex flex-col gap-4">
      <div class="flex gap-2 overflow-hidden rounded-xl border border-border/50 bg-card p-2">
        <div v-for="i in 5" :key="i" class="h-10 flex-1 bg-muted/40 rounded-lg animate-pulse" />
      </div>
      <div class="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="space-y-3">
          <div class="h-20 bg-muted/30 rounded-xl animate-pulse" />
          <div class="h-16 bg-muted/20 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
    <div v-if="!loadingData">
      <!-- Pipeline Headers as Filters -->
      <div class="flex overflow-x-auto w-full scrollbar-hide text-xs whitespace-nowrap select-none bg-card rounded-xl overflow-hidden border border-border/50 shadow-sm mb-4">
        <div
          v-for="(g, idx) in pipelineGroups" :key="g.stage.id"
          class="relative -ml-3 first:ml-0 first:pl-2 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer origin-center"
          :class="[
            selectedStageFilter === g.stage.id ? 'z-50 scale-[1.12]' : 'opacity-70 hover:opacity-100 hover:brightness-110 hover:scale-[1.03]',
            dragOverStageId === g.stage.id && g.stage.id !== 'all' ? 'drop-target-active !opacity-100 !scale-[1.2] !z-[60]' : '',
            dragCustomer && g.stage.id !== 'all' ? 'drop-target-ready' : '',
          ]"
          :style="{ zIndex: dragOverStageId === g.stage.id ? 60 : (selectedStageFilter === g.stage.id ? 50 : pipelineGroups.length - idx) }"
          @click="selectFilter(g.stage.id)"
          @dragover="onStageDragOver($event, g.stage.id)"
          @dragleave="onStageDragLeave"
          @drop="onStageDrop($event, g.stage.id)"
        >
          <!-- ACTIVE STATE (Rotating Conic Edge) -->
          <div v-if="selectedStageFilter === g.stage.id" class="relative flex items-center justify-center h-12 pl-6 pr-6">
            <!-- INVISIBLE TEXT FORCING EXACT WIDTH -->
            <div class="flex flex-col items-center justify-center pt-0.5 opacity-0 pointer-events-none">
              <span class="font-bold text-[13px] leading-tight">{{ g.count }}</span>
              <span class="text-[8px] uppercase tracking-wider leading-[1.1] text-center max-w-[90px] line-clamp-2 whitespace-normal">{{ g.stage.label }}</span>
            </div>

            <!-- OUTER BORDER MASK (Clipped) -->
            <div class="absolute inset-0 overflow-hidden" :style="{ clipPath: getChevronClipPath(idx === 0) }">
              <div class="absolute inset-0 brightness-[0.7]" :style="{ backgroundColor: g.stage.color || 'hsl(var(--primary))' }" />
              <div class="absolute inset-[-100%] bg-[conic-gradient(from_0deg,transparent_0_300deg,white_360deg)] animate-[spin_2s_linear_infinite]" />
            </div>

            <!-- INNER CONTENT (Inset by 2.5px to reveal outer mask) -->
            <div
              class="absolute inset-[2.5px] transition-all flex flex-col items-center justify-center pt-0.5 brightness-110"
              :style="{ clipPath: getChevronClipPath(idx === 0), backgroundColor: g.stage.color || 'hsl(var(--primary))' }"
            >
              <span class="font-bold text-[13px] leading-tight text-white">{{ g.count }}</span>
              <span class="text-[8px] uppercase tracking-wider text-center max-w-[90px] leading-[1.1] line-clamp-2 whitespace-normal font-bold text-white" :title="g.stage.label">{{ g.stage.label }}</span>
            </div>
          </div>

          <!-- INACTIVE STATE (Standard) -->
          <div
            v-else class="flex items-center justify-center h-12 pl-6 pr-6 w-full transition-all duration-300"
            :style="{ clipPath: getChevronClipPath(idx === 0), backgroundColor: g.stage.color || 'hsl(var(--primary))' }"
          >
            <div class="flex flex-col items-center justify-center pt-0.5">
              <span class="font-bold text-[13px] leading-tight text-white">{{ g.count }}</span>
              <span class="text-[8px] uppercase tracking-wider leading-[1.1] text-center max-w-[90px] line-clamp-2 whitespace-normal font-bold text-white" :title="g.stage.label">{{ g.stage.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Table Details Desktop -->
      <div class="hidden lg:block flex-1 min-h-0 overflow-auto bg-card border border-border/50 rounded-xl text-sm shadow-sm relative">
        <table class="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr class="border-b bg-card text-muted-foreground text-[10px] font-bold uppercase tracking-wider sticky top-0 z-20">
              <th class="p-2.5 w-10 text-center">
                <input type="checkbox" class="rounded border-border text-primary cursor-pointer" :checked="isAllSelected" @change="toggleSelectAll">
              </th>
              <th class="p-2.5 min-w-[200px]">
                Customer
              </th>
              <th class="p-2.5 min-w-[160px]">
                Project Name
              </th>
              <th class="p-2.5 w-16 min-w-[60px] text-center">
                Stage
              </th>
              <th class="p-2.5 min-w-[100px]">
                Est. Duration
              </th>
              <th class="p-2.5 min-w-[120px]">
                Total Estimate
              </th>
              <th class="p-2.5 min-w-[140px]">
                Assigned To
              </th>
              <th class="p-2.5 min-w-[80px] text-center">
                Views
              </th>
              <th class="p-2.5 min-w-[120px]">
                Estimate Sent On
              </th>

              <th class="p-2.5 min-w-[100px]">
                Contact Date
              </th>
              <th class="p-2.5 min-w-[100px]">
                Follow-Up On
              </th>
              <th class="p-2.5 min-w-[100px]">
                Date Approved
              </th>
              <th class="p-2.5 min-w-[140px]">
                Crew
              </th>
              <th class="p-2.5 min-w-[100px]">
                Wood Ordered
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in filteredCustomers" :key="c._id"
              class="border-b border-border/30 last:border-0 text-[13px] transition-colors group/row hover:bg-muted/20 cursor-pointer"
              :class="[
                dragCustomer?._id === c._id ? 'opacity-40 scale-[0.98] bg-primary/5' : '',
                selectedIds.has(c._id) ? '!bg-primary/5' : '',
              ]"
              draggable="true"
              @dragstart="onRowDragStart($event, c)"
              @dragend="onRowDragEnd"
              @click="navigateTo(`/crm/pipeline/${c._id}`)"
            >
              <td class="p-2.5 text-center px-4" @click.stop>
                <input type="checkbox" class="rounded border-border text-primary cursor-pointer" :checked="selectedIds.has(c._id)" @change="toggleSelect(c._id)">
              </td>
              <td class="p-2.5 max-w-[200px] relative" :class="isQuickEditMode ? 'whitespace-normal' : 'truncate'" @click="isQuickEditMode && $event.stopPropagation()">
                <span class="font-semibold text-foreground/90 truncate flex-1 block">
                  <input v-if="isQuickEditMode" v-model="c.name" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" @change="handleQuickUpdate(c, 'name', $event)">
                  <template v-else>
                    {{ c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown' }}
                  </template>
                </span>
              </td>
              <td class="p-2.5 max-w-[160px]" :class="isQuickEditMode ? 'whitespace-normal' : 'truncate'" @click="isQuickEditMode && $event.stopPropagation()">
                <span class="text-foreground/80 truncate flex-1 block">
                  <input v-if="isQuickEditMode" v-model="c.projectName" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Project name..." @change="handleQuickUpdate(c, 'projectName', $event)">
                  <template v-else>
                    {{ c.projectName || '—' }}
                  </template>
                </span>
              </td>
              <td class="p-2.5" @click.stop>
                <!-- Stage Combobox -->
                <div class="relative w-full flex justify-center" :class="activeDropdown === `${c._id}stage` ? 'z-[100]' : 'z-10'">
                  <button
                    class="size-5 rounded-full shadow-sm hover:scale-110 transition-transform focus:outline-none ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center cursor-pointer shrink-0 border"
                    :style="getStageStyle(c)"
                    :class="getStageClasses(c)"
                    :title="getStatusName(c) || 'Set Status'"
                    @click.stop="activeDropdown = activeDropdown === `${c._id}stage` ? null : `${c._id}stage`"
                  >
                    <Icon v-if="!c.status" name="i-lucide-plus" class="size-3 text-muted-foreground opacity-70" />
                    <Icon v-else-if="resolveStatus(c)?.icon" :name="resolveStatus(c)!.icon" class="size-3" />
                  </button>

                  <div v-if="activeDropdown === `${c._id}stage`" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
                  <div v-if="activeDropdown === `${c._id}stage`" class="absolute left-1/2 -translate-x-1/2 mt-2 top-full min-w-[200px] max-w-[240px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div class="p-2 border-b border-border/50">
                      <input ref="stageSearchInput" v-model="stageSearch" type="text" placeholder="Search status..." class="w-full bg-background border border-border/50 rounded filter-none px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary font-medium" @click.stop>
                    </div>
                    <div class="max-h-[200px] overflow-y-auto py-1.5">
                      <button v-for="st in filteredStageOptions" :key="st.id" class="w-full text-left px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-muted/60 transition-colors flex items-center gap-2" :style="{ color: st.color || '' }" @click.stop="handleStageSelect(c, st.id)">
                        <Icon v-if="st.icon" :name="st.icon" class="size-3.5" />
                        <span class="truncate">{{ st.label }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </td>

              <td class="p-2.5 text-muted-foreground" :class="{ 'whitespace-normal': isQuickEditMode }">
                <input v-if="isQuickEditMode" v-model="c.estimatedProjectDuration" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" @change="handleQuickUpdate(c, 'estimatedProjectDuration', $event)">
                <template v-else>
                  {{ c.estimatedProjectDuration || '' }}
                </template>
              </td>

              <td class="p-2.5 tabular-nums font-medium text-foreground/80">
                <input v-if="isQuickEditMode" v-model="c.totalEstimate" type="number" step="0.01" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" @change="handleQuickUpdate(c, 'totalEstimate', $event)">
                <template v-else>
                  {{ formatCurrency(c.totalEstimate) }}
                </template>
              </td>

              <td class="p-2.5">
                <div v-if="isQuickEditMode" class="relative w-full transition-all" :class="[activeDropdown === `${c._id}assignedTo` ? 'z-[100]' : 'z-10']">
                  <div v-if="activeDropdown === `${c._id}assignedTo`" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />

                  <div
                    class="relative z-50 w-full bg-background border border-border/50 rounded px-2 py-1.5 flex flex-wrap gap-1 items-center min-h-[30px] cursor-pointer hover:border-primary/50 transition-colors"
                    @click.stop="activeDropdown = activeDropdown === `${c._id}assignedTo` ? null : `${c._id}assignedTo`"
                  >
                    <div
                      v-for="assignee in getAssignedToArray(c.assignedTo)" :key="assignee"
                      class="text-[10px] bg-primary/10 text-primary pl-1.5 pr-1 py-0.5 rounded-full flex items-center gap-1 font-bold border border-primary/20 max-w-[120px]"
                    >
                      <img v-if="resolveAssignedTo(assignee)?.image" :src="resolveAssignedTo(assignee)!.image" class="size-3.5 rounded-full object-cover shrink-0">
                      <span class="truncate">{{ resolveAssignedTo(assignee)?.name }}</span>
                      <div class="hover:bg-primary/20 rounded-full p-0.5 ml-0.5 shrink-0" @click.stop="removeAssignee(c, 'assignedTo', assignee)">
                        <Icon name="i-lucide-x" class="size-3 text-primary/70 hover:text-red-500 transition-colors" />
                      </div>
                    </div>
                    <div v-if="!getAssignedToArray(c.assignedTo).length" class="text-[11px] text-muted-foreground w-full">
                      Select employees...
                    </div>
                  </div>

                  <div
                    v-if="activeDropdown === `${c._id}assignedTo`"
                    class="absolute left-0 top-full mt-1 w-[220px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 max-h-[220px] overflow-y-auto flex flex-col py-1.5 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div
                      v-for="emp in employeesList" :key="emp.email"
                      class="px-3 py-2 text-xs cursor-pointer font-medium flex items-center gap-2.5 transition-colors"
                      :class="getAssignedToArray(c.assignedTo).includes(emp.email) ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-foreground/80 hover:text-foreground'"
                      @click.stop="toggleAssignee(c, 'assignedTo', emp.email)"
                    >
                      <img v-if="emp.profileImage" :src="emp.profileImage" class="size-6 rounded-full object-cover border border-border/50">
                      <div v-else class="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] uppercase font-bold text-muted-foreground border border-border/50 shadow-sm">
                        {{ emp.employee?.substring(0, 2) }}
                      </div>

                      <div class="flex flex-col min-w-0">
                        <span class="truncate text-[13px] leading-tight font-bold">{{ emp.employee }}</span>
                        <span class="text-[9px] opacity-70 truncate">{{ emp.email }}</span>
                      </div>
                      <Icon v-if="getAssignedToArray(c.assignedTo).includes(emp.email)" name="i-lucide-check-circle-2" class="ml-auto size-4 shrink-0" />
                    </div>
                    <div v-if="!employeesList.length" class="px-3 py-4 text-xs text-muted-foreground text-center flex flex-col items-center gap-2">
                      <Icon name="i-lucide-users" class="size-5 opacity-40" />
                      No employees found
                    </div>
                  </div>
                </div>

                <template v-else>
                  <div v-if="getAssignedToArray(c.assignedTo).length" class="flex items-center" :class="{ '-space-x-1.5': getAssignedToArray(c.assignedTo).length > 1, 'gap-2': getAssignedToArray(c.assignedTo).length === 1 }">
                    <div
                      v-for="assignee in getAssignedToArray(c.assignedTo).slice(0, 3)" :key="assignee"
                      class="relative flex-shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold uppercase text-primary border-2 border-card shadow-sm hover:z-10 transition-transform hover:scale-110 cursor-help"
                      :title="resolveAssignedTo(assignee)?.name"
                    >
                      <img v-if="resolveAssignedTo(assignee)?.image" :src="resolveAssignedTo(assignee)!.image" class="w-full h-full rounded-full object-cover">
                      <span v-else>{{ resolveAssignedTo(assignee)?.name.substring(0, 1) }}</span>
                    </div>
                    <div v-if="getAssignedToArray(c.assignedTo).length > 3" class="relative flex-shrink-0 size-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground border-2 border-card shadow-sm z-0">
                      +{{ getAssignedToArray(c.assignedTo).length - 3 }}
                    </div>
                    <span class="text-xs truncate max-w-[150px] ml-1" :title="getAssignedToNames(c.assignedTo)">
                      {{ getAssignedToNames(c.assignedTo) }}
                    </span>
                  </div>
                </template>
              </td>

              <td class="p-2.5 tabular-nums text-center text-muted-foreground">
                <input v-if="isQuickEditMode" v-model="c.totalTrackedViews" type="number" class="w-full text-center bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" @change="handleQuickUpdate(c, 'totalTrackedViews', $event)">
                <template v-else>
                  {{ c.totalTrackedViews || 0 }}
                </template>
              </td>

              <td class="p-2.5 tabular-nums text-muted-foreground">
                <input v-if="isQuickEditMode" type="date" :value="c.estimateSentOn ? new Date(c.estimateSentOn).toISOString().split('T')[0] : ''" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" @change="handleQuickUpdate(c, 'estimateSentOn', $event)">
                <template v-else>
                  {{ formatShortDate(c.estimateSentOn) }}
                </template>
              </td>

              <td class="p-2.5 tabular-nums text-muted-foreground">
                <input v-if="isQuickEditMode" type="date" :value="c.initialContactDate ? new Date(c.initialContactDate).toISOString().split('T')[0] : ''" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" @change="handleQuickUpdate(c, 'initialContactDate', $event)">
                <template v-else>
                  {{ formatShortDate(c.initialContactDate) }}
                </template>
              </td>

              <td class="p-2.5 tabular-nums text-muted-foreground">
                <input v-if="isQuickEditMode" type="date" :value="c.lastFollowUpSentOn ? new Date(c.lastFollowUpSentOn).toISOString().split('T')[0] : ''" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" @change="handleQuickUpdate(c, 'lastFollowUpSentOn', $event)">
                <template v-else>
                  {{ formatShortDate(c.lastFollowUpSentOn) }}
                </template>
              </td>

              <td class="p-2.5 tabular-nums text-muted-foreground">
                <input v-if="isQuickEditMode" type="date" :value="c.dateApproved ? new Date(c.dateApproved).toISOString().split('T')[0] : ''" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" @change="handleQuickUpdate(c, 'dateApproved', $event)">
                <template v-else>
                  {{ formatShortDate(c.dateApproved) }}
                </template>
              </td>

              <td class="p-2.5">
                <div v-if="isQuickEditMode" class="relative w-full transition-all" :class="[activeDropdown === `${c._id}projectAssignedTo` ? 'z-[100]' : 'z-10']">
                  <div v-if="activeDropdown === `${c._id}projectAssignedTo`" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />

                  <div
                    class="relative z-50 w-full bg-background border border-border/50 rounded px-2 py-1.5 flex flex-wrap gap-1 items-center min-h-[30px] cursor-pointer hover:border-primary/50 transition-colors"
                    @click.stop="activeDropdown = activeDropdown === `${c._id}projectAssignedTo` ? null : `${c._id}projectAssignedTo`"
                  >
                    <div
                      v-for="assignee in getAssignedToArray(c.projectAssignedTo)" :key="assignee"
                      class="text-[10px] bg-primary/10 text-primary pl-1.5 pr-1 py-0.5 rounded-full flex items-center gap-1 font-bold border border-primary/20 max-w-[120px]"
                    >
                      <img v-if="resolveAssignedTo(assignee)?.image" :src="resolveAssignedTo(assignee)!.image" class="size-3.5 rounded-full object-cover shrink-0">
                      <span class="truncate">{{ resolveAssignedTo(assignee)?.name }}</span>
                      <div class="hover:bg-primary/20 rounded-full p-0.5 ml-0.5 shrink-0" @click.stop="removeAssignee(c, 'projectAssignedTo', assignee)">
                        <Icon name="i-lucide-x" class="size-3 text-primary/70 hover:text-red-500 transition-colors" />
                      </div>
                    </div>
                    <div v-if="!getAssignedToArray(c.projectAssignedTo).length" class="text-[11px] text-muted-foreground w-full">
                      Select employees...
                    </div>
                  </div>

                  <div
                    v-if="activeDropdown === `${c._id}projectAssignedTo`"
                    class="absolute left-0 top-full mt-1 w-[220px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 max-h-[220px] overflow-y-auto flex flex-col py-1.5 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div
                      v-for="emp in employeesList" :key="emp.email"
                      class="px-3 py-2 text-xs cursor-pointer font-medium flex items-center gap-2.5 transition-colors"
                      :class="getAssignedToArray(c.projectAssignedTo).includes(emp.email) ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-foreground/80 hover:text-foreground'"
                      @click.stop="toggleAssignee(c, 'projectAssignedTo', emp.email)"
                    >
                      <img v-if="emp.profileImage" :src="emp.profileImage" class="size-6 rounded-full object-cover border border-border/50">
                      <div v-else class="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] uppercase font-bold text-muted-foreground border border-border/50 shadow-sm">
                        {{ emp.employee?.substring(0, 2) }}
                      </div>

                      <div class="flex flex-col min-w-0">
                        <span class="truncate text-[13px] leading-tight font-bold">{{ emp.employee }}</span>
                        <span class="text-[9px] opacity-70 truncate">{{ emp.email }}</span>
                      </div>
                      <Icon v-if="getAssignedToArray(c.projectAssignedTo).includes(emp.email)" name="i-lucide-check-circle-2" class="ml-auto size-4 shrink-0" />
                    </div>
                    <div v-if="!employeesList.length" class="px-3 py-4 text-xs text-muted-foreground text-center flex flex-col items-center gap-2">
                      <Icon name="i-lucide-users" class="size-5 opacity-40" />
                      No employees found
                    </div>
                  </div>
                </div>

                <template v-else>
                  <div v-if="getAssignedToArray(c.projectAssignedTo).length" class="flex items-center" :class="{ '-space-x-1.5': getAssignedToArray(c.projectAssignedTo).length > 1, 'gap-2': getAssignedToArray(c.projectAssignedTo).length === 1 }">
                    <div
                      v-for="assignee in getAssignedToArray(c.projectAssignedTo).slice(0, 3)" :key="assignee"
                      class="relative flex-shrink-0 size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold uppercase text-primary border-2 border-card shadow-sm hover:z-10 transition-transform hover:scale-110 cursor-help"
                      :title="resolveAssignedTo(assignee)?.name"
                    >
                      <img v-if="resolveAssignedTo(assignee)?.image" :src="resolveAssignedTo(assignee)!.image" class="w-full h-full rounded-full object-cover">
                      <span v-else>{{ resolveAssignedTo(assignee)?.name.substring(0, 1) }}</span>
                    </div>
                    <div v-if="getAssignedToArray(c.projectAssignedTo).length > 3" class="relative flex-shrink-0 size-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground border-2 border-card shadow-sm z-0">
                      +{{ getAssignedToArray(c.projectAssignedTo).length - 3 }}
                    </div>
                    <span class="text-xs truncate max-w-[150px] ml-1" :title="getAssignedToNames(c.projectAssignedTo)">
                      {{ getAssignedToNames(c.projectAssignedTo) }}
                    </span>
                  </div>
                </template>
              </td>

              <td class="p-2.5 tabular-nums text-muted-foreground">
                <input v-if="isQuickEditMode" type="date" :value="c.woodOrderDate ? new Date(c.woodOrderDate).toISOString().split('T')[0] : ''" class="w-full bg-background border border-border/50 rounded px-2 py-1.5 outline-none focus:border-primary" @change="handleQuickUpdate(c, 'woodOrderDate', $event)">
                <template v-else>
                  {{ formatShortDate(c.woodOrderDate) }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Infinite Scroll Sentinel -->
        <div ref="scrollSentinel" class="h-1 w-full" />

        <!-- Loading More Indicator -->
        <div v-if="isLoadingMore" class="flex items-center justify-center gap-2 py-4">
          <Icon name="i-lucide-loader-2" class="size-4 animate-spin text-primary" />
          <span class="text-xs font-medium text-muted-foreground">Loading more...</span>
        </div>

        <!-- All Loaded Message -->
        <div v-else-if="pipelinePage >= pipelineTotalPages && customers.length > 0" class="py-3 text-center">
          <span class="text-[11px] font-medium text-muted-foreground/60">Showing {{ customers.length }} of {{ pipelineTotal }} records</span>
        </div>
      </div>

      <!-- Mobile Card View -->
      <div class="block lg:hidden flex-1 min-h-0 overflow-auto bg-muted/10 pb-16">
        <div class="flex flex-col gap-3 p-3">
          <div
            v-for="c in filteredCustomers"
            :key="c._id"
            class="bg-card border border-border/60 rounded-xl p-3 shadow-sm flex flex-col gap-2 relative transition-colors hover:bg-muted/20 cursor-pointer"
            @click="navigateTo(`/crm/pipeline/${c._id}`)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-col min-w-0 flex-1 gap-2">
                <div class="flex flex-col gap-1 min-w-0">
                  <span class="text-sm font-bold text-foreground truncate">{{ c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown' }}</span>
                  <span v-if="c.projectName" class="text-[11px] text-primary/80 font-semibold truncate block w-full">{{ c.projectName }}</span>
                  <span class="text-[11px] text-muted-foreground truncate block w-full">{{ c.email || c.phone || '—' }}</span>
                </div>
                <!-- Stage Combobox Mobile -->
                <div class="relative shrink-0 flex items-center justify-center mr-2 lg:mr-0" :class="activeDropdown === `${c._id}stage-mobile` ? 'z-[100]' : 'z-10'">
                  <button
                    class="size-6 rounded-full shadow-sm hover:scale-110 transition-transform focus:outline-none ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center cursor-pointer shrink-0 border"
                    :style="getStageStyle(c)"
                    :class="getStageClasses(c)"
                    :title="getStatusName(c) || 'Set Status'"
                    @click.stop="activeDropdown = activeDropdown === `${c._id}stage-mobile` ? null : `${c._id}stage-mobile`"
                  >
                    <Icon v-if="!c.status" name="i-lucide-plus" class="size-3.5 text-muted-foreground opacity-70" />
                    <Icon v-else-if="resolveStatus(c)?.icon" :name="resolveStatus(c)!.icon" class="size-3.5" />
                  </button>

                  <div v-if="activeDropdown === `${c._id}stage-mobile`" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
                  <div v-if="activeDropdown === `${c._id}stage-mobile`" class="absolute right-0 mt-2 top-full min-w-[200px] max-w-[240px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div class="p-2 border-b border-border/50">
                      <input ref="stageSearchInput" v-model="stageSearch" type="text" placeholder="Search status..." class="w-full bg-background border border-border/50 rounded filter-none px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary font-medium" @click.stop>
                    </div>
                    <div class="max-h-[200px] overflow-y-auto py-1.5">
                      <button v-for="st in filteredStageOptions" :key="st.id" class="w-full text-left px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-muted/60 transition-colors flex items-center gap-2" :style="{ color: st.color || '' }" @click.stop="handleStageSelect(c, st.id)">
                        <Icon v-if="st.icon" :name="st.icon" class="size-3.5" />
                        <span class="truncate">{{ st.label }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="text-right flex flex-col items-end shrink-0 pt-0.5">
                <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Est. Total</span>
                <span class="text-xs font-medium tabular-nums">{{ formatCurrency(c.totalEstimate) || '—' }}</span>
              </div>
            </div>

            <!-- Content details block -->
            <div class="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2 rounded-lg border border-border/40 mt-1">
              <div class="flex flex-col justify-center min-w-0 gap-1.5">
                <div class="flex items-center text-[11px]">
                  <span class="text-muted-foreground font-bold pr-1.5">Contact:</span>
                  <span class="font-medium truncate">{{ formatShortDate(c.initialContactDate) || '—' }}</span>
                </div>
                <div class="flex items-center text-[11px]">
                  <span class="text-muted-foreground font-bold pr-1.5">Views:</span>
                  <span class="font-medium tabular-nums">{{ c.totalTrackedViews || 0 }}</span>
                </div>
              </div>
              <div class="flex flex-col min-w-0 gap-1 pl-2 border-l border-border/40">
                <div class="flex flex-col justify-center h-full">
                  <span class="text-[9px] text-muted-foreground uppercase font-bold mb-1">Assigned To</span>
                  <div v-if="getAssignedToArray(c.assignedTo).length" class="flex items-center" :class="{ '-space-x-1.5': getAssignedToArray(c.assignedTo).length > 1, 'gap-1.5': getAssignedToArray(c.assignedTo).length === 1 }">
                    <div
                      v-for="assignee in getAssignedToArray(c.assignedTo).slice(0, 3)" :key="assignee"
                      class="relative flex-shrink-0 size-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold uppercase text-primary border border-card shadow-sm z-10"
                      :title="resolveAssignedTo(assignee)?.name"
                    >
                      <img v-if="resolveAssignedTo(assignee)?.image" :src="resolveAssignedTo(assignee)!.image" class="w-full h-full rounded-full object-cover">
                      <span v-else>{{ resolveAssignedTo(assignee)?.name.substring(0, 1) }}</span>
                    </div>
                    <div v-if="getAssignedToArray(c.assignedTo).length > 3" class="relative flex-shrink-0 size-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground border border-card shadow-sm z-0">
                      +{{ getAssignedToArray(c.assignedTo).length - 3 }}
                    </div>
                    <span class="text-[10px] font-medium truncate max-w-[80px] ml-1.5" :title="getAssignedToNames(c.assignedTo)">
                      {{ getAssignedToNames(c.assignedTo) }}
                    </span>
                  </div>
                  <span v-else class="text-[10px] text-muted-foreground mt-0.5 font-medium">—</span>
                </div>
              </div>
            </div>

            <!-- Footer/Actions -->
            <div class="pt-2.5 flex items-center justify-between gap-2 border-t border-border/40 mt-1.5">
              <div class="text-[10px] text-muted-foreground font-medium flex gap-2">
                <span>Sent: {{ formatShortDate(c.estimateSentOn) || '—' }}</span>
              </div>
              <button class="h-6 px-2.5 rounded border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider transition-colors" @click.stop="navigateTo(`/crm/pipeline/${c._id}`)">
                View Full
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <CrmCustomerFormDialog
    v-model="showCreateModal"
    @saved="onCustomerCreated"
  />

  <!-- Bulk Delete Confirmation -->
  <AlertDialog :open="showBulkDeleteConfirm" @update:open="v => showBulkDeleteConfirm = v">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {{ selectedIds.size }} Customer{{ selectedIds.size !== 1 ? 's' : '' }}</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete {{ selectedIds.size }} selected customer{{ selectedIds.size !== 1 ? 's' : '' }}? This action cannot be undone and all associated data will be permanently removed.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="isBulkDeleting">
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          :disabled="isBulkDeleting"
          @click="bulkDeleteSelected"
        >
          <Icon v-if="isBulkDeleting" name="i-lucide-loader-2" class="size-3.5 mr-1.5 animate-spin" />
          <Icon v-else name="i-lucide-trash-2" class="size-3.5 mr-1.5" />
          {{ isBulkDeleting ? 'Deleting...' : 'Delete All' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Drag & Drop Animations */
.drop-target-ready {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
}

.drop-target-active {
  filter: brightness(1.3) drop-shadow(0 0 12px currentColor);
  animation: drop-pulse 0.8s ease-in-out infinite;
}

@keyframes drop-pulse {
  0%, 100% { filter: brightness(1.3) drop-shadow(0 0 8px currentColor); }
  50% { filter: brightness(1.5) drop-shadow(0 0 18px currentColor); }
}

tr[draggable='true'] {
  cursor: grab;
}

tr[draggable='true']:active {
  cursor: grabbing;
}

/*
  We simulate a smooth animated rolling ring/border that organically traces the clip path
  by rotating dual high-intensity drop-shadow coordinates!
*/
.chevron-glow {
  animation: roll-glow 3s linear infinite;
}

.dark .chevron-glow {
  animation: roll-glow-dark 3s linear infinite;
}

@keyframes roll-glow {
  0%   { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(6px 0 6px rgba(255, 255, 255, 0.8)); }
  25%  { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 6px 6px rgba(255, 255, 255, 0.8)); }
  50%  { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(-6px 0 6px rgba(255, 255, 255, 0.8)); }
  75%  { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 -6px 6px rgba(255, 255, 255, 0.8)); }
  100% { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(6px 0 6px rgba(255, 255, 255, 0.8)); }
}

@keyframes roll-glow-dark {
  0%   { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(6px 0 6px rgba(255, 255, 255, 0.5)); }
  25%  { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 6px 6px rgba(255, 255, 255, 0.5)); }
  50%  { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(-6px 0 6px rgba(255, 255, 255, 0.5)); }
  75%  { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 -6px 6px rgba(255, 255, 255, 0.5)); }
  100% { filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(6px 0 6px rgba(255, 255, 255, 0.5)); }
}
</style>
