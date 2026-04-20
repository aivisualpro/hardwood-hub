<script setup lang="ts">
import { toast } from 'vue-sonner'

// ─── PDF Upload State ──────────────────────────────────────
const showPdfUpload = ref(false)
const pdfFile = ref<File | null>(null)
const pdfParsing = ref(false)
const pdfParseProgress = ref(0)
const pdfParsed = ref<{
  html: string
  variables: any[]
  templateName: string
  description: string
  category: string
} | null>(null)
const pdfDragOver = ref(false)
const pdfPreviewStep = ref<'upload' | 'preview'>('upload')
const pdfInputRef = ref<HTMLInputElement | null>(null)

function openPdfUpload() {
  showPdfUpload.value = true
  pdfFile.value = null
  pdfParsed.value = null
  pdfParsing.value = false
  pdfParseProgress.value = 0
  pdfPreviewStep.value = 'upload'
}

function handlePdfDrop(e: DragEvent) {
  pdfDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type === 'application/pdf') {
    pdfFile.value = file
  } else {
    toast.error('Please drop a valid PDF file')
  }
}

function handlePdfSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    pdfFile.value = file
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data:application/pdf;base64, prefix
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function parsePdf() {
  if (!pdfFile.value) return
  pdfParsing.value = true
  pdfParseProgress.value = 10

  // Simulate progress while waiting for AI
  const progressInterval = setInterval(() => {
    pdfParseProgress.value = Math.min(pdfParseProgress.value + Math.random() * 15, 90)
  }, 800)

  try {
    const base64 = await fileToBase64(pdfFile.value)
    pdfParseProgress.value = 30

    const res = await $fetch<{ success: boolean, data: any }>('/api/contracts/templates/parse-pdf', {
      method: 'POST',
      body: {
        pdfBase64: base64,
        fileName: pdfFile.value.name,
      },
    })

    clearInterval(progressInterval)
    pdfParseProgress.value = 100

    if (res.success && res.data) {
      pdfParsed.value = res.data
      pdfPreviewStep.value = 'preview'
      toast.success('PDF analyzed successfully', { description: `Found ${res.data.variables?.length || 0} variables` })
    }
  } catch (e: any) {
    clearInterval(progressInterval)
    toast.error('Failed to parse PDF', { description: e?.data?.message || e?.message })
  } finally {
    pdfParsing.value = false
  }
}

function acceptPdfTemplate() {
  if (!pdfParsed.value) return
  selectedTemplate.value = null
  const mappedVars = pdfParsed.value.variables.map((v: any) => ({
    key: v.key,
    label: v.label,
    type: v.type || 'text',
    defaultValue: v.defaultValue || '',
    required: v.required || false,
    scope: v.scope || 'template',
  }))
  
  templateForm.value = {
    name: pdfParsed.value.templateName,
    description: pdfParsed.value.description,
    content: pdfParsed.value.html,
    category: pdfParsed.value.category || 'General',
    variables: [
      { key: 'contract_number', label: 'Contract Number', type: 'text', defaultValue: '', required: true, scope: 'template' },
      ...mappedVars.filter((v: any) => v.key !== 'contract_number')
    ],
  }
  showPdfUpload.value = false
  showEditor.value = true
  toast.success('Template loaded into editor — review and save when ready')
}

function removePdfVariable(idx: number) {
  if (pdfParsed.value) {
    pdfParsed.value.variables.splice(idx, 1)
  }
}

const { setHeader } = usePageHeader()

// Initial header state
setHeader({
  title: 'Contracts',
  icon: 'i-lucide-file-signature',
  description: 'Manage legal contracts and templates',
})



const route = useRoute()
const activeTab = computed(() => {
  const slug = route.params.tab as string | undefined
  return slug || 'list'
})

if (!route.params.tab) {
  navigateTo('/crm/contracts/list', { replace: true })
}

const tabs = [
  { id: 'list', label: 'List', icon: 'i-lucide-list' },
  { id: 'templates', label: 'Templates', icon: 'i-lucide-layout-template' },
]

// ─── Types ───────────────────────────────────────────────
interface TemplateVariable {
  key: string
  label: string
  type: string
  defaultValue: string
  options?: string[]
  required: boolean
  scope?: 'template' | 'client'
}

