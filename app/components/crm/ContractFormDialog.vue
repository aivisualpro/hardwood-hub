
<script setup lang="ts">
import { toast } from 'vue-sonner'
import { ref, computed, watch } from 'vue'
import { upload } from '@vercel/blob/client'

const emit = defineEmits(['saved', 'update:modelValue'])

const props = defineProps<{
  modelValue?: boolean
}>()

const TYPE_ICONS: Record<string, string> = {
  'lead': 'i-lucide-user',
  'prospect': 'i-lucide-user-plus',
  'active-customer': 'i-lucide-user-check',
  'past-customer': 'i-lucide-user-minus',
  default: 'i-lucide-user',
}

const showCreateModal = computed({
  get: () => props.modelValue || internalOpen.value,
  set: (v) => {
    internalOpen.value = v
    emit('update:modelValue', v)
  }
})

const internalOpen = ref(false)

const templates = ref<any[]>([])
const loadingTemplates = ref(false)
async function fetchTemplates() {
  loadingTemplates.value = true
  try {
    const res = await $fetch<any>('/api/contracts/templates')
    templates.value = res.data || []
  } finally {
    loadingTemplates.value = false
  }
}

const companyProfile = ref<any>({})
async function fetchCompanyProfile() {
  try {
    const res = await $fetch<any>('/api/app-settings')
    if (res.success && res.data?.companyProfile) companyProfile.value = res.data.companyProfile
  } catch {}
}

watch(showCreateModal, (val) => {
  if (val) {
    fetchTemplates()
    if (!companyProfile.value.name) fetchCompanyProfile()
  }
})

// ─── Create/Edit Contract Modal ───────────────────────────────

const editingContractId = ref<string | null>(null)
const createStep = ref(1) // 1=customer, 2=template, 3=variables+confirm
const savingContract = ref(false)

// Step 1: Customer selection
const customers = ref<any[]>([])
const loadingCustomers = ref(false)
const customerSearch = ref('')
const selectedCustomer = ref<any | null>(null)

async function fetchCustomers() {
  loadingCustomers.value = true
  try {
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/customers', {
      params: { limit: 100, search: customerSearch.value || undefined },
    })
    customers.value = res.data || []
  } catch (e: any) {
    toast.error('Failed to load customers')
  } finally {
    loadingCustomers.value = false
  }
}

const filteredCustomers = computed(() => {
  if (!customerSearch.value) return customers.value
  const q = customerSearch.value.toLowerCase()
  return customers.value.filter(c =>
    c.name?.toLowerCase().includes(q)
    || c.email?.toLowerCase().includes(q)
    || c.phone?.includes(q),
  )
})

// Step 2: Template selection
const selectedModalTemplate = ref<any | null>(null)
const templateDropdownOpen = ref(false)
const templateSearch = ref('')
const filteredTemplates = computed(() => {
  if (!templateSearch.value) return templates.value
  const q = templateSearch.value.toLowerCase()
  return templates.value.filter(t => t.name.toLowerCase().includes(q))
})

function chooseTemplate(t: any) {
  selectedModalTemplate.value = t
  templateSearch.value = ''
  templateDropdownOpen.value = false
}

function handleTemplateBlur() {
  // Give dropdown items time to register click before closing
  setTimeout(() => { templateDropdownOpen.value = false }, 200)
}

// Step 3: Variable values
const variableValues = ref<Record<string, string>>({})
const contractTitle = ref('')
const customerSignature = ref('')
const customerSignatureDate = ref('')
const attachedPdf = ref('')
const attachedPdfName = ref('')
const isUploadingPdf = ref(false)
const pdfFileInput = ref<HTMLInputElement | null>(null)
const attachedGalleryImages = ref<string[]>([])

async function loadCustomerGallery(id: string) {
  try {
    const res = await $fetch<any>(`/api/customers/${id}`)
    if (res.success && res.data?.gallery) {
      if (selectedCustomer.value) {
        selectedCustomer.value.gallery = res.data.gallery
      }
    }
  } catch (e) {}
}

