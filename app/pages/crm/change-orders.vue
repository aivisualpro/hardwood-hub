<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
const { canCreate, canDelete } = usePermissions('/crm/change-orders')

setHeader({
  title: 'Change Orders',
  icon: 'i-lucide-file-diff',
  description: 'Create and manage change orders for projects',
})

// ─── Types ───────────────────────────────────────────────
interface ChangeOrderRecord {
  _id: string
  changeOrderNumber: string
  title: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  customerAddress: string
  projectId: string
  projectName: string
  templateId: string
  templateName: string
  variableValues: Record<string, string>
  content: string
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface TemplateVariable {
  key: string
  label: string
  type: string
  defaultValue: string
  options?: string[]
  required: boolean
  scope?: 'template' | 'client'
}

// ─── List State ──────────────────────────────────────────
const changeOrders = ref<ChangeOrderRecord[]>([])
const loading = ref(true)
const searchQuery = ref('')

async function fetchChangeOrders() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: ChangeOrderRecord[] }>('/api/change-orders', {
      params: searchQuery.value ? { search: searchQuery.value } : {},
    })
    changeOrders.value = res.data || []
  }
  catch (e: any) {
    toast.error('Failed to load change orders', { description: e?.message })
  }
  finally {
    loading.value = false
  }
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Delete ──────────────────────────────────────────────
async function deleteChangeOrder(id: string) {
  toast.warning('Delete Change Order?', {
    description: 'This action cannot be undone.',
    action: {
      label: 'Delete',
      onClick: async () => {
        try {
          await $fetch(`/api/change-orders/${id}`, { method: 'DELETE' })
          toast.success('Change order deleted')
          fetchChangeOrders()
        }
        catch (e: any) {
          toast.error('Delete failed', { description: e?.message })
        }
      },
    },
    cancel: { label: 'Cancel', onClick: () => {} },
  })
}

