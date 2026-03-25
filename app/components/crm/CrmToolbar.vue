<script setup lang="ts">
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

const props = withDefaults(defineProps<{
  searchQuery?: string
  statusFilter: string
  isSyncing?: boolean
  totalItems?: number
  hideSearch?: boolean
  hideSync?: boolean
}>(), {
  searchQuery: '',
  isSyncing: false,
  totalItems: 0,
  hideSearch: false,
  hideSync: false,
})

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void
  (e: 'update:statusFilter', value: string): void
  (e: 'sync'): void
}>()

const statuses = [
  { label: 'All Statuses', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Archived', value: 'archived' },
]
</script>

<template>
  <div class="flex items-center gap-3 flex-wrap">
    <!-- Search -->
    <div v-if="!hideSearch" class="relative flex-1 min-w-[200px] max-w-sm">
      <Icon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <input
        :value="searchQuery"
        type="text"
        placeholder="Search contacts..."
        class="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <ClientOnly>
      <!-- Status Filter -->
      <Select :model-value="statusFilter" @update:model-value="emit('update:statusFilter', $event as string)">
        <SelectTrigger class="w-[160px] h-9">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="s in statuses" :key="s.value" :value="s.value">
            {{ s.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <template #fallback>
        <div class="w-[160px] h-9 rounded-lg border border-input bg-background" />
      </template>
    </ClientOnly>

    <div class="flex items-center gap-2 ml-auto">
      <!-- Count Badge -->
      <span v-if="totalItems > 0" class="text-xs text-muted-foreground tabular-nums">
        {{ totalItems }} {{ totalItems === 1 ? 'result' : 'results' }}
      </span>

      <!-- Sync Button -->
      <button
        v-if="!hideSync"
        class="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
        :disabled="isSyncing"
        @click="emit('sync')"
      >
        <Icon
          name="i-lucide-refresh-cw"
          class="size-3.5 transition-transform duration-700"
          :class="isSyncing ? 'animate-spin' : ''"
        />
        {{ isSyncing ? 'Syncing...' : 'Sync from WordPress' }}
      </button>
    </div>
  </div>
</template>