function toggleGalleryImage(url: string) {
  const index = attachedGalleryImages.value.indexOf(url)
  if (index === -1) {
    attachedGalleryImages.value.push(url)
  } else {
    attachedGalleryImages.value.splice(index, 1)
  }
}

async function handlePdfUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (file.type !== 'application/pdf') {
    toast.error('Only PDF files are allowed')
    target.value = ''
    return
  }

  const sizeMB = (file.size / 1024 / 1024).toFixed(1)

  // Vercel Blob handles up to 500MB on client uploads, so we're good
  if (file.size > 200 * 1024 * 1024) {
    toast.error('PDF too large', {
      description: `File is ${sizeMB}MB. Max upload size is 200MB.`,
    })
    target.value = ''
    return
  }

  attachedPdfName.value = `${file.name} (${sizeMB}MB)`
  attachedPdf.value = ''
  isUploadingPdf.value = true

  try {
    toast.loading(`Uploading ${sizeMB}MB PDF to Vercel Blob…`, { id: 'pdf-upload' })

    const newBlob = await upload(`hardwood-hub/contracts/raw/${file.name}`, file, {
      access: 'private',
      handleUploadUrl: '/api/upload/blob-token',
    })

    if (!newBlob?.url) throw new Error('Vercel Blob did not return a URL')

    attachedPdf.value = newBlob.url
    toast.success(
      `PDF uploaded successfully (${sizeMB}MB)`,
      { id: 'pdf-upload' },
    )
  } catch (err: any) {
    toast.error('PDF upload failed', {
      description: err?.data?.message || err?.message || 'Upload error',
      id: 'pdf-upload',
    })
    attachedPdf.value = ''
    attachedPdfName.value = ''
  } finally {
    isUploadingPdf.value = false
    target.value = ''
  }
}

function selectCustomer(c: any) {
  selectedCustomer.value = c
  createStep.value = 2
  if (!c.gallery) loadCustomerGallery(c._id)
}

function selectModalTemplate(t: any) {
  selectedModalTemplate.value = t
  // Pre-fill variable defaults
  variableValues.value = {}
  for (const v of t.variables) {
    variableValues.value[v.key] = v.defaultValue || ''
  }
  // Auto-set company name if variable exists
  if (variableValues.value.company_name !== undefined && companyProfile.value.name) {
    variableValues.value.company_name = companyProfile.value.name
  }
  // Auto-set company signature
  if (companyProfile.value?.signature) {
    const sigKey = Object.keys(variableValues.value).find(k => k.includes('signature') && k.includes('company'))
    if (sigKey) {
      variableValues.value[sigKey] = companyProfile.value.signature
    }
  }
  // Auto-set client name
  const clientKey = Object.keys(variableValues.value).find(k => 
    ['clientname', 'client_name', 'customername', 'customer_name'].includes(k.toLowerCase())
  )
  if (clientKey && selectedCustomer.value) {
    variableValues.value[clientKey] = selectedCustomer.value.name || `${selectedCustomer.value.firstName || ''} ${selectedCustomer.value.lastName || ''}`.trim() || ''
  }
  contractTitle.value = `${t.name} — ${selectedCustomer.value?.name || 'Customer'}`
  createStep.value = 3
}

function openCreateModal() {
  showCreateModal.value = true
  editingContractId.value = null
  createStep.value = 1
  selectedCustomer.value = null
  selectedModalTemplate.value = null
  variableValues.value = {}
  contractTitle.value = ''
  customerSearch.value = ''
  customerSignature.value = ''
  customerSignatureDate.value = ''
  attachedPdf.value = ''
  attachedPdfName.value = ''
  attachedGalleryImages.value = []
  fetchCustomers()
}

