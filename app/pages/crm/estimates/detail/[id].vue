<script setup lang="ts">
import { format } from 'date-fns'
import { toast } from 'vue-sonner'

const route = useRoute()
const router = useRouter()
const { setHeader } = usePageHeader()
const { canUpdate } = usePermissions('/crm/estimates')

const estimateId = route.params.id as string

// State
const estimate = ref<any>(null)
const loading = ref(true)
const isSaving = ref(false)
const companyProfile = ref<any>({})

// Status config
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30',
  sent: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  approved: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  change_request: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  declined: 'bg-red-500/15 text-red-500 border-red-500/30',
  completed: 'bg-green-500/15 text-green-600 border-green-500/30',
  cancelled: 'bg-red-500/15 text-red-500 border-red-500/30',
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', approved: 'Approved',
  change_request: 'Change Request', declined: 'Declined',
  completed: 'Completed', cancelled: 'Cancelled',
}
const STATUS_ICONS: Record<string, string> = {
  draft: 'i-lucide-file-edit',
  sent: 'i-lucide-send',
  approved: 'i-lucide-check-circle-2',
  change_request: 'i-lucide-message-square-warning',
  declined: 'i-lucide-x-circle',
  completed: 'i-lucide-check-check',
  cancelled: 'i-lucide-ban',
}

const statuses = ['draft', 'sent', 'approved', 'change_request', 'declined', 'completed', 'cancelled']

// Fetch
async function fetchEstimate() {
  loading.value = true
  try {
    const [estRes, settingsRes] = await Promise.all([
      $fetch<any>(`/api/estimates/detail/${estimateId}`),
      $fetch<{ success: boolean, data: Record<string, any> }>('/api/app-settings'),
    ])
    estimate.value = estRes.data
    if (settingsRes.data?.companyProfile)
      companyProfile.value = settingsRes.data.companyProfile

    setHeader({
      title: displayTitle(estimate.value?.title) || 'Estimate Details',
      icon: 'i-lucide-file-text',
      description: `#${estimate.value?.estimateNumber || ''}`,
    })
  }
  catch {
    toast.error('Failed to load estimate')
    router.push('/crm/estimates/list')
  }
  finally {
    loading.value = false
  }
}

async function updateStatus(status: string) {
  if (!estimate.value) return
  isSaving.value = true
  try {
    await $fetch(`/api/estimates/detail/${estimateId}`, {
      method: 'PUT',
      body: { status },
    })
    estimate.value.status = status
    toast.success(`Status updated to ${STATUS_LABELS[status] || status}`)
  }
  catch (e: any) {
    toast.error('Failed to update', { description: e?.data?.message || e?.message })
  }
  finally {
    isSaving.value = false
  }
}

// Helpers
function displayTitle(title: string) {
  return (title || '').replace(/^Ann Arbor Hardwoods\s+/i, '').trim()
}
function formatDate(d: string) { return d ? format(new Date(d), 'MMM dd, yyyy') : '—' }
function formatDateTime(d: string) { return d ? format(new Date(d), 'MMM dd, yyyy · h:mm a') : '—' }