interface ContractTemplate {
  _id: string
  name: string
  slug: string
  description: string
  content: string
  variables: TemplateVariable[]
  category: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface CrmCustomer {
  _id: string
  name: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  type: string
}

interface ContractRecord {
  _id: string
  contractNumber: string
  title: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  templateId: string
  templateName: string
  variableValues: Record<string, string>
  content: string
  customerSignature?: string
  customerSignatureDate?: string
  sentAt?: string
  status: string
  createdAt: string
  updatedAt: string
}

// ─── Templates State ─────────────────────────────────────
const templates = ref<ContractTemplate[]>([])
const loadingTemplates = ref(true)
const selectedTemplate = ref<ContractTemplate | null>(null)
const showEditor = ref(false)

watch(() => showEditor.value, (isEditing) => {
  if (isEditing) {
    setHeader({
      title: 'Editing Template',
      icon: 'i-lucide-pen-tool',
      description: 'Customize contract layout and variables'
    })
  } else {
    setHeader({
      title: 'Contracts',
      icon: 'i-lucide-file-signature',
      description: 'Manage legal contracts and templates',
    })
  }
})
const saving = ref(false)
const seeding = ref(false)

const systemVariables = [
  { key: 'printDate', label: 'Print Date' },
  { key: 'company_name', label: 'Company Name' },
  { key: 'company_address', label: 'Street Address' },
  { key: 'company_city', label: 'City' },
  { key: 'company_state', label: 'State' },
  { key: 'company_zip', label: 'Zip' },
  { key: 'company_phone1', label: 'Primary Phone' },
  { key: 'company_phone2', label: 'Secondary Phone' },
  { key: 'company_website', label: 'Website' },
  { key: 'company_email', label: 'Email' },
  { key: 'company_license', label: "Builder's License Number" },
]

const templatePages = ref(1)

const templateForm = ref({
  name: '',
  description: '',
  content: '',
  category: 'General',
  variables: [] as TemplateVariable[],
})

async function fetchTemplates() {
  loadingTemplates.value = true
  try {
    const res = await $fetch<{ success: boolean, data: ContractTemplate[] }>('/api/contracts/templates')
    templates.value = res.data || []
  } catch (e: any) {
    toast.error('Failed to load templates', { description: e?.message })
  } finally {
    loadingTemplates.value = false
  }
}

async function seedChangeOrder() {
  seeding.value = true
  try {
    await $fetch('/api/contracts/templates/seed', { method: 'POST' })
    toast.success('Change Order template created')
    await fetchTemplates()
  } catch (e: any) {
    toast.error('Seed failed', { description: e?.message })
  } finally {
    seeding.value = false
  }
}

function openTemplateEditor(template: ContractTemplate) {
  selectedTemplate.value = template
  templateForm.value = {
    name: template.name,
    description: template.description,
    content: template.content,
    category: template.category,
    variables: [
      { key: 'contract_number', label: 'Contract Number', type: 'text', defaultValue: '', required: true, scope: 'template' },
      ...template.variables.filter(v => v.key !== 'contract_number')
    ],
  }
  showEditor.value = true
}

function openNewTemplate() {
  selectedTemplate.value = null
  templateForm.value = {
    name: '',
    description: '',
    content: '<p>Start writing your contract template...</p>',
    category: 'General',
    variables: [
      { key: 'contract_number', label: 'Contract Number', type: 'text', defaultValue: '', required: true, scope: 'template' }
    ],
  }
  showEditor.value = true
}

async function saveTemplate() {
  if (!templateForm.value.name) {
    toast.error('Template name is required')
    return
  }

  // Validate variables
  const invalidVars = templateForm.value.variables.filter(v => !v.key.trim())
  if (invalidVars.length > 0) {
    toast.error('All variables must have a key')
    return
  }

  // Auto-fill missing labels using the key
  templateForm.value.variables.forEach(v => {
    if (!v.label?.trim()) {
      v.label = v.key.trim()
    }
  })

  saving.value = true
  try {
    if (selectedTemplate.value) {
      await $fetch(`/api/contracts/templates/${selectedTemplate.value._id}`, {
        method: 'PUT',
        body: templateForm.value,
      })
      toast.success('Template updated')
    } else {
      await $fetch('/api/contracts/templates', {
        method: 'POST',
        body: templateForm.value,
      })
      toast.success('Template created')
    }
    showEditor.value = false
    await fetchTemplates()
  } catch (e: any) {
    toast.error('Save failed', { description: e?.message })
  } finally {
    saving.value = false
  }
}

async function deleteTemplate(id: string) {
  try {
    await $fetch(`/api/contracts/templates/${id}`, { method: 'DELETE' })
    toast.success('Template deleted')
    await fetchTemplates()
  } catch (e: any) {
    toast.error('Delete failed', { description: e?.message })
  }
}

function addVariable(scope: 'template' | 'client' = 'template') {
  templateForm.value.variables.push({ key: '', label: '', type: 'text', defaultValue: '', required: false, scope })
}

function removeVariable(idx: number) {
  templateForm.value.variables.splice(idx, 1)
}

function moveVariable(idx: number, direction: 'up' | 'down') {
  const vars = templateForm.value.variables
  const currentVar = vars[idx]
  if (!currentVar) return

  const targetScope = currentVar.scope || 'template'
  
  if (direction === 'up') {
    for (let i = idx - 1; i >= 0; i--) {
      const swapVar = vars[i]
      if (!swapVar) continue
      const scope = swapVar.scope || 'template'
      if (scope === targetScope) {
        vars[idx] = swapVar
        vars[i] = currentVar
        break
      }
    }
  } else {
    for (let i = idx + 1; i < vars.length; i++) {
      const swapVar = vars[i]
      if (!swapVar) continue
      const scope = swapVar.scope || 'template'
      if (scope === targetScope) {
        vars[idx] = swapVar
        vars[i] = currentVar
        break
      }
    }
  }
}

function insertVariable(key: string) {
  window.dispatchEvent(new CustomEvent('insert-variable', { detail: { key } }))
}

// ─── Contracts List State ────────────────────────────────
const contracts = ref<ContractRecord[]>([])
const loadingContracts = ref(true)
const searchQuery = ref('')

async function fetchContracts() {
  loadingContracts.value = true
  try {
    const res = await $fetch<{ success: boolean, data: ContractRecord[] }>('/api/contracts', {
      params: searchQuery.value ? { search: searchQuery.value } : {},
    })
    contracts.value = res.data || []
  } catch (e: any) {
    toast.error('Failed to load contracts', { description: e?.message })
  } finally {
    loadingContracts.value = false
  }
}

// ─── Create/Edit Contract Modal ───────────────────────────────
const contractFormDialog = ref<any>(null)

function openCreateModal() {
  contractFormDialog.value?.openCreateModal()
}

function openEditContract(ct: any) {
  contractFormDialog.value?.openEditContract(ct)
}

// ─── Company Profile ─────────────────────────────────────
const companyProfile = ref<any>({})

async function fetchCompanyProfile() {
  try {
    const res = await $fetch<{ success: boolean, data: Record<string, any> }>('/api/app-settings')
    if (res.data?.companyProfile) companyProfile.value = res.data.companyProfile
  } catch { /* ignore */ }
}

onMounted(async () => {
  await Promise.all([fetchTemplates(), fetchCompanyProfile(), fetchContracts()])
})

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const CATEGORIES = ['General', 'Agreements', 'Change Orders', 'Legal', 'Warranties']

const TYPE_ICONS: Record<string, string> = {
  appointment: 'i-lucide-calendar-check',
  'fast-quote': 'i-lucide-zap',
  'flooring-estimate': 'i-lucide-ruler',
  subscriber: 'i-lucide-mail-check',
  'conditional-logic': 'i-lucide-split',
  other: 'i-lucide-user',
}

</script>

<template>
  <div class="space-y-0 -mt-4 lg:-mt-6">
    <!-- Header Teleport -->
    <ClientOnly>
      <Teleport defer to="#header-toolbar">
        <div v-if="!showEditor" class="flex items-center gap-2 sm:gap-3 w-full max-w-xl pr-2">
          <div class="relative flex-1">
            <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search contracts..."
              class="w-full h-8 sm:h-9 pl-8 sm:pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              @input="activeTab === 'list' && fetchContracts()"
            >
          </div>
          <button
            v-if="activeTab === 'list'"
            class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shrink-0 shadow-lg shadow-primary/20"
            @click="openCreateModal"
          >
            <Icon name="i-lucide-plus" class="size-3.5" />
            <span class="hidden sm:inline">New Contract</span>
          </button>
          <DropdownMenu v-if="activeTab === 'templates' && !showEditor">
            <DropdownMenuTrigger as-child>
              <button
                class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shrink-0 shadow-lg shadow-primary/20"
              >
                <Icon name="i-lucide-plus" class="size-3.5" />
                <span class="hidden sm:inline">New Template</span>
                <Icon name="i-lucide-chevron-down" class="size-3 ml-0.5 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-52">
              <DropdownMenuItem class="cursor-pointer gap-2.5 py-2.5" @click="openNewTemplate">
                <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-pen-tool" class="size-4 text-primary" />
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-semibold">Design Template</span>
                  <span class="text-[10px] text-muted-foreground">Build from scratch</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="cursor-pointer gap-2.5 py-2.5" @click="openPdfUpload">
                <div class="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Icon name="i-lucide-file-up" class="size-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-semibold">Upload PDF</span>
                  <span class="text-[10px] text-muted-foreground">AI-powered extraction</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <!-- ══ EDITOR MODE ACTIONS ══ -->
        <div v-else class="flex items-center gap-3">
          <button class="size-8 rounded-lg border bg-card hover:bg-muted flex items-center justify-center transition-colors shrink-0" @click="showEditor = false">
            <Icon name="i-lucide-arrow-left" class="size-4" />
          </button>
          <div class="h-4 w-px bg-border/50 mx-1" />
          <div class="flex items-center gap-2 bg-muted/30 rounded-lg p-1 border border-border/50">
             <input v-model="templateForm.name" type="text" placeholder="Template Name" class="text-sm font-bold bg-transparent border-none outline-none w-[180px] px-2 placeholder:text-muted-foreground/40 transition-colors focus:bg-background focus:ring-1 focus:ring-primary rounded">
             <div class="h-3 w-px bg-border/50 mx-1" />
             <Select v-model="templateForm.category">
               <SelectTrigger class="w-28 h-7 text-xs border-none bg-transparent shadow-none focus:ring-0"><SelectValue placeholder="Category" /></SelectTrigger>
               <SelectContent>
                 <SelectItem v-for="cat in CATEGORIES" :key="cat" :value="cat">{{ cat }}</SelectItem>
               </SelectContent>
             </Select>
          </div>
          <div class="h-4 w-px bg-border/50 mx-1" />
          <Button variant="ghost" size="sm" class="h-8" @click="showEditor = false">Cancel</Button>
          <Button size="sm" class="h-8 shadow-lg shadow-primary/20" :disabled="saving" @click="saveTemplate">
            <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-1.5 size-3.5 animate-spin" />
            <Icon v-else name="i-lucide-save" class="mr-1.5 size-3.5" />
            Save
          </Button>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- Tabs Container -->
    <div class="flex flex-col h-[calc(100dvh-90px)]">
      <!-- Tab bar: fixed, never scrolls -->
      <div class="shrink-0 bg-background/95 backdrop-blur-sm -mx-4 lg:-mx-6 px-4 lg:px-6 h-12 flex items-center border-b">
        <div class="flex items-center justify-start overflow-x-auto no-scrollbar w-full">
          <div class="flex items-center gap-0.5 min-w-max">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="relative flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap rounded-lg"
              :class="activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30' : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'"
              @click="navigateTo(`/crm/contracts/${tab.id}`); showEditor = false"
            >
              <Icon :name="tab.icon" class="size-3.5 sm:size-4" />
              {{ tab.label }}
              <div
                v-if="tab.id === 'list' && contracts.length > 0"
                class="ml-1 px-1.5 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold tabular-nums"
                :class="activeTab === tab.id ? 'bg-background/25 text-primary-foreground' : 'bg-primary/10 text-primary group-hover:bg-primary/20'"
              >
                {{ contracts.length }}
              </div>
              <div
                v-if="tab.id === 'templates' && templates.length > 0"
                class="ml-1 px-1.5 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold tabular-nums"
                :class="activeTab === tab.id ? 'bg-background/25 text-primary-foreground' : 'bg-primary/10 text-primary group-hover:bg-primary/20'"
              >
                {{ templates.length }}
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Tab content: fills remaining height, no overflow on body -->
      <div class="flex-1 overflow-hidden">  
        <!-- ═══════ LIST TAB ═══════ -->
        <div v-if="activeTab === 'list'" class="h-full overflow-y-auto">

