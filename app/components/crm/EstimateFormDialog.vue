<script setup lang="ts">
import { upload } from '@vercel/blob/client'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

const props = defineProps<{
  modelValue?: boolean
}>()

const emit = defineEmits(['saved', 'update:modelValue'])

const TYPE_ICONS: Record<string, string> = {
  'lead': 'i-lucide-user',
  'prospect': 'i-lucide-user-plus',
  'active-customer': 'i-lucide-user-check',
  'past-customer': 'i-lucide-user-minus',
  'default': 'i-lucide-user',
}

const showCreateModal = computed({
  get: () => props.modelValue || internalOpen.value,
  set: (v) => {
    internalOpen.value = v
    emit('update:modelValue', v)
  },
})

const internalOpen = ref(false)

const templates = ref<any[]>([])
const loadingTemplates = ref(false)
async function fetchTemplates() {
  loadingTemplates.value = true
  try {
    const res = await $fetch<any>('/api/estimates/templates')
    templates.value = res.data || []
  }
  finally {
    loadingTemplates.value = false
  }
}

const companyProfile = ref<any>({})
async function fetchCompanyProfile() {
  try {
    const res = await $fetch<any>('/api/app-settings')
    if (res.success && res.data?.companyProfile)
      companyProfile.value = res.data.companyProfile
  }
  catch {}
}

watch(showCreateModal, (val) => {
  if (val) {
    fetchTemplates()
    if (!companyProfile.value.name)
      fetchCompanyProfile()
  }
})

// ─── Create/Edit Estimate Modal ───────────────────────────────

const editingEstimateId = ref<string | null>(null)
const createStep = ref(1) // 1=customer, 2=project, 3=template, 4=variables+confirm
const savingEstimate = ref(false)

// Step 1: Customer selection
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
  catch (e: any) {
    toast.error('Failed to load customers')
  }
  finally {
    loadingCustomers.value = false
  }
}

// Step 2: Project selection (from pipeline, filtered by customerId)
const projects = ref<any[]>([])
const loadingProjects = ref(false)
const projectSearch = ref('')
const selectedProject = ref<any | null>(null)

async function fetchProjects(custId: string) {
  loadingProjects.value = true
  try {
    const custName = selectedCustomer.value?.name || ''
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/pipeline', {
      params: { limit: 200, customerId: custId, customerName: custName || undefined },
    })
    projects.value = res.data || []
  }
  catch (e: any) {
    toast.error('Failed to load projects')
  }
  finally {
    loadingProjects.value = false
  }
}

const filteredProjects = computed(() => {
  if (!projectSearch.value)
    return projects.value
  const q = projectSearch.value.toLowerCase()
  return projects.value.filter(p =>
    p.name?.toLowerCase().includes(q)
    || p.projectName?.toLowerCase().includes(q)
    || p.email?.toLowerCase().includes(q),
  )
})

const filteredCustomers = computed(() => {
  if (!customerSearch.value)
    return customers.value
  const q = customerSearch.value.toLowerCase()
  return customers.value.filter(c =>
    c.name?.toLowerCase().includes(q)
    || c.email?.toLowerCase().includes(q)
    || c.phone?.includes(q),
  )
})

// Step 3: Template selection
const selectedModalTemplate = ref<any | null>(null)
const templateDropdownOpen = ref(false)
const templateSearch = ref('')
const filteredTemplates = computed(() => {
  if (!templateSearch.value)
    return templates.value
  const q = templateSearch.value.toLowerCase()
  return templates.value.filter(t => t.name.toLowerCase().includes(q))
})

function chooseTemplate(t: any) {
  selectedModalTemplate.value = t
  templateSearch.value = ''
  templateDropdownOpen.value = false
}

function handleTemplateBlur() {
  setTimeout(() => { templateDropdownOpen.value = false }, 200)
}

// Step 4: Variable values
const variableValues = ref<Record<string, string>>({})
const estimateTitle = ref('')
const attachedPdf = ref('')
const attachedPdfName = ref('')
const isUploadingPdf = ref(false)
const pdfFileInput = ref<HTMLInputElement | null>(null)
const attachedGalleryImages = ref<string[]>([])

// Extracted PDF line items and totals
const isExtractingPdf = ref(false)
const lineItems = ref<any[]>([])
const materialTotal = ref(0)
const laborTotal = ref(0)
const taxTotal = ref(0)
const discountTotal = ref(0)
const totalAmount = ref(0)

const groupedLineItems = computed(() => {
  const groups: Record<string, any[]> = {}
  for (const item of lineItems.value) {
    const room = item.room || 'Main Floor'
    if (!groups[room]) groups[room] = []
    groups[room].push(item)
  }
  return groups
})

function addLineItem(room = 'Main Floor') {
  lineItems.value.push({
    room,
    sku: '',
    description: '',
    quantity: 1,
    unit: 'EA',
    price: 0,
    amount: 0,
  })
}

function removeLineItem(index: number) {
  lineItems.value.splice(index, 1)
  recalculateTotals()
}

function updateLineItemAmount(item: any) {
  item.amount = (Number(item.quantity) || 0) * (Number(item.price) || 0)
  recalculateTotals()
}

function recalculateTotals() {
  let calculatedAmount = 0
  for (const item of lineItems.value) {
    calculatedAmount += Number(item.amount) || 0
  }
  totalAmount.value = calculatedAmount + Number(taxTotal.value || 0) - Number(discountTotal.value || 0)
}

