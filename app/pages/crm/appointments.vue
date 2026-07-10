<script setup lang="ts">
import { format } from 'date-fns'
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({
  title: 'Appointments',
  icon: 'i-lucide-calendar-check',
  description: 'Calendly appointments',
})

const { canUpdate } = usePermissions('/crm/appointments')

const {
  items,
  isLoading,
  isSyncing,
  searchQuery,
  statusFilter,
  currentPage,
  totalItems,
  fetchSubmissions,
  syncFromGravityForms,
  updateSubmission,
  toggleStar,
} = useCrmSubmissions('appointment')

const viewMode = ref<'calendar' | 'list'>('calendar')
const lastSyncTime = ref<string>('')

// Auto-sync from Calendly on page load, then refresh the list
async function autoSyncCalendly() {
  try {
    const res = await $fetch<any>('/api/crm/calendly-sync', { method: 'POST' })
    if (res.success) {
      lastSyncTime.value = new Date().toLocaleTimeString()
      // Refresh the submissions list after background sync
      await fetchSubmissions(currentPage.value)
    }
  }
  catch (err) {
    console.warn('[Appointments] Auto-sync failed:', err)
  }
}

// ─── Server-first data fetching (blocks navigation until resolved) ──────
await useAsyncData('appointments-page', async () => { await fetchSubmissions(); return true })

// Background Calendly sync (not blocking — runs after page renders)
onMounted(() => {
  autoSyncCalendly()
})

// Poll every 5 minutes to keep calendar up-to-date (avoid rate limits)
let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  pollTimer = setInterval(() => {
    autoSyncCalendly()
  }, 300_000)
})

onUnmounted(() => {
  if (pollTimer)
    clearInterval(pollTimer)
})

// Manual full sync (Calendly + Gravity Forms)
async function handleSync() {
  try {
    const res = await syncFromGravityForms()
    lastSyncTime.value = new Date().toLocaleTimeString()
    toast.success(`Synced ${res.synced} new submissions`, {
      description: res.existing > 0 ? `${res.existing} already existed` : undefined,
    })
  }
  catch {
    toast.error('Sync failed. Check your API credentials.')
  }
}

const selectedItem = ref<any>(null)
const showDetailSheet = ref(false)

function showDetails(item: any) {
  selectedItem.value = item
  showDetailSheet.value = true
}

function formatDate(date: string) {
  if (!date)
    return '—'
  return format(new Date(date), 'MMM dd, yyyy h:mm a')
}

// ─── Appointment state (active / rescheduled / canceled) ────────────────────
function getAptState(item: any): 'active' | 'rescheduled' | 'canceled' | 'completed' {
  const meeting = item?.fields?.meetingScheduled
  if (meeting?.rescheduled)
    return 'rescheduled'
  if (meeting?.eventStatus === 'canceled' || item?.status === 'archived')
    return 'canceled'
  if (item?.status === 'completed')
    return 'completed'
  return 'active'
}

const APT_STATE_BADGES: Record<string, string> = {
  active: 'bg-sky-500/15 text-sky-600',
  completed: 'bg-emerald-500/15 text-emerald-600',
  rescheduled: 'bg-zinc-500/15 text-zinc-500',
  canceled: 'bg-red-500/15 text-red-600',
}

async function handleStatusUpdate(id: string, status: string) {
  await updateSubmission(id, { status } as any)
  if (selectedItem.value && selectedItem.value._id === id) {
    selectedItem.value.status = status
  }
  toast.success(`Status updated to ${status}`)
}

// ─── Appointment type filter ────────────────────────────────────────────────
type AptType = 'all' | 'in-home' | 'phone' | 'other'
const typeFilter = ref<AptType>('all')

function getAptType(item: any): 'in-home' | 'phone' | 'other' {
  const t = (item.fields?.appointmentType || '').toLowerCase()
  const name = (item.formName || '').toLowerCase()
  if (t === 'in-home' || /in[\s-]?home/.test(name))
    return 'in-home'
  if (t === 'phone' || /phone|call|consult/.test(name))
    return 'phone'
  return 'other'
}

const filteredItems = computed(() => {
  if (typeFilter.value === 'all')
    return items.value
  return items.value.filter(item => getAptType(item) === typeFilter.value)
})

