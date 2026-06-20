<script setup lang="ts">
import { format } from 'date-fns'
import { toast } from 'vue-sonner'

definePageMeta({
  key: route => route.params.id as string,
})

const route = useRoute()
const customerId = route.params.id as string

const customer = ref<any>(null)

// ─── Type Dropdown Resolution ────────────────────────────────────────────
interface TypeOption { _id: string, label: string, value: string, color: string, icon: string, order: number }
const typeOptions = ref<TypeOption[]>([])
const typeMap = computed(() => {
  const map = new Map<string, TypeOption>()
  for (const opt of typeOptions.value) map.set(String(opt._id), opt)
  return map
})

function resolveType(c: any): TypeOption | undefined {
  if (!c?.type) return undefined
  const id = String(c.type)
  const byId = typeMap.value.get(id)
  if (byId) return byId
  return typeOptions.value.find(o => o.label?.toLowerCase() === id.toLowerCase() || o.value?.toLowerCase() === id.toLowerCase())
}

const { setHeader } = usePageHeader()

function updateHeader(cust: any) {
  if (!cust) return
  setHeader({
    title: cust.name || `${cust.firstName || ''} ${cust.lastName || ''}`.trim() || 'Customer Profile',
    icon: 'i-lucide-user',
    description: cust.email || cust.phone || 'Customer Dashboard',
  })
}

// ─── Related Contracts ───────────────────────────────────────────────────
const customerContracts = ref<any[]>([])
const loadingContracts = ref(false)
const templates = ref<any[]>([])
const companyProfile = ref<any>({})

async function fetchCustomerContracts() {
  loadingContracts.value = true
  try {
    const res = await $fetch<any>(`/api/contracts?customerId=${customerId}`)
    if (res.success) customerContracts.value = res.data || []
  }
  catch { console.error('Failed to load contracts') }
  finally { loadingContracts.value = false }
}

// ─── Related Projects (pipeline entries with same customer name) ─────────
const relatedProjects = ref<any[]>([])
const loadingRelatedProjects = ref(false)

async function fetchRelatedProjects() {
  if (!customer.value?.name) { relatedProjects.value = []; return }
  loadingRelatedProjects.value = true
  try {
    const res = await $fetch<any>('/api/pipeline', {
      params: { search: customer.value.name, limit: 100 },
    })
    const name = customer.value.name.toLowerCase()
    relatedProjects.value = (res.data || []).filter(
      (r: any) => r.name && r.name.toLowerCase() === name,
    )
  }
  catch { console.error('Failed to load related projects') }
  finally { loadingRelatedProjects.value = false }
}

// ─── Fetch all page data ─────────────────────────────────────────────────
async function loadPageData() {
  const [custRes, templatesRes, settingsRes, typeDropdownRes] = await Promise.all([
    $fetch<any>(`/api/customers/${customerId}`),
    $fetch<{ success: boolean, data: any[] }>('/api/contracts/templates'),
    $fetch<{ success: boolean, data: Record<string, any> }>('/api/app-settings'),
    $fetch<any>('/api/dropdowns?name=Customer Type').catch(() => null),
  ])
  if (custRes.success) customer.value = custRes.data
  templates.value = templatesRes.data || []
  if (settingsRes.data?.companyProfile) companyProfile.value = settingsRes.data.companyProfile

  if (typeDropdownRes?.data?.options) {
    typeOptions.value = typeDropdownRes.data.options
  }
  else if (typeDropdownRes?.data && Array.isArray(typeDropdownRes.data)) {
    const match = typeDropdownRes.data.find((dd: any) => dd.name === 'Customer Type')
    if (match?.options) typeOptions.value = match.options
  }

  if (customer.value) {
    updateHeader(customer.value)
    fetchCustomerContracts()
    fetchRelatedProjects()
  }
}

onMounted(loadPageData)

watch(customer, (newCust) => {
  if (newCust) updateHeader(newCust)
})

// ─── Edit / Delete ───────────────────────────────────────────────────────
const showEditCustomer = ref(false)
const contractFormDialog = ref<any>(null)
const galleryRef = ref<any>(null)
const documentsRef = ref<any>(null)
const relatedContactsRef = ref<any>(null)
const showDeleteConfirm = ref(false)
const saving = ref(false)

