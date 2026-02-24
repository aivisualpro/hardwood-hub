<script setup lang="ts">
import type { Task } from '../data/schema'
import { inject, ref } from 'vue'

const props = defineProps<{ task: Task }>()

const context = inject<{
  updateTask: (taskId: string, updates: Partial<Task>) => void
  availableAssignees: { id: string; name: string; avatar: string }[]
}>('task-table-context')

const open = ref(false)

const assignees = computed(() => {
  const ids = props.task.assignees || []
  if (!context?.availableAssignees) return []
  return ids
    .map(id => context.availableAssignees.find(a => a.id === id))
    .filter(Boolean) as { id: string; name: string; avatar: string }[]
})

function getInitials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const avatarColors = [
  'bg-violet-500/80',
  'bg-sky-500/80',
  'bg-emerald-500/80',
  'bg-amber-500/80',
  'bg-rose-500/80',
  'bg-indigo-500/80',
  'bg-teal-500/80',
  'bg-pink-500/80',
]

function getColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function toggleAssignee(id: string) {
  const current = props.task.assignees || []
  const updated = current.includes(id)
    ? current.filter(a => a !== id)
    : [...current, id]
  context?.updateTask(props.task.id, { assignees: updated })
}
</script>

<template>
  <div @click.stop>
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <button
          class="inline-flex items-center rounded-md px-1 py-0.5 hover:bg-muted/80 active:scale-[0.97] transition-all duration-150 cursor-pointer group/assignee"
        >
          <!-- Stacked avatars with tooltips -->
          <template v-if="assignees.length">
            <div class="flex -space-x-1.5">
              <Tooltip v-for="(a, i) in assignees.slice(0, 3)" :key="a.id">
                <TooltipTrigger as-child>
                  <div
                    class="relative flex items-center justify-center size-6 rounded-full border-2 border-background text-[10px] font-semibold text-white shadow-sm transition-transform group-hover/assignee:translate-x-0"
                    :class="getColor(a.id)"
                    :style="{ zIndex: 10 - i }"
                  >
                    {{ getInitials(a.name) }}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" :side-offset="4">
                  <p class="text-xs font-medium">{{ a.name }}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip v-if="assignees.length > 3">
                <TooltipTrigger as-child>
                  <div
                    class="relative flex items-center justify-center size-6 rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground shadow-sm"
                    :style="{ zIndex: 6 }"
                  >
                    +{{ assignees.length - 3 }}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" :side-offset="4">
                  <p class="text-xs font-medium">{{ assignees.slice(3).map(a => a.name).join(', ') }}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </template>
          <!-- Unassigned placeholder -->
          <template v-else>
            <div class="flex items-center gap-1 text-muted-foreground/50 group-hover/assignee:text-muted-foreground transition-colors">
              <div class="flex items-center justify-center size-6 rounded-full border-2 border-dashed border-muted-foreground/30 group-hover/assignee:border-muted-foreground/50 transition-colors">
                <Icon name="lucide:user-plus" class="size-3" />
              </div>
            </div>
          </template>
        </button>
      </PopoverTrigger>
      <PopoverContent class="w-[220px] p-1" align="start" :side-offset="5">
        <div class="space-y-0.5">
          <button
            v-for="a in context?.availableAssignees || []"
            :key="a.id"
            class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent transition-colors"
            @click="toggleAssignee(a.id)"
          >
            <div
              class="flex h-4 w-4 items-center justify-center rounded-sm border border-primary transition-colors"
              :class="(task.assignees || []).includes(a.id) ? 'bg-primary text-primary-foreground' : 'opacity-50'"
            >
              <Icon v-if="(task.assignees || []).includes(a.id)" name="i-radix-icons-check" class="h-3 w-3" />
            </div>
            <div
              class="flex items-center justify-center size-5 rounded-full text-[9px] font-semibold text-white shrink-0"
              :class="getColor(a.id)"
            >
              {{ getInitials(a.name) }}
            </div>
            <span class="flex-1 text-left truncate">{{ a.name }}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
