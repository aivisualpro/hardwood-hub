<script setup lang="ts">
import { format } from 'date-fns'
import { toast } from 'vue-sonner'
import type { CrmSubmission } from '~/composables/useCrm'

const route = useRoute()
const router = useRouter()
const { setHeader } = usePageHeader()
const { updateSubmission, toggleStar } = useCrmSubmissions()

// State
const item = ref<CrmSubmission | null>(null)
const isLoading = ref(true)
const isSaving = ref(false)
const relatedSubmissions = ref<CrmSubmission[]>([])
const isLoadingRelated = ref(false)

// Fetch Data
async function fetchData() {
  isLoading.value = true
  try {
    const res = await $fetch<any>(`/api/crm/submissions/${route.params.id}`)
    item.value = res.data
    
    // Set Header
    setHeader({
      title: item.value?.name || 'Submission Details',
      icon: typeIcon(item.value?.type || ''),
      description: item.value?.formName || 'CRM lead details',
    })
    
    // Fetch History
    if (item.value?.email) {
      fetchHistory(item.value.email)
    }
  } catch (err) {
    toast.error('Failed to load submission details')
    router.push('/crm/customers')
  } finally {
    isLoading.value = false
  }
}

async function fetchHistory(email: string) {
  isLoadingRelated.value = true
  try {
    const res = await $fetch<any>(`/api/crm/submissions?email=${encodeURIComponent(email)}&limit=100`)
    relatedSubmissions.value = (res.data || []).filter((s: any) => s._id !== route.params.id)
  } finally {
    isLoadingRelated.value = false
  }
}

// Actions
async function handleUpdateStatus(status: CrmSubmission['status']) {
  if (!item.value) return
  isSaving.value = true
  try {
    await updateSubmission(item.value._id, { status })
    item.value.status = status
    toast.success(`Status updated to ${status}`)
  } finally {
    isSaving.value = false
  }
}

async function handleToggleStar() {
  if (!item.value) return
  await toggleStar(item.value._id)
  item.value.starred = !item.value.starred
}

async function handleSaveNotes() {
  if (!item.value) return
  isSaving.value = true
  try {
    await updateSubmission(item.value._id, { notes: item.value.notes })
    toast.success('Notes saved successfully')
  } finally {
    isSaving.value = false
  }
}

// Helpers
function typeIcon(type: CrmSubmission['type'] | string) {
  switch (type) {
    case 'appointment': return 'i-lucide-calendar-check'
    case 'fast-quote': return 'i-lucide-zap'
    case 'flooring-estimate': return 'i-lucide-ruler'
    case 'subscriber': return 'i-lucide-mail-check'
    case 'conditional-logic': return 'i-lucide-split'
    default: return 'i-lucide-file-text'
  }
}

function typeColor(type: CrmSubmission['type'] | string) {
  switch (type) {
    case 'appointment': return 'bg-sky-500/10 text-sky-600'
    case 'fast-quote': return 'bg-amber-500/10 text-amber-600'
    case 'flooring-estimate': return 'bg-emerald-500/10 text-emerald-600'
    case 'subscriber': return 'bg-primary/10 text-primary'
    case 'conditional-logic': return 'bg-rose-500/10 text-rose-600'
    default: return 'bg-muted text-muted-foreground'
  }
}

function statusColor(status: CrmSubmission['status'] | string) {
  switch (status) {
    case 'new': return 'bg-blue-500/10 text-blue-600'
    case 'contacted': return 'bg-amber-500/10 text-amber-600'
    case 'in-progress': return 'bg-violet-500/10 text-violet-600'
    case 'completed': return 'bg-emerald-500/10 text-emerald-600'
    case 'archived': return 'bg-zinc-500/10 text-zinc-500'
    default: return 'bg-zinc-500/10 text-zinc-500'
  }
}

/**
 * Detects photos from form fields. 
 * Gravity Forms stores multiple file uploads as a JSON array string.
 */
