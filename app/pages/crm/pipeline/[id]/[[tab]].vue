<script setup lang="ts">
import { format } from 'date-fns'
import { toast } from 'vue-sonner'

const { canCreate, canUpdate, canDelete } = usePermissions('/crm/pipeline')

definePageMeta({
  key: route => route.params.id as string,
})

const route = useRoute()
const customerId = route.params.id as string

const customer = ref<any>(null)

interface StatusOption { _id: string, label: string, value: string, color: string, icon: string, order: number }
const statusOptions = ref<StatusOption[]>([])

const { setHeader } = usePageHeader()

function updateHeader(cust: any) {
  if (!cust)
    return
  setHeader({
    title: cust.name || `${cust.firstName || ''} ${cust.lastName || ''}`.trim() || 'Customer Profile',
    icon: 'i-lucide-user',
    description: cust.email || cust.phone || 'Customer Profile',
  })
}

const { updateSubmission } = useCrmSubmissions()

const allSubmissions = ref<any[]>([])
const loadingAllSubmissions = ref(false)

// ─── Computed slices per column ────────────────────────────────────────────
const relatedQuotes = computed(() => allSubmissions.value.filter(s => s.type === 'flooring-estimate'))
const relatedFastQuotes = computed(() => allSubmissions.value.filter(s => s.type === 'fast-quote'))

// ─── Related Appointments (Calendly bookings for this contact) ─────────────
const relatedAppointments = computed(() => allSubmissions.value
  .filter(s => s.type === 'appointment' && s.gfFormId === 0)
  .sort((a, b) => {
    const ta = new Date(a.fields?.meetingScheduled?.startTime || a.dateSubmitted).getTime()
    const tb = new Date(b.fields?.meetingScheduled?.startTime || b.dateSubmitted).getTime()
    return tb - ta
  }))

type AptState = 'active' | 'rescheduled' | 'canceled' | 'completed'

function getAptState(item: any): AptState {
  const meeting = item?.fields?.meetingScheduled
  if (meeting?.rescheduled)
    return 'rescheduled'
  if (meeting?.eventStatus === 'canceled' || item?.status === 'archived')
    return 'canceled'
  if (item?.status === 'completed')
    return 'completed'
  return 'active'
}

const APT_STATE_BADGES: Record<AptState, string> = {
  active: 'bg-sky-500/15 text-sky-600',
  completed: 'bg-emerald-500/15 text-emerald-600',
  rescheduled: 'bg-zinc-500/15 text-zinc-500',
  canceled: 'bg-red-500/15 text-red-600',
}

function getAptIcon(item: any): string {
  const t = item?.fields?.appointmentType || ''
  const name = (item?.formName || '').toLowerCase()
  if (t === 'in-home' || /in[\s-]?home/.test(name))
    return 'i-lucide-home'
  if (t === 'phone' || /phone|call|consult/.test(name))
    return 'i-lucide-phone'
  return 'i-lucide-calendar'
}

// ─── Related Estimates (from hardwoodDB_Estimates collection) ──────────────
const relatedEstimates = ref<any[]>([])
const loadingEstimates = ref(false)

const latestEstimate = computed(() => {
  if (!relatedEstimates.value || relatedEstimates.value.length === 0) return null
  return [...relatedEstimates.value].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
})

const ESTIMATE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/15 text-zinc-500',
  sent: 'bg-blue-500/15 text-blue-500',
  approved: 'bg-emerald-500/15 text-emerald-600',
  change_request: 'bg-amber-500/15 text-amber-600',
  declined: 'bg-red-500/15 text-red-500',
  completed: 'bg-green-500/15 text-green-600',
  cancelled: 'bg-red-500/15 text-red-500',
}
const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', approved: 'Approved',
  change_request: 'Change Request', declined: 'Declined',
  completed: 'Completed', cancelled: 'Cancelled',
}

async function fetchRelatedEstimates() {
  loadingEstimates.value = true
  try {
    const res = await $fetch<any>(`/api/estimates?projectId=${customerId}&limit=100`)
    relatedEstimates.value = res.data || []
  }
  catch { console.error('Failed to load estimates') }
  finally { loadingEstimates.value = false }
}

async function fetchAllData(email: string, phone: string) {
  if (!email && !phone) { allSubmissions.value = []; return }
  loadingAllSubmissions.value = true
  try {
    const q = new URLSearchParams()
    if (email)
      q.append('email', email)
    if (phone)
      q.append('phone', phone)
    q.append('limit', '500')
    const res = await $fetch<any>(`/api/crm/submissions?${q.toString()}`)
    if (res.success)
      allSubmissions.value = res.data || []
  }
  catch {
    toast.error('Failed to load submissions')
  }
  finally {
    loadingAllSubmissions.value = false
  }
}

const customerContracts = ref<any[]>([])
const loadingContracts = ref(false)

async function fetchCustomerContracts() {
  loadingContracts.value = true
  try {
    const res = await $fetch<any>(`/api/contracts?customerId=${customerId}`)
    if (res.success)
      customerContracts.value = res.data || []
  }
  catch {
    console.error('Failed to load contracts')
  }
  finally {
    loadingContracts.value = false
  }
}

