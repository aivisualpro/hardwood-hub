<script setup lang="ts">
import { toast } from 'vue-sonner'

definePageMeta({
  key: route => route.params.id as string
})

const route = useRoute()
const customerId = route.params.id as string

const customer = ref<any>(null)
const isLoadingCustomer = ref(true)

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


onMounted(() => {
  fetchCustomer()
  fetchTemplates()
  fetchCompanyProfile()
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

async function deleteCustomer() {
  if (!confirm('Are you sure you want to delete this customer? This action cannot be undone.')) return
  
  try {
    const res = await $fetch<any>(`/api/customers/${customerId}`, { method: 'DELETE' })
    if (res.success) {
      toast.success('Customer deleted')
      navigateTo('/crm/customers')
    }
  } catch (e: any) {
    toast.error('Failed to delete customer')
  }
}

const visibleTabs = computed(() => {
  return tabs.filter(tab => {
    if (tab.id === 'details' || tab.id === 'conditional-logic' || tab.id === 'gallery') return true
    if (tab.id === 'contracts') return customerContracts.value.length > 0
    if (tab.typeFilter) {
      if (tab.typeFilter === 'gallery') return true
      return allSubmissions.value.some(s => s.type === tab.typeFilter)
    }
    return true
  })
})

const STAGES = [
  { id: 'contact made', label: 'contact made', bg: 'bg-[#FFD966]', text: 'text-black', border: 'border-[#FFD966]' },
  { id: 'Needs estimate', label: 'Needs estimate', bg: 'bg-[#FFE599]', text: 'text-black', border: 'border-[#FFE599]' },
  { id: 'Estimate sent', label: 'Estimate sent', bg: 'bg-[#F6B26B]', text: 'text-black', border: 'border-[#F6B26B]' },
  { id: 'Changes requested', label: 'Changes requested', bg: 'bg-[#4A86E8]', text: 'text-white', border: 'border-[#4A86E8]' },
  { id: 'Follow-Up Sent', label: 'Follow-Up Sent', bg: 'bg-[#E06666]', text: 'text-white', border: 'border-[#E06666]' },
  { id: 'Needs Sched', label: 'Needs Sched', bg: 'bg-[#EA9999]', text: 'text-black', border: 'border-[#EA9999]' },
  { id: 'Needs Contr', label: 'Needs Contr', bg: 'bg-[#B4A7D6]', text: 'text-black', border: 'border-[#B4A7D6]' },
  { id: 'Waiting for sign', label: 'Waiting for Si...', bg: 'bg-[#8E7CC3]', text: 'text-white', border: 'border-[#8E7CC3]' },
  { id: 'Needs Deposit', label: 'Needs Deposit', bg: 'bg-[#3D85C6]', text: 'text-white', border: 'border-[#3D85C6]' },
  { id: 'Needs wood', label: 'Needs wood', bg: 'bg-[#0B5394]', text: 'text-white', border: 'border-[#0B5394]' },
  { id: 'Needs Crew', label: 'Needs Crew', bg: 'bg-[#76A5AF]', text: 'text-black', border: 'border-[#76A5AF]' },
  { id: 'Project In Rev', label: 'Project Is Re...', bg: 'bg-[#45818E]', text: 'text-white', border: 'border-[#45818E]' },
  { id: 'Project In Pro', label: 'Project In Pro...', bg: 'bg-[#38761D]', text: 'text-white', border: 'border-[#38761D]' },
  { id: 'needs follow', label: 'needs follow', bg: 'bg-[#6AA84F]', text: 'text-white', border: 'border-[#6AA84F]' },
  { id: 'inspection do', label: 'inspection do...', bg: 'bg-[#93C47D]', text: 'text-black', border: 'border-[#93C47D]' },
  { id: 'Waiting for P', label: 'Waiting for P...', bg: 'bg-[#8FCE00]', text: 'text-black', border: 'border-[#8FCE00]' },
  { id: 'lost', label: 'lost', bg: 'bg-[#999999]', text: 'text-white', border: 'border-[#999999]' },
  { id: 'subscribers', label: 'subscribers', bg: 'bg-[#333333]', text: 'text-white', border: 'border-[#333333]' }
]

function normalizeStage(stageStr: string): string {
  if (!stageStr) return ''
  let s = stageStr.trim().toLowerCase()
  s = s.replace('neads', 'needs')
  s = s.replace(/needs estimate\s*$/, 'needs estimate')
  return s
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
  if (!customer.value) return STAGES
  let all = [...STAGES]
  if (customer.value.stage) {
     const exactVal = customer.value.stage.trim()
     const found = all.find(x => normalizeStage(x.id) === normalizeStage(exactVal))
     if (!found && exactVal) {
        all.push({ id: exactVal, label: exactVal, bg: 'bg-muted/80', text: 'text-foreground', border: 'border-border' })
     }
  }
  if (!stageSearch.value) return all
  const sub = stageSearch.value.toLowerCase()
  return all.filter(s => s.label.toLowerCase().includes(sub))
})

async function handleStageSelect(newStage: string) {
  if (!newStage.trim() || !customer.value) return
  customer.value.stage = newStage.trim()
  activeDropdown.value = null
  
  try {
    const res = await $fetch<any>(`/api/customers/${customerId}`, {
      method: 'PUT',
      body: { stage: customer.value.stage }
    })
    if (res.success) toast.success('Stage updated')
    else toast.error('Failed to update stage')
  } catch (err) {
    toast.error('Error updating stage')
  }
}

function getStageClasses(stageName: string) {
  if (!stageName) return 'bg-muted text-muted-foreground border-border'
  const norm = normalizeStage(stageName)
  const found = STAGES.find(s => normalizeStage(s.id) === norm)
  if (found) return `${found.bg} ${found.text} border ${found.border}`
  return 'bg-muted/80 text-foreground border-border'
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="isLoadingCustomer" class="space-y-4">
      <div class="h-24 bg-muted/40 rounded-xl animate-pulse" />
    </div>
    
    <div v-else-if="customer" class="space-y-6">
      
      <Teleport to="#header-toolbar">
        <div class="flex items-center gap-2">
          <!-- The CrmCustomerGallery handles dynamic header button injections via its own Teleport too! -->
          <button v-if="activeTab !== 'gallery'" @click="showEditCustomer = true" class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shrink-0 shadow-lg shadow-primary/20" title="Edit Customer">
            <Icon name="i-lucide-pencil" class="size-3.5" />
            <span class="hidden sm:inline">Edit</span>
          </button>
          <button v-if="activeTab !== 'gallery'" @click="deleteCustomer" class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-destructive/10 text-destructive text-xs sm:text-sm font-bold hover:bg-destructive/20 transition-all shrink-0" title="Delete Customer">
            <Icon name="i-lucide-trash-2" class="size-3.5" />
            <span class="hidden sm:inline">Delete</span>
          </button>
        </div>
      </Teleport>

      <!-- Tabs and Tables -->
      <div class="flex flex-col gap-4 -mt-4 lg:-mt-6">
        <div class="sticky top-(--header-height) z-30 bg-background/95 backdrop-blur-sm -mx-4 lg:-mx-6 px-4 lg:px-6 pt-4 lg:pt-6 border-b">
          <div class="flex items-center justify-start pb-1 overflow-x-auto no-scrollbar">
            <div class="flex items-center gap-0.5 min-w-max">
              <button
                v-for="tab in visibleTabs"
                :key="tab.id"
                class="relative flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap rounded-lg"
                :class="activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30' : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'"
                @click="navigateTo(`/crm/customers/${customerId}/${tab.id}`)"
              >
                <Icon :name="tab.icon" class="size-3.5 sm:size-4" />
                {{ tab.label }}
                <!-- Counter -->
                <div
                  v-if="tab.id !== 'details' && tab.id !== 'conditional-logic'"
                  class="ml-1 px-1.5 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold tabular-nums"
                  :class="activeTab === tab.id ? 'bg-background/25 text-primary-foreground' : 'bg-primary/10 text-primary group-hover:bg-primary/20'"
                >
                  {{ tab.id === 'contracts' ? customerContracts.length : (tab.id === 'gallery' ? (customer.gallery?.length || 0) : allSubmissions.filter(s => s.type === tab.typeFilter).length) }}
                </div>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Details View -->
        <div v-if="activeTab === 'details'" class="relative space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-card p-6 rounded-xl border border-border/50">
            <!-- Basic Info -->
            <div class="space-y-4">
              <div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Name / Company</h4>
                <div class="flex items-center gap-2">
                  <p class="font-medium text-foreground truncate">{{ customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || '—' }}</p>
                  
                  <!-- Stage Combobox -->
                  <div class="relative shrink-0" :class="activeDropdown === 'stage' ? 'z-50' : ''">
                    <button @click.stop="activeDropdown = activeDropdown === 'stage' ? null : 'stage'" class="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider hover:opacity-80 transition-colors shadow-sm shadow-black/5" :class="getStageClasses(customer.stage)">
                      {{ customer.stage || 'Set Stage' }}
                      <Icon name="i-lucide-chevron-down" class="size-3 ml-0.5 opacity-70" />
                    </button>
                    
                    <div v-if="activeDropdown === 'stage'" class="fixed inset-0 z-40" @click.stop="activeDropdown = null" />
                    <div v-if="activeDropdown === 'stage'" class="absolute left-0 mt-1 top-full w-[200px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                       <div class="p-2 border-b border-border/50">
                         <input ref="stageSearchInput" type="text" v-model="stageSearch" placeholder="Search or add fresh..." class="w-full bg-background border border-border/50 rounded filter-none px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary font-medium" @click.stop @keydown.enter="handleStageSelect(stageSearch)" />
                       </div>
                       <div class="max-h-[200px] overflow-y-auto py-1.5">
                          <button v-for="st in filteredStageOptions" :key="st.id" @click.stop="handleStageSelect(st.id)" class="w-full text-left px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-muted/60 transition-colors flex items-center gap-2">
                             <div class="size-2 rounded-full shadow-inner" :class="st.bg" />
                             <span class="truncate">{{ st.label }}</span>
                          </button>
                          <button v-if="stageSearch && !filteredStageOptions.find(s => s.id.toLowerCase() === stageSearch.toLowerCase())" @click.stop="handleStageSelect(stageSearch)" class="w-full text-left px-3 py-1.5 text-xs hover:bg-primary/10 text-primary transition-colors flex items-center gap-2 font-bold whitespace-nowrap">
                             <Icon name="i-lucide-plus" class="size-3.5 shrink-0" />
                             <span class="truncate">Add "{{ stageSearch }}"</span>
                          </button>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Contact</h4>
                <p class="font-medium text-sm text-foreground" v-if="customer.email">{{ customer.email }}</p>
                <p class="font-medium text-sm text-foreground" v-if="customer.phone">{{ customer.phone }}</p>
                <p class="text-sm text-muted-foreground" v-if="!customer.email && !customer.phone">—</p>
              </div>
              <div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Tags</h4>
                <div class="flex flex-wrap gap-1">
                  <span v-for="tag in customer.tags" :key="tag" class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted text-foreground border">{{ tag }}</span>
                  <span v-if="!customer.tags?.length" class="text-sm text-muted-foreground">—</span>
                </div>
              </div>
            </div>

            <!-- Project & Sales Details -->
            <div class="space-y-4">
              <div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Sales Info</h4>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <p class="text-xs text-muted-foreground">Assigned To</p>
                    <p class="font-medium text-sm">{{ customer.assignedTo || '—' }}</p>
                  </div>
                </div>
              </div>
              <div class="pt-2 border-t border-border/40">
                <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Project Info</h4>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <p class="text-xs text-muted-foreground">Project Manager</p>
                    <p class="font-medium text-sm">{{ customer.projectAssignedTo || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Duration</p>
                    <p class="font-medium text-sm">{{ customer.estimatedProjectDuration || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Total Estimate</p>
                    <p class="font-medium text-sm">
                      {{ customer.totalEstimate ? '$' + customer.totalEstimate.toLocaleString() : '—' }}
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Views</p>
                    <p class="font-medium text-sm">{{ customer.totalTrackedViews || '0' }}</p>
                  </div>
                </div>
              </div>
              <div class="pt-2 border-t border-border/40">
                <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Location</h4>
                <div class="grid grid-cols-2 gap-4">
                  <div class="col-span-2">
                    <p class="text-xs text-muted-foreground">Address</p>
                    <p class="font-medium text-sm text-foreground">{{ customer.address || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">City</p>
                    <p class="font-medium text-sm text-foreground">{{ customer.city || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">State</p>
                    <p class="font-medium text-sm text-foreground">{{ customer.state || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Zip Code</p>
                    <p class="font-medium text-sm text-foreground">{{ customer.zip || '—' }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Timeline & Dates -->
            <div class="space-y-4">
              <div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Key Dates</h4>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <p class="text-xs text-muted-foreground">Initial Contact</p>
                    <p class="text-sm font-medium">{{ customer.initialContactDate ? new Date(customer.initialContactDate).toLocaleDateString() : '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Estimate Sent</p>
                    <p class="text-sm font-medium">{{ customer.estimateSentOn ? new Date(customer.estimateSentOn).toLocaleDateString() : '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Last Follow-up</p>
                    <p class="text-sm font-medium">{{ customer.lastFollowUpSentOn ? new Date(customer.lastFollowUpSentOn).toLocaleDateString() : '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Approved On</p>
                    <p class="text-sm font-medium">{{ customer.dateApproved ? new Date(customer.dateApproved).toLocaleDateString() : '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">Wood Ordered</p>
                    <p class="text-sm font-medium">{{ customer.woodOrderDate ? new Date(customer.woodOrderDate).toLocaleDateString() : '—' }}</p>
                  </div>
                </div>
              </div>
              <div class="pt-2 border-t border-border/40">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">System Added</h4>
                    <p class="text-sm text-muted-foreground">{{ customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '—' }}</p>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Last Updated</h4>
                    <p class="text-sm text-muted-foreground">{{ customer.updatedAt ? new Date(customer.updatedAt).toLocaleDateString() : '—' }}</p>
                  </div>
                </div>
              </div>
              <div class="pt-2 border-t border-border/40">
                <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Notes</h4>
                <p class="text-sm text-foreground whitespace-pre-wrap">{{ customer.notes || '—' }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Gallery View -->
        <div v-else-if="activeTab === 'gallery'" class="relative">
          <CrmCustomerGallery :customer="customer" @updated="onCustomerUpdated" />
        </div>

        <!-- Contracts View -->
        <div v-else-if="activeTab === 'contracts'" class="relative">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-lg">Contracts</h3>
            <button @click="contractFormDialog?.openForCustomer(customer)" class="inline-flex items-center justify-center gap-2 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm">
              <Icon name="i-lucide-plus" class="size-3.5" />
              New Contract
            </button>
          </div>

          <div v-if="loadingContracts" class="space-y-4">
            <div v-for="i in 3" :key="i" class="h-16 bg-muted/40 rounded-xl animate-pulse" />
          </div>
          <div v-else-if="customerContracts.length === 0" class="flex flex-col items-center justify-center py-12 text-center border bg-card rounded-xl border-dashed">
            <Icon name="i-lucide-file-signature" class="size-8 text-muted-foreground mb-4" />
            <h3 class="font-bold text-lg mb-1">No contracts found</h3>
            <p class="text-sm text-muted-foreground mb-4">This customer has no active contracts on file.</p>
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

        <!-- Appointments View -->
        <div v-else-if="activeTab === 'appointments'" class="relative space-y-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-lg">Appointments</h3>
            <!-- View Actions (List vs Calendar) -->
            <div class="bg-muted p-0.5 hidden sm:flex rounded-lg items-center shadow-inner border border-input/50 h-8 sm:h-9">
              <button 
                @click="aptViewMode = 'calendar'"
                class="px-2.5 h-full rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
                :class="aptViewMode === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
              >
                <Icon name="i-lucide-calendar" class="size-3.5" />
                <span class="sr-only">Calendar</span>
              </button>
              <button 
                @click="aptViewMode = 'list'"
                class="px-2.5 h-full rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
                :class="aptViewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
              >
                <Icon name="i-lucide-list" class="size-3.5" />
                <span class="sr-only">List</span>
              </button>
            </div>
          </div>

          <CrmCalendarView 
            v-if="aptViewMode === 'calendar'"
            :items="customerSubmissions" 
            :is-loading="loadingSubmissionsForTab" 
            @update-status="handleStatusUpdate"
            @select="openAptDetails"
            class="min-h-[600px] mb-8"
          />
          <CrmSubmissionsTable
            v-else
            :items="customerSubmissions"
            :is-loading="loadingSubmissionsForTab"
            :show-type-column="false"
            type="appointment"
            empty-icon="i-lucide-calendar-check"
            empty-title="No appointment requests yet"
            empty-description="This customer hasn't booked any meetings yet"
            @toggle-star="handleToggleStar"
            @update-status="handleStatusUpdate"
          />
        </div>

        <!-- Table view of generic submissions for the other tabs -->
        <div v-else class="relative">
          <CrmSubmissionsTable
            :items="customerSubmissions"
            :is-loading="loadingSubmissionsForTab"
            :show-type-column="false"
            class="sticky-header"
            :is-embedded="true"
            :empty-icon="tabs.find(t => t.id === activeTab)?.icon"
            :empty-title="`No ${tabs.find(t => t.id === activeTab)?.label} found`"
            empty-description="This customer hasn't submitted this type of form yet."
            @toggle-star="handleToggleStar"
            @update-status="handleStatusUpdate"
          />
        </div>
      </div>
      
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
      
      <!-- Create Contract UI specifically instantiated for this active context -->
      <CrmContractFormDialog
        ref="contractFormDialog"
        @saved="fetchCustomerContracts"
      />
      
    </div>
  </div>
</template>