const photos = computed(() => {
  if (!item.value?.fields) return []
  
  // Scrape everything in the fields object for image URLs
  const allText = JSON.stringify(item.value.fields)
  const imageRegex = /https?:\/\/[^"'\s\\]+\.(?:jpg|jpeg|png|gif|webp|heic)/gi
  const matches = allText.match(imageRegex)
  
  if (!matches) return []
  
  // Clean up any double-slashes or escaping from JSON mapping
  return [...new Set(matches.map(url => url.replace(/\\/g, '')))]
})

/**
 * Returns the key of the field that was identified as the photo field
 */
const photoFieldKeys = computed(() => {
  if (!item.value?.fields) return []
  return Object.keys(item.value.fields).filter(key => {
    const k = key.toLowerCase()
    const v = item.value?.fields ? String(item.value.fields[key]).toLowerCase() : ''
    return k.includes('photo') || k.includes('image') || (v.includes('http') && v.includes('.j'))
  })
})

const activePhotoIndex = ref(0)
const showCarousel = ref(false)

const statuses: CrmSubmission['status'][] = ['new', 'contacted', 'in-progress', 'completed', 'archived']

onMounted(fetchData)
</script>

<template>
  <div class="max-w-7xl mx-auto space-y-6 pb-20">
    <!-- Skeleton Loading -->
    <div v-if="isLoading" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="h-40 rounded-3xl bg-muted animate-pulse" />
        <div class="h-96 rounded-3xl bg-muted animate-pulse" />
      </div>
      <div class="space-y-6">
        <div class="h-64 rounded-3xl bg-muted animate-pulse" />
        <div class="h-96 rounded-3xl bg-muted animate-pulse" />
      </div>
    </div>

    <template v-else-if="item">
      <!-- Full-Screen Carousel Overlay -->
      <Teleport to="body">
        <div v-if="showCarousel && photos.length > 0" class="fixed inset-0 z-[100] bg-zinc-950/95 flex flex-col items-center justify-center p-4 lg:p-10 backdrop-blur-xl">
          <button 
            class="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all z-[110]"
            @click="showCarousel = false"
          >
            <Icon name="i-lucide-x" class="size-6" />
          </button>

          <div class="relative w-full h-full flex items-center justify-center">
            <!-- Navigation -->
            <button 
              class="absolute left-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all disabled:opacity-20"
              :disabled="activePhotoIndex === 0"
              @click="activePhotoIndex--"
            >
              <Icon name="i-lucide-chevron-left" class="size-6" />
            </button>
            <button 
              class="absolute right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all disabled:opacity-20"
              :disabled="activePhotoIndex === photos.length - 1"
              @click="activePhotoIndex++"
            >
              <Icon name="i-lucide-chevron-right" class="size-6" />
            </button>

            <!-- Active Photo -->
            <div class="max-w-5xl h-full flex flex-col items-center justify-center gap-6">
              <img 
                :src="photos[activePhotoIndex]" 
                class="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
              />
              <!-- Page info -->
              <div class="text-white/50 text-sm font-medium bg-white/5 px-4 py-2 rounded-full">
                Submission Highlight {{ activePhotoIndex + 1 }} of {{ photos.length }}
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Page Header & Hero Section -->
      <div class="relative overflow-hidden rounded-3xl border bg-card p-8 lg:p-10 shadow-sm transition-all duration-300 hover:shadow-md">
        <!-- Typespecific decorative blob -->
        <div 
          class="absolute -right-20 -top-20 w-80 h-80 rounded-full blur-[80px] opacity-20 pointer-events-none"
          :class="{
            'bg-sky-500': item.type === 'appointment',
            'bg-amber-500': item.type === 'fast-quote',
            'bg-emerald-500': item.type === 'flooring-estimate',
            'bg-primary': item.type === 'subscriber',
            'bg-rose-500': item.type === 'conditional-logic',
          }"
        />

        <div class="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div class="flex items-start gap-6">
            <div 
              class="w-20 h-20 rounded-2xl flex items-center justify-center relative ring-1 ring-border shadow-inner"
              :class="typeColor(item.type)"
            >
              <Icon :name="typeIcon(item.type)" class="size-10" />
              <button 
                class="absolute -top-2 -right-2 w-8 h-8 rounded-full border shadow-lg bg-background flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                :class="item.starred ? 'text-amber-400' : 'text-muted-foreground/30'"
                @click="handleToggleStar"
              >
                <Icon :name="item.starred ? 'i-lucide-star' : 'i-lucide-star'" class="size-4" :class="item.starred ? 'fill-amber-400' : ''" />
              </button>
            </div>
            <div class="space-y-2">
              <div class="flex items-center gap-3">
                 <h1 class="text-3xl font-bold tracking-tight text-foreground font-display">
                  {{ item.name || 'Anonymous User' }}
                </h1>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-muted text-muted-foreground border">
                  #{{ item.gfEntryId }}
                </span>
              </div>
              <div class="flex items-center gap-3 flex-wrap">
                <span 
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold capitalize"
                  :class="statusColor(item.status)"
                >
                  <Icon name="i-lucide-check-circle-2" class="size-3.5" />
                  {{ item.status }}
                </span>
                <span class="text-sm text-muted-foreground font-medium">
                  Submitted {{ format(new Date(item.dateSubmitted), 'PPP p') }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 w-full md:w-auto">
            <div class="bg-muted/50 p-1.5 rounded-xl border flex items-center gap-1 overflow-x-auto no-scrollbar w-full md:w-auto">
              <button
                v-for="s in statuses"
                :key="s"
                class="px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize whitespace-nowrap"
                :class="item.status === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/40'"
                :disabled="isSaving"
                @click="handleUpdateStatus(s)"
              >
                {{ s }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Content (Left) -->
        <div class="lg:col-span-2 space-y-8">
          
          <!-- Photo Gallery Grid -->
          <div v-if="photos.length > 0" class="bg-card rounded-3xl border p-8 space-y-6 shadow-sm">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold flex items-center gap-2">
                <Icon name="i-lucide-images" class="size-5 text-indigo-500" />
                Submission Photos
              </h3>
              <p class="text-xs text-muted-foreground font-medium bg-muted px-2.5 py-1 rounded-lg">
                {{ photos.length }} files attached
              </p>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div 
                v-for="(photo, idx) in photos.slice(0, 6)" 
                :key="photo"
                class="group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer ring-1 ring-border shadow-sm hover:ring-primary/50 transition-all active:scale-[0.98]"
                @click="() => { activePhotoIndex = idx; showCarousel = true }"
              >
                <img :src="photo" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Icon name="i-lucide-maximize-2" class="size-6 text-white" />
                </div>
                <!-- Counter for extra photos -->
                <div 
                  v-if="idx === 5 && photos.length > 6" 
                  class="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white border-2 border-primary/50"
                >
                  <p class="text-2xl font-bold">+{{ photos.length - 6 }}</p>
                  <p class="text-[10px] font-bold uppercase tracking-widest">More Photos</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Message Section -->
          <div v-if="item.message" class="bg-card rounded-3xl border p-8 space-y-4 shadow-sm">
            <h3 class="text-lg font-bold flex items-center gap-2">
              <Icon name="i-lucide-message-square" class="size-5 text-primary" />
              Customer Message
            </h3>
            <div class="bg-muted/30 p-6 rounded-2xl text-base leading-relaxed text-foreground/80 italic font-medium border border-dashed border-border/50">
              "{{ item.message }}"
            </div>
          </div>

          <!-- Notes Editor -->
          <div class="bg-card rounded-3xl border p-8 space-y-4 shadow-sm border-amber-500/10">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold flex items-center gap-2">
                <Icon name="i-lucide-notebook-pen" class="size-5 text-amber-500" />
                Staff Notes
              </h3>
              <button 
                class="text-xs font-bold text-amber-500 hover:text-amber-600 transition-colors uppercase tracking-widest px-3 py-1 rounded-lg hover:bg-amber-500/5"
                @click="handleSaveNotes"
              >
                {{ isSaving ? 'Saving...' : 'Save Notes' }}
              </button>
            </div>
            <textarea
              v-model="item.notes"
              rows="4"
              placeholder="Add internal notes about this lead here..."
              class="w-full bg-muted/20 border-border/50 rounded-2xl p-5 text-sm focus:ring-amber-500/20 focus:border-amber-500/50 transition-all outline-none resize-none"
            />
          </div>

          <!-- All Form Fields Tabular -->
          <div class="bg-card rounded-3xl border overflow-hidden shadow-sm">
            <div class="p-8 border-b bg-muted/10">
              <h3 class="text-lg font-bold flex items-center gap-2 font-display">
                <Icon name="i-lucide-list" class="size-5 text-emerald-500" />
                Form Response Details
              </h3>
              <p class="text-xs text-muted-foreground mt-1">Full breakdown of all captured form data</p>
            </div>
            <div class="divide-y">
              <template v-for="(val, key) in item.fields" :key="String(key)">
                <div 
                  v-if="!photoFieldKeys.includes(String(key)) && val && val !== '—' && val !== ''"
                  class="grid grid-cols-1 sm:grid-cols-3 gap-2 px-8 py-5 hover:bg-muted/20 transition-colors"
                >
                  <span class="text-sm font-bold text-muted-foreground">{{ key }}</span>
                  <span class="sm:col-span-2 text-sm text-foreground/90 font-medium whitespace-pre-line">{{ val || '—' }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- Technical Metadata -->
          <div class="bg-muted/20 rounded-3xl p-8 border border-dashed grid grid-cols-2 md:grid-cols-4 gap-6 text-[11px] text-muted-foreground font-mono">
            <div>
              <p class="font-bold text-foreground/30 uppercase tracking-widest mb-1">GF Form ID</p>
              <p>#{{ item.gfFormId }}</p>
            </div>
            <div>
              <p class="font-bold text-foreground/30 uppercase tracking-widest mb-1">Entry ID</p>
              <p>#{{ item.gfEntryId }}</p>
            </div>
            <div>
              <p class="font-bold text-foreground/30 uppercase tracking-widest mb-1">Source URL</p>
              <p class="truncate">{{ item.sourceUrl || 'Unknown' }}</p>
            </div>
            <div>
              <p class="font-bold text-foreground/30 uppercase tracking-widest mb-1">Submission IP</p>
              <p>{{ item.ip || '—' }}</p>
            </div>
          </div>
        </div>

        <!-- Sidebar Info (Right) -->
        <div class="space-y-8">
          <!-- Contact Card -->
          <div class="bg-card rounded-3xl border p-8 space-y-6 shadow-sm ring-1 ring-primary/5">
            <h3 class="text-lg font-bold font-display flex items-center gap-2">
              <Icon name="i-lucide-contact" class="size-5 text-primary" />
              Contact Information
            </h3>
            
            <div class="space-y-4">
              <!-- Email -->
              <div class="group block p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all">
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Email Address</p>
                <div class="flex items-center justify-between">
                  <a :href="`mailto:${item.email}`" class="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate pr-2">
                    {{ item.email || '—' }}
                  </a>
                  <button 
                    class="p-2 rounded-xl bg-background shadow-sm hover:bg-primary hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    @click="() => { /* Copy or Navigate */ }"
                  >
                    <Icon name="i-lucide-mail" class="size-4" />
                  </button>
                </div>
              </div>

              <!-- Phone -->
              <div class="group block p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-emerald/20 hover:bg-emerald/5 transition-all">
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Phone Number</p>
                <div class="flex items-center justify-between">
                  <a :href="`tel:${item.phone}`" class="text-sm font-bold text-foreground group-hover:text-emerald-600 transition-colors">
                    {{ item.phone || '—' }}
                  </a>
                   <button 
                    class="p-2 rounded-xl bg-background shadow-sm hover:bg-emerald-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Icon name="i-lucide-phone" class="size-4" />
                  </button>
                </div>
              </div>

              <!-- Location -->
              <div class="block p-4 rounded-2xl bg-muted/10 border border-transparent">
                <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Primary Address</p>
                <div class="flex items-start gap-3">
                  <div class="mt-1 p-2 rounded-lg bg-background border shadow-sm shrink-0">
                    <Icon name="i-lucide-map-pin" class="size-4 text-rose-500" />
                  </div>
                  <p class="text-sm text-foreground/80 font-medium leading-tight">
                    {{ [item.address, item.city, item.state, item.zip].filter(Boolean).join(', ') || 'No address provided' }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Submission History -->
          <div class="bg-card rounded-3xl border p-8 space-y-6 shadow-sm overflow-hidden min-h-[400px]">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold font-display flex items-center gap-2">
                <Icon name="i-lucide-history" class="size-5 text-indigo-500" />
                Submission History
              </h3>
              <span class="px-2 py-0.5 rounded-lg bg-muted text-[10px] font-bold">{{ relatedSubmissions.length + 1 }}</span>
            </div>

            <div v-if="isLoadingRelated" class="space-y-4">
              <div v-for="i in 3" :key="i" class="h-20 rounded-2xl bg-muted animate-pulse" />
            </div>

            <div v-else-if="relatedSubmissions.length > 0" class="space-y-3">
              <!-- Current Item Indicator -->
              <div class="relative flex flex-col gap-1 p-4 rounded-2xl border-2 border-primary bg-primary/5">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-bold text-primary">{{ item.formName }}</p>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-white">CURRENT</span>
                </div>
                <p class="text-[10px] text-muted-foreground">{{ format(new Date(item.dateSubmitted), 'MMM d, yyyy') }}</p>
              </div>

              <!-- Other Items -->
              <NuxtLink
                v-for="sub in relatedSubmissions"
                :key="sub._id"
                :to="`/crm/submissions/${sub._id}`"
                class="group block p-4 rounded-2xl border border-border/50 bg-muted/10 hover:bg-muted/40 transition-all border-dashed"
              >
                <div class="flex items-center justify-between mb-1">
                  <p class="text-xs font-bold group-hover:text-primary transition-colors truncate pr-2">{{ sub.formName }}</p>
                  <span class="shrink-0 text-[9px] text-muted-foreground uppercase tabular-nums font-mono">{{ format(new Date(sub.dateSubmitted), 'MMM d') }}</span>
                </div>
                <div class="flex items-center gap-2">
                   <span 
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tighter"
                    :class="typeColor(sub.type)"
                  >
                    {{ sub.type }}
                  </span>
                  <p v-if="sub.status === 'new'" class="text-[9px] font-bold text-blue-500 uppercase">New</p>
                </div>
              </NuxtLink>
            </div>
            <div v-else class="text-center py-10">
              <div class="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Icon name="i-lucide-user-check" class="size-6 text-muted-foreground/30" />
              </div>
              <p class="text-xs text-muted-foreground">This is the customer's first submission.</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.font-display {
  font-family: 'Outfit', sans-serif;
}
</style>