async function fetchPdfDetails() {
  if (!attachedPdf.value) return
  isExtractingPdf.value = true
  try {
    toast.loading('Extracting line items from PDF...', { id: 'pdf-extract' })
    const res = await $fetch<{ success: boolean, data: any }>('/api/estimates/extract-pdf', {
      method: 'POST',
      body: { pdfUrl: attachedPdf.value }
    })
    if (res.success && res.data) {
      lineItems.value = res.data.lineItems || []
      materialTotal.value = res.data.materialTotal || 0
      laborTotal.value = res.data.laborTotal || 0
      taxTotal.value = res.data.taxTotal || 0
      discountTotal.value = res.data.discountTotal || 0
      totalAmount.value = res.data.totalAmount || 0
      toast.success('Successfully extracted details from PDF!', { id: 'pdf-extract' })
    } else {
      throw new Error('No data returned')
    }
  } catch (err: any) {
    toast.error('Failed to extract details from PDF', {
      description: err?.data?.message || err?.message || 'Error occurred',
      id: 'pdf-extract'
    })
  } finally {
    isExtractingPdf.value = false
  }
}

async function loadCustomerGallery(id: string) {
  try {
    const res = await $fetch<any>(`/api/pipeline/${id}`)
    if (res.success && res.data?.gallery) {
      if (selectedCustomer.value) {
        selectedCustomer.value.gallery = res.data.gallery
      }
    }
  }
  catch (e) {}
}

function toggleGalleryImage(url: string) {
  const index = attachedGalleryImages.value.indexOf(url)
  if (index === -1) {
    attachedGalleryImages.value.push(url)
  }
  else {
    attachedGalleryImages.value.splice(index, 1)
  }
}

// ─── Gallery Image Upload ─────────────────────────────────────
const galleryFileInput = ref<HTMLInputElement | null>(null)
const isUploadingGallery = ref(false)
const galleryUploadQueue = ref<any[]>([])

function compressImageForGallery(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 1200
        let w = img.width; let h = img.height
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX } }
        else { if (h > MAX) { w *= MAX / h; h = MAX } }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = reject
      img.src = event.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function handleGalleryUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0 || !selectedCustomer.value)
    return

  const files = Array.from(target.files)
  isUploadingGallery.value = true

  const queueItems = files.map(f => ({ id: Math.random().toString(36).substr(2, 9), file: f, progress: 0 }))
  galleryUploadQueue.value.push(...queueItems)

  try {
    const uploadedImages: any[] = []

    for (const item of queueItems) {
      item.progress = 10
      try {
        const dataUrl = await compressImageForGallery(item.file)
        item.progress = 40
        const interval = setInterval(() => {
          if (item.progress < 90)
            item.progress += 5
        }, 300)

        const sigRes = await $fetch<{ signature: string, timestamp: number, cloudName: string, apiKey: string, folder: string }>('/api/upload/cloudinary-signature', {
          params: { folder: 'hardwood-hub/crm/gallery' },
        })

        const fd = new FormData()
        fd.append('file', dataUrl)
        fd.append('api_key', sigRes.apiKey)
        fd.append('timestamp', String(sigRes.timestamp))
        fd.append('signature', sigRes.signature)
        fd.append('folder', sigRes.folder)

        const clRes = await $fetch<any>(`https://api.cloudinary.com/v1_1/${sigRes.cloudName}/auto/upload`, { method: 'POST', body: fd })
        clearInterval(interval)
        item.progress = 100

        if (clRes?.secure_url) {
          const newImg = { url: clRes.secure_url, caption: '', uploadedAt: new Date().toISOString() }
          uploadedImages.push(newImg)
        }
      }
      catch (e) {
        console.error('Gallery upload failed:', item.file.name, e)
        item.progress = -1
      }
    }

    if (uploadedImages.length > 0) {
      const currentGallery = selectedCustomer.value.gallery || []
      const newGallery = [...currentGallery, ...uploadedImages]

      const updateRes = await $fetch<any>(`/api/pipeline/${selectedCustomer.value._id}`, {
        method: 'PUT',
        body: { gallery: newGallery },
      })

      if (updateRes.success) {
        selectedCustomer.value.gallery = updateRes.data.gallery || newGallery
        for (const img of uploadedImages) {
          if (!attachedGalleryImages.value.includes(img.url)) {
            attachedGalleryImages.value.push(img.url)
          }
        }
        toast.success(`Uploaded ${uploadedImages.length} image(s) to gallery`)
      }
    }

    setTimeout(() => { galleryUploadQueue.value = [] }, 1000)
  }
  catch (err) {
    toast.error('Failed to upload images')
  }
  finally {
    isUploadingGallery.value = false
    if (galleryFileInput.value)
      galleryFileInput.value.value = ''
  }
}