          <CrmContractsTable 
            :contracts="contracts" 
            :templates="templates" 
            :companyProfile="companyProfile"
            :isLoading="loadingContracts"
            @refresh="fetchContracts"
            @edit="openEditContract"
          />
        </div>

        <!-- ═══════ TEMPLATES TAB ═══════ -->
        <template v-if="activeTab === 'templates'">
          <!-- ═══ EDITOR VIEW: fills remaining height ═══ -->
          <div v-if="showEditor" class="h-full">
            <!-- Two-column grid -->
            <div class="h-full overflow-hidden grid grid-cols-1 xl:grid-cols-[1fr_450px] gap-0 border border-border/50 rounded-xl bg-card shadow-sm">
              <!-- LEFT: Editor — scrolls inside -->
              <div class="overflow-hidden flex flex-col border-r border-border/50">
                <ClientOnly>
                  <ContractsEditor v-model="templateForm.content" @update:pages="templatePages = $event" />
                  <template #fallback>
                    <div class="h-full flex items-center justify-center">
                      <Icon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted-foreground" />
                    </div>
                  </template>
                </ClientOnly>
              </div>

              <!-- RIGHT: Variables — scrolls inside -->
              <div class="flex flex-col overflow-hidden">
                <div class="flex-1 overflow-y-auto">
                    <!-- Template Variables -->
                    <div class="px-4 py-2 border-b border-border/50 bg-card flex items-center justify-between sticky top-0 z-10">
                      <h3 class="text-xs font-bold flex items-center gap-1.5">
                        <Icon name="i-lucide-braces" class="size-3.5 text-amber-500" />
                        Template Variables
                      </h3>
                      <button class="size-7 rounded-md bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors" @click="addVariable('template')">
                        <Icon name="i-lucide-plus" class="size-3.5" />
                      </button>
                    </div>
                    <div class="divide-y divide-border/30">
                      <div v-for="(v, idx) in templateForm.variables" :key="idx">
                        <div v-if="!v.scope || v.scope === 'template'" class="p-2.5 hover:bg-muted/20 transition-colors group flex items-center gap-2">
                          <button class="size-6 rounded flex items-center justify-center text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors shrink-0" @click="insertVariable(v.key)" title="Insert into document">
                            <Icon name="i-lucide-arrow-left-to-line" class="size-3.5" />
                          </button>
                          <input v-model="v.key" :readonly="v.key === 'contract_number'" placeholder="variable_key" class="flex-1 min-w-0 text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1.5 outline-none" :class="{ 'opacity-80 cursor-default': v.key === 'contract_number' }">
                          <select v-model="v.type" class="text-[10px] border rounded px-1.5 py-1.5 bg-background text-foreground outline-none shrink-0 w-[68px]">
                            <option value="text">Text</option>
                            <option value="date">Date</option>
                            <option value="number">Number</option>
                            <option value="currency">Currency</option>
                            <option value="textarea">Multi</option>
                          </select>
                          <div class="flex items-center gap-1 shrink-0 px-1" title="Required">
                            <input type="checkbox" :id="'req-'+idx" v-model="v.required" :disabled="v.key === 'contract_number'" class="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer disabled:opacity-50">
                            <label :for="'req-'+idx" class="text-[10px] text-muted-foreground cursor-pointer font-medium select-none">Req</label>
                          </div>
                          <div class="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" :class="{ 'invisible pointer-events-none': v.key === 'contract_number' }">
                            <button class="size-3.5 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors rounded hover:text-foreground" @click="moveVariable(idx, 'up')" title="Move Up">
                              <Icon name="i-lucide-chevron-up" class="size-3" />
                            </button>
                            <button class="size-3.5 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors rounded hover:text-foreground" @click="moveVariable(idx, 'down')" title="Move Down">
                              <Icon name="i-lucide-chevron-down" class="size-3" />
                            </button>
                          </div>
                          <button class="size-6 rounded flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0" @click="removeVariable(idx)" :class="{ 'invisible pointer-events-none': v.key === 'contract_number' }">
                            <Icon name="i-lucide-x" class="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <div v-if="!templateForm.variables.some(v => !v.scope || v.scope === 'template')" class="p-4 text-center">
                        <p class="text-xs text-muted-foreground">Filled by you during creation</p>
                      </div>
                    </div>