const typeFilterOptions: { value: AptType, label: string, icon: string, color: string, activeColor: string }[] = [
  { value: 'all', label: 'All', icon: 'i-lucide-layers', color: 'text-muted-foreground', activeColor: 'bg-foreground text-background' },
  { value: 'in-home', label: 'In-Home', icon: 'i-lucide-home', color: 'text-blue-600', activeColor: 'bg-blue-600 text-white' },
  { value: 'phone', label: 'Phone', icon: 'i-lucide-phone', color: 'text-emerald-600', activeColor: 'bg-emerald-600 text-white' },
  { value: 'other', label: 'Other', icon: 'i-lucide-calendar', color: 'text-amber-600', activeColor: 'bg-amber-600 text-white' },
]

const typeCounts = computed(() => ({
  'all': items.value.length,
  'in-home': items.value.filter(i => getAptType(i) === 'in-home').length,
  'phone': items.value.filter(i => getAptType(i) === 'phone').length,
  'other': items.value.filter(i => getAptType(i) === 'other').length,
}))
</script>

<template>
  <div class="space-y-4">
    <!-- Header Teleport -->
    <ClientOnly>
      <Teleport to="#header-toolbar">
        <div class="flex items-center gap-2 sm:gap-3 w-full max-w-xl pr-2">
          <div class="relative flex-1">
            <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search appointments..."
              class="w-full h-8 sm:h-9 pl-8 sm:pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            >
          </div>
          <!-- Type Filter Pills -->
          <div class="hidden sm:flex items-center gap-1 shrink-0">
            <button
              v-for="opt in typeFilterOptions"
              :key="opt.value"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all border"
              :class="typeFilter === opt.value
                ? `${opt.activeColor} border-transparent shadow-sm`
                : `bg-transparent border-border/50 ${opt.color} hover:bg-muted/50`"
              @click="typeFilter = opt.value"
            >
              <Icon :name="opt.icon" class="size-3.5" />
              {{ opt.label }}
              <span
                class="text-[9px] font-bold px-1.5 py-px rounded-full"
                :class="typeFilter === opt.value ? 'bg-white/20' : 'bg-muted'"
              >{{ typeCounts[opt.value] }}</span>
            </button>
          </div>
          <!-- View Toggle -->
          <div class="bg-muted p-0.5 hidden sm:flex rounded-lg items-center shadow-inner border border-input/50 h-8 sm:h-9">
            <button
              class="px-2.5 h-full rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
              :class="viewMode === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
              @click="viewMode = 'calendar'"
            >
              <Icon name="i-lucide-calendar" class="size-3.5" />
            </button>
            <button
              class="px-2.5 h-full rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
              :class="viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
              @click="viewMode = 'list'"
            >
              <Icon name="i-lucide-list" class="size-3.5" />
            </button>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span v-if="lastSyncTime" class="hidden lg:inline text-[10px] text-muted-foreground/60 font-medium">
              synced {{ lastSyncTime }}
            </span>
            <button
              v-if="canUpdate()"
              class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shrink-0 shadow-lg shadow-primary/20"
              :disabled="isSyncing"
              @click="handleSync"
            >
              <Icon name="i-lucide-refresh-cw" class="size-3.5" :class="isSyncing ? 'animate-spin' : ''" />
              <span class="hidden sm:inline">{{ isSyncing ? 'Syncing...' : 'Sync' }}</span>
            </button>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- Calendar View -->
    <CrmCalendarView
      v-if="viewMode === 'calendar'"
      :items="filteredItems"
      :is-loading="isLoading"
      class="min-h-[700px]"
      @update-status="handleStatusUpdate"
      @select="showDetails"
    />

    <!-- List View -->
    <CrmSubmissionsTable
      v-else
      :items="filteredItems"
      :is-loading="isLoading"
      type="appointment"
      empty-icon="i-lucide-calendar-check"
      empty-title="No appointment requests yet"
      empty-description="Click 'Sync' in the header to pull in form submissions"
      @toggle-star="toggleStar"
      @update-status="handleStatusUpdate"
    />

    <!-- Pagination -->
    <div v-if="totalItems > 50" class="flex items-center justify-center gap-2 pt-2 pb-10">
      <button
        class="h-8 px-4 rounded-lg border bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40"
        :disabled="isLoading || items.length >= totalItems"
        @click="fetchSubmissions(currentPage + 1)"
      >
        {{ isLoading ? 'Loading...' : 'Load more' }}
      </button>
    </div>

    <!-- Appointment Detail Slideover -->
    <Sheet v-model:open="showDetailSheet">
      <SheetContent class="sm:max-w-xl overflow-y-auto w-full p-6 sm:p-8">
        <SheetHeader v-if="selectedItem">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
              <Icon name="i-lucide-calendar" class="size-6 text-primary" />
            </div>
            <div>
              <SheetTitle class="text-lg">
                {{ selectedItem.name || 'Unknown Contact' }}
              </SheetTitle>
              <SheetDescription>{{ selectedItem.formName || 'Calendly Appointment' }}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div v-if="selectedItem" class="mt-6 space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div v-if="selectedItem.email" class="flex items-center gap-2 text-sm">
              <Icon name="i-lucide-mail" class="size-4 text-muted-foreground shrink-0" />
              <a :href="`mailto:${selectedItem.email}`" class="text-primary hover:underline truncate">{{ selectedItem.email }}</a>
            </div>
            <div v-if="selectedItem.phone" class="flex items-center gap-2 text-sm">
              <Icon name="i-lucide-phone" class="size-4 text-muted-foreground shrink-0" />
              <a :href="`tel:${selectedItem.phone}`" class="text-primary hover:underline">{{ selectedItem.phone }}</a>
            </div>
            <div v-if="selectedItem.fields?.meetingScheduled" class="flex items-center gap-2 text-sm col-span-1 sm:col-span-2 mt-2 p-3 bg-muted/40 rounded-xl border">
              <div
                class="w-1.5 h-1.5 rounded-full mr-1 shrink-0"
                :class="getAptState(selectedItem) === 'canceled' ? 'bg-red-500' : getAptState(selectedItem) === 'rescheduled' ? 'bg-zinc-400' : 'bg-emerald-500'"
              />
              <div class="flex flex-col">
                <span class="font-bold text-foreground">Scheduled for:</span>
                <span
                  class="text-muted-foreground"
                  :class="{ 'line-through opacity-70': getAptState(selectedItem) === 'rescheduled' || getAptState(selectedItem) === 'canceled' }"
                >{{ formatDate(selectedItem.fields.meetingScheduled.startTime) }}</span>
              </div>
              <span
                v-if="getAptState(selectedItem) === 'rescheduled' || getAptState(selectedItem) === 'canceled'"
                class="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0"
                :class="APT_STATE_BADGES[getAptState(selectedItem)]"
              >{{ getAptState(selectedItem) }}</span>
            </div>
          </div>

          <Separator />

          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <span
              class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium capitalize w-fit"
              :class="APT_STATE_BADGES[getAptState(selectedItem)]"
            >
              Status: {{ getAptState(selectedItem) === 'active' ? selectedItem.status : getAptState(selectedItem) }}
            </span>
            <span class="text-xs text-muted-foreground sm:ml-auto">
              Booked {{ formatDate(selectedItem.dateSubmitted) }}
            </span>
          </div>

          <div v-if="selectedItem.message" class="space-y-2">
            <h4 class="text-sm font-medium text-foreground">
              Message / Notes
            </h4>
            <div class="rounded-lg bg-muted/30 p-4 text-sm text-foreground/80 leading-relaxed border border-border/50 whitespace-pre-wrap">
              {{ selectedItem.message }}
            </div>
          </div>

          <div v-if="selectedItem.fields && Object.keys(selectedItem.fields).length > 0" class="space-y-2">
            <h4 class="text-sm font-medium text-foreground">
              Additional Details
            </h4>
            <div class="rounded-lg border border-border/50 overflow-hidden divide-y divide-border/50">
              <div
                v-for="(entry, index) in Object.entries(selectedItem.fields).filter(([k]) => k !== 'meetingScheduled' && k !== 'appointmentType')"
                :key="entry[0]"
                class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-4 py-3 bg-card text-sm"
              >
                <span class="text-muted-foreground font-medium sm:min-w-[150px] sm:max-w-[180px] shrink-0">{{ entry[0] }}</span>
                <span class="text-foreground whitespace-pre-wrap break-words leading-relaxed">{{ entry[1] || '—' }}</span>
              </div>
            </div>

            <div v-if="selectedItem.fields.meetingScheduled" class="mt-4 flex flex-col sm:flex-row gap-3 pb-8">
              <a v-if="selectedItem.fields.meetingScheduled.rescheduleUrl" :href="selectedItem.fields.meetingScheduled.rescheduleUrl" target="_blank" class="px-4 py-2.5 rounded-lg bg-orange-500/10 text-orange-600 font-bold text-sm sm:text-xs ring-1 ring-orange-500/20 hover:bg-orange-500/20 transition-all flex items-center justify-center flex-1">
                Reschedule Link
              </a>
              <a v-if="selectedItem.fields.meetingScheduled.cancelUrl" :href="selectedItem.fields.meetingScheduled.cancelUrl" target="_blank" class="px-4 py-2.5 rounded-lg bg-red-500/10 text-red-600 font-bold text-sm sm:text-xs ring-1 ring-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center flex-1">
                Cancel Link
              </a>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
