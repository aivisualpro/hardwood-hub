<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({
  title: 'Appointments',
  icon: 'i-lucide-calendar-check',
  description: 'Calendly appointments',
})

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

onMounted(() => fetchSubmissions())

async function handleSync() {
  try {
    const res = await syncFromGravityForms()
    toast.success(`Synced ${res.synced} new submissions`, {
      description: res.existing > 0 ? `${res.existing} already existed` : undefined,
    })
  }
  catch {
    toast.error('Sync failed. Check your API credentials.')
  }
}

import { format } from 'date-fns'

const selectedItem = ref<any>(null)
const showDetailSheet = ref(false)

function showDetails(item: any) {
  selectedItem.value = item
  showDetailSheet.value = true
}

function formatDate(date: string) {
  if (!date) return '—'
  return format(new Date(date), 'MMM dd, yyyy h:mm a')
}

async function handleStatusUpdate(id: string, status: string) {
  await updateSubmission(id, { status } as any)
  if (selectedItem.value && selectedItem.value._id === id) {
     selectedItem.value.status = status
  }
  toast.success(`Status updated to ${status}`)
}
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
          <!-- View Toggle -->
          <div class="bg-muted p-0.5 hidden sm:flex rounded-lg items-center shadow-inner border border-input/50 h-8 sm:h-9">
            <button
              @click="viewMode = 'calendar'"
              class="px-2.5 h-full rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
              :class="viewMode === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
            >
              <Icon name="i-lucide-calendar" class="size-3.5" />
            </button>
            <button
              @click="viewMode = 'list'"
              class="px-2.5 h-full rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all"
              :class="viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
            >
              <Icon name="i-lucide-list" class="size-3.5" />
            </button>
          </div>
          <button
            class="inline-flex items-center justify-center gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shrink-0 shadow-lg shadow-primary/20"
            :disabled="isSyncing"
            @click="handleSync"
          >
            <Icon name="i-lucide-refresh-cw" class="size-3.5" :class="isSyncing ? 'animate-spin' : ''" />
            <span class="hidden sm:inline">{{ isSyncing ? 'Syncing...' : 'Sync' }}</span>
          </button>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- Calendar View -->
    <CrmCalendarView
      v-if="viewMode === 'calendar'"
      :items="items"
      :is-loading="isLoading"
      @update-status="handleStatusUpdate"
      @select="showDetails"
      class="min-h-[700px]"
    />

    <!-- List View -->
    <CrmSubmissionsTable
      v-else
      :items="items"
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
              <SheetTitle class="text-lg">{{ selectedItem.name || 'Unknown Contact' }}</SheetTitle>
              <SheetDescription>Calendly Appointment</SheetDescription>
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
              <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 shrink-0" />
              <div class="flex flex-col">
                 <span class="font-bold text-foreground">Scheduled for:</span>
                 <span class="text-muted-foreground">{{ formatDate(selectedItem.fields.meetingScheduled.startTime) }}</span>
              </div>
            </div>
          </div>

          <Separator />
          
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
             <span
              class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium capitalize w-fit"
              :class="selectedItem.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-sky-500/15 text-sky-600'"
            >
              Status: {{ selectedItem.status }}
            </span>
            <span class="text-xs text-muted-foreground sm:ml-auto">
              Booked {{ formatDate(selectedItem.dateSubmitted) }}
            </span>
          </div>

          <div v-if="selectedItem.message" class="space-y-2">
            <h4 class="text-sm font-medium text-foreground">Message / Notes</h4>
            <div class="rounded-lg bg-muted/30 p-4 text-sm text-foreground/80 leading-relaxed border border-border/50 whitespace-pre-wrap">
              {{ selectedItem.message }}
            </div>
          </div>

          <div v-if="selectedItem.fields && Object.keys(selectedItem.fields).length > 0" class="space-y-2">
            <h4 class="text-sm font-medium text-foreground">Additional Details</h4>
            <div class="rounded-lg border border-border/50 overflow-hidden divide-y divide-border/50">
              <div
                v-for="(entry, index) in Object.entries(selectedItem.fields).filter(([k]) => k !== 'meetingScheduled')"
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
