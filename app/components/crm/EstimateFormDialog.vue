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

function syncExtractedTotalsToVariables() {
  // Round to cents and avoid float artifacts like 7000.009999999998
  const money = (v: any) => (v !== undefined && v !== null ? String(+Number(v).toFixed(2)) : '')

  const keys = Object.keys(variableValues.value)
  for (const key of keys) {
    const k = key.toLowerCase().replace(/[\s_-]/g, '')
    // Substring matching so template variables like "estimated_new_total",
    // "grand_total", "material_cost_total", "labor_amount" etc. all sync.
    // (Previously only exact keys matched — e.g. the change-order template's
    // "estimated_new_total" was silently skipped and kept its stale default.)
    if (k.includes('material')) {
      variableValues.value[key] = money(materialTotal.value)
    }
    else if (k.includes('labor')) {
      variableValues.value[key] = money(laborTotal.value)
    }
    else if (k.includes('discount')) {
      variableValues.value[key] = money(discountTotal.value)
    }
    else if (k.includes('tax')) {
      variableValues.value[key] = money(taxTotal.value)
    }
    else if (k.includes('total') || k === 'estimateamount') {
      variableValues.value[key] = money(totalAmount.value)
    }
  }
}

function recalculateTotals() {
  let calculatedAmount = 0
  for (const item of lineItems.value) {
    calculatedAmount += Number(item.amount) || 0
  }
  totalAmount.value = calculatedAmount + Number(taxTotal.value || 0) - Number(discountTotal.value || 0)
  syncExtractedTotalsToVariables()
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
      syncExtractedTotalsToVariables()
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
      // Multipart = chunked + retried parts; single-PUT uploads of large PDFs
      // were timing out intermittently on slow connections
      multipart: file.size > 5 * 1024 * 1024,
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

async function saveAndGetId(): Promise<string | null> {
  if (!selectedCustomer.value || !selectedModalTemplate.value) {
    toast.error('Please select a customer and template')
    return null
  }
  if (!estimateTitle.value.trim()) {
    toast.error('Estimate title is required')
    return null
  }
  if (!String(variableValues.value.estimate_number || '').trim()) {
    toast.error('Estimate Number is required')
    return null
  }

  // Validate required template variables
  const vars = selectedModalTemplate.value.variables || []
  for (const v of vars) {
    if (!v.required) continue
    if (['company_name', 'companyName', 'client_name', 'clientName', 'customer_name', 'customerName'].includes(v.key)) continue
    const val = variableValues.value[v.key]
    if (!val || !String(val).trim()) {
      toast.error(`"${v.label || v.key}" is required`)
      return null
    }
  }

  if (!attachedPdf.value) {
    toast.error('PDF document is required', { description: 'Please upload the estimate PDF before creating.' })
    return null
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
      status: editingEstimateId.value ? undefined : 'draft',
      lineItems: lineItems.value,
      materialTotal: materialTotal.value,
      laborTotal: laborTotal.value,
      taxTotal: taxTotal.value,
      discountTotal: discountTotal.value,
      totalAmount: totalAmount.value,
    }

    let savedId = editingEstimateId.value
    if (editingEstimateId.value) {
      await $fetch(`/api/estimates/detail/${editingEstimateId.value}`, { method: 'PUT', body: payload })
      toast.success('Estimate updated successfully')
    }
    else {
      const res = await $fetch<{ success: boolean, data: any }>('/api/estimates', { method: 'POST', body: payload })
      savedId = res.data?._id || null
      toast.success('Estimate created successfully')
    }

    emit('saved')
    return savedId
  }
  catch (e: any) {
    toast.error(editingEstimateId.value ? 'Failed to update estimate' : 'Failed to create estimate', {
      description: e?.data?.message || e?.message || 'Unknown error',
    })
    return null
  }
  finally {
    savingEstimate.value = false
  }
}

async function saveEstimate() {
  const id = await saveAndGetId()
  if (id) {
    showCreateModal.value = false
  }
}

