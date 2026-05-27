<script setup lang="ts">
import { toast } from 'vue-sonner'

definePageMeta({
  key: route => route.params.id as string
})

const route = useRoute()
const customerId = route.params.id as string

const customer = ref<any>(null)
const isLoadingCustomer = ref(false)

// Status dropdown options (must be declared before useAsyncData that populates it)
interface StatusOption { _id: string; label: string; value: string; color: string; icon: string; order: number }
const statusOptions = ref<StatusOption[]>([])

const { setHeader } = usePageHeader()

const activeTab = computed(() => (route.params.tab as string) || 'details')

const tabs = [
  { id: 'details', label: 'Details', icon: 'i-lucide-info', typeFilter: 'details' },
  { id: 'gallery', label: 'Gallery', icon: 'i-lucide-images', typeFilter: 'gallery' },
  { id: 'appointments', label: 'Appointments', icon: 'i-lucide-calendar-check', typeFilter: 'appointment' },
  { id: 'estimates', label: 'Estimates', icon: 'i-lucide-ruler', typeFilter: 'flooring-estimate' },
  { id: 'contracts', label: 'Contracts', icon: 'i-lucide-file-signature', typeFilter: 'contract' },
  { id: 'emails', label: 'Emails', icon: 'i-lucide-mail', typeFilter: 'email' },
]

const aptViewMode = ref<'calendar' | 'list'>('calendar')
const selectedApt = ref<any>(null)
const showAptDetail = ref(false)

function openAptDetails(apt: any) {
  selectedApt.value = apt
  showAptDetail.value = true
}

import { format } from 'date-fns'
function formatDate(date: string) {
  if (!date) return '—'
  return format(new Date(date), 'MMM dd, yyyy h:mm a')
}

async function fetchCustomer() {
  isLoadingCustomer.value = true
  try {
    const res = await $fetch<any>(`/api/customers/${customerId}`)
    if (res.success) {
      customer.value = res.data
      updateHeaderForContext(customer.value, activeTab.value)
    }
  } catch (err) {
    toast.error('Failed to load customer profile.')
  } finally {
    isLoadingCustomer.value = false
  }
}

const {
  items: submissions,
  isLoading: isLoadingSubmissions,
  fetchSubmissions,
  totalItems,
  updateSubmission,
  toggleStar,
} = useCrmSubmissions()

const allSubmissions = ref<any[]>([])
const loadingAllSubmissions = ref(false)

const customerSubmissions = computed(() => {
  const tabInfo = tabs.find(t => t.id === activeTab.value)
  if (!tabInfo || !tabInfo.typeFilter) return []
  return allSubmissions.value.filter(s => s.type === tabInfo.typeFilter)
})

const loadingSubmissionsForTab = computed(() => loadingAllSubmissions.value)

watch([customer, activeTab], ([newCust, newTab]) => {
  if (!newCust) return
  fetchAllData(newCust.email, newCust.phone)
  fetchCustomerContracts()
  updateHeaderForContext(newCust, newTab)
}, { immediate: true })

function updateHeaderForContext(cust: any, tab: string) {
  if (!cust) return
  if (tab === 'gallery') {
    setHeader({
      title: 'Project Gallery',
      icon: 'i-lucide-images',
      description: cust.name || `${cust.firstName || ''} ${cust.lastName || ''}`.trim(),
    })
  } else {
    setHeader({
      title: cust.name || `${cust.firstName || ''} ${cust.lastName || ''}`.trim(),
      icon: 'i-lucide-user',
      description: cust.email || cust.phone || 'Customer Profile',
    })
  }
}

async function fetchAllData(email: string, phone: string) {
  if (!email && !phone) {
    allSubmissions.value = []
    loadingAllSubmissions.value = false
    return
  }

  loadingAllSubmissions.value = true
  try {
    const query = new URLSearchParams()
    if (email) query.append('email', email)
    if (phone) query.append('phone', phone)
    query.append('limit', '500')
    
    const res = await $fetch<any>(`/api/crm/submissions?${query.toString()}`)
    if (res.success) {
      allSubmissions.value = res.data || []
    }
  } catch {
    toast.error('Failed to load submissions')
  } finally {
    loadingAllSubmissions.value = false
  }
}

const customerContracts = ref<any[]>([])
const loadingContracts = ref(false)

async function fetchCustomerContracts() {
  loadingContracts.value = true
  try {
    const res = await $fetch<any>(`/api/contracts?customerId=${customerId}`)
    if (res.success) {
      customerContracts.value = res.data || []
    }
  } catch {
    console.error('Failed to load contracts')
  } finally {
    loadingContracts.value = false
  }
}