                    <!-- Client Variables -->
                    <div class="px-4 py-2 border-y border-border/50 bg-card flex items-center justify-between sticky top-0 z-10">
                      <h3 class="text-xs font-bold flex items-center gap-1.5">
                        <Icon name="i-lucide-user" class="size-3.5 text-blue-500" />
                        Client Variables
                      </h3>
                      <button class="size-7 rounded-md bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center text-blue-600 transition-colors" @click="addVariable('client')">
                        <Icon name="i-lucide-plus" class="size-3.5" />
                      </button>
                    </div>
                    <div class="divide-y divide-border/30">
                      <div v-for="(v, idx) in templateForm.variables" :key="idx">
                        <div v-if="v.scope === 'client'" class="p-2.5 hover:bg-muted/20 transition-colors group flex items-center gap-2">
                          <button class="size-6 rounded flex items-center justify-center text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors shrink-0" @click="insertVariable(v.key)" title="Insert into document">
                            <Icon name="i-lucide-arrow-left-to-line" class="size-3.5" />
                          </button>
                          <input v-model="v.key" placeholder="variable_key" class="flex-1 min-w-0 text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-500/5 border border-blue-500/20 rounded px-2 py-1.5 outline-none">
                          <select v-model="v.type" class="text-[10px] border rounded px-1.5 py-1.5 bg-background text-foreground outline-none shrink-0 w-[68px]">
                            <option value="text">Text</option>
                            <option value="date">Date</option>
                            <option value="number">Number</option>
                            <option value="currency">Currency</option>
                            <option value="textarea">Multi</option>
                            <option value="signature">Sign</option>
                          </select>
                          <div class="flex items-center gap-1 shrink-0 px-1" title="Required">
                            <input type="checkbox" :id="'req-'+idx" v-model="v.required" class="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer">
                            <label :for="'req-'+idx" class="text-[10px] text-muted-foreground cursor-pointer font-medium select-none">Req</label>
                          </div>
                          <div class="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button class="size-3.5 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors rounded hover:text-foreground" @click="moveVariable(idx, 'up')" title="Move Up">
                              <Icon name="i-lucide-chevron-up" class="size-3" />
                            </button>
                            <button class="size-3.5 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors rounded hover:text-foreground" @click="moveVariable(idx, 'down')" title="Move Down">
                              <Icon name="i-lucide-chevron-down" class="size-3" />
                            </button>
                          </div>
                          <button class="size-6 rounded flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0" @click="removeVariable(idx)">
                            <Icon name="i-lucide-x" class="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <div v-if="!templateForm.variables.some(v => v.scope === 'client')" class="p-4 text-center">
                        <p class="text-xs text-muted-foreground">Filled by the client when signing</p>
                      </div>
                    </div>