// ─── Customer edit form (mirrors /crm/customers list page) ───────────────
function emptyEditForm() {
  return {
    name: '',
    type: '' as string,
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    notes: '',
  }
}
const editForm = ref(emptyEditForm())

function openEditCustomer() {
  if (!customer.value) return
  editForm.value = {
    name: customer.value.name || '',
    type: customer.value.type ? String(customer.value.type) : '',
    email: customer.value.email || '',
    phone: customer.value.phone || '',
    address: customer.value.address || '',
    city: customer.value.city || '',
    state: customer.value.state || '',
    zip: customer.value.zip || '',
    notes: customer.value.notes || '',
  }
  showEditCustomer.value = true
}

async function saveCustomerEdit() {
  if (!editForm.value.name.trim()) {
    toast.error('Name is required')
    return
  }
  saving.value = true
  try {
    const res = await $fetch<any>(`/api/customers/${customerId}`, {
      method: 'PUT',
      body: editForm.value,
    })
    if (res.success) {
      customer.value = res.data
      updateHeader(res.data)
      toast.success('Customer updated')
      showEditCustomer.value = false
    }
  }
  catch (e: any) {
    toast.error('Failed to update', { description: e?.message })
  }
  finally {
    saving.value = false
  }
}

// ─── Type Dropdown for edit form ─────────────────────────────────────────
const activeEditDropdown = ref<string | null>(null)
const editTypeSearch = ref('')
const editTypeSearchInput = ref<HTMLInputElement | null>(null)

const filteredEditTypeOptions = computed(() => {
  if (!editTypeSearch.value) return typeOptions.value
  const s = editTypeSearch.value.toLowerCase()
  return typeOptions.value.filter((o: any) =>
    (o.label || '').toLowerCase().includes(s)
    || (o.value || '').toLowerCase().includes(s),
  )
})

function selectEditType(opt: any) {
  editForm.value.type = String(opt._id)
  activeEditDropdown.value = null
  editTypeSearch.value = ''
}

function clearEditType() {
  editForm.value.type = ''
}

async function addNewEditType(label: string) {
  if (!label.trim()) return
  const newOpt = { label: label.trim(), value: label.trim(), color: '#6366f1', icon: '', order: typeOptions.value.length }
  try {
    const res = await $fetch<any>('/api/dropdowns', {
      method: 'POST',
      body: { name: 'Customer Type', options: [...typeOptions.value, newOpt] },
    })
    if (res.data) {
      typeOptions.value = res.data.options || []
      const added = typeOptions.value[typeOptions.value.length - 1]
      if (added) editForm.value.type = String(added._id)
    }
    editTypeSearch.value = ''
    activeEditDropdown.value = null
    toast.success(`Type "${label.trim()}" added`)
  }
  catch {
    toast.error('Failed to add type')
  }
}

watch(activeEditDropdown, (val) => {
  if (val === 'type') {
    nextTick(() => editTypeSearchInput.value?.focus())
  }
})

function onCustomerUpdated(updatedCustomer: any) {
  customer.value = updatedCustomer
  updateHeader(customer.value)
}