const templates = ref<any[]>([])
const companyProfile = ref<any>({})

async function fetchTemplates() {
  try {
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/contracts/templates')
    templates.value = res.data || []
  } catch { /* ignore */ }
}

async function fetchCompanyProfile() {
  try {
    const res = await $fetch<{ success: boolean, data: Record<string, any> }>('/api/app-settings')
    if (res.data?.companyProfile) companyProfile.value = res.data.companyProfile
  } catch { /* ignore */ }
}

// `deleteContract` has been moved to CrmContractsTable

// ─── Server-first data fetching (blocks navigation until resolved) ──────
await useAsyncData(`pipeline-detail-${customerId}`, async () => {
  const [custRes, templatesRes, settingsRes, dropdownRes] = await Promise.all([
    $fetch<any>(`/api/customers/${customerId}`),
    $fetch<{ success: boolean, data: any[] }>('/api/contracts/templates'),
    $fetch<{ success: boolean, data: Record<string, any> }>('/api/app-settings'),
    $fetch<any>('/api/dropdowns?name=Customer Status').catch(() => null),
  ])
  if (custRes.success) {
    customer.value = custRes.data
    updateHeaderForContext(customer.value, activeTab.value)
  }
  templates.value = templatesRes.data || []
  if (settingsRes.data?.companyProfile) companyProfile.value = settingsRes.data.companyProfile
  if (dropdownRes?.data?.options) statusOptions.value = dropdownRes.data.options
  return true
})

async function handleStatusUpdate(id: string, status: string) {
  await updateSubmission(id, { status } as any)
  toast.success(`Status updated to ${status}`)
  
  // Update local
  const sub = allSubmissions.value.find(s => s._id === id)
  if (sub) sub.status = status
}

async function handleToggleStar(id: string) {
  const sub = allSubmissions.value.find(s => s._id === id)
  if (!sub) return
  const newStarred = !sub.starred
  await updateSubmission(id, { starred: newStarred } as any)
  sub.starred = newStarred
}

const showEditCustomer = ref(false)
const contractFormDialog = ref<any>(null)

function onCustomerUpdated(updatedCustomer: any) {
  customer.value = updatedCustomer
  updateHeaderForContext(customer.value, activeTab.value)
}

const showDeleteConfirm = ref(false)

async function deleteCustomer() {
  try {
    const res = await $fetch<any>(`/api/customers/${customerId}`, { method: 'DELETE' })
    if (res.success) {
      toast.success('Customer deleted')
      // Navigate back to the pipeline tab — preserve status filter if customer had one
      const statusId = customer.value?.status
      navigateTo(statusId ? `/crm/pipeline?status=${statusId}` : '/crm/pipeline')
    }
  } catch (e: any) {
    toast.error('Failed to delete customer')
  } finally {
    showDeleteConfirm.value = false
  }
}

const visibleTabs = computed(() => {
  return tabs.filter(tab => {
    if (tab.id === 'details' || tab.id === 'gallery') return true
    if (tab.id === 'contracts') return customerContracts.value.length > 0
    if (tab.typeFilter) {
      if (tab.typeFilter === 'gallery') return true
      return allSubmissions.value.some(s => s.type === tab.typeFilter)
    }
    return true
  })
})

// ─── Dropdown-based Status Resolution ───────────────────
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
    if (res?.data?.options) {
      statusOptions.value = res.data.options
    }
  } catch (e) {
    console.warn('Failed to load status dropdown', e)
  }
}

function resolveStatus(cust: any): StatusOption | null {
  const id = cust?.status
  if (!id) return null
  return statusMap.value.get(String(id)) || null
}

function getStatusLabel(): string {
  if (!customer.value) return 'Set Status'
  const opt = resolveStatus(customer.value)
  return opt?.label || 'Set Status'
}

const activeDropdown = ref<string | null>(null)
const stageSearch = ref('')
const stageSearchInput = ref<HTMLInputElement | null>(null)

watch(activeDropdown, (val) => {
  if (val === 'stage') {
    stageSearch.value = ''
    setTimeout(() => {
      stageSearchInput.value && stageSearchInput.value.focus()
    }, 50)
  }
})

const filteredStageOptions = computed(() => {
  const all = statusOptions.value.map(o => ({ id: String(o._id), label: o.label, color: o.color || '' }))
  if (!stageSearch.value) return all
  const sub = stageSearch.value.toLowerCase()
  return all.filter(s => s.label.toLowerCase().includes(sub))
})