                    <!-- System Variables -->
                    <div class="bg-muted/10 border-t border-border/50 p-3 flex flex-col gap-2">
                      <div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">System Variables</div>
                      
                      <div
                        v-for="sv in systemVariables"
                        :key="sv.key"
                        class="flex items-center gap-2 group px-2.5 py-1.5 hover:bg-muted/20 transition-colors"
                      >
                        <button class="size-6 rounded flex items-center justify-center text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors shrink-0" title="Insert into document" @click="insertVariable(sv.key)">
                          <Icon name="i-lucide-arrow-left-to-line" class="size-3.5" />
                        </button>
                        <input :value="sv.key" readonly class="flex-1 min-w-0 text-[10px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/5 border border-cyan-500/20 rounded px-2 py-1.5 outline-none cursor-default" />
                        
                        <!-- Invisible placeholders to mathematically match Client Variables width -->
                        <select class="invisible pointer-events-none text-[10px] border rounded px-1.5 py-1.5 shrink-0 w-[68px]">
                          <option>Text</option>
                        </select>
                        <div class="invisible pointer-events-none flex items-center gap-1 shrink-0 px-1">
                          <div class="size-3.5 border rounded"></div>
                          <label class="text-[10px] font-medium select-none">Req</label>
                        </div>
                        <div class="invisible pointer-events-none shrink-0 size-3.5"></div>
                        <div class="invisible pointer-events-none shrink-0 size-6"></div>
                      </div>

