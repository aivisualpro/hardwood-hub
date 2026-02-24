<script setup lang="ts">
import type { Task } from '../data/schema'
import { priorities } from '../data/data'
import { inject, ref } from 'vue'

const props = defineProps<{ task: Task }>()
const { t } = useLocale()

const context = inject<{
  updateTask: (taskId: string, updates: Partial<Task>) => void
}>('task-table-context')

const priority = computed(() => priorities.find(p => p.value === props.task.priority))
const open = ref(false)

// Color map for priority chips
const priorityColors: Record<string, { bg: string; text: string; ring: string; icon: string }> = {
  low: { bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', ring: 'ring-sky-500/20', icon: 'lucide:arrow-down' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/20', icon: 'lucide:minus' },
  high: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', ring: 'ring-rose-500/20', icon: 'lucide:arrow-up' },
}

const defaultColor = { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/20', icon: 'lucide:minus' }

function getColors(value: string) {
  return priorityColors[value] ?? defaultColor
}

function select(value: string) {
  context?.updateTask(props.task.id, { priority: value })
  open.value = false
}
</script>

<template>
  <div @click.stop>
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <button
          class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition-all duration-200 hover:shadow-sm active:scale-[0.96] cursor-pointer"
          :class="[getColors(task.priority).bg, getColors(task.priority).text, getColors(task.priority).ring]"
        >
          <Icon :name="getColors(task.priority).icon" class="size-3" />
          {{ priority ? t(priority.labelKey as any) : task.priority }}
        </button>
      </PopoverTrigger>
      <PopoverContent class="w-[180px] p-1.5" align="start" :side-offset="5">
        <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">Set Priority</p>
        <div class="space-y-0.5">
          <button
            v-for="p in priorities"
            :key="p.value"
            class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent/80 transition-all duration-150"
            :class="{ 'bg-accent/50': p.value === task.priority }"
            @click="select(p.value)"
          >
            <Icon :name="getColors(p.value).icon" class="size-3.5 shrink-0" :class="getColors(p.value).text" />
            <span class="flex-1 text-left text-xs font-medium">{{ t(p.labelKey as any) }}</span>
            <Icon v-if="p.value === task.priority" name="lucide:check" class="size-3.5 text-primary shrink-0" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