const templates = ref<any[]>([])
const companyProfile = ref<any>({})

// ─── Fetch all page data ────────────────────────────────────────────────────
async function loadPageData() {
  const [custRes, templatesRes, settingsRes, dropdownRes] = await Promise.all([
    $fetch<any>(`/api/pipeline/${customerId}`),
    $fetch<{ success: boolean, data: any[] }>('/api/contracts/templates'),
    $fetch<{ success: boolean, data: Record<string, any> }>('/api/app-settings'),
    $fetch<any>('/api/dropdowns?name=Customer Status').catch(() => null),
  ])
  if (custRes.success)
    customer.value = custRes.data
  templates.value = templatesRes.data || []
  if (settingsRes.data?.companyProfile)
    companyProfile.value = settingsRes.data.companyProfile
  if (dropdownRes?.data?.options)
    statusOptions.value = dropdownRes.data.options

  if (customer.value) {
    updateHeader(customer.value)
    fetchAllData(customer.value.email, customer.value.phone)
    fetchCustomerContracts()
    fetchRelatedEstimates()
    fetchRelatedStainSignOffs()
    fetchRelatedDailyProduction()
    fetchRelatedProjects()
  }
}

// Always fetch on mount — works for both SPA navigation and hard refresh
onMounted(loadPageData)

// React to subsequent customer updates (e.g. after edit dialog save)
watch(customer, (newCust) => {
  if (newCust)
    updateHeader(newCust)
})

// ─── Status dropdown ────────────────────────────────────────────────────────
const statusMap = computed(() => {
  const m = new Map<string, StatusOption>()
  for (const o of statusOptions.value) m.set(String(o._id), o)
  return m
})

function resolveStatus(cust: any): StatusOption | null {
  const id = cust?.status
  if (!id)
    return null
  return statusMap.value.get(String(id)) || null
}

function getStatusLabel() { return resolveStatus(customer.value)?.label || 'Set Status' }
function getStageStyle(): Record<string, string> {
  const opt = resolveStatus(customer.value)
  if (!opt?.color)
    return {}
  return { backgroundColor: `${opt.color}22`, color: opt.color, borderColor: opt.color }
}

const activeDropdown = ref<string | null>(null)
const stageSearch = ref('')
const stageSearchInput = ref<HTMLInputElement | null>(null)

watch(activeDropdown, (val) => {
  if (val === 'stage') { stageSearch.value = ''; setTimeout(() => stageSearchInput.value?.focus(), 50) }
})

const filteredStageOptions = computed(() => {
  const all = statusOptions.value.map(o => ({ id: String(o._id), label: o.label, color: o.color || '' }))
  if (!stageSearch.value)
    return all
  return all.filter(s => s.label.toLowerCase().includes(stageSearch.value.toLowerCase()))
})

async function handleStageSelect(optionId: string) {
  if (!optionId || !customer.value)
    return
  customer.value.status = optionId
  activeDropdown.value = null
  try {
    const res = await $fetch<any>(`/api/pipeline/${customerId}`, { method: 'PUT', body: { status: optionId } })
    if (res.success)
      toast.success('Status updated')
    else toast.error('Failed to update status')
  }
  catch { toast.error('Error updating status') }
}

// ─── Edit / Delete ─────────────────────────────────────────────────────────
const showEditCustomer = ref(false)
const contractFormDialog = ref<any>(null)
const galleryRef = ref<any>(null)
const documentsRef = ref<any>(null)
const relatedContactsRef = ref<any>(null)
const showDeleteConfirm = ref(false)

// ─── Create Related Project ────────────────────────────────────────────────
const showNewProject = ref(false)
const newProjectPrefill = computed(() => {
  if (!customer.value) return null
  const c = customer.value
  return {
    // Pre-fill contact info from current record but leave projectName empty for user to fill
    name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
    projectName: '',
    customerId: c.customerId || '',
    firstName: c.firstName || '',
    lastName: c.lastName || '',
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    city: c.city || '',
    state: c.state || '',
    zip: c.zip || '',
    assignedTo: c.assignedTo || '',
    projectAssignedTo: c.projectAssignedTo || '',
  }
})

function onNewProjectSaved(saved: any) {
  showNewProject.value = false
  fetchRelatedProjects()
  toast.success('Related project created')
  if (saved?._id) {
    navigateTo(`/crm/pipeline/${saved._id}`)
  }
}

function onCustomerUpdated(updatedCustomer: any) {
  customer.value = updatedCustomer
  updateHeader(customer.value)
}

