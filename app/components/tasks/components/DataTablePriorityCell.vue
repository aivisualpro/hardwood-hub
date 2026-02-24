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
          class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted/80 active:scale-[0.97] transition-all duration-150 cursor-pointer group/priority"
        >
          <component :is="priority?.icon" v-if="priority?.icon" class="size-3.5 text-muted-foreground group-hover/priority:text-foreground transition-colors" />
          <span class="group-hover/priority:text-foreground transition-colors">
            {{ priority ? t(priority.labelKey as any) : task.priority }}
          </span>
          <Icon name="lucide:chevron-down" class="size-3 text-muted-foreground/50 opacity-0 group-hover/priority:opacity-100 transition-all -ml-0.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent class="w-[170px] p-1" align="start" :side-offset="5">
        <div class="space-y-0.5">
          <button
            v-for="p in priorities"
            :key="p.value"
            class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent transition-colors"
            :class="{ 'bg-accent/60': p.value === task.priority }"
            @click="select(p.value)"
          >
            <component :is="p.icon" v-if="p.icon" class="size-3.5 text-muted-foreground shrink-0" />
            <span class="flex-1 text-left">{{ t(p.labelKey as any) }}</span>
            <Icon v-if="p.value === task.priority" name="lucide:check" class="size-3.5 text-primary shrink-0" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
