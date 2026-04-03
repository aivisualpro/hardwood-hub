<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({
  title: 'CRM Customers',
  icon: 'i-lucide-contact',
  description: 'Manage all leads and subscribers',
})

const {
  items,
  isLoading,
  isSyncing,
  stats,
  searchQuery,
  statusFilter,
  typeFilter,
  currentPage,
  totalItems,
  fetchSubmissions,
  fetchStats,
  syncFromGravityForms,
  updateSubmission,
  toggleStar,
} = useCrmSubmissions()

onMounted(async () => {
  await Promise.all([fetchSubmissions(), fetchStats()])
})

const syncHint = ref('')

async function handleSync() {
  syncHint.value = ''
  try {
    const res = await syncFromGravityForms()
    if (res.hint) {
      syncHint.value = res.hint
      toast.warning('Sync completed with issues', {
        description: res.hint,
        duration: 8000,
      })
    }
    else {
      toast.success(`Synced ${res.synced} new submissions`, {
        description: res.existing > 0 ? `${res.existing} already existed` : undefined,
      })
    }
  }
  catch {
    toast.error('Sync failed. Check your API credentials.')
  }
}

async function handleStatusUpdate(id: string, status: string) {
  await updateSubmission(id, { status } as any)
  toast.success(`Status updated to ${status}`)
}

function statValue(key: string, obj?: Record<string, number>) {
  return obj?.[key] || 0
}

const tabs = [
  { id: 'all', label: 'All', icon: 'i-lucide-users' },
  { id: 'appointment', label: 'Appointments', icon: 'i-lucide-calendar-check' },
  { id: 'fast-quote', label: 'Fast Quotes', icon: 'i-lucide-zap' },
  { id: 'flooring-estimate', label: 'Estimates', icon: 'i-lucide-ruler' },
  { id: 'subscriber', label: 'Subscribers', icon: 'i-lucide-mail-check' },
  { id: 'conditional-logic', label: 'Conditional Logic', icon: 'i-lucide-split' },
]

function getCount(id: string) {
  if (id === 'all')
    return stats.value?.totalCount || 0
  return stats.value?.byType?.[id] || 0
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header Teleport -->
    <Teleport to="#header-toolbar">
      <div class="flex items-center gap-2 sm:gap-3 w-full max-w-xl pr-2">
        <div class="relative flex-1">
          <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search leads..."
            class="w-full h-8 sm:h-9 pl-8 sm:pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          >
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

    <!-- API Hint Banner -->
    <div
      v-if="syncHint"
      class="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
    >
      <Icon name="i-lucide-alert-triangle" class="size-5 text-amber-500 shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="font-medium text-foreground">API Setup Required</p>
        <p class="text-muted-foreground mt-1">
          {{ syncHint }}
        </p>
      </div>
      <button class="text-muted-foreground hover:text-foreground" @click="syncHint = ''">
        <Icon name="i-lucide-x" class="size-4" />
      </button>
    </div>

    <!-- Tabs Container -->
    <div class="flex flex-col gap-4">
      <div class="sticky top-(--header-height) z-30 bg-background/95 backdrop-blur-sm -mx-4 lg:-mx-6 px-4 lg:px-6 pt-2 border-b">
        <div class="flex items-center justify-between pb-1 overflow-x-auto no-scrollbar">
          <div class="flex items-center gap-0.5 min-w-max">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="relative flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold transition-all whitespace-nowrap"
              :class="typeFilter === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
              @click="typeFilter = tab.id"
            >
              <Icon :name="tab.icon" class="size-3.5 sm:size-4" />
              {{ tab.label }}
              <span
                v-if="getCount(tab.id) >= 0"
                class="ml-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold tabular-nums"
                :class="typeFilter === tab.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'"
              >
                {{ getCount(tab.id) }}
              </span>
              <!-- Active Indicator -->
              <div
                v-if="typeFilter === tab.id"
                class="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_0_8px_rgba(var(--primary),0.3)]"
              />
            </button>
          </div>
 
          <!-- Secondary Filters (Status) - Hidden on mobile if redundant -->
          <CrmToolbar
            v-model:search-query="searchQuery"
            v-model:status-filter="statusFilter"
            :is-syncing="isSyncing"
            :total-items="totalItems"
            class="!max-w-none !flex-none hidden xl:flex"
            hide-search
            hide-sync
          />
        </div>
      </div>

      <!-- Table Wrapper -->
      <div class="relative">
        <CrmSubmissionsTable
          :items="items"
          :is-loading="isLoading"
          :show-type-column="typeFilter === 'all'"
          class="sticky-header"
          empty-icon="i-lucide-contact"
          empty-title="No contacts yet"
          empty-description="Try adjusting your filters or syncing from WordPress"
          @toggle-star="toggleStar"
          @update-status="handleStatusUpdate"
        />
      </div>

      <!-- Pagination -->
      <div v-if="totalItems > 50" class="flex items-center justify-center gap-2 pt-2">
        <button
          class="h-8 px-4 rounded-lg border bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40"
          :disabled="isLoading || items.length >= totalItems"
          @click="fetchSubmissions(currentPage + 1)"
        >
          {{ isLoading ? 'Loading...' : 'Load more' }}
        </button>
      </div>
    </div>
  </div>
</template>