// Merged HTML for preview
const previewHTML = computed(() => {
  if (!estimate.value?.content) return ''
  let html = estimate.value.content

  // Replace variable placeholders with values
  if (estimate.value.variableValues) {
    for (const [key, val] of Object.entries<string>(estimate.value.variableValues)) {
      const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
      html = html.replace(re, String(val || ''))
    }
  }

  // System variables
  const printDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  html = html.replace(/\{\{\s*printDate\s*\}\}/gi, printDate)
  html = html.replace(/\{\{\s*company_name\s*\}\}/gi, companyProfile.value?.name || '')
  html = html.replace(/\{\{\s*company_address\s*\}\}/gi, companyProfile.value?.address || '')
  html = html.replace(/\{\{\s*company_city\s*\}\}/gi, companyProfile.value?.city || '')
  html = html.replace(/\{\{\s*company_state\s*\}\}/gi, companyProfile.value?.state || '')
  html = html.replace(/\{\{\s*company_zip\s*\}\}/gi, companyProfile.value?.zip || '')
  html = html.replace(/\{\{\s*company_phone1?\s*\}\}/gi, companyProfile.value?.phone1 || '')
  html = html.replace(/\{\{\s*company_phone2\s*\}\}/gi, companyProfile.value?.phone2 || '')
  html = html.replace(/\{\{\s*company_website\s*\}\}/gi, companyProfile.value?.website || '')
  html = html.replace(/\{\{\s*company_email\s*\}\}/gi, companyProfile.value?.email || '')
  html = html.replace(/\{\{\s*company_license\s*\}\}/gi, companyProfile.value?.licenseNumber || '')

  // Strip template-variable spans
  html = html.replace(/<span[^>]*class="[^"]*template-variable[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
  html = html.replace(/<hr\s*\/?>/gi, '')

  return html
})

// Variable display list (filter out empty/system)
const variablesList = computed(() => {
  if (!estimate.value?.variableValues) return []
  const systemKeys = new Set(['printDate', 'company_name', 'company_address', 'company_city', 'company_state', 'company_zip', 'company_phone1', 'company_phone2', 'company_website', 'company_email', 'company_license'])
  return Object.entries(estimate.value.variableValues)
    .filter(([key]) => !systemKeys.has(key))
    .map(([key, val]) => ({ key, value: val as string }))
})

// Client response info
const clientResponse = computed(() => {
  const timeline = estimate.value?.statusTimeline || []
  const responseEntry = [...timeline].reverse().find((t: any) => ['approved', 'change_request', 'declined'].includes(t.action))
  if (responseEntry) {
    return {
      action: responseEntry.action,
      message: responseEntry.message,
      respondedAt: responseEntry.timestamp,
    }
  }
  return null
})

onMounted(fetchEstimate)
</script>

<template>
  <div class="max-w-7xl mx-auto space-y-6 pb-20">
    <!-- Loading -->
    <div v-if="loading" class="space-y-6">
      <div class="h-40 bg-card rounded-3xl border animate-pulse" />
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 h-[500px] bg-card rounded-3xl border animate-pulse" />
        <div class="h-[400px] bg-card rounded-3xl border animate-pulse" />
      </div>
    </div>

    <template v-if="estimate && !loading">
      <!-- Header Toolbar Teleport -->
      <ClientOnly>
        <Teleport to="#header-toolbar">
          <div class="flex items-center gap-2">
            <button
              class="size-8 sm:size-9 rounded-lg border bg-card hover:bg-muted flex items-center justify-center transition-colors"
              @click="router.push('/crm/estimates/list')"
            >
              <Icon name="i-lucide-arrow-left" class="size-4" />
            </button>
            <button
              v-if="canUpdate()"
              class="inline-flex items-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              @click="router.push('/crm/estimates/list')"
            >
              <Icon name="i-lucide-pencil" class="size-3.5" />
              <span class="hidden sm:inline">Edit</span>
            </button>
          </div>
        </Teleport>
      </ClientOnly>

      <!-- ════ HERO CARD ════ -->
      <div class="relative overflow-hidden rounded-3xl border bg-card p-8 lg:p-10 shadow-sm">
        <!-- Decorative gradient blob -->
        <div
          class="absolute -right-20 -top-20 w-80 h-80 rounded-full blur-[80px] opacity-15 pointer-events-none"
          :class="{
            'bg-zinc-400': estimate.status === 'draft',
            'bg-blue-500': estimate.status === 'sent',
            'bg-emerald-500': estimate.status === 'approved' || estimate.status === 'completed',
            'bg-amber-500': estimate.status === 'change_request',
            'bg-red-500': estimate.status === 'declined' || estimate.status === 'cancelled',
          }"
        />

        <div class="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div class="flex items-start gap-6">
            <div
              class="w-20 h-20 rounded-2xl flex items-center justify-center relative ring-1 ring-border shadow-inner"
              :class="STATUS_COLORS[estimate.status]?.replace(/border-[^\s]+/, '') || 'bg-muted'"
            >
              <Icon :name="STATUS_ICONS[estimate.status] || 'i-lucide-file-text'" class="size-10" />
            </div>
            <div class="space-y-2">
              <div class="flex items-center gap-3 flex-wrap">
                <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {{ displayTitle(estimate.title) }}
                </h1>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-muted text-muted-foreground border">
                  #{{ estimate.estimateNumber }}
                </span>
              </div>
              <div class="flex items-center gap-3 flex-wrap">
                <span
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold capitalize border"
                  :class="STATUS_COLORS[estimate.status] || 'bg-muted text-muted-foreground'"
                >
                  <Icon :name="STATUS_ICONS[estimate.status] || 'i-lucide-circle'" class="size-3.5" />
                  {{ STATUS_LABELS[estimate.status] || estimate.status }}
                </span>
                <span class="text-sm text-muted-foreground font-medium">
                  Created {{ formatDateTime(estimate.createdAt) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Status Switcher -->
          <div v-if="canUpdate()" class="flex items-center gap-2 w-full md:w-auto">
            <div class="bg-muted/50 p-1.5 rounded-xl border flex items-center gap-1 overflow-x-auto no-scrollbar w-full md:w-auto">
              <button
                v-for="s in statuses"
                :key="s"
                class="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap"
                :class="estimate.status === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/40'"
                :disabled="isSaving"
                @click="updateStatus(s)"
              >
                {{ STATUS_LABELS[s] || s }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ════ CONTENT GRID ════ -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left: Main Content -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Client Response Banner -->
          <div v-if="clientResponse" class="rounded-2xl border overflow-hidden shadow-sm">
            <div
              class="flex items-center gap-3 px-6 py-4"
              :class="{
                'bg-emerald-500/10 border-emerald-500/20': clientResponse.action === 'approved',
                'bg-amber-500/10 border-amber-500/20': clientResponse.action === 'change_request',
                'bg-red-500/10 border-red-500/20': clientResponse.action === 'declined',
              }"
            >
              <div
                class="size-10 rounded-xl flex items-center justify-center shrink-0"
                :class="{
                  'bg-emerald-500/20 text-emerald-600': clientResponse.action === 'approved',
                  'bg-amber-500/20 text-amber-600': clientResponse.action === 'change_request',
                  'bg-red-500/20 text-red-600': clientResponse.action === 'declined',
                }"
              >
                <Icon
                  :name="clientResponse.action === 'approved' ? 'i-lucide-check-circle-2' : clientResponse.action === 'change_request' ? 'i-lucide-message-square-warning' : 'i-lucide-x-circle'"
                  class="size-5"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold">
                  Client {{ STATUS_LABELS[clientResponse.action] || clientResponse.action }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ formatDateTime(clientResponse.respondedAt) }}
                </p>
              </div>
            </div>
            <div v-if="clientResponse.message" class="px-6 py-4 bg-card border-t">
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Client's Message
              </p>
              <p class="text-sm text-foreground/80 leading-relaxed italic bg-muted/30 rounded-lg p-4 border border-dashed">
                "{{ clientResponse.message }}"
              </p>
            </div>
          </div>

          <!-- Document Preview -->
          <div class="bg-card rounded-3xl border overflow-hidden shadow-sm">
            <div class="px-8 py-5 border-b bg-muted/10 flex items-center justify-between">
              <h3 class="text-lg font-bold flex items-center gap-2">
                <Icon name="i-lucide-file-text" class="size-5 text-primary" />
                Estimate Document
              </h3>
              <div class="flex items-center gap-2">
                <span v-if="estimate.templateName" class="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {{ estimate.templateName.replace(/^Ann Arbor Hardwoods\s+/i, '') }}
                </span>
              </div>
            </div>
            <div class="p-8">
              <div
                class="prose prose-sm max-w-none dark:prose-invert prose-headings:tracking-tight"
                v-html="previewHTML"
              />
            </div>
          </div>

          <!-- Variable Values -->
          <div v-if="variablesList.length > 0" class="bg-card rounded-3xl border overflow-hidden shadow-sm">
            <div class="px-8 py-5 border-b bg-muted/10">
              <h3 class="text-lg font-bold flex items-center gap-2">
                <Icon name="i-lucide-braces" class="size-5 text-amber-500" />
                Variable Values
              </h3>
              <p class="text-xs text-muted-foreground mt-1">
                Fields filled for this estimate
              </p>
            </div>
            <div class="divide-y">
              <div
                v-for="v in variablesList"
                :key="v.key"
                class="grid grid-cols-1 sm:grid-cols-3 gap-2 px-8 py-4 hover:bg-muted/20 transition-colors"
              >
                <span class="text-sm font-bold text-muted-foreground">{{ v.key }}</span>
                <span class="sm:col-span-2 text-sm text-foreground/90 font-medium whitespace-pre-line">{{ v.value || '—' }}</span>
              </div>
            </div>
          </div>

          <!-- Gallery Images -->
          <div v-if="estimate.attachedGalleryImages?.length > 0" class="bg-card rounded-3xl border p-8 space-y-6 shadow-sm">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold flex items-center gap-2">
                <Icon name="i-lucide-images" class="size-5 text-indigo-500" />
                Attached Images
              </h3>
              <p class="text-xs text-muted-foreground font-medium bg-muted px-2.5 py-1 rounded-lg">
                {{ estimate.attachedGalleryImages.length }} files
              </p>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div
                v-for="(img, idx) in estimate.attachedGalleryImages.slice(0, 6)"
                :key="idx"
                class="group relative aspect-[4/3] rounded-2xl overflow-hidden ring-1 ring-border shadow-sm"
              >
                <img :src="img" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
              </div>
            </div>
          </div>

          <!-- Technical Metadata -->
          <div class="bg-muted/20 rounded-3xl p-8 border border-dashed grid grid-cols-2 md:grid-cols-4 gap-6 text-[11px] text-muted-foreground font-mono">
            <div>
              <p class="font-bold text-foreground/30 uppercase tracking-widest mb-1">Estimate ID</p>
              <p class="truncate">{{ estimate._id }}</p>
            </div>
            <div>
              <p class="font-bold text-foreground/30 uppercase tracking-widest mb-1">Template</p>
              <p class="truncate">{{ estimate.templateName || '—' }}</p>
            </div>
            <div>
              <p class="font-bold text-foreground/30 uppercase tracking-widest mb-1">Created</p>
              <p>{{ formatDateTime(estimate.createdAt) }}</p>
            </div>
            <div>
              <p class="font-bold text-foreground/30 uppercase tracking-widest mb-1">Updated</p>
              <p>{{ formatDateTime(estimate.updatedAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Right: Sidebar -->
        <div class="space-y-6">
          <!-- Customer Contact Card -->
          <div class="bg-card rounded-3xl border p-8 space-y-5 shadow-sm ring-1 ring-primary/5">
            <h3 class="text-lg font-bold flex items-center gap-2">
              <Icon name="i-lucide-contact" class="size-5 text-primary" />
              Customer
            </h3>

            <!-- Name -->
            <div class="group p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all">
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Name</p>
              <p class="text-sm font-bold text-foreground">{{ estimate.customerName || '—' }}</p>
            </div>

            <!-- Email -->
            <div class="group p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all">
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Email</p>
              <div class="flex items-center justify-between">
                <a v-if="estimate.customerEmail" :href="`mailto:${estimate.customerEmail}`" class="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate pr-2">
                  {{ estimate.customerEmail }}
                </a>
                <span v-else class="text-sm text-muted-foreground">—</span>
                <button
                  v-if="estimate.customerEmail"
                  class="p-2 rounded-xl bg-background shadow-sm hover:bg-primary hover:text-white transition-all opacity-0 group-hover:opacity-100 shrink-0"
                >
                  <Icon name="i-lucide-mail" class="size-4" />
                </button>
              </div>
            </div>

            <!-- Phone -->
            <div class="group p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-emerald/20 hover:bg-emerald/5 transition-all">
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Phone</p>
              <div class="flex items-center justify-between">
                <a v-if="estimate.customerPhone" :href="`tel:${estimate.customerPhone}`" class="text-sm font-bold text-foreground group-hover:text-emerald-600 transition-colors">
                  {{ estimate.customerPhone }}
                </a>
                <span v-else class="text-sm text-muted-foreground">—</span>
                <button
                  v-if="estimate.customerPhone"
                  class="p-2 rounded-xl bg-background shadow-sm hover:bg-emerald-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 shrink-0"
                >
                  <Icon name="i-lucide-phone" class="size-4" />
                </button>
              </div>
            </div>

            <!-- Address -->
            <div class="p-4 rounded-2xl bg-muted/10 border border-transparent">
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Address</p>
              <div class="flex items-start gap-3">
                <div class="mt-1 p-2 rounded-lg bg-background border shadow-sm shrink-0">
                  <Icon name="i-lucide-map-pin" class="size-4 text-rose-500" />
                </div>
                <p class="text-sm text-foreground/80 font-medium leading-tight">
                  {{ estimate.customerAddress || 'No address provided' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Timeline Card -->
          <div class="bg-card rounded-3xl border p-8 space-y-5 shadow-sm">
            <h3 class="text-lg font-bold flex items-center gap-2">
              <Icon name="i-lucide-clock" class="size-5 text-indigo-500" />
              Timeline
            </h3>
            <div class="space-y-4">
              <!-- Created -->
              <div class="flex items-start gap-3">
                <div class="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="i-lucide-plus-circle" class="size-4 text-blue-500" />
                </div>
                <div>
                  <p class="text-xs font-bold text-foreground">Estimate Created</p>
                  <p class="text-[11px] text-muted-foreground">{{ formatDateTime(estimate.createdAt) }}</p>
                </div>
              </div>

              <!-- Sent -->
              <div v-if="estimate.sentAt" class="flex items-start gap-3">
                <div class="size-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="i-lucide-send" class="size-4 text-violet-500" />
                </div>
                <div>
                  <p class="text-xs font-bold text-foreground">Emailed to Client</p>
                  <p class="text-[11px] text-muted-foreground">{{ formatDateTime(estimate.sentAt) }}</p>
                </div>
              </div>

              <!-- Client Response -->
              <div v-if="clientResponse" class="flex items-start gap-3">
                <div
                  class="size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  :class="{
                    'bg-emerald-500/10': clientResponse.action === 'approved',
                    'bg-amber-500/10': clientResponse.action === 'change_request',
                    'bg-red-500/10': clientResponse.action === 'declined',
                  }"
                >
                  <Icon
                    :name="clientResponse.action === 'approved' ? 'i-lucide-check-circle-2' : clientResponse.action === 'change_request' ? 'i-lucide-message-square-warning' : 'i-lucide-x-circle'"
                    class="size-4"
                    :class="{
                      'text-emerald-500': clientResponse.action === 'approved',
                      'text-amber-500': clientResponse.action === 'change_request',
                      'text-red-500': clientResponse.action === 'declined',
                    }"
                  />
                </div>
                <div>
                  <p class="text-xs font-bold text-foreground">
                    Client {{ STATUS_LABELS[clientResponse.action] || clientResponse.action }}
                  </p>
                  <p class="text-[11px] text-muted-foreground">{{ formatDateTime(clientResponse.respondedAt) }}</p>
                </div>
              </div>

              <!-- Last Updated -->
              <div class="flex items-start gap-3">
                <div class="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="i-lucide-refresh-cw" class="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p class="text-xs font-bold text-foreground">Last Updated</p>
                  <p class="text-[11px] text-muted-foreground">{{ formatDateTime(estimate.updatedAt) }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Attached PDF -->
          <div v-if="estimate.attachedPdf" class="bg-card rounded-3xl border p-8 space-y-4 shadow-sm">
            <h3 class="text-lg font-bold flex items-center gap-2">
              <Icon name="i-lucide-paperclip" class="size-5 text-rose-500" />
              Attached PDF
            </h3>
            <div class="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 border">
              <div class="size-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <Icon name="i-lucide-file-text" class="size-5 text-red-500" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-foreground truncate">Attached Document</p>
                <p class="text-[11px] text-muted-foreground">PDF attachment included with estimate</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.prose :deep(th),
.prose :deep(td) {
  border: 1px solid var(--color-border);
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.prose :deep(th) {
  background: hsl(var(--muted) / 0.5);
  font-weight: 600;
}
</style>
