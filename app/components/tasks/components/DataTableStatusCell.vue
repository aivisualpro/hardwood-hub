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
          class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted/80 active:scale-[0.97] transition-all duration-150 cursor-pointer group/status"
        >
          <component :is="status?.icon" v-if="status?.icon" class="size-3.5 text-muted-foreground group-hover/status:text-foreground transition-colors" />
          <span class="group-hover/status:text-foreground transition-colors">
            {{ status ? t(status.labelKey as any) : task.status }}
          </span>
          <Icon name="lucide:chevron-down" class="size-3 text-muted-foreground/50 opacity-0 group-hover/status:opacity-100 transition-all -ml-0.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent class="w-[190px] p-1" align="start" :side-offset="5">
        <div class="space-y-0.5">
          <button
            v-for="s in statuses"
            :key="s.value"
            class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent transition-colors"
            :class="{ 'bg-accent/60': s.value === task.status }"
            @click="select(s.value)"
          >
            <component :is="s.icon" v-if="s.icon" class="size-3.5 text-muted-foreground shrink-0" />
            <span class="flex-1 text-left">{{ t(s.labelKey as any) }}</span>
            <Icon v-if="s.value === task.status" name="lucide:check" class="size-3.5 text-primary shrink-0" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