                      <div class="mt-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                        <p class="text-[9px] text-emerald-600 dark:text-emerald-400 leading-relaxed">
                          <Icon name="i-lucide-info" class="size-3 inline-block mr-1 -mt-0.5" />
                          Signature block is automatically appended to every PDF with contractor &amp; client signatures.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          </div>

          <div v-else class="h-full overflow-y-auto">
            <div v-if="loadingTemplates" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="i in 3" :key="i" class="h-48 bg-muted/40 rounded-xl animate-pulse" />
            </div>

            <div v-else-if="templates.length === 0" class="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/60 rounded-2xl bg-muted/5">
              <div class="size-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center mb-4 border border-amber-500/20">
                <Icon name="i-lucide-layout-template" class="size-8 text-amber-500" />
              </div>
              <h3 class="text-xl font-bold mb-1">No Templates Yet</h3>
              <p class="text-muted-foreground max-w-sm px-4 text-sm mb-4">Create your first contract template or seed the default Change Order template.</p>
              <div class="flex items-center gap-3">
                <Button variant="outline" size="sm" :disabled="seeding" @click="seedChangeOrder">
                  <Icon v-if="seeding" name="i-lucide-loader-circle" class="mr-1.5 size-3.5 animate-spin" />
                  <Icon v-else name="i-lucide-download" class="mr-1.5 size-3.5" />
                  Seed Change Order
                </Button>
                <Button size="sm" class="shadow-lg shadow-primary/20" @click="openNewTemplate">
                  <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
                  Create Template
                </Button>
              </div>
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="tmpl in templates"
                :key="tmpl._id"
                class="group rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all duration-300 cursor-pointer overflow-hidden hover:shadow-lg hover:shadow-primary/5"
                @click="openTemplateEditor(tmpl)"
              >
                <div class="h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
                <div class="p-5">
                  <div class="flex items-start justify-between mb-3">
                    <div class="size-10 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
                      <Icon name="i-lucide-file-signature" class="size-5 text-primary" />
                    </div>
                    <div class="flex items-center gap-1">
                      <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-muted text-muted-foreground">{{ tmpl.category }}</span>
                      <button class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100" @click.stop="deleteTemplate(tmpl._id)">
                        <Icon name="i-lucide-trash-2" class="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <h3 class="font-bold text-sm mb-1 group-hover:text-primary transition-colors">{{ tmpl.name }}</h3>
                  <p v-if="tmpl.description" class="text-xs text-muted-foreground line-clamp-2 mb-3">{{ tmpl.description }}</p>
                  <div class="flex items-center justify-between pt-3 border-t border-border/40">
                    <span class="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Icon name="i-lucide-clock" class="size-3" />
                      {{ formatDate(tmpl.updatedAt) }}
                    </span>
                    <span class="text-[10px] text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Edit <Icon name="i-lucide-arrow-right" class="size-3" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
        <!-- ═══════════════════════════════════════════════════════ -->
    <!-- ═══════ CREATE CONTRACT MODAL ═══════ -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <CrmContractFormDialog ref="contractFormDialog" @saved="fetchContracts" />