async function handlePdfUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return
  if (file.type !== 'application/pdf') {
    toast.error('Only PDF files are allowed')
    target.value = ''
    return
  }

  const sizeMB = (file.size / 1024 / 1024).toFixed(1)

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

    const uniqueName = `${file.name.replace(/\.pdf$/i, '')}-${Date.now()}.pdf`
    const newBlob = await upload(`hardwood-hub/estimates/raw/${uniqueName}`, file, {
      access: 'private',
      handleUploadUrl: '/api/upload/blob-token',
    })

    if (!newBlob?.url)
      throw new Error('Vercel Blob did not return a URL')

    attachedPdf.value = newBlob.url
    toast.success(
      `PDF uploaded successfully (${sizeMB}MB)`,
      { id: 'pdf-upload' },
    )
    // Auto-extract line items from the uploaded PDF
    fetchPdfDetails()
  }
  catch (err: any) {
    toast.error('PDF upload failed', {
      description: err?.data?.message || err?.message || 'Upload error',
      id: 'pdf-upload',
    })
    attachedPdf.value = ''
    attachedPdfName.value = ''
  }
  finally {
    isUploadingPdf.value = false
    target.value = ''
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
  if (!p.gallery)
    loadCustomerGallery(p._id)
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
  // Auto-set client name
  const clientKey = Object.keys(variableValues.value).find(k =>
    ['clientname', 'client_name', 'customername', 'customer_name'].includes(k.toLowerCase()),
  )
  if (clientKey && selectedCustomer.value) {
    variableValues.value[clientKey] = selectedCustomer.value.name || `${selectedCustomer.value.firstName || ''} ${selectedCustomer.value.lastName || ''}`.trim() || ''
  }
  estimateTitle.value = `${t.name} — ${selectedCustomer.value?.name || 'Customer'}`
  createStep.value = 4
}

function openCreateModal() {
  showCreateModal.value = true
  editingEstimateId.value = null
  createStep.value = 1
  selectedCustomer.value = null
  selectedProject.value = null
  selectedModalTemplate.value = null
  variableValues.value = {}
  estimateTitle.value = ''
  customerSearch.value = ''
  projectSearch.value = ''
  attachedPdf.value = ''
  attachedPdfName.value = ''
  attachedGalleryImages.value = []
  lineItems.value = []
  materialTotal.value = 0
  laborTotal.value = 0
  taxTotal.value = 0
  discountTotal.value = 0
  totalAmount.value = 0
  fetchCustomers()
}

function goToStep(n: number) {
  if (n >= createStep.value) return // can only go back
  createStep.value = n
  if (n === 1 && !customers.value.length) fetchCustomers()
  if (n === 2 && selectedCustomer.value?._id && !projects.value.length) fetchProjects(selectedCustomer.value._id)
}

async function openEditEstimate(ct: any) {
  try {
    toast.loading('Fetching estimate details...', { id: 'fetch-estimate' })
    const res = await $fetch<{ success: boolean, data: any }>(`/api/estimates/detail/${ct._id}`)
    const fullCt = res.data

    editingEstimateId.value = fullCt._id
    estimateTitle.value = fullCt.title
    selectedCustomer.value = { _id: fullCt.customerId, name: fullCt.customerName, email: fullCt.customerEmail, phone: fullCt.customerPhone } as any
    variableValues.value = { ...fullCt.variableValues }
    attachedPdf.value = fullCt.attachedPdf || ''
    attachedPdfName.value = fullCt.attachedPdf ? 'Attached PDF' : ''
    attachedGalleryImages.value = fullCt.attachedGalleryImages || []
    lineItems.value = fullCt.lineItems || []
    materialTotal.value = fullCt.materialTotal || 0
    laborTotal.value = fullCt.laborTotal || 0
    taxTotal.value = fullCt.taxTotal || 0
    discountTotal.value = fullCt.discountTotal || 0
    totalAmount.value = fullCt.totalAmount || 0
    loadCustomerGallery(fullCt.customerId)

    const foundTemplate = templates.value.find(t => t._id === fullCt.templateId)
    selectedModalTemplate.value = foundTemplate || {
      _id: fullCt.templateId,
      name: fullCt.templateName,
      content: fullCt.content,
      variables: Object.keys(fullCt.variableValues || {}).map(k => ({ key: k, label: k, type: 'text' })),
    } as any

    // Pre-load customers and projects
    fetchCustomers()
    if (fullCt.customerId) {
      fetchProjects(fullCt.customerId).then(() => {
        if (fullCt.projectId) {
          const proj = projects.value.find((p: any) => p._id === fullCt.projectId)
          if (proj) selectedProject.value = proj
        }
      })
    }

    createStep.value = 4
    showCreateModal.value = true
  }
  catch (err: any) {
    toast.error('Failed to load estimate details', { description: err?.message })
  }
  finally {
    toast.dismiss('fetch-estimate')
  }
}