async function deleteCustomer() {
  try {
    const res = await $fetch<any>(`/api/customers/${customerId}`, { method: 'DELETE' })
    if (res.success) {
      toast.success('Customer deleted')
      navigateTo('/crm/customers')
    }
  }
  catch { toast.error('Failed to delete customer') }
  finally { showDeleteConfirm.value = false }
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function formatDate(d: string) { return d ? format(new Date(d), 'MMM dd, yyyy') : '—' }
</script>

<template>
  <div class="h-full overflow-hidden -mx-4 lg:-mx-6">
    <!-- ── Header toolbar: Edit + Delete ────────────────────────────── -->
    <ClientOnly>
      <Teleport to="#header-toolbar">
        <div class="flex items-center gap-2">
          <button class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20" @click="openEditCustomer">
            <Icon name="i-lucide-pencil" class="size-3.5" />
            <span class="hidden sm:inline">Edit</span>
          </button>
          <button class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-destructive/10 text-destructive text-xs sm:text-sm font-bold hover:bg-destructive/20 transition-all" @click="showDeleteConfirm = true">
            <Icon name="i-lucide-trash-2" class="size-3.5" />
            <span class="hidden sm:inline">Delete</span>
          </button>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- ── 3-column layout ─────────────────────────────────────────── -->
    <div class="flex h-full overflow-hidden divide-x divide-border">
      <!-- ══ LEFT COLUMN — Customer Details + Related Contacts ══════ -->
      <div class="w-[32%] min-w-0 flex flex-col gap-3 px-4 lg:px-5 py-4 overflow-y-auto">
        <!-- ── Customer Details Card ──────────────────────────────── -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center gap-2 shrink-0">
            <Icon name="i-lucide-user" class="size-4 text-primary shrink-0" />
            <h3 class="text-sm font-bold text-foreground">
              Customer Details
            </h3>
          </div>
          <div v-if="customer" class="px-5 py-4 space-y-3 flex-1 min-h-0 overflow-y-auto">
            <!-- Customer Name -->
            <div>
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                Customer Name
              </p>
              <p class="text-sm font-bold text-foreground">
                {{ customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || '—' }}
              </p>
            </div>
            <!-- Type -->
            <div v-if="resolveType(customer)">
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                Type
              </p>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border"
                :style="{ backgroundColor: resolveType(customer)!.color + '20', color: resolveType(customer)!.color, borderColor: resolveType(customer)!.color + '40' }"
              >
                {{ resolveType(customer)!.label }}
              </span>
            </div>
            <!-- Email & Phone -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                  Email
                </p>
                <a v-if="customer.email" :href="`mailto:${customer.email}`" class="text-xs font-semibold text-primary hover:underline truncate block">{{ customer.email }}</a>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </div>
              <div>
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                  Phone
                </p>
                <a v-if="customer.phone" :href="`tel:${customer.phone}`" class="text-xs font-semibold text-foreground hover:text-primary transition-colors">{{ customer.phone }}</a>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </div>
            </div>
            <!-- Address -->
            <div>
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                Address
              </p>
              <p class="text-xs text-foreground/80 font-medium leading-relaxed">
                {{ customer.address || '—' }}
              </p>
            </div>
            <!-- City & State & Zip -->
            <div class="grid grid-cols-3 gap-3">
              <div>
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                  City
                </p>
                <p class="text-xs font-semibold text-foreground">
                  {{ customer.city || '—' }}
                </p>
              </div>
              <div>
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                  State
                </p>
                <p class="text-xs font-semibold text-foreground">
                  {{ customer.state || '—' }}
                </p>
              </div>
              <div>
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                  Zip
                </p>
                <p class="text-xs font-semibold text-foreground">
                  {{ customer.zip || '—' }}
                </p>
              </div>
            </div>
            <!-- Notes -->
            <div v-if="customer.notes">
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Notes
              </p>
              <p class="text-xs text-foreground/70 leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border border-dashed">
                {{ customer.notes }}
              </p>
            </div>
            <!-- Tags -->
            <div v-if="customer.tags?.length" class="pt-1 border-t border-border/50">
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Tags
              </p>
              <div class="flex flex-wrap gap-1">
                <span v-for="tag in customer.tags" :key="tag" class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted text-foreground border">{{ tag }}</span>
              </div>
            </div>
            <!-- Key Dates -->
            <div class="pt-1 border-t border-border/50">
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Record Info
              </p>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <p class="text-[9px] text-muted-foreground uppercase tracking-wider">
                    Created
                  </p>
                  <p class="text-[11px] font-semibold">
                    {{ customer.createdAt ? formatDate(customer.createdAt) : '—' }}
                  </p>
                </div>
                <div>
                  <p class="text-[9px] text-muted-foreground uppercase tracking-wider">
                    Updated
                  </p>
                  <p class="text-[11px] font-semibold">
                    {{ customer.updatedAt ? formatDate(customer.updatedAt) : '—' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="px-5 py-8">
            <div class="space-y-2 w-full">
              <div v-for="i in 4" :key="i" class="h-4 bg-muted/40 rounded animate-pulse" :style="`width: ${[88, 75, 92, 80][i - 1]}%`" />
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
            <CrmCustomerRelatedContacts v-if="customer" ref="relatedContactsRef" :customer="customer" api-prefix="/api/customers" @updated="onCustomerUpdated" />
          </div>
        </div>
      </div>

      <!-- ══ MIDDLE COLUMN — Contracts + Related Projects ══════════════ -->
      <div class="flex-1 min-w-0 flex flex-col gap-3 px-4 lg:px-5 py-4 overflow-y-auto">
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

        <!-- Related Projects (pipeline entries) -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-kanban" class="size-4 text-emerald-500 shrink-0" />
              <h3 class="text-sm font-bold text-foreground">
                Related Projects
              </h3>
            </div>
            <span v-if="relatedProjects.length" class="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{{ relatedProjects.length }}</span>
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
              class="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/20 transition-colors border-l-[3px] border-l-transparent hover:border-l-emerald-500"
            >
              <div class="w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                <Icon name="i-lucide-folder-kanban" class="size-3 text-muted-foreground" />
              </div>
              <span class="text-xs font-bold text-foreground truncate min-w-0 flex-1">
                {{ proj.projectName || proj.name || '—' }}
              </span>
              <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">{{ proj.stage || '—' }}</span>
              <span class="text-[10px] text-muted-foreground shrink-0">{{ proj.createdAt ? formatDate(proj.createdAt) : '—' }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- ══ RIGHT COLUMN — Gallery + Documents ════════════════════════ -->
      <div class="w-[30%] min-w-0 flex flex-col gap-3 px-4 lg:px-5 py-4 overflow-y-auto">
        <!-- Gallery Card -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-0">
          <div class="px-5 py-3 border-b bg-muted/30 flex items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-2 shrink-0">
              <Icon name="i-lucide-images" class="size-4 text-violet-500 shrink-0" />
              <h3 class="text-sm font-bold text-foreground">
                Gallery
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
            <CrmCustomerGallery ref="galleryRef" :customer="customer" api-prefix="/api/customers" @updated="onCustomerUpdated" />
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
      </div>
    </div><!-- /3-column -->

    <!-- ── Dialogs ────────────────────────────────────────────────────── -->
    <!-- ── Edit Customer Dialog (matches /crm/customers list page) ── -->
    <Dialog v-model:open="showEditCustomer">
      <DialogContent class="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div class="flex items-center gap-3 mb-1">
            <div class="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Icon name="i-lucide-pencil" class="size-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Edit Customer</DialogTitle>
              <DialogDescription class="text-xs mt-0.5">
                Update customer details
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="space-y-4 pt-2">
          <!-- Name -->
          <div class="space-y-1.5">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Name <span class="text-destructive">*</span></Label>
            <Input v-model="editForm.name" placeholder="e.g. John Smith" class="h-9 text-sm" />
          </div>

          <!-- Type -->
          <div class="space-y-1.5 relative" :class="activeEditDropdown === 'type' ? 'z-50' : ''">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</Label>
            <div class="relative">
              <button type="button" class="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-input bg-background hover:bg-muted/50 transition-colors shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary h-9" @click.stop="activeEditDropdown = activeEditDropdown === 'type' ? null : 'type'">
                <div class="flex items-center gap-2">
                  <div v-if="resolveType({ type: editForm.type })" class="size-2.5 rounded-full" :style="{ backgroundColor: resolveType({ type: editForm.type })!.color }" />
                  <span :class="editForm.type ? 'text-foreground font-medium' : 'text-muted-foreground'">{{ resolveType({ type: editForm.type })?.label || 'Select type...' }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <button v-if="editForm.type" type="button" class="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" @click.stop="clearEditType">
                    <Icon name="i-lucide-x" class="size-3" />
                  </button>
                  <Icon name="i-lucide-chevron-down" class="size-4 opacity-50" />
                </div>
              </button>

              <div v-if="activeEditDropdown === 'type'" class="fixed inset-0 z-40" @click.stop="activeEditDropdown = null" />
              <div v-if="activeEditDropdown === 'type'" class="absolute left-0 mt-1 top-full w-full bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl shadow-primary/5 z-50 flex flex-col ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div class="p-2 border-b border-border/50">
                  <input ref="editTypeSearchInput" v-model="editTypeSearch" type="text" placeholder="Search or add new..." class="w-full bg-background border border-border/50 rounded filter-none px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary" @click.stop @keydown.enter.prevent="editTypeSearch && !filteredEditTypeOptions.find(o => o.label.toLowerCase() === editTypeSearch.toLowerCase()) ? addNewEditType(editTypeSearch) : (filteredEditTypeOptions.length === 1 && filteredEditTypeOptions[0]) ? selectEditType(filteredEditTypeOptions[0]!) : null">
                </div>
                <div class="max-h-[200px] overflow-y-auto py-1.5">
                  <button v-for="opt in filteredEditTypeOptions" :key="opt._id" type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between gap-2" @click.stop="selectEditType(opt)">
                    <div class="flex items-center gap-2">
                      <div class="size-2.5 rounded-full" :style="{ backgroundColor: opt.color || '#6366f1' }" />
                      <span class="truncate" :class="editForm.type === String(opt._id) ? 'font-bold text-primary' : ''">{{ opt.label }}</span>
                    </div>
                    <Icon v-if="editForm.type === String(opt._id)" name="i-lucide-check" class="size-4 text-primary shrink-0" />
                  </button>
                  <button v-if="editTypeSearch && !filteredEditTypeOptions.find(o => o.label.toLowerCase() === editTypeSearch.toLowerCase())" type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 text-primary transition-colors flex items-center gap-2 font-bold whitespace-nowrap" @click.stop="addNewEditType(editTypeSearch)">
                    <Icon name="i-lucide-plus" class="size-4 shrink-0" />
                    <span class="truncate">Add "{{ editTypeSearch }}"</span>
                  </button>
                  <div v-if="!filteredEditTypeOptions.length && !editTypeSearch" class="px-3 py-2 text-xs text-muted-foreground text-center">
                    No types available.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Contact -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</Label>
              <Input v-model="editForm.email" type="email" placeholder="email@example.com" class="h-9 text-sm" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Phone</Label>
              <Input v-model="editForm.phone" placeholder="+1 (555) 000-0000" class="h-9 text-sm" />
            </div>
          </div>

          <!-- Address -->
          <div class="space-y-1.5">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Address</Label>
            <Input v-model="editForm.address" placeholder="123 Main St" class="h-9 text-sm" />
          </div>

          <!-- City / State / Zip -->
          <div class="grid grid-cols-6 gap-3">
            <div class="space-y-1.5 col-span-3">
              <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">City</Label>
              <Input v-model="editForm.city" placeholder="Ann Arbor" class="h-9 text-sm" />
            </div>
            <div class="space-y-1.5 col-span-1">
              <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">State</Label>
              <Input v-model="editForm.state" placeholder="MI" maxlength="2" class="h-9 text-sm" />
            </div>
            <div class="space-y-1.5 col-span-2">
              <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Zip</Label>
              <Input v-model="editForm.zip" placeholder="48104" maxlength="10" class="h-9 text-sm" />
            </div>
          </div>

          <!-- Notes -->
          <div class="space-y-1.5">
            <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Notes</Label>
            <textarea
              v-model="editForm.notes"
              placeholder="Any additional notes..."
              rows="3"
              class="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        <DialogFooter class="pt-4 gap-2">
          <Button variant="outline" @click="showEditCustomer = false">
            Cancel
          </Button>
          <Button :disabled="saving" @click="saveCustomerEdit">
            <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <CrmContractFormDialog
      ref="contractFormDialog"
      @saved="fetchCustomerContracts"
    />

    <AlertDialog :open="showDeleteConfirm" @update:open="v => showDeleteConfirm = v">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Customer</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this customer? This action cannot be undone.
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