    <CrmContractFormDialog ref="contractFormDialog" @saved="fetchContracts" />

    <!-- ═══════ PDF UPLOAD DIALOG ═══════ -->
    <Dialog :open="showPdfUpload" @update:open="showPdfUpload = $event">
      <DialogContent class="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <!-- Header -->
        <div class="shrink-0 px-6 pt-6 pb-4 border-b">
          <div class="flex items-center gap-3">
            <div class="size-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center border border-amber-500/20">
              <Icon name="i-lucide-sparkles" class="size-5 text-amber-500" />
            </div>
            <div>
              <h2 class="text-lg font-bold">Upload PDF Template</h2>
              <p class="text-xs text-muted-foreground">AI-powered content extraction with Gemini</p>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto">
          <!-- ══ STEP 1: Upload ══ -->
          <div v-if="pdfPreviewStep === 'upload'" class="p-6 space-y-5">
            <!-- Drop Zone -->
            <div
              class="relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer group"
              :class="pdfDragOver
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : pdfFile
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-border/60 hover:border-primary/40 hover:bg-muted/30'"
              @drop.prevent="handlePdfDrop"
              @dragover.prevent="pdfDragOver = true"
              @dragleave="pdfDragOver = false"
              @click="pdfInputRef?.click()"
            >
              <input ref="pdfInputRef" type="file" accept=".pdf" class="hidden" @change="handlePdfSelect">

              <div v-if="!pdfFile" class="flex flex-col items-center gap-3">
                <div class="size-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon name="i-lucide-cloud-upload" class="size-8 text-primary/70" />
                </div>
                <div>
                  <p class="text-sm font-bold">Drop your PDF here</p>
                  <p class="text-xs text-muted-foreground mt-1">or click to browse • PDF files only</p>
                </div>
              </div>

              <div v-else class="flex items-center gap-4 justify-center">
                <div class="size-14 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Icon name="i-lucide-file-text" class="size-7 text-red-500" />
                </div>
                <div class="text-left">
                  <p class="text-sm font-bold truncate max-w-[300px]">{{ pdfFile.name }}</p>
                  <p class="text-xs text-muted-foreground">{{ (pdfFile.size / 1024).toFixed(1) }} KB</p>
                </div>
                <button
                  class="size-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                  @click.stop="pdfFile = null"
                >
                  <Icon name="i-lucide-x" class="size-4" />
                </button>
              </div>
            </div>

            <!-- Parsing Progress -->
            <div v-if="pdfParsing" class="space-y-3">
              <div class="flex items-center gap-3">
                <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="i-lucide-brain" class="size-4 text-primary animate-pulse" />
                </div>
                <div class="flex-1">
                  <p class="text-sm font-semibold">Analyzing PDF with AI...</p>
                  <p class="text-[10px] text-muted-foreground">Extracting content, layout, and identifying variables</p>
                </div>
              </div>
              <div class="w-full bg-muted/40 rounded-full h-2 overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500 ease-out"
                  :style="{ width: pdfParseProgress + '%' }"
                />
              </div>
              <div class="flex items-center justify-center gap-6 text-[10px] text-muted-foreground">
                <span class="flex items-center gap-1"><Icon name="i-lucide-scan-text" class="size-3" /> Reading content</span>
                <span class="flex items-center gap-1"><Icon name="i-lucide-braces" class="size-3" /> Detecting variables</span>
                <span class="flex items-center gap-1"><Icon name="i-lucide-wand-2" class="size-3" /> Building template</span>
              </div>
            </div>