async function saveEstimate() {
  if (!selectedCustomer.value || !selectedModalTemplate.value) {
    toast.error('Please select a customer and template')
    return
  }
  if (!estimateTitle.value.trim()) {
    toast.error('Estimate title is required')
    return
  }
  if (!String(variableValues.value.estimate_number || '').trim()) {
    toast.error('Estimate Number is required')
    return
  }
  if (!attachedPdf.value) {
    toast.error('PDF document is required', { description: 'Please upload the estimate PDF before creating.' })
    return
  }

  savingEstimate.value = true
  try {
    const finalAttachedPdf = attachedPdf.value

    const c = selectedCustomer.value
    const payload = {
      title: estimateTitle.value,
      customerId: c._id,
      projectId: selectedProject.value?._id || c._id,
      customerName: c.name,
      customerEmail: c.email,
      customerPhone: c.phone,
      customerAddress: c.address ? [c.address, c.city, c.state, c.zip].filter(Boolean).join(', ') : '',
      templateId: selectedModalTemplate.value._id,
      templateName: selectedModalTemplate.value.name,
      variableValues: variableValues.value,
      content: selectedModalTemplate.value.content,
      attachedPdf: finalAttachedPdf,
      attachedGalleryImages: attachedGalleryImages.value,
      status: 'draft',
      lineItems: lineItems.value,
      materialTotal: materialTotal.value,
      laborTotal: laborTotal.value,
      taxTotal: taxTotal.value,
      discountTotal: discountTotal.value,
      totalAmount: totalAmount.value,
    }

    if (editingEstimateId.value) {
      await $fetch(`/api/estimates/detail/${editingEstimateId.value}`, { method: 'PUT', body: payload })
      toast.success('Estimate updated successfully')
    }
    else {
      await $fetch('/api/estimates', { method: 'POST', body: payload })
      toast.success('Estimate created successfully')
    }

    showCreateModal.value = false
    emit('saved')
  }
  catch (e: any) {
    toast.error(editingEstimateId.value ? 'Failed to update estimate' : 'Failed to create estimate', {
      description: e?.data?.message || e?.message || 'Unknown error',
    })
  }
  finally {
    savingEstimate.value = false
  }
}

function openForCustomer(customer: any) {
  internalOpen.value = true
  editingEstimateId.value = null
  createStep.value = 3
  selectedCustomer.value = customer
  selectedProject.value = customer
  selectedModalTemplate.value = null
  variableValues.value = {}
  estimateTitle.value = ''
  attachedPdf.value = ''
  attachedPdfName.value = ''
  attachedGalleryImages.value = []
  lineItems.value = []
  materialTotal.value = 0
  laborTotal.value = 0
  taxTotal.value = 0
  discountTotal.value = 0
  totalAmount.value = 0
  fetchTemplates()
  if (!companyProfile.value.name)
    fetchCompanyProfile()
  if (!customer.gallery)
    loadCustomerGallery(customer._id)
}

// Computed: can the estimate be submitted?
const canSubmitEstimate = computed(() => {
  if (!estimateTitle.value.trim()) return false
  if (!selectedCustomer.value || !selectedModalTemplate.value) return false
  if (!attachedPdf.value) return false
  const vars = selectedModalTemplate.value.variables || []
  for (const v of vars) {
    if (!v.required) continue
    if (['company_name', 'companyName', 'client_name', 'clientName', 'customer_name', 'customerName'].includes(v.key)) continue
    const val = variableValues.value[v.key]
    if (!val || !String(val).trim()) return false
  }
  return true
})

defineExpose({ openCreateModal, openEditEstimate, openForCustomer })
</script>

