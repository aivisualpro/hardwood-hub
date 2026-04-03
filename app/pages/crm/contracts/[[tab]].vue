<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
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

// Redirect /crm/contracts → /crm/contracts/list
if (!route.params.tab) {
  navigateTo('/crm/contracts/list', { replace: true })
}

const tabs = [
  { id: 'list', label: 'List', icon: 'i-lucide-list' },
  { id: 'templates', label: 'Templates', icon: 'i-lucide-layout-template' },
]

// ─── Templates State ─────────────────────────────────────
interface TemplateVariable {
  key: string
  label: string
  type: string
  defaultValue: string
  options?: string[]
  required: boolean
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

const templates = ref<ContractTemplate[]>([])
const loadingTemplates = ref(true)
const selectedTemplate = ref<ContractTemplate | null>(null)
const showEditor = ref(false)
const saving = ref(false)
const seeding = ref(false)

// Template form
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
    variables: [...template.variables],
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
    variables: [],
  }
  showEditor.value = true
}

async function saveTemplate() {
  if (!templateForm.value.name) {
    toast.error('Template name is required')
    return
  }
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

// Variable management
function addVariable() {
  templateForm.value.variables.push({
    key: '',
    label: '',
    type: 'text',
    defaultValue: '',
    required: false,
  })
}

function removeVariable(idx: number) {
  templateForm.value.variables.splice(idx, 1)
}

function insertVariable(key: string) {
  // This will be accessible from the editor component
  const event = new CustomEvent('insert-variable', { detail: { key } })
  window.dispatchEvent(event)
}

// Company profile for letterhead preview
const companyProfile = ref<any>({})
async function fetchCompanyProfile() {
  try {
    const res = await $fetch<{ success: boolean, data: Record<string, any> }>('/api/app-settings')
    if (res.data?.companyProfile) {
      companyProfile.value = res.data.companyProfile
    }
  } catch { /* ignore */ }
}

onMounted(async () => {
  await Promise.all([fetchTemplates(), fetchCompanyProfile()])
})

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const CATEGORIES = ['General', 'Agreements', 'Change Orders', 'Legal', 'Warranties']
</script>

<template>
  <div class="space-y-0">
    <!-- Header Teleport -->
    <Teleport to="#header-toolbar">
      <div class="flex items-center gap-2 sm:gap-3 w-full max-w-xl pr-2">
        <div class="relative flex-1">
          <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contracts..."
            class="w-full h-8 sm:h-9 pl-8 sm:pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          >
        </div>
        <button
          v-if="activeTab === 'templates' && !showEditor"
          class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shrink-0 shadow-lg shadow-primary/20"
          @click="openNewTemplate"
        >
          <Icon name="i-lucide-plus" class="size-3.5" />
          <span class="hidden sm:inline">New Template</span>
        </button>
      </div>
    </Teleport>

    <!-- Tabs Container -->
    <div class="flex flex-col gap-0">
      <div class="sticky top-0 z-30 bg-background/95 backdrop-blur-sm -mx-4 lg:-mx-6 px-4 lg:px-6 border-b">
        <div class="flex items-center justify-between pb-1 overflow-x-auto no-scrollbar">
          <div class="flex items-center gap-0.5 min-w-max">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="relative flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold transition-all whitespace-nowrap"
              :class="activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
              @click="navigateTo(`/crm/contracts/${tab.id}`); showEditor = false"
            >
              <Icon :name="tab.icon" class="size-3.5 sm:size-4" />
              {{ tab.label }}
              <span
                v-if="tab.id === 'templates' && templates.length > 0"
                class="ml-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold tabular-nums"
                :class="activeTab === tab.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'"
              >
                {{ templates.length }}
              </span>
              <!-- Active Indicator -->
              <div
                v-if="activeTab === tab.id"
                class="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_0_8px_rgba(var(--primary),0.3)]"
              />
            </button>
          </div>
        </div>
      </div>

      <!-- Tab Content Area -->
      <div class="pt-4">
        <!-- ═══════ LIST TAB ═══════ -->
        <div v-if="activeTab === 'list'" class="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/60 rounded-2xl bg-muted/5">
          <div class="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 transition-transform hover:scale-110">
            <Icon name="i-lucide-list" class="size-8 text-primary" />
          </div>
          <h3 class="text-xl font-bold mb-1">Contract List</h3>
          <p class="text-muted-foreground max-w-sm px-4">
            No contracts found. Start by creating a new contract or using a template.
          </p>
        </div>

        <!-- ═══════ TEMPLATES TAB ═══════ -->
        <template v-if="activeTab === 'templates'">
          <!-- Full-screen Template Editor -->
          <div v-if="showEditor" class="space-y-4">
            <!-- Editor Header Bar -->
            <div class="flex items-center justify-between gap-4 pb-4 border-b border-border/50">
              <div class="flex items-center gap-3 min-w-0">
                <button
                  class="size-9 rounded-lg border bg-card hover:bg-muted flex items-center justify-center transition-colors shrink-0"
                  @click="showEditor = false"
                >
                  <Icon name="i-lucide-arrow-left" class="size-4" />
                </button>
                <div class="min-w-0">
                  <input
                    v-model="templateForm.name"
                    type="text"
                    placeholder="Template Name"
                    class="text-lg font-bold bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/40"
                  >
                  <input
                    v-model="templateForm.description"
                    type="text"
                    placeholder="Add a description..."
                    class="text-xs text-muted-foreground bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/30 mt-0.5"
                  >
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <Select v-model="templateForm.category">
                  <SelectTrigger class="w-36 h-8 text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="cat in CATEGORIES" :key="cat" :value="cat">{{ cat }}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" class="h-8" @click="showEditor = false">Cancel</Button>
                <Button size="sm" class="h-8 shadow-lg shadow-primary/20" :disabled="saving" @click="saveTemplate">
                  <Icon v-if="saving" name="i-lucide-loader-circle" class="mr-1.5 size-3.5 animate-spin" />
                  <Icon v-else name="i-lucide-save" class="mr-1.5 size-3.5" />
                  Save
                </Button>
              </div>
            </div>

            <!-- Two-column Editor Layout -->
            <div class="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
              <!-- Left: Editor Canvas -->
              <div class="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
                <!-- Company Letterhead Preview -->
                <div class="border-b border-border/40 bg-white dark:bg-zinc-900 px-8 py-6">
                  <div class="flex items-start justify-between gap-4">
                    <div v-if="companyProfile.logo" class="size-20 shrink-0">
                      <img :src="companyProfile.logo" alt="Logo" class="size-full object-contain" />
                    </div>
                    <div v-else class="size-20 shrink-0 rounded-lg bg-muted/30 border flex items-center justify-center">
                      <Icon name="i-lucide-building-2" class="size-8 text-muted-foreground/30" />
                    </div>
                    <div class="text-right">
                      <p class="text-sm font-bold text-emerald-700 dark:text-emerald-400">{{ companyProfile.name || 'Company Name' }}</p>
                      <p class="text-xs font-semibold text-foreground/80">{{ companyProfile.address || '2232 South Main Street' }}</p>
                      <p class="text-xs font-semibold text-foreground/80">{{ companyProfile.city || 'Ann Arbor' }}, {{ companyProfile.state || 'MI' }}. {{ companyProfile.zip || '48104' }}</p>
                      <p class="text-xs font-bold text-foreground/80">{{ companyProfile.phone1 || '(734) 604-3786' }}</p>
                      <p v-if="companyProfile.phone2" class="text-xs font-bold text-foreground/80">{{ companyProfile.phone2 }}</p>
                      <p class="text-xs font-bold text-foreground/80">{{ companyProfile.website || 'www.annarborhardwoods.com' }}</p>
                      <p class="text-xs font-bold text-foreground/80">{{ companyProfile.email || 'quote@annarborhardwoods.com' }}</p>
                      <p class="text-xs font-bold text-foreground/80">Builder's License Number: {{ companyProfile.licenseNumber || '242600350' }}</p>
                    </div>
                  </div>
                  <!-- Title bar -->
                  <div class="mt-5 mb-1">
                    <h2 class="text-lg font-black text-foreground/90">{{ templateForm.name || 'Change Order Agreement' }} <span class="text-muted-foreground/50">Change Order #</span></h2>
                    <div class="h-[3px] bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 rounded-full mt-2" />
                  </div>
                </div>

                <!-- TipTap Editor Component -->
                <ClientOnly>
                  <ContractsEditor v-model="templateForm.content" />
                  <template #fallback>
                    <div class="h-96 flex items-center justify-center">
                      <Icon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted-foreground" />
                    </div>
                  </template>
                </ClientOnly>
              </div>

              <!-- Right: Variable Panel -->
              <div class="space-y-4">
                <!-- Variables Card -->
                <div class="rounded-xl border border-border/50 bg-card overflow-hidden">
                  <div class="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                    <div>
                      <h3 class="text-xs font-bold flex items-center gap-1.5">
                        <Icon name="i-lucide-braces" class="size-3.5 text-amber-500" />
                        Template Variables
                      </h3>
                      <p class="text-[10px] text-muted-foreground mt-0.5">Click to insert into document</p>
                    </div>
                    <button
                      class="size-7 rounded-md bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors"
                      @click="addVariable"
                    >
                      <Icon name="i-lucide-plus" class="size-3.5" />
                    </button>
                  </div>
                  <div class="divide-y divide-border/30 max-h-[50vh] overflow-y-auto">
                    <div
                      v-for="(v, idx) in templateForm.variables"
                      :key="idx"
                      class="p-3 hover:bg-muted/20 transition-colors group"
                    >
                      <div class="flex items-center gap-2 mb-2">
                        <input
                          v-model="v.label"
                          placeholder="Label"
                          class="flex-1 text-xs font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/30"
                        >
                        <button
                          class="size-6 rounded flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          @click="removeVariable(idx)"
                        >
                          <Icon name="i-lucide-x" class="size-3" />
                        </button>
                      </div>
                      <div class="flex items-center gap-2">
                        <input
                          v-model="v.key"
                          placeholder="variable_key"
                          class="flex-1 text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1 outline-none"
                        >
                        <select
                          v-model="v.type"
                          class="text-[10px] border rounded px-1.5 py-1 bg-background text-foreground outline-none"
                        >
                          <option value="text">Text</option>
                          <option value="date">Date</option>
                          <option value="number">Number</option>
                          <option value="currency">Currency</option>
                          <option value="textarea">Textarea</option>
                        </select>
                      </div>
                      <button
                        class="mt-2 inline-flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary font-semibold transition-colors"
                        @click="insertVariable(v.key)"
                      >
                        <Icon name="i-lucide-plus-circle" class="size-3" />
                        Insert into document
                      </button>
                    </div>
                    <div v-if="templateForm.variables.length === 0" class="p-6 text-center">
                      <Icon name="i-lucide-braces" class="size-8 text-muted-foreground/20 mx-auto mb-2" />
                      <p class="text-xs text-muted-foreground">No variables defined</p>
                      <button class="text-xs text-primary font-semibold mt-2 hover:underline" @click="addVariable">
                        Add your first variable
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Quick Tips -->
                <div class="rounded-xl border border-border/50 bg-card p-4">
                  <h4 class="text-xs font-bold flex items-center gap-1.5 mb-3">
                    <Icon name="i-lucide-lightbulb" class="size-3.5 text-amber-400" />
                    Quick Tips
                  </h4>
                  <div class="space-y-2">
                    <p class="text-[10px] text-muted-foreground flex items-start gap-2">
                      <span class="text-primary font-bold shrink-0">•</span>
                      Use <code class="px-1 py-0.5 bg-muted rounded text-[9px] font-mono text-amber-600 dark:text-amber-400">{<!-- -->{variable_key}}</code> syntax in the editor to mark dynamic fields
                    </p>
                    <p class="text-[10px] text-muted-foreground flex items-start gap-2">
                      <span class="text-primary font-bold shrink-0">•</span>
                      Variables are highlighted in <span class="text-amber-500 font-semibold">amber</span> for easy identification
                    </p>
                    <p class="text-[10px] text-muted-foreground flex items-start gap-2">
                      <span class="text-primary font-bold shrink-0">•</span>
                      The company letterhead is auto-populated from <strong class="text-foreground">General Settings → Company</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Templates Grid (when editor is closed) -->
          <div v-else>
            <!-- Loading -->
            <div v-if="loadingTemplates" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="i in 3" :key="i" class="h-48 bg-muted/40 rounded-xl animate-pulse" />
            </div>

            <!-- Empty State -->
            <div v-else-if="templates.length === 0" class="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/60 rounded-2xl bg-muted/5">
              <div class="size-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center mb-4 border border-amber-500/20">
                <Icon name="i-lucide-layout-template" class="size-8 text-amber-500" />
              </div>
              <h3 class="text-xl font-bold mb-1">No Templates Yet</h3>
              <p class="text-muted-foreground max-w-sm px-4 text-sm mb-4">
                Create your first contract template or seed the default Change Order template.
              </p>
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

            <!-- Templates Cards -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="tmpl in templates"
                :key="tmpl._id"
                class="group rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all duration-300 cursor-pointer overflow-hidden hover:shadow-lg hover:shadow-primary/5"
                @click="openTemplateEditor(tmpl)"
              >
                <!-- Card Top Accent -->
                <div class="h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

                <div class="p-5">
                  <div class="flex items-start justify-between mb-3">
                    <div class="size-10 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
                      <Icon name="i-lucide-file-signature" class="size-5 text-primary" />
                    </div>
                    <div class="flex items-center gap-1">
                      <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-muted text-muted-foreground">
                        {{ tmpl.category }}
                      </span>
                      <button
                        class="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        @click.stop="deleteTemplate(tmpl._id)"
                      >
                        <Icon name="i-lucide-trash-2" class="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <h3 class="font-bold text-sm mb-1 group-hover:text-primary transition-colors">{{ tmpl.name }}</h3>
                  <p v-if="tmpl.description" class="text-xs text-muted-foreground line-clamp-2 mb-3">{{ tmpl.description }}</p>

                  <!-- Variable Pills -->
                  <div v-if="tmpl.variables?.length" class="flex flex-wrap gap-1 mb-3">
                    <span
                      v-for="v in tmpl.variables.slice(0, 4)"
                      :key="v.key"
                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    >
                      {{ v.key }}
                    </span>
                    <span v-if="tmpl.variables.length > 4" class="text-[9px] text-muted-foreground px-1">
                      +{{ tmpl.variables.length - 4 }} more
                    </span>
                  </div>

                  <!-- Footer -->
                  <div class="flex items-center justify-between pt-3 border-t border-border/40">
                    <span class="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Icon name="i-lucide-clock" class="size-3" />
                      {{ formatDate(tmpl.updatedAt) }}
                    </span>
                    <span class="text-[10px] text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Edit
                      <Icon name="i-lucide-arrow-right" class="size-3" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