async function deleteCustomer() {
  try {
    const res = await $fetch<any>(`/api/pipeline/${customerId}`, { method: 'DELETE' })
    if (res.success) {
      toast.success('Customer deleted')
      const statusId = customer.value?.status
      navigateTo(statusId ? `/crm/pipeline?status=${statusId}` : '/crm/pipeline')
    }
  }
  catch { toast.error('Failed to delete customer') }
  finally { showDeleteConfirm.value = false }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatDate(d: string) { return d ? format(new Date(d), 'MMM dd, yyyy') : '—' }
function formatDateTime(d: string) { return d ? format(new Date(d), 'MMM dd, yyyy · h:mm a') : '—' }

function submissionStatusClass(status: string) {
  const m: Record<string, string> = {
    'completed': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    'in-progress': 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    'new': 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    'contacted': 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
    'archived': 'bg-muted text-muted-foreground',
  }
  return m[status] || 'bg-muted text-muted-foreground'
}

// ─── Related Stain Sign Offs ───────────────────────────────────────────────
const relatedStainSignOffs = ref<any[]>([])
const loadingStainSignOffs = ref(false)

async function fetchRelatedStainSignOffs() {
  if (!customer.value?.name) { relatedStainSignOffs.value = []; return }
  loadingStainSignOffs.value = true
  try {
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/stain-sign-off')
    const name = customer.value.name.toLowerCase()
    relatedStainSignOffs.value = (res.data || []).filter(
      (r: any) => r.clientName && r.clientName.toLowerCase() === name,
    )
  }
  catch {
    console.error('Failed to load stain sign-offs')
  }
  finally {
    loadingStainSignOffs.value = false
  }
}

// ─── Related Daily Production ──────────────────────────────────────────────
const relatedDailyProduction = ref<any[]>([])
const loadingDailyProduction = ref(false)

async function fetchRelatedDailyProduction() {
  if (!customer.value?.name) { relatedDailyProduction.value = []; return }
  loadingDailyProduction.value = true
  try {
    // 1. Get CrmSubmission IDs that match the customer name
    const clientsRes = await $fetch<{ success: boolean, data: any[] }>('/api/crm/clients-list')
    const matchingIds = (clientsRes.data || [])
      .filter((c: any) => c.name.toLowerCase() === customer.value.name.toLowerCase())
      .map((c: any) => c._id)

    if (matchingIds.length === 0) {
      relatedDailyProduction.value = []
      return
    }

    // 2. Get daily production records and filter by matching job IDs
    const prodRes = await $fetch<{ success: boolean, data: any[] }>('/api/daily-production')
    relatedDailyProduction.value = (prodRes.data || []).filter(
      (r: any) => r.job && matchingIds.includes(String(r.job)),
    )
  }
  catch {
    console.error('Failed to load daily production')
  }
  finally {
    loadingDailyProduction.value = false
  }
}

// ─── Related Projects ────────────────────────────────────────────────
const relatedProjects = ref<any[]>([])
const loadingRelatedProjects = ref(false)

async function fetchRelatedProjects() {
  if (!customer.value?.name) { relatedProjects.value = []; return }
  loadingRelatedProjects.value = true
  try {
    const res = await $fetch<any>('/api/pipeline', {
      params: { search: customer.value.name, limit: 100 },
    })
    // Filter to exact name match (the API does regex, so refine client-side)
    const name = customer.value.name.toLowerCase()
    relatedProjects.value = (res.data || []).filter(
      (r: any) => r.name && r.name.toLowerCase() === name,
    )
  }
  catch {
    console.error('Failed to load related projects')
  }
  finally {
    loadingRelatedProjects.value = false
  }
}

function formatStainColors(colors: string[]) {
  if (!colors?.length)
    return '—'
  return colors.slice(0, 3).join(', ') + (colors.length > 3 ? ` +${colors.length - 3}` : '')
}

function totalSqft(blocks: any[]) {
  if (!blocks?.length)
    return 0
  return blocks.reduce((sum: number, b: any) => sum + (b.sqft || 0), 0)
}
</script>

<template>
  <div class="h-full overflow-hidden -mx-4 lg:-mx-6">
    <!-- ── Header toolbar: status pill + Edit + Delete ─────────────────── -->
    <ClientOnly>
      <Teleport to="#header-toolbar">
        <div class="flex items-center gap-2">
          <!-- Stage selector -->
          <div v-if="customer" class="relative" :class="activeDropdown === 'stage' ? 'z-50' : ''">
            <button
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-colors border h-8 sm:h-9"
              :style="getStageStyle()"
              :class="!resolveStatus(customer) ? 'bg-muted text-muted-foreground border-border' : ''"
              @click.stop="activeDropdown = activeDropdown === 'stage' ? null : 'stage'"
            >
              <Icon name="i-lucide-check-circle-2" class="size-3.5" />
              {{ getStatusLabel() }}
              <Icon name="i-lucide-chevron-down" class="size-3 opacity-70" />
            </button>
            <div v-if="activeDropdown === 'stage'" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
            <div v-if="activeDropdown === 'stage'" class="absolute left-0 mt-1 top-full w-[200px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div class="p-2 border-b border-border/50">
                <input ref="stageSearchInput" v-model="stageSearch" type="text" placeholder="Search status..." class="w-full bg-background border border-border/50 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary font-medium" @click.stop>
              </div>
              <div class="max-h-[200px] overflow-y-auto py-1.5">
                <button v-for="st in filteredStageOptions" :key="st.id" class="w-full text-left px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-muted/60 transition-colors flex items-center gap-2" @click.stop="handleStageSelect(st.id)">
                  <div class="size-2 rounded-full" :style="st.color ? { backgroundColor: st.color } : {}" />
                  <span class="truncate">{{ st.label }}</span>
                </button>
              </div>
            </div>
          </div>

          <button v-if="canUpdate()" class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20" @click="showEditCustomer = true">
            <Icon name="i-lucide-pencil" class="size-3.5" />
            <span class="hidden sm:inline">Edit</span>
          </button>
          <button v-if="canDelete()" class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-destructive/10 text-destructive text-xs sm:text-sm font-bold hover:bg-destructive/20 transition-all" @click="showDeleteConfirm = true">
            <Icon name="i-lucide-trash-2" class="size-3.5" />
            <span class="hidden sm:inline">Delete</span>
          </button>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- ── 3-column layout — cards scroll individually ──────────────────── -->
    <div class="flex h-full overflow-hidden divide-x divide-border">
      <!-- ══ LEFT COLUMN — Details + Related Contacts ══════════════════════ -->
      <div class="w-[32%] min-w-0 flex flex-col gap-3 px-4 lg:px-5 py-4 overflow-y-auto">
        <!-- ── Customer Details Card ─────────────────────────────────── -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center gap-2 shrink-0">
            <Icon name="i-lucide-user" class="size-4 text-primary shrink-0" />
            <h3 class="text-sm font-bold text-foreground">
              Customer Details
            </h3>
          </div>
          <div v-if="customer" class="px-5 py-4 flex-1 min-h-0 overflow-y-auto">
            <div class="space-y-0 text-xs">
              <!-- Customer Name -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Name</span>
                <span class="col-span-7 font-bold text-foreground">
                  {{ customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || '—' }}
                </span>
              </div>
              <!-- Email -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Email</span>
                <span class="col-span-7">
                  <a v-if="customer.email" :href="`mailto:${customer.email}`" class="font-semibold text-primary hover:underline truncate block">{{ customer.email }}</a>
                  <span v-else class="text-muted-foreground">—</span>
                </span>
              </div>
              <!-- Phone -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Phone</span>
                <span class="col-span-7">
                  <a v-if="customer.phone" :href="`tel:${customer.phone}`" class="font-semibold text-foreground hover:text-primary transition-colors">{{ customer.phone }}</a>
                  <span v-else class="text-muted-foreground">—</span>
                </span>
              </div>
              <!-- Address -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Address</span>
                <span class="col-span-7 font-medium text-foreground/80 leading-relaxed">{{ customer.address || '—' }}</span>
              </div>
              <!-- City -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">City</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.city || '—' }}</span>
              </div>
              <!-- State -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">State</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.state || '—' }}{{ customer.zip ? ` ${customer.zip}` : '' }}</span>
              </div>
              <!-- Type -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Type</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.type || '—' }}</span>
              </div>
              <!-- Source -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30 last:border-b-0">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Source</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.source || 'Direct' }}</span>
              </div>
            </div>
          </div>
          <div v-else class="px-5 py-8">
            <div class="space-y-2 w-full">
              <div v-for="i in 4" :key="i" class="h-4 bg-muted/40 rounded animate-pulse" :style="`width: ${[88, 75, 92, 80][i - 1]}%`" />
            </div>
          </div>
        </div>

        <!-- ── Project Details Card ──────────────────────────────────── -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center gap-2 shrink-0">
            <Icon name="i-lucide-folder-kanban" class="size-4 text-primary shrink-0" />
            <h3 class="text-sm font-bold text-foreground">
              Project Details
            </h3>
          </div>
          <div v-if="customer" class="px-5 py-4 flex-1 min-h-0 overflow-y-auto">
            <div class="space-y-0 text-xs">
              <!-- Project Name -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Project Name</span>
                <span class="col-span-7 font-bold text-foreground">{{ customer.projectName || '—' }}</span>
              </div>
              <!-- Stage -->
              <div class="grid grid-cols-12 gap-2 items-center py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Stage</span>
                <span class="col-span-7 font-bold uppercase tracking-wider text-xs" :style="getStageStyle()">{{ getStatusLabel() || '—' }}</span>
              </div>
              <!-- Duration -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Project Duration</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.estimatedProjectDuration || '—' }}</span>
              </div>
              <!-- Total Estimate -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Total Estimate</span>
                <span class="col-span-7 font-black tabular-nums text-foreground">{{ customer.totalEstimate ? `$${customer.totalEstimate.toLocaleString()}` : '—' }}</span>
              </div>
              <!-- Labor + Sanding -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Labor + Sanding</span>
                <span class="col-span-7 font-black tabular-nums text-foreground">{{ customer.laborSandingTotal ? `$${customer.laborSandingTotal.toLocaleString()}` : '—' }}</span>
              </div>
              <!-- Assigned To -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Assigned To</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.assignedTo || '—' }}</span>
              </div>
              <!-- Crew -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Crew</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.projectAssignedTo || '—' }}</span>
              </div>
              <!-- Tracked Views -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Tracked Views</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.totalTrackedViews ?? 0 }}</span>
              </div>
              <!-- Estimate Sent On -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Estimate Sent On</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.estimateSentOn ? formatDate(customer.estimateSentOn) : '—' }}</span>
              </div>
              <!-- Notes -->
              <div v-if="customer.notes" class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Notes</span>
                <span class="col-span-7 text-foreground/70 leading-relaxed whitespace-pre-wrap">{{ customer.notes }}</span>
              </div>
              <!-- Key Dates -->
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Initial Contact</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.initialContactDate ? formatDate(customer.initialContactDate) : '—' }}</span>
              </div>
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Last Follow-Up</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.lastFollowUpSentOn ? formatDate(customer.lastFollowUpSentOn) : '—' }}</span>
              </div>
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Date Approved</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.dateApproved ? formatDate(customer.dateApproved) : '—' }}</span>
              </div>
              <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Wood Order Date</span>
                <span class="col-span-7 font-semibold text-foreground">{{ customer.woodOrderDate ? formatDate(customer.woodOrderDate) : '—' }}</span>
              </div>
              <!-- Tags -->
              <div v-if="customer.tags?.length" class="grid grid-cols-12 gap-2 items-start py-1.5">
                <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">Tags</span>
                <span class="col-span-7">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="tag in customer.tags" :key="tag" class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted text-foreground border">{{ tag }}</span>
                  </div>
                </span>
              </div>
            </div>
          </div>
          <div v-else class="px-5 py-8">
            <div class="space-y-2 w-full">
              <div v-for="i in 5" :key="i" class="h-4 bg-muted/40 rounded animate-pulse" :style="`width: ${[85, 72, 90, 78, 82][i - 1]}%`" />
            </div>
          </div>
        </div>

        <!-- ── Estimate Details Card ──────────────────────────────────── -->
        <div v-if="latestEstimate" class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center gap-2 shrink-0">
            <Icon name="i-lucide-file-text" class="size-4 text-blue-500 shrink-0" />
            <h3 class="text-sm font-bold text-foreground">
              Estimate Details
            </h3>
            <span class="ml-auto text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
              #{{ latestEstimate.estimateNumber }}
            </span>
          </div>
          <div class="px-5 py-4 space-y-3 flex-1 min-h-0 overflow-y-auto">
             <!-- Details List (Two columns: Label & Value) -->
             <div class="space-y-2.5 pt-1 text-xs">
               <!-- Estimate Title -->
               <div class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30">
                 <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">
                   Estimate Title
                 </span>
                 <span class="col-span-7 font-bold text-foreground truncate" :title="latestEstimate.title">
                   {{ latestEstimate.title?.replace(/^Ann Arbor Hardwoods\s+/i, '') || 'Estimate' }}
                 </span>
               </div>

               <!-- Status -->
               <div class="grid grid-cols-12 gap-2 items-center py-1.5 border-b border-border/30">
                 <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                   Status
                 </span>
                 <span class="col-span-7">
                   <span
                     class="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                     :class="ESTIMATE_STATUS_COLORS[latestEstimate.status] || 'bg-muted text-muted-foreground'"
                   >
                     {{ ESTIMATE_STATUS_LABELS[latestEstimate.status] || latestEstimate.status }}
                   </span>
                 </span>
               </div>

               <!-- Variables -->
               <template v-if="latestEstimate.variableValues && Object.keys(latestEstimate.variableValues).length > 0">
                 <div v-for="(val, key) in latestEstimate.variableValues" :key="key" class="grid grid-cols-12 gap-2 items-start py-1.5 border-b border-border/30 last:border-b-0">
                   <span class="col-span-5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider pt-0.5">
                     {{ String(key).replace(/_/g, ' ') }}
                   </span>
                   <span class="col-span-7 font-semibold text-foreground whitespace-pre-wrap break-words">
                     {{ val || '—' }}
                   </span>
                 </div>
               </template>
               <div v-else class="text-xs text-muted-foreground text-center py-2">
                 No variable information available.
               </div>
             </div>
          </div>
        </div>

        <!-- Related Contacts Card -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center justify-between gap-2 shrink-0">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-contact" class="size-4 text-primary shrink-0" />
              <h3 class="text-sm font-bold text-foreground">
                Related Contacts
              </h3>
            </div>
            <button
              v-if="customer && relatedContactsRef && !relatedContactsRef.isEditing"
              class="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-all"
              @click="relatedContactsRef.openAdd()"
            >
              <Icon name="i-lucide-plus" class="size-3" />
              Add Contact
            </button>
          </div>
          <div class="px-5 py-4 flex-1 min-h-0 overflow-y-auto">
            <CrmCustomerRelatedContacts v-if="customer" ref="relatedContactsRef" :customer="customer" :pipeline-id="customerId" :contact-ids="(customer.contactIds || []).map((id: any) => String(id))" @updated="onCustomerUpdated" />
          </div>
        </div>
      </div>

      <!-- ══ MIDDLE COLUMN — Quotes + Estimates + Contracts ════════════════ -->
      <div class="flex-1 min-w-0 flex flex-col gap-3 px-4 lg:px-5 py-4 overflow-y-auto">
        <!-- Appointments (Calendly bookings timeline) -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-calendar-check" class="size-4 text-sky-500 shrink-0" />
              <h3 class="text-sm font-bold text-foreground">
                Appointments
              </h3>
            </div>
            <span v-if="relatedAppointments.length" class="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{{ relatedAppointments.length }}</span>
          </div>
          <div v-if="loadingAllSubmissions" class="flex-1 px-5 py-4 space-y-2">
            <div v-for="i in 2" :key="i" class="h-10 bg-muted/30 rounded-lg animate-pulse" />
          </div>
          <div v-else-if="relatedAppointments.length === 0" class="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <Icon name="i-lucide-calendar-check" class="size-6 text-muted-foreground/30 mx-auto mb-2" />
            <p class="text-xs text-muted-foreground">
              No Calendly appointments
            </p>
          </div>
          <div v-else class="divide-y divide-border/50 max-h-[240px] overflow-y-auto">
            <div v-for="item in relatedAppointments" :key="item._id" class="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
              <div class="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                <Icon :name="getAptIcon(item)" class="size-3.5 text-sky-500" />
              </div>
              <div class="flex-1 min-w-0">
                <p
                  class="text-xs font-bold text-foreground truncate"
                  :class="{ 'line-through opacity-60': getAptState(item) === 'rescheduled' || getAptState(item) === 'canceled' }"
                >
                  {{ item.formName || 'Calendly Appointment' }}
                </p>
                <p class="text-[10px] text-muted-foreground truncate">
                  <span v-if="item.fields?.meetingScheduled?.startTime" :class="{ 'line-through': getAptState(item) === 'rescheduled' || getAptState(item) === 'canceled' }">
                    Scheduled {{ formatDateTime(item.fields.meetingScheduled.startTime) }}
                  </span>
                  <span v-if="item.dateSubmitted"> · Booked {{ formatDate(item.dateSubmitted) }}</span>
                </p>
              </div>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0" :class="APT_STATE_BADGES[getAptState(item)]">
                {{ getAptState(item) === 'active' ? 'Scheduled' : getAptState(item) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Related Quotes -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-ruler" class="size-4 text-emerald-500 shrink-0" />
              <h3 class="text-sm font-bold text-foreground">
                Related Quotes
              </h3>
            </div>
            <span v-if="relatedQuotes.length" class="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{{ relatedQuotes.length }}</span>
          </div>
          <div v-if="loadingAllSubmissions" class="flex-1 px-5 py-4 space-y-2">
            <div v-for="i in 3" :key="i" class="h-10 bg-muted/30 rounded-lg animate-pulse" />
          </div>
          <div v-else-if="relatedQuotes.length === 0" class="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <Icon name="i-lucide-ruler" class="size-6 text-muted-foreground/30 mx-auto mb-2" />
            <p class="text-xs text-muted-foreground">
              No quote submissions
            </p>
          </div>
          <div v-else class="divide-y divide-border/50 max-h-[240px] overflow-y-auto">
            <div v-for="item in relatedQuotes" :key="item._id" class="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
              <div class="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Icon name="i-lucide-file-text" class="size-3.5 text-emerald-500" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-foreground truncate">
                  {{ item.name || 'Anonymous' }}
                </p>
                <p class="text-[10px] text-muted-foreground">
                  {{ formatDate(item.fields?.meetingScheduled?.startTime || item.dateSubmitted) }}
                </p>
              </div>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0" :class="submissionStatusClass(item.status)">{{ item.status }}</span>
            </div>
          </div>
        </div>



        <!-- Related Contracts -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-file-signature" class="size-4 text-indigo-500 shrink-0" />
              <h3 class="text-sm font-bold text-foreground">
                Related Contracts
              </h3>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="customerContracts.length" class="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{{ customerContracts.length }}</span>
              <button v-if="customer" class="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-all" @click="contractFormDialog?.openForCustomer(customer)">
                <Icon name="i-lucide-plus" class="size-3" />
                Add Contract
              </button>
            </div>
          </div>
          <div v-if="loadingContracts" class="flex-1 px-5 py-4 space-y-2">
            <div v-for="i in 2" :key="i" class="h-10 bg-muted/30 rounded-lg animate-pulse" />
          </div>
          <div v-else-if="customerContracts.length === 0" class="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <Icon name="i-lucide-file-signature" class="size-6 text-muted-foreground/30 mx-auto mb-2" />
            <p class="text-xs text-muted-foreground">
              No contracts on file
            </p>
          </div>
          <div v-else class="p-4 max-h-[240px] overflow-y-auto">
            <CrmContractsTable
              :contracts="customerContracts"
              :templates="templates"
              :company-profile="companyProfile"
              :is-loading="loadingContracts"
              :compact="true"
              @refresh="fetchCustomerContracts"
              @edit="ct => contractFormDialog?.openEditContract(ct)"
            />
          </div>
        </div>

        <!-- Related Projects -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-kanban" class="size-4 text-emerald-500 shrink-0" />
              <h3 class="text-sm font-bold text-foreground">
                Related Projects
              </h3>
            </div>
            <span v-if="relatedProjects.length" class="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{{ relatedProjects.length }}</span>
            <button
              v-if="canCreate()"
              class="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-all shadow-sm"
              @click="showNewProject = true"
            >
              <Icon name="i-lucide-plus" class="size-3" />
              New Project
            </button>
          </div>
          <div v-if="loadingRelatedProjects" class="flex-1 px-5 py-4 space-y-2">
            <div v-for="i in 2" :key="i" class="h-10 bg-muted/30 rounded-lg animate-pulse" />
          </div>
          <div v-else-if="relatedProjects.length === 0" class="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <Icon name="i-lucide-kanban" class="size-6 text-muted-foreground/30 mx-auto mb-2" />
            <p class="text-xs text-muted-foreground">
              No related projects
            </p>
          </div>
          <div v-else class="divide-y divide-border/50 max-h-[240px] overflow-y-auto">
            <NuxtLink
              v-for="proj in relatedProjects"
              :key="proj._id"
              :to="`/crm/pipeline/${proj._id}`"
              class="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/20 transition-colors border-l-[3px]"
              :class="proj._id === customerId ? 'border-l-emerald-500 bg-emerald-500/5' : 'border-l-transparent'"
            >
              <div class="w-6 h-6 rounded-md flex items-center justify-center shrink-0" :class="proj._id === customerId ? 'bg-emerald-500/15' : 'bg-muted/50'">
                <Icon name="i-lucide-folder-kanban" class="size-3" :class="proj._id === customerId ? 'text-emerald-500' : 'text-muted-foreground'" />
              </div>
              <span class="text-xs font-bold text-foreground truncate min-w-0 flex-1">
                {{ proj.projectName || proj.name || '—' }}
                <span v-if="proj._id === customerId" class="ml-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">(current)</span>
              </span>
              <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">{{ (proj.status && statusMap.get(String(proj.status))?.label) || proj.stage || '—' }}</span>
              <span class="text-[10px] text-muted-foreground shrink-0">{{ proj.createdAt ? formatDate(proj.createdAt) : '—' }}</span>
            </NuxtLink>
          </div>
        </div>

        <!-- Related Stain Sign Offs -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-stamp" class="size-4 text-amber-500 shrink-0" />
              <h3 class="text-sm font-bold text-foreground">
                Stain Sign Offs
              </h3>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="relatedStainSignOffs.length" class="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{{ relatedStainSignOffs.length }}</span>
              <NuxtLink v-if="customer" to="/stain-sign-off" class="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-all">
                <Icon name="i-lucide-plus" class="size-3" />
                New
              </NuxtLink>
            </div>
          </div>
          <div v-if="loadingStainSignOffs" class="flex-1 px-5 py-4 space-y-2">
            <div v-for="i in 2" :key="i" class="h-10 bg-muted/30 rounded-lg animate-pulse" />
          </div>
          <div v-else-if="relatedStainSignOffs.length === 0" class="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <Icon name="i-lucide-stamp" class="size-6 text-muted-foreground/30 mx-auto mb-2" />
            <p class="text-xs text-muted-foreground">
              No stain sign-offs
            </p>
          </div>
          <div v-else class="divide-y divide-border/50 max-h-[240px] overflow-y-auto">
            <NuxtLink v-for="item in relatedStainSignOffs" :key="item._id" to="/stain-sign-off" class="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
              <div class="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Icon name="i-lucide-stamp" class="size-3.5 text-amber-500" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-foreground truncate">
                  {{ item.clientName || '—' }}
                </p>
                <p class="text-[10px] text-muted-foreground">
                  {{ formatStainColors(item.stainColorAdditive) }}
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span v-if="item.isSigned" class="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <Icon name="i-lucide-check" class="size-2.5" />
                </span>
                <span class="text-[10px] text-muted-foreground">{{ formatDate(item.createdAt) }}</span>
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- Related Daily Production -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-clipboard-list" class="size-4 text-teal-500 shrink-0" />
              <h3 class="text-sm font-bold text-foreground">
                Daily Production
              </h3>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="relatedDailyProduction.length" class="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{{ relatedDailyProduction.length }}</span>
              <NuxtLink v-if="customer" to="/daily-production" class="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-all">
                <Icon name="i-lucide-plus" class="size-3" />
                New
              </NuxtLink>
            </div>
          </div>
          <div v-if="loadingDailyProduction" class="flex-1 px-5 py-4 space-y-2">
            <div v-for="i in 2" :key="i" class="h-10 bg-muted/30 rounded-lg animate-pulse" />
          </div>
          <div v-else-if="relatedDailyProduction.length === 0" class="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <Icon name="i-lucide-clipboard-list" class="size-6 text-muted-foreground/30 mx-auto mb-2" />
            <p class="text-xs text-muted-foreground">
              No production records
            </p>
          </div>
          <div v-else class="divide-y divide-border/50 max-h-[240px] overflow-y-auto">
            <NuxtLink v-for="item in relatedDailyProduction" :key="item._id" to="/daily-production" class="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
              <div class="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                <Icon name="i-lucide-calendar-days" class="size-3.5 text-teal-500" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-foreground">
                  {{ item.date || formatDate(item.createdAt) }}
                </p>
                <p class="text-[10px] text-muted-foreground">
                  {{ item.blocks?.length || 0 }} work blocks · {{ totalSqft(item.blocks).toLocaleString() }} sqft
                </p>
              </div>
              <span v-if="item.submitted" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">Submitted</span>
              <span v-else class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">Draft</span>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- ══ RIGHT COLUMN — Gallery + 2 TBD ════════════════════════════════ -->
      <div class="w-[30%] min-w-0 flex flex-col gap-3 px-4 lg:px-5 py-4 overflow-y-auto">
        <!-- Gallery Card -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-2 shrink-0">
              <Icon name="i-lucide-images" class="size-4 text-violet-500 shrink-0" />
              <h3 class="text-sm font-bold text-foreground">
                Project Gallery
              </h3>
              <span v-if="customer?.gallery?.length" class="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{{ customer.gallery.length }}</span>
            </div>
            <div v-if="customer && galleryRef" class="flex items-center gap-1.5">
              <template v-if="customer.gallery?.length > 0">
                <button v-if="!galleryRef.selectionMode" class="inline-flex items-center justify-center h-7 px-2.5 rounded-lg bg-muted text-foreground text-[11px] font-bold hover:bg-muted/80 transition-all" @click="galleryRef.toggleSelectionMode()">
                  Select
                </button>
                <template v-else>
                  <button :disabled="galleryRef.selectedIndices.size === 0" class="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-destructive text-white text-[11px] font-bold hover:bg-destructive/90 transition-all disabled:opacity-50" @click="galleryRef.removeSelectedImages()">
                    <Icon name="i-lucide-trash-2" class="size-3" />
                    Delete ({{ galleryRef.selectedIndices.size }})
                  </button>
                  <button class="inline-flex items-center justify-center h-7 px-2.5 rounded-lg border border-border text-foreground text-[11px] font-bold hover:bg-muted transition-all" @click="galleryRef.toggleSelectionMode()">
                    Cancel
                  </button>
                </template>
              </template>
              <button v-if="!galleryRef.selectionMode" :disabled="galleryRef.isUploading" class="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-all disabled:opacity-50" @click="galleryRef.triggerUpload()">
                <Icon v-if="galleryRef.isUploading" name="i-lucide-loader-2" class="size-3 animate-spin" />
                <Icon v-else name="i-lucide-upload-cloud" class="size-3" />
                {{ galleryRef.isUploading ? 'Uploading...' : 'Upload' }}
              </button>
            </div>
          </div>
          <div v-if="customer" class="p-4 flex-1 min-h-0 overflow-y-auto">
            <CrmCustomerGallery ref="galleryRef" :customer="customer" @updated="onCustomerUpdated" />
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <Icon name="i-lucide-images" class="size-6 text-muted-foreground/30 mx-auto mb-2" />
            <p class="text-xs text-muted-foreground">
              No photos yet
            </p>
          </div>
        </div>

        <!-- Documents Card -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-2 shrink-0">
              <Icon name="i-lucide-file-stack" class="size-4 text-rose-500 shrink-0" />
              <h3 class="text-sm font-bold text-foreground">
                Documents
              </h3>
              <span v-if="customer?.documents?.length" class="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{{ customer.documents.length }}</span>
            </div>
            <button
              v-if="customer && documentsRef && !documentsRef.showAddForm"
              class="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-all"
              @click="documentsRef.openAdd()"
            >
              <Icon name="i-lucide-plus" class="size-3" />
              Add
            </button>
          </div>
          <div v-if="customer" class="p-4 flex-1 min-h-0 overflow-y-auto">
            <CrmCustomerDocuments ref="documentsRef" :customer="customer" />
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <Icon name="i-lucide-file-stack" class="size-6 text-muted-foreground/30 mx-auto mb-2" />
            <p class="text-xs text-muted-foreground">
              No documents yet
            </p>
          </div>
        </div>


        <!-- Placeholder Box 2 -->
        <div class="bg-card rounded-2xl border border-dashed shadow-sm overflow-hidden">
          <div class="px-5 py-3 border-b bg-muted/20 flex items-center gap-2 shrink-0">
            <Icon name="i-lucide-box" class="size-4 text-muted-foreground/40 shrink-0" />
            <h3 class="text-sm font-bold text-muted-foreground/40">
              Coming Soon
            </h3>
          </div>
          <div class="flex-1 flex flex-col items-center justify-center text-center gap-2">
            <Icon name="i-lucide-plus-circle" class="size-8 text-muted-foreground/20" />
            <p class="text-xs text-muted-foreground/40 font-medium">
              More content coming here
            </p>
          </div>
        </div>
      </div>
    </div><!-- /3-column -->

    <!-- ── Dialogs ──────────────────────────────────────────────────────── -->
    <CrmCustomerFormDialog
      v-model="showEditCustomer"
      :customer="customer"
      @saved="onCustomerUpdated"
    />

    <CrmContractFormDialog
      ref="contractFormDialog"
      @saved="fetchCustomerContracts"
    />

    <!-- Create Related Project Dialog (pre-filled from current record) -->
    <CrmCustomerFormDialog
      v-model="showNewProject"
      :customer="newProjectPrefill"
      @saved="onNewProjectSaved"
    />

    <AlertDialog :open="showDeleteConfirm" @update:open="v => showDeleteConfirm = v">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Customer</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this customer? This action cannot be undone and all associated data will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="deleteCustomer">
            <Icon name="i-lucide-trash-2" class="size-3.5 mr-1.5" />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<style scoped>
.font-display {
  font-family: 'Outfit', sans-serif;
}
</style>
