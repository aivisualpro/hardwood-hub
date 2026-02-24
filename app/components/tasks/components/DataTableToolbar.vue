<script setup lang="ts">
import type { Table } from '@tanstack/vue-table'
import type { Task } from '../data/schema'
import { computed } from 'vue'
import { priorities, statuses } from '../data/data'
import DataTableFacetedFilter from './DataTableFacetedFilter.vue'
import DataTableViewOptions from './DataTableViewOptions.vue'

interface DataTableToolbarProps {
  table: Table<Task>
  viewMode?: 'table' | 'kanban'
}

const props = withDefaults(defineProps<DataTableToolbarProps>(), {
  viewMode: 'table',
})

const emit = defineEmits<{
  addTask: []
  'update:viewMode': [mode: 'table' | 'kanban']
}>()

const { t } = useLocale()
const isFiltered = computed(() => props.table.getState().columnFilters.length > 0)
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- View Toggle (before search) -->
    <div class="inline-flex items-center rounded-lg border bg-muted/40 p-0.5 shrink-0">
      <button
        class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200"
        :class="viewMode === 'table'
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'"
        @click="emit('update:viewMode', 'table')"
      >
        <Icon name="lucide:table-2" class="size-3.5" />
        <span class="hidden sm:inline">Table</span>
      </button>
      <button
        class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200"
        :class="viewMode === 'kanban'
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'"
        @click="emit('update:viewMode', 'kanban')"
      >
        <Icon name="lucide:kanban" class="size-3.5" />
        <span class="hidden sm:inline">Board</span>
      </button>
    </div>

    <div class="flex flex-1 items-center gap-2">
      <Input
        :placeholder="t('tasks.filterPlaceholder' as any)"
        :model-value="(table.getColumn('title')?.getFilterValue() as string) ?? ''"
        class="h-8 w-[150px] lg:w-[250px]"
        @input="table.getColumn('title')?.setFilterValue($event.target.value)"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('status')"
        :column="table.getColumn('status')"
        title-key="tasks.col.status"
        :options="statuses"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('priority')"
        :column="table.getColumn('priority')"
        title-key="tasks.col.priority"
        :options="priorities"
      />

      <Button
        v-if="isFiltered"
        variant="ghost"
        class="h-8 px-2 lg:px-3"
        @click="table.resetColumnFilters()"
      >
        {{ t('tasks.reset' as any) }}
        <Icon name="i-radix-icons-cross-2" class="ml-2 h-4 w-4" />
      </Button>
    </div>

    <DataTableViewOptions :table="table" />

    <Button
      size="sm"
      class="h-8"
      @click="emit('addTask')"
    >
      <Icon name="lucide:plus" class="size-4 mr-1" />
      {{ t('tasks.addTask' as any) }}
    </Button>
  </div>
</template>
