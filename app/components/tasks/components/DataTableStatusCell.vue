<script setup lang="ts">
import type { Task } from '../data/schema'
import { statuses } from '../data/data'
import { inject, ref } from 'vue'

const props = defineProps<{ task: Task }>()
const { t } = useLocale()

const context = inject<{
  updateTask: (taskId: string, updates: Partial<Task>) => void
}>('task-table-context')

const status = computed(() => statuses.find(s => s.value === props.task.status))
const open = ref(false)

// Color map for status chips
const statusColors: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  backlog: { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', ring: 'ring-slate-500/20', dot: 'bg-slate-500' },
  todo: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/20', dot: 'bg-blue-500' },
  'in progress': { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/20', dot: 'bg-amber-500' },
  done: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/20', dot: 'bg-emerald-500' },
  canceled: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-500/20', dot: 'bg-red-500' },
}

const defaultColor = { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', ring: 'ring-slate-500/20', dot: 'bg-slate-500' }

function getColors(value: string) {
  return statusColors[value] ?? defaultColor
}

function select(value: string) {
  context?.updateTask(props.task.id, { status: value })
  open.value = false
}
</script>

<template>
  <div @click.stop>
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <button
          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition-all duration-200 hover:shadow-sm active:scale-[0.96] cursor-pointer"
          :class="[getColors(task.status).bg, getColors(task.status).text, getColors(task.status).ring]"
        >
          <span class="size-1.5 rounded-full animate-pulse" :class="task.status === 'in progress' ? getColors(task.status).dot : ''" />
          <span v-if="task.status !== 'in progress'" class="size-1.5 rounded-full" :class="getColors(task.status).dot" />
          {{ status ? t(status.labelKey as any) : task.status }}
        </button>
      </PopoverTrigger>
      <PopoverContent class="w-[200px] p-1.5" align="start" :side-offset="5">
        <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">Change Status</p>
        <div class="space-y-0.5">
          <button
            v-for="s in statuses"
            :key="s.value"
            class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent/80 transition-all duration-150"
            :class="{ 'bg-accent/50': s.value === task.status }"
            @click="select(s.value)"
          >
            <span class="size-2 rounded-full shrink-0" :class="getColors(s.value).dot" />
            <span class="flex-1 text-left text-xs font-medium">{{ t(s.labelKey as any) }}</span>
            <Icon v-if="s.value === task.status" name="lucide:check" class="size-3.5 text-primary shrink-0" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
