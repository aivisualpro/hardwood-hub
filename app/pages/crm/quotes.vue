<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({
  title: 'Quotes',
  icon: 'i-lucide-ruler',
  description: 'Flooring quote submissions',
})

const { canUpdate } = usePermissions('/crm/flooring-estimate')

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
} = useCrmSubmissions('flooring-estimate')

// ─── Server-first data fetching (blocks navigation until resolved) ──────
await useAsyncData('quotes-page', async () => { await fetchSubmissions(); return true }, { server: false })

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

async function handleStatusUpdate(id: string, status: string) {
  await updateSubmission(id, { status } as any)
  toast.success(`Status updated to ${status}`)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header Teleport -->
    <ClientOnly>
      <Teleport to="#header-toolbar">
        <div class="flex items-center gap-2 sm:gap-3 w-full max-w-2xl pr-2">
          <!-- Search -->
          <div class="relative flex-1">
            <Icon name="i-lucide-search" class="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search quotes..."
              class="w-full h-8 sm:h-9 pl-8 sm:pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            >
          </div>
          <!-- Status Filter -->
          <ClientOnly>
            <Select v-model="statusFilter">
              <SelectTrigger class="w-[130px] sm:w-[160px] h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Statuses
                </SelectItem>
                <SelectItem value="new">
                  New
                </SelectItem>
                <SelectItem value="contacted">
                  Contacted
                </SelectItem>
                <SelectItem value="in-progress">
                  In Progress
                </SelectItem>
                <SelectItem value="completed">
                  Completed
                </SelectItem>
                <SelectItem value="archived">
                  Archived
                </SelectItem>
              </SelectContent>
            </Select>
            <template #fallback>
              <div class="w-[130px] sm:w-[160px] h-8 sm:h-9 rounded-lg border border-input bg-background" />
            </template>
          </ClientOnly>
          <!-- Sync -->
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
      </Teleport>
    </ClientOnly>

    <!-- Table -->
    <CrmSubmissionsTable
      :items="items"
      :is-loading="isLoading"
      type="flooring-estimate"
      empty-icon="i-lucide-ruler"
      empty-title="No quotes yet"
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
  </div>
</template>
