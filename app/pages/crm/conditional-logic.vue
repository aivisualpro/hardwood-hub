<script setup lang="ts">
import { toast } from 'vue-sonner'

const { setHeader } = usePageHeader()
setHeader({
  title: 'Conditional Logic Leads',
  icon: 'i-lucide-split',
  description: 'Inquiries filtered by site conditional logic',
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
} = useCrmSubmissions('conditional-logic')

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

async function handleStatusUpdate(id: string, status: string) {
  await updateSubmission(id, { status } as any)
  toast.success(`Status updated to ${status}`)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header Teleport -->
    <Teleport to="#header-toolbar">
      <div class="flex items-center gap-3 w-full max-w-xl">
        <div class="relative flex-1">
          <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search inquiries..."
            class="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          >
        </div>
        <button
          class="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
          :disabled="isSyncing"
          @click="handleSync"
        >
          <Icon name="i-lucide-refresh-cw" class="size-3.5" :class="isSyncing ? 'animate-spin' : ''" />
          <span class="hidden sm:inline">{{ isSyncing ? 'Syncing...' : 'Sync' }}</span>
        </button>
      </div>
    </Teleport>

    <!-- Hero Banner -->
    <div class="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-rose-500/10 via-card to-card p-6">
      <div class="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-rose-500/5 blur-2xl" />
      <div class="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-rose-400/5 blur-xl" />
      <div class="relative flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-rose-500/15 flex items-center justify-center ring-1 ring-rose-500/20 shadow-lg shadow-rose-500/10">
          <Icon name="i-lucide-split" class="size-7 text-rose-500" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-foreground font-display">Conditional Logic Inquiries</h2>
          <p class="text-sm text-muted-foreground mt-0.5">
            Submissions from "Get in Touch with Conditional Logic" form
            <span v-if="totalItems > 0" class="text-rose-500 font-semibold">· {{ totalItems }} total</span>
          </p>
        </div>
      </div>
    </div>

    <!-- Sticky Toolbar Wrapper -->
    <div class="flex flex-col gap-4">
      <div class="sticky top-(--header-height) z-30 bg-background/95 backdrop-blur-sm -mx-4 lg:-mx-6 px-4 lg:px-6 pt-2 pb-2 border-b">
        <CrmToolbar
          v-model:search-query="searchQuery"
          v-model:status-filter="statusFilter"
          :is-syncing="isSyncing"
          :total-items="totalItems"
          hide-search
          hide-sync
        />
      </div>

      <!-- Table Section -->
      <div class="relative">
        <CrmSubmissionsTable
          :items="items"
          :is-loading="isLoading"
          type="conditional-logic"
          empty-icon="i-lucide-split"
          empty-title="No conditional inquiries yet"
          empty-description="Click 'Sync' in the header to pull in form submissions"
          @toggle-star="toggleStar"
          @update-status="handleStatusUpdate"
        />
      </div>

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
  </div>
</template>