async function handleStageSelect(optionId: string) {
  if (!optionId || !customer.value) return
  customer.value.status = optionId
  activeDropdown.value = null

  try {
    const res = await $fetch<any>(`/api/customers/${customerId}`, {
      method: 'PUT',
      body: { status: optionId }
    })
    if (res.success) toast.success('Status updated')
    else toast.error('Failed to update status')
  } catch (err) {
    toast.error('Error updating status')
  }
}

function getStageClasses(): string {
  if (!customer.value) return 'bg-muted text-muted-foreground border-border'
  const opt = resolveStatus(customer.value)
  if (!opt?.color) return 'bg-muted text-muted-foreground border-border'
  return `border-[${opt.color}]`
}

function getStageStyle(): Record<string, string> {
  if (!customer.value) return {}
  const opt = resolveStatus(customer.value)
  if (!opt?.color) return {}
  return { backgroundColor: opt.color + '22', color: opt.color, borderColor: opt.color }
}
</script>

<template>
  <div class="max-w-7xl mx-auto space-y-6 pb-20">
    <div v-if="isLoadingCustomer" class="space-y-4">
      <div class="h-24 bg-muted/40 rounded-xl animate-pulse" />
    </div>
    
    <template v-else-if="customer">
      <Teleport to="#header-toolbar">
        <div class="flex items-center gap-2">
          <button @click="showEditCustomer = true" class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shrink-0 shadow-lg shadow-primary/20" title="Edit Customer">
            <Icon name="i-lucide-pencil" class="size-3.5" />
            <span class="hidden sm:inline">Edit</span>
          </button>
          <button @click="showDeleteConfirm = true" class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-destructive/10 text-destructive text-xs sm:text-sm font-bold hover:bg-destructive/20 transition-all shrink-0" title="Delete Customer">
            <Icon name="i-lucide-trash-2" class="size-3.5" />
            <span class="hidden sm:inline">Delete</span>
          </button>
        </div>
      </Teleport>

      <!-- Page Header & Hero Section -->
      <div class="relative overflow-hidden rounded-3xl border bg-card p-8 lg:p-10 shadow-sm transition-all duration-300 hover:shadow-md">
        <div class="absolute -right-20 -top-20 w-80 h-80 rounded-full blur-[80px] opacity-20 pointer-events-none bg-primary" />

        <div class="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div class="flex items-start gap-6">
            <div class="w-20 h-20 rounded-2xl flex items-center justify-center relative ring-1 ring-border shadow-inner bg-primary/10 text-primary">
              <Icon name="i-lucide-user" class="size-10" />
            </div>
            <div class="space-y-2">
              <div class="flex items-center gap-3">
                <h1 class="text-3xl font-bold tracking-tight text-foreground font-display">
                  {{ customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown' }}
                </h1>
              </div>
              <div class="flex items-center gap-3 flex-wrap">
                <!-- Status Badge -->
                <div class="relative" :class="activeDropdown === 'stage' ? 'z-50' : ''">
                  <button @click.stop="activeDropdown = activeDropdown === 'stage' ? null : 'stage'" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-colors border" :style="getStageStyle()" :class="!resolveStatus(customer) ? 'bg-muted text-muted-foreground border-border' : ''">
                    <Icon name="i-lucide-check-circle-2" class="size-3.5" />
                    {{ getStatusLabel() }}
                    <Icon name="i-lucide-chevron-down" class="size-3 opacity-70" />
                  </button>
                  
                  <div v-if="activeDropdown === 'stage'" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
                  <div v-if="activeDropdown === 'stage'" class="absolute left-0 mt-1 top-full w-[200px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div class="p-2 border-b border-border/50">
                      <input ref="stageSearchInput" type="text" v-model="stageSearch" placeholder="Search status..." class="w-full bg-background border border-border/50 rounded filter-none px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary font-medium" @click.stop />
                    </div>
                    <div class="max-h-[200px] overflow-y-auto py-1.5">
                      <button v-for="st in filteredStageOptions" :key="st.id" @click.stop="handleStageSelect(st.id)" class="w-full text-left px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-muted/60 transition-colors flex items-center gap-2">
                        <div class="size-2 rounded-full shadow-inner" :style="st.color ? { backgroundColor: st.color } : {}" />
                        <span class="truncate">{{ st.label }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <span v-if="customer.email" class="text-sm text-muted-foreground font-medium">
                  {{ customer.email }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Content (Left) -->
        <div class="lg:col-span-2 space-y-8">

          <!-- Customer Details Card -->
          <div class="bg-card rounded-3xl border p-8 space-y-6 shadow-sm">
            <h3 class="text-lg font-bold flex items-center gap-2 font-display">
              <Icon name="i-lucide-info" class="size-5 text-primary" />
              Customer Details
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div>
                  <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Assigned To</p>
                  <p class="text-sm font-bold text-foreground">{{ customer.assignedTo || '—' }}</p>
                </div>
                <div>
                  <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Project Manager</p>
                  <p class="text-sm font-bold text-foreground">{{ customer.projectAssignedTo || '—' }}</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Duration</p>
                    <p class="text-sm font-bold text-foreground">{{ customer.estimatedProjectDuration || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Views</p>
                    <p class="text-sm font-bold text-foreground">{{ customer.totalTrackedViews || '0' }}</p>
                  </div>
                </div>
              </div>
              <div class="space-y-4">
                <div>
                  <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Estimate</p>
                  <p class="text-2xl font-black tabular-nums tracking-tight text-foreground">
                    {{ customer.totalEstimate ? '$' + customer.totalEstimate.toLocaleString() : '—' }}
                  </p>
                </div>
                <div>
                  <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Tags</p>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="tag in customer.tags" :key="tag" class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted text-foreground border">{{ tag }}</span>
                    <span v-if="!customer.tags?.length" class="text-sm text-muted-foreground">—</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Key Dates Card -->
          <div class="bg-card rounded-3xl border p-8 space-y-6 shadow-sm">
            <h3 class="text-lg font-bold flex items-center gap-2 font-display">
              <Icon name="i-lucide-calendar" class="size-5 text-indigo-500" />
              Key Dates
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Initial Contact</p>
                <p class="text-sm font-medium">{{ customer.initialContactDate ? new Date(customer.initialContactDate).toLocaleDateString() : '—' }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Estimate Sent</p>
                <p class="text-sm font-medium">{{ customer.estimateSentOn ? new Date(customer.estimateSentOn).toLocaleDateString() : '—' }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Last Follow-up</p>
                <p class="text-sm font-medium">{{ customer.lastFollowUpSentOn ? new Date(customer.lastFollowUpSentOn).toLocaleDateString() : '—' }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Approved On</p>
                <p class="text-sm font-medium">{{ customer.dateApproved ? new Date(customer.dateApproved).toLocaleDateString() : '—' }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Wood Ordered</p>
                <p class="text-sm font-medium">{{ customer.woodOrderDate ? new Date(customer.woodOrderDate).toLocaleDateString() : '—' }}</p>
              </div>
            </div>
          </div>

          <!-- Notes Card -->
          <div class="bg-card rounded-3xl border p-8 space-y-4 shadow-sm border-amber-500/10">
            <h3 class="text-lg font-bold flex items-center gap-2 font-display">
              <Icon name="i-lucide-notebook-pen" class="size-5 text-amber-500" />
              Notes
            </h3>
            <div class="bg-muted/20 p-6 rounded-2xl text-sm leading-relaxed text-foreground/80 font-medium border border-dashed border-border/50 whitespace-pre-wrap min-h-[80px]">
              {{ customer.notes || 'No notes added yet.' }}
            </div>
          </div>

          <!-- Gallery Section -->
          <div v-if="customer.gallery?.length > 0" class="bg-card rounded-3xl border p-8 space-y-6 shadow-sm">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold flex items-center gap-2 font-display">
                <Icon name="i-lucide-images" class="size-5 text-indigo-500" />
                Project Gallery
              </h3>
              <p class="text-xs text-muted-foreground font-medium bg-muted px-2.5 py-1 rounded-lg">
                {{ customer.gallery.length }} photos
              </p>
            </div>
            <CrmCustomerGallery :customer="customer" @updated="onCustomerUpdated" />
          </div>

          <!-- Contracts Section -->
          <div class="bg-card rounded-3xl border overflow-hidden shadow-sm">
            <div class="p-8 border-b bg-muted/10 flex items-center justify-between">
              <h3 class="text-lg font-bold flex items-center gap-2 font-display">
                <Icon name="i-lucide-file-signature" class="size-5 text-emerald-500" />
                Contracts
              </h3>
              <button @click="contractFormDialog?.openForCustomer(customer)" class="inline-flex items-center justify-center gap-2 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm">
                <Icon name="i-lucide-plus" class="size-3.5" />
                New Contract
              </button>
            </div>
            <div class="p-6">
              <div v-if="loadingContracts" class="space-y-4">
                <div v-for="i in 3" :key="i" class="h-16 bg-muted/40 rounded-xl animate-pulse" />
              </div>
              <div v-else-if="customerContracts.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
                <Icon name="i-lucide-file-signature" class="size-8 text-muted-foreground mb-4" />
                <p class="text-sm text-muted-foreground">No contracts on file yet.</p>
              </div>
              <CrmContractsTable 
                v-else
                :contracts="customerContracts" 
                :templates="templates" 
                :companyProfile="companyProfile"
                :isLoading="loadingContracts"
                @refresh="fetchCustomerContracts"
                @edit="ct => contractFormDialog?.openEditContract(ct)"
              />
            </div>
          </div>

          <!-- Technical Metadata -->
          <div class="bg-muted/20 rounded-3xl p-8 border border-dashed grid grid-cols-2 md:grid-cols-4 gap-6 text-[11px] text-muted-foreground font-mono">
            <div>
              <p class="font-bold text-foreground/30 uppercase tracking-widest mb-1">System Added</p>
              <p>{{ customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '—' }}</p>
            </div>
            <div>
              <p class="font-bold text-foreground/30 uppercase tracking-widest mb-1">Last Updated</p>
              <p>{{ customer.updatedAt ? new Date(customer.updatedAt).toLocaleDateString() : '—' }}</p>
            </div>
            <div>
              <p class="font-bold text-foreground/30 uppercase tracking-widest mb-1">Customer ID</p>
              <p class="truncate">{{ customerId }}</p>
            </div>
            <div>
              <p class="font-bold text-foreground/30 uppercase tracking-widest mb-1">Source</p>
              <p>{{ customer.source || 'Direct' }}</p>
            </div>
          </div>
        </div>

        <!-- Sidebar (Right) -->
        <div class="space-y-8">
          <!-- Contact Information Card -->
          <div class="bg-card rounded-3xl border p-8 space-y-6 shadow-sm ring-1 ring-primary/5">
            <h3 class="text-lg font-bold font-display flex items-center gap-2">
              <Icon name="i-lucide-contact" class="size-5 text-primary" />
              Contact Information
            </h3>
            
            <div class="space-y-4">
              <div class="group block p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all">
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Email Address</p>
                <div class="flex items-center justify-between">
                  <a v-if="customer.email" :href="`mailto:${customer.email}`" class="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate pr-2">
                    {{ customer.email }}
                  </a>
                  <span v-else class="text-sm text-muted-foreground">—</span>
                  <button v-if="customer.email" class="p-2 rounded-xl bg-background shadow-sm hover:bg-primary hover:text-white transition-all opacity-0 group-hover:opacity-100">
                    <Icon name="i-lucide-mail" class="size-4" />
                  </button>
                </div>
              </div>

              <div class="group block p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all">
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Phone Number</p>
                <div class="flex items-center justify-between">
                  <a v-if="customer.phone" :href="`tel:${customer.phone}`" class="text-sm font-bold text-foreground group-hover:text-emerald-600 transition-colors">
                    {{ customer.phone }}
                  </a>
                  <span v-else class="text-sm text-muted-foreground">—</span>
                  <button v-if="customer.phone" class="p-2 rounded-xl bg-background shadow-sm hover:bg-emerald-600 hover:text-white transition-all opacity-0 group-hover:opacity-100">
                    <Icon name="i-lucide-phone" class="size-4" />
                  </button>
                </div>
              </div>

              <div class="block p-4 rounded-2xl bg-muted/10 border border-transparent">
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Primary Address</p>
                <div class="flex items-start gap-3">
                  <div class="mt-1 p-2 rounded-lg bg-background border shadow-sm shrink-0">
                    <Icon name="i-lucide-map-pin" class="size-4 text-rose-500" />
                  </div>
                  <p class="text-sm text-foreground/80 font-medium leading-tight">
                    {{ [customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ') || 'No address provided' }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Related Contacts -->
          <div class="bg-card rounded-3xl border shadow-sm overflow-hidden min-h-[400px]">
            <CrmCustomerRelatedContacts :customer="customer" @updated="onCustomerUpdated" />
          </div>
        </div>
      </div>
    </template>
      
    <!-- Appointment Detail Slideover -->
    <Sheet v-model:open="showAptDetail">
      <SheetContent class="sm:max-w-xl overflow-y-auto w-full p-6 sm:p-8">
        <SheetHeader v-if="selectedApt">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
              <Icon name="i-lucide-calendar" class="size-6 text-primary" />
            </div>
            <div>
              <SheetTitle class="text-lg">{{ selectedApt.name || 'Unknown Contact' }}</SheetTitle>
              <SheetDescription>Calendly Appointment</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div v-if="selectedApt" class="mt-6 space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div v-if="selectedApt.email" class="flex items-center gap-2 text-sm">
              <Icon name="i-lucide-mail" class="size-4 text-muted-foreground shrink-0" />
              <a :href="`mailto:${selectedApt.email}`" class="text-primary hover:underline truncate">{{ selectedApt.email }}</a>
            </div>
            <div v-if="selectedApt.phone" class="flex items-center gap-2 text-sm">
              <Icon name="i-lucide-phone" class="size-4 text-muted-foreground shrink-0" />
              <a :href="`tel:${selectedApt.phone}`" class="text-primary hover:underline">{{ selectedApt.phone }}</a>
            </div>
            <div v-if="selectedApt.fields?.meetingScheduled" class="flex items-center gap-2 text-sm col-span-1 sm:col-span-2 mt-2 p-3 bg-muted/40 rounded-xl border">
              <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 shrink-0" />
              <div class="flex flex-col">
                <span class="font-bold text-foreground">Scheduled for:</span>
                <span class="text-muted-foreground">{{ formatDate(selectedApt.fields.meetingScheduled.startTime) }}</span>
              </div>
            </div>
          </div>

          <Separator />
          
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <span
              class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium capitalize w-fit"
              :class="selectedApt.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-sky-500/15 text-sky-600'"
            >
              Status: {{ selectedApt.status }}
            </span>
            <span class="text-xs text-muted-foreground sm:ml-auto">
              Booked {{ formatDate(selectedApt.dateSubmitted) }}
            </span>
          </div>

          <div v-if="selectedApt.message" class="space-y-2">
            <h4 class="text-sm font-medium text-foreground">Message / Notes</h4>
            <div class="rounded-lg bg-muted/30 p-4 text-sm text-foreground/80 leading-relaxed border border-border/50 whitespace-pre-wrap">
              {{ selectedApt.message }}
            </div>
          </div>

          <div v-if="selectedApt.fields && Object.keys(selectedApt.fields).length > 0" class="space-y-2">
            <h4 class="text-sm font-medium text-foreground">Additional Details</h4>
            <div class="rounded-lg border border-border/50 overflow-hidden divide-y divide-border/50">
              <div
                v-for="(entry, index) in Object.entries(selectedApt.fields).filter(([k]) => k !== 'meetingScheduled')"
                :key="entry[0]"
                class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-4 py-3 bg-card text-sm"
              >
                <span class="text-muted-foreground font-medium sm:min-w-[150px] sm:max-w-[180px] shrink-0">{{ entry[0] }}</span>
                <span class="text-foreground whitespace-pre-wrap break-words leading-relaxed">{{ entry[1] || '—' }}</span>
              </div>
            </div>
            
            <div v-if="selectedApt.fields.meetingScheduled" class="mt-4 flex flex-col sm:flex-row gap-3 pb-8">
              <a v-if="selectedApt.fields.meetingScheduled.rescheduleUrl" :href="selectedApt.fields.meetingScheduled.rescheduleUrl" target="_blank" class="px-4 py-2.5 rounded-lg bg-orange-500/10 text-orange-600 font-bold text-sm sm:text-xs ring-1 ring-orange-500/20 hover:bg-orange-500/20 transition-all flex items-center justify-center flex-1">
                Reschedule Link
              </a>
              <a v-if="selectedApt.fields.meetingScheduled.cancelUrl" :href="selectedApt.fields.meetingScheduled.cancelUrl" target="_blank" class="px-4 py-2.5 rounded-lg bg-red-500/10 text-red-600 font-bold text-sm sm:text-xs ring-1 ring-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center flex-1">
                Cancel Link
              </a>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
    
    <!-- Edit Custom Dialog -->
    <CrmCustomerFormDialog 
      v-model="showEditCustomer"
      :customer="customer"
      @saved="onCustomerUpdated"
    />
    
    <!-- Create Contract UI -->
    <CrmContractFormDialog
      ref="contractFormDialog"
      @saved="fetchCustomerContracts"
    />

    <!-- Delete Confirmation Dialog -->
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
          <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="deleteCustomer">
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