// ─── Download PDF ────────────────────────────────────────
async function downloadPDF(co: ChangeOrderRecord) {
  toast.loading('Generating Change Order PDF...')
  try {
    const response = await fetch(`/api/change-orders/download-pdf/${co._id}`)
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `Server returned ${response.status}`)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = `ChangeOrder_${co.changeOrderNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.dismiss()
      toast.success('PDF downloaded successfully')
    }, 600)
  }
  catch (err: any) {
    toast.dismiss()
    toast.error('Could not generate PDF', { description: err?.message || 'Server error' })
  }
}

// ─── Create/Edit Dialog ──────────────────────────────────
const showDialog = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const createStep = ref(1) // 1=customer, 2=project, 3=fill fields

// Step 1: Customer
const customers = ref<any[]>([])
const loadingCustomers = ref(false)
const customerSearch = ref('')
const selectedCustomer = ref<any | null>(null)

async function fetchCustomers() {
  loadingCustomers.value = true
  try {
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/customers', {
      params: { limit: 0, search: customerSearch.value || undefined },
    })
    customers.value = res.data || []
  }
  catch { toast.error('Failed to load customers') }
  finally { loadingCustomers.value = false }
}

const filteredCustomers = computed(() => {
  if (!customerSearch.value) return customers.value
  const q = customerSearch.value.toLowerCase()
  return customers.value.filter(c =>
    c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q),
  )
})

// Step 2: Project
const projects = ref<any[]>([])
const loadingProjects = ref(false)
const projectSearch = ref('')
const selectedProject = ref<any | null>(null)

async function fetchProjects(custId: string) {
  loadingProjects.value = true
  try {
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/pipeline', {
      params: { limit: 200, customerId: custId },
    })
    projects.value = res.data || []
  }
  catch { toast.error('Failed to load projects') }
  finally { loadingProjects.value = false }
}

const filteredProjects = computed(() => {
  if (!projectSearch.value) return projects.value
  const q = projectSearch.value.toLowerCase()
  return projects.value.filter(p =>
    p.name?.toLowerCase().includes(q) || p.projectName?.toLowerCase().includes(q),
  )
})

// Step 3: Template + Variables
const changeOrderTemplate = ref<any | null>(null)
const loadingTemplate = ref(false)
const variableValues = ref<Record<string, string>>({})
const contractTitle = ref('')

// Company profile for auto-fill
const companyProfile = ref<any>({})
async function fetchCompanyProfile() {
  try {
    const res = await $fetch<{ success: boolean, data: Record<string, any> }>('/api/app-settings')
    if (res.data?.companyProfile)
      companyProfile.value = res.data.companyProfile
  }
  catch { /* ignore */ }
}

async function fetchChangeOrderTemplate() {
  loadingTemplate.value = true
  try {
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/contracts/templates')
    const templates = res.data || []
    // Find the Change Order Agreement template
    changeOrderTemplate.value = templates.find((t: any) =>
      t.name.toLowerCase().includes('change order'),
    ) || null
    if (!changeOrderTemplate.value) {
      toast.warning('Change Order template not found', {
        description: 'Please create the "Ann Arbor Hardwoods Change Order Agreement" template first in Contracts → Templates.',
      })
    }
  }
  catch (e: any) {
    toast.error('Failed to load template')
  }
  finally {
    loadingTemplate.value = false
  }
}

function selectCustomer(c: any) {
  selectedCustomer.value = c
  selectedProject.value = null
  projectSearch.value = ''
  createStep.value = 2
  fetchProjects(c._id)
}

function selectProject(p: any) {
  selectedProject.value = p
  createStep.value = 3
  setupVariables()
}

function setupVariables() {
  if (!changeOrderTemplate.value) return
  variableValues.value = {}
  for (const v of changeOrderTemplate.value.variables) {
    variableValues.value[v.key] = v.defaultValue || ''
  }
  // Auto-fill company name
  if (variableValues.value.company_name !== undefined && companyProfile.value.name) {
    variableValues.value.company_name = companyProfile.value.name
  }
  // Auto-fill company signature
  if (companyProfile.value?.signature) {
    const sigKey = Object.keys(variableValues.value).find(k => k.includes('signature') && k.includes('company'))
    if (sigKey) variableValues.value[sigKey] = companyProfile.value.signature
  }
  // Auto-fill client name
  const clientKey = Object.keys(variableValues.value).find(k =>
    ['clientname', 'client_name', 'customername', 'customer_name'].includes(k.toLowerCase()),
  )
  if (clientKey && selectedCustomer.value) {
    variableValues.value[clientKey] = selectedCustomer.value.name || `${selectedCustomer.value.firstName || ''} ${selectedCustomer.value.lastName || ''}`.trim() || ''
  }
  contractTitle.value = `Change Order — ${selectedCustomer.value?.name || 'Customer'}`
}

function goToStep(n: number) {
  if (n >= createStep.value) return
  createStep.value = n
  if (n === 1 && !customers.value.length) fetchCustomers()
  if (n === 2 && selectedCustomer.value?._id && !projects.value.length) fetchProjects(selectedCustomer.value._id)
}

function openCreateDialog() {
  showDialog.value = true
  editingId.value = null
  createStep.value = 1
  selectedCustomer.value = null
  selectedProject.value = null
  variableValues.value = {}
  contractTitle.value = ''
  customerSearch.value = ''
  projectSearch.value = ''
  fetchCustomers()
  fetchChangeOrderTemplate()
  if (!companyProfile.value.name) fetchCompanyProfile()
}

async function openEditDialog(co: ChangeOrderRecord) {
  try {
    toast.loading('Loading change order...', { id: 'fetch-co' })
    const res = await $fetch<{ success: boolean, data: any }>(`/api/change-orders/${co._id}`)
    const full = res.data

    editingId.value = full._id
    contractTitle.value = full.title
    selectedCustomer.value = { _id: full.customerId, name: full.customerName, email: full.customerEmail, phone: full.customerPhone }
    variableValues.value = { ...full.variableValues }

    await fetchChangeOrderTemplate()
    fetchCustomers()
    if (full.customerId) {
      fetchProjects(full.customerId).then(() => {
        if (full.projectId) {
          selectedProject.value = projects.value.find(p => p._id === full.projectId) || null
        }
      })
    }

    createStep.value = 3
    showDialog.value = true
  }
  catch (err: any) {
    toast.error('Failed to load', { description: err?.message })
  }
  finally {
    toast.dismiss('fetch-co')
  }
}

async function saveChangeOrder() {
  if (!selectedCustomer.value || !changeOrderTemplate.value) {
    toast.error('Please select a customer and ensure the template exists')
    return
  }
  if (!contractTitle.value.trim()) {
    toast.error('Title is required')
    return
  }

  saving.value = true
  try {
    const c = selectedCustomer.value
    const userCookie = useCookie<{ _id: string, employee: string } | null>('hardwood_user')
    const payload = {
      title: contractTitle.value,
      customerId: c._id,
      projectId: selectedProject.value?._id || c._id,
      customerName: c.name,
      customerEmail: c.email || '',
      customerPhone: c.phone || '',
      customerAddress: c.address ? [c.address, c.city, c.state, c.zip].filter(Boolean).join(', ') : '',
      projectName: selectedProject.value?.projectName || selectedProject.value?.name || '',
      templateId: changeOrderTemplate.value._id,
      templateName: changeOrderTemplate.value.name,
      variableValues: variableValues.value,
      content: changeOrderTemplate.value.content,
      notes: '',
      createdBy: userCookie.value?.employee || '',
    }

    if (editingId.value) {
      await $fetch(`/api/change-orders/${editingId.value}`, { method: 'PUT', body: payload })
      toast.success('Change order updated')
    }
    else {
      await $fetch('/api/change-orders', { method: 'POST', body: payload })
      toast.success('Change order created')
    }

    showDialog.value = false
    fetchChangeOrders()
  }
  catch (e: any) {
    toast.error(editingId.value ? 'Failed to update' : 'Failed to create', {
      description: e?.data?.message || e?.message || 'Unknown error',
    })
  }
  finally {
    saving.value = false
  }
}

const TYPE_ICONS: Record<string, string> = {
  'lead': 'i-lucide-user',
  'prospect': 'i-lucide-user-plus',
  'active-customer': 'i-lucide-user-check',
  'past-customer': 'i-lucide-user-minus',
  'default': 'i-lucide-user',
}

// Variables to display (filter out system variables)
const SYSTEM_KEYS = new Set([
  'contract_number', 'company_name', 'companyName', 'company_address', 'company_city',
  'company_state', 'company_zip', 'company_phone', 'company_phone1', 'company_phone2',
  'company_website', 'company_email', 'company_license', 'company_logo', 'company_signature',
  'companySignature', 'contractor_signature', 'printDate',
])

const editableVariables = computed(() => {
  if (!changeOrderTemplate.value) return []
  return (changeOrderTemplate.value.variables as TemplateVariable[]).filter(
    v => !SYSTEM_KEYS.has(v.key),
  )
})

// Load data on mount
if (import.meta.client) {
  fetchChangeOrders()
  fetchCompanyProfile()
}
</script>

<template>
  <div class="space-y-0 -mt-4 lg:-mt-6">
    <!-- Header Teleport -->
    <ClientOnly>
      <Teleport defer to="#header-toolbar">
        <div class="flex items-center gap-2 sm:gap-3 w-full max-w-xl pr-2">
          <div class="relative flex-1">
            <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search change orders..."
              class="w-full h-8 sm:h-9 pl-8 sm:pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              @input="fetchChangeOrders()"
            >
          </div>
          <button
            v-if="canCreate()"
            class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shrink-0 shadow-lg shadow-primary/20"
            @click="openCreateDialog"
          >
            <Icon name="i-lucide-plus" class="size-3.5" />
            <span class="hidden sm:inline">New Change Order</span>
          </button>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- Content -->
    <div class="flex flex-col h-[calc(100dvh-90px)]">
      <div class="flex-1 overflow-y-auto pt-4">
        <!-- Loading -->
        <div v-if="loading" class="space-y-4 px-1">
          <div v-for="i in 4" :key="i" class="h-16 bg-muted/40 rounded-xl animate-pulse" />
        </div>

        <!-- Empty State -->
        <div v-else-if="!changeOrders.length" class="flex flex-col items-center justify-center py-16 text-center border bg-card rounded-xl border-dashed mx-1">
          <div class="size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-5">
            <Icon name="i-lucide-file-diff" class="size-7 text-primary" />
          </div>
          <h3 class="font-bold text-lg mb-1">
            No change orders yet
          </h3>
          <p class="text-sm text-muted-foreground mb-5 max-w-sm">
            Create your first change order for a project modification.
          </p>
          <button
            v-if="canCreate()"
            class="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            @click="openCreateDialog"
          >
            <Icon name="i-lucide-plus" class="size-4" />
            New Change Order
          </button>
        </div>

        <!-- Table -->
        <div v-else class="rounded-xl border border-border/50 bg-card overflow-hidden mx-1">
          <!-- Desktop Table -->
          <div class="hidden lg:block overflow-x-auto">
            <table class="w-full text-left min-w-max">
              <thead>
                <tr class="border-b bg-muted/30">
                  <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    CO #
                  </th>
                  <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Customer
                  </th>
                  <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Project
                  </th>
                  <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Title
                  </th>
                  <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Created By
                  </th>
                  <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Created
                  </th>
                  <th class="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-32 text-right" />
                </tr>
              </thead>
              <tbody class="divide-y divide-border/30">
                <tr
                  v-for="co in changeOrders"
                  :key="co._id"
                  class="group hover:bg-muted/10 transition-colors"
                >
                  <td class="px-4 py-3">
                    <span class="text-xs font-mono font-bold text-primary">{{ co.changeOrderNumber }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <div class="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon name="i-lucide-user" class="size-3.5 text-primary" />
                      </div>
                      <span class="text-xs font-semibold">{{ co.customerName || '—' }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-xs font-medium text-foreground/80">{{ co.projectName || '—' }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-sm font-semibold">{{ co.title }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-xs text-muted-foreground">{{ co.createdBy || '—' }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-xs text-muted-foreground tabular-nums">{{ formatDate(co.createdAt) }}</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-1">
                      <button class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Download PDF" @click.stop="downloadPDF(co)">
                        <Icon name="i-lucide-download" class="size-3.5" />
                      </button>
                      <button class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Edit" @click.stop="openEditDialog(co)">
                        <Icon name="i-lucide-pencil" class="size-3.5" />
                      </button>
                      <button v-if="canDelete()" class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete" @click.stop="deleteChangeOrder(co._id)">
                        <Icon name="i-lucide-trash-2" class="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Card View -->
          <div class="block lg:hidden p-3 space-y-3 bg-muted/20">
            <div v-for="co in changeOrders" :key="co._id" class="border border-border/60 rounded-xl p-3.5 bg-card shadow-sm flex flex-col gap-3">
              <div class="flex items-start justify-between gap-3">
                <div class="flex flex-col min-w-0 flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-[11px] font-mono font-bold text-primary">{{ co.changeOrderNumber }}</span>
                  </div>
                  <span class="text-sm font-bold text-foreground leading-tight truncate">{{ co.title }}</span>
                </div>
                <div class="text-right flex flex-col items-end shrink-0 pt-0.5">
                  <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Created</span>
                  <span class="text-xs font-medium">{{ formatDate(co.createdAt) }}</span>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 bg-muted/30 p-2.5 rounded-lg border border-border/40">
                <div class="flex flex-col min-w-0">
                  <span class="text-[10px] text-muted-foreground uppercase font-bold mb-0.5 flex items-center gap-1"><Icon name="i-lucide-user" class="size-3 pl-0.5 text-primary" /> Customer</span>
                  <span class="text-xs font-bold truncate">{{ co.customerName || '—' }}</span>
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">Project</span>
                  <span class="text-xs font-medium truncate pt-px">{{ co.projectName || '—' }}</span>
                </div>
              </div>

              <div class="pt-2 flex justify-between gap-2 mt-0.5">
                <div class="flex gap-2 flex-1">
                  <button class="flex-1 h-8 rounded-lg border bg-background font-medium focus:ring-1 hover:bg-muted text-foreground text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs" @click.stop="downloadPDF(co)">
                    <Icon name="i-lucide-file-text" class="size-3.5 text-muted-foreground" /> PDF
                  </button>
                </div>
                <div class="flex gap-1.5 shrink-0">
                  <button class="size-8 rounded-lg border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shadow-xs" @click.stop="openEditDialog(co)">
                    <Icon name="i-lucide-pencil" class="size-3.5" />
                  </button>
                  <button v-if="canDelete()" class="size-8 rounded-lg border border-red-500/20 bg-red-500/5 flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors shadow-xs" @click.stop="deleteChangeOrder(co._id)">
                    <Icon name="i-lucide-trash-2" class="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ CREATE/EDIT DIALOG ═══════ -->
    <Dialog v-model:open="showDialog">
      <DialogContent class="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <!-- Header -->
        <div class="px-6 pt-6 pb-4 border-b border-border/50">
          <div class="flex items-center gap-3 mb-4">
            <div class="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <Icon name="i-lucide-file-diff" class="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle class="text-base font-bold">
                {{ editingId ? 'Edit Change Order' : 'Create Change Order' }}
              </DialogTitle>
              <DialogDescription class="text-xs text-muted-foreground mt-0.5">
                {{ createStep === 1 ? 'Select a customer' : createStep === 2 ? 'Select a project' : 'Fill in the change order details' }}
              </DialogDescription>
            </div>
          </div>

          <!-- Step Indicator -->
          <div class="flex items-center gap-2">
            <button
              v-for="step in [
                { n: 1, label: 'Customer', icon: 'i-lucide-user' },
                { n: 2, label: 'Project', icon: 'i-lucide-folder-kanban' },
                { n: 3, label: 'Details', icon: 'i-lucide-file-edit' },
              ]"
              :key="step.n"
              class="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              :class="createStep === step.n
                ? 'bg-primary/10 text-primary border border-primary/30'
                : createStep > step.n
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                  : 'bg-muted/40 text-muted-foreground border border-transparent'"
              @click="goToStep(step.n)"
            >
              <div
                class="size-6 rounded-md flex items-center justify-center shrink-0"
                :class="createStep > step.n ? 'bg-emerald-500/20' : createStep === step.n ? 'bg-primary/20' : 'bg-muted'"
              >
                <Icon v-if="createStep > step.n" name="i-lucide-check" class="size-3.5" />
                <Icon v-else :name="step.icon" class="size-3.5" />
              </div>
              <span class="hidden sm:inline">{{ step.label }}</span>
              <span class="sm:hidden">{{ step.n }}</span>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto">
          <!-- Step 1: Customer Selection -->
          <div v-if="createStep === 1" class="p-6">
            <div class="relative mb-4">
              <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                v-model="customerSearch"
                type="text"
                placeholder="Search customers by name, email, or phone..."
                class="w-full h-10 pl-10 pr-4 rounded-lg border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all"
              >
            </div>

            <div v-if="loadingCustomers" class="space-y-2">
              <div v-for="i in 5" :key="i" class="h-16 bg-muted/40 rounded-lg animate-pulse" />
            </div>

            <div v-else-if="filteredCustomers.length === 0" class="text-center py-12">
              <Icon name="i-lucide-users" class="size-10 text-muted-foreground/20 mx-auto mb-3" />
              <p class="text-sm font-semibold text-muted-foreground">
                No customers found
              </p>
            </div>

            <div v-else class="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
              <button
                v-for="c in filteredCustomers"
                :key="c._id"
                class="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group"
                :class="selectedCustomer?._id === c._id
                  ? 'border-primary/40 bg-primary/5 shadow-md shadow-primary/10'
                  : 'border-border/40 bg-card hover:border-primary/20 hover:bg-muted/30'"
                @click="selectCustomer(c)"
              >
                <div
                  class="size-10 rounded-lg flex items-center justify-center shrink-0"
                  :class="selectedCustomer?._id === c._id ? 'bg-primary/20' : 'bg-muted'"
                >
                  <Icon :name="TYPE_ICONS[c.type] || 'i-lucide-user'" class="size-4" :class="selectedCustomer?._id === c._id ? 'text-primary' : 'text-muted-foreground'" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold truncate" :class="selectedCustomer?._id === c._id ? 'text-primary' : ''">
                    {{ c.name || `${c.firstName} ${c.lastName}`.trim() || 'Unknown' }}
                  </p>
                  <div class="flex items-center gap-3 mt-0.5">
                    <span v-if="c.email" class="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                      <Icon name="i-lucide-mail" class="size-2.5 shrink-0" />
                      {{ c.email }}
                    </span>
                    <span v-if="c.phone" class="text-[10px] text-muted-foreground tabular-nums flex items-center gap-1">
                      <Icon name="i-lucide-phone" class="size-2.5 shrink-0" />
                      {{ c.phone }}
                    </span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold capitalize shrink-0" :class="selectedCustomer?._id === c._id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'">
                  {{ c.type?.replace(/-/g, ' ') || 'lead' }}
                </span>
                <Icon name="i-lucide-chevron-right" class="size-4 text-muted-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
              </button>
            </div>
          </div>

          <!-- Step 2: Project Selection -->
          <div v-else-if="createStep === 2" class="p-6">
            <!-- Selected Customer Summary -->
            <div v-if="selectedCustomer" class="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 mb-5">
              <div class="size-8 rounded-md bg-emerald-500/15 flex items-center justify-center">
                <Icon name="i-lucide-check" class="size-4 text-emerald-500" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Customer Selected
                </p>
                <p class="text-xs text-foreground font-semibold">
                  {{ selectedCustomer.name }}
                </p>
              </div>
              <button class="text-[10px] text-emerald-600 font-semibold hover:underline" @click="createStep = 1">
                Change
              </button>
            </div>

            <div class="relative mb-4">
              <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                v-model="projectSearch"
                type="text"
                placeholder="Search projects by name..."
                class="w-full h-10 pl-10 pr-4 rounded-lg border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all"
              >
            </div>

            <div v-if="loadingProjects" class="space-y-2">
              <div v-for="i in 3" :key="i" class="h-16 bg-muted/40 rounded-lg animate-pulse" />
            </div>

            <div v-else-if="filteredProjects.length === 0" class="text-center py-12">
              <Icon name="i-lucide-folder-kanban" class="size-10 text-muted-foreground/20 mx-auto mb-3" />
              <p class="text-sm font-semibold text-muted-foreground">
                No projects found for this customer
              </p>
              <p class="text-xs text-muted-foreground/70 mt-1">
                Create a project in the Pipeline first
              </p>
            </div>

            <div v-else class="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
              <button
                v-for="p in filteredProjects"
                :key="p._id"
                class="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group"
                :class="selectedProject?._id === p._id
                  ? 'border-primary/40 bg-primary/5 shadow-md shadow-primary/10'
                  : 'border-border/40 bg-card hover:border-primary/20 hover:bg-muted/30'"
                @click="selectProject(p)"
              >
                <div
                  class="size-10 rounded-lg flex items-center justify-center shrink-0"
                  :class="selectedProject?._id === p._id ? 'bg-primary/20' : 'bg-muted'"
                >
                  <Icon name="i-lucide-folder-kanban" class="size-4" :class="selectedProject?._id === p._id ? 'text-primary' : 'text-muted-foreground'" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold truncate" :class="selectedProject?._id === p._id ? 'text-primary' : ''">
                    {{ p.projectName || p.name || 'Untitled Project' }}
                  </p>
                  <div class="flex items-center gap-3 mt-0.5">
                    <span v-if="p.projectName && p.name" class="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                      <Icon name="i-lucide-user" class="size-2.5 shrink-0" />
                      {{ p.name }}
                    </span>
                    <span v-if="p.email" class="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                      <Icon name="i-lucide-mail" class="size-2.5 shrink-0" />
                      {{ p.email }}
                    </span>
                  </div>
                </div>
                <Icon name="i-lucide-chevron-right" class="size-4 text-muted-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
              </button>
            </div>
          </div>

          <!-- Step 3: Fill Variables -->
          <div v-else-if="createStep === 3" class="p-6">
            <!-- Summaries -->
            <div class="flex gap-3 mb-5">
              <div v-if="selectedCustomer" class="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div class="size-6 rounded-md bg-emerald-500/15 flex items-center justify-center">
                  <Icon name="i-lucide-check" class="size-3 text-emerald-500" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Customer</p>
                  <p class="text-xs font-semibold truncate">{{ selectedCustomer.name }}</p>
                </div>
                <button class="text-[10px] text-emerald-600 font-semibold hover:underline" @click="createStep = 1">Change</button>
              </div>
              <div v-if="selectedProject" class="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div class="size-6 rounded-md bg-emerald-500/15 flex items-center justify-center">
                  <Icon name="i-lucide-check" class="size-3 text-emerald-500" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Project</p>
                  <p class="text-xs font-semibold truncate">{{ selectedProject.projectName || selectedProject.name }}</p>
                </div>
                <button class="text-[10px] text-emerald-600 font-semibold hover:underline" @click="createStep = 2">Change</button>
              </div>
            </div>

            <!-- Template Warning -->
            <div v-if="!changeOrderTemplate && !loadingTemplate" class="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-5">
              <div class="flex items-center gap-2">
                <Icon name="i-lucide-alert-triangle" class="size-4 text-amber-500 shrink-0" />
                <p class="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  Change Order template not found
                </p>
              </div>
              <p class="text-xs text-muted-foreground mt-1">
                Go to Contracts → Templates and create the "Ann Arbor Hardwoods Change Order Agreement" template first.
              </p>
            </div>

            <div v-if="loadingTemplate" class="space-y-3">
              <div v-for="i in 4" :key="i" class="h-12 bg-muted/40 rounded-lg animate-pulse" />
            </div>

            <div v-else-if="changeOrderTemplate" class="space-y-5">
              <!-- Title -->
              <div>
                <label class="block text-xs font-bold mb-1.5 text-muted-foreground">Change Order Title</label>
                <input
                  v-model="contractTitle"
                  type="text"
                  class="w-full h-10 px-3 rounded-lg border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Change Order — Customer Name"
                >
              </div>

              <!-- Template Variables -->
              <div v-if="editableVariables.length > 0">
                <h3 class="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Icon name="i-lucide-settings-2" class="size-3.5" />
                  Change Order Fields
                </h3>
                <div class="space-y-3">
                  <div v-for="v in editableVariables" :key="v.key">
                    <label class="block text-xs font-semibold mb-1">
                      {{ v.label || v.key }}
                      <span v-if="v.required" class="text-red-500">*</span>
                    </label>
                    <select
                      v-if="v.type === 'select' && v.options?.length"
                      v-model="variableValues[v.key]"
                      class="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      <option value="">
                        Select...
                      </option>
                      <option v-for="opt in v.options" :key="opt" :value="opt">
                        {{ opt }}
                      </option>
                    </select>
                    <textarea
                      v-else-if="v.type === 'textarea'"
                      v-model="variableValues[v.key]"
                      rows="3"
                      class="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-y"
                      :placeholder="v.label || v.key"
                    />
                    <input
                      v-else-if="v.type === 'date'"
                      v-model="variableValues[v.key]"
                      type="date"
                      class="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                    <input
                      v-else-if="v.type === 'number' || v.type === 'currency'"
                      v-model="variableValues[v.key]"
                      type="number"
                      step="any"
                      class="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      :placeholder="v.label || v.key"
                    >
                    <input
                      v-else
                      v-model="variableValues[v.key]"
                      type="text"
                      class="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      :placeholder="v.label || v.key"
                    >
                  </div>
                </div>
              </div>

              <!-- Save Button -->
              <div class="pt-4 border-t border-border/50 flex justify-end gap-3">
                <Button variant="outline" @click="showDialog = false">
                  Cancel
                </Button>
                <Button :disabled="saving || !contractTitle.trim()" class="min-w-[140px]" @click="saveChangeOrder">
                  <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-2 size-4 animate-spin" />
                  <Icon v-else name="i-lucide-save" class="mr-2 size-4" />
                  {{ saving ? 'Saving...' : editingId ? 'Update' : 'Create & Save' }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
