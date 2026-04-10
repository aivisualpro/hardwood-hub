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
  { id: 'estimates', label: 'Estimates', icon: 'i-lucide-ruler', typeFilter: 'flooring-estimate' },
  { id: 'contracts', label: 'Contracts', icon: 'i-lucide-file-signature', typeFilter: 'contract' },
  { id: 'emails', label: 'Emails', icon: 'i-lucide-mail', typeFilter: 'email' },
]

async function fetchCustomer() {
  isLoadingCustomer.value = true
  try {
    const res = await $fetch<any>(`/api/customers/${customerId}`)
    if (res.success) {
      customer.value = res.data
      setHeader({
        title: customer.value.name || `${customer.value.firstName} ${customer.value.lastName}`.trim(),
        icon: 'i-lucide-user',
        description: customer.value.email || customer.value.phone || 'Customer Profile',
      })
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

watch(customer, (newCust) => {
  if (!newCust) return
  fetchAllData(newCust.email, newCust.phone)
  fetchCustomerContracts()
}, { immediate: true })

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
  setHeader({
    title: customer.value.name || `${customer.value.firstName} ${customer.value.lastName}`.trim(),
    icon: 'i-lucide-user',
    description: customer.value.email || customer.value.phone || 'Customer Profile',
  })
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
</script>

<template>
  <div class="space-y-6">
    <div v-if="isLoadingCustomer" class="space-y-4">
      <div class="h-24 bg-muted/40 rounded-xl animate-pulse" />
    </div>
    
    <div v-else-if="customer" class="space-y-6">
      
      <Teleport to="#header-toolbar">
        <div class="flex items-center gap-2">
          <button @click="showEditCustomer = true" class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shrink-0 shadow-lg shadow-primary/20" title="Edit Customer">
            <Icon name="i-lucide-pencil" class="size-3.5" />
            <span class="hidden sm:inline">Edit</span>
          </button>
          <button @click="deleteCustomer" class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-destructive/10 text-destructive text-xs sm:text-sm font-bold hover:bg-destructive/20 transition-all shrink-0" title="Delete Customer">
            <Icon name="i-lucide-trash-2" class="size-3.5" />
            <span class="hidden sm:inline">Delete</span>
          </button>
        </div>
      </Teleport>

      <!-- Tabs and Tables -->
      <div class="flex flex-col gap-4">
        <div class="sticky top-(--header-height) z-30 bg-background/95 backdrop-blur-sm -mx-4 lg:-mx-6 px-4 lg:px-6 pt-2 border-b">
          <div class="flex items-center justify-start pb-1 overflow-x-auto no-scrollbar">
            <div class="flex items-center gap-0.5 min-w-max">
              <button
                v-for="tab in tabs"
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
                  {{ tab.id === 'contracts' ? customerContracts.length : allSubmissions.filter(s => s.type === tab.typeFilter).length }}
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
                <p class="font-medium text-foreground">{{ customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || '—' }}</p>
              </div>
              <div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Contact</h4>
                <p class="font-medium text-sm text-foreground" v-if="customer.email">{{ customer.email }}</p>
                <p class="font-medium text-sm text-foreground" v-if="customer.phone">{{ customer.phone }}</p>
                <p class="text-sm text-muted-foreground" v-if="!customer.email && !customer.phone">—</p>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Type</h4>
                  <span class="px-2.5 py-1 rounded-full text-xs font-bold capitalize bg-primary/10 text-primary">{{ customer.type || 'lead' }}</span>
                </div>
                <div>
                  <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Status</h4>
                  <span class="px-2.5 py-1 rounded-full text-xs font-bold capitalize border bg-muted/50 text-muted-foreground">{{ customer.status || 'new' }}</span>
                </div>
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
                    <p class="text-xs text-muted-foreground">Stage</p>
                    <p class="font-medium text-sm">{{ customer.stage || '—' }}</p>
                  </div>
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
                <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Full Address</h4>
                <p class="font-medium text-sm text-foreground">
                  {{ [customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ') || '—' }}
                </p>
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

        <!-- Table view of submissions for the active tab -->
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