async function downloadPDFDirect() {
  const id = await saveAndGetId()
  if (!id) return

  toast.loading('Generating Estimate PDF...')
  try {
    const response = await fetch(`/api/estimates/download-pdf/${id}`, {
      method: 'GET',
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `Server returned ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const data = await response.json() as { downloadUrl?: string, filename?: string }
      if (!data?.downloadUrl) {
        throw new Error('Server returned JSON without a downloadUrl')
      }

      toast.loading('Fetching large PDF...')
      const fileRes = await fetch(data.downloadUrl)
      if (!fileRes.ok) {
        throw new Error(`Failed to fetch PDF: ${fileRes.status}`)
      }
      const fileBlob = await fileRes.blob()
      const fileObjUrl = URL.createObjectURL(fileBlob)

      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = fileObjUrl
      a.download = data.filename || `Estimate_${variableValues.value.estimate_number || id}.pdf`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(fileObjUrl)
        toast.dismiss()
        toast.success('PDF downloaded successfully')
        showCreateModal.value = false
      }, 400)
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = `Estimate_${variableValues.value.estimate_number || id}.pdf`
    document.body.appendChild(a)
    a.click()

    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.dismiss()
      toast.success('PDF downloaded successfully')
      showCreateModal.value = false
    }, 600)
  }
  catch (err: any) {
    toast.dismiss()
    toast.error('Could not generate PDF', { description: err?.message || 'Server error' })
  }
}

// Send email logic inside the modal
const sendingEmailId = ref<string | null>(null)
const showSendEmailModal = ref(false)
const sendEmailEstimateId = ref<string | null>(null)
const sendEmailEstimateTitle = ref('')
const sendEmailAddresses = ref<string[]>([])
const sendEmailInput = ref('')

async function sendEmailDirect() {
  const id = await saveAndGetId()
  if (!id) return

  sendEmailEstimateId.value = id
  sendEmailEstimateTitle.value = estimateTitle.value
  sendEmailAddresses.value = selectedCustomer.value?.email ? [selectedCustomer.value.email] : []
  sendEmailInput.value = ''
  showSendEmailModal.value = true
}

function addEmailTag() {
  const raw = sendEmailInput.value.trim()
  if (!raw) return
  const emails = raw.split(/[,;\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean)
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const email of emails) {
    if (emailRe.test(email) && !sendEmailAddresses.value.includes(email)) {
      sendEmailAddresses.value.push(email)
    }
  }
  sendEmailInput.value = ''
}

function removeEmailTag(idx: number) {
  sendEmailAddresses.value.splice(idx, 1)
}

function handleEmailInputKeydown(e: KeyboardEvent) {
  if (['Enter', ',', ';', 'Tab'].includes(e.key)) {
    e.preventDefault()
    addEmailTag()
  }
  if (e.key === 'Backspace' && !sendEmailInput.value && sendEmailAddresses.value.length > 0) {
    sendEmailAddresses.value.pop()
  }
}

async function confirmSendEmail() {
  if (!sendEmailEstimateId.value)
    return
  addEmailTag()
  if (sendEmailAddresses.value.length === 0) {
    toast.error('Please enter at least one email address')
    return
  }
  sendingEmailId.value = sendEmailEstimateId.value
  try {
    const res = await $fetch<{ success: boolean, message: string }>('/api/estimates/send-email', {
      method: 'POST',
      body: { estimateId: sendEmailEstimateId.value, overrideEmail: sendEmailAddresses.value.join(', ') },
    })
    toast.success('Email Sent!', { description: res.message })
    showSendEmailModal.value = false
    showCreateModal.value = false
  }
  catch (e: any) {
    toast.error('Failed to send email', { description: e?.data?.message || e?.message })
  }
  finally {
    sendingEmailId.value = null
  }
}

function displayTitle(title: string): string {
  return (title || '').replace(/^Ann Arbor Hardwoods\s+/i, '').trim()
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

/**
 * Open the dialog to create a NEW estimate, pre-filled with data from an existing one.
 * Used for the "Update Estimate" flow on the pipeline detail page.
 */
async function openForCustomerWithPrefill(customer: any, existingEstimate: any) {
  try {
    toast.loading('Loading estimate details...', { id: 'prefill-estimate' })
    // Fetch the full estimate so we get all fields (template content, variables, etc.)
    const res = await $fetch<{ success: boolean, data: any }>(`/api/estimates/detail/${existingEstimate._id}`)
    const fullEst = res.data

    internalOpen.value = true
    editingEstimateId.value = null // Creating NEW, not editing
    selectedCustomer.value = customer
    selectedProject.value = customer

    // Pre-fill from the existing estimate
    estimateTitle.value = fullEst.title || ''
    variableValues.value = { ...fullEst.variableValues }
    attachedPdf.value = fullEst.attachedPdf || ''
    attachedPdfName.value = fullEst.attachedPdf ? 'Attached PDF' : ''
    attachedGalleryImages.value = fullEst.attachedGalleryImages || []
    lineItems.value = fullEst.lineItems || []
    materialTotal.value = fullEst.materialTotal || 0
    laborTotal.value = fullEst.laborTotal || 0
    taxTotal.value = fullEst.taxTotal || 0
    discountTotal.value = fullEst.discountTotal || 0
    totalAmount.value = fullEst.totalAmount || 0

    // Load templates and pre-select the same template
    await fetchTemplates()
    const foundTemplate = templates.value.find(t => t._id === fullEst.templateId)
    selectedModalTemplate.value = foundTemplate || {
      _id: fullEst.templateId,
      name: fullEst.templateName,
      content: fullEst.content,
      variables: Object.keys(fullEst.variableValues || {}).map(k => ({ key: k, label: k, type: 'text' })),
    } as any

    if (!companyProfile.value.name) fetchCompanyProfile()
    if (!customer.gallery) loadCustomerGallery(customer._id)

    createStep.value = 4 // Jump directly to the variables/details step
  }
  catch (err: any) {
    toast.error('Failed to load estimate details', { description: err?.message })
  }
  finally {
    toast.dismiss('prefill-estimate')
  }
}

// Searchable Dropdowns logic for Customers, Projects, and Templates
const customerDropdownOpen = ref(false)
const customerSearchInput = ref('')
const filteredCustomersSearch = computed(() => {
  const query = customerSearchInput.value.trim().toLowerCase()
  if (!query) return customers.value
  return customers.value.filter(c => (c.name || '').toLowerCase().includes(query) || (c.email || '').toLowerCase().includes(query))
})
function handleCustomerBlur() {
  setTimeout(() => {
    customerDropdownOpen.value = false
    customerSearchInput.value = ''
  }, 200)
}

const projectDropdownOpen = ref(false)
const projectSearchInput = ref('')
const filteredProjectsSearch = computed(() => {
  const query = projectSearchInput.value.trim().toLowerCase()
  if (!query) return projects.value
  return projects.value.filter(p => (p.projectName || p.name || '').toLowerCase().includes(query) || (p.address || '').toLowerCase().includes(query))
})
function handleProjectBlur() {
  setTimeout(() => {
    projectDropdownOpen.value = false
    projectSearchInput.value = ''
  }, 200)
}

const templateDropdownOpenGrid = ref(false)
const templateSearchInput = ref('')
const filteredTemplatesSearch = computed(() => {
  const query = templateSearchInput.value.trim().toLowerCase()
  if (!query) return templates.value
  return templates.value.filter(t => (t.name || '').toLowerCase().includes(query) || (t.description || '').toLowerCase().includes(query))
})
function handleTemplateBlurGrid() {
  setTimeout(() => {
    templateDropdownOpenGrid.value = false
    templateSearchInput.value = ''
  }, 200)
}

defineExpose({ openCreateModal, openEditEstimate, openForCustomer, openForCustomerWithPrefill })
</script>

<template>
  <!-- ═══════ CREATE ESTIMATE MODAL ═══════ -->
  <Dialog v-model:open="showCreateModal">
    <DialogContent :class="['max-h-[90vh] overflow-hidden flex flex-col p-0 transition-all duration-300', lineItems.length > 0 ? '!max-w-[95vw]' : '!max-w-5xl']">
      <!-- Modal Header -->
      <div class="px-6 pt-6 pb-4 border-b border-border/50">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
            <Icon name="i-lucide-file-text" class="size-5 text-primary" />
          </div>
          <div>
            <DialogTitle class="text-base font-bold">
              {{ editingEstimateId ? `Edit Estimate (${editingEstimateId})` : 'Create New Estimate' }}
            </DialogTitle>
          </div>
        </div>
      </div>

      <!-- Modal Body -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Selections Grid (Customer, Project, Template) -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-muted/20 p-4 rounded-xl border border-border/50">
          <!-- Customer Select -->
          <div class="flex flex-col gap-1 relative">
            <label class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Customer</label>
            <div v-if="editingEstimateId || selectedCustomer" class="flex items-center justify-between h-9 px-3 rounded-lg bg-background border border-border/30">
              <span class="text-xs font-bold text-foreground truncate">{{ selectedCustomer?.name }}</span>
              <button v-if="!editingEstimateId" class="text-[10px] text-primary font-bold hover:underline" @click="selectedCustomer = null; selectedProject = null;">Change</button>
            </div>
            <div class="else relative" v-else>
              <div
                class="w-full h-9 pl-3 pr-2 flex items-center rounded-lg border border-border bg-background hover:bg-muted/10 focus-within:bg-background focus-within:ring-1 focus-within:ring-primary shadow-sm cursor-text transition-all"
                @click="customerDropdownOpen = true"
              >
                <Icon name="i-lucide-search" class="size-3.5 text-muted-foreground mr-2 shrink-0" />
                <input
                  v-model="customerSearchInput"
                  placeholder="Search Customer..."
                  class="flex-1 bg-transparent border-none focus:outline-none text-xs font-medium placeholder:text-muted-foreground w-full"
                  @focus="customerDropdownOpen = true"
                  @blur="handleCustomerBlur"
                >
                <div class="size-5 rounded bg-muted/50 flex items-center justify-center pointer-events-none">
                  <Icon name="i-lucide-chevron-down" class="size-3 text-muted-foreground" />
                </div>
              </div>

              <!-- Customer Dropdown List -->
              <transition name="fade">
                <div
                  v-if="customerDropdownOpen"
                  class="absolute left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto"
                >
                  <div v-if="filteredCustomersSearch.length === 0" class="p-3 text-center text-xs font-semibold text-muted-foreground">
                    No customers found.
                  </div>
                  <button
                    v-for="c in filteredCustomersSearch"
                    :key="c._id"
                    type="button"
                    class="w-full flex items-center text-left px-3 py-2 hover:bg-primary/10 transition-colors border-b border-border/10 last:border-0 group"
                    @mousedown="selectCustomer(c); customerDropdownOpen = false;"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {{ c.name }}
                      </p>
                      <p class="text-[10px] text-muted-foreground truncate">
                        {{ c.email || c.phone || 'No contact info' }}
                      </p>
                    </div>
                  </button>
                </div>
              </transition>
            </div>
          </div>

          <!-- Project Select -->
          <div class="flex flex-col gap-1 relative">
            <label class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Project</label>
            <div v-if="editingEstimateId || selectedProject" class="flex items-center justify-between h-9 px-3 rounded-lg bg-background border border-border/30">
              <span class="text-xs font-bold text-foreground truncate">{{ selectedProject?.projectName || selectedProject?.name }}</span>
              <button v-if="!editingEstimateId && selectedCustomer" class="text-[10px] text-primary font-bold hover:underline" @click="selectedProject = null">Change</button>
            </div>
            <div class="else relative" v-else>
              <div
                class="w-full h-9 pl-3 pr-2 flex items-center rounded-lg border border-border bg-background hover:bg-muted/10 focus-within:bg-background focus-within:ring-1 focus-within:ring-primary shadow-sm cursor-text transition-all"
                :class="{ 'opacity-50 pointer-events-none': !selectedCustomer }"
                @click="selectedCustomer && (projectDropdownOpen = true)"
              >
                <Icon name="i-lucide-search" class="size-3.5 text-muted-foreground mr-2 shrink-0" />
                <input
                  v-model="projectSearchInput"
                  :placeholder="selectedCustomer ? 'Search Project...' : 'Select Customer first'"
                  :disabled="!selectedCustomer"
                  class="flex-1 bg-transparent border-none focus:outline-none text-xs font-medium placeholder:text-muted-foreground w-full"
                  @focus="projectDropdownOpen = true"
                  @blur="handleProjectBlur"
                >
                <div class="size-5 rounded bg-muted/50 flex items-center justify-center pointer-events-none">
                  <Icon name="i-lucide-chevron-down" class="size-3 text-muted-foreground" />
                </div>
              </div>

              <!-- Project Dropdown List -->
              <transition name="fade">
                <div
                  v-if="projectDropdownOpen && selectedCustomer"
                  class="absolute left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto"
                >
                  <div v-if="filteredProjectsSearch.length === 0" class="p-3 text-center text-xs font-semibold text-muted-foreground">
                    No projects found.
                  </div>
                  <button
                    v-for="p in filteredProjectsSearch"
                    :key="p._id"
                    type="button"
                    class="w-full flex items-center text-left px-3 py-2 hover:bg-primary/10 transition-colors border-b border-border/10 last:border-0 group"
                    @mousedown="selectProject(p); projectDropdownOpen = false;"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {{ p.projectName || p.name }}
                      </p>
                      <p class="text-[10px] text-muted-foreground truncate">
                        {{ p.address || '' }}
                      </p>
                    </div>
                  </button>
                </div>
              </transition>
            </div>
          </div>

          <!-- Template Select -->
          <div class="flex flex-col gap-1 relative">
            <label class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Template</label>
            <div v-if="editingEstimateId || selectedModalTemplate" class="flex items-center justify-between h-9 px-3 rounded-lg bg-background border border-border/30">
              <span class="text-xs font-bold text-foreground truncate">{{ selectedModalTemplate?.name }}</span>
              <button v-if="!editingEstimateId" class="text-[10px] text-primary font-bold hover:underline" @click="selectedModalTemplate = null">Change</button>
            </div>
            <div class="else relative" v-else>
              <div
                class="w-full h-9 pl-3 pr-2 flex items-center rounded-lg border border-border bg-background hover:bg-muted/10 focus-within:bg-background focus-within:ring-1 focus-within:ring-primary shadow-sm cursor-text transition-all"
                @click="templateDropdownOpenGrid = true"
              >
                <Icon name="i-lucide-search" class="size-3.5 text-muted-foreground mr-2 shrink-0" />
                <input
                  v-model="templateSearchInput"
                  placeholder="Search Template..."
                  class="flex-1 bg-transparent border-none focus:outline-none text-xs font-medium placeholder:text-muted-foreground w-full"
                  @focus="templateDropdownOpenGrid = true"
                  @blur="handleTemplateBlurGrid"
                >
                <div class="size-5 rounded bg-muted/50 flex items-center justify-center pointer-events-none">
                  <Icon name="i-lucide-chevron-down" class="size-3 text-muted-foreground" />
                </div>
              </div>

              <!-- Template Dropdown List -->
              <transition name="fade">
                <div
                  v-if="templateDropdownOpenGrid"
                  class="absolute left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto"
                >
                  <div v-if="filteredTemplatesSearch.length === 0" class="p-3 text-center text-xs font-semibold text-muted-foreground">
                    No templates found.
                  </div>
                  <button
                    v-for="t in filteredTemplatesSearch"
                    :key="t._id"
                    type="button"
                    class="w-full flex items-center text-left px-3 py-2 hover:bg-primary/10 transition-colors border-b border-border/10 last:border-0 group"
                    @mousedown="selectModalTemplate(t); templateDropdownOpenGrid = false;"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {{ t.name }}
                      </p>
                      <p class="text-[10px] text-muted-foreground truncate">
                        {{ t.description || 'No description' }}
                      </p>
                    </div>
                  </button>
                </div>
              </transition>
            </div>
          </div>
        </div>

        <!-- Selections Incomplete Placeholder -->
        <div v-if="!selectedCustomer || !selectedProject || !selectedModalTemplate" class="text-center py-16 bg-muted/5 rounded-2xl border border-dashed border-border/60">
          <Icon name="i-lucide-file-signature" class="size-12 mx-auto text-muted-foreground/30 mb-4 animate-bounce duration-1000" />
          <h3 class="text-base font-bold text-foreground/80 mb-1">Configure Estimate Selections</h3>
          <p class="text-xs text-muted-foreground max-w-md mx-auto">
            Please choose a <strong>Customer</strong>, <strong>Project</strong>, and <strong>Template</strong> using the selectors above to display the estimate variables and extraction tools.
          </p>
        </div>

        <!-- ─── Dynamic Variable Form ─── -->
        <div v-else>

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

                <div v-if="selectedCustomer?.gallery?.length || galleryUploadQueue.length" class="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  <button
                    v-for="(img, idx) in (selectedCustomer?.gallery || [])"
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
                      {{ +(items as any[]).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0).toFixed(2) }}
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
                      <Input type="number" v-model="materialTotal" class="h-7 w-36 text-xs pl-5 tabular-nums" @input="recalculateTotals" />
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Labor</span>
                    <div class="relative flex items-center">
                      <span class="absolute left-2 text-[10px] text-muted-foreground">$</span>
                      <Input type="number" v-model="laborTotal" class="h-7 w-36 text-xs pl-5 tabular-nums" @input="recalculateTotals" />
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
        <div />
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" @click="showCreateModal = false">
            Cancel
          </Button>
          <template v-if="createStep === 4">
            <Button
              variant="outline"
              size="sm"
              :disabled="savingEstimate || isUploadingPdf"
              @click="downloadPDFDirect"
            >
              <Icon name="i-lucide-download" class="mr-1.5 size-3.5" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="savingEstimate || isUploadingPdf"
              @click="sendEmailDirect"
            >
              <Icon name="i-lucide-send" class="mr-1.5 size-3.5" />
              Send
            </Button>
          </template>
          <Button
            v-if="createStep === 4"
            size="sm"
            class="shadow-lg shadow-primary/20"
            :disabled="savingEstimate || isUploadingPdf"
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