async function openEditContract(ct: any) {
  try {
    toast.loading('Fetching contract details...', { id: 'fetch-contract' })
    const res = await $fetch<{ success: boolean, data: any }>(`/api/contracts/detail/${ct._id}`)
    const fullCt = res.data

    editingContractId.value = fullCt._id
    contractTitle.value = fullCt.title
    selectedCustomer.value = { _id: fullCt.customerId, name: fullCt.customerName, email: fullCt.customerEmail, phone: fullCt.customerPhone } as any
    variableValues.value = { ...fullCt.variableValues }
    customerSignature.value = fullCt.customerSignature || ''
    customerSignatureDate.value = fullCt.customerSignatureDate ? new Date(fullCt.customerSignatureDate).toISOString().split('T')[0]! : ''
    attachedPdf.value = fullCt.attachedPdf || ''
    attachedPdfName.value = fullCt.attachedPdf ? 'Attached PDF' : ''
    attachedGalleryImages.value = fullCt.attachedGalleryImages || []
    loadCustomerGallery(fullCt.customerId)
    
    const foundTemplate = templates.value.find(t => t._id === fullCt.templateId)
    selectedModalTemplate.value = foundTemplate || { 
      _id: fullCt.templateId, 
      name: fullCt.templateName, 
      content: fullCt.content, 
      variables: Object.keys(fullCt.variableValues || {}).map(k => ({ key: k, label: k, type: 'text' }))
    } as any
    
    createStep.value = 3
    showCreateModal.value = true
  } catch (err: any) {
    toast.error('Failed to load contract details', { description: err?.message })
  } finally {
    toast.dismiss('fetch-contract')
  }
}

async function saveContract() {
  if (!selectedCustomer.value || !selectedModalTemplate.value) {
    toast.error('Please select a customer and template')
    return
  }
  if (!contractTitle.value.trim()) {
    toast.error('Contract title is required')
    return
  }
  if (!variableValues.value.contract_number?.trim()) {
    toast.error('Contract Number is required')
    return
  }

  savingContract.value = true
  try {
    // PDF upload + compression already happened in handlePdfUpload — at this
    // point attachedPdf.value is either '' or a final Cloudinary URL.
    const finalAttachedPdf = attachedPdf.value

    const c = selectedCustomer.value
    const payload = {
      title: contractTitle.value,
      customerId: c._id,
      customerName: c.name,
      customerEmail: c.email,
      customerPhone: c.phone,
      customerAddress: c.address ? [c.address, c.city, c.state, c.zip].filter(Boolean).join(', ') : '',
      templateId: selectedModalTemplate.value._id,
      templateName: selectedModalTemplate.value.name,
      variableValues: variableValues.value,
      customerSignature: customerSignature.value,
      customerSignatureDate: customerSignatureDate.value ? new Date(customerSignatureDate.value).toISOString() : null,
      content: selectedModalTemplate.value.content,
      attachedPdf: finalAttachedPdf,
      attachedGalleryImages: attachedGalleryImages.value,
      status: 'draft',
    }

    if (editingContractId.value) {
      await $fetch(`/api/contracts/detail/${editingContractId.value}`, { method: 'PUT', body: payload })
      toast.success('Contract updated successfully')
    } else {
      await $fetch('/api/contracts', { method: 'POST', body: payload })
      toast.success('Contract created successfully')
    }
    
    showCreateModal.value = false
    emit('saved')
  } catch (e: any) {
    toast.error(editingContractId.value ? 'Failed to update contract' : 'Failed to create contract', { description: e?.message })
  } finally {
    savingContract.value = false
  }
}



function openForCustomer(customer: any) {
  internalOpen.value = true
  editingContractId.value = null
  createStep.value = 2
  selectedCustomer.value = customer
  selectedModalTemplate.value = null
  variableValues.value = {}
  contractTitle.value = ''
  customerSignature.value = ''
  customerSignatureDate.value = ''
  attachedPdf.value = ''
  attachedPdfName.value = ''
  attachedGalleryImages.value = []
  fetchTemplates()
  if (!companyProfile.value.name) fetchCompanyProfile()
  if (!customer.gallery) loadCustomerGallery(customer._id)
}

defineExpose({ openCreateModal, openEditContract, openForCustomer })

const seeding = ref(false)
async function seedChangeOrder() {}
</script>