<template>
  <!-- ═══════ CREATE ESTIMATE MODAL ═══════ -->
  <Dialog v-model:open="showCreateModal">
    <DialogContent :class="['max-h-[90vh] overflow-hidden flex flex-col p-0 transition-all duration-300', lineItems.length > 0 ? '!max-w-[95vw]' : '!max-w-5xl']">
      <!-- Modal Header -->
      <div class="px-6 pt-6 pb-4 border-b border-border/50">
        <div class="flex items-center gap-3 mb-4">
          <div class="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
            <Icon name="i-lucide-file-text" class="size-5 text-primary" />
          </div>
          <div>
            <DialogTitle class="text-base font-bold">
              {{ editingEstimateId ? `Edit Estimate (${editingEstimateId})` : 'Create New Estimate' }}
            </DialogTitle>
            <DialogDescription class="text-xs text-muted-foreground mt-0.5">
              {{ createStep === 1 ? 'Select a customer from your CRM' : createStep === 2 ? 'Select a project for this customer' : createStep === 3 ? 'Choose an estimate template' : '' }}
            </DialogDescription>
          </div>
        </div>

        <!-- Step Indicator -->
        <div class="flex items-center gap-1">
          <button
            v-for="s in 4"
            :key="s"
            class="h-1.5 flex-1 rounded-full transition-all"
            :class="s <= createStep ? 'bg-primary' : 'bg-muted'"
            @click="s < createStep ? goToStep(s) : null"
          />
        </div>
      </div>

      <!-- Modal Body -->
      <div class="flex-1 overflow-y-auto">
        <!-- ─── Step 1: Select Customer ─── -->
        <div v-if="createStep === 1" class="p-6">
          <div class="relative mb-5">
            <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              v-model="customerSearch"
              placeholder="Search customers..."
              class="pl-10 h-11 bg-muted/30"
              @input="fetchCustomers"
            />
          </div>

          <div v-if="loadingCustomers" class="space-y-2">
            <div v-for="i in 3" :key="i" class="h-16 bg-muted/40 rounded-xl animate-pulse" />
          </div>

          <div v-else class="space-y-2 max-h-[400px] overflow-y-auto">
            <button
              v-for="c in filteredCustomers"
              :key="c._id"
              class="w-full flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
              @click="selectCustomer(c)"
            >
              <div class="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Icon :name="TYPE_ICONS[c.type?.value || 'default'] || TYPE_ICONS.default || 'i-lucide-user'" class="size-4.5 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold group-hover:text-primary transition-colors">
                  {{ c.name }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ c.email || c.phone || 'No contact info' }}
                </p>
              </div>
              <Icon name="i-lucide-chevron-right" class="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
        </div>

        <!-- ─── Step 2: Select Project ─── -->
        <div v-else-if="createStep === 2" class="p-6">
          <div v-if="selectedCustomer" class="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 mb-5">
            <div class="size-8 rounded-md bg-emerald-500/15 flex items-center justify-center">
              <Icon name="i-lucide-check" class="size-4 text-emerald-500" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Customer
              </p>
              <p class="text-xs text-foreground font-semibold">
                {{ selectedCustomer.name }}
              </p>
            </div>
            <button class="text-[10px] text-emerald-600 font-semibold hover:underline" @click="createStep = 1">
              Change
            </button>
          </div>

          <div class="relative mb-5">
            <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              v-model="projectSearch"
              placeholder="Search projects..."
              class="pl-10 h-11 bg-muted/30"
            />
          </div>

          <div v-if="loadingProjects" class="space-y-2">
            <div v-for="i in 3" :key="i" class="h-16 bg-muted/40 rounded-xl animate-pulse" />
          </div>

          <div v-else-if="filteredProjects.length === 0" class="text-center py-12 text-muted-foreground">
            <Icon name="i-lucide-folder-kanban" class="size-10 mx-auto mb-3 opacity-20" />
            <p class="text-sm font-semibold">
              No projects found
            </p>
          </div>

          <div v-else class="space-y-2 max-h-[400px] overflow-y-auto">
            <button
              v-for="p in filteredProjects"
              :key="p._id"
              class="w-full flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
              @click="selectProject(p)"
            >
              <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Icon name="i-lucide-folder-kanban" class="size-4.5 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold group-hover:text-primary transition-colors">
                  {{ p.projectName || p.name }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ p.address || p.email || '' }}
                </p>
              </div>
              <Icon name="i-lucide-chevron-right" class="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
        </div>

        <!-- ─── Step 3: Select Template ─── -->
        <div v-else-if="createStep === 3" class="p-6">
          <div v-if="selectedCustomer" class="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 mb-3">
            <div class="size-8 rounded-md bg-emerald-500/15 flex items-center justify-center">
              <Icon name="i-lucide-check" class="size-4 text-emerald-500" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Customer
              </p>
              <p class="text-xs text-foreground font-semibold">
                {{ selectedCustomer.name }}
              </p>
            </div>
            <button class="text-[10px] text-emerald-600 font-semibold hover:underline" @click="createStep = 1">
              Change
            </button>
          </div>
          <div v-if="selectedProject" class="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 mb-5">
            <div class="size-8 rounded-md bg-emerald-500/15 flex items-center justify-center">
              <Icon name="i-lucide-check" class="size-4 text-emerald-500" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Project
              </p>
              <p class="text-xs text-foreground font-semibold">
                {{ selectedProject.projectName || selectedProject.name }}
              </p>
            </div>
            <button class="text-[10px] text-emerald-600 font-semibold hover:underline" @click="createStep = 2">
              Change
            </button>
          </div>

          <div v-if="loadingTemplates" class="space-y-2">
            <div v-for="i in 3" :key="i" class="h-24 bg-muted/40 rounded-xl animate-pulse" />
          </div>

          <div v-else-if="templates.length === 0" class="text-center py-12">
            <Icon name="i-lucide-layout-template" class="size-10 text-muted-foreground/20 mx-auto mb-3" />
            <p class="text-sm font-semibold text-muted-foreground">
              No templates available
            </p>
            <p class="text-xs text-muted-foreground/70 mt-1 mb-4">
              Create a template first in the Templates tab
            </p>
          </div>

          <div v-else class="py-8 pb-64 space-y-6">
            <div class="space-y-2">
              <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wider block ml-1">Estimate Template</Label>
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
                  >
                  <div v-if="selectedModalTemplate" class="cursor-pointer hover:bg-muted/50 p-1 px-1.5 rounded-md mr-1 transition-colors" @click.stop="selectedModalTemplate = null">
                    <Icon name="i-lucide-x" class="size-3.5 text-muted-foreground hover:text-destructive" />
                  </div>
                  <div class="size-6 rounded-md bg-muted/50 flex items-center justify-center pointer-events-none">
                    <Icon name="i-lucide-chevron-down" class="size-3.5 text-muted-foreground" />
                  </div>
                </div>

                <!-- Dropdown -->
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
                      <div
                        class="size-8 rounded-lg flex items-center justify-center shrink-0 mr-3 border"
                        :class="selectedModalTemplate?._id === t._id ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted/30 border-border/30 text-muted-foreground group-hover:text-primary group-hover:border-primary/20'"
                      >
                        <Icon name="i-lucide-file-text" class="size-4" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-foreground group-hover:text-primary transition-colors break-words" :class="{ 'text-primary': selectedModalTemplate?._id === t._id }">
                          {{ t.name }}
                        </p>
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

        <!-- ─── Step 4: Variable Form + Confirm ─── -->
        <div v-else-if="createStep === 4" class="p-6">
          <!-- Selections Summary -->
          <div class="flex flex-col sm:flex-row items-stretch gap-3 mb-6 bg-muted/20 p-1.5 rounded-xl border border-border/50">
            <div class="flex-1 flex items-center gap-3 p-3 rounded-lg bg-background shadow-sm border border-border/30">
              <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Icon name="i-lucide-user" class="size-4 text-primary" />
              </div>
              <div class="min-w-0">
                <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">
                  Customer
                </p>
                <p class="text-xs font-bold truncate text-foreground">
                  {{ selectedCustomer?.name }}
                </p>
              </div>
            </div>
            <div class="flex-1 flex items-center gap-3 p-3 rounded-lg bg-background shadow-sm border border-border/30">
              <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Icon name="i-lucide-folder-kanban" class="size-4 text-primary" />
              </div>
              <div class="min-w-0">
                <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">
                  Project
                </p>
                <p class="text-xs font-bold truncate text-foreground">
                  {{ selectedProject?.projectName || selectedProject?.name }}
                </p>
              </div>
            </div>
            <div class="flex-1 flex items-center gap-3 p-3 rounded-lg bg-background shadow-sm border border-border/30">
              <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Icon name="i-lucide-file-text" class="size-4 text-primary" />
              </div>
              <div class="min-w-0">
                <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">
                  Template
                </p>
                <p class="text-xs font-bold truncate text-foreground">
                  {{ selectedModalTemplate?.name }}
                </p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
            <!-- Left Side: Variables and uploads -->
            <div :class="lineItems.length > 0 ? 'lg:col-span-4' : 'lg:col-span-12'">
              <!-- Estimate Title -->
              <div class="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5 relative overflow-hidden">
                <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
                <Label for="estimate-title" class="text-xs font-bold text-primary uppercase tracking-wider mb-2 block">
                  Estimate Title
                </Label>
                <Input
                  id="estimate-title"
                  v-model="estimateTitle"
                  placeholder="e.g. Hardwood Floor Estimate — John Smith"
                  class="h-11 text-sm font-bold bg-background border-primary/20 focus:border-primary focus:ring-primary/20 shadow-sm"
                />
              </div>

              <!-- Dynamic Variable Fields (system variables only) -->
              <div v-if="selectedModalTemplate?.variables?.length" class="space-y-4">
                <div class="relative flex items-center py-2 mb-2 group">
                  <div class="absolute inset-0 flex items-center" aria-hidden="true">
                    <div class="w-full border-t border-border/60" />
                  </div>
                  <div class="relative flex justify-center w-full">
                    <span class="bg-card px-4 text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Icon name="i-lucide-list-collapse" class="size-3.5" />
                      Estimate Variables
                    </span>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    v-for="v in selectedModalTemplate.variables.filter((v: any) => !['company_name', 'companyName', 'client_name', 'clientName', 'customer_name', 'customerName'].includes(v.key))"
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
                      <option value="" disabled selected>
                        Select an option...
                      </option>
                      <option v-for="opt in v.options" :key="opt" :value="opt">
                        {{ opt }}
                      </option>
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
                <p class="text-sm font-semibold">
                  No variables needed
                </p>
                <p class="text-xs mt-0.5">
                  This template has no dynamic fields.
                </p>
              </div>

              <!-- PDF Attachment (Required) -->
              <div class="mt-6 p-4 rounded-xl border bg-card relative overflow-hidden" :class="attachedPdf ? 'border-emerald-500/30' : 'border-destructive/30'">
                <Label class="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  Attach PDF Document
                  <span class="text-destructive">*</span>
                </Label>
                <div class="flex flex-wrap items-center gap-3">
                  <Button variant="outline" size="sm" @click="pdfFileInput?.click()">
                    <Icon name="i-lucide-upload" class="mr-2 size-4" />
                    {{ attachedPdfName || 'Upload PDF' }}
                  </Button>
                  <Button
                    v-if="attachedPdfName"
                    variant="ghost"
                    size="sm"
                    class="text-destructive hover:bg-destructive/10"
                    @click="attachedPdf = ''; attachedPdfName = ''; lineItems = []; materialTotal = 0; laborTotal = 0; taxTotal = 0; discountTotal = 0; totalAmount = 0;"
                  >
                    Remove
                  </Button>
                  <Button
                    v-if="attachedPdf && !isExtractingPdf"
                    variant="outline"
                    size="sm"
                    class="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                    @click="fetchPdfDetails"
                  >
                    <Icon name="i-lucide-wand-2" class="mr-2 size-4" />
                    Re-Extract
                  </Button>
                  <Button
                    v-else-if="isExtractingPdf"
                    disabled
                    variant="outline"
                    size="sm"
                  >
                    <Icon name="i-lucide-loader-2" class="mr-2 size-4 animate-spin" />
                    Extracting...
                  </Button>
                  <input ref="pdfFileInput" type="file" accept="application/pdf" class="hidden" @change="handlePdfUpload">
                </div>
                <p v-if="!attachedPdf" class="text-[10px] text-destructive/70 mt-2 font-medium">
                  PDF upload is required. Line items will be automatically extracted.
                </p>
                <p v-else class="text-[10px] text-emerald-600 mt-2 font-medium flex items-center gap-1">
                  <Icon name="i-lucide-check-circle" class="size-3" />
                  PDF uploaded. This PDF will be appended to the final estimate document.
                </p>
              </div>

              <!-- Gallery Image Attachments -->
              <div v-if="selectedCustomer" class="mt-4 p-4 rounded-xl border border-border bg-card relative overflow-hidden">
                <div class="flex items-center justify-between mb-2">
                  <Label class="text-xs font-bold text-foreground uppercase tracking-wider">
                    Attach Customer Images (Optional)
                  </Label>
                  <button
                    type="button"
                    :disabled="isUploadingGallery"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                    :class="isUploadingGallery ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary hover:bg-primary/20'"
                    @click="galleryFileInput?.click()"
                  >
                    <Icon :name="isUploadingGallery ? 'i-lucide-loader-2' : 'i-lucide-upload-cloud'" :class="isUploadingGallery ? 'animate-spin' : ''" class="size-3.5" />
                    {{ isUploadingGallery ? 'Uploading...' : 'Upload New' }}
                  </button>
                </div>
                <input ref="galleryFileInput" type="file" multiple accept="image/*" class="hidden" @change="handleGalleryUpload">
                <p class="text-[10px] text-muted-foreground mb-3">
                  Select images from the customer's gallery to append to the estimate, or upload new ones.
                </p>

                <div v-if="selectedCustomer.gallery?.length || galleryUploadQueue.length" class="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  <button
                    v-for="(img, idx) in selectedCustomer.gallery"
                    :key="idx"
                    class="relative size-20 sm:size-24 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer group"
                    :class="attachedGalleryImages.includes(img.url) ? 'border-primary ring-2 ring-primary/20 scale-95' : 'border-transparent hover:border-border'"
                    @click="toggleGalleryImage(img.url)"
                  >
                    <img :src="img.url" class="w-full h-full object-cover">
                    <div v-if="attachedGalleryImages.includes(img.url)" class="absolute inset-0 bg-primary/20 backdrop-blur-[2px] flex items-center justify-center">
                      <div class="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                        <Icon name="i-lucide-check" class="size-3.5" />
                      </div>
                    </div>
                    <div v-else class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Icon name="i-lucide-plus" class="size-6 text-white" />
                    </div>
                  </button>
                  <!-- Upload queue skeletons -->
                  <div
                    v-for="item in galleryUploadQueue"
                    :key="item.id"
                    class="relative size-20 sm:size-24 rounded-lg overflow-hidden shrink-0 border-2 border-primary/30 bg-muted/50 flex items-center justify-center"
                  >
                    <template v-if="item.progress < 0">
                      <Icon name="i-lucide-x-circle" class="size-5 text-red-500" />
                    </template>
                    <template v-else-if="item.progress === 100">
                      <Icon name="i-lucide-check-circle-2" class="size-5 text-emerald-500" />
                    </template>
                    <template v-else>
                      <div class="flex flex-col items-center gap-1">
                        <Icon name="i-lucide-loader-2" class="size-5 text-primary animate-spin" />
                        <span class="text-[9px] font-bold text-primary">{{ item.progress }}%</span>
                      </div>
                    </template>
                  </div>
                </div>

                <div v-else class="flex items-center justify-center py-6 border border-dashed border-border/60 rounded-lg bg-muted/10">
                  <button type="button" class="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors" @click="galleryFileInput?.click()">
                    <Icon name="i-lucide-images" class="size-8 opacity-50" />
                    <span class="text-[10px] font-bold uppercase tracking-wider">No images yet — Upload some</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Right Side: Extracted Line Items & Totals Summary -->
            <div v-if="lineItems.length > 0" class="lg:col-span-8 border-l border-border lg:pl-6 flex flex-col max-h-[65vh] overflow-hidden">
              <div class="flex items-center justify-between mb-3 shrink-0">
                <span class="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <Icon name="i-lucide-wand-2" class="size-4" />
                  Extracted Items ({{ lineItems.length }})
                </span>
                <Button variant="outline" size="sm" class="h-7 text-[10px] font-bold uppercase tracking-wider" @click="addLineItem()">
                  <Icon name="i-lucide-plus" class="mr-1 size-3" />
                  Add Item
                </Button>
              </div>

              <!-- Scrollable items area -->
              <div class="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-4">
                <div v-for="(items, roomName) in groupedLineItems" :key="roomName" class="rounded-lg border border-border bg-muted/5 overflow-hidden">
                  <!-- Room Header -->
                  <div class="flex items-center justify-between px-3 py-2.5 bg-primary/15 border-b border-primary/20">
                    <span class="text-[11px] font-bold text-primary flex items-center gap-1.5">
                      <Icon name="i-lucide-map-pin" class="size-3.5" />
                      {{ roomName }}
                      <span class="text-primary/60 font-normal">({{ items.length }} items)</span>
                    </span>
                    <button type="button" class="text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors flex items-center gap-1" @click="addLineItem(roomName as string)">
                      <Icon name="i-lucide-plus" class="size-3" />
                      Add
                    </button>
                  </div>

                  <!-- Table Header -->
                  <div class="grid grid-cols-[1fr_2fr_60px_50px_80px_80px_28px] gap-px bg-muted/30 px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/30">
                    <span>Item</span>
                    <span>Description</span>
                    <span class="text-center">Qty</span>
                    <span class="text-center">Unit</span>
                    <span class="text-right">Price</span>
                    <span class="text-right">Amount</span>
                    <span></span>
                  </div>

                  <!-- Table Rows -->
                  <div class="divide-y divide-border/20">
                    <div
                      v-for="item in items"
                      :key="item._id || lineItems.indexOf(item)"
                      class="grid grid-cols-[1fr_2fr_60px_50px_80px_80px_28px] gap-px items-center px-2 py-1 group hover:bg-muted/10 transition-colors"
                    >
                      <input
                        v-model="item.sku"
                        placeholder="SKU"
                        class="bg-transparent text-xs font-semibold border-0 outline-none px-1 py-1 truncate hover:bg-muted/20 focus:bg-muted/30 rounded transition-colors"
                      />
                      <input
                        v-model="item.description"
                        placeholder="Description"
                        class="bg-transparent text-xs border-0 outline-none px-1 py-1 truncate text-muted-foreground hover:bg-muted/20 focus:bg-muted/30 rounded transition-colors"
                      />
                      <input
                        v-model="item.quantity"
                        type="number"
                        class="bg-transparent text-xs text-center border-0 outline-none px-1 py-1 tabular-nums hover:bg-muted/20 focus:bg-muted/30 rounded transition-colors w-full"
                        @input="updateLineItemAmount(item)"
                      />
                      <input
                        v-model="item.unit"
                        class="bg-transparent text-xs text-center border-0 outline-none px-1 py-1 uppercase hover:bg-muted/20 focus:bg-muted/30 rounded transition-colors w-full"
                      />
                      <input
                        v-model="item.price"
                        type="number"
                        class="bg-transparent text-xs text-right border-0 outline-none px-1 py-1 tabular-nums hover:bg-muted/20 focus:bg-muted/30 rounded transition-colors w-full"
                        @input="updateLineItemAmount(item)"
                      />
                      <span class="text-xs font-bold text-right tabular-nums px-1 text-foreground/80">
                        ${{ (item.amount || 0).toFixed(2) }}
                      </span>
                      <button
                        type="button"
                        class="size-5 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        @click="removeLineItem(lineItems.indexOf(item))"
                      >
                        <Icon name="i-lucide-x" class="size-3" />
                      </button>
                    </div>
                  </div>

                  <!-- Section Subtotal -->
                  <div class="grid grid-cols-[1fr_2fr_60px_50px_80px_80px_28px] gap-px items-center px-2 py-1.5 bg-muted/30 border-t border-border/40">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground col-span-2">
                      Subtotal — {{ roomName }}
                    </span>
                    <span class="text-[10px] text-center tabular-nums text-muted-foreground font-semibold">
                      {{ (items as any[]).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) }}
                    </span>
                    <span></span>
                    <span></span>
                    <span class="text-xs font-black text-right tabular-nums text-primary px-1">
                      ${{ (items as any[]).reduce((s: number, i: any) => s + Number(i.amount || 0), 0).toFixed(2) }}
                    </span>
                    <span></span>
                  </div>
                </div>
              </div>

              <!-- Totals Summary - Fixed at bottom -->
              <div class="mt-3 pt-3 border-t border-border/60 shrink-0">
                <div class="flex items-center gap-3 flex-wrap">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Material</span>
                    <div class="relative flex items-center">
                      <span class="absolute left-2 text-[10px] text-muted-foreground">$</span>
                      <Input type="number" v-model="materialTotal" class="h-7 w-36 text-xs pl-5 tabular-nums" />
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Labor</span>
                    <div class="relative flex items-center">
                      <span class="absolute left-2 text-[10px] text-muted-foreground">$</span>
                      <Input type="number" v-model="laborTotal" class="h-7 w-36 text-xs pl-5 tabular-nums" />
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Tax</span>
                    <div class="relative flex items-center">
                      <span class="absolute left-2 text-[10px] text-muted-foreground">$</span>
                      <Input type="number" v-model="taxTotal" class="h-7 w-28 text-xs pl-5 tabular-nums" @input="recalculateTotals" />
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Discount</span>
                    <div class="relative flex items-center">
                      <span class="absolute left-2 text-[10px] text-muted-foreground">$</span>
                      <Input type="number" v-model="discountTotal" class="h-7 w-28 text-xs pl-5 tabular-nums" @input="recalculateTotals" />
                    </div>
                  </div>
                  <div class="ml-auto flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/20">
                    <span class="text-[10px] font-bold text-primary uppercase tracking-wider">Total</span>
                    <span class="text-sm font-black text-primary tabular-nums">
                      ${{ (totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 border-t border-border/50 flex items-center justify-between bg-muted/10">
        <Button v-if="createStep > 1" variant="ghost" size="sm" @click="goToStep(createStep - 1)">
          <Icon name="i-lucide-arrow-left" class="mr-1.5 size-3.5" />
          Back
        </Button>
        <div v-else />
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" @click="showCreateModal = false">
            Cancel
          </Button>
          <Button
            v-if="createStep === 4"
            size="sm"
            class="shadow-lg shadow-primary/20"
            :disabled="savingEstimate || isUploadingPdf || !canSubmitEstimate"
            @click="saveEstimate"
          >
            <Icon v-if="savingEstimate || isUploadingPdf" name="i-lucide-loader-circle" class="mr-1.5 size-3.5 animate-spin" />
            <Icon v-else name="i-lucide-file-text" class="mr-1.5 size-3.5" />
            <span v-if="isUploadingPdf">Uploading PDF...</span>
            <span v-else>{{ editingEstimateId ? 'Save Changes' : 'Create Estimate' }}</span>
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