            <!-- AI Info Box -->
            <div class="rounded-xl bg-gradient-to-br from-violet-500/5 to-indigo-500/5 border border-violet-500/15 p-4">
              <div class="flex items-start gap-3">
                <Icon name="i-lucide-info" class="size-4 text-violet-500 shrink-0 mt-0.5" />
                <div class="text-xs text-muted-foreground space-y-1">
                  <p class="font-semibold text-foreground">How it works</p>
                  <p>Google Gemini AI will analyze your PDF and extract:</p>
                  <ul class="list-disc pl-4 space-y-0.5">
                    <li>Full document content with formatting preserved</li>
                    <li>Headings, tables, lists, and layout structure</li>
                    <li>Fillable fields converted to template variables</li>
                    <li>Automatic variable type detection (text, date, currency, etc.)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- ══ STEP 2: Preview ══ -->
          <div v-if="pdfPreviewStep === 'preview' && pdfParsed" class="divide-y">
            <!-- Template Info -->
            <div class="p-5 space-y-3">
              <div class="flex items-center gap-2">
                <Icon name="i-lucide-check-circle" class="size-4 text-emerald-500" />
                <span class="text-sm font-bold text-emerald-600 dark:text-emerald-400">PDF analyzed successfully</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Template Name</label>
                  <input
                    v-model="pdfParsed.templateName"
                    class="w-full mt-1 h-8 px-3 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                </div>
                <div>
                  <label class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Category</label>
                  <select
                    v-model="pdfParsed.category"
                    class="w-full mt-1 h-8 px-2 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    <option v-for="cat in CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Description</label>
                <input
                  v-model="pdfParsed.description"
                  class="w-full mt-1 h-8 px-3 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                >
              </div>
            </div>

            <!-- Detected Variables -->
            <div class="p-5 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Icon name="i-lucide-braces" class="size-4 text-amber-500" />
                  <span class="text-sm font-bold">Detected Variables</span>
                  <span class="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">{{ pdfParsed.variables.length }}</span>
                </div>
              </div>

              <div v-if="pdfParsed.variables.length === 0" class="text-center py-4">
                <p class="text-xs text-muted-foreground">No variables detected in this PDF</p>
              </div>

              <div v-else class="space-y-1.5 max-h-48 overflow-y-auto">
                <div
                  v-for="(v, idx) in pdfParsed.variables"
                  :key="idx"
                  class="flex items-center gap-2 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors group"
                >
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0"
                    :class="v.scope === 'client'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'"
                  >{{ v.key }}</span>
                  <span class="text-xs text-muted-foreground truncate flex-1">{{ v.label }}</span>
                  <span class="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">{{ v.type }}</span>
                  <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                    :class="v.scope === 'client' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'"
                  >{{ v.scope }}</span>
                  <button
                    class="size-6 rounded flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    @click="removePdfVariable(idx)"
                  >
                    <Icon name="i-lucide-x" class="size-3" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Content Preview -->
            <div class="p-5 space-y-3">
              <div class="flex items-center gap-2">
                <Icon name="i-lucide-eye" class="size-4 text-primary" />
                <span class="text-sm font-bold">Content Preview</span>
              </div>
              <div
                class="border rounded-xl p-4 max-h-64 overflow-y-auto text-xs bg-background/50 prose prose-sm dark:prose-invert max-w-none"
                v-html="pdfParsed.html"
              />
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="shrink-0 px-6 py-4 border-t bg-muted/10 flex items-center justify-between">
          <div>
            <button
              v-if="pdfPreviewStep === 'preview'"
              class="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              @click="pdfPreviewStep = 'upload'; pdfParsed = null; pdfFile = null"
            >
              <Icon name="i-lucide-arrow-left" class="size-3" />
              Upload different PDF
            </button>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="ghost" size="sm" @click="showPdfUpload = false">Cancel</Button>
            <Button
              v-if="pdfPreviewStep === 'upload'"
              size="sm"
              class="shadow-lg shadow-primary/20"
              :disabled="!pdfFile || pdfParsing"
              @click="parsePdf"
            >
              <Icon v-if="pdfParsing" name="i-lucide-loader-circle" class="mr-1.5 size-3.5 animate-spin" />
              <Icon v-else name="i-lucide-sparkles" class="mr-1.5 size-3.5" />
              {{ pdfParsing ? 'Analyzing...' : 'Analyze with AI' }}
            </Button>
            <Button
              v-if="pdfPreviewStep === 'preview'"
              size="sm"
              class="shadow-lg shadow-primary/20"
              @click="acceptPdfTemplate"
            >
              <Icon name="i-lucide-check" class="mr-1.5 size-3.5" />
              Open in Editor
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