<template>
  <!-- ═══════ CREATE CONTRACT MODAL ═══════ -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <Dialog v-model:open="showCreateModal">
      <DialogContent class="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <!-- Modal Header -->
        <div class="px-6 pt-6 pb-4 border-b border-border/50">
          <div class="flex items-center gap-3 mb-4">
            <div class="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <Icon name="i-lucide-file-signature" class="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle class="text-base font-bold">{{ editingContractId ? 'Edit Contract' : 'Create New Contract' }}</DialogTitle>
              <DialogDescription class="text-xs text-muted-foreground mt-0.5">
                {{ createStep === 1 ? 'Select a customer from your CRM' : createStep === 2 ? 'Choose a contract template' : 'Fill in the contract details' }}
              </DialogDescription>
            </div>
          </div>

          <!-- Step Indicator -->
          <div class="flex items-center gap-2">
            <button
              v-for="step in [
                { n: 1, label: 'Customer', icon: 'i-lucide-user' },
                { n: 2, label: 'Template', icon: 'i-lucide-layout-template' },
                { n: 3, label: 'Details', icon: 'i-lucide-file-edit' },
              ]"
              :key="step.n"
              class="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              :class="createStep === step.n
                ? 'bg-primary/10 text-primary border border-primary/30'
                : createStep > step.n
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                  : 'bg-muted/40 text-muted-foreground border border-transparent'"
              @click="step.n < createStep && (createStep = step.n)"
            >
              <div class="size-6 rounded-md flex items-center justify-center shrink-0"
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

        <!-- Modal Body -->
        <div class="flex-1 overflow-y-auto">
          <!-- ─── Step 1: Customer Selection ─── -->
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
              <p class="text-sm font-semibold text-muted-foreground">No customers found</p>
              <p class="text-xs text-muted-foreground/70 mt-1">Try a different search term</p>
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
                <div class="size-10 rounded-lg flex items-center justify-center shrink-0"
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
                <div class="shrink-0">
                  <span class="px-2 py-0.5 rounded-full text-[9px] font-bold capitalize" :class="selectedCustomer?._id === c._id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'">
                    {{ c.type?.replace(/-/g, ' ') || 'lead' }}
                  </span>
                </div>
                <Icon name="i-lucide-chevron-right" class="size-4 text-muted-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
              </button>
            </div>
          </div>

          <!-- ─── Step 2: Template Selection ─── -->
          <div v-else-if="createStep === 2" class="p-6">
            <!-- Selected Customer Summary -->
            <div v-if="selectedCustomer" class="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 mb-5">
              <div class="size-8 rounded-md bg-emerald-500/15 flex items-center justify-center">
                <Icon name="i-lucide-check" class="size-4 text-emerald-500" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400">Customer Selected</p>
                <p class="text-xs text-foreground font-semibold">{{ selectedCustomer.name }}</p>
              </div>
              <button class="text-[10px] text-emerald-600 font-semibold hover:underline" @click="createStep = 1">Change</button>
            </div>

            <div v-if="loadingTemplates" class="space-y-2">
              <div v-for="i in 3" :key="i" class="h-24 bg-muted/40 rounded-xl animate-pulse" />
            </div>

            <div v-else-if="templates.length === 0" class="text-center py-12">
              <Icon name="i-lucide-layout-template" class="size-10 text-muted-foreground/20 mx-auto mb-3" />
              <p class="text-sm font-semibold text-muted-foreground">No templates available</p>
              <p class="text-xs text-muted-foreground/70 mt-1 mb-4">Create a template first in the Templates tab</p>
              <Button variant="outline" size="sm" :disabled="seeding" @click="seedChangeOrder">
                <Icon v-if="seeding" name="i-lucide-loader-circle" class="mr-1.5 size-3.5 animate-spin" />
                <Icon v-else name="i-lucide-download" class="mr-1.5 size-3.5" />
                Seed Change Order Template
              </Button>
            </div>

            <div v-else class="max-w-md mx-auto py-8 pb-64 space-y-6">
              <div class="space-y-2">
                <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider block ml-1">Contract Template</Label>
                <div class="relative">
                  <div
                    class="w-full h-12 pl-4 pr-3 flex items-center rounded-xl border border-border/60 bg-card hover:bg-muted/10 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 shadow-sm cursor-text transition-all"
                    @click="templateDropdownOpen = true"
                  >
                    <Icon name="i-lucide-search" class="size-4 text-primary/60 mr-3 shrink-0" />
                    <input
                      v-model="templateSearch"
                      :placeholder="selectedModalTemplate ? selectedModalTemplate.name : 'Search templates...'"
                      class="flex-1 bg-transparent border-none focus:outline-none text-sm font-bold placeholder:text-foreground/90 w-full"
                      @focus="templateDropdownOpen = true"
                      @blur="handleTemplateBlur"
                    />
                    <div v-if="selectedModalTemplate" @click.stop="selectedModalTemplate = null" class="cursor-pointer hover:bg-muted/50 p-1 px-1.5 rounded-md mr-1 transition-colors">
                      <Icon name="i-lucide-x" class="size-3.5 text-muted-foreground hover:text-destructive" />
                    </div>
                    <div class="size-6 rounded-md bg-muted/50 flex items-center justify-center pointer-events-none">
                      <Icon name="i-lucide-chevron-down" class="size-3.5 text-muted-foreground" />
                    </div>
                  </div>
                  
                  <!-- Awesome Dropdown -->
                  <transition name="fade">
                    <div
                      v-if="templateDropdownOpen"
                      class="absolute z-50 w-full mt-2 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
                    >
                      <div v-if="filteredTemplates.length === 0" class="p-4 text-center text-sm font-semibold text-muted-foreground">
                        No templates found.
                      </div>
                      <button
                        v-for="t in filteredTemplates"
                        :key="t._id"
                        class="w-full flex items-center text-left px-4 py-3 hover:bg-primary/10 transition-colors border-b border-border/30 last:border-0 group"
                        @click="chooseTemplate(t)"
                      >
                        <div class="size-8 rounded-lg flex items-center justify-center shrink-0 mr-3 border"
                          :class="selectedModalTemplate?._id === t._id ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted/30 border-border/30 text-muted-foreground group-hover:text-primary group-hover:border-primary/20'"
                        >
                          <Icon name="i-lucide-file-signature" class="size-4" />
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors" :class="{ 'text-primary': selectedModalTemplate?._id === t._id }">{{ t.name }}</p>
                        </div>
                        <Icon v-if="selectedModalTemplate?._id === t._id" name="i-lucide-check" class="size-4 text-primary shrink-0 ml-2" />
                      </button>
                    </div>
                  </transition>
                </div>
                <div v-if="selectedModalTemplate" class="px-1 mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p class="text-xs text-muted-foreground font-medium leading-relaxed">
                    {{ selectedModalTemplate.description || 'No description provided for this template.' }}
                  </p>
                </div>
              </div>

              <Button
                class="w-full h-11 font-bold shadow-md shadow-primary/20 group"
                :disabled="!selectedModalTemplate"
                @click="selectModalTemplate(selectedModalTemplate)"
              >
                Continue Details
                <Icon name="i-lucide-arrow-right" class="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>

          <!-- ─── Step 3: Variable Form + Confirm ─── -->
          <div v-else-if="createStep === 3" class="p-6">
            <!-- Selections Summary -->
            <div class="flex flex-col sm:flex-row items-stretch gap-3 mb-6 bg-muted/20 p-1.5 rounded-xl border border-border/50">
              <div class="flex-1 flex items-center gap-3 p-3 rounded-lg bg-background shadow-sm border border-border/30">
                <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-user" class="size-4 text-primary" />
                </div>
                <div class="min-w-0">
                  <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Customer</p>
                  <p class="text-xs font-bold truncate text-foreground">{{ selectedCustomer?.name }}</p>
                </div>
              </div>
              <div class="flex-1 flex items-center gap-3 p-3 rounded-lg bg-background shadow-sm border border-border/30">
                <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-file-signature" class="size-4 text-primary" />
                </div>
                <div class="min-w-0">
                  <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Template</p>
                  <p class="text-xs font-bold truncate text-foreground">{{ selectedModalTemplate?.name }}</p>
                </div>
              </div>
            </div>

            <!-- Contract Title -->
            <div class="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5 relative overflow-hidden">
              <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl"></div>
              <Label for="contract-title" class="text-xs font-bold text-primary uppercase tracking-wider mb-2 block">
                Contract Title
              </Label>
              <Input
                id="contract-title"
                v-model="contractTitle"
                placeholder="e.g. Change Order — John Smith"
                class="h-11 text-sm font-bold bg-background border-primary/20 focus:border-primary focus:ring-primary/20 shadow-sm"
              />
            </div>

            <!-- Dynamic Variable Fields -->
            <div v-if="selectedModalTemplate?.variables?.length" class="space-y-4">
              <div class="relative flex items-center py-2 mb-2 group">
                <div class="absolute inset-0 flex items-center" aria-hidden="true">
                  <div class="w-full border-t border-border/60"></div>
                </div>
                <div class="relative flex justify-center w-full">
                  <span class="bg-card px-4 text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Icon name="i-lucide-list-collapse" class="size-3.5" />
                    Contract Variables
                  </span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  v-for="v in selectedModalTemplate.variables.filter((v: any) => v.scope !== 'client' && !['company_name', 'companyName', 'client_name', 'clientName', 'customer_name', 'customerName'].includes(v.key))"
                  :key="v.key"
                  :class="v.type === 'textarea' ? 'sm:col-span-2' : ''"
                >
                  <Label :for="`var-${v.key}`" class="text-xs font-semibold text-foreground/80 mb-2 flex items-center gap-1.5">
                    {{ v.label || v.key }}
                    <span v-if="v.required" class="text-destructive text-[10px]">*</span>
                  </Label>
                  <textarea
                    v-if="v.type === 'textarea'"
                    :id="`var-${v.key}`"
                    v-model="variableValues[v.key]"
                    :placeholder="v.label || v.key"
                    rows="3"
                    class="w-full px-3 py-2 text-sm rounded-lg border bg-muted/20 hover:bg-background focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none shadow-sm max-h-[250px]"
                  />
                  <select
                    v-else-if="v.type === 'select'"
                    :id="`var-${v.key}`"
                    v-model="variableValues[v.key]"
                    class="w-full h-10 px-3 text-sm rounded-lg border border-input bg-muted/20 hover:bg-background focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm appearance-none"
                  >
                    <option value="" disabled selected>Select an option...</option>
                    <option v-for="opt in v.options" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                  <Input
                    v-else-if="v.type === 'date'"
                    :id="`var-${v.key}`"
                    v-model="variableValues[v.key]"
                    type="date"
                    class="h-10 text-sm bg-muted/20 hover:bg-background focus:bg-background transition-all shadow-sm"
                  />
                  <Input
                    v-else-if="v.type === 'number'"
                    :id="`var-${v.key}`"
                    v-model="variableValues[v.key]"
                    type="number"
                    :placeholder="v.label || v.key"
                    class="h-10 text-sm tabular-nums bg-muted/20 hover:bg-background focus:bg-background transition-all shadow-sm"
                  />
                  <div v-else-if="v.type === 'currency'" class="relative flex items-center">
                    <span class="absolute left-3 text-sm text-muted-foreground font-semibold">$</span>
                    <Input
                      :id="`var-${v.key}`"
                      v-model="variableValues[v.key]"
                      type="text"
                      :placeholder="v.label || '0.00'"
                      class="h-10 text-sm pl-7 tabular-nums bg-muted/20 hover:bg-background focus:bg-background transition-all shadow-sm"
                    />
                  </div>
                  
                  <div v-else-if="v.type === 'signature'" class="flex flex-col gap-2">
                    <SignaturePad v-model="variableValues[v.key]" class="h-32 w-full bg-background rounded-lg border border-border shadow-sm overflow-hidden" />
                    <Input
                      :id="`var-${v.key}`"
                      v-model="variableValues[v.key]"
                      placeholder="Or paste an image URL / base64 string directly..."
                      class="h-9 text-xs text-muted-foreground bg-muted/20 hover:bg-background focus:bg-background transition-all shadow-sm"
                    />
                  </div>

                  <Input
                    v-else
                    :id="`var-${v.key}`"
                    v-model="variableValues[v.key]"
                    :placeholder="v.label || v.key"
                    class="h-10 text-sm bg-muted/20 hover:bg-background focus:bg-background transition-all shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div v-else class="text-center py-8 text-muted-foreground">
              <Icon name="i-lucide-check-circle" class="size-8 mx-auto mb-2 text-emerald-500" />
              <p class="text-sm font-semibold">No variables needed</p>
              <p class="text-xs mt-0.5">This template has no dynamic fields.</p>
            </div>

            <!-- PDF Attachment -->
            <div class="mt-6 p-4 rounded-xl border border-border bg-card relative overflow-hidden">
              <Label class="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">
                Attach Additional PDF Document (Optional)
              </Label>
              <div class="flex items-center gap-3">
                <Button variant="outline" size="sm" @click="pdfFileInput?.click()">
                  <Icon name="i-lucide-upload" class="mr-2 size-4" />
                  {{ attachedPdfName || 'Upload PDF' }}
                </Button>
                <Button v-if="attachedPdfName" variant="ghost" size="sm" class="text-destructive hover:bg-destructive/10" @click="attachedPdf = ''; attachedPdfName = '';">
                  Remove
                </Button>
                <input ref="pdfFileInput" type="file" accept="application/pdf" class="hidden" @change="handlePdfUpload" />
              </div>
              <p class="text-[10px] text-muted-foreground mt-2">
                This PDF will be appended to the final contract document.
              </p>
            </div>

            <!-- Gallery Image Attachments -->
            <div v-if="selectedCustomer?.gallery?.length" class="mt-4 p-4 rounded-xl border border-border bg-card relative overflow-hidden">
              <Label class="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">
                Attach Customer Images (Optional)
              </Label>
              <p class="text-[10px] text-muted-foreground mb-3">
                Select images from the customer's project gallery to append to the contract.
              </p>
              
              <div class="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button
                  v-for="(img, idx) in selectedCustomer.gallery"
                  :key="idx"
                  class="relative size-20 sm:size-24 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer group"
                  :class="attachedGalleryImages.includes(img.url) ? 'border-primary ring-2 ring-primary/20 scale-95' : 'border-transparent hover:border-border'"
                  @click="toggleGalleryImage(img.url)"
                >
                  <img :src="img.url" class="w-full h-full object-cover" />
                  <div v-if="attachedGalleryImages.includes(img.url)" class="absolute inset-0 bg-primary/20 backdrop-blur-[2px] flex items-center justify-center">
                    <div class="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                      <Icon name="i-lucide-check" class="size-3.5" />
                    </div>
                  </div>
                  <div v-else class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Icon name="i-lucide-plus" class="size-6 text-white" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 border-t border-border/50 flex items-center justify-between bg-muted/10">
          <Button v-if="createStep > 1" variant="ghost" size="sm" @click="createStep--">
            <Icon name="i-lucide-arrow-left" class="mr-1.5 size-3.5" />
            Back
          </Button>
          <div v-else />
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="showCreateModal = false">Cancel</Button>
            <Button
              v-if="createStep === 3"
              size="sm"
              class="shadow-lg shadow-primary/20"
              :disabled="savingContract || isUploadingPdf || !contractTitle.trim()"
              @click="saveContract"
            >
              <Icon v-if="savingContract || isUploadingPdf" name="i-lucide-loader-circle" class="mr-1.5 size-3.5 animate-spin" />
              <Icon v-else name="i-lucide-file-signature" class="mr-1.5 size-3.5" />
              <span v-if="isUploadingPdf">Uploading PDF...</span>
              <span v-else>{{ editingContractId ? 'Save Changes' : 'Create Contract' }}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
</template>
